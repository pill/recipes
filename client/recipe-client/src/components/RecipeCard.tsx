interface RecipeCardProps {
  title?: string
  description?: string
  ingredients?: string[]
  instructions?: string[]
}

export default function RecipeCard({ 
  title = 'Sample Recipe',
  description = 'A delicious recipe',
  ingredients = ['Ingredient 1', 'Ingredient 2'],
  instructions = ['Step 1', 'Step 2']
}: RecipeCardProps) {
  return (
    <div style={{
      border: '1px solid #ccc',
      borderRadius: '8px',
      padding: '1rem',
      margin: '1rem 0',
      textAlign: 'left'
    }}>
      <h2>{title}</h2>
      <p>{description}</p>
      <h3>Ingredients</h3>
      <ul>
        {ingredients.map((ingredient, index) => (
          <li key={index}>{ingredient}</li>
        ))}
      </ul>
      <h3>Instructions</h3>
      <ol>
        {instructions.map((instruction, index) => (
          <li key={index}>{instruction}</li>
        ))}
      </ol>
    </div>
  )
}

