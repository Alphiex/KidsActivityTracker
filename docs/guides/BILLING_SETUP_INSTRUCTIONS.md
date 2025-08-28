# Billing Setup Instructions

## Step 1: Enable Billing

1. Go to the Google Cloud Console: https://console.cloud.google.com
2. Select the project `kids-activity-tracker-dev` from the project dropdown
3. Navigate to "Billing" in the left sidebar
4. Click "Link a billing account"
5. Select your billing account or create a new one
6. Confirm the association

## Step 2: Run the Setup Script

Once billing is enabled, run the automated setup script:

```bash
./scripts/setup-after-billing.sh
```

This script will:
- Enable all required APIs
- Create Cloud SQL instance (minimal tier)
- Create Redis instance
- Set up service account
- Create secrets
- Deploy the backend
- Update your configuration files
- Initialize the database

## Step 3: Populate the Database

After the setup script completes:

```bash
cd backend
npm run db:seed
```

This will create:
- NVRC provider configuration
- Test locations
- Test user account

## Step 4: Verify Everything Works

1. Test the API health endpoint:
```bash
curl [YOUR_SERVICE_URL]/health
```

2. Check that the app connects:
```bash
npm start
```

## Cost Management

When you're done developing for the day:
```bash
./scripts/dev-stop.sh
```

When you want to start developing again:
```bash
./scripts/dev-start.sh
```

## Manual Steps (if needed)

If you prefer to set up billing manually:

1. Get your billing account ID:
```bash
gcloud beta billing accounts list
```

2. Link billing to the project:
```bash
gcloud beta billing projects link kids-activity-tracker-dev --billing-account=[YOUR_BILLING_ACCOUNT_ID]
```

Then run the setup script as described above.