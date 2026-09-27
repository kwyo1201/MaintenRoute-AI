"""Dataset review, model selection, and explanations for the operator UI.

The deployed model is intentionally kept separate from an experiment. A new
selection run evaluates candidates but never silently replaces the model used
by live maintenance planning.
"""

from pathlib import Path
from typing import Callable
import csv
import hashlib
import json

import numpy as np
import pandas as pd
import sklearn
import xgboost
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    average_precision_score,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from xgboost import XGBClassifier


ROOT = Path(__file__).resolve().parent
RUNTIME = ROOT / "runtime"
FEATURES = [
    "Type",
    "Air temperature [K]",
    "Process temperature [K]",
    "Rotational speed [rpm]",
    "Torque [Nm]",
    "Tool wear [min]",
]
TARGET = "Machine failure"
EXCLUDED_LEAKAGE = ["TWF", "HDF", "PWF", "OSF", "RNF"]
MODEL_LABELS = {"RandomForestClassifier": "Random Forest", "XGBClassifier": "XGBoost"}
UPLOADED_DATA = RUNTIME / "training_dataset.csv"
UPLOADED_METADATA = RUNTIME / "training_dataset.json"


def validate_training_dataset(frame: pd.DataFrame) -> pd.DataFrame:
    missing = [name for name in FEATURES + [TARGET] if name not in frame]
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(missing)}")
    if not 1000 <= len(frame) <= 50000:
        raise ValueError("Upload between 1,000 and 50,000 labeled rows.")
    clean = frame[FEATURES + [TARGET]].copy()
    clean["Type"] = clean["Type"].astype("string").str.strip()
    if (clean["Type"].isna().any() or (clean["Type"] == "").any()
            or clean["Type"].nunique() > 20
            or clean["Type"].str.len().max() > 40):
        raise ValueError("Type must contain 1–20 nonempty categories of at most 40 characters.")
    for name in FEATURES[1:] + [TARGET]:
        clean[name] = pd.to_numeric(clean[name], errors="coerce")
        if clean[name].isna().any() or not np.isfinite(clean[name].to_numpy(dtype=float)).all():
            raise ValueError(f"{name} must contain finite numeric values without blanks.")
    if not clean[TARGET].isin([0, 1]).all():
        raise ValueError("Machine failure must contain only binary labels 0 and 1.")
    counts = clean[TARGET].value_counts()
    if min(int(counts.get(0, 0)), int(counts.get(1, 0))) < 40:
        raise ValueError("At least 40 examples of each failure class are needed.")
    clean[TARGET] = clean[TARGET].astype(int)
    return clean


def save_training_dataset(frame: pd.DataFrame, filename: str) -> dict:
    clean = validate_training_dataset(frame)
    RUNTIME.mkdir(exist_ok=True)
    safe_name = Path(filename).name[:100] or "uploaded.csv"
    temporary = RUNTIME / "training_dataset.tmp"
    clean.to_csv(temporary, index=False)
    temporary.replace(UPLOADED_DATA)
    digest = hashlib.sha256(UPLOADED_DATA.read_bytes()).hexdigest()
    details = {"name": safe_name, "sha256": digest}
    UPLOADED_METADATA.write_text(json.dumps(details), encoding="utf-8")
    return dataset_profile(clean, f"Uploaded: {safe_name}")


def training_dataset(default: pd.DataFrame) -> tuple[pd.DataFrame, str, str]:
    if UPLOADED_DATA.exists():
        details = json.loads(UPLOADED_METADATA.read_text(encoding="utf-8"))
        return pd.read_csv(UPLOADED_DATA), f"Uploaded: {details['name']}", details["sha256"]
    return default, "AI4I 2020 (built-in)", hashlib.sha256((ROOT / "data/raw/ai4i2020.csv").read_bytes()).hexdigest()


def reset_training_dataset() -> None:
    UPLOADED_DATA.unlink(missing_ok=True)
    UPLOADED_METADATA.unlink(missing_ok=True)


def dataset_profile(data: pd.DataFrame, name: str = "AI4I 2020 (built-in)") -> dict:
    columns = FEATURES + [TARGET]
    failures = int((data[TARGET] == 1).sum())
    return {
        "name": name,
        "rows": int(len(data)),
        "feature_count": len(FEATURES),
        "failure_count": failures,
        "failure_rate": failures / len(data),
        "missing_cells": int(data[columns].isna().sum().sum()),
        "duplicate_rows": int(data[columns].duplicated().sum()),
        "excluded_leakage_columns": [col for col in EXCLUDED_LEAKAGE if col in data],
    }


def historical_comparison() -> list[dict]:
    """Use the recorded notebook experiment, without treating test as selection data."""
    comparison_path = ROOT / "data" / "processed" / "model_comparison.csv"
    runs_path = ROOT / "data" / "processed" / "mlflow_run_summary.csv"

    with comparison_path.open(newline="", encoding="utf-8-sig") as file:
        test_rows = list(csv.DictReader(file))
    with runs_path.open(newline="", encoding="utf-8-sig") as file:
        tracked_rows = list(csv.DictReader(file))

    validation = {}
    for row in tracked_rows:
        if row.get("tags.stage") == "candidate_evaluation":
            label = MODEL_LABELS.get(row.get("params.model_type"))
            if label:
                validation[label] = row

    result = []
    for row in test_rows:
        name = row["Model"]
        tracked = validation.get(name, {})
        result.append({
            "model": name,
            "threshold": float(row["Threshold"]),
            "validation_pr_auc": float(tracked["metrics.val_average_precision"])
            if tracked.get("metrics.val_average_precision") else None,
            "validation_f1": float(tracked["metrics.val_f1"])
            if tracked.get("metrics.val_f1") else None,
            "test_pr_auc": float(row["PR-AUC"]),
            "test_f1": float(row["F1"]),
            "test_recall": float(row["Recall"]),
            "selected": row["Selected"].strip().lower() == "true",
            "mlflow_run_id": tracked.get("run_id") or None,
        })
    return sorted(result, key=lambda item: item["validation_pr_auc"] or -1, reverse=True)


def global_feature_importance(deployed_model) -> list[dict]:
    """Aggregate one-hot type categories into a single global feature."""
    try:
        transformed = deployed_model.named_steps["preprocessor"]
        estimator = deployed_model.named_steps["model"]
        names = transformed.get_feature_names_out()
        weights = estimator.feature_importances_
        grouped: dict[str, float] = {}
        for name, weight in zip(names, weights):
            label = str(name).split("__", 1)[-1]
            if label.startswith("Type_"):
                label = "Type"
            grouped[label] = grouped.get(label, 0.0) + float(weight)
        total = sum(grouped.values()) or 1.0
        return [
            {"feature": feature, "importance": score / total}
            for feature, score in sorted(grouped.items(), key=lambda item: -item[1])
        ]
    except (AttributeError, KeyError, ValueError):
        return []


def scenario_sensitivity(deployed_model, data: pd.DataFrame, sensor: dict) -> dict:
    """Compare one input at a time to the dataset median/mode; not a causal claim."""
    current = pd.DataFrame([sensor], columns=FEATURES)
    risk = float(deployed_model.predict_proba(current)[0, 1])
    rows = []
    for feature in FEATURES:
        typical = (
            data[feature].mode().iloc[0] if feature == "Type"
            else float(data[feature].median())
        )
        reference = current.copy()
        reference.loc[0, feature] = typical
        reference_risk = float(deployed_model.predict_proba(reference)[0, 1])
        rows.append({
            "feature": feature,
            "current_value": str(sensor[feature]),
            "reference_value": str(typical),
            "risk_difference_points": round((risk - reference_risk) * 100, 2),
        })
    return {
        "failure_risk": risk,
        "method": "One feature at a time is set to its dataset median (mode for Type).",
        "limitations": "Model sensitivity for this input; correlated sensors and causality are not evaluated.",
        "features": sorted(rows, key=lambda item: -abs(item["risk_difference_points"])),
    }


def _metrics(y_true, probabilities: np.ndarray, threshold: float) -> dict:
    predicted = probabilities >= threshold
    return {
        "pr_auc": float(average_precision_score(y_true, probabilities)),
        "roc_auc": float(roc_auc_score(y_true, probabilities)),
        "f1": float(f1_score(y_true, predicted, zero_division=0)),
        "precision": float(precision_score(y_true, predicted, zero_division=0)),
        "recall": float(recall_score(y_true, predicted, zero_division=0)),
    }


def _best_threshold(y_true, probabilities: np.ndarray) -> float:
    return float(max(
        np.round(np.arange(0.05, 0.951, 0.01), 2),
        key=lambda threshold: (
            f1_score(y_true, probabilities >= threshold, zero_division=0),
            recall_score(y_true, probabilities >= threshold, zero_division=0),
            precision_score(y_true, probabilities >= threshold, zero_division=0),
        ),
    ))


def run_model_selection(data: pd.DataFrame, report: Callable[[str], None], source: str = "AI4I 2020 (built-in)", digest: str = "") -> dict:
    """Replay notebook candidate training on the built-in data and track new runs.

    The 20% held-out test partition is not inspected by this repeatable UI
    experiment. Model and threshold selection use only the validation split.
    """
    import mlflow

    RUNTIME.mkdir(exist_ok=True)
    tracking_uri = f"sqlite:///{RUNTIME / 'selection.db'}"
    mlflow.set_tracking_uri(tracking_uri)
    experiment_name = "MaintenRoute AI - App Model Selection"
    experiment = mlflow.get_experiment_by_name(experiment_name)
    if experiment is None:
        experiment_id = mlflow.create_experiment(
            experiment_name,
            artifact_location=(RUNTIME / "artifacts").resolve().as_uri(),
        )
    else:
        experiment_id = experiment.experiment_id

    X = data[FEATURES].copy()
    y = data[TARGET].copy()
    X_pool, _, y_pool, _ = train_test_split(
        X, y, test_size=0.20, stratify=y, random_state=42,
    )
    X_train, X_val, y_train, y_val = train_test_split(
        X_pool, y_pool, test_size=0.20, stratify=y_pool, random_state=42,
    )
    positive = int(y_train.sum())
    if positive == 0 or positive == len(y_train):
        raise ValueError("Training data must contain both failure classes.")

    def preprocessor():
        return ColumnTransformer([
            ("categorical", OneHotEncoder(handle_unknown="ignore"), ["Type"]),
            ("numeric", "passthrough", FEATURES[1:]),
        ])

    candidates = {
        "Random Forest": RandomForestClassifier(
            n_estimators=300, class_weight="balanced", random_state=42, n_jobs=-1,
        ),
        "XGBoost": XGBClassifier(
            n_estimators=400, max_depth=4, learning_rate=0.05,
            subsample=0.80, colsample_bytree=0.80, min_child_weight=1,
            reg_lambda=1.0, scale_pos_weight=(len(y_train) - positive) / positive,
            objective="binary:logistic", eval_metric="logloss", random_state=42,
            n_jobs=-1, tree_method="hist",
        ),
    }

    rows = []
    for name, estimator in candidates.items():
        report(f"Training {name}")
        pipeline = Pipeline([("preprocessor", preprocessor()), ("model", estimator)])
        pipeline.fit(X_train, y_train)
        probabilities = pipeline.predict_proba(X_val)[:, 1]
        threshold = _best_threshold(y_val, probabilities)
        metrics = _metrics(y_val, probabilities, threshold)
        with mlflow.start_run(experiment_id=experiment_id, run_name=name) as run:
            mlflow.set_tags({"project": "MaintenRoute AI", "dataset": source, "dataset_sha256": digest, "stage": "app_candidate"})
            mlflow.log_params({
                "candidate": name,
                "train_rows": len(X_train),
                "validation_rows": len(X_val),
                "operating_threshold": threshold,
                "selection_metric": "validation_pr_auc",
                "threshold_metric": "validation_f1",
                "random_state": 42,
                "sklearn_version": sklearn.__version__,
                "xgboost_version": xgboost.__version__,
                "n_estimators": estimator.n_estimators,
                "preprocessing": "OneHot(Type)+NumericPassthrough",
            })
            mlflow.log_metrics({f"validation_{key}": value for key, value in metrics.items()})
            run_id = run.info.run_id
        rows.append({
            "model": name,
            "threshold": threshold,
            "validation_pr_auc": metrics["pr_auc"],
            "validation_f1": metrics["f1"],
            "validation_recall": metrics["recall"],
            "mlflow_run_id": run_id,
        })

    rows.sort(key=lambda row: (row["validation_pr_auc"], row["validation_f1"], row["validation_recall"]), reverse=True)
    winner = rows[0]
    for row in rows:
        row["selected"] = row is winner
    result = {
        "dataset": source,
        "dataset_sha256": digest,
        "train_rows": len(X_train),
        "validation_rows": len(X_val),
        "held_out_rows": len(y) - len(y_pool),
        "selection_metric": "Validation PR-AUC",
        "threshold_metric": "Validation F1",
        "recommended_model": winner["model"],
        "recommended_threshold": winner["threshold"],
        "candidates": rows,
        "tracking": "MLflow SQLite",
        "deployment_changed": False,
    }
    output = RUNTIME / "last_selection.json"
    temporary = RUNTIME / "last_selection.tmp"
    temporary.write_text(json.dumps(result, indent=2), encoding="utf-8")
    temporary.replace(output)
    return result
