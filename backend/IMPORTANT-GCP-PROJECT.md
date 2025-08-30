# ⚠️ CRITICAL: GCP PROJECT CONFIGURATION ⚠️

## ✅ CORRECT PROJECT
- **Project ID**: `kids-activity-tracker-2024`
- **Project Number**: 205843686007
- **Purpose**: Kids Activity Tracker Application

## ❌ WRONG PROJECT (DO NOT USE!)
- **Project ID**: `kids-activity-tracker-2024`
- **Project Number**: 205843686007
- **Purpose**: Murmans Picks (DIFFERENT APP!)

## 🚨 IMPORTANT RULES

1. **ALWAYS** check current project before deploying:
   ```bash
   gcloud config get-value project
   ```

2. **ALWAYS** use project flag in commands:
   ```bash
   --project kids-activity-tracker-2024
   ```

3. **NEVER** deploy Kids Activity resources to elevated-pod project

4. **RUN** safety check before any deployment:
   ```bash
   source ./.gcloud-project-check.sh
   ```

## 📝 Correct URLs

### API
- ✅ CORRECT: `https://kids-activity-api-205843686007.us-central1.run.app`
- ❌ WRONG: `https://kids-activity-api-205843686007.us-central1.run.app`

### Container Registry
- ✅ CORRECT: `gcr.io/kids-activity-tracker-2024/...`
- ❌ WRONG: `gcr.io/kids-activity-tracker-2024/...`

## 🔧 Set Correct Project
```bash
gcloud config set project kids-activity-tracker-2024
```

## 🛡️ Deployment Scripts
All deployment scripts now include safety checks:
- `deploy-api-fixes.sh` - Deploys API with project check
- `deploy-scraper-fix.sh` - Deploys scraper with project check

## Why This Matters
We keep accidentally deploying to the wrong project because:
1. The elevated-pod project may be the default in gcloud config
2. Old commands in history don't specify --project
3. Copy-pasted commands might have the wrong project

**ALWAYS DOUBLE-CHECK THE PROJECT BEFORE DEPLOYING!**