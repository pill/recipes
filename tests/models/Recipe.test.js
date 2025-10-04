import { describe, it, expect } from 'vitest';
describe('Recipe Model', () => {
    describe('Recipe interface', () => {
        it('should create a valid Recipe object', () => {
            const recipe = {
                title: 'Chocolate Chip Cookies',
                description: 'Classic homemade chocolate chip cookies',
                ingredients: [],
                instructions: ['Mix ingredients', 'Bake for 12 minutes'],
                prep_time_minutes: 15,
                cook_time_minutes: 12,
                total_time_minutes: 27,
                servings: 24,
                difficulty: 'easy',
                cuisine_type: 'American',
                meal_type: 'dessert',
                dietary_tags: ['vegetarian'],
                reddit_author: 'test_user',
                reddit_score: 42
            };
            expect(recipe.title).toBe('Chocolate Chip Cookies');
            expect(recipe.difficulty).toBe('easy');
            expect(recipe.meal_type).toBe('dessert');
            expect(recipe.dietary_tags).toEqual(['vegetarian']);
        });
        it('should handle optional fields', () => {
            const minimalRecipe = {
                title: 'Simple Recipe',
                ingredients: [],
                instructions: ['Do something']
            };
            expect(minimalRecipe.title).toBe('Simple Recipe');
            expect(minimalRecipe.description).toBeUndefined();
            expect(minimalRecipe.prep_time_minutes).toBeUndefined();
            expect(minimalRecipe.difficulty).toBeUndefined();
        });
    });
    describe('Ingredient interface', () => {
        it('should create a valid Ingredient object', () => {
            const ingredient = {
                name: 'Flour',
                category: 'Baking',
                description: 'All-purpose flour'
            };
            expect(ingredient.name).toBe('Flour');
            expect(ingredient.category).toBe('Baking');
            expect(ingredient.description).toBe('All-purpose flour');
        });
        it('should handle minimal Ingredient object', () => {
            const ingredient = {
                name: 'Salt'
            };
            expect(ingredient.name).toBe('Salt');
            expect(ingredient.category).toBeUndefined();
            expect(ingredient.description).toBeUndefined();
        });
    });
    describe('Measurement interface', () => {
        it('should create a valid Measurement object', () => {
            const measurement = {
                name: 'Cup',
                abbreviation: 'c',
                unit_type: 'volume'
            };
            expect(measurement.name).toBe('Cup');
            expect(measurement.abbreviation).toBe('c');
            expect(measurement.unit_type).toBe('volume');
        });
        it('should handle all unit types', () => {
            const volumeMeasurement = {
                name: 'Liter',
                unit_type: 'volume'
            };
            const weightMeasurement = {
                name: 'Gram',
                unit_type: 'weight'
            };
            const countMeasurement = {
                name: 'Piece',
                unit_type: 'count'
            };
            expect(volumeMeasurement.unit_type).toBe('volume');
            expect(weightMeasurement.unit_type).toBe('weight');
            expect(countMeasurement.unit_type).toBe('count');
        });
    });
    describe('RecipeIngredient interface', () => {
        it('should create a valid RecipeIngredient object', () => {
            const recipeIngredient = {
                ingredient_id: 1,
                measurement_id: 2,
                amount: 2.5,
                notes: 'room temperature',
                order_index: 1
            };
            expect(recipeIngredient.ingredient_id).toBe(1);
            expect(recipeIngredient.measurement_id).toBe(2);
            expect(recipeIngredient.amount).toBe(2.5);
            expect(recipeIngredient.notes).toBe('room temperature');
            expect(recipeIngredient.order_index).toBe(1);
        });
        it('should handle populated ingredient and measurement data', () => {
            const recipeIngredient = {
                ingredient_id: 1,
                measurement_id: 2,
                amount: 1,
                ingredient: {
                    name: 'Butter',
                    category: 'Dairy'
                },
                measurement: {
                    name: 'Cup',
                    abbreviation: 'c',
                    unit_type: 'volume'
                }
            };
            expect(recipeIngredient.ingredient?.name).toBe('Butter');
            expect(recipeIngredient.measurement?.abbreviation).toBe('c');
        });
    });
    describe('RecipeFilters interface', () => {
        it('should create a valid RecipeFilters object', () => {
            const filters = {
                cuisine_type: 'Italian',
                meal_type: 'dinner',
                difficulty: 'medium',
                dietary_tags: ['vegetarian', 'gluten-free'],
                max_prep_time: 30,
                max_cook_time: 60,
                min_servings: 4
            };
            expect(filters.cuisine_type).toBe('Italian');
            expect(filters.meal_type).toBe('dinner');
            expect(filters.difficulty).toBe('medium');
            expect(filters.dietary_tags).toEqual(['vegetarian', 'gluten-free']);
            expect(filters.max_prep_time).toBe(30);
            expect(filters.max_cook_time).toBe(60);
            expect(filters.min_servings).toBe(4);
        });
        it('should handle partial filters', () => {
            const partialFilters = {
                difficulty: 'easy'
            };
            expect(partialFilters.difficulty).toBe('easy');
            expect(partialFilters.cuisine_type).toBeUndefined();
            expect(partialFilters.dietary_tags).toBeUndefined();
        });
    });
});
//# sourceMappingURL=Recipe.test.js.map