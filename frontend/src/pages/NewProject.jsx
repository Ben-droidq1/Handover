import { useState } from 'react'
import { api } from '../api/client'
import { CriterionEditor } from '../components/CriterionEditor'
import { IconArrow, Spinner } from '../components/ui'
import { navigate, Link } from '../router'

export default function NewProject() {
  const [form, setForm] = useState({ name: '', clientName: '', siteUrl: '' })
  const [items, setItems] = useState([{ key: 'new_0', text: '' }])
  const [urlError, setUrlError] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))

  function validateUrl(value) {
    if (!value.trim()) return 'Add the site your client should receive.'
    try {
      const parsed = new URL(value.trim())
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return 'Use a full http:// or https:// URL.'
      return null
    } catch {
      return 'That does not look like a URL yet.'
    }
  }

  async function submit(event) {
    event.preventDefault()
    setError(null)
    const issue = validateUrl(form.siteUrl)
    setUrlError(issue)
    if (issue) return
    if (!form.name.trim()) {
      setError('Give the project a name.')
      return
    }
    const criteria = items.map((item) => item.text.trim()).filter(Boolean)
    if (!criteria.length) {
      setError('Add at least one acceptance criterion.')
      return
    }

    setBusy(true)
    try {
      const { project } = await api.createProject({ ...form, siteUrl: form.siteUrl.trim(), criteria })
      navigate(`/projects/${project.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <Link to="/" className="back-link">
        ← All projects
      </Link>

      <div className="page-head compact">
        <div>
          <p className="eyebrow">New handover</p>
          <h1>What should the site do?</h1>
          <p className="lede">
            Paste the acceptance criteria from your contract or client thread. One task per line — Kane runs each in its
            own browser.
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="split">
        <div className="stack gap-20">
          <section className="card card-pad stack gap-16">
            <h2 className="section-title">The delivery</h2>
            <div className="grid-2">
              <label className="field">
                <span className="field-label">Project name</span>
                <input
                  className="input"
                  value={form.name}
                  onChange={set('name')}
                  placeholder="Northwind Store redesign"
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">Client name</span>
                <input
                  className="input"
                  value={form.clientName}
                  onChange={set('clientName')}
                  placeholder="Northwind Ltd."
                />
              </label>
            </div>

            <label className="field">
              <span className="field-label">Site URL</span>
              <input
                className={`input ${urlError ? 'input-bad' : ''}`}
                value={form.siteUrl}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, siteUrl: event.target.value }))
                  if (urlError) setUrlError(null)
                }}
                onBlur={() => setUrlError(validateUrl(form.siteUrl))}
                placeholder="https://client-site.com"
                inputMode="url"
                required
              />
              {urlError ? <span className="field-error">{urlError}</span> : <span className="field-hint">Kane opens this URL in a fresh Chrome session for every criterion.</span>}
            </label>
          </section>

          <section className="card card-pad">
            <CriterionEditor items={items} onChange={setItems} disabled={busy} />
          </section>

          {error ? <p className="form-error">{error}</p> : null}

          <div className="row end gap-8">
            <Link to="/" className="btn btn-ghost">
              Cancel
            </Link>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? <Spinner /> : null}
              {busy ? 'Creating…' : 'Create project'}
              {busy ? null : <IconArrow width={15} height={15} />}
            </button>
          </div>
        </div>

        <aside className="aside-rail stack gap-16">
          <section className="card card-pad rail-card">
            <h3>How a handover works</h3>
            <ol className="rail-steps">
              <li>
                <span>1</span>
                <div>
                  <strong>Write the checklist</strong>
                  <p className="muted small">Plain English. No selectors, no test scripts.</p>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <strong>Kane runs it</strong>
                  <p className="muted small">Each criterion gets its own real Chrome session, three at a time.</p>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <strong>Send the report</strong>
                  <p className="muted small">Your client sees screenshots, pass/fail, and an approve button.</p>
                </div>
              </li>
            </ol>
          </section>

          <section className="card card-pad rail-card tip">
            <h3>Write criteria a client would argue about</h3>
            <p className="muted small">
              Name the page, the action, and the result. If two people could disagree about whether it passed, Kane can
              too.
            </p>
            <div className="good-bad">
              <div>
                <span className="tag tag-bad">Vague</span>
                <p>“Checkout works.”</p>
              </div>
              <div>
                <span className="tag tag-ok">Provable</span>
                <p>“Add the first product to the cart, then verify the cart badge shows 1 item.”</p>
              </div>
            </div>
          </section>
        </aside>
      </form>
    </div>
  )
}
