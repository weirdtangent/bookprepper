import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import rateLimit from "@fastify/rate-limit";
import authPlugin from "./plugins/auth.js";
import booksRoutes from "./routes/books.js";
import prepsRoutes from "./routes/preps.js";
import suggestionsRoutes from "./routes/suggestions.js";
import adminRoutes from "./routes/admin/index.js";
import profileRoutes from "./routes/profile.js";
import readingRoutes from "./routes/reading.js";
import { env } from "config";
import { randomUUID } from "crypto";

async function buildServer() {
  const server = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
    },
    genReqId: () => randomUUID(),
  });

  await server.register(sensible);
  await server.register(helmet, {
    crossOriginResourcePolicy: false,
  });
  await server.register(cors, {
    origin: [env.WEB_BASE_URL],
    credentials: true,
  });
  // Global rate limiting - conservative default
  await server.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    // Per-route limits can override this
    global: true,
    // Use client IP from proxy headers (X-Forwarded-For takes precedence)
    // or fall back to direct connection IP
    keyGenerator: (request: {
      ip: string;
      headers: Record<string, string | string[] | undefined>;
    }) => {
      // X-Forwarded-For can contain multiple IPs (client, proxy1, proxy2...)
      // Extract only the first (client) IP to prevent bypass attacks
      const forwardedFor = request.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim();
      const realIp = request.headers["x-real-ip"]?.toString();

      return forwardedFor || realIp || request.ip || "unknown";
    },
  });
  await server.register(authPlugin);

  server.get("/healthz", async () => ({ status: "ok" }));

  await server.register(booksRoutes, { prefix: "/api" });
  await server.register(prepsRoutes, { prefix: "/api" });
  await server.register(suggestionsRoutes, { prefix: "/api" });
  await server.register(profileRoutes, { prefix: "/api" });
  await server.register(adminRoutes, { prefix: "/api" });
  await server.register(readingRoutes, { prefix: "/api" });

  return server;
}

const server = await buildServer();

try {
  await server.listen({
    port: env.API_PORT,
    host: env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1",
  });
  server.log.info(`"API server listening on port ${env.API_PORT}"`);
} catch (error) {
  server.log.error(`"Failed to start API server: ${(error as Error).message}"`);
  process.exit(1);
}
