'use client';

import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { forwardRef, useEffect, useId, useRef } from 'react';

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: 'primary' | 'secondary' | 'danger' | 'quiet';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    className,
    disabled,
    leadingIcon,
    loading = false,
    size = 'md',
    tone = 'primary',
    trailingIcon,
    type = 'button',
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      className={classes('mb-button', `mb-button--${tone}`, `mb-button--${size}`, className)}
      disabled={disabled || loading}
      type={type}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner label="Working" size="sm" /> : leadingIcon}
      <span>{children}</span>
      {!loading && trailingIcon}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'default' | 'danger';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { children, className, label, size = 'md', tone = 'default', type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={classes(
        'mb-icon-button',
        `mb-icon-button--${size}`,
        tone === 'danger' && 'mb-icon-button--danger',
        className,
      )}
      aria-label={label}
      title={label}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
});

export interface FieldProps {
  children: ReactNode;
  className?: string | undefined;
  description?: string | undefined;
  error?: string | undefined;
  label: string;
  required?: boolean | undefined;
}

export function Field({ children, className, description, error, label, required }: FieldProps) {
  return (
    <label className={classes('mb-field', className)}>
      <span className="mb-field__label">
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </span>
      {children}
      {error ? (
        <span className="mb-field__error" role="alert">
          {error}
        </span>
      ) : description ? (
        <span className="mb-field__description">{description}</span>
      ) : null}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={classes('mb-input', className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ children, className, ...props }, ref) {
    return (
      <select ref={ref} className={classes('mb-select', className)} {...props}>
        {children}
      </select>
    );
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={classes('mb-textarea', className)} {...props} />;
});

export interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  description?: string | undefined;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className, description, label, ...props },
  ref,
) {
  return (
    <label className={classes('mb-checkbox', className)}>
      <input ref={ref} type="checkbox" {...props} />
      <span className="mb-checkbox__copy">
        <span>{label}</span>
        {description ? <small>{description}</small> : null}
      </span>
    </label>
  );
});

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export function Badge({
  children,
  className,
  tone = 'neutral',
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return <span className={classes('mb-badge', `mb-badge--${tone}`, className)}>{children}</span>;
}

export function Surface({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={classes('mb-surface', className)} {...props} />;
}

export function Spinner({
  label = 'Loading',
  size = 'md',
}: {
  label?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <span className={classes('mb-spinner', `mb-spinner--${size}`)} role="status">
      <span className="mb-spinner__ring" aria-hidden="true" />
      <span className="mb-sr-only">{label}</span>
    </span>
  );
}

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={classes('mb-skeleton', className)} aria-hidden="true" {...props} />;
}

export interface StateProps {
  action?: ReactNode;
  description: string;
  icon?: ReactNode;
  title: string;
}

function StatePanel({ action, description, icon, title }: StateProps) {
  return (
    <div className="mb-state">
      {icon ? (
        <div className="mb-state__icon" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <h2>{title}</h2>
      <p>{description}</p>
      {action ? <div className="mb-state__action">{action}</div> : null}
    </div>
  );
}

export function EmptyState(props: StateProps) {
  return <StatePanel {...props} />;
}

export function PermissionState(props: StateProps) {
  return <StatePanel {...props} />;
}

export function ErrorState({
  correlationId,
  ...props
}: StateProps & { correlationId?: string | undefined }) {
  return (
    <div>
      <StatePanel {...props} />
      {correlationId ? (
        <p className="mb-correlation">
          Support reference: <code>{correlationId}</code>
        </p>
      ) : null}
    </div>
  );
}

export function InlineNotice({
  children,
  className,
  tone = 'info',
  ...props
}: HTMLAttributes<HTMLDivElement> & { tone?: 'info' | 'success' | 'warning' | 'danger' }) {
  return (
    <div
      className={classes('mb-inline-notice', `mb-inline-notice--${tone}`, className)}
      role={tone === 'danger' ? 'alert' : 'status'}
      {...props}
    >
      {children}
    </div>
  );
}

export interface DialogProps {
  children: ReactNode;
  description?: string;
  footer?: ReactNode;
  onClose: () => void;
  open: boolean;
  title: string;
  width?: 'sm' | 'md' | 'lg';
}

export function Dialog({
  children,
  description,
  footer,
  onClose,
  open,
  title,
  width = 'md',
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={classes('mb-dialog', `mb-dialog--${width}`)}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="mb-dialog__panel">
        <header className="mb-dialog__header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <IconButton label="Close dialog" size="sm" onClick={onClose}>
            <span aria-hidden="true">x</span>
          </IconButton>
        </header>
        <div className="mb-dialog__body">{children}</div>
        {footer ? <footer className="mb-dialog__footer">{footer}</footer> : null}
      </div>
    </dialog>
  );
}
