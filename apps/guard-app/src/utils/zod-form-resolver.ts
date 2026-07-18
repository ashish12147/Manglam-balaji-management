import type { FieldErrors, FieldValues, Resolver } from "react-hook-form";
import type { ZodType } from "zod";

export function zodFormResolver<TValues extends FieldValues>(
  schema: ZodType<TValues>
): Resolver<TValues> {
  return async (values) => {
    const result = schema.safeParse(values);
    if (result.success) return { errors: {}, values: result.data };

    const errors: FieldErrors<TValues> = {};
    const writableErrors = errors as Record<string, unknown>;
    for (const issue of result.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string" && writableErrors[field] === undefined) {
        writableErrors[field] = { message: issue.message, type: issue.code };
      }
    }
    return { errors, values: {} };
  };
}
