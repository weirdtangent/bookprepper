/**
 * Admin routes aggregator.
 * Registers all admin sub-routes under the /api prefix.
 */
import type { FastifyPluginAsync } from "fastify";
import adminBooksRoutes from "./books.js";
import adminPrepsRoutes from "./preps.js";
import adminSuggestionsRoutes from "./suggestions.js";

const adminRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(adminBooksRoutes);
  await fastify.register(adminPrepsRoutes);
  await fastify.register(adminSuggestionsRoutes);
};

export default adminRoutes;
