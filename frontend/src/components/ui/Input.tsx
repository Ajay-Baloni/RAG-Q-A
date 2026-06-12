import { forwardRef, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, id, className = '', ...rest },
  ref
) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-xs font-medium uppercase tracking-wide text-muted">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={`rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-muted/70 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 ${className}`}
        {...rest}
      />
    </div>
  );
});
