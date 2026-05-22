import { useState, useCallback, useRef, useEffect } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import './RulebookPage.css'

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

const PDF_OPTIONS = {
  cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
}

const ZOOM_LEVELS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0]

export function RulebookPage({ onBack }: { onBack: () => void }) {
  const [numPages, setNumPages] = useState(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [zoomIdx, setZoomIdx] = useState(2)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)

  const stageRef = useRef<HTMLDivElement>(null)
  const [stageH, setStageH] = useState(0)

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => setStageH(entries[0].contentRect.height))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const zoom       = ZOOM_LEVELS[zoomIdx]
  const pageHeight = stageH > 0 ? Math.max(200, (stageH - 48) * zoom) : undefined

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setLoading(false)
  }, [])

  const onDocumentLoadError = useCallback(() => {
    setError(true)
    setLoading(false)
  }, [])

  const prev   = () => setPageNumber(p => Math.max(1, p - 1))
  const next   = () => setPageNumber(p => Math.min(numPages, p + 1))
  const zoomIn  = () => setZoomIdx(i => Math.min(ZOOM_LEVELS.length - 1, i + 1))
  const zoomOut = () => setZoomIdx(i => Math.max(0, i - 1))

  return (
    <div className="rb-root">
      <div className="rb-scanlines" />

      <header className="rb-header">
        <button className="rb-btn rb-btn-back" onClick={onBack}>← BACK</button>

        <div className="rb-title-block">
          <span className="rb-title-label">CLASSIFIED DOSSIER</span>
          <h1 className="rb-title">RADLANDS CODEX</h1>
        </div>

        <div className="rb-header-controls">
          <button className="rb-btn rb-btn-zoom" onClick={zoomOut} disabled={zoomIdx === 0}>−</button>
          <span className="rb-zoom-label">{Math.round(zoom * 100)}%</span>
          <button className="rb-btn rb-btn-zoom" onClick={zoomIn} disabled={zoomIdx === ZOOM_LEVELS.length - 1}>+</button>

          <div className="rb-sep" />

          <button className="rb-btn rb-btn-nav" onClick={prev} disabled={pageNumber <= 1}>◄</button>
          <div className="rb-page-input-wrap">
            <input
              className="rb-page-input"
              type="number"
              value={pageNumber}
              min={1}
              max={numPages || 1}
              onChange={e => {
                const v = parseInt(e.target.value)
                if (!isNaN(v) && v >= 1 && v <= numPages) setPageNumber(v)
              }}
            />
            <span className="rb-page-total">/ {numPages || '—'}</span>
          </div>
          <button className="rb-btn rb-btn-nav" onClick={next} disabled={pageNumber >= numPages}>►</button>

          <div className="rb-sep" />

          <a className="rb-btn rb-btn-dl" href="/rulebook.pdf" download="Radlands_Rulebook.pdf">↓ EXTRACT</a>
        </div>
      </header>

      <div className="rb-stage" ref={stageRef}>
        {loading && !error && (
          <div className="rb-status">
            <div className="rb-status-icon">📡</div>
            <div className="rb-status-text">LOADING INTEL…</div>
            <div className="rb-loader" />
          </div>
        )}

        {error && (
          <div className="rb-status">
            <div className="rb-status-icon">⚠</div>
            <div className="rb-status-text rb-error">TRANSMISSION FAILURE</div>
            <p className="rb-error-sub">PDF could not be decoded. Download the file instead.</p>
            <a className="rb-btn rb-btn-dl" href="/rulebook.pdf" download style={{ marginTop: 16 }}>
              ↓ DOWNLOAD RULEBOOK
            </a>
          </div>
        )}

        <div className={`rb-doc-wrap ${loading ? 'rb-hidden' : ''}`}>
          <div className="rb-corner rb-corner-tl" />
          <div className="rb-corner rb-corner-tr" />
          <div className="rb-corner rb-corner-bl" />
          <div className="rb-corner rb-corner-br" />

          <div className="rb-page-frame">
            <div className="rb-page-scanlines" />
            <Document
              file="/rulebook.pdf"
              options={PDF_OPTIONS}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={null}
              error={null}
            >
              <Page
                pageNumber={pageNumber}
                height={pageHeight}
                renderAnnotationLayer={false}
                renderTextLayer={false}
                loading={null}
              />
            </Document>
          </div>
        </div>
      </div>

      {!loading && !error && (
        <footer className="rb-footer">
          <button className="rb-btn rb-btn-nav-lg" onClick={prev} disabled={pageNumber <= 1}>◄ PREV</button>
          <div className="rb-progress-bar">
            <div
              className="rb-progress-fill"
              style={{ width: numPages > 0 ? `${(pageNumber / numPages) * 100}%` : '0%' }}
            />
          </div>
          <button className="rb-btn rb-btn-nav-lg" onClick={next} disabled={pageNumber >= numPages}>NEXT ►</button>
        </footer>
      )}
    </div>
  )
}
