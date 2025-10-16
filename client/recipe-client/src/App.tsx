import { useState } from 'react'
import './App.css'
import RecipeCard from './components/RecipeCard'

interface Recipe {
  id?: number
  title: string
  description?: string
  ingredients: Array<{
    name: string
    quantity?: number
    unit?: string
    notes?: string
  }>
  instructions: string[]
  prep_time_minutes?: number
  cook_time_minutes?: number
  total_time_minutes?: number
  servings?: number
  difficulty?: string
  cuisine_type?: string
  meal_type?: string
}

function App() {
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getRandomRecipe = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/recipes/_search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          size: 1,
          query: {
            function_score: {
              query: { match_all: {} },
              random_score: {},
            },
          },
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to fetch recipe')
      }

      const data = await response.json()
      
      if (data.hits?.hits?.length > 0) {
        setRecipe(data.hits.hits[0]._source)
      } else {
        setError('No recipes found')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch recipe')
      console.error('Error fetching recipe:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <h1>Recipe Sandbox</h1>
      <div className="card">
        <button onClick={getRandomRecipe} disabled={loading}>
          {loading ? 'Loading...' : 'Press Me for random recipe'}
        </button>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        {recipe && (
          <RecipeCard
            title={recipe.title}
            description={recipe.description}
            ingredients={recipe.ingredients.map(ing => 
              `${ing.quantity || ''} ${ing.unit || ''} ${ing.name}`.trim()
            )}
            instructions={recipe.instructions}
          />
        )}
      </div>
    </>
  )
}

export default App
