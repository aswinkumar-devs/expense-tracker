# Project memory

## Product intent & audience

- Personal daily expense tracker; user logs expenses per day, broken down by route
- Currency is rupees (₹); monthly budget tracking with over/under status
- Month archiving/history with entry counts and totals
- Primary usage is on mobile; UI must be optimized for one-handed phone use

## Brand personality & voice

- Practical, utility-first, no-nonsense personal finance tool
- Clear and direct labels; informative over decorative

## Visual design & UX direction

- Vite + React, JSX, Tailwind CSS, Lucide React icons only — no extra UI/theme packages
- Mobile-first: large touch targets, safe-area padding for notched devices, thin scrollbars
- Floating action button (bottom-right, round "+") for quick entry navigation
- Action buttons rendered as horizontally scrollable chips on mobile instead of stacked/wrapped
- Charts: bar chart with fixed-height container (bug root cause was percentage-height bars in heightless parent); amber highlight for today's bar; percentage labels; footer summary (highest day, daily average)
- Budget progress bar: colored fill, red when over budget, "X left" / "X over" text
- Month history cards show entry count, total, and delete option with confirmation; current month protected from deletion

## Decisions, constraints & rationale

- Chart height fix: container must have explicit height for percentage-height bars to render
- Repeat-last-entry feature copies most recent day's amounts to reduce repetitive logging taps
- Delete archived months added to prevent unbounded history growth; current month excluded
- Data persistence via localStorage (inferred from storage handler wiring)
- CSV export and column management are existing features kept intact

## Open questions & assumptions

- Visual verification only done at code/build level; real-device visual check still needed, especially chart and FAB
- Route-based breakdown implies delivery/gig-worker context but not confirmed
- No backend sync; data assumed local-only