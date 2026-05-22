/* Shared SVG icon set — no emojis, consistent 24×24 viewBox, stroke-based */
type IP = { size?: number; color?: string; className?: string }

function Svg({ size = 20, color = 'currentColor', className, children }: IP & { children: React.ReactNode }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke={color} strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  )
}

export function IconSword({ size, color, className }: IP) {
  return (
    <Svg size={size} color={color} className={className}>
      <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
      <line x1="13" y1="19" x2="19" y2="13" />
      <line x1="16" y1="16" x2="20" y2="20" />
      <line x1="19" y1="21" x2="21" y2="19" />
    </Svg>
  )
}

export function IconSwords({ size, color, className }: IP) {
  return (
    <Svg size={size} color={color} className={className}>
      <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
      <line x1="13" y1="19" x2="19" y2="13" />
      <line x1="16" y1="16" x2="20" y2="20" />
      <line x1="19" y1="21" x2="21" y2="19" />
      <polyline points="9.5 6.5 21 18 21 21 18 21 6.5 9.5" />
      <line x1="11" y1="5" x2="5" y2="11" />
      <line x1="8" y1="8" x2="4" y2="4" />
      <line x1="5" y1="5" x2="3" y2="3" />
    </Svg>
  )
}

export function IconBookOpen({ size, color, className }: IP) {
  return (
    <Svg size={size} color={color} className={className}>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </Svg>
  )
}

export function IconUsers({ size, color, className }: IP) {
  return (
    <Svg size={size} color={color} className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  )
}

export function IconHelpCircle({ size, color, className }: IP) {
  return (
    <Svg size={size} color={color} className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </Svg>
  )
}

export function IconUser({ size, color, className }: IP) {
  return (
    <Svg size={size} color={color} className={className}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </Svg>
  )
}

export function IconTrophy({ size, color, className }: IP) {
  return (
    <Svg size={size} color={color} className={className}>
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <path d="M7 4h10v8a5 5 0 0 1-10 0V4z" />
      <path d="M17 7h2a2 2 0 0 1 0 4h-2" />
      <path d="M7 7H5a2 2 0 0 0 0 4h2" />
    </Svg>
  )
}

export function IconTarget({ size, color, className }: IP) {
  return (
    <Svg size={size} color={color} className={className}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </Svg>
  )
}

export function IconFlame({ size, color, className }: IP) {
  return (
    <Svg size={size} color={color} className={className}>
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3z" />
    </Svg>
  )
}

export function IconZap({ size, color, className }: IP) {
  return (
    <Svg size={size} color={color} className={className}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </Svg>
  )
}

export function IconClock({ size, color, className }: IP) {
  return (
    <Svg size={size} color={color} className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </Svg>
  )
}

export function IconCheck({ size, color, className }: IP) {
  return (
    <Svg size={size} color={color} className={className}>
      <polyline points="20 6 9 17 4 12" />
    </Svg>
  )
}

export function IconX({ size, color, className }: IP) {
  return (
    <Svg size={size} color={color} className={className}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </Svg>
  )
}

export function IconSend({ size, color, className }: IP) {
  return (
    <Svg size={size} color={color} className={className}>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </Svg>
  )
}

export function IconPlus({ size, color, className }: IP) {
  return (
    <Svg size={size} color={color} className={className}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </Svg>
  )
}

export function IconShield({ size, color, className }: IP) {
  return (
    <Svg size={size} color={color} className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </Svg>
  )
}

export function IconChevronLeft({ size, color, className }: IP) {
  return (
    <Svg size={size} color={color} className={className}>
      <polyline points="15 18 9 12 15 6" />
    </Svg>
  )
}

export function IconStar({ size, color, className }: IP) {
  return (
    <Svg size={size} color={color} className={className}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </Svg>
  )
}

export function IconBarChart({ size, color, className }: IP) {
  return (
    <Svg size={size} color={color} className={className}>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
      <line x1="2" y1="20" x2="22" y2="20" />
    </Svg>
  )
}

export function IconInbox({ size, color, className }: IP) {
  return (
    <Svg size={size} color={color} className={className}>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </Svg>
  )
}

export function IconCalendar({ size, color, className }: IP) {
  return (
    <Svg size={size} color={color} className={className}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </Svg>
  )
}

export function IconSearch({ size, color, className }: IP) {
  return (
    <Svg size={size} color={color} className={className}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </Svg>
  )
}

export function IconDroplet({ size, color, className }: IP) {
  return (
    <Svg size={size} color={color} className={className}>
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
    </Svg>
  )
}

export function IconRefresh({ size, color, className }: IP) {
  return (
    <Svg size={size} color={color} className={className}>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </Svg>
  )
}

export function IconAward({ size, color, className }: IP) {
  return (
    <Svg size={size} color={color} className={className}>
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
    </Svg>
  )
}

export function IconMap({ size, color, className }: IP) {
  return (
    <Svg size={size} color={color} className={className}>
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </Svg>
  )
}
