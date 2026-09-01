export default function MealSlot({ mealType, meal, onClick }) {
  const isGoingOut = !!meal?.going_out
  const hasMeal = !!meal?.recipe_id || isGoingOut

  const purchasedCount = meal?.meal_ingredients?.filter(mi => mi.purchased).length ?? 0
  const totalCount = meal?.meal_ingredients?.length ?? 0
  const purchasePercent = totalCount > 0 ? (purchasedCount / totalCount) * 100 : 0

  return (
    <div className={`meal-slot${hasMeal ? ' has-meal' : ''}${isGoingOut ? ' going-out' : ''}`} onClick={onClick} title="Click to edit">
      <div className="meal-type-label">{mealType}</div>

      {hasMeal ? (
        <>
          <div className="meal-recipe-name">{isGoingOut ? '🍽 Going Out' : meal.recipe?.name}</div>
          <div className="meal-meta">
            {meal.rating != null && (
              <div className="meal-stars">
                {[1,2,3,4,5].map(i => (
                  <span key={i} className={`star ${i <= meal.rating ? 'filled' : 'empty'}`}>★</span>
                ))}
              </div>
            )}
            {meal.prep_time_minutes != null && (
              <div className="meal-prep">⏱ {meal.prep_time_minutes} min</div>
            )}
            {totalCount > 0 && (
              <>
                <div className="meal-purchase-progress">
                  {purchasedCount}/{totalCount} ingredients
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${purchasePercent}%` }} />
                </div>
              </>
            )}
          </div>
        </>
      ) : (
        <div className="meal-empty">+ Add {mealType}</div>
      )}
    </div>
  )
}
