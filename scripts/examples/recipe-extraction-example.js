import { RecipeSchema } from '../schemas/recipe-schema';
import { getAIService } from '../services/AIService';
// Example Reddit post text (you would replace this with actual Reddit post content)
const sampleRedditPost = `
Title: Easy Tiramisu Recipe (no raw eggs!)

This is by no means "authentic" tiramisu in that it has no raw eggs, but it's just as tasty!

Ingredients:
- About 1.5 packages of HARD lady fingers (NOT the soft ones. Imported from Italy preferred.)
- 2 C strong coffee/espresso
- 9 Tbsp rum or marsala wine (Can half this for a less pronounced alcoholic flavor)
- 1 C heavy cream
- 1-1.5 lb mascarpone
- 2/3 C sugar, divided
- 1 tsp vanilla extract
- 2-3 Tbsp cocoa powder
- Handful chopped chocolate/chocolate shavings (optional)

Instructions:
1. Prepare coffee/alcohol for dipping: Combine coffee in a wide, shallow bowl, and combine with about 5 Tbsp of the rum. Set aside.

2. Prepare mascarpone/cream mixture: Whip heavy cream with 1/3 C sugar, 1 tsp vanilla extract, and 2 Tbsp rum, until you have soft peaks. Then, slowly fold in the mascarpone along with the other 1/3 C sugar and 2 Tbsp rum. Whip altogether until nice and fluffy. Set aside.

3. Prepare tiramisu layers: Dip each side of a lady finger into the coffee/rum mixture for no more than 1-2 seconds per side (DO NOT DIP TOO LONG; This is the biggest mistake in making tiramisu. NO SOGGINESS!). Then, carefully lay in a pan (8x5 in), making sure all the ladyfingers are lined up side by side; trim if needed to fix snugly into pan. Then, add a generous, even layer of the mascarpone/cream mixture on top of the ladyfingers, smoothing them out on the edges with a spatula. Dust with some cocoa powder with a colander/sieve. Repeat the ladyfinger layer with the final mascarpone layer, and dust the top with cocoa powder and chocolate shavings if using.

4. Refrigerate tiramisu: Refrigerate for at least 6 hours to allow it to set, and allowing the lady fingers to soften well. Cut with a clean knife, wiping off between slices for the cleanest edges, and enjoy!

Prep time: 30 minutes
Chill time: at least 6 hours
Pan size: 8x5 in
`;
async function demonstrateRecipeExtraction() {
    try {
        console.log('🍰 Demonstrating recipe extraction with Zod schema...\n');
        const aiService = getAIService();
        // Method 1: Using the generic extractStructuredData method
        console.log('Method 1: Using extractStructuredData with RecipeSchema');
        const recipeData = await aiService.extractStructuredData(sampleRedditPost, RecipeSchema, {
            model: 'claude-3-haiku-20240307',
            systemPrompt: 'You are an expert at extracting detailed recipe information from Reddit posts. Focus on accuracy and completeness.'
        });
        console.log('✅ Successfully extracted recipe data:');
        console.log(`Title: ${recipeData.title}`);
        console.log(`Description: ${recipeData.description}`);
        console.log(`Ingredients: ${recipeData.ingredients.length} items`);
        console.log(`Instructions: ${recipeData.instructions.length} steps`);
        console.log(`Prep Time: ${recipeData.prepTime}`);
        console.log(`Chill Time: ${recipeData.chillTime}`);
        console.log(`Pan Size: ${recipeData.panSize}`);
        // Method 2: Using the specialized extractRecipeData method (when the linting issue is fixed)
        // console.log('\nMethod 2: Using extractRecipeData method');
        // const recipeData2 = await aiService.extractRecipeData(sampleRedditPost);
        // console.log('✅ Recipe extracted using specialized method');
    }
    catch (error) {
        console.error('❌ Error during recipe extraction:', error);
    }
}
// Run the demonstration if this file is executed directly
if (require.main === module) {
    demonstrateRecipeExtraction();
}
export { demonstrateRecipeExtraction };
//# sourceMappingURL=recipe-extraction-example.js.map