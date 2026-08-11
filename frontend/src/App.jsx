import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import WeekView from './components/WeekView.jsx'
import PastWeeks from './components/PastWeeks.jsx'
import RecipeLibrary from './components/RecipeLibrary.jsx'
import Reports from './components/Reports.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <header className="app-header">
          <div className="header-inner">
            <div className="logo">
              <span className="logo-icon">🥗</span>
              <span className="logo-text">Meal Tracker</span>
            </div>
            <nav className="main-nav">
              <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                This Week
              </NavLink>
              <NavLink to="/past-weeks" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                Past Weeks
              </NavLink>
              <NavLink to="/recipes" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                Recipes
              </NavLink>
              <NavLink to="/reports" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                Reports
              </NavLink>
            </nav>
          </div>
        </header>
        <main className="app-main">
          <Routes>
            <Route path="/" element={<WeekView />} />
            <Route path="/weeks/:id" element={<WeekView />} />
            <Route path="/past-weeks" element={<PastWeeks />} />
            <Route path="/recipes" element={<RecipeLibrary />} />
            <Route path="/reports" element={<Reports />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
