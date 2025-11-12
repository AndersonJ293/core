/*
 * PermissionService Business Logic Tests - Teams MVP
 *
 * REAL tests for actual business behavior, NOT mock validation.
 * These tests expose genuine bugs and implementation gaps.
 */

import { PermissionService, PermissionError } from '../../app/services/permission.server';
import { prisma } from '../../app/db.server';

// Mock ONLY external dependencies (database)
jest.mock('../../app/db.server');

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;

describe('PermissionService - Real Business Logic Tests', () => {
  let permissionService: PermissionService;

  beforeEach(() => {
    jest.clearAllMocks();
    permissionService = new PermissionService(mockedPrisma);
  });

  // ============================================================================
  // TEAM MEMBERSHIP BUSINESS LOGIC
  // ============================================================================

  describe('Team Membership Verification', () => {
    describe('isTeamMember', () => {
      it('should return true for active team members', async () => {
        // Given: User is active team member
        const userId = 'user_active123';
        const teamId = 'team_valid456';

        const activeMember = {
          id: 'member_789',
          userId,
          teamId,
          role: 'MEMBER',
          deleted: null,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        mockedPrisma.teamMember.findFirst.mockResolvedValue(activeMember);

        // When: Checking membership
        const result = await permissionService.isTeamMember(userId, teamId);

        // Then: Should return true
        expect(result).toBe(true);
        expect(mockedPrisma.teamMember.findFirst).toHaveBeenCalledWith({
          where: {
            teamId,
            userId,
            deleted: null,
          },
        });
      });

      it('should return false for soft-deleted team members', async () => {
        // Given: User was team member but was deleted
        const userId = 'user_deleted123';
        const teamId = 'team_old456';

        const deletedMember = {
          id: 'member_old789',
          userId,
          teamId,
          role: 'MEMBER',
          deleted: new Date('2024-01-01'), // Soft deleted
          createdAt: new Date('2023-12-01'),
          updatedAt: new Date('2024-01-01')
        };

        mockedPrisma.teamMember.findFirst.mockResolvedValue(deletedMember);

        // When: Checking membership
        const result = await permissionService.isTeamMember(userId, teamId);

        // Then: Should return false (deleted members are not active)
        expect(result).toBe(false);
      });

      it('should return false for non-existent team members', async () => {
        // Given: User never was a team member
        const userId = 'user_never123';
        const teamId = 'team_missing456';

        mockedPrisma.teamMember.findFirst.mockResolvedValue(null);

        // When: Checking membership
        const result = await permissionService.isTeamMember(userId, teamId);

        // Then: Should return false
        expect(result).toBe(false);
      });
    });

    describe('isTeamOwner', () => {
      it('should return true only for users with OWNER role', async () => {
        // Given: User is team owner
        const userId = 'owner123';
        const teamId = 'team456';

        const owner = {
          id: 'member_owner',
          userId,
          teamId,
          role: 'OWNER',
          deleted: null,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        mockedPrisma.teamMember.findFirst.mockResolvedValue(owner);

        // When: Checking ownership
        const result = await permissionService.isTeamOwner(userId, teamId);

        // Then: Should return true
        expect(result).toBe(true);
        expect(mockedPrisma.teamMember.findFirst).toHaveBeenCalledWith({
          where: {
            teamId,
            userId,
            role: 'OWNER',
            deleted: null,
          },
        });
      });

      it('should return false for users with other roles (ADMIN, MEMBER, VIEWER)', async () => {
        // Given: User is admin but not owner
        const userId = 'admin123';
        const teamId = 'team456';

        const admin = {
          id: 'member_admin',
          userId,
          teamId,
          role: 'ADMIN', // NOT OWNER
          deleted: null,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        mockedPrisma.teamMember.findFirst.mockResolvedValue(admin);

        // When: Checking ownership
        const result = await permissionService.isTeamOwner(userId, teamId);

        // Then: Should return false (admin != owner)
        expect(result).toBe(false);
      });

      it('should handle role-mismatch defense for buggy mocks', async () => {
        // Given: Database returns inconsistent data (mocking bug protection)
        const userId = 'suspicious123';
        const teamId = 'team456';

        const inconsistentMember = {
          id: 'member_broken',
          userId,
          teamId,
          role: 'MEMBER', // Query asks for OWNER but returns MEMBER
          deleted: null,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        mockedPrisma.teamMember.findFirst.mockResolvedValue(inconsistentMember);

        // When: Checking ownership
        const result = await permissionService.isTeamOwner(userId, teamId);

        // Then: Should return false (defensive programming)
        expect(result).toBe(false);
      });
    });

    describe('getUserTeamRole', () => {
      it('should return the exact role for active team members', async () => {
        // Given: User is team admin
        const userId = 'admin123';
        const teamId = 'team456';

        const adminMember = {
          id: 'member_admin',
          userId,
          teamId,
          role: 'ADMIN',
          deleted: null,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        mockedPrisma.teamMember.findFirst.mockResolvedValue(adminMember);

        // When: Getting user role
        const result = await permissionService.getUserTeamRole(userId, teamId);

        // Then: Should return exact role
        expect(result).toBe('ADMIN');
      });

      it('should return null for non-members', async () => {
        // Given: User is not a team member
        const userId = 'stranger123';
        const teamId = 'team456';

        mockedPrisma.teamMember.findFirst.mockResolvedValue(null);

        // When: Getting user role
        const result = await permissionService.getUserTeamRole(userId, teamId);

        // Then: Should return null
        expect(result).toBeNull();
      });

      it('should return null for deleted members', async () => {
        // Given: User was member but was deleted
        const userId = 'former123';
        const teamId = 'team456';

        const deletedMember = {
          id: 'member_deleted',
          userId,
          teamId,
          role: 'MEMBER',
          deleted: new Date('2024-01-01'),
          createdAt: new Date('2023-12-01'),
          updatedAt: new Date('2024-01-01')
        };

        mockedPrisma.teamMember.findFirst.mockResolvedValue(deletedMember);

        // When: Getting user role
        const result = await permissionService.getUserTeamRole(userId, teamId);

        // Then: Should return null (deleted members have no role)
        expect(result).toBeNull();
      });
    });
  });

  // ============================================================================
  // SPACE PERMISSION BUSINESS LOGIC
  // ============================================================================

  describe('Space Access Control', () => {
    describe('canReadSpace', () => {
      it('should allow workspace owner to read private spaces', async () => {
        // Given: Private space owned by user
        const userId = 'owner123';
        const spaceId = 'space_private789';

        const space = {
          id: spaceId,
          name: 'My Private Space',
          visibility: 'PRIVATE',
          teamId: null,
          Workspace: { userId }
        };

        mockedPrisma.space.findUnique.mockResolvedValue(space);

        // When: Checking read access
        const result = await permissionService.canReadSpace(userId, spaceId);

        // Then: Should allow access
        expect(result).toBe(true);
      });

      it('should deny non-owner access to private spaces', async () => {
        // Given: Private space owned by someone else
        const userId = 'stranger123';
        const spaceId = 'space_private789';

        const space = {
          id: spaceId,
          name: 'Someone Else Private Space',
          visibility: 'PRIVATE',
          teamId: null,
          Workspace: { userId: 'owner456' } // Different owner
        };

        mockedPrisma.space.findUnique.mockResolvedValue(space);

        // When: Checking read access
        const result = await permissionService.canReadSpace(userId, spaceId);

        // Then: Should deny access
        expect(result).toBe(false);
      });

      it('should allow team members to read team spaces', async () => {
        // Given: Team space and user is team member
        const userId = 'member123';
        const teamId = 'team456';
        const spaceId = 'space_team789';

        const space = {
          id: spaceId,
          name: 'Team Space',
          visibility: 'TEAM',
          teamId,
          Workspace: { userId: 'owner456' },
          team: {
            members: [{
              userId,
              role: 'MEMBER',
              deleted: null
            }]
          }
        };

        mockedPrisma.space.findUnique.mockResolvedValue(space);

        // When: Checking read access
        const result = await permissionService.canReadSpace(userId, spaceId);

        // Then: Should allow access
        expect(result).toBe(true);
      });
    });

    describe('canWriteSpace', () => {
      it('should allow workspace owner to write to team spaces', async () => {
        // Given: Team space and user is workspace owner (ultimate override)
        const userId = 'owner123';
        const teamId = 'team456';
        const spaceId = 'space_team789';

        const space = {
          id: spaceId,
          name: 'Team Space',
          visibility: 'TEAM',
          teamId,
          Workspace: { userId }, // User owns the workspace
          team: {
            members: [] // User doesn't even need to be team member
          }
        };

        mockedPrisma.space.findUnique.mockResolvedValue(space);

        // When: Checking write access
        const result = await permissionService.canWriteSpace(userId, spaceId);

        // Then: Should allow access (workspace owner override)
        expect(result).toBe(true);
      });

      it('should deny VIEWER role write access to team spaces', async () => {
        // Given: Team space and user is VIEWER only
        const userId = 'viewer123';
        const teamId = 'team456';
        const spaceId = 'space_team789';

        const space = {
          id: spaceId,
          name: 'Team Space',
          visibility: 'TEAM',
          teamId,
          Workspace: { userId: 'owner456' }, // Different owner
          team: {
            members: [{
              userId,
              role: 'VIEWER',
              deleted: null
            }]
          }
        };

        mockedPrisma.space.findUnique.mockResolvedValue(space);

        // When: Checking write access
        const result = await permissionService.canWriteSpace(userId, spaceId);

        // Then: Should deny access (VIEWER cannot write)
        expect(result).toBe(false);
      });

      it('should allow MEMBER role write access to team spaces', async () => {
        // Given: Team space and user is MEMBER
        const userId = 'member123';
        const teamId = 'team456';
        const spaceId = 'space_team789';

        const space = {
          id: spaceId,
          name: 'Team Space',
          visibility: 'TEAM',
          teamId,
          Workspace: { userId: 'owner456' }, // Different owner
          team: {
            members: [{
              userId,
              role: 'MEMBER',
              deleted: null
            }]
          }
        };

        mockedPrisma.space.findUnique.mockResolvedValue(space);

        // When: Checking write access
        const result = await permissionService.canWriteSpace(userId, spaceId);

        // Then: Should allow access (MEMBER can write)
        expect(result).toBe(true);
      });
    });
  });

  // ============================================================================
  // PERMISSION REQUIREMENTS (THROWING METHODS)
  // ============================================================================

  describe('Permission Requirements', () => {
    describe('requireTeamMember', () => {
      it('should return team member for valid members', async () => {
        // Given: User is active team member
        const userId = 'member123';
        const teamId = 'team456';

        const member = {
          id: 'member_789',
          userId,
          teamId,
          role: 'MEMBER',
          deleted: null,
          team: { id: teamId, name: 'Test Team' }
        };

        mockedPrisma.teamMember.findFirst.mockResolvedValue(member);

        // When: Requiring team membership
        const result = await permissionService.requireTeamMember(userId, teamId);

        // Then: Should return member
        expect(result).toEqual(member);
      });

      it('should throw PermissionError for non-members', async () => {
        // Given: User is not a team member
        const userId = 'stranger123';
        const teamId = 'team456';

        mockedPrisma.teamMember.findFirst.mockResolvedValue(null);

        // When: Requiring team membership
        const result = permissionService.requireTeamMember(userId, teamId);

        // Then: Should throw PermissionError
        await expect(result).rejects.toThrow(PermissionError);
        await expect(result).rejects.toThrow('User stranger123 is not a member of team team456');
      });

      it('should throw PermissionError for deleted members', async () => {
        // Given: User was deleted from team
        const userId = 'former123';
        const teamId = 'team456';

        const deletedMember = {
          id: 'member_deleted',
          userId,
          teamId,
          role: 'MEMBER',
          deleted: new Date('2024-01-01'),
          team: { id: teamId, name: 'Test Team' }
        };

        mockedPrisma.teamMember.findFirst.mockResolvedValue(deletedMember);

        // When: Requiring team membership
        const result = permissionService.requireTeamMember(userId, teamId);

        // Then: Should throw PermissionError
        await expect(result).rejects.toThrow(PermissionError);
      });
    });

    describe('requireTeamAdmin', () => {
      it('should return member for team owners and admins', async () => {
        // Given: User is team admin
        const userId = 'admin123';
        const teamId = 'team456';

        const admin = {
          id: 'member_admin',
          userId,
          teamId,
          role: 'ADMIN',
          deleted: null,
          team: { id: teamId, name: 'Test Team' }
        };

        mockedPrisma.teamMember.findFirst.mockResolvedValue(admin);

        // When: Requiring team admin
        const result = await permissionService.requireTeamAdmin(userId, teamId);

        // Then: Should return admin
        expect(result).toEqual(admin);
      });

      it('should throw PermissionError for regular members', async () => {
        // Given: User is regular member, not admin
        const userId = 'member123';
        const teamId = 'team456';

        const member = {
          id: 'member_regular',
          userId,
          teamId,
          role: 'MEMBER', // NOT ADMIN/OWNER
          deleted: null,
          team: { id: teamId, name: 'Test Team' }
        };

        mockedPrisma.teamMember.findFirst.mockResolvedValue(member);

        // When: Requiring team admin
        const result = permissionService.requireTeamAdmin(userId, teamId);

        // Then: Should throw PermissionError
        await expect(result).rejects.toThrow(PermissionError);
      });
    });

    describe('requireTeamOwner', () => {
      it('should return member only for team owners', async () => {
        // Given: User is team owner
        const userId = 'owner123';
        const teamId = 'team456';

        const owner = {
          id: 'member_owner',
          userId,
          teamId,
          role: 'OWNER',
          deleted: null,
          team: { id: teamId, name: 'Test Team' }
        };

        mockedPrisma.teamMember.findFirst.mockResolvedValue(owner);

        // When: Requiring team owner
        const result = await permissionService.requireTeamOwner(userId, teamId);

        // Then: Should return owner
        expect(result).toEqual(owner);
      });

      it('should throw PermissionError for team admins', async () => {
        // Given: User is admin, not owner
        const userId = 'admin123';
        const teamId = 'team456';

        const admin = {
          id: 'member_admin',
          userId,
          teamId,
          role: 'ADMIN', // NOT OWNER
          deleted: null,
          team: { id: teamId, name: 'Test Team' }
        };

        mockedPrisma.teamMember.findFirst.mockResolvedValue(admin);

        // When: Requiring team owner
        const result = permissionService.requireTeamOwner(userId, teamId);

        // Then: Should throw PermissionError
        await expect(result).rejects.toThrow(PermissionError);
      });
    });
  });

  // ============================================================================
  // ADVANCED PERMISSION FEATURES
  // ============================================================================

  describe('Advanced Permission Features', () => {
    describe('canPerformTeamAction', () => {
      it('should allow owners to perform all actions', async () => {
        // Given: User is team owner
        const userId = 'owner123';
        const teamId = 'team456';

        const owner = {
          id: 'member_owner',
          userId,
          teamId,
          role: 'OWNER',
          deleted: null
        };

        mockedPrisma.teamMember.findFirst.mockResolvedValue(owner);

        // When/Then: Owner can perform all actions
        expect(await permissionService.canPerformTeamAction(userId, teamId, 'view')).toBe(true);
        expect(await permissionService.canPerformTeamAction(userId, teamId, 'edit')).toBe(true);
        expect(await permissionService.canPerformTeamAction(userId, teamId, 'invite')).toBe(true);
        expect(await permissionService.canPerformTeamAction(userId, teamId, 'remove_member')).toBe(true);
        expect(await permissionService.canPerformTeamAction(userId, teamId, 'delete')).toBe(true);
      });

      it('should allow admins to perform most actions except delete', async () => {
        // Given: User is team admin
        const userId = 'admin123';
        const teamId = 'team456';

        const admin = {
          id: 'member_admin',
          userId,
          teamId,
          role: 'ADMIN',
          deleted: null
        };

        mockedPrisma.teamMember.findFirst.mockResolvedValue(admin);

        // When/Then: Admin can perform most actions but not delete
        expect(await permissionService.canPerformTeamAction(userId, teamId, 'view')).toBe(true);
        expect(await permissionService.canPerformTeamAction(userId, teamId, 'edit')).toBe(true);
        expect(await permissionService.canPerformTeamAction(userId, teamId, 'invite')).toBe(true);
        expect(await permissionService.canPerformTeamAction(userId, teamId, 'remove_member')).toBe(true);
        expect(await permissionService.canPerformTeamAction(userId, teamId, 'delete')).toBe(false); // Only owners can delete
      });

      it('should allow members only to view', async () => {
        // Given: User is team member
        const userId = 'member123';
        const teamId = 'team456';

        const member = {
          id: 'member_regular',
          userId,
          teamId,
          role: 'MEMBER',
          deleted: null
        };

        mockedPrisma.teamMember.findFirst.mockResolvedValue(member);

        // When/Then: Members can only view
        expect(await permissionService.canPerformTeamAction(userId, teamId, 'view')).toBe(true);
        expect(await permissionService.canPerformTeamAction(userId, teamId, 'edit')).toBe(false);
        expect(await permissionService.canPerformTeamAction(userId, teamId, 'invite')).toBe(false);
        expect(await permissionService.canPerformTeamAction(userId, teamId, 'remove_member')).toBe(false);
        expect(await permissionService.canPerformTeamAction(userId, teamId, 'delete')).toBe(false);
      });
    });
  });

  // ============================================================================
  // BUSINESS INVARIANTS (RULES THAT MUST NEVER BE BROKEN)
  // ============================================================================

  describe('Business Invariants - Security Rules', () => {
    it('NEVER allows deleted users to have any permissions', async () => {
      // Given: Deleted team member
      const userId = 'deleted123';
      const teamId = 'team456';

      const deletedMember = {
        id: 'member_deleted',
        userId,
        teamId,
        role: 'OWNER', // Even if role was owner
        deleted: new Date('2024-01-01') // But user is deleted
      };

      mockedPrisma.teamMember.findFirst.mockResolvedValue(deletedMember);

      // When/Then: Deleted users should have no permissions
      expect(await permissionService.isTeamMember(userId, teamId)).toBe(false);
      expect(await permissionService.isTeamOwner(userId, teamId)).toBe(false);
      expect(await permissionService.getUserTeamRole(userId, teamId)).toBeNull();

      // Should throw for required permissions
      await expect(permissionService.requireTeamMember(userId, teamId))
        .rejects.toThrow(PermissionError);
    });

    it('ALWAYS validates role consistency in require methods', async () => {
      // Given: Inconsistent data (query asks for OWNER but returns MEMBER)
      const userId = 'inconsistent123';
      const teamId = 'team456';

      const inconsistentMember = {
        id: 'member_broken',
        userId,
        teamId,
        role: 'MEMBER', // Wrong role for query
        deleted: null,
        team: { id: teamId, name: 'Test Team' }
      };

      mockedPrisma.teamMember.findFirst.mockResolvedValue(inconsistentMember);

      // When/Then: Should throw due to role validation
      await expect(permissionService.requireTeamOwner(userId, teamId))
        .rejects.toThrow(PermissionError);
    });
  });
});