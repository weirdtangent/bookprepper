/**
 * Admin routes aggregator.
 * Registers all admin sub-routes under the /api prefix.
 */
import type { FastifyPluginAsync } from "fastify";
import rateLimit from "@fastify/rate-limit";
import adminBooksRoutes from "./books.js";
import adminPrepsRoutes from "./preps.js";
import adminSuggestionsRoutes from "./suggestions.js";

const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // Stricter rate limiting for admin write operations
  // This supplements the global rate limit with tighter controls for sensitive endpoints
  await fastify.register(rateLimit, {
    max: 30,
    timeWindow: "1 minute",
    keyGenerator: (request) => {
      // Rate limit by authenticated user ID when available, fall back to IP
      const userId = (request as { user?: { sub?: string } }).user?.sub;
      return userId || request.ip;
    },
  });

  await fastify.register(adminBooksRoutes);
  await fastify.register(adminPrepsRoutes);
  await fastify.register(adminSuggestionsRoutes);
};

export default adminRoutes;
