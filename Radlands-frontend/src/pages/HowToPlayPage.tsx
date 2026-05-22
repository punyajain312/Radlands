import './HowToPlayPage.css'

interface HowToPlayPageProps {
  onBack: () => void
}

const SECTIONS = [
  {
    title: 'OBJECTIVE',
    color: '#ff0080',
    icon: '⚔',
    text: 'Destroy all three of your opponent\'s camps before they destroy yours. Each player starts with 3 camps and a hand of cards drawn from a shared deck.',
  },
  {
    title: 'TURN STRUCTURE',
    color: '#ff6600',
    icon: '◎',
    text: 'Each turn: (1) Advance your events, (2) Draw a card, (3) Gain 3 water, (4) Take actions — play people, use abilities, play events, junk cards. End your turn to pass.',
  },
  {
    title: 'WATER',
    color: '#00e5ff',
    icon: '💧',
    text: 'Water is the currency of Radlands. You start each turn with 3 water. Spend it to play people and events, or activate abilities. Unused water is lost at turn end.',
  },
  {
    title: 'PEOPLE CARDS',
    color: '#b700ff',
    icon: '◈',
    text: 'People protect your camps. Play them in front of a camp (up to 2 per column). They must be destroyed before that camp can be attacked. Most people have one activated ability usable per turn.',
  },
  {
    title: 'EVENT CARDS',
    color: '#ff6600',
    icon: '◉',
    text: 'Events are placed in your event queue and fire after a countdown. They trigger powerful effects — damage, water, card draws. Your opponent can junk their own cards to destroy events.',
  },
  {
    title: 'CAMPS',
    color: '#d4ff00',
    icon: '⬡',
    text: 'Camps are your base. Each has a passive or activated ability. A camp can only be attacked if it has no people in front of it (unprotected). Once destroyed, it\'s gone — but may grant a bonus.',
  },
  {
    title: 'JUNKING',
    color: '#ff0080',
    icon: '✕',
    text: 'Discard any card from your hand face-up to use its junk effect — usually 1 damage, 1 water, or drawing a card. A powerful emergency option when you need resources.',
  },
  {
    title: 'DAMAGE',
    color: '#ff0080',
    icon: '!',
    text: 'Damage is placed on people and camps. People are destroyed when they have enough damage (check the card). Camps are destroyed when damaged — they are not resilient. Game ends when a player loses all 3 camps.',
  },
]

export function HowToPlayPage({ onBack }: HowToPlayPageProps) {
  return (
    <div className="htp-root">
      <div className="htp-scanlines" />

      <header className="htp-header">
        <button className="htp-back-btn" onClick={onBack}>← BACK</button>
        <div>
          <h1 className="htp-title">HOW TO PLAY</h1>
          <p className="htp-subtitle">RADLANDS — QUICK REFERENCE</p>
        </div>
      </header>

      <div className="htp-content">
        <div className="htp-intro">
          Radlands is a 2-player card game set in a post-apocalyptic wasteland.
          Master water management, protect your camps, and destroy your opponent's.
        </div>

        <div className="htp-grid">
          {SECTIONS.map(s => (
            <div
              key={s.title}
              className="htp-card"
              style={{ '--card-color': s.color } as React.CSSProperties}
            >
              <div className="htp-card-top">
                <span className="htp-card-icon">{s.icon}</span>
                <span className="htp-card-title">{s.title}</span>
              </div>
              <p className="htp-card-text">{s.text}</p>
              <div className="htp-card-bar" />
            </div>
          ))}
        </div>

        <div className="htp-tip">
          <span className="htp-tip-label">PRO TIP</span>
          Junk effects are often undervalued. A well-timed junk can turn the tide —
          use it to destroy an enemy event before it fires or grab emergency water.
        </div>
      </div>
    </div>
  )
}
