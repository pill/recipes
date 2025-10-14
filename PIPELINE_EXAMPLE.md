# Complete Recipe Processing Pipeline

This guide shows the complete workflow from CSV to database.

## Overview

The pipeline has three stages:

1. **Extract**: CSV → JSON (with AI extraction)
2. **Load**: JSON → Database
3. **Query**: Database queries and searches

## Prerequisites

1. **Environment Variables** (`.env` file):
```bash
ANTHROPIC_API_KEY=your_api_key_here
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=reddit_recipes
```

2. **Database Running**:
```bash
npm run docker:start
# Wait ~10 seconds for database to be ready
```

3. **Initialize Database Schema**:
```bash
npm run setup-db
```

## Method 1: Single Recipe (Quick Test)

### Step 1: Extract one recipe from CSV
```bash
npm run build
node dist/src/utils/reddit_csv_to_json.js data/raw/Reddit_Recipes.csv 1
```

**Output**: `data/stage/Reddit_Recipes_entry_1.json`

### Step 2: Load into database
```bash
node dist/src/utils/load_json_to_db.js data/stage/Reddit_Recipes_entry_1.json
```

**Output**: 
```
[Load] ✅ Recipe successfully inserted with ID: 1
```

### Step 3: Verify in database
```bash
# Connect to database
docker exec -it recipes_postgres_1 psql -U postgres -d reddit_recipes

# Query the recipe
SELECT id, title, prep_time_minutes, servings FROM recipes;
```

## Method 2: Batch Processing with Temporal (Recommended)

Process multiple recipes efficiently with rate limiting and monitoring.

### Step 1: Start Temporal (one-time setup)
```bash
# Clone Temporal docker compose
git clone https://github.com/temporalio/docker-compose.git temporal-docker
cd temporal-docker
docker-compose up -d
cd ..
```

Wait ~30 seconds, then verify at: http://localhost:8233

### Step 2: Extract multiple recipes

**Terminal 1 - Start Worker:**
```bash
npm run worker
```

**Terminal 2 - Process batch (entries 1-20):**
```bash
# 1500ms delay = ~40 recipes/min (safe for Anthropic 50 req/min limit)
npm run client -- data/raw/Reddit_Recipes.csv 1 20 1500
```

**Output Files**: 
- `data/stage/Reddit_Recipes_entry_1.json`
- `data/stage/Reddit_Recipes_entry_2.json`
- ...
- `data/stage/Reddit_Recipes_entry_20.json`

### Step 3: Load all recipes into database

**Option A - Load one at a time:**
```bash
for i in {1..20}; do
  echo "Loading entry $i..."
  node dist/src/utils/load_json_to_db.js data/stage/Reddit_Recipes_entry_$i.json
done
```

**Option B - Load using a script:**
```bash
# Load all JSON files in data/stage/
for file in data/stage/Reddit_Recipes_entry_*.json; do
  echo "Loading $file..."
  node dist/src/utils/load_json_to_db.js "$file"
done
```

### Step 4: Query and verify

**Count recipes:**
```bash
docker exec -it recipes_postgres_1 psql -U postgres -d reddit_recipes -c "SELECT COUNT(*) FROM recipes;"
```

**List recent recipes:**
```bash
docker exec -it recipes_postgres_1 psql -U postgres -d reddit_recipes -c "SELECT id, title, cuisine_type, servings FROM recipes ORDER BY created_at DESC LIMIT 10;"
```

## Method 3: Large Scale Processing

Process hundreds or thousands of recipes.

### Process multiple batches
```bash
# Terminal 1: Worker (keep running)
WORKER_MAX_CONCURRENT_ACTIVITIES=1 npm run worker

# Terminal 2: Batch 1 (entries 1-50)
npm run client -- data/raw/Reddit_Recipes.csv 1 50 1500

# Wait for completion, then batch 2 (entries 51-100)
npm run client -- data/raw/Reddit_Recipes.csv 51 100 1500

# Batch 3 (entries 101-150)
npm run client -- data/raw/Reddit_Recipes.csv 101 150 1500
```

### Parallel processing with multiple CSV files
```bash
# Terminal 1: Worker
npm run worker

# Terminal 2: Process first CSV
npm run client -- data/raw/Reddit_Recipes.csv 1 50 1500

# Terminal 3: Process second CSV (after first completes)
npm run client -- data/raw/Reddit_Recipes_2.csv 1 50 1500
```

### Bulk load to database
```bash
# Load all processed JSON files
for file in data/stage/*.json; do
  echo "Processing: $file"
  node dist/src/utils/load_json_to_db.js "$file" || echo "Failed: $file"
done
```

## Monitoring and Troubleshooting

### Check Temporal Workflow Status
- Web UI: http://localhost:8233
- View running workflows, completed tasks, and errors

### Check Database Contents
```bash
# Connect to database
docker exec -it recipes_postgres_1 psql -U postgres -d reddit_recipes

# Recipe statistics
SELECT 
  COUNT(*) as total_recipes,
  COUNT(DISTINCT cuisine_type) as unique_cuisines,
  COUNT(DISTINCT meal_type) as meal_types,
  AVG(prep_time_minutes) as avg_prep_time,
  AVG(servings) as avg_servings
FROM recipes;

# Recipes by cuisine
SELECT cuisine_type, COUNT(*) 
FROM recipes 
GROUP BY cuisine_type 
ORDER BY COUNT(*) DESC;

# Recent recipes
SELECT id, title, cuisine_type, difficulty, created_at 
FROM recipes 
ORDER BY created_at DESC 
LIMIT 20;
```

### Check Processed Files
```bash
# Count JSON files in stage directory
ls -1 data/stage/*.json | wc -l

# List all processed entry numbers
ls data/stage/Reddit_Recipes_entry_*.json | grep -o '[0-9]\+' | sort -n
```

### Find Gaps in Processing
```bash
# Show missing entry numbers between 1-100
for i in {1..100}; do
  if [ ! -f "data/stage/Reddit_Recipes_entry_$i.json" ]; then
    echo "Missing: entry $i"
  fi
done
```

## Common Workflows

### Re-extract Failed Entries
If some entries failed during extraction:

```bash
# Check workflow results in Temporal UI for failed entry numbers
# Then re-process specific entries:
node dist/src/utils/reddit_csv_to_json.js data/raw/Reddit_Recipes.csv 42
node dist/src/utils/load_json_to_db.js data/stage/Reddit_Recipes_entry_42.json
```

### Update Duplicate Check
If you need to reload recipes (e.g., after fixing extraction):

1. Delete from database:
```sql
DELETE FROM recipes WHERE title = 'Your Recipe Title';
```

2. Reload JSON:
```bash
node dist/src/utils/load_json_to_db.js data/stage/Reddit_Recipes_entry_5.json
```

### Process Specific Ranges
```bash
# Only process weekend recipes (hypothetical entries 100-150)
npm run client -- data/raw/Reddit_Recipes.csv 100 150 1500

# Load them
for i in {100..150}; do
  node dist/src/utils/load_json_to_db.js data/stage/Reddit_Recipes_entry_$i.json
done
```

## Performance Tips

### Extraction Rate Limiting
- **Conservative** (50 req/min): 1500ms delay
- **Moderate** (if higher tier): 800ms delay  
- **Aggressive** (100+ req/min): 600ms delay

### Loading to Database
- Single worker: ~1-2 recipes/second
- Batch inserts: Can process 1000+ recipes in 10-15 minutes
- No rate limiting needed for database inserts

### Parallel Processing
Run multiple workers on different CSV files:
```bash
# Worker 1
npm run worker

# Process file 1 (Terminal 2)
npm run client -- data/raw/Reddit_Recipes.csv 1 100 1500

# Process file 2 (Terminal 3, after file 1 completes)
npm run client -- data/raw/Reddit_Recipes_2.csv 1 100 1500
```

## Complete Example: 1000 Recipes

Process 1000 recipes from start to finish:

```bash
# 1. Start infrastructure
npm run docker:start
cd temporal-docker && docker-compose up -d && cd ..

# 2. Build code
npm run build

# 3. Start worker
npm run worker &

# 4. Process in batches of 50 (20 batches total)
for batch in {0..19}; do
  start=$((batch * 50 + 1))
  end=$((start + 49))
  echo "Processing batch $batch: entries $start-$end"
  npm run client -- data/raw/Reddit_Recipes.csv $start $end 1500
  sleep 5  # Brief pause between batches
done

# 5. Load all to database
for file in data/stage/Reddit_Recipes_entry_*.json; do
  node dist/src/utils/load_json_to_db.js "$file"
done

# 6. Verify
docker exec -it recipes_postgres_1 psql -U postgres -d reddit_recipes -c "SELECT COUNT(*) FROM recipes;"
```

**Estimated time**: ~45-60 minutes for 1000 recipes (with 1500ms delay)

## Cleanup

### Stop Services
```bash
# Stop Temporal
cd temporal-docker && docker-compose down && cd ..

# Stop database
npm run docker:stop
```

### Clear Processed Files
```bash
# Remove all JSON files from stage
rm data/stage/*.json
```

### Reset Database
```bash
# Warning: This deletes all data!
npm run docker:reset
npm run docker:start
npm run setup-db
```

