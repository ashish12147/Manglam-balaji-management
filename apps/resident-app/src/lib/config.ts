import { z } from 'zod';

const absoluteUrl = z
  .string()
  .url()
  .refine(
    (value) =>
      value.startsWith('https://') ||
      value.startsWith('http://127.0.0.1') ||
      value.startsWith('http://10.0.2.2'),
    {
      message: 'Use HTTPS except for a local emulator or loopback API.',
    },
  );

const runtimeConfigSchema = z
  .object({
    apiUrl: absoluteUrl,
    appEnv: z.enum(['development', 'staging', 'production']).default('development'),
    wsUrl: absoluteUrl,
  })
  .superRefine((value, context) => {
    if (value.appEnv !== 'production') return;
    for (const [path, url] of [
      ['apiUrl', value.apiUrl],
      ['wsUrl', value.wsUrl],
    ] as const) {
      if (!url.startsWith('https://')) {
        context.addIssue({
          code: 'custom',
          message: 'Production endpoints must use HTTPS.',
          path: [path],
        });
      }
    }
  });

export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>;

let parsedConfig: RuntimeConfig | undefined;

export class RuntimeConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RuntimeConfigurationError';
  }
}

export function getRuntimeConfig(): RuntimeConfig {
  if (parsedConfig) return parsedConfig;

  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  const wsUrl = process.env.EXPO_PUBLIC_WS_URL;
  const result = runtimeConfigSchema.safeParse({
    apiUrl,
    appEnv: process.env.EXPO_PUBLIC_APP_ENV,
    wsUrl,
  });

  if (!result.success) {
    const issue = result.error.issues[0];
    throw new RuntimeConfigurationError(
      issue?.message ?? 'EXPO_PUBLIC_API_URL and EXPO_PUBLIC_WS_URL are required.',
    );
  }

  parsedConfig = {
    ...result.data,
    apiUrl: result.data.apiUrl.replace(/\/$/, ''),
    wsUrl: result.data.wsUrl.replace(/\/$/, ''),
  };
  return parsedConfig;
}
