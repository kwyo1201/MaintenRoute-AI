import type { Asset } from "@/lib/data";
import { RegistrySection } from "@/components/OverviewPage";

export function AssetTable({
  assets
}: {
  assets: Asset[];
}) {
  return (
    <RegistrySection
      code="ASSET"
      label="registry"
      title="Asset Registry"
      meta={`${assets.length} representative assets · sorted by failure risk`}
    >
      <div className="tableWrap registryTableWrap">
        <table className="dataTable">
          <thead>
            <tr>
              <th>record</th>
              <th>asset</th>
              <th>failure risk</th>
              <th>risk level</th>
              <th>alert</th>
              <th>priority</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset, index) => (
              <tr key={asset.id}>
                <td className="recordId">
                  AST-{String(index + 1).padStart(3, "0")}
                </td>
                <td className="strong">{asset.id}</td>
                <td>
                  {asset.risk < 1
                    ? asset.risk.toFixed(2)
                    : asset.risk.toFixed(1)}%
                </td>
                <td>
                  <span className="statusCell">
                    <span
                      className={`statusDot status-${asset.level.toLowerCase()}`}
                    />
                    {asset.level}
                  </span>
                </td>
                <td className={asset.alert === "ALERT" ? "alertText" : ""}>
                  {asset.alert}
                </td>
                <td>{asset.priority.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </RegistrySection>
  );
}
