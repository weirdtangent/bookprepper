import type { Prisma } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { prisma } from "db";
import {
  profileUpdateBodySchema,
  type ProfileUpdateBody,
  type UserPreferences
} from "../schemas.js";
import { ensureUserProfile } from "../utils/profile.js";
import { updateCognitoDisplayName } from "../lib/cognito.js";

const profileRoutes: FastifyPluginAsync = async (fastify) => {
  const guard = { onRequest: [fastify.verifyJwt] };

  fastify.get("/profile", guard, async (request) => {
    const profile = await ensureUserProfile(request);
    return { profile: mapProfile(profile) };
  });

  fastify.patch("/profile", guard, async (request) => {
    const body = profileUpdateBodySchema.parse(request.body);
    const authProfile = await ensureUserProfile(request);

    const updates: Prisma.UserProfileUpdateInput = buildProfileUpdates(body, authProfile);

    if (Object.keys(updates).length === 0) {
      return {
        profile: mapProfile(authProfile),
        cognitoSynced: false
      };
    }

    const updated = await prisma.userProfile.update({
      where: { id: authProfile.id },
      data: updates
    });

    let cognitoSynced = false;
    if (body.displayName) {
      try {
        await updateCognitoDisplayName({
          cognitoSub: authProfile.cognitoSub,
          displayName: body.displayName
        });
        cognitoSynced = true;
      } catch (error) {
        fastify.log.error(
          {
            cognitoSub: authProfile.cognitoSub
          },
          `"Failed to update Cognito nickname: ${(error as Error).message}"`
        );
      }
    }

    return {
      profile: mapProfile(updated),
      cognitoSynced
    };
  });
};

export default profileRoutes;

function mapProfile(profile: {
  id: string;
  displayName: string;
  email: string;
  role: string;
  preferences: Prisma.JsonValue | null;
}) {
  return {
    id: profile.id,
    displayName: profile.displayName,
    email: profile.email,
    role: profile.role,
    preferences: normalizePreferences(profile.preferences)
  };
}

function buildProfileUpdates(body: ProfileUpdateBody, profile: { preferences: Prisma.JsonValue | null }) {
  const updates: Prisma.UserProfileUpdateInput = {};

  if (body.displayName) {
    updates.displayName = body.displayName;
  }

  if (body.preferences) {
    const currentPreferences = normalizePreferences(profile.preferences);
    const nextPreferences: UserPreferences = { ...currentPreferences };
    if (body.preferences.shuffleDefault !== undefined) {
      nextPreferences.shuffleDefault = body.preferences.shuffleDefault;
    }
    updates.preferences = nextPreferences;
  }

  return updates;
}

function normalizePreferences(preferences: Prisma.JsonValue | null): UserPreferences {
  if (!preferences || typeof preferences !== "object") {
    return {};
  }

  const prefsRecord = preferences as Record<string, unknown>;
  const normalized: UserPreferences = {};

  if (typeof prefsRecord.shuffleDefault === "boolean") {
    normalized.shuffleDefault = prefsRecord.shuffleDefault;
  }

  return normalized;
}

