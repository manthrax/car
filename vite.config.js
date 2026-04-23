import { defineConfig } from 'vite';

export default defineConfig({
  // Set the base path to your repository name for GitHub Pages deployment
  // Replace 'car' with your actual repository name
  base: '/car/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  server: {
    port: 5173,
  }
});
