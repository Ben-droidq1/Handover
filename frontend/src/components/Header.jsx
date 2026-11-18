import { isMockMode } from '../api/client'
import { Link, useLocation } from '../router'

export function BrandMark({ size = 26 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="brand-mark"
    >
      <rect width="24" height="24" rx="7" fill="currentColor" />
      <path
        d="M6.5 8.2h6.2a3.8 3.8 0 010 7.6H6.5"
        stroke="#fff"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path d="M8 12h7M12 8.8L15.2 12 12 15.2" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Header() {
  const path = useLocation()

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link to="/" className="brand">
          <BrandMark />
          <span>Handover</span>
        </Link>

        <nav className="nav" aria-label="Main">
          <Link to="/" className={`nav-link ${path === '/' ? 'is-active' : ''}`}>
            Projects
          </Link>
          <Link to="/new" className={`nav-link ${path === '/new' ? 'is-active' : ''}`}>
            New project
          </Link>
        </nav>

        <div className="topbar-actions">
          {isMockMode ? <span className="pill pill-muted pill-sm">Demo data</span> : null}
          <Link to="/new" className="btn btn-primary btn-sm">
            New project
          </Link>
        </div>
      </div>
    </header>
  )
}
