import Anthropic from "@anthropic-ai/sdk";
import { TRADING_RULES, hardRuleCheck, getEffectiveAllocationPct, getSignalPriorityBoost } from "./tradingRules.js";
import { db, flowAlertsTable, signalDecisionsTable, optionsPositionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { executeEntry } from "./tradierExecutor.js";
import { sendTarsAlert } from "./tarsDiscord.js";
import { logger } from "./logger.js";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface UwAlert {
  id: string;
  ticker: string;
  type?: string;              // "call" | "put"
  sentiment?: string;         // "bullish" | "bearish"
  premium?: number;           // dollars
  dte?: number;
  strike?: number;
  expiry?: string;
  iv_rank?: number;
  delta?: number | string;
  volume?: number;
  open_interest?: number;
  option_symbol?: string;
  description?: string;
  signals?: string[];         // signal type tags e.g. ["SWEEP", "GOLDEN_SWEEP"]
  [key: string]: unknown;
}

// ── Shared state for circuit breakers ────────────────────────────────────────
let consecutiveLosses = 0;
let dailyLossDollars = 0;
let dailyLossDate = "";

export function recordTradeLoss(lossDollars: number): void {
  const today = new Date().toDateString();
  if (dailyLossDate !== today) {
    dailyLossDollars = 0;
    dailyLossDate = today;
  }
  dailyLossDollars += Math.abs(lossDollars);
  consecutiveLosses++;
}

export function recordTradeWin(): void {
  consecutiveLosses = 0;
}

export function resetDailyLoss(): void {
  dailyLossDollars = 0;
  dailyLossDate = new Date().toDateString();
}

// ── Macro context ─────────────────────────────────────────────────────────────
export interface MacroContext {
  vix: number | null;
  spyTrend: string;
  spyChangePct: number | null;
}

export async function fetchMacroContext(): Promise<MacroContext> {
  try {
    const [vixRes, spyRes] = await Promise.all([
      fetch("https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=5d", {
        signal: AbortSignal.timeout(8_000),
      }),
      fetch("https://query1.finance.yahoo.com/v8/finance/chart/SPY?interval=1d&range=5d", {
        signal: AbortSignal.timeout(8_000),
      }),
    ]);

    let vix: number | null = null;
    if (vixRes.ok) {
      const data = await vixRes.json() as {
        chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> };
      };
      vix = data?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
    }

    let spyTrend = "unknown";
    let spyChangePct: number | null = null;
    if (spyRes.ok) {
      const spyData = await spyRes.json() as {
        chart?: { result?: Array<{ indicators?: { quote?: Array<{ close?: number[] }> } }> };
      };
      const closes = spyData?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
      const valid = closes.filter((c): c is number => c != null);
      if (valid.length >= 2) {
        const first = valid[0];
        const last = valid[valid.length - 1];
        spyChangePct = ((last - first) / first) * 100;
        spyTrend =
          spyChangePct >= 1.5 ? "strong uptrend" :
          spyChangePct >= 0.5 ? "mild uptrend" :
          spyChangePct <= -1.5 ? "strong downtrend" :
          spyChangePct <= -0.5 ? "mild downtrend" : "flat/neutral";
      }
    }

    return { vix, spyTrend, spyChangePct };
  } catch (err) {
    logger.warn({ err }, "Failed to fetch macro context");
    return { vix: null, spyTrend: "unknown", spyChangePct: null };
  }
}

async function getOpenPositions() {
  return db
    .select()
    .from(optionsPositionsTable)
    .where(eq(optionsPositionsTable.status, "open"));
}

// ── Claude decision schema ────────────────────────────────────────────────────
interface ClaudeDecision {
  decision: "TAKE" | "SKIP";
  score: number;             // 0–100
  reasoning: string;         // 2-3 sentence narrative
  rejectionReason?: string;  // present on SKIP
  conviction: "HIGH" | "MEDIUM" | "LOW";
  catalysts: string[];       // what smart money is betting on
}

async function askClaude(prompt: string): Promise<ClaudeDecision> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("");

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`Claude returned no JSON: ${text.slice(0, 200)}`);

  return JSON.parse(jsonMatch[0]) as ClaudeDecision;
}

// ── Main analysis function ────────────────────────────────────────────────────
export async function analyzeSignal(alert: UwAlert): Promise<void> {
  logger.info({ ticker: alert.ticker, id: alert.id }, "Analyzing UW signal");

  const direction = (alert.type ?? alert.sentiment ?? "unknown").toLowerCase();
  const dte = alert.dte ?? 0;
  const ivRank = alert.iv_rank ?? 0;
  const rawDelta = typeof alert.delta === "string" ? parseFloat(alert.delta) : (alert.delta ?? 0);
  const delta = Math.abs(rawDelta); // normalize: puts come in negative
  const premium = alert.premium ?? 0;
  // UW option price is not directly available; estimate from premium/100 as a rough proxy
  const optionPrice = (alert.volume && alert.volume > 0)
    ? (premium / (alert.volume * 100))
    : (premium / 10_000); // fallback estimate
  const openInterest = alert.open_interest ?? 0;
  const volume = alert.volume ?? 0;
  const volOiRatio = openInterest > 0 ? volume / openInterest : null;

  // Fetch macro first (needed for VIX hard rule)
  const macro = await fetchMacroContext();

  // ── Circuit breaker checks ───────────────────────────────────────────────
  const portfolioValue = parseFloat(process.env.PORTFOLIO_VALUE ?? "100000");
  const today = new Date().toDateString();
  if (dailyLossDate !== today) {
    dailyLossDollars = 0;
    dailyLossDate = today;
  }
  const dailyLossLimit = portfolioValue * TRADING_RULES.dailyLossLimitPct;

  if (dailyLossDollars >= dailyLossLimit) {
    const reason = `Daily loss limit reached: -$${dailyLossDollars.toFixed(0)} >= $${dailyLossLimit.toFixed(0)}`;
    logger.warn({ reason }, "Circuit breaker: daily loss limit");
    await sendTarsAlert("CIRCUIT_BREAKER", { reason });
    await db.insert(signalDecisionsTable).values({
      alertId: alert.id,
      decision: "SKIP",
      reasoning: reason,
      score: 0,
      rejectionReason: reason,
    }).catch(() => undefined);
    return;
  }

  if (consecutiveLosses >= TRADING_RULES.maxConsecutiveLosses) {
    const reason = `${consecutiveLosses} consecutive losses — pausing new entries`;
    logger.warn({ reason }, "Circuit breaker: consecutive losses");
    await sendTarsAlert("CIRCUIT_BREAKER", { reason, details: "Reset consecutiveLosses counter to resume." });
    await db.insert(signalDecisionsTable).values({
      alertId: alert.id,
      decision: "SKIP",
      reasoning: reason,
      score: 0,
      rejectionReason: reason,
    }).catch(() => undefined);
    return;
  }

  // ── Save flow alert to DB ─────────────────────────────────────────────────
  await db
    .insert(flowAlertsTable)
    .values({
      id: alert.id,
      ticker: alert.ticker,
      direction,
      premium,
      dte,
      strike: alert.strike ?? null,
      expiry: alert.expiry ?? null,
      ivRank: ivRank || null,
      delta: String(rawDelta || ""),
      uwSignals: alert.signals ?? [],
      analyzedAt: new Date(),
    })
    .onConflictDoNothing();

  // ── Hard rule check ───────────────────────────────────────────────────────
  const openPositions = await getOpenPositions();
  const ruleResult = hardRuleCheck({
    dte,
    ivRank,
    delta,
    optionPrice,
    openInterest,
    openPositionCount: openPositions.length,
    premium,
    volOiRatio: volOiRatio ?? undefined,
    vix: macro.vix,
  });

  if (!ruleResult.pass) {
    logger.info({ ticker: alert.ticker, reason: ruleResult.reason }, "Hard rule failed — skipping");
    await db.insert(signalDecisionsTable).values({
      alertId: alert.id,
      decision: "SKIP",
      reasoning: ruleResult.reason ?? "Hard rule failed",
      score: 0,
      rejectionReason: ruleResult.reason,
    });
    return;
  }

  // ── Duplicate position check ──────────────────────────────────────────────
  const existingPosition = openPositions.find((p) => p.ticker === alert.ticker);
  if (existingPosition) {
    const reason = `Already have open ${existingPosition.direction} position in ${alert.ticker}`;
    logger.info({ ticker: alert.ticker }, reason);
    await db.insert(signalDecisionsTable).values({
      alertId: alert.id,
      decision: "SKIP",
      reasoning: reason,
      score: 0,
      rejectionReason: reason,
    });
    return;
  }

  // ── Build signal priority context ─────────────────────────────────────────
  const signals = alert.signals ?? [];
  const priorityBoost = getSignalPriorityBoost(signals);
  const signalTypeDesc = signals.length > 0
    ? `Signal types: ${signals.join(", ")} (priority boost: +${priorityBoost})`
    : "No signal type tags";

  const effectiveAllocation = getEffectiveAllocationPct(macro.vix);
  const sizeNote = macro.vix && macro.vix > 25
    ? `⚠️ VIX ${macro.vix.toFixed(1)} > 25 → reduced size: 1% allocation ($${(portfolioValue * 0.01).toFixed(0)})`
    : `Normal size: 2% allocation ($${(portfolioValue * effectiveAllocation).toFixed(0)})`;

  // ── Claude prompt ─────────────────────────────────────────────────────────
  const prompt = `You are Kowalski, a disciplined autonomous options trader. Analyze this UW flow signal.

IMPORTANT: Be highly selective. Most signals should be SKIP. Only TAKE when you see clear evidence of institutional conviction with a specific catalyst thesis. Score >= 75 AND conviction HIGH or MEDIUM required to TAKE.

## UW Flow Signal
- Ticker: ${alert.ticker}
- Direction: ${direction.toUpperCase()}
- Premium: $${(premium / 1000).toFixed(0)}k
- DTE: ${dte} (preferred range: 21-45)
- Strike: $${alert.strike ?? "unknown"}
- Expiry: ${alert.expiry ?? "unknown"}
- IV Rank: ${ivRank} (max allowed: 50)
- Delta: ${rawDelta} (abs: ${delta.toFixed(2)}, range 0.20-0.60)
- Volume: ${volume.toLocaleString()}
- Open Interest: ${openInterest.toLocaleString()}
- Vol/OI Ratio: ${volOiRatio != null ? volOiRatio.toFixed(2) : "unknown"} (min: 0.30)
- Option Symbol: ${alert.option_symbol ?? "unknown"}
${signalTypeDesc}
${alert.description ? `- UW Description: ${alert.description}` : ""}

## Macro Context
- VIX: ${macro.vix?.toFixed(1) ?? "unknown"} (entry blocked above 35)
- SPY 5-day trend: ${macro.spyTrend}${macro.spyChangePct != null ? ` (${macro.spyChangePct >= 0 ? "+" : ""}${macro.spyChangePct.toFixed(2)}%)` : ""}

## Current Open Positions (${openPositions.length}/${TRADING_RULES.maxOpenPositions})
${openPositions.length === 0 ? "None — portfolio has capacity" : openPositions.map((p) => `- ${p.ticker} ${p.direction.toUpperCase()} $${p.strike} exp ${p.expiry} (entry $${p.entryPrice}, stop $${p.stopPrice})`).join("\n")}

## Position Sizing
${sizeNote}

## What I Need From You
1. Is this genuine institutional flow? (SWEEP and GOLDEN_SWEEP get highest weight)
2. What is smart money specifically betting on? What's the catalyst?
3. Does the macro environment support this directional bet?
4. Is there adequate liquidity and a clean risk/reward setup?

Be critical. The bar is high. Reject noise.

Respond with ONLY valid JSON (no markdown, no text outside the JSON object):
{
  "decision": "TAKE" or "SKIP",
  "score": 0-100,
  "reasoning": "2-3 sentences explaining your thesis or why you're skipping",
  "rejectionReason": "specific reason if SKIP, null if TAKE",
  "conviction": "HIGH" or "MEDIUM" or "LOW",
  "catalysts": ["list", "of", "specific", "catalysts", "or", "empty", "array"]
}`;

  let claudeResult: ClaudeDecision;
  try {
    claudeResult = await askClaude(prompt);
  } catch (err) {
    logger.error({ err, ticker: alert.ticker }, "Claude analysis failed");
    return;
  }

  // Enforce minimum score + conviction requirements
  const meetsThreshold =
    claudeResult.decision === "TAKE" &&
    claudeResult.score >= TRADING_RULES.minScoreToTake &&
    (claudeResult.conviction === "HIGH" || claudeResult.conviction === "MEDIUM");

  if (claudeResult.decision === "TAKE" && !meetsThreshold) {
    logger.info(
      { ticker: alert.ticker, score: claudeResult.score, conviction: claudeResult.conviction },
      "Claude said TAKE but failed score/conviction threshold — converting to SKIP",
    );
    claudeResult.decision = "SKIP";
    claudeResult.rejectionReason = `Score ${claudeResult.score} < ${TRADING_RULES.minScoreToTake} or conviction too low (${claudeResult.conviction})`;
  }

  // ── Save decision ─────────────────────────────────────────────────────────
  await db.insert(signalDecisionsTable).values({
    alertId: alert.id,
    decision: claudeResult.decision,
    reasoning: `[${claudeResult.conviction}] ${claudeResult.reasoning}${claudeResult.catalysts.length ? ` Catalysts: ${claudeResult.catalysts.join(", ")}.` : ""}`,
    score: claudeResult.score,
    rejectionReason: claudeResult.rejectionReason ?? null,
  });

  logger.info(
    { ticker: alert.ticker, decision: claudeResult.decision, score: claudeResult.score, conviction: claudeResult.conviction },
    "Signal decision recorded",
  );

  // ── Execute or alert ──────────────────────────────────────────────────────
  if (claudeResult.decision === "TAKE") {
    const optionSymbol = alert.option_symbol ?? "";
    if (!optionSymbol) {
      logger.warn({ ticker: alert.ticker }, "No option symbol — cannot execute entry");
      return;
    }

    try {
      const positionId = await executeEntry({
        alertId: alert.id,
        ticker: alert.ticker,
        optionSymbol,
        direction,
        strike: alert.strike ?? 0,
        expiry: alert.expiry ?? "",
        optionPrice,
        vix: macro.vix,
      });

      const alloc = getEffectiveAllocationPct(macro.vix);
      const contracts = Math.max(1, Math.floor((portfolioValue * alloc) / (optionPrice * 100)));
      const stopP = +(optionPrice * (1 - TRADING_RULES.hardStopPct)).toFixed(2);
      const t1P = +(optionPrice * (1 + TRADING_RULES.t1TargetPct)).toFixed(2);
      const t2P = +(optionPrice * (1 + TRADING_RULES.t2TargetPct)).toFixed(2);

      await sendTarsAlert("TRADE_ENTERED", {
        ticker: alert.ticker,
        direction,
        strike: alert.strike ?? 0,
        expiry: alert.expiry ?? "unknown",
        contracts,
        entryPrice: optionPrice.toFixed(2),
        stopPrice: String(stopP),
        t1Price: String(t1P),
        t2Price: String(t2P),
        score: claudeResult.score,
        reasoning: claudeResult.reasoning,
      });

      logger.info({ positionId, ticker: alert.ticker }, "Entry executed successfully");
    } catch (err) {
      logger.error({ err, ticker: alert.ticker }, "Entry execution failed");
    }
  } else if (claudeResult.score >= 75) {
    // High-conviction skip worth flagging (near-miss)
    await sendTarsAlert("HIGH_SCORE_SKIP", {
      ticker: alert.ticker,
      direction,
      score: claudeResult.score,
      reasoning: claudeResult.reasoning,
      skipReason: claudeResult.rejectionReason ?? claudeResult.reasoning,
    });
  }
}
