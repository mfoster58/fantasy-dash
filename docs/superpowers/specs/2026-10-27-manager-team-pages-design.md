# Manager and team pages: banners, career timeline, all-time team — design

Date: 2026-10-27. Mockups: `.superpowers/brainstorm/32356-1793167410/content/manager-banner.html`, `career-timeline.html` (git-ignored).

## Decided with Mathias

1. **Rivals** moves to the manager page's right column, under League records.
2. **Banners.** `ProfileHeader`, which both pages share, becomes a banner built like the game-of-the-week banner and the player banner:
   - The league blue wash.
   - The avatar cut on a diagonal, with a league-blue (`--accent`) stripe and a thin gold one.
   - The eyebrow as a condensed, letter-spaced kicker in the accent colour.
   - The title in the condensed display type, upper-case.
   - The six tiles on the right, on translucent dark plates.
   - **The existing championship `Pennant`, unchanged**, hanging from the top edge.
   - Badges, chips and the strip keep their places.
   - On phones the avatar becomes a band across the top and everything else stacks below.
3. **PPG history is replaced by a Career timeline** on the manager page.
   - One stop per season, oldest first, with a gradient line through the medals.
   - **Medal:**
     - The site's `FinishIcon`: gold trophy for champion, silver for runner-up, bronze for third, the white toilet for last place, with a caption.
     - Off the podium: the regular-season finish ("8th", caption "Regular season").
     - The season in progress is in the accent colour, captioned "So far".
   - **Season card:**
     - year, plus "in progress" while the season is live
     - team name, falling back to "Team <manager>" when the league stored none
     - record, regular-season finish and points for
     - a "Points title" tag if he won it
     - his top scorer that season (most points while started): headshot, name, position, points started
   - **All season cards are the same height.**
4. **All-time team, single-game view:** only games a player started count. Bench weeks never qualify, and the "on the bench" note goes. The season view is unchanged (my call: it counts the player's whole season on the roster, as today).
5. **Single-week team:** each player shows his stat line (`statLine(pos, stats)`) for that game, and a total row sums the lineup's points.

## Left to the builder

Component names; where the timeline lines are computed (alongside `careerProfile` in `lib/teamProfile.ts` is the natural home); how game stats reach a `GamePick` (look up the game in `Season` by year, week and matchup, or carry them through).
