-- Create a test user account
-- Email: test@kidsactivitytracker.com
-- Password: Test123! (bcrypt hashed)

-- The bcrypt hash below is for password "Test123!"
-- Generated with bcrypt rounds: 10
INSERT INTO "User" (
    id,
    email,
    password,
    name,
    "phoneNumber",
    "emailVerified",
    "isActive",
    preferences,
    "createdAt",
    "updatedAt"
) VALUES (
    gen_random_uuid(),
    'test@kidsactivitytracker.com',
    '$2b$10$U8l6VOY2HCdtpRVu9Wx2RezIATjolhT9xLGcfMUfNPWw5VdsqKdcu',
    'Test User',
    NULL,
    true,
    true,
    '{"theme": "light", "notifications": {"email": true, "push": true}}'::jsonb,
    NOW(),
    NOW()
) ON CONFLICT (email) DO NOTHING;

-- Verify the user was created
SELECT id, email, name, "emailVerified", "isActive" 
FROM "User" 
WHERE email = 'test@kidsactivitytracker.com';