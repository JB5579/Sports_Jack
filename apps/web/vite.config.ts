import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// npm run dev:web serves the app with hot reload and forwards game traffic to npm start.
export default defineConfig({
  root: import.meta.dirname,
  plugins: [react()],
  build: { outDir: "dist", emptyOutDir: true },
  server: {
    proxy: {
      "/ws": { target: "ws://localhost:8787", ws: true },
      "/api": "http://localhost:8787",
      "/health": "http://localhost:8787",
    },
  },
});
