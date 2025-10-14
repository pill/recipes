import csvParser from 'csv-parser'
import fs from 'fs'
import path from 'path'
import { config } from 'dotenv'

/*
This script will parse a single Stromberg recipe entry from CSV into JSON using AI.

Usage: node dist/src/utils/stromberg_csv_to_json.js <csv-file-path> <entry-number>
Example: node dist/src/utils/stromberg_csv_to_json.js data/raw/stromberg_data.csv 5

The script will:
- Extract the specified entry from the CSV file
- Process it using AI to extract structured recipe data
- Save to ../data/stage/{csv_filename}/ with filename: entry_{number}.json
- Skip processing if the output file already exists
*/

// Load environment variables from .env file FIRST
config()

import { getAIService } from '../services/AIService.js'
import { RecipeExtractionSchema } from '../schemas/recipe-extraction.js'

// this is the CSV format of the Stromberg recipes dataset
type RowData = {
  title: string
  ingredients: string
  directions: string
  link: string
  source: string
  NER: string
  site: string
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
  const aiService = getAIService()
  
  console.log(`Found entry ${entryNumber}:`)
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
  console.log('\nExtracting structured recipe data...')

  // Construct recipe text from structured data
  const recipeText = `Recipe: ${row.title}

Ingredients:
${ingredientsArray.map((ing, i) => `${i + 1}. ${ing}`).join('\n')}

Directions:
${directionsArray.map((dir, i) => `${i + 1}. ${dir}`).join('\n')}`

  try {
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
  console.error('Usage: node dist/src/utils/stromberg_csv_to_json.js <csv-file-path> <entry-number>')
  console.error('Example: node dist/src/utils/stromberg_csv_to_json.js data/raw/stromberg_data.csv 5')
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

