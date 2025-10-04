import { testConnection, closeConnection } from '../src/database';
import { RecipeService } from '../src/services/RecipeService';
import { Recipe } from '../src/models/Recipe';

async function testDatabase() {
  console.log('🍳 Testing Reddit Recipes Database');
  console.log('==================================');
  
  try {
    // Test database connection
    console.log('\n1. Testing database connection...');
    const connected = await testConnection();
    if (!connected) {
      console.log('❌ Database connection failed. Make sure PostgreSQL is running.');
      return;
    }
    
    // Test creating a recipe
    console.log('\n2. Creating a test recipe...');
    const newRecipe: Omit<Recipe, 'id' | 'created_at' | 'updated_at'> = {
      title: 'Chocolate Chip Cookies',
      description: 'Classic homemade chocolate chip cookies',
      ingredients: [
        { ingredient_id: 1, amount: 2.25, ingredient: { name: 'all-purpose flour' }, measurement: { name: 'cups' } },
        { ingredient_id: 2, amount: 1, ingredient: { name: 'butter' }, measurement: { name: 'cup' } },
        { ingredient_id: 3, amount: 0.75, ingredient: { name: 'brown sugar' }, measurement: { name: 'cup' } },
        { ingredient_id: 4, amount: 0.5, ingredient: { name: 'white sugar' }, measurement: { name: 'cup' } },
        { ingredient_id: 5, amount: 2, ingredient: { name: 'chocolate chips' }, measurement: { name: 'cups' } },
        { ingredient_id: 6, amount: 2, ingredient: { name: 'eggs' }, measurement: { name: 'large' } },
        { ingredient_id: 7, amount: 2, ingredient: { name: 'vanilla extract' }, measurement: { name: 'tsp' } },
        { ingredient_id: 8, amount: 1, ingredient: { name: 'baking soda' }, measurement: { name: 'tsp' } },
        { ingredient_id: 9, amount: 1, ingredient: { name: 'salt' }, measurement: { name: 'tsp' } }
      ],
      instructions: [
        'Preheat oven to 375°F (190°C)',
        'Mix butter and sugars until creamy',
        'Beat in eggs and vanilla',
        'Combine flour, baking soda, and salt; gradually add to butter mixture',
        'Stir in chocolate chips',
        'Drop rounded tablespoons onto ungreased cookie sheets',
        'Bake 9-11 minutes until golden brown'
      ],
      prep_time_minutes: 15,
      cook_time_minutes: 11,
      total_time_minutes: 26,
      servings: 48,
      difficulty: 'easy',
      cuisine_type: 'American',
      meal_type: 'dessert',
      dietary_tags: ['vegetarian'],
      reddit_author: 'test_user',
      reddit_score: 42
    };
    
    const createdRecipe = await RecipeService.create(newRecipe);
    console.log('✅ Recipe created with ID:', createdRecipe.id);
    console.log('📝 Title:', createdRecipe.title);
    
    // Test getting recipe by ID
    console.log('\n3. Retrieving recipe by ID...');
    const retrievedRecipe = await RecipeService.getById(createdRecipe.id!);
    if (retrievedRecipe) {
      console.log('✅ Recipe retrieved successfully');
      console.log('🍪 Ingredients count:', retrievedRecipe.ingredients.length);
      console.log('📋 Instructions count:', retrievedRecipe.instructions.length);
    }
    
    // Test searching recipes
    console.log('\n4. Searching for recipes...');
    const searchResults = await RecipeService.search('chocolate');
    console.log('🔍 Found', searchResults.length, 'recipes matching "chocolate"');
    
    // Test filtering recipes
    console.log('\n5. Filtering recipes by dessert type...');
    const dessertRecipes = await RecipeService.getAll({
      meal_type: 'dessert'
    });
    console.log('🍰 Found', dessertRecipes.length, 'dessert recipes');
    
    // Test getting statistics
    console.log('\n6. Getting database statistics...');
    const stats = await RecipeService.getStats();
    console.log('📊 Database Stats:');
    console.log('   Total recipes:', stats.total_recipes);
    console.log('   Unique cuisines:', stats.unique_cuisines);
    console.log('   Average prep time:', Math.round(stats.avg_prep_time || 0), 'minutes');
    console.log('   Average Reddit score:', Math.round(stats.avg_reddit_score || 0));
    
    console.log('\n✅ All database tests passed!');
    
  } catch (error) {
    console.error('❌ Database test failed:', error);
  } finally {
    await closeConnection();
  }
}

// Run the test
testDatabase();
