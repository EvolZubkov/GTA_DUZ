import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 8000,
    open: true
  },
  build: {
    target: 'es2022'
  }
});
