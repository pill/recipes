import { Client, Connection } from '@temporalio/client'
import { processRecipeBatchLocalParallel } from './workflows'

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2)
  
  if (args.length < 3) {
    console.log('Usage: npm run client:local:parallel -- <csv_file_path> <start_entry> <end_entry> [batch_size] [delay_between_batches_ms]')
    console.log('')
    console.log('Examples:')
    console.log('  # Process entries 1-20 with default batch size of 5')
    console.log('  npm run client:local:parallel -- data/raw/Reddit_Recipes.csv 1 20')
    console.log('')
    console.log('  # Process entries 1-100 with batch size of 10')
    console.log('  npm run client:local:parallel -- data/raw/Reddit_Recipes.csv 1 100 10')
    console.log('')
    console.log('  # Process entries 1-50 with batch size of 8 and 100ms delay between batches')
    console.log('  npm run client:local:parallel -- data/raw/Reddit_Recipes.csv 1 50 8 100')
    console.log('')
    console.log('  # Process Stromberg entries 1-30 with batch size of 15')
    console.log('  npm run client:local:parallel -- data/raw/stromberg_data.csv 1 30 15')
    process.exit(1)
  }

  const csvFilePath = args[0]
  const startEntry = parseInt(args[1])
  const endEntry = parseInt(args[2])
  const batchSize = args[3] ? parseInt(args[3]) : 5
  const delayBetweenBatchesMs = args[4] ? parseInt(args[4]) : 0

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

  if (isNaN(delayBetweenBatchesMs) || delayBetweenBatchesMs < 0) {
    console.error('Error: delay_between_batches_ms must be a non-negative integer')
    process.exit(1)
  }

  console.log('🚀 Starting PARALLELIZED Local Recipe Processing Workflow')
  console.log(`📁 CSV File: ${csvFilePath}`)
  console.log(`📊 Entries: ${startEntry} to ${endEntry} (${endEntry - startEntry + 1} total)`)
  console.log(`⚡ Batch Size: ${batchSize} (processing ${batchSize} entries in parallel)`)
  console.log(`⏱️  Delay between batches: ${delayBetweenBatchesMs}ms`)
  console.log('💡 Using LOCAL parsing (no AI) - fast and free!')
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
    // Start the parallelized workflow
    const workflowId = `recipe-batch-local-parallel-${Date.now()}`
    const handle = await client.workflow.start(processRecipeBatchLocalParallel, {
      args: [{
        csvFilePath,
        startEntry,
        endEntry,
        batchSize,
        delayBetweenBatchesMs
      }],
      taskQueue: 'recipe-processing',
      workflowId
    })

    console.log(`✅ Workflow started with ID: ${workflowId}`)
    console.log('📋 You can check progress in the Temporal UI: http://localhost:8080')
    console.log('')

    // Wait for the workflow to complete and get the result
    const result = await handle.result()

    console.log('')
    console.log('🎉 Workflow completed!')
    console.log('')
    console.log('📊 Results Summary:')
    console.log(`   Total Processed: ${result.totalProcessed}`)
    console.log(`   ✅ Successful: ${result.successful}`)
    console.log(`   ⏭️  Skipped: ${result.skipped}`)
    console.log(`   ❌ Failed: ${result.failed}`)
    console.log('')

    // Show detailed results for failed entries
    const failedEntries = result.results.filter(r => !r.success)
    if (failedEntries.length > 0) {
      console.log('❌ Failed Entries:')
      failedEntries.forEach(entry => {
        console.log(`   Entry ${entry.entryNumber}: ${entry.error}`)
      })
      console.log('')
    }

    // Show some successful entries
    const successfulEntries = result.results.filter(r => r.success && !r.skipped)
    if (successfulEntries.length > 0) {
      console.log('✅ Sample Successful Entries:')
      successfulEntries.slice(0, 5).forEach(entry => {
        console.log(`   Entry ${entry.entryNumber}: ${entry.outputFilePath}`)
      })
      if (successfulEntries.length > 5) {
        console.log(`   ... and ${successfulEntries.length - 5} more`)
      }
      console.log('')
    }

    console.log('💡 Performance Tips:')
    console.log('   - Increase batch_size for faster processing (try 10-20)')
    console.log('   - Set delay_between_batches_ms to 0 for maximum speed')
    console.log('   - Monitor system resources if using very large batch sizes')
    console.log('')

  } catch (error) {
    console.error('❌ Error starting or running workflow:', error)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('❌ Fatal error:', error)
  process.exit(1)
})
