# Database Schema Normalization Scripts

This directory contains comprehensive scripts for deploying the database schema normalization that fixes location data integrity issues.

## 🎯 Problem Being Solved

The current database has serious referential integrity issues:
- Same location name maps to 13+ different location IDs
- Activities have both `locationId` and `locationName` fields causing inconsistency  
- No proper City table for geographic hierarchy
- Count mismatches between browse screens and detail views

## 📋 Script Overview

### 1. `pre-migration-backup.sql`
Creates comprehensive backups before migration:
- Backs up Location and Activity tables
- Creates metadata about current state
- Identifies problematic data that will be fixed

### 2. `deploy-normalized-schema.sql` 
Main migration script that:
- Creates City table with proper geographic hierarchy
- Adds Apple Maps integration fields to Location table  
- Consolidates duplicate location records
- Updates Activity references to use normalized locations
- Adds proper foreign key constraints

### 3. `verify-normalized-schema.sql`
Comprehensive verification that:
- Validates table structure and constraints
- Checks data integrity and referential consistency
- Reports on Apple Maps integration coverage
- Tests query performance
- Provides migration success/failure status

### 4. `rollback-normalized-schema.sql`
Safe rollback script that:
- Restores original location structure
- Removes new constraints and indexes  
- Cleans up new columns
- Validates rollback success

### 5. `deploy-to-production.sh`
Production deployment orchestrator that:
- Handles multiple environments (local/staging/production)
- Runs pre-deployment checks
- Creates backups automatically
- Executes migration safely
- Verifies results
- Provides next steps guidance

## 🚀 Deployment Instructions

### Local Development
```bash
# Test the migration locally first
./scripts/deploy-to-production.sh local
```

### Production Deployment  
```bash
# Set production database password
export PRODUCTION_DB_PASSWORD="your_production_password"

# Deploy to production (requires confirmation)
./scripts/deploy-to-production.sh production
```

## 🔄 Rollback Instructions

If issues occur after migration:

```bash
# Connect to the affected database
psql -h [host] -p [port] -U [user] -d [database]

# Run rollback script
\i scripts/rollback-normalized-schema.sql
```

## 📊 New Schema Structure

### City Table
- `id`: UUID primary key
- `name`: City name (e.g., "North Vancouver")
- `province`: Province/state (e.g., "BC")
- `country`: Country (default "Canada")

### Enhanced Location Table  
- `cityId`: Foreign key to City table
- `fullAddress`: Complete formatted address for Apple Maps
- `mapUrl`: Apple Maps URL for direct navigation
- `placeId`: Apple Place ID (future use)
- `phoneNumber`: Location contact number
- `website`: Location website

### Activity Table Changes
- Removed: `locationName`, `fullAddress`, `latitude`, `longitude`
- Kept: `locationId` (now properly references unique locations)

## ✅ Benefits After Migration

1. **Eliminates Count Mismatches**: Consistent location references
2. **Apple Maps Integration**: Direct navigation to activity locations
3. **Better Performance**: Proper indexes and normalized queries
4. **Data Integrity**: Foreign key constraints prevent orphaned data
5. **Easier Maintenance**: Single source of truth for location data

## 🔍 Verification

After migration, verify success by:
1. Running `verify-normalized-schema.sql`
2. Checking that location browse counts match detail view counts
3. Testing Apple Maps URLs work correctly
4. Confirming no duplicate location records exist

## 📞 Support

If migration issues occur:
1. Check verification script output
2. Review backup data in `backup_pre_normalization` schema
3. Use rollback script if necessary
4. Contact development team with verification results