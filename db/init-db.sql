-- Initialize the reddit_recipes database
-- This script runs when the PostgreSQL container starts for the first time

-- Create database if it doesn't exist (handled by POSTGRES_DB env var)
-- Set up extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE reddit_recipes TO postgres;

-- Create a custom user for the application (optional)
-- CREATE USER reddit_app WITH PASSWORD 'app_password';
-- GRANT ALL PRIVILEGES ON DATABASE reddit_recipes TO reddit_app;

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'Reddit Recipes database initialized successfully!';
    RAISE NOTICE 'Database: reddit_recipes';
    RAISE NOTICE 'User: postgres';
    RAISE NOTICE 'Schema will be created next...';
END $$;
