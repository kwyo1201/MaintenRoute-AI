"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";
import type { Asset, RiskLevel } from "@/lib/data";

const order: RiskLevel[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

const colors: Record<RiskLevel, string> = {
  CRITICAL: "#cf777b",
  HIGH: "#bd9665",
  MEDIUM: "#a89a67",
  LOW: "#76b991"
};

export function RiskDistribution({
  assets
}: {
  assets: Asset[];
}) {
  const data = order.map((level) => ({
    level: level[0] + level.slice(1).toLowerCase(),
    key: level,
    count: assets.filter((asset) => asset.level === level).length
  }));

  return (
    <div className="recordBlock">
      <div className="recordBlockHead">
        <div>
          <div className="eyebrow">risk field</div>
          <h3>Distribution</h3>
        </div>
        <div className="panelMeta">{assets.length} records</div>
      </div>

      <div className="chartWrap">
        <ResponsiveContainer width="100%" height={230}>
          <BarChart
            layout="vertical"
            data={data}
            margin={{ top: 8, right: 36, bottom: 8, left: 0 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="level"
              axisLine={false}
              tickLine={false}
              tick={{
                fill: "#8f8a82",
                fontSize: 11,
                fontFamily: '"Segoe UI", Arial, Helvetica, sans-serif'
              }}
              width={78}
            />

            <Tooltip
              cursor={{ fill: "rgba(236,232,223,0.018)" }}
              contentStyle={{
                background: "#11110f",
                border: "1px solid #35332f",
                borderRadius: 0,
                color: "#eee9df",
                fontSize: 11,
                fontFamily: '"Segoe UI", Arial, Helvetica, sans-serif'
              }}
            />

            <Bar dataKey="count" barSize={12} radius={0}>
              {data.map((entry) => (
                <Cell
                  key={entry.key}
                  fill={colors[entry.key as RiskLevel]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
