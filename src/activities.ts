import csvParser from 'csv-parser'
import fs from 'fs'
import path from 'path'
import { config } from 'dotenv'

config()

import { getAIService } from './services/AIService.js'
import { RecipeExtractionSchema } from './schemas/recipe-extraction.js'
import { pool } from './database.js'
import { parseRedditRecipeLocal, parseStrombergRecipeLocal } from './utils/shared_parser.js'
import { RecipeService } from './services/RecipeService.js'
import type { Recipe, RecipeIngredient } from './models/Recipe.js'
import type { RecipeExtraction } from './schemas/recipe-extraction.js'

// CSV format of the reddit recipes dataset
type RedditRowData = {
  date: string
  num_comments: string
  title: string
  user: string
  comment: string
  n_char: string
}

// CSV format of the Stromberg recipes dataset
type StrombergRowData = {
  title: string
  ingredients: string
  directions: string
  link: string
  source: string
  NER: string
  site: string
}

type RowData = RedditRowData | StrombergRowData

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

    // Define output file path with new subfolder structure
    const csvFileName = path.basename(csvFilePath, '.csv')
    const outputDir = path.join(path.dirname(csvFilePath), '..', 'stage', csvFileName)
    const outputFilePath = path.join(outputDir, `entry_${entryNumber}.json`)

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

    // Detect CSV format based on filename
    const isStromberg = csvFileName.toLowerCase().includes('stromberg')
    
    // Find the target entry in the CSV
    const targetRow = await findCsvEntry(csvFilePath, entryNumber)

    if (!targetRow) {
      throw new Error(`Entry ${entryNumber} not found in CSV file`)
    }

    // Process based on CSV format
    let recipeText: string
    let output: any

    if (isStromberg) {
      const row = targetRow as StrombergRowData
      console.log(`[Activity] Found Stromberg entry ${entryNumber}:`)
      console.log(`  Title: ${row.title}`)
      console.log(`  Source: ${row.source}`)
      console.log(`  Link: ${row.link}`)

      // Parse the ingredients and directions arrays
      let ingredientsArray: string[] = []
      let directionsArray: string[] = []
      
      try {
        ingredientsArray = JSON.parse(row.ingredients)
      } catch (e) {
        console.warn('Failed to parse ingredients array, using raw string')
        ingredientsArray = [row.ingredients]
      }
      
      try {
        directionsArray = JSON.parse(row.directions)
      } catch (e) {
        console.warn('Failed to parse directions array, using raw string')
        directionsArray = [row.directions]
      }

      console.log(`  Ingredients count: ${ingredientsArray.length}`)
      console.log(`  Directions count: ${directionsArray.length}`)
      console.log('\n[Activity] Extracting structured recipe data...')

      // Construct recipe text from structured data
      recipeText = `Recipe: ${row.title}

Ingredients:
${ingredientsArray.map((ing, i) => `${i + 1}. ${ing}`).join('\n')}

Directions:
${directionsArray.map((dir, i) => `${i + 1}. ${dir}`).join('\n')}`

      const result = await aiService.extractStructuredData(
        recipeText,
        RecipeExtractionSchema,
        {
          systemPrompt: `You are an expert at extracting recipe information from structured recipe data. 
Extract as much information as possible, even if incomplete. 
If a field cannot be determined, use null or omit it.

IMPORTANT for ingredients: 
- ALWAYS separate quantity and unit into different fields
- quantity: ONLY the number (e.g., 2, 1.5, "1-2")
- unit: ONLY the measurement unit (e.g., "cups", "tablespoons", "grams")
- Example: "2 cups flour" → quantity: 2, unit: "cups", name: "flour"
- Example: "1-2 lbs chicken" → quantity: "1-2", unit: "lbs", name: "chicken"

For instructions: extract the steps clearly from the directions provided.
The recipe data is already well-structured, so preserve the organization.`
        }
      )

      output = {
        entryNumber,
        metadata: {
          title: row.title,
          link: row.link,
          source: row.source,
          site: row.site,
          ner: row.NER
        },
        recipeData: result
      }
    } else {
      // Reddit format
      const row = targetRow as RedditRowData
      console.log(`[Activity] Found Reddit entry ${entryNumber}:`)
      console.log(`  Title: ${row.title}`)
      console.log(`  User: ${row.user}`)
      console.log(`  Date: ${row.date}`)
      console.log(`  Comment length: ${row.n_char} characters`)
      console.log('\n[Activity] Extracting structured recipe data...')

      const result = await aiService.extractStructuredData(
        row.comment,
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

      output = {
        entryNumber,
        metadata: {
          title: row.title,
          user: row.user,
          date: row.date,
          num_comments: row.num_comments,
          n_char: row.n_char
        },
        recipeData: result
      }
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

/**
 * Activity to process a single CSV entry using LOCAL parsing (no AI)
 */
export async function processRecipeEntryLocal(
  input: ProcessRecipeEntryInput
): Promise<ProcessRecipeEntryResult> {
  const { csvFilePath, entryNumber } = input

  try {
    // Validate entry number
    if (entryNumber < 1) {
      throw new Error('Entry number must be >= 1')
    }

    // Check if CSV file exists
    if (!fs.existsSync(csvFilePath)) {
      throw new Error(`CSV file not found: ${csvFilePath}`)
    }

    // Define output file path with new subfolder structure
    const csvFileName = path.basename(csvFilePath, '.csv')
    const outputDir = path.join(path.dirname(csvFilePath), '..', 'stage', csvFileName)
    const outputFilePath = path.join(outputDir, `entry_${entryNumber}.json`)

    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    // Check if output file already exists
    if (fs.existsSync(outputFilePath)) {
      console.log(`[Activity Local] Output file already exists: ${outputFilePath}`)
      return {
        success: true,
        skipped: true,
        outputFilePath,
        entryNumber
      }
    }

    console.log(`[Activity Local] Processing entry ${entryNumber} from ${csvFilePath}...`)

    // Detect CSV format based on filename
    const isStromberg = csvFileName.toLowerCase().includes('stromberg')
    
    // Find the target entry in the CSV
    const targetRow = await findCsvEntry(csvFilePath, entryNumber)

    if (!targetRow) {
      throw new Error(`Entry ${entryNumber} not found in CSV file`)
    }

    let output: any

    if (isStromberg) {
      const row = targetRow as StrombergRowData
      console.log(`[Activity Local] Found Stromberg entry ${entryNumber}:`)
      console.log(`  Title: ${row.title}`)
      console.log(`  Source: ${row.source}`)

      const recipeData = parseStrombergRecipeLocalActivity(row)
      console.log(`  Found ${recipeData.ingredients.length} ingredients (local parsing)`)
      console.log(`  Found ${recipeData.instructions.length} instruction steps`)

      output = {
        entryNumber,
        metadata: {
          title: row.title,
          link: row.link,
          source: row.source,
          site: row.site,
          ner: row.NER
        },
        recipeData
      }
    } else {
      // Reddit format
      const row = targetRow as RedditRowData
      console.log(`[Activity Local] Found Reddit entry ${entryNumber}:`)
      console.log(`  Title: ${row.title}`)
      console.log(`  User: ${row.user}`)

      const recipeData = parseRedditRecipeLocalActivity(row)
      console.log(`  Found ${recipeData.ingredients.length} ingredients (local parsing)`)
      console.log(`  Found ${recipeData.instructions.length} instruction steps`)

      output = {
        entryNumber,
        metadata: {
          title: row.title,
          user: row.user,
          date: row.date,
          num_comments: row.num_comments,
          n_char: row.n_char
        },
        recipeData
      }
    }

    fs.writeFileSync(outputFilePath, JSON.stringify(output, null, 2))
    console.log(`[Activity Local] Successfully saved to: ${outputFilePath}`)

    return {
      success: true,
      outputFilePath,
      entryNumber
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[Activity Local] Error processing entry ${entryNumber}:`, errorMessage)
    return {
      success: false,
      error: errorMessage,
      entryNumber
    }
  }
}

// ============================================================================
// Local Parsing Functions (No AI)
// ============================================================================

type Ingredient = {
  name: string
  quantity?: number | string | null
  unit?: string | null
  notes?: string | null
}

type RecipeData = {
  title: string
  description?: string | null
  ingredients: Ingredient[]
  instructions: string[]
  prepTime?: string | null
  cookTime?: string | null
  totalTime?: string | null
  servings?: number | string | null
  difficulty?: string | null
  cuisine?: string | null
  course?: string | null
  mealType?: string | null
  dietaryTags?: string[] | null
}

const COMMON_UNITS = [
  'cup', 'cups', 'c', 'c.',
  'tablespoon', 'tablespoons', 'tbsp', 'tbsp.', 'tbs', 'tbs.', 'T', 'Tbsp', 'Tbsp.',
  'teaspoon', 'teaspoons', 'tsp', 'tsp.', 't',
  'pound', 'pounds', 'lb', 'lbs', 'lb.', 'lbs.',
  'ounce', 'ounces', 'oz', 'oz.',
  'gram', 'grams', 'g', 'g.',
  'kilogram', 'kilograms', 'kg', 'kg.',
  'milliliter', 'milliliters', 'ml', 'ml.',
  'liter', 'liters', 'l', 'l.',
  'quart', 'quarts', 'qt', 'qt.',
  'pint', 'pints', 'pt', 'pt.',
  'gallon', 'gallons', 'gal', 'gal.',
  'pinch', 'dash', 'handful',
  'can', 'cans', 'jar', 'jars', 'package', 'packages', 'pkg', 'box', 'boxes',
  'clove', 'cloves', 'piece', 'pieces', 'slice', 'slices',
  'stick', 'sticks', 'head', 'heads', 'bunch', 'bunches'
]

function parseIngredientText(ingredientText: string): Ingredient {
  let text = ingredientText.trim()
  let quantity: number | string | null = null
  let unit: string | null = null
  let notes: string | null = null
  
  // Extract notes in parentheses first
  const notesMatch = text.match(/\(([^)]+)\)/)
  if (notesMatch) {
    notes = notesMatch[1]
    text = text.replace(notesMatch[0], '').trim()
  }
  
  // Try to match range (e.g., "1-2 cups")
  const rangeMatch = text.match(/^(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/)
  if (rangeMatch) {
    quantity = `${rangeMatch[1]}-${rangeMatch[2]}`
    text = text.substring(rangeMatch[0].length).trim()
  }
  // Try to match fraction (e.g., "1/2" or "1 1/2")
  else {
    const fractionMatch = text.match(/^(\d+\/\d+|\d+\s+\d+\/\d+)/)
    if (fractionMatch) {
      quantity = fractionMatch[0].trim()
      text = text.substring(fractionMatch[0].length).trim()
    }
    // Try to match regular number
    else {
      const numberMatch = text.match(/^(\d+\.?\d*)/)
      if (numberMatch) {
        const num = parseFloat(numberMatch[0])
        if (!isNaN(num)) {
          quantity = num
          text = text.substring(numberMatch[0].length).trim()
        }
      }
    }
  }
  
  // Try to find unit at the beginning of remaining text
  const textLower = text.toLowerCase()
  for (const u of COMMON_UNITS) {
    const unitRegex = new RegExp(`^${u}\\b`, 'i')
    if (unitRegex.test(textLower)) {
      unit = u
      text = text.substring(u.length).trim()
      text = text.replace(/^[s\.]?\s*/, '')
      break
    }
  }
  
  const name = text.trim()
  const ingredient: Ingredient = { name }
  if (quantity !== null) ingredient.quantity = quantity
  if (unit !== null) ingredient.unit = unit
  if (notes !== null) ingredient.notes = notes
  
  return ingredient
}

function parseRedditRecipeLocalActivity(row: RedditRowData): RecipeData {
  // Use shared parser function
  return parseRedditRecipeLocal(row.comment, row.title)
}

// Old duplicated parsing logic removed - now using shared_parser.ts

function parseStrombergRecipeLocalActivity(row: StrombergRowData): RecipeData {
  // Parse the ingredients and directions arrays from JSON strings
  let ingredientsArray: string[] = []
  let directionsArray: string[] = []
  
  try {
    ingredientsArray = JSON.parse(row.ingredients)
  } catch (e) {
    ingredientsArray = [row.ingredients]
  }
  
  try {
    directionsArray = JSON.parse(row.directions)
  } catch (e) {
    directionsArray = [row.directions]
  }
  
  // Use shared parser function
  return parseStrombergRecipeLocal(ingredientsArray, directionsArray, row.title)
}

// Old duplicated Stromberg parsing logic removed - now using shared_parser.ts

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

function parseIntegerValue(value: number | string | null | undefined): number | undefined {
  const numericValue = parseNumericValue(value)
  if (numericValue === undefined) return undefined
  
  // Round to nearest integer for fields that must be integers
  return Math.round(numericValue)
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
  
  // Use parseIntegerValue for INTEGER database fields
  const prepTime = parseIntegerValue(data.prepTime)
  const cookTime = parseIntegerValue(data.cookTime)
  const servings = parseIntegerValue(data.servings)

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

