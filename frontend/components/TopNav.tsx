"use client";

import type { PageName } from "@/lib/data";

const items: PageName[] = ["Overview", "Assets", "Planning", "Model Ops"];

export function TopNav({
  page,
  onChange
}: {
  page: PageName;
  onChange: (page: PageName) => void;
}) {
  return (
    <header className="commandTopbar">
      <button
        className="commandBrand"
        onClick={() => onChange("Overview")}
      >
        <span className="commandBrandMark">MR</span>
        <span className="commandBrandCopy">
          <strong>MaintenRoute AI</strong>
          <small>Predictive Maintenance Operations</small>
        </span>
      </button>

      <nav className="commandNav" aria-label="Primary navigation">
        {items.map((item) => (
          <button
            key={item}
            className={page === item ? "commandNavItem active" : "commandNavItem"}
            onClick={() => onChange(item)}
          >
            {item}
          </button>
        ))}
      </nav>
    </header>
  );
}
