import { clsx } from "clsx/lite";

type SwitchProps = {
  label: string;
  name: string;
  value: string;
  checked: boolean;
  className?: string;
};

/**
 * An on/off switch (`.gui-switch`) inside a form, which it submits on change.
 * The form also needs a submit button for when JS is off.
 */
export function Switch(
  { label, name, value, checked, className }: SwitchProps,
) {
  return (
    <label className={clsx("gui-switch text-1 text-text-2", className)}>
      {label}
      <input
        type="checkbox"
        role="switch"
        name={name}
        value={value}
        defaultChecked={checked}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      />
    </label>
  );
}
