/*
 * PermissionService Dependency Injection Test
 *
 * This test demonstrates that the refactored PermissionService now supports
 * dependency injection, enabling better testability with mocked Prisma clients.
 */

import { PermissionService } from '../../app/services/permission.server';

// Simple mock Prisma client for testing
const createMockPrisma = () => ({
  teamMember: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  team: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  space: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  workspace: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
});

describe('PermissionService - Dependency Injection', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let permissionService: PermissionService;

  beforeEach(() => {
    // Create fresh mock for each test
    mockPrisma = createMockPrisma();

    // Inject mock Prisma client into PermissionService
    permissionService = new PermissionService(mockPrisma);

    // Clear all mocks
    jest.clearAllMocks();
  });

  it('should accept injected Prisma client', () => {
    expect(permissionService).toBeInstanceOf(PermissionService);
  });

  it('should use injected Prisma client for isTeamMember', async () => {
    const userId = 'test-user-123';
    const teamId = 'test-team-456';

    // Mock the Prisma response
    mockPrisma.teamMember.findFirst.mockResolvedValue({
      id: 'member-123',
      userId,
      teamId,
      role: 'MEMBER',
      deleted: null,
    });

    // Call the method
    const result = await permissionService.isTeamMember(userId, teamId);

    // Verify that our injected mock was called, not the real Prisma
    expect(mockPrisma.teamMember.findFirst).toHaveBeenCalledTimes(1);
    expect(mockPrisma.teamMember.findFirst).toHaveBeenCalledWith({
      where: {
        teamId,
        userId,
        deleted: null,
      },
    });

    // Verify result
    expect(result).toBe(true);
  });

  it('should use injected Prisma client for isTeamOwner', async () => {
    const userId = 'owner-user-123';
    const teamId = 'test-team-456';

    // Mock the Prisma response
    mockPrisma.teamMember.findFirst.mockResolvedValue({
      id: 'owner-member-123',
      userId,
      teamId,
      role: 'OWNER',
      deleted: null,
    });

    // Call the method
    const result = await permissionService.isTeamOwner(userId, teamId);

    // Verify that our injected mock was called
    expect(mockPrisma.teamMember.findFirst).toHaveBeenCalledWith({
      where: {
        teamId,
        userId,
        role: 'OWNER',
        deleted: null,
      },
    });

    // Verify result
    expect(result).toBe(true);
  });

  it('should work with different mock data scenarios', async () => {
    const userId = 'test-user-123';
    const teamId = 'test-team-456';

    // Test scenario: User is not a member
    mockPrisma.teamMember.findFirst.mockResolvedValue(null);

    const result = await permissionService.isTeamMember(userId, teamId);

    expect(result).toBe(false);
    expect(mockPrisma.teamMember.findFirst).toHaveBeenCalledTimes(1);
  });

  it('should demonstrate independence between test instances', async () => {
    // Create two separate PermissionService instances with different mocks
    const mockPrisma1 = createMockPrisma();
    const mockPrisma2 = createMockPrisma();

    const service1 = new PermissionService(mockPrisma1);
    const service2 = new PermissionService(mockPrisma2);

    // Configure different responses for each mock
    mockPrisma1.teamMember.findFirst.mockResolvedValue({
      id: 'member-1',
      userId: 'user-1',
      teamId: 'team-1',
      role: 'MEMBER',
      deleted: null,
    });

    mockPrisma2.teamMember.findFirst.mockResolvedValue(null);

    // Test both services independently
    const result1 = await service1.isTeamMember('user-1', 'team-1');
    const result2 = await service2.isTeamMember('user-2', 'team-2');

    // Verify each service used its own mock
    expect(result1).toBe(true);
    expect(result2).toBe(false);
    expect(mockPrisma1.teamMember.findFirst).toHaveBeenCalledTimes(1);
    expect(mockPrisma2.teamMember.findFirst).toHaveBeenCalledTimes(1);
  });
});