import { HTMLAttributes } from "preact";

type NumberRangeProps =
  & Omit<HTMLAttributes<HTMLInputElement>, "onChange" | "value" | "label">
  & {
    label: string;
    name: string;
    value: [number, number];
    min?: number;
    max?: number;
    onChange: (value: [number, number]) => void;
  };

/**
 * Simple number range input with two values
 */
// TODO: build proper custom input that can just be dropped into a form (this is a bit hacky)
export function NumberRange(
  { label, value, name, min = 0, max = 20, onChange, ...rest }:
    NumberRangeProps,
) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={`${name}-min`} className="text-fl-0 text-text-2">
        {label}
      </label>

      <div className="flex items-center gap-fl-1">
        <input
          type="number"
          className="text-1 min-w-4ch text-center bg-surface-1"
          name={`${name}-min`}
          value={value[0]}
          min={min}
          max={value[1]}
          onChange={(e) => onChange([Number(e.currentTarget.value), value[1]])}
          {...rest}
        />

        <span className="text-text-2">–</span>

        <input
          type="number"
          className="text-1 min-w-4ch text-center bg-surface-1"
          name={`${name}-min`}
          value={value[1]}
          min={value[0]}
          max={max}
          onChange={(e) => onChange([value[0], Number(e.currentTarget.value)])}
          {...rest}
        />
      </div>
    </div>
  );
}
