import { Client, Connection } from '@temporalio/client'
import { processRecipeBatchLocalParallel, loadRecipesToDbParallel } from './workflows.js'
import fs from 'fs'
import path from 'path'

/**
 * ULTRA-FAST parallel processing client
 * 
 * This client maximizes performance by:
 * 1. Using maximum parallel batch sizes
 * 2. Processing CSV parsing and DB loading in parallel
 * 3. Optimized for high-throughput processing
 * 4. Supports batch-based processing for large datasets
 * 
 * Usage: npm run client:ultra -- <csv_file_path> <start_entry> <end_entry> [batch_size] [start_batch]
 */
async function main() {
  const args = process.argv.slice(2)
  
  if (args.length < 3) {
    console.log('Usage: npm run client:ultra -- <csv_file_path> <start_entry> <end_entry> [batch_size] [start_batch]')
    console.log('')
    console.log('Examples:')
    console.log('  # Process entries 1-1000 with maximum parallelization')
    console.log('  npm run client:ultra -- data/raw/Reddit_Recipes.csv 1 1000')
    console.log('')
    console.log('  # Process Stromberg entries 1-500')
    console.log('  npm run client:ultra -- data/raw/stromberg_data.csv 1 500')
    console.log('')
    console.log('  # Process in batches of 1000, starting from batch 5')
    console.log('  npm run client:ultra -- data/raw/stromberg_data.csv 1 10000 1000 5')
    console.log('')
    console.log('  # Resume Stromberg processing from batch 10')
    console.log('  npm run client:ultra -- data/raw/stromberg_data.csv 1 100000 1000 10')
    process.exit(1)
  }

  const csvFilePath = args[0]
  const startEntry = parseInt(args[1])
  const endEntry = parseInt(args[2])
  const batchSize = args[3] ? parseInt(args[3]) : 1000
  const startBatch = args[4] ? parseInt(args[4]) : 0

  // Validate arguments
  if (isNaN(startEntry) || startEntry < 1) {
    console.error('Error: start_entry must be a positive integer')
    process.exit(1)
  }

  if (isNaN(endEntry) || endEntry < startEntry) {
    console.error('Error: end_entry must be an integer greater than or equal to start_entry')
    process.exit(1)
  }

  if (isNaN(batchSize) || batchSize < 1) {
    console.error('Error: batch_size must be a positive integer')
    process.exit(1)
  }

  if (isNaN(startBatch) || startBatch < 0) {
    console.error('Error: start_batch must be a non-negative integer')
    process.exit(1)
  }

  // Calculate actual processing range based on batch parameters
  const totalEntries = endEntry - startEntry + 1
  const totalBatches = Math.ceil(totalEntries / batchSize)
  const batchesToProcess = totalBatches - startBatch
  const actualStartEntry = startEntry + (startBatch * batchSize)
  const actualEndEntry = Math.min(actualStartEntry + (batchesToProcess * batchSize) - 1, endEntry)

  console.log('🚀 Starting ULTRA-FAST Parallel Processing Client')
  console.log(`📁 CSV File: ${csvFilePath}`)
  console.log(`📊 Total Entries: ${startEntry} to ${endEntry} (${totalEntries.toLocaleString()} total)`)
  console.log(`📦 Batch Size: ${batchSize}`)
  console.log(`🔄 Processing: Batches ${startBatch + 1}-${totalBatches} (${batchesToProcess} batches)`)
  console.log(`📊 Actual Range: ${actualStartEntry} to ${actualEndEntry} (${actualEndEntry - actualStartEntry + 1} entries)`)
  console.log('⚡ Using maximum parallelization for speed!')
  console.log('')

  // Create connection to Temporal server
  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233'
  })

  const client = new Client({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || 'default'
  })

  try {
    const startTime = Date.now()

    // Step 1: Process CSV entries with maximum parallelization
    console.log('🔄 Step 1: Processing CSV entries...')
    const csvResult = await client.workflow.execute(processRecipeBatchLocalParallel, {
      taskQueue: 'recipe-processing',
      workflowId: `ultra-fast-csv-${Date.now()}`,
      args: [{
        csvFilePath,
        startEntry: actualStartEntry,
        endEntry: actualEndEntry,
        batchSize: 20, // Maximum parallel batch size
        delayBetweenBatchesMs: 0 // No delay for maximum speed
      }]
    })

    console.log('✅ CSV processing complete!')
    console.log(`   Total: ${csvResult.totalProcessed}`)
    console.log(`   Success: ${csvResult.successful}`)
    console.log(`   Skipped: ${csvResult.skipped}`)
    console.log(`   Failed: ${csvResult.failed}`)
    console.log('')

    // Step 2: Find generated JSON files
    console.log('🔍 Step 2: Finding generated JSON files...')
    const stageDir = path.dirname(csvFilePath).replace('raw', 'stage')
    const csvBaseName = path.basename(csvFilePath, '.csv')
    const stageSubDir = path.join(stageDir, csvBaseName)
    
    if (!fs.existsSync(stageSubDir)) {
      console.error(`❌ Stage directory not found: ${stageSubDir}`)
      process.exit(1)
    }

    const jsonFiles = fs.readdirSync(stageSubDir)
      .filter(f => f.endsWith('.json'))
      .map(f => path.join(stageSubDir, f))
      .filter(f => {
        // Only process files from the current batch range
        const match = f.match(/entry_(\d+)\.json$/)
        if (!match) return false
        const entryNum = parseInt(match[1])
        return entryNum >= actualStartEntry && entryNum <= actualEndEntry
      })
      .sort()

    console.log(`📁 Found ${jsonFiles.length} JSON files to load`)
    console.log('')

    // Step 3: Load to database with maximum parallelization
    console.log('💾 Step 3: Loading to database...')
    const dbResult = await client.workflow.execute(loadRecipesToDbParallel, {
      taskQueue: 'recipe-processing',
      workflowId: `ultra-fast-db-${Date.now()}`,
      args: [{
        jsonFilePaths: jsonFiles,
        batchSize: 15, // High parallel batch size for DB operations
        delayBetweenBatchesMs: 0 // No delay for maximum speed
      }]
    })

    console.log('✅ Database loading complete!')
    console.log(`   Total: ${dbResult.totalProcessed}`)
    console.log(`   Success: ${dbResult.successful}`)
    console.log(`   Already Exists: ${dbResult.alreadyExists}`)
    console.log(`   Failed: ${dbResult.failed}`)
    console.log('')

    // Summary
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2)
    const recipesPerSecond = ((csvResult.successful + dbResult.successful) / 2 / (parseInt(totalTime))).toFixed(2)
    
    console.log('🎉 ULTRA-FAST Processing Complete!')
    console.log('==========================================')
    console.log(`⏱️  Total Time: ${totalTime}s`)
    console.log(`⚡ Speed: ~${recipesPerSecond} recipes/second`)
    console.log(`📊 CSV Success: ${csvResult.successful}/${csvResult.totalProcessed}`)
    console.log(`💾 DB Success: ${dbResult.successful}/${dbResult.totalProcessed}`)
    console.log(`📦 Processed Batches: ${startBatch + 1}-${totalBatches} (${batchesToProcess} batches)`)
    console.log('')
    console.log('🚀 Next steps:')
    console.log('   1. Sync to Elasticsearch: npm run sync:search')
    console.log('   2. Start the React app: cd client/recipe-client && npm run dev')
    console.log('')
    console.log('🔄 To continue processing more batches:')
    console.log(`   npm run client:ultra -- ${csvFilePath} ${startEntry} ${endEntry} ${batchSize} ${totalBatches}`)
    console.log('')

  } catch (error) {
    console.error('❌ Ultra-fast processing failed:', error)
    process.exit(1)
  } finally {
    await connection.close()
  }
}

main().catch(console.error)
