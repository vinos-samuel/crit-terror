import { defineConfig } from 'vite';

export default defineConfig({
  server: { host: true, port: 4817, strictPort: true },
  preview: { host: true, port: 4818, strictPort: true },
  build: { target: 'es2020' },
});
