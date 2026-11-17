import { Header } from './components/Header'
import { OwnerDialog } from './components/OwnerDialog'
import Dashboard from './pages/Dashboard'
import NewProject from './pages/NewProject'
import NotFound from './pages/NotFound'
import ProjectDetail from './pages/ProjectDetail'
import PublicReport from './pages/PublicReport'
import RunDetail from './pages/RunDetail'
import { useLocation } from './router'

function Routes({ path }) {
  if (path === '/' || path === '') return <Dashboard />
  if (path === '/new') return <NewProject />

  const project = path.match(/^\/projects\/([^/]+)$/)
  if (project) return <ProjectDetail id={decodeURIComponent(project[1])} />

  const run = path.match(/^\/runs\/([^/]+)$/)
  if (run) return <RunDetail id={decodeURIComponent(run[1])} />

  return <NotFound />
}

export default function App() {
  const path = useLocation()
  const isPublic = path.startsWith('/r/')

  if (isPublic) {
    const token = decodeURIComponent(path.slice(3).split('?')[0])
    return <PublicReport token={token} />
  }

  return (
    <>
      <Header />
      <Routes path={path} />
      <OwnerDialog />
    </>
  )
}
