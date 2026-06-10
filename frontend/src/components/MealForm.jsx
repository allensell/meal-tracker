import { useState, useEffect, useRef } from 'react'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function StarRating({ value, onChange }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div className="star-rating">
      {[1,2,3,4,5].map(n => (
        <button
          key={n}
          type="button"
          className={`star-btn${(hovered || value) >= n ? ' active' : ''}`}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(n === value ? null : n)}
          title={`${n} star${n > 1 ? 's' : ''}`}
        >★</button>
      ))}
    </div>
  )
}

function IngredientEditor({ ingredients, onChange }) {
  const addIngredient = () => onChange([...ingredients, { quantity: '', unit: '', name: '' }])
  const removeIngredient = (i) => onChange(ingredients.filter((_, idx) => idx !== i))
  const updateIngredient = (i, field, val) => {
    const updated = ingredients.map((ing, idx) => idx === i ? { ...ing, [field]: val } : ing)
    onChange(updated)
  }
  return (
    <div>
      <div className="ingredients-list">
        {ingredients.map((ing, i) => (
          <div key={i} className="ingredient-row">
            <input
              className="form-input qty"
              placeholder="Qty"
              value={ing.quantity}
              onChange={e => updateIngredient(i, 'quantity', e.target.value)}
            />
            <input
              className="form-input unit"
              placeholder="Unit"
              value={ing.unit}
              onChange={e => updateIngredient(i, 'unit', e.target.value)}
            />
            <input
              className="form-input name"
              placeholder="Ingredient name"
              value={ing.name}
              onChange={e => updateIngredient(i, 'name', e.target.value)}
            />
            <button type="button" className="ingredient-remove" onClick={() => removeIngredient(i)} title="Remove">×</button>
          </div>
        ))}
      </div>
      <button type="button" className="add-ingredient-btn mt-8" onClick={addIngredient}>+ Add ingredient</button>
    </div>
  )
}

export default function MealForm({ weekId, dayOfWeek, mealType, meal, onClose }) {
  const [tab, setTab] = useState('assign') // 'assign' | 'log' | 'ingredients'
  const [recipes, setRecipes] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedRecipe, setSelectedRecipe] = useState(null)
  const [showNewRecipe, setShowNewRecipe] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const searchRef = useRef(null)

  // New recipe form state
  const [newRecipeName, setNewRecipeName] = useState('')
  const [newRecipeInstructions, setNewRecipeInstructions] = useState('')
  const [newRecipePrepTime, setNewRecipePrepTime] = useState('')
  const [newRecipeIngredients, setNewRecipeIngredients] = useState([{ quantity: '', unit: '', name: '' }])

  // Log state
  const [rating, setRating] = useState(meal?.rating ?? null)
  const [prepTime, setPrepTime] = useState(meal?.prep_time_minutes ?? '')
  const [notes, setNotes] = useState(meal?.notes ?? '')

  // Ingredient purchase state
  const [mealIngredients, setMealIngredients] = useState(meal?.meal_ingredients ?? [])

  useEffect(() => {
    fetch('/api/recipes').then(r => r.json()).then(setRecipes).catch(() => {})
  }, [])

  useEffect(() => {
    if (meal?.recipe) {
      setSelectedRecipe(meal.recipe)
      setSearchQuery(meal.recipe.name)
    }
    setMealIngredients(meal?.meal_ingredients ?? [])
    setRating(meal?.rating ?? null)
    setPrepTime(meal?.prep_time_minutes ?? '')
    setNotes(meal?.notes ?? '')
  }, [meal])

  const filteredRecipes = recipes.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleRecipeSelect = async (recipe) => {
    setSelectedRecipe(recipe)
    setSearchQuery(recipe.name)
    setShowDropdown(false)
    setShowNewRecipe(false)
  }

  const handleSearchFocus = () => setShowDropdown(true)
  const handleSearchBlur = () => setTimeout(() => setShowDropdown(false), 150)

  const handleSaveAssign = async () => {
    setSaving(true)
    try {
      let recipeId = selectedRecipe?.id

      if (showNewRecipe) {
        if (!newRecipeName.trim() || !newRecipeInstructions.trim()) {
          alert('Recipe name and instructions are required')
          setSaving(false)
          return
        }
        const validIngredients = newRecipeIngredients.filter(i => i.name.trim())
        const res = await fetch('/api/recipes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: newRecipeName.trim(),
            instructions: newRecipeInstructions.trim(),
            prep_time_minutes: newRecipePrepTime ? parseInt(newRecipePrepTime) : null,
            ingredients: validIngredients
          })
        })
        if (!res.ok) {
          const err = await res.json()
          alert(err.error || 'Failed to create recipe')
          setSaving(false)
          return
        }
        const newRecipe = await res.json()
        recipeId = newRecipe.id
      }

      if (!recipeId) {
        alert('Please select or create a recipe')
        setSaving(false)
        return
      }

      if (meal?.id) {
        // Update existing meal
        await fetch(`/api/meals/${meal.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipe_id: recipeId })
        })
      } else {
        // Create new meal
        await fetch('/api/meals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ week_id: weekId, day_of_week: dayOfWeek, meal_type: mealType, recipe_id: recipeId })
        })
      }
      onClose()
    } catch (e) {
      alert('Error saving meal: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveLog = async () => {
    if (!meal?.id) return
    setSaving(true)
    try {
      await fetch(`/api/meals/${meal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: rating,
          prep_time_minutes: prepTime ? parseInt(prepTime) : null,
          notes: notes || null
        })
      })
      onClose()
    } catch (e) {
      alert('Error saving: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleTogglePurchased = async (mi) => {
    const newVal = mi.purchased ? 0 : 1
    try {
      await fetch(`/api/meal_ingredients/${mi.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchased: newVal })
      })
      setMealIngredients(prev => prev.map(m => m.id === mi.id ? { ...m, purchased: newVal } : m))
    } catch (e) {
      alert('Error updating: ' + e.message)
    }
  }

  const handleDelete = async () => {
    if (!meal?.id) return
    if (!confirm('Remove this meal from the week?')) return
    setDeleting(true)
    try {
      await fetch(`/api/meals/${meal.id}`, { method: 'DELETE' })
      onClose()
    } catch (e) {
      alert('Error deleting: ' + e.message)
    } finally {
      setDeleting(false)
    }
  }

  const hasMeal = !!meal?.recipe_id

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <div className="modal-title">
              {DAYS[dayOfWeek]} – {mealType.charAt(0).toUpperCase() + mealType.slice(1)}
            </div>
            {hasMeal && (
              <div style={{ fontSize: '13px', color: 'var(--gray-500)', marginTop: '2px' }}>
                {meal.recipe?.name}
              </div>
            )}
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {hasMeal && (
            <div className="tabs">
              <button className={`tab${tab === 'assign' ? ' active' : ''}`} onClick={() => setTab('assign')}>Recipe</button>
              <button className={`tab${tab === 'ingredients' ? ' active' : ''}`} onClick={() => setTab('ingredients')}>
                Ingredients {mealIngredients.length > 0 && `(${mealIngredients.filter(m=>m.purchased).length}/${mealIngredients.length})`}
              </button>
              <button className={`tab${tab === 'log' ? ' active' : ''}`} onClick={() => setTab('log')}>Rate & Log</button>
            </div>
          )}

          {/* ── Assign Tab ── */}
          {tab === 'assign' && (
            <div>
              <div className="modal-section">
                <div className="modal-section-title">Select Recipe</div>
                <div className="recipe-search-wrap">
                  <input
                    ref={searchRef}
                    className="form-input"
                    placeholder="Search recipes…"
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setSelectedRecipe(null); setShowDropdown(true); setShowNewRecipe(false) }}
                    onFocus={handleSearchFocus}
                    onBlur={handleSearchBlur}
                  />
                  {showDropdown && (
                    <div className="recipe-dropdown">
                      {filteredRecipes.map(r => (
                        <div
                          key={r.id}
                          className="recipe-dropdown-item"
                          onMouseDown={() => handleRecipeSelect(r)}
                        >
                          {r.name}
                          {r.prep_time_minutes && <span style={{ color: 'var(--gray-400)', fontSize: '12px', marginLeft: '8px' }}>{r.prep_time_minutes} min</span>}
                        </div>
                      ))}
                      <div
                        className="recipe-dropdown-item create-new"
                        onMouseDown={() => { setShowDropdown(false); setShowNewRecipe(true); setSelectedRecipe(null) }}
                      >
                        + Create new recipe{searchQuery ? ` "${searchQuery}"` : ''}
                      </div>
                    </div>
                  )}
                </div>

                {selectedRecipe && !showNewRecipe && (
                  <div style={{ marginTop: '12px', padding: '12px', background: 'var(--green-50)', border: '1.5px solid var(--green-200)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontWeight: 700, color: 'var(--gray-800)', marginBottom: '6px' }}>{selectedRecipe.name}</div>
                    {selectedRecipe.prep_time_minutes && (
                      <div style={{ fontSize: '13px', color: 'var(--gray-500)', marginBottom: '6px' }}>⏱ {selectedRecipe.prep_time_minutes} min prep</div>
                    )}
                    {selectedRecipe.instructions && (
                      <div style={{ fontSize: '13px', color: 'var(--gray-600)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{selectedRecipe.instructions}</div>
                    )}
                  </div>
                )}
              </div>

              {showNewRecipe && (
                <div className="inline-section">
                  <div className="inline-section-title">New Recipe</div>
                  <div className="form-group">
                    <label className="form-label">Recipe Name *</label>
                    <input
                      className="form-input"
                      value={newRecipeName || searchQuery}
                      onChange={e => setNewRecipeName(e.target.value)}
                      placeholder="e.g. Spaghetti Bolognese"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Prep Time (minutes)</label>
                    <input
                      className="form-input"
                      type="number"
                      value={newRecipePrepTime}
                      onChange={e => setNewRecipePrepTime(e.target.value)}
                      placeholder="30"
                      min="0"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Instructions *</label>
                    <textarea
                      className="form-textarea"
                      value={newRecipeInstructions}
                      onChange={e => setNewRecipeInstructions(e.target.value)}
                      placeholder="Step-by-step instructions…"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Ingredients</label>
                    <IngredientEditor ingredients={newRecipeIngredients} onChange={setNewRecipeIngredients} />
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => { setShowNewRecipe(false); setSearchQuery('') }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Ingredients Tab ── */}
          {tab === 'ingredients' && (
            <div>
              <div className="modal-section">
                <div className="modal-section-title">Ingredients to Purchase</div>
                {mealIngredients.length === 0 ? (
                  <div className="text-muted text-sm">No ingredients tracked for this meal.</div>
                ) : (
                  <div className="purchase-list">
                    {mealIngredients.map(mi => (
                      <div key={mi.id} className={`purchase-item${mi.purchased ? ' purchased' : ''}`}>
                        <input
                          type="checkbox"
                          className="purchase-checkbox"
                          checked={!!mi.purchased}
                          onChange={() => handleTogglePurchased(mi)}
                        />
                        <span className="purchase-label">
                          {mi.custom_quantity || mi.orig_quantity ? (mi.custom_quantity || mi.orig_quantity) + ' ' : ''}
                          {mi.unit ? mi.unit + ' ' : ''}
                          {mi.name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Log Tab ── */}
          {tab === 'log' && (
            <div>
              <div className="modal-section">
                <div className="modal-section-title">Rate & Log</div>
                <div className="form-group">
                  <label className="form-label">Rating</label>
                  <StarRating value={rating} onChange={setRating} />
                </div>
                <div className="form-group">
                  <label className="form-label">Actual Prep Time (minutes)</label>
                  <input
                    className="form-input"
                    type="number"
                    value={prepTime}
                    onChange={e => setPrepTime(e.target.value)}
                    placeholder="e.g. 45"
                    min="0"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea
                    className="form-textarea"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="How did it go? Any modifications?"
                    style={{ minHeight: '80px' }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {hasMeal && (
            <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={deleting} style={{ marginRight: 'auto' }}>
              {deleting ? 'Removing…' : 'Remove Meal'}
            </button>
          )}
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          {tab === 'assign' && (
            <button className="btn btn-primary" onClick={handleSaveAssign} disabled={saving}>
              {saving ? 'Saving…' : hasMeal ? 'Update Recipe' : 'Add to Week'}
            </button>
          )}
          {tab === 'log' && (
            <button className="btn btn-primary" onClick={handleSaveLog} disabled={saving}>
              {saving ? 'Saving…' : 'Save Log'}
            </button>
          )}
          {tab === 'ingredients' && (
            <button className="btn btn-secondary" onClick={onClose}>Done</button>
          )}
        </div>
      </div>
    </div>
  )
}
