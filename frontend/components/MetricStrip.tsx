type Metric = {
  label: string;
  value: string;
};

export function MetricStrip({ items }: { items: Metric[] }) {
  return (
    <div className="metricStrip">
      {items.map((item) => (
        <div className="metricCell" key={item.label}>
          <div className="metricLabel">{item.label}</div>
          <div className="metricValue">{item.value}</div>
        </div>
      ))}
    </div>
  );
}
