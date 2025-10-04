import { pool } from '../database';
import { Recipe, RecipeFilters, RecipeIngredient, Ingredient, Measurement } from '../models/Recipe';
import { IngredientService } from './IngredientService';

export class RecipeService {
  
  // Create a new recipe
  static async create(recipe: Omit<Recipe, 'id' | 'created_at' | 'updated_at'>): Promise<Recipe> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Insert the recipe
      const recipeQuery = `
        INSERT INTO recipes (
          title, description, instructions, prep_time_minutes,
          cook_time_minutes, total_time_minutes, servings, difficulty,
          cuisine_type, meal_type, dietary_tags, source_url,
          reddit_post_id, reddit_author, reddit_score, reddit_comments_count
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *
      `;
      
      const recipeValues = [
        recipe.title,
        recipe.description,
        JSON.stringify(recipe.instructions),
        recipe.prep_time_minutes,
        recipe.cook_time_minutes,
        recipe.total_time_minutes,
        recipe.servings,
        recipe.difficulty,
        recipe.cuisine_type,
        recipe.meal_type,
        recipe.dietary_tags,
        recipe.source_url,
        recipe.reddit_post_id,
        recipe.reddit_author,
        recipe.reddit_score,
        recipe.reddit_comments_count
      ];
      
      const recipeResult = await client.query(recipeQuery, recipeValues);
      const newRecipe = recipeResult.rows[0];
      
      // Insert recipe ingredients
      if (recipe.ingredients && recipe.ingredients.length > 0) {
        await this.insertRecipeIngredients(client, newRecipe.id, recipe.ingredients);
      }
      
      await client.query('COMMIT');
      
      // Fetch the complete recipe with ingredients
      const completeRecipe = await this.getById(newRecipe.id);
      if (!completeRecipe) {
        throw new Error('Failed to fetch created recipe');
      }
      return completeRecipe;
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  // Get recipe by ID
  static async getById(id: number): Promise<Recipe | null> {
    const query = `
      SELECT 
        r.*,
        ri.id as recipe_ingredient_id,
        ri.ingredient_id,
        ri.measurement_id,
        ri.amount,
        ri.notes,
        ri.order_index,
        i.name as ingredient_name,
        i.category as ingredient_category,
        i.description as ingredient_description,
        m.name as measurement_name,
        m.abbreviation as measurement_abbreviation,
        m.unit_type as measurement_unit_type
      FROM recipes r
      LEFT JOIN recipe_ingredients ri ON r.id = ri.recipe_id
      LEFT JOIN ingredients i ON ri.ingredient_id = i.id
      LEFT JOIN measurements m ON ri.measurement_id = m.id
      WHERE r.id = $1
      ORDER BY ri.order_index ASC
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapDbRowsToRecipe(result.rows);
  }
  
  // Get all recipes with optional filtering
  static async getAll(filters?: RecipeFilters, limit = 50, offset = 0): Promise<Recipe[]> {
    let baseQuery = 'SELECT DISTINCT r.id FROM recipes r WHERE 1=1';
    const values: any[] = [];
    let paramCount = 0;
    
    if (filters?.cuisine_type) {
      paramCount++;
      baseQuery += ` AND r.cuisine_type = $${paramCount}`;
      values.push(filters.cuisine_type);
    }
    
    if (filters?.meal_type) {
      paramCount++;
      baseQuery += ` AND r.meal_type = $${paramCount}`;
      values.push(filters.meal_type);
    }
    
    if (filters?.difficulty) {
      paramCount++;
      baseQuery += ` AND r.difficulty = $${paramCount}`;
      values.push(filters.difficulty);
    }
    
    if (filters?.dietary_tags && filters.dietary_tags.length > 0) {
      paramCount++;
      baseQuery += ` AND r.dietary_tags && $${paramCount}`;
      values.push(filters.dietary_tags);
    }
    
    if (filters?.max_prep_time) {
      paramCount++;
      baseQuery += ` AND r.prep_time_minutes <= $${paramCount}`;
      values.push(filters.max_prep_time);
    }
    
    if (filters?.max_cook_time) {
      paramCount++;
      baseQuery += ` AND r.cook_time_minutes <= $${paramCount}`;
      values.push(filters.max_cook_time);
    }
    
    if (filters?.min_servings) {
      paramCount++;
      baseQuery += ` AND r.servings >= $${paramCount}`;
      values.push(filters.min_servings);
    }
    
    baseQuery += ` ORDER BY r.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    values.push(limit, offset);
    
    // Get recipe IDs first
    const recipeIdsResult = await pool.query(baseQuery, values);
    const recipeIds = recipeIdsResult.rows.map(row => row.id);
    
    if (recipeIds.length === 0) {
      return [];
    }
    
    // Now fetch full recipes with ingredients
    const query = `
      SELECT 
        r.*,
        ri.id as recipe_ingredient_id,
        ri.ingredient_id,
        ri.measurement_id,
        ri.amount,
        ri.notes,
        ri.order_index,
        i.name as ingredient_name,
        i.category as ingredient_category,
        i.description as ingredient_description,
        m.name as measurement_name,
        m.abbreviation as measurement_abbreviation,
        m.unit_type as measurement_unit_type
      FROM recipes r
      LEFT JOIN recipe_ingredients ri ON r.id = ri.recipe_id
      LEFT JOIN ingredients i ON ri.ingredient_id = i.id
      LEFT JOIN measurements m ON ri.measurement_id = m.id
      WHERE r.id = ANY($${paramCount + 3})
      ORDER BY r.created_at DESC, ri.order_index ASC
    `;
    
    const result = await pool.query(query, [...values, recipeIds]);
    
    // Group results by recipe ID
    const recipeMap = new Map<number, Recipe>();
    
    result.rows.forEach(row => {
      if (!recipeMap.has(row.id)) {
        recipeMap.set(row.id, this.mapDbRowToRecipe(row));
      }
      
      if (row.recipe_ingredient_id) {
        const recipe = recipeMap.get(row.id)!;
        recipe.ingredients.push(this.mapDbRowToRecipeIngredient(row));
      }
    });
    
    return Array.from(recipeMap.values());
  }
  
  // Search recipes by text
  static async search(searchTerm: string, limit = 50): Promise<Recipe[]> {
    // First get recipe IDs that match the search
    const recipeIdsQuery = `
      SELECT DISTINCT r.id FROM recipes r 
      WHERE to_tsvector('english', r.title || ' ' || COALESCE(r.description, '')) @@ plainto_tsquery('english', $1)
      ORDER BY ts_rank(to_tsvector('english', r.title || ' ' || COALESCE(r.description, '')), plainto_tsquery('english', $1)) DESC
      LIMIT $2
    `;
    
    const recipeIdsResult = await pool.query(recipeIdsQuery, [searchTerm, limit]);
    const recipeIds = recipeIdsResult.rows.map(row => row.id);
    
    if (recipeIds.length === 0) {
      return [];
    }
    
    // Now fetch full recipes with ingredients
    const query = `
      SELECT 
        r.*,
        ri.id as recipe_ingredient_id,
        ri.ingredient_id,
        ri.measurement_id,
        ri.amount,
        ri.notes,
        ri.order_index,
        i.name as ingredient_name,
        i.category as ingredient_category,
        i.description as ingredient_description,
        m.name as measurement_name,
        m.abbreviation as measurement_abbreviation,
        m.unit_type as measurement_unit_type
      FROM recipes r
      LEFT JOIN recipe_ingredients ri ON r.id = ri.recipe_id
      LEFT JOIN ingredients i ON ri.ingredient_id = i.id
      LEFT JOIN measurements m ON ri.measurement_id = m.id
      WHERE r.id = ANY($1)
      ORDER BY ri.order_index ASC
    `;
    
    const result = await pool.query(query, [recipeIds]);
    
    // Group results by recipe ID
    const recipeMap = new Map<number, Recipe>();
    
    result.rows.forEach(row => {
      if (!recipeMap.has(row.id)) {
        recipeMap.set(row.id, this.mapDbRowToRecipe(row));
      }
      
      if (row.recipe_ingredient_id) {
        const recipe = recipeMap.get(row.id)!;
        recipe.ingredients.push(this.mapDbRowToRecipeIngredient(row));
      }
    });
    
    return Array.from(recipeMap.values());
  }
  
  // Update recipe
  static async update(id: number, updates: Partial<Recipe>): Promise<Recipe | null> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const fields: string[] = [];
      const values: any[] = [];
      let paramCount = 0;
      
      // Handle non-ingredient fields
      Object.entries(updates).forEach(([key, value]) => {
        if (key !== 'id' && key !== 'ingredients' && value !== undefined) {
          paramCount++;
          fields.push(`${key} = $${paramCount}`);
          
          // Handle JSON fields
          if (key === 'instructions') {
            values.push(JSON.stringify(value));
          } else {
            values.push(value);
          }
        }
      });
      
      if (fields.length > 0) {
        paramCount++;
        values.push(id);
        
        const query = `
          UPDATE recipes 
          SET ${fields.join(', ')} 
          WHERE id = $${paramCount} 
          RETURNING *
        `;
        
        await client.query(query, values);
      }
      
      // Handle ingredients update
      if (updates.ingredients !== undefined) {
        // Delete existing recipe ingredients
        await client.query('DELETE FROM recipe_ingredients WHERE recipe_id = $1', [id]);
        
        // Insert new recipe ingredients
        if (updates.ingredients.length > 0) {
          await this.insertRecipeIngredients(client, id, updates.ingredients);
        }
      }
      
      await client.query('COMMIT');
      
      // Fetch the complete recipe with ingredients
      return await this.getById(id);
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  // Delete recipe
  static async delete(id: number): Promise<boolean> {
    const query = 'DELETE FROM recipes WHERE id = $1';
    const result = await pool.query(query, [id]);
    return (result.rowCount ?? 0) > 0;
  }
  
  // Get recipe statistics
  static async getStats(): Promise<any> {
    const query = `
      SELECT 
        COUNT(*) as total_recipes,
        COUNT(DISTINCT cuisine_type) as unique_cuisines,
        COUNT(DISTINCT meal_type) as unique_meal_types,
        AVG(prep_time_minutes) as avg_prep_time,
        AVG(cook_time_minutes) as avg_cook_time,
        AVG(reddit_score) as avg_reddit_score
      FROM recipes
    `;
    
    const result = await pool.query(query);
    return result.rows[0];
  }
  
  // Helper method to insert recipe ingredients
  private static async insertRecipeIngredients(client: any, recipeId: number, ingredients: RecipeIngredient[]): Promise<void> {
    for (let i = 0; i < ingredients.length; i++) {
      const ingredient = ingredients[i];
      
      // Get or create ingredient
      const ingredientRecord = await IngredientService.getOrCreateIngredient(
        ingredient.ingredient?.name || 'Unknown Ingredient',
        ingredient.ingredient?.category,
        ingredient.ingredient?.description
      );
      
      // Get or create measurement if provided
      let measurementId = null;
      if (ingredient.measurement?.name) {
        const measurementRecord = await IngredientService.getOrCreateMeasurement(
          ingredient.measurement.name,
          ingredient.measurement.abbreviation,
          ingredient.measurement.unit_type
        );
        measurementId = measurementRecord.id;
      }
      
      // Insert recipe ingredient
      const query = `
        INSERT INTO recipe_ingredients (recipe_id, ingredient_id, measurement_id, amount, notes, order_index)
        VALUES ($1, $2, $3, $4, $5, $6)
      `;
      
      await client.query(query, [
        recipeId,
        ingredientRecord.id,
        measurementId,
        ingredient.amount,
        ingredient.notes,
        ingredient.order_index || i + 1
      ]);
    }
  }
  
  // Helper method to map database rows to Recipe object (for joined queries)
  private static mapDbRowsToRecipe(rows: any[]): Recipe {
    if (rows.length === 0) {
      throw new Error('No rows provided to mapDbRowsToRecipe');
    }
    
    const firstRow = rows[0];
    const recipe: Recipe = {
      id: firstRow.id,
      title: firstRow.title,
      description: firstRow.description,
      ingredients: [],
      instructions: firstRow.instructions || [],
      prep_time_minutes: firstRow.prep_time_minutes,
      cook_time_minutes: firstRow.cook_time_minutes,
      total_time_minutes: firstRow.total_time_minutes,
      servings: firstRow.servings,
      difficulty: firstRow.difficulty,
      cuisine_type: firstRow.cuisine_type,
      meal_type: firstRow.meal_type,
      dietary_tags: firstRow.dietary_tags,
      source_url: firstRow.source_url,
      reddit_post_id: firstRow.reddit_post_id,
      reddit_author: firstRow.reddit_author,
      reddit_score: firstRow.reddit_score,
      reddit_comments_count: firstRow.reddit_comments_count,
      created_at: firstRow.created_at,
      updated_at: firstRow.updated_at
    };
    
    // Add ingredients
    rows.forEach(row => {
      if (row.recipe_ingredient_id) {
        recipe.ingredients.push(this.mapDbRowToRecipeIngredient(row));
      }
    });
    
    return recipe;
  }
  
  // Helper method to map database row to RecipeIngredient object
  private static mapDbRowToRecipeIngredient(row: any): RecipeIngredient {
    const recipeIngredient: RecipeIngredient = {
      id: row.recipe_ingredient_id,
      recipe_id: row.id,
      ingredient_id: row.ingredient_id,
      measurement_id: row.measurement_id,
      amount: row.amount,
      notes: row.notes,
      order_index: row.order_index,
      created_at: row.created_at
    };
    
    // Add populated ingredient data if available
    if (row.ingredient_name) {
      recipeIngredient.ingredient = {
        id: row.ingredient_id,
        name: row.ingredient_name,
        category: row.ingredient_category,
        description: row.ingredient_description
      };
    }
    
    // Add populated measurement data if available
    if (row.measurement_name) {
      recipeIngredient.measurement = {
        id: row.measurement_id,
        name: row.measurement_name,
        abbreviation: row.measurement_abbreviation,
        unit_type: row.measurement_unit_type
      };
    }
    
    return recipeIngredient;
  }
  
  // Helper method to map database row to Recipe object (for single row queries)
  private static mapDbRowToRecipe(row: any): Recipe {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      ingredients: [],
      instructions: row.instructions || [],
      prep_time_minutes: row.prep_time_minutes,
      cook_time_minutes: row.cook_time_minutes,
      total_time_minutes: row.total_time_minutes,
      servings: row.servings,
      difficulty: row.difficulty,
      cuisine_type: row.cuisine_type,
      meal_type: row.meal_type,
      dietary_tags: row.dietary_tags,
      source_url: row.source_url,
      reddit_post_id: row.reddit_post_id,
      reddit_author: row.reddit_author,
      reddit_score: row.reddit_score,
      reddit_comments_count: row.reddit_comments_count,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}
