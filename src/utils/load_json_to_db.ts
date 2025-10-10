import fs from 'fs'
import path from 'path'
import { config } from 'dotenv'

config()

import { pool } from '../database.js'
import { RecipeService } from '../services/RecipeService.js'
import type { Recipe, RecipeIngredient } from '../models/Recipe.js'
import type { RecipeExtraction } from '../schemas/recipe-extraction.js'

/*
This script loads a JSON file from data/stage/ into the database.

Usage: node dist/src/utils/load_json_to_db.js <json-file-path>
Example: node dist/src/utils/load_json_to_db.js data/stage/Reddit_Recipes_entry_5.json

The script will:
- Read the JSON file
- Check if a recipe with the same title already exists
- If not, insert it into the database
- If it exists, skip the insertion
*/

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

/**
 * Check if a recipe with the same title already exists
 */
async function recipeExists(title: string): Promise<boolean> {
  const query = 'SELECT id FROM recipes WHERE title = $1 LIMIT 1'
  const result = await pool.query(query, [title])
  return result.rows.length > 0
}

/**
 * Parse a number or string value to extract the first numeric value
 * Examples: "2-4" -> 2, "30-45" -> 30, 5 -> 5, "6" -> 6
 */
function parseNumericValue(value: number | string | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined
  
  if (typeof value === 'number') return value
  
  // Try to parse as string
  const str = String(value).trim()
  
  // Handle ranges (e.g., "2-4", "30-45 minutes")
  const rangeMatch = str.match(/^(\d+\.?\d*)\s*[-–—to]\s*\d+/)
  if (rangeMatch) {
    return parseFloat(rangeMatch[1])
  }
  
  // Handle single numbers (e.g., "5", "3.5")
  const numberMatch = str.match(/\d+\.?\d*/)
  if (numberMatch) {
    return parseFloat(numberMatch[0])
  }
  
  return undefined
}

/**
 * Map RecipeExtraction to Recipe format for database insertion
 */
function mapRecipeExtractionToRecipe(
  data: RecipeExtraction,
  metadata: JsonRecipeFile['metadata']
): Omit<Recipe, 'id' | 'created_at' | 'updated_at'> {
  // Map ingredients
  const ingredients: RecipeIngredient[] = (data.ingredients || []).map((ing, index) => ({
    ingredient_id: 0, // Will be set by RecipeService
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

  // Map instructions - filter out null values
  const instructions = (data.instructions || []).filter((inst): inst is string => inst !== null)

  // Filter out null dietary tags
  const dietaryTags = (data.dietaryTags || []).filter((tag): tag is string => tag !== null)

  // Normalize difficulty to match database enum
  const normalizeDifficulty = (diff: string | null | undefined): 'easy' | 'medium' | 'hard' | undefined => {
    if (!diff) return undefined
    const lower = diff.toLowerCase()
    if (lower.includes('easy') || lower.includes('simple') || lower.includes('beginner')) return 'easy'
    if (lower.includes('hard') || lower.includes('difficult') || lower.includes('advanced') || lower.includes('challenging')) return 'hard'
    if (lower.includes('medium') || lower.includes('moderate') || lower.includes('intermediate')) return 'medium'
    return undefined
  }

  // Normalize meal type to match database enum
  const normalizeMealType = (meal: string | null | undefined): 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'dessert' | undefined => {
    if (!meal) return undefined
    const lower = meal.toLowerCase()
    if (lower.includes('breakfast') || lower.includes('brunch')) return 'breakfast'
    if (lower.includes('lunch')) return 'lunch'
    if (lower.includes('dinner') || lower.includes('supper')) return 'dinner'
    if (lower.includes('snack') || lower.includes('appetizer')) return 'snack'
    if (lower.includes('dessert') || lower.includes('sweet')) return 'dessert'
    return undefined
  }

  // Parse numeric values (handles both numbers and strings like "2-4")
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
    total_time_minutes: (prepTime && cookTime) 
      ? prepTime + cookTime 
      : undefined,
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

/**
 * Load a JSON file into the database
 */
async function loadJsonToDb(jsonFilePath: string): Promise<void> {
  try {
    console.log(`[Load] Reading file: ${jsonFilePath}`)

    // Check if file exists
    if (!fs.existsSync(jsonFilePath)) {
      throw new Error(`File not found: ${jsonFilePath}`)
    }

    // Read and parse JSON file
    const fileContent = fs.readFileSync(jsonFilePath, 'utf-8')
    const data: JsonRecipeFile = JSON.parse(fileContent)

    console.log(`[Load] Entry Number: ${data.entryNumber}`)
    console.log(`[Load] Recipe Title: ${data.metadata.title}`)
    console.log(`[Load] Reddit User: ${data.metadata.user}`)

    // Check if recipe already exists
    const title = data.recipeData.title || data.metadata.title
    const exists = await recipeExists(title)

    if (exists) {
      console.log(`[Load] ⚠️  Recipe already exists in database: "${title}"`)
      console.log(`[Load] Skipping insertion.`)
      return
    }

    // Map the data to Recipe format
    const recipeData = mapRecipeExtractionToRecipe(data.recipeData, data.metadata)

    console.log(`[Load] Inserting recipe into database...`)
    console.log(`[Load]   - Title: ${recipeData.title}`)
    console.log(`[Load]   - Ingredients: ${recipeData.ingredients.length}`)
    console.log(`[Load]   - Instructions: ${recipeData.instructions.length} steps`)
    console.log(`[Load]   - Prep Time: ${recipeData.prep_time_minutes || 'N/A'} min`)
    console.log(`[Load]   - Cook Time: ${recipeData.cook_time_minutes || 'N/A'} min`)
    console.log(`[Load]   - Servings: ${recipeData.servings || 'N/A'}`)
    console.log(`[Load]   - Difficulty: ${recipeData.difficulty || 'N/A'}`)
    console.log(`[Load]   - Cuisine: ${recipeData.cuisine_type || 'N/A'}`)
    console.log(`[Load]   - Meal Type: ${recipeData.meal_type || 'N/A'}`)

    // Insert into database
    const createdRecipe = await RecipeService.create(recipeData)

    console.log(`[Load] ✅ Recipe successfully inserted with ID: ${createdRecipe.id}`)
    console.log(`[Load] Database record created at: ${createdRecipe.created_at}`)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[Load] ❌ Error loading JSON to database:`, errorMessage)
    throw error
  }
}

// Parse command line arguments
const args = process.argv.slice(2)

if (args.length < 1) {
  console.error('Usage: node dist/src/utils/load_json_to_db.js <json-file-path>')
  console.error('Example: node dist/src/utils/load_json_to_db.js data/stage/Reddit_Recipes_entry_5.json')
  process.exit(1)
}

const jsonFilePath = args[0]

// Run the function
loadJsonToDb(jsonFilePath)
  .then(() => {
    console.log('[Load] Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('[Load] Failed:', error)
    process.exit(1)
  })

