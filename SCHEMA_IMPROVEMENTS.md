# Recipe Extraction Schema Improvements

## Problems Encountered

### Issue 1: Schema validation errors
```
Failed to extract structured data: No object generated: response did not match schema.
```

### Issue 2: Type errors with numeric fields
```
Error: Expected number, received string
value: { title: 'Creme Brulee', servings: '2-4', ... }
```

The AI was returning strings like `"2-4"` for numeric fields, causing validation failures.

## Root Causes

1. **Strict Enums**: The schema used strict TypeScript enums for `difficulty` and `mealType` that would fail if the AI returned variations like "Simple" instead of "easy"

2. **Strict Number Types**: Numeric fields only accepted `number` type, but AI often returns ranges as strings like `"2-4"` or `"30-45 minutes"`

3. **Missing Fallbacks**: No fallback values when the AI couldn't determine a field value

4. **Rigid Validation**: Schema was too strict for handling informal Reddit post text

## Solutions Implemented

### 1. Flexible Schema with Catch Handlers

**Before:**
```typescript
difficulty: z.enum(['easy', 'medium', 'hard']).nullable().optional()
```

**After:**
```typescript
difficulty: z.string().nullable().optional().catch(null)
```

**Changes:**
- Removed strict enums, now accepts any string
- Added `.catch()` handlers to provide fallback values on parsing errors
- Added `.passthrough()` to allow extra fields without failing
- Made all fields more lenient with `nullable` and `optional`

### 2. Improved AI Prompt

Added detailed system prompt for better extraction:

```typescript
systemPrompt: `You are an expert at extracting recipe information from Reddit posts. 
Extract as much information as possible, even if incomplete. 
If a field cannot be determined, use null or omit it.
For ingredients: extract name, quantity, and unit when available.
For instructions: break down the steps clearly.
Be flexible with format - Reddit posts may have informal recipe descriptions.
If the text is not a recipe at all, still try to extract any food-related information.`
```

### 3. Union Types for Numeric Fields

**Before:**
```typescript
servings: z.number().nullable().optional()
prepTime: z.number().nullable().optional()
```

**After:**
```typescript
servings: z.union([z.number(), z.string()]).nullable().optional().catch(null)
prepTime: z.union([z.number(), z.string()]).nullable().optional().catch(null)
```

**Changes:**
- Accepts both numbers and strings for numeric fields
- Handles ranges like `"2-4"` or `"30-45 minutes"`
- Also applies to `cookTime`, `prepTime`, `servings`, and ingredient `quantity`

### 4. Numeric Value Parsing

Added smart parsing function to extract numbers from strings:

```typescript
function parseNumericValue(value: number | string | null | undefined): number | undefined {
  // "2-4" → 2 (takes first value from range)
  // "30-45 minutes" → 30
  // 5 → 5 (passes through numbers)
  // "6" → 6 (parses string numbers)
}
```

This function:
- Extracts the first number from ranges
- Removes non-numeric text (like "minutes", "servings")
- Handles both integer and decimal values
- Returns `undefined` for non-parseable values

### 5. Value Normalization in Database Loader

Added normalization functions to map flexible AI output to database enums:

```typescript
const normalizeDifficulty = (diff: string | null | undefined) => {
  if (!diff) return undefined
  const lower = diff.toLowerCase()
  if (lower.includes('easy') || lower.includes('simple')) return 'easy'
  if (lower.includes('hard') || lower.includes('difficult')) return 'hard'
  if (lower.includes('medium') || lower.includes('moderate')) return 'medium'
  return undefined
}
```

This allows the AI to return variations like:
- "Simple" → normalized to "easy"
- "Very difficult" → normalized to "hard"
- "Moderate" → normalized to "medium"

## Updated Schema Fields

All fields now have robust error handling:

| Field | Type | Handling |
|-------|------|----------|
| title | string | Defaults to 'Untitled Recipe' |
| description | string | Nullable, optional |
| ingredients | array | Defaults to empty array |
| -- quantity | number/string | Parsed to number in DB |
| instructions | array | Defaults to empty array |
| prepTime | number/string | Parsed to number in DB |
| cookTime | number/string | Parsed to number in DB |
| servings | number/string | Parsed to number in DB |
| difficulty | string | Flexible, normalized on DB insert |
| cuisineType | string | Nullable, optional |
| mealType | string | Flexible, normalized on DB insert |
| dietaryTags | array | Defaults to empty array |

## Testing

All existing tests pass with the new schema. The schema is now much more resilient to:
- Informal Reddit post formatting
- Missing information
- Non-recipe text (will extract what it can)
- Variations in terminology

## Migration Notes

- **Existing JSON files**: Will work with the new loader (backward compatible)
- **Database**: No schema changes needed, normalization happens at insert time
- **Temporal workflows**: Automatically use the improved schema and prompt

## Retry Failed Entries

If you had entries that failed before, you can now retry them:

```bash
# Re-extract specific entries
node dist/src/utils/reddit_csv_to_json.js data/raw/Reddit_Recipes.csv 1
node dist/src/utils/reddit_csv_to_json.js data/raw/Reddit_Recipes.csv 4

# Load to database
node dist/src/utils/load_json_to_db.js data/stage/Reddit_Recipes_entry_1.json
node dist/src/utils/load_json_to_db.js data/stage/Reddit_Recipes_entry_4.json
```

Or use Temporal workflow for batch retry:
```bash
npm run client -- data/raw/Reddit_Recipes.csv 1 10 1500
```

## Expected Behavior

With these improvements:
- ✅ More entries will extract successfully
- ✅ Partial information is captured even for incomplete recipes
- ✅ Non-recipe posts won't cause failures
- ✅ AI can use natural language (e.g., "super easy" instead of "easy")
- ✅ Ranges are handled automatically (e.g., "2-4 servings" → 2)
- ✅ String numbers are parsed correctly (e.g., "30 minutes" → 30)
- ✅ Missing fields gracefully default to null/empty

## Examples of Handled Cases

| AI Output | Database Value |
|-----------|----------------|
| `servings: "2-4"` | `servings: 2` |
| `prepTime: "30-45 minutes"` | `prep_time_minutes: 30` |
| `difficulty: "Super easy"` | `difficulty: "easy"` |
| `mealType: "Dinner or lunch"` | `meal_type: "dinner"` |
| `quantity: "1-2 cups"` | `amount: 1` |
| `cookTime: 60` | `cook_time_minutes: 60` |

