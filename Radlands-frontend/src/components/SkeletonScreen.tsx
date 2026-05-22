import './SkeletonScreen.css'

export function SkeletonScreen() {
  return (
    <div className="sk-root">
      <div className="sk-scanlines" />
      <div className="sk-center">
        <div className="sk-logo">RADLANDS</div>
        <div className="sk-loader-track">
          <div className="sk-loader-fill" />
        </div>
        <div className="sk-label">CONNECTING TO ARENA…</div>
      </div>
    </div>
  )
}
