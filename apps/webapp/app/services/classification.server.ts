import { prisma } from "~/trigger/utils/prisma";
import { logger } from "./logger.service";
import { permissionService } from "./permission.server";
import { getModel, makeModelCall } from "~/lib/model.server";
import type { CoreMessage } from "ai";
import type { Team, Space } from "@prisma/client";

export class ClassificationService {
  async classifyEpisode(
    episodeId: string,
    content: string,
    userId: string,
    workspaceId: string,
  ): Promise<string[]> {
    logger.info(`Classifying episode ${episodeId} for user ${userId}`);

    try {
      // 1. Buscar teams e spaces do user
      const userTeams = await permissionService.getUserTeams(userId, workspaceId);
      const allSpaces = await this.getAllUserSpaces(userTeams, userId);

      if (allSpaces.length === 0) {
        logger.info(`No spaces found for user ${userId}, assigning to none`);
        return [];
      }

      logger.info(`Found ${allSpaces.length} spaces for user ${userId}`);

      // 2. Tentar LLM classification primeiro
      try {
        const llmClassification = await this.llmClassify(content, allSpaces);
        if (llmClassification && llmClassification.spaceIds.length > 0) {
          // Validar que o usuário tem acesso aos spaces
          const validatedSpaceIds = await this.validateSpaceIds(
            llmClassification.spaceIds,
            userId,
            workspaceId,
          );

          if (validatedSpaceIds.length > 0) {
            logger.info(
              `LLM classified episode ${episodeId} into ${validatedSpaceIds.length} spaces: ${validatedSpaceIds.join(", ")} (confidence: ${llmClassification.confidence})`,
            );
            return validatedSpaceIds;
          }
        }
      } catch (llmError) {
        logger.error("LLM classification failed:", llmError);
        // Fall through to rule-based
      }

      // 3. Fallback para rule-based
      const ruleBasedSpaces = this.ruleBasedClassify(content, allSpaces);
      logger.info(
        `Rule-based classification for episode ${episodeId}: ${ruleBasedSpaces.join(", ")}`,
      );
      return ruleBasedSpaces;
    } catch (error) {
      logger.error(`Error classifying episode ${episodeId}:`, error as Record<string, unknown>);
      return [];
    }
  }

  // NOVO: LLM Classification
  private async llmClassify(
    content: string,
    spaces: (Space & { team?: Team | null })[],
  ): Promise<{
    spaceIds: string[];
    confidence: number;
    reasoning: string;
  } | null> {
    // Timeout de 5 segundos
    const timeoutPromise = new Promise<null>((_, reject) => {
      setTimeout(() => reject(new Error("LLM classification timeout")), 5000);
    });

    const classificationPromise = this.performLLMClassification(content, spaces);

    try {
      return await Promise.race([classificationPromise, timeoutPromise]);
    } catch (error) {
      logger.error("LLM classification error:", error);
      throw error;
    }
  }

  private async performLLMClassification(
    content: string,
    spaces: (Space & { team?: Team | null })[],
  ): Promise<{
    spaceIds: string[];
    confidence: number;
    reasoning: string;
  }> {
    // Build system prompt
    const systemPrompt = this.buildClassificationPrompt(spaces);

    const userMessage = `Classify this memory:\n\n${content}`;

    let resultText = "";
    await makeModelCall(
      false, // not streaming
      [
        { role: "system" as const, content: systemPrompt },
        { role: "user" as const, content: userMessage },
      ],
      (text: string) => {
        resultText = text;
      },
      {
        response_format: { type: "json_object" },
        temperature: 0.3,
      },
      "low", // usar complexity "low" para economizar custos
    );

    if (!resultText) {
      throw new Error("Empty response from LLM");
    }

    try {
      const parsed = JSON.parse(resultText);
      return {
        spaceIds: parsed.spaceIds || [],
        confidence: parsed.confidence || 0,
        reasoning: parsed.reasoning || "",
      };
    } catch (error) {
      throw new Error(`Failed to parse LLM response: ${error}`);
    }
  }

  // NOVO: Build system prompt
  private buildClassificationPrompt(spaces: (Space & { team?: Team | null })[]): string {
    const spaceDescriptions = spaces
      .map((s) => {
        const visibility = s.visibility === "TEAM" ? `(Team: ${s.team?.name || "Unknown"})` : "(Personal)";
        return `- ID: ${s.id}
  Name: ${s.name} ${visibility}
  Description: ${s.description || "No description"}
  Classification Rule: ${s.classificationRule || "General content"}`;
      })
      .join("\n");

    return `
You are a memory classification system for CORE AI.

SPACES TO CLASSIFY:
${spaceDescriptions}

CLASSIFICATION RULES:
1. PREFER team spaces over personal when content benefits the team
2. A memory CAN belong to MULTIPLE spaces if relevant
3. If no good match, return empty array
4. NEVER create new spaces - use existing only
5. Consider: file paths, project context, technical topics, team relevance
6. Be selective - don't assign to spaces that are only loosely related
7. Use confidence score: 0.0 (low) to 1.0 (very high)
8. Match based on semantic similarity, not just keywords

Return JSON with:
{
  "spaceIds": ["space_id_1", "space_id_2"],
  "confidence": 0.92,
  "reasoning": "Why these spaces were selected"
}
    `.trim();
  }

  // MELHORAR: rule-based (existing, just improve)
  private ruleBasedClassify(
    content: string,
    spaces: (Space & { team?: Team | null })[],
  ): string[] {
    const contentLower = content.toLowerCase();

    // Separar team spaces e personal spaces
    const teamSpaces = spaces.filter((s) => s.visibility === "TEAM");
    const personalSpaces = spaces.filter((s) => s.visibility === "PRIVATE");

    // Tentar encontrar matches por keywords
    const matchedSpaces: string[] = [];

    for (const space of spaces) {
      const spaceNameLower = space.name.toLowerCase();
      const spaceDescLower = (space.description || "").toLowerCase();
      const spaceRuleLower = (space.classificationRule || "").toLowerCase();

      // Extrair keywords
      const keywords = this.extractKeywords(
        spaceNameLower + " " + spaceDescLower + " " + spaceRuleLower,
      );

      // Verificar se algum keyword está no conteúdo
      for (const keyword of keywords) {
        if (keyword.length > 2 && contentLower.includes(keyword)) {
          matchedSpaces.push(space.id);
          break;
        }
      }
    }

    // Se encontrou matches, retornar
    if (matchedSpaces.length > 0) {
      return matchedSpaces;
    }

    // Se não encontrou matches, aplicar heurística
    // Para MVP: assign to first team space or first personal
    if (teamSpaces.length > 0) {
      return [teamSpaces[0].id];
    }
    if (personalSpaces.length > 0) {
      return [personalSpaces[0].id];
    }
    return [];
  }

  // NOVO: get all user spaces
  private async getAllUserSpaces(
    teams: Team[],
    userId: string,
  ): Promise<(Space & { team?: Team | null })[]> {
    // Buscar personal spaces do usuário
    const personalSpaces = await prisma.space.findMany({
      where: {
        workspace: { userId },
        deleted: null,
      },
    });

    // Buscar team spaces
    const teamIds = teams.map((t) => t.id);
    let teamSpaces: (Space & { team?: Team | null })[] = [];

    if (teamIds.length > 0) {
      teamSpaces = await prisma.space.findMany({
        where: {
          teamId: { in: teamIds },
          deleted: null,
        },
        include: { team: true },
      });
    }

    return [...personalSpaces, ...teamSpaces];
  }

  // NOVO: validate space IDs
  private async validateSpaceIds(
    spaceIds: string[],
    userId: string,
    workspaceId: string,
  ): Promise<string[]> {
    const accessibleSpaceIds = await permissionService.getUserReadableSpaces(
      userId,
      workspaceId,
    );
    return spaceIds.filter((id) => accessibleSpaceIds.includes(id));
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
      const allSpaces = await this.getAllUserSpaces(userTeams, userId);

      // Usar LLM para suggestions
      try {
        const llmSuggestions = await this.llmClassify(content, allSpaces);
        if (llmSuggestions && llmSuggestions.spaceIds.length > 0) {
          const validatedSpaceIds = await this.validateSpaceIds(
            llmSuggestions.spaceIds,
            userId,
            workspaceId,
          );

          for (const spaceId of validatedSpaceIds) {
            const space = allSpaces.find((s) => s.id === spaceId);
            if (space) {
              suggestions.push({
                spaceId: space.id,
                spaceName: space.name,
                confidence: llmSuggestions.confidence,
                reason: llmSuggestions.reasoning || "AI classification",
              });
            }
          }
        }
      } catch (llmError) {
        logger.error("LLM suggestions failed, using rule-based:", llmError);
        // Fallback to rule-based
        const ruleBasedSpaces = this.ruleBasedClassify(content, allSpaces);

        for (const spaceId of ruleBasedSpaces) {
          const space = allSpaces.find((s) => s.id === spaceId);
          if (space) {
            suggestions.push({
              spaceId: space.id,
              spaceName: space.name,
              confidence: 0.7,
              reason: "Keyword match",
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
    workspaceId: string,
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
