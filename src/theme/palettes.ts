/**
 * The site's dark palettes.
 *
 * Every colour the page and the hero scene use lives here, so a theme is one
 * object rather than a hunt through components. `ui` values are written onto
 * the document as the Tailwind theme variables they shadow; `scene` values are
 * read directly by the 3D scene, which has no CSS to read.
 *
 * `daylight` is the design's own palette; the rest are dark alternates, where
 * the hero reads as a lit stage against something that is not.
 */
export type Palette = {
  id: string
  name: string
  /** One line on what the theme is going for, shown in the picker. */
  note: string
  ui: {
    paper: string
    panel: string
    ink: string
    inkMuted: string
    brand: string
    brandDark: string
    blue: string
    red: string
  }
  scene: {
    /** Six stops for the section's own backdrop, sky at the top down to ground. */
    sky: [string, string, string, string, string, string]
    /** Four stops for the parallax band that sits over it. */
    band: [string, string, string, string]
    /** Near edge, middle, far edge of the platform slab. */
    platform: [string, string, string]
    /** Grid ruled onto the slab. */
    grid: string
    /** The blueprint sheet's field. */
    blueprint: string
    /** Underside of the sheet, seen on the curl. */
    sheetBack: [string, string]
    /** Per-piece gradient, light corner to saturated corner. */
    pieces: [string, string][]
    /** One orb per piece. Index 2 is the one that comes down from the sky. */
    orbs: [string, string, string, string]
    /** Cast shadows on the sheet and on the pieces. */
    shadow: string
    /** The disc in the sky: full for a sun, bitten into for a crescent moon. */
    celestial: 'sun' | 'moon'
    moon: string
    moonGlow: string
  }
}

export const PALETTES: Palette[] = [
  {
    id: 'daylight',
    name: 'Daylight',
    note: 'The design as drawn — blue sky over a rose horizon',
    ui: {
      paper: '#f7fbff',
      panel: '#ffffff',
      ink: '#1b2559',
      inkMuted: '#5a6a8a',
      brand: '#2563eb',
      brandDark: '#1d4ed8',
      blue: '#2563eb',
      red: '#f2607f',
    },
    scene: {
      sky: ['#4FA3F7', '#7FC2F9', '#BFE0FB', '#E8E6F7', '#F7DDE6', '#FDF3F6'],
      band: ['#4FA3F7', '#7FC2F9', '#BFE0FB', '#E8E6F7'],
      platform: ['#D6E8FA', '#E9F3FD', '#F8FCFF'],
      grid: 'rgba(255,255,255,0.9)',
      blueprint: '#3B82F6',
      sheetBack: ['#7FE3F5', '#38BDF8'],
      pieces: [
        ['#FFFFFF', '#5FD9C9'],
        ['#FFF6C2', '#FFD84D'],
        ['#FFC7D8', '#F87FA0'],
        ['#EAF7A8', '#B7E06B'],
      ],
      orbs: ['#2B7FFF', '#A3E635', '#8B5CF6', '#F472B6'],
      shadow: '#1B3C6B',
      celestial: 'sun',
      moon: '#FFFCEC',
      moonGlow: '#FFFBE6',
    },
  },
  {
    id: 'blurple-night',
    name: 'Blurple Night',
    note: "Discord's blurple over its darkest surface",
    ui: {
      paper: '#1e1f22',
      panel: '#2b2d31',
      ink: '#f2f3f5',
      inkMuted: '#b5bac1',
      brand: '#5865f2',
      brandDark: '#4752c4',
      blue: '#404eed',
      red: '#ed4245',
    },
    scene: {
      sky: ['#404EED', '#3A3E9E', '#2B2D5E', '#242637', '#1E1F22', '#1E1F22'],
      band: ['#404EED', '#3A3E9E', '#2B2D5E', '#242637'],
      platform: ['#3C43B4', '#2C2F5E', '#1E1F22'],
      grid: 'rgba(255,255,255,0.14)',
      blueprint: '#2B2F7A',
      sheetBack: ['#5865F2', '#3C43B4'],
      // One cool, near-neutral family in four values: the finished picture
      // reads as a single lit surface split into quadrants rather than four
      // unrelated cards. Deliberately off the blurple the rest of the scene is
      // built on, so the orbs — blurple included — stay the only saturated
      // colour anywhere and keep their lead.
      pieces: [
        ['#F2F4FB', '#C6CEE4'],
        ['#E7EBF6', '#AEB8D6'],
        ['#DDE2F1', '#9BA7CA'],
        ['#D2D8EC', '#8B98BE'],
      ],
      orbs: ['#00A8FC', '#57F287', '#5865F2', '#FEE75C'],
      shadow: '#0B0C10',
      celestial: 'moon',
      moon: '#EEF1FF',
      moonGlow: '#D7DEFF',
    },
  },
  {
    id: 'deep-teal',
    name: 'Deep Teal',
    note: 'Cold water at night, lit by a mint moon',
    ui: {
      paper: '#0f1a1c',
      panel: '#16262a',
      ink: '#e8f4f2',
      inkMuted: '#8fabab',
      brand: '#2dd4bf',
      brandDark: '#14a99a',
      blue: '#22d3ee',
      red: '#fb7185',
    },
    scene: {
      sky: ['#0E7C7B', '#0B5E60', '#0A4145', '#0B2C31', '#0F1A1C', '#0F1A1C'],
      band: ['#0E7C7B', '#0B5E60', '#0A4145', '#0B2C31'],
      platform: ['#12706E', '#0D3E42', '#0F1A1C'],
      grid: 'rgba(190,255,247,0.14)',
      blueprint: '#0C4F52',
      sheetBack: ['#2DD4BF', '#0E7C7B'],
      pieces: [
        ['#FFFFFF', '#9CF6E4'],
        ['#FFF7D6', '#FCD34D'],
        ['#FFD9E7', '#F472B6'],
        ['#DDF3F1', '#5EEAD4'],
      ],
      orbs: ['#38BDF8', '#34D399', '#2DD4BF', '#FCD34D'],
      shadow: '#05191B',
      celestial: 'moon',
      moon: '#E6FFFA',
      moonGlow: '#9CF6E4',
    },
  },
  {
    id: 'ember',
    name: 'Ember',
    note: 'The old orange brand, kept as firelight on charcoal',
    ui: {
      paper: '#191614',
      panel: '#26211d',
      ink: '#f7f0ea',
      inkMuted: '#b3a79d',
      brand: '#fd5000',
      brandDark: '#c93f00',
      blue: '#ffa53d',
      red: '#ef4444',
    },
    scene: {
      sky: ['#B23A00', '#8A2F06', '#5A2510', '#331A14', '#191614', '#191614'],
      band: ['#B23A00', '#8A2F06', '#5A2510', '#331A14'],
      platform: ['#93380B', '#4A2312', '#191614'],
      grid: 'rgba(255,225,205,0.13)',
      blueprint: '#5E2A12',
      sheetBack: ['#FD8A3D', '#C93F00'],
      pieces: [
        ['#FFFFFF', '#FFC48A'],
        ['#FFF3D1', '#FFB020'],
        ['#FFD8CC', '#FF7A59'],
        ['#F6E4D8', '#E2703A'],
      ],
      orbs: ['#FFB020', '#FF7A59', '#FD5000', '#FFD98A'],
      shadow: '#120C08',
      celestial: 'moon',
      moon: '#FFF3E4',
      moonGlow: '#FFC48A',
    },
  },
  {
    id: 'neon-violet',
    name: 'Neon Violet',
    note: 'Synth night — magenta on near-black',
    ui: {
      paper: '#120c1c',
      panel: '#1e1430',
      ink: '#f5edff',
      inkMuted: '#a99bc4',
      brand: '#a855f7',
      brandDark: '#7e22ce',
      blue: '#38bdf8',
      red: '#f43f5e',
    },
    scene: {
      sky: ['#6D28D9', '#4C1D95', '#331367', '#20103C', '#120C1C', '#120C1C'],
      band: ['#6D28D9', '#4C1D95', '#331367', '#20103C'],
      platform: ['#5B21B6', '#2C1358', '#120C1C'],
      grid: 'rgba(240,220,255,0.14)',
      blueprint: '#3B1A85',
      sheetBack: ['#C084FC', '#7E22CE'],
      pieces: [
        ['#FFFFFF', '#C4B5FD'],
        ['#FFF0FB', '#F0ABFC'],
        ['#FFD9EC', '#F472B6'],
        ['#E0E7FF', '#818CF8'],
      ],
      orbs: ['#38BDF8', '#F0ABFC', '#A855F7', '#FDE68A'],
      shadow: '#0A0614',
      celestial: 'moon',
      moon: '#F8EEFF',
      moonGlow: '#D8B4FE',
    },
  },
  {
    id: 'forest',
    name: 'Forest',
    note: 'Moss and moonlight, the quietest of the set',
    ui: {
      paper: '#101a13',
      panel: '#18261c',
      ink: '#eaf4ec',
      inkMuted: '#9ab3a1',
      brand: '#4ade80',
      brandDark: '#22a75a',
      blue: '#67e8f9',
      red: '#fb7185',
    },
    scene: {
      sky: ['#166534', '#14532D', '#123D24', '#12281A', '#101A13', '#101A13'],
      band: ['#166534', '#14532D', '#123D24', '#12281A'],
      platform: ['#15803D', '#123A24', '#101A13'],
      grid: 'rgba(220,255,230,0.13)',
      blueprint: '#14512F',
      sheetBack: ['#86EFAC', '#22A75A'],
      pieces: [
        ['#FFFFFF', '#BBF7D0'],
        ['#FBFFE0', '#D9F99D'],
        ['#FFE9D6', '#FDBA74'],
        ['#DFF5EE', '#6EE7B7'],
      ],
      orbs: ['#67E8F9', '#A3E635', '#4ADE80', '#FDE68A'],
      shadow: '#06120A',
      celestial: 'moon',
      moon: '#F0FFF4',
      moonGlow: '#BBF7D0',
    },
  },
  {
    id: 'slate-ice',
    name: 'Slate Ice',
    note: 'Neutral greys with one cold blue doing the work',
    ui: {
      paper: '#14171c',
      panel: '#1e232b',
      ink: '#eef1f6',
      inkMuted: '#a4adbb',
      brand: '#38bdf8',
      brandDark: '#0284c7',
      blue: '#60a5fa',
      red: '#f87171',
    },
    scene: {
      sky: ['#1E5F8C', '#1B4A6B', '#1A3648', '#17252F', '#14171C', '#14171C'],
      band: ['#1E5F8C', '#1B4A6B', '#1A3648', '#17252F'],
      platform: ['#22648F', '#1A3140', '#14171C'],
      grid: 'rgba(226,240,255,0.14)',
      blueprint: '#1C4763',
      sheetBack: ['#7DD3FC', '#0284C7'],
      pieces: [
        ['#FFFFFF', '#BAE6FD'],
        ['#FFF8DE', '#FCD34D'],
        ['#FFDCE4', '#FB7185'],
        ['#E4EAF2', '#94A3B8'],
      ],
      orbs: ['#38BDF8', '#7DD3FC', '#60A5FA', '#FCD34D'],
      shadow: '#080B10',
      celestial: 'moon',
      moon: '#F0F7FF',
      moonGlow: '#BAE6FD',
    },
  },
]

export const DEFAULT_PALETTE_ID = PALETTES[0].id

export function paletteById(id: string): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0]
}
