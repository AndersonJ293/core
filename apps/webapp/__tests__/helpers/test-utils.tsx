/*
 * Test Utilities for CORE Teams MVP Testing
 *
 * Provides comprehensive helper functions for testing React components,
 * services, and API routes in the CORE application
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'remix-themes';
import { PrismaClient } from '@core/database';
import { mockPrisma } from '../../__mocks__/database';

// Custom render function with providers
interface AllTheProvidersProps {
  children: React.ReactNode;
  initialEntries?: string[];
  theme?: 'light' | 'dark';
}

const AllTheProviders: React.FC<AllTheProvidersProps> = ({
  children,
  initialEntries = ['/'],
  theme = 'light'
}) => {
  return (
    <ThemeProvider specifiedTheme={theme} themeAction="set">
      <MemoryRouter initialEntries={initialEntries}>
        {children}
      </MemoryRouter>
    </ThemeProvider>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & {
    initialEntries?: string[];
    theme?: 'light' | 'dark';
  }
) => {
  const { initialEntries, theme, ...renderOptions } = options || {};

  return render(ui, {
    wrapper: ({ children }) => (
      <AllTheProviders
        initialEntries={initialEntries}
        theme={theme}
      >
        {children}
      </AllTheProviders>
    ),
    ...renderOptions,
  });
};

// Mock data factories
export class MockDataFactory {
  static createTeam(overrides: Partial<any> = {}) {
    return {
      id: `team_${Date.now()}`,
      name: 'Test Team',
      description: 'A test team',
      workspaceId: `workspace_${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      deleted: null,
      ...overrides,
    };
  }

  static createTeamMember(overrides: Partial<any> = {}) {
    return {
      id: `member_${Date.now()}`,
      userId: `user_${Date.now()}`,
      teamId: `team_${Date.now()}`,
      role: 'MEMBER',
      createdAt: new Date(),
      updatedAt: new Date(),
      deleted: null,
      ...overrides,
    };
  }

  static createSpace(overrides: Partial<any> = {}) {
    return {
      id: `space_${Date.now()}`,
      name: 'Test Space',
      description: 'A test space',
      visibility: 'TEAM',
      workspaceId: `workspace_${Date.now()}`,
      teamId: `team_${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      deleted: null,
      ...overrides,
    };
  }

  static createUser(overrides: Partial<any> = {}) {
    return {
      id: `user_${Date.now()}`,
      name: 'Test User',
      email: `test${Date.now()}@example.com`,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  static createWorkspace(overrides: Partial<any> = {}) {
    return {
      id: `workspace_${Date.now()}`,
      name: 'Test Workspace',
      userId: `user_${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }
}

// Mock setup utilities
export class MockSetup {
  static setupPrismaMock() {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mock implementations
    mockPrisma.team.findUnique.mockResolvedValue(null);
    mockPrisma.team.findMany.mockResolvedValue([]);
    mockPrisma.teamMember.findFirst.mockResolvedValue(null);
    mockPrisma.teamMember.findMany.mockResolvedValue([]);
    mockPrisma.space.findUnique.mockResolvedValue(null);
    mockPrisma.space.findMany.mockResolvedValue([]);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.workspace.findUnique.mockResolvedValue(null);
  }

  static mockSuccessfulTeamCreation(team: any) {
    mockPrisma.team.create.mockResolvedValue(team);
    mockPrisma.team.findUnique.mockResolvedValue(team);
    return team;
  }

  static mockTeamMembership(teamMember: any) {
    mockPrisma.teamMember.findFirst.mockResolvedValue(teamMember);
    mockPrisma.teamMember.findMany.mockResolvedValue([teamMember]);
    return teamMember;
  }

  static mockSpaceAccess(space: any) {
    mockPrisma.space.findUnique.mockResolvedValue(space);
    return space;
  }

  static mockUserTeams(teams: any[]) {
    mockPrisma.team.findMany.mockResolvedValue(teams);
    return teams;
  }
}

// Service testing utilities
export class ServiceTestUtils {
  static async testServiceMethod<T>(
    serviceMethod: () => Promise<T>,
    expectedValue: T,
    mockSetup: () => void,
    assertions: (result: T) => void = () => {}
  ) {
    // Setup mocks
    mockSetup();

    // Execute service method
    const result = await serviceMethod();

    // Assertions
    expect(result).toBeDefined();
    if (expectedValue !== undefined) {
      expect(result).toEqual(expectedValue);
    }
    assertions(result);

    return result;
  }

  static testServiceError<T>(
    serviceMethod: () => Promise<T>,
    expectedError: string | Error,
    mockSetup: () => void
  ) {
    // Setup mocks
    mockSetup();

    // Execute and expect error
    return expect(serviceMethod()).rejects.toThrow(expectedError);
  }
}

// Permission testing utilities
export class PermissionTestUtils {
  static testTeamPermission = {
    // Test various team membership scenarios
    scenarios: {
      owner: { role: 'OWNER', userId: 'user1', teamId: 'team1' },
      admin: { role: 'ADMIN', userId: 'user1', teamId: 'team1' },
      member: { role: 'MEMBER', userId: 'user1', teamId: 'team1' },
      nonMember: { userId: 'user1', teamId: 'team1' },
    },

    // Expected permission matrix
    expectedPermissions: {
      owner: {
        isTeamMember: true,
        isTeamOwner: true,
        canEdit: true,
        canDelete: true,
        canInvite: true,
        canRemoveMember: true,
      },
      admin: {
        isTeamMember: true,
        isTeamOwner: false,
        canEdit: true,
        canDelete: false,
        canInvite: true,
        canRemoveMember: true,
      },
      member: {
        isTeamMember: true,
        isTeamOwner: false,
        canEdit: false,
        canDelete: false,
        canInvite: false,
        canRemoveMember: false,
      },
      nonMember: {
        isTeamMember: false,
        isTeamOwner: false,
        canEdit: false,
        canDelete: false,
        canInvite: false,
        canRemoveMember: false,
      },
    },

    // Test space visibility scenarios
    spaceScenarios: {
      private: { visibility: 'PRIVATE', isOwner: true },
      team: { visibility: 'TEAM', isTeamMember: true },
      workspace: { visibility: 'WORKSPACE', isWorkspaceMember: true },
      noAccess: { visibility: 'PRIVATE', isOwner: false },
    },
  };
}

// Component testing utilities
export class ComponentTestUtils {
  static renderWithProviders = customRender;

  static waitForComponentToLoad(container: HTMLElement) {
    return new Promise((resolve) => {
      const observer = new MutationObserver(() => {
        if (container.children.length > 0) {
          observer.disconnect();
          resolve(container);
        }
      });
      observer.observe(container, { childList: true, subtree: true });
    });
  }

  static async testAccessibility(component: ReactElement) {
    const { container } = customRender(component);
    // Add axe-core accessibility testing here if needed
    return container;
  }
}

// API testing utilities
export class ApiTestUtils {
  static createMockRequest(body: any = {}, headers: Record<string, string> = {}) {
    return {
      json: async () => body,
      text: async () => JSON.stringify(body),
      headers: new Headers(headers),
      signal: new AbortController().signal,
      method: 'POST',
      url: 'http://localhost:3000/api/test',
    };
  }

  static createMockResponse() {
    const headers = new Headers();
    const body = {
      json: jest.fn().mockResolvedValue({ success: true }),
      text: jest.fn().mockResolvedValue('{"success":true}'),
      status: 200,
      headers,
    };

    return {
      ...body,
      json: body.json,
      text: body.text,
      status: 200,
      headers,
      ok: true,
    };
  }

  static testApiResponse(
    handler: (req: Request) => Promise<Response>,
    requestBody: any,
    expectedResponse: any
  ) {
    const mockRequest = this.createMockRequest(requestBody);
    return expect(handler(mockRequest)).resolves.toMatchObject({
      status: expectedResponse.status || 200,
    });
  }
}

// Integration testing utilities
export class IntegrationTestUtils {
  static async setupTestDatabase() {
    // Mock database setup for integration tests
    MockSetup.setupPrismaMock();

    // Add any test data creation here
    const testUser = MockDataFactory.createUser();
    const testWorkspace = MockDataFactory.createWorkspace({ userId: testUser.id });
    const testTeam = MockDataFactory.createTeam({ workspaceId: testWorkspace.id });
    const testMember = MockDataFactory.createTeamMember({
      userId: testUser.id,
      teamId: testTeam.id,
    });

    return {
      user: testUser,
      workspace: testWorkspace,
      team: testTeam,
      member: testMember,
    };
  }

  static async cleanupTestDatabase() {
    // Clean up database state after tests
    jest.clearAllMocks();
  }
}

// Export all test utilities
export {
  customRender as render,
  MockDataFactory,
  MockSetup,
  ServiceTestUtils,
  PermissionTestUtils,
  ComponentTestUtils,
  ApiTestUtils,
  IntegrationTestUtils,
};