# 🚀 PRODUCTION DEPLOYMENT CHECKLIST - Schema Normalization

## ✅ Prerequisites - COMPLETED
- [x] Backend code updated and deployed (API revision: `kids-activity-api-00114-44d`)
- [x] TypeScript compilation successful
- [x] Migration scripts created and tested
- [x] Rollback scripts prepared
- [x] Documentation complete

## 📋 DEPLOYMENT STEPS - TO BE EXECUTED

### Step 1: Database Connection Setup
```bash
# Option A: Direct connection (if credentials available)
export PRODUCTION_DB_PASSWORD="[correct_password]"

# Option B: Use Cloud SQL Proxy
gcloud sql connect [instance-name] --user=postgres --project=kids-activity-tracker-2024

# Option C: Use gcloud sql proxy
./cloud_sql_proxy -instances=kids-activity-tracker-2024:[region]:[instance-name]=tcp:5432
```

### Step 2: Pre-Migration Verification
```bash
# Verify current data state
PGPASSWORD='[password]' psql -h [host] -U postgres -d kids_activity_tracker -c "
SELECT 
  COUNT(*) as total_activities,
  COUNT(DISTINCT locationId) as unique_location_ids,
  (SELECT COUNT(*) FROM Location) as total_locations,
  (SELECT COUNT(DISTINCT name) FROM Location) as unique_location_names
FROM Activity;"
```

**Expected Current State**:
- ~2940 total activities
- ~13 location IDs for "Parkgate Community Centre"
- Count mismatch: browse shows 313, detail shows 276

### Step 3: Execute Database Migration
```bash
# Run the comprehensive deployment script
./scripts/deploy-to-production.sh production
```

**What This Does**:
1. Creates comprehensive backup
2. Creates `City` table from existing location data
3. Consolidates duplicate location records
4. Updates activity references to normalized locations
5. Adds Apple Maps integration data
6. Validates migration success

### Step 4: Verification
```bash
# Run verification script
PGPASSWORD='[password]' psql -h [host] -U postgres -d kids_activity_tracker -f scripts/verify-normalized-schema.sql
```

**Expected Results**:
- All locations consolidated (1 record per unique location)
- All activities reference proper location IDs
- Apple Maps URLs generated for navigation
- Foreign key constraints ensure data integrity

### Step 5: Application Testing

#### Test Location Count Consistency
1. **Open mobile app** → Browse by Location → North Vancouver
2. **Check Parkgate Community Centre** count (should show ~137 with global filters)
3. **Click on Parkgate** → Detail view (should show same ~137 count)
4. **✅ Success**: Counts now match exactly

#### Test Apple Maps Integration
1. **View activity detail** with location information
2. **Tap location** → Should open Apple Maps with correct address
3. **✅ Success**: Navigation works properly

#### Test Global Filters
1. **Enable "Hide Full Activities"** in settings
2. **Check counts** across browse and detail screens
3. **✅ Success**: All screens respect global filter settings consistently

## 🔍 Monitoring Checklist

### Immediate Post-Deployment (0-2 hours)
- [ ] API health check: `curl https://kids-activity-api-205843686007.us-central1.run.app/health`
- [ ] Location browse screens load correctly
- [ ] Activity detail screens show proper location data
- [ ] No 500 errors in API logs
- [ ] Count consistency verified across all screens

### Short-term Monitoring (24 hours)
- [ ] Scrapers run successfully with new location logic
- [ ] New activities created with proper location references
- [ ] Apple Maps URLs work for navigation
- [ ] No duplicate location records created

### Long-term Benefits (1 week+)
- [ ] Consistent count displays across all location screens
- [ ] Improved query performance with normalized structure  
- [ ] Better data integrity with foreign key constraints
- [ ] Enhanced user experience with Apple Maps integration

## 🚨 Rollback Plan (If Issues Occur)

### Immediate Rollback
```bash
# Connect to database
PGPASSWORD='[password]' psql -h [host] -U postgres -d kids_activity_tracker

# Run rollback script
\i scripts/rollback-normalized-schema.sql
```

### Application Rollback
```bash
# Deploy previous API revision
gcloud run deploy kids-activity-api --image gcr.io/kids-activity-tracker-2024/kids-activity-api:previous --region us-central1 --project=kids-activity-tracker-2024
```

## 📞 Support Information

**Migration Scripts Location**: `/Users/mike/Development/KidsActivityTracker/backend/scripts/`

**Key Files**:
- `deploy-normalized-schema.sql` - Main migration
- `verify-normalized-schema.sql` - Validation
- `rollback-normalized-schema.sql` - Emergency rollback
- `README.md` - Detailed documentation

**API Status**: Backend code already deployed and ready for normalized schema

---
**✅ STATUS**: Ready for production database migration  
**🔄 NEXT**: Execute Step 1-3 when database access is available