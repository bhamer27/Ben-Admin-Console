// ─────────────────────────────────────────────────────────────────────────────
// Kowalski Trading Rules — industry-standard options flow parameters
// These are HARD RULES. They are checked before Claude is ever called.
// DO NOT relax them without careful deliberation.
// ─────────────────────────────────────────────────────────────────────────────

export const TRADING_RULES = {
  // ── Flow signal filters ────────────────────────────────────────────────────
  minPremium: 100_000,         // $100k minimum premium (institutional size)
  minVolOiRatio: 0.3,          // vol/OI >= 0.3 signals unusual activity

  // ── DTE window ─────────────────────────────────────────────────────────────
  minDte: 21,                  // no short-dated gamma traps
  maxDte: 60,                  // cap at 60 — theta drag beyond is too high
  preferredDteMin: 21,         // sweet spot
  preferredDteMax: 45,

  // ── IV & delta ────────────────────────────────────────────────────────────
  maxIvRank: 50,               // avoid buying expensive premium
  minDelta: 0.20,              // no OTM lottery tickets
  maxDelta: 0.60,              // no deep ITM (directional, not leverage)

  // ── Position sizing (fixed fractional) ────────────────────────────────────
  maxAllocationPct: 0.02,      // 2% per trade ($2k on $100k)
  maxTotalExposurePct: 0.10,   // max 10% of portfolio in options total
  reduceSizeAboveVix25: true,  // cut to 1% allocation when VIX > 25
  maxVixForEntry: 35,          // no new positions when VIX > 35

  // ── Exit rules ────────────────────────────────────────────────────────────
  hardStopPct: 0.35,           // -35% hard stop (options need room to breathe)
  t1TargetPct: 0.50,           // +50% sell half, move stop to breakeven
  t2TargetPct: 1.00,           // +100% close rest
  trailingStopBelowPeakPct: 0.25, // after T1, trail at 25% below peak
  timeDteCutoff: 10,           // exit at 10 DTE regardless

  // ── Concentration ─────────────────────────────────────────────────────────
  maxOpenPositions: 3,
  maxCorrelatedPositions: 2,   // max 2 positions in same sector/direction

  // ── Circuit breakers ──────────────────────────────────────────────────────
  dailyLossLimitPct: 0.03,     // -3% portfolio daily loss → halt new entries
  maxConsecutiveLosses: 3,     // 3 consecutive losers → pause + alert

  // ── Liquidity minimums ────────────────────────────────────────────────────
  minOptionPrice: 0.50,        // no sub-50¢ lottery tickets
  minOpenInterest: 200,        // reasonable liquidity floor

  // ── Signal type priority ──────────────────────────────────────────────────
  // Higher score = higher priority consideration
  signalPriority: {
    SWEEP: 100,
    GOLDEN_SWEEP: 95,
    FLOOR: 80,
    BLOCK: 60,
    REPEATED_HITS: 50,
  } as Record<string, number>,

  // ── Claude decision threshold ─────────────────────────────────────────────
  minScoreToTake: 75,          // only TAKE when score >= 75

  // ── Misc ──────────────────────────────────────────────────────────────────
  pdtProtection: true,
  maxDayTrades: 3,

  // ── Notifications ─────────────────────────────────────────────────────────
  discordWebhook: process.env.TARS_DISCORD_WEBHOOK ?? "",
  benDiscordId: process.env.DISCORD_USER_ID ?? "1473483249404874922",
} as const;

export function isFriday(): boolean {
  return new Date().getDay() === 5;
}

export function hardRuleCheck(params: {
  dte: number;
  ivRank: number;
  delta: number;
  optionPrice: number;
  openInterest: number;
  openPositionCount: number;
  premium: number;
  volOiRatio?: number;
  vix?: number | null;
}): { pass: boolean; reason?: string } {
  const {
    dte, ivRank, delta, optionPrice, openInterest,
    openPositionCount, premium, volOiRatio, vix,
  } = params;

  if (isFriday()) {
    return { pass: false, reason: "Friday hard cutoff: no new positions" };
  }
  if (vix != null && vix > TRADING_RULES.maxVixForEntry) {
    return { pass: false, reason: `VIX ${vix.toFixed(1)} > max ${TRADING_RULES.maxVixForEntry} — market too volatile` };
  }
  if (premium < TRADING_RULES.minPremium) {
    return { pass: false, reason: `Premium $${(premium / 1000).toFixed(0)}k < minimum $${TRADING_RULES.minPremium / 1000}k` };
  }
  if (dte < TRADING_RULES.minDte) {
    return { pass: false, reason: `DTE ${dte} < minimum ${TRADING_RULES.minDte}` };
  }
  if (dte > TRADING_RULES.maxDte) {
    return { pass: false, reason: `DTE ${dte} > maximum ${TRADING_RULES.maxDte}` };
  }
  if (ivRank > TRADING_RULES.maxIvRank) {
    return { pass: false, reason: `IV Rank ${ivRank} > max ${TRADING_RULES.maxIvRank} (buying expensive premium)` };
  }
  if (delta < TRADING_RULES.minDelta) {
    return { pass: false, reason: `Delta ${delta.toFixed(2)} < min ${TRADING_RULES.minDelta} (far OTM lottery ticket)` };
  }
  if (delta > TRADING_RULES.maxDelta) {
    return { pass: false, reason: `Delta ${delta.toFixed(2)} > max ${TRADING_RULES.maxDelta} (deep ITM)` };
  }
  if (optionPrice < TRADING_RULES.minOptionPrice) {
    return { pass: false, reason: `Price $${optionPrice.toFixed(2)} < min $${TRADING_RULES.minOptionPrice}` };
  }
  if (openInterest > 0 && openInterest < TRADING_RULES.minOpenInterest) {
    return { pass: false, reason: `OI ${openInterest} < min ${TRADING_RULES.minOpenInterest} (illiquid)` };
  }
  if (volOiRatio != null && volOiRatio < TRADING_RULES.minVolOiRatio) {
    return { pass: false, reason: `Vol/OI ratio ${volOiRatio.toFixed(2)} < min ${TRADING_RULES.minVolOiRatio} (low unusual activity)` };
  }
  if (openPositionCount >= TRADING_RULES.maxOpenPositions) {
    return { pass: false, reason: `At max ${TRADING_RULES.maxOpenPositions} open positions` };
  }
  return { pass: true };
}

/** Get effective allocation % based on current VIX level */
export function getEffectiveAllocationPct(vix: number | null): number {
  if (vix != null && TRADING_RULES.reduceSizeAboveVix25 && vix > 25) {
    return 0.01; // half size in high-vol regime
  }
  return TRADING_RULES.maxAllocationPct;
}

/** Score boost based on signal type priority */
export function getSignalPriorityBoost(signalTypes: string[]): number {
  let maxBoost = 0;
  for (const sig of signalTypes) {
    const normalized = sig.toUpperCase().replace(/[^A-Z_]/g, "_");
    for (const [key, score] of Object.entries(TRADING_RULES.signalPriority)) {
      if (normalized.includes(key)) {
        maxBoost = Math.max(maxBoost, score);
        break;
      }
    }
  }
  return maxBoost;
}
