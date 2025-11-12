/*
 * Teams Analytics API TDD Test Suite - CORE Teams MVP
 *
 * COMPREHENSIVE TEST-DRIVEN DEVELOPMENT SUITE FOR GET /api/v1/teams/:teamId/analytics
 *
 * These tests define HOW the Analytics API MUST behave before implementing the endpoint.
 * They follow strict TDD principles: Tests First, Requirements Definition, Edge Cases Coverage.
 *
 * CRITICAL: These tests WILL FAIL initially, as the endpoint doesn't exist yet.
 *
 * PRINCIPLES:
 * 1. Business intelligence over raw data counts
 * 2. Security-first testing (non-members should NEVER see analytics)
 * 3. Real-world analytics scenarios for enterprise teams
 * 4. Performance requirements (analytics must be fast)
 * 5. Data accuracy validation
 * 6. Response format and caching validation
 */

// Mock all dependencies BEFORE any imports to avoid hoisting issues
jest.mock('../../app/db.server');
jest.mock('../../app/services/permission.server');
jest.mock('../../app/utils/rate-limit.server');
jest.mock('../../app/services/audit.service');
jest.mock('../../app/utils/team-permissions.server', () => ({
  requireTeamMember: jest.fn(),
  requireTeamAdmin: jest.fn(),
  requireTeamOwner: jest.fn(),
  requireSpaceReadAccess: jest.fn(),
  requireSpaceWriteAccess: jest.fn(),
  requireSpaceAdminAccess: jest.fn(),
}));

// Mock Analytics Service
jest.mock('../../app/services/analytics.server', () => ({
  AnalyticsService: {
    getTeamOverview: jest.fn(),
    getMemberMetrics: jest.fn(),
    getSpaceMetrics: jest.fn(),
    getEngagementMetrics: jest.fn(),
    getContentMetrics: jest.fn(),
    getBusinessIntelligence: jest.fn(),
  },
}));

// Mock Remix modules
jest.mock('@remix-run/node', () => ({
  json: jest.fn((data: any, init?: any) => {
    const response = {
      status: init?.status || 200,
      json: jest.fn().mockResolvedValue(data),
    };
    return response;
  }),
}));

// Import after mocking
import { mockPrisma } from '../../__mocks__/database';
import { permissionService } from '../../app/services/permission.server';
import { checkRateLimit } from '../../app/utils/rate-limit.server';
import { AuditService } from '../../app/services/audit.service';
import { json } from '@remix-run/node';
import { requireTeamMember } from '../../app/utils/team-permissions.server';

// Import route handler after mocks - this will fail initially since route doesn't exist
let analyticsRouteModule: any;
let AnalyticsService: any;

beforeAll(async () => {
  // Dynamic import to avoid TypeScript compilation issues
  analyticsRouteModule = await import('../../app/routes/api.v1.teams.$teamId.analytics');
  AnalyticsService = (await import('../../app/services/analytics.server')).AnalyticsService;
});

const mockedPermissionService = permissionService as jest.Mocked<typeof permissionService>;
const mockedCheckRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;
const mockedAuditService = AuditService as jest.Mocked<typeof AuditService>;
const mockedRequireTeamMember = requireTeamMember as jest.MockedFunction<typeof requireTeamMember>;

// ============================================================================
// MOCK DATA FACTORIES - Realistic Test Data for Analytics
// ============================================================================

interface MockUser {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  lastLoginAt?: Date;
}

interface MockWorkspace {
  id: string;
  name: string;
  slug: string;
  userId: string;
  createdAt: Date;
}

interface MockTeam {
  id: string;
  name: string;
  slug: string;
  description?: string;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface MockTeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  createdAt: Date;
  lastActiveAt?: Date;
}

interface MockSpace {
  id: string;
  name: string;
  slug: string;
  description?: string;
  visibility: 'PRIVATE' | 'TEAM' | 'WORKSPACE';
  teamId?: string;
  workspaceId: string;
  contextCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

interface MockConversation {
  id: string;
  userId: string;
  workspaceId?: string;
  title?: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

interface MockActivity {
  id: string;
  text: string;
  workspaceId: string;
  createdAt: Date;
  integrationAccountId?: string;
}

interface MockRecallLog {
  id: string;
  userId: string;
  workspaceId?: string;
  accessType: string;
  query?: string;
  targetType?: string;
  resultCount: number;
  responseTimeMs?: number;
  createdAt: Date;
}

class AnalyticsTestDataFactory {
  static createUser(overrides: Partial<MockUser> = {}): MockUser {
    const now = new Date();
    return {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      email: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}@example.com`,
      name: 'Test User',
      createdAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      ...overrides,
    };
  }

  static createWorkspace(overrides: Partial<MockWorkspace> = {}): MockWorkspace {
    const now = new Date();
    return {
      id: `workspace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: 'Acme Workspace',
      slug: 'acme-workspace',
      userId: `user_${Date.now()}`,
      createdAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
      ...overrides,
    };
  }

  static createTeam(overrides: Partial<MockTeam> = {}): MockTeam {
    const now = new Date();
    return {
      id: `team_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: 'Engineering Team',
      slug: 'engineering',
      description: 'Core engineering team',
      workspaceId: `workspace_${Date.now()}`,
      createdAt: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
      updatedAt: now,
      ...overrides,
    };
  }

  static createTeamMember(overrides: Partial<MockTeamMember> = {}): MockTeamMember {
    const now = new Date();
    return {
      id: `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      teamId: `team_${Date.now()}`,
      userId: `user_${Date.now()}`,
      role: 'MEMBER',
      createdAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      lastActiveAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      ...overrides,
    };
  }

  static createSpace(overrides: Partial<MockSpace> = {}): MockSpace {
    const now = new Date();
    return {
      id: `space_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: 'Test Space',
      slug: 'test-space',
      description: 'Test space description',
      visibility: 'TEAM',
      teamId: `team_${Date.now()}`,
      workspaceId: `workspace_${Date.now()}`,
      contextCount: Math.floor(Math.random() * 100),
      createdAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
      updatedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      ...overrides,
    };
  }

  static createConversation(overrides: Partial<MockConversation> = {}): MockConversation {
    const now = new Date();
    return {
      id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: `user_${Date.now()}`,
      workspaceId: `workspace_${Date.now()}`,
      title: 'Test Conversation',
      status: 'completed',
      createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      updatedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      ...overrides,
    };
  }

  static createActivity(overrides: Partial<MockActivity> = {}): MockActivity {
    const now = new Date();
    return {
      id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text: 'Sample activity text',
      workspaceId: `workspace_${Date.now()}`,
      createdAt: new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random within 30 days
      ...overrides,
    };
  }

  static createRecallLog(overrides: Partial<MockRecallLog> = {}): MockRecallLog {
    const now = new Date();
    return {
      id: `recall_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: `user_${Date.now()}`,
      workspaceId: `workspace_${Date.now()}`,
      accessType: 'search',
      query: 'test query',
      targetType: 'episode',
      resultCount: Math.floor(Math.random() * 20),
      responseTimeMs: Math.floor(Math.random() * 500) + 100,
      createdAt: new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Random within 7 days
      ...overrides,
    };
  }

  // Helper to create date ranges for analytics
  static createDateRange(daysAgo: number): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    return { start, end: now };
  }

  // Helper to create growth data
  static createGrowthData(baseValue: number, growthRate: number, periods: number): number[] {
    const data: number[] = [];
    let current = baseValue;
    for (let i = 0; i < periods; i++) {
      data.push(Math.floor(current));
      current *= (1 + growthRate);
    }
    return data;
  }
}

// Mock request/response helpers
const createMockRequest = (params: any = {}, authentication: any = {}) => ({
  json: async () => ({}),
  text: async () => JSON.stringify({}),
  headers: new Headers({ 'content-type': 'application/json' }),
  signal: new AbortController().signal,
  method: 'GET',
  url: `http://localhost:3000/api/v1/teams/${params.teamId}/analytics`,
  params,
  authentication,
});

const createMockAuthentication = (userId: string) => ({
  userId,
  type: 'pat',
});

// ============================================================================
// SETUP AND TEARDOWN
// ============================================================================

describe('GET /api/v1/teams/:teamId/analytics - Teams Analytics API TDD Suite', () => {
  let testUser: MockUser;
  let testWorkspace: MockWorkspace;
  let testTeam: MockTeam;
  let teamMember: MockTeamMember;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup default test data
    testUser = AnalyticsTestDataFactory.createUser();
    testWorkspace = AnalyticsTestDataFactory.createWorkspace({ userId: testUser.id });
    testTeam = AnalyticsTestDataFactory.createTeam({ workspaceId: testWorkspace.id });
    teamMember = AnalyticsTestDataFactory.createTeamMember({
      teamId: testTeam.id,
      userId: testUser.id
    });

    // Setup default rate limit mock
    mockedCheckRateLimit.mockResolvedValue();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  // ============================================================================
  // CORE TEAM METRICS - Foundation Analytics
  // ============================================================================

  describe('Core Team Metrics Analytics', () => {
    it('should return comprehensive team overview metrics', async () => {
      // Given: Team with members and spaces
      const teamMembers = [
        AnalyticsTestDataFactory.createTeamMember({
          teamId: testTeam.id,
          userId: testUser.id,
          role: 'OWNER',
          lastActiveAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
        }),
        AnalyticsTestDataFactory.createTeamMember({
          teamId: testTeam.id,
          role: 'ADMIN',
          lastActiveAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
        }),
        AnalyticsTestDataFactory.createTeamMember({
          teamId: testTeam.id,
          role: 'MEMBER',
          lastActiveAt: new Date(Date.now() - 7 * 24 * 60 * 1000) // 7 days ago
        }),
      ];

      const spaces = [
        AnalyticsTestDataFactory.createSpace({
          teamId: testTeam.id,
          workspaceId: testWorkspace.id,
          contextCount: 50,
          visibility: 'TEAM'
        }),
        AnalyticsTestDataFactory.createSpace({
          teamId: testTeam.id,
          workspaceId: testWorkspace.id,
          contextCount: 25,
          visibility: 'PRIVATE'
        }),
      ];

      // Mock dependencies
      mockedRequireTeamMember.mockResolvedValue({
        user: testUser,
        teamId: testTeam.id,
        membership: teamMembers[0]
      });

      // Mock Analytics Service responses
      AnalyticsService.getTeamOverview.mockResolvedValue({
        totalMembers: 3,
        activeMembers: 2,
        inactiveMembers: 1,
        totalSpaces: 2,
        teamAge: 45,
        teamName: testTeam.name,
        createdAt: testTeam.createdAt,
      });

      AnalyticsService.getMemberMetrics.mockResolvedValue({
        ownerCount: 1,
        adminCount: 1,
        memberCount: 1,
        roleDistribution: {
          OWNER: 1,
          ADMIN: 1,
          MEMBER: 1,
        },
        totalConversations: 0,
        averageConversationsPerMember: 0,
        topContributors: [],
      });

      AnalyticsService.getSpaceMetrics.mockResolvedValue({
        teamSpaces: 1,
        privateSpaces: 1,
        workspaceSpaces: 0,
        totalContextItems: 75,
        averageContextPerSpace: 37.5,
        mostActiveSpaces: [],
      });

      const request = createMockRequest({ teamId: testTeam.id }, createMockAuthentication(testUser.id));

      // When: Requesting team analytics
      const response = await analyticsRouteModule.loader({
        request,
        params: { teamId: testTeam.id }
      });

      // Then: Should return comprehensive metrics
      const responseData = await response.json();
      expect(response.status).toBe(200);

      expect(responseData).toMatchObject({
        analytics: {
          overview: {
            totalMembers: 3,
            activeMembers: 2, // Members active in last 7 days
            inactiveMembers: 1,
            totalSpaces: 2,
            teamAge: expect.any(Number), // Days since team creation
          },
          memberMetrics: {
            ownerCount: 1,
            adminCount: 1,
            memberCount: 1,
            roleDistribution: {
              OWNER: 1,
              ADMIN: 1,
              MEMBER: 1,
            },
          },
          spaceMetrics: {
            teamSpaces: 1,
            privateSpaces: 1,
            totalContextItems: 75, // 50 + 25
            averageContextPerSpace: 37.5,
          },
        },
        meta: {
          responseTimeMs: expect.any(Number),
          cached: expect.any(Boolean),
        }
      });

      // And: Should validate performance requirements
      expect(responseData.meta.responseTimeMs).toBeLessThan(1000); // Must be under 1s
    });
  });

  // ============================================================================
  // PERMISSION AND SECURITY - Access Control Testing
  // ============================================================================

  describe('Permission and Security', () => {
    it('should reject analytics access for non-team members', async () => {
      // Given: User is not a team member
      mockedRequireTeamMember.mockRejectedValue(
        new Error('Access denied: User is not a team member')
      );

      const request = createMockRequest({ teamId: testTeam.id }, createMockAuthentication(testUser.id));

      // When: Non-member tries to access analytics
      const response = await analyticsRouteModule.loader({
        request,
        params: { teamId: testTeam.id }
      });

      // Then: Should be rejected with proper error
      expect(response.status).toBe(403);
      const responseData = await response.json();
      expect(responseData.error.toLowerCase()).toContain('access denied');
    });

    it('should allow analytics access for all team members regardless of role', async () => {
      // Given: User is a regular team member
      const member = AnalyticsTestDataFactory.createTeamMember({
        teamId: testTeam.id,
        userId: testUser.id,
        role: 'MEMBER'
      });

      mockedRequireTeamMember.mockResolvedValue({
        user: testUser,
        teamId: testTeam.id,
        membership: member
      });
      mockPrisma.team.findUnique.mockResolvedValue({
        ...testTeam,
        workspace: testWorkspace,
      });

      const request = createMockRequest({ teamId: testTeam.id }, createMockAuthentication(testUser.id));

      // When: Regular member requests analytics
      const response = await analyticsRouteModule.loader({
        request,
        params: { teamId: testTeam.id }
      });

      // Then: Should allow access
      expect(response.status).toBe(200);
      const responseData = await response.json();
      expect(responseData.analytics).toBeDefined();
    });
  });

  // ============================================================================
  // PERFORMANCE METRICS - System Health Analytics
  // ============================================================================

  describe('Performance Metrics', () => {
    it('should track API response times and system performance', async () => {
      // Given: System with performance tracking data
      mockedRequireTeamMember.mockResolvedValue({
        user: testUser,
        teamId: testTeam.id,
        membership: teamMember
      });

      const request = createMockRequest({ teamId: testTeam.id }, createMockAuthentication(testUser.id));

      // When: Requesting performance analytics
      const startTime = Date.now();
      const response = await analyticsRouteModule.loader({
        request,
        params: { teamId: testTeam.id }
      });
      const endTime = Date.now();

      // Then: Should include performance metrics in response
      expect(response.status).toBe(200);

      const responseData = await response.json();
      expect(responseData.meta).toMatchObject({
        responseTimeMs: expect.any(Number),
        cached: expect.any(Boolean),
        timestamp: expect.any(String),
        version: expect.any(String),
      });

      // And: Should meet performance requirements
      expect(responseData.meta.responseTimeMs).toBeLessThan(1000); // Under 1 second
      expect(endTime - startTime).toBeLessThan(1200); // Include some margin
    });
  });

  // ============================================================================
  // SYSTEM INVARIANTS - Rules That Must Never Be Broken
  // ============================================================================

  describe('System invariants - critical rules that must never be broken', () => {
    it('NEVER allow analytics access without team membership', async () => {
      // Given: Valid request but user is not team member
      mockedRequireTeamMember.mockRejectedValue(
        new Error('Access denied: User is not a team member')
      );

      const request = createMockRequest({ teamId: testTeam.id }, createMockAuthentication(testUser.id));

      // When: Non-member tries to access analytics
      const response = await analyticsRouteModule.loader({
        request,
        params: { teamId: testTeam.id }
      });

      // Then: Must always be rejected
      expect(response.status).toBe(403);

      // And: No analytics data should be returned
      const responseData = await response.json();
      expect(responseData.analytics).toBeUndefined();
      expect(responseData.error).toBeDefined();
    });

    it('ALWAYS include performance metadata in response', async () => {
      // Given: Valid analytics request
      mockedRequireTeamMember.mockResolvedValue({
        user: testUser,
        teamId: testTeam.id,
        membership: teamMember
      });
      mockPrisma.team.findUnique.mockResolvedValue({
        ...testTeam,
        workspace: testWorkspace,
      });

      const request = createMockRequest({ teamId: testTeam.id }, createMockAuthentication(testUser.id));

      // When: Requesting analytics
      const response = await analyticsRouteModule.loader({
        request,
        params: { teamId: testTeam.id }
      });

      // Then: Must always include metadata
      expect(response.status).toBe(200);
      const responseData = await response.json();

      expect(responseData.meta).toBeDefined();
      expect(responseData.meta.responseTimeMs).toBeDefined();
      expect(responseData.meta.timestamp).toBeDefined();
      expect(responseData.meta.version).toBeDefined();
      expect(responseData.meta.cached).toBeDefined();
    });

    it('MUST meet performance requirements (under 1 second)', async () => {
      // Given: Valid analytics request
      mockedRequireTeamMember.mockResolvedValue({
        user: testUser,
        teamId: testTeam.id,
        membership: teamMember
      });
      mockPrisma.team.findUnique.mockResolvedValue({
        ...testTeam,
        workspace: testWorkspace,
      });

      const request = createMockRequest({ teamId: testTeam.id }, createMockAuthentication(testUser.id));

      // When: Requesting analytics
      const startTime = Date.now();
      const response = await analyticsRouteModule.loader({
        request,
        params: { teamId: testTeam.id }
      });
      const endTime = Date.now();

      // Then: Must meet performance requirements
      expect(response.status).toBe(200);
      const responseData = await response.json();

      expect(responseData.meta.responseTimeMs).toBeLessThan(1000);
      expect(endTime - startTime).toBeLessThan(1200); // Include some margin
    });
  });
});