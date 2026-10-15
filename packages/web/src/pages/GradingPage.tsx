import type { ReactNode } from 'react';
import { Link, useLoaderData } from 'react-router';
import { BASELINE_RANKS, BENCH_RANKS, CAPITAL_DECAY, POSITION_WEIGHTS, SURPLUS_PREMIUM, TOP_BONUS, TOP_BONUS_DECAY, capital, earnedCapital, expectedAt, surplusMultiplier, type Draft, type DraftPick, type Manager, type PlayerDirectory, type Season, type UserId } from '@fantasy-dash/core';
import Headshot from '../components/Headshot';
import PosPill from '../components/PosPill';
import { fmtSigned } from '../lib/format';
import { letterGrade, pickLabel } from '../lib/draft';
import { gradeTotals, gradingExamples, type GradingExample } from '../lib/grading';
import { playerName, playerPos, posColor } from '../lib/players';
import { players as directory } from '../data/load';

const signClass = (n: number) => (n > 0 ? 'text-win' : n < 0 ? 'text-loss' : 'text-muted');
const fmt1 = (n: number) => n.toFixed(1);
/** Picks before 1 are drawn in this much "better than pick 1" space on the x axis. */
const X_MIN = -30;
/** Example picks are drawn in a fixed palette so chart and table agree. */
const EXAMPLE_COLORS: Record<string, string> = { dominant: 'var(--pos-RB)', steal: 'var(--accent)', bust: 'var(--loss)', lateHit: 'var(--pos-TE)', lateMiss: 'var(--pos-K)' };

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="card">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <span className="num grid h-7 w-7 place-items-center rounded-full bg-accent/20 text-xs font-semibold text-accent">{n}</span>
        <h2 className="text-sm font-semibold uppercase tracking-wide">{title}</h2>
      </div>
      <div className="space-y-3 px-4 py-3 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

/** Scatter of every valued pick's contribution against pick number, with the fitted expectation curve and the examples' earned picks traced. */
function CurveChart({ draft, examples, players }: { draft: Draft; examples: GradingExample[]; players: PlayerDirectory }) {
  const curve = draft.expectedCurve;
  const valued = draft.picks.filter((p) => p.contribution !== null);
  if (!curve || !valued.length) return null;
  const W = 720; const H = 330; const L = 44; const R = 16; const T = 16; const B = 52;
  const xMax = Math.max(...valued.map((p) => p.pickNo));
  const yMax = Math.max(...valued.map((p) => p.contribution!)) * 1.12;
  const yMin = Math.min(...valued.map((p) => p.contribution!), curve.c) - 10;
  const x = (pick: number) => L + ((pick - X_MIN) / (xMax - X_MIN)) * (W - L - R);
  const y = (v: number) => T + ((yMax - v) / (yMax - yMin)) * (H - T - B);
  const path = Array.from({ length: 120 }, (_, i) => X_MIN + (i / 119) * (xMax - X_MIN)).map((p, i) => `${i ? 'L' : 'M'}${x(p).toFixed(1)},${y(expectedAt(curve, p)).toFixed(1)}`).join(' ');
  const yTicks = [0, 50, 100, 150, 200, 250, 300].filter((v) => v > yMin && v < yMax);
  const xTicks = [1, 20, 40, 60, 80, 100, 120, 140, 160].filter((v) => v <= xMax);
  const exampleIds = new Set(examples.map((e) => e.pick.pickNo));
  // Earned-pick labels alternate between two rows in x order so neighbours never overlap.
  const labelRow = new Map(examples.filter((e) => e.pick.earnedPick !== null).sort((a, b) => a.pick.earnedPick! - b.pick.earnedPick!).map((e, i) => [e.key, i % 2]));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Contribution by pick with the fitted expectation curve">
      <defs><clipPath id="curve-plot"><rect x={L} y={T} width={W - L - R} height={H - T - B} /></clipPath></defs>
      <rect x={L} y={T} width={x(1) - L} height={H - T - B} fill="var(--accent)" opacity={0.06} />
      <text x={(L + x(1)) / 2} y={H - B - 6} textAnchor="middle" fontSize={10} fill="var(--muted)">better than pick 1</text>
      {yTicks.map((v) => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--line)" /><text x={L - 6} y={y(v) + 3} textAnchor="end" fontSize={10} fill="var(--muted)" className="num">{v}</text></g>)}
      {xTicks.map((v) => <text key={v} x={x(v)} y={H - B + 14} textAnchor="middle" fontSize={10} fill="var(--muted)" className="num">{v}</text>)}
      <text x={W - R} y={H - B + 14} textAnchor="end" fontSize={10} fill="var(--muted)">pick</text>
      <text x={L} y={H - 6} fontSize={10} fill="var(--muted)">earned picks ↓</text>
      <text transform={`translate(12 ${(T + H - B) / 2}) rotate(-90)`} textAnchor="middle" fontSize={10} fill="var(--muted)">contribution (points over baseline)</text>
      <line x1={L} x2={W - R} y1={y(curve.c)} y2={y(curve.c)} stroke="var(--muted)" strokeDasharray="3 4" />
      <text x={W - R} y={y(curve.c) + 12} textAnchor="end" fontSize={10} fill="var(--muted)">off the board below the floor</text>
      <line x1={x(1)} x2={x(1)} y1={T} y2={H - B} stroke="var(--line)" />
      {valued.filter((p) => !exampleIds.has(p.pickNo)).map((p) => <circle key={p.pickNo} cx={x(p.pickNo)} cy={y(p.contribution!)} r={3} fill="var(--muted)" opacity={0.45} />)}
      <path d={path} fill="none" stroke="var(--ink)" strokeWidth={2} clipPath="url(#curve-plot)" />
      {examples.map(({ key, pick }, i) => {
        const color = EXAMPLE_COLORS[key];
        const cy = y(pick.contribution!);
        const dy = -8 - (i % 3) * 13;
        return (
          <g key={key}>
            {pick.earnedPick !== null && (
              <>
                <line x1={x(pick.pickNo)} x2={x(pick.earnedPick)} y1={cy} y2={cy} stroke={color} strokeDasharray="4 3" />
                <line x1={x(pick.earnedPick)} x2={x(pick.earnedPick)} y1={cy} y2={H - B} stroke={color} strokeDasharray="4 3" />
                <text x={x(pick.earnedPick)} y={H - B + 27 + (labelRow.get(key) ?? 0) * 11} textAnchor="middle" fontSize={10} fill={color} className="num">{fmt1(pick.earnedPick)}</text>
              </>
            )}
            <circle cx={x(pick.pickNo)} cy={cy} r={5} fill={color} stroke="var(--surface)" strokeWidth={1.5} />
            <text x={x(pick.pickNo) + 8} y={cy + dy} fontSize={11} fill={color} fontWeight={600}>{playerName(players, pick.playerId)}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** The capital curve on its own, with a few reference picks called out. */
function CapitalChart({ draft }: { draft: Draft }) {
  const W = 720; const H = 220; const L = 44; const R = 16; const T = 16; const B = 24;
  const xMax = Math.max(160, ...draft.picks.map((p) => p.pickNo));
  const ceiling = 100 + TOP_BONUS;
  const yMax = ceiling * 1.08;
  const x = (pick: number) => L + ((pick - X_MIN) / (xMax - X_MIN)) * (W - L - R);
  const y = (v: number) => T + ((yMax - v) / yMax) * (H - T - B);
  const path = Array.from({ length: 160 }, (_, i) => X_MIN + (i / 159) * (xMax - X_MIN)).map((p, i) => `${i ? 'L' : 'M'}${x(p).toFixed(1)},${y(earnedCapital(p)).toFixed(1)}`).join(' ');
  const yTicks = [0, 50, 100, 150, 200].filter((v) => v < yMax);
  const xTicks = [1, 20, 40, 60, 80, 100, 120, 140, 160].filter((v) => v <= xMax);
  const marks = [1, 30, 60, 130].filter((v) => v <= xMax);
  const shownTicks = xTicks.filter((v) => v < xMax - 8);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Draft capital by pick">
      <rect x={L} y={T} width={x(1) - L} height={H - T - B} fill="var(--accent)" opacity={0.06} />
      <text x={(L + x(1)) / 2} y={H - B - 6} textAnchor="middle" fontSize={10} fill="var(--muted)">better than pick 1</text>
      {yTicks.map((v) => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--line)" /><text x={L - 6} y={y(v) + 3} textAnchor="end" fontSize={10} fill="var(--muted)" className="num">{v}</text></g>)}
      {shownTicks.map((v) => <text key={v} x={x(v)} y={H - B + 14} textAnchor="middle" fontSize={10} fill="var(--muted)" className="num">{v}</text>)}
      <text x={W - R} y={H - B + 14} textAnchor="end" fontSize={10} fill="var(--muted)">pick</text>
      <text transform={`translate(12 ${(T + H - B) / 2}) rotate(-90)`} textAnchor="middle" fontSize={10} fill="var(--muted)">draft capital</text>
      <line x1={L} x2={x(1)} y1={y(ceiling)} y2={y(ceiling)} stroke="var(--muted)" strokeDasharray="3 3" />
      <text x={L + 4} y={y(ceiling) - 4} fontSize={10} fill="var(--muted)" className="num">ceiling {ceiling}</text>
      <path d={path} fill="none" stroke="var(--ink)" strokeWidth={2} />
      {marks.map((v) => (
        <g key={v}>
          <circle cx={x(v)} cy={y(capital(v))} r={4} fill="var(--accent)" stroke="var(--surface)" strokeWidth={1.5} />
          <text x={x(v) + 8} y={y(capital(v)) - 6} fontSize={10} fill="var(--accent)" className="num">pick {v} = {capital(v).toFixed(0)}</text>
        </g>
      ))}
    </svg>
  );
}

/** Capital spent against capital earned for each example, as paired bars; the difference is the value. */
function ExampleBars({ examples, players }: { examples: GradingExample[]; players: PlayerDirectory }) {
  const max = Math.max(100, ...examples.map(({ pick }) => Math.max(capital(pick.pickNo), earnedCapital(pick.earnedPick))));
  const pct = (v: number) => `${Math.max(0.5, (v / max) * 100).toFixed(1)}%`;
  return (
    <div className="space-y-2">
      {examples.map(({ key, pick }) => {
        const color = EXAMPLE_COLORS[key];
        const spent = capital(pick.pickNo);
        const earned = earnedCapital(pick.earnedPick);
        return (
          <div key={key} className="grid grid-cols-[9rem_minmax(0,1fr)_3.5rem] items-center gap-3 text-xs">
            <span className="truncate font-medium" style={{ color }}>{playerName(players, pick.playerId)}</span>
            <span className="space-y-0.5">
              <span className="flex items-center gap-2"><span className="min-w-0 flex-1"><span className="block h-2 rounded-sm border" style={{ width: pct(spent), borderColor: color }} /></span><span className="num w-20 shrink-0 whitespace-nowrap text-muted">spent {spent.toFixed(0)}</span></span>
              <span className="flex items-center gap-2"><span className="min-w-0 flex-1"><span className="block h-2 rounded-sm" style={{ width: pct(earned), background: color }} /></span><span className="num w-20 shrink-0 whitespace-nowrap text-muted">earned {earned.toFixed(0)}</span></span>
            </span>
            <span className={`num text-right text-sm font-semibold ${signClass(pick.value!)}`}>{fmtSigned(pick.value!, 0)}</span>
          </div>
        );
      })}
    </div>
  );
}

function ExampleTable({ examples, managers, teams, players }: { examples: GradingExample[]; managers: Record<UserId, Manager>; teams: number; players: PlayerDirectory }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="section-label text-left"><th className="py-1.5 pr-3">Example</th><th className="py-1.5 pr-3">Player</th><th className="num py-1.5 pr-3 text-right">Pick</th><th className="num py-1.5 pr-3 text-right">Capital spent</th><th className="num py-1.5 pr-3 text-right">Contribution</th><th className="num py-1.5 pr-3 text-right">Earned pick</th><th className="num py-1.5 pr-3 text-right">Capital earned</th><th className="num py-1.5 pr-3 text-right">Premium</th><th className="num py-1.5 text-right">Value</th></tr>
        </thead>
        <tbody>
          {examples.map(({ key, label, pick: p }) => {
            const earned = earnedCapital(p.earnedPick);
            return (
              <tr key={key} className="border-t border-line">
                <td className="py-2 pr-3"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: EXAMPLE_COLORS[key] }} />{label}</td>
                <td className="py-2 pr-3">
                  <span className="flex items-center gap-2"><Headshot players={players} id={p.playerId} size={24} /><span className="font-medium">{playerName(players, p.playerId)}</span><PosPill pos={playerPos(players, p.playerId)} /><span className="text-xs text-muted">{managers[p.userId]?.displayName ?? p.userId}</span></span>
                </td>
                <td className="num py-2 pr-3 text-right">{pickLabel(p, teams)} <span className="text-muted">(#{p.pickNo})</span></td>
                <td className="num py-2 pr-3 text-right">{fmt1(capital(p.pickNo))}</td>
                <td className="num py-2 pr-3 text-right">{fmtSigned(p.contribution!, 1)}</td>
                <td className="num py-2 pr-3 text-right">{p.earnedPick === null ? <span className="text-muted">off the board</span> : fmt1(p.earnedPick)}</td>
                <td className="num py-2 pr-3 text-right">{fmt1(earned)}</td>
                <td className="num py-2 pr-3 text-right">{p.value! > 0 ? `×${surplusMultiplier(p.pickNo).toFixed(2)}` : <span className="text-muted">—</span>}</td>
                <td className={`num py-2 text-right font-semibold ${signClass(p.value!)}`}>{fmtSigned(p.value!, 1)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const POS_ORDER = ['QB', 'RB', 'WR', 'TE'];

export function GradingGuide({ season, players }: { season: Season; players: PlayerDirectory }) {
  const draft = season.draft!;
  const curve = draft.expectedCurve;
  const teams = draft.slotOrder.length;
  const examples = gradingExamples(draft);
  const totals = gradeTotals(draft);
  const dominant = examples.find((e) => e.key === 'dominant');
  const steal = examples.find((e) => e.key === 'steal');
  const lateMiss = examples.find((e) => e.key === 'lateMiss');
  const halfLife = Math.round(CAPITAL_DECAY * Math.LN2);
  const name = (p: DraftPick) => playerName(players, p.playerId);
  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold">How grading works</h1>
          <p className="text-xs text-muted">Worked through the completed <Link to={`/draft/${season.year}`} className="text-accent hover:underline">{season.year} draft</Link>. The same steps run on the current season every week, with points to date.</p>
        </div>
        <Link to="/draft" className="text-xs text-accent hover:underline">← Back to the draft board</Link>
      </header>

      <div className="card px-4 py-3 text-sm leading-relaxed">
        <p><strong>Every pick gets one number: draft capital gained.</strong> A pick spends capital (an early pick is worth a lot, a late pick very little). The player's production is converted into the pick where that much production is usually found in this season's draft, which is the capital the pick earned. Value is capital earned minus capital spent, with hits on cheap picks scaled up a little. A dominant player earns more than pick 1, a miss costs only what was spent, and a late dart that hits is worth the whole gap and then some.</p>
      </div>

      <Step n={1} title="Production over replacement">
        <p>Start with each player's season points under league scoring. Subtract the points of the last startable player at the position across the whole NFL player pool: the {BASELINE_RANKS.QB}th quarterback, {BASELINE_RANKS.RB}th running back, {BASELINE_RANKS.WR}th receiver and {BASELINE_RANKS.TE}th tight end (what a {teams}-team league starts, with flex spots split between RB and WR). This is <em>points over baseline</em>. Quarterbacks count at {POSITION_WEIGHTS.QB * 100}% because a one-QB league replaces them easily and prices them that way at the draft.</p>
        <p>Then floor it at bench level: a player below the {BENCH_RANKS.RB}th back or {BENCH_RANKS.WR}th receiver is worth "waiver-wire replacement", not infinitely bad. The floored, weighted number is the player's <em>contribution</em>. Kickers and defenses are streamed, so they are left out entirely. While a season is in progress, points are scaled so teams that have already had their bye are not behind.</p>
        <div className="overflow-x-auto">
          <table className="w-full max-w-xl text-sm">
            <thead><tr className="section-label text-left"><th className="py-1.5 pr-3">Position</th><th className="num py-1.5 pr-3 text-right">Baseline</th><th className="num py-1.5 pr-3 text-right">Points</th><th className="num py-1.5 pr-3 text-right">Bench line</th><th className="num py-1.5 text-right">Points</th></tr></thead>
            <tbody>
              {POS_ORDER.filter((pos) => draft.baselines[pos]).map((pos) => {
                const b = draft.baselines[pos];
                return (
                  <tr key={pos} className="border-t border-line">
                    <td className="py-1.5 pr-3"><span className="font-semibold" style={{ color: posColor(pos) }}>{pos}</span>{POSITION_WEIGHTS[pos] !== undefined ? <span className="ml-2 text-xs text-muted">× {POSITION_WEIGHTS[pos]}</span> : null}</td>
                    <td className="num py-1.5 pr-3 text-right">{pos}{b.baselineRank}</td>
                    <td className="num py-1.5 pr-3 text-right">{b.baselinePoints.toFixed(1)}</td>
                    <td className="num py-1.5 pr-3 text-right">{pos}{b.benchRank}</td>
                    <td className="num py-1.5 text-right">{b.benchPoints.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {dominant && <p className="text-muted">{season.year}: {name(dominant.pick)} scored {dominant.pick.seasonPoints.toFixed(1)}, the baseline at {playerPos(players, dominant.pick.playerId)} was {draft.baselines[playerPos(players, dominant.pick.playerId)]?.baselinePoints.toFixed(1)}, so the contribution is <span className="num">{fmtSigned(dominant.pick.contribution!, 1)}</span>.</p>}
      </Step>

      <Step n={2} title="What a pick usually returns">
        <p>Plot every valued pick's contribution against its pick number and fit a smooth decaying curve through the cloud. That curve is what a pick in each slot typically returned <em>in this draft</em>, so it adapts each year to how strong the class was. It levels off below zero late, because the typical late pick is a little worse than replacement.</p>
        {curve && <p className="text-muted">{season.year}: the curve expects <span className="num">{fmtSigned(expectedAt(curve, 1), 0)}</span> at pick 1, <span className="num">{fmtSigned(expectedAt(curve, 20), 0)}</span> at pick 20, <span className="num">{fmtSigned(expectedAt(curve, 60), 0)}</span> at pick 60 and settles near <span className="num">{fmtSigned(curve.c, 0)}</span>.</p>}
        <CurveChart draft={draft} examples={examples} players={players} />
      </Step>

      <Step n={3} title="Earned pick: run the curve backwards">
        <p>For each player, ask where on that curve their contribution sits. That x-position is the <em>earned pick</em>: the pick at which this much production is normally found. The dashed lines in the chart above trace it. A player who out-produces what pick 1 usually returns lands in the shaded region before pick 1. A player under the curve's floor has no earned pick at all; they are off the board.</p>
        {dominant && steal && (
          <p className="text-muted">
            {season.year}: {name(dominant.pick)} earned pick <span className="num">{dominant.pick.earnedPick === null ? '—' : fmt1(dominant.pick.earnedPick)}</span> from pick {dominant.pick.pickNo}. {name(steal.pick)} earned pick <span className="num">{steal.pick.earnedPick === null ? '—' : fmt1(steal.pick.earnedPick)}</span> from pick {steal.pick.pickNo}.{lateMiss ? ` ${name(lateMiss.pick)} (pick ${lateMiss.pick.pickNo}) is off the board.` : ''}
          </p>
        )}
      </Step>

      <Step n={4} title="Capital earned minus capital spent">
        <p>Picks are priced on a trade-value curve: pick 1 is worth 100 and the value halves every {halfLife} picks, so pick 30 is about {capital(30).toFixed(0)}, pick 60 about {capital(60).toFixed(0)} and pick 130 about {capital(130).toFixed(0)}. Off the board is worth 0.</p>
        <p>An earned pick before 1 does not keep compounding. Pick 1 is worth 100, and beating what pick 1 usually returns adds a bonus that approaches a ceiling of {TOP_BONUS} the further ahead the player lands (about {Math.round(TOP_BONUS * (1 - 1 / Math.E))} of it by {TOP_BONUS_DECAY} picks before 1). A monster season is worth at most {100 + TOP_BONUS}; it does not make one pick worth three first-rounders.</p>
        <p><strong>Value = capital at the earned pick − capital at the pick spent.</strong> The most you can lose is what you spent, so a round 13 whiff costs about {capital(teams * 12 + 1).toFixed(0)} while a round 1 whiff costs most of 100. Hits are judged on production, so a late pick that hits is worth the whole gap.</p>
        <p><strong>Hits get a surplus premium.</strong> The same production is worth more from a cheap pick than from an expensive one, because the cheap pick also left capital to spend elsewhere. A positive gain is multiplied by 1 plus {Math.round(SURPLUS_PREMIUM * 100)}% of the share of capital the pick saved: nothing extra at pick 1, about ×{surplusMultiplier(30).toFixed(2)} at pick 30, ×{surplusMultiplier(100).toFixed(2)} by pick 100. Misses are never scaled.</p>
        <CapitalChart draft={draft} />
        <ExampleBars examples={examples} players={players} />
        <ExampleTable examples={examples} managers={season.managers} teams={teams} players={players} />
      </Step>

      <Step n={5} title="From picks to grades">
        <p>A manager's draft value is the sum over their picks. Letter grades follow rank within the league, from A+ at the top to D at the bottom, so they compare managers against each other rather than against a fixed bar. The board's redraft position (where a player would go if the league redrafted on production today) is shown for context but does not enter the value.</p>
        <ol className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
          {totals.map(([userId, total], i) => (
            <li key={userId} className="flex items-center gap-3 border-t border-line py-1.5 text-sm">
              <span className="num w-5 text-xs text-muted">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate">{season.managers[userId]?.displayName ?? userId}</span>
              <span className={`num font-semibold ${signClass(total)}`}>{fmtSigned(total, 0)}</span>
              <span className="w-6 text-right font-bold">{letterGrade(i + 1, totals.length)}</span>
            </li>
          ))}
        </ol>
      </Step>

      <section className="card px-4 py-3 text-xs leading-relaxed text-muted">
        <p><strong className="text-ink">Fine print.</strong> Keepers are valued like any other pick at the slot they occupied. A traded player's value stays with the manager who drafted him; the board marks where he went. In season, everything is "to date": the curve is refitted every week, so a value can move as the rest of the draft fills in. Players with no games yet count as zero. Position changes (such as a two-way player) follow the league's configured overrides.</p>
      </section>
    </section>
  );
}

export default function GradingPage() {
  const season = useLoaderData() as Season | null;
  if (!season?.draft) return <p className="text-sm text-muted">No completed draft to walk through yet.</p>;
  return <GradingGuide season={season} players={directory} />;
}
