import { prisma } from "~/trigger/utils/prisma";
import { logger } from "./logger.service";
import { permissionService } from "./permission.server";

export class ClassificationService {
  async classifyEpisode(
    episodeId: string,
    content: string,
    userId: string,
    workspaceId: string,
  ): Promise<string[]> {
    logger.info(`Classifying episode ${episodeId} for user ${userId}`);

    const assignedSpaceIds: string[] = [];

    try {
      // Get user's default/private space
      const privateSpace = await prisma.space.findFirst({
        where: {
          workspaceId,
          visibility: "PRIVATE",
          Workspace: {
            userId,
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      if (privateSpace) {
        assignedSpaceIds.push(privateSpace.id);
        logger.info(`Assigned episode ${episodeId} to private space ${privateSpace.id}`);
      }

      const userTeams = await permissionService.getUserTeams(userId, workspaceId);

      for (const team of userTeams) {
        const teamSpaces = await prisma.space.findMany({
          where: {
            teamId: team.id,
            visibility: "TEAM",
            deleted: null,
          },
        });

        for (const space of teamSpaces) {
          const shouldAssign = await this.shouldAssignToSpace(
            content,
            space.name,
            space.description || "",
          );

          if (shouldAssign) {
            assignedSpaceIds.push(space.id);
            logger.info(
              `Assigned episode ${episodeId} to team space ${space.id} (${space.name})`,
            );
          }
        }
      }

      logger.info(
        `Episode ${episodeId} classified into ${assignedSpaceIds.length} spaces`,
      );

      return assignedSpaceIds;
    } catch (error) {
      logger.error(
        `Error classifying episode ${episodeId}:`,
        error as Record<string, unknown>,
      );
      return assignedSpaceIds;
    }
  }

  private async shouldAssignToSpace(
    content: string,
    spaceName: string,
    spaceDescription: string,
  ): Promise<boolean> {
    const contentLower = content.toLowerCase();
    const spaceNameLower = spaceName.toLowerCase();
    const spaceDescLower = spaceDescription.toLowerCase();

    const keywords = this.extractKeywords(spaceNameLower + " " + spaceDescLower);

    for (const keyword of keywords) {
      if (contentLower.includes(keyword)) {
        return true;
      }
    }

    return false;
  }

  private extractKeywords(text: string): string[] {
    const stopWords = new Set([
      "a",
      "an",
      "and",
      "are",
      "as",
      "at",
      "be",
      "by",
      "for",
      "from",
      "has",
      "he",
      "in",
      "is",
      "it",
      "its",
      "of",
      "on",
      "that",
      "the",
      "to",
      "was",
      "will",
      "with",
      "space",
      "team",
    ]);

    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.has(word));

    return Array.from(new Set(words));
  }

  async reclassifyUserEpisodes(
    userId: string,
    workspaceId: string,
    limit: number = 100,
  ): Promise<number> {
    logger.info(`Reclassifying episodes for user ${userId} (limit: ${limit})`);

    logger.info(
      `Reclassification for user ${userId} queued (Neo4j integration pending)`,
    );

    return 0;
  }

  async getClassificationSuggestions(
    content: string,
    userId: string,
    workspaceId: string,
  ): Promise<
    Array<{
      spaceId: string;
      spaceName: string;
      confidence: number;
      reason: string;
    }>
  > {
    const suggestions: Array<{
      spaceId: string;
      spaceName: string;
      confidence: number;
      reason: string;
    }> = [];

    try {
      const userTeams = await permissionService.getUserTeams(userId, workspaceId);

      for (const team of userTeams) {
        const teamSpaces = await prisma.space.findMany({
          where: {
            teamId: team.id,
            visibility: "TEAM",
            deleted: null,
          },
        });

        for (const space of teamSpaces) {
          const shouldAssign = await this.shouldAssignToSpace(
            content,
            space.name,
            space.description || "",
          );

          if (shouldAssign) {
            suggestions.push({
              spaceId: space.id,
              spaceName: space.name,
              confidence: 0.7,
              reason: `Matches keywords from "${space.name}"`,
            });
          }
        }
      }

      return suggestions;
    } catch (error) {
      logger.error(
        "Error getting classification suggestions:",
        error as Record<string, unknown>,
      );
      return suggestions;
    }
  }

  async validateSpaceAssignments(
    userId: string,
    spaceIds: string[],
  ): Promise<{ valid: string[]; invalid: string[] }> {
    const valid: string[] = [];
    const invalid: string[] = [];

    for (const spaceId of spaceIds) {
      const canWrite = await permissionService.canWriteSpace(userId, spaceId);

      if (canWrite) {
        valid.push(spaceId);
      } else {
        invalid.push(spaceId);
      }
    }

    return { valid, invalid };
  }

  async getClassificationStats(workspaceId: string): Promise<{
    totalSpaces: number;
    teamSpaces: number;
    privateSpaces: number;
  }> {
    const [totalSpaces, teamSpaces, privateSpaces] = await Promise.all([
      prisma.space.count({
        where: { workspaceId, deleted: null },
      }),
      prisma.space.count({
        where: { workspaceId, visibility: "TEAM", deleted: null },
      }),
      prisma.space.count({
        where: { workspaceId, visibility: "PRIVATE", deleted: null },
      }),
    ]);

    return {
      totalSpaces,
      teamSpaces,
      privateSpaces,
    };
  }
}

export const classificationService = new ClassificationService();
