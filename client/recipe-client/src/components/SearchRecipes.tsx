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

export default function SearchRecipes() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalHits, setTotalHits] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const searchRecipes = async (page: number = 1) => {
    if (!searchQuery.trim()) return

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
            multi_match: {
              query: searchQuery,
              fields: ['title^2', 'description', 'instructions'],
            },
          },
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to search recipes')
      }

      const data = await response.json()
      
      if (data.hits?.hits?.length > 0) {
        setRecipes(data.hits.hits.map((hit: any) => hit._source))
        setTotalHits(data.hits.total.value)
        setCurrentPage(page)
      } else {
        setRecipes([])
        setTotalHits(0)
        setError('No recipes found')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search recipes')
      console.error('Error searching recipes:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setCurrentPage(1)
    setTotalHits(0)
  }, [searchQuery])

  const handlePageChange = (page: number) => {
    searchRecipes(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div>
      <h2>Full-Text Search</h2>
      <div style={{ marginBottom: '1rem' }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && searchRecipes(1)}
          placeholder="Search recipes..."
          style={{ 
            padding: '0.5rem',
            width: '300px',
            marginRight: '0.5rem',
          }}
        />
        <button onClick={() => searchRecipes(1)} disabled={loading}>
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

