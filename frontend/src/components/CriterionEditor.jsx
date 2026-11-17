import { useState } from 'react'
import { IconPlus, IconTrash } from './ui'

export const EXAMPLE_CRITERIA = [
  'Go to the site, sign up with a new email address, then verify the welcome dashboard loads',
  'Add the first product to the cart, then verify the cart badge shows 1 item',
  'Open the pricing page and verify every plan is listed with a price',
  'Submit the contact form and verify a confirmation message appears',
]

export function lintCriterion(text) {
  const value = text.trim()
  if (!value) return []
  const issues = []
  if (value.length < 25) issues.push('Too short — name the path and the result you expect.')
  if (!/\b(verify|confirm|check|see|shows?|displays?|loads?|opens?|appears?|contains?)\b/i.test(value)) {
    issues.push('Say what proves it worked, for example “then verify …”.')
  }
  if (value.split(/\s+/).length > 45) issues.push('Long enough to drift — split this into two criteria.')
  return issues
}

export function CriterionEditor({ items, onChange, disabled = false }) {
  const [touched, setTouched] = useState({})

  const update = (key, text) => onChange(items.map((item) => (item.key === key ? { ...item, text } : item)))
  const remove = (key) => onChange(items.filter((item) => item.key !== key))
  const add = (text = '') =>
    onChange([...items, { key: `new_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, text }])

  return (
    <div className="criteria-editor">
      <div className="editor-head">
        <div>
          <h3>Acceptance criteria</h3>
          <p className="muted small">Plain English, one task per row. Kane opens a real browser and proves each one.</p>
        </div>
        <span className="count-badge">{items.length}</span>
      </div>

      <ol className="criterion-list">
        {items.map((item, index) => {
          const issues = touched[item.key] ? lintCriterion(item.text) : []
          return (
            <li key={item.key} className="criterion-row">
              <span className="criterion-index" aria-hidden="true">
                {index + 1}
              </span>
              <div className="criterion-body">
                <textarea
                  className="input textarea"
                  rows={2}
                  value={item.text}
                  disabled={disabled}
                  placeholder="Go to the site, <do the thing>, then verify <the result>"
                  onChange={(event) => update(item.key, event.target.value)}
                  onBlur={() => setTouched((prev) => ({ ...prev, [item.key]: true }))}
                />
                {issues.map((issue) => (
                  <p key={issue} className="criterion-warn">
                    {issue}
                  </p>
                ))}
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => remove(item.key)}
                disabled={disabled || items.length <= 1}
                aria-label={`Remove criterion ${index + 1}`}
                title="Remove"
              >
                <IconTrash />
              </button>
            </li>
          )
        })}
      </ol>

      <button type="button" className="btn btn-ghost add-row" onClick={() => add()} disabled={disabled}>
        <IconPlus width={14} height={14} /> Add criterion
      </button>

      <div className="examples">
        <span className="examples-title">Start from an example</span>
        <div className="chip-row">
          {EXAMPLE_CRITERIA.map((example) => (
            <button
              key={example}
              type="button"
              className="chip"
              disabled={disabled}
              onClick={() => add(example)}
              title={example}
            >
              {example.length > 58 ? `${example.slice(0, 58)}…` : example}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
