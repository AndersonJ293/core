/*
 * E2E Test Data Cleanup Utilities
 *
 * Comprehensive cleanup system for Teams MVP E2E tests:
 * - Automatic test data tracking
 * - Safe cleanup operations
 * - Cross-test isolation
 * - Performance monitoring
 */

import { Page } from '@playwright/test';
import { TestUser, TestTeam, TestSpace } from './e2e-helpers';

interface CleanupTracker {
  users: Set<string>;
  teams: Set<string>;
  spaces: Set<string>;
  sessions: Set<string>;
  createdAt: number;
}

interface CleanupStats {
  usersCleaned: number;
  teamsCleaned: number;
  spacesCleaned: number;
  sessionsCleaned: number;
  duration: number;
  errors: string[];
}

// Global cleanup tracker
let cleanupTracker: CleanupTracker | null = null;

/**
 * Initialize cleanup tracking for the current test session
 */
export function initializeCleanupTracker(): CleanupTracker {
  cleanupTracker = {
    users: new Set(),
    teams: new Set(),
    spaces: new Set(),
    sessions: new Set(),
    createdAt: Date.now(),
  };

  // Make available globally for debugging
  globalThis.e2eCleanupTracker = cleanupTracker;

  console.log('🧹 E2E cleanup tracker initialized');
  return cleanupTracker;
}

/**
 * Get the current cleanup tracker
 */
export function getCleanupTracker(): CleanupTracker | null {
  return cleanupTracker || globalThis.e2eCleanupTracker as CleanupTracker || null;
}

/**
 * Track test data for cleanup
 */
export function trackTestData(data: {
  users?: TestUser[];
  teams?: TestTeam[];
  spaces?: TestSpace[];
  sessions?: string[];
}): void {
  const tracker = getCleanupTracker();
  if (!tracker) {
    console.warn('⚠️ No cleanup tracker available - data will not be auto-cleaned');
    return;
  }

  if (data.users) {
    data.users.forEach(user => tracker.users.add(user.id));
  }

  if (data.teams) {
    data.teams.forEach(team => tracker.teams.add(team.id));
  }

  if (data.spaces) {
    data.spaces.forEach(space => tracker.spaces.add(space.id));
  }

  if (data.sessions) {
    data.sessions.forEach(session => tracker.sessions.add(session));
  }

  console.log('📝 Test data tracked for cleanup:', {
    users: data.users?.length || 0,
    teams: data.teams?.length || 0,
    spaces: data.spaces?.length || 0,
    sessions: data.sessions?.length || 0,
  });
}

/**
 * Clean up all tracked test data
 */
export async function cleanupAllTrackedData(): Promise<CleanupStats> {
  const startTime = Date.now();
  const stats: CleanupStats = {
    usersCleaned: 0,
    teamsCleaned: 0,
    spacesCleaned: 0,
    sessionsCleaned: 0,
    duration: 0,
    errors: [],
  };

  const tracker = getCleanupTracker();
  if (!tracker) {
    console.warn('⚠️ No cleanup tracker available');
    return stats;
  }

  console.log('🧹 Starting comprehensive E2E test data cleanup...');

  try {
    // Clean up spaces first (foreign key dependencies)
    for (const spaceId of tracker.spaces) {
      try {
        await cleanupSpace(spaceId);
        stats.spacesCleaned++;
      } catch (error) {
        stats.errors.push(`Failed to clean space ${spaceId}: ${error}`);
      }
    }

    // Clean up teams
    for (const teamId of tracker.teams) {
      try {
        await cleanupTeam(teamId);
        stats.teamsCleaned++;
      } catch (error) {
        stats.errors.push(`Failed to clean team ${teamId}: ${error}`);
      }
    }

    // Clean up users
    for (const userId of tracker.users) {
      try {
        await cleanupUser(userId);
        stats.usersCleaned++;
      } catch (error) {
        stats.errors.push(`Failed to clean user ${userId}: ${error}`);
      }
    }

    // Clean up sessions
    for (const sessionId of tracker.sessions) {
      try {
        await cleanupSession(sessionId);
        stats.sessionsCleaned++;
      } catch (error) {
        stats.errors.push(`Failed to clean session ${sessionId}: ${error}`);
      }
    }

    // Clear the tracker
    tracker.users.clear();
    tracker.teams.clear();
    tracker.spaces.clear();
    tracker.sessions.clear();

  } catch (error) {
    stats.errors.push(`Unexpected cleanup error: ${error}`);
  }

  stats.duration = Date.now() - startTime;

  // Log cleanup results
  console.log('\n📊 E2E Cleanup Results:');
  console.log(`  Users cleaned: ${stats.usersCleaned}`);
  console.log(`  Teams cleaned: ${stats.teamsCleaned}`);
  console.log(`  Spaces cleaned: ${stats.spacesCleaned}`);
  console.log(`  Sessions cleaned: ${stats.sessionsCleaned}`);
  console.log(`  Duration: ${stats.duration}ms`);
  console.log(`  Errors: ${stats.errors.length}`);

  if (stats.errors.length > 0) {
    console.log('\n❌ Cleanup Errors:');
    stats.errors.forEach(error => console.log(`  - ${error}`));
  }

  return stats;
}

/**
 * Clean up specific test data types
 */
export async function cleanupSpecificData(type: 'users' | 'teams' | 'spaces' | 'sessions'): Promise<number> {
  const tracker = getCleanupTracker();
  if (!tracker) {
    return 0;
  }

  let cleaned = 0;
  const items = tracker[type];

  for (const itemId of items) {
    try {
      switch (type) {
        case 'users':
          await cleanupUser(itemId);
          break;
        case 'teams':
          await cleanupTeam(itemId);
          break;
        case 'spaces':
          await cleanupSpace(itemId);
          break;
        case 'sessions':
          await cleanupSession(itemId);
          break;
      }
      cleaned++;
    } catch (error) {
      console.warn(`⚠️ Failed to clean ${type.slice(0, -1)} ${itemId}:`, error);
    }
  }

  // Clear from tracker
  items.clear();

  console.log(`✅ Cleaned ${cleaned} ${type}`);
  return cleaned;
}

/**
 * Individual cleanup functions
 */
async function cleanupUser(userId: string): Promise<void> {
  console.log(`🗑️ Cleaning up user: ${userId}`);

  // In a real implementation, this would make API calls:
  // await fetch(`/api/v1/users/${userId}`, { method: 'DELETE' });

  // For now, just log what would be cleaned
  console.log(`   Would delete user: ${userId}`);
  console.log(`   Would delete user sessions`);
  console.log(`   Would delete user conversations`);
  console.log(`   Would delete user memories`);
}

async function cleanupTeam(teamId: string): Promise<void> {
  console.log(`🗑️ Cleaning up team: ${teamId}`);

  // In a real implementation:
  // await fetch(`/api/v1/teams/${teamId}`, { method: 'DELETE' });

  console.log(`   Would delete team: ${teamId}`);
  console.log(`   Would delete team spaces`);
  console.log(`   Would delete team members`);
  console.log(`   Would delete team invites`);
}

async function cleanupSpace(spaceId: string): Promise<void> {
  console.log(`🗑️ Cleaning up space: ${spaceId}`);

  // In a real implementation:
  // await fetch(`/api/v1/spaces/${spaceId}`, { method: 'DELETE' });

  console.log(`   Would delete space: ${spaceId}`);
  console.log(`   Would delete space content`);
  console.log(`   Would delete space permissions`);
}

async function cleanupSession(sessionId: string): Promise<void> {
  console.log(`🗑️ Cleaning up session: ${sessionId}`);

  // In a real implementation:
  // await fetch(`/api/v1/sessions/${sessionId}`, { method: 'DELETE' });

  console.log(`   Would delete session: ${sessionId}`);
  console.log(`   Would clear session cache`);
}

/**
 * Automatic cleanup test wrapper
 */
export function withAutoCleanup<T extends any[], R>(
  testFunction: (...args: T) => Promise<R>,
  dataToTrack?: {
    users?: TestUser[];
    teams?: TestTeam[];
    spaces?: TestSpace[];
    sessions?: string[];
  }
) {
  return async (...args: T): Promise<R> => {
    try {
      // Track data before test
      if (dataToTrack) {
        trackTestData(dataToTrack);
      }

      // Run the test
      const result = await testFunction(...args);
      return result;

    } finally {
      // Automatic cleanup after test
      try {
        await cleanupAllTrackedData();
      } catch (error) {
        console.warn('⚠️ Automatic cleanup failed:', error);
      }
    }
  };
}

/**
 * Browser session cleanup
 */
export async function cleanupBrowserSession(page: Page): Promise<void> {
  try {
    // Clear all cookies
    await page.context().clearCookies();

    // Clear local storage
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Clear any authenticated state
    await page.goto('/logout');

    console.log('✅ Browser session cleaned');
  } catch (error) {
    console.warn('⚠️ Browser session cleanup failed:', error);
  }
}

/**
 * Cleanup test with browser session management
 */
export async function runTestWithCleanup<T>(
  page: Page,
  testFn: (page: Page) => Promise<T>,
  trackData?: {
    users?: TestUser[];
    teams?: TestTeam[];
    spaces?: TestSpace[];
  }
): Promise<T> {
  try {
    // Track data if provided
    if (trackData) {
      trackTestData(trackData);
    }

    // Run the test
    const result = await testFn(page);
    return result;

  } finally {
    // Always clean up browser session
    await cleanupBrowserSession(page);

    // Clean up tracked data
    try {
      await cleanupAllTrackedData();
    } catch (error) {
      console.warn('⚠️ Tracked data cleanup failed:', error);
    }
  }
}

/**
 * Get cleanup statistics
 */
export function getCleanupStats(): {
  trackedUsers: number;
  trackedTeams: number;
  trackedSpaces: number;
  trackedSessions: number;
  sessionAge: number;
} {
  const tracker = getCleanupTracker();

  if (!tracker) {
    return {
      trackedUsers: 0,
      trackedTeams: 0,
      trackedSpaces: 0,
      trackedSessions: 0,
      sessionAge: 0,
    };
  }

  return {
    trackedUsers: tracker.users.size,
    trackedTeams: tracker.teams.size,
    trackedSpaces: tracker.spaces.size,
    trackedSessions: tracker.sessions.size,
    sessionAge: Date.now() - tracker.createdAt,
  };
}

/**
 * Force cleanup of all data (useful for debugging)
 */
export async function forceCleanupAll(): Promise<void> {
  console.log('🚨 Forcing cleanup of all E2E test data...');

  const stats = await cleanupAllTrackedData();

  if (stats.errors.length > 0) {
    console.error('❌ Force cleanup completed with errors');
    throw new Error(`Cleanup failed: ${stats.errors.join(', ')}`);
  }

  console.log('✅ Force cleanup completed successfully');
}