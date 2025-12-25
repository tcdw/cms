import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";
import { TanStackRouterRspack } from "@tanstack/router-plugin/rspack";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [pluginReact()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  tools: {
    rspack: {
      plugins: [TanStackRouterRspack({ target: "react", autoCodeSplitting: true })],
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  html: {
    title: "CMS Admin",
  },
});
