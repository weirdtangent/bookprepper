import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { env } from "config";

const verifier = CognitoJwtVerifier.create({
  userPoolId: env.COGNITO_USER_POOL_ID,
  clientId: env.COGNITO_CLIENT_ID,
  tokenUse: "id",
});
const adminEmail = env.ADMIN_EMAIL.trim().toLowerCase();

const authPlugin: FastifyPluginAsync = fp(async (fastify) => {
  fastify.decorate("verifyJwt", async (request) => {
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      throw fastify.httpErrors.unauthorized("Missing authorization header");
    }

    const token = authHeader.slice("Bearer ".length);

    try {
      const payload = await verifier.verify(token);
      const email =
        typeof payload.email === "string"
          ? payload.email
          : typeof payload["cognito:username"] === "string"
            ? payload["cognito:username"]
            : null;
      const name =
        typeof payload.name === "string"
          ? payload.name
          : typeof payload["cognito:username"] === "string"
            ? payload["cognito:username"]
            : null;
      request.authUser = {
        sub: payload.sub,
        email,
        name,
      };
    } catch (error) {
      fastify.log.warn(`"JWT verification failed: ${(error as Error).message}"`);
      throw fastify.httpErrors.unauthorized("Invalid token");
    }
  });

  fastify.decorate("requireAdmin", async (request) => {
    const email = request.authUser?.email?.toLowerCase();

    if (!email) {
      throw fastify.httpErrors.forbidden("Admin privileges require a verified email address.");
    }

    if (email !== adminEmail) {
      throw fastify.httpErrors.forbidden("Admin access denied.");
    }
  });
});

export default authPlugin;
