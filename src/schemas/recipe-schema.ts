import { z } from 'zod';

// Schema for recipe ingredients based on sample JSON
export const RecipeIngredientSchema = z.object({
  item: z.string().describe('The ingredient name'),
  amount: z.string().describe('The amount of the ingredient (e.g., "1 C", "2-3 Tbsp")'),
  notes: z.string().optional().describe('Additional notes or preparation instructions for the ingredient')
});

// Schema for recipe instructions based on sample JSON
export const RecipeInstructionSchema = z.object({
  step: z.number().describe('The step number'),
  title: z.string().describe('The title or brief description of the step'),
  description: z.string().describe('Detailed description of what to do in this step')
});

// Main recipe schema based on sample JSON structure
export const RecipeSchema = z.object({
  title: z.string().describe('The recipe title'),
  description: z.string().optional().describe('Brief description of the recipe'),
  ingredients: z.array(RecipeIngredientSchema).min(1).describe('List of ingredients with amounts and notes'),
  instructions: z.array(RecipeInstructionSchema).min(1).describe('Step-by-step cooking instructions with titles and descriptions'),
  prepTime: z.string().optional().describe('Preparation time (e.g., "30 minutes")'),
  chillTime: z.string().optional().describe('Chilling/resting time (e.g., "at least 6 hours")'),
  panSize: z.string().optional().describe('Required pan or dish size (e.g., "8x5 in")')
});

// Type inference from the schema
export type Recipe = z.infer<typeof RecipeSchema>;
export type RecipeIngredient = z.infer<typeof RecipeIngredientSchema>;
export type RecipeInstruction = z.infer<typeof RecipeInstructionSchema>;

// Example usage:
/*
import { RecipeSchema } from './schemas/recipe-schema';
import { getAIService } from '../services/AIService';

const aiService = getAIService();
const recipeData = await aiService.extractStructuredData(
  redditPostText,
  RecipeSchema,
  {
    model: 'claude-3-haiku-20240307',
    systemPrompt: 'You are an expert at extracting detailed recipe information from Reddit posts. Focus on accuracy and completeness, including all ingredients with amounts and detailed step-by-step instructions.'
  }
);
*/
