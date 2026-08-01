// Server-only AI validation via Anthropic Claude. Never import from client code.
export interface ValidationResult {
  relevance: number;
  quality: number;
  spam: number;
  confidence: number;
  feedback: string;
  recommendation: "approve" | "reject" | "review";
}

export interface ValidationInput {
  campaignTitle: string;
  campaignDescription: string;
  instructions?: string | null;
  proofType: string;
  proofText?: string | null;
  proofUrl?: string | null;
  hasImage?: boolean;
  trustScore?: number;
}

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022";

function fallback(reason: string): ValidationResult {
  return {
    relevance: 50,
    quality: 50,
    spam: 20,
    confidence: 40,
    feedback: reason,
    recommendation: "review",
  };
}

function extractJson(text: string): any {
  // Try direct parse, then fenced block, then first {...} chunk
  try { return JSON.parse(text); } catch {}
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try { return JSON.parse(fence[1].trim()); } catch {}
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  }
  throw new Error("Could not parse JSON from Claude response");
}

export async function runAiValidation(input: ValidationInput): Promise<ValidationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      relevance: 70, quality: 70, spam: 10, confidence: 65,
      feedback: "Anthropic API key not configured. Queued for manual review.",
      recommendation: "review",
    };
  }

  const trustNote = input.trustScore !== undefined
    ? `\nWorker trust score: ${input.trustScore}/100 (>=75 means established trustworthy worker; <25 means new/risky).`
    : "";

  const systemPrompt = `You are a strict but fair proof-validation AI for a reward platform.
Evaluate user submissions against campaign requirements. Detect spam, low effort, and irrelevant content.
Respond ONLY with a single JSON object — no prose, no markdown fences — matching exactly:
{
  "relevance": number 0-100,
  "quality": number 0-100,
  "spam": number 0-100 (higher = spammier),
  "confidence": number 0-100,
  "feedback": string (max 2 sentences),
  "recommendation": "approve" | "reject" | "review"
}`;

  const userPrompt = `CAMPAIGN
Title: ${input.campaignTitle}
Description: ${input.campaignDescription}
Instructions: ${input.instructions ?? "(none)"}
Required proof type: ${input.proofType}${trustNote}

SUBMISSION
Text: ${input.proofText ?? "(none)"}
URL: ${input.proofUrl ?? "(none)"}
Image attached: ${input.hasImage ? "yes" : "no"}

Rules:
- "approve" if confidence>=75 and spam<25
- "reject" if spam>60 or relevance<30
- otherwise "review"
Return the JSON object only.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 512,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!res.ok) {
      console.error("Anthropic error:", res.status, await res.text());
      return fallback("AI validation temporarily unavailable. Queued for manual review.");
    }

    const json = await res.json();
    const text: string = json?.content?.[0]?.text ?? "";
    if (!text) return fallback("Empty AI response. Queued for manual review.");

    const parsed = extractJson(text);
    const rec = parsed.recommendation;
    return {
      relevance: Number(parsed.relevance ?? 50),
      quality: Number(parsed.quality ?? 50),
      spam: Number(parsed.spam ?? 20),
      confidence: Number(parsed.confidence ?? 50),
      feedback: String(parsed.feedback ?? ""),
      recommendation: rec === "approve" || rec === "reject" ? rec : "review",
    };
  } catch (e) {
    console.error("AI validation failed:", e);
    return fallback("Validation error. Queued for manual review.");
  }
}
