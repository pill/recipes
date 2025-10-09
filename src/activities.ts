import csvParser from 'csv-parser'
import fs from 'fs'
import path from 'path'
import { config } from 'dotenv'

config()

import { getAIService } from './services/AIService.js'
import { RecipeExtractionSchema } from './schemas/recipe-extraction.js'

// CSV format of the reddit recipes dataset
type RowData = {
  date: string
  num_comments: string
  title: string
  user: string
  comment: string
  n_char: string
}

export interface ProcessRecipeEntryInput {
  csvFilePath: string
  entryNumber: number
}

export interface ProcessRecipeEntryResult {
  success: boolean
  outputFilePath?: string
  skipped?: boolean
  error?: string
  entryNumber: number
}

/**
 * Activity to process a single CSV entry and extract recipe data
 */
export async function processRecipeEntry(
  input: ProcessRecipeEntryInput
): Promise<ProcessRecipeEntryResult> {
  const { csvFilePath, entryNumber } = input

  try {
    const aiService = getAIService()

    // Validate AI service
    if (!aiService.isConfigured()) {
      throw new Error('AI Service not configured. Set ANTHROPIC_API_KEY environment variable.')
    }

    // Validate entry number
    if (entryNumber < 1) {
      throw new Error('Entry number must be >= 1')
    }

    // Check if CSV file exists
    if (!fs.existsSync(csvFilePath)) {
      throw new Error(`CSV file not found: ${csvFilePath}`)
    }

    // Define output file path
    const outputDir = path.join(path.dirname(csvFilePath), '..', 'stage')
    const csvFileName = path.basename(csvFilePath, '.csv')
    const outputFilePath = path.join(outputDir, `${csvFileName}_entry_${entryNumber}.json`)

    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    // Check if output file already exists
    if (fs.existsSync(outputFilePath)) {
      console.log(`[Activity] Output file already exists: ${outputFilePath}`)
      return {
        success: true,
        skipped: true,
        outputFilePath,
        entryNumber
      }
    }

    console.log(`[Activity] Processing entry ${entryNumber} from ${csvFilePath}...`)

    // Find the target entry in the CSV
    const targetRow = await findCsvEntry(csvFilePath, entryNumber)

    if (!targetRow) {
      throw new Error(`Entry ${entryNumber} not found in CSV file`)
    }

    console.log(`[Activity] Found entry ${entryNumber}:`)
    console.log(`  Title: ${targetRow.title}`)
    console.log(`  User: ${targetRow.user}`)
    console.log(`  Date: ${targetRow.date}`)
    console.log(`  Comment length: ${targetRow.n_char} characters`)
    console.log('\n[Activity] Extracting structured recipe data...')

    const result = await aiService.extractStructuredData(
      targetRow.comment,
      RecipeExtractionSchema
    )

    // Save result with metadata
    const output = {
      entryNumber,
      metadata: {
        title: targetRow.title,
        user: targetRow.user,
        date: targetRow.date,
        num_comments: targetRow.num_comments,
        n_char: targetRow.n_char
      },
      recipeData: result
    }

    fs.writeFileSync(outputFilePath, JSON.stringify(output, null, 2))
    console.log(`[Activity] Successfully saved to: ${outputFilePath}`)

    return {
      success: true,
      outputFilePath,
      entryNumber
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[Activity] Error processing entry ${entryNumber}:`, errorMessage)
    return {
      success: false,
      error: errorMessage,
      entryNumber
    }
  }
}

/**
 * Helper function to find a specific entry in a CSV file
 */
async function findCsvEntry(csvFilePath: string, entryNumber: number): Promise<RowData | null> {
  return new Promise((resolve, reject) => {
    let currentRow = 0
    let targetRow: RowData | null = null

    const stream = fs.createReadStream(csvFilePath)
      .pipe(csvParser())
      .on('data', (row: RowData) => {
        currentRow++
        if (currentRow === entryNumber) {
          targetRow = row
          stream.destroy() // Stop reading once we found our entry
        }
      })
      .on('end', () => {
        resolve(targetRow)
      })
      .on('close', () => {
        resolve(targetRow)
      })
      .on('error', (error) => {
        reject(error)
      })
  })
}

