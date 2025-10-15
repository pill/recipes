import { Connection, Client } from '@temporalio/client'
import { loadRecipesToDbParallel } from './workflows.js'
import { config } from 'dotenv'
import fs from 'fs'
import path from 'path'

config()

/**
 * PARALLELIZED Client script to load recipe JSON files into the database using Temporal
 * 
 * Usage:
 * npm run client:load:parallel -- <directory-pattern> [batch-size] [delay-between-batches-ms]
 * 
 * Examples:
 * npm run client:load:parallel -- "data/stage/*.json"
 * npm run client:load:parallel -- "data/stage/Reddit_Recipes_entry_*.json" 20
 * npm run client:load:parallel -- "data/stage/" 15 0
 * npm run client:load:parallel -- "data/stage/stromberg_data/" 25 50
 * 
 * Arguments:
 * - directory-pattern: Glob pattern or directory path for JSON files
 * - batch-size: (optional) Number of files to process in parallel (default: 10)
 * - delay-between-batches-ms: (optional) Delay between batches in milliseconds (default: 0)
 * 
 * Performance Tips:
 * - Use batch-size 10-25 for optimal performance
 * - Set delay-between-batches-ms to 0 for maximum speed
 * - Monitor database connection limits if using very large batch sizes
 */
async function run() {
  const args = process.argv.slice(2)

  if (args.length < 1) {
    console.error('Usage: npm run client:load:parallel -- <directory-pattern> [batch-size] [delay-between-batches-ms]')
    console.error('')
    console.error('Examples:')
    console.error('  npm run client:load:parallel -- "data/stage/*.json"')
    console.error('  npm run client:load:parallel -- "data/stage/" 20')
    console.error('  npm run client:load:parallel -- "data/stage/stromberg_data/" 15 0')
    console.error('  npm run client:load:parallel -- "data/stage/Reddit_Recipes/" 25 50')
    console.error('')
    console.error('Arguments:')
    console.error('  - directory-pattern: Directory path or glob pattern for JSON files')
    console.error('  - batch-size: Number of files to process in parallel (default: 10)')
    console.error('  - delay-between-batches-ms: Delay between batches in ms (default: 0)')
    console.error('')
    console.error('Performance Tips:')
    console.error('  - Use batch-size 10-25 for optimal performance')
    console.error('  - Set delay-between-batches-ms to 0 for maximum speed')
    console.error('  - Monitor database connection limits if using very large batch sizes')
    process.exit(1)
  }

  const pattern = args[0]
  const batchSize = args[1] ? parseInt(args[1], 10) : 10
  const delayBetweenBatchesMs = args[2] ? parseInt(args[2], 10) : 0

  // Validate arguments
  if (isNaN(batchSize) || batchSize < 1) {
    console.error('Error: batch-size must be a positive integer')
    process.exit(1)
  }

  if (isNaN(delayBetweenBatchesMs) || delayBetweenBatchesMs < 0) {
    console.error('Error: delay-between-batches-ms must be a non-negative integer')
    process.exit(1)
  }

  // Get list of JSON files
  let jsonFilePaths: string[] = []

  // Check if pattern is a directory
  if (fs.existsSync(pattern) && fs.statSync(pattern).isDirectory()) {
    const files = fs.readdirSync(pattern)
    jsonFilePaths = files
      .filter(f => f.endsWith('.json'))
      .map(f => path.join(pattern, f))
      .sort() // Sort for consistent ordering
  } else {
    // Try to read as a glob pattern or single file
    if (fs.existsSync(pattern)) {
      jsonFilePaths = [pattern]
    } else {
      console.error(`Error: Cannot find files matching pattern: ${pattern}`)
      console.error('Try using: data/stage/')
      process.exit(1)
    }
  }

  if (jsonFilePaths.length === 0) {
    console.error(`No JSON files found matching pattern: ${pattern}`)
    process.exit(1)
  }

  console.log('🚀 Starting PARALLELIZED Database Loading Client')
  console.log(`📁 Found ${jsonFilePaths.length} JSON files to process`)
  console.log(`⚡ Batch Size: ${batchSize} (processing ${batchSize} files in parallel)`)
  console.log(`⏱️  Delay between batches: ${delayBetweenBatchesMs}ms`)
  console.log('')

  // Show first few files as preview
  const preview = jsonFilePaths.slice(0, 5)
  console.log('📋 Files to process (showing first 5):')
  preview.forEach(f => console.log(`   - ${f}`))
  if (jsonFilePaths.length > 5) {
    console.log(`   ... and ${jsonFilePaths.length - 5} more`)
  }
  console.log('')

  // Calculate estimated time with parallelization
  const totalBatches = Math.ceil(jsonFilePaths.length / batchSize)
  const estimatedTimeSeconds = totalBatches * (delayBetweenBatchesMs / 1000) + (jsonFilePaths.length / batchSize) * 0.1 // Rough estimate
  const estimatedMinutes = Math.ceil(estimatedTimeSeconds / 60)
  console.log(`⏰ Estimated time: ~${estimatedMinutes} minutes (${totalBatches} batches)`)
  console.log('💡 This is much faster than sequential loading!')
  console.log('')

  // Create connection to Temporal server
  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233'
  })

  const client = new Client({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || 'default'
  })

  // Start the parallelized workflow
  const workflowId = `load-recipes-db-parallel-${Date.now()}`
  console.log(`✅ Starting parallelized workflow: ${workflowId}`)

  const handle = await client.workflow.start(loadRecipesToDbParallel, {
    taskQueue: 'recipe-processing',
    workflowId,
    args: [{
      jsonFilePaths,
      batchSize,
      delayBetweenBatchesMs
    }]
  })

  console.log(`📋 Workflow started with ID: ${handle.workflowId}`)
  console.log(`🆔 Run ID: ${handle.firstExecutionRunId}`)
  console.log('📊 You can check progress in the Temporal UI: http://localhost:8080')
  console.log('')
  console.log('🔄 Loading recipes to database in parallel...')
  console.log('💡 (You can safely Ctrl+C and the workflow will continue in the background)')
  console.log('')

  // Wait for the workflow to complete
  const result = await handle.result()

  console.log('')
  console.log('🎉 ==========================================')
  console.log('🎉 PARALLELIZED Database Loading Complete!')
  console.log('🎉 ==========================================')
  console.log(`📊 Total Processed: ${result.totalProcessed}`)
  console.log(`✅ Successfully Inserted: ${result.successful}`)
  console.log(`⏭️  Already Exists (skipped): ${result.alreadyExists}`)
  console.log(`❌ Failed: ${result.failed}`)
  console.log('')

  if (result.failed > 0) {
    console.log('❌ Failed files:')
    result.results
      .filter(r => !r.success)
      .forEach(r => {
        console.log(`   ${r.jsonFilePath}: ${r.error}`)
      })
    console.log('')
  }

  if (result.successful > 0) {
    console.log('✅ Sample of successfully inserted recipes:')
    result.results
      .filter(r => r.success && !r.alreadyExists)
      .slice(0, 5)
      .forEach(r => {
        console.log(`   ID ${r.recipeId}: ${r.title}`)
      })
    console.log('')
  }

  console.log('💡 Performance Summary:')
  console.log(`   - Processed ${result.totalProcessed} files in parallel batches`)
  console.log(`   - Batch size: ${batchSize}`)
  console.log(`   - Delay between batches: ${delayBetweenBatchesMs}ms`)
  console.log('')

  console.log('🔍 Check the database:')
  console.log('   docker exec -it reddit-recipes-db psql -U postgres -d recipes -c "SELECT COUNT(*) FROM recipes;"')
  console.log('')

  console.log('💡 Tips for even better performance:')
  console.log('   - Increase batch-size to 15-25 for faster processing')
  console.log('   - Set delay-between-batches-ms to 0 for maximum speed')
  console.log('   - Monitor database connection limits if using very large batch sizes')
}

run().catch((err) => {
  console.error('❌ Client error:', err)
  process.exit(1)
})
