import { Client, Connection } from '@temporalio/client'
import { processRecipeBatchLocalParallel, loadRecipesToDbParallel } from './workflows.js'
import fs from 'fs'
import path from 'path'

/**
 * Stromberg Bulk Data Pipeline
 * 
 * Processes the entire Stromberg dataset (2.2M+ recipes) in optimized chunks
 * 
 * Usage: npm run stromberg:pipeline -- [chunk_size] [max_chunks]
 * 
 * Examples:
 *   # Process first 10 chunks of 1000 recipes each
 *   npm run stromberg:pipeline -- 1000 10
 *   
 *   # Process first 50 chunks of 500 recipes each  
 *   npm run stromberg:pipeline -- 500 50
 *   
 *   # Process entire dataset in chunks of 2000
 *   npm run stromberg:pipeline -- 2000
 */
async function main() {
  const args = process.argv.slice(2)
  
  const chunkSize = args[0] ? parseInt(args[0]) : 1000
  const maxChunks = args[1] ? parseInt(args[1]) : 10
  
  if (isNaN(chunkSize) || chunkSize < 1) {
    console.error('Error: chunk_size must be a positive integer')
    process.exit(1)
  }
  
  if (isNaN(maxChunks) || maxChunks < 1) {
    console.error('Error: max_chunks must be a positive integer')
    process.exit(1)
  }

  const csvFilePath = 'data/raw/stromberg_data.csv'
  const totalLines = 2231150 // From wc -l
  const totalRecipes = totalLines - 1 // Subtract header row
  const totalChunks = Math.ceil(totalRecipes / chunkSize)
  const chunksToProcess = Math.min(maxChunks, totalChunks)

  console.log('🚀 Stromberg Bulk Data Pipeline Starting')
  console.log('==========================================')
  console.log(`📊 Dataset: ${totalRecipes.toLocaleString()} recipes`)
  console.log(`📦 Chunk size: ${chunkSize} recipes`)
  console.log(`🔄 Processing: ${chunksToProcess} chunks (${(chunksToProcess * chunkSize).toLocaleString()} recipes)`)
  console.log(`⏱️  Estimated time: ~${Math.ceil(chunksToProcess * 2)} minutes`)
  console.log('')

  // Create connection to Temporal server
  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233'
  })

  const client = new Client({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || 'default'
  })

  const startTime = Date.now()
  let totalProcessed = 0
  let totalSuccessful = 0
  let totalFailed = 0

  try {
    for (let chunk = 0; chunk < chunksToProcess; chunk++) {
      const startEntry = chunk * chunkSize + 1
      const endEntry = Math.min((chunk + 1) * chunkSize, totalRecipes)
      const actualChunkSize = endEntry - startEntry + 1
      
      console.log(`\n🔄 Processing Chunk ${chunk + 1}/${chunksToProcess}`)
      console.log(`   Entries: ${startEntry} to ${endEntry} (${actualChunkSize} recipes)`)
      
      const chunkStartTime = Date.now()
      
      // Step 1: Process CSV entries
      console.log('   📝 Converting CSV to JSON...')
      const csvResult = await client.workflow.execute(processRecipeBatchLocalParallel, {
        taskQueue: 'recipe-processing',
        workflowId: `stromberg-chunk-${chunk}-${Date.now()}`,
        args: [{
          csvFilePath,
          startEntry,
          endEntry,
          batchSize: 20, // High parallelization for CSV processing
          delayBetweenBatchesMs: 0
        }]
      })
      
      console.log(`   ✅ CSV: ${csvResult.successful}/${csvResult.totalProcessed} successful`)
      
      // Step 2: Load to database
      console.log('   💾 Loading to database...')
      const stageDir = 'data/stage/stromberg_data'
      const jsonFiles = fs.readdirSync(stageDir)
        .filter(f => f.endsWith('.json'))
        .map(f => path.join(stageDir, f))
        .filter(f => {
          // Only process files from this chunk
          const match = f.match(/entry_(\d+)\.json$/)
          if (!match) return false
          const entryNum = parseInt(match[1])
          return entryNum >= startEntry && entryNum <= endEntry
        })
        .sort()
      
      if (jsonFiles.length > 0) {
        const dbResult = await client.workflow.execute(loadRecipesToDbParallel, {
          taskQueue: 'recipe-processing',
          workflowId: `stromberg-db-chunk-${chunk}-${Date.now()}`,
          args: [{
            jsonFilePaths: jsonFiles,
            batchSize: 15, // High parallelization for DB loading
            delayBetweenBatchesMs: 0
          }]
        })
        
        console.log(`   ✅ DB: ${dbResult.successful}/${dbResult.totalProcessed} successful`)
        
        totalProcessed += csvResult.totalProcessed
        totalSuccessful += Math.min(csvResult.successful, dbResult.successful)
        totalFailed += csvResult.failed + dbResult.failed
      } else {
        console.log('   ⚠️  No JSON files found for this chunk')
        totalProcessed += csvResult.totalProcessed
        totalSuccessful += csvResult.successful
        totalFailed += csvResult.failed
      }
      
      const chunkTime = ((Date.now() - chunkStartTime) / 1000).toFixed(1)
      const recipesPerSecond = (actualChunkSize / parseFloat(chunkTime)).toFixed(1)
      
      console.log(`   ⏱️  Chunk completed in ${chunkTime}s (${recipesPerSecond} recipes/s)`)
      
      // Progress summary
      const progress = ((chunk + 1) / chunksToProcess * 100).toFixed(1)
      const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1)
      const remaining = ((chunksToProcess - chunk - 1) * parseFloat(chunkTime) / 60).toFixed(1)
      
      console.log(`   📊 Progress: ${progress}% | Elapsed: ${elapsed}m | Remaining: ~${remaining}m`)
      console.log(`   📈 Total: ${totalSuccessful.toLocaleString()}/${totalProcessed.toLocaleString()} successful`)
      
      // Brief pause between chunks to prevent overwhelming the system
      if (chunk < chunksToProcess - 1) {
        console.log('   ⏸️  Pausing 2s before next chunk...')
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
    
    // Final summary
    const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1)
    const overallSpeed = (totalSuccessful / (parseFloat(totalTime) * 60)).toFixed(1)
    
    console.log('\n🎉 Stromberg Pipeline Complete!')
    console.log('==========================================')
    console.log(`⏱️  Total Time: ${totalTime} minutes`)
    console.log(`⚡ Average Speed: ${overallSpeed} recipes/second`)
    console.log(`📊 Total Processed: ${totalProcessed.toLocaleString()}`)
    console.log(`✅ Total Successful: ${totalSuccessful.toLocaleString()}`)
    console.log(`❌ Total Failed: ${totalFailed.toLocaleString()}`)
    console.log(`📈 Success Rate: ${((totalSuccessful / totalProcessed) * 100).toFixed(1)}%`)
    console.log('')
    console.log('🚀 Next steps:')
    console.log('   1. Sync to Elasticsearch: npm run sync:search')
    console.log('   2. Check performance: npm run perf:monitor')
    console.log('   3. Start React app: cd client/recipe-client && npm run dev')
    console.log('')
    console.log('💡 To continue processing more chunks:')
    console.log(`   npm run stromberg:pipeline -- ${chunkSize} ${chunksToProcess + 10}`)
    
  } catch (error) {
    console.error('❌ Pipeline failed:', error)
    process.exit(1)
  } finally {
    await connection.close()
  }
}

main().catch(console.error)
