import { defineConfig } from 'astro/config';

// For a repo named <username>.github.io, BASE_PATH stays "/".
// For any other repo name, the deploy workflow sets BASE_PATH to "/<repo>".
export default defineConfig({
  site: 'https://126saugat126.github.io',
  base: process.env.BASE_PATH || '/',
});
