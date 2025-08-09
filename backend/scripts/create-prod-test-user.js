#!/usr/bin/env node

const { execSync } = require('child_process');

// Create test user by deploying a Cloud Run Job
const createTestUser = `
const { PrismaClient } = require('/app/generated/prisma');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function createUser() {
  try {
    const email = 'test@kidsactivitytracker.com';
    const password = 'Test123!';
    
    // Check if user exists
    const existing = await prisma.user.findUnique({
      where: { email }
    });
    
    if (existing) {
      console.log('User already exists:', existing.id);
      return;
    }
    
    // Create user
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        name: 'Test User',
        isVerified: true,
        preferences: {
          theme: 'light',
          notifications: { email: true, push: true },
          viewType: 'card',
          hasCompletedOnboarding: true
        }
      }
    });
    
    console.log('User created:', user.id);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createUser();
`;

// Create a temporary file with the script
const fs = require('fs');
const path = require('path');
const tmpFile = path.join(__dirname, 'temp-create-user.js');

fs.writeFileSync(tmpFile, createTestUser);

console.log('Creating test user in production database...');

try {
  // Run the script using the production container
  const result = execSync(
    `gcloud run jobs create create-test-user-job \
      --image=gcr.io/elevated-pod-459203-n5/kids-activity-api:latest \
      --region=us-central1 \
      --parallelism=1 \
      --task-timeout=60 \
      --max-retries=0 \
      --command="node" \
      --args="/app/scripts/seed-test-user.js" \
      --set-env-vars="^||^DATABASE_URL=\${DATABASE_URL}" \
      --set-secrets="DATABASE_URL=database-url:latest" \
      --execute-now \
      --wait`,
    { encoding: 'utf8' }
  );
  
  console.log(result);
} catch (error) {
  // Job might already exist, try to execute it
  try {
    const result = execSync(
      `gcloud run jobs execute create-test-user-job \
        --region=us-central1 \
        --wait`,
      { encoding: 'utf8' }
    );
    console.log(result);
  } catch (execError) {
    console.error('Failed to run job:', execError.message);
  }
}

// Clean up
fs.unlinkSync(tmpFile);