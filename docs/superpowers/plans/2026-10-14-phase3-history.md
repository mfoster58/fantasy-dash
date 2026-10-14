# Phase 3: League History and Season Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the League History page (one row per season: champion, runner-up, points title, last place) and the Season Review page (honors, final standings, playoff and consolation brackets with scores, round 1 of the draft, season records), plus the draft data the review and Phase 4 need.

**Architecture:** `packages/core` learns Sleeper drafts (`Draft`/`DraftPick` on `Season`, no value math yet) and exposes each season's honors in `history.json`. `scripts/sync.ts` fetches drafts and picks. The web app gets `/history` and `/history/:season`, a narrow-screen nav menu (required before adding a fifth link), and loader cache recovery. Season records are derived in the web app from `standings`.

**Tech Stack:** unchanged (TypeScript strict, Vitest, zod 3, Vite 6, React 19, react-router 7, Tailwind 4).

**Spec:** `docs/superpowers/specs/2026-10-14-fantasy-dashboard-design.md`, "Views" Phase 3, "Data model" (`Draft`), "Bracket resolution".

## Global Constraints

- Managers keyed by Sleeper `user_id`. A draft pick's manager is `picked_by` when present, else the roster owner.
- Draft `slotOrder` comes from Sleeper `draft_order` (user id to slot) when present, else from round-1 picks (slot to picker).
- Keepers are flagged from Sleeper `is_keeper` (true only when the flag is true).
- Honors per season are the existing `Season.honors` (null while in season).
- Records block definitions: most points = max PF; best PPG = max PPG; best record = max Win% with PF as tiebreak; best all-play = max all-play pct; most weekly highs = max weeklyHighs. All from regular-season `standings`.
- Bracket games link to their box score via `gameId` (`/scores/{year}/{week}/{matchupId}`); unresolved games show "TBD".
- The `/draft/:season` route does not exist yet (Phase 4). The round-1 board renders without a link; Phase 4 adds it.
- Points rounded to 2 decimals; ratios 0 to 1 with 4 decimals.
- UI tokens and shared components stay: `.card`, `.section-label`, `.num`, `.pos-pill`, `Avatar`, `Headshot`, `PosPill`, `StandingsTable`, `fmt*`.
- Every commit message ends with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Work on branch `phase-3`; do not push during tasks.

## File Structure

```
packages/core/src/types.ts            # Draft, DraftPick, Season.draft, HistorySeason.honors
packages/core/src/sleeper/types.ts    # SleeperDraft, SleeperDraftPick
packages/core/src/sleeper/client.ts   # getDrafts, getDraftPicks
packages/core/src/draft.ts            # buildDraft()
packages/core/src/season.ts           # RawSeasonInput.draft, Season.draft
packages/core/src/players.ts          # collectPlayerIds includes draft picks
packages/core/src/history.ts          # HistorySeason.honors
packages/core/src/schema.ts           # Draft schema; honors on seasons
packages/core/test/draft.test.ts, test/fixtures/mini.ts (adds a draft), history.test.ts
scripts/sync.ts                       # fetch drafts + picks
data/                                 # regenerated
packages/web/src/components/Nav.tsx (+ Nav.test.tsx)   # narrow menu
packages/web/src/data/load.ts         # cache recovery
packages/web/src/lib/records.ts (+ .test.ts)
packages/web/src/pages/HistoryPage.tsx
packages/web/src/pages/SeasonReviewPage.tsx
packages/web/src/components/history/HonorsStrip.tsx
packages/web/src/components/history/Bracket.tsx (+ .test.tsx)
packages/web/src/components/history/DraftRoundOne.tsx
packages/web/src/components/history/RecordsBlock.tsx
packages/web/src/App.tsx              # routes
docs/superpowers/specs/...design.md   # data model: Draft shape, HistorySeason.honors, records derived in web
```

---

### Task 1: Draft types, builder, and honors in history (core)

**Files:**
- Modify: `packages/core/src/types.ts`, `packages/core/src/sleeper/types.ts`, `packages/core/src/sleeper/client.ts`, `packages/core/src/season.ts`, `packages/core/src/players.ts`, `packages/core/src/history.ts`, `packages/core/src/schema.ts`, `packages/core/src/index.ts`, `packages/core/test/fixtures/mini.ts`
- Create: `packages/core/src/draft.ts`
- Test: `packages/core/test/draft.test.ts`, `packages/core/test/history.test.ts`, `packages/core/test/players.test.ts`, `packages/core/test/client.test.ts`

**Interfaces:**
```ts
// types.ts
export interface DraftPick { round: number; pickNo: number; slot: number; userId: UserId; playerId: PlayerId; isKeeper: boolean }
export interface Draft { draftId: string; type: string; rounds: number; slotOrder: UserId[]; picks: DraftPick[] }
// Season gains: draft: Draft | null
// HistorySeason gains: honors: Honors
// sleeper/types.ts
export interface SleeperDraft { draft_id: string; type: string; status: string; settings: { rounds: number; teams: number; [k: string]: unknown }; draft_order: Record<string, number> | null; slot_to_roster_id: Record<string, number> | null }
export interface SleeperDraftPick { round: number; pick_no: number; draft_slot: number; roster_id: number | null; picked_by: string | null; player_id: string; is_keeper: boolean | null }
// draft.ts
export function buildDraft(draft: SleeperDraft, picks: SleeperDraftPick[], rosterToUser: Record<number, UserId>): Draft
// season.ts: RawSeasonInput gains `draft: { draft: SleeperDraft; picks: SleeperDraftPick[] } | null`
// client.ts: getDrafts(leagueId): Promise<SleeperDraft[] | null>; getDraftPicks(draftId): Promise<SleeperDraftPick[] | null>
```

- [ ] **Step 1: Failing tests**

`packages/core/test/draft.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildDraft } from '../src/draft';
import type { SleeperDraft, SleeperDraftPick } from '../src/sleeper/types';

const rosterToUser = { 1: 'ua', 2: 'ub', 3: 'uc' };
const draft: SleeperDraft = {
  draft_id: 'D1', type: 'snake', status: 'complete',
  settings: { rounds: 2, teams: 3 },
  draft_order: { ub: 1, uc: 2, ua: 3 },
  slot_to_roster_id: null,
};
const pick = (round: number, pick_no: number, draft_slot: number, roster_id: number, player_id: string, extra: Partial<SleeperDraftPick> = {}): SleeperDraftPick =>
  ({ round, pick_no, draft_slot, roster_id, picked_by: rosterToUser[roster_id as 1 | 2 | 3], player_id, is_keeper: null, ...extra });
const picks: SleeperDraftPick[] = [
  pick(1, 1, 1, 2, 'p1'), pick(1, 2, 2, 3, 'p2'), pick(1, 3, 3, 1, 'p3', { is_keeper: true }),
  pick(2, 4, 3, 1, 'p4'), pick(2, 5, 2, 3, 'p5'), pick(2, 6, 1, 2, 'p6', { picked_by: null }),
];

describe('buildDraft', () => {
  it('normalizes picks in pick order with keeper flags', () => {
    const d = buildDraft(draft, picks, rosterToUser);
    expect(d).toMatchObject({ draftId: 'D1', type: 'snake', rounds: 2 });
    expect(d.picks.map((p) => p.pickNo)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(d.picks[2]).toEqual({ round: 1, pickNo: 3, slot: 3, userId: 'ua', playerId: 'p3', isKeeper: true });
    expect(d.picks[0].isKeeper).toBe(false);
  });

  it('uses draft_order for the slot order', () => {
    expect(buildDraft(draft, picks, rosterToUser).slotOrder).toEqual(['ub', 'uc', 'ua']);
  });

  it('falls back to round-1 picks for the slot order and to the roster owner for the picker', () => {
    const d = buildDraft({ ...draft, draft_order: null }, picks, rosterToUser);
    expect(d.slotOrder).toEqual(['ub', 'uc', 'ua']);
    expect(d.picks[5].userId).toBe('ub');
  });
});
```

Append to `packages/core/test/history.test.ts` (inside the first `describe('buildHistory')`):
```ts
  it('carries each season\'s honors', () => {
    expect(history.seasons[0].honors).toEqual({ champion: null, runnerUp: null, third: null, pointsTitle: 'uc', lastPlace: null });
  });
```

Append to `packages/core/test/players.test.ts` `collectPlayerIds` describe:
```ts
  it('includes draft picks', () => {
    const season = { weeks: [], draft: { picks: [{ playerId: 'd1' }, { playerId: 'd2' }] } } as unknown as Season;
    expect([...collectPlayerIds([season])].sort()).toEqual(['d1', 'd2']);
  });
```

Append to `packages/core/test/client.test.ts` describe:
```ts
  it('uses the draft paths', async () => {
    const fetchFn = vi.fn(async (_url: string | URL | Request) => response(200, []));
    const client = new SleeperClient({ fetchFn, minIntervalMs: 0 });
    await client.getDrafts('L1');
    await client.getDraftPicks('D1');
    expect(fetchFn.mock.calls.map((c) => c[0])).toEqual([
      'https://api.sleeper.app/v1/league/L1/drafts',
      'https://api.sleeper.app/v1/draft/D1/picks',
    ]);
  });
```

Update `packages/core/test/fixtures/mini.ts`: add to the returned `RawSeasonInput` a two-round snake draft so `buildSeason` output carries one:
```ts
    draft: {
      draft: { draft_id: 'DM', type: 'snake', status: 'complete', settings: { rounds: 2, teams: 4 }, draft_order: { ua: 1, ub: 2, uc: 3, ud: 4 }, slot_to_roster_id: null },
      picks: [
        { round: 1, pick_no: 1, draft_slot: 1, roster_id: 1, picked_by: 'ua', player_id: 'q1', is_keeper: null },
        { round: 1, pick_no: 2, draft_slot: 2, roster_id: 2, picked_by: 'ub', player_id: 'q2', is_keeper: null },
        { round: 1, pick_no: 3, draft_slot: 3, roster_id: 3, picked_by: 'uc', player_id: 'q3', is_keeper: true },
        { round: 1, pick_no: 4, draft_slot: 4, roster_id: 4, picked_by: 'ud', player_id: 'q4', is_keeper: null },
        { round: 2, pick_no: 5, draft_slot: 4, roster_id: 4, picked_by: 'ud', player_id: 'r4', is_keeper: null },
        { round: 2, pick_no: 6, draft_slot: 3, roster_id: 3, picked_by: 'uc', player_id: 'r3', is_keeper: null },
        { round: 2, pick_no: 7, draft_slot: 2, roster_id: 2, picked_by: 'ub', player_id: 'r2', is_keeper: null },
        { round: 2, pick_no: 8, draft_slot: 1, roster_id: 1, picked_by: 'ua', player_id: 'r1', is_keeper: null },
      ],
    },
```
and in `packages/core/test/season.test.ts` add inside the main describe:
```ts
  it('carries the normalized draft', () => {
    expect(season.draft).toMatchObject({ draftId: 'DM', rounds: 2, slotOrder: ['ua', 'ub', 'uc', 'ud'] });
    expect(season.draft?.picks).toHaveLength(8);
    expect(season.draft?.picks[2]).toMatchObject({ userId: 'uc', playerId: 'q3', isKeeper: true });
  });
```
The oracle test (`test/oracle.test.ts`) builds seasons from recorded fixtures without a draft; its `load()` must add `draft: null`.

- [ ] **Step 2: Run, expect failures**

```bash
pnpm --filter @fantasy-dash/core test
```
Expected: FAIL on the new draft tests (module missing), history honors, players draft ids, client paths, season draft; typecheck also fails until `RawSeasonInput` has `draft`.

- [ ] **Step 3: Implement**

`packages/core/src/sleeper/types.ts`: add `SleeperDraft` and `SleeperDraftPick` as in Interfaces.

`packages/core/src/sleeper/client.ts`: add
```ts
  getDrafts(leagueId: string) { return this.get<SleeperDraft[]>(`/league/${leagueId}/drafts`); }
  getDraftPicks(draftId: string) { return this.get<SleeperDraftPick[]>(`/draft/${draftId}/picks`); }
```
(and import the two types).

`packages/core/src/types.ts`: add `DraftPick`, `Draft`; add `draft: Draft | null;` to `Season` (after `honors`); add `honors: Honors;` to `HistorySeason`.

`packages/core/src/draft.ts`:
```ts
import type { Draft, DraftPick, UserId } from './types';
import type { SleeperDraft, SleeperDraftPick } from './sleeper/types';

/** Normalize a Sleeper draft. Pickers come from `picked_by`, else the roster owner. */
export function buildDraft(draft: SleeperDraft, rawPicks: SleeperDraftPick[], rosterToUser: Record<number, UserId>): Draft {
  const pickerOf = (p: SleeperDraftPick): UserId =>
    p.picked_by ?? (p.roster_id != null ? rosterToUser[p.roster_id] ?? `roster-${p.roster_id}` : 'unknown');

  const picks: DraftPick[] = [...rawPicks]
    .sort((a, b) => a.pick_no - b.pick_no)
    .map((p) => ({ round: p.round, pickNo: p.pick_no, slot: p.draft_slot, userId: pickerOf(p), playerId: p.player_id, isKeeper: p.is_keeper === true }));

  let slotOrder: UserId[];
  if (draft.draft_order && Object.keys(draft.draft_order).length > 0) {
    slotOrder = Object.entries(draft.draft_order).sort((a, b) => a[1] - b[1]).map(([userId]) => userId);
  } else {
    slotOrder = picks.filter((p) => p.round === 1).sort((a, b) => a.slot - b.slot).map((p) => p.userId);
  }

  return { draftId: draft.draft_id, type: draft.type, rounds: draft.settings.rounds, slotOrder, picks };
}
```

`packages/core/src/season.ts`: add `draft: { draft: SleeperDraft; picks: SleeperDraftPick[] } | null;` to `RawSeasonInput` (import the types), and in `buildSeason` compute `const draft = input.draft ? buildDraft(input.draft.draft, input.draft.picks, rosterToUser) : null;` and return `draft` after `honors`.

`packages/core/src/players.ts`: in `collectPlayerIds`, after the weeks loop add `for (const p of s.draft?.picks ?? []) ids.add(p.playerId);`.

`packages/core/src/history.ts`: in the `seasons` map add `honors: s.honors`.

`packages/core/src/schema.ts`: add `DraftPick` and `Draft` object schemas mirroring the types, `draft: Draft.nullable()` to `SeasonSchema`, and `honors: Honors` to the seasons entry of `HistorySchema` (the `Honors` schema already exists for `SeasonSchema`; hoist it if it is inline). The `satisfies` guards must compile.

`packages/core/src/index.ts`: `export * from './draft';`.

Update `test/oracle.test.ts` `load()` to return `{ ...raw, projections: {}, stats: {}, players: {}, draft: null }`.

- [ ] **Step 4: Run, expect pass**

```bash
pnpm --filter @fantasy-dash/core test && pnpm --filter @fantasy-dash/core typecheck
```
Expected: 75 + 7 = 82 tests pass; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add packages/core && git commit -m "feat(core): normalize Sleeper drafts and carry season honors in history

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Sync fetches drafts; regenerate data

**Files:**
- Modify: `scripts/sync.ts`
- Generate: `data/`

- [ ] **Step 1: Fetch drafts in `fetchSeason`**

After the users/rosters/brackets fetch and checks, add:
```ts
  const drafts = await client.getDrafts(id);
  if (!drafts) throw missing('drafts');
  const completed = drafts.find((d) => d.status === 'complete') ?? null;
  let draft: RawSeasonInput['draft'] = null;
  if (completed) {
    const picks = await client.getDraftPicks(completed.draft_id);
    if (!picks) throw missing(`draft ${completed.draft_id} picks`);
    if (picks.length === 0) throw new Error(`Season ${season} (${id}): draft ${completed.draft_id} has no picks`);
    draft = { draft: completed, picks };
  }
```
and pass `draft` in the `RawSeasonInput`. Log `  ${season} draft: ${picks.length} picks (${keepers} keepers)` where `keepers = picks.filter((p) => p.is_keeper).length`, or `  ${season} draft: none` when there is no completed draft.

- [ ] **Step 2: Typecheck, sync, inspect**

```bash
cd /Users/mathiasfoster/repos/fantasy-dash && pnpm typecheck:scripts && pnpm sync && node -e '
const h=require("./data/history.json"); const n=id=>id?h.managers[id].displayName:null;
for (const s of h.seasons) { const d=require(`./data/seasons/${s.year}.json`).draft; console.log(s.year, "honors", n(s.honors.champion), n(s.honors.runnerUp), n(s.honors.third), n(s.honors.pointsTitle), n(s.honors.lastPlace), "| draft", d && [d.type, d.rounds, d.picks.length, d.picks.filter(p=>p.isKeeper).length+" keepers", "slots", d.slotOrder.length]); }
const p=require("./data/players.json"); console.log("players", Object.keys(p).length);'
```
Expected: honors for 2023 to 2025 match the oracle (champions BigBufoon, CurryLover53, mattygggg; last place CurryLover53, vishwakn, vishwakn); 2026 honors null; drafts: 2023 snake 15 rounds 150 picks, 2024 to 2026 16 rounds 160 picks, 2026 with 19 keepers, every `slotOrder` length 10; the player count rises above 430 (drafted players who never started).

- [ ] **Step 3: Commit**

```bash
git add scripts data && git commit -m "feat(sync): fetch drafts and picks; regenerate data

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Narrow-screen nav menu and loader cache recovery (web)

**Files:**
- Modify: `packages/web/src/components/Nav.tsx`, `packages/web/src/data/load.ts`
- Test: `packages/web/src/components/Nav.test.tsx`

- [ ] **Step 1: Failing test**

`packages/web/src/components/Nav.test.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Nav from './Nav';

describe('Nav', () => {
  it('toggles the narrow-screen menu and closes it on navigation', () => {
    render(<MemoryRouter><Nav /></MemoryRouter>);
    const button = screen.getByRole('button', { name: /menu/i });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const menu = screen.getByTestId('nav-menu');
    fireEvent.click(menu.querySelector('a[href="/standings"]')!);
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
pnpm --filter @fantasy-dash/web test -- Nav
```
Expected: FAIL, no button named menu.

- [ ] **Step 3: Implement**

`packages/web/src/components/Nav.tsx`:
```tsx
import { useState } from 'react';
import { NavLink } from 'react-router';
import { leagueConfig } from '../../../../league.config';
import ThemeToggle from './ThemeToggle';

export const links: { to: string; label: string }[] = [
  { to: '/scores', label: 'Scores' },
  { to: '/standings', label: 'Standings' },
  { to: '/h2h', label: 'Head to Head' },
  { to: '/all-time', label: 'All-Time' },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `relative flex h-12 shrink-0 items-center whitespace-nowrap px-2.5 transition-colors after:absolute after:inset-x-2.5 after:bottom-0 after:h-0.5 after:rounded-full ${isActive ? 'text-ink after:bg-accent' : 'text-muted after:bg-transparent hover:text-ink'}`;

export default function Nav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-12 w-full max-w-[1400px] items-center gap-3 px-4 sm:gap-6 sm:px-6 lg:px-10">
        <NavLink to="/" className="shrink-0 whitespace-nowrap font-semibold tracking-tight" onClick={() => setOpen(false)}>{leagueConfig.name}</NavLink>
        <nav className="hidden h-full min-w-0 items-center gap-1 text-sm md:flex">
          {links.map((l) => <NavLink key={l.to} to={l.to} className={linkClass}>{l.label}</NavLink>)}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            aria-label="Menu"
            aria-expanded={open}
            aria-controls="nav-menu"
            onClick={() => setOpen((o) => !o)}
            className="rounded px-2 py-1 text-xs text-muted hover:text-ink md:hidden"
          >
            {open ? 'Close' : 'Menu'}
          </button>
        </div>
      </div>
      {open && (
        <div id="nav-menu" data-testid="nav-menu" className="border-t border-line bg-bg md:hidden">
          <nav className="mx-auto flex max-w-[1400px] flex-col px-2 py-1 text-sm">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) => `rounded px-3 py-2 ${isActive ? 'bg-surface-2 text-ink' : 'text-muted hover:text-ink'}`}
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
```

`packages/web/src/data/load.ts`: make rejected loads retryable:
```ts
export function loadSeason(year: number): Promise<Season> {
  let pending = cache.get(year);
  if (!pending) {
    const key = Object.keys(seasonMods).find((k) => k.endsWith(`/${year}.json`));
    if (!key) return Promise.reject(new Response(`No data for season ${year}`, { status: 404 }));
    pending = seasonMods[key]().then((m) => m.default).catch((err) => { cache.delete(year); throw err; });
    cache.set(year, pending);
  }
  return pending;
}

let allSeasons: Promise<Season[]> | null = null;
export function loadAllSeasons(): Promise<Season[]> {
  if (!allSeasons) {
    allSeasons = Promise.all(history.seasons.map((s) => loadSeason(s.year))).catch((err) => { allSeasons = null; throw err; });
  }
  return allSeasons;
}
```

- [ ] **Step 4: Run, expect pass; browser check**

```bash
pnpm --filter @fantasy-dash/web test && pnpm --filter @fantasy-dash/web typecheck
```
Expected: 31 pass. Screenshot `/standings/2025` at 400 with the menu closed and (via a second capture after clicking, if the script allows; otherwise rely on the test) confirm the horizontal nav is hidden and the Menu button shows; at 1440 the inline links are unchanged.

- [ ] **Step 5: Commit**

```bash
git add packages/web && git commit -m "feat(web): collapsible nav on narrow screens; retryable season loads

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Season records helper (web)

**Files:**
- Create: `packages/web/src/lib/records.ts`
- Test: `packages/web/src/lib/records.test.ts`

**Interfaces:**
```ts
export interface SeasonRecord { key: string; label: string; userId: UserId; value: string; definition: string }
export function seasonRecords(standings: StandingRow[]): SeasonRecord[]   // 5 entries in fixed order; [] when standings is empty
```

- [ ] **Step 1: Failing test**

`packages/web/src/lib/records.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import type { StandingRow } from '@fantasy-dash/core';
import { seasonRecords } from './records';

const row = (userId: string, o: Partial<StandingRow>): StandingRow => ({
  userId, rank: 1, w: 7, l: 7, t: 0, winPct: 0.5, pf: 1500, pa: 1500, ppg: 107.1, maxPoints: 1700, efficiency: 0.88,
  streak: '-', allPlay: { w: 60, l: 66, t: 0, pct: 0.4762 }, weeklyHighs: 1, ...o,
});

describe('seasonRecords', () => {
  const rows = [
    row('a', { w: 10, l: 4, pf: 2061.76, ppg: 147.3, winPct: 0.7143, allPlay: { w: 82, l: 44, t: 0, pct: 0.651 }, weeklyHighs: 4 }),
    row('b', { w: 10, l: 4, pf: 2003.96, ppg: 143.1, winPct: 0.7143, allPlay: { w: 77, l: 49, t: 0, pct: 0.611 }, weeklyHighs: 5 }),
    row('c', { pf: 1600, ppg: 114.3, winPct: 0.2143, allPlay: { w: 35, l: 91, t: 0, pct: 0.278 }, weeklyHighs: 0 }),
  ];
  it('picks the leader for each record with PF as the record tiebreak', () => {
    const r = Object.fromEntries(seasonRecords(rows).map((x) => [x.key, x]));
    expect(r.mostPoints).toMatchObject({ userId: 'a', value: '2061.76' });
    expect(r.bestPpg).toMatchObject({ userId: 'a', value: '147.3' });
    expect(r.bestRecord).toMatchObject({ userId: 'a', value: '10-4' });
    expect(r.bestAllPlay).toMatchObject({ userId: 'a', value: '82-44 (.651)' });
    expect(r.mostWeeklyHighs).toMatchObject({ userId: 'b', value: '5' });
    expect(seasonRecords(rows).map((x) => x.key)).toEqual(['mostPoints', 'bestPpg', 'bestRecord', 'bestAllPlay', 'mostWeeklyHighs']);
  });
  it('returns nothing for an empty season', () => {
    expect(seasonRecords([])).toEqual([]);
  });
});
```
Rows `a` and `b` share the same win percentage, so the PF tiebreak decides `bestRecord`.

- [ ] **Step 2: Run, expect failure**

```bash
pnpm --filter @fantasy-dash/web test -- records
```

- [ ] **Step 3: Implement**

`packages/web/src/lib/records.ts`:
```ts
import type { StandingRow, UserId } from '@fantasy-dash/core';
import { fmtPpg, fmtPts, fmtRecord, fmtWinPct } from './format';

export interface SeasonRecord { key: string; label: string; userId: UserId; value: string; definition: string }

function leader(rows: StandingRow[], score: (r: StandingRow) => number): StandingRow {
  return rows.reduce((best, r) => {
    const a = score(r); const b = score(best);
    return a > b || (a === b && r.pf > best.pf) ? r : best;
  });
}

/** The five season records shown on the season review, derived from regular-season standings. */
export function seasonRecords(rows: StandingRow[]): SeasonRecord[] {
  if (rows.length === 0) return [];
  const mostPoints = leader(rows, (r) => r.pf);
  const bestPpg = leader(rows, (r) => r.ppg);
  const bestRecord = leader(rows, (r) => r.winPct);
  const bestAllPlay = leader(rows, (r) => r.allPlay.pct);
  const mostWeeklyHighs = leader(rows, (r) => r.weeklyHighs);
  return [
    { key: 'mostPoints', label: 'Most points', userId: mostPoints.userId, value: fmtPts(mostPoints.pf), definition: 'Highest regular-season points for.' },
    { key: 'bestPpg', label: 'Best PPG', userId: bestPpg.userId, value: fmtPpg(bestPpg.ppg), definition: 'Highest regular-season points per game.' },
    { key: 'bestRecord', label: 'Best record', userId: bestRecord.userId, value: fmtRecord(bestRecord), definition: 'Best regular-season win percentage; points for breaks ties.' },
    { key: 'bestAllPlay', label: 'Best all-play', userId: bestAllPlay.userId, value: `${bestAllPlay.allPlay.w}-${bestAllPlay.allPlay.l}${bestAllPlay.allPlay.t ? `-${bestAllPlay.allPlay.t}` : ''} (${fmtWinPct(bestAllPlay.allPlay.pct)})`, definition: 'Best record against every other team each week.' },
    { key: 'mostWeeklyHighs', label: 'Most weekly highs', userId: mostWeeklyHighs.userId, value: String(mostWeeklyHighs.weeklyHighs), definition: "Most weeks with the league's top score." },
  ];
}
```

- [ ] **Step 4: Run, expect pass; commit**

```bash
pnpm --filter @fantasy-dash/web test && git add packages/web && git commit -m "feat(web): season records helper

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: History page

**Files:**
- Create: `packages/web/src/pages/HistoryPage.tsx`
- Modify: `packages/web/src/App.tsx`, `packages/web/src/components/Nav.tsx`

- [ ] **Step 1: Implement**

`packages/web/src/pages/HistoryPage.tsx`:
```tsx
import { Link } from 'react-router';
import type { UserId } from '@fantasy-dash/core';
import Avatar from '../components/Avatar';
import { history } from '../data/load';

function Who({ id }: { id: UserId | null }) {
  if (!id) return <span className="text-muted">—</span>;
  const m = history.managers[id];
  return (
    <Link to={`/h2h?a=${id}`} className="flex items-center gap-2 hover:text-accent">
      <Avatar avatar={m?.avatar ?? null} name={m?.displayName ?? id} size={24} />
      <span className="font-medium">{m?.displayName ?? id}</span>
    </Link>
  );
}

export default function HistoryPage() {
  const seasons = [...history.seasons].reverse();
  return (
    <section className="space-y-4">
      <header><h1 className="text-[22px] font-semibold">League History</h1></header>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line">
              {['Season', 'Champion', 'Runner-up', 'Points title', 'Last place', ''].map((h) => (
                <th key={h} scope="col" className="section-label px-3 py-2 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {seasons.map((s) => (
              <tr key={s.year} data-testid="history-row" className="border-t border-line transition-colors hover:bg-surface-2">
                <td className="num px-3 py-3 font-semibold">{s.year}</td>
                {s.status === 'in_season' ? (
                  <td colSpan={4} className="px-3 py-3 text-muted">In progress · through week {s.lastScoredWeek}</td>
                ) : (
                  <>
                    <td className="px-3 py-3"><Who id={s.honors.champion} /></td>
                    <td className="px-3 py-3"><Who id={s.honors.runnerUp} /></td>
                    <td className="px-3 py-3"><Who id={s.honors.pointsTitle} /></td>
                    <td className="px-3 py-3"><Who id={s.honors.lastPlace} /></td>
                  </>
                )}
                <td className="px-3 py-3 text-right whitespace-nowrap"><Link to={`/history/${s.year}`} className="text-accent hover:underline">Season review →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
```

`App.tsx`: import `HistoryPage` and add `{ path: 'history', element: <HistoryPage /> }` after `h2h`. `Nav.tsx`: append `{ to: '/history', label: 'History' }`.

- [ ] **Step 2: Verify and commit**

```bash
pnpm --filter @fantasy-dash/web typecheck && pnpm --filter @fantasy-dash/web test
git add packages/web && git commit -m "feat(web): league history page

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
Screenshot `/history` at 1440 and 400 (table scrolls in its card at 400).

---

### Task 6: Season review page

**Files:**
- Create: `packages/web/src/pages/SeasonReviewPage.tsx`, `packages/web/src/components/history/HonorsStrip.tsx`, `Bracket.tsx`, `DraftRoundOne.tsx`, `RecordsBlock.tsx`
- Modify: `packages/web/src/App.tsx`
- Test: `packages/web/src/components/history/Bracket.test.tsx`

**Interfaces:**
- `<HonorsStrip honors managers status lastScoredWeek />` five tiles (Champion, Runner-up, Third, Points title, Last place) with avatar and name; in-season shows one muted line.
- `<Bracket games kind managers year />` where `games: BracketGame[]`, `kind: 'winners' | 'consolation'`; renders one column per round (ordered), each game a card with two rows (name, score), winner bold, placement games labeled via `fmtTag`; a game with a `gameId` is a `Link` to `/scores/{year}/{week}/{matchupId}`; a game with null teams renders "TBD".
- `<DraftRoundOne draft managers players />` ordered round-1 picks: pick number, manager, headshot, player name, `PosPill`, NFL team, "Keeper" badge when `isKeeper`.
- `<RecordsBlock records managers />` five tiles from `seasonRecords`.

- [ ] **Step 1: Failing test**

`packages/web/src/components/history/Bracket.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { BracketGame, Manager } from '@fantasy-dash/core';
import Bracket from './Bracket';

const managers: Record<string, Manager> = {
  a: { userId: 'a', displayName: 'alice', teamName: 'Team A', avatar: null, rosterId: 1 },
  b: { userId: 'b', displayName: 'bob', teamName: 'Team B', avatar: null, rosterId: 2 },
  c: { userId: 'c', displayName: 'cara', teamName: 'Team C', avatar: null, rosterId: 3 },
};
const g = (o: Partial<BracketGame>): BracketGame => ({
  bracket: 'winners', round: 1, matchNo: 1, placement: null, week: 15, tag: 'QF',
  home: 'a', away: 'b', homePoints: 120.5, awayPoints: 99.25, advanced: 'a', gameId: '2025-15-1', ...o,
});

describe('Bracket', () => {
  it('groups games by round, marks winners, labels placement games and links box scores', () => {
    render(<MemoryRouter><Bracket kind="winners" year={2025} managers={managers} games={[
      g({}),
      g({ round: 2, matchNo: 2, week: 16, tag: 'Final', placement: 1, home: 'a', away: 'c', homePoints: 140, awayPoints: 150.75, advanced: 'c', gameId: '2025-16-3' }),
      g({ round: 2, matchNo: 3, week: 16, tag: '3rd', placement: 3, home: 'b', away: null, homePoints: null, awayPoints: null, advanced: null, gameId: null }),
    ]} /></MemoryRouter>);
    expect(screen.getByText('Quarterfinal')).toBeInTheDocument();
    expect(screen.getByText('Championship')).toBeInTheDocument();
    expect(screen.getByText('3rd place')).toBeInTheDocument();
    expect(screen.getByText('TBD')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Team A.*120\.50.*Team B.*99\.25/s })).toHaveAttribute('href', '/scores/2025/15/1');
    expect(screen.getByRole('link', { name: /Team C.*150\.75/s })).toHaveAttribute('href', '/scores/2025/16/3');
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
pnpm --filter @fantasy-dash/web test -- Bracket
```

- [ ] **Step 3: Implement**

`packages/web/src/components/history/Bracket.tsx`:
```tsx
import { Link } from 'react-router';
import type { BracketGame, BracketKind, Manager, UserId } from '@fantasy-dash/core';
import { fmtPts, fmtTag } from '../../lib/format';

interface Props { games: BracketGame[]; kind: BracketKind; managers: Record<UserId, Manager>; year: number }

const roundTitle = (kind: BracketKind, round: number, games: BracketGame[]) => {
  const tags = new Set(games.map((g) => g.tag));
  if (tags.size === 1) return fmtTag(games[0].tag);
  return kind === 'winners' ? `Round ${round}` : `Consolation round ${round}`;
};

function Side({ id, points, won, managers }: { id: UserId | null; points: number | null; won: boolean; managers: Record<UserId, Manager> }) {
  const m = id ? managers[id] : undefined;
  return (
    <div className={`flex items-center justify-between gap-3 ${won ? 'text-ink font-semibold' : 'text-muted'}`}>
      <span className="truncate">{id ? m?.teamName ?? m?.displayName ?? id : 'TBD'}</span>
      <span className="num">{points === null ? '' : fmtPts(points)}</span>
    </div>
  );
}

export default function Bracket({ games, kind, managers, year }: Props) {
  const rounds = [...new Set(games.map((g) => g.round))].sort((a, b) => a - b);
  return (
    <div className="flex gap-4 overflow-x-auto pb-1">
      {rounds.map((round) => {
        const inRound = games.filter((g) => g.round === round).sort((a, b) => (a.placement ?? 0) - (b.placement ?? 0) || a.matchNo - b.matchNo);
        return (
          <div key={round} className="flex min-w-[220px] flex-1 flex-col gap-3">
            <div className="section-label">{roundTitle(kind, round, inRound)}</div>
            {inRound.map((g) => {
              const body = (
                <div className="card p-3 text-sm">
                  {inRound.length > 1 && tagsDiffer(inRound) && <div className="section-label mb-1">{fmtTag(g.tag)}</div>}
                  <Side id={g.home} points={g.homePoints} won={wonBy(g, kind, 'home')} managers={managers} />
                  <Side id={g.away} points={g.awayPoints} won={wonBy(g, kind, 'away')} managers={managers} />
                </div>
              );
              const matchupId = g.gameId?.split('-').pop();
              return g.gameId ? (
                <Link key={g.matchNo} to={`/scores/${year}/${g.week}/${matchupId}`} className="block rounded-xl transition-colors hover:ring-1 hover:ring-accent/60">{body}</Link>
              ) : <div key={g.matchNo}>{body}</div>;
            })}
          </div>
        );
      })}
    </div>
  );
}

function tagsDiffer(games: BracketGame[]): boolean {
  return new Set(games.map((g) => g.tag)).size > 1;
}

/**
 * Winners bracket: the advancing team won. Consolation is a toilet bowl where the
 * lower scorer advances, so the game's winner is the higher scorer.
 */
function wonBy(g: BracketGame, kind: BracketKind, side: 'home' | 'away'): boolean {
  if (kind === 'winners') return g.advanced !== null && g.advanced === (side === 'home' ? g.home : g.away);
  if (g.homePoints === null || g.awayPoints === null) return false;
  return side === 'home' ? g.homePoints > g.awayPoints : g.awayPoints > g.homePoints;
}
```
Note on the test: round 2 holds the Championship and 3rd place game, so the round title is "Round 2" and each card gets its own `fmtTag` label; round 1 holds only quarterfinals, so the column title is "Quarterfinal".

`packages/web/src/components/history/HonorsStrip.tsx`:
```tsx
import { Link } from 'react-router';
import type { Honors, Manager, SeasonStatus, UserId } from '@fantasy-dash/core';
import Avatar from '../Avatar';

interface Props { honors: Honors; managers: Record<UserId, Manager>; status: SeasonStatus; lastScoredWeek: number }

const tiles: { key: keyof Honors; label: string }[] = [
  { key: 'champion', label: 'Champion' }, { key: 'runnerUp', label: 'Runner-up' }, { key: 'third', label: 'Third' },
  { key: 'pointsTitle', label: 'Points title' }, { key: 'lastPlace', label: 'Last place' },
];

export default function HonorsStrip({ honors, managers, status, lastScoredWeek }: Props) {
  if (status === 'in_season') return <div className="card p-4 text-sm text-muted">Season in progress · through week {lastScoredWeek}. Honors are decided after the playoffs.</div>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {tiles.map((t) => {
        const id = honors[t.key];
        const m = id ? managers[id] : undefined;
        return (
          <div key={t.key} className="card flex items-center gap-3 p-3">
            <Avatar avatar={m?.avatar ?? null} name={m?.displayName ?? '?'} size={36} />
            <div className="min-w-0">
              <div className="section-label">{t.label}</div>
              {id ? <Link to={`/h2h?a=${id}`} className="truncate font-semibold hover:text-accent">{m?.teamName ?? m?.displayName ?? id}</Link> : <div className="text-muted">—</div>}
              {m?.teamName && <div className="truncate text-xs text-muted">{m.displayName}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

`packages/web/src/components/history/DraftRoundOne.tsx`:
```tsx
import type { Draft, Manager, PlayerDirectory, UserId } from '@fantasy-dash/core';
import Headshot from '../Headshot';
import PosPill from '../PosPill';
import { playerName, playerPos, playerTeam } from '../../lib/players';

interface Props { draft: Draft; managers: Record<UserId, Manager>; players: PlayerDirectory }

export default function DraftRoundOne({ draft, managers, players }: Props) {
  const picks = draft.picks.filter((p) => p.round === 1).sort((a, b) => a.pickNo - b.pickNo);
  return (
    <div className="card">
      <div className="flex items-baseline justify-between px-4 pt-3">
        <div className="section-label">Draft · Round 1</div>
        <div className="text-xs text-muted">{draft.rounds} rounds · {draft.type}</div>
      </div>
      <ol className="grid gap-x-6 px-4 py-2 sm:grid-cols-2">
        {picks.map((p) => {
          const pos = playerPos(players, p.playerId);
          return (
            <li key={p.pickNo} className="grid grid-cols-[1.5rem_28px_minmax(0,1fr)_auto] items-center gap-3 border-t border-line py-2 text-sm first:border-t-0 sm:[&:nth-child(2)]:border-t-0">
              <span className="num text-muted">{p.pickNo}</span>
              <Headshot players={players} id={p.playerId} size={28} />
              <span className="min-w-0">
                <span className="truncate font-medium">{playerName(players, p.playerId)}</span>
                <span className="ml-1.5 text-xs text-muted">{managers[p.userId]?.displayName ?? p.userId}</span>
              </span>
              <span className="flex items-center gap-2">
                {p.isKeeper && <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">Keeper</span>}
                <PosPill pos={pos} />
                <span className="w-8 text-xs text-muted">{playerTeam(players, p.playerId)}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="border-t border-line px-4 py-2 text-xs text-muted">Full draft board and value analysis arrive in a later release.</div>
    </div>
  );
}
```

`packages/web/src/components/history/RecordsBlock.tsx`:
```tsx
import { Link } from 'react-router';
import type { Manager, UserId } from '@fantasy-dash/core';
import type { SeasonRecord } from '../../lib/records';
import Avatar from '../Avatar';

export default function RecordsBlock({ records, managers }: { records: SeasonRecord[]; managers: Record<UserId, Manager> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {records.map((r) => {
        const m = managers[r.userId];
        return (
          <div key={r.key} className="card p-3" title={r.definition}>
            <div className="section-label">{r.label}</div>
            <div className="num mt-1 text-xl font-semibold">{r.value}</div>
            <Link to={`/h2h?a=${r.userId}`} className="mt-1 flex items-center gap-2 text-sm hover:text-accent">
              <Avatar avatar={m?.avatar ?? null} name={m?.displayName ?? '?'} size={20} />
              <span className="truncate">{m?.displayName ?? r.userId}</span>
            </Link>
          </div>
        );
      })}
    </div>
  );
}
```

`packages/web/src/pages/SeasonReviewPage.tsx`:
```tsx
import { Link, useLoaderData } from 'react-router';
import type { Season } from '@fantasy-dash/core';
import StandingsTable from '../components/StandingsTable';
import Bracket from '../components/history/Bracket';
import DraftRoundOne from '../components/history/DraftRoundOne';
import HonorsStrip from '../components/history/HonorsStrip';
import RecordsBlock from '../components/history/RecordsBlock';
import { players } from '../data/load';
import { seasonRecords } from '../lib/records';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (<section className="space-y-3"><h2 className="section-label">{title}</h2>{children}</section>);
}

export default function SeasonReviewPage() {
  const season = useLoaderData() as Season;
  const hasBracket = season.brackets.winners.some((g) => g.home !== null);
  return (
    <article className="space-y-8">
      <nav className="text-xs text-muted"><Link to="/history" className="hover:text-ink">← League history</Link></nav>
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-[22px] font-semibold">{season.year} <span className="font-normal text-muted">season review</span></h1>
        <Link to={`/scores/${season.year}/${Math.max(1, season.lastScoredWeek)}`} className="text-sm text-accent hover:underline">Scoreboard →</Link>
      </header>
      <HonorsStrip honors={season.honors} managers={season.managers} status={season.status} lastScoredWeek={season.lastScoredWeek} />
      <Section title={season.status === 'complete' ? 'Final standings' : `Standings · through week ${season.lastScoredWeek}`}>
        <StandingsTable rows={season.standings} managers={season.managers} playoffTeams={season.playoffTeams} />
      </Section>
      <Section title="Playoffs">
        {hasBracket ? <Bracket games={season.brackets.winners} kind="winners" managers={season.managers} year={season.year} /> : <p className="text-sm text-muted">Playoff matchups are set after the regular season.</p>}
      </Section>
      {hasBracket && season.brackets.consolation.length > 0 && (
        <Section title="Consolation">
          <Bracket games={season.brackets.consolation} kind="consolation" managers={season.managers} year={season.year} />
        </Section>
      )}
      {season.draft && <DraftRoundOne draft={season.draft} managers={season.managers} players={players} />}
      {season.standings.length > 0 && (
        <Section title="Season records">
          <RecordsBlock records={seasonRecords(season.standings)} managers={season.managers} />
        </Section>
      )}
    </article>
  );
}
```
Add `import type { ReactNode } from 'react'` and use `ReactNode` instead of `React.ReactNode` if the JSX runtime config requires it.

`App.tsx`: add `{ path: 'history/:season', loader: seasonLoader, element: <SeasonReviewPage /> }` after `history`.

- [ ] **Step 4: Verify; screenshots; commit**

```bash
pnpm --filter @fantasy-dash/web test && pnpm --filter @fantasy-dash/web typecheck && pnpm build
```
Expected: 34 pass (30 before this phase, plus Nav, two records tests, and Bracket). Screenshot `/history/2025` at 1440 and 400, and `/history/2026` at 1440 (in-progress variant). Check: five honors tiles, standings table, winners bracket in three columns (Quarterfinal, Round 2 with Semifinal/5th place, Round 3 with Championship/3rd place), consolation in two columns, round-1 draft list, five record tiles; no horizontal page overflow at 400 (brackets scroll inside their row).

```bash
git add packages/web && git commit -m "feat(web): season review page with honors, brackets, draft round one, records

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Spec update and visual pass

**Files:**
- Modify: `docs/superpowers/specs/2026-10-14-fantasy-dashboard-design.md`

- [ ] **Step 1: Spec**

In "Data model": replace the `Draft`/`Pick` block with the shipped Phase 3 shape (`Draft { draftId, type, rounds, slotOrder, picks: DraftPick[] }`, `DraftPick { round, pickNo, slot, userId, playerId, isKeeper }`) and note that value fields (`posDraftRank`, `seasonPoints`, `posFinishRank`, `value`, `pointsOverBaseline`) arrive in Phase 4. Add `honors: Honors` to the `HistorySeason` shape. Replace `records: SeasonRecords` on `Season` with a note that records are derived in the web app from `standings` (`seasonRecords`). In "Views" Phase 3, note the History page shows "In progress" for the current season and that the season review's draft section has no link until Phase 4.

- [ ] **Step 2: Visual pass and commit**

Screenshot `/history`, `/history/2025`, `/history/2023` at 1440, `/history/2025` at 400, `/standings/2025` at 400 (menu button visible). Fix anything unbalanced in Phase 3 files.

```bash
git add docs && git commit -m "docs: phase 3 data model and views

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Phase 3 exit criteria

- `pnpm test` green in both packages; typechecks clean; schema `satisfies` guards compile.
- `data/` carries drafts for all four seasons and honors on every history season.
- `/history` and `/history/:season` deployed; the nav collapses to a menu below `md`; season loads recover from a failed chunk.
