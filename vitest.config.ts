import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // jsdom only where the browser globals are the point: the notifier test and
    // the client-wiring test each carry a `@vitest-environment jsdom` docblock.
    environment: 'node',
  },
})
