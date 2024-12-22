import { defineConfig } from 'vitest/config';

// https://vite.dev/config/
export default defineConfig({
  base: '/Plane/', // Replace 'Plane' with your repository name
  build: {
    outDir: 'dist', // Ensure this matches your workflow configuration
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js', // Point to the setup file
  },
})