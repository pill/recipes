import { Connection, Client } from '@temporalio/client'
import { loadRecipesToDb } from './workflows.js'
import { config } from 'dotenv'
import fs from 'fs'
import path from 'path'

config()

/**
 * Client script to load recipe JSON files into the database using Temporal
 * 
 * Usage:
 * npm run client:load -- <directory-pattern> [delay-ms]
 * 
 * Examples:
 * npm run client:load -- "data/stage/*.json"
 * npm run client:load -- "data/stage/Reddit_Recipes_entry_*.json" 100
 * npm run client:load -- "data/stage/Reddit_Recipes_entry_{1..20}.json"
 * 
 * Arguments:
 * - directory-pattern: Glob pattern or directory path for JSON files
 * - delay-ms: (optional) Delay between database inserts in milliseconds (default: 100)
 *   Lower delays are fine for database operations since there are no API rate limits
 */
async function run() {
  const args = process.argv.slice(2)

  if (args.length < 1) {
    console.error('Usage: npm run client:load -- <directory-pattern> [delay-ms]')
    console.error('')
    console.error('Examples:')
    console.error('  npm run client:load -- "data/stage/*.json"')
    console.error('  npm run client:load -- "data/stage/" 100')
    console.error('  Load all JSON files in data/stage directory')
    console.error('')
    console.error('Note: Put glob patterns in quotes to prevent shell expansion')
    process.exit(1)
  }

  const pattern = args[0]
  const delayBetweenActivitiesMs = args[1] ? parseInt(args[1], 10) : 100

  // Get list of JSON files
  let jsonFilePaths: string[] = []

  // Check if pattern is a directory
  if (fs.existsSync(pattern) && fs.statSync(pattern).isDirectory()) {
    const files = fs.readdirSync(pattern)
    jsonFilePaths = files
      .filter(f => f.endsWith('.json'))
      .map(f => path.join(pattern, f))
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

  console.log('Starting Temporal Client for Database Loading...')
  console.log(`Found ${jsonFilePaths.length} JSON files to process`)
  console.log(`Delay between files: ${delayBetweenActivitiesMs}ms`)
  console.log('')

  // Show first few files as preview
  const preview = jsonFilePaths.slice(0, 5)
  console.log('Files to process (showing first 5):')
  preview.forEach(f => console.log(`  - ${f}`))
  if (jsonFilePaths.length > 5) {
    console.log(`  ... and ${jsonFilePaths.length - 5} more`)
  }
  console.log('')

  // Estimate time
  const estimatedTimeSeconds = (jsonFilePaths.length * delayBetweenActivitiesMs) / 1000
  const estimatedMinutes = Math.ceil(estimatedTimeSeconds / 60)
  console.log(`Estimated minimum time: ~${estimatedMinutes} minutes`)
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
  const workflowId = `load-recipes-db-${Date.now()}`
  console.log(`Starting workflow: ${workflowId}`)

  const handle = await client.workflow.start(loadRecipesToDb, {
    taskQueue: 'recipe-processing',
    workflowId,
    args: [{
      jsonFilePaths,
      delayBetweenActivitiesMs
    }]
  })

  console.log(`Workflow started with ID: ${handle.workflowId}`)
  console.log(`Run ID: ${handle.firstExecutionRunId}`)
  console.log('')
  console.log('Loading recipes to database...')
  console.log('(You can safely Ctrl+C and the workflow will continue in the background)')
  console.log('')

  // Wait for the workflow to complete
  const result = await handle.result()

  console.log('')
  console.log('==========================================')
  console.log('Database Loading Complete!')
  console.log('==========================================')
  console.log(`Total Processed: ${result.totalProcessed}`)
  console.log(`Successfully Inserted: ${result.successful}`)
  console.log(`Already Exists (skipped): ${result.alreadyExists}`)
  console.log(`Failed: ${result.failed}`)
  console.log('')

  if (result.failed > 0) {
    console.log('Failed files:')
    result.results
      .filter(r => !r.success)
      .forEach(r => {
        console.log(`  ${r.jsonFilePath}: ${r.error}`)
      })
    console.log('')
  }

  if (result.successful > 0) {
    console.log('Sample of successfully inserted recipes:')
    result.results
      .filter(r => r.success && !r.alreadyExists)
      .slice(0, 5)
      .forEach(r => {
        console.log(`  ID ${r.recipeId}: ${r.title}`)
      })
    console.log('')
  }

  console.log('Check the database:')
  console.log('  docker exec -it reddit-recipes-db psql -U postgres -d recipes -c "SELECT COUNT(*) FROM recipes;"')
}

run().catch((err) => {
  console.error('Client error:', err)
  process.exit(1)
})

