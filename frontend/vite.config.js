import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const sharedDir = path.resolve(__dirname, "..", "shared");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": sharedDir,
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:4000",
      "/uploads": "http://localhost:4000",
      // Proxy de Socket.io para desarrollo local (en Docker lo hace nginx)
      "/socket.io": {
        target: "http://localhost:4000",
        ws: true
      }
    }
  }
});
