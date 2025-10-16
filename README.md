# Recipes

First dataset is Reddit Recipes from [kaggle](https://www.kaggle.com/datasets/michau96/recipes-from-reddit)

Second dataset is from [here ](https://www.kaggle.com/datasets/wilmerarltstrmberg/recipe-dataset-over-2m)

I'm just playing with some AI tools, (Vercel + Claude) to parse the data.

## Running things

### Transform one recipe from CSV (single entry)

**Reddit recipes (with AI):**
```bash
npm run build
node dist/src/utils/reddit_csv_to_json.js data/raw/Reddit_Recipes.csv 5
cat data/stage/Reddit_Recipes/entry_5.json
```

**Reddit recipes (local parsing - no AI, free!):**
```bash
npm run build
node dist/src/utils/reddit_csv_to_json_local.js data/raw/Reddit_Recipes.csv 5
cat data/stage/Reddit_Recipes/entry_5.json
```

**Stromberg recipes (with AI):**
```bash
npm run build
node dist/src/utils/stromberg_csv_to_json.js data/raw/stromberg_data.csv 5
cat data/stage/stromberg_data/entry_5.json
```

**Stromberg recipes (local parsing - no AI, free!):**
```bash
npm run build
node dist/src/utils/stromberg_csv_to_json_local.js data/raw/stromberg_data.csv 5
cat data/stage/stromberg_data/entry_5.json
```

💡 **Tip**: Use the local parsers for fast, free processing. They use pattern matching to extract ingredients and instructions. Use AI parsers for better accuracy with messy/unstructured recipes.

### Transform multiple recipes using Temporal workflows (recommended for batches)

**Prerequisites:** Install and start Temporal server (see [TEMPORAL_GUIDE.md](./TEMPORAL_GUIDE.md))

**With AI (slower, costs money):**
```bash
# Terminal 1: Start the worker
npm run worker

# Terminal 2: Process entries 1-20 with 1.5 second delay between each
# Reddit recipes:
npm run client -- data/raw/Reddit_Recipes.csv 1 20 1500

# Stromberg recipes:
npm run client -- data/raw/stromberg_data.csv 1 20 1500
```

**With LOCAL parsing (faster, FREE!):**
```bash
# Terminal 1: Start the worker
npm run worker

# Terminal 2: Process entries 1-100 with 50ms delay (much faster!)
# Reddit recipes:
npm run client:local -- data/raw/Reddit_Recipes.csv 1 100 50

# Stromberg recipes:
npm run client:local -- data/raw/stromberg_data.csv 1 100 50
```

**With PARALLELIZED LOCAL parsing (fastest, FREE!):**
```bash
# Terminal 1: Start the worker
npm run worker

# Terminal 2: Process entries 1-100 with parallel batches (fastest!)
# Reddit recipes (batch size 10, no delay between batches):
npm run client:local:parallel -- data/raw/Reddit_Recipes.csv 1 100 10 0

# Stromberg recipes (batch size 15, no delay between batches):
npm run client:local:parallel -- data/raw/stromberg_data.csv 1 100 15 0

# With delay between batches (if needed):
npm run client:local:parallel -- data/raw/Reddit_Recipes.csv 1 100 10 100
```

**Comparison:**

| Feature | AI Parsing | Local Parsing | Parallelized Local |
|---------|-----------|---------------|-------------------|
| **Speed** | ~1.5s per recipe | ~0.05s per recipe (30x faster) | ~0.05s per recipe (parallel batches) |
| **Cost** | ~$0.001-0.01 per recipe | **FREE** | **FREE** |
| **Accuracy** | Excellent for messy text | Good for structured data | Good for structured data |
| **Batch Processing** | Sequential | Sequential | **Parallel batches** |
| **Best for** | Unstructured Reddit posts | Stromberg dataset, well-formatted recipes | **Bulk processing (100s-1000s)** |
| **100 recipes** | ~3 minutes + API costs | ~5 seconds, free | **~1-2 seconds, free** |

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

**PARALLELIZED batch loading (fastest - using Temporal):**
```bash
# Terminal 1: Start the worker (if not already running)
npm run worker

# Terminal 2: Load all JSON files with parallel batches (fastest!)
npm run client:load:parallel -- data/stage/ 15 0

# Load specific directory with custom batch size
npm run client:load:parallel -- data/stage/stromberg_data/ 20 0

# Load with delay between batches (if needed)
npm run client:load:parallel -- data/stage/Reddit_Recipes/ 10 50
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

## Improvements
### v1
- Call LLM directly on each recipe
- Separate scripts for different raw data

### v1.1
- Have LLM create transform scripts to avoid calling LLM over and over

### 1.2
- Optimize performance of csv -> JSON, JSON -> DB data processing
- chain together workflows csv -> JSON -> DB


