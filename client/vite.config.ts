import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5188,
    proxy: {
      "/ws": {
        target: "ws://localhost:9088",
        ws: true,
      },
    },
  },
});
