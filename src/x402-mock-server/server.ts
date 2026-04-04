import express from "express";
import type {
  X402PaymentRequirements,
  X402PaymentPayload,
  X402PaymentResponse,
  PriceData,
} from "../types/index.js";
import { fetchBTCPrice } from "../services/price-fetcher.js";

const app = express();
const PORT = parseInt(process.env.X402_SERVER_PORT || "4020", 10);

const PAYMENT_REQUIREMENTS: X402PaymentRequirements = {
  x402Version: 2,
  accepts: [
    {
      scheme: "exact",
      network: "hedera:testnet",
      asset: "HBAR",
      amount: "1000000", // tinybars
      payTo: "0.0.MOCK_PAYEE",
    },
  ],
};

const HARDCODED_FALLBACK: PriceData = {
  sources: ["mock-coinbase", "mock-kraken", "mock-binance"],
  prices: [68420.5, 68415.3, 68425.1],
  average: 68420.3,
};

function log(method: string, path: string, status: number, detail: string): void {
  const ts = new Date().toISOString();
  console.log(`[x402-server] ${ts} | ${method} ${path} → ${status} | ${detail}`);
}

function encodeBase64(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64");
}

function decodeBase64<T>(b64: string): T | null {
  try {
    return JSON.parse(Buffer.from(b64, "base64").toString("utf-8")) as T;
  } catch {
    return null;
  }
}

function isValidPaymentPayload(payload: unknown): payload is X402PaymentPayload {
  if (typeof payload !== "object" || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return (
    typeof p.x402Version === "number" &&
    typeof p.scheme === "string" &&
    typeof p.payload === "object" &&
    p.payload !== null &&
    typeof (p.payload as Record<string, unknown>).signature === "string"
  );
}

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "x402-mock-server" });
});

// x402-protected BTC price endpoint
app.get("/api/v1/btc-price", async (req, res) => {
  const paymentHeader = req.headers["x-payment"] as string | undefined;

  // No payment header → 402 Payment Required
  if (!paymentHeader) {
    const encoded = encodeBase64(PAYMENT_REQUIREMENTS);
    res.setHeader("X-Payment-Required", encoded);
    log("GET", "/api/v1/btc-price", 402, "No payment — returning requirements");
    res.status(402).json({
      error: "Payment Required",
      message: "This endpoint requires x402 payment. See X-Payment-Required header.",
    });
    return;
  }

  // Validate payment header
  const payment = decodeBase64<X402PaymentPayload>(paymentHeader);
  if (!payment || !isValidPaymentPayload(payment)) {
    log("GET", "/api/v1/btc-price", 400, "Invalid payment payload");
    res.status(400).json({
      error: "Bad Request",
      message: "Invalid X-Payment header. Must be base64-encoded X402PaymentPayload.",
    });
    return;
  }

  // Payment accepted — fetch real prices or use fallback
  let priceData: PriceData;
  try {
    priceData = await fetchBTCPrice();
    log("GET", "/api/v1/btc-price", 200, `Real prices from ${priceData.sources.join(", ")}`);
  } catch {
    priceData = HARDCODED_FALLBACK;
    log("GET", "/api/v1/btc-price", 200, "Using hardcoded fallback prices");
  }

  const paymentResponse: X402PaymentResponse = {
    success: true,
    transactionId: `mock-txn-${Date.now()}`,
  };

  res.setHeader("X-Payment-Response", encodeBase64(paymentResponse));
  res.json(priceData);
});

// Only start if run directly (not imported)
import { fileURLToPath } from "url";
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  startServer();
}

export function startServer(port: number = PORT): Promise<ReturnType<typeof app.listen>> {
  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log(`[x402-server] Mock x402 server running on http://localhost:${port}`);
      console.log(`[x402-server] Endpoints:`);
      console.log(`  GET /health          — Health check`);
      console.log(`  GET /api/v1/btc-price — x402-protected BTC price`);
      resolve(server);
    });
  });
}

export { app };
