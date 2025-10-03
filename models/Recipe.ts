export interface Recipe {
  id?: number;
  title: string;
  description?: string;
  ingredients: RecipeIngredient[];
  instructions: string[];
  prep_time_minutes?: number;
  cook_time_minutes?: number;
  total_time_minutes?: number;
  servings?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  cuisine_type?: string;
  meal_type?: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'dessert';
  dietary_tags?: string[]; // ['vegetarian', 'vegan', 'gluten-free', etc.]
  source_url?: string;
  reddit_post_id?: string;
  reddit_author?: string;
  reddit_score?: number;
  reddit_comments_count?: number;
  created_at?: Date;
  updated_at?: Date;
}

export interface Ingredient {
  id?: number;
  name: string;
  category?: string;
  description?: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface Measurement {
  id?: number;
  name: string;
  abbreviation?: string;
  unit_type?: 'volume' | 'weight' | 'count' | 'length' | 'temperature' | 'other';
  created_at?: Date;
  updated_at?: Date;
}

export interface RecipeIngredient {
  id?: number;
  recipe_id?: number;
  ingredient_id: number;
  measurement_id?: number;
  amount?: number;
  notes?: string;
  order_index?: number;
  created_at?: Date;
  // Populated fields when joining with ingredients and measurements
  ingredient?: Ingredient;
  measurement?: Measurement;
}

export interface RecipeFilters {
  cuisine_type?: string;
  meal_type?: string;
  difficulty?: string;
  dietary_tags?: string[];
  max_prep_time?: number;
  max_cook_time?: number;
  min_servings?: number;
}
