import './RulebookPage.css'

interface RulebookPageProps {
  onBack: () => void
}

export function RulebookPage({ onBack }: RulebookPageProps) {
  return (
    <div className="rb-root">
      <header className="rb-header">
        <button className="rb-back-btn" onClick={onBack}>← BACK</button>
        <h1 className="rb-title">RULEBOOK</h1>
        <a
          className="rb-download-btn"
          href="/rulebook.pdf"
          download="Radlands_Rulebook.pdf"
        >
          DOWNLOAD
        </a>
      </header>

      <div className="rb-viewer">
        <iframe
          src="/rulebook.pdf"
          title="Radlands Rulebook"
          className="rb-iframe"
        />
      </div>
    </div>
  )
}
