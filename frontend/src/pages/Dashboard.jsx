import { api } from '../api/client'
import { Link } from '../router'
import { useAsync } from '../lib/useAsync'
import { initializeLabel, passRate, plural, relativeTime } from '../lib/format'
import { EmptyState, ErrorNote, PassBar, Skeleton, StatusPill } from '../components/ui'

function hostOf(url) {
  try {
    return new URL(url).host
  } catch {
    return url || 'No URL set'
  }
}

function Stats({ projects }) {
  const withRuns = projects.filter((project) => project.lastRun)
  const passed = withRuns.reduce((sum, project) => sum + project.lastRun.passed, 0)
  const total = withRuns.reduce((sum, project) => sum + project.lastRun.total, 0)
  const awaiting = projects.filter(
    (project) => project.lastRun && !project.signedOff && project.lastRun.status !== 'running',
  ).length

  return (
    <div className="stats">
      <div className="stat">
        <span className="stat-label">Projects</span>
        <strong>{projects.length}</strong>
      </div>
      <div className="stat">
        <span className="stat-label">Checks passing</span>
        <strong>
          {total ? `${passRate(passed, total)}%` : '—'}
          <span className="stat-sub">{total ? `${passed}/${total} on latest runs` : 'no runs yet'}</span>
        </strong>
      </div>
      <div className="stat">
        <span className="stat-label">Awaiting sign-off</span>
        <strong>
          {awaiting}
          <span className="stat-sub">{plural(awaiting, 'delivery', 'deliveries')} ready for the client</span>
        </strong>
      </div>
    </div>
  )
}

function ProjectCard({ project }) {
  const run = project.lastRun
  const perfect = run && run.total > 0 && run.passed === run.total

  return (
    <Link to={`/projects/${project.id}`} className="card project-card">
      <div className="project-top">
        <div className="avatar" aria-hidden="true">
          {initializeLabel(project.name)}
        </div>
        <div className="project-id">
          <h3>{project.name}</h3>
          <p className="muted small">{project.clientName || 'No client set'}</p>
        </div>
        {project.signedOff ? <span className="pill pill-ok pill-sm">Signed off</span> : null}
      </div>

      <p className="project-url" title={project.siteUrl}>
        {hostOf(project.siteUrl)}
      </p>

      <div className="project-run">
        {run ? (
          <>
            <StatusPill status={run.status} size="sm" />
            <span className={perfect ? 'ok-text' : ''}>
              {run.passed}/{run.total} passed
            </span>
          </>
        ) : (
          <span className="muted small">Not run yet</span>
        )}
        <span className="dot-sep" aria-hidden="true">
          ·
        </span>
        <span className="muted small">{project.criteriaCount} criteria</span>
      </div>

      <PassBar passed={run?.passed ?? 0} total={run?.total ?? project.criteriaCount} tone={run ? undefined : 'muted'} />

      <footer className="project-foot">
        <span>{run ? `Last run ${relativeTime(run.startedAt)}` : 'Ready when you are'}</span>
        <span className="link-arrow">Open →</span>
      </footer>
    </Link>
  )
}

export default function Dashboard() {
  const { data, loading, error, reload } = useAsync(() => api.listProjects(), [])
  const projects = data?.projects ?? []

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Delivery reports</p>
          <h1>Prove it works, then hand it over</h1>
          <p className="lede">
            Turn your client&apos;s acceptance criteria into real browser checks. Share one link with screenshots and a
            sign-off button.
          </p>
        </div>
      </div>

      {loading && !data ? (
        <div className="card card-pad">
          <Skeleton lines={4} />
        </div>
      ) : error ? (
        <ErrorNote error={error} onRetry={reload} />
      ) : projects.length === 0 ? (
        <div className="card">
          <EmptyState
            title="No projects yet"
            action={
              <Link to="/new" className="btn btn-primary">
                Create your first project
              </Link>
            }
          >
            Add a site URL and a few plain-English criteria. Kane verifies each one in a real Chrome browser and
            Handover turns the results into a report your client can approve.
          </EmptyState>
        </div>
      ) : (
        <>
          <Stats projects={projects} />
          <div className="project-grid">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
            <Link to="/new" className="card new-card">
              <span className="new-mark" aria-hidden="true">
                +
              </span>
              <strong>New project</strong>
              <span className="muted small">Start from a URL and a checklist</span>
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
