import { defineConfig } from 'vite';

export default defineConfig({
  base: '/build/',
  build: { outDir: '../public/build', emptyOutDir: true },
});
