# CRITICAL PROJECT CONFIGURATION

## PROJECT RULE #1: NEVER DEPLOY TO MURMANS PICKS PROJECT

### CORRECT PROJECT INFORMATION:
- **GCP Project ID**: `kids-activity-tracker-2024`
- **GCP Project Number**: 197565264905
- **Container Registry**: `gcr.io/kids-activity-tracker-2024`

### WRONG PROJECT (NEVER USE):
- **DO NOT USE**: `elevated-pod-459203-n5` (This is Murmans Picks)
- **DO NOT USE**: `gcr.io/elevated-pod-459203-n5`
- **DO NOT USE**: Any Cloud SQL instance in elevated-pod-459203-n5
- **DO NOT USE**: Project number 44042034457 (This is Murmans Picks)

### BEFORE ANY DEPLOYMENT:
1. ALWAYS run: `gcloud config set project kids-activity-tracker-2024`
2. VERIFY with: `gcloud config get-value project`
3. Should output: `kids-activity-tracker-2024`
4. NEVER trust the current project setting - ALWAYS verify first

### ALL CLOUD BUILD FILES MUST USE:
- `gcr.io/kids-activity-tracker-2024/[image-name]`
- NEVER use `gcr.io/elevated-pod-459203-n5/[anything]`

### ALL DEPLOYMENTS MUST USE:
- `--project=kids-activity-tracker-2024` flag explicitly
- NEVER rely on default project configuration

### CRITICAL CHECKS:
- If you see "elevated-pod-459203-n5" ANYWHERE - STOP IMMEDIATELY
- If you see project number "44042034457" - STOP IMMEDIATELY  
- Always double-check cloudbuild.yaml files for correct project references
- Always verify gcloud config before ANY deployment command

## This is the #1 rule of this project! Violating this rule is UNACCEPTABLE!