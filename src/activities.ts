import csvParser from 'csv-parser'
import fs from 'fs'
import path from 'path'
import { config } from 'dotenv'

config()

import { getAIService } from './services/AIService.js'
import { RecipeExtractionSchema } from './schemas/recipe-extraction.js'
import { pool } from './database.js'
import { RecipeService } from './services/RecipeService.js'
import type { Recipe, RecipeIngredient } from './models/Recipe.js'
import type { RecipeExtraction } from './schemas/recipe-extraction.js'

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
      RecipeExtractionSchema,
      {
        systemPrompt: `You are an expert at extracting recipe information from Reddit posts. 
Extract as much information as possible, even if incomplete. 
If a field cannot be determined, use null or omit it.

IMPORTANT for ingredients: 
- ALWAYS separate quantity and unit into different fields
- quantity: ONLY the number (e.g., 2, 1.5, "1-2")
- unit: ONLY the measurement unit (e.g., "cups", "tablespoons", "grams")
- Example: "2 cups flour" → quantity: 2, unit: "cups", name: "flour"
- Example: "1-2 lbs chicken" → quantity: "1-2", unit: "lbs", name: "chicken"

For instructions: break down the steps clearly.
Be flexible with format - Reddit posts may have informal recipe descriptions.
If the text is not a recipe at all, still try to extract any food-related information.`
      }
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

// ============================================================================
// Database Loading Activities
// ============================================================================

interface JsonRecipeFile {
  entryNumber: number
  metadata: {
    title: string
    user: string
    date: string
    num_comments: string
    n_char: string
  }
  recipeData: RecipeExtraction
}

export interface LoadJsonToDbInput {
  jsonFilePath: string
}

export interface LoadJsonToDbResult {
  success: boolean
  recipeId?: number
  title?: string
  alreadyExists?: boolean
  error?: string
  jsonFilePath: string
}

/**
 * Activity to load a single JSON file into the database
 */
export async function loadJsonToDb(input: LoadJsonToDbInput): Promise<LoadJsonToDbResult> {
  const { jsonFilePath } = input

  try {
    console.log(`[Activity] Loading JSON file: ${jsonFilePath}`)

    // Check if file exists
    if (!fs.existsSync(jsonFilePath)) {
      throw new Error(`File not found: ${jsonFilePath}`)
    }

    // Read and parse JSON file
    const fileContent = fs.readFileSync(jsonFilePath, 'utf-8')
    const data: JsonRecipeFile = JSON.parse(fileContent)

    const title = data.recipeData.title || data.metadata.title || 'Untitled Recipe'
    
    // Check if recipe already exists
    const existsQuery = 'SELECT id FROM recipes WHERE title = $1 LIMIT 1'
    const existsResult = await pool.query(existsQuery, [title])
    
    if (existsResult.rows.length > 0) {
      console.log(`[Activity] Recipe already exists in database: "${title}"`)
      return {
        success: true,
        alreadyExists: true,
        recipeId: existsResult.rows[0].id,
        title,
        jsonFilePath
      }
    }

    // Map the data to Recipe format
    const recipeData = mapRecipeExtractionToRecipe(data.recipeData, data.metadata)

    console.log(`[Activity] Inserting recipe: ${recipeData.title}`)
    console.log(`[Activity]   - Ingredients: ${recipeData.ingredients.length}`)
    console.log(`[Activity]   - Instructions: ${recipeData.instructions.length} steps`)

    // Insert into database
    const createdRecipe = await RecipeService.create(recipeData)

    console.log(`[Activity] ✅ Recipe inserted with ID: ${createdRecipe.id}`)

    return {
      success: true,
      recipeId: createdRecipe.id,
      title: createdRecipe.title,
      jsonFilePath
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[Activity] Error loading JSON to database:`, errorMessage)
    return {
      success: false,
      error: errorMessage,
      jsonFilePath
    }
  }
}

/**
 * Helper functions for mapping JSON to database format
 */

function parseNumericValue(value: number | string | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined
  
  if (typeof value === 'number') return value
  
  const str = String(value).trim()
  const rangeMatch = str.match(/^(\d+\.?\d*)\s*[-–—to]\s*\d+/)
  if (rangeMatch) {
    return parseFloat(rangeMatch[1])
  }
  
  const numberMatch = str.match(/\d+\.?\d*/)
  if (numberMatch) {
    return parseFloat(numberMatch[0])
  }
  
  return undefined
}

function normalizeDifficulty(diff: string | null | undefined): 'easy' | 'medium' | 'hard' | undefined {
  if (!diff) return undefined
  const lower = diff.toLowerCase()
  if (lower.includes('easy') || lower.includes('simple') || lower.includes('beginner')) return 'easy'
  if (lower.includes('hard') || lower.includes('difficult') || lower.includes('advanced') || lower.includes('challenging')) return 'hard'
  if (lower.includes('medium') || lower.includes('moderate') || lower.includes('intermediate')) return 'medium'
  return undefined
}

function normalizeMealType(meal: string | null | undefined): 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'dessert' | undefined {
  if (!meal) return undefined
  const lower = meal.toLowerCase()
  if (lower.includes('breakfast') || lower.includes('brunch')) return 'breakfast'
  if (lower.includes('lunch')) return 'lunch'
  if (lower.includes('dinner') || lower.includes('supper')) return 'dinner'
  if (lower.includes('snack') || lower.includes('appetizer')) return 'snack'
  if (lower.includes('dessert') || lower.includes('sweet')) return 'dessert'
  return undefined
}

function mapRecipeExtractionToRecipe(
  data: RecipeExtraction,
  metadata: JsonRecipeFile['metadata']
): Omit<Recipe, 'id' | 'created_at' | 'updated_at'> {
  const ingredients: RecipeIngredient[] = (data.ingredients || []).map((ing, index) => ({
    ingredient_id: 0,
    ingredient: {
      name: ing.name || 'Unknown ingredient',
      category: undefined,
      description: undefined
    },
    measurement: ing.unit ? {
      name: ing.unit,
      abbreviation: undefined,
      unit_type: undefined
    } : undefined,
    amount: parseNumericValue(ing.quantity),
    notes: ing.notes || undefined,
    order_index: index + 1
  }))

  const instructions = (data.instructions || []).filter((inst): inst is string => inst !== null)
  const dietaryTags = (data.dietaryTags || []).filter((tag): tag is string => tag !== null)
  
  const prepTime = parseNumericValue(data.prepTime)
  const cookTime = parseNumericValue(data.cookTime)
  const servings = parseNumericValue(data.servings)

  return {
    title: data.title || metadata.title || 'Untitled Recipe',
    description: data.description || undefined,
    ingredients,
    instructions,
    prep_time_minutes: prepTime,
    cook_time_minutes: cookTime,
    total_time_minutes: (prepTime && cookTime) ? prepTime + cookTime : undefined,
    servings,
    difficulty: normalizeDifficulty(data.difficulty),
    cuisine_type: data.cuisineType || undefined,
    meal_type: normalizeMealType(data.mealType),
    dietary_tags: dietaryTags.length > 0 ? dietaryTags : undefined,
    source_url: undefined,
    reddit_post_id: undefined,
    reddit_author: metadata.user,
    reddit_score: parseInt(metadata.num_comments) || undefined,
    reddit_comments_count: parseInt(metadata.num_comments) || undefined
  }
}

