import {
  domainError,
  err,
  ok,
  type ApiErrorCode,
  type DomainError,
  type Result,
  type StateTransition,
} from '@manglam/types';

export type TransitionTable<TState extends string> = Readonly<Record<TState, readonly TState[]>>;

export const canTransition = <TState extends string>(
  table: TransitionTable<TState>,
  current: TState,
  target: TState,
): boolean => table[current].includes(target);

export const applyTransition = <TState extends string>(input: {
  readonly table: TransitionTable<TState>;
  readonly current: TState;
  readonly target: TState;
  readonly occurredAt: string;
  readonly eventPrefix: string;
  readonly errorCode: ApiErrorCode;
  readonly aggregateLabel: string;
}): Result<StateTransition<TState>, DomainError> => {
  if (!canTransition(input.table, input.current, input.target)) {
    return err(
      domainError(
        input.errorCode,
        `Cannot transition ${input.aggregateLabel} from ${input.current} to ${input.target}.`,
        {
          current: input.current,
          target: input.target,
        },
      ),
    );
  }

  return ok({
    previous: input.current,
    current: input.target,
    event: `${input.eventPrefix}_${input.target}`,
    occurredAt: input.occurredAt,
  });
};

export const hasRequiredText = (value: string | undefined, minimumLength = 3): value is string =>
  (value?.trim().length ?? 0) >= minimumLength;
