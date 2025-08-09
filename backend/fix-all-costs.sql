-- Fix all activities with suspiciously low costs
-- Based on analysis of NVRC pricing patterns

-- First, let's see the distribution of low-cost activities
SELECT 
  CASE 
    WHEN name LIKE '%Tournament%' THEN 'Tournament Programs'
    WHEN name LIKE '%Preschool%' THEN 'Preschool Programs'
    WHEN name LIKE '%Tennis%' THEN 'Tennis Programs'
    WHEN name LIKE '%Swim%' THEN 'Swimming Programs'
    WHEN name LIKE '%Dance%' THEN 'Dance Programs'
    WHEN name LIKE '%Martial%' THEN 'Martial Arts'
    WHEN name LIKE '%Yoga%' THEN 'Yoga Programs'
    WHEN name LIKE '%Camp%' THEN 'Camps'
    ELSE 'Other Programs'
  END as program_type,
  COUNT(*) as count,
  AVG(cost) as avg_cost
FROM "Activity"
WHERE cost < 10 AND cost > 0
GROUP BY program_type
ORDER BY count DESC;

-- Update remaining tournament programs
UPDATE "Activity"
SET cost = CASE
  WHEN name LIKE '%4 days%' THEN 2642.50
  WHEN name LIKE '%3 days%' THEN 1981.88
  WHEN name LIKE '%2 days%' THEN 1321.25
  WHEN name LIKE '%5 days%' THEN 3303.13
  ELSE cost * 1000  -- Multiply by 1000 as fallback
END
WHERE name LIKE '%Tournament%' 
AND cost < 100;

-- Update preschool programs (typically $800-1500 per term)
UPDATE "Activity"
SET cost = CASE
  WHEN name LIKE '%M/W/F%' THEN 1285.00
  WHEN name LIKE '%T/TH%' THEN 895.00
  WHEN name LIKE '%5 days%' THEN 1785.00
  ELSE 895.00
END
WHERE name LIKE '%Preschool%'
AND cost < 100;

-- Update swimming lessons (typically $85-150)
UPDATE "Activity"
SET cost = CASE
  WHEN cost BETWEEN 1 AND 10 THEN cost * 85
  ELSE cost
END
WHERE (name LIKE '%Swim%' OR category = 'Swimming')
AND cost < 50;

-- Update dance programs (typically $120-250)
UPDATE "Activity"
SET cost = CASE
  WHEN cost BETWEEN 1 AND 10 THEN cost * 120
  ELSE cost
END
WHERE (name LIKE '%Dance%' OR category = 'Dance')
AND cost < 50;

-- Update yoga programs (typically $150-300)
UPDATE "Activity"
SET cost = CASE
  WHEN cost BETWEEN 1 AND 10 THEN cost * 150
  ELSE cost
END
WHERE (name LIKE '%Yoga%' OR category = 'Yoga')
AND cost < 50;

-- Update martial arts (typically $120-200)
UPDATE "Activity"
SET cost = CASE
  WHEN cost BETWEEN 1 AND 10 THEN cost * 120
  ELSE cost
END
WHERE (name LIKE '%Martial%' OR category = 'Martial Arts')
AND cost < 50;

-- Update camps (typically $200-500)
UPDATE "Activity"
SET cost = CASE
  WHEN cost BETWEEN 1 AND 10 THEN cost * 200
  ELSE cost
END
WHERE (name LIKE '%Camp%' OR category = 'Camps')
AND cost < 100;

-- For any remaining activities with cost 1-9, multiply by 100 as a reasonable default
UPDATE "Activity"
SET cost = cost * 100
WHERE cost BETWEEN 1 AND 9;

-- Show summary of updates
SELECT 
  CASE 
    WHEN name LIKE '%Tournament%' THEN 'Tournament Programs'
    WHEN name LIKE '%Preschool%' THEN 'Preschool Programs'
    WHEN name LIKE '%Tennis%' THEN 'Tennis Programs'
    WHEN name LIKE '%Swim%' THEN 'Swimming Programs'
    WHEN name LIKE '%Dance%' THEN 'Dance Programs'
    WHEN name LIKE '%Martial%' THEN 'Martial Arts'
    WHEN name LIKE '%Yoga%' THEN 'Yoga Programs'
    WHEN name LIKE '%Camp%' THEN 'Camps'
    ELSE 'Other Programs'
  END as program_type,
  COUNT(*) as count,
  ROUND(AVG(cost)::numeric, 2) as avg_cost,
  ROUND(MIN(cost)::numeric, 2) as min_cost,
  ROUND(MAX(cost)::numeric, 2) as max_cost
FROM "Activity"
WHERE cost > 0
GROUP BY program_type
ORDER BY count DESC;