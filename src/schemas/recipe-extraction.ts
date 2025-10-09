import { z } from 'zod';

// Schema for extracting recipe data from Reddit posts
export const RecipeExtractionSchema = z.object({
  title: z.string().nullable().default('Untitled Recipe').describe('The recipe title'),
  description: z.string().nullable().optional().describe('Brief description of the recipe'),
  ingredients: z.array(z.object({
    name: z.string().nullable().default('Unknown ingredient').describe('Ingredient name'),
    quantity: z.number().nullable().optional().describe('Numeric quantity (e.g., 2, 1.5, 0.5)'),
    unit: z.string().nullable().optional().describe('Unit of measurement (e.g., "cups", "lbs", "tbsp", "tsp")'),
    notes: z.string().nullable().optional().describe('Additional notes or preparation instructions')
  })).default([]).describe('List of ingredients'),
  instructions: z.array(z.string().nullable()).default([]).describe('Step-by-step cooking instructions'),
  prepTime: z.number().nullable().optional().describe('Preparation time in minutes'),
  cookTime: z.number().nullable().optional().describe('Cooking time in minutes'),
  servings: z.number().nullable().optional().describe('Number of servings'),
  difficulty: z.enum(['easy', 'medium', 'hard']).nullable().optional().describe('Recipe difficulty level'),
  cuisineType: z.string().nullable().optional().describe('Type of cuisine (e.g., Italian, Mexican, Asian)'),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack', 'dessert']).nullable().optional().describe('Type of meal'),
  dietaryTags: z.array(z.string().nullable()).default([]).describe('Dietary restrictions or tags (e.g., vegetarian, gluten-free)')
});

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
