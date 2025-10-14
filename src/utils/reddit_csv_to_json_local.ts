import csvParser from 'csv-parser'
import fs from 'fs'
import path from 'path'

/*
This script will parse a single Reddit recipe entry from CSV into JSON using local parsing (no AI).

Usage: node dist/src/utils/reddit_csv_to_json_local.js <csv-file-path> <entry-number>
Example: node dist/src/utils/reddit_csv_to_json_local.js data/raw/Reddit_Recipes.csv 5

The script will:
- Extract the specified entry from the CSV file
- Parse it locally using pattern matching (no AI API calls)
- Save to ../data/stage/{csv_filename}/ with filename: entry_{number}.json
- Skip processing if the output file already exists
*/

// CSV format of the reddit recipes dataset
type RowData = {
  date: string
  num_comments: string
  title: string
  user: string
  comment: string
  n_char: string
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
  difficulty?: string | null
  cuisine?: string | null
  course?: string | null
  mealType?: string | null
  dietaryTags?: string[] | null
}

/**
 * Parse ingredients from text
 */
function parseIngredients(text: string): Ingredient[] {
  const ingredients: Ingredient[] = []
  const lines = text.split('\n')
  
  // Common measurement units
  const units = [
    'cup', 'cups', 'c', 'c.',
    'tablespoon', 'tablespoons', 'tbsp', 'tbsp.', 'tbs', 'tbs.', 'T',
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
  
  // Pattern for fractions
  const fractionPattern = /(\d+\/\d+|\d+\s+\d+\/\d+)/
  const numberPattern = /(\d+\.?\d*|\d*\.?\d+)/
  const rangePattern = /(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/
  
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.length < 3) continue
    
    // Skip lines that look like headers or instructions
    if (/^(ingredient|instruction|direction|step|method|prep|cook)/i.test(trimmed)) continue
    
    // Remove bullet points, numbers, asterisks
    let cleaned = trimmed.replace(/^[\d\*\-\•\◦\→]+\.?\s*/, '')
    
    let quantity: number | string | null = null
    let unit: string | null = null
    let name = cleaned
    let notes: string | null = null
    
    // Try to match range (e.g., "1-2 cups")
    const rangeMatch = cleaned.match(rangePattern)
    if (rangeMatch) {
      quantity = `${rangeMatch[1]}-${rangeMatch[2]}`
      cleaned = cleaned.replace(rangeMatch[0], '').trim()
    }
    // Try to match fraction (e.g., "1/2" or "1 1/2")
    else {
      const fractionMatch = cleaned.match(fractionPattern)
      if (fractionMatch) {
        quantity = fractionMatch[0].trim()
        cleaned = cleaned.replace(fractionMatch[0], '').trim()
      }
      // Try to match regular number
      else {
        const numberMatch = cleaned.match(new RegExp(`^${numberPattern.source}`))
        if (numberMatch) {
          const num = parseFloat(numberMatch[0])
          if (!isNaN(num)) {
            quantity = num
            cleaned = cleaned.replace(numberMatch[0], '').trim()
          }
        }
      }
    }
    
    // Try to find unit
    const cleanedLower = cleaned.toLowerCase()
    for (const u of units) {
      const unitRegex = new RegExp(`^${u}\\b`, 'i')
      if (unitRegex.test(cleanedLower)) {
        unit = u
        cleaned = cleaned.substring(u.length).trim()
        // Remove trailing 's' for plural or period
        cleaned = cleaned.replace(/^[s\.]?\s*/, '')
        break
      }
    }
    
    // Extract notes in parentheses
    const notesMatch = cleaned.match(/\(([^)]+)\)/)
    if (notesMatch) {
      notes = notesMatch[1]
      cleaned = cleaned.replace(notesMatch[0], '').trim()
    }
    
    name = cleaned.trim()
    
    // Only add if we have a name
    if (name) {
      const ingredient: Ingredient = { name }
      if (quantity !== null) ingredient.quantity = quantity
      if (unit !== null) ingredient.unit = unit
      if (notes !== null) ingredient.notes = notes
      ingredients.push(ingredient)
    }
  }
  
  return ingredients
}

/**
 * Parse instructions from text
 */
function parseInstructions(text: string): string[] {
  const instructions: string[] = []
  const lines = text.split('\n')
  
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.length < 10) continue
    
    // Skip lines that look like ingredients
    if (/^\d+\.?\d*\s*(cup|tbsp|tsp|oz|lb|gram|ml)/i.test(trimmed)) continue
    
    // Remove step numbers, bullet points
    let cleaned = trimmed.replace(/^(step\s+)?\d+[\.\)\:]?\s*/i, '')
    cleaned = cleaned.replace(/^[\*\-\•\◦\→]+\s*/, '')
    // Remove all markdown formatting (bold, italic, strikethrough)
    cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, '$1')  // **bold**
    cleaned = cleaned.replace(/\*(.*?)\*/g, '$1')      // *italic*
    cleaned = cleaned.replace(/~~(.*?)~~/g, '$1')      // ~~strikethrough~~
    // Remove any remaining asterisks at start/end
    cleaned = cleaned.replace(/^\*+|\*+$/g, '')
    cleaned = cleaned.trim()
    
    if (cleaned.length > 10) {
      instructions.push(cleaned)
    }
  }
  
  return instructions
}

/**
 * Extract recipe data from Reddit comment
 */
function parseRecipeFromComment(comment: string, title: string): RecipeData {
  const sections = {
    ingredients: [] as string[],
    instructions: [] as string[],
    general: [] as string[]
  }
  
  let currentSection: 'ingredients' | 'instructions' | 'general' = 'general'
  const lines = comment.split('\n')
  
  // Identify sections
  for (const line of lines) {
    const lower = line.toLowerCase().trim()
    // Remove markdown formatting for better section detection
    const cleaned = lower.replace(/[\*\#\-\_\:]/g, '').trim()
    
    // Check for section headers
    if (/^(ingredient|what you need|you('ll)? need|materials|items)/i.test(cleaned)) {
      currentSection = 'ingredients'
      continue
    } else if (/^(instruction|direction|step|method|how to|preparation|prep|procedure)/i.test(cleaned)) {
      currentSection = 'instructions'
      continue
    }
    
    // Add line to current section
    if (currentSection === 'ingredients') {
      sections.ingredients.push(line)
    } else if (currentSection === 'instructions') {
      sections.instructions.push(line)
    } else {
      sections.general.push(line)
    }
  }
  
  // If no explicit sections found, try to auto-detect
  if (sections.ingredients.length === 0 && sections.instructions.length === 0) {
    for (const line of lines) {
      const trimmed = line.trim()
      // Lines with measurements are likely ingredients
      if (/\d+\.?\d*\s*(cup|tbsp|tsp|oz|lb|gram|ml|c\.|tsp\.|tbsp\.)/i.test(trimmed)) {
        sections.ingredients.push(line)
      }
      // Lines with action verbs are likely instructions
      else if (/^(mix|stir|add|pour|bake|cook|heat|boil|fry|blend|combine|place|put|remove|serve)/i.test(trimmed)) {
        sections.instructions.push(line)
      }
    }
  }
  
  // Parse ingredients and instructions
  const ingredients = parseIngredients(sections.ingredients.join('\n'))
  const instructions = parseInstructions(sections.instructions.join('\n'))
  
  // Extract description from the beginning of the text (first paragraph)
  const descLines = comment.split('\n').map(line => line.trim()).filter(line => line.length > 0)
  let description: string | null = null
  
  // Find the first substantial paragraph that's not a title or ingredient list
  for (const line of descLines) {
    if (line.length > 30 && 
        !line.toLowerCase().includes('ingredients') && 
        !line.toLowerCase().includes('directions') &&
        !line.toLowerCase().includes('instructions') &&
        !line.toLowerCase().includes('method') &&
        !line.match(/^\d+\./) &&
        !line.startsWith('**') &&  // Skip markdown headers
        !line.startsWith('-')) {
      description = line
      break
    }
  }

  // Extract metadata from general section or comment
  const fullText = comment.toLowerCase()
  let servings: number | string | null = null
  let prepTime: string | null = null
  let cookTime: string | null = null
  let totalTime: string | null = null
  let difficulty: string | null = null
  let cuisine: string | null = null
  let course: string | null = null
  let mealType: string | null = null
  let dietaryTags: string[] | null = null
  
  // Extract servings - try multiple patterns
  let servingsMatch = fullText.match(/(?:serves?|servings?|yields?|makes?)[:\s]+(\d+(?:\s*-\s*\d+)?)/i)
  if (!servingsMatch) {
    // Try "Servings: X" format
    servingsMatch = fullText.match(/servings?[:\s]+(\d+(?:\s*-\s*\d+)?)/i)
  }
  if (!servingsMatch) {
    // Try "makes X servings" or "serves X people"
    servingsMatch = fullText.match(/makes?\s+(\d+)\s*(?:servings?|people|portions?)/i)
  }
  if (!servingsMatch) {
    // Try "for X people" or "feeds X"
    servingsMatch = fullText.match(/(?:for|feeds?)\s+(\d+)\s*(?:people|servings?)/i)
  }
  if (!servingsMatch) {
    // Try "X servings" or "X people"
    servingsMatch = fullText.match(/(\d+)\s*(?:servings?|people|portions?)/i)
  }
  
  if (servingsMatch) {
    servings = servingsMatch[1].includes('-') ? servingsMatch[1] : parseInt(servingsMatch[1])
  } else {
    // Infer from pan size, recipe type, or specific mentions
    if (fullText.includes('9x13') || fullText.includes('13x9')) {
      servings = 12 // Typical for large pan desserts
    } else if (fullText.includes('8x8') || fullText.includes('square pan')) {
      servings = 8 // Typical for square pans
    } else if (fullText.includes('loaf pan') || fullText.includes('bread')) {
      servings = 10 // Typical for breads
    } else if (fullText.includes('clusters') || fullText.includes('cookies') || fullText.includes('balls')) {
      // Try to extract number of pieces
      const piecesMatch = fullText.match(/(\d+)\s*(?:clusters?|cookies?|balls?|pieces?)/i)
      if (piecesMatch) {
        servings = parseInt(piecesMatch[1])
      }
    } else if (fullText.includes('pizza') || fullText.includes('pie')) {
      servings = 8 // Typical for pizzas/pies
    } else if (fullText.includes('soup') || fullText.includes('stew')) {
      servings = 6 // Typical for soups
    }
  }
  
  // Extract times - try multiple patterns including ranges
  let prepMatch = fullText.match(/prep(?:\s+time)?[:\s]+(\d+(?:\s*-\s*\d+)?\s*(?:min|minute|hr|hour)s?)/i)
  if (!prepMatch) {
    // Try "Prep Time: X" format
    prepMatch = fullText.match(/prep\s+time[:\s]+(\d+(?:\s*-\s*\d+)?\s*(?:min|minute|hr|hour)s?)/i)
  }
  if (!prepMatch) {
    // Try "preparation time" or "prep"
    prepMatch = fullText.match(/preparation(?:\s+time)?[:\s]+(\d+(?:\s*-\s*\d+)?\s*(?:min|minute|hr|hour)s?)/i)
  }
  if (!prepMatch) {
    // Try "takes X to prep" or "X minutes prep"
    prepMatch = fullText.match(/(?:takes?\s+)?(\d+(?:\s*-\s*\d+)?\s*(?:min|minute|hr|hour)s?)\s*(?:to\s+)?prep/i)
  }
  if (prepMatch) prepTime = prepMatch[1]
  
  // If no explicit prep time found, try to infer from recipe complexity
  if (!prepTime) {
    if (fullText.includes('tiramisu') || fullText.includes('layered') || fullText.includes('multiple steps')) {
      prepTime = '60-90' // Complex layered desserts
    } else if (fullText.includes('whisk') || fullText.includes('whip') || fullText.includes('fold')) {
      prepTime = '30-45' // Requires mixing techniques
    } else if (fullText.includes('chop') || fullText.includes('dice') || fullText.includes('slice')) {
      prepTime = '20-30' // Requires prep work
    }
  }
  
  let cookMatch = fullText.match(/cook(?:\s+time)?[:\s]+(\d+(?:\s*-\s*\d+)?\s*(?:min|minute|hr|hour)s?)/i)
  if (!cookMatch) {
    // Try "Cook Time: X" format
    cookMatch = fullText.match(/cook\s+time[:\s]+(\d+(?:\s*-\s*\d+)?\s*(?:min|minute|hr|hour)s?)/i)
  }
  if (!cookMatch) {
    // Try "cooking time" or "bake time"
    cookMatch = fullText.match(/(?:cooking|bake)(?:\s+time)?[:\s]+(\d+(?:\s*-\s*\d+)?\s*(?:min|minute|hr|hour)s?)/i)
  }
  if (!cookMatch) {
    // Try "bake for X" or "cook for X"
    cookMatch = fullText.match(/(?:bake|cook)\s+for\s+(\d+(?:\s*-\s*\d+)?\s*(?:min|minute|hr|hour)s?)/i)
  }
  if (cookMatch) cookTime = cookMatch[1]
  
  let totalMatch = fullText.match(/total(?:\s+time)?[:\s]+(\d+\s*(?:min|minute|hr|hour)s?)/i)
  if (!totalMatch) {
    // Try "total cooking time" or "all together"
    totalMatch = fullText.match(/total\s+(?:cooking\s+)?time[:\s]+(\d+\s*(?:min|minute|hr|hour)s?)/i)
  }
  if (!totalMatch) {
    // Try "all together X" or "total X"
    totalMatch = fullText.match(/all\s+together[:\s]+(\d+\s*(?:min|minute|hr|hour)s?)/i)
  }
  if (totalMatch) totalTime = totalMatch[1]
  
  // Extract difficulty - try multiple patterns
  let difficultyMatch = fullText.match(/difficulty[:\s]+(easy|medium|hard|beginner|intermediate|advanced)/i)
  if (!difficultyMatch) {
    // Try "level" or "skill"
    difficultyMatch = fullText.match(/(?:level|skill)[:\s]+(easy|medium|hard|beginner|intermediate|advanced)/i)
  }
  if (!difficultyMatch) {
    // Try standalone difficulty words
    difficultyMatch = fullText.match(/\b(easy|medium|hard|beginner|intermediate|advanced)\b/i)
  }
  if (!difficultyMatch) {
    // Try "super easy" or "very easy"
    difficultyMatch = fullText.match(/(?:super|very|really)\s+(easy|hard)/i)
  }
  if (!difficultyMatch) {
    // Try "simple" or "complex"
    if (fullText.includes('simple') || fullText.includes('quick') || fullText.includes('basic')) {
      difficulty = 'easy'
    } else if (fullText.includes('complex') || fullText.includes('advanced') || fullText.includes('challenging')) {
      difficulty = 'hard'
    }
  } else {
    difficulty = difficultyMatch[1].toLowerCase()
  }
  
  // Override difficulty based on recipe complexity (even if title says "easy")
  if (fullText.includes('tiramisu') || fullText.includes('layered') || fullText.includes('multiple steps') ||
      fullText.includes('whip') || fullText.includes('fold') || fullText.includes('temper')) {
    difficulty = 'medium' // Complex techniques override "easy" in title
  }
  
  // Extract cuisine type
  const cuisineKeywords = [
    'italian', 'mexican', 'chinese', 'japanese', 'thai', 'indian', 'french', 'mediterranean',
    'american', 'greek', 'korean', 'vietnamese', 'spanish', 'german', 'british', 'caribbean',
    'middle eastern', 'turkish', 'lebanese', 'moroccan', 'persian', 'african', 'brazilian',
    'argentinian', 'peruvian', 'chilean', 'australian', 'canadian', 'scandinavian'
  ]
  
  for (const cuisineKeyword of cuisineKeywords) {
    if (fullText.includes(cuisineKeyword)) {
      cuisine = cuisineKeyword
      break
    }
  }
  
  // Extract course/meal type
  const courseKeywords = [
    'appetizer', 'starter', 'soup', 'salad', 'main course', 'main dish', 'entree',
    'side dish', 'dessert', 'snack', 'breakfast', 'lunch', 'dinner', 'brunch',
    'beverage', 'drink', 'cocktail', 'sauce', 'condiment', 'dip', 'spread'
  ]
  
  for (const courseKeyword of courseKeywords) {
    if (fullText.includes(courseKeyword)) {
      course = courseKeyword
      break
    }
  }
  
  // Extract meal type - more comprehensive detection
  const mealKeywords = [
    'breakfast', 'brunch', 'lunch', 'dinner', 'supper', 'snack', 'appetizer',
    'dessert', 'midnight snack', 'late night', 'morning', 'afternoon', 'evening',
    'main course', 'starter', 'afternoon tea'
  ]
  
  // Try exact matches first
  for (const mealKeyword of mealKeywords) {
    if (fullText.includes(mealKeyword)) {
      mealType = mealKeyword
      break
    }
  }
  
  // If no exact match, try to infer from recipe type
  if (!mealType) {
    if (fullText.includes('cake') || fullText.includes('cookie') || fullText.includes('pie') || 
        fullText.includes('tiramisu') || fullText.includes('ice cream') || fullText.includes('pudding') ||
        fullText.includes('cheesecake') || fullText.includes('mousse') || fullText.includes('tart') ||
        fullText.includes('rolls') || fullText.includes('muffin') || fullText.includes('brownie') ||
        fullText.includes('donut') || fullText.includes('cupcake')) {
      mealType = 'dessert'
    } else if (fullText.includes('soup') || fullText.includes('stew') || fullText.includes('broth')) {
      mealType = 'soup'
    } else if (fullText.includes('pancake') || fullText.includes('waffle') || fullText.includes('toast') ||
               fullText.includes('cereal') || fullText.includes('oatmeal')) {
      mealType = 'breakfast'
    } else if (fullText.includes('pizza') || fullText.includes('burger') || fullText.includes('sandwich') ||
               fullText.includes('pasta') || fullText.includes('rice') || fullText.includes('noodle') ||
               fullText.includes('chicken') || fullText.includes('beef') || fullText.includes('pork') ||
               fullText.includes('fish') || fullText.includes('shrimp')) {
      mealType = 'main'
    } else if (fullText.includes('dip') || fullText.includes('sauce') || fullText.includes('spread') ||
               fullText.includes('cracker') || fullText.includes('chip') || fullText.includes('bite')) {
      mealType = 'snack'
    }
  }
  
  // Extract dietary tags
  const dietaryTagsList: string[] = []
  const dietaryKeywords = [
    'vegan', 'vegetarian', 'gluten-free', 'dairy-free', 'nut-free', 'soy-free',
    'keto', 'paleo', 'low-carb', 'low-fat', 'high-protein', 'sugar-free',
    'halal', 'kosher', 'raw', 'organic', 'whole30', 'atkins', 'south beach'
  ]
  
  for (const dietaryKeyword of dietaryKeywords) {
    if (fullText.includes(dietaryKeyword)) {
      dietaryTagsList.push(dietaryKeyword)
    }
  }
  
  if (dietaryTagsList.length > 0) {
    dietaryTags = dietaryTagsList
  }
  
  // Get description from first few lines of general section
  const generalDescription = sections.general
    .slice(0, 3)
    .join(' ')
    .trim()
    .substring(0, 500) || null
  
  return {
    title,
    description: description || generalDescription,
    ingredients,
    instructions,
    prepTime,
    cookTime,
    totalTime,
    servings,
    difficulty,
    cuisine,
    course,
    mealType,
    dietaryTags
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
  console.log(`  User: ${row.user}`)
  console.log(`  Date: ${row.date}`)
  console.log(`  Comment length: ${row.n_char} characters`)
  console.log('\nParsing recipe data locally (no AI)...')

  try {
    const recipeData = parseRecipeFromComment(row.comment, row.title)
    
    console.log(`  Found ${recipeData.ingredients.length} ingredients`)
    console.log(`  Found ${recipeData.instructions.length} instruction steps`)
    
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
  console.error('Usage: node dist/src/utils/reddit_csv_to_json_local.js <csv-file-path> <entry-number>')
  console.error('Example: node dist/src/utils/reddit_csv_to_json_local.js data/raw/Reddit_Recipes.csv 5')
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

