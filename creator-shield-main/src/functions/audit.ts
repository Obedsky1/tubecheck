import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fetchTranscript, analyzeVideoCompliance } from "@/server/services/compliance";

const auditInputSchema = z.object({
  videoId: z.string(),
  videoTitle: z.string(),
});

// A basic server function exposed to the frontend
export const runComplianceAudit = createServerFn({ method: "POST" })
  .inputValidator(auditInputSchema)
  .handler(async ({ data }) => {
    const videoId = data.videoId;
    const videoTitle = data.videoTitle;
    console.log(`Starting audit for video: ${videoId} (${videoTitle})`);

    try {
      // 1. Fetch transcript from YouTube
      console.log("Fetching transcript...");
      const transcript = await fetchTranscript(videoId);

      if (!transcript || transcript.length === 0) {
        throw new Error("No transcript found for this video.");
      }

      // 2. Run the AI compliance analysis
      console.log("Analyzing transcript with AI...");
      const report = await analyzeVideoCompliance(transcript, videoTitle);

      // 3. (Mock) Save to Database
      // In a real implementation, you would use Drizzle ORM here:
      // await db.insert(complianceScans).values({ ... })
      // await db.insert(alerts).values({ ... })
      console.log("Saving report to DB (mocked)...", report);

      // 4. Return the structured report to the client
      return {
        success: true,
        report,
      };
    } catch (error) {
      console.error("Audit failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  });
