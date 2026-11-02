import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const basePath = env.VITE_BASE_PATH ?? "";

  return {
    base: basePath ? `${basePath.replace(/\/$/, "")}/` : "/",
    plugins: [
      // Must run before the React plugin.
      tanstackRouter({ target: "react", autoCodeSplitting: true }),
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    // "out" is the folder the Cloudflare Pages project is configured to publish
    // (a holdover from the Next.js export), so keep it instead of Vite's "dist".
    build: { outDir: "out" },
    server: { port: 3000 },
    preview: { port: 3000 },
  };
});
