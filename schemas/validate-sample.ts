import { RecipeSchema } from './recipe-schema';
import sampleData from '../data/samples/sample-json.json';

// Function to validate the sample JSON against our Zod schema
export function validateSampleData() {
  try {
    const result = RecipeSchema.parse(sampleData);
    console.log('✅ Sample data is valid!');
    console.log('Parsed recipe:', {
      title: result.title,
      ingredientCount: result.ingredients.length,
      instructionCount: result.instructions.length,
      prepTime: result.prepTime,
      chillTime: result.chillTime,
      panSize: result.panSize
    });
    return { success: true, data: result };
  } catch (error) {
    console.error('❌ Sample data validation failed:');
    if (error instanceof Error) {
      console.error('Error:', error.message);
    }
    return { success: false, error };
  }
}

// Function to get validation errors in a more readable format
export function getValidationErrors() {
  try {
    RecipeSchema.parse(sampleData);
    return null; // No errors
  } catch (error) {
    if (error instanceof Error) {
      return error.message;
    }
    return 'Unknown validation error';
  }
}

// Run validation if this file is executed directly
if (require.main === module) {
  validateSampleData();
}
