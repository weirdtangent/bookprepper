import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import rateLimit from "@fastify/rate-limit";
import authPlugin from "./plugins/auth.js";
import booksRoutes from "./routes/books.js";
import prepsRoutes from "./routes/preps.js";
import suggestionsRoutes from "./routes/suggestions.js";
import adminRoutes from "./routes/admin.js";
import profileRoutes from "./routes/profile.js";
import { env } from "config";
import { randomUUID } from "crypto";

async function buildServer() {
  const server = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info"
    },
    genReqId: () => randomUUID()
  });

  await server.register(sensible);
  await server.register(helmet, {
    crossOriginResourcePolicy: false
  });
  await server.register(cors, {
    origin: [env.WEB_BASE_URL],
    credentials: true
  });
  await server.register(rateLimit, {
    max: 300,
    timeWindow: "1 minute"
  });
  await server.register(authPlugin);

  server.get("/healthz", async () => ({ status: "ok" }));

  await server.register(booksRoutes, { prefix: "/api" });
  await server.register(prepsRoutes, { prefix: "/api" });
  await server.register(suggestionsRoutes, { prefix: "/api" });
  await server.register(profileRoutes, { prefix: "/api" });
  await server.register(adminRoutes, { prefix: "/api" });

  return server;
}

const server = await buildServer();

try {
  await server.listen({
    port: env.API_PORT,
    host: env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1"
  });
  server.log.info(`"API server listening on port ${env.API_PORT}"`);
} catch (error) {
  server.log.error(`"Failed to start API server: ${(error as Error).message}"`);
  process.exit(1);
}

