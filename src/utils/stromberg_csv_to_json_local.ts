import csvParser from 'csv-parser'
import fs from 'fs'
import path from 'path'

/*
This script will parse a single Stromberg recipe entry from CSV into JSON using local parsing (no AI).

Usage: node dist/src/utils/stromberg_csv_to_json_local.js <csv-file-path> <entry-number>
Example: node dist/src/utils/stromberg_csv_to_json_local.js data/raw/stromberg_data.csv 5

The script will:
- Extract the specified entry from the CSV file
- Parse it locally using pattern matching (no AI API calls)
- Save to ../data/stage/{csv_filename}/ with filename: entry_{number}.json
- Skip processing if the output file already exists
*/

// CSV format of the Stromberg recipes dataset
type RowData = {
  title: string
  ingredients: string
  directions: string
  link: string
  source: string
  NER: string
  site: string
}

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
  cuisine?: string | null
  course?: string | null
}

/**
 * Parse a single ingredient string into structured data
 */
function parseIngredient(ingredientText: string): Ingredient {
  // Common measurement units
  const units = [
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
  for (const u of units) {
    const unitRegex = new RegExp(`^${u}\\b`, 'i')
    if (unitRegex.test(textLower)) {
      unit = u
      text = text.substring(u.length).trim()
      // Remove trailing 's' for plural or period
      text = text.replace(/^[s\.]?\s*/, '')
      break
    }
  }
  
  // What's left is the ingredient name
  const name = text.trim()
  
  const ingredient: Ingredient = { name }
  if (quantity !== null) ingredient.quantity = quantity
  if (unit !== null) ingredient.unit = unit
  if (notes !== null) ingredient.notes = notes
  
  return ingredient
}

/**
 * Extract servings from directions
 */
function extractServings(directions: string[]): number | string | null {
  for (const direction of directions) {
    const lower = direction.toLowerCase()
    const servingsMatch = lower.match(/(?:serves?|servings?|yields?|makes?)[:\s]+(\d+(?:\s*-\s*\d+)?)/i)
    if (servingsMatch) {
      return servingsMatch[1].includes('-') ? servingsMatch[1] : parseInt(servingsMatch[1])
    }
    
    // Also check for "makes X cookies/servings/etc"
    const makesMatch = lower.match(/makes?\s+(?:about\s+)?(\d+)/i)
    if (makesMatch) {
      return parseInt(makesMatch[1])
    }
  }
  return null
}

/**
 * Extract times from directions
 */
function extractTimes(directions: string[]): { prepTime: string | null, cookTime: string | null, totalTime: string | null } {
  const fullText = directions.join(' ').toLowerCase()
  
  let prepTime: string | null = null
  let cookTime: string | null = null
  let totalTime: string | null = null
  
  const prepMatch = fullText.match(/prep(?:\s+time)?[:\s]+(\d+\s*(?:min|minute|hr|hour)s?)/i)
  if (prepMatch) prepTime = prepMatch[1]
  
  const cookMatch = fullText.match(/(?:cook|bake)(?:\s+time)?[:\s]+(\d+\s*(?:min|minute|hr|hour)s?)/i)
  if (cookMatch) cookTime = cookMatch[1]
  
  const totalMatch = fullText.match(/total(?:\s+time)?[:\s]+(\d+\s*(?:min|minute|hr|hour)s?)/i)
  if (totalMatch) totalTime = totalMatch[1]
  
  return { prepTime, cookTime, totalTime }
}

/**
 * Parse recipe data from Stromberg format
 */
function parseRecipeFromRow(row: RowData): RecipeData {
  // Parse ingredients array from JSON string
  let ingredientsArray: string[] = []
  try {
    ingredientsArray = JSON.parse(row.ingredients)
  } catch (e) {
    console.warn('Failed to parse ingredients array, using raw string')
    ingredientsArray = [row.ingredients]
  }
  
  // Parse directions array from JSON string
  let directionsArray: string[] = []
  try {
    directionsArray = JSON.parse(row.directions)
  } catch (e) {
    console.warn('Failed to parse directions array, using raw string')
    directionsArray = [row.directions]
  }
  
  // Parse each ingredient
  const ingredients = ingredientsArray.map(ing => parseIngredient(ing))
  
  // Extract metadata
  const servings = extractServings(directionsArray)
  const { prepTime, cookTime, totalTime } = extractTimes(directionsArray)
  
  return {
    title: row.title,
    description: null,
    ingredients,
    instructions: directionsArray,
    prepTime,
    cookTime,
    totalTime,
    servings
  }
}

async function processRecipeEntry(csvFilePath: string, entryNumber: number) {
  // Validate entry number
  if (entryNumber < 1) {
    console.error('Entry number must be >= 1')
    process.exit(1)
  }

  // Check if CSV file exists
  if (!fs.existsSync(csvFilePath)) {
    console.error(`CSV file not found: ${csvFilePath}`)
    process.exit(1)
  }

  // Define output file path
  const csvFileName = path.basename(csvFilePath, '.csv')
  const outputDir = path.join(path.dirname(csvFilePath), '..', 'stage', csvFileName)
  const outputFilePath = path.join(outputDir, `entry_${entryNumber}.json`)

  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  // Check if output file already exists
  if (fs.existsSync(outputFilePath)) {
    console.log(`Output file already exists: ${outputFilePath}`)
    console.log('Skipping processing.')
    return
  }

  console.log(`Processing entry ${entryNumber} from ${csvFilePath}...`)

  let currentRow = 0
  let targetRow: RowData | null = null

  // Read CSV and find the target entry
  const stream = fs.createReadStream(csvFilePath)
    .pipe(csvParser())
    .on('data', (row: RowData) => {
      currentRow++
      if (currentRow === entryNumber) {
        targetRow = row
        stream.destroy() // Stop reading once we found our entry
      }
    })
    .on('end', async () => {
      if (!targetRow) {
        console.error(`Entry ${entryNumber} not found in CSV file`)
        process.exit(1)
      }
      await processAndSave(targetRow, outputFilePath, entryNumber)
    })
    .on('close', async () => {
      if (targetRow) {
        await processAndSave(targetRow, outputFilePath, entryNumber)
      }
    })
    .on('error', (error) => {
      console.error('Error reading CSV:', error)
      process.exit(1)
    })
}

async function processAndSave(row: RowData, outputFilePath: string, entryNumber: number) {
  console.log(`Found entry ${entryNumber}:`)
  console.log(`  Title: ${row.title}`)
  console.log(`  Source: ${row.source}`)
  console.log(`  Link: ${row.link}`)
  console.log('\nParsing recipe data locally (no AI)...')

  try {
    const recipeData = parseRecipeFromRow(row)
    
    console.log(`  Found ${recipeData.ingredients.length} ingredients`)
    console.log(`  Found ${recipeData.instructions.length} instruction steps`)
    
    // Save result with metadata
    const output = {
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

    fs.writeFileSync(outputFilePath, JSON.stringify(output, null, 2))
    console.log(`\nSuccessfully saved to: ${outputFilePath}`)
  } catch (error) {
    console.error('Error processing recipe:', error)
    process.exit(1)
  }
}

// Parse command line arguments
const args = process.argv.slice(2)

if (args.length < 2) {
  console.error('Usage: node dist/src/utils/stromberg_csv_to_json_local.js <csv-file-path> <entry-number>')
  console.error('Example: node dist/src/utils/stromberg_csv_to_json_local.js data/raw/stromberg_data.csv 5')
  process.exit(1)
}

const csvFilePath = args[0]
const entryNumber = parseInt(args[1], 10)

if (isNaN(entryNumber)) {
  console.error('Entry number must be a valid integer')
  process.exit(1)
}

// Run the function
processRecipeEntry(csvFilePath, entryNumber).catch(console.error)

