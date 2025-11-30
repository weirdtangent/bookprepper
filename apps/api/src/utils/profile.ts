import type { FastifyRequest } from "fastify";
import { prisma } from "db";

export async function ensureUserProfile(request: FastifyRequest) {
  const authUser = request.authUser;

  if (!authUser) {
    throw new Error("Missing auth context");
  }

  const email =
    authUser.email ??
    `${authUser.sub}@users.bookprepper.com`.toLowerCase().replace(/[^a-z0-9@.]/g, "");

  const displayName =
    authUser.name ??
    (authUser.email ? authUser.email.split("@")[0] : `Reader-${authUser.sub.slice(0, 6)}`);

  return prisma.userProfile.upsert({
    where: { cognitoSub: authUser.sub },
    update: {
      email,
      displayName
    },
    create: {
      cognitoSub: authUser.sub,
      email,
      displayName
    }
  });
}

