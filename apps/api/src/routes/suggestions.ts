import type { FastifyPluginAsync } from "fastify";
import { prisma } from "db";
import { bookSuggestionBodySchema } from "../schemas.js";
import { ensureUserProfile } from "../utils/profile.js";

const suggestionsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/suggestions/books",
    { onRequest: [fastify.verifyJwt] },
    async (request) => {
      const body = bookSuggestionBodySchema.parse(request.body);
      const user = await ensureUserProfile(request);

      const suggestion = await prisma.bookSuggestion.create({
        data: {
          title: body.title,
          authorName: body.authorName,
          notes: body.notes ?? null,
          genreIdeas: body.genreIdeas ?? [],
          prepIdeas: body.prepIdeas ?? [],
          submittedById: user.id,
          status: "PENDING"
        }
      });

      fastify.log.info(`"Captured book suggestion ${suggestion.id}"`);

      return {
        message: "Book suggestion submitted",
        suggestionId: suggestion.id,
        status: suggestion.status
      };
    }
  );
};

export default suggestionsRoutes;

