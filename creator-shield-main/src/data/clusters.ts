export interface ContentCluster {
  slug: string;
  title: string;
  cluster: string;
  link: string;
}

export const contentClusters: ContentCluster[] = [
  // Monetization Cluster
  { slug: "what-is-youtube-monetization", title: "What Is YouTube Monetization?", cluster: "Monetization", link: "/youtube-monetization-checker" },
  { slug: "youtube-monetization-requirements-explained", title: "YouTube Monetization Requirements Explained", cluster: "Monetization", link: "/youtube-monetization-requirements" },
  { slug: "youtube-monetization-rules-2026", title: "YouTube Monetization Rules In 2026", cluster: "Monetization", link: "/youtube-monetization-rules" },
  { slug: "how-to-get-monetized-on-youtube", title: "How To Get Monetized On YouTube", cluster: "Monetization", link: "/youtube-monetization-checker" },
  { slug: "why-channels-get-demonetized", title: "Why Channels Get Demonetized", cluster: "Monetization", link: "/youtube-channel-audit" },
  { slug: "youtube-monetization-calculator-guide", title: "YouTube Monetization Calculator Guide", cluster: "Monetization", link: "/youtube-monetization-calculator" },
  { slug: "how-to-pass-ypp-review", title: "How To Pass YPP Review", cluster: "Monetization", link: "/youtube-compliance-checker" },

  // Reused Content Cluster
  { slug: "what-counts-as-reused-content", title: "What Counts As Reused Content?", cluster: "Reused Content", link: "/reused-content-checker" },
  { slug: "how-to-avoid-reused-content", title: "How To Avoid Reused Content", cluster: "Reused Content", link: "/reused-content-checker" },
  { slug: "reused-content-examples", title: "Reused Content Examples", cluster: "Reused Content", link: "/reused-content-checker" },
  { slug: "why-youtube-rejected-my-channel", title: "Why YouTube Rejected My Channel", cluster: "Reused Content", link: "/youtube-channel-audit" },
  { slug: "transformative-content-explained", title: "Transformative Content Explained", cluster: "Reused Content", link: "/youtube-originality-checker" },
  { slug: "compilation-video-monetization", title: "Compilation Video Monetization Guide", cluster: "Reused Content", link: "/reused-content-checker" },

  // AI Content Cluster
  { slug: "can-ai-videos-be-monetized", title: "Can AI Videos Be Monetized?", cluster: "AI Content", link: "/ai-video-monetization-checker" },
  { slug: "ai-voice-monetization-rules", title: "AI Voice Monetization Rules", cluster: "AI Content", link: "/tools/ai-voice-detector" },
  { slug: "youtube-ai-content-policies", title: "YouTube AI Content Policies", cluster: "AI Content", link: "/youtube-ai-content-checker" },
  { slug: "does-youtube-detect-ai-videos", title: "Does YouTube Detect AI Videos?", cluster: "AI Content", link: "/youtube-ai-content-checker" },
  { slug: "ai-generated-shorts-monetization", title: "AI Generated Shorts Monetization", cluster: "AI Content", link: "/ai-video-monetization-checker" },
  { slug: "human-value-content-guide", title: "Human Value Content Guide", cluster: "AI Content", link: "/youtube-originality-checker" },

  // Copyright Cluster
  { slug: "copyright-claims-explained", title: "Copyright Claims Explained", cluster: "Copyright", link: "/copyright-risk-checker" },
  { slug: "copyright-strikes-explained", title: "Copyright Strikes Explained", cluster: "Copyright", link: "/copyright-risk-checker" },
  { slug: "fair-use-on-youtube", title: "Fair Use On YouTube", cluster: "Copyright", link: "/copyright-risk-checker" },
  { slug: "music-copyright-guide", title: "Music Copyright Guide", cluster: "Copyright", link: "/copyright-risk-checker" },
  { slug: "movie-clips-monetization", title: "Movie Clips Monetization", cluster: "Copyright", link: "/copyright-risk-checker" },
  { slug: "copyright-risk-prevention", title: "Copyright Risk Prevention", cluster: "Copyright", link: "/tools/copyright-risk-scanner" },

  // Compliance Cluster
  { slug: "youtube-compliance-checklist", title: "YouTube Compliance Checklist", cluster: "Compliance", link: "/youtube-compliance-checker" },
  { slug: "youtube-community-guidelines-explained", title: "YouTube Community Guidelines Explained", cluster: "Compliance", link: "/youtube-compliance-checker" },
  { slug: "inauthentic-content-detection", title: "Inauthentic Content Detection", cluster: "Compliance", link: "/tools/content-farm-detector" },
  { slug: "content-farm-risks", title: "Content Farm Risks", cluster: "Compliance", link: "/tools/content-farm-detector" },
  { slug: "youtube-enforcement-actions", title: "YouTube Enforcement Actions", cluster: "Compliance", link: "/youtube-policy-scanner" },
  { slug: "channel-health-audits", title: "Channel Health Audits", cluster: "Compliance", link: "/youtube-channel-audit" }
];
