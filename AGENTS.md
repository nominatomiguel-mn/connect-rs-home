<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->


## Design — RS CONECT / Colégio Raios de Sol

Use these shared design tokens from `src/styles.css`; do not introduce one-off colors when a token or semantic utility exists.

- Primary navy: `#0B2A4A` (`--brand-navy`) for headings, navigation icons, and brand surfaces.
- Accent orange: `#F57C00` (`--brand-orange-bright`); accessible primary button orange: `#E65100` (`--brand-orange`).
- Soft orange: `#FFF1E0` (`--brand-orange-soft`) for icon tiles and light badges.
- White: `#FFFFFF`; page background: `#F6F8FB`; secondary text: `#5B6B7F`; borders: `#E3E8EF`.
- Status colors: open/pending orange, in progress blue `#2563EB`, resolved/approved green `#16A34A`, denied/urgent red `#DC2626`. Use pale badge backgrounds and readable dark text.
- Prefer white cards with subtle borders and `shadow-sm`; use restrained hover elevation. Inputs use an orange focus ring.
- Maintain existing font, labels, routes, behavior, responsive layout, roles, database, and RLS. Check mobile layout at 375px before release.
