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

  const fallbackDisplayName =
    authUser.name ??
    (authUser.email ? authUser.email.split("@")[0] : `Reader-${authUser.sub.slice(0, 6)}`);

  const existing = await prisma.userProfile.findUnique({
    where: { cognitoSub: authUser.sub },
  });

  if (existing) {
    const updates: { email?: string; displayName?: string } = {};

    if (existing.email !== email) {
      updates.email = email;
    }

    if (!existing.displayName?.trim()) {
      updates.displayName = fallbackDisplayName;
    }

    if (Object.keys(updates).length > 0) {
      return prisma.userProfile.update({
        where: { id: existing.id },
        data: updates,
      });
    }

    return existing;
  }

  return prisma.userProfile.create({
    data: {
      cognitoSub: authUser.sub,
      email,
      displayName: fallbackDisplayName,
    },
  });
}
