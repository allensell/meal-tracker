import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import MealSlot from './MealSlot.jsx'
import MealForm from './MealForm.jsx'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAYS_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// Parse a quantity string to a number, supporting fractions like "1/2"
function parseQty(str) {
  if (!str) return null
  const s = str.trim()
  const fraction = s.match(/^(\d+)\s*\/\s*(\d+)$/)
  if (fraction) return parseFloat(fraction[1]) / parseFloat(fraction[2])
  const mixed = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/)
  if (mixed) return parseFloat(mixed[1]) + parseFloat(mixed[2]) / parseFloat(mixed[3])
  const num = parseFloat(s)
  return isNaN(num) ? null : num
}

// Format a number back to a clean string, converting decimals back to fractions where obvious
function formatQty(n) {
  if (n === Math.floor(n)) return String(n)
  const fractions = [[0.25,'1/4'],[0.5,'1/2'],[0.75,'3/4'],[0.333,'1/3'],[0.667,'2/3']]
  const whole = Math.floor(n)
  const dec = n - whole
  for (const [val, str] of fractions) {
    if (Math.abs(dec - val) < 0.01) return whole > 0 ? `${whole} ${str}` : str
  }
  return n.toFixed(2).replace(/\.?0+$/, '')
}

function buildCombinedList(week) {
  // Collect all unpurchased items across all meals
  const all = []
  if (week?.meals) {
    for (const meal of week.meals) {
      for (const mi of meal.meal_ingredients || []) {
        if (!mi.purchased) all.push(mi)
      }
    }
  }

  // Group by name (case-insensitive) + unit (case-insensitive)
  const map = new Map()
  for (const mi of all) {
    const key = `${mi.name.trim().toLowerCase()}||${(mi.unit || '').trim().toLowerCase()}`
    if (!map.has(key)) {
      map.set(key, { name: mi.name.trim(), unit: mi.unit || '', quantities: [], rawQtys: [] })
    }
    const qty = mi.custom_quantity || mi.orig_quantity || ''
    map.get(key).rawQtys.push(qty)
    const parsed = parseQty(qty)
    map.get(key).quantities.push(parsed)
  }

  // Build combined items
  return Array.from(map.values()).map(({ name, unit, quantities, rawQtys }) => {
    const allNumeric = quantities.every(q => q !== null)
    let displayQty
    if (allNumeric && quantities.length > 0) {
      displayQty = formatQty(quantities.reduce((a, b) => a + b, 0))
    } else if (rawQtys.some(q => q)) {
      // Mix of numeric and text — join unique values
      const unique = [...new Set(rawQtys.filter(Boolean))]
      displayQty = unique.join(' + ')
    } else {
      displayQty = ''
    }
    return { name, unit, displayQty, count: quantities.length }
  }).sort((a, b) => a.name.localeCompare(b.name))
}

function ShoppingListModal({ week, onClose }) {
  const combined = buildCombinedList(week)
  const total = combined.length

  const handleExport = () => {
    const lines = [`Shopping List — ${formatWeekRange(week.start_date)}`, '']
    for (const item of combined) {
      const qty = item.displayQty ? item.displayQty + ' ' : ''
      const unit = item.unit ? item.unit + ' ' : ''
      lines.push(`- ${qty}${unit}${item.name}`)
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `shopping-list-${week.start_date}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <div className="modal-title">Shopping List</div>
            <div style={{ fontSize: '13px', color: 'var(--gray-500)', marginTop: '2px' }}>
              {total === 0 ? 'All ingredients purchased!' : `${total} item${total !== 1 ? 's' : ''} needed`}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {combined.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px 0' }}>
              <div className="empty-state-icon">🛒</div>
              <div className="empty-state-text">Nothing left to buy — all ingredients are checked off!</div>
            </div>
          ) : (
            <ul className="shopping-list">
              {combined.map((item, i) => (
                <li key={i} className="shopping-item">
                  {item.displayQty && <span className="shopping-qty">{item.displayQty}</span>}
                  {item.unit && <span className="shopping-unit">{item.unit}</span>}
                  <span className="shopping-name">{item.name}</span>
                  {item.count > 1 && <span className="shopping-badge">{item.count} meals</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="modal-footer">
          {combined.length > 0 && (
            <button className="btn btn-secondary" onClick={handleExport} style={{ marginRight: 'auto' }}>
              ⬇ Export .txt
            </button>
          )}
          <button className="btn btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}

function getMondayOfWeek(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1 - day)
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function isoDate(date) {
  return date.toISOString().slice(0, 10)
}

function formatWeekRange(startDate) {
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const opts = { month: 'short', day: 'numeric' }
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`
}

function getDayDates(startDate) {
  const dates = []
  const start = new Date(startDate + 'T00:00:00')
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    dates.push(d)
  }
  return dates
}

export default function WeekView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [week, setWeek] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null) // { dayOfWeek, mealType, meal? }
  const [allWeeks, setAllWeeks] = useState([])
  const [showShoppingList, setShowShoppingList] = useState(false)

  const loadWeek = useCallback(async (weekId) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/weeks/${weekId}`)
      if (!res.ok) throw new Error('Failed to load week')
      const data = await res.json()
      setWeek(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const ensureCurrentWeek = useCallback(async () => {
    const monday = getMondayOfWeek(new Date())
    const startDate = isoDate(monday)
    try {
      const res = await fetch('/api/weeks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ start_date: startDate }) })
      const w = await res.json()
      navigate(`/weeks/${w.id}`, { replace: true })
      await loadWeek(w.id)
    } catch (e) {
      setError(e.message)
      setLoading(false)
    }
  }, [navigate, loadWeek])

  useEffect(() => {
    fetch('/api/weeks').then(r => r.json()).then(setAllWeeks).catch(() => {})
  }, [])

  useEffect(() => {
    if (id) {
      loadWeek(id)
    } else {
      ensureCurrentWeek()
    }
  }, [id, loadWeek, ensureCurrentWeek])

  const getMealForSlot = (dayIndex, mealType) => {
    if (!week) return null
    return week.meals?.find(m => m.day_of_week === dayIndex && m.meal_type === mealType) || null
  }

  const handleSlotClick = (dayOfWeek, mealType) => {
    const meal = getMealForSlot(dayOfWeek, mealType)
    setSelectedSlot({ dayOfWeek, mealType, meal })
  }

  const handleModalClose = () => {
    setSelectedSlot(null)
    if (week) loadWeek(week.id)
  }

  const goToPrevWeek = () => {
    const sortedWeeks = [...allWeeks].sort((a, b) => a.start_date.localeCompare(b.start_date))
    const idx = sortedWeeks.findIndex(w => w.id === week?.id)
    if (idx > 0) navigate(`/weeks/${sortedWeeks[idx - 1].id}`)
  }

  const goToNextWeek = async () => {
    const sortedWeeks = [...allWeeks].sort((a, b) => a.start_date.localeCompare(b.start_date))
    const idx = sortedWeeks.findIndex(w => w.id === week?.id)
    if (idx < sortedWeeks.length - 1) {
      navigate(`/weeks/${sortedWeeks[idx + 1].id}`)
    } else if (week) {
      // Create next week
      const currentStart = new Date(week.start_date + 'T00:00:00')
      const nextStart = new Date(currentStart)
      nextStart.setDate(nextStart.getDate() + 7)
      const res = await fetch('/api/weeks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ start_date: isoDate(nextStart) }) })
      const w = await res.json()
      const weeks = await fetch('/api/weeks').then(r => r.json())
      setAllWeeks(weeks)
      navigate(`/weeks/${w.id}`)
    }
  }

  if (loading) return <div className="loading-state">Loading week…</div>
  if (error) return <div className="error-state">{error}</div>
  if (!week) return null

  const dayDates = getDayDates(week.start_date)
  const today = isoDate(new Date())
  const isCurrentWeek = !id || week.start_date === isoDate(getMondayOfWeek(new Date()))

  const sortedWeeks = [...allWeeks].sort((a, b) => a.start_date.localeCompare(b.start_date))
  const currentIdx = sortedWeeks.findIndex(w => w.id === week.id)
  const hasPrev = currentIdx > 0

  return (
    <div>
      <div className="week-nav">
        <div>
          <h1>{isCurrentWeek ? 'This Week' : 'Week of'}</h1>
          <div style={{ fontSize: '14px', color: 'var(--gray-500)', marginTop: '2px' }}>{formatWeekRange(week.start_date)}</div>
        </div>
        <div className="flex gap-8">
          {hasPrev && (
            <button className="btn btn-secondary btn-sm" onClick={goToPrevWeek}>← Prev</button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={goToNextWeek}>Next →</button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowShoppingList(true)}>🛒 Shopping List</button>
        </div>
      </div>

      <div className="week-grid">
        {DAYS.map((dayName, dayIndex) => {
          const date = dayDates[dayIndex]
          const dateStr = isoDate(date)
          const isToday = dateStr === today
          return (
            <div key={dayIndex} className="day-column">
              <div className={`day-header${isToday ? ' today' : ''}`}>
                <div className="day-name">{dayName}</div>
                <div className="day-date">{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
              </div>
              {['lunch', 'dinner'].map(mealType => (
                <MealSlot
                  key={mealType}
                  mealType={mealType}
                  meal={getMealForSlot(dayIndex, mealType)}
                  onClick={() => handleSlotClick(dayIndex, mealType)}
                />
              ))}
            </div>
          )
        })}
      </div>

      {showShoppingList && (
        <ShoppingListModal week={week} onClose={() => setShowShoppingList(false)} />
      )}

      {selectedSlot && (
        <MealForm
          weekId={week.id}
          dayOfWeek={selectedSlot.dayOfWeek}
          mealType={selectedSlot.mealType}
          meal={selectedSlot.meal}
          onClose={handleModalClose}
        />
      )}
    </div>
  )
}
