import type {
  Asset,
  PlanningResponse
} from "@/lib/data";

const defaultPositions: Record<
  string,
  [number, number]
> = {
  M01: [3, 2],
  M02: [7, 2],
  M03: [11, 2],
  M04: [4, 5],
  M05: [9, 5],
  M06: [14, 5],
  M07: [2, 8],
  M08: [7, 8],
  M09: [12, 8],
  M10: [17, 8]
};

const defaultObstacles: [number, number][] = [
  [6,1],[6,2],[6,3],[6,4],
  [10,4],[11,4],[12,4],[13,4],[14,4],[15,4],
  [13,6],[13,7],[13,8],[13,9]
];

const defaultRoute: [number, number][] = [
  [1,5],[2,5],[3,5],[4,5],
  [3,5],[3,4],[3,3],[3,2],
  [4,2],[5,2],[5,1],[5,0],
  [6,0],[7,0],[7,1],[7,2],
  [8,2],[9,2],[10,2],[11,2],
  [10,2],[9,2],[9,3],[9,4],[9,5],
  [10,5],[11,5],[12,5],[13,5],[14,5]
];


const riskColor = (
  level: string
) => {
  if (level === "CRITICAL") return "#e7565b";
  if (level === "HIGH") return "#ed7d22";
  if (level === "MEDIUM") return "#e2b21c";
  return "#2bc56e";
};

export function FactoryMap({
  assets,
  planning,
  editable = false,
  onCellClick
}: {
  assets: Asset[];
  planning: PlanningResponse | null;
  editable?: boolean;
  onCellClick?: (x: number, y: number) => void;
}) {
  const apiAssets = planning?.assets ?? [];

  const positions = Object.fromEntries(
    apiAssets.map(
      (asset) => [
        asset.asset_id,
        asset.position
      ]
    )
  ) as Record<string, [number, number]>;

  const route = (
    planning
      ? planning.maintenroute_route
      : defaultRoute
  );

  const obstacles = (
    planning?.factory.obstacles
    ?? defaultObstacles
  );

  const technician = (
    planning?.factory.technician_start
    ?? [1, 5]
  ) as [number, number];

  const gridWidth = (
    planning?.factory.grid_width
    ?? 20
  );

  const gridHeight = (
    planning?.factory.grid_height
    ?? 11
  );

  const mapLeft = 46;
  const mapRight = 842;
  const mapTop = 34;
  const mapBottom = 386;

  const sx = (x: number) => (
    mapLeft
    + (
        x
        / Math.max(gridWidth - 1, 1)
      )
      * (mapRight - mapLeft)
  );

  const sy = (y: number) => (
    mapBottom
    - (
        y
        / Math.max(gridHeight - 1, 1)
      )
      * (mapBottom - mapTop)
  );

  const routePoints = route
    .map(
      ([x, y]) => `${sx(x)},${sy(y)}`
    )
    .join(" ");

  return (
    <div className="mapPanel">
      <div className="panelHeader">
        <div>
          <div className="eyebrow">
            route intelligence
          </div>
          <h3>Technician route</h3>
        </div>
        <div className="panelMeta">
          live / FastAPI planning
        </div>
      </div>

      <svg
        className={editable ? "factorySvg editable" : "factorySvg"}
        viewBox="0 0 880 420"
        role="img"
        aria-label="MaintenRoute facility map"
        onClick={editable && onCellClick ? (event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const px = ((event.clientX - rect.left) / rect.width) * 880;
          const py = ((event.clientY - rect.top) / rect.height) * 420;
          const x = Math.round(((px - mapLeft) / (mapRight - mapLeft)) * Math.max(gridWidth - 1, 1));
          const y = Math.round(((mapBottom - py) / (mapBottom - mapTop)) * Math.max(gridHeight - 1, 1));
          if (x >= 0 && x < gridWidth && y >= 0 && y < gridHeight) onCellClick(x, y);
        } : undefined}
      >
        {Array.from({ length: gridWidth }).map(
          (_, x) => (
            <line
              key={`x${x}`}
              x1={sx(x)}
              y1={35}
              x2={sx(x)}
              y2={390}
              className="gridLine"
            />
          )
        )}

        {Array.from({ length: gridHeight }).map(
          (_, y) => (
            <line
              key={`y${y}`}
              x1={35}
              y1={sy(y)}
              x2={850}
              y2={sy(y)}
              className="gridLine"
            />
          )
        )}

        <polyline
          points={routePoints}
          fill="none"
          className="routeLine"
        />

        {obstacles.map(
          ([x, y], index) => (
            <rect
              key={index}
              x={sx(x) - 8}
              y={sy(y) - 8}
              width="16"
              height="16"
              className="obstacle"
            />
          )
        )}

        <polygon
          points={`${sx(technician[0])},${sy(technician[1])-13} ${sx(technician[0])+4},${sy(technician[1])-4} ${sx(technician[0])+14},${sy(technician[1])-4} ${sx(technician[0])+6},${sy(technician[1])+2} ${sx(technician[0])+9},${sy(technician[1])+13} ${sx(technician[0])},${sy(technician[1])+7} ${sx(technician[0])-9},${sy(technician[1])+13} ${sx(technician[0])-6},${sy(technician[1])+2} ${sx(technician[0])-14},${sy(technician[1])-4} ${sx(technician[0])-4},${sy(technician[1])-4}`}
          className="techStar"
        />

        <text
          x={sx(technician[0])}
          y={sy(technician[1]) - 20}
          className="mapLabel"
          textAnchor="middle"
        >
          Technician
        </text>

        {assets.map((asset) => {
          const position = (
            positions[asset.id]
            ?? defaultPositions[asset.id]
          );

          if (!position) return null;

          const sequenceRow = (
            planning?.maintenance_sequence.find(
              (row) => row.asset_id === asset.id
            )
          );

          return (
            <g key={asset.id}>
              <circle
                cx={sx(position[0])}
                cy={sy(position[1])}
                r="10"
                fill={riskColor(asset.level)}
                className="assetCircle"
              />

              <text
                x={sx(position[0])}
                y={sy(position[1]) - 22}
                className="mapLabel"
                textAnchor="middle"
              >
                {sequenceRow
                  ? `#${sequenceRow.order} ${asset.id}`
                  : asset.id}
              </text>

              <text
                x={sx(position[0])}
                y={sy(position[1]) + 25}
                className="mapSubLabel"
                textAnchor="middle"
              >
                {asset.risk < 1
                  ? asset.risk.toFixed(2)
                  : asset.risk.toFixed(1)}%
              </text>
            </g>
          );
        })}

        {editable && (
          <text x="835" y="407" textAnchor="end" className="editorMapHint">
            click a grid intersection to edit
          </text>
        )}
      </svg>
    </div>
  );
}
