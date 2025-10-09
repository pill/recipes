import { Connection, Client } from '@temporalio/client'
import { processRecipeBatch } from './workflows.js'
import { config } from 'dotenv'

config()

/**
 * Client script to start recipe processing workflows
 * 
 * Usage:
 * npm run client -- <csv-file-path> <start-entry> <end-entry> [delay-ms]
 * 
 * Examples:
 * npm run client -- data/raw/Reddit_Recipes.csv 1 10 2000
 * npm run client -- data/raw/Reddit_Recipes_2.csv 50 100 1000
 * 
 * Arguments:
 * - csv-file-path: Path to the CSV file
 * - start-entry: First entry number to process (1-indexed)
 * - end-entry: Last entry number to process (inclusive)
 * - delay-ms: (optional) Delay between activities in milliseconds (default: 1000)
 *   Increase this to avoid rate limits. Anthropic rate limits:
 *   - Claude Sonnet: 50 requests/min (recommend 1500ms delay)
 *   - Claude Haiku: 50 requests/min (recommend 1500ms delay)
 */
async function run() {
  const args = process.argv.slice(2)

  if (args.length < 3) {
    console.error('Usage: npm run client -- <csv-file-path> <start-entry> <end-entry> [delay-ms]')
    console.error('Example: npm run client -- data/raw/Reddit_Recipes.csv 1 10 2000')
    console.error('')
    console.error('Delay recommendations based on Anthropic rate limits:')
    console.error('  - 50 req/min: 1200ms+ delay (safe)')
    console.error('  - 100 req/min: 600ms+ delay (if you have higher tier)')
    process.exit(1)
  }

  const csvFilePath = args[0]
  const startEntry = parseInt(args[1], 10)
  const endEntry = parseInt(args[2], 10)
  const delayBetweenActivitiesMs = args[3] ? parseInt(args[3], 10) : 1000

  if (isNaN(startEntry) || isNaN(endEntry)) {
    console.error('Error: start-entry and end-entry must be valid integers')
    process.exit(1)
  }

  if (startEntry < 1 || endEntry < startEntry) {
    console.error('Error: start-entry must be >= 1 and end-entry must be >= start-entry')
    process.exit(1)
  }

  console.log('Starting Temporal Client...')
  console.log(`CSV File: ${csvFilePath}`)
  console.log(`Entry Range: ${startEntry} to ${endEntry} (${endEntry - startEntry + 1} entries)`)
  console.log(`Delay between activities: ${delayBetweenActivitiesMs}ms`)
  console.log('')

  // Calculate estimated time
  const totalEntries = endEntry - startEntry + 1
  const estimatedTimeSeconds = (totalEntries * delayBetweenActivitiesMs) / 1000
  const estimatedMinutes = Math.ceil(estimatedTimeSeconds / 60)
  console.log(`Estimated minimum time: ~${estimatedMinutes} minutes (not including AI processing time)`)
  console.log('')

  // Create connection to Temporal server
  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233'
  })

  const client = new Client({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || 'default'
  })

  // Start the workflow
  const workflowId = `process-recipes-${Date.now()}`
  console.log(`Starting workflow: ${workflowId}`)

  const handle = await client.workflow.start(processRecipeBatch, {
    taskQueue: 'recipe-processing',
    workflowId,
    args: [{
      csvFilePath,
      startEntry,
      endEntry,
      delayBetweenActivitiesMs
    }]
  })

  console.log(`Workflow started with ID: ${handle.workflowId}`)
  console.log(`Run ID: ${handle.firstExecutionRunId}`)
  console.log('')
  console.log('Waiting for workflow to complete...')
  console.log('(You can safely Ctrl+C and the workflow will continue in the background)')
  console.log('')

  // Wait for the workflow to complete
  const result = await handle.result()

  console.log('')
  console.log('==========================================')
  console.log('Workflow Complete!')
  console.log('==========================================')
  console.log(`Total Processed: ${result.totalProcessed}`)
  console.log(`Successful: ${result.successful}`)
  console.log(`Skipped (already exists): ${result.skipped}`)
  console.log(`Failed: ${result.failed}`)
  console.log('')

  if (result.failed > 0) {
    console.log('Failed entries:')
    result.results
      .filter(r => !r.success)
      .forEach(r => {
        console.log(`  Entry ${r.entryNumber}: ${r.error}`)
      })
  }

  console.log('')
  console.log('Output files saved to: data/stage/')
}

run().catch((err) => {
  console.error('Client error:', err)
  process.exit(1)
})

