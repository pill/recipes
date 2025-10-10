import csvParser from 'csv-parser'
import fs from 'fs'
import path from 'path'
import { config } from 'dotenv'

/*
This script will parse a single Reddit recipe entry from CSV into JSON using AI.

Usage: node dist/src/utils/csv_to_json.js <csv-file-path> <entry-number>
Example: node dist/src/utils/csv_to_json.js data/raw/Reddit_Recipes.csv 5

The script will:
- Extract the specified entry from the CSV file
- Process it using AI to extract structured recipe data
- Save to ../data/stage/ with filename: {csv_filename}_entry_{number}.json
- Skip processing if the output file already exists
*/

// Load environment variables from .env file FIRST
config()

import { getAIService } from '../services/AIService.js'
import { RecipeExtractionSchema } from '../schemas/recipe-extraction.js'

// this is the CSV format of the reddit recipes dataset
type RowData = {
  date: string
  num_comments: string
  title: string
  user: string
  comment: string
  n_char: string
}

async function processRecipeEntry(csvFilePath: string, entryNumber: number) {
  const aiService = getAIService()
  
  // Validate AI service
  if (!aiService.isConfigured()) {
    console.error('AI Service not configured. Set ANTHROPIC_API_KEY environment variable.')
    process.exit(1)
  }

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
  const outputDir = path.join(path.dirname(csvFilePath), '..', 'stage')
  const csvFileName = path.basename(csvFilePath, '.csv')
  const outputFilePath = path.join(outputDir, `${csvFileName}_entry_${entryNumber}.json`)

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
  const aiService = getAIService()
  
  console.log(`Found entry ${entryNumber}:`)
  console.log(`  Title: ${row.title}`)
  console.log(`  User: ${row.user}`)
  console.log(`  Date: ${row.date}`)
  console.log(`  Comment length: ${row.n_char} characters`)
  console.log('\nExtracting structured recipe data...')

  try {
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
    
    // Save result with metadata
    const output = {
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
  console.error('Usage: node dist/src/utils/csv_to_json.js <csv-file-path> <entry-number>')
  console.error('Example: node dist/src/utils/csv_to_json.js data/raw/Reddit_Recipes.csv 5')
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




