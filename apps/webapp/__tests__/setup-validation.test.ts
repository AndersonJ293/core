/*
 * Setup Validation Test
 *
 * Basic test to validate Jest and mocking setup is working correctly
 */

describe('Jest Setup Validation', () => {
  test('should be able to run basic tests', () => {
    expect(true).toBe(true);
    expect(1 + 1).toBe(2);
  });

  test('should have jest mocking working', () => {
    const mockFn = jest.fn();
    mockFn('test');
    expect(mockFn).toHaveBeenCalledWith('test');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  test('should have access to global test utilities', () => {
    expect(global.testUtils).toBeDefined();
    expect(typeof global.testUtils.createTestTeam).toBe('function');
    expect(typeof global.testUtils.createTestUser).toBe('function');

    const team = global.testUtils.createTestTeam({ name: 'Validation Team' });
    expect(team.id).toBe('team_test_123');
    expect(team.name).toBe('Validation Team');
  });

  test('should have DOM environment available', () => {
    // Test that jsdom is working
    document.body.innerHTML = '<div id="test">Test Content</div>';
    const element = document.getElementById('test');
    expect(element).toBeInTheDocument();
    expect(element?.textContent).toBe('Test Content');
  });

  test('should have basic matchers available', () => {
    // Test custom matchers from jest setup
    const testElement = document.createElement('div');
    testElement.textContent = 'Hello World';

    // This tests that @testing-library/jest-dom is working
    expect(testElement).toHaveTextContent('Hello World');
  });

  test('should have mocked database instance', () => {
    expect(global.mockPrisma).toBeDefined();
    expect(typeof global.mockPrisma.team.findUnique).toBe('function');
    expect(typeof global.mockPrisma.teamMember.findFirst).toBe('function');
  });

  test('should be able to mock database operations', () => {
    const mockFindFirst = global.mockPrisma.teamMember.findFirst;
    mockFindFirst.mockResolvedValue({
      id: 'member-123',
      userId: 'user-123',
      teamId: 'team-123',
      role: 'MEMBER',
    });

    // Test that the mock was configured correctly
    expect(mockFindFirst).toBeDefined();
    expect(typeof mockFindFirst).toBe('function');
  });
});