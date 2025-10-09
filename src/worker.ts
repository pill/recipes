import { Worker, NativeConnection } from '@temporalio/worker'
import * as activities from './activities.js'
import { config } from 'dotenv'

config()

/**
 * Run a Temporal Worker to process recipe extraction activities
 * 
 * Worker Configuration:
 * - Task queue: 'recipe-processing'
 * - Max concurrent activities: Configurable via WORKER_MAX_CONCURRENT_ACTIVITIES (default: 1)
 *   Setting this to 1 ensures strict rate limiting
 * 
 * Usage:
 * npm run worker
 * 
 * Or with custom concurrency:
 * WORKER_MAX_CONCURRENT_ACTIVITIES=2 npm run worker
 */
async function run() {
  // Get max concurrent activities from environment or default to 1
  const maxConcurrentActivityExecutions = parseInt(
    process.env.WORKER_MAX_CONCURRENT_ACTIVITIES || '1',
    10
  )

  console.log('Starting Temporal Worker...')
  console.log(`Max concurrent activities: ${maxConcurrentActivityExecutions}`)
  console.log('Task queue: recipe-processing')

  // Create connection to Temporal server
  const connection = await NativeConnection.connect({
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233'
  })

  // Create and run the worker
  const worker = await Worker.create({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || 'default',
    taskQueue: 'recipe-processing',
    workflowsPath: require.resolve('./workflows'),
    activities,
    maxConcurrentActivityTaskExecutions: maxConcurrentActivityExecutions
  })

  console.log('Worker started successfully!')
  console.log('Waiting for workflow executions...')

  await worker.run()
}

run().catch((err) => {
  console.error('Worker error:', err)
  process.exit(1)
})

