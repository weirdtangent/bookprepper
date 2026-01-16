import type { RateLimitPluginOptions } from "@fastify/rate-limit";

/**
 * Rate limiting configurations for different route types
 * These can be applied per-route to override global limits
 */

// For routes that make external API calls (Google Books, Cognito)
export const externalApiRateLimit: RateLimitPluginOptions = {
  max: 5,
  timeWindow: "1 minute",
};

// For routes with very expensive database queries
export const expensiveQueryRateLimit: RateLimitPluginOptions = {
  max: 20,
  timeWindow: "1 minute",
};

// For write operations (POST/PUT/DELETE/PATCH)
export const writeOperationRateLimit: RateLimitPluginOptions = {
  max: 30,
  timeWindow: "1 minute",
};

// For admin operations (typically lower volume)
export const adminOperationRateLimit: RateLimitPluginOptions = {
  max: 50,
  timeWindow: "1 minute",
};

// For public read operations
export const publicReadRateLimit: RateLimitPluginOptions = {
  max: 60,
  timeWindow: "1 minute",
};
