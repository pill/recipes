import { Client } from '@elastic/elasticsearch'
import { config } from 'dotenv'
import { pool } from '../database.js'

config()

/**
 * Sync recipes from PostgreSQL to Elasticsearch
 * 
 * Usage: npm run sync:search
 * 
 * This script:
 * 1. Creates the Elasticsearch index with proper mappings
 * 2. Reads all recipes from PostgreSQL
 * 3. Transforms and indexes them into Elasticsearch
 * 4. Shows progress and statistics
 */

const ES_INDEX = 'recipes'

// Elasticsearch client
const es = new Client({
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200'
})

/**
 * Create or update the Elasticsearch index with proper mappings
 */
async function createIndex() {
  console.log('Creating Elasticsearch index...')
  
  const indexExists = await es.indices.exists({ index: ES_INDEX })
  
  if (indexExists) {
    console.log(`Index '${ES_INDEX}' already exists. Deleting...`)
    await es.indices.delete({ index: ES_INDEX })
  }
  
  await es.indices.create({
    index: ES_INDEX,
    body: {
      settings: {
        number_of_shards: 1,
        number_of_replicas: 0,
        analysis: {
          analyzer: {
            ingredient_analyzer: {
              type: 'standard',
              stopwords: '_english_'
            }
          }
        }
      },
      mappings: {
        properties: {
          id: { type: 'integer' },
          title: {
            type: 'text',
            analyzer: 'english',
            fields: {
              keyword: { type: 'keyword' }
            }
          },
          description: {
            type: 'text',
            analyzer: 'english'
          },
          ingredients: {
            type: 'nested',
            properties: {
              name: {
                type: 'text',
                analyzer: 'ingredient_analyzer',
                fields: {
                  keyword: { type: 'keyword' }
                }
              },
              quantity: { type: 'float' },
              unit: { type: 'keyword' },
              notes: { type: 'text' }
            }
          },
          instructions: {
            type: 'text',
            analyzer: 'english'
          },
          prep_time_minutes: { type: 'integer' },
          cook_time_minutes: { type: 'integer' },
          total_time_minutes: { type: 'integer' },
          servings: { type: 'float' },
          difficulty: { type: 'keyword' },
          cuisine_type: { type: 'keyword' },
          meal_type: { type: 'keyword' },
          dietary_tags: { type: 'keyword' },
          reddit_author: { type: 'keyword' },
          reddit_score: { type: 'integer' },
          reddit_comments_count: { type: 'integer' },
          created_at: { type: 'date' },
          updated_at: { type: 'date' }
        }
      }
    }
  })
  
  console.log(`✅ Index '${ES_INDEX}' created successfully`)
}

/**
 * Fetch all recipes from PostgreSQL with their ingredients
 */
async function fetchRecipesFromDB() {
  console.log('Fetching recipes from PostgreSQL...')
  
  const query = `
    SELECT 
      r.*,
      json_agg(
        json_build_object(
          'name', i.name,
          'quantity', ri.amount,
          'unit', m.name,
          'notes', ri.notes
        ) ORDER BY ri.order_index
      ) FILTER (WHERE i.id IS NOT NULL) as ingredients
    FROM recipes r
    LEFT JOIN recipe_ingredients ri ON r.id = ri.recipe_id
    LEFT JOIN ingredients i ON ri.ingredient_id = i.id
    LEFT JOIN measurements m ON ri.measurement_id = m.id
    GROUP BY r.id
    ORDER BY r.id
  `
  
  const result = await pool.query(query)
  console.log(`✅ Fetched ${result.rows.length} recipes from database`)
  
  return result.rows
}

/**
 * Transform a database recipe to Elasticsearch document format
 */
function transformRecipe(dbRecipe: any) {
  return {
    id: dbRecipe.id,
    title: dbRecipe.title,
    description: dbRecipe.description,
    ingredients: dbRecipe.ingredients || [],
    instructions: dbRecipe.instructions, // Already JSONB array
    prep_time_minutes: dbRecipe.prep_time_minutes,
    cook_time_minutes: dbRecipe.cook_time_minutes,
    total_time_minutes: dbRecipe.total_time_minutes,
    servings: dbRecipe.servings ? parseFloat(dbRecipe.servings) : null,
    difficulty: dbRecipe.difficulty,
    cuisine_type: dbRecipe.cuisine_type,
    meal_type: dbRecipe.meal_type,
    dietary_tags: dbRecipe.dietary_tags,
    reddit_author: dbRecipe.reddit_author,
    reddit_score: dbRecipe.reddit_score,
    reddit_comments_count: dbRecipe.reddit_comments_count,
    created_at: dbRecipe.created_at,
    updated_at: dbRecipe.updated_at
  }
}

/**
 * Index recipes to Elasticsearch using bulk API
 */
async function indexRecipes(recipes: any[]) {
  console.log('Indexing recipes to Elasticsearch...')
  
  const batchSize = 100
  let indexed = 0
  let failed = 0
  
  for (let i = 0; i < recipes.length; i += batchSize) {
    const batch = recipes.slice(i, i + batchSize)
    
    // Build bulk operations
    const operations = batch.flatMap(recipe => [
      { index: { _index: ES_INDEX, _id: recipe.id.toString() } },
      transformRecipe(recipe)
    ])
    
    try {
      const result = await es.bulk({ operations })
      
      if (result.errors) {
        const errorCount = result.items.filter((item: any) => item.index?.error).length
        failed += errorCount
        console.error(`❌ ${errorCount} documents failed in batch ${i / batchSize + 1}`)
        
        // Log first error for debugging
        const firstError = result.items.find((item: any) => item.index?.error)
        if (firstError) {
          console.error('First error:', JSON.stringify(firstError.index?.error, null, 2))
        }
      }
      
      indexed += batch.length - (result.errors ? failed : 0)
      
      console.log(`  Indexed batch ${i / batchSize + 1}/${Math.ceil(recipes.length / batchSize)} (${indexed}/${recipes.length})`)
    } catch (error) {
      console.error(`❌ Error indexing batch ${i / batchSize + 1}:`, error)
      failed += batch.length
    }
  }
  
  // Refresh the index to make documents searchable
  await es.indices.refresh({ index: ES_INDEX })
  
  return { indexed, failed }
}

/**
 * Main sync function
 */
async function syncToElasticsearch() {
  const startTime = Date.now()
  
  console.log('🔄 Starting PostgreSQL to Elasticsearch sync...')
  console.log('==========================================')
  
  try {
    // Check Elasticsearch connection
    const info = await es.info()
    console.log(`✅ Connected to Elasticsearch: ${info.name} (v${info.version.number})`)
    
    // Check PostgreSQL connection
    const dbResult = await pool.query('SELECT NOW()')
    console.log(`✅ Connected to PostgreSQL: ${dbResult.rows[0].now}`)
    console.log('')
    
    // Create index
    await createIndex()
    console.log('')
    
    // Fetch recipes from database
    const recipes = await fetchRecipesFromDB()
    console.log('')
    
    if (recipes.length === 0) {
      console.log('⚠️  No recipes found in database. Nothing to sync.')
      return
    }
    
    // Index recipes to Elasticsearch
    const { indexed, failed } = await indexRecipes(recipes)
    console.log('')
    
    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log('==========================================')
    console.log('✅ Sync Complete!')
    console.log('==========================================')
    console.log(`Total recipes in DB: ${recipes.length}`)
    console.log(`Successfully indexed: ${indexed}`)
    console.log(`Failed: ${failed}`)
    console.log(`Duration: ${duration}s`)
    console.log('')
    console.log('🔍 Test your search:')
    console.log(`   curl "http://localhost:9200/${ES_INDEX}/_search?pretty"`)
    console.log('')
    console.log('📊 View in Kibana:')
    console.log('   http://localhost:5601')
    
  } catch (error) {
    console.error('❌ Sync failed:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

// Run the sync
syncToElasticsearch()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })

