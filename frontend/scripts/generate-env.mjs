import { config } from 'dotenv';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

config({ path: resolve(root, '.env') });

const apiUrl =
  process.env.API_URL?.trim() ||
  process.env.NG_APP_API_URL?.trim() ||
  'http://localhost:3000';

const publicSiteUrl =
  process.env.PUBLIC_SITE_URL?.trim() ||
  process.env.NG_APP_PUBLIC_SITE_URL?.trim() ||
  'http://localhost:4200';

const buildId =
  process.env.BUILD_ID?.trim() ||
  process.env.CF_PAGES_COMMIT_SHA?.trim() ||
  process.env.GITHUB_SHA?.trim() ||
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const escape = (value) => value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const content = `// Auto-generated from frontend/.env — do not edit manually.
// Regenerated when you run \`npm start\` or \`npm run build\`.

export const ENV = {
  API_URL: '${escape(apiUrl)}',
  PUBLIC_SITE_URL: '${escape(publicSiteUrl)}',
  BUILD_ID: '${escape(buildId)}',
} as const;
`;

writeFileSync(resolve(root, 'src/app/core/config/env.generated.ts'), content, 'utf8');
writeFileSync(
  resolve(root, 'public/app-version.json'),
  `${JSON.stringify({ buildId }, null, 2)}\n`,
  'utf8',
);

console.log('[env] API_URL:', apiUrl);
console.log('[env] PUBLIC_SITE_URL:', publicSiteUrl);
console.log('[env] BUILD_ID:', buildId);
