# Elasticsearch Integration Guide

This guide explains how to use Elasticsearch for full-text search, filtering, and recommendations in the recipe application.

## What is Elasticsearch?

Elasticsearch is a distributed search and analytics engine that provides:
- **Full-text search**: Search recipes by title, description, ingredients
- **Filtering**: Filter by cuisine, difficulty, dietary tags, etc.
- **Aggregations**: Get statistics and faceted search
- **Recommendations**: Find similar recipes based on ingredients

## Services Included

### Elasticsearch (Port 9200)
- Search engine for recipe data
- REST API for queries and indexing
- No authentication (development mode)

### Kibana (Port 5601)
- Web UI for Elasticsearch
- Data visualization and exploration
- Dev Tools for testing queries

## Starting Elasticsearch

### Start Only Elasticsearch and Kibana
```bash
npm run docker:start:search
```

### Start All Services (PostgreSQL + Elasticsearch)
```bash
npm run docker:start:all
```

### Check Status
```bash
# Check if Elasticsearch is running
curl http://localhost:9200

# Should return cluster information like:
# {
#   "name" : "recipes-elasticsearch",
#   "cluster_name" : "docker-cluster",
#   "version" : { ... }
# }
```

### Access Kibana
Open browser to: http://localhost:5601

## Index Structure

### Recipe Index

Create the recipe index with proper mappings:

```bash
curl -X PUT "localhost:9200/recipes" -H 'Content-Type: application/json' -d'
{
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 0,
    "analysis": {
      "analyzer": {
        "ingredient_analyzer": {
          "type": "standard",
          "stopwords": "_english_"
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "id": { "type": "integer" },
      "title": {
        "type": "text",
        "analyzer": "english",
        "fields": {
          "keyword": { "type": "keyword" }
        }
      },
      "description": {
        "type": "text",
        "analyzer": "english"
      },
      "ingredients": {
        "type": "nested",
        "properties": {
          "name": {
            "type": "text",
            "analyzer": "ingredient_analyzer",
            "fields": {
              "keyword": { "type": "keyword" }
            }
          },
          "quantity": { "type": "float" },
          "unit": { "type": "keyword" },
          "notes": { "type": "text" }
        }
      },
      "instructions": { "type": "text" },
      "prep_time_minutes": { "type": "integer" },
      "cook_time_minutes": { "type": "integer" },
      "total_time_minutes": { "type": "integer" },
      "servings": { "type": "float" },
      "difficulty": { "type": "keyword" },
      "cuisine_type": { "type": "keyword" },
      "meal_type": { "type": "keyword" },
      "dietary_tags": { "type": "keyword" },
      "reddit_author": { "type": "keyword" },
      "reddit_score": { "type": "integer" },
      "created_at": { "type": "date" }
    }
  }
}
'
```

## Indexing Recipes

### Index a Single Recipe

```bash
curl -X POST "localhost:9200/recipes/_doc/1" -H 'Content-Type: application/json' -d'
{
  "id": 1,
  "title": "Classic Chocolate Chip Cookies",
  "description": "Crispy on the outside, chewy on the inside",
  "ingredients": [
    {
      "name": "flour",
      "quantity": 2,
      "unit": "cups"
    },
    {
      "name": "chocolate chips",
      "quantity": 1,
      "unit": "cup"
    }
  ],
  "instructions": ["Mix ingredients", "Bake at 350F for 12 minutes"],
  "prep_time_minutes": 15,
  "cook_time_minutes": 12,
  "servings": 24,
  "difficulty": "easy",
  "cuisine_type": "American",
  "meal_type": "dessert",
  "dietary_tags": ["vegetarian"],
  "created_at": "2024-01-15T10:30:00Z"
}
'
```

### Bulk Index from PostgreSQL

You'll need to create a sync script (see below for implementation ideas).

## Searching Recipes

### Basic Full-Text Search

Search across title and description:

```bash
curl -X GET "localhost:9200/recipes/_search" -H 'Content-Type: application/json' -d'
{
  "query": {
    "multi_match": {
      "query": "chocolate cookies",
      "fields": ["title^2", "description", "instructions"]
    }
  }
}
'
```

### Search by Ingredients

Find recipes containing specific ingredients:

```bash
curl -X GET "localhost:9200/recipes/_search" -H 'Content-Type: application/json' -d'
{
  "query": {
    "nested": {
      "path": "ingredients",
      "query": {
        "match": {
          "ingredients.name": "chicken"
        }
      }
    }
  }
}
'
```

### Filter by Multiple Criteria

```bash
curl -X GET "localhost:9200/recipes/_search" -H 'Content-Type: application/json' -d'
{
  "query": {
    "bool": {
      "must": [
        { "match": { "title": "pasta" }}
      ],
      "filter": [
        { "term": { "cuisine_type": "Italian" }},
        { "term": { "difficulty": "easy" }},
        { "range": { "prep_time_minutes": { "lte": 30 }}}
      ]
    }
  }
}
'
```

### Find Similar Recipes

Use "More Like This" query:

```bash
curl -X GET "localhost:9200/recipes/_search" -H 'Content-Type: application/json' -d'
{
  "query": {
    "more_like_this": {
      "fields": ["title", "description", "ingredients.name"],
      "like": [
        {
          "_index": "recipes",
          "_id": "1"
        }
      ],
      "min_term_freq": 1,
      "max_query_terms": 12
    }
  }
}
'
```

## Aggregations

### Count Recipes by Cuisine

```bash
curl -X GET "localhost:9200/recipes/_search?size=0" -H 'Content-Type: application/json' -d'
{
  "aggs": {
    "cuisines": {
      "terms": {
        "field": "cuisine_type",
        "size": 20
      }
    }
  }
}
'
```

### Average Prep Time by Difficulty

```bash
curl -X GET "localhost:9200/recipes/_search?size=0" -H 'Content-Type: application/json' -d'
{
  "aggs": {
    "by_difficulty": {
      "terms": {
        "field": "difficulty"
      },
      "aggs": {
        "avg_prep": {
          "avg": {
            "field": "prep_time_minutes"
          }
        }
      }
    }
  }
}
'
```

### Popular Ingredients

```bash
curl -X GET "localhost:9200/recipes/_search?size=0" -H 'Content-Type: application/json' -d'
{
  "aggs": {
    "popular_ingredients": {
      "nested": {
        "path": "ingredients"
      },
      "aggs": {
        "ingredient_names": {
          "terms": {
            "field": "ingredients.name.keyword",
            "size": 50
          }
        }
      }
    }
  }
}
'
```

## Using Kibana Dev Tools

1. Open Kibana: http://localhost:5601
2. Click on "Dev Tools" in the sidebar
3. Use the Console to run queries

Example in Kibana Console:
```
GET /recipes/_search
{
  "query": {
    "match": {
      "title": "chicken"
    }
  }
}
```

## Syncing PostgreSQL to Elasticsearch

### Automated Sync Script (Recommended)

Use the built-in sync script to index all recipes:

```bash
# Install dependencies
npm install

# Start Elasticsearch
npm run docker:start:search

# Wait for Elasticsearch to be ready (~30 seconds)

# Run sync script
npm run sync:search
```

**Output:**
```
🔄 Starting PostgreSQL to Elasticsearch sync...
==========================================
✅ Connected to Elasticsearch: recipes-elasticsearch (v8.11.0)
✅ Connected to PostgreSQL: 2024-01-15 10:30:00

Creating Elasticsearch index...
✅ Index 'recipes' created successfully

Fetching recipes from PostgreSQL...
✅ Fetched 150 recipes from database

Indexing recipes to Elasticsearch...
  Indexed batch 1/2 (100/150)
  Indexed batch 2/2 (150/150)

==========================================
✅ Sync Complete!
==========================================
Total recipes in DB: 150
Successfully indexed: 150
Failed: 0
Duration: 2.35s

🔍 Test your search:
   curl "http://localhost:9200/recipes/_search?pretty"

📊 View in Kibana:
   http://localhost:5601
```

**What the script does:**
1. Creates (or recreates) the `recipes` index with proper mappings
2. Fetches all recipes with ingredients from PostgreSQL
3. Transforms data to Elasticsearch format
4. Uses bulk API for efficient indexing (100 recipes per batch)
5. Shows progress and statistics

**Re-sync after updates:**
Simply run the script again - it will recreate the index with fresh data.

```bash
npm run sync:search
```

### Incremental Sync (Advanced)

For production, you might want incremental updates instead of full re-indexing:

**Strategy 1: Trigger-Based Sync**

Use PostgreSQL triggers to sync changes automatically (advanced).

**Strategy 2: Temporal Workflow**

Create a scheduled Temporal workflow to sync periodically.

**Strategy 3: Change Data Capture (CDC)**

Use tools like Debezium to stream database changes to Elasticsearch.

## Common Use Cases

### Recipe Search API

Build a search endpoint:

```typescript
async function searchRecipes(query: string, filters: any) {
  const response = await es.search({
    index: 'recipes',
    body: {
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query,
                fields: ['title^2', 'description', 'ingredients.name']
              }
            }
          ],
          filter: [
            filters.cuisine ? { term: { cuisine_type: filters.cuisine }} : null,
            filters.difficulty ? { term: { difficulty: filters.difficulty }} : null
          ].filter(Boolean)
        }
      },
      size: 20
    }
  })
  
  return response.hits.hits.map(hit => hit._source)
}
```

### Ingredient-Based Recommendations

Find recipes you can make with available ingredients:

```typescript
async function findRecipesByIngredients(ingredients: string[]) {
  const response = await es.search({
    index: 'recipes',
    body: {
      query: {
        nested: {
          path: 'ingredients',
          query: {
            terms: {
              'ingredients.name.keyword': ingredients
            }
          }
        }
      }
    }
  })
  
  return response.hits.hits
}
```

### Auto-Complete for Search

```bash
curl -X GET "localhost:9200/recipes/_search" -H 'Content-Type: application/json' -d'
{
  "suggest": {
    "recipe-suggest": {
      "prefix": "chick",
      "completion": {
        "field": "title.suggest"
      }
    }
  }
}
'
```

## Monitoring and Maintenance

### Check Cluster Health

```bash
curl http://localhost:9200/_cluster/health?pretty
```

### View Index Stats

```bash
curl http://localhost:9200/recipes/_stats?pretty
```

### Delete Index (Careful!)

```bash
curl -X DELETE "localhost:9200/recipes"
```

### Refresh Index

Force Elasticsearch to make recent changes searchable:

```bash
curl -X POST "localhost:9200/recipes/_refresh"
```

## Performance Tips

1. **Use Filters**: Filters are cached and faster than queries
2. **Limit Result Size**: Use `size` parameter appropriately
3. **Use Pagination**: Use `from` and `size` for pagination
4. **Optimize Mapping**: Only index fields you need to search
5. **Use Bulk API**: When indexing multiple documents

## Troubleshooting

### Elasticsearch Won't Start

Check memory settings:
```bash
docker stats recipes-elasticsearch
```

If memory is too low, adjust in docker-compose.yml:
```yaml
- "ES_JAVA_OPTS=-Xms1g -Xmx1g"  # Increase to 1GB
```

### Connection Refused

Ensure Elasticsearch is running:
```bash
docker ps | grep elasticsearch
```

### Slow Queries

Check query execution:
```bash
curl -X GET "localhost:9200/recipes/_search?explain=true" -H 'Content-Type: application/json' -d'
{
  "query": { "match_all": {} }
}
'
```

## Next Steps

1. Install Elasticsearch Node.js client: `npm install @elastic/elasticsearch`
2. Create a sync service to index recipes from PostgreSQL
3. Build a search API endpoint
4. Implement auto-complete suggestions
5. Add recommendation engine based on user preferences

## Resources

- Elasticsearch Docs: https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html
- Kibana Guide: https://www.elastic.co/guide/en/kibana/current/index.html
- Node.js Client: https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/index.html

