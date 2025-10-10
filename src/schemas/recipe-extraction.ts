import { z } from 'zod';

// Schema for extracting recipe data from Reddit posts
// This schema is intentionally very flexible to handle varied input quality
export const RecipeExtractionSchema = z.object({
  title: z.string().nullable().optional().catch('Untitled Recipe').describe('The recipe title'),
  description: z.string().nullable().optional().catch(null).describe('Brief description of the recipe'),
  ingredients: z.array(z.object({
    name: z.string().nullable().optional().catch('Unknown ingredient').describe('Ingredient name'),
    quantity: z.union([z.number(), z.string()]).nullable().optional().catch(null).describe('ONLY the numeric quantity (e.g., 2, 1.5, "1-2"). Do NOT include the unit here.'),
    unit: z.string().nullable().optional().catch(null).describe('Unit of measurement SEPARATE from quantity (e.g., "cups", "tablespoons", "lbs", "grams", "tsp"). ALWAYS extract the unit if present.'),
    notes: z.string().nullable().optional().catch(null).describe('Additional notes or preparation instructions (e.g., "chopped", "diced", "optional")')
  })).optional().catch([]).describe('List of ingredients - extract as many as you can identify. IMPORTANT: Keep quantity and unit separate!'),
  instructions: z.array(z.string().nullable()).optional().catch([]).describe('Step-by-step cooking instructions - break down into clear steps'),
  prepTime: z.union([z.number(), z.string()]).nullable().optional().catch(null).describe('Preparation time in minutes (can be a number or string like "30-45")'),
  cookTime: z.union([z.number(), z.string()]).nullable().optional().catch(null).describe('Cooking time in minutes (can be a number or string like "60-90")'),
  servings: z.union([z.number(), z.string()]).nullable().optional().catch(null).describe('Number of servings (can be a number or range like "2-4" or "4-6")'),
  difficulty: z.string().nullable().optional().catch(null).describe('Recipe difficulty level - prefer: easy, medium, or hard'),
  cuisineType: z.string().nullable().optional().catch(null).describe('Type of cuisine (e.g., Italian, Mexican, Asian, American)'),
  mealType: z.string().nullable().optional().catch(null).describe('Type of meal - prefer: breakfast, lunch, dinner, snack, or dessert'),
  dietaryTags: z.array(z.string().nullable()).optional().catch([]).describe('Dietary restrictions or tags (e.g., vegetarian, vegan, gluten-free, dairy-free)')
}).passthrough();

export type RecipeExtraction = z.infer<typeof RecipeExtractionSchema>;

// Example usage:
/*
const aiService = getAIService();
const recipeData = await aiService.extractStructuredData(
  redditPostText,
  RecipeExtractionSchema,
  {
    model: 'claude-3-haiku-20240307',
    systemPrompt: 'You are an expert at extracting recipe information from Reddit posts. Focus on accuracy and completeness.'
  }
);
*/
