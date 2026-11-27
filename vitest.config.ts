import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
      '~': resolve(import.meta.dirname, 'src'),
      graphql: resolve(import.meta.dirname, 'node_modules/graphql/index.mjs'),
      'graphql/error': resolve(import.meta.dirname, 'node_modules/graphql/error/index.mjs'),
      'graphql/execution': resolve(import.meta.dirname, 'node_modules/graphql/execution/index.mjs'),
      'graphql/language': resolve(import.meta.dirname, 'node_modules/graphql/language/index.mjs'),
      'graphql/type': resolve(import.meta.dirname, 'node_modules/graphql/type/index.mjs'),
      'graphql/validation': resolve(import.meta.dirname, 'node_modules/graphql/validation/index.mjs'),
      'graphql/utilities': resolve(import.meta.dirname, 'node_modules/graphql/utilities/index.mjs'),
    },
    dedupe: ['graphql'],
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.{test,spec}.ts'],
    testTimeout: 30_000,
  },
})
