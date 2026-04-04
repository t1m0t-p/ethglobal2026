import type {
  PriceData,
  X402PaymentRequirements,
  X402PaymentPayload,
  X402PaymentResponse,
  PaymentSigner,
} from "../types/index.js";

const TOTAL_TIMEOUT_MS = 30_000;

function decodeBase64<T>(b64: string): T {
  return JSON.parse(Buffer.from(b64, "base64").toString("utf-8")) as T;
}

function encodeBase64(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64");
}

export async function fetchWithPayment(
  url: string,
  paymentSigner: PaymentSigner,
): Promise<{ priceData: PriceData; paymentResponse: X402PaymentResponse }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TOTAL_TIMEOUT_MS);

  try {
    // Step 1: Initial request (no payment)
    const initialResponse = await fetch(url, { signal: controller.signal });

    // If we get 200 directly, data is free
    if (initialResponse.ok) {
      const priceData = (await initialResponse.json()) as PriceData;
      return {
        priceData,
        paymentResponse: { success: true, transactionId: "free" },
      };
    }

    // If not 402, it's an unexpected error
    if (initialResponse.status !== 402) {
      throw new Error(
        `x402: unexpected status ${initialResponse.status} from ${url}`,
      );
    }

    // Step 2: Parse payment requirements from 402 response
    const requirementsHeader = initialResponse.headers.get("x-payment-required");
    if (!requirementsHeader) {
      throw new Error("x402: 402 response missing X-Payment-Required header");
    }

    const requirements = decodeBase64<X402PaymentRequirements>(requirementsHeader);
    if (!requirements.accepts || requirements.accepts.length === 0) {
      throw new Error("x402: payment requirements have no accepted payment methods");
    }

    console.log(
      `[x402-client] Payment required: ${requirements.accepts[0].amount} ${requirements.accepts[0].asset} to ${requirements.accepts[0].payTo}`,
    );

    // Step 3: Sign payment
    const paymentPayload: X402PaymentPayload = await paymentSigner(requirements);

    // Step 4: Retry with payment proof
    const paidResponse = await fetch(url, {
      signal: controller.signal,
      headers: {
        "X-Payment": encodeBase64(paymentPayload),
      },
    });

    if (!paidResponse.ok) {
      const body = await paidResponse.text();
      throw new Error(
        `x402: payment rejected — status ${paidResponse.status}: ${body}`,
      );
    }

    // Step 5: Extract payment confirmation and data
    const paymentResponseHeader = paidResponse.headers.get("x-payment-response");
    const paymentResponse: X402PaymentResponse = paymentResponseHeader
      ? decodeBase64<X402PaymentResponse>(paymentResponseHeader)
      : { success: true, transactionId: "unknown" };

    const priceData = (await paidResponse.json()) as PriceData;

    console.log(
      `[x402-client] Payment accepted — txn: ${paymentResponse.transactionId}`,
    );

    return { priceData, paymentResponse };
  } finally {
    clearTimeout(timeout);
  }
}

/** Mock payment signer for testing — returns a fake signature */
export function createMockPaymentSigner(workerId: string): PaymentSigner {
  return async (requirements: X402PaymentRequirements): Promise<X402PaymentPayload> => {
    const accepted = requirements.accepts[0];
    console.log(
      `[x402-client] Mock signing payment: ${accepted.amount} ${accepted.asset} → ${accepted.payTo}`,
    );
    return {
      x402Version: requirements.x402Version,
      scheme: accepted.scheme,
      payload: {
        signature: `mock-payment-${workerId}-${Date.now()}`,
        transactionId: `mock-txn-${workerId}-${Date.now()}`,
      },
    };
  };
}
