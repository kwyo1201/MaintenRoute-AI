"use client";

import { useEffect, useState } from "react";
import { PageHero, RegistrySection } from "@/components/OverviewPage";

type Candidate = {
  model: string;
  threshold: number;
  validation_pr_auc: number | null;
  validation_f1?: number | null;
  test_pr_auc?: number;
  test_f1?: number;
  test_recall?: number;
  selected: boolean;
  mlflow_run_id: string | null;
};
type ModelOps = {
  dataset: {
    name: string; rows: number; feature_count: number; failure_count: number; failure_rate: number;
    missing_cells: number; duplicate_rows: number; excluded_leakage_columns: string[];
  };
  active_model: {
    name: string; threshold: number; selection_metric: string;
    threshold_metric: string; test_metrics: Record<string, number>;
  };
  historical_candidates: Candidate[];
  global_feature_importance: { feature: string; importance: number }[];
};
type SelectionStatus = {
  status: "idle" | "queued" | "running" | "completed" | "failed";
  message: string;
  result?: {
    dataset: string; recommended_model: string; recommended_threshold: number;
    train_rows: number; validation_rows: number; candidates: Candidate[];
  };
};

const score = (value: number | null | undefined) =>
  typeof value === "number" ? value.toFixed(3) : "—";

export function ModelOpsPage() {
  const [health, setHealth] = useState("checking");
  const [ops, setOps] = useState<ModelOps | null>(null);
  const [selection, setSelection] = useState<SelectionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [changingDataset, setChangingDataset] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const responses = await Promise.all([
          fetch("/api/health"), fetch("/api/model-ops"), fetch("/api/model-selection")
        ]);
        if (!responses[1].ok) throw new Error("Model operations data could not be loaded.");
        const [healthPayload, opsPayload, statusPayload] = await Promise.all(
          responses.map((response) => response.json())
        );
        if (active) {
          setHealth(responses[0].ok ? String(healthPayload.status) : "offline");
          setOps(opsPayload as ModelOps);
          if (responses[2].ok) setSelection(statusPayload as SelectionStatus);
        }
      } catch (caught) {
        if (active) {
          setHealth("offline");
          setError(caught instanceof Error ? caught.message : "Model operations unavailable.");
        }
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (selection?.status !== "queued" && selection?.status !== "running") return;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch("/api/model-selection", { cache: "no-store" });
        if (!response.ok) throw new Error("Experiment status unavailable.");
        setSelection(await response.json() as SelectionStatus);
      } catch {
        setError("Could not refresh experiment status. Reload to check its result.");
        window.clearInterval(timer);
      }
    }, 1800);
    return () => window.clearInterval(timer);
  }, [selection?.status]);

  async function startSelection() {
    setError(null);
    try {
      const response = await fetch("/api/model-selection", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || "Model selection could not start.");
      setSelection({ status: "queued", message: `Preparing candidates for ${data?.name ?? "training data"}.` });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Model selection could not start.");
    }
  }

  async function changeDataset(method: "POST" | "DELETE") {
    setError(null);
    setChangingDataset(true);
    try {
      const form = new FormData();
      if (method === "POST") {
        if (!csvFile) throw new Error("Choose a CSV file first.");
        form.append("file", csvFile);
      }
      const response = await fetch("/api/training-dataset", {
        method,
        ...(method === "POST" ? { body: form } : {})
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || "Could not change training data.");
      const refreshed = await fetch("/api/model-ops", { cache: "no-store" });
      if (!refreshed.ok) throw new Error("Dataset saved, but the view could not refresh.");
      setOps(await refreshed.json() as ModelOps);
      setCsvFile(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not change training data.");
    } finally {
      setChangingDataset(false);
    }
  }

  const activeModel = ops?.active_model;
  const data = ops?.dataset;
  const running = selection?.status === "queued" || selection?.status === "running";

  return (
    <>
      <PageHero eyebrow="MLOPS" title="Model Operations"
        copy="Inspect data quality, understand model selection, and track a fresh candidate experiment."
        badge={`FastAPI · ${health}`} />
      {error && <div className="errorMessage" role="alert">{error}</div>}
      {!ops && !error && <p className="opsLoading">Loading dataset and model records…</p>}

      {data && (
        <RegistrySection code="MOD-001" label="data review" title="Dataset Health" meta={data.name}>
          <div className="opsDatasetHeader">
            <div><span className="opsCardLabel">TRAINING SOURCE</span><strong>{data.name}</strong></div>
            <div className="opsDatasetControls">
              <label className="opsFilePicker">Choose AI4I-style CSV
                <input type="file" accept=".csv,text/csv" disabled={running || changingDataset}
                  onChange={(event) => {
                    setCsvFile(event.target.files?.[0] ?? null);
                    event.target.value = "";
                  }} />
              </label>
              <span className="opsChosenFile">{csvFile?.name ?? "No file selected"}</span>
              <button type="button" onClick={() => void changeDataset("POST")} disabled={!csvFile || running || changingDataset}>Use CSV</button>
              <button type="button" onClick={() => void changeDataset("DELETE")} disabled={running || changingDataset || !data.name.startsWith("Uploaded:")}>Restore sample</button>
            </div>
          </div>
          <div className="opsKpiGrid">
            <OpsMetric label="observations" value={data.rows.toLocaleString()} />
            <OpsMetric label="input features" value={String(data.feature_count)} />
            <OpsMetric label="failure examples" value={String(data.failure_count)} />
            <OpsMetric label="failure rate" value={`${(data.failure_rate * 100).toFixed(2)}%`} />
            <OpsMetric label="missing cells" value={String(data.missing_cells)} />
            <OpsMetric label="duplicate rows" value={String(data.duplicate_rows)} />
          </div>
          <p className="opsCaption">CSV needs Type, five numeric sensor columns, and binary Machine failure labels (at least 1,000 rows and 40 per class). Only these six features train candidate models. {data.excluded_leakage_columns.length > 0 && `Failure-mode indicators (${data.excluded_leakage_columns.join(", ")}) are excluded to prevent target leakage.`} The built-in sample is synthetic. Uploading changes the experiment dataset, not the deployed model or live planning data.</p>
        </RegistrySection>
      )}

      {activeModel && (
        <RegistrySection code="MOD-002" label="serving" title="Active Model" meta="frozen deployment / FastAPI">
          <div className="opsActiveGrid">
            <div className="opsModelCard">
              <div className="opsStatus"><span className={`statusLamp ${health === "offline" ? "offline" : ""}`} />{health}</div>
              <strong className="opsModelName">{activeModel.name}</strong>
              <p>Operating alert threshold <b>{activeModel.threshold.toFixed(2)}</b></p>
              <p>Candidate selected by <b>{activeModel.selection_metric}</b>; threshold tuned by <b>{activeModel.threshold_metric}</b>.</p>
              <span className="opsQuiet">This model powers Assets and Planning. Experiments below do not change it.</span>
            </div>
            <div className="opsPerformance">
              <div className="opsCardLabel">HELD-OUT TEST / SELECTED MODEL</div>
              <div className="opsMetricPairs">
                <OpsMetric label="average precision" value={score(activeModel.test_metrics.pr_auc)} />
                <OpsMetric label="recall" value={score(activeModel.test_metrics.recall)} />
                <OpsMetric label="F1" value={score(activeModel.test_metrics.f1)} />
                <OpsMetric label="ROC-AUC" value={score(activeModel.test_metrics.roc_auc)} />
              </div>
            </div>
          </div>
        </RegistrySection>
      )}

      {ops && (
        <RegistrySection code="MOD-003" label="notebook experiment" title="Candidate Comparison" meta="AI4I 2020 / validation PR-AUC">
          <div className="opsTableWrap"><table className="opsTable">
            <thead><tr><th>Candidate</th><th>Validation PR-AUC</th><th>Test PR-AUC</th><th>Test F1</th><th>Test Recall</th><th>Threshold</th></tr></thead>
            <tbody>{ops.historical_candidates.map((candidate) => (
              <tr key={candidate.model}>
                <td><strong>{candidate.model}</strong>{candidate.selected && <span className="opsSelected">DEPLOYED</span>}</td>
                <td>{score(candidate.validation_pr_auc)}</td><td>{score(candidate.test_pr_auc)}</td>
                <td>{score(candidate.test_f1)}</td><td>{score(candidate.test_recall)}</td>
                <td>{candidate.threshold.toFixed(2)}</td>
              </tr>
            ))}</tbody>
          </table></div>
          <p className="opsCaption">Model choice uses validation PR-AUC; the threshold uses validation F1. Held-out test values are evaluation results and do not choose the winner.</p>
        </RegistrySection>
      )}

      {ops && (
        <RegistrySection code="MOD-004" label="new experiment" title="Run Model Selection" meta="train / compare / track">
          <div className="opsRunHead">
            <p>Train Random Forest and XGBoost on <b>{data?.name}</b>. Compare validation PR-AUC, tune thresholds on validation F1, and log both runs in MLflow. The held-out test partition stays untouched.</p>
            <button className="primaryButton opsRunButton" type="button" onClick={startSelection} disabled={running}>
              {running ? "Experiment running…" : "Run Model Selection"}
            </button>
          </div>
          {selection && <div className={`opsRunState ${selection.status}`} role="status"><strong>{selection.status.toUpperCase()}</strong><span>{selection.message}</span></div>}
          {selection?.result && (
            <>
              <div className="opsRecommendation">{selection.result.dataset} <span>·</span> Recommended: <strong>{selection.result.recommended_model}</strong><span>·</span> threshold {selection.result.recommended_threshold.toFixed(2)}<span>·</span> {selection.result.train_rows.toLocaleString()} train / {selection.result.validation_rows.toLocaleString()} validation</div>
              <div className="opsTableWrap"><table className="opsTable">
                <thead><tr><th>New candidate</th><th>Validation PR-AUC</th><th>Validation F1</th><th>Threshold</th><th>MLflow run</th></tr></thead>
                <tbody>{selection.result.candidates.map((candidate) => (
                  <tr key={candidate.model}>
                    <td><strong>{candidate.model}</strong>{candidate.selected && <span className="opsSelected">RECOMMENDED</span>}</td>
                    <td>{score(candidate.validation_pr_auc)}</td><td>{score(candidate.validation_f1)}</td>
                    <td>{candidate.threshold.toFixed(2)}</td>
                    <td title={candidate.mlflow_run_id || ""}>{candidate.mlflow_run_id?.slice(0, 10) ?? "—"}…</td>
                  </tr>
                ))}</tbody>
              </table></div>
              <p className="opsCaption">Runs are stored in MLflow. The serving model stays unchanged; deployment requires a separate validation step.</p>
            </>
          )}
        </RegistrySection>
      )}

      {ops && ops.global_feature_importance.length > 0 && (
        <RegistrySection code="MOD-005" label="model interpretation" title="Global Feature Importance" meta="active model / relative importance">
          <div className="opsImportance">{ops.global_feature_importance.map((item) => (
            <div className="opsImportanceRow" key={item.feature}>
              <span>{item.feature}</span><div className="opsImportanceTrack"><div style={{ width: `${(item.importance * 100).toFixed(1)}%` }} /></div>
              <strong>{(item.importance * 100).toFixed(1)}%</strong>
            </div>
          ))}</div>
          <p className="opsCaption">Importance describes the fitted model globally. Use Asset Analysis for sensitivity to one sensor scenario.</p>
        </RegistrySection>
      )}
    </>
  );
}

function OpsMetric({ label, value }: { label: string; value: string }) {
  return <div className="opsMetric"><span>{label}</span><strong>{value}</strong></div>;
}
