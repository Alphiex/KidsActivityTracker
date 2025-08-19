-- Create a dedicated user for the scraper with necessary permissions
CREATE USER scraper_user WITH PASSWORD 'ScraperPass2024';

-- Grant necessary permissions
GRANT CONNECT ON DATABASE kidsactivity TO scraper_user;
GRANT USAGE ON SCHEMA public TO scraper_user;
GRANT CREATE ON SCHEMA public TO scraper_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO scraper_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO scraper_user;

-- Grant permissions on future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO scraper_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO scraper_user;