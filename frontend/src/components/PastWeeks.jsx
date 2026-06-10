import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function formatWeekRange(startDate) {
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const opts = { month: 'short', day: 'numeric' }
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`
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

function CopyModal({ sourceWeek, onClose, onCopied, allWeeks }) {
  const currentMonday = isoDate(getMondayOfWeek(new Date()))
  const [targetWeekId, setTargetWeekId] = useState('')
  const [copying, setCopying] = useState(false)
  const [error, setError] = useState(null)

  const eligibleWeeks = allWeeks.filter(w => w.id !== sourceWeek.id)

  const handleCopy = async () => {
    if (!targetWeekId) {
      setError('Please select a target week')
      return
    }
    setCopying(true)
    setError(null)
    try {
      const res = await fetch(`/api/weeks/${sourceWeek.id}/copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_week_id: parseInt(targetWeekId) })
      })
      if (!res.ok) {
        const err = await res.json()
        setError(err.error || 'Copy failed')
        return
      }
      onCopied(parseInt(targetWeekId))
    } catch (e) {
      setError(e.message)
    } finally {
      setCopying(false)
    }
  }

  const handleCopyToCurrentWeek = async () => {
    setCopying(true)
    setError(null)
    try {
      // Ensure current week exists
      const weekRes = await fetch('/api/weeks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: currentMonday })
      })
      const currentWeek = await weekRes.json()

      const res = await fetch(`/api/weeks/${sourceWeek.id}/copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_week_id: currentWeek.id })
      })
      if (!res.ok) {
        const err = await res.json()
        setError(err.error || 'Copy failed')
        return
      }
      onCopied(currentWeek.id)
    } catch (e) {
      setError(e.message)
    } finally {
      setCopying(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <div className="modal-title">Pull Week Forward</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: '14px', color: 'var(--gray-600)', marginBottom: '16px' }}>
            Copy the meal plan from <strong>{formatWeekRange(sourceWeek.start_date)}</strong> into another week.
            Ratings, notes, and purchase status will not be copied.
          </p>
          {error && <div className="error-state" style={{ marginBottom: '12px' }}>{error}</div>}
          <div style={{ marginBottom: '16px' }}>
            <button
              className="btn btn-primary"
              onClick={handleCopyToCurrentWeek}
              disabled={copying}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {copying ? 'Copying…' : '→ Copy to This Week'}
            </button>
          </div>
          <div style={{ textAlign: 'center', color: 'var(--gray-400)', fontSize: '13px', marginBottom: '12px' }}>or choose a specific week</div>
          <div className="form-group">
            <label className="form-label">Target Week</label>
            <select className="form-select" value={targetWeekId} onChange={e => setTargetWeekId(e.target.value)}>
              <option value="">Select a week…</option>
              {eligibleWeeks.sort((a,b) => b.start_date.localeCompare(a.start_date)).map(w => (
                <option key={w.id} value={w.id}>{formatWeekRange(w.start_date)}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleCopy} disabled={copying || !targetWeekId}>
            {copying ? 'Copying…' : 'Copy to Selected Week'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PastWeeks() {
  const [weeks, setWeeks] = useState([])
  const [loading, setLoading] = useState(true)
  const [copyingWeek, setCopyingWeek] = useState(null)
  const navigate = useNavigate()

  const loadWeeks = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/weeks')
      const data = await res.json()
      // Load meal counts for each week
      const withMeals = await Promise.all(
        data.map(async w => {
          const detail = await fetch(`/api/weeks/${w.id}`).then(r => r.json())
          return { ...w, mealCount: detail.meals?.filter(m => m.recipe_id).length ?? 0 }
        })
      )
      setWeeks(withMeals.sort((a, b) => b.start_date.localeCompare(a.start_date)))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadWeeks() }, [])

  const handleCopied = (targetWeekId) => {
    setCopyingWeek(null)
    navigate(`/weeks/${targetWeekId}`)
  }

  if (loading) return <div className="loading-state">Loading weeks…</div>

  return (
    <div>
      <h1 className="page-title">Past Weeks</h1>
      <p className="page-subtitle">View previous meal plans or copy them forward.</p>

      {weeks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📅</div>
          <div className="empty-state-text">No weeks saved yet. Start planning meals on the home page!</div>
        </div>
      ) : (
        <div className="weeks-list">
          {weeks.map(w => {
            const isCurrentWeek = w.start_date === isoDate(getMondayOfWeek(new Date()))
            return (
              <div key={w.id} className="week-item">
                <div className="week-item-info">
                  <div className="week-item-date">
                    {formatWeekRange(w.start_date)}
                    {isCurrentWeek && <span className="tag tag-green" style={{ marginLeft: '8px' }}>Current</span>}
                  </div>
                  <div className="week-item-stats">
                    {w.mealCount} meal{w.mealCount !== 1 ? 's' : ''} planned
                  </div>
                </div>
                <div className="week-item-actions">
                  <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/weeks/${w.id}`)}>
                    View
                  </button>
                  {!isCurrentWeek && (
                    <button className="btn btn-primary btn-sm" onClick={() => setCopyingWeek(w)}>
                      Pull Forward
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {copyingWeek && (
        <CopyModal
          sourceWeek={copyingWeek}
          allWeeks={weeks}
          onClose={() => setCopyingWeek(null)}
          onCopied={handleCopied}
        />
      )}
    </div>
  )
}
