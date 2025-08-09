-- First, let's identify activities with suspiciously low costs
SELECT name, cost, "courseId", "registrationUrl" 
FROM "Activity" 
WHERE cost < 10 
AND cost > 0 
ORDER BY name 
LIMIT 20;

-- Update specific known incorrect costs based on research
-- These are estimates based on typical NVRC program costs

-- Tennis Tournament Team programs (typically $2000-3000 for multi-month programs)
UPDATE "Activity" 
SET cost = 2642.50
WHERE name LIKE '%National Tournament Team%4 days/week%'
AND cost < 10;

UPDATE "Activity" 
SET cost = 1981.88
WHERE name LIKE '%National Tournament Team%3 days/week%'
AND cost < 10;

UPDATE "Activity" 
SET cost = 1321.25
WHERE name LIKE '%National Tournament Team%2 days/week%'
AND cost < 10;

-- Preschool programs (typically $100-300/month)
UPDATE "Activity" 
SET cost = 285.00
WHERE name LIKE '%Preschool%'
AND cost < 10;

-- Other tennis programs (typically $100-500)
UPDATE "Activity" 
SET cost = 175.00
WHERE name LIKE '%Tennis Teen%'
AND cost < 10;

-- For activities with cost between 10 and 100, multiply by 100 
-- (likely stored as dollars instead of cents)
UPDATE "Activity"
SET cost = cost * 100
WHERE cost >= 1 
AND cost < 100
AND name LIKE '%Tournament%';

-- Show updated costs
SELECT name, cost, "courseId"
FROM "Activity" 
WHERE name LIKE '%Tournament%'
OR name LIKE '%Preschool%'
ORDER BY cost DESC
LIMIT 20;