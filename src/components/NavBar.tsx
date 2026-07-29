import { useState } from 'react'
import { NavLink, Link } from 'react-router'
import { Logo } from './Logo'
import { SITE } from '@/config/site'
import { useT, useLang, setLang } from '@/i18n/store'
import type { TranslationKey } from '@/i18n/dict'
import MenuIcon from '@/assets/menu.svg?react'

const NAV_LINKS: { key: TranslationKey; to: string }[] = [
  { key: 'nav.home', to: '/' },
  { key: 'nav.about', to: '/about' },
  { key: 'nav.works', to: '/portfolio' },
  { key: 'nav.sandbox', to: '/playground' },
]

const PILL = 'flex h-[34px] items-center justify-center rounded-full px-4 text-sm font-medium'

export function NavBar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const t = useT()
  const lang = useLang()

  return (
    <nav
      className="fixed inset-x-0 top-0 z-50 flex h-20 items-center justify-between px-16 py-6 backdrop-blur-[2px]"
      style={{
        background:
          'linear-gradient(180deg, rgba(255,244,223,0.5) 0%, rgba(255,255,255,0) 100%)',
      }}
    >
      <Link to="/" className="shrink-0">
        <Logo />
      </Link>

      {/* Center nav links (desktop) */}
      <div className="hidden items-center gap-[5px] md:flex">
        {NAV_LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/'}
            className={({ isActive }) =>
              `${PILL} min-w-20 transition-all duration-200 ${
                isActive ? 'bg-brand-orange text-white' : 'text-ink hover:bg-black/5'
              }`
            }
          >
            {t(link.key)}
          </NavLink>
        ))}
      </div>

      {/* Right: language toggle + resume + mobile hamburger */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setLang(lang === 'en' ? 'th' : 'en')}
          className={`${PILL} hidden text-ink transition hover:bg-black/5 md:flex`}
        >
          {t('nav.langLabel')}
        </button>

        <a
          href={SITE.resumeUrl}
          target="_blank"
          rel="noreferrer"
          className={`${PILL} hidden w-[85px] bg-brand-orange text-white transition-colors duration-200 hover:bg-brand-orange-dark md:flex`}
        >
          {t('nav.resume')}
        </a>

        <button
          type="button"
          onClick={() => setIsMenuOpen((open) => !open)}
          aria-label={t('nav.openMenu')}
          aria-expanded={isMenuOpen}
          className="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-black/5 md:hidden"
        >
          <MenuIcon />
        </button>
      </div>

      {/* Mobile dropdown */}
      {isMenuOpen && (
        <div className="absolute inset-x-0 top-full mt-px border-b border-black/5 bg-paper shadow-lg md:hidden">
          <ul className="flex flex-col gap-1 px-4 py-2">
            {NAV_LINKS.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  end={link.to === '/'}
                  onClick={() => setIsMenuOpen(false)}
                  className={({ isActive }) =>
                    `block rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                      isActive ? 'bg-brand-orange text-white' : 'text-black/60 hover:bg-black/5'
                    }`
                  }
                >
                  {t(link.key)}
                </NavLink>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => {
                  setLang(lang === 'en' ? 'th' : 'en')
                  setIsMenuOpen(false)
                }}
                className="block w-full rounded-xl px-4 py-2 text-left text-sm font-medium text-black/60 transition-colors hover:bg-black/5"
              >
                {t('nav.langLabel')}
              </button>
            </li>
            <li>
              <a
                href={SITE.resumeUrl}
                target="_blank"
                rel="noreferrer"
                className="block rounded-xl px-4 py-2 text-sm font-medium text-brand-orange"
              >
                {t('nav.resume')}
              </a>
            </li>
          </ul>
        </div>
      )}
    </nav>
  )
}
