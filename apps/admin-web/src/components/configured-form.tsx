'use client';
/* eslint-disable react-hooks/refs -- React Hook Form field refs are intentionally forwarded to controls. */

import { zodResolver } from '@hookform/resolvers/zod';
import { Checkbox, Field, Input, Select, Textarea } from '@manglam/ui';
import { useQuery } from '@tanstack/react-query';
import type { ChangeEvent } from 'react';
import type { Control, Resolver } from 'react-hook-form';
import { useController, useForm } from 'react-hook-form';
import { z } from 'zod';

import { apiList } from '@/lib/api-client';
import type { ApiRecord } from '@/lib/api-types';
import type { FormFieldConfig, LookupConfig } from '@/lib/resource-config';

export type FormValue = boolean | number | string | string[];
export type FormValues = Record<string, FormValue>;

function getValue(record: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => {
    if (!value || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[key];
  }, record);
}

function optionLabel(record: ApiRecord, keys: string[]) {
  const values = keys
    .map((key) => getValue(record, key))
    .filter(
      (value): value is string | number => typeof value === 'string' || typeof value === 'number',
    )
    .map(String);
  return values.join(' - ') || record.id;
}

function useLookup(config: LookupConfig | undefined) {
  return useQuery({
    queryKey: ['lookup', config?.endpoint, config?.query],
    queryFn: ({ signal }) =>
      apiList<ApiRecord>(config!.endpoint, { limit: 200, ...config?.query }, signal),
    enabled: Boolean(config),
    staleTime: 60_000,
  });
}

function RemoteSelect({
  config,
  disabled,
  onChange,
  value,
}: {
  config: LookupConfig;
  disabled?: boolean | undefined;
  onChange: (value: string) => void;
  value: FormValue;
}) {
  const lookupQuery = useLookup(config);
  const stringValue = typeof value === 'string' ? value : '';

  return (
    <>
      <Select
        value={stringValue}
        onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value)}
        disabled={disabled || lookupQuery.isLoading || lookupQuery.isError}
      >
        <option value="">
          {lookupQuery.isLoading
            ? 'Loading options...'
            : lookupQuery.isError
              ? 'Options unavailable'
              : lookupQuery.data?.items.length
                ? 'Select an option'
                : 'No options available'}
        </option>
        {lookupQuery.data?.items.map((record) => (
          <option
            key={record.id}
            value={String(getValue(record, config.valueKey ?? 'id') ?? record.id)}
          >
            {optionLabel(record, config.labelKeys)}
          </option>
        ))}
      </Select>
      {lookupQuery.isError ? (
        <button className="lookup-retry" type="button" onClick={() => void lookupQuery.refetch()}>
          Retry loading options
        </button>
      ) : null}
    </>
  );
}

function RemoteMultiSelect({
  config,
  disabled,
  onChange,
  value,
}: {
  config: LookupConfig;
  disabled?: boolean | undefined;
  onChange: (value: string[]) => void;
  value: FormValue;
}) {
  const lookupQuery = useLookup(config);
  const selected = Array.isArray(value) ? value : [];

  if (lookupQuery.isLoading) return <p className="lookup-status">Loading options...</p>;
  if (lookupQuery.isError) {
    return (
      <p className="lookup-status">
        Options could not be loaded.{' '}
        <button className="lookup-retry" type="button" onClick={() => void lookupQuery.refetch()}>
          Retry
        </button>
      </p>
    );
  }
  if (!lookupQuery.data?.items.length)
    return <p className="lookup-status">No eligible options are available.</p>;

  return (
    <div className="multi-select-list">
      {lookupQuery.data.items.map((record) => {
        const optionValue = String(getValue(record, config.valueKey ?? 'id') ?? record.id);
        return (
          <label key={record.id}>
            <input
              type="checkbox"
              checked={selected.includes(optionValue)}
              disabled={disabled}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...selected, optionValue]
                    : selected.filter((item) => item !== optionValue),
                )
              }
            />
            <span>{optionLabel(record, config.labelKeys)}</span>
          </label>
        );
      })}
    </div>
  );
}

function ConfiguredField({
  config,
  control,
  disabled,
}: {
  config: FormFieldConfig;
  control: Control<FormValues>;
  disabled?: boolean | undefined;
}) {
  const { field, fieldState } = useController({ control, name: config.key });
  const className = config.fullWidth ? 'form-grid__full' : undefined;
  const inputValue = Array.isArray(field.value) ? '' : String(field.value ?? '');

  let controlElement;
  if (config.type === 'checkbox') {
    controlElement = (
      <Checkbox
        label={config.label}
        description={config.description}
        checked={Boolean(field.value)}
        disabled={disabled}
        onChange={(event: ChangeEvent<HTMLInputElement>) => field.onChange(event.target.checked)}
        onBlur={field.onBlur}
        name={field.name}
        ref={field.ref}
      />
    );
    return <div className={className}>{controlElement}</div>;
  }

  if (config.type === 'lookup' && config.lookup) {
    controlElement = (
      <RemoteSelect
        config={config.lookup}
        value={field.value}
        onChange={field.onChange}
        disabled={disabled}
      />
    );
  } else if (config.type === 'lookup-multi' && config.lookup) {
    controlElement = (
      <RemoteMultiSelect
        config={config.lookup}
        value={field.value}
        onChange={field.onChange}
        disabled={disabled}
      />
    );
  } else if (config.type === 'select') {
    controlElement = (
      <Select
        ref={field.ref}
        name={field.name}
        value={inputValue}
        onBlur={field.onBlur}
        onChange={field.onChange}
        disabled={disabled}
      >
        <option value="">Select an option</option>
        {config.options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    );
  } else if (config.type === 'textarea') {
    controlElement = (
      <Textarea
        ref={field.ref}
        name={field.name}
        value={inputValue}
        onBlur={field.onBlur}
        onChange={field.onChange}
        disabled={disabled}
        maxLength={config.maxLength}
        placeholder={config.placeholder}
      />
    );
  } else {
    const htmlType = config.type === 'lookup-multi' ? 'text' : config.type;
    controlElement = (
      <Input
        ref={field.ref}
        name={field.name}
        type={htmlType}
        value={inputValue}
        onBlur={field.onBlur}
        onChange={field.onChange}
        disabled={disabled}
        min={config.min}
        max={config.max}
        maxLength={config.maxLength}
        placeholder={config.placeholder}
      />
    );
  }

  return (
    <Field
      className={className}
      label={config.label}
      required={config.required}
      description={config.description}
      error={typeof fieldState.error?.message === 'string' ? fieldState.error.message : undefined}
    >
      {controlElement}
    </Field>
  );
}

function schemaFor(fields: FormFieldConfig[]) {
  const shape: Record<string, z.ZodType> = {};
  fields.forEach((field) => {
    if (field.type === 'checkbox') {
      shape[field.key] = z.boolean();
      return;
    }
    if (field.type === 'lookup-multi') {
      shape[field.key] = field.required
        ? z.array(z.string()).min(1, `Select at least one ${field.label.toLowerCase()}.`)
        : z.array(z.string());
      return;
    }

    let value = z.string().trim();
    if (field.required) value = value.min(1, `${field.label} is required.`);
    if (field.maxLength) value = value.max(field.maxLength, `${field.label} is too long.`);
    if (field.type === 'email')
      value = value.refine(
        (input) => !input || z.email().safeParse(input).success,
        'Enter a valid email address.',
      );
    if (field.type === 'number') {
      value = value.refine(
        (input) => !input || Number.isFinite(Number(input)),
        'Enter a valid number.',
      );
    }
    shape[field.key] = value;
  });
  return z.object(shape);
}

function defaultsFor(fields: FormFieldConfig[]) {
  return Object.fromEntries(
    fields.map((field) => [
      field.key,
      field.defaultValue ??
        (field.type === 'checkbox' ? false : field.type === 'lookup-multi' ? [] : ''),
    ]),
  ) as FormValues;
}

export function transformFormValues(values: FormValues, fields: FormFieldConfig[]) {
  const payload: Record<string, unknown> = {};
  fields.forEach((field) => {
    const value = values[field.key];
    if (
      value === '' ||
      value === undefined ||
      (Array.isArray(value) && value.length === 0 && !field.required)
    )
      return;
    payload[field.key] =
      field.type === 'number' && typeof value === 'string' ? Number(value) : value;
  });
  return payload;
}

export function useConfiguredForm(fields: FormFieldConfig[]) {
  const schema = schemaFor(fields);
  return useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: defaultsFor(fields),
  });
}

export function ConfiguredFormFields({
  control,
  disabled,
  fields,
}: {
  control: Control<FormValues>;
  disabled?: boolean | undefined;
  fields: FormFieldConfig[];
}) {
  return (
    <div className="form-grid">
      {fields.map((field) => (
        <ConfiguredField config={field} control={control} disabled={disabled} key={field.key} />
      ))}
    </div>
  );
}
