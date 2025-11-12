import { prisma } from "~/trigger/utils/prisma";
import { logger } from "./logger.service";

export class PermissionService {
  async isTeamMember(userId: string, teamId: string): Promise<boolean> {
    const membership = await prisma.teamMember.findFirst({
      where: {
        teamId,
        userId,
        deleted: null,
      },
    });

    return membership !== null;
  }

  async isTeamOwner(userId: string, teamId: string): Promise<boolean> {
    const membership = await prisma.teamMember.findFirst({
      where: {
        teamId,
        userId,
        role: "OWNER",
        deleted: null,
      },
    });

    return membership !== null;
  }

  async getUserTeamRole(
    userId: string,
    teamId: string,
  ): Promise<string | null> {
    const membership = await prisma.teamMember.findFirst({
      where: {
        teamId,
        userId,
        deleted: null,
      },
    });

    return membership?.role || null;
  }

  async canReadSpace(userId: string, spaceId: string): Promise<boolean> {
    const space = await prisma.space.findUnique({
      where: { id: spaceId },
      include: {
        team: {
          include: {
            members: {
              where: {
                userId,
                deleted: null,
              },
            },
          },
        },
        Workspace: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!space) {
      logger.warn(`Space ${spaceId} not found`);
      return false;
    }

    // Check workspace ownership
    const isWorkspaceOwner = space.Workspace?.userId === userId;

    if (space.visibility === "PRIVATE") {
      return isWorkspaceOwner;
    }

    if (space.visibility === "TEAM" && space.teamId) {
      const isTeamMember = space.team?.members && space.team.members.length > 0;
      return isWorkspaceOwner || !!isTeamMember;
    }

    return isWorkspaceOwner;
  }

  async canWriteSpace(userId: string, spaceId: string): Promise<boolean> {
    const space = await prisma.space.findUnique({
      where: { id: spaceId },
      include: {
        team: {
          include: {
            members: {
              where: {
                userId,
                deleted: null,
              },
            },
          },
        },
        Workspace: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!space) {
      logger.warn(`Space ${spaceId} not found`);
      return false;
    }

    // Check workspace ownership
    const isWorkspaceOwner = space.Workspace?.userId === userId;

    if (space.visibility === "PRIVATE") {
      return isWorkspaceOwner;
    }

    if (space.visibility === "TEAM" && space.teamId) {
      const isTeamMember = space.team?.members && space.team.members.length > 0;
      return isWorkspaceOwner || !!isTeamMember;
    }

    return isWorkspaceOwner;
  }

  async getUserReadableSpaces(
    userId: string,
    workspaceId: string,
  ): Promise<string[]> {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      return [];
    }

    const isWorkspaceOwner = workspace.userId === userId;

    const teamMemberships = await prisma.teamMember.findMany({
      where: {
        userId,
        deleted: null,
      },
      select: {
        teamId: true,
      },
    });

    const teamIds = teamMemberships.map((m) => m.teamId);

    const spaces = await prisma.space.findMany({
      where: {
        workspaceId,
        OR: [
          isWorkspaceOwner ? { id: { not: undefined } } : { id: undefined },
          {
            visibility: "PRIVATE",
            Workspace: {
              userId,
            },
          },
          {
            visibility: "TEAM",
            teamId: {
              in: teamIds,
            },
          },
        ],
      },
      select: {
        id: true,
      },
    });

    return spaces.map((s) => s.id);
  }

  async getUserTeams(userId: string, workspaceId: string) {
    return await prisma.team.findMany({
      where: {
        workspaceId,
        members: {
          some: {
            userId,
            deleted: null,
          },
        },
        deleted: null,
      },
      include: {
        members: {
          where: {
            deleted: null,
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        _count: {
          select: {
            spaces: true,
            members: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async canPerformTeamAction(
    userId: string,
    teamId: string,
    action: "view" | "edit" | "delete" | "invite" | "remove_member",
  ): Promise<boolean> {
    const membership = await prisma.teamMember.findFirst({
      where: {
        teamId,
        userId,
        deleted: null,
      },
    });

    if (!membership) {
      return false;
    }

    if (action === "view") {
      return true;
    }

    return membership.role === "OWNER";
  }

  async isWorkspaceOwner(
    userId: string,
    workspaceId: string,
  ): Promise<boolean> {
    const workspace = await prisma.workspace.findUnique({
      where: {
        id: workspaceId,
      },
    });

    return workspace?.userId === userId;
  }

  async filterEpisodesByPermission(
    userId: string,
    workspaceId: string,
    episodeIds: string[],
  ): Promise<string[]> {
    if (episodeIds.length === 0) {
      return [];
    }

    const readableSpaceIds = await this.getUserReadableSpaces(
      userId,
      workspaceId,
    );

    if (readableSpaceIds.length === 0) {
      logger.warn(`User ${userId} has no readable spaces in workspace ${workspaceId}`);
      return [];
    }

    logger.info(
      `Filtering ${episodeIds.length} episodes for user ${userId} (readable spaces: ${readableSpaceIds.length})`,
    );

    return episodeIds;
  }

  // NEW: Require team member
  async requireTeamMember(userId: string, teamId: string) {
    const membership = await prisma.teamMember.findFirst({
      where: { userId, teamId, deleted: null },
      include: { team: true }
    });

    if (!membership) {
      throw new PermissionError(`User ${userId} is not a member of team ${teamId}`);
    }

    return membership;
  }

  // NEW: Require team admin/owner
  async requireTeamAdmin(userId: string, teamId: string) {
    const membership = await prisma.teamMember.findFirst({
      where: {
        userId,
        teamId,
        role: { in: ['OWNER', 'ADMIN'] },
        deleted: null
      },
      include: { team: true }
    });

    if (!membership) {
      throw new PermissionError(`User ${userId} is not an admin of team ${teamId}`);
    }

    return membership;
  }

  // NEW: Require team owner only
  async requireTeamOwner(userId: string, teamId: string) {
    const membership = await prisma.teamMember.findFirst({
      where: {
        userId,
        teamId,
        role: 'OWNER',
        deleted: null
      },
      include: { team: true }
    });

    if (!membership) {
      throw new PermissionError(`User ${userId} is not the owner of team ${teamId}`);
    }

    return membership;
  }

  // NEW: Check space access with action
  async checkSpaceAccess(
    userId: string,
    spaceId: string,
    action: 'read' | 'write' | 'admin'
  ): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const space = await prisma.space.findUnique({
        where: { id: spaceId },
        include: {
          team: {
            include: {
              members: { where: { userId, deleted: null } }
            }
          },
          Workspace: true
        }
      });

      if (!space) {
        return { allowed: false, reason: 'Space not found' };
      }

      // Private space: only owner
      if (space.visibility === 'PRIVATE') {
        const isOwner = space.Workspace.userId === userId;
        return {
          allowed: action === 'read' ? isOwner : isOwner,
          reason: isOwner ? undefined : 'Space is private'
        };
      }

      // Team space: check membership
      if (space.visibility === 'TEAM' && space.teamId) {
        const membership = space.team.members[0];

        if (!membership) {
          return { allowed: false, reason: 'Not a team member' };
        }

        // Admin actions require ADMIN/OWNER
        if (action === 'admin') {
          const allowed = ['OWNER', 'ADMIN'].includes(membership.role);
          return {
            allowed,
            reason: allowed ? undefined : 'Admin access requires team admin role'
          };
        }

        // Write actions
        if (action === 'write') {
          // For team spaces, check write permission based on space settings
          // All members can write by default unless specified otherwise
          const allowed = ['OWNER', 'ADMIN', 'MEMBER'].includes(membership.role);
          return {
            allowed,
            reason: allowed ? undefined : 'Insufficient team role'
          };
        }

        // Read actions: all members
        return { allowed: true };
      }

      // Workspace space: all workspace members
      if (space.visibility === 'WORKSPACE') {
        const isWorkspaceMember = space.Workspace.userId === userId;
        return {
          allowed: isWorkspaceMember,
          reason: isWorkspaceMember ? undefined : 'Not a workspace member'
        };
      }

      return { allowed: false, reason: 'Unknown visibility' };
    } catch (error) {
      logger.error('Permission check failed:', error);
      return { allowed: false, reason: 'Permission check failed' };
    }
  }

  // NEW: Batch permission checks
  async batchCheckPermissions(
    userId: string,
    checks: { spaceId: string; action: 'read' | 'write' | 'admin' }[]
  ): Promise<Record<string, { allowed: boolean; reason?: string }>> {
    const results: Record<string, { allowed: boolean; reason?: string }> = {};

    // Process in parallel
    await Promise.all(
      checks.map(async (check) => {
        results[check.spaceId] = await this.checkSpaceAccess(
          userId,
          check.spaceId,
          check.action
        );
      })
    );

    return results;
  }

  // NEW: Get all accessible spaces for user (with caching)
  async getAccessibleSpaces(
    userId: string,
    workspaceId: string,
    includeTeamSpaces = true
  ) {
    // TODO: Implement Redis caching
    // Cache key: `user:${userId}:accessible_spaces`

    // Personal spaces
    const personalSpaces = await prisma.space.findMany({
      where: {
        workspaceId,
        visibility: 'PRIVATE',
        deleted: null
      }
    });

    if (!includeTeamSpaces) {
      return personalSpaces;
    }

    // Team spaces
    const teamMemberships = await prisma.teamMember.findMany({
      where: { userId, deleted: null },
      include: {
        team: {
          include: {
            spaces: {
              where: { deleted: null }
            }
          }
        }
      }
    });

    const teamSpaces = teamMemberships.flatMap(m => m.team.spaces);

    return [...personalSpaces, ...teamSpaces];
  }
}

// NEW: Custom error class
export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionError';
  }
}

export const permissionService = new PermissionService();
