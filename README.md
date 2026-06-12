# CreatorShield AI Compliance Engine

CreatorShield is an enterprise-grade authenticity intelligence system designed to flag content farms, recycled scripts, thumbnail layout theft, and synthetic voice fraud across large multi-channel networks (MCNs) on YouTube.

## Features

- **Semantic Fingerprinting**: Cosine similarity clustering and rigidity calculations using PostgreSQL `pgvector`.
- **Policy Engine**: Correlation of visual/textual signals to YouTube rules (Reused Content, Inauthentic Behavior).
- **Reputation Scoring**: Real-time channel trust indexing and monetization stability prediction.
- **Forensic Pipeline**: Celery workers mapping keyframes, transcripts, and audio classification patterns.

## Repository Layout

```
├── backend/          # FastAPI API Gateway + Celery Task definitions
├── frontend/         # Next.js 15 Tailwind Dashboard UI
├── shared/           # Cross-service constants and helpers
├── docs/             # Technical architecture guides
├── scripts/          # PowerShell orchestration scripts
└── docker-compose.yml
```

## Quick Start

1. Initialize local environment variables:
   ```bash
   copy .env.example .env
   ```

2. Start the Docker services:
   ```bash
   docker-compose up --build
   ```

3. Open the dashboard at `http://localhost:3000`.
