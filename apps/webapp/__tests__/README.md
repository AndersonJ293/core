# CORE Teams MVP - Test Infrastructure

Enterprise-grade testing setup for the CORE Teams MVP feature.

## 🚀 Overview

This test suite provides comprehensive testing capabilities for the CORE Teams MVP, including:

- **Unit Tests**: Service-level testing with realistic mocks
- **Integration Tests**: Component and workflow testing
- **E2E Tests**: Full user journey testing with Playwright
- **Coverage Reports**: Detailed code coverage analysis

## 📁 Structure

```
__tests__/
├── unit/                    # Unit tests for services and utilities
│   └── permission.service.test.ts
├── integration/             # Integration tests for components
├── e2e/                     # End-to-end tests with Playwright
│   ├── teams-basic.spec.ts
│   ├── global-setup.ts
│   └── global-teardown.ts
├── helpers/                 # Test utilities and helpers
│   └── test-utils.tsx
├── fixtures/                # Test data fixtures
└── setup-validation.test.ts # Setup validation
```

## 🔧 Configuration

### Jest Configuration

- **Main Config**: `jest.config.cjs` - Production-ready Jest configuration
- **Setup**: `jest.setup.cjs` - Global test setup and mocks
- **Mock Setup**: `__mocks__/setup.js` - Comprehensive mock configuration

### Playwright Configuration

- **Config**: `playwright.config.ts` - E2E testing configuration
- **Setup**: `__tests__/e2e/global-setup.ts` - Global E2E setup
- **Teardown**: `__tests__/e2e/global-teardown.ts` - Global E2E cleanup

## 🧪 Running Tests

### Unit Tests

```bash
# Run all unit tests
pnpm test:unit

# Run specific unit test
pnpm test __tests__/unit/permission.service.test.ts

# Run with coverage
pnpm test:coverage
```

### Integration Tests

```bash
# Run all integration tests
pnpm test:integration

# Run specific integration test
pnpm test __tests__/integration/some-integration.test.ts
```

### End-to-End Tests

```bash
# Install Playwright browsers (first time only)
pnpm test:e2e:install

# Run all E2E tests
pnpm test:e2e

# Run E2E tests with visible browser
pnpm test:e2e:headed

# Debug E2E tests
pnpm test:e2e:debug

# View E2E test report
pnpm test:e2e:report
```

### All Tests

```bash
# Run all tests (unit + integration)
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage report
pnpm test:coverage
```

## 🎯 Test Types

### 1. Unit Tests (`__tests__/unit/`)

Focus on testing individual services and functions in isolation:

- **PermissionService**: Tests team permissions, space access, and user roles
- **Service Methods**: Database interactions, business logic
- **Utility Functions**: Helper functions, transformations

**Example**:
```typescript
// Testing PermissionService.isTeamMember
test('should return true for active team member', async () => {
  const member = createTestTeamMember({ userId, teamId });
  mockTeamMembership(member);

  const result = await permissionService.isTeamMember(userId, teamId);

  expect(result).toBe(true);
});
```

### 2. Integration Tests (`__tests__/integration/`)

Test how components and services work together:

- **React Components**: UI rendering and user interactions
- **API Routes**: Request/response handling
- **Data Flow**: Service integration patterns

### 3. E2E Tests (`__tests__/e2e/`)

Full user journey testing with real browser automation:

- **Team Creation**: Creating and managing teams
- **Permission Workflows**: User access control
- **UI Navigation**: Routing and page rendering
- **Responsive Design**: Mobile and desktop layouts

**Example**:
```typescript
test('should render teams page correctly', async ({ page }) => {
  await page.goto('/home/teams');

  await expect(page.locator('h1')).toContainText('Teams');
  await expect(page.locator('[data-testid="create-team-button"]')).toBeVisible();
});
```

## 🎛️ Mocking Strategy

### Database Mocking

Comprehensive mocking for all database operations:

```typescript
// Global mock instance available in tests
global.mockPrisma.team.findUnique.mockResolvedValue(mockTeamData);
global.mockPrisma.teamMember.findFirst.mockResolvedValue(mockMemberData);
```

### Service Mocking

Mocks for external dependencies:

- **Neo4j**: Knowledge graph database operations
- **Redis**: Caching and session management
- **Logger**: Application logging
- **Auth**: Authentication and authorization

### Environment Variables

Test environment automatically configured with mock values:

```typescript
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/core_test';
// ... other environment variables
```

## 📊 Coverage Reports

Coverage reports are generated in the `coverage/` directory:

- **HTML Report**: Open `coverage/lcov-report/index.html`
- **Text Report**: Console output
- **LCOV Format**: For CI/CD integration

**Coverage Thresholds**:
- **Branches**: 70%
- **Functions**: 75%
- **Lines**: 75%
- **Statements**: 75%

## 🐛 Debugging Tests

### Unit Tests

```bash
# Run with verbose output
pnpm test --verbose

# Run specific test with debug output
DEBUG=* pnpm test specific.test.ts
```

### E2E Tests

```bash
# Run with visible browser for debugging
pnpm test:e2e:headed

# Run in debug mode with pause points
pnpm test:e2e:debug

# Run with trace files for detailed debugging
npx playwright test --trace on
```

## 🚨 Test Patterns

### Critical Bug Detection

Tests are designed to **expose real bugs** in the system:

1. **Permission Logic**: Tests for role-based access control vulnerabilities
2. **Data Validation**: Tests for missing validation and edge cases
3. **Error Handling**: Tests for proper error responses and recovery
4. **Performance**: Tests for slow operations and memory leaks

### Example Bug Detection

```typescript
test('should demonstrate bug in canPerformTeamAction', async () => {
  // Mock admin member
  mockTeamMember({ role: 'ADMIN' });

  const canEdit = await permissionService.canPerformTeamAction(userId, teamId, 'edit');

  // This exposes a bug: admins should be able to edit
  expect(canEdit).toBe(false); // BUG: This should be true!
});
```

## 🔄 Continuous Integration

The test suite is optimized for CI/CD pipelines:

- **Fast Execution**: Parallel test execution with optimized timeouts
- **Coverage Reports**: Automatic generation and upload
- **Test Reports**: JUnit XML format for test result aggregation
- **Environment Detection**: Optimized configurations for different environments

### CI Commands

```bash
# Full test suite for CI
pnpm test:coverage

# E2E tests for CI
pnpm test:e2e --reporter=junit --reporter=html
```

## 🛠️ Development Workflow

### Adding New Tests

1. **Unit Tests**: Add to `__tests__/unit/`
2. **Integration Tests**: Add to `__tests__/integration/`
3. **E2E Tests**: Add to `__tests__/e2e/`

### Test Utilities

Use the provided test utilities:

```typescript
import {
  MockDataFactory,
  MockSetup,
  ServiceTestUtils,
  renderWithProviders,
} from '../helpers/test-utils';

// Create test data
const team = MockDataFactory.createTeam();
const user = MockDataFactory.createUser();

// Setup mocks
MockSetup.mockTeamMembership(teamMember);

// Test services
await ServiceTestUtils.testServiceMethod(
  () => permissionService.isTeamMember(userId, teamId),
  true,
  () => mockTeamMember(teamMember)
);
```

## 📝 Best Practices

### Unit Tests

- **Test Behavior**: Test what the code does, not how it does it
- **Use Realistic Data**: Mock data should match production data structures
- **Test Edge Cases**: Include null, undefined, and error scenarios
- **Keep Tests Focused**: One test should verify one behavior

### Integration Tests

- **Test Integration Points**: Focus on how components interact
- **Use Real Dependencies**: Where possible, use real implementations
- **Mock External Services**: Mock external APIs and databases
- **Test Error Flows**: Verify error handling and recovery

### E2E Tests

- **Test User Journeys**: Focus on complete user workflows
- **Use Page Objects**: Organize selectors and interactions
- **Wait for Elements**: Use proper wait strategies
- **Test Multiple Viewports**: Verify responsive behavior

## 🔧 Troubleshooting

### Common Issues

1. **Module Resolution**: Check `moduleNameMapper` in Jest config
2. **Mock Configuration**: Verify mocks in `__mocks__/setup.js`
3. **Environment Variables**: Ensure test environment is configured
4. **Timeout Issues**: Adjust `testTimeout` in Jest config

### Debug Commands

```bash
# Check Jest configuration
./node_modules/.bin/jest --showConfig

# Validate E2E setup
npx playwright test --list

# Check test coverage
pnpm test:coverage --coverageReporters=text-lcov
```

## 📚 Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Testing Library](https://testing-library.com/docs)
- [CORE Architecture Guide](../../../CLAUDE.md)

---

## ✅ Validation

To validate the test setup is working correctly:

```bash
# Run setup validation test
pnpm test __tests__/setup-validation.test.ts

# All tests should pass:
# ✓ Jest mocking working
# ✓ DOM environment available
# ✓ Database mocks configured
# ✓ Global utilities available
```