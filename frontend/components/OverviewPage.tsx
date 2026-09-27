import type { Asset } from "@/lib/data";
import {
  modelMetrics,
  routeStats,
  type PlanningResponse
} from "@/lib/data";
import { RiskDistribution } from "@/components/RiskDistribution";
import { AssetTable } from "@/components/AssetTable";

export function OverviewPage({
  assets,
  maxAssets,
  minRisk,
  distanceWeight,
  planning
}: {
  assets: Asset[];
  maxAssets: number;
  minRisk: number;
  distanceWeight: number;
  planning: PlanningResponse | null;
}) {
  const criticalCount = assets.filter((asset) => asset.level === "CRITICAL").length;
  const alertCount = assets.filter((asset) => asset.alert === "ALERT").length;
  const metrics = planning?.metrics;

  return (
    <>
      <PageHero
        eyebrow="LIVE OPERATIONS"
        title="Maintenance Operations"
        copy="Monitor machine risk, inspection priority, and route execution from one operational command center."
        badge={`${modelMetrics.model} · API online`}
      />

      <div className="commandKpiGrid">
        <KpiCard label="Assets" value={String(assets.length)} meta={`${alertCount} active alerts`} />
        <KpiCard label="Critical" value={String(criticalCount)} meta="predicted risk ≥ 80%" />
        <KpiCard
          label="Planned"
          value={String(planning?.selected_count ?? Math.min(maxAssets, 5))}
          meta={`capacity ${maxAssets}`}
        />
        <KpiCard
          label="Travel Reduction"
          value={`${(metrics?.travel_reduction_percent ?? routeStats.reduction).toFixed(1)}%`}
          meta="vs. risk-only order"
          accent
        />
      </div>

      <section className="commandSection">
        <SectionHeader
          eyebrow="FLEET MONITOR"
          title="Operational Snapshot"
          meta={`planning risk ${minRisk.toFixed(2)} · distance weight ${distanceWeight.toFixed(2)}`}
        />

        <div className="commandTwoCol">
          <div className="commandPanel">
            <div className="commandPanelHead">
              <div>
                <span>RISK DISTRIBUTION</span>
                <h3>Fleet Risk</h3>
              </div>
              <div className="panelBadge">{assets.length} assets</div>
            </div>
            <RiskDistribution assets={assets} />
          </div>

          <div className="commandPanel">
            <div className="commandPanelHead">
              <div>
                <span>INSPECTION ORDER</span>
                <h3>Today's Queue</h3>
              </div>
              <div className="panelBadge">{planning?.selected_count ?? 0} planned</div>
            </div>

            <div className="commandQueue">
              {(planning?.maintenance_sequence ?? []).map((row) => (
                <div className="commandQueueRow" key={row.asset_id}>
                  <div className="queueIndex">{String(row.order).padStart(2, "0")}</div>
                  <div className="queueMachine">
                    <strong>{row.asset_id}</strong>
                    <span>priority {row.priority_score.toFixed(3)}</span>
                  </div>
                  <div className="queueRiskValue">
                    {row.failure_risk_percent < 1
                      ? row.failure_risk_percent.toFixed(2)
                      : row.failure_risk_percent.toFixed(1)}%
                  </div>
                </div>
              ))}

              {!planning?.maintenance_sequence.length && (
                <div className="emptyState">Waiting for live planning data.</div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="commandSection">
        <SectionHeader
          eyebrow="ROUTE SUMMARY"
          title="Technician Plan"
          meta="risk-aware sequence · point-to-point A*"
        />

        <div className="routeCommandCard">
          <div className="routeCommandPath">
            <div className="routeStart">TECH</div>
            {(planning?.maintenance_sequence ?? []).map((row) => (
              <div className="routeCommandStop" key={row.asset_id}>
                <span>→</span>
                <strong>{row.asset_id}</strong>
              </div>
            ))}
          </div>

          <div className="routeCommandMetrics">
            <MiniMetric
              label="Route Distance"
              value={String(metrics?.maintenroute_distance ?? routeStats.distance)}
            />
            <MiniMetric
              label="Risk-only"
              value={String(metrics?.risk_only_distance ?? routeStats.riskOnly)}
            />
            <MiniMetric
              label="High-risk Coverage"
              value={`${(metrics?.high_risk_coverage_percent ?? 100).toFixed(0)}%`}
            />
          </div>
        </div>
      </section>

      <AssetTable assets={assets} />
    </>
  );
}

export function PageHero({
  eyebrow,
  title,
  copy,
  badge
}: {
  eyebrow: string;
  title: string;
  copy: string;
  badge?: string;
}) {
  return (
    <section className="commandHero">
      <div>
        <div className="commandEyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{copy}</p>
      </div>

      {badge && (
        <div className="heroStatus">
          <span />
          {badge}
        </div>
      )}
    </section>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  meta
}: {
  eyebrow: string;
  title: string;
  meta?: string;
}) {
  return (
    <div className="commandSectionHead">
      <div>
        <div className="commandEyebrow">{eyebrow}</div>
        <h2>{title}</h2>
      </div>
      {meta && <div className="commandSectionMeta">{meta}</div>}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  meta,
  accent = false
}: {
  label: string;
  value: string;
  meta: string;
  accent?: boolean;
}) {
  return (
    <div className={accent ? "kpiCard accent" : "kpiCard"}>
      <div className="kpiLabel">{label}</div>
      <div className="kpiValue">{value}</div>
      <div className="kpiMeta">{meta}</div>
    </div>
  );
}

export function MiniMetric({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="miniMetric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

// Compatibility exports used by other pages.
export function RegistryReadout({ label, value }: { label: string; value: string }) {
  return <MiniMetric label={label} value={value} />;
}
export function RegistrySection({
  code,
  label,
  title,
  meta,
  children
}: {
  code: string;
  label: string;
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="commandSection">
      <SectionHeader eyebrow={`${code} · ${label}`} title={title} meta={meta} />
      {children}
    </section>
  );
}
export function Metric({ label, value }: { label: string; value: string }) {
  return <MiniMetric label={label} value={value} />;
}
export function Stat({ label, value }: { label: string; value: string }) {
  return <MiniMetric label={label} value={value} />;
}
