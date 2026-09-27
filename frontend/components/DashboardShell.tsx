"use client";

import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { TopNav } from "@/components/TopNav";
import { OverviewPage } from "@/components/OverviewPage";
import { AssetsPage } from "@/components/AssetsPage";
import { PlanningPage } from "@/components/PlanningPage";
import { ModelOpsPage } from "@/components/ModelOpsPage";

import {
  assets as fallbackAssets,
  apiAssetToAsset,
  type Asset,
  type AppliedScenario,
  type PageName,
  type PlanningResponse
} from "@/lib/data";

type LayoutSource = "default" | "auto";

type LayoutSnapshot = {
  positions: Record<string, [number, number]>;
  technician: [number, number];
  obstacles: [number, number][];
  gridWidth: number;
  gridHeight: number;
};

const FALLBACK_POSITIONS: Record<string, [number, number]> = {
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

const FALLBACK_OBSTACLES: [number, number][] = [
  [6,1],[6,2],[6,3],[6,4],
  [10,4],[11,4],[12,4],[13,4],[14,4],[15,4],
  [13,6],[13,7],[13,8],[13,9]
];

export function DashboardShell() {
  const [page, setPage] = useState<PageName>("Overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [assetCount, setAssetCount] = useState(10);

  // Layout source = how the current facility is created.
  // Editing is independent and always available on Planning.
  const [layoutSource, setLayoutSource] = useState<LayoutSource>("default");
  const [layoutSeed, setLayoutSeed] = useState(42);

  // Auto-generation settings are separate from the active editable grid.
  const [autoGridWidth, setAutoGridWidth] = useState(20);
  const [autoGridHeight, setAutoGridHeight] = useState(11);
  const [obstacleDensity, setObstacleDensity] = useState(0.07);

  // Active editable layout.
  const [editorReady, setEditorReady] = useState(false);
  const [manualPositions, setManualPositions] = useState<Record<string, [number, number]>>({});
  const [manualTechnician, setManualTechnician] = useState<[number, number]>([1, 5]);
  const [manualObstacles, setManualObstacles] = useState<[number, number][]>([]);
  const [manualGridWidth, setManualGridWidth] = useState(20);
  const [manualGridHeight, setManualGridHeight] = useState(11);

  // Source baseline used by Restore Layout.
  const [sourceBaseline, setSourceBaseline] = useState<LayoutSnapshot | null>(null);

  const [editorTool, setEditorTool] = useState<"asset" | "technician" | "obstacle">("asset");
  const [editorAssetId, setEditorAssetId] = useState("M01");

  const [minRisk, setMinRisk] = useState(0.4);
  const [maxAssets, setMaxAssets] = useState(5);
  const [distanceWeight, setDistanceWeight] = useState(0.8);
  const [appliedScenario, setAppliedScenario] = useState<AppliedScenario | null>(null);

  const [planning, setPlanning] = useState<PlanningResponse | null>(null);
  const [planningError, setPlanningError] = useState<string | null>(null);
  const [planningLoading, setPlanningLoading] = useState(true);

  function cloneSnapshot(snapshot: LayoutSnapshot): LayoutSnapshot {
    return {
      positions: Object.fromEntries(
        Object.entries(snapshot.positions).map(
          ([assetId, [x, y]]) => [assetId, [x, y] as [number, number]]
        )
      ) as Record<string, [number, number]>,
      technician: [snapshot.technician[0], snapshot.technician[1]],
      obstacles: snapshot.obstacles.map(([x, y]) => [x, y] as [number, number]),
      gridWidth: snapshot.gridWidth,
      gridHeight: snapshot.gridHeight
    };
  }

  function snapshotFromPlanning(payload: PlanningResponse): LayoutSnapshot {
    return {
      positions: Object.fromEntries(
        payload.assets.map((asset) => [
          asset.asset_id,
          [asset.position[0], asset.position[1]] as [number, number]
        ])
      ) as Record<string, [number, number]>,
      technician: [
        payload.factory.technician_start[0],
        payload.factory.technician_start[1]
      ],
      obstacles: payload.factory.obstacles.map(
        ([x, y]) => [x, y] as [number, number]
      ),
      gridWidth: payload.factory.grid_width,
      gridHeight: payload.factory.grid_height
    };
  }

  function fallbackSnapshot(): LayoutSnapshot {
    const ids = fallbackAssets
      .slice(0, assetCount)
      .map((asset) => asset.id);

    return {
      positions: Object.fromEntries(
        ids.map((assetId) => [
          assetId,
          [
            FALLBACK_POSITIONS[assetId][0],
            FALLBACK_POSITIONS[assetId][1]
          ] as [number, number]
        ])
      ) as Record<string, [number, number]>,
      technician: [1, 5],
      obstacles: FALLBACK_OBSTACLES.map(
        ([x, y]) => [x, y] as [number, number]
      ),
      gridWidth: 20,
      gridHeight: 11
    };
  }

  function applySnapshot(snapshot: LayoutSnapshot) {
    const cloned = cloneSnapshot(snapshot);

    setManualPositions(cloned.positions);
    setManualTechnician(cloned.technician);
    setManualObstacles(cloned.obstacles);
    setManualGridWidth(cloned.gridWidth);
    setManualGridHeight(cloned.gridHeight);

    const firstAsset = Object.keys(cloned.positions)[0];
    if (firstAsset) {
      setEditorAssetId(firstAsset);
    }
  }

  function captureSourceLayout(payload: PlanningResponse) {
    const snapshot = snapshotFromPlanning(payload);

    setSourceBaseline(cloneSnapshot(snapshot));
    applySnapshot(snapshot);
    setEditorReady(true);
  }

  function loadDefaultLayout() {
    setLayoutSource("default");
    setEditorReady(false);
    setSourceBaseline(null);
  }

  function selectAutoLayout() {
    setLayoutSource("auto");
    setEditorReady(false);
    setSourceBaseline(null);
  }

  function generateAutoLayout() {
    setLayoutSource("auto");
    setLayoutSeed((seed) => seed + 1);
    setEditorReady(false);
    setSourceBaseline(null);
  }

  function restoreSourceLayout() {
    if (sourceBaseline) {
      applySnapshot(sourceBaseline);
      return;
    }

    const fallback = fallbackSnapshot();
    setSourceBaseline(cloneSnapshot(fallback));
    applySnapshot(fallback);
    setEditorReady(true);
  }

  function changeAssetCount(value: number) {
    setAssetCount(value);

    // Reload from whichever source is selected so every active asset
    // receives a valid position before editing resumes.
    setEditorReady(false);
    setSourceBaseline(null);
  }

  function editCell(x: number, y: number) {
    if (!editorReady) return;

    const cell: [number, number] = [x, y];

    const samePoint = (
      a: [number, number],
      b: [number, number]
    ) => (
      a[0] === b[0]
      && a[1] === b[1]
    );

    const assetEntries = Object.entries(manualPositions);

    const occupiedByAsset = assetEntries.find(
      ([, point]) => samePoint(point, cell)
    );

    const occupiedByObstacle = manualObstacles.some(
      (point) => samePoint(point, cell)
    );

    const occupiedByTechnician = samePoint(
      manualTechnician,
      cell
    );

    if (editorTool === "asset") {
      if (
        !editorAssetId
        || occupiedByObstacle
        || occupiedByTechnician
      ) {
        return;
      }

      if (
        occupiedByAsset
        && occupiedByAsset[0] !== editorAssetId
      ) {
        return;
      }

      setManualPositions(
        (previous) => ({
          ...previous,
          [editorAssetId]: cell
        })
      );

      return;
    }

    if (editorTool === "technician") {
      if (
        occupiedByObstacle
        || occupiedByAsset
      ) {
        return;
      }

      setManualTechnician(cell);
      return;
    }

    if (
      occupiedByAsset
      || occupiedByTechnician
    ) {
      return;
    }

    setManualObstacles(
      (previous) => {
        const exists = previous.some(
          (point) => samePoint(point, cell)
        );

        return exists
          ? previous.filter(
              (point) => !samePoint(point, cell)
            )
          : [...previous, cell];
      }
    );
  }

  useEffect(() => {
    const controller = new AbortController();

    async function loadPlanning() {
      setPlanningLoading(true);
      setPlanningError(null);

      try {
        // Source request creates Default or Auto.
        // Once captured, every subsequent request uses backend "manual"
        // mode so the source layout remains directly editable.
        const requestMode = editorReady
          ? "manual"
          : layoutSource;

        const response = await fetch(
          "/api/planning",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              number_of_assets: assetCount,
              minimum_risk: minRisk,
              maximum_assets: maxAssets,
              distance_weight: distanceWeight,
              risk_weight: 0.60,
              criticality_weight: 0.25,
              urgency_weight: 0.15,

              layout_mode: requestMode,

              grid_width: editorReady
                ? manualGridWidth
                : layoutSource === "auto"
                ? autoGridWidth
                : 20,

              grid_height: editorReady
                ? manualGridHeight
                : layoutSource === "auto"
                ? autoGridHeight
                : 11,

              obstacle_density: obstacleDensity,
              layout_seed: layoutSeed,

              custom_positions: editorReady
                ? manualPositions
                : null,

              custom_technician_start: editorReady
                ? manualTechnician
                : null,

              custom_obstacles: editorReady
                ? manualObstacles
                : null,

              scenario: appliedScenario
            }),
            signal: controller.signal
          }
        );

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(
            payload?.detail
            || "Planning request failed."
          );
        }

        const typedPayload = (
          payload as PlanningResponse
        );

        setPlanning(
          typedPayload
        );

        if (!editorReady) {
          captureSourceLayout(
            typedPayload
          );
        }
      } catch (caught) {
        if (
          caught instanceof DOMException
          && caught.name === "AbortError"
        ) {
          return;
        }

        setPlanningError(
          caught instanceof Error
            ? caught.message
            : "Planning request failed."
        );
      } finally {
        setPlanningLoading(false);
      }
    }

    const timer = window.setTimeout(
      loadPlanning,
      120
    );

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    assetCount,
    layoutSource,
    layoutSeed,
    autoGridWidth,
    autoGridHeight,
    obstacleDensity,
    editorReady,
    manualPositions,
    manualTechnician,
    manualObstacles,
    manualGridWidth,
    manualGridHeight,
    minRisk,
    maxAssets,
    distanceWeight,
    appliedScenario
  ]);

  const liveAssets: Asset[] = useMemo(
    () => planning
      ? planning.assets.map(apiAssetToAsset)
      : fallbackAssets.slice(0, assetCount),
    [planning, assetCount]
  );

  return (
    <div className="appShell">
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((value) => !value)}

        assetCount={assetCount}
        setAssetCount={changeAssetCount}

        layoutSource={layoutSource}
        onLoadDefault={loadDefaultLayout}
        onSelectAuto={selectAutoLayout}

        gridWidth={autoGridWidth}
        setGridWidth={setAutoGridWidth}
        gridHeight={autoGridHeight}
        setGridHeight={setAutoGridHeight}
        obstacleDensity={obstacleDensity}
        setObstacleDensity={setObstacleDensity}
        onGenerateLayout={generateAutoLayout}

        minRisk={minRisk}
        setMinRisk={setMinRisk}
        maxAssets={maxAssets}
        setMaxAssets={setMaxAssets}
        distanceWeight={distanceWeight}
        setDistanceWeight={setDistanceWeight}
      />

      <main className="mainArea">
        <div className="content">
          <TopNav
            page={page}
            onChange={setPage}
          />

          <div
            className={
              planningError
                ? "commandSystemBar error"
                : "commandSystemBar"
            }
          >
            <span
              className={
                planningLoading
                  ? "backendDot loading"
                  : planningError
                  ? "backendDot error"
                  : "backendDot"
              }
            />

            <span>
              {planningError
                ? "Planning fallback"
                : planningLoading
                ? "Recomputing plan"
                : "Live planning connected"}
            </span>

            <em>
              {planningError
                ?? `${planning?.model ?? "XGBoost"} · threshold ${
                  (
                    planning?.operating_threshold
                    ?? 0.81
                  ).toFixed(2)
                }`}
            </em>
          </div>

          {page === "Overview" && (
            <OverviewPage
              assets={liveAssets}
              maxAssets={maxAssets}
              minRisk={minRisk}
              distanceWeight={distanceWeight}
              planning={planning}
            />
          )}

          {page === "Assets" && (
            <AssetsPage
              assets={liveAssets}
              planning={planning}
              appliedScenario={appliedScenario}
              onApplyScenario={setAppliedScenario}
              onResetScenario={() => setAppliedScenario(null)}
            />
          )}

          {page === "Planning" && (
            <PlanningPage
              assets={liveAssets}
              maxAssets={maxAssets}
              minRisk={minRisk}
              planning={planning}
              layoutSource={layoutSource}
              editorReady={editorReady}
              editorTool={editorTool}
              setEditorTool={setEditorTool}
              editorAssetId={editorAssetId}
              setEditorAssetId={setEditorAssetId}
              onEditCell={editCell}
              onResetLayout={restoreSourceLayout}
            />
          )}

          {page === "Model Ops" && (
            <ModelOpsPage />
          )}

          <footer className="footer">
            <span>MaintenRoute AI</span>
            <span>prediction · prioritization · routing</span>
            <span>prototype / 2026</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
