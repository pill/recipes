-- Initialize the recipes database
-- This script runs when the PostgreSQL container starts for the first time

-- Create database if it doesn't exist (handled by POSTGRES_DB env var)
-- Set up extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE recipes TO postgres;

-- Create a custom user for the application (optional)
-- CREATE USER recipes_app WITH PASSWORD 'app_password';
-- GRANT ALL PRIVILEGES ON DATABASE recipes TO recipes_app;

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'Recipes database initialized successfully!';
    RAISE NOTICE 'Database: recipes';
    RAISE NOTICE 'User: postgres';
    RAISE NOTICE 'Schema will be created next...';
END $$;
