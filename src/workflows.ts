import { proxyActivities, sleep } from '@temporalio/workflow'
import type * as activities from './activities'

// Proxy activities with timeout settings (AI-based processing)
const { processRecipeEntry, loadJsonToDb } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 minutes', // Max time for a single recipe extraction/load
  retry: {
    initialInterval: '5s',
    maximumInterval: '1m',
    maximumAttempts: 3,
    backoffCoefficient: 2
  }
})

// Proxy activities for local parsing (no AI - faster timeout)
const { processRecipeEntryLocal } = proxyActivities<typeof activities>({
  startToCloseTimeout: '2 minutes', // Local parsing is much faster
  retry: {
    initialInterval: '2s',
    maximumInterval: '30s',
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

/**
 * Workflow to process a batch of recipe entries using LOCAL parsing (no AI)
 * 
 * This workflow is much faster and free since it doesn't use AI APIs.
 * Uses pattern matching to extract recipe data.
 */
export async function processRecipeBatchLocal(
  input: ProcessRecipeBatchInput
): Promise<ProcessRecipeBatchResult> {
  const { csvFilePath, startEntry, endEntry, delayBetweenActivitiesMs = 100 } = input

  console.log(`[Workflow Local] Processing entries ${startEntry} to ${endEntry} from ${csvFilePath}`)
  console.log(`[Workflow Local] Using LOCAL parsing (no AI) - faster and free!`)
  console.log(`[Workflow Local] Delay between activities: ${delayBetweenActivitiesMs}ms`)

  const results: ProcessRecipeBatchResult = {
    totalProcessed: 0,
    successful: 0,
    skipped: 0,
    failed: 0,
    results: []
  }

  // Process each entry sequentially
  for (let entryNumber = startEntry; entryNumber <= endEntry; entryNumber++) {
    console.log(`[Workflow Local] Processing entry ${entryNumber}/${endEntry}`)

    try {
      const result = await processRecipeEntryLocal({
        csvFilePath,
        entryNumber
      })

      results.totalProcessed++

      if (result.success) {
        if (result.skipped) {
          console.log(`[Workflow Local] Entry ${entryNumber} skipped (already exists)`)
          results.skipped++
        } else {
          console.log(`[Workflow Local] Entry ${entryNumber} processed successfully`)
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

      // Add small delay between activities (local parsing is fast, so we can use shorter delays)
      if (entryNumber < endEntry && delayBetweenActivitiesMs > 0) {
        console.log(`[Workflow Local] Sleeping for ${delayBetweenActivitiesMs}ms...`)
        await sleep(delayBetweenActivitiesMs)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`[Workflow Local] Error processing entry ${entryNumber}:`, errorMessage)
      
      results.totalProcessed++
      results.failed++
      results.results.push({
        entryNumber,
        success: false,
        error: errorMessage
      })
    }
  }

  console.log(`[Workflow Local] Batch processing complete!`)
  console.log(`[Workflow Local] Total: ${results.totalProcessed}, Success: ${results.successful}, Skipped: ${results.skipped}, Failed: ${results.failed}`)

  return results
}

// ============================================================================
// Database Loading Workflows
// ============================================================================

export interface LoadRecipesToDbInput {
  jsonFilePaths: string[] // Array of JSON file paths to load
  delayBetweenActivitiesMs?: number // Delay between database inserts (default: 100ms)
}

export interface LoadRecipesToDbResult {
  totalProcessed: number
  successful: number
  alreadyExists: number
  failed: number
  results: Array<{
    jsonFilePath: string
    success: boolean
    recipeId?: number
    title?: string
    alreadyExists?: boolean
    error?: string
  }>
}

/**
 * Workflow to load multiple recipe JSON files into the database
 * 
 * This workflow processes files sequentially with minimal delays
 * since database operations don't have the same rate limits as AI APIs.
 */
export async function loadRecipesToDb(
  input: LoadRecipesToDbInput
): Promise<LoadRecipesToDbResult> {
  const { jsonFilePaths, delayBetweenActivitiesMs = 100 } = input

  console.log(`[Workflow] Loading ${jsonFilePaths.length} recipe files to database`)
  console.log(`[Workflow] Delay between activities: ${delayBetweenActivitiesMs}ms`)

  const results: LoadRecipesToDbResult = {
    totalProcessed: 0,
    successful: 0,
    alreadyExists: 0,
    failed: 0,
    results: []
  }

  // Process each JSON file sequentially
  for (let i = 0; i < jsonFilePaths.length; i++) {
    const jsonFilePath = jsonFilePaths[i]
    console.log(`[Workflow] Processing file ${i + 1}/${jsonFilePaths.length}: ${jsonFilePath}`)

    try {
      const result = await loadJsonToDb({ jsonFilePath })

      results.totalProcessed++

      if (result.success) {
        if (result.alreadyExists) {
          results.alreadyExists++
        } else {
          results.successful++
        }
      } else {
        results.failed++
      }

      results.results.push({
        jsonFilePath: result.jsonFilePath,
        success: result.success,
        recipeId: result.recipeId,
        title: result.title,
        alreadyExists: result.alreadyExists,
        error: result.error
      })

      // Add delay between activities (except for last file)
      if (i < jsonFilePaths.length - 1 && delayBetweenActivitiesMs > 0) {
        await sleep(delayBetweenActivitiesMs)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`[Workflow] Error loading file ${jsonFilePath}:`, errorMessage)
      
      results.totalProcessed++
      results.failed++
      results.results.push({
        jsonFilePath,
        success: false,
        error: errorMessage
      })
    }
  }

  console.log(`[Workflow] Database loading complete!`)
  console.log(`[Workflow] Total: ${results.totalProcessed}, Success: ${results.successful}, Already Exists: ${results.alreadyExists}, Failed: ${results.failed}`)

  return results
}

