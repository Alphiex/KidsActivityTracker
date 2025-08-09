# Database Migration Guide - Schema v2

This guide covers the deployment of the enhanced database schema (v2) that adds user accounts, children profiles, and activity sharing features.

## Overview

The v2 schema migration includes:
- Enhanced User model with authentication fields
- New Child model for managing children profiles
- ChildActivity model for tracking child-specific activity data
- ActivityShare and related models for sharing activities between users
- Invitation system for sharing
- Enhanced Activity model with nullable age ranges and day of week
- Replacement of ScrapeJob with ScraperRun model

## Pre-Migration Checklist

- [x] Backup created for local database
- [x] Migration tested locally
- [x] Data preservation verified locally
- [ ] Cloud database backup created
- [ ] Cloud migration applied
- [ ] Cloud data verified

## Local Migration (Completed)

The local migration has been successfully applied. Results:
- 4,246 activities preserved
- 244 locations preserved
- 1 provider preserved
- All unique constraints properly applied
- New tables created successfully

## Cloud Migration Steps

### 1. Backup Cloud Database

```bash
# Option 1: Use the automated backup script
node migrate-cloud-to-v2.js
# This will prompt for confirmation and create a backup before migrating

# Option 2: Manual backup
DATABASE_URL=$CLOUD_DATABASE_URL node backup-database.js
```

### 2. Apply Migration to Cloud

```bash
# Option 1: Use Prisma migrate deploy (recommended)
DATABASE_URL=$CLOUD_DATABASE_URL npx prisma migrate deploy

# Option 2: Use the custom migration script
DATABASE_URL=$CLOUD_DATABASE_URL node migrate-cloud-to-v2.js
```

### 3. Verify Cloud Migration

```bash
# Run verification script
DATABASE_URL=$CLOUD_DATABASE_URL node verify-migration.js
```

## Important Notes

1. **Unique Constraint**: The migration updates the unique constraint on the Activity table from `[providerId, externalId]` to ensure no duplicate activities.

2. **User Password**: Existing users will get a temporary password hash. You'll need to implement a password reset flow for existing users.

3. **Location Data**: The migration sets default values for required fields:
   - `country` defaults to 'Canada'
   - `address` defaults to empty string if null

4. **Age Ranges**: Activity age ranges (ageMin/ageMax) are now nullable to support activities without age restrictions.

5. **Provider Config**: The `scraperConfig` field is now required (non-null) with a default empty JSON object.

## Rollback Plan

If issues occur during cloud migration:

1. The backup file is stored in `backups/cloud/cloud-backup-[timestamp].json`
2. Restore the database to the previous state
3. Review and fix any issues before re-attempting

## Post-Migration Tasks

1. Update API endpoints to handle new schema
2. Implement authentication endpoints for user management
3. Create UI for managing children profiles
4. Implement activity sharing features
5. Update scraper to use ScraperRun instead of ScrapeJob

## Migration Files

- Schema: `/prisma/schema.prisma` (enhanced v2 schema)
- Migration SQL: `/prisma/migrations/20250807221001_enhance_schema_v2/migration.sql`
- Backup: `/backups/backup-[timestamp].json` (local)
- Scripts:
  - `migrate-to-v2.js` - Local migration script
  - `migrate-cloud-to-v2.js` - Cloud migration script
  - `verify-migration.js` - Verification script
  - `backup-database.js` - Backup script

## Support

If you encounter issues:
1. Check the backup files
2. Review migration logs
3. Verify database connection strings
4. Ensure proper permissions for schema modifications