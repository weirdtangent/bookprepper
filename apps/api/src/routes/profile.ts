import type { FastifyPluginAsync } from "fastify";
import { prisma } from "db";
import { profileUpdateBodySchema } from "../schemas.js";
import { ensureUserProfile } from "../utils/profile.js";

const profileRoutes: FastifyPluginAsync = async (fastify) => {
  const guard = { onRequest: [fastify.verifyJwt] };

  fastify.get("/profile", guard, async (request) => {
    const profile = await ensureUserProfile(request);
    return { profile: mapProfile(profile) };
  });

  fastify.patch("/profile", guard, async (request) => {
    const body = profileUpdateBodySchema.parse(request.body);
    const authProfile = await ensureUserProfile(request);

    const updated = await prisma.userProfile.update({
      where: { id: authProfile.id },
      data: {
        displayName: body.displayName
      }
    });

    return {
      profile: mapProfile(updated)
    };
  });
};

export default profileRoutes;

function mapProfile(profile: { id: string; displayName: string; email: string; role: string }) {
  return {
    id: profile.id,
    displayName: profile.displayName,
    email: profile.email,
    role: profile.role
  };
}

