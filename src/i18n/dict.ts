export const LANGS = ['en', 'th'] as const
export type Lang = (typeof LANGS)[number]

/**
 * Every user-visible string lives here. `en` is the source of truth — its keys
 * define the shape, and `th` must satisfy the same shape.
 */
const en = {
  'nav.home': 'Home',
  'nav.about': 'About',
  'nav.works': 'Works',
  'nav.sandbox': 'Sandbox',
  'nav.resume': 'Resume',
  'nav.openMenu': 'Open menu',
  'nav.langLabel': 'ภาษาไทย',

  'anchor.intro': 'Intro',
  'anchor.works': 'Works',
  'anchor.impact': 'Impact',
  'anchor.about': 'About',
  'anchor.contact': 'Contact',

  'hero.badge': 'Joe',
  'hero.turning': 'Turning',
  'hero.vision': 'Vision',
  'hero.into': 'into',
  'hero.experiences': '{Experiences}',
  'hero.subtitle':
    'I love crafting valuable things with passionate people to bringing design to a real-world impact solution.',

  'footer.credit': 'Designed & Built by {name} @{year} All Right Reserved.',
} as const

export type TranslationKey = keyof typeof en

const th: Record<TranslationKey, string> = {
  'nav.home': 'หน้าแรก',
  'nav.about': 'เกี่ยวกับ',
  'nav.works': 'ผลงาน',
  'nav.sandbox': 'แซนด์บ็อกซ์',
  'nav.resume': 'เรซูเม่',
  'nav.openMenu': 'เปิดเมนู',
  'nav.langLabel': 'English',

  'anchor.intro': 'แนะนำตัว',
  'anchor.works': 'ผลงาน',
  'anchor.impact': 'ผลลัพธ์',
  'anchor.about': 'เกี่ยวกับ',
  'anchor.contact': 'ติดต่อ',

  'hero.badge': 'โจ้',
  'hero.turning': 'เปลี่ยน',
  'hero.vision': 'Vision',
  'hero.into': 'ให้เป็น',
  'hero.experiences': '{Experiences}',
  'hero.subtitle':
    'ผมชอบสร้างสิ่งที่มีคุณค่าร่วมกับคนที่มี passion เพื่อเปลี่ยนงานออกแบบให้เป็นทางแก้ปัญหาที่ใช้ได้จริง',

  'footer.credit': 'ออกแบบและพัฒนาโดย {name} @{year} สงวนลิขสิทธิ์',
}

export const DICTS: Record<Lang, Record<TranslationKey, string>> = { en, th }
