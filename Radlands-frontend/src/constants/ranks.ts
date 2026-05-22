export interface RankTier {
  tier: number
  name: string
  min: number
  max: number       /* Infinity for top tier */
  color: string
  description: string
}

export const RANKS: RankTier[] = [
  {
    tier: 1,  name: 'SURVIVOR',        min: 0,    max: 299,       color: '#808080',
    description: 'New to the wasteland. Survival is the only goal.',
  },
  {
    tier: 2,  name: 'SCAVENGER',       min: 300,  max: 549,       color: '#a08060',
    description: 'Picking through the ruins. Learning the basics of combat.',
  },
  {
    tier: 3,  name: 'WANDERER',        min: 550,  max: 799,       color: '#00e5ff',
    description: 'Moving through hostile territory. Developing tactical instincts.',
  },
  {
    tier: 4,  name: 'RAIDER',          min: 800,  max: 1049,      color: '#d4ff00',
    description: 'Taking what you need by force. A proven threat on the field.',
  },
  {
    tier: 5,  name: 'MARAUDER',        min: 1050, max: 1299,      color: '#ff6600',
    description: 'Striking hard and fast. Opponents fear your arrival.',
  },
  {
    tier: 6,  name: 'ENFORCER',        min: 1300, max: 1549,      color: '#ff0080',
    description: 'Enforcing the law of the wasteland by blade and fire.',
  },
  {
    tier: 7,  name: 'WARLORD',         min: 1550, max: 1799,      color: '#b700ff',
    description: 'Commanding entire factions. Strategy and power combined.',
  },
  {
    tier: 8,  name: 'OVERLORD',        min: 1800, max: 2099,      color: '#ff2200',
    description: 'Dominating vast territories. Few dare challenge you.',
  },
  {
    tier: 9,  name: 'DUNE MASTER',     min: 2100, max: 2399,      color: '#ffd700',
    description: 'Legendary across the wastelands. Your name brings silence.',
  },
  {
    tier: 10, name: 'APOCALYPSE LORD', min: 2400, max: Infinity,  color: '#ff0040',
    description: 'The apex of wasteland dominance. Unmatched, unchallenged, unstoppable.',
  },
]

/** Win: +28 pts · Loss: -18 pts */
export const WIN_DELTA  = 28
export const LOSS_DELTA = 18

export function getRankFromRating(rating: number): RankTier {
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (rating >= RANKS[i].min) return RANKS[i]
  }
  return RANKS[0]
}

/** Progress within current rank, 0–100 */
export function rankProgress(rating: number): number {
  const rank = getRankFromRating(rating)
  if (rank.max === Infinity) return 100
  const range = rank.max - rank.min
  return Math.min(100, Math.round(((rating - rank.min) / range) * 100))
}
