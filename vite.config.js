import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // In dev, `vercel dev` runs the Vite server and the /api serverless
  // functions together, so no manual proxy is needed here.
});
