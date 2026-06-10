import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import MealSlot from './MealSlot.jsx'
import MealForm from './MealForm.jsx'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

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
