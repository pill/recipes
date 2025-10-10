# Temporal Recipe Processing Guide

This guide explains how to use the Temporal workflow system to process CSV recipe entries in batches with rate limiting.

## Overview

The Temporal workflow system allows you to:
- Process multiple CSV entries in batches
- Control the rate of API calls to avoid hitting Anthropic rate limits
- Resume processing if interrupted
- Monitor workflow execution status
- Scale processing across multiple workers

## Architecture

1. **Activities** (`src/activities.ts`): Processes a single CSV entry
2. **Workflows** (`src/workflows.ts`): Orchestrates batch processing with delays
3. **Worker** (`src/worker.ts`): Runs activities and workflows
4. **Client** (`src/client.ts`): Starts workflow executions

## Prerequisites

### 1. Install and Start Temporal Server

Using Docker (recommended):

```bash
# Clone the Temporal docker-compose repo
git clone https://github.com/temporalio/docker-compose.git temporal-docker
cd temporal-docker

# Start Temporal
docker-compose up -d

# Wait for services to start (~30 seconds)
```

Or install Temporal CLI:

```bash
# macOS
brew install temporal

# Start local dev server
temporal server start-dev
```

### 2. Verify Temporal is Running

The Temporal Web UI should be available at: http://localhost:8233

## Usage

### Step 1: Start the Worker

In one terminal, start the worker that will execute your activities:

```bash
npm run worker
```

The worker will:
- Connect to the Temporal server
- Wait for workflow tasks on the `recipe-processing` queue
- Process activities with the configured concurrency (default: 1)

**Rate Limiting Configuration:**

Control how many activities run simultaneously:

```bash
# Strict rate limiting (1 activity at a time) - RECOMMENDED
WORKER_MAX_CONCURRENT_ACTIVITIES=1 npm run worker

# Moderate rate limiting (2 activities at a time)
WORKER_MAX_CONCURRENT_ACTIVITIES=2 npm run worker

# Higher concurrency (only if you have higher API tier)
WORKER_MAX_CONCURRENT_ACTIVITIES=5 npm run worker
```

### Step 2: Start a Workflow

In another terminal, start a workflow to process a batch of entries:

```bash
npm run client -- <csv-file-path> <start-entry> <end-entry> [delay-ms]
```

**Examples:**

```bash
# Process entries 1-10 with 2 second delay between each
npm run client -- data/raw/Reddit_Recipes.csv 1 10 2000

# Process entries 50-100 with 1.5 second delay (safe for 50 req/min limit)
npm run client -- data/raw/Reddit_Recipes.csv 50 100 1500

# Process entries 1-5 with default 1 second delay
npm run client -- data/raw/Reddit_Recipes.csv 1 5
```

**Arguments:**
- `csv-file-path`: Path to your CSV file
- `start-entry`: First entry number (1-indexed)
- `end-entry`: Last entry number (inclusive)
- `delay-ms`: (optional) Milliseconds to wait between activities (default: 1000)

### Step 3: Monitor Progress

**In the terminal:**
Both the worker and client will show logs of the processing.

**In the Temporal Web UI:**
1. Open http://localhost:8233
2. Click on the workflow ID to see details
3. View execution history, pending activities, and results

**Detaching from the client:**
You can press Ctrl+C on the client terminal - the workflow continues running in the background. Check the Web UI to monitor progress.

## Rate Limiting Strategy

### Anthropic Rate Limits

Default limits (as of 2024):
- **Claude Sonnet/Haiku**: 50 requests per minute
- **Higher tiers**: 100-1000+ requests per minute

### Recommended Delay Settings

For 50 requests/minute limit:
```bash
# 1200ms delay = 50 requests/min (safe)
npm run client -- data/raw/Reddit_Recipes.csv 1 100 1200

# 1500ms delay = 40 requests/min (very safe with buffer)
npm run client -- data/raw/Reddit_Recipes.csv 1 100 1500
```

For 100 requests/minute limit:
```bash
# 600ms delay = 100 requests/min
npm run client -- data/raw/Reddit_Recipes.csv 1 100 600
```

### Multi-Worker Setup

For higher throughput with multiple workers:

**Terminal 1-3 (Start 3 workers):**
```bash
WORKER_MAX_CONCURRENT_ACTIVITIES=1 npm run worker
```

**Terminal 4 (Start workflow with shorter delay):**
```bash
npm run client -- data/raw/Reddit_Recipes.csv 1 100 400
```

This distributes work across 3 workers while maintaining rate limits.

## Output Files

Processed entries are saved to:
```
data/stage/{csv_filename}_entry_{number}.json
```

Example:
- `data/stage/Reddit_Recipes_entry_1.json`
- `data/stage/Reddit_Recipes_entry_2.json`

**Skip Logic:** If a file already exists, it will be skipped (no re-processing).

## Common Workflows

### Process Entire CSV in Batches

```bash
# Batch 1: entries 1-50
npm run client -- data/raw/Reddit_Recipes.csv 1 50 1500

# Batch 2: entries 51-100
npm run client -- data/raw/Reddit_Recipes.csv 51 100 1500

# Batch 3: entries 101-150
npm run client -- data/raw/Reddit_Recipes.csv 101 150 1500
```

### Resume Failed Batch

If processing fails, you can resume from where it stopped:

```bash
# Original batch failed at entry 25
# Resume from entry 25 onwards
npm run client -- data/raw/Reddit_Recipes.csv 25 50 1500
```

### Process Different CSV Files

```bash
# Start worker once
npm run worker

# Terminal 2: Process first CSV
npm run client -- data/raw/Reddit_Recipes.csv 1 20 1500

# Terminal 3 (after first finishes): Process second CSV
npm run client -- data/raw/Reddit_Recipes_2.csv 1 20 1500
```

## Troubleshooting

### "Connection refused" error

**Problem:** Temporal server is not running

**Solution:**
```bash
# Check if Temporal is running
docker ps | grep temporal

# Start Temporal if needed
cd temporal-docker
docker-compose up -d
```

### Rate limit errors

**Problem:** Hitting API rate limits

**Solution:** Increase the delay between activities:
```bash
npm run client -- data/raw/Reddit_Recipes.csv 1 50 2000
```

### Worker not picking up tasks

**Problem:** Worker and client are using different task queues

**Solution:** Both use `recipe-processing` queue by default. Check logs for queue name.

## Environment Variables

Create a `.env` file:

```bash
# Required
ANTHROPIC_API_KEY=your_api_key_here

# Optional Temporal configuration
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default
WORKER_MAX_CONCURRENT_ACTIVITIES=1
```

## Advanced: Parallel Workflows

To process multiple ranges simultaneously:

```bash
# Terminal 1: Worker
npm run worker

# Terminal 2: Process entries 1-50
npm run client -- data/raw/Reddit_Recipes.csv 1 50 1500

# Terminal 3: Process entries 501-550 (different range, can run in parallel)
npm run client -- data/raw/Reddit_Recipes_2.csv 1 50 1500
```

Each workflow runs independently and worker distributes the load.

## Database Loading Workflow

Load extracted JSON files into the database efficiently.

### Quick Start

```bash
# Terminal 1: Worker (if not already running)
npm run worker

# Terminal 2: Load all JSON files from data/stage
npm run client:load -- data/stage/
```

### Command Syntax

```bash
npm run client:load -- <directory-or-pattern> [delay-ms]
```

**Examples:**

```bash
# Load all JSON files from a directory
npm run client:load -- data/stage/

# Load with a specific delay (100ms between inserts)
npm run client:load -- data/stage/ 100

# Note: Database operations are fast, so delays can be minimal
```

### Features

- **Duplicate Detection**: Automatically skips recipes already in database (by title)
- **Fast Processing**: Typical rate is 10+ recipes/second
- **Error Handling**: Failed inserts are logged but don't stop the workflow
- **Resume Support**: Can re-run to process any new files added to directory

### Monitoring

Track database loading in Temporal Web UI:
- View real-time progress
- See which recipes were inserted vs skipped
- Check for any errors

### Example Output

```
==========================================
Database Loading Complete!
==========================================
Total Processed: 50
Successfully Inserted: 45
Already Exists (skipped): 3
Failed: 2
```

## Benefits of Using Temporal

1. **Reliability**: Workflows survive process crashes and restarts
2. **Observability**: Track every step in the Web UI
3. **Rate Limiting**: Built-in delays and concurrency control
4. **Scalability**: Add more workers to process faster
5. **Idempotency**: Already-processed entries are skipped
6. **Resume**: Continue from where you left off if interrupted
7. **Dual Workflows**: Extract from CSV and load to database in separate workflows

