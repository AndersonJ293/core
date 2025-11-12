/*
 * Jest Global Setup
 * Runs once before all test suites
 */

import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Global setup for Jest tests
export default async function globalSetup() {
  console.log('🚀 Setting up Jest test environment for CORE Teams MVP');

  // Validate required environment variables
  const requiredEnvVars = [
    'DATABASE_URL',
    'NEO4J_URI',
    'REDIS_HOST',
    'SESSION_SECRET',
    'ENCRYPTION_KEY',
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    console.warn(`⚠️  Missing environment variables: ${missingVars.join(', ')}`);
    console.log('   Using mock values for testing...');
  }

  // Initialize test database if needed
  // await initializeTestDatabase();

  console.log('✅ Jest global setup completed');
}