import { YoutubeTranscript } from "youtube-transcript";
import OpenAI from "openai";

// Note: In a real app, you would initialize this with process.env.GROQ_API_KEY
// The OpenAI SDK is fully compatible with Groq's API.
const openai = new OpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.GROQ_API_KEY || "dummy_key_for_scaffolding",
});

export async function fetchTranscript(videoId: string): Promise<string> {
  try {
    const transcriptArray = await YoutubeTranscript.fetchTranscript(videoId);
    // Combine all transcript lines into a single string
    return transcriptArray.map((t) => t.text).join(" ");
  } catch (error) {
    console.error(`Failed to fetch transcript for video ${videoId}:`, error);
    throw new Error("Transcript fetch failed");
  }
}

export type ComplianceReport = {
  riskScore: number;
  originalityScore: number;
  flags: Array<{
    severity: "low" | "medium" | "high" | "critical";
    type: "policy_violation" | "clickbait_thumbnail" | "semantic_redundancy";
    description: string;
    impact: string;
  }>;
};

export async function analyzeVideoCompliance(
  transcript: string,
  videoTitle: string
): Promise<ComplianceReport> {
  // If no real API key is present, return a mocked response for local testing
  if (openai.apiKey === "dummy_key_for_scaffolding") {
    console.warn("Using dummy OpenAI key. Returning mocked compliance data.");
    return {
      riskScore: 72,
      originalityScore: 85,
      flags: [
        {
          severity: "medium",
          type: "policy_violation",
          description: "Detected minor profanity in the first 30 seconds which may impact advertiser friendliness.",
          impact: "-15 pts monetization",
        },
      ],
    };
  }

  const prompt = `
    You are a strict YouTube Trust & Safety and Forensic Compliance AI.
    Analyze the following video title and transcript.
    
    Video Title: ${videoTitle}
    Transcript: ${transcript.substring(0, 5000)} // Truncating for cost/scaffolding purposes
    
    Evaluate the risk score (0-100, where 100 is perfectly safe and compliant) and originality score.
    Identify any flags based on YouTube Community Guidelines (profanity, dangerous content, spam, misleading).
  `;

  const response = await openai.chat.completions.create({
    model: "llama-3.1-8b-instant", // Using Groq's ultra-fast Llama 3.1 model
    messages: [
      {
        role: "system",
        content: "You output JSON strictly matching the ComplianceReport schema requested.",
      },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" }, // In a real app, use structured outputs or tools for strict typing
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error("No response from OpenAI");
  }

  try {
    return JSON.parse(content) as ComplianceReport;
  } catch (error) {
    console.error("Failed to parse OpenAI response", error);
    throw new Error("Invalid compliance report format");
  }
}
