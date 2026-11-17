import { useEffect, useState } from 'react'

export function Screenshot({ src, alt, variant = 'thumb' }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open])

  if (!src) {
    return <div className={`shot shot-${variant} shot-empty`}>No screenshot captured</div>
  }

  return (
    <>
      <button type="button" className={`shot shot-${variant}`} onClick={() => setOpen(true)}>
        <img src={src} alt={alt} loading="lazy" />
        <span className="shot-zoom">View full size</span>
      </button>
      {open ? (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={alt} onClick={() => setOpen(false)}>
          <button type="button" className="lightbox-close" onClick={() => setOpen(false)} aria-label="Close screenshot">
            ×
          </button>
          <img src={src} alt={alt} onClick={(event) => event.stopPropagation()} />
        </div>
      ) : null}
    </>
  )
}
