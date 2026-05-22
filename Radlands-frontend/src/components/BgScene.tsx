/* Shared animated wasteland background — imported by every page */
import './BgScene.css'

const STARS = 55
const SPARKS = 18

interface BgSceneProps {
  orbColor?: string
}

export function BgScene({ orbColor = '#b700ff' }: BgSceneProps) {
  return (
    <div className="bgs-root" aria-hidden>
      <div className="bgs-orb" style={{ background: `radial-gradient(circle, ${orbColor}22 0%, transparent 68%)` }} />

      {Array.from({ length: STARS }, (_, i) => (
        <div key={i} className="bgs-star" style={{
          left:  `${(i * 37 + 11) % 96 + 2}%`,
          top:   `${(i * 53 + 7)  % 55 + 2}%`,
          animationDelay: `${((i * 0.47) % 3).toFixed(2)}s`,
          width:  i % 5 === 0 ? '2px' : '1px',
          height: i % 5 === 0 ? '2px' : '1px',
        }} />
      ))}

      <svg className="bgs-grid" viewBox="0 0 600 300" preserveAspectRatio="none">
        {[0,60,120,180,240,300,360,420,480,540,600].map(x => (
          <line key={x} x1={x} y1="300" x2="300" y2="0" stroke="#ff0080" strokeWidth="0.7" opacity="0.14" />
        ))}
        {[250,200,160,125,95,70,50,35,22,12].map(y => (
          <line key={y} x1={300-y} y1={y} x2={300+y} y2={y} stroke="#ff0080" strokeWidth="0.7" opacity={0.05+(y/300)*0.2} />
        ))}
      </svg>

      <svg className="bgs-dunes" viewBox="0 0 1400 160" preserveAspectRatio="none">
        <path d="M0 160 L0 90 Q175 20 350 75 Q525 120 700 52 Q875 0 1050 58 Q1225 105 1400 70 L1400 160 Z" fill="#08001a" />
      </svg>
      <div className="bgs-ground" />

      <div className="bgs-fire">
        <div className="bgs-flame bgs-fl1" />
        <div className="bgs-flame bgs-fl2" />
        <div className="bgs-flame bgs-fl3" />
        <div className="bgs-fire-base" />
      </div>

      {Array.from({ length: SPARKS }, (_, i) => (
        <div key={i} className="bgs-spark" style={{
          left: `${48 + ((i * 11) % 14) - 7}%`,
          '--dur':   `${1.8 + (i * 0.19) % 2}s`,
          '--delay': `${(i * 0.27) % 3.2}s`,
          '--drift': `${((i * 41 + 13) % 44) - 22}px`,
          '--size':  `${2 + (i % 3)}px`,
          '--clr':   i % 3 === 0 ? '#00e5ff' : i % 3 === 1 ? '#ff0080' : '#d4ff00',
        } as React.CSSProperties} />
      ))}

      <div className="bgs-scanlines" />
    </div>
  )
}
