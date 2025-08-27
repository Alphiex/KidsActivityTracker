# Cloud Run Deployment Issues and Solutions

## Common Deployment Issues

### 1. Container Fails to Start - Missing Dependencies

**Error**: `Container called exit(1)` with error like:
```
Error: ENOENT: no such file or directory, open '/app/activity-name-mapping.json'
```

**Cause**: The Dockerfile is missing required files that are imported/required by the application.

**Solution**: Add all required files to the Dockerfile:
```dockerfile
# Copy all required mapper files and configs
COPY --from=builder /app/comprehensive-activity-mapper.js ./
COPY --from=builder /app/comprehensive-activity-mapper-v2.js ./
COPY --from=builder /app/activity-name-mapping.json ./
COPY --from=builder /app/migrate-production-batch.js ./
```

### 2. Port Configuration Issues

**Error**: `The user-provided container failed to start and listen on the port defined provided by the PORT=3000 environment variable`

**Cause**: Cloud Run automatically sets the PORT environment variable. Your application must listen on this port.

**Solution**: 
- Don't set ENV PORT in Dockerfile (Cloud Run provides it)
- Use the correct port in deployment command matching your server.js:
```bash
gcloud run deploy kids-activity-api \
  --port 3000  # Must match what server.js listens on
```

### 3. Startup Timeout Issues

**Error**: Container fails to start within allocated timeout

**Solutions**:
1. Increase memory and CPU:
```bash
--memory 1Gi \
--cpu 2 \
```

2. Use --no-cpu-throttling for startup:
```bash
--no-cpu-throttling
```

3. Set minimum instances to avoid cold starts:
```bash
--min-instances 1
```

### 4. Database Connection Issues

**Error**: Database connection timeout during startup

**Solutions**:
- Ensure DATABASE_URL secret is properly configured
- Use connection pooling with appropriate pool size
- Consider using Prisma Accelerate for connection pooling

## Successful Deployment Command

```bash
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Build for linux/amd64 platform (required for Cloud Run)
docker build --platform linux/amd64 -t gcr.io/kids-activity-tracker-2024/kids-activity-api:$TIMESTAMP .

# Push to Container Registry
docker push gcr.io/kids-activity-tracker-2024/kids-activity-api:$TIMESTAMP

# Deploy to Cloud Run
gcloud run deploy kids-activity-api \
  --image gcr.io/kids-activity-tracker-2024/kids-activity-api:$TIMESTAMP \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 2 \
  --port 3000 \
  --min-instances 1 \
  --max-instances 10
```

## Debugging Failed Deployments

Check logs for specific revision:
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=kids-activity-api AND resource.labels.revision_name=<REVISION_NAME>" --limit=20 --format=json | jq '.[].textPayload'
```

## Key Files to Include in Dockerfile

Always ensure these files are copied in the Dockerfile:
- All JavaScript files imported/required by your application
- Configuration JSON files
- Prisma schema and generated client
- Any static assets or templates

## Testing Before Deployment

1. Build locally:
```bash
docker build -t test-api .
```

2. Run locally to test:
```bash
docker run -p 3000:3000 -e PORT=3000 -e DATABASE_URL="your-db-url" test-api
```

3. Test endpoints:
```bash
curl http://localhost:3000/health
```

## Notes

- Always use `--platform linux/amd64` when building Docker images on Apple Silicon Macs
- Cloud Run automatically provides PORT environment variable - don't override it
- Ensure all required files are in the Docker context before building
- Test locally with Docker before deploying to catch missing file issues early