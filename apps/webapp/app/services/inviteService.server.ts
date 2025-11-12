import { prisma } from "~/db.server";
import { logger } from "~/services/logger.service";
import { permissionService } from "~/services/permission.server";

export class InviteService {
  /**
   * Create a new team invite
   */
  async createInvite(
    teamId: string,
    inviterId: string,
    email: string,
    role: string = "MEMBER",
  ) {
    try {
      // Validate email format
      if (!email || typeof email !== 'string') {
        throw new Error("Valid email address is required");
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        throw new Error("Invalid email address format");
      }

      // Sanitize email (lowercase, trim spaces)
      const sanitizedEmail = email.toLowerCase().trim();
      // Validate team exists and user can invite
      const canInvite = await permissionService.canPerformTeamAction(
        inviterId,
        teamId,
        "invite",
      );

      if (!canInvite) {
        throw new Error(
          "You don't have permission to invite members to this team",
        );
      }

      // Check if team exists
      const team = await prisma.team.findFirst({
        where: { id: teamId, deleted: null },
      });

      if (!team) {
        throw new Error("Team not found");
      }

      // Check if user is trying to invite themselves
      const inviterUser = await prisma.user.findFirst({
        where: { id: inviterId },
        select: { email: true },
      });

      if (inviterUser && inviterUser.email === sanitizedEmail) {
        throw new Error("You cannot invite yourself to a team");
      }

      // Check if user already exists
      const invitedUser = await prisma.user.findFirst({
        where: { email: sanitizedEmail },
      });

      // Check for existing pending invite for this email and team (only non-expired ones)
      const existingInvite = await prisma.teamInvite.findFirst({
        where: {
          teamId,
          invitedUserEmail: sanitizedEmail,
          status: "PENDING",
          expiresAt: { gt: new Date() }, // Only active invites
        },
      });

      if (existingInvite) {
        throw new Error("Invite already sent to this email");
      }

      // Check if user is already a team member
      if (invitedUser) {
        const existingMember = await prisma.teamMember.findFirst({
          where: {
            teamId,
            userId: invitedUser.id,
            deleted: null,
          },
        });

        if (existingMember) {
          throw new Error("User is already a member of this team");
        }
      }

      // Create the invite
      const invite = await prisma.teamInvite.create({
        data: {
          teamId,
          inviterId,
          invitedUserEmail: sanitizedEmail,
          invitedUserId: invitedUser?.id,
          role,
          status: "PENDING",
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
        include: {
          team: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          inviter: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      logger.info(
        `Team invite created: ${invite.id} for ${sanitizedEmail} to team ${teamId} by ${inviterId}`,
      );

      return invite;
    } catch (error) {
      logger.error("Error creating team invite:", error as any);
      throw error;
    }
  }

  /**
   * Get user's pending invites
   */
  async getUserPendingInvites(userId: string) {
    try {
      // Get user email for email-based invites (safe approach)
      const userEmail = await this.getUserEmailSafely(userId);

      const whereConditions = [
        { invitedUserId: userId },
      ];

      // Only add email condition if user email is found
      if (userEmail) {
        whereConditions.push({ invitedUserEmail: userEmail });
      }

      const invites = await prisma.teamInvite.findMany({
        where: {
          OR: whereConditions,
          status: "PENDING",
          expiresAt: { gt: new Date() },
        },
        include: {
          team: {
            select: {
              id: true,
              name: true,
              slug: true,
              icon: true,
            },
          },
          inviter: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return invites;
    } catch (error) {
      logger.error("Error fetching user pending invites:", error as any);
      throw error;
    }
  }

  /**
   * Accept a team invite
   */
  async acceptInvite(inviteId: string, userId: string) {
    try {
      // First, try to find invite by userId
      let invite = await prisma.teamInvite.findFirst({
        where: {
          id: inviteId,
          invitedUserId: userId,
          status: "PENDING",
          expiresAt: { gt: new Date() },
        },
        include: {
          team: true,
        },
      });

      // If not found by userId, try by email (safe approach)
      if (!invite) {
        const userEmail = await this.getUserEmailSafely(userId);
        if (userEmail) {
          invite = await prisma.teamInvite.findFirst({
            where: {
              id: inviteId,
              invitedUserEmail: userEmail,
              status: "PENDING",
              expiresAt: { gt: new Date() },
            },
            include: {
              team: true,
            },
          });
        }
      }

      if (!invite) {
        throw new Error("Invite not found or expired");
      }

      // Update invite status
      await prisma.teamInvite.update({
        where: { id: inviteId },
        data: {
          status: "ACCEPTED",
          respondedAt: new Date(),
          invitedUserId: userId, // Ensure the user ID is set
        },
      });

      // Create team member
      const teamMember = await prisma.teamMember.create({
        data: {
          teamId: invite.teamId,
          userId: userId,
          role: invite.role,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          team: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      });

      logger.info(
        `Team invite accepted: ${inviteId} by user ${userId}, created team member ${teamMember.id}`,
      );

      return teamMember;
    } catch (error) {
      logger.error("Error accepting team invite:", error as any);
      throw error;
    }
  }

  /**
   * Refuse a team invite
   */
  async refuseInvite(inviteId: string, userId: string) {
    try {
      // First, try to find invite by userId
      let invite = await prisma.teamInvite.findFirst({
        where: {
          id: inviteId,
          invitedUserId: userId,
          status: "PENDING",
          expiresAt: { gt: new Date() },
        },
      });

      // If not found by userId, try by email (safe approach)
      if (!invite) {
        const userEmail = await this.getUserEmailSafely(userId);
        if (userEmail) {
          invite = await prisma.teamInvite.findFirst({
            where: {
              id: inviteId,
              invitedUserEmail: userEmail,
              status: "PENDING",
              expiresAt: { gt: new Date() },
            },
          });
        }
      }

      if (!invite) {
        throw new Error("Invite not found or expired");
      }

      await prisma.teamInvite.update({
        where: { id: inviteId },
        data: {
          status: "REFUSED",
          respondedAt: new Date(),
          invitedUserId: userId, // Ensure the user ID is set
        },
      });

      logger.info(`Team invite refused: ${inviteId} by user ${userId}`);

      return true;
    } catch (error) {
      logger.error("Error refusing team invite:", error as any);
      throw error;
    }
  }

  /**
   * Cancel a team invite (by inviter or team owner)
   */
  async cancelInvite(inviteId: string, userId: string) {
    try {
      const invite = await prisma.teamInvite.findFirst({
        where: {
          id: inviteId,
          status: "PENDING",
        },
        include: {
          team: {
            include: {
              members: {
                where: {
                  userId: userId,
                  deleted: null,
                },
              },
            },
          },
        },
      });

      if (!invite) {
        throw new Error("Invite not found");
      }

      // Check if user can cancel (inviter or team owner)
      const isInviter = invite.inviterId === userId;
      const isTeamOwner = invite.team.members.some(
        (member: any) => member.userId === userId && member.role === "OWNER",
      );

      if (!isInviter && !isTeamOwner) {
        throw new Error("You don't have permission to cancel this invite");
      }

      await prisma.teamInvite.update({
        where: { id: inviteId },
        data: {
          status: "REFUSED", // Mark as refused to indicate cancellation
          respondedAt: new Date(),
        },
      });

      logger.info(`Team invite canceled: ${inviteId} by user ${userId}`);

      return true;
    } catch (error) {
      logger.error("Error canceling team invite:", error as any);
      throw error;
    }
  }

  /**
   * Get team invites (for team management)
   */
  async getTeamInvites(teamId: string, userId: string) {
    try {
      // Check if user can view team invites
      const canView = await permissionService.canPerformTeamAction(
        userId,
        teamId,
        "view",
      );

      if (!canView) {
        throw new Error("You don't have permission to view team invites");
      }

      const invites = await prisma.teamInvite.findMany({
        where: {
          teamId,
          status: { in: ["PENDING", "ACCEPTED", "REFUSED"] },
        },
        include: {
          inviter: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          invitedUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return invites;
    } catch (error) {
      logger.error("Error fetching team invites:", error as any);
      throw error;
    }
  }

  /**
   * Clean expired invites (to be run as a scheduled job)
   */
  async cleanExpiredInvites() {
    try {
      const result = await prisma.teamInvite.updateMany({
        where: {
          status: "PENDING",
          expiresAt: { lt: new Date() },
        },
        data: {
          status: "EXPIRED",
        },
      });

      logger.info(`Cleaned ${result.count} expired team invites`);

      return result.count;
    } catch (error) {
      logger.error("Error cleaning expired invites:", error as any);
      throw error;
    }
  }

  /**
   * Helper method to get user email
   */
  private async getUserEmail(userId: string): Promise<string> {
    const user = await prisma.user.findFirst({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      throw new Error("User not found");
    }

    return user.email;
  }

  /**
   * Helper method to get user email safely (returns null if not found)
   */
  private async getUserEmailSafely(userId: string): Promise<string | null> {
    try {
      const user = await prisma.user.findFirst({
        where: { id: userId },
        select: { email: true },
      });
      return user?.email || null;
    } catch {
      return null;
    }
  }
}

export const inviteService = new InviteService();
