import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: [
      'tests/smoke.test.ts',
      'tests/api/**/*.test.ts',
      'tests/security/**/*.test.ts',
    ],
    exclude: [
      'bkp/**',
      'tests/**/* 2.*',
    ],
    pool: 'forks',
    maxWorkers: 1,
    testTimeout: 15000,
    hookTimeout: 15000,
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
  resolve: {
    // Array form: checked in order, first match wins.
    // @/lib/auth MUST come before @, otherwise the broad @ prefix swallows it.
    alias: [
      {
        find: '@/lib/auth',
        replacement: resolve(__dirname, './tests/__mocks__/auth.ts'),
      },
      {
        find: '@',
        replacement: resolve(__dirname, './src'),
      },
    ],
  },
})
