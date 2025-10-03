#!/bin/bash

# Docker Helper Scripts for Reddit Recipes
# Usage: source docker-scripts.sh

echo "🐳 Docker Helper Scripts for Reddit Recipes"
echo "=========================================="

# Function to start the database
start_db() {
    echo "🚀 Starting PostgreSQL database..."
    docker-compose up -d postgres
    
    echo "⏳ Waiting for database to be ready..."
    until docker-compose exec postgres pg_isready -U postgres -d reddit_recipes; do
        echo "Waiting for PostgreSQL..."
        sleep 2
    done
    
    echo "✅ Database is ready!"
    echo "📊 Connection details:"
    echo "   Host: localhost"
    echo "   Port: 5432"
    echo "   Database: reddit_recipes"
    echo "   Username: postgres"
    echo "   Password: postgres"
}

# Function to stop the database
stop_db() {
    echo "🛑 Stopping PostgreSQL database..."
    docker-compose down
    echo "✅ Database stopped!"
}

# Function to start with pgAdmin
start_full() {
    echo "🚀 Starting PostgreSQL database with pgAdmin..."
    docker-compose up -d
    
    echo "⏳ Waiting for services to be ready..."
    until docker-compose exec postgres pg_isready -U postgres -d reddit_recipes; do
        echo "Waiting for PostgreSQL..."
        sleep 2
    done
    
    echo "✅ All services are ready!"
    echo "📊 PostgreSQL:"
    echo "   Host: localhost:5432"
    echo "   Database: reddit_recipes"
    echo "   Username: postgres"
    echo "   Password: postgres"
    echo ""
    echo "🌐 pgAdmin:"
    echo "   URL: http://localhost:8080"
    echo "   Email: admin@redditrecipes.com"
    echo "   Password: admin"
}

# Function to view logs
logs() {
    echo "📋 Viewing database logs..."
    docker-compose logs -f postgres
}

# Function to connect to database
connect_db() {
    echo "🔌 Connecting to PostgreSQL database..."
    docker-compose exec postgres psql -U postgres -d reddit_recipes
}

# Function to reset database
reset_db() {
    echo "⚠️  Resetting database (this will delete all data)..."
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker-compose down -v
        docker volume rm reddit-recipes_postgres_data 2>/dev/null || true
        docker volume rm reddit-recipes_pgadmin_data 2>/dev/null || true
        echo "✅ Database reset complete!"
    else
        echo "❌ Reset cancelled"
    fi
}

# Function to backup database
backup_db() {
    local backup_file="backup_$(date +%Y%m%d_%H%M%S).sql"
    echo "💾 Creating database backup: $backup_file"
    docker-compose exec postgres pg_dump -U postgres reddit_recipes > "$backup_file"
    echo "✅ Backup created: $backup_file"
}

# Function to restore database
restore_db() {
    if [ -z "$1" ]; then
        echo "❌ Please provide backup file: restore_db backup.sql"
        return 1
    fi
    
    if [ ! -f "$1" ]; then
        echo "❌ Backup file not found: $1"
        return 1
    fi
    
    echo "🔄 Restoring database from: $1"
    docker-compose exec -T postgres psql -U postgres -d reddit_recipes < "$1"
    echo "✅ Database restored!"
}

# Function to run tests
test_db() {
    echo "🧪 Running database tests..."
    export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    npm run test-db
}

echo "Available commands:"
echo "  start_db    - Start PostgreSQL database"
echo "  stop_db     - Stop PostgreSQL database"
echo "  start_full  - Start PostgreSQL + pgAdmin"
echo "  logs        - View database logs"
echo "  connect_db  - Connect to database via psql"
echo "  reset_db    - Reset database (deletes all data)"
echo "  backup_db   - Create database backup"
echo "  restore_db  - Restore from backup file"
echo "  test_db     - Run database tests"
echo ""
echo "Example: start_db"
