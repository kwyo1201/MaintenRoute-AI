"use client";

type LayoutSource = "default" | "auto";

type Props = {
  open: boolean;
  onToggle: () => void;

  assetCount: number;
  setAssetCount: (value: number) => void;

  layoutSource: LayoutSource;
  onLoadDefault: () => void;
  onSelectAuto: () => void;

  gridWidth: number;
  setGridWidth: (value: number) => void;
  gridHeight: number;
  setGridHeight: (value: number) => void;
  obstacleDensity: number;
  setObstacleDensity: (value: number) => void;
  onGenerateLayout: () => void;

  minRisk: number;
  setMinRisk: (value: number) => void;
  maxAssets: number;
  setMaxAssets: (value: number) => void;
  distanceWeight: number;
  setDistanceWeight: (value: number) => void;
};

export function Sidebar({
  open,
  onToggle,

  assetCount,
  setAssetCount,

  layoutSource,
  onLoadDefault,
  onSelectAuto,

  gridWidth,
  setGridWidth,
  gridHeight,
  setGridHeight,
  obstacleDensity,
  setObstacleDensity,
  onGenerateLayout,

  minRisk,
  setMinRisk,
  maxAssets,
  setMaxAssets,
  distanceWeight,
  setDistanceWeight
}: Props) {
  return (
    <>
      {!open && (
        <button
          className="controlsLauncher"
          onClick={onToggle}
          aria-label="Open controls"
        >
          <span className="controlsIcon">☷</span>
          Controls
        </button>
      )}

      {open && (
        <div className="drawerLayer">
          <button
            className="drawerScrim"
            onClick={onToggle}
            aria-label="Close controls"
          />

          <aside className="controlDrawer">
            <div className="drawerHeader">
              <div>
                <div className="drawerEyebrow">
                  SYSTEM CONTROLS
                </div>
                <h2>Plant Settings</h2>
              </div>

              <button
                className="drawerClose"
                onClick={onToggle}
              >
                ×
              </button>
            </div>

            <div className="drawerStatus">
              <span />
              Planning service online
            </div>

            <ControlGroup title="Factory">
              <RangeControl
                label="Assets"
                value={assetCount}
                min={1}
                max={10}
                step={1}
                format={(value) => String(value)}
                onChange={setAssetCount}
              />

              <div className="segmentedBlock">
                <div className="drawerLabel">
                  Layout Source
                </div>

                <div className="segmentedControl two">
                  <button
                    className={
                      layoutSource === "default"
                        ? "active"
                        : ""
                    }
                    onClick={onLoadDefault}
                  >
                    Default
                  </button>

                  <button
                    className={
                      layoutSource === "auto"
                        ? "active"
                        : ""
                    }
                    onClick={onSelectAuto}
                  >
                    Auto
                  </button>
                </div>
              </div>

              {layoutSource === "default" && (
                <div className="drawerSourceInfo">
                  <strong>Default Layout</strong>
                  <span>
                    Loads the fixed prototype facility.
                    The map remains fully editable in Planning.
                  </span>

                  <button
                    className="drawerSecondary"
                    onClick={onLoadDefault}
                  >
                    Reload Default Layout
                  </button>
                </div>
              )}

              {layoutSource === "auto" && (
                <div className="drawerNested">
                  <RangeControl
                    label="Factory Width"
                    value={gridWidth}
                    min={12}
                    max={30}
                    step={1}
                    format={(value) => String(value)}
                    onChange={setGridWidth}
                  />

                  <RangeControl
                    label="Factory Height"
                    value={gridHeight}
                    min={8}
                    max={20}
                    step={1}
                    format={(value) => String(value)}
                    onChange={setGridHeight}
                  />

                  <RangeControl
                    label="Obstacle Density"
                    value={obstacleDensity}
                    min={0}
                    max={0.20}
                    step={0.01}
                    format={(value) => value.toFixed(2)}
                    onChange={setObstacleDensity}
                  />

                  <button
                    className="drawerPrimary"
                    onClick={onGenerateLayout}
                  >
                    Generate Auto Layout
                  </button>

                  <div className="drawerHint compact">
                    Generated layouts remain editable directly
                    on the Planning map.
                  </div>
                </div>
              )}
            </ControlGroup>

            <ControlGroup title="Planning">
              <RangeControl
                label="Minimum Failure Risk"
                value={minRisk}
                min={0}
                max={1}
                step={0.01}
                format={(value) => value.toFixed(2)}
                onChange={setMinRisk}
              />

              <RangeControl
                label="Inspection Capacity"
                value={maxAssets}
                min={1}
                max={10}
                step={1}
                format={(value) => String(value)}
                onChange={setMaxAssets}
              />

              <RangeControl
                label="Distance Weight"
                value={distanceWeight}
                min={0}
                max={1.5}
                step={0.05}
                format={(value) => value.toFixed(2)}
                onChange={setDistanceWeight}
              />
            </ControlGroup>

            <div className="drawerFooter">
              risk 0.60 · criticality 0.25 · urgency 0.15
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

function ControlGroup({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="drawerGroup">
      <div className="drawerGroupTitle">
        {title}
      </div>
      {children}
    </section>
  );
}

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  const progress = (
    (value - min)
    / (max - min)
    * 100
  );

  return (
    <div className="drawerRange">
      <div className="drawerRangeTop">
        <span>{label}</span>
        <strong>{format(value)}</strong>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{
          "--range-progress": `${progress}%`
        } as React.CSSProperties}
        onChange={(event) => onChange(
          Number(event.target.value)
        )}
      />
    </div>
  );
}
