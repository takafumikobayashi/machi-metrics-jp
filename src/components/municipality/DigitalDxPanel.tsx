import type { DigitalDxFile } from "@/lib/data/digital-dx-schema";

export function DigitalDxPanel({
  metrics,
}: {
  metrics: DigitalDxFile["entries"][number]["metrics"];
}) {
  const implemented = metrics.filter(
    (metric) => metric.display_value === "実施",
  ).length;
  const notImplemented = metrics.filter(
    (metric) => metric.display_value === "未実施",
  ).length;
  const categories = [...new Set(metrics.map((metric) => metric.category))];
  return (
    <section className="data-card" aria-labelledby="digital-dx-heading">
      <div className="section-heading compact-heading">
        <p className="eyebrow">自治体DX</p>
        <h2 id="digital-dx-heading">デジタル化の取組状況</h2>
        <p className="section-note">
          デジタル庁が公開する機械可読データをもとに、実施状況と公表された割合を表示しています。
        </p>
      </div>
      <div className="dx-summary-grid">
        <div>
          <strong>{implemented}</strong>
          <span>実施</span>
        </div>
        <div>
          <strong>{notImplemented}</strong>
          <span>未実施</span>
        </div>
        <div>
          <strong>{metrics.length}</strong>
          <span>確認項目</span>
        </div>
      </div>
      <div className="dx-chart-list">
        {categories.map((category) => (
          <div className="dx-category" key={category}>
            <h3>{category}</h3>
            {metrics
              .filter((metric) => metric.category === category)
              .map((metric) => (
                <div className="dx-metric" key={metric.label}>
                  <div className="dx-metric-label">
                    <span>{metric.label}</span>
                    <strong>{metric.display_value ?? "データなし"}</strong>
                  </div>
                  {metric.value !== null ? (
                    <div
                      className="dx-meter"
                      aria-label={`${metric.label} ${metric.display_value}`}
                    >
                      <span style={{ width: `${metric.value * 100}%` }} />
                    </div>
                  ) : null}
                </div>
              ))}
          </div>
        ))}
      </div>
      <p className="section-note">
        ※
        基準日は2024年7月12日です。「実施」「未実施」は原本の表記を維持しています。
      </p>
    </section>
  );
}
