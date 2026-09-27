export type PageName = "Overview" | "Assets" | "Planning" | "Model Ops";
export type RiskLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type Asset = {
  id: string;
  risk: number;
  level: RiskLevel;
  alert: "ALERT" | "NORMAL";
  priority: number;
};

export type PredictionRequest = {
  type: string;
  air_temperature: number;
  process_temperature: number;
  rotational_speed: number;
  torque: number;
  tool_wear: number;
};

export type PredictionResponse = {
  model: string;
  operating_threshold: number;
  failure_risk: number;
  failure_risk_percent: number;
  risk_level: string;
  failure_alert: string;
};

export const assets: Asset[] = [
  { id: "M01", risk: 90.3, level: "CRITICAL", alert: "ALERT", priority: 0.732 },
  { id: "M02", risk: 86.6, level: "CRITICAL", alert: "ALERT", priority: 0.706 },
  { id: "M03", risk: 79.2, level: "HIGH", alert: "NORMAL", priority: 0.642 },
  { id: "M04", risk: 78.2, level: "HIGH", alert: "NORMAL", priority: 0.758 },
  { id: "M05", risk: 40.4, level: "MEDIUM", alert: "NORMAL", priority: 0.457 },
  { id: "M06", risk: 40.3, level: "MEDIUM", alert: "NORMAL", priority: 0.569 },
  { id: "M07", risk: 8.2, level: "LOW", alert: "NORMAL", priority: 0.227 },
  { id: "M08", risk: 7.8, level: "LOW", alert: "NORMAL", priority: 0.213 },
  { id: "M09", risk: 0.5, level: "LOW", alert: "NORMAL", priority: 0.141 },
  { id: "M10", risk: 0.4, level: "LOW", alert: "NORMAL", priority: 0.137 }
];

export const baseQueue = ["M04", "M01", "M02", "M03", "M06"];

export const modelMetrics = {
  model: "XGBoost",
  threshold: 0.81,
  accuracy: 0.9830,
  precision: 0.7931,
  recall: 0.6765,
  f1: 0.7302,
  rocAuc: 0.9712,
  averagePrecision: 0.7953
};

export const routeStats = {
  distance: 29,
  riskOnly: 37,
  reduction: 21.6,
  weightedCost: 52.928,
  riskOnlyWeightedCost: 71.868
};

export const defaultSensorInput: PredictionRequest = {
  type: "M",
  air_temperature: 298.1,
  process_temperature: 308.6,
  rotational_speed: 1551,
  torque: 42.8,
  tool_wear: 120
};


export type ApiAsset = {
  asset_id: string;
  source_row: number;
  type: string;
  air_temperature: number;
  process_temperature: number;
  rotational_speed: number;
  torque: number;
  tool_wear: number;
  baseline_failure_risk: number;
  baseline_failure_risk_percent: number;
  failure_risk: number;
  failure_risk_percent: number;
  risk_level: RiskLevel;
  failure_alert: "ALERT" | "NORMAL";
  criticality: number;
  urgency: number;
  priority_score?: number;
  position: [number, number];
  scenario_active: boolean;
};


export type AppliedScenario = {
  asset_id: string;
  sensor: PredictionRequest;
};

export type PlanningSequenceItem = {
  order: number;
  asset_id: string;
  failure_risk: number;
  failure_risk_percent: number;
  risk_level: RiskLevel;
  priority_score: number;
  travel_distance: number | null;
  selection_utility: number | null;
  position: [number, number];
};

export type PlanningResponse = {
  model: string;
  operating_threshold: number;
  configuration: {
    number_of_assets: number;
    minimum_risk: number;
    maximum_assets: number;
    distance_weight: number;
    risk_weight: number;
    criticality_weight: number;
    urgency_weight: number;
    layout_mode: string;
    grid_width: number;
    grid_height: number;
    obstacle_density: number | null;
    layout_seed: number | null;
    manual_layout_active?: boolean;
  };
  factory: {
    layout_mode: string;
    grid_width: number;
    grid_height: number;
    technician_start: [number, number];
    obstacles: [number, number][];
  };
  assets: ApiAsset[];
  eligible_count: number;
  selected_count: number;
  unreachable_assets: string[];
  maintenance_sequence: PlanningSequenceItem[];
  risk_only_sequence: PlanningSequenceItem[];
  maintenroute_route: [number, number][];
  risk_only_route: [number, number][];
  metrics: {
    maintenroute_distance: number;
    risk_only_distance: number;
    travel_reduction_percent: number;
    maintenroute_weighted_cost: number;
    risk_only_weighted_cost: number;
    weighted_cost_reduction_percent: number;
    high_risk_coverage_percent: number;
  };
};

export function apiAssetToAsset(asset: ApiAsset): Asset {
  return {
    id: asset.asset_id,
    risk: asset.failure_risk_percent,
    level: asset.risk_level,
    alert: asset.failure_alert,
    priority: asset.priority_score ?? 0
  };
}
