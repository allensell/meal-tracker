import { useEffect, useState } from 'react'

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatMealDate(startDate, dayOfWeek) {
  if (!startDate) return ''
  const d = new Date(startDate + 'T00:00:00')
  d.setDate(d.getDate() + dayOfWeek)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function StarDisplay({ rating }) {
  if (rating == null) return <span>—</span>
  return (
    <span>
      {'★'.repeat(Math.round(rating))}{'☆'.repeat(5 - Math.round(rating))}
    </span>
  )
}

// ─── BarChart ────────────────────────────────────────────────────────────────

function BarChart({ data, groups, xKey, yMax, height = 220, unit = '' }) {
  if (!data || data.length === 0) return <p className="text-muted text-sm">No data yet.</p>

  const paddingLeft = 44
  const paddingRight = 16
  const paddingTop = 12
  const paddingBottom = data.length > 5 ? 60 : 40
  const totalWidth = Math.max(360, data.length * (groups.length * 20 + 16) + paddingLeft + paddingRight)
  const chartH = height - paddingTop - paddingBottom
  const chartW = totalWidth - paddingLeft - paddingRight

  const gridLines = 5
  const yStep = yMax / gridLines

  const barGroupW = chartW / data.length
  const barW = Math.min(18, (barGroupW - 8) / groups.length)
  const groupPad = (barGroupW - barW * groups.length) / 2

  return (
    <svg
      viewBox={`0 0 ${totalWidth} ${height}`}
      width="100%"
      style={{ display: 'block', minWidth: totalWidth > 600 ? totalWidth : undefined }}
      aria-label="Bar chart"
    >
      {/* gridlines */}
      {Array.from({ length: gridLines + 1 }, (_, i) => {
        const yVal = yStep * i
        const y = paddingTop + chartH - (yVal / yMax) * chartH
        return (
          <g key={i}>
            <line
              x1={paddingLeft} y1={y}
              x2={paddingLeft + chartW} y2={y}
              stroke="var(--gray-200, #e5e7eb)"
              strokeWidth="1"
            />
            <text
              x={paddingLeft - 6} y={y}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize="10"
              fill="var(--gray-400, #9ca3af)"
            >
              {Number.isInteger(yVal) ? yVal : yVal.toFixed(1)}{unit}
            </text>
          </g>
        )
      })}

      {/* bars */}
      {data.map((row, di) => {
        const xBase = paddingLeft + di * barGroupW + groupPad
        return groups.map((g, gi) => {
          const val = row[g.key]
          if (val == null) return null
          const barH = Math.max(2, (val / yMax) * chartH)
          const x = xBase + gi * barW
          const y = paddingTop + chartH - barH
          return (
            <rect
              key={g.key}
              x={x} y={y}
              width={barW - 1} height={barH}
              fill={g.color}
              rx="2"
            >
              <title>{g.label}: {val}{unit}</title>
            </rect>
          )
        })
      })}

      {/* x-axis labels */}
      {data.map((row, di) => {
        const x = paddingLeft + di * barGroupW + barGroupW / 2
        const y = paddingTop + chartH + 8
        const label = row[xKey]
        return (
          <text
            key={di}
            x={x} y={y}
            textAnchor={data.length > 5 ? 'end' : 'middle'}
            fontSize="10"
            fill="var(--gray-500, #6b7280)"
            transform={data.length > 5 ? `rotate(-40, ${x}, ${y})` : undefined}
          >
            {label}
          </text>
        )
      })}

      {/* legend */}
      {groups.map((g, gi) => {
        const lx = paddingLeft + gi * 90
        const ly = height - 12
        return (
          <g key={g.key}>
            <rect x={lx} y={ly - 8} width={10} height={10} fill={g.color} rx="2" />
            <text x={lx + 14} y={ly} fontSize="10" fill="var(--gray-600, #4b5563)">{g.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export default function Reports() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('http://localhost:3001/api/reports')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  if (loading) return <div className="loading-state">Loading reports…</div>
  if (error) return <div className="error-state">Error: {error}</div>

  const { overall, byWeek, notes, mostUsed, topRated, goingOut } = data

  const hasData = overall.avg_rating != null || overall.overall_avg_prep != null
  const totalRated = byWeek.reduce((sum, w) => sum + 1, 0)

  const ratingGroups = [
    { key: 'avg_rating', label: 'Overall', color: '#4cba7e' },
    { key: 'lunch_avg_rating', label: 'Lunch', color: '#f59e0b' },
    { key: 'dinner_avg_rating', label: 'Dinner', color: '#6366f1' },
  ]

  const prepGroups = [
    { key: 'avg_prep', label: 'Overall', color: '#4cba7e' },
    { key: 'lunch_avg_prep', label: 'Lunch', color: '#f59e0b' },
    { key: 'dinner_avg_prep', label: 'Dinner', color: '#6366f1' },
  ]

  const chartData = byWeek.map(w => ({ ...w, label: formatDate(w.start_date) }))

  const maxPrep = Math.max(
    10,
    ...byWeek.flatMap(w => [w.avg_prep, w.lunch_avg_prep, w.dinner_avg_prep].filter(v => v != null))
  )
  const prepYMax = Math.ceil(maxPrep / 10) * 10

  function fmt(val, suffix = '') {
    return val == null ? '—' : `${val}${suffix}`
  }

  function downloadNotes() {
    const escape = val => `"${String(val ?? '').replace(/"/g, '""')}"`
    const headers = ['Date', 'Day', 'Meal', 'Recipe', 'Rating', 'Prep Time (min)', 'Notes']
    const rows = notes.map(n => [
      escape(formatMealDate(n.start_date, n.day_of_week)),
      escape(DAY_NAMES[n.day_of_week] ?? ''),
      escape(n.meal_type.charAt(0).toUpperCase() + n.meal_type.slice(1)),
      escape(n.recipe_name),
      escape(n.rating != null ? n.rating : ''),
      escape(n.prep_time_minutes != null ? n.prep_time_minutes : ''),
      escape(n.notes),
    ].join(','))

    const content = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([content], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'meal-notes.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!hasData) {
    return (
      <div>
        <h1 className="page-title">Reports</h1>
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <p className="empty-state-text">No ratings yet — start rating your meals to see reports here</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="page-title">Reports</h1>
      <p className="page-subtitle">
        {byWeek.length > 0
          ? `Data across ${byWeek.length} week${byWeek.length !== 1 ? 's' : ''} of rated meals`
          : 'No rated meals yet'}
      </p>

      {/* Stat cards */}
      <div className="stat-cards">
        <div className="stat-card">
          <div className="stat-card-value">{fmt(overall.avg_rating, ' ★')}</div>
          <div className="stat-card-label">Overall Avg Rating</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value">{fmt(overall.lunch_avg_rating, ' ★')}</div>
          <div className="stat-card-label">Lunch Avg Rating</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value">{fmt(overall.dinner_avg_rating, ' ★')}</div>
          <div className="stat-card-label">Dinner Avg Rating</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value">{fmt(overall.overall_avg_prep, ' min')}</div>
          <div className="stat-card-label">Overall Avg Prep Time</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value">{fmt(overall.lunch_avg_prep, ' min')}</div>
          <div className="stat-card-label">Lunch Avg Prep Time</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value">{fmt(overall.dinner_avg_prep, ' min')}</div>
          <div className="stat-card-label">Dinner Avg Prep Time</div>
        </div>
      </div>

      {/* Weekly Ratings Chart */}
      <div className="chart-section">
        <h2 className="chart-title">Weekly Ratings</h2>
        <div className="chart-wrap">
          <BarChart
            data={chartData}
            groups={ratingGroups}
            xKey="label"
            yMax={5}
            height={240}
            unit=""
          />
        </div>
      </div>

      {/* Weekly Prep Time Chart */}
      <div className="chart-section">
        <h2 className="chart-title">Weekly Prep Times</h2>
        <div className="chart-wrap">
          <BarChart
            data={chartData}
            groups={prepGroups}
            xKey="label"
            yMax={prepYMax}
            height={240}
            unit=" min"
          />
        </div>
      </div>

      {/* Most Used Recipes */}
      <div className="chart-section">
        <h2 className="chart-title">Most Used Recipes</h2>
        <div className="stat-cards">
          {[
            { label: 'Overall', list: mostUsed?.overall },
            { label: 'Lunch', list: mostUsed?.lunch },
            { label: 'Dinner', list: mostUsed?.dinner },
          ].map(({ label, list }) => (
            <div key={label} className="recipe-rank-card">
              <div className="recipe-rank-title">{label}</div>
              {!list || list.length === 0 ? (
                <div className="text-muted text-sm">No data yet</div>
              ) : (
                <ol className="recipe-rank-list">
                  {list.map((r, i) => (
                    <li key={i} className="recipe-rank-item">
                      <span className="recipe-rank-name">{r.name}</span>
                      <span className="recipe-rank-count">{r.count}×</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Top Rated Recipes */}
      <div className="chart-section">
        <h2 className="chart-title">Top Rated Recipes <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--gray-400)' }}>(min. 3 rated entries)</span></h2>
        <div className="stat-cards" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {[
            { label: 'Lunch', list: topRated?.lunch },
            { label: 'Dinner', list: topRated?.dinner },
          ].map(({ label, list }) => (
            <div key={label} className="recipe-rank-card">
              <div className="recipe-rank-title">{label}</div>
              {!list || list.length === 0 ? (
                <div className="text-muted text-sm">Not enough data yet — need at least 3 rated entries per recipe</div>
              ) : (
                <ol className="recipe-rank-list">
                  {list.map((r, i) => (
                    <li key={i} className="recipe-rank-item">
                      <span className="recipe-rank-name">{r.name}</span>
                      <span className="recipe-rank-rating">{'★'.repeat(Math.round(r.avg_rating))}{'☆'.repeat(5 - Math.round(r.avg_rating))} {r.avg_rating}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Going Out Stats */}
      {goingOut && goingOut.total > 0 && (
        <div className="chart-section">
          <h2 className="chart-title">Going Out</h2>
          <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="stat-card">
              <div className="stat-card-value">{goingOut.total}</div>
              <div className="stat-card-label">Total Times Going Out</div>
              <div style={{ fontSize: '13px', color: 'var(--gray-400)', marginTop: '4px' }}>
                {goingOut.totalMeals > 0 ? `${Math.round((goingOut.total / goingOut.totalMeals) * 100)}% of all meals` : ''}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-card-value">{goingOut.lunch}</div>
              <div className="stat-card-label">Lunches Out</div>
              <div style={{ fontSize: '13px', color: 'var(--gray-400)', marginTop: '4px' }}>
                {goingOut.totalLunch > 0 ? `${Math.round((goingOut.lunch / goingOut.totalLunch) * 100)}% of lunches` : ''}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-card-value">{goingOut.dinner}</div>
              <div className="stat-card-label">Dinners Out</div>
              <div style={{ fontSize: '13px', color: 'var(--gray-400)', marginTop: '4px' }}>
                {goingOut.totalDinner > 0 ? `${Math.round((goingOut.dinner / goingOut.totalDinner) * 100)}% of dinners` : ''}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notes section */}
      {notes.length > 0 && (
        <div className="chart-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <h2 className="chart-title" style={{ marginBottom: 0 }}>Meal Notes</h2>
              <div style={{ fontSize: '12px', color: 'var(--gray-400)', marginTop: '2px' }}>Only meals with notes entered are shown</div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={downloadNotes}>
              ⬇ Download Notes (.csv)
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="notes-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Meal</th>
                  <th>Recipe</th>
                  <th>Rating</th>
                  <th>Prep</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {notes.map((n, i) => (
                  <tr key={i}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatMealDate(n.start_date, n.day_of_week)} {DAY_NAMES[n.day_of_week]?.slice(0, 3)}</td>
                    <td style={{ textTransform: 'capitalize' }}>{n.meal_type}</td>
                    <td>{n.recipe_name}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {n.rating != null ? `${'★'.repeat(n.rating)}${'☆'.repeat(5 - n.rating)}` : '—'}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{n.prep_time_minutes != null ? `${n.prep_time_minutes} min` : '—'}</td>
                    <td>{n.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
