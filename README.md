# Recipes

First dataset is Reddit Recipes from [kaggle](https://www.kaggle.com/datasets/michau96/recipes-from-reddit)
I'm just playing with some AI tools to parse the data.

## Running things

### Transform one recipe from CSV (single entry)
```bash
npm run build
node dist/src/utils/csv_to_json.js data/raw/Reddit_Recipes.csv 5
cat data/stage/Reddit_Recipes_entry_5.json
```

### Transform multiple recipes using Temporal workflows (recommended for batches)

**Prerequisites:** Install and start Temporal server (see [TEMPORAL_GUIDE.md](./TEMPORAL_GUIDE.md))

```bash
# Terminal 1: Start the worker
npm run worker

# Terminal 2: Process entries 1-20 with 1.5 second delay between each
npm run client -- data/raw/Reddit_Recipes.csv 1 20 1500
```

**Benefits:**
- Built-in rate limiting to avoid API limits
- Automatic retry on failures
- Resume from where you left off if interrupted
- Monitor progress in Temporal Web UI (http://localhost:8233)
- Scale with multiple workers

See [TEMPORAL_GUIDE.md](./TEMPORAL_GUIDE.md) for complete documentation.

### Load recipe JSON into database

After processing CSV entries into JSON, load them into the database:

**Single recipe (manual):**
```bash
# Load a single recipe from JSON file
npm run build
node dist/src/utils/load_json_to_db.js data/stage/Reddit_Recipes_entry_5.json

# Or use the npm script
npm run load-to-db data/stage/Reddit_Recipes_entry_5.json
```

**Batch loading (recommended - using Temporal):**
```bash
# Terminal 1: Start the worker (if not already running)
npm run worker

# Terminal 2: Load all JSON files from data/stage directory
npm run client:load -- data/stage/

# Or load all with a specific pattern
npm run client:load -- "data/stage/*.json" 100
```

**Features:**
- Automatically checks if recipe already exists (by title)
- Skips duplicate recipes
- Creates ingredients and measurements automatically
- Returns the created recipe ID
- Temporal workflow provides: reliability, resumability, and monitoring

**Prerequisites:** Database must be running and configured (see docker setup below)

### Search with Elasticsearch

Enable full-text search and recommendations:

```bash
# 1. Start Elasticsearch and Kibana
npm run docker:start:search

# 2. Wait ~30 seconds for Elasticsearch to be ready

# 3. Sync recipes from database to Elasticsearch
npm install  # Install @elastic/elasticsearch
npm run sync:search

# Access Kibana at http://localhost:5601
# Access Elasticsearch at http://localhost:9200
```

**Test your search:**
```bash
# Search for recipes
curl "http://localhost:9200/recipes/_search?q=chicken&pretty"

# Count recipes
curl "http://localhost:9200/recipes/_count?pretty"
```

See [ELASTICSEARCH_GUIDE.md](./ELASTICSEARCH_GUIDE.md) for complete search documentation.

---

**📚 Complete Pipeline Guide**: See [PIPELINE_EXAMPLE.md](./PIPELINE_EXAMPLE.md) for end-to-end examples of processing hundreds of recipes from CSV to database.






## Tech (so far)
- Typescript
- Postgres
- Elasticsearch
    - full-text search and recommendations
- Vercel AI
    - standardized interaction with AI models
- Zod
    - Typescript schema validation
- Temporal
    - workflow orchestration and rate limiting
- vitest


## Ideas

### Extract
- category

- use vercel to exract structured data
- process in batch?
- use temportal to orchestrate/control flow


- ingredients
- relative amounts
- description

### Recommender
- how to train and use models
    - ingredients
    - nutrition
    - variety
    - cost
        - grocery prices
        - sales of the week

- feedback loop
    - family preferences
    - rating after meal

- cooking skill level required
    - how many times have I cooked this before

## Workflows

### May use Temporal or similar for orchestration

### Get raw recipe data from Reddit
- Poll for new posts
    - note popularity (comments, likes?)
- Download data to "raw" s3 bucket (or local storage)
- CSV will be another source of the same data (from kaggle)
- turn into an Agent

### Transform
- take text from a comment on r/recipes and transform into a structured JSON

### Clean data
- dedupe (esp when starting to get from multiple sources)

### Load into DB
- load data from 

### Add to Search Index
- simple schema to start
- vector based recommendation
- add feedback loops to improve relevance




