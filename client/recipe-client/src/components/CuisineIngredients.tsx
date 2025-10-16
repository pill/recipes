import { useState, useEffect } from 'react'

interface CuisineData {
  cuisine: string
  ingredients: Array<{
    name: string
    count: number
  }>
}

export default function CuisineIngredients() {
  const [cuisineData, setCuisineData] = useState<CuisineData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedCuisine, setSelectedCuisine] = useState<string | null>(null)

  const fetchCuisineIngredients = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/recipes/_search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          size: 0,
          aggs: {
            by_cuisine: {
              terms: {
                field: 'cuisine_type',
                size: 10
              },
              aggs: {
                ingredients_nested: {
                  nested: {
                    path: 'ingredients'
                  },
                  aggs: {
                    top_ingredients: {
                      terms: {
                        field: 'ingredients.name.keyword',
                        size: 10
                      }
                    }
                  }
                }
              }
            }
          }
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to fetch cuisine ingredients')
      }

      const data = await response.json()
      
      if (data.aggregations?.by_cuisine?.buckets?.length > 0) {
        const processedData = data.aggregations.by_cuisine.buckets.map((bucket: any) => ({
          cuisine: bucket.key,
          ingredients: bucket.ingredients_nested.top_ingredients.buckets.map((ing: any) => ({
            name: ing.key,
            count: ing.doc_count
          }))
        }))
        setCuisineData(processedData)
      } else {
        setCuisineData([])
        setError('No cuisine data found')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch cuisine ingredients')
      console.error('Error fetching cuisine ingredients:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCuisineIngredients()
  }, [])

  const cuisines = cuisineData.map(item => item.cuisine)

  return (
    <div>
      <h2>Most Popular Ingredients by Cuisine</h2>
      
      <div style={{ marginBottom: '2rem' }}>
        <button onClick={fetchCuisineIngredients} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh Data'}
        </button>
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {cuisines.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <label style={{ marginRight: '1rem' }}>Select Cuisine:</label>
          <select
            value={selectedCuisine || ''}
            onChange={(e) => setSelectedCuisine(e.target.value || null)}
            style={{
              padding: '0.5rem',
              fontSize: '1rem',
              borderRadius: '4px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              color: 'inherit',
              minWidth: '200px'
            }}
          >
            <option value="">All Cuisines</option>
            {cuisines.map(cuisine => (
              <option key={cuisine} value={cuisine}>
                {cuisine}
              </option>
            ))}
          </select>
        </div>
      )}

      {cuisineData.length > 0 && (
        <div style={{ display: 'grid', gap: '2rem' }}>
          {cuisineData
            .filter(item => !selectedCuisine || item.cuisine === selectedCuisine)
            .map((item, index) => (
            <div key={index} style={{
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '1.5rem',
              backgroundColor: 'rgba(255, 255, 255, 0.02)'
            }}>
              <h3 style={{ 
                margin: '0 0 1rem 0', 
                color: '#646cff',
                fontSize: '1.5rem'
              }}>
                {item.cuisine}
              </h3>
              
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {item.ingredients.map((ingredient, ingIndex) => (
                  <div key={ingIndex} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '4px',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <span style={{ fontWeight: '500' }}>{ingredient.name}</span>
                    <span style={{ 
                      color: '#888',
                      fontSize: '0.9rem',
                      backgroundColor: 'rgba(100, 108, 255, 0.1)',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '12px'
                    }}>
                      {ingredient.count} recipes
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {cuisineData.length === 0 && !loading && !error && (
        <p style={{ color: '#888', textAlign: 'center', marginTop: '2rem' }}>
          No cuisine data available. Make sure recipes are indexed in Elasticsearch.
        </p>
      )}
    </div>
  )
}
