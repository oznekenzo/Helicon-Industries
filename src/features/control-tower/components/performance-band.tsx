"use client";

import { IconArrowDown, IconArrowUp, IconMinus } from "@tabler/icons-react";

import { SegmentedControl } from "@/components/ui/control-tower-primitives";
import { formatInteger, formatPercent } from "@/features/control-tower/format";
import type {
  PerformanceMetric,
  PerformanceWindow,
  PerformanceWindowKey,
} from "@/features/control-tower/types";

const windowOptions: Array<{ value: PerformanceWindowKey; label: string }> = [
  { value: "7d", label: "7D" },
  { value: "14d", label: "14D" },
  { value: "all", label: "All" },
];

function Delta({ metric }: { metric: PerformanceMetric }) {
  if (metric.delta === null) return <span className="kpi-delta">—</span>;
  const isFlat = Math.abs(metric.delta) < 0.05;
  const positive = metric.delta > 0;
  const IconComponent = isFlat
    ? IconMinus
    : positive
      ? IconArrowUp
      : IconArrowDown;
  const suffix = metric.deltaUnit === "percentage-points" ? " pp" : "%";

  return (
    <span
      className={`kpi-delta ${isFlat ? "is-flat" : positive ? "is-positive" : "is-negative"}`}
    >
      <IconComponent aria-hidden="true" size={12} stroke={2} />
      {positive ? "+" : ""}
      {metric.delta.toFixed(1)}
      {suffix}
    </span>
  );
}

function Meter({
  value,
  prior,
}: {
  value: number | null;
  prior: number | null;
}) {
  const cells = 40;
  const now = value === null ? 0 : Math.round(value * cells);
  const previous = prior === null ? -1 : Math.round(prior * cells);
  return (
    <div aria-hidden="true" className="meter">
      {Array.from({ length: cells }, (_, index) => {
        const between =
          previous >= 0 &&
          index >= Math.min(now, previous) &&
          index < Math.max(now, previous);
        return (
          <span
            className={index < now ? "is-filled" : between ? "is-prior" : ""}
            key={index}
          />
        );
      })}
    </div>
  );
}

function DailyBars({ values }: { values: number[] }) {
  const displayedValues = values.slice(-14);
  const maximum = Math.max(...displayedValues, 1);
  const priorCount = Math.max(displayedValues.length - 7, 0);
  return (
    <div aria-label="Daily good units" className="daily-bars" role="img">
      {displayedValues.map((value, index) => (
        <span
          className={index < priorCount ? "is-prior" : undefined}
          key={index}
          style={{
            height: `${Math.max(3, Math.round((value / maximum) * 34))}px`,
          }}
          title={`${formatInteger(value)} good units`}
        />
      ))}
    </div>
  );
}

export function PerformanceBand({
  selected,
  window,
  onWindowChange,
}: {
  selected: PerformanceWindowKey;
  window: PerformanceWindow;
  onWindowChange: (value: PerformanceWindowKey) => void;
}) {
  const onTime = window.onTimeCompletion;
  const units = window.goodUnitsProduced;
  const productionYield = window.productionYield;

  return (
    <section className="performance-band" aria-labelledby="performance-heading">
      <div className="section-heading-row">
        <h2 id="performance-heading">Facility performance</h2>
        <span>{window.label}</span>
        <div className="section-heading-row__spacer" />
        <SegmentedControl
          label="Performance window"
          onChange={onWindowChange}
          options={windowOptions}
          value={selected}
        />
      </div>
      <div className="kpi-grid">
        <article className="kpi-cell">
          <h3>On-time completion</h3>
          <div className="kpi-value-row">
            <strong>{formatPercent(onTime.value)}</strong>
            <Delta metric={onTime} />
          </div>
          <p>
            {onTime.denominator === undefined
              ? "Not reported"
              : `${onTime.numerator ?? 0} of ${onTime.denominator} Jobs`}
          </p>
          <Meter prior={onTime.priorValue} value={onTime.value} />
          <small>
            PRIOR{" "}
            {onTime.priorValue === null
              ? "—"
              : formatPercent(onTime.priorValue)}
          </small>
        </article>
        <article className="kpi-cell">
          <h3>Good units produced</h3>
          <div className="kpi-value-row">
            <strong>
              {units.value === null ? "—" : formatInteger(units.value)}
            </strong>
            <Delta metric={units} />
          </div>
          <p>
            {selected === "all"
              ? "All-time total"
              : `${selected.replace("d", "-day")} total`}
          </p>
          <DailyBars values={units.dailyValues} />
          <small>
            DAILY · PRIOR{" "}
            {units.priorValue === null ? "—" : formatInteger(units.priorValue)}
          </small>
        </article>
        <article className="kpi-cell">
          <h3>Production yield</h3>
          <div className="kpi-value-row">
            <strong>{formatPercent(productionYield.value)}</strong>
            <Delta metric={productionYield} />
          </div>
          <p>
            {productionYield.scrapUnits === undefined
              ? "Not reported"
              : `${formatInteger(productionYield.scrapUnits)} scrap units`}
          </p>
          <Meter
            prior={productionYield.priorValue}
            value={productionYield.value}
          />
          <small>
            PRIOR{" "}
            {productionYield.priorValue === null
              ? "—"
              : formatPercent(productionYield.priorValue)}
          </small>
        </article>
      </div>
    </section>
  );
}
