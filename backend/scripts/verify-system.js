const { PrismaClient } = require('../generated/prisma');
const axios = require('axios');
const chalk = require('chalk');

const prisma = new PrismaClient();
const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';

// Verification functions
async function verifyDatabase() {
  console.log(chalk.blue('\n🔍 Verifying Database Connection...'));
  
  try {
    await prisma.$connect();
    console.log(chalk.green('✅ Database connection successful'));
    
    // Check tables
    const userCount = await prisma.user.count();
    const childCount = await prisma.child.count();
    const activityCount = await prisma.activity.count();
    const providerCount = await prisma.provider.count();
    const locationCount = await prisma.location.count();
    
    console.log(chalk.cyan(`   Users: ${userCount}`));
    console.log(chalk.cyan(`   Children: ${childCount}`));
    console.log(chalk.cyan(`   Activities: ${activityCount}`));
    console.log(chalk.cyan(`   Providers: ${providerCount}`));
    console.log(chalk.cyan(`   Locations: ${locationCount}`));
    
    return true;
  } catch (error) {
    console.error(chalk.red('❌ Database verification failed:'), error.message);
    return false;
  }
}

async function verifyApiEndpoints() {
  console.log(chalk.blue('\n🔍 Verifying API Endpoints...'));
  
  const endpoints = [
    { method: 'GET', path: '/health', description: 'Health check' },
    { method: 'POST', path: '/api/auth/register', description: 'User registration' },
    { method: 'POST', path: '/api/auth/login', description: 'User login' },
    { method: 'GET', path: '/api/auth/check', description: 'Auth check' },
    { method: 'GET', path: '/api/children', description: 'List children', auth: true },
    { method: 'POST', path: '/api/children', description: 'Create child', auth: true },
    { method: 'GET', path: '/api/activities/search', description: 'Search activities' },
    { method: 'GET', path: '/api/favorites', description: 'List favorites', auth: true },
    { method: 'POST', path: '/api/child-activities/link', description: 'Link child to activity', auth: true },
    { method: 'GET', path: '/api/invitations', description: 'List invitations', auth: true }
  ];
  
  let accessToken = null;
  const results = [];
  
  // First, try to get an auth token
  try {
    const loginResponse = await axios.post(`${API_BASE_URL}/api/auth/login`, {
      email: 'test@example.com',
      password: 'password123'
    });
    
    if (loginResponse.data.success && loginResponse.data.tokens) {
      accessToken = loginResponse.data.tokens.accessToken;
      console.log(chalk.green('✅ Authentication successful'));
    }
  } catch (error) {
    console.log(chalk.yellow('⚠️  Could not authenticate - auth endpoints will be skipped'));
  }
  
  // Test each endpoint
  for (const endpoint of endpoints) {
    try {
      const config = {
        method: endpoint.method,
        url: `${API_BASE_URL}${endpoint.path}`,
        headers: {}
      };
      
      if (endpoint.auth && accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
      
      if (endpoint.method === 'POST') {
        config.data = {}; // Empty body for POST requests
      }
      
      const response = await axios(config);
      results.push({
        endpoint: `${endpoint.method} ${endpoint.path}`,
        description: endpoint.description,
        status: 'success',
        statusCode: response.status
      });
      console.log(chalk.green(`✅ ${endpoint.method} ${endpoint.path} - ${endpoint.description}`));
    } catch (error) {
      const statusCode = error.response?.status || 'N/A';
      const skipAuth = endpoint.auth && !accessToken;
      
      if (skipAuth) {
        console.log(chalk.gray(`⏭️  ${endpoint.method} ${endpoint.path} - ${endpoint.description} (auth required)`));
      } else if (statusCode === 404) {
        console.log(chalk.yellow(`⚠️  ${endpoint.method} ${endpoint.path} - ${endpoint.description} (not implemented)`));
      } else {
        console.log(chalk.red(`❌ ${endpoint.method} ${endpoint.path} - ${endpoint.description} (${statusCode})`));
      }
      
      results.push({
        endpoint: `${endpoint.method} ${endpoint.path}`,
        description: endpoint.description,
        status: skipAuth ? 'skipped' : 'failed',
        statusCode: statusCode
      });
    }
  }
  
  return results;
}

async function verifyServices() {
  console.log(chalk.blue('\n🔍 Verifying Backend Services...'));
  
  const services = [
    { name: 'AuthService', path: '../src/services/authService.ts' },
    { name: 'ChildrenService', path: '../src/services/childrenService.ts' },
    { name: 'ChildActivityService', path: '../src/services/childActivityService.ts' },
    { name: 'SharingService', path: '../src/services/sharingService.ts' },
    { name: 'InvitationService', path: '../src/services/invitationService.ts' },
    { name: 'EmailService', path: '../src/utils/emailService.ts' }
  ];
  
  const results = [];
  
  for (const service of services) {
    try {
      require(service.path);
      console.log(chalk.green(`✅ ${service.name} - Available`));
      results.push({ name: service.name, status: 'available' });
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND') {
        console.log(chalk.yellow(`⚠️  ${service.name} - Not found`));
        results.push({ name: service.name, status: 'not found' });
      } else {
        console.log(chalk.red(`❌ ${service.name} - Error: ${error.message}`));
        results.push({ name: service.name, status: 'error', error: error.message });
      }
    }
  }
  
  return results;
}

async function verifyIntegration() {
  console.log(chalk.blue('\n🔍 Verifying System Integration...'));
  
  const checks = [];
  
  // Check if TypeScript server is running
  try {
    const response = await axios.get(`${API_BASE_URL}/health`);
    if (response.data.success) {
      console.log(chalk.green('✅ TypeScript API server is running'));
      checks.push({ check: 'TypeScript API', status: 'running' });
    }
  } catch (error) {
    console.log(chalk.red('❌ TypeScript API server is not accessible'));
    checks.push({ check: 'TypeScript API', status: 'not running' });
  }
  
  // Check database migrations
  try {
    const migrations = await prisma.$queryRaw`
      SELECT migration_name, finished_at 
      FROM _prisma_migrations 
      WHERE finished_at IS NOT NULL 
      ORDER BY finished_at DESC 
      LIMIT 5
    `;
    console.log(chalk.green(`✅ Database migrations applied: ${migrations.length}`));
    checks.push({ check: 'Database migrations', status: 'applied', count: migrations.length });
  } catch (error) {
    console.log(chalk.red('❌ Could not check database migrations'));
    checks.push({ check: 'Database migrations', status: 'error' });
  }
  
  // Check if mobile app config is correct
  try {
    const apiConfig = require('../../src/config/api.ts');
    console.log(chalk.green(`✅ Mobile app API config found`));
    checks.push({ check: 'Mobile app config', status: 'configured' });
  } catch (error) {
    console.log(chalk.yellow('⚠️  Could not verify mobile app config'));
    checks.push({ check: 'Mobile app config', status: 'unknown' });
  }
  
  return checks;
}

async function generateReport(dbStatus, apiResults, serviceResults, integrationChecks) {
  console.log(chalk.blue('\n📊 System Verification Report'));
  console.log(chalk.blue('============================\n'));
  
  // Database Status
  console.log(chalk.bold('Database Status:'), dbStatus ? chalk.green('Connected') : chalk.red('Failed'));
  
  // API Endpoints
  console.log(chalk.bold('\nAPI Endpoints:'));
  const apiSuccess = apiResults.filter(r => r.status === 'success').length;
  const apiSkipped = apiResults.filter(r => r.status === 'skipped').length;
  const apiFailed = apiResults.filter(r => r.status === 'failed').length;
  console.log(`  Success: ${chalk.green(apiSuccess)}, Failed: ${chalk.red(apiFailed)}, Skipped: ${chalk.gray(apiSkipped)}`);
  
  // Backend Services
  console.log(chalk.bold('\nBackend Services:'));
  const servicesAvailable = serviceResults.filter(r => r.status === 'available').length;
  const servicesMissing = serviceResults.filter(r => r.status === 'not found').length;
  console.log(`  Available: ${chalk.green(servicesAvailable)}, Missing: ${chalk.yellow(servicesMissing)}`);
  
  // Integration Status
  console.log(chalk.bold('\nIntegration Status:'));
  integrationChecks.forEach(check => {
    const statusColor = check.status === 'running' || check.status === 'applied' || check.status === 'configured' 
      ? chalk.green : chalk.red;
    console.log(`  ${check.check}: ${statusColor(check.status)}`);
  });
  
  // Overall Status
  const allGood = dbStatus && apiSuccess > 0 && servicesAvailable > 0;
  console.log(chalk.bold('\nOverall System Status:'), allGood ? chalk.green('✅ READY') : chalk.yellow('⚠️  NEEDS ATTENTION'));
  
  if (!allGood) {
    console.log(chalk.yellow('\nRecommendations:'));
    if (!dbStatus) console.log('  - Check database connection and run migrations');
    if (apiSuccess === 0) console.log('  - Ensure the API server is running (npm run dev)');
    if (servicesAvailable === 0) console.log('  - Check that all TypeScript services are compiled');
  }
}

// Main verification function
async function verifySystem() {
  console.log(chalk.bold.blue('🚀 Kids Activity Tracker System Verification\n'));
  
  try {
    // Run all verifications
    const dbStatus = await verifyDatabase();
    const apiResults = await verifyApiEndpoints();
    const serviceResults = await verifyServices();
    const integrationChecks = await verifyIntegration();
    
    // Generate report
    await generateReport(dbStatus, apiResults, serviceResults, integrationChecks);
    
    console.log(chalk.blue('\n✨ Verification complete!\n'));
    
  } catch (error) {
    console.error(chalk.red('\n❌ System verification failed:'), error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  verifySystem()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { verifySystem };