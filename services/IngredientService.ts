import { pool } from '../database';
import { Ingredient, Measurement } from '../models/Recipe';

export class IngredientService {
  
  // Create a new ingredient
  static async createIngredient(ingredient: Omit<Ingredient, 'id' | 'created_at' | 'updated_at'>): Promise<Ingredient> {
    const query = `
      INSERT INTO ingredients (name, category, description)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    
    const values = [ingredient.name, ingredient.category, ingredient.description];
    const result = await pool.query(query, values);
    return this.mapDbRowToIngredient(result.rows[0]);
  }
  
  // Get ingredient by ID
  static async getIngredientById(id: number): Promise<Ingredient | null> {
    const query = 'SELECT * FROM ingredients WHERE id = $1';
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapDbRowToIngredient(result.rows[0]);
  }
  
  // Get ingredient by name
  static async getIngredientByName(name: string): Promise<Ingredient | null> {
    const query = 'SELECT * FROM ingredients WHERE name = $1';
    const result = await pool.query(query, [name]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapDbRowToIngredient(result.rows[0]);
  }
  
  // Get all ingredients with optional filtering
  static async getAllIngredients(category?: string, limit = 100, offset = 0): Promise<Ingredient[]> {
    let query = 'SELECT * FROM ingredients WHERE 1=1';
    const values: any[] = [];
    let paramCount = 0;
    
    if (category) {
      paramCount++;
      query += ` AND category = $${paramCount}`;
      values.push(category);
    }
    
    query += ` ORDER BY name ASC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    values.push(limit, offset);
    
    const result = await pool.query(query, values);
    return result.rows.map(row => this.mapDbRowToIngredient(row));
  }
  
  // Search ingredients by name
  static async searchIngredients(searchTerm: string, limit = 50): Promise<Ingredient[]> {
    const query = `
      SELECT * FROM ingredients 
      WHERE name ILIKE $1 OR description ILIKE $1
      ORDER BY name ASC
      LIMIT $2
    `;
    
    const result = await pool.query(query, [`%${searchTerm}%`, limit]);
    return result.rows.map(row => this.mapDbRowToIngredient(row));
  }
  
  // Update ingredient
  static async updateIngredient(id: number, updates: Partial<Ingredient>): Promise<Ingredient | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 0;
    
    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && value !== undefined) {
        paramCount++;
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
      }
    });
    
    if (fields.length === 0) {
      return this.getIngredientById(id);
    }
    
    paramCount++;
    values.push(id);
    
    const query = `
      UPDATE ingredients 
      SET ${fields.join(', ')} 
      WHERE id = $${paramCount} 
      RETURNING *
    `;
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapDbRowToIngredient(result.rows[0]);
  }
  
  // Delete ingredient
  static async deleteIngredient(id: number): Promise<boolean> {
    const query = 'DELETE FROM ingredients WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rowCount > 0;
  }
  
  // Create a new measurement
  static async createMeasurement(measurement: Omit<Measurement, 'id' | 'created_at' | 'updated_at'>): Promise<Measurement> {
    const query = `
      INSERT INTO measurements (name, abbreviation, unit_type)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    
    const values = [measurement.name, measurement.abbreviation, measurement.unit_type];
    const result = await pool.query(query, values);
    return this.mapDbRowToMeasurement(result.rows[0]);
  }
  
  // Get measurement by ID
  static async getMeasurementById(id: number): Promise<Measurement | null> {
    const query = 'SELECT * FROM measurements WHERE id = $1';
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapDbRowToMeasurement(result.rows[0]);
  }
  
  // Get measurement by name
  static async getMeasurementByName(name: string): Promise<Measurement | null> {
    const query = 'SELECT * FROM measurements WHERE name = $1';
    const result = await pool.query(query, [name]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapDbRowToMeasurement(result.rows[0]);
  }
  
  // Get all measurements with optional filtering
  static async getAllMeasurements(unitType?: string, limit = 100, offset = 0): Promise<Measurement[]> {
    let query = 'SELECT * FROM measurements WHERE 1=1';
    const values: any[] = [];
    let paramCount = 0;
    
    if (unitType) {
      paramCount++;
      query += ` AND unit_type = $${paramCount}`;
      values.push(unitType);
    }
    
    query += ` ORDER BY name ASC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    values.push(limit, offset);
    
    const result = await pool.query(query, values);
    return result.rows.map(row => this.mapDbRowToMeasurement(row));
  }
  
  // Search measurements by name
  static async searchMeasurements(searchTerm: string, limit = 50): Promise<Measurement[]> {
    const query = `
      SELECT * FROM measurements 
      WHERE name ILIKE $1 OR abbreviation ILIKE $1
      ORDER BY name ASC
      LIMIT $2
    `;
    
    const result = await pool.query(query, [`%${searchTerm}%`, limit]);
    return result.rows.map(row => this.mapDbRowToMeasurement(row));
  }
  
  // Update measurement
  static async updateMeasurement(id: number, updates: Partial<Measurement>): Promise<Measurement | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 0;
    
    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && value !== undefined) {
        paramCount++;
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
      }
    });
    
    if (fields.length === 0) {
      return this.getMeasurementById(id);
    }
    
    paramCount++;
    values.push(id);
    
    const query = `
      UPDATE measurements 
      SET ${fields.join(', ')} 
      WHERE id = $${paramCount} 
      RETURNING *
    `;
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapDbRowToMeasurement(result.rows[0]);
  }
  
  // Delete measurement
  static async deleteMeasurement(id: number): Promise<boolean> {
    const query = 'DELETE FROM measurements WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rowCount > 0;
  }
  
  // Get or create ingredient (useful for bulk operations)
  static async getOrCreateIngredient(name: string, category?: string, description?: string): Promise<Ingredient> {
    let ingredient = await this.getIngredientByName(name);
    
    if (!ingredient) {
      ingredient = await this.createIngredient({ name, category, description });
    }
    
    return ingredient;
  }
  
  // Get or create measurement (useful for bulk operations)
  static async getOrCreateMeasurement(name: string, abbreviation?: string, unitType?: string): Promise<Measurement> {
    let measurement = await this.getMeasurementByName(name);
    
    if (!measurement) {
      measurement = await this.createMeasurement({ name, abbreviation, unitType });
    }
    
    return measurement;
  }
  
  // Helper method to map database row to Ingredient object
  private static mapDbRowToIngredient(row: any): Ingredient {
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      description: row.description,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
  
  // Helper method to map database row to Measurement object
  private static mapDbRowToMeasurement(row: any): Measurement {
    return {
      id: row.id,
      name: row.name,
      abbreviation: row.abbreviation,
      unit_type: row.unit_type,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}
