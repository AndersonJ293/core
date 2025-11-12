import { logger } from "./logger.service";
import { prisma } from "~/db.server";

export class TeamService {
  /**
   * Get the active team for a user
   * For now, returns the first team the user belongs to
   * In the future, this could be enhanced with user preferences, context, etc.
   */
  async getActiveTeam(userId: string): Promise<string | null> {
    try {
      // Get the first team the user belongs to
      const teamMember = await prisma.teamMember.findFirst({
        where: {
          userId: userId,
          deleted: null,
        },
        include: {
          team: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc", // Get the first team they joined
        },
      });

      if (!teamMember) {
        logger.info(`User ${userId} is not a member of any team`);
        return null;
      }

      logger.info(`Active team for user ${userId}: ${teamMember.team.name} (${teamMember.team.id})`);
      return teamMember.team.id;
    } catch (error) {
      logger.error(`Error getting active team for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Check if user belongs to a specific team
   */
  async isUserInTeam(userId: string, teamId: string): Promise<boolean> {
    try {
      const teamMember = await prisma.teamMember.findFirst({
        where: {
          userId: userId,
          teamId: teamId,
          deleted: null,
        },
      });

      return !!teamMember;
    } catch (error) {
      logger.error(`Error checking team membership for user ${userId}, team ${teamId}:`, error);
      return false;
    }
  }

  /**
   * Get all teams for a user
   */
  async getUserTeams(userId: string): Promise<Array<{ id: string; name: string; role: string }>> {
    try {
      const teamMembers = await prisma.teamMember.findMany({
        where: {
          userId: userId,
          deleted: null,
        },
        include: {
          team: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      return teamMembers.map(member => ({
        id: member.team.id,
        name: member.team.name,
        role: member.role,
      }));
    } catch (error) {
      logger.error(`Error getting teams for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Validate team access for security
   */
  async validateTeamAccess(userId: string, teamId: string): Promise<boolean> {
    return await this.isUserInTeam(userId, teamId);
  }
}

export const teamService = new TeamService();