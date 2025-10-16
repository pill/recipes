# Stromberg Data Pipeline Guide

This guide helps you efficiently process the massive Stromberg dataset (2.2M+ recipes) using optimized parallel processing.

## 🚀 Quick Start

### 1. Start the Worker
```bash
# Terminal 1: Start Temporal worker
npm run worker
```

### 2. Run the Pipeline
```bash
# Terminal 2: Process in chunks
npm run stromberg:pipeline -- 1000 10
```

## 📊 Pipeline Options

### Chunk Sizes
- **Small chunks (500)**: More manageable, easier to resume
- **Medium chunks (1000)**: Good balance of speed and memory usage
- **Large chunks (2000)**: Maximum speed, requires more memory

### Processing Strategies

#### **Conservative Approach** (Recommended for first run)
```bash
# Process 10,000 recipes in 10 chunks of 1000
npm run stromberg:pipeline -- 1000 10
```

#### **Aggressive Approach** (For powerful systems)
```bash
# Process 20,000 recipes in 10 chunks of 2000
npm run stromberg:pipeline -- 2000 10
```

#### **Full Dataset** (When ready for everything)
```bash
# Process entire dataset in chunks of 1000
npm run stromberg:pipeline -- 1000 2231
```

## 📈 Performance Expectations

| Chunk Size | Recipes/Chunk | Time/Chunk | Memory Usage | Recommended For |
|------------|---------------|------------|--------------|-----------------|
| 500        | 500          | ~30s       | Low          | Testing, small systems |
| 1000       | 1000         | ~45s       | Medium       | **Recommended** |
| 2000       | 2000         | ~70s       | High         | Powerful systems |

## 🔄 Resuming Processing

The pipeline is designed to be resumable. If it stops, you can continue from where you left off:

```bash
# Continue from chunk 11 (after processing first 10 chunks of 1000)
npm run stromberg:pipeline -- 1000 20
```

## 📊 Monitoring Progress

### Real-time Monitoring
```bash
# Check system performance
npm run perf:monitor
```

### Database Monitoring
```sql
-- Check total recipes in database
SELECT COUNT(*) FROM recipes;

-- Check recent additions
SELECT COUNT(*) FROM recipes 
WHERE created_at > NOW() - INTERVAL '1 hour';

-- Check by source
SELECT source, COUNT(*) FROM recipes 
WHERE source LIKE '%stromberg%' 
GROUP BY source;
```

## 🚨 Troubleshooting

### Memory Issues
If you get out-of-memory errors:
```bash
# Use smaller chunks
npm run stromberg:pipeline -- 500 20
```

### Database Connection Issues
```bash
# Check database performance
npm run perf:monitor

# Restart database if needed
npm run docker:stop
npm run docker:start
```

### Temporal Worker Issues
```bash
# Restart worker
# Ctrl+C in worker terminal, then:
npm run worker
```

## 📋 Complete Workflow

### 1. Initial Setup
```bash
# Start all services
npm run docker:start:all

# Start worker
npm run worker
```

### 2. Test Run
```bash
# Process small batch first
npm run stromberg:pipeline -- 500 2
```

### 3. Full Processing
```bash
# Process in manageable chunks
npm run stromberg:pipeline -- 1000 50  # 50,000 recipes
npm run stromberg:pipeline -- 1000 100 # 100,000 recipes
# Continue until all 2.2M are processed
```

### 4. Sync to Elasticsearch
```bash
# After processing is complete
npm run sync:search
```

### 5. Start React App
```bash
cd client/recipe-client
npm run dev
```

## 💡 Optimization Tips

### For Maximum Speed
1. **Use SSD storage** for better I/O performance
2. **Increase system memory** (8GB+ recommended)
3. **Use larger chunk sizes** (2000+)
4. **Close other applications** to free up resources

### For Stability
1. **Use smaller chunk sizes** (500-1000)
2. **Add delays between chunks** (modify script)
3. **Monitor system resources** regularly
4. **Process during off-peak hours**

## 📊 Expected Timeline

| Dataset Size | Chunk Size | Estimated Time |
|--------------|------------|----------------|
| 10,000 recipes | 1000 | ~8 minutes |
| 100,000 recipes | 1000 | ~75 minutes |
| 1,000,000 recipes | 1000 | ~12 hours |
| 2,200,000 recipes | 1000 | ~26 hours |

## 🔍 Quality Checks

After processing, verify data quality:

```sql
-- Check for missing data
SELECT COUNT(*) FROM recipes WHERE title IS NULL;
SELECT COUNT(*) FROM recipes WHERE ingredients IS NULL;

-- Check ingredient parsing
SELECT COUNT(*) FROM recipe_ingredients;

-- Check cuisine distribution
SELECT cuisine_type, COUNT(*) FROM recipes 
WHERE cuisine_type IS NOT NULL 
GROUP BY cuisine_type 
ORDER BY COUNT(*) DESC;
```

## 🚀 Next Steps

1. **Process the data** using the pipeline
2. **Sync to Elasticsearch** for search functionality
3. **Test the React app** with your data
4. **Optimize queries** based on your specific use case
5. **Scale up** if you need to process even larger datasets

Happy processing! 🎉
