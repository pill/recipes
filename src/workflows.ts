import { proxyActivities, sleep } from '@temporalio/workflow'
import type * as activities from './activities'

// Proxy activities with timeout settings
const { processRecipeEntry } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 minutes', // Max time for a single recipe extraction
  retry: {
    initialInterval: '5s',
    maximumInterval: '1m',
    maximumAttempts: 3,
    backoffCoefficient: 2
  }
})

export interface ProcessRecipeBatchInput {
  csvFilePath: string
  startEntry: number
  endEntry: number
  delayBetweenActivitiesMs?: number // Delay to throttle API calls
}

export interface ProcessRecipeBatchResult {
  totalProcessed: number
  successful: number
  skipped: number
  failed: number
  results: Array<{
    entryNumber: number
    success: boolean
    skipped?: boolean
    outputFilePath?: string
    error?: string
  }>
}

/**
 * Workflow to process a batch of recipe entries from a CSV file
 * 
 * This workflow processes entries sequentially with configurable delays
 * to avoid hitting API rate limits.
 */
export async function processRecipeBatch(
  input: ProcessRecipeBatchInput
): Promise<ProcessRecipeBatchResult> {
  const { csvFilePath, startEntry, endEntry, delayBetweenActivitiesMs = 1000 } = input

  console.log(`[Workflow] Processing entries ${startEntry} to ${endEntry} from ${csvFilePath}`)
  console.log(`[Workflow] Delay between activities: ${delayBetweenActivitiesMs}ms`)

  const results: ProcessRecipeBatchResult = {
    totalProcessed: 0,
    successful: 0,
    skipped: 0,
    failed: 0,
    results: []
  }

  // Process each entry sequentially
  for (let entryNumber = startEntry; entryNumber <= endEntry; entryNumber++) {
    console.log(`[Workflow] Processing entry ${entryNumber}/${endEntry}`)

    try {
      const result = await processRecipeEntry({
        csvFilePath,
        entryNumber
      })

      results.totalProcessed++

      if (result.success) {
        if (result.skipped) {
          results.skipped++
        } else {
          results.successful++
        }
      } else {
        results.failed++
      }

      results.results.push({
        entryNumber: result.entryNumber,
        success: result.success,
        skipped: result.skipped,
        outputFilePath: result.outputFilePath,
        error: result.error
      })

      // Add delay between activities to throttle API calls (except for last entry)
      if (entryNumber < endEntry && delayBetweenActivitiesMs > 0) {
        console.log(`[Workflow] Sleeping for ${delayBetweenActivitiesMs}ms...`)
        await sleep(delayBetweenActivitiesMs)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`[Workflow] Error processing entry ${entryNumber}:`, errorMessage)
      
      results.totalProcessed++
      results.failed++
      results.results.push({
        entryNumber,
        success: false,
        error: errorMessage
      })
    }
  }

  console.log(`[Workflow] Batch processing complete!`)
  console.log(`[Workflow] Total: ${results.totalProcessed}, Success: ${results.successful}, Skipped: ${results.skipped}, Failed: ${results.failed}`)

  return results
}

