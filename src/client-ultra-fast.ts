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
 * 
 * Usage: npm run client:ultra -- <csv_file_path> <start_entry> <end_entry>
 */
async function main() {
  const args = process.argv.slice(2)
  
  if (args.length < 3) {
    console.log('Usage: npm run client:ultra -- <csv_file_path> <start_entry> <end_entry>')
    console.log('')
    console.log('Examples:')
    console.log('  # Process entries 1-1000 with maximum parallelization')
    console.log('  npm run client:ultra -- data/raw/Reddit_Recipes.csv 1 1000')
    console.log('')
    console.log('  # Process Stromberg entries 1-500')
    console.log('  npm run client:ultra -- data/raw/stromberg_data.csv 1 500')
    process.exit(1)
  }

  const csvFilePath = args[0]
  const startEntry = parseInt(args[1])
  const endEntry = parseInt(args[2])

  // Validate arguments
  if (isNaN(startEntry) || startEntry < 1) {
    console.error('Error: start_entry must be a positive integer')
    process.exit(1)
  }

  if (isNaN(endEntry) || endEntry < startEntry) {
    console.error('Error: end_entry must be an integer greater than or equal to start_entry')
    process.exit(1)
  }

  console.log('🚀 Starting ULTRA-FAST Parallel Processing Client')
  console.log(`📁 CSV File: ${csvFilePath}`)
  console.log(`📊 Entries: ${startEntry} to ${endEntry} (${endEntry - startEntry + 1} total)`)
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
        startEntry,
        endEntry,
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
    console.log('')
    console.log('🚀 Next steps:')
    console.log('   1. Sync to Elasticsearch: npm run sync:search')
    console.log('   2. Start the React app: cd client/recipe-client && npm run dev')
    console.log('')

  } catch (error) {
    console.error('❌ Ultra-fast processing failed:', error)
    process.exit(1)
  } finally {
    await connection.close()
  }
}

main().catch(console.error)
