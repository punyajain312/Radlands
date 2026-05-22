import { useState } from 'react'
import {
  IconTarget, IconRefresh, IconDroplet, IconUsers,
  IconClock, IconShield, IconZap, IconFlame, IconChevronLeft,
} from '../components/Icons'
import './HowToPlayPage.css'

type RuleIcon = React.ComponentType<{ size?: number; color?: string }>

interface Rule {
  Icon: RuleIcon
  title: string
  color: string
  shortDesc: string
  overview: string
  deepDive: string
  mechanics: [string, string, string, string]
  tip: string
}

const RULES: Rule[] = [
  {
    Icon: IconTarget,
    title: 'OBJECTIVE',
    color: '#ff0080',
    shortDesc: 'Destroy all 3 enemy camps to claim victory in the wasteland.',
    overview: 'Each player controls 3 camps arranged in a row. Your goal is to destroy all 3 of your opponent\'s camps before they destroy yours. Camps can only be attacked when unprotected — when no people are standing in front of them.',
    deepDive: 'The game ends immediately when all 3 camps on one side are destroyed. Camps have unique abilities that can shift the course of battle, so deciding which camp to target first is often the most decisive strategic call you\'ll make.',
    mechanics: [
      'Each player starts with 3 secret face-down camps',
      'Camps reveal their abilities when attacked or activated',
      'Destroying a camp removes its ability permanently',
      'Win by destroying all 3 of your opponent\'s camps',
    ],
    tip: 'Target the most dangerous camp first. Disabling a powerful ability early can be worth more than raw damage output.',
  },
  {
    Icon: IconRefresh,
    title: 'TURN STRUCTURE',
    color: '#ff6600',
    shortDesc: 'Advance events, draw a card, gain 3 water, then take your actions.',
    overview: 'Each turn follows a strict sequence. First advance all queued events one step closer to firing. Then draw one card. Then gain exactly 3 water. Finally, spend that water taking as many actions as you can afford before passing to your opponent.',
    deepDive: 'The order matters — events advance before you draw, so you must plan around their countdown each turn. You cannot save water between turns; anything unspent is lost when you pass. Always find ways to extract value from every drop.',
    mechanics: [
      'Step 1 — Advance all queued events forward',
      'Step 2 — Draw one card from the shared deck',
      'Step 3 — Gain exactly 3 water',
      'Step 4 — Spend water on actions, then pass',
    ],
    tip: 'Never end your turn with water left over. Even junking a weak card for 1 damage is better than losing resources.',
  },
  {
    Icon: IconDroplet,
    title: 'WATER',
    color: '#00e5ff',
    shortDesc: 'The sole currency of the wasteland — spend it all or lose it.',
    overview: 'Water is everything in Radlands. You receive exactly 3 water at the start of your action phase every turn. You spend it to play people and events from your hand, to activate camp and person abilities, and sometimes to junk cards for emergency effects.',
    deepDive: 'Some camps and people generate bonus water as part of their ability, letting you chain more actions in a single turn. Water management is the core skill — knowing which sequence of plays maximizes your turn separates strong players from new ones.',
    mechanics: [
      'Gain 3 water at the start of every action phase',
      'Playing a card costs its printed water cost',
      'Abilities also cost water to activate',
      'Unspent water is always lost at end of turn',
    ],
    tip: 'Cards that generate water let you chain extra actions. Prioritize them early to build momentum and pull ahead.',
  },
  {
    Icon: IconUsers,
    title: 'PEOPLE',
    color: '#b700ff',
    shortDesc: 'Shield your camps and grant powerful ongoing field abilities.',
    overview: 'People are your front-line defenders. Each column can hold up to 2 people standing in front of the camp. An opponent cannot attack a camp directly if any people protect it — they must first destroy those people. People also provide activated abilities.',
    deepDive: 'People are double-purpose: protection and power. Most person abilities cost water and can only be used once per turn. A damaged person is removed immediately, so keeping people alive is critical to your defensive line holding together.',
    mechanics: [
      'Up to 2 people per column in front of each camp',
      'Opponent must destroy people before attacking the camp',
      'Each person can use their ability once per turn',
      'A damaged person is removed from play instantly',
    ],
    tip: 'Spread people across all 3 columns. Stacking one column leaves your other camps completely exposed.',
  },
  {
    Icon: IconClock,
    title: 'EVENTS',
    color: '#ffd700',
    shortDesc: 'Queued countdown cards that fire powerful effects automatically.',
    overview: 'Events are played into a shared queue with a countdown number. Each turn, every queued event advances by one. When it reaches zero, it fires its effect and is discarded. Effects range from dealing damage to granting water to drawing cards.',
    deepDive: 'The opponent can cancel an incoming event by junking any card from their hand before the event fires. This creates tension: threatening events forces the opponent to burn hand cards even if the event never actually fires. Bluffing with cheap events is a legitimate strategy.',
    mechanics: [
      'Events enter a shared queue with a printed countdown',
      'Each event advances one step at the start of each turn',
      'When countdown reaches 0 the effect fires immediately',
      'Opponent can junk a hand card to cancel any event',
    ],
    tip: 'Chain multiple events to overwhelm your opponent\'s ability to cancel them — they only have so many cards to sacrifice.',
  },
  {
    Icon: IconShield,
    title: 'CAMPS',
    color: '#d4ff00',
    shortDesc: 'Your stronghold — each with a unique ability that defines your strategy.',
    overview: 'Camps form the backbone of your game plan. Each camp starts face-down and flips to reveal its ability the first time it is attacked or when you activate it. Camps provide either a passive effect that is always active, or an activated ability costing water.',
    deepDive: 'Your 3 starting camps are the most impactful decision in the game. Camps that synergize create dominant engine combinations — a water-generating camp combined with a camp that rewards spending extra water creates explosive, unstoppable turns.',
    mechanics: [
      'Camps start face-down and flip when attacked or activated',
      'Passive abilities are always active once flipped',
      'Activated abilities cost water and can be used once per turn',
      'A destroyed camp is gone — its ability lost permanently',
    ],
    tip: 'Protect your most powerful camp at all costs. Losing a key engine ability early can decide the entire game.',
  },
  {
    Icon: IconZap,
    title: 'JUNKING',
    color: '#ff0080',
    shortDesc: 'Discard any card instantly for an emergency effect.',
    overview: 'Any card can be junked at any time during your turn — or during the opponent\'s turn to cancel an event. Junking discards the card face-up and grants the card\'s junk effect, printed at its bottom. Junk effects are weaker than the card\'s main use but instant and free.',
    deepDive: 'Junking is consistently undervalued by new players. The ability to respond to enemy events mid-turn is powerful. Cards with strong junk effects are worth running even if their main ability is average — flexible responses win close games.',
    mechanics: [
      'Junk any time during your turn or to react to events',
      'Junk effects are weaker than the card\'s main ability',
      'Common effects: 1 damage, 1 water, or draw 1 card',
      'Junked cards go face-up to a shared discard pile',
    ],
    tip: 'When you\'re ahead, junk freely to cancel threats. Protecting your lead is worth more than hoarding hand cards.',
  },
  {
    Icon: IconFlame,
    title: 'DAMAGE',
    color: '#ff4400',
    shortDesc: 'One damage destroys any person or camp instantly — no HP tracking.',
    overview: 'Damage in Radlands is binary. Everything has 1 health. A single point of damage destroys any person or camp outright. There is no HP tracking, no partial damage, and no healing. This makes every attack decisive and every defensive choice carry real weight.',
    deepDive: 'Because damage is final, board control swings dramatically and suddenly. Protecting people with damage-prevention effects is extremely valuable. Effects that deal 2 damage at once — hitting a person and the camp behind them — are among the strongest plays available.',
    mechanics: [
      'One damage destroys any person or camp instantly',
      'Attacking a column hits the front-most person',
      'If no people are present, damage hits the camp',
      'Some effects deal damage to multiple targets at once',
    ],
    tip: 'Effects that hit both a person and the camp behind them in one action are almost always your strongest available play.',
  },
]

export function HowToPlayPage({ onBack }: { onBack: () => void }) {
  const [selected, setSelected] = useState<Rule | null>(null)

  if (selected) {
    return <DetailView rule={selected} onBack={() => setSelected(null)} onBackToMenu={onBack} />
  }
  return <GridView rules={RULES} onSelect={setSelected} onBack={onBack} />
}

function GridView({
  rules,
  onSelect,
  onBack,
}: {
  rules: Rule[]
  onSelect: (r: Rule) => void
  onBack: () => void
}) {
  return (
    <div className="htp-root">
      <div className="htp-scanlines" />

      <header className="htp-bar">
        <button className="htp-back-btn" onClick={onBack}>
          <IconChevronLeft size={14} /> BACK
        </button>
        <div className="htp-bar-center">
          <span className="htp-bar-eyebrow">RADLANDS — TACTICAL MANUAL</span>
          <span className="htp-bar-title">HOW TO PLAY</span>
        </div>
        <span className="htp-bar-tag">8 MECHANICS</span>
      </header>

      {/* compact title strip */}
      <div className="htp-title-strip">
        <div className="htp-ts-eyebrow">MASTER THE WASTELAND</div>
        <div className="htp-ts-title">GAME MECHANICS</div>
        <div className="htp-ts-sub">Select any card to dive deep into the rules of Radlands</div>
        <div className="htp-ts-line" />
      </div>

      {/* grid fills all remaining space */}
      <div className="htp-grid-wrap">
        {rules.map(rule => (
          <button
            key={rule.title}
            className="htp-card"
            style={{ '--cc': rule.color } as React.CSSProperties}
            onClick={() => onSelect(rule)}
          >
            <div className="htp-card-glow" />
            <div className="htp-card-body">
              <div className="htp-card-icon-wrap">
                <rule.Icon size={28} color={rule.color} />
              </div>
              <div className="htp-card-title" style={{ color: rule.color }}>{rule.title}</div>
              <div className="htp-card-desc">{rule.shortDesc}</div>
              <div className="htp-card-learn">LEARN MORE →</div>
            </div>
            <div className="htp-card-bar" />
          </button>
        ))}
      </div>
    </div>
  )
}

function DetailView({
  rule,
  onBack,
  onBackToMenu,
}: {
  rule: Rule
  onBack: () => void
  onBackToMenu: () => void
}) {
  return (
    <div className="htp-root">
      <div className="htp-scanlines" />

      <header className="htp-bar">
        <button className="htp-back-btn" onClick={onBack}>
          <IconChevronLeft size={14} /> BACK TO MECHANICS
        </button>
        <div className="htp-bar-center">
          <span className="htp-bar-eyebrow">RADLANDS — TACTICAL MANUAL</span>
          <span className="htp-bar-title" style={{ color: rule.color, textShadow: `0 0 14px ${rule.color}` }}>
            {rule.title}
          </span>
        </div>
        <button className="htp-menu-btn" onClick={onBackToMenu}>MAIN MENU</button>
      </header>

      <div className="htp-detail-scroll">
        <div className="htp-detail-hero">
          <div className="htp-detail-hero-icon">
            <rule.Icon size={40} color={rule.color} />
          </div>
          <h1 className="htp-detail-title" style={{ color: rule.color, textShadow: `0 0 36px ${rule.color}40` }}>
            {rule.title}
          </h1>
          <div className="htp-detail-sub">{rule.shortDesc}</div>
          <div className="htp-detail-line" style={{ background: `linear-gradient(90deg, transparent, ${rule.color}, transparent)` }} />
        </div>

        <div className="htp-detail-body">
          <div className="htp-detail-section">
            <div className="htp-section-label">OVERVIEW</div>
            <p className="htp-section-text">{rule.overview}</p>
          </div>

          <div className="htp-detail-section">
            <div className="htp-section-label">DEEP DIVE</div>
            <p className="htp-section-text">{rule.deepDive}</p>
          </div>

          <div className="htp-detail-section">
            <div className="htp-section-label">KEY MECHANICS</div>
            <div className="htp-mechanics-grid">
              {rule.mechanics.map((m, idx) => (
                <div key={idx} className="htp-mech-item" style={{ borderColor: `${rule.color}30` }}>
                  <span className="htp-mech-num" style={{ color: rule.color }}>
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span className="htp-mech-text">{m}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="htp-tip-box" style={{ borderColor: `${rule.color}50`, background: `${rule.color}08` }}>
            <span className="htp-tip-label" style={{ color: rule.color }}>TACTICAL TIP</span>
            <p className="htp-tip-text">{rule.tip}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
