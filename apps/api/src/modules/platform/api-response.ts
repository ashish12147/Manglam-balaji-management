export interface SuccessEnvelope<TData, TMeta = never> {
  readonly correlationId: string;
  readonly data: TData;
  readonly meta?: TMeta;
}

export function success<TData>(
  data: TData,
  correlationId: string,
): SuccessEnvelope<TData> {
  return { correlationId, data };
}

export function successPage<TData, TMeta>(
  data: TData,
  meta: TMeta,
  correlationId: string,
): SuccessEnvelope<TData, TMeta> {
  return { correlationId, data, meta };
}
