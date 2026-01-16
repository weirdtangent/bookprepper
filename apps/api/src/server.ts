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
    // Extract client IP with security considerations for proxy deployments
    keyGenerator: (request: {
      ip: string;
      headers: Record<string, string | string[] | undefined>;
    }) => {
      // When behind a reverse proxy (load balancer, CDN), we need to extract the real client IP
      // X-Forwarded-For format: "client-ip, proxy1-ip, proxy2-ip"
      // Security note: The leftmost IP can be spoofed by attackers. For production deployments
      // behind trusted proxies, consider using the rightmost trusted IP or configuring the
      // number of trusted proxy hops. For now, we trust X-Real-IP (set by single trusted proxy)
      // over X-Forwarded-For, and only use X-Forwarded-For's first IP as a last resort before
      // falling back to the direct connection IP.

      const realIp = request.headers["x-real-ip"]?.toString().trim();
      if (realIp) return realIp; // Most secure: set by trusted proxy only

      // Fallback to direct connection IP (no proxy scenario)
      if (request.ip) return request.ip;

      // Last resort: use first IP from X-Forwarded-For (may be spoofable in some deployments)
      const forwardedFor = request.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim();
      return forwardedFor || "unknown";
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
