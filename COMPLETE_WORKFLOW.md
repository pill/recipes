# Complete Recipe Processing Workflow

This guide shows the complete automated workflow from CSV to searchable database.

## Overview

The complete pipeline has three main stages:

1. **Extract** (CSV → JSON): Use AI to extract structured recipe data
2. **Load** (JSON → Database): Insert recipes into PostgreSQL
3. **Query**: Search and retrieve recipes

All stages can be orchestrated using Temporal workflows for reliability and monitoring.

## Quick Start: Process 20 Recipes End-to-End

### Prerequisites

```bash
# 1. Start Temporal (one-time setup)
git clone https://github.com/temporalio/docker-compose.git temporal-docker
cd temporal-docker && docker-compose up -d && cd ..

# 2. Start PostgreSQL database
npm run docker:start

# 3. Build the project
npm run build
```

### Step 1: Start the Worker

The worker processes both extraction and database loading tasks.

```bash
# Terminal 1
npm run worker
```

### Step 2: Extract Recipes from CSV

Extract 20 recipes using AI.

```bash
# Terminal 2
npm run client -- data/raw/Reddit_Recipes.csv 1 20 1500
```

**Output:** 
- Creates 20 JSON files in `data/stage/`
- Each file contains structured recipe data
- Takes ~30-45 minutes (with 1500ms delay for rate limiting)

### Step 3: Load Recipes to Database

Load all extracted JSON files into PostgreSQL.

```bash
# Terminal 2 (after extraction completes)
npm run client:load -- data/stage/
```

**Output:**
- Inserts recipes into database
- Skips duplicates automatically
- Takes ~1-2 minutes for 20 recipes

### Step 4: Query the Database

```bash
# Count recipes
docker exec -it reddit-recipes-db psql -U postgres -d recipes -c "SELECT COUNT(*) FROM recipes;"

# View recent recipes
docker exec -it reddit-recipes-db psql -U postgres -d recipes -c "SELECT id, title, cuisine_type, servings FROM recipes ORDER BY created_at DESC LIMIT 10;"
```

## Parallel Processing (Advanced)

Process extraction and loading in parallel for maximum efficiency.

### Terminal 1: Worker
```bash
npm run worker
```

### Terminal 2: Extract First Batch
```bash
npm run client -- data/raw/Reddit_Recipes.csv 1 20 1500
```

### Terminal 3: Load Completed Files (after first few extract)
```bash
# Wait for a few recipes to be extracted, then start loading
sleep 300  # Wait 5 minutes for first few recipes
npm run client:load -- data/stage/
```

### Terminal 4: Extract Second Batch (while first batch loads)
```bash
# Once first batch extraction is done
npm run client -- data/raw/Reddit_Recipes.csv 21 40 1500
```

This approach maximizes throughput by overlapping I/O-bound extraction and CPU-bound loading.

## Processing Large Datasets

### Example: 1000 Recipes

**Strategy 1: Sequential (Simple)**

```bash
# Extract all 1000
npm run client -- data/raw/Reddit_Recipes.csv 1 1000 1500

# Load all 1000 
npm run client:load -- data/stage/
```

**Time:** ~25-30 hours for extraction, ~1-2 hours for loading

**Strategy 2: Batched (Efficient)**

```bash
# Process in batches of 50
for batch in {0..19}; do
  start=$((batch * 50 + 1))
  end=$((start + 49))
  
  echo "Processing batch $batch: entries $start-$end"
  npm run client -- data/raw/Reddit_Recipes.csv $start $end 1500
  
  # Load this batch while next batch extracts
  npm run client:load -- data/stage/
  
  sleep 10  # Brief pause between batches
done
```

**Time:** Similar total time, but results available incrementally

**Strategy 3: Parallel Workers (Fastest)**

Run multiple workers on different CSV files:

```bash
# Terminal 1: Worker 1
npm run worker

# Terminal 2: CSV File 1
npm run client -- data/raw/Reddit_Recipes.csv 1 100 1500

# Terminal 3: CSV File 2  
npm run client -- data/raw/Reddit_Recipes_2.csv 1 100 1500

# Terminal 4: Load as files appear
watch -n 60 'npm run client:load -- data/stage/'
```

## Monitoring & Troubleshooting

### Temporal Web UI

Open http://localhost:8233 to:
- View running workflows
- Check completion status
- See error details
- Monitor worker health

### Database Monitoring

```bash
# Recipe count
docker exec -it reddit-recipes-db psql -U postgres -d recipes -c \
  "SELECT COUNT(*) FROM recipes;"

# Cuisine breakdown
docker exec -it reddit-recipes-db psql -U postgres -d recipes -c \
  "SELECT cuisine_type, COUNT(*) FROM recipes GROUP BY cuisine_type ORDER BY COUNT(*) DESC;"

# Recent additions
docker exec -it reddit-recipes-db psql -U postgres -d recipes -c \
  "SELECT id, title, created_at FROM recipes ORDER BY created_at DESC LIMIT 10;"
```

### Check Extraction Progress

```bash
# Count extracted JSON files
ls data/stage/*.json | wc -l

# List recent extractions
ls -lt data/stage/*.json | head -10

# Check for missing entries
for i in {1..100}; do
  if [ ! -f "data/stage/Reddit_Recipes_entry_$i.json" ]; then
    echo "Missing: entry $i"
  fi
done
```

## Resume from Failures

Both workflows are resumable:

### Resume Extraction

```bash
# Re-run the same command - it will skip existing files
npm run client -- data/raw/Reddit_Recipes.csv 1 100 1500
```

### Resume Loading

```bash
# Re-run - it will skip recipes already in database
npm run client:load -- data/stage/
```

## Complete Example: Sunday Batch Job

Process 100 recipes every Sunday night:

```bash
#!/bin/bash
# sunday-recipe-batch.sh

# Configuration
START_ENTRY=1
END_ENTRY=100
CSV_FILE="data/raw/Reddit_Recipes.csv"
EXTRACT_DELAY=1500  # ms

echo "Starting Sunday recipe batch job..."
echo "Processing entries $START_ENTRY to $END_ENTRY"

# Ensure services are running
npm run docker:start
cd temporal-docker && docker-compose up -d && cd ..

# Start worker in background
npm run worker &
WORKER_PID=$!

# Wait for worker to be ready
sleep 10

# Extract recipes
echo "Extracting recipes from CSV..."
npm run client -- $CSV_FILE $START_ENTRY $END_ENTRY $EXTRACT_DELAY

# Load to database
echo "Loading recipes to database..."
npm run client:load -- data/stage/

# Report statistics
RECIPE_COUNT=$(docker exec -it reddit-recipes-db psql -U postgres -d recipes -t -c "SELECT COUNT(*) FROM recipes;")
echo "Total recipes in database: $RECIPE_COUNT"

# Cleanup
kill $WORKER_PID

echo "Sunday batch job complete!"
```

Make it executable and schedule with cron:

```bash
chmod +x sunday-recipe-batch.sh

# Add to crontab (run every Sunday at 11 PM)
0 23 * * 0 /path/to/sunday-recipe-batch.sh >> /path/to/logs/recipe-batch.log 2>&1
```

## Performance Optimization

### Extraction (Rate Limited by AI API)
- **Conservative**: 1500ms delay = 40 recipes/hour
- **Moderate**: 1000ms delay = 60 recipes/hour  
- **Aggressive**: 800ms delay = 75 recipes/hour (if you have higher API tier)

### Database Loading (Not Rate Limited)
- **Typical**: 10-20 recipes/second
- **Batch of 100**: ~5-10 seconds
- **Batch of 1000**: ~1-2 minutes

### Bottleneck
Extraction is the bottleneck. Optimize by:
1. Running multiple workers on different CSV files
2. Using faster/cheaper AI models (Haiku vs Sonnet)
3. Increasing API rate limits with provider

## Cost Estimation

### Anthropic API Costs
- **Claude Haiku**: ~$0.25 per 1M input tokens
- **Typical recipe**: ~500 tokens input
- **Cost per recipe**: ~$0.0001 - $0.0002
- **1000 recipes**: ~$0.10 - $0.20

### Infrastructure
- **PostgreSQL**: Free (Docker container)
- **Temporal**: Free (local instance)
- **Storage**: Minimal (<100MB for 1000 recipes)

**Total for 1000 recipes: ~$0.20** 💰

## Next Steps

After loading recipes:
1. Build search interface (full-text search is already indexed)
2. Add recipe recommendations based on ingredients
3. Create API endpoints for recipe retrieval
4. Build web UI for browsing recipes

See main README for additional features and documentation.

