import { describe, it, expect } from 'vitest';
import { RecipeSchema, RecipeIngredientSchema, RecipeInstructionSchema } from '../../src/schemas/recipe-schema';
describe('Recipe Schema', () => {
    describe('RecipeIngredientSchema', () => {
        it('should validate valid ingredient', () => {
            const validIngredient = {
                item: 'Flour',
                amount: '2 cups',
                notes: 'all-purpose'
            };
            const result = RecipeIngredientSchema.parse(validIngredient);
            expect(result.item).toBe('Flour');
            expect(result.amount).toBe('2 cups');
            expect(result.notes).toBe('all-purpose');
        });
        it('should validate ingredient without notes', () => {
            const ingredient = {
                item: 'Salt',
                amount: '1 tsp'
            };
            const result = RecipeIngredientSchema.parse(ingredient);
            expect(result.item).toBe('Salt');
            expect(result.amount).toBe('1 tsp');
            expect(result.notes).toBeUndefined();
        });
        it('should reject invalid ingredient', () => {
            const invalidIngredient = {
                item: 123, // Should be string
                amount: '1 cup'
            };
            expect(() => RecipeIngredientSchema.parse(invalidIngredient)).toThrow();
        });
        it('should reject ingredient without required fields', () => {
            const incompleteIngredient = {
                amount: '1 cup'
                // Missing 'item'
            };
            expect(() => RecipeIngredientSchema.parse(incompleteIngredient)).toThrow();
        });
    });
    describe('RecipeInstructionSchema', () => {
        it('should validate valid instruction', () => {
            const validInstruction = {
                step: 1,
                title: 'Mix dry ingredients',
                description: 'In a large bowl, whisk together flour, sugar, and salt'
            };
            const result = RecipeInstructionSchema.parse(validInstruction);
            expect(result.step).toBe(1);
            expect(result.title).toBe('Mix dry ingredients');
            expect(result.description).toBe('In a large bowl, whisk together flour, sugar, and salt');
        });
        it('should reject invalid instruction', () => {
            const invalidInstruction = {
                step: 'first', // Should be number
                title: 'Mix ingredients',
                description: 'Mix everything together'
            };
            expect(() => RecipeInstructionSchema.parse(invalidInstruction)).toThrow();
        });
        it('should reject instruction without required fields', () => {
            const incompleteInstruction = {
                step: 1,
                title: 'Mix ingredients'
                // Missing 'description'
            };
            expect(() => RecipeInstructionSchema.parse(incompleteInstruction)).toThrow();
        });
    });
    describe('RecipeSchema', () => {
        it('should validate complete recipe', () => {
            const validRecipe = {
                title: 'Chocolate Chip Cookies',
                description: 'Classic homemade chocolate chip cookies',
                ingredients: [
                    {
                        item: 'All-purpose flour',
                        amount: '2 1/4 cups',
                        notes: 'sifted'
                    },
                    {
                        item: 'Butter',
                        amount: '1 cup',
                        notes: 'room temperature'
                    },
                    {
                        item: 'Chocolate chips',
                        amount: '2 cups'
                    }
                ],
                instructions: [
                    {
                        step: 1,
                        title: 'Preheat oven',
                        description: 'Preheat oven to 375°F (190°C)'
                    },
                    {
                        step: 2,
                        title: 'Mix wet ingredients',
                        description: 'In a large bowl, cream together butter and sugars until light and fluffy'
                    },
                    {
                        step: 3,
                        title: 'Add dry ingredients',
                        description: 'Gradually add flour mixture to butter mixture, mixing until just combined'
                    }
                ],
                prepTime: '15 minutes',
                chillTime: '30 minutes',
                panSize: '2 large baking sheets'
            };
            const result = RecipeSchema.parse(validRecipe);
            expect(result.title).toBe('Chocolate Chip Cookies');
            expect(result.description).toBe('Classic homemade chocolate chip cookies');
            expect(result.ingredients).toHaveLength(3);
            expect(result.instructions).toHaveLength(3);
            expect(result.prepTime).toBe('15 minutes');
            expect(result.chillTime).toBe('30 minutes');
            expect(result.panSize).toBe('2 large baking sheets');
        });
        it('should validate minimal recipe', () => {
            const minimalRecipe = {
                title: 'Simple Recipe',
                ingredients: [
                    {
                        item: 'Ingredient',
                        amount: '1 cup'
                    }
                ],
                instructions: [
                    {
                        step: 1,
                        title: 'Do something',
                        description: 'Mix the ingredient'
                    }
                ]
            };
            const result = RecipeSchema.parse(minimalRecipe);
            expect(result.title).toBe('Simple Recipe');
            expect(result.description).toBeUndefined();
            expect(result.prepTime).toBeUndefined();
            expect(result.chillTime).toBeUndefined();
            expect(result.panSize).toBeUndefined();
        });
        it('should reject recipe without title', () => {
            const invalidRecipe = {
                ingredients: [
                    {
                        item: 'Ingredient',
                        amount: '1 cup'
                    }
                ],
                instructions: [
                    {
                        step: 1,
                        title: 'Do something',
                        description: 'Mix the ingredient'
                    }
                ]
            };
            expect(() => RecipeSchema.parse(invalidRecipe)).toThrow();
        });
        it('should reject recipe without ingredients', () => {
            const invalidRecipe = {
                title: 'Recipe without ingredients',
                instructions: [
                    {
                        step: 1,
                        title: 'Do something',
                        description: 'Mix the ingredient'
                    }
                ]
            };
            expect(() => RecipeSchema.parse(invalidRecipe)).toThrow();
        });
        it('should reject recipe without instructions', () => {
            const invalidRecipe = {
                title: 'Recipe without instructions',
                ingredients: [
                    {
                        item: 'Ingredient',
                        amount: '1 cup'
                    }
                ]
            };
            expect(() => RecipeSchema.parse(invalidRecipe)).toThrow();
        });
        it('should reject recipe with empty ingredients array', () => {
            const invalidRecipe = {
                title: 'Recipe with empty ingredients',
                ingredients: [],
                instructions: [
                    {
                        step: 1,
                        title: 'Do something',
                        description: 'Mix the ingredient'
                    }
                ]
            };
            expect(() => RecipeSchema.parse(invalidRecipe)).toThrow();
        });
        it('should reject recipe with empty instructions array', () => {
            const invalidRecipe = {
                title: 'Recipe with empty instructions',
                ingredients: [
                    {
                        item: 'Ingredient',
                        amount: '1 cup'
                    }
                ],
                instructions: []
            };
            expect(() => RecipeSchema.parse(invalidRecipe)).toThrow();
        });
        it('should handle complex ingredient amounts', () => {
            const recipe = {
                title: 'Complex Recipe',
                ingredients: [
                    {
                        item: 'Flour',
                        amount: '2-3 cups',
                        notes: 'add gradually until dough comes together'
                    },
                    {
                        item: 'Salt',
                        amount: '1/2 tsp',
                        notes: 'or to taste'
                    },
                    {
                        item: 'Butter',
                        amount: '1/4 cup (4 Tbsp)',
                        notes: 'cold, cut into small pieces'
                    }
                ],
                instructions: [
                    {
                        step: 1,
                        title: 'Prepare ingredients',
                        description: 'Measure all ingredients and have them ready'
                    }
                ]
            };
            const result = RecipeSchema.parse(recipe);
            expect(result.ingredients[0].amount).toBe('2-3 cups');
            expect(result.ingredients[1].amount).toBe('1/2 tsp');
            expect(result.ingredients[2].amount).toBe('1/4 cup (4 Tbsp)');
        });
        it('should handle multi-step instructions', () => {
            const recipe = {
                title: 'Multi-step Recipe',
                ingredients: [
                    {
                        item: 'Ingredient',
                        amount: '1 cup'
                    }
                ],
                instructions: [
                    {
                        step: 1,
                        title: 'First step',
                        description: 'Do the first thing'
                    },
                    {
                        step: 2,
                        title: 'Second step',
                        description: 'Do the second thing'
                    },
                    {
                        step: 3,
                        title: 'Final step',
                        description: 'Do the final thing and serve'
                    }
                ]
            };
            const result = RecipeSchema.parse(recipe);
            expect(result.instructions).toHaveLength(3);
            expect(result.instructions[0].step).toBe(1);
            expect(result.instructions[1].step).toBe(2);
            expect(result.instructions[2].step).toBe(3);
        });
    });
});
//# sourceMappingURL=recipe-schema.test.js.map