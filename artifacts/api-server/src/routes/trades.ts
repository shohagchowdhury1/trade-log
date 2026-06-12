import { Router } from "express";
import { db, tradesTable } from "@workspace/db";
import { eq, ilike, and, asc, desc, type SQL } from "drizzle-orm";
import { ListTradesQueryParams, CreateTradeBody, UpdateTradeParams, UpdateTradeBody, DeleteTradeParams } from "@workspace/api-zod";

const router = Router();

function calcPnl(side: string, entry: number, exit: number, shares: number): number {
  if (side === "Long") return (exit - entry) * shares;
  return (entry - exit) * shares;
}

function calcRr(entry: number, exit: number, stop: number): number {
  const reward = Math.abs(exit - entry);
  const risk = Math.abs(entry - stop);
  if (risk === 0) return 0;
  return Math.round((reward / risk) * 100) / 100;
}

function calcResult(pnl: number): string {
  return pnl > 0 ? "Win" : "Loss";
}

router.get("/trades", async (req, res) => {
  const parsed = ListTradesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }
  const { search, side, result, sortOrder } = parsed.data;

  const conditions: SQL[] = [];
  if (search) conditions.push(ilike(tradesTable.ticker, `%${search}%`));
  if (side) conditions.push(eq(tradesTable.side, side));
  if (result) conditions.push(eq(tradesTable.result, result));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const order = sortOrder === "asc" ? asc(tradesTable.date) : desc(tradesTable.date);

  const trades = await db.select().from(tradesTable).where(whereClause).orderBy(order);

  const mapped = trades.map((t) => ({
    id: t.id,
    date: t.date,
    ticker: t.ticker,
    side: t.side,
    strategy: t.strategy ?? null,
    entryPrice: t.entryPrice,
    exitPrice: t.exitPrice,
    stopLoss: t.stopLoss,
    shares: t.shares,
    notes: t.notes ?? null,
    netPnl: t.netPnl,
    rr: t.rr,
    result: t.result,
    createdAt: t.createdAt.toISOString(),
  }));

  res.json(mapped);
});

router.get("/trades/stats", async (_req, res) => {
  const trades = await db.select().from(tradesTable).orderBy(asc(tradesTable.date));

  const totalTrades = trades.length;
  const wins = trades.filter((t) => t.result === "Win").length;
  const losses = totalTrades - wins;
  const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 10000) / 100 : 0;
  const netPnl = trades.reduce((sum, t) => sum + t.netPnl, 0);

  const grossProfit = trades.filter((t) => t.netPnl > 0).reduce((sum, t) => sum + t.netPnl, 0);
  const grossLoss = Math.abs(trades.filter((t) => t.netPnl < 0).reduce((sum, t) => sum + t.netPnl, 0));
  const profitFactor = grossLoss > 0 ? Math.round((grossProfit / grossLoss) * 100) / 100 : grossProfit > 0 ? 999 : 0;

  const pnlByTrade = trades.map((t, i) => ({
    tradeNumber: i + 1,
    pnl: t.netPnl,
    result: t.result as "Win" | "Loss",
    ticker: t.ticker,
    date: t.date,
  }));

  res.json({ totalTrades, winRate, netPnl, profitFactor, wins, losses, pnlByTrade });
});

router.post("/trades", async (req, res) => {
  const parsed = CreateTradeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;
  const netPnl = calcPnl(d.side, d.entryPrice, d.exitPrice, d.shares);
  const rr = calcRr(d.entryPrice, d.exitPrice, d.stopLoss);
  const result = calcResult(netPnl);

  const [trade] = await db
    .insert(tradesTable)
    .values({
      date: d.date,
      ticker: d.ticker,
      side: d.side,
      strategy: d.strategy ?? null,
      entryPrice: d.entryPrice,
      exitPrice: d.exitPrice,
      stopLoss: d.stopLoss,
      shares: d.shares,
      notes: d.notes ?? null,
      netPnl,
      rr,
      result,
    })
    .returning();

  res.status(201).json({
    ...trade,
    strategy: trade.strategy ?? null,
    notes: trade.notes ?? null,
    createdAt: trade.createdAt.toISOString(),
  });
});

router.put("/trades/:id", async (req, res) => {
  const paramsParsed = UpdateTradeParams.safeParse(req.params);
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = UpdateTradeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;
  const netPnl = calcPnl(d.side, d.entryPrice, d.exitPrice, d.shares);
  const rr = calcRr(d.entryPrice, d.exitPrice, d.stopLoss);
  const result = calcResult(netPnl);

  const [trade] = await db
    .update(tradesTable)
    .set({
      date: d.date,
      ticker: d.ticker,
      side: d.side,
      strategy: d.strategy ?? null,
      entryPrice: d.entryPrice,
      exitPrice: d.exitPrice,
      stopLoss: d.stopLoss,
      shares: d.shares,
      notes: d.notes ?? null,
      netPnl,
      rr,
      result,
    })
    .where(eq(tradesTable.id, paramsParsed.data.id))
    .returning();

  if (!trade) {
    res.status(404).json({ error: "Trade not found" });
    return;
  }

  res.json({
    ...trade,
    strategy: trade.strategy ?? null,
    notes: trade.notes ?? null,
    createdAt: trade.createdAt.toISOString(),
  });
});

router.delete("/trades/:id", async (req, res) => {
  const parsed = DeleteTradeParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  await db.delete(tradesTable).where(eq(tradesTable.id, parsed.data.id));
  res.json({ success: true });
});

export default router;
