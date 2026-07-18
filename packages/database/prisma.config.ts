import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDirectory = dirname(fileURLToPath(import.meta.url));
for (const path of [resolve(packageDirectory, '../../.env'), resolve(packageDirectory, '.env')]) {
  if (existsSync(path)) process.loadEnvFile(path);
}

export default {
  schema: 'prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
  datasource: {
    url:
      process.env.DIRECT_DATABASE_URL ??
      process.env.DATABASE_URL ??
      'postgresql://schema_validation:schema_validation@127.0.0.1:5432/schema_validation',
  },
};
