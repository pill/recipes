import { useState, useEffect } from 'react'
import RecipeCard from './RecipeCard'
import Pagination from './Pagination'

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
}

const PAGE_SIZE = 10

export default function IngredientSearch() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [ingredient, setIngredient] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalHits, setTotalHits] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const searchByIngredient = async (page: number = 1) => {
    if (!ingredient.trim()) return

    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/recipes/_search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: (page - 1) * PAGE_SIZE,
          size: PAGE_SIZE,
          query: {
            nested: {
              path: 'ingredients',
              query: {
                wildcard: {
                  'ingredients.name': {
                    value: `*${ingredient}*`,
                    case_insensitive: true,
                  },
                },
              },
            },
          },
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to search by ingredient')
      }

      const data = await response.json()
      
      if (data.hits?.hits?.length > 0) {
        setRecipes(data.hits.hits.map((hit: any) => hit._source))
        setTotalHits(data.hits.total.value)
        setCurrentPage(page)
      } else {
        setRecipes([])
        setTotalHits(0)
        setError('No recipes found with that ingredient')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search by ingredient')
      console.error('Error searching by ingredient:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setCurrentPage(1)
    setTotalHits(0)
  }, [ingredient])

  const handlePageChange = (page: number) => {
    searchByIngredient(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div>
      <h2>Search by Ingredient</h2>
      <div style={{ marginBottom: '1rem' }}>
        <input
          type="text"
          value={ingredient}
          onChange={(e) => setIngredient(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && searchByIngredient(1)}
          placeholder="e.g. chicken, garlic, cheese..."
          style={{ 
            padding: '0.5rem',
            width: '300px',
            marginRight: '0.5rem',
          }}
        />
        <button onClick={() => searchByIngredient(1)} disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {recipes.length > 0 && (
        <div>
          <Pagination
            currentPage={currentPage}
            totalResults={totalHits}
            pageSize={PAGE_SIZE}
            onPageChange={handlePageChange}
          />
          {recipes.map((recipe, index) => (
            <RecipeCard
              key={index}
              title={recipe.title}
              description={recipe.description}
              ingredients={recipe.ingredients?.map(ing => 
                `${ing.quantity || ''} ${ing.unit || ''} ${ing.name}`.trim()
              )}
              instructions={recipe.instructions}
            />
          ))}
          <Pagination
            currentPage={currentPage}
            totalResults={totalHits}
            pageSize={PAGE_SIZE}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </div>
  )
}

