"use client";

import {
  useEffect,
  useMemo,
  useState
} from "react";

import { AssetTable } from "@/components/AssetTable";
import { PageHero } from "@/components/OverviewPage";

import {
  defaultSensorInput,
  type AppliedScenario,
  type Asset,
  type PlanningResponse,
  type PredictionRequest,
  type PredictionResponse
} from "@/lib/data";

type Props = {
  assets: Asset[];
  planning: PlanningResponse | null;
  appliedScenario: AppliedScenario | null;
  onApplyScenario: (scenario: AppliedScenario) => void;
  onResetScenario: () => void;
};

type ScenarioExplanation = {
  failure_risk: number;
  method: string;
  limitations: string;
  features: {
    feature: string;
    current_value: string;
    reference_value: string;
    risk_difference_points: number;
  }[];
};

export function AssetsPage({
  assets,
  planning,
  appliedScenario,
  onApplyScenario,
  onResetScenario
}: Props) {
  const availableAssetIds = useMemo(
    () => assets.map((asset) => asset.id),
    [assets]
  );

  const initialAsset = (
    availableAssetIds.includes("M05")
      ? "M05"
      : availableAssetIds[0] ?? "M01"
  );

  const [selectedAssetId, setSelectedAssetId] = useState(initialAsset);
  const [form, setForm] = useState<PredictionRequest>(defaultSensorInput);
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<ScenarioExplanation | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [explanationError, setExplanationError] = useState<string | null>(null);

  const selectedApiAsset = planning?.assets.find(
    (asset) => asset.asset_id === selectedAssetId
  );

  useEffect(() => {
    if (!availableAssetIds.includes(selectedAssetId)) {
      setSelectedAssetId(
        availableAssetIds.includes("M05")
          ? "M05"
          : availableAssetIds[0] ?? "M01"
      );
    }
  }, [availableAssetIds, selectedAssetId]);

  useEffect(() => {
    if (!selectedApiAsset) return;

    setExplanation(null);
    setExplanationError(null);

    setForm({
      type: selectedApiAsset.type,
      air_temperature: selectedApiAsset.air_temperature,
      process_temperature: selectedApiAsset.process_temperature,
      rotational_speed: selectedApiAsset.rotational_speed,
      torque: selectedApiAsset.torque,
      tool_wear: selectedApiAsset.tool_wear
    });

    setResult({
      model: planning?.model ?? "XGBoost",
      operating_threshold: planning?.operating_threshold ?? 0.81,
      failure_risk: selectedApiAsset.failure_risk,
      failure_risk_percent: selectedApiAsset.failure_risk_percent,
      risk_level: selectedApiAsset.risk_level,
      failure_alert: selectedApiAsset.failure_alert
    });
  }, [
    selectedAssetId,
    selectedApiAsset,
    planning?.model,
    planning?.operating_threshold
  ]);

  const update = (
    key: keyof PredictionRequest,
    value: string | number
  ) => {
    setExplanation(null);
    setExplanationError(null);
    setForm(
      (previous) => ({
        ...previous,
        [key]: value
      })
    );
  };

  async function explainInputs() {
    setExplaining(true);
    setExplanationError(null);
    try {
      const response = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || "Could not analyze these sensor inputs.");
      setExplanation(payload as ScenarioExplanation);
    } catch (caught) {
      setExplanationError(caught instanceof Error ? caught.message : "Explanation unavailable.");
    } finally {
      setExplaining(false);
    }
  }

  async function applyScenario() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        "/api/predict",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(form)
        }
      );

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload?.detail
          || "Scenario inference failed"
        );
      }

      const prediction = (
        payload as PredictionResponse
      );

      setResult(
        prediction
      );

      onApplyScenario({
        asset_id: selectedAssetId,
        sensor: { ...form }
      });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Scenario inference failed"
      );
    } finally {
      setLoading(false);
    }
  }

  function resetScenario() {
    onResetScenario();
    setError(null);
  }

  const isApplied = (
    appliedScenario?.asset_id
    === selectedAssetId
  );

  const baselineRisk = (
    selectedApiAsset
      ?.baseline_failure_risk_percent
  );

  const delta = (
    baselineRisk !== undefined
    && result !== null
      ? result.failure_risk_percent - baselineRisk
      : null
  );

  return (
    <>
      <PageHero
        eyebrow="MACHINE INSPECTOR"
        title="Asset Analysis"
        copy="Test a machine's sensor condition and apply the updated risk to the live maintenance plan."
        badge="sensor → risk → route"
      />

      <section className="commandSection">
        <div className="commandSectionHead">
          <div>
            <div className="commandEyebrow">LIVE INFERENCE</div>
            <h2>Sensor Scenario</h2>
          </div>
          <div className="commandSectionMeta">
            sensor → risk → priority → route
          </div>
        </div>

        <div className="assetScenarioBar">
          <label className="field compactField">
            <span>Asset to simulate</span>
            <select
              value={selectedAssetId}
              onChange={(event) => {
                setSelectedAssetId(
                  event.target.value
                );
                setError(null);
              }}
            >
              {availableAssetIds.map(
                (assetId) => (
                  <option
                    key={assetId}
                    value={assetId}
                  >
                    {assetId}
                  </option>
                )
              )}
            </select>
          </label>

          <div className="scenarioStatus">
            <span
              className={
                isApplied
                  ? "scenarioLamp active"
                  : "scenarioLamp"
              }
            />
            {isApplied
              ? "scenario applied to planning"
              : "baseline planning active"}
          </div>
        </div>

        <div className="inferenceGrid">
          <div className="sensorForm">
            <Field label="Machine type">
              <select
                value={form.type}
                onChange={(event) => update(
                  "type",
                  event.target.value
                )}
              >
                <option>L</option>
                <option>M</option>
                <option>H</option>
              </select>
            </Field>

            <NumberField
              label="Air temperature [K]"
              value={form.air_temperature}
              onChange={(value) => update(
                "air_temperature",
                value
              )}
            />

            <NumberField
              label="Process temperature [K]"
              value={form.process_temperature}
              onChange={(value) => update(
                "process_temperature",
                value
              )}
            />

            <NumberField
              label="Rotational speed [rpm]"
              value={form.rotational_speed}
              onChange={(value) => update(
                "rotational_speed",
                value
              )}
            />

            <NumberField
              label="Torque [Nm]"
              value={form.torque}
              onChange={(value) => update(
                "torque",
                value
              )}
            />

            <NumberField
              label="Tool wear [min]"
              value={form.tool_wear}
              onChange={(value) => update(
                "tool_wear",
                value
              )}
            />

            <div className="scenarioActions">
              <button
                className="primaryButton"
                onClick={applyScenario}
                disabled={loading}
              >
                {loading
                  ? "Applying scenario…"
                  : "Apply Scenario"}
              </button>
            </div>

            {appliedScenario && (
              <button
                className="textButton"
                onClick={resetScenario}
              >
                Reset applied scenario
              </button>
            )}

            {error && (
              <div className="errorMessage">
                {error}
              </div>
            )}
          </div>

          <div className="predictionPanel">
            <div className="eyebrow">
              prediction readout / {selectedAssetId}
            </div>

            {result ? (
              <>
                <div className="riskComparison">
                  <div>
                    <span>current risk</span>
                    <strong>
                      {formatRiskPercent(
                        result.failure_risk_percent
                      )}%
                    </strong>
                  </div>

                  <div>
                    <span>baseline</span>
                    <strong className="secondaryRisk">
                      {baselineRisk !== undefined
                        ? `${formatRiskPercent(baselineRisk)}%`
                        : "—"}
                    </strong>
                  </div>

                  <div>
                    <span>change</span>
                    <strong
                      className={
                        delta !== null && delta > 0
                          ? "riskDelta positive"
                          : delta !== null && delta < 0
                          ? "riskDelta negative"
                          : "riskDelta"
                      }
                    >
                      {delta !== null
                        ? `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} pts`
                        : "—"}
                    </strong>
                  </div>
                </div>

                <div className="predictionMetaGrid">
                  <Readout
                    label="risk level"
                    value={result.risk_level}
                  />

                  <Readout
                    label="failure alert"
                    value={result.failure_alert}
                  />

                  <Readout
                    label="model"
                    value={result.model}
                  />

                  <Readout
                    label="threshold"
                    value={
                      result.operating_threshold
                        .toFixed(2)
                    }
                  />
                </div>

                <div className="methodNote">
                  Apply Scenario runs the deployed model
                  and sends the resulting asset condition into
                  the Python prioritization, sequencing, and
                  A* planning pipeline.
                </div>

                <div className="scenarioExplanation">
                  <button className="explainButton" type="button" onClick={explainInputs} disabled={explaining}>
                    {explaining ? "Analyzing inputs…" : "Explain current sensor inputs"}
                  </button>
                  {explanationError && <p className="errorMessage" role="alert">{explanationError}</p>}
                  {explanation && (
                    <div className="explanationResult">
                      <div className="eyebrow">SENSOR SENSITIVITY / {(explanation.failure_risk * 100).toFixed(1)}% PREDICTED RISK</div>
                      <p>Change in predicted risk when each current input is compared with its dataset median (mode for Type).</p>
                      {explanation.features.slice(0, 4).map((item) => (
                        <div className="explanationRow" key={item.feature}>
                          <span>{item.feature}<small>{item.current_value} vs typical {item.reference_value}</small></span>
                          <strong className={item.risk_difference_points > 0 ? "positive" : ""}>
                            {item.risk_difference_points > 0 ? "+" : ""}{item.risk_difference_points.toFixed(2)} pts
                          </strong>
                        </div>
                      ))}
                      <p className="explanationCaveat">Model sensitivity only. This comparison does not establish causality.</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="emptyPrediction">
                <span>Awaiting inference.</span>
                <p>
                  Select an asset, change its sensor values,
                  then apply the scenario.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <AssetTable
        assets={assets}
      />
    </>
  );
}

function formatRiskPercent(
  value: number
) {
  if (value < 1) {
    return value.toFixed(2);
  }

  return value.toFixed(1);
}

function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(
          Number(event.target.value)
        )}
      />
    </Field>
  );
}

function Readout({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="readout">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
