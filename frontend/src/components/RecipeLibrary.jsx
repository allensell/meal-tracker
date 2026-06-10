import { useState, useEffect } from 'react'

function IngredientEditor({ ingredients, onChange }) {
  const addIngredient = () => onChange([...ingredients, { quantity: '', unit: '', name: '' }])
  const removeIngredient = (i) => onChange(ingredients.filter((_, idx) => idx !== i))
  const updateIngredient = (i, field, val) => {
    onChange(ingredients.map((ing, idx) => idx === i ? { ...ing, [field]: val } : ing))
  }
  return (
    <div>
      <div className="ingredients-list">
        {ingredients.map((ing, i) => (
          <div key={i} className="ingredient-row">
            <input className="form-input qty" placeholder="Qty" value={ing.quantity} onChange={e => updateIngredient(i, 'quantity', e.target.value)} />
            <input className="form-input unit" placeholder="Unit" value={ing.unit} onChange={e => updateIngredient(i, 'unit', e.target.value)} />
            <input className="form-input name" placeholder="Ingredient name" value={ing.name} onChange={e => updateIngredient(i, 'name', e.target.value)} />
            <button type="button" className="ingredient-remove" onClick={() => removeIngredient(i)}>×</button>
          </div>
        ))}
      </div>
      <button type="button" className="add-ingredient-btn mt-8" onClick={addIngredient}>+ Add ingredient</button>
    </div>
  )
}

function RecipeModal({ recipe, onClose, onSaved }) {
  const isNew = !recipe
  const [name, setName] = useState(recipe?.name ?? '')
  const [instructions, setInstructions] = useState(recipe?.instructions ?? '')
  const [prepTime, setPrepTime] = useState(recipe?.prep_time_minutes ?? '')
  const [ingredients, setIngredients] = useState(
    recipe?.ingredients?.map(i => ({ quantity: i.quantity ?? '', unit: i.unit ?? '', name: i.name })) ?? [{ quantity: '', unit: '', name: '' }]
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleSave = async () => {
    if (!name.trim() || !instructions.trim()) {
      setError('Name and instructions are required.')
      return
    }
    setSaving(true)
    setError(null)
    const validIngredients = ingredients.filter(i => i.name.trim())
    const payload = {
      name: name.trim(),
      instructions: instructions.trim(),
      prep_time_minutes: prepTime ? parseInt(prepTime) : null,
      ingredients: validIngredients
    }
    try {
      const res = await fetch(isNew ? '/api/recipes' : `/api/recipes/${recipe.id}`, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const err = await res.json()
        setError(err.error || 'Failed to save recipe')
        return
      }
      const saved = await res.json()
      onSaved(saved)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{isNew ? 'New Recipe' : 'Edit Recipe'}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {error && <div className="error-state" style={{ marginBottom: '16px' }}>{error}</div>}
          <div className="form-group">
            <label className="form-label">Recipe Name *</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Chicken Stir Fry" />
          </div>
          <div className="form-group">
            <label className="form-label">Prep Time (minutes)</label>
            <input className="form-input" type="number" value={prepTime} onChange={e => setPrepTime(e.target.value)} placeholder="30" min="0" />
          </div>
          <div className="form-group">
            <label className="form-label">Instructions *</label>
            <textarea className="form-textarea" value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="Step-by-step instructions…" style={{ minHeight: '140px' }} />
          </div>
          <div className="form-group">
            <label className="form-label">Ingredients</label>
            <IngredientEditor ingredients={ingredients} onChange={setIngredients} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Recipe'}</button>
        </div>
      </div>
    </div>
  )
}

function RecipeDetailModal({ recipe, onClose, onEdit, onDelete }) {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!confirm(`Delete "${recipe.name}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await fetch(`/api/recipes/${recipe.id}`, { method: 'DELETE' })
      onDelete(recipe.id)
    } catch (e) {
      alert('Error deleting recipe')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <div className="modal-title">{recipe.name}</div>
            {recipe.prep_time_minutes && (
              <div style={{ fontSize: '13px', color: 'var(--gray-500)', marginTop: '2px' }}>⏱ {recipe.prep_time_minutes} min prep</div>
            )}
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {recipe.ingredients && recipe.ingredients.length > 0 && (
            <div className="modal-section">
              <div className="modal-section-title">Ingredients</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {recipe.ingredients.map(ing => (
                  <div key={ing.id} style={{ fontSize: '14px', color: 'var(--gray-700)' }}>
                    {ing.quantity && <span style={{ color: 'var(--gray-500)' }}>{ing.quantity} </span>}
                    {ing.unit && <span style={{ color: 'var(--gray-500)' }}>{ing.unit} </span>}
                    {ing.name}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="modal-section">
            <div className="modal-section-title">Instructions</div>
            <div style={{ fontSize: '14px', color: 'var(--gray-700)', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
              {recipe.instructions}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={deleting} style={{ marginRight: 'auto' }}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={() => onEdit(recipe)}>Edit</button>
        </div>
      </div>
    </div>
  )
}

export default function RecipeLibrary() {
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showNewModal, setShowNewModal] = useState(false)
  const [editingRecipe, setEditingRecipe] = useState(null)
  const [viewingRecipe, setViewingRecipe] = useState(null)

  const loadRecipes = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/recipes')
      const data = await res.json()
      // Load each recipe with ingredients
      const withIngredients = await Promise.all(
        data.map(r => fetch(`/api/recipes/${r.id}`).then(r => r.json()))
      )
      setRecipes(withIngredients)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadRecipes() }, [])

  const handleSaved = (saved) => {
    setRecipes(prev => {
      const idx = prev.findIndex(r => r.id === saved.id)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = saved
        return updated
      }
      return [...prev, saved].sort((a, b) => a.name.localeCompare(b.name))
    })
    setShowNewModal(false)
    setEditingRecipe(null)
  }

  const handleDelete = (id) => {
    setRecipes(prev => prev.filter(r => r.id !== id))
    setViewingRecipe(null)
  }

  const handleEdit = (recipe) => {
    setViewingRecipe(null)
    setEditingRecipe(recipe)
  }

  const filtered = recipes.filter(r => r.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <div className="flex-center gap-8" style={{ marginBottom: '8px' }}>
        <h1 className="page-title" style={{ margin: 0, flex: 1 }}>Recipe Library</h1>
        <button className="btn btn-primary" onClick={() => setShowNewModal(true)}>+ New Recipe</button>
      </div>
      <p className="page-subtitle">{recipes.length} recipe{recipes.length !== 1 ? 's' : ''} saved</p>

      <input
        className="form-input"
        placeholder="Search recipes…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ maxWidth: '320px', marginBottom: '0' }}
      />

      {loading ? (
        <div className="loading-state">Loading recipes…</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📖</div>
          <div className="empty-state-text">{search ? 'No recipes match your search.' : 'No recipes yet. Create your first one!'}</div>
        </div>
      ) : (
        <div className="recipe-grid">
          {filtered.map(recipe => (
            <div key={recipe.id} className="recipe-card" onClick={() => setViewingRecipe(recipe)}>
              <div className="recipe-card-name">{recipe.name}</div>
              <div className="recipe-card-meta">
                {recipe.prep_time_minutes && <span>⏱ {recipe.prep_time_minutes} min</span>}
                <span>{recipe.ingredients?.length ?? 0} ingredient{recipe.ingredients?.length !== 1 ? 's' : ''}</span>
              </div>
              {recipe.ingredients && recipe.ingredients.length > 0 && (
                <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--gray-500)', lineHeight: 1.6 }}>
                  {recipe.ingredients.slice(0, 3).map(i => i.name).join(', ')}
                  {recipe.ingredients.length > 3 && ` +${recipe.ingredients.length - 3} more`}
                </div>
              )}
              <div className="recipe-card-actions">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={e => { e.stopPropagation(); handleEdit(recipe) }}
                >Edit</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(showNewModal || editingRecipe) && (
        <RecipeModal
          recipe={editingRecipe}
          onClose={() => { setShowNewModal(false); setEditingRecipe(null) }}
          onSaved={handleSaved}
        />
      )}

      {viewingRecipe && (
        <RecipeDetailModal
          recipe={viewingRecipe}
          onClose={() => setViewingRecipe(null)}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}
