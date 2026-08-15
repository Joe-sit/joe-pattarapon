# joe-pattarapon

Portfolio site. React 19 + TypeScript + Vite, Tailwind v4, react-router. The 3D
work is r3f (`@react-three/fiber` 9) on three 0.182 with `@react-three/drei` 10.

## 3D work: read the skills first

**Before writing or editing any three.js / r3f code, load `three-best-practices`
and `r3f-best-practices`.** Not optional, and not only for work that sounds like
performance work — the rules cover geometry, materials, disposal, loading and
frame loops, which is most of what a change to this scene touches.

Both are installed in this repo:

    .agents/skills/three-best-practices/    SKILL.md + rules/
    .agents/skills/r3f-best-practices/      SKILL.md + rules/

Prefer the `Skill` tool when they appear in the session's skill listing. When
they do not — the listing is fixed when a session starts, so a fresh install is
invisible until the next one — read the files directly instead. `SKILL.md` is an
index; the rule files under `rules/` are the actual content, so read the ones the
task touches rather than the index alone.

Installed with `npx skills add emalorenzo/three-agent-skills`; `npx skills list`
shows what is present and which agents can see it.

## Checks

Run both after any edit:

    npm run typecheck     # tsc -b
    npm run lint          # oxlint src

`npm run dev` serves over **HTTPS** at https://localhost:5173.

## House rules

- **No fake data.** No hardcoded, mock or placeholder values standing in for
  something real — an empty state is honest, invented numbers are not.
- **Secrets** live in `.env.local`, which is gitignored. Never anywhere else.
- **Commit and push only when asked.** Branch off `main` first.
- **Dev-only tools** — debug panels, part pickers, export buttons — are gated
  behind `import.meta.env.DEV`.
- **Anything clickable** gets `cursor: pointer`.
- **Money**: interest and tax to 2 decimals, principal whole.
- Judge a visual change on the real screen, not by reasoning about the diff.

## Layout

    src/sections/mascot/     the parametric mascot, built in code (TSX)
    src/joespresso/          the /joespresso 3D scene (JSX), its own layout
    public/models/           bought GLBs — chair, desk, laptop
