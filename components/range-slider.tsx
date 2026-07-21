import { HTMLAttributes } from "preact";

type RangeSliderProps =
  & Omit<HTMLAttributes<HTMLInputElement>, "onChange" | "value" | "label">
  & {
    label: string;
    name: string;
    value: number;
    min?: number;
    max?: number;
    step?: number;
    /** Formats the value for the readout (e.g. a percentage). */
    format?: (value: number) => string;
    onChange: (value: number) => void;
  };

/**
 * Single-value range slider with a label and live value readout, styled to
 * match the sidebar controls. Complements `NumberRange` (which is two-valued).
 */
export function RangeSlider(
  {
    label,
    name,
    value,
    min = 0,
    max = 100,
    step = 1,
    format,
    onChange,
    ...rest
  }: RangeSliderProps,
) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-fl-1">
        <label htmlFor={name} className="text-fl-0 text-text-2">
          {label}
        </label>
        <span className="text-1 text-text-1 font-weight-7 tabular-nums">
          {format ? format(value) : value}
        </span>
      </div>

      <input
        type="range"
        id={name}
        name={name}
        className="w-full accent-brand cursor-pointer"
        value={value}
        min={min}
        max={max}
        step={step}
        onInput={(e) => onChange(Number(e.currentTarget.value))}
        {...rest}
      />
    </div>
  );
}
