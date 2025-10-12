-- Create the database (run this manually if database doesn't exist)
-- CREATE DATABASE recipes;

-- Create ingredients table
CREATE TABLE IF NOT EXISTS ingredients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL UNIQUE,
    category VARCHAR(100), -- e.g., 'dairy', 'vegetables', 'spices', 'meat'
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create measurements table
CREATE TABLE IF NOT EXISTS measurements (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    abbreviation VARCHAR(20),
    unit_type VARCHAR(50), -- e.g., 'volume', 'weight', 'count', 'length'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create recipes table
CREATE TABLE IF NOT EXISTS recipes (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    instructions JSONB NOT NULL DEFAULT '[]',
    prep_time_minutes INTEGER,
    cook_time_minutes INTEGER,
    total_time_minutes INTEGER,
    servings DECIMAL(10,2), -- Allow fractional servings like 1.5 or 3.5
    difficulty VARCHAR(20) CHECK (difficulty IN ('easy', 'medium', 'hard')),
    cuisine_type VARCHAR(100),
    meal_type VARCHAR(20) CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack', 'dessert')),
    dietary_tags TEXT[],
    source_url TEXT,
    reddit_post_id VARCHAR(50),
    reddit_author VARCHAR(100),
    reddit_score INTEGER,
    reddit_comments_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create recipe_ingredients junction table
CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id SERIAL PRIMARY KEY,
    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    measurement_id INTEGER REFERENCES measurements(id) ON DELETE SET NULL,
    amount DECIMAL(10,3), -- Can store fractional amounts like 1.5
    notes TEXT, -- Additional notes like "chopped", "diced", "optional"
    order_index INTEGER, -- Order of ingredients in the recipe
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(recipe_id, ingredient_id, order_index)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_recipes_title ON recipes USING gin(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_recipes_cuisine_type ON recipes(cuisine_type);
CREATE INDEX IF NOT EXISTS idx_recipes_meal_type ON recipes(meal_type);
CREATE INDEX IF NOT EXISTS idx_recipes_difficulty ON recipes(difficulty);
CREATE INDEX IF NOT EXISTS idx_recipes_dietary_tags ON recipes USING gin(dietary_tags);
CREATE INDEX IF NOT EXISTS idx_recipes_reddit_post_id ON recipes(reddit_post_id);

-- Indexes for ingredients table
CREATE INDEX IF NOT EXISTS idx_ingredients_name ON ingredients(name);
CREATE INDEX IF NOT EXISTS idx_ingredients_category ON ingredients(category);

-- Indexes for measurements table
CREATE INDEX IF NOT EXISTS idx_measurements_name ON measurements(name);
CREATE INDEX IF NOT EXISTS idx_measurements_unit_type ON measurements(unit_type);

-- Indexes for recipe_ingredients junction table
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id ON recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_ingredient_id ON recipe_ingredients(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_measurement_id ON recipe_ingredients(measurement_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_order ON recipe_ingredients(recipe_id, order_index);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
DROP TRIGGER IF EXISTS update_recipes_updated_at ON recipes;
CREATE TRIGGER update_recipes_updated_at
    BEFORE UPDATE ON recipes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ingredients_updated_at ON ingredients;
CREATE TRIGGER update_ingredients_updated_at
    BEFORE UPDATE ON ingredients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_measurements_updated_at ON measurements;
CREATE TRIGGER update_measurements_updated_at
    BEFORE UPDATE ON measurements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample measurements
INSERT INTO measurements (name, abbreviation, unit_type) VALUES
('gram', 'g', 'weight'),
('kilogram', 'kg', 'weight'),
('milliliter', 'ml', 'volume'),
('liter', 'l', 'volume'),
('tablespoon', 'tbsp', 'volume'),
('teaspoon', 'tsp', 'volume'),
('cup', 'cup', 'volume'),
('piece', 'pc', 'count'),
('pinch', 'pinch', 'volume'),
('dash', 'dash', 'volume')
ON CONFLICT (name) DO NOTHING;

-- Insert sample ingredients
INSERT INTO ingredients (name, category, description) VALUES
('mascarpone cheese', 'dairy', 'Italian cream cheese'),
('heavy cream', 'dairy', 'High-fat cream for whipping'),
('sugar', 'sweetener', 'Granulated white sugar'),
('ladyfinger cookies', 'baked goods', 'Sponge cake cookies for tiramisu'),
('espresso', 'beverage', 'Strong coffee'),
('cocoa powder', 'spice', 'Unsweetened cocoa powder')
ON CONFLICT (name) DO NOTHING;

-- Insert sample recipe
INSERT INTO recipes (
    title, 
    description, 
    instructions, 
    prep_time_minutes, 
    cook_time_minutes, 
    servings, 
    difficulty, 
    cuisine_type, 
    meal_type, 
    dietary_tags,
    reddit_author,
    reddit_score
) VALUES (
    'Easy Tiramisu (Raw-Egg-Free)',
    'A delicious tiramisu recipe without raw eggs, perfect for those who prefer a cooked version.',
    '["Mix mascarpone with sugar until smooth", "Whip heavy cream until stiff peaks", "Fold whipped cream into mascarpone mixture", "Dip ladyfingers in espresso briefly", "Layer ladyfingers and cream mixture", "Dust with cocoa powder", "Refrigerate for at least 4 hours"]',
    30,
    0,
    8,
    'easy',
    'Italian',
    'dessert',
    ARRAY['vegetarian'],
    'yvonnemeetsfood',
    28
) ON CONFLICT DO NOTHING;

-- Insert recipe ingredients (assuming recipe ID 1 and the ingredient/measurement IDs from above)
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, measurement_id, amount, notes, order_index) VALUES
(1, (SELECT id FROM ingredients WHERE name = 'mascarpone cheese'), (SELECT id FROM measurements WHERE name = 'gram'), 500, NULL, 1),
(1, (SELECT id FROM ingredients WHERE name = 'heavy cream'), (SELECT id FROM measurements WHERE name = 'milliliter'), 300, NULL, 2),
(1, (SELECT id FROM ingredients WHERE name = 'sugar'), (SELECT id FROM measurements WHERE name = 'gram'), 100, NULL, 3),
(1, (SELECT id FROM ingredients WHERE name = 'ladyfinger cookies'), (SELECT id FROM measurements WHERE name = 'gram'), 200, NULL, 4),
(1, (SELECT id FROM ingredients WHERE name = 'espresso'), (SELECT id FROM measurements WHERE name = 'milliliter'), 250, NULL, 5),
(1, (SELECT id FROM ingredients WHERE name = 'cocoa powder'), (SELECT id FROM measurements WHERE name = 'tablespoon'), 2, NULL, 6)
ON CONFLICT (recipe_id, ingredient_id, order_index) DO NOTHING;
