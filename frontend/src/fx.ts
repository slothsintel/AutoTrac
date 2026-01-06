// frontend/src/fx.ts
type FxCache = { rate: number; ts: number };

// Cache for 12 hours
const TTL_MS = 12 * 60 * 60 * 1000;

export async function getRateToGBP(from: string): Promise<number> {
  const cur = (from || "GBP").toUpperCase();
  if (cur === "GBP") return 1;

  const key = `fx_${cur}_GBP`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as FxCache;
      if (parsed?.rate && Date.now() - parsed.ts < TTL_MS) return parsed.rate;
    }
  } catch {
    // ignore cache parse errors
  }

  // Free endpoint (no key): exchangerate.host
  // If it ever fails, we fallback to 1.
  const url = `https://api.exchangerate.host/latest?base=${encodeURIComponent(
    cur
  )}&symbols=GBP`;

  const r = await fetch(url);
  if (!r.ok) throw new Error(`FX fetch failed: ${r.status}`);
  const data = await r.json();

  const rate = Number(data?.rates?.GBP);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error("Bad FX rate");

  try {
    localStorage.setItem(key, JSON.stringify({ rate, ts: Date.now() }));
  } catch {
    // ignore storage errors
  }

  return rate;
}

export async function toGBP(amount: number, currency?: string): Promise<number> {
  const cur = (currency || "GBP").toUpperCase();
  if (cur === "GBP") return amount;
  const rate = await getRateToGBP(cur);
  return amount * rate;
}
