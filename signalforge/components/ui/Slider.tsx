"use client";

import type { CSSProperties } from "react";

export function Slider({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  const fill = `${((value - min) / (max - min)) * 100}%`;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[0.85rem] text-ink-2">
          {label}
        </label>
        <output htmlFor={id} className="font-mono text-[0.85rem] text-ink tabular">
          {format ? format(value) : value}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ "--fill": fill } as CSSProperties}
        aria-valuetext={format ? format(value) : String(value)}
      />
    </div>
  );
}
