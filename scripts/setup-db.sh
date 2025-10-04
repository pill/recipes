#!/bin/bash

echo "🍳 Setting up Reddit Recipes PostgreSQL Database"
echo "==============================================="

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is not installed. Please install PostgreSQL first."
    echo "   On macOS: brew install postgresql"
    echo "   On Ubuntu: sudo apt-get install postgresql postgresql-contrib"
    exit 1
fi

# Check if PostgreSQL is running
if ! pg_isready -q; then
    echo "❌ PostgreSQL is not running. Please start PostgreSQL first."
    echo "   On macOS: brew services start postgresql"
    echo "   On Ubuntu: sudo service postgresql start"
    exit 1
fi

echo "✅ PostgreSQL is installed and running"

# Create database if it doesn't exist
echo "📁 Creating database 'reddit_recipes'..."
createdb reddit_recipes 2>/dev/null || echo "Database already exists"

# Run schema
echo "🏗️  Creating tables and schema..."
psql -d reddit_recipes -f schema.sql

if [ $? -eq 0 ]; then
    echo "✅ Database setup completed successfully!"
    echo ""
    echo "🎯 Next steps:"
    echo "1. Update your .env file with your PostgreSQL credentials"
    echo "2. Run: npm run test-db"
    echo "3. Start building your Reddit recipes parser!"
else
    echo "❌ Database setup failed"
    exit 1
fi
