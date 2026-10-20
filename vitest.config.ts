import { defineConfig } from 'vitest/config'

// Pruebas en Node con fakes de los puertos: el dominio y los casos de uso no dependen del runtime de Workers.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
  },
})
