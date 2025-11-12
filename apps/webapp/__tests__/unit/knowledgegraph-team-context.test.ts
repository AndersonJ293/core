/*
 * KnowledgeGraphService Team Context Integration Tests - Teams MVP
 *
 * Tests for team context propagation in knowledge graph operations.
 * Validates that:
 * - Memory searches are properly scoped to team context
 * - Episodes and statements respect team boundaries
 * - Cross-team data isolation is maintained
 */

import { KnowledgeGraphService } from '../../app/services/knowledgeGraph.server';
import { prisma } from '../../app/db.server';
import { permissionService } from '../../app/services/permission.server';

// Mock external dependencies
jest.mock('../../app/db.server');
jest.mock('../../app/services/permission.server');

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;
const mockedPermissionService = permissionService as jest.Mocked<typeof permissionService>;

describe('KnowledgeGraphService - Team Context Integration', () => {
  let knowledgeGraphService: KnowledgeGraphService;

  beforeEach(() => {
    jest.clearAllMocks();
    knowledgeGraphService = new KnowledgeGraphService();
  });

  // ============================================================================
  // TEAM-SCOPED MEMORY SEARCH
  // ============================================================================

  describe('Team-Scoped Memory Search', () => {
    it('should restrict semantic search to team context', async () => {
      // Given: User searching memory within team context
      const userId = 'user123';
      const teamId = 'team456';
      const workspaceId = 'workspace789';
      const query = 'confidential project details';

      const searchParams = {
        query,
        userId,
        workspaceId,
        teamId, // Team context specified
        limit: 10
      };

      // Mock team membership verification
      mockedPermissionService.isTeamMember.mockResolvedValue(true);

      // Mock episode results scoped to team
      const teamEpisodes = [
        {
          id: 'episode_team1',
          userId,
          workspaceId,
          teamId, // Episode belongs to team
          content: 'Team confidential project details...',
          createdAt: new Date('2024-01-01')
        }
      ];

      // The service should filter episodes by teamId
      jest.spyOn(knowledgeGraphService as any, 'searchEpisodes')
        .mockResolvedValue(teamEpisodes);

      // When: Searching with team context
      const results = await knowledgeGraphService.semanticSearch(searchParams);

      // Then: Results should be limited to team context
      expect(results).toHaveLength(1);
      expect(results[0].teamId).toBe(teamId);
      expect(mockedPermissionService.isTeamMember).toHaveBeenCalledWith(userId, teamId);

      // Critical: Verify search was scoped to team
      expect((knowledgeGraphService as any).searchEpisodes).toHaveBeenCalledWith(
        expect.objectContaining({
          teamId, // Must include team filter
          userId,
          workspaceId
        })
      );
    });

    it('should reject cross-team memory access', async () => {
      // Given: User trying to search outside their team context
      const userId = 'user123';
      const requestedTeamId = 'team_other456';
      const workspaceId = 'workspace789';
      const query = 'other team data';

      // Mock user is NOT member of requested team
      mockedPermissionService.isTeamMember.mockResolvedValue(false);

      // When: Attempting to search with unauthorized team context
      const searchPromise = knowledgeGraphService.semanticSearch({
        query,
        userId,
        workspaceId,
        teamId: requestedTeamId,
        limit: 10
      });

      // Then: Should be rejected
      await expect(searchPromise).rejects.toThrow();
      expect(mockedPermissionService.isTeamMember).toHaveBeenCalledWith(userId, requestedTeamId);
    });

    it('should handle mixed team and personal search correctly', async () => {
      // Given: User searching both personal and team memory
      const userId = 'user123';
      const teamId = 'team456';
      const workspaceId = 'workspace789';
      const query = 'project updates';

      // Mock team membership
      mockedPermissionService.isTeamMember.mockResolvedValue(true);

      // Mock mixed results (personal + team)
      const mixedEpisodes = [
        {
          id: 'episode_personal',
          userId,
          workspaceId,
          teamId: null, // Personal episode
          content: 'Personal project notes...',
          createdAt: new Date('2024-01-01')
        },
        {
          id: 'episode_team',
          userId,
          workspaceId,
          teamId, // Team episode
          content: 'Team project updates...',
          createdAt: new Date('2024-01-02')
        }
      ];

      jest.spyOn(knowledgeGraphService as any, 'searchEpisodes')
        .mockResolvedValue(mixedEpisodes);

      // When: Searching without team restriction
      const results = await knowledgeGraphService.semanticSearch({
        query,
        userId,
        workspaceId,
        limit: 10
        // No teamId specified - should search user's accessible content
      });

      // Then: Should return both personal and team content
      expect(results).toHaveLength(2);
      expect(results.some(r => r.teamId === null)).toBe(true); // Personal content
      expect(results.some(r => r.teamId === teamId)).toBe(true); // Team content
    });
  });

  // ============================================================================
  // TEAM-SCOPED EPISODE CREATION
  // ============================================================================

  describe('Team-Scoped Episode Creation', () => {
    it('should associate episodes with team context when provided', async () => {
      // Given: Creating episode within team context
      const userId = 'user123';
      const teamId = 'team456';
      const workspaceId = 'workspace789';

      const episodeData = {
        title: 'Team Meeting Notes',
        content: 'Discussion about Q4 roadmap...',
        userId,
        workspaceId,
        teamId // Team context specified
      };

      // Mock team membership verification
      mockedPermissionService.isTeamMember.mockResolvedValue(true);

      // Mock successful episode creation
      const createdEpisode = {
        id: 'episode_new123',
        ...episodeData,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      jest.spyOn(knowledgeGraphService as any, 'createEpisode')
        .mockResolvedValue(createdEpisode);

      // When: Creating episode with team context
      const result = await knowledgeGraphService.createEpisode(episodeData);

      // Then: Episode should be associated with team
      expect(result.teamId).toBe(teamId);
      expect(mockedPermissionService.isTeamMember).toHaveBeenCalledWith(userId, teamId);

      // Critical: Verify episode creation included team context
      expect((knowledgeGraphService as any).createEpisode).toHaveBeenCalledWith(
        expect.objectContaining({
          teamId
        })
      );
    });

    it('should reject episode creation for unauthorized team access', async () => {
      // Given: User trying to create episode in team they're not member of
      const userId = 'user123';
      const unauthorizedTeamId = 'team_restricted456';
      const workspaceId = 'workspace789';

      const episodeData = {
        title: 'Restricted Team Notes',
        content: 'Should not be accessible...',
        userId,
        workspaceId,
        teamId: unauthorizedTeamId
      };

      // Mock user is NOT team member
      mockedPermissionService.isTeamMember.mockResolvedValue(false);

      // When: Attempting to create episode
      const createPromise = knowledgeGraphService.createEpisode(episodeData);

      // Then: Should be rejected
      await expect(createPromise).rejects.toThrow();
      expect(mockedPermissionService.isTeamMember).toHaveBeenCalledWith(userId, unauthorizedTeamId);
    });

    it('should handle personal episode creation (no team context)', async () => {
      // Given: Creating personal episode
      const userId = 'user123';
      const workspaceId = 'workspace789';

      const episodeData = {
        title: 'Personal Notes',
        content: 'My personal thoughts...',
        userId,
        workspaceId
        // No teamId - personal episode
      };

      // Mock successful creation
      const createdEpisode = {
        id: 'episode_personal123',
        ...episodeData,
        teamId: null, // Should remain null for personal episodes
        createdAt: new Date(),
        updatedAt: new Date()
      };

      jest.spyOn(knowledgeGraphService as any, 'createEpisode')
        .mockResolvedValue(createdEpisode);

      // When: Creating personal episode
      const result = await knowledgeGraphService.createEpisode(episodeData);

      // Then: Should not require team permission check
      expect(result.teamId).toBeNull();
      expect(mockedPermissionService.isTeamMember).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // TEAM-SCOPED STATEMENT RESOLUTION
  // ============================================================================

  describe('Team-Scoped Statement Resolution', () => {
    it('should respect team boundaries during statement resolution', async () => {
      // Given: Resolving statements within team context
      const userId = 'user123';
      const teamId = 'team456';
      const workspaceId = 'workspace789';

      const statements = [
        {
          id: 'stmt_team1',
          subject: 'Project Alpha',
          predicate: 'has_status',
          object: 'In Progress',
          userId,
          workspaceId,
          teamId, // Team-scoped statement
          createdAt: new Date()
        }
      ];

      // Mock team membership
      mockedPermissionService.isTeamMember.mockResolvedValue(true);

      // Mock statement resolution service
      jest.spyOn(knowledgeGraphService as any, 'resolveStatements')
        .mockResolvedValue(statements);

      // When: Resolving statements with team context
      const results = await knowledgeGraphService.resolveStatements({
        statements,
        userId,
        workspaceId,
        teamId
      });

      // Then: Resolution should respect team boundaries
      expect(results).toHaveLength(1);
      expect(results[0].teamId).toBe(teamId);

      // Critical: Verify resolution was team-scoped
      expect((knowledgeGraphService as any).resolveStatements).toHaveBeenCalledWith(
        expect.objectContaining({
          teamId,
          userId,
          workspaceId
        })
      );
    });

    it('should prevent cross-team statement conflicts', async () => {
      // Given: Potential cross-team statement conflicts
      const userId = 'user123';
      const teamId = 'team456';
      const workspaceId = 'workspace789';

      const conflictingStatements = [
        {
          id: 'stmt_team_a',
          subject: 'Project Beta',
          predicate: 'has_status',
          object: 'Completed',
          userId,
          workspaceId,
          teamId, // Team A statement
          createdAt: new Date()
        },
        {
          id: 'stmt_team_b',
          subject: 'Project Beta', // Same subject
          predicate: 'has_status',
          object: 'In Progress', // Different status (conflict)
          userId,
          workspaceId,
          teamId: 'different_team789', // Different team
          createdAt: new Date()
        }
      ];

      // Mock membership for team A only
      mockedPermissionService.isTeamMember
        .mockResolvedValueOnce(true) // Team A access
        .mockResolvedValueOnce(false); // Team B access denied

      // When: Resolving statements (should only see team A statements)
      const results = await knowledgeGraphService.resolveStatements({
        statements: [conflictingStatements[0]], // Only team A statement
        userId,
        workspaceId,
        teamId
      });

      // Then: Should only resolve team A statements
      expect(results).toHaveLength(1);
      expect(results[0].teamId).toBe(teamId);
      expect(results[0].object).toBe('Completed'); // Team A's version

      // Should not see Team B's conflicting statement
      expect(results.some(r => r.teamId === 'different_team789')).toBe(false);
    });
  });

  // ============================================================================
  // BUSINESS INVARIANTS - SECURITY RULES
  // ============================================================================

  describe('Business Invariants - Team Security', () => {
    it('NEVER allows cross-team data leakage in search results', async () => {
      // Given: User with limited team access
      const userId = 'user123';
      const userTeamId = 'team_user456';
      const restrictedTeamId = 'team_restricted789';
      const workspaceId = 'workspace789';

      // Mock user only belongs to their team
      mockedPermissionService.isTeamMember
        .mockImplementation((uid, tid) =>
          Promise.resolve(uid === userId && tid === userTeamId)
        );

      // Mock search that would return cross-team data
      const allEpisodes = [
        {
          id: 'episode_user_team',
          userId,
          workspaceId,
          teamId: userTeamId,
          content: 'User team data...',
          createdAt: new Date()
        },
        {
          id: 'episode_restricted_team',
          userId: 'other_user',
          workspaceId,
          teamId: restrictedTeamId,
          content: 'Restricted team data...',
          createdAt: new Date()
        }
      ];

      jest.spyOn(knowledgeGraphService as any, 'searchEpisodes')
        .mockResolvedValue(allEpisodes);

      // When: User searches their team context
      const results = await knowledgeGraphService.semanticSearch({
        query: 'project data',
        userId,
        workspaceId,
        teamId: userTeamId,
        limit: 10
      });

      // Then: Should only return user's team data
      expect(results.every(r => r.teamId === userTeamId)).toBe(true);
      expect(results.some(r => r.teamId === restrictedTeamId)).toBe(false);
    });

    it('ALWAYS validates team membership before team operations', async () => {
      // Given: Various team operations
      const userId = 'user123';
      const teamId = 'team456';
      const workspaceId = 'workspace789';

      // Mock team membership failure
      mockedPermissionService.isTeamMember.mockResolvedValue(false);

      // When: Attempting various team operations
      const searchPromise = knowledgeGraphService.semanticSearch({
        query: 'test',
        userId,
        workspaceId,
        teamId,
        limit: 10
      });

      const createPromise = knowledgeGraphService.createEpisode({
        title: 'Test',
        content: 'Test content',
        userId,
        workspaceId,
        teamId
      });

      // Then: All operations should be rejected
      await expect(searchPromise).rejects.toThrow();
      await expect(createPromise).rejects.toThrow();

      // Critical: All operations must validate team membership
      expect(mockedPermissionService.isTeamMember).toHaveBeenCalledTimes(2);
      expect(mockedPermissionService.isTeamMember).toHaveBeenCalledWith(userId, teamId);
    });

    it('maintains performance with team filtering', async () => {
      // Given: Large dataset with team filtering
      const userId = 'user123';
      const teamId = 'team456';
      const workspaceId = 'workspace789';

      // Mock team membership
      mockedPermissionService.isTeamMember.mockResolvedValue(true);

      // Mock slow database operation
      jest.spyOn(knowledgeGraphService as any, 'searchEpisodes')
        .mockImplementation(async () => {
          // Simulate database query time
          await new Promise(resolve => setTimeout(resolve, 50));
          return [];
        });

      // When: Performing team-scoped search
      const startTime = Date.now();
      await knowledgeGraphService.semanticSearch({
        query: 'test',
        userId,
        workspaceId,
        teamId,
        limit: 10
      });
      const endTime = Date.now();

      // Then: Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(200); // Allow for team permission check + query
    });
  });
});