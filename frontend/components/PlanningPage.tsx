import type {
  Asset,
  PlanningResponse
} from "@/lib/data";

import { routeStats } from "@/lib/data";

import {
  PageHero,
  KpiCard,
  SectionHeader
} from "@/components/OverviewPage";

import { FactoryMap } from "@/components/FactoryMap";

export function PlanningPage({
  assets,
  maxAssets,
  minRisk,
  planning,

  layoutSource,
  editorReady,

  editorTool,
  setEditorTool,

  editorAssetId,
  setEditorAssetId,

  onEditCell,
  onResetLayout
}: {
  assets: Asset[];
  maxAssets: number;
  minRisk: number;
  planning: PlanningResponse | null;

  layoutSource: "default" | "auto";
  editorReady: boolean;

  editorTool:
    | "asset"
    | "technician"
    | "obstacle";

  setEditorTool: (
    tool:
      | "asset"
      | "technician"
      | "obstacle"
  ) => void;

  editorAssetId: string;
  setEditorAssetId: (
    assetId: string
  ) => void;

  onEditCell: (
    x: number,
    y: number
  ) => void;

  onResetLayout: () => void;
}) {
  const metrics = planning?.metrics;

  return (
    <>
      <PageHero
        eyebrow="ROUTE INTELLIGENCE"
        title="Route Planning"
        copy="Prioritize inspections, sequence selected machines, and edit the facility directly while A* recomputes the technician route."
        badge={`${layoutSource} source · editable · A*`}
      />

      <div className="commandKpiGrid">
        <KpiCard
          label="Route Distance"
          value={String(
            metrics?.maintenroute_distance
            ?? routeStats.distance
          )}
          meta="current MaintenRoute plan"
        />

        <KpiCard
          label="Risk-only Distance"
          value={String(
            metrics?.risk_only_distance
            ?? routeStats.riskOnly
          )}
          meta="baseline ordering"
        />

        <KpiCard
          label="Travel Reduction"
          value={`${(
            metrics?.travel_reduction_percent
            ?? routeStats.reduction
          ).toFixed(1)}%`}
          meta="current simulated layout"
          accent
        />

        <KpiCard
          label="High-risk Coverage"
          value={`${(
            metrics?.high_risk_coverage_percent
            ?? 100
          ).toFixed(1)}%`}
          meta={`min risk ${minRisk.toFixed(2)}`}
        />
      </div>

      <section className="commandSection">
        <SectionHeader
          eyebrow="FACILITY MAP"
          title="Technician Route"
          meta={`${layoutSource} source · direct editing enabled`}
        />

        <div className="routeMapShell editing">
          <div className="floatingEditor persistent">
            <div className="floatingEditorTitle">
              <span>MAP EDITOR</span>
              <strong>
                {editorReady
                  ? "Click the grid to edit"
                  : "Loading editable layout…"}
              </strong>
            </div>

            <div className="floatingEditorTools">
              <button
                className={
                  editorTool === "asset"
                    ? "active"
                    : ""
                }
                onClick={() => setEditorTool("asset")}
                disabled={!editorReady}
              >
                Move Asset
              </button>

              <button
                className={
                  editorTool === "technician"
                    ? "active"
                    : ""
                }
                onClick={() => setEditorTool("technician")}
                disabled={!editorReady}
              >
                Technician
              </button>

              <button
                className={
                  editorTool === "obstacle"
                    ? "active"
                    : ""
                }
                onClick={() => setEditorTool("obstacle")}
                disabled={!editorReady}
              >
                Toggle Obstacle
              </button>
            </div>

            {editorTool === "asset" && (
              <select
                className="floatingAssetSelect"
                value={editorAssetId}
                disabled={!editorReady}
                onChange={(event) => setEditorAssetId(
                  event.target.value
                )}
              >
                {assets.map(
                  (asset) => (
                    <option
                      key={asset.id}
                      value={asset.id}
                    >
                      {asset.id}
                    </option>
                  )
                )}
              </select>
            )}

            <div className="floatingSourceBadge">
              source / {layoutSource}
            </div>

            <button
              className="floatingRestore"
              onClick={onResetLayout}
              disabled={!editorReady}
            >
              Restore Source
            </button>
          </div>

          <FactoryMap
            assets={assets}
            planning={planning}
            editable={editorReady}
            onCellClick={onEditCell}
          />
        </div>
      </section>

      <section className="commandSection">
        <SectionHeader
          eyebrow="INSPECTION PLAN"
          title="Inspection Queue"
          meta={`capacity ${maxAssets}`}
        />

        <div className="inspectionTable">
          <div className="inspectionTableHead">
            <span>Order</span>
            <span>Asset</span>
            <span>Priority</span>
            <span>Travel</span>
            <span>Risk</span>
          </div>

          {(
            planning?.maintenance_sequence
            ?? []
          ).map(
            (row) => (
              <div
                className="inspectionTableRow"
                key={row.asset_id}
              >
                <span>
                  #{String(row.order).padStart(2, "0")}
                </span>

                <strong>
                  {row.asset_id}
                </strong>

                <span>
                  {row.priority_score.toFixed(3)}
                </span>

                <span>
                  {row.travel_distance ?? "—"}
                </span>

                <b>
                  {row.failure_risk_percent < 1
                    ? row.failure_risk_percent.toFixed(2)
                    : row.failure_risk_percent.toFixed(1)}%
                </b>
              </div>
            )
          )}
        </div>

        <div className="methodCallout">
          <strong>Routing method</strong>
          <span>
            A* computes point-to-point shortest paths
            between selected stops. Asset selection and
            multi-stop ordering are handled separately by
            the risk-aware planning logic.
          </span>
        </div>
      </section>
    </>
  );
}
