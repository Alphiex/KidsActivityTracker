-- Add provider enhancements for generic scraper architecture
-- This migration adds fields to support multi-provider scraping

-- Add platform and region fields to Provider table
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "platform" VARCHAR(50);
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "region" VARCHAR(100);
ALTER TABLE "Provider" ADD COLUMN IF NOT EXISTS "contactInfo" JSONB;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS "Provider_platform_idx" ON "Provider"("platform");
CREATE INDEX IF NOT EXISTS "Provider_region_idx" ON "Provider"("region");
CREATE INDEX IF NOT EXISTS "Provider_isActive_idx" ON "Provider"("isActive");

-- Add activity indexes for multi-provider queries
CREATE INDEX IF NOT EXISTS "Activity_provider_category_idx" ON "Activity"("providerId", "category");
CREATE INDEX IF NOT EXISTS "Activity_provider_isActive_idx" ON "Activity"("providerId", "isActive");

-- Create ProviderMetrics table for tracking data quality
CREATE TABLE IF NOT EXISTS "ProviderMetrics" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "providerId" TEXT NOT NULL,
  "scrapeDate" DATE NOT NULL,
  "activitiesFound" INTEGER DEFAULT 0,
  "activitiesProcessed" INTEGER DEFAULT 0,
  "dataQualityScore" DECIMAL(3,2),
  "errors" JSONB,
  "scrapeDuration" INTEGER, -- in seconds
  "memoryUsed" BIGINT, -- in bytes
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "ProviderMetrics_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProviderMetrics_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Add indexes for ProviderMetrics
CREATE INDEX IF NOT EXISTS "ProviderMetrics_providerId_idx" ON "ProviderMetrics"("providerId");
CREATE INDEX IF NOT EXISTS "ProviderMetrics_scrapeDate_idx" ON "ProviderMetrics"("scrapeDate");
CREATE INDEX IF NOT EXISTS "ProviderMetrics_providerId_scrapeDate_idx" ON "ProviderMetrics"("providerId", "scrapeDate");

-- Create ScraperHealthCheck table for monitoring
CREATE TABLE IF NOT EXISTS "ScraperHealthCheck" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "providerId" TEXT NOT NULL,
  "status" VARCHAR(20) NOT NULL, -- 'healthy', 'warning', 'error'
  "message" TEXT,
  "details" JSONB,
  "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  
  CONSTRAINT "ScraperHealthCheck_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ScraperHealthCheck_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Add indexes for ScraperHealthCheck
CREATE INDEX IF NOT EXISTS "ScraperHealthCheck_providerId_idx" ON "ScraperHealthCheck"("providerId");
CREATE INDEX IF NOT EXISTS "ScraperHealthCheck_status_idx" ON "ScraperHealthCheck"("status");
CREATE INDEX IF NOT EXISTS "ScraperHealthCheck_checkedAt_idx" ON "ScraperHealthCheck"("checkedAt");

-- Update existing Provider records with platform information
UPDATE "Provider" 
SET 
  "platform" = 'perfectmind',
  "region" = 'North Vancouver'
WHERE "name" = 'NVRC' AND "platform" IS NULL;

-- Add constraints for data integrity
ALTER TABLE "ProviderMetrics" ADD CONSTRAINT "ProviderMetrics_dataQualityScore_check" 
  CHECK ("dataQualityScore" >= 0.00 AND "dataQualityScore" <= 1.00);

ALTER TABLE "ProviderMetrics" ADD CONSTRAINT "ProviderMetrics_activitiesProcessed_check" 
  CHECK ("activitiesProcessed" >= 0);

ALTER TABLE "ProviderMetrics" ADD CONSTRAINT "ProviderMetrics_activitiesFound_check" 
  CHECK ("activitiesFound" >= 0);

-- Create a view for provider dashboard
CREATE OR REPLACE VIEW "ProviderDashboard" AS
SELECT 
  p."id",
  p."name",
  p."platform",
  p."region",
  p."isActive",
  p."updatedAt",
  COUNT(a."id") as "totalActivities",
  COUNT(CASE WHEN a."isActive" = true THEN 1 END) as "activeActivities",
  MAX(a."lastSeenAt") as "lastActivityUpdate",
  lm."scrapeDate" as "lastMetricDate",
  lm."dataQualityScore",
  lhc."status" as "healthStatus",
  lhc."checkedAt" as "lastHealthCheck"
FROM "Provider" p
LEFT JOIN "Activity" a ON p."id" = a."providerId"
LEFT JOIN LATERAL (
  SELECT "scrapeDate", "dataQualityScore" 
  FROM "ProviderMetrics" pm 
  WHERE pm."providerId" = p."id" 
  ORDER BY "scrapeDate" DESC 
  LIMIT 1
) lm ON true
LEFT JOIN LATERAL (
  SELECT "status", "checkedAt"
  FROM "ScraperHealthCheck" hc
  WHERE hc."providerId" = p."id"
  ORDER BY "checkedAt" DESC
  LIMIT 1
) lhc ON true
GROUP BY p."id", p."name", p."platform", p."region", p."isActive", p."updatedAt", 
         lm."scrapeDate", lm."dataQualityScore", lhc."status", lhc."checkedAt";

-- Add comments for documentation
COMMENT ON TABLE "ProviderMetrics" IS 'Tracks scraping performance and data quality metrics for each provider';
COMMENT ON TABLE "ScraperHealthCheck" IS 'Monitors the health status of scrapers for each provider';
COMMENT ON VIEW "ProviderDashboard" IS 'Consolidated view of provider status, activities, and health metrics';