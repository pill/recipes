import { Ingredient } from '../models/Recipe'

// Simple ingredient type for parsing (before database storage)
export interface ParsedIngredient {
  amount: string
  name: string
}

export type RecipeData = {
  title: string
  description?: string | null
  ingredients: ParsedIngredient[]
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

export function parseIngredients(ingredientsText: string): ParsedIngredient[] {
  const ingredients: ParsedIngredient[] = []
  const lines = ingredientsText.split('\n').filter(line => line.trim())
  
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.length < 3) continue
    
    // Remove markdown formatting
    const cleaned = trimmed.replace(/^[\*\-\+\•]\s*/, '').trim()
    
    // Parse ingredient with amount and unit
    const match = cleaned.match(/^(.+?)\s*[-–—]\s*(.+)$/)
    if (match) {
      ingredients.push({
        amount: match[1].trim(),
        name: match[2].trim()
      })
    } else {
      // Try to split on common separators
      const parts = cleaned.split(/\s*[-–—]\s*|\s*:\s*/)
      if (parts.length >= 2) {
        ingredients.push({
          amount: parts[0].trim(),
          name: parts.slice(1).join(' ').trim()
        })
      } else {
        // If no clear separator, try to extract amount from beginning
        const amountMatch = cleaned.match(/^(\d+(?:\/\d+)?(?:\s+\d+\/\d+)?(?:\s*(?:cup|tbsp|tsp|oz|lb|gram|ml|c\.|tsp\.|tbsp\.|tablespoon|teaspoon|ounce|pound|kilogram|liter|g|kg|l|ml|cl|dl))?\s*)/i)
        if (amountMatch) {
          ingredients.push({
            amount: amountMatch[1].trim(),
            name: cleaned.substring(amountMatch[1].length).trim()
          })
        } else {
          ingredients.push({
            amount: '',
            name: cleaned
          })
        }
      }
    }
  }
  
  return ingredients
}

export function parseInstructions(instructionsText: string): string[] {
  const instructions: string[] = []
  const lines = instructionsText.split('\n').filter(line => line.trim())
  
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.length < 10) continue
    
    // Remove markdown formatting and numbering
    let cleaned = trimmed
      .replace(/^\d+\.?\s*/, '') // Remove "1. " or "1)"
      .replace(/^[\*\-\+\•]\s*/, '') // Remove bullet points
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.*?)\*/g, '$1') // Remove italic
      .replace(/~~(.*?)~~/g, '$1') // Remove strikethrough
      .replace(/^\*+|\*+$/g, '') // Remove trailing asterisks
      .trim()
    
    if (cleaned.length > 10) {
      instructions.push(cleaned)
    }
  }
  
  return instructions
}

export function parseRedditRecipeLocal(comment: string, title: string): RecipeData {
  // Parse sections
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
    
    if (/^(ingredient|what you need|you('ll)? need|materials|items)/i.test(cleaned)) {
      currentSection = 'ingredients'
      continue
    } else if (/^(instruction|direction|step|method|how to|preparation|prep|procedure)/i.test(cleaned)) {
      currentSection = 'instructions'
      continue
    }
    
    if (currentSection === 'ingredients') {
      sections.ingredients.push(line)
    } else if (currentSection === 'instructions') {
      sections.instructions.push(line)
    } else {
      sections.general.push(line)
    }
  }
  
  // Auto-detect if no explicit sections
  if (sections.ingredients.length === 0 && sections.instructions.length === 0) {
    for (const line of lines) {
      const trimmed = line.trim()
      if (/\d+\.?\d*\s*(cup|tbsp|tsp|oz|lb|gram|ml|c\.|tsp\.|tbsp\.)/i.test(trimmed)) {
        sections.ingredients.push(line)
      } else if (/^(mix|stir|add|pour|bake|cook|heat|boil|fry|blend|combine|place|put|remove|serve)/i.test(trimmed)) {
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
    'turkish', 'moroccan', 'lebanese', 'ethiopian', 'brazilian', 'argentinian', 'peruvian',
    'filipino', 'indonesian', 'malaysian', 'singaporean', 'australian', 'canadian', 'south african'
  ]
  
  for (const cuisineKeyword of cuisineKeywords) {
    if (fullText.includes(cuisineKeyword)) {
      cuisine = cuisineKeyword
      break
    }
  }
  
  // Extract course type
  const courseKeywords = [
    'appetizer', 'starter', 'soup', 'salad', 'main dish', 'main course', 'side dish', 'dessert',
    'beverage', 'drink', 'snack', 'breakfast', 'lunch', 'dinner', 'brunch', 'sauce', 'dip',
    'spread', 'condiment', 'marinade', 'dressing', 'topping', 'garnish', 'bread', 'roll',
    'muffin', 'cake', 'cookie', 'pie', 'tart', 'pastry', 'candy', 'ice cream', 'pudding'
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
    'keto', 'paleo', 'low-carb', 'high-protein', 'raw', 'organic', 'halal', 'kosher',
    'sugar-free', 'low-sodium', 'fat-free', 'lactose-free', 'egg-free', 'shellfish-free'
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

export function parseStrombergRecipeLocal(ingredients: string[], directions: string[], title: string): RecipeData {
  // Parse ingredients from JSON array
  const parsedIngredients: ParsedIngredient[] = ingredients.map(ing => {
    // Try to split on common patterns
    const parts = ing.split(/\s*[-–—]\s*|\s*:\s*/)
    if (parts.length >= 2) {
      return {
        amount: parts[0].trim(),
        name: parts.slice(1).join(' ').trim()
      }
    } else {
      // Try to extract amount from beginning
      const amountMatch = ing.match(/^(\d+(?:\/\d+)?(?:\s+\d+\/\d+)?(?:\s*(?:cup|tbsp|tsp|oz|lb|gram|ml|c\.|tsp\.|tbsp\.|tablespoon|teaspoon|ounce|pound|kilogram|liter|g|kg|l|ml|cl|dl))?\s*)/i)
      if (amountMatch) {
        return {
          amount: amountMatch[1].trim(),
          name: ing.substring(amountMatch[1].length).trim()
        }
      } else {
        return {
          amount: '',
          name: ing
        }
      }
    }
  })

  // Parse instructions from JSON array
  const instructions = directions.map(dir => {
    // Remove markdown formatting
    return dir
      .replace(/^\d+\.?\s*/, '') // Remove numbering
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.*?)\*/g, '$1') // Remove italic
      .replace(/~~(.*?)~~/g, '$1') // Remove strikethrough
      .replace(/^\*+|\*+$/g, '') // Remove trailing asterisks
      .trim()
  }).filter(inst => inst.length > 10)

  // For Stromberg data, we'll extract metadata from the combined text
  const combinedText = [...ingredients, ...directions].join(' ').toLowerCase()
  
  // Extract servings
  let servings: number | string | null = null
  const servingsMatch = combinedText.match(/(?:serves?|servings?|yields?|makes?)[:\s]+(\d+(?:\s*-\s*\d+)?)/i)
  if (servingsMatch) {
    servings = servingsMatch[1].includes('-') ? servingsMatch[1] : parseInt(servingsMatch[1])
  }

  // Extract times
  let prepTime: string | null = null
  let cookTime: string | null = null
  let totalTime: string | null = null
  
  const prepMatch = combinedText.match(/prep(?:\s+time)?[:\s]+(\d+(?:\s*-\s*\d+)?\s*(?:min|minute|hr|hour)s?)/i)
  if (prepMatch) prepTime = prepMatch[1]
  
  const cookMatch = combinedText.match(/cook(?:\s+time)?[:\s]+(\d+(?:\s*-\s*\d+)?\s*(?:min|minute|hr|hour)s?)/i)
  if (cookMatch) cookTime = cookMatch[1]
  
  const totalMatch = combinedText.match(/total(?:\s+time)?[:\s]+(\d+(?:\s*-\s*\d+)?\s*(?:min|minute|hr|hour)s?)/i)
  if (totalMatch) totalTime = totalMatch[1]

  // Extract difficulty
  let difficulty: string | null = null
  const difficultyMatch = combinedText.match(/difficulty[:\s]+(easy|medium|hard|beginner|intermediate|advanced)/i)
  if (difficultyMatch) {
    difficulty = difficultyMatch[1].toLowerCase()
  } else if (combinedText.includes('simple') || combinedText.includes('quick')) {
    difficulty = 'easy'
  } else if (combinedText.includes('complex') || combinedText.includes('advanced')) {
    difficulty = 'hard'
  }

  // Extract cuisine type
  let cuisine: string | null = null
  const cuisineKeywords = [
    'italian', 'mexican', 'chinese', 'japanese', 'thai', 'indian', 'french', 'mediterranean',
    'american', 'greek', 'korean', 'vietnamese', 'spanish', 'german', 'british', 'caribbean'
  ]
  
  for (const cuisineKeyword of cuisineKeywords) {
    if (combinedText.includes(cuisineKeyword)) {
      cuisine = cuisineKeyword
      break
    }
  }

  // Extract course type
  let course: string | null = null
  const courseKeywords = [
    'appetizer', 'starter', 'soup', 'salad', 'main dish', 'main course', 'side dish', 'dessert',
    'beverage', 'drink', 'snack', 'breakfast', 'lunch', 'dinner', 'brunch', 'sauce', 'dip'
  ]
  
  for (const courseKeyword of courseKeywords) {
    if (combinedText.includes(courseKeyword)) {
      course = courseKeyword
      break
    }
  }

  // Extract meal type
  let mealType: string | null = null
  const mealKeywords = [
    'breakfast', 'brunch', 'lunch', 'dinner', 'supper', 'snack', 'appetizer', 'dessert'
  ]
  
  for (const mealKeyword of mealKeywords) {
    if (combinedText.includes(mealKeyword)) {
      mealType = mealKeyword
      break
    }
  }

  // Extract dietary tags
  let dietaryTags: string[] | null = null
  const dietaryTagsList: string[] = []
  const dietaryKeywords = [
    'vegan', 'vegetarian', 'gluten-free', 'dairy-free', 'nut-free', 'soy-free',
    'keto', 'paleo', 'low-carb', 'high-protein', 'raw', 'organic', 'halal', 'kosher'
  ]
  
  for (const dietaryKeyword of dietaryKeywords) {
    if (combinedText.includes(dietaryKeyword)) {
      dietaryTagsList.push(dietaryKeyword)
    }
  }
  
  if (dietaryTagsList.length > 0) {
    dietaryTags = dietaryTagsList
  }

  return {
    title,
    description: null,
    ingredients: parsedIngredients,
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
