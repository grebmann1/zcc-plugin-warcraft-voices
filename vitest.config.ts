import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', include: ['*.test.ts', '*.test.tsx'], maxWorkers: 2,
  coverage: { provider: 'v8', include: ['app.tsx','model.ts','download.ts','server.ts','runtime.ts','policy.ts','player.ts'], thresholds: { statements:80, branches:80, lines:80, functions:80 } }
} });
