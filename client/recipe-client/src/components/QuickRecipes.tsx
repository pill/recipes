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
  total_time_minutes?: number
  difficulty?: string
}

const PAGE_SIZE = 10

export default function QuickRecipes() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [maxTime, setMaxTime] = useState(30)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalHits, setTotalHits] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const findQuickRecipes = async (page: number = 1) => {
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
            bool: {
              must: [
                { term: { difficulty: 'easy' } }
              ],
              filter: [
                { range: { total_time_minutes: { lte: maxTime } } }
              ],
            },
          },
          sort: [
            { total_time_minutes: { order: 'asc' } }
          ],
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to search quick recipes')
      }

      const data = await response.json()
      
      if (data.hits?.hits?.length > 0) {
        setRecipes(data.hits.hits.map((hit: any) => hit._source))
        setTotalHits(data.hits.total.value)
        setCurrentPage(page)
      } else {
        setRecipes([])
        setTotalHits(0)
        setError('No quick recipes found')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search quick recipes')
      console.error('Error searching quick recipes:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setCurrentPage(1)
    setTotalHits(0)
  }, [maxTime])

  const handlePageChange = (page: number) => {
    findQuickRecipes(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div>
      <h2>Quick & Easy Recipes</h2>
      <div style={{ marginBottom: '1rem' }}>
        <label>
          Max time: {maxTime} minutes
          <input
            type="range"
            min="15"
            max="60"
            step="5"
            value={maxTime}
            onChange={(e) => setMaxTime(Number(e.target.value))}
            style={{ marginLeft: '1rem', width: '200px' }}
          />
        </label>
        <button onClick={() => findQuickRecipes(1)} disabled={loading} style={{ marginLeft: '1rem' }}>
          {loading ? 'Searching...' : 'Find Quick Recipes'}
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
            <div key={index}>
              <RecipeCard
                title={recipe.title}
                description={recipe.description}
                ingredients={recipe.ingredients?.map(ing => 
                  `${ing.quantity || ''} ${ing.unit || ''} ${ing.name}`.trim()
                )}
                instructions={recipe.instructions}
              />
              {recipe.total_time_minutes && (
                <p style={{ fontSize: '0.9rem', color: '#888' }}>
                  ⏱️ {recipe.total_time_minutes} minutes
                </p>
              )}
            </div>
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

