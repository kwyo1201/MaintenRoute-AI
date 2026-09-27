import type { Asset } from "@/lib/data";
import { baseQueue } from "@/lib/data";

export function InspectionQueue({
  assets,
  maxAssets,
  minRisk
}: {
  assets: Asset[];
  maxAssets: number;
  minRisk: number;
}) {
  const rows = baseQueue
    .map((id) => assets.find((a) => a.id === id))
    .filter((a): a is Asset => Boolean(a))
    .filter((a) => a.risk / 100 >= minRisk)
    .slice(0, maxAssets);

  return (
    <div className="panel">
      <div className="panelHeader">
        <div>
          <div className="eyebrow">inspection sequence</div>
          <h3>Today's queue</h3>
        </div>
        <div className="panelMeta">capacity / {maxAssets}</div>
      </div>
      <div className="queue">
        {rows.map((row, index) => (
          <div className="queueRow" key={row.id}>
            <div className="queueOrder">{String(index + 1).padStart(2, "0")}</div>
            <div className="queueAsset">{row.id}</div>
            <div className="queueMeta">priority {row.priority.toFixed(3)}</div>
            <div className="queueRisk">{row.risk.toFixed(1)}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}
