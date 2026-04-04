import type { PriceData, PaymentSigner } from "../types/index.js";
import { fetchWithPayment } from "./x402-client.js";

// ──────────────────────────────────────────────
// IGeminiWorkerService — interface injectable dans WorkerAgent
// ──────────────────────────────────────────────

export interface IGeminiWorkerService {
  executeWithDescription(
    description: string,
    bountyContext: { taskId: string; reward: number },
  ): Promise<PriceData>;
}

// ──────────────────────────────────────────────
// MockGeminiWorkerService — aucune clé API, délègue à x402
// ──────────────────────────────────────────────

export class MockGeminiWorkerService implements IGeminiWorkerService {
  constructor(
    private readonly x402Url: string,
    private readonly paymentSigner: PaymentSigner,
  ) {}

  async executeWithDescription(
    description: string,
    bountyContext: { taskId: string; reward: number },
  ): Promise<PriceData> {
    console.log(
      `[mock-gemini-worker] No GEMINI_API_KEY — falling back to x402 fetch`,
    );
    console.log(
      `[mock-gemini-worker] Task: "${description}" (${bountyContext.taskId})`,
    );
    const { priceData } = await fetchWithPayment(this.x402Url, this.paymentSigner);
    return priceData;
  }
}

// ──────────────────────────────────────────────
// GeminiWorkerService — Gemini 2.5 Flash + Hedera Agent Kit via LangChain
// ──────────────────────────────────────────────

export class GeminiWorkerService implements IGeminiWorkerService {
  private readonly x402Url: string;
  private readonly paymentSigner: PaymentSigner;
  private readonly geminiApiKey: string;
  private readonly hederaAccountId: string;
  private readonly hederaPrivateKey: string;
  private readonly timeoutMs: number;

  constructor(
    x402Url: string,
    paymentSigner: PaymentSigner,
    geminiApiKey: string,
    hederaAccountId: string,
    hederaPrivateKey: string,
    timeoutMs = 120_000,
  ) {
    this.x402Url = x402Url;
    this.paymentSigner = paymentSigner;
    this.geminiApiKey = geminiApiKey;
    this.hederaAccountId = hederaAccountId;
    this.hederaPrivateKey = hederaPrivateKey;
    this.timeoutMs = timeoutMs;
  }

  async executeWithDescription(
    description: string,
    bountyContext: { taskId: string; reward: number },
  ): Promise<PriceData> {
    // Dynamic imports — aucune dépendance au chargement du module
    const { ChatGoogleGenerativeAI } = await import("@langchain/google-genai");
    const { createReactAgent } = await import("@langchain/langgraph/prebuilt");
    const { tool } = await import("@langchain/core/tools");
    const { z } = await import("zod");
    const { HederaLangchainToolkit, AgentMode } = await import("hedera-agent-kit") as {
      HederaLangchainToolkit: new (config: {
        client: unknown;
        configuration: {
          tools?: string[];
          context?: { mode: string; accountId: string };
        };
      }) => {
        getTools(): unknown[];
        getHederaAgentKitAPI(): unknown;
      };
      AgentMode: { AUTONOMOUS: string };
    };
    const { Client, AccountId, PrivateKey } = await import("@hashgraph/sdk");

    // ── Client Hedera pour l'Agent Kit ──
    // Note : utilise @hashgraph/sdk (interne au kit), pas @hiero-ledger/sdk
    const hederaClient = Client.forTestnet();
    hederaClient.setOperator(
      AccountId.fromString(this.hederaAccountId),
      PrivateKey.fromStringDer(this.hederaPrivateKey),
    );

    // ── Hedera Agent Kit — initialisation avec tous les tools HCS ──
    const toolkit = new HederaLangchainToolkit({
      client: hederaClient,
      configuration: {
        tools: ["submit_topic_message_tool", "get_topic_messages_query_tool"],
        context: {
          mode: AgentMode.AUTONOMOUS,
          accountId: this.hederaAccountId,
        },
      },
    });

    // L'API interne du kit expose run(method, arg) pour tous les tools
    const kitApi = toolkit.getHederaAgentKitAPI() as {
      run(method: string, arg: unknown): Promise<string>;
    };

    // ── Wrapper tools avec schemas Gemini-compatibles (pas de type[] ni anyOf) ──
    // toolkit.getTools() produit des schemas Zod avec .optional() → "type":["x","null"]
    // que Gemini rejette. On crée des wrappers avec z.object() simple et on délègue au kit.

    const hcsPublishTool = tool(
      async (input: { topicId: string; message: string }): Promise<string> => {
        console.log(`[gemini-worker] hcs_publish_message → topic ${input.topicId}`);
        const result = await kitApi.run("submit_topic_message_tool", {
          topicId: input.topicId,
          message: input.message,
        });
        return result;
      },
      {
        name: "hcs_publish_message",
        description:
          "Publish a message to a Hedera Consensus Service (HCS) topic. " +
          "Use this to broadcast data on Hedera.",
        schema: z.object({
          topicId: z.string().describe("HCS topic ID, e.g. '0.0.12345'"),
          message: z.string().describe("Message content to publish"),
        }),
      },
    );

    const hcsQueryTool = tool(
      async (input: { topicId: string }): Promise<string> => {
        console.log(`[gemini-worker] hcs_query_messages → topic ${input.topicId}`);
        const result = await kitApi.run("get_topic_messages_query_tool", { topicId: input.topicId });
        return result;
      },
      {
        name: "hcs_query_messages",
        description:
          "Query recent messages from a Hedera Consensus Service (HCS) topic. " +
          "Returns an array of messages.",
        schema: z.object({
          topicId: z.string().describe("HCS topic ID to query, e.g. '0.0.12345'"),
        }),
      },
    );

    // ── Tool custom : fetch BTC prix via x402 ──
    const x402PaymentSigner = this.paymentSigner;
    const x402ToolUrl = this.x402Url;

    const x402Tool = tool(
      async (_input: Record<string, never>): Promise<string> => {
        console.log(`[gemini-worker] Calling x402_fetch_btc_price...`);
        const { priceData, paymentResponse } = await fetchWithPayment(
          x402ToolUrl,
          x402PaymentSigner,
        );
        console.log(
          `[gemini-worker] x402 done — avg $${priceData.average} — txn: ${paymentResponse.transactionId}`,
        );
        return JSON.stringify(priceData);
      },
      {
        name: "x402_fetch_btc_price",
        description:
          "Fetch BTC price data from multiple exchange sources (CoinGecko, Kraken, Binance) " +
          "by making an x402 micropayment. Returns a JSON object: " +
          '{"sources": ["exchange1",...], "prices": [12345,...], "average": 12345.67}. ' +
          "Use this when the task requires fetching BTC price data.",
        schema: z.object({}),
      },
    );

    // ── Tool custom : Google Search (via @google/generative-ai googleSearchRetrieval) ──
    const geminiApiKeyForSearch = this.geminiApiKey;
    const googleSearchTool = tool(
      async (input: { query: string }): Promise<string> => {
        console.log(`[gemini-worker] Google Search: "${input.query}"`);
        try {
          const { GoogleGenerativeAI } = await import("@google/generative-ai");
          const genAI = new GoogleGenerativeAI(geminiApiKeyForSearch);
          const searchModel = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            tools: [{ googleSearchRetrieval: {} }],
          });
          const result = await searchModel.generateContent({
            contents: [{ role: "user", parts: [{ text: input.query }] }],
          });
          const text = result.response.text();
          console.log(`[gemini-worker] Search result (${text.length} chars): ${text.slice(0, 150)}...`);
          return text;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[gemini-worker] Google Search failed: ${msg}`);
          return `Search failed: ${msg}`;
        }
      },
      {
        name: "google_search",
        description:
          "Search the web using Google Search to find current real-world information. " +
          "Returns a text summary of search results. Use this for flight prices, travel info, news, etc.",
        schema: z.object({
          query: z.string().describe("Search query to retrieve from the web"),
        }),
      },
    );

    // ── LLM — Gemini 2.5 Flash ──
    const llm = new ChatGoogleGenerativeAI({
      model: "gemini-2.5-flash",
      apiKey: this.geminiApiKey,
      temperature: 0,
    });

    // ── Agent ReAct ──
    const allTools = [x402Tool, hcsPublishTool, hcsQueryTool, googleSearchTool] as Parameters<typeof createReactAgent>[0]["tools"];
    const agent = createReactAgent({ llm, tools: allTools });

    const systemPrompt =
      `You are a Worker agent in a decentralized labor market on Hedera.\n` +
      `Your job is to complete the given task by calling the appropriate tools.\n` +
      `Use google_search to find real-world information (flights, prices, news, etc.).\n` +
      `Use x402_fetch_btc_price specifically for BTC/crypto price data.\n` +
      `When you have all the data needed, output ONLY a JSON object in this exact format and nothing else:\n` +
      `{"sources": ["source1", "source2"], "prices": [123.45, 67.89], "average": 95.67}\n` +
      `Where:\n` +
      `- "sources": array of strings identifying data sources (exchanges, airlines, websites, routes, etc.)\n` +
      `- "prices": array of numbers (prices found, e.g. ticket prices in EUR, BTC prices in USD, etc.)\n` +
      `- "average": the best or most representative single price as a number\n` +
      `Do not add markdown fences. Do not add any text before or after the JSON object.`;

    const userPrompt =
      `Task: ${description}\n` +
      `Task ID: ${bountyContext.taskId}\n` +
      `Reward: ${bountyContext.reward} HBAR`;

    console.log(
      `[gemini-worker] Starting Gemini 2.5 Flash agent — task: "${description}"`,
    );

    // ── Exécution avec timeout ──
    const agentPromise = agent.invoke({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Gemini agent timeout after ${this.timeoutMs}ms`)),
        this.timeoutMs,
      ),
    );

    const result = await Promise.race([agentPromise, timeoutPromise]) as {
      messages: Array<{ content: unknown; _getType?: () => string }>;
    };

    return extractPriceData(result.messages);
  }
}

// ──────────────────────────────────────────────
// extractPriceData — parse la sortie de l'agent en PriceData
// ──────────────────────────────────────────────

function extractPriceData(
  messages: Array<{ content: unknown; _getType?: () => string }>,
): PriceData {
  // Cherche le dernier message AI (le résultat final de l'agent)
  const lastAiMessage = [...messages].reverse().find(
    (m) =>
      m._getType?.() === "ai" ||
      (m as { role?: string }).role === "assistant" ||
      (m as { role?: string }).role === "ai",
  );

  if (!lastAiMessage) {
    throw new Error("No AI message found in Gemini agent output");
  }

  // Extrait le texte du contenu (peut être string ou tableau de parts)
  let raw: string;
  if (typeof lastAiMessage.content === "string") {
    raw = lastAiMessage.content;
  } else if (Array.isArray(lastAiMessage.content)) {
    const textPart = (lastAiMessage.content as Array<{ type?: string; text?: string }>).find(
      (p) => p.type === "text",
    );
    raw = textPart?.text ?? JSON.stringify(lastAiMessage.content);
  } else {
    raw = JSON.stringify(lastAiMessage.content);
  }

  // Strip éventuels markdown fences
  const stripped = raw
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim();

  // Extraire l'objet JSON même s'il est entouré de texte
  const jsonMatch = stripped.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(
      `Cannot extract JSON from Gemini output: ${raw.slice(0, 300)}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error(`JSON parse failed on Gemini output: ${jsonMatch[0].slice(0, 200)}`);
  }

  const data = parsed as { sources?: unknown; prices?: unknown; average?: unknown };

  if (
    !Array.isArray(data.sources) ||
    !Array.isArray(data.prices) ||
    typeof data.average !== "number" ||
    (data.prices as number[]).length === 0 ||
    data.average <= 0
  ) {
    throw new Error(
      `Gemini output failed PriceData validation: ${jsonMatch[0].slice(0, 200)}`,
    );
  }

  return {
    sources: data.sources as string[],
    prices: (data.prices as number[]).map(Number),
    average: Math.round((data.average as number) * 100) / 100,
  };
}

// ──────────────────────────────────────────────
// Factory — sélectionne real vs mock selon GEMINI_API_KEY
// ──────────────────────────────────────────────

export function createGeminiWorkerService(
  x402Url: string,
  paymentSigner: PaymentSigner,
  opts?: {
    geminiApiKey?: string;
    hederaAccountId?: string;
    hederaPrivateKey?: string;
    timeoutMs?: number;
  },
): IGeminiWorkerService {
  const geminiApiKey = opts?.geminiApiKey ?? process.env.GEMINI_API_KEY;

  if (!geminiApiKey) {
    console.log("[gemini-worker] No GEMINI_API_KEY — using MockGeminiWorkerService");
    return new MockGeminiWorkerService(x402Url, paymentSigner);
  }

  const hederaAccountId =
    opts?.hederaAccountId ??
    process.env.WORKER_ACCOUNT_ID ??
    process.env.HEDERA_ACCOUNT_ID;

  const hederaPrivateKey =
    opts?.hederaPrivateKey ??
    process.env.WORKER_PRIVATE_KEY ??
    process.env.HEDERA_PRIVATE_KEY;

  if (!hederaAccountId || !hederaPrivateKey) {
    throw new Error(
      "GeminiWorkerService requires HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY (or WORKER_ variants)",
    );
  }

  console.log("[gemini-worker] GEMINI_API_KEY found — using GeminiWorkerService");
  return new GeminiWorkerService(
    x402Url,
    paymentSigner,
    geminiApiKey,
    hederaAccountId,
    hederaPrivateKey,
    opts?.timeoutMs,
  );
}
