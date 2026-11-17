import { Link } from '../router'

export default function NotFound() {
  return (
    <div className="page">
      <div className="card card-pad not-found">
        <p className="eyebrow">404</p>
        <h1>Nothing here</h1>
        <p className="muted">That page does not exist. The report link may have been mistyped.</p>
        <Link to="/" className="btn btn-primary">
          Back to projects
        </Link>
      </div>
    </div>
  )
}
