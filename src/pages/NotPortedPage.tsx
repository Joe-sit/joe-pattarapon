import { Link } from 'react-router'

/**
 * Placeholder for routes whose Vue pages have not been ported to the React
 * build yet. Deliberately states the real status instead of inventing content.
 */
export function NotPortedPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-screen-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-3xl font-medium text-ink">Not ported yet</p>
      <p className="max-w-prose text-sm text-ink-muted">
        This page still lives in the Vue build. It has not been rebuilt in React yet.
      </p>
      <Link
        to="/"
        className="rounded-full bg-brand-orange px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-orange-dark"
      >
        Back home
      </Link>
    </div>
  )
}
