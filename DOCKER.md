# Docker Setup for Reddit Recipes

This guide will help you run the Reddit Recipes project using Docker for PostgreSQL.

## 🐳 Quick Start

### 1. Prerequisites
- Docker and Docker Compose installed
- Node.js and npm (for running the application)

### 2. Setup
```bash
# Run the Docker setup script
./docker-setup.sh
```

This will:
- ✅ Check Docker installation
- ✅ Start PostgreSQL container
- ✅ Initialize the database schema
- ✅ Test the connection
- ✅ Set up environment variables

### 3. Load Helper Scripts
```bash
# Source the helper scripts
source docker-scripts.sh
```

## 🚀 Available Commands

After sourcing the helper scripts, you can use:

```bash
start_db      # Start PostgreSQL database
stop_db       # Stop PostgreSQL database  
start_full    # Start PostgreSQL + pgAdmin
logs          # View database logs
connect_db    # Connect to database via psql
reset_db      # Reset database (deletes all data)
backup_db     # Create database backup
restore_db    # Restore from backup file
test_db       # Run database tests
```

## 🌐 Services

### PostgreSQL Database
- **Host**: localhost
- **Port**: 5432
- **Database**: reddit_recipes
- **Username**: postgres
- **Password**: postgres

### pgAdmin (Optional)
- **URL**: http://localhost:8080
- **Email**: admin@redditrecipes.com
- **Password**: admin

To start pgAdmin:
```bash
docker-compose up -d pgadmin
```

## 📁 Docker Files

- `docker-compose.yml` - Main Docker Compose configuration
- `init-db.sql` - Database initialization script
- `docker-scripts.sh` - Helper functions for Docker management
- `docker-setup.sh` - Automated setup script

## 🔧 Manual Commands

If you prefer to run commands manually:

```bash
# Start database
docker-compose up -d postgres

# View logs
docker-compose logs -f postgres

# Connect to database
docker-compose exec postgres psql -U postgres -d reddit_recipes

# Stop database
docker-compose down

# Reset database (delete all data)
docker-compose down -v
```

## 🗄️ Data Persistence

Database data is persisted in Docker volumes:
- `reddit-recipes_postgres_data` - PostgreSQL data
- `reddit-recipes_pgadmin_data` - pgAdmin configuration

To backup your data:
```bash
docker-compose exec postgres pg_dump -U postgres reddit_recipes > backup.sql
```

To restore from backup:
```bash
docker-compose exec -T postgres psql -U postgres -d reddit_recipes < backup.sql
```

## 🐛 Troubleshooting

### Database won't start
```bash
# Check if port 5432 is already in use
lsof -i :5432

# View detailed logs
docker-compose logs postgres
```

### Connection refused
```bash
# Ensure database is healthy
docker-compose ps

# Restart database
docker-compose restart postgres
```

### Reset everything
```bash
# Stop and remove all containers and volumes
docker-compose down -v
docker system prune -f

# Start fresh
./docker-setup.sh
```

## 🔒 Security Notes

- Default passwords are used for development
- Change passwords for production use
- Consider using Docker secrets for production
- pgAdmin is only accessible locally by default
