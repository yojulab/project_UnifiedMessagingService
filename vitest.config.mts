import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    env: {
      ENCRYPTION_KEY: '0'.repeat(64),
      UNSUBSCRIBE_SECRET: 'test-unsub-secret',
      NEXTAUTH_URL: 'http://localhost:3000',
    },
  },
});
