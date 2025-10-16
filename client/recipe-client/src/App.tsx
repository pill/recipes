import { useState } from 'react'
import './App.css'
import RandomRecipe from './components/RandomRecipe'
import SearchRecipes from './components/SearchRecipes'
import IngredientSearch from './components/IngredientSearch'
import QuickRecipes from './components/QuickRecipes'
import CuisineIngredients from './components/CuisineIngredients'

type TabType = 'random' | 'search' | 'ingredients' | 'quick' | 'cuisine'

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('random')

  const tabs = [
    { id: 'random' as TabType, label: 'Random Recipe' },
    { id: 'search' as TabType, label: 'Full-Text Search' },
    { id: 'ingredients' as TabType, label: 'By Ingredient' },
    { id: 'quick' as TabType, label: 'Quick & Easy' },
    { id: 'cuisine' as TabType, label: 'Cuisine Analysis' },
  ]

  return (
    <>
      <h1>Recipe Sandbox</h1>
      
      <div className="tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="card">
        {activeTab === 'random' && <RandomRecipe />}
        {activeTab === 'search' && <SearchRecipes />}
        {activeTab === 'ingredients' && <IngredientSearch />}
        {activeTab === 'quick' && <QuickRecipes />}
        {activeTab === 'cuisine' && <CuisineIngredients />}
      </div>
    </>
  )
}

export default App
