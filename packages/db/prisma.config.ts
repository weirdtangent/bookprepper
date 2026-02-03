import { defineConfig, env } from "@prisma/config";
import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootEnvPath = resolve(__dirname, "../../.env");
if (existsSync(rootEnvPath)) {
  loadEnv({ path: rootEnvPath });
} else {
  loadEnv();
}

export default defineConfig({
  schema: "./prisma/schema.prisma",
  datasource: {
    // Use a dummy URL for client generation when DATABASE_URL is not set
    url: process.env.DATABASE_URL || "mysql://localhost:3306/bookprepper",
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
