import type { PriceData } from "../types/index.js";

const TIMEOUT_MS = 10_000;

interface PriceSource {
  name: string;
  url: string;
  extract: (data: unknown) => number;
}

const SOURCES: PriceSource[] = [
  {
    name: "coingecko",
    url: "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
    extract: (data) => (data as { bitcoin: { usd: number } }).bitcoin.usd,
  },
  {
    name: "kraken",
    url: "https://api.kraken.com/0/public/Ticker?pair=XBTUSD",
    extract: (data) => {
      const result = (data as { result: { XXBTZUSD: { c: [string] } } }).result.XXBTZUSD;
      return parseFloat(result.c[0]);
    },
  },
  {
    name: "binance",
    url: "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT",
    extract: (data) => parseFloat((data as { price: string }).price),
  },
];

async function fetchFromSource(source: PriceSource): Promise<{ name: string; price: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(source.url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`${source.name} returned ${response.status}`);
    }
    const data: unknown = await response.json();
    const price = source.extract(data);
    if (typeof price !== "number" || isNaN(price) || price <= 0) {
      throw new Error(`${source.name} returned invalid price: ${price}`);
    }
    return { name: source.name, price };
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchBTCPrice(): Promise<PriceData> {
  const results = await Promise.allSettled(SOURCES.map(fetchFromSource));

  const successful: { name: string; price: number }[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      successful.push(result.value);
    }
  }

  if (successful.length < 2) {
    const errors = results
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map((r) => String(r.reason));
    throw new Error(
      `Need at least 2 price sources, got ${successful.length}. Errors: ${errors.join("; ")}`,
    );
  }

  const sources = successful.map((s) => s.name);
  const prices = successful.map((s) => s.price);
  const average = prices.reduce((sum, p) => sum + p, 0) / prices.length;

  return {
    sources,
    prices,
    average: Math.round(average * 100) / 100,
  };
}
