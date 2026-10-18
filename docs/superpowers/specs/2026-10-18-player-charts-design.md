# Player charts

Four play-by-play graphics on the player page, drawn as football fields:
- **Route tree** for WR, TE and RB.
- **Run lanes** for RB.
- **Passing zones** for QB.
- **Under pressure & vs coverage** for QB.

The agreed mockups are in `.superpowers/brainstorm/33950-1792351966/content/`:
- `route-tree-v7.html`: route tree layout, target-share default, bars beside the tree.
- `run-lanes-v2.html`: run lanes.
- `qb-cards-v6.html`: passing zones (glow map) and the pressure card.

The data is nflverse play-by-play joined to nflverse participation. That covers seasons 2023–2025. 2026 has no participation file yet, so it gets no charts until nflverse publishes one, and the sync then picks it up without changes.

## Who gets which card

| Position | Cards | Ranked against |
|---|---|---|
| WR | Route tree | WRs |
| TE | Route tree | TEs |
| RB | Run lanes, route tree | RBs |
| QB | Passing zones, pressure & coverage | QBs |

A card is hidden when the player has no rows for it in any chart season. Its season picker lists only the seasons where he has rows, newest first, and defaults to the newest. Kickers and defenses get no cards.

## Data

### File

One file per season: `data/charts/{year}.json`. It is separate from the player database, so the Players page loads nothing new. It is lazy-loaded on the player page through `loadCharts(year)` and `hasCharts(year)` in `data/load.ts`, which follow the `loadPlayerDb` pattern (an `import.meta.glob`, cached promises, and a 404 `Response` for a missing year).

Players are keyed by **gsis id**, so players without a Sleeper id still count in the rankings. The page finds a player's gsis id through `db.players[sleeperId].gsisId` in that year's player database. If he has no gsis id, the cards are hidden.

```ts
type Counts = number[];           // fixed-order tuple per kind, below
interface ChartDb {
  year: number;
  builtAt: string;
  players: Record<GsisId, {
    pos: 'QB' | 'RB' | 'WR' | 'TE';
    routes?: Record<Coverage, Partial<Record<Route, Counts>>>;   // Coverage = 'all' | 'man' | 'zone'
    lanes?:  Record<Box, Partial<Record<Lane, Counts>>>;          // Box = 'all' | 'light' | 'heavy'
    zones?:  Record<Pocket, Partial<Record<Zone, Counts>>>;       // Pocket = 'all' | 'clean' | 'pressured'
    splits?: Partial<Record<Split, Counts>>;
  }>;
}
```

Players only get the keys that apply to them. Each tuple's order is fixed and documented next to the type in `packages/core/src/charts/types.ts`:

| Kind | Tuple |
|---|---|
| route | targets, catches, yards, epa, tds |
| lane | carries, yards, epa, successes, tds |
| zone | attempts, completions, yards, epa, tds, ints, cpoeSum, cpoeN |
| split | dropbacks, attempts, completions, yards, epa, sacks |

Names and values:
- **Route:** the 13 nflverse values (`QUICK OUT`, `HITCH/CURL`, `GO`, `SCREEN`, `IN/DIG`, `DEEP OUT`, `SHALLOW CROSS/DRAG`, `SLANT`, `POST`, `SWING`, `CORNER`, `WHEEL`, `TEXAS/ANGLE`).
- **Lane:** `LE LT LG MID RG RT RE`, from `run_location` and `run_gap`. `middle` means MID; left/right with `end`, `tackle` or `guard` give the rest. A carry missing either field is skipped.
- **Box:** `light` is 6 or fewer defenders in the box, `heavy` is 7 or more. A carry with no box count goes only into `all`.
- **Zone:** `{band}|{side}`.
  - Band from air yards: `blos` under 0, `short` 0–9, `mid` 10–19, `deep` 20 or more.
  - Side is `left`, `middle` or `right` from `pass_location`.
  - An attempt missing either field, or a sack, is skipped.
- **Pocket:** `pressured` when participation `was_pressure` is TRUE, otherwise `clean`.
- **Split:**

  | Key | Meaning |
  |---|---|
  | `all` | Every dropback |
  | `clean`, `pressured` | Pressure flag |
  | `noblitz`, `blitz` | Rushers: 4 or fewer, or 5 or more |
  | `man`, `zone` | Man or zone coverage |
  | `COVER_0`, `COVER_1`, `COVER_2`, `COVER_3`, `COVER_4`, `COVER_6` | Coverage shell; other shells are left out |
  | `quick`, `hold` | Time to throw: under 2.5 s, or 2.5 s or more |

  A split whose participation field is blank is not counted. The dropback still counts in `all`.

Plays are restricted to weeks 1–18, regular season, the same as the player database.

### Which plays count

All plays come from `play_by_play_{year}.csv.gz`, matched to participation on `game_id` and `play_id` (`nflverse_game_id` and `play_id` in the participation file):
- **Route:**
  - The play has a `receiver_player_id` and its participation row has a `route`.
  - Credited to the receiver, under `all` and under `man` or `zone`.
  - Targets with no route are not counted. That's about 1% of targets.
- **Lane:**
  - `rush_attempt` is 1 and `qb_scramble` is not 1.
  - Credited to the `rusher_player_id`.
  - Success means `epa > 0`.
- **Zone and split:** credited to the `passer_player_id`.
  - A dropback is any play with `pass_attempt` = 1, sacks included.
  - An attempt is a dropback that is not a sack.

Yards are `receiving_yards`, `yards_gained` (for carries) or `passing_yards`. TDs are `pass_touchdown` or `rush_touchdown`. INTs are `interception`.

**Position** comes from the player database entry with that gsis id, so league position overrides apply. If there's no entry, it falls back to the nflverse `players.csv` position. Players at other positions are dropped.

### Building it

- Core: `packages/core/src/charts/`
  - `build.ts`: `buildCharts(pbpRows, participationRows, positions, year)` returns a `ChartDb`. Pure, and takes iterables of CSV rows.
  - `types.ts`: the types and tuple orders.
  - `schema.ts`: a zod `ChartDbSchema`.
- `scripts/syncPlayers.ts` gets a second phase after the player-database phase. For every league season:
  - **Skip** the season when its chart file exists and parses, and the season is complete. `--full` rebuilds anyway, as it does for the player database.
  - **Otherwise** download `pbp_participation_{year}.csv` and `pbp/play_by_play_{year}.csv.gz`. Either one returning 404 means the season is skipped with a log line, not an error.
  - **Positions** come from that season's `data/playerdb/{year}.json` plus `players.csv`.
  - **Writing** goes through staging and a rename, like the player database. `--dry-run` writes to a temporary directory.
- The GitHub workflow needs no change: `pnpm sync:players` already runs and commits `data/`.

A finished season comes to roughly 0.5–1 MB of JSON.

## Ranking

All percentiles are computed in the browser in `packages/web/src/lib/charts/`, ranked within his position and the same filter, using `percentiles()` from `lib/playerdb/percentile.ts`. The scale is 0–100, rounded.

| Card | Minimum to be ranked | Share pool |
|---|---|---|
| Route tree | 5 targets on the route | Players with 50+ targets (20+ for man or zone alone) |
| Run lanes | 10 carries in the lane | Players with 100+ carries (30+ for light or heavy alone) |
| Passing zones | 10 attempts in the zone | Players with 150+ attempts (50+ for clean or pressured alone) |
| Pressure & coverage | 20 dropbacks in the split | None |

A player under the minimum is left out of that pool. His own value still shows, greyed, with "too few to rank". Sack % ranks lower as better.

## The cards

All four share one look, with field colours from new theme tokens in `index.css`, in both dark and light:

| Token | Use |
|---|---|
| `--field` | The playing surface |
| `--field-band` | The grey sideline bands that carry yard marks |
| `--field-line` | Yard lines and hash marks |
| `--los` | The line of scrimmage |
| `--heat-0` … `--heat-3` | The share scale |

**Colour:**
- The share view uses the heat scale: brighter in dark mode, deeper in light mode, the more of his volume it gets.
- Every "how good" view uses his percentile on red → yellow → green, built from `--loss`, `--warn` and `--win` with `color-mix` in oklch. These are the same tokens as the percentile bars.
- An unranked item is grey.

**The main number is always the actual stat:** share %, yards per target, catch %, EPA, comp %, CPOE and so on. Small text beside or under it gives the percentile as "92nd", plus the volume ("27 tgt", "43 att").

**Hover** on any item, or on its bar, highlights it and dims the rest. A line under the field shows the full numbers. On touch, a tap does the same.

**Layout:**
- **WR and TE:** the route tree is full width, below the percentile bars and Advanced by season, and above the game log.
- **RB:** run lanes and the route tree share that row side by side, stacked below `lg`.
- **QB:** passing zones and the pressure card share that row, stacked below `lg`.

Each card has a `SeasonPicker` in its header.

### Route tree

The route tree uses the field from `route-tree-v7.html`, restyled into the shared look.

**Field:**
- Grey sideline bands marked LOS, +5, +10, +15 and +20, with hash marks.
- One receiver at the line, inside breaks toward the left.
- Every line is the same width.

**Shapes,** in yards (x below 0 is inside):

| Route | Path |
|---|---|
| Go | stem to 12, on to 23 |
| Post | stem to 12, then (−7, 20) |
| Corner | stem to 12, then (6, 19) |
| Dig | stem to 12, then (−10, 12) |
| Deep out | stem to 12, then (7, 12) |
| Hitch | stem to 12, back to (−2.8, 9) |
| Slant | stem to 3, then (−5.5, 8) |
| Quick out | stem to 3, then (5.5, 3) |
| Drag | (−2, 2.5), then (−11.5, 3.5) |
| Angle | (2.5, 3), then (−3, 6.5) |
| Wheel | (3, 1), (5.5, 4), (6, 15) |
| Screen | (−1, −1.5), (−4, −2.2) |
| Swing | (3, −1.5), (7, −0.5), (9, 1.5) |

The shared stem from 0 to 12 is drawn once as a neutral trunk, and each route's colour starts where it breaks. Label positions are fixed per route so labels never overlap.

**Label at each tip:** the route name, a chip with the main number coloured as above, then the small text.

**Switches:**
- All / vs Man / vs Zone
- Target share (the default) / Yds/tgt / Catch % / EPA/tgt

**Bars on the right**, sorted by targets: route, targets, the value, and the percentile, or the share in the share view. They drop below the tree under `lg`.

Routes he was never targeted on aren't drawn.

### Run lanes

The run lanes use the field from `run-lanes-v2.html`, restyled into the shared look:
- The sideline bands show only LOS. There are no depth marks, because the data has no depth.
- The line is drawn TE, LT, LG, C, RG, RT, TE, over the runs.
- The RB sits in the backfield, with 7 arrows fanning through the gaps. End runs bend outside.

**Label at each tip:** the lane name, the chip with the main number, then the small text.

**Switches:**
- All / Light box (≤6) / Heavy box (7+)
- Carry share (the default) / Yds/carry / Success % / EPA/carry

The legend says "Success = a carry that gained EPA".

**Bars** in field order, left end to right end.

### Passing zones

The passing zones use the glow map from `qb-cards-v6.html`.

**Field:**
- Drawn to scale, 7 yards behind the line to 35 past it.
- Grey sideline bands marked LOS, +10, +20 and +30.
- Yard lines every 5, and two columns of hash marks.
- A blue line of scrimmage.
- Left / Middle / Right under the field.

**Each zone** is a soft blurred glow in its colour. Over the glow sit:
- the main number, between chevrons that stay at fixed positions in the zone
- an underline in the zone's colour
- small text: "92nd · 43 att", or "43 att" in the share view

The text has no outline.

**Switches:**
- All / Clean pocket / Pressured
- Throw share (the default) / Comp % / Yds/att / EPA/att / CPOE

The CPOE legend explains the term.

**Three tiles under the field:** All, vs Man and vs Zone, each showing the matching stat from the splits with his percentile chip.

| Selected metric | Tiles show |
|---|---|
| Comp % | Comp % |
| Yds/att | Yds/att |
| Throw share, EPA/att, CPOE | EPA/dropback |

### Under pressure & vs coverage

As in `qb-cards-v6.html`:
- An "All dropbacks" row, then grouped rows:

  | Group | Rows |
  |---|---|
  | Pocket | Clean, Pressured |
  | Pass rush | 4 or fewer, Blitz (5+) |
  | Coverage | Man, Zone |
  | Shell | Cover 0, 1, 2, 3, 4, 6 |
  | Time to throw | Under 2.5 s, 2.5 s or more |

- Each row shows its label, dropbacks, a percentile bar, the value and the percentile.
- A tick on each bar marks his "All dropbacks" percentile.
- Metric switch: EPA/dropback (the default) / Comp % / Yds/att / Sack %.

The note under the card says each row ranks him only against QBs in the same situation.

## Components and modules

- **Web lib,** `packages/web/src/lib/charts/`, pure and tested:
  - `routes.ts` gives route items for a player, coverage and metric: value, share, percentile and ranked flag.
  - `lanes.ts` does the same for lanes.
  - `zones.ts` does the same for zones.
  - `splits.ts` gives the pressure rows.
  - `scale.ts` has `heatColor(share)`, `pctColor(p)` and the metric formatters.
- **Components,** `packages/web/src/components/charts/`:
  - `Field.tsx`: shared SVG pieces (sideline bands, hash marks, the line of scrimmage, chip labels and chevrons).
  - `RouteTree.tsx`, `RunLanes.tsx`, `PassingZones.tsx` and `PressureCard.tsx`.
  - `ChartBars.tsx`: the bar list.
- **`PlayerPage.tsx`:** the player loader also loads `loadCharts(year)` for every `hasCharts(year)`, and the page picks the cards by `bio.pos`.

## Testing

- **Core `build.ts`,** on hand-built CSV rows, covering:
  - the join on game and play
  - a target with no route, which is skipped
  - man and zone filing
  - lane mapping, including a missing gap
  - box filing, including a missing count
  - zone bands at the edges: −1, 0, 9, 10, 19, 20
  - sacks: they count as dropbacks and in splits, but not in zones
  - pressure, blitz and shell filing, including blanks
  - scrambles left out
  - the position fallback and dropping other positions
  - week 19 or later ignored
- **Web lib,** covering:
  - percentiles within position and filter
  - the cut-offs at exactly the minimum and one under it
  - the share pool cut-off
  - sack % inverted
  - a TE ranked only against TEs
- **Components,** covering:
  - switches change the numbers and colours
  - hover links the field and the bars
  - the season picker
  - a hidden card when there's no data
  - the right cards for each position on `PlayerPage`
- **Smoke test** on the committed 2025 file:
  - Nacua: 205 route targets, 27 on the dig.
  - Bijan Robinson: 287 lane carries, 61 to the right tackle.
  - Josh Allen: 585 dropbacks, 96 short-right attempts.

## Out of scope

- Real route depths or field side. The shapes are standard drawings.
- Every route run (a target tree only).
- Charts for 2026 until nflverse publishes its participation file.
- Charts for kickers and defenses.
