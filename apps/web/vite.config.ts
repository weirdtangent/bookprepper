import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function getAppVersion(): string {
  try {
    const versionPath = resolve(__dirname, "../../VERSION");
    if (existsSync(versionPath)) {
      return readFileSync(versionPath, "utf-8").trim();
    }
    // Fallback to package.json version
    const pkgPath = resolve(__dirname, "../../package.json");
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      return pkg.version ?? "dev";
    }
  } catch {
    // Silently fall back to dev
  }
  return "dev";
}

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(getAppVersion()),
  },
  server: {
    port: 5173,
    host: "0.0.0.0",
  },
  preview: {
    port: 4173,
    host: "0.0.0.0",
  },
  resolve: {
    extensions: [".tsx", ".ts", ".jsx", ".js", ".mjs", ".json"],
  },
});
