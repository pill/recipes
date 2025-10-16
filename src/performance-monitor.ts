import { pool } from './database.js'
import { Client } from '@elastic/elasticsearch'

/**
 * Performance monitoring script
 * 
 * Monitors database and Elasticsearch performance metrics
 * Usage: npm run perf:monitor
 */
async function monitorPerformance() {
  console.log('📊 Performance Monitor Starting...')
  console.log('=====================================')
  
  // Database performance metrics
  console.log('🗄️  Database Performance:')
  try {
    const startTime = Date.now()
    
    // Test connection pool
    const client = await pool.connect()
    const dbTime = Date.now() - startTime
    console.log(`   Connection time: ${dbTime}ms`)
    
    // Test query performance
    const queryStart = Date.now()
    const result = await client.query(`
      SELECT 
        COUNT(*) as total_recipes,
        COUNT(DISTINCT cuisine_type) as unique_cuisines,
        AVG(array_length(ingredients, 1)) as avg_ingredients_per_recipe
      FROM recipes r
      LEFT JOIN (
        SELECT recipe_id, COUNT(*) as ingredients
        FROM recipe_ingredients 
        GROUP BY recipe_id
      ) ri ON r.id = ri.recipe_id
    `)
    const queryTime = Date.now() - queryStart
    console.log(`   Query time: ${queryTime}ms`)
    console.log(`   Total recipes: ${result.rows[0].total_recipes}`)
    console.log(`   Unique cuisines: ${result.rows[0].unique_cuisines}`)
    console.log(`   Avg ingredients: ${parseFloat(result.rows[0].avg_ingredients_per_recipe).toFixed(1)}`)
    
    client.release()
    
    // Connection pool stats
    console.log(`   Pool total: ${pool.totalCount}`)
    console.log(`   Pool idle: ${pool.idleCount}`)
    console.log(`   Pool waiting: ${pool.waitingCount}`)
    
  } catch (error) {
    console.error('   ❌ Database error:', error)
  }
  
  console.log('')
  
  // Elasticsearch performance metrics
  console.log('🔍 Elasticsearch Performance:')
  try {
    const es = new Client({
      node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200'
    })
    
    // Test connection
    const esStart = Date.now()
    const info = await es.info()
    const esTime = Date.now() - esStart
    console.log(`   Connection time: ${esTime}ms`)
    console.log(`   Version: ${info.version.number}`)
    
    // Test search performance
    const searchStart = Date.now()
    const searchResult = await es.search({
      index: 'recipes',
      body: {
        query: { match_all: {} },
        size: 0
      }
    })
    const searchTime = Date.now() - searchStart
    console.log(`   Search time: ${searchTime}ms`)
    console.log(`   Total documents: ${searchResult.hits.total.value}`)
    
    // Index stats
    const stats = await es.indices.stats({ index: 'recipes' })
    const indexStats = stats.indices.recipes
    console.log(`   Index size: ${(indexStats.total.store.size_in_bytes / 1024 / 1024).toFixed(2)} MB`)
    console.log(`   Document count: ${indexStats.total.docs.count}`)
    
  } catch (error) {
    console.error('   ❌ Elasticsearch error:', error)
  }
  
  console.log('')
  console.log('💡 Performance Tips:')
  console.log('   - Use npm run client:ultra for maximum speed')
  console.log('   - Increase batch sizes for parallel processing')
  console.log('   - Monitor memory usage during large operations')
  console.log('   - Consider SSD storage for better I/O performance')
  console.log('')
  
  await pool.end()
}

monitorPerformance().catch(console.error)
