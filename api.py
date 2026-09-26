# ============================================================
# MaintenRoute AI
# FastAPI Inference Service
# ============================================================

from pathlib import Path
import json
import heapq
import math

import numpy as np

import joblib
import pandas as pd

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


# ============================================================
# PROJECT PATHS
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parent

MODEL_PATH = (
    PROJECT_ROOT
    / "models"
    / "best_model.joblib"
)

METADATA_PATH = (
    PROJECT_ROOT
    / "models"
    / "model_selection_metadata.json"
)

DATA_PATH = (
    PROJECT_ROOT
    / "data"
    / "raw"
    / "ai4i2020.csv"
)

ASSET_MAPPING_PATH = (
    PROJECT_ROOT
    / "data"
    / "processed"
    / "asset_failure_risks.csv"
)


# ============================================================
# REQUIRED FILE CHECK
# ============================================================

required_files = [
    MODEL_PATH,
    METADATA_PATH,
    DATA_PATH,
    ASSET_MAPPING_PATH,
]

missing_files = [
    path
    for path in required_files
    if not path.exists()
]

if missing_files:
    missing_text = "\n".join(
        str(path)
        for path in missing_files
    )

    raise FileNotFoundError(
        f"Required project files are missing:\n{missing_text}"
    )


# ============================================================
# LOAD MODEL + METADATA
# ============================================================

model = joblib.load(
    MODEL_PATH
)

with open(
    METADATA_PATH,
    "r",
    encoding="utf-8",
) as file:
    model_metadata = json.load(
        file
    )

SELECTED_MODEL = (
    model_metadata.get(
        "selected_model",
        "Unknown",
    )
)

SELECTED_THRESHOLD = float(
    model_metadata.get(
        "selected_threshold",
        0.50,
    )
)

TEST_METRICS = (
    model_metadata.get(
        "test_metrics",
        {},
    )
)


# ============================================================
# DATA / FEATURE RANGES
# ============================================================

raw_data = pd.read_csv(
    DATA_PATH
)

asset_mapping = (
    pd.read_csv(
        ASSET_MAPPING_PATH
    )
    .sort_values(
        "Asset ID"
    )
    .reset_index(
        drop=True
    )
)

FEATURE_COLUMNS = [
    "Type",
    "Air temperature [K]",
    "Process temperature [K]",
    "Rotational speed [rpm]",
    "Torque [Nm]",
    "Tool wear [min]",
]

NUMERIC_FEATURES = [
    "Air temperature [K]",
    "Process temperature [K]",
    "Rotational speed [rpm]",
    "Torque [Nm]",
    "Tool wear [min]",
]

VALID_TYPES = sorted(
    raw_data[
        "Type"
    ]
    .dropna()
    .unique()
    .tolist()
)

FEATURE_RANGES = {}

for feature in NUMERIC_FEATURES:
    FEATURE_RANGES[
        feature
    ] = {
        "min": float(
            raw_data[
                feature
            ].min()
        ),
        "max": float(
            raw_data[
                feature
            ].max()
        ),
    }


# ============================================================
# DEFAULT FACTORY / PLANNING CONFIGURATION
# ============================================================

DEFAULT_GRID_WIDTH = 20
DEFAULT_GRID_HEIGHT = 11
DEFAULT_TECHNICIAN_START = (1, 5)

DEFAULT_FACTORY_POSITIONS = {
    "M01": (3, 2),
    "M02": (7, 2),
    "M03": (11, 2),
    "M04": (4, 5),
    "M05": (9, 5),
    "M06": (14, 5),
    "M07": (2, 8),
    "M08": (7, 8),
    "M09": (12, 8),
    "M10": (17, 8),
}

DEFAULT_OBSTACLES = set()

for y in range(1, 5):
    DEFAULT_OBSTACLES.add((6, y))

for x in range(10, 16):
    DEFAULT_OBSTACLES.add((x, 4))

for y in range(6, 10):
    DEFAULT_OBSTACLES.add((13, y))

HIGH_RISK_THRESHOLD = 0.60


# ============================================================
# FASTAPI APP
# ============================================================

app = FastAPI(
    title="MaintenRoute AI API",
    description=(
        "Inference API for MaintenRoute AI predictive "
        "maintenance prototype."
    ),
    version="1.0.0",
)


# ============================================================
# REQUEST / RESPONSE SCHEMAS
# ============================================================

class PredictionRequest(BaseModel):
    type: str = Field(
        ...,
        description="AI4I product type: L, M, or H",
        examples=["M"],
    )

    air_temperature: float = Field(
        ...,
        description="Air temperature [K]",
        examples=[300.1],
    )

    process_temperature: float = Field(
        ...,
        description="Process temperature [K]",
        examples=[310.5],
    )

    rotational_speed: float = Field(
        ...,
        description="Rotational speed [rpm]",
        examples=[1500],
    )

    torque: float = Field(
        ...,
        description="Torque [Nm]",
        examples=[42.5],
    )

    tool_wear: float = Field(
        ...,
        description="Tool wear [min]",
        examples=[120],
    )


class PredictionResponse(BaseModel):
    model: str
    operating_threshold: float
    failure_risk: float
    failure_risk_percent: float
    risk_level: str
    failure_alert: str


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    selected_model: str
    operating_threshold: float


class SensorScenario(BaseModel):
    asset_id: str
    sensor: PredictionRequest


class PlanningRequest(BaseModel):
    number_of_assets: int = Field(10, ge=1, le=10)
    minimum_risk: float = Field(0.40, ge=0.0, le=1.0)
    maximum_assets: int = Field(5, ge=1, le=10)
    distance_weight: float = Field(0.80, ge=0.0, le=5.0)

    risk_weight: float = Field(0.60, ge=0.0)
    criticality_weight: float = Field(0.25, ge=0.0)
    urgency_weight: float = Field(0.15, ge=0.0)

    layout_mode: str = Field("default")
    grid_width: int = Field(20, ge=12, le=30)
    grid_height: int = Field(11, ge=8, le=20)
    obstacle_density: float = Field(0.07, ge=0.0, le=0.20)
    layout_seed: int = Field(42, ge=0)

    custom_positions: dict[str, list[int]] | None = None
    custom_technician_start: list[int] | None = None
    custom_obstacles: list[list[int]] | None = None

    scenario: SensorScenario | None = None


# ============================================================
# HELPERS
# ============================================================

def assign_risk_level(
    probability: float,
) -> str:
    if probability >= 0.80:
        return "CRITICAL"

    if probability >= 0.60:
        return "HIGH"

    if probability >= 0.40:
        return "MEDIUM"

    return "LOW"


def assign_failure_alert(
    probability: float,
) -> str:
    if probability >= SELECTED_THRESHOLD:
        return "ALERT"

    return "NORMAL"


def validate_request(
    request: PredictionRequest,
):
    if request.type not in VALID_TYPES:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Invalid Type '{request.type}'. "
                f"Allowed values: {VALID_TYPES}"
            ),
        )

    request_values = {
        "Air temperature [K]": request.air_temperature,
        "Process temperature [K]": request.process_temperature,
        "Rotational speed [rpm]": request.rotational_speed,
        "Torque [Nm]": request.torque,
        "Tool wear [min]": request.tool_wear,
    }

    for feature, value in request_values.items():
        minimum = FEATURE_RANGES[
            feature
        ][
            "min"
        ]

        maximum = FEATURE_RANGES[
            feature
        ][
            "max"
        ]

        if value < minimum or value > maximum:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"{feature}={value} is outside "
                    f"the observed AI4I range "
                    f"[{minimum}, {maximum}]."
                ),
            )


def request_to_dataframe(
    request: PredictionRequest,
) -> pd.DataFrame:
    row = {
        "Type": request.type,
        "Air temperature [K]": request.air_temperature,
        "Process temperature [K]": request.process_temperature,
        "Rotational speed [rpm]": request.rotational_speed,
        "Torque [Nm]": request.torque,
        "Tool wear [min]": request.tool_wear,
    }

    return pd.DataFrame(
        [row],
        columns=FEATURE_COLUMNS,
    )



# ============================================================
# ASSET + PLANNING HELPERS
# ============================================================

def predict_probability_from_values(sensor_values: dict) -> float:
    input_df = pd.DataFrame(
        [{
            feature: sensor_values[feature]
            for feature in FEATURE_COLUMNS
        }],
        columns=FEATURE_COLUMNS,
    )

    return float(
        model.predict_proba(
            input_df
        )[0, 1]
    )



def all_assets_reachable(
    technician,
    positions,
    grid_width,
    grid_height,
    obstacles,
):
    for position in positions.values():
        if astar(
            technician,
            position,
            grid_width,
            grid_height,
            obstacles,
        ) is None:
            return False

    return True


def generate_auto_layout(
    asset_ids,
    grid_width,
    grid_height,
    obstacle_density,
    seed,
):
    rng = np.random.default_rng(
        seed
    )

    count = len(asset_ids)

    columns = math.ceil(
        math.sqrt(count)
    )

    rows = math.ceil(
        count / columns
    )

    x_values = (
        np.linspace(
            3,
            grid_width - 3,
            columns,
        )
        .round()
        .astype(int)
    )

    y_values = (
        np.linspace(
            2,
            grid_height - 3,
            rows,
        )
        .round()
        .astype(int)
    )

    slots = []

    for y in y_values:
        for x in x_values:
            slots.append(
                (int(x), int(y))
            )

    slots = slots[:count]
    rng.shuffle(slots)

    positions = {
        asset_id: slots[index]
        for index, asset_id
        in enumerate(asset_ids)
    }

    technician = (
        1,
        grid_height // 2,
    )

    protected = set(
        positions.values()
    )
    protected.add(
        technician
    )

    candidates = []

    for x in range(
        1,
        grid_width - 1,
    ):
        for y in range(
            1,
            grid_height - 1,
        ):
            cell = (x, y)

            if cell not in protected:
                candidates.append(
                    cell
                )

    rng.shuffle(
        candidates
    )

    target_obstacles = int(
        grid_width
        * grid_height
        * obstacle_density
    )

    obstacles = set()

    for candidate in candidates:
        if len(obstacles) >= target_obstacles:
            break

        test_obstacles = (
            obstacles
            | {candidate}
        )

        if all_assets_reachable(
            technician,
            positions,
            grid_width,
            grid_height,
            test_obstacles,
        ):
            obstacles.add(
                candidate
            )

    return (
        positions,
        technician,
        obstacles,
    )



def validate_manual_layout(
    asset_ids,
    positions_payload,
    technician_payload,
    obstacles_payload,
    grid_width,
    grid_height,
):
    if positions_payload is None:
        raise HTTPException(
            status_code=422,
            detail="Manual layout requires custom_positions.",
        )

    if technician_payload is None:
        raise HTTPException(
            status_code=422,
            detail="Manual layout requires custom_technician_start.",
        )

    if len(technician_payload) != 2:
        raise HTTPException(
            status_code=422,
            detail="custom_technician_start must contain [x, y].",
        )

    def parse_point(value, label):
        if not isinstance(value, (list, tuple)) or len(value) != 2:
            raise HTTPException(
                status_code=422,
                detail=f"{label} must contain [x, y].",
            )

        point = (int(value[0]), int(value[1]))

        if not inside_grid(
            point,
            grid_width,
            grid_height,
        ):
            raise HTTPException(
                status_code=422,
                detail=(
                    f"{label}={list(point)} lies outside "
                    f"the {grid_width}x{grid_height} grid."
                ),
            )

        return point

    active_positions = {}

    for asset_id in asset_ids:
        if asset_id not in positions_payload:
            raise HTTPException(
                status_code=422,
                detail=f"Manual layout is missing position for {asset_id}.",
            )

        active_positions[asset_id] = parse_point(
            positions_payload[asset_id],
            f"custom_positions[{asset_id}]",
        )

    if len(set(active_positions.values())) != len(active_positions):
        raise HTTPException(
            status_code=422,
            detail="Two assets cannot occupy the same grid cell.",
        )

    technician = parse_point(
        technician_payload,
        "custom_technician_start",
    )

    if technician in set(active_positions.values()):
        raise HTTPException(
            status_code=422,
            detail="Technician cannot occupy an asset cell.",
        )

    obstacles = set()

    for index, value in enumerate(obstacles_payload or []):
        point = parse_point(
            value,
            f"custom_obstacles[{index}]",
        )

        if point == technician:
            raise HTTPException(
                status_code=422,
                detail="Obstacle cannot occupy the technician cell.",
            )

        if point in set(active_positions.values()):
            raise HTTPException(
                status_code=422,
                detail="Obstacle cannot occupy an asset cell.",
            )

        obstacles.add(point)

    return active_positions, technician, obstacles


def build_representative_assets(
    number_of_assets: int,
    scenario: SensorScenario | None = None,
) -> pd.DataFrame:
    mapping = (
        asset_mapping
        .head(number_of_assets)
        .copy()
    )

    # Generate fixed operational metadata across the complete representative
    # asset set so values remain stable when number_of_assets changes.
    rng = np.random.default_rng(42)

    criticality_values = rng.uniform(
        0.4,
        1.0,
        len(asset_mapping),
    )

    urgency_values = rng.uniform(
        0.4,
        1.0,
        len(asset_mapping),
    )

    metadata = {
        row["Asset ID"]: {
            "Criticality": float(criticality_values[index]),
            "Urgency": float(urgency_values[index]),
        }
        for index, (_, row) in enumerate(asset_mapping.iterrows())
    }

    rows = []

    for _, mapping_row in mapping.iterrows():
        asset_id = str(mapping_row["Asset ID"])
        source_row = int(mapping_row["Source Row"])

        sensor_row = raw_data.loc[
            source_row,
            FEATURE_COLUMNS,
        ]

        baseline_sensor_values = {
            feature: sensor_row[feature]
            for feature in FEATURE_COLUMNS
        }

        baseline_probability = (
            predict_probability_from_values(
                baseline_sensor_values
            )
        )

        sensor_values = dict(
            baseline_sensor_values
        )

        scenario_active = False

        if (
            scenario is not None
            and scenario.asset_id == asset_id
        ):
            validate_request(
                scenario.sensor
            )

            sensor_values = {
                "Type": scenario.sensor.type,
                "Air temperature [K]": scenario.sensor.air_temperature,
                "Process temperature [K]": scenario.sensor.process_temperature,
                "Rotational speed [rpm]": scenario.sensor.rotational_speed,
                "Torque [Nm]": scenario.sensor.torque,
                "Tool wear [min]": scenario.sensor.tool_wear,
            }

            scenario_active = True

        probability = predict_probability_from_values(
            sensor_values
        )

        position = DEFAULT_FACTORY_POSITIONS.get(
            asset_id
        )

        if position is None:
            raise HTTPException(
                status_code=500,
                detail=f"No default factory position for {asset_id}.",
            )

        rows.append({
            "Asset ID": asset_id,
            "Source Row": source_row,
            "Type": str(sensor_values["Type"]),
            "Air temperature [K]": float(sensor_values["Air temperature [K]"]),
            "Process temperature [K]": float(sensor_values["Process temperature [K]"]),
            "Rotational speed [rpm]": int(sensor_values["Rotational speed [rpm]"]),
            "Torque [Nm]": float(sensor_values["Torque [Nm]"]),
            "Tool wear [min]": int(sensor_values["Tool wear [min]"]),
            "Baseline Failure Risk": baseline_probability,
            "Failure Risk": probability,
            "Risk Level": assign_risk_level(probability),
            "Failure Alert": assign_failure_alert(probability),
            "Criticality": metadata[asset_id]["Criticality"],
            "Urgency": metadata[asset_id]["Urgency"],
            "Position": position,
            "Scenario Active": scenario_active,
        })

    return pd.DataFrame(rows)


def calculate_priority_scores(
    asset_df: pd.DataFrame,
    risk_weight: float,
    criticality_weight: float,
    urgency_weight: float,
) -> pd.DataFrame:
    total_weight = (
        risk_weight
        + criticality_weight
        + urgency_weight
    )

    if total_weight <= 0:
        raise HTTPException(
            status_code=422,
            detail="Priority weights cannot all be zero.",
        )

    df = asset_df.copy()

    rw = risk_weight / total_weight
    cw = criticality_weight / total_weight
    uw = urgency_weight / total_weight

    df["Priority Score"] = (
        rw * df["Failure Risk"]
        + cw * df["Criticality"]
        + uw * df["Urgency"]
    )

    return df


def inside_grid(position, grid_width, grid_height):
    x, y = position
    return (
        0 <= x < grid_width
        and 0 <= y < grid_height
    )


def manhattan_distance(a, b):
    return (
        abs(a[0] - b[0])
        + abs(a[1] - b[1])
    )


def get_neighbors(
    node,
    grid_width,
    grid_height,
    obstacles,
):
    x, y = node

    candidates = [
        (x + 1, y),
        (x - 1, y),
        (x, y + 1),
        (x, y - 1),
    ]

    return [
        point
        for point in candidates
        if (
            0 <= point[0] < grid_width
            and 0 <= point[1] < grid_height
            and point not in obstacles
        )
    ]


def astar(
    start,
    goal,
    grid_width,
    grid_height,
    obstacles,
):
    if (
        start in obstacles
        or goal in obstacles
        or not inside_grid(start, grid_width, grid_height)
        or not inside_grid(goal, grid_width, grid_height)
    ):
        return None

    open_set = []

    heapq.heappush(
        open_set,
        (
            manhattan_distance(start, goal),
            0,
            start,
        ),
    )

    came_from = {}
    g_score = {start: 0}
    closed = set()

    while open_set:
        _, _, current = heapq.heappop(
            open_set
        )

        if current in closed:
            continue

        if current == goal:
            path = [current]

            while current in came_from:
                current = came_from[current]
                path.append(current)

            path.reverse()
            return path

        closed.add(current)

        for neighbor in get_neighbors(
            current,
            grid_width,
            grid_height,
            obstacles,
        ):
            tentative_g = g_score[current] + 1

            if tentative_g < g_score.get(
                neighbor,
                float("inf"),
            ):
                came_from[neighbor] = current
                g_score[neighbor] = tentative_g

                heapq.heappush(
                    open_set,
                    (
                        tentative_g
                        + manhattan_distance(
                            neighbor,
                            goal,
                        ),
                        tentative_g,
                        neighbor,
                    ),
                )

    return None


def astar_distance(
    start,
    goal,
    grid_width,
    grid_height,
    obstacles,
):
    path = astar(
        start,
        goal,
        grid_width,
        grid_height,
        obstacles,
    )

    if path is None:
        return float("inf")

    return len(path) - 1


def build_risk_aware_sequence(
    candidate_assets,
    technician_start,
    distance_weight,
    grid_width,
    grid_height,
    obstacles,
):
    remaining = candidate_assets.copy()
    current_position = technician_start
    sequence = []
    distance_normalizer = grid_width + grid_height

    while len(remaining) > 0:
        best_index = None
        best_utility = -float("inf")
        best_distance = None

        for index, row in remaining.iterrows():
            distance = astar_distance(
                current_position,
                row["Position"],
                grid_width,
                grid_height,
                obstacles,
            )

            if np.isinf(distance):
                continue

            normalized_distance = (
                distance
                / distance_normalizer
            )

            utility = (
                row["Priority Score"]
                - distance_weight
                * normalized_distance
            )

            if utility > best_utility:
                best_index = index
                best_utility = utility
                best_distance = distance

        if best_index is None:
            break

        selected = remaining.loc[
            best_index
        ]

        record = selected.to_dict()
        record["Travel Distance"] = float(
            best_distance
        )
        record["Selection Utility"] = float(
            best_utility
        )

        sequence.append(record)

        current_position = selected[
            "Position"
        ]

        remaining = remaining.drop(
            best_index
        )

    return pd.DataFrame(sequence)


def build_full_route(
    start,
    sequence,
    grid_width,
    grid_height,
    obstacles,
):
    full_route = []
    route_segments = []
    current = start

    for _, row in sequence.iterrows():
        path = astar(
            current,
            row["Position"],
            grid_width,
            grid_height,
            obstacles,
        )

        if path is None:
            continue

        distance = len(path) - 1

        route_segments.append({
            "asset_id": row["Asset ID"],
            "distance": int(distance),
            "path": [
                [int(x), int(y)]
                for x, y in path
            ],
        })

        if not full_route:
            full_route.extend(path)
        else:
            full_route.extend(path[1:])

        current = row["Position"]

    return (
        [
            [int(x), int(y)]
            for x, y in full_route
        ],
        route_segments,
    )


def calculate_weighted_cost(
    sequence,
    route_segments,
):
    cumulative_distance = 0
    total_cost = 0.0

    for (_, row), segment in zip(
        sequence.iterrows(),
        route_segments,
    ):
        cumulative_distance += segment[
            "distance"
        ]

        total_cost += (
            float(row["Priority Score"])
            * cumulative_distance
        )

    return float(total_cost)


def dataframe_assets_to_records(
    df: pd.DataFrame,
):
    records = []

    for _, row in df.iterrows():
        position = row["Position"]

        record = {
            "asset_id": str(row["Asset ID"]),
            "source_row": int(row["Source Row"]),
            "type": str(row["Type"]),
            "air_temperature": float(row["Air temperature [K]"]),
            "process_temperature": float(row["Process temperature [K]"]),
            "rotational_speed": int(row["Rotational speed [rpm]"]),
            "torque": float(row["Torque [Nm]"]),
            "tool_wear": int(row["Tool wear [min]"]),
            "baseline_failure_risk": float(
                row["Baseline Failure Risk"]
            ),
            "baseline_failure_risk_percent": round(
                float(row["Baseline Failure Risk"]) * 100,
                2,
            ),
            "failure_risk": float(row["Failure Risk"]),
            "failure_risk_percent": round(
                float(row["Failure Risk"]) * 100,
                2,
            ),
            "risk_level": str(row["Risk Level"]),
            "failure_alert": str(row["Failure Alert"]),
            "criticality": float(row["Criticality"]),
            "urgency": float(row["Urgency"]),
            "position": [
                int(position[0]),
                int(position[1]),
            ],
            "scenario_active": bool(
                row["Scenario Active"]
            ),
        }

        if "Priority Score" in df.columns:
            record["priority_score"] = float(
                row["Priority Score"]
            )

        records.append(record)

    return records


def sequence_to_records(
    df: pd.DataFrame,
):
    records = []

    for order, (_, row) in enumerate(
        df.iterrows(),
        start=1,
    ):
        records.append({
            "order": order,
            "asset_id": str(row["Asset ID"]),
            "failure_risk": float(row["Failure Risk"]),
            "failure_risk_percent": round(
                float(row["Failure Risk"]) * 100,
                2,
            ),
            "risk_level": str(row["Risk Level"]),
            "priority_score": float(row["Priority Score"]),
            "travel_distance": (
                float(row["Travel Distance"])
                if "Travel Distance" in row
                else None
            ),
            "selection_utility": (
                float(row["Selection Utility"])
                if "Selection Utility" in row
                else None
            ),
            "position": [
                int(row["Position"][0]),
                int(row["Position"][1]),
            ],
        })

    return records


# ============================================================
# ENDPOINTS
# ============================================================

@app.get("/")
def root():
    return {
        "service": "MaintenRoute AI",
        "status": "running",
        "model": SELECTED_MODEL,
        "docs": "/docs",
    }


@app.get(
    "/health",
    response_model=HealthResponse,
)
def health():
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "selected_model": SELECTED_MODEL,
        "operating_threshold": SELECTED_THRESHOLD,
    }


@app.get("/model-info")
def model_info():
    return {
        "selected_model": SELECTED_MODEL,
        "operating_threshold": SELECTED_THRESHOLD,
        "features": FEATURE_COLUMNS,
        "valid_types": VALID_TYPES,
        "feature_ranges": FEATURE_RANGES,
        "test_metrics": {
            "accuracy": TEST_METRICS.get("accuracy"),
            "precision": TEST_METRICS.get("precision"),
            "recall": TEST_METRICS.get("recall"),
            "f1": TEST_METRICS.get("f1"),
            "roc_auc": TEST_METRICS.get("roc_auc"),
            "average_precision": TEST_METRICS.get("pr_auc"),
        },
    }


@app.post(
    "/predict",
    response_model=PredictionResponse,
)
def predict(
    request: PredictionRequest,
):
    validate_request(
        request
    )

    input_df = request_to_dataframe(
        request
    )

    try:
        probability = float(
            model.predict_proba(
                input_df
            )[0, 1]
        )

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=(
                f"Model inference failed: {str(error)}"
            ),
        )

    return {
        "model": SELECTED_MODEL,
        "operating_threshold": SELECTED_THRESHOLD,

        # Keep full model precision for downstream planning.
        "failure_risk": probability,

        # Human-friendly display value only.
        "failure_risk_percent": round(
            probability * 100,
            2,
        ),
        "risk_level": assign_risk_level(
            probability
        ),
        "failure_alert": assign_failure_alert(
            probability
        ),
    }


# ============================================================
# REPRESENTATIVE ASSETS
# ============================================================

@app.get("/assets")
def get_assets(
    number_of_assets: int = 10,
):
    if (
        number_of_assets < 1
        or number_of_assets > len(asset_mapping)
    ):
        raise HTTPException(
            status_code=422,
            detail=(
                f"number_of_assets must be between 1 "
                f"and {len(asset_mapping)}."
            ),
        )

    assets_df = build_representative_assets(
        number_of_assets
    )

    priority_df = calculate_priority_scores(
        assets_df,
        0.60,
        0.25,
        0.15,
    )

    return {
        "count": len(priority_df),
        "assets": dataframe_assets_to_records(
            priority_df
        ),
    }


# ============================================================
# END-TO-END PLANNING
# ============================================================

@app.post("/planning")
def planning(
    request: PlanningRequest,
):
    if request.number_of_assets > len(
        asset_mapping
    ):
        raise HTTPException(
            status_code=422,
            detail=(
                f"number_of_assets cannot exceed "
                f"{len(asset_mapping)}."
            ),
        )

    assets_df = build_representative_assets(
        request.number_of_assets,
        request.scenario,
    )

    if request.layout_mode not in {
        "default",
        "auto",
        "manual",
    }:
        raise HTTPException(
            status_code=422,
            detail=(
                "layout_mode must be "
                "'default', 'manual', or 'auto'."
            ),
        )

    if request.layout_mode == "auto":
        (
            active_positions,
            active_technician_start,
            active_obstacles,
        ) = generate_auto_layout(
            assets_df["Asset ID"]
            .astype(str)
            .tolist(),
            request.grid_width,
            request.grid_height,
            request.obstacle_density,
            request.layout_seed,
        )

        active_grid_width = (
            request.grid_width
        )
        active_grid_height = (
            request.grid_height
        )

    elif request.layout_mode == "manual":
        active_grid_width = request.grid_width
        active_grid_height = request.grid_height

        (
            active_positions,
            active_technician_start,
            active_obstacles,
        ) = validate_manual_layout(
            assets_df["Asset ID"]
            .astype(str)
            .tolist(),
            request.custom_positions,
            request.custom_technician_start,
            request.custom_obstacles,
            active_grid_width,
            active_grid_height,
        )

    else:
        active_positions = {
            asset_id: position
            for asset_id, position
            in DEFAULT_FACTORY_POSITIONS.items()
            if asset_id in set(
                assets_df["Asset ID"]
                .astype(str)
                .tolist()
            )
        }

        active_technician_start = (
            DEFAULT_TECHNICIAN_START
        )

        active_obstacles = set(
            DEFAULT_OBSTACLES
        )

        active_grid_width = (
            DEFAULT_GRID_WIDTH
        )
        active_grid_height = (
            DEFAULT_GRID_HEIGHT
        )

    assets_df["Position"] = (
        assets_df["Asset ID"]
        .map(active_positions)
    )

    priority_df = calculate_priority_scores(
        assets_df,
        request.risk_weight,
        request.criticality_weight,
        request.urgency_weight,
    )

    eligible_assets = (
        priority_df[
            priority_df["Failure Risk"]
            >= request.minimum_risk
        ]
        .copy()
    )

    priority_assets = (
        eligible_assets
        .sort_values(
            "Priority Score",
            ascending=False,
        )
        .head(
            request.maximum_assets
        )
        .copy()
    )

    reachable_indices = []
    unreachable_assets = []

    for index, row in priority_assets.iterrows():
        distance = astar_distance(
            active_technician_start,
            row["Position"],
            active_grid_width,
            active_grid_height,
            active_obstacles,
        )

        if np.isinf(distance):
            unreachable_assets.append(
                str(row["Asset ID"])
            )
        else:
            reachable_indices.append(
                index
            )

    planning_assets = (
        priority_assets.loc[
            reachable_indices
        ]
        .copy()
    )

    if len(planning_assets) > 0:
        maintenance_sequence = (
            build_risk_aware_sequence(
                planning_assets,
                active_technician_start,
                request.distance_weight,
                active_grid_width,
                active_grid_height,
                active_obstacles,
            )
        )
    else:
        maintenance_sequence = pd.DataFrame()

    risk_only_sequence = (
        planning_assets
        .sort_values(
            "Failure Risk",
            ascending=False,
        )
        .reset_index(
            drop=True
        )
    )

    maintenroute_route, maintenroute_segments = (
        build_full_route(
            active_technician_start,
            maintenance_sequence,
            active_grid_width,
            active_grid_height,
            active_obstacles,
        )
    )

    risk_only_route, risk_only_segments = (
        build_full_route(
            active_technician_start,
            risk_only_sequence,
            active_grid_width,
            active_grid_height,
            active_obstacles,
        )
    )

    maintenroute_distance = sum(
        segment["distance"]
        for segment in maintenroute_segments
    )

    risk_only_distance = sum(
        segment["distance"]
        for segment in risk_only_segments
    )

    if risk_only_distance > 0:
        travel_reduction = (
            (
                risk_only_distance
                - maintenroute_distance
            )
            / risk_only_distance
            * 100
        )
    else:
        travel_reduction = 0.0

    maintenroute_weighted_cost = (
        calculate_weighted_cost(
            maintenance_sequence,
            maintenroute_segments,
        )
    )

    risk_only_weighted_cost = (
        calculate_weighted_cost(
            risk_only_sequence,
            risk_only_segments,
        )
    )

    if risk_only_weighted_cost > 0:
        weighted_cost_reduction = (
            (
                risk_only_weighted_cost
                - maintenroute_weighted_cost
            )
            / risk_only_weighted_cost
            * 100
        )
    else:
        weighted_cost_reduction = 0.0

    high_risk_ids = set(
        priority_df[
            priority_df["Failure Risk"]
            >= HIGH_RISK_THRESHOLD
        ]["Asset ID"]
        .astype(str)
        .tolist()
    )

    planned_ids = set(
        maintenance_sequence["Asset ID"]
        .astype(str)
        .tolist()
        if len(maintenance_sequence)
        else []
    )

    if high_risk_ids:
        high_risk_coverage = (
            len(
                high_risk_ids
                & planned_ids
            )
            / len(high_risk_ids)
            * 100
        )
    else:
        high_risk_coverage = 100.0

    return {
        "model": SELECTED_MODEL,
        "operating_threshold": SELECTED_THRESHOLD,
        "configuration": {
            "number_of_assets": request.number_of_assets,
            "minimum_risk": request.minimum_risk,
            "maximum_assets": request.maximum_assets,
            "distance_weight": request.distance_weight,
            "risk_weight": request.risk_weight,
            "criticality_weight": request.criticality_weight,
            "urgency_weight": request.urgency_weight,
            "layout_mode": request.layout_mode,
            "grid_width": active_grid_width,
            "grid_height": active_grid_height,
            "obstacle_density": (
                request.obstacle_density
                if request.layout_mode == "auto"
                else None
            ),
            "layout_seed": (
                request.layout_seed
                if request.layout_mode == "auto"
                else None
            ),
            "manual_layout_active": (
                request.layout_mode == "manual"
            ),
        },
        "factory": {
            "layout_mode": request.layout_mode,
            "grid_width": active_grid_width,
            "grid_height": active_grid_height,
            "technician_start": list(
                active_technician_start
            ),
            "obstacles": [
                [int(x), int(y)]
                for x, y in sorted(
                    active_obstacles
                )
            ],
        },
        "assets": dataframe_assets_to_records(
            priority_df
        ),
        "eligible_count": int(
            len(eligible_assets)
        ),
        "selected_count": int(
            len(planning_assets)
        ),
        "unreachable_assets": unreachable_assets,
        "maintenance_sequence": sequence_to_records(
            maintenance_sequence
        ),
        "risk_only_sequence": sequence_to_records(
            risk_only_sequence
        ),
        "maintenroute_route": maintenroute_route,
        "risk_only_route": risk_only_route,
        "maintenroute_segments": maintenroute_segments,
        "risk_only_segments": risk_only_segments,
        "metrics": {
            "maintenroute_distance": int(
                maintenroute_distance
            ),
            "risk_only_distance": int(
                risk_only_distance
            ),
            "travel_reduction_percent": round(
                travel_reduction,
                2,
            ),
            "maintenroute_weighted_cost": round(
                maintenroute_weighted_cost,
                3,
            ),
            "risk_only_weighted_cost": round(
                risk_only_weighted_cost,
                3,
            ),
            "weighted_cost_reduction_percent": round(
                weighted_cost_reduction,
                2,
            ),
            "high_risk_coverage_percent": round(
                high_risk_coverage,
                2,
            ),
        },
    }
