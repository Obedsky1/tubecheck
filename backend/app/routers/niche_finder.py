"""Router for AI Niche Finder & Analyser.

Allows creators to analyze a content niche or keyword for search volume, competition,
expected RPM, and critical YouTube compliance risks (reused content, copyright, advertiser safety).
"""

from __future__ import annotations

import logging
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from google.genai import types
import json

from app.routers.auth import get_current_user
from app.models import User
from app.schemas import (
    NicheAnalysisRequest,
    NicheAnalysisResponse,
    DemographicInfoSchema,
    VideoIdeaSchema,
)
from app.services.gemini_service import gemini_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/niche-finder", tags=["niche-finder"])


def _generate_fallback_niche(query: str, format_type: str) -> dict[str, Any]:
    """Generate high-quality simulated niche reports when the Gemini API is unavailable."""
    query_lower = query.lower()
    format_type = format_type or "Long-form"

    # Default values
    niche_title = query.title()
    shield_rating = 75.0
    search_volume = "Medium"
    competition = "Medium"
    cpm_level = "Medium"
    cpm_rpm_estimate = "$3.00 - $6.50"
    
    reuse_content_risk = "Medium"
    copyright_risk = "Low"
    advertiser_friendly_risk = "Low"
    ai_viability = "High"
    
    summary = (
        f"The '{niche_title}' niche presents a stable opportunity on YouTube. "
        "Audience interest is steady with healthy advertising demand. "
        "Compliance concerns are moderate, but can be easily mitigated by maintaining unique visual styles "
        "and original editing layouts."
    )
    
    pros = ["Steady audience demand", "High content versatility", "Good automation potential"]
    cons = ["Moderate competition", "Requires regular uploads", "Needs high audio quality"]
    red_flags = ["Stock video overuse warning", "Repetitious visual themes"]
    
    safe_content_strategy = [
        "Avoid using raw stock footage without custom overlays or text animations.",
        "Ensure the audio track features a high-quality voiceover with dynamic range.",
        "Add unique title overlays and color grading to distinguish your content from competitors."
    ]
    
    recommended_tools = ["CapCut", "ElevenLabs", "Midjourney", "Canva"]
    
    age_groups = ["18-24", "25-34"]
    gender_distribution = "55% Male, 45% Female"
    top_countries = ["United States", "United Kingdom", "Canada"]
    
    video_ideas = [
        {
            "title": f"The Untold Truth of {niche_title}",
            "hook": "You won't believe what they never told you about this...",
            "outline": "Introduction -> The Secret Reveal -> Impact/Consequences -> Call to Action.",
            "ai_safety_tip": "Use custom graphic animations rather than static images to maintain high visual editing value."
        },
        {
            "title": f"5 Things You Must Know About {niche_title}",
            "hook": "If you are ignoring these 5 critical facts, you are missing out.",
            "outline": "Intro -> Fact 1 to 5 breakdown -> Quick comparison -> Conclusion.",
            "ai_safety_tip": "Avoid repeating identical background audio loops across multiple uploads to bypass repetitious content flags."
        },
        {
            "title": f"The Future of {niche_title} (2026 Edition)",
            "hook": "Everything we know is about to change, and here is why.",
            "outline": "Current Landscape -> The Shift -> Future Predictions -> How to Prepare.",
            "ai_safety_tip": "Write custom commentary scripts rather than using direct ChatGPT summaries to ensure authentic educational value."
        }
    ]

    # Niche-specific overrides
    if any(k in query_lower for k in ["history", "ancient", "roman", "egypt"]):
        niche_title = "Historical Documentaries & Ancient Mysteries"
        shield_rating = 82.0
        search_volume = "High"
        competition = "Medium"
        cpm_level = "Medium"
        cpm_rpm_estimate = "$4.00 - $8.00"
        reuse_content_risk = "Medium"
        copyright_risk = "Medium"
        ai_viability = "High"
        summary = (
            "Historical storytelling is highly engaging and retains viewers for long durations. "
            "However, utilizing public domain images and archive footage poses a Moderate Reused Content risk. "
            "YouTube requires creative commentary and heavy visual editing (zooms, pans, color filters) to approve monetization."
        )
        pros = ["Excellent viewer retention rates", "Rich catalog of public domain assets", "High educational value"]
        cons = ["Time-consuming research phase", "Moderate reused content risk on archive clips", "Requires narrative voiceover"]
        red_flags = ["Using unedited museum stock photos", "Copyright claims from major networks on historical broadcast clips"]
        safe_content_strategy = [
            "Write a highly engaging, custom historical narrative script.",
            "Apply pan-and-scan (Ken Burns effect) to all historical images with animated text captions.",
            "Integrate custom sound effects (sword clashes, wind, atmospheric music) to elevate production value."
        ]
        recommended_tools = ["Photoshop", "Premiere Pro", "ElevenLabs (Custom Voice)", "Midjourney"]
        age_groups = ["25-34", "35-54"]
        gender_distribution = "65% Male, 35% Female"
        top_countries = ["United States", "United Kingdom", "Germany"]
        video_ideas = [
            {
                "title": "The Day Rome Realized It Was Doomed",
                "hook": "In 410 AD, the gates of Rome opened, but not for its legions...",
                "outline": "Build up to the Sack of Rome -> Internal political collapse -> The siege details -> Legacy.",
                "ai_safety_tip": "Combine AI-generated conceptual art with actual historical artifacts to prove original educational curation."
            },
            {
                "title": "The Bizarre Tech of Ancient Egypt",
                "hook": "We think we invented modern engineering, but the Pharaohs did it first.",
                "outline": "Introduction -> Case study of specific temples -> Engineering analysis -> Legacy.",
                "ai_safety_tip": "Do not copy Wikipedia text directly; formulate custom explanations using modern engineering terms."
            },
            {
                "title": "History's Most Successful Impostor",
                "hook": "This man convinced an entire nation he was royalty, and they crowned him anyway.",
                "outline": "The origin -> The deception phase -> The peak -> The exposure and trials.",
                "ai_safety_tip": "Use localized regional maps and routes to add documentary value and bypass low-quality flags."
            }
        ]

    elif any(k in query_lower for k in ["motivation", "quote", "mindset", "stoic"]):
        niche_title = "Stoic Philosophy & Daily Motivation"
        shield_rating = 45.0  # High Risk Niche
        search_volume = "Very High"
        competition = "Very High"
        cpm_level = "Low"
        cpm_rpm_estimate = "$1.50 - $3.50"
        reuse_content_risk = "High"
        copyright_risk = "Low"
        advertiser_friendly_risk = "Low"
        ai_viability = "Very High"
        summary = (
            "While motivational content attracts massive viewership (especially on Shorts), it is "
            "currently the number one target for YouTube's Reused Content demonetization sweeps. "
            "Simply placing quotes over random relaxing videos or synthetic speech is no longer monetizable. "
            "Success requires heavy personalization and human authenticity."
        )
        pros = ["Extremely viral potential", "Easy to automate production", "Universal global appeal"]
        cons = ["Critical risk of demonetization", "Very low CPM/RPM rates", "Extreme saturation"]
        red_flags = ["Repetitious speech patterns from standard AI voices", "Using identical stock video clips as other creators"]
        safe_content_strategy = [
            "Use a highly customized, expressive voice model with unique cadence (or record your own voice).",
            "Overlay custom text animations (kinetic typography) that match the spoken words exactly.",
            "Incorporate custom reactions, sketches, or original commentary to provide genuine human value."
        ]
        recommended_tools = ["ElevenLabs (Voice Design)", "CapCut", "After Effects", "Leonardo AI"]
        age_groups = ["18-24", "25-34"]
        gender_distribution = "70% Male, 30% Female"
        top_countries = ["United States", "India", "Brazil"]
        video_ideas = [
            {
                "title": "3 Rules of Marcus Aurelius to Stop Overthinking",
                "hook": "The Emperor of Rome once wrote a sentence that cured my anxiety instantly.",
                "outline": "Overthinking problem -> Quote analysis -> Real life application -> Conclusion.",
                "ai_safety_tip": "Avoid generic black backgrounds. Create unique themed historical visual sets using AI text-to-image."
            },
            {
                "title": "Why Weakness is a Choice",
                "hook": "Most people think motivation is a feeling. It's actually a decision.",
                "outline": "Differentiate feelings vs discipline -> Stoic lesson -> Actionable habits.",
                "ai_safety_tip": "Include a customized audio intro or outro stating your channel name to reinforce branding identity."
            },
            {
                "title": "Stoic Lessons on Dealing with Disrespect",
                "hook": "When someone insults you, they are revealing their own pain. Here is how to use it.",
                "outline": "The psychology of insult -> Epictetus perspective -> The power of silence -> Exercises.",
                "ai_safety_tip": "Do not upload more than 3 videos a day to avoid velocity spam flags."
            }
        ]

    elif any(k in query_lower for k in ["finance", "money", "invest", "stock", "rich"]):
        niche_title = "Personal Finance, Budgeting & Stocks"
        shield_rating = 90.0  # Very Safe & High Value
        search_volume = "High"
        competition = "High"
        cpm_level = "Very High"
        cpm_rpm_estimate = "$12.00 - $28.00"
        reuse_content_risk = "Low"
        copyright_risk = "Low"
        advertiser_friendly_risk = "Medium"
        ai_viability = "Medium"
        summary = (
            "Personal finance is one of the highest-paying niches on YouTube. "
            "Advertisers pay premium rates because viewers have high purchase intent. "
            "Since the content must be highly accurate and authoritative, automated channels must "
            "ensure they do not distribute spammy or misleading financial advice to maintain advertiser safety."
        )
        pros = ["Astronomical CPM and RPM rates", "High affiliate commission potential", "Loyal, mature audience"]
        cons = ["Requires high financial literacy", "Strict advertiser scrutiny", "Low tolerance for robotic AI delivery"]
        red_flags = ["Misleading thumbnail clickbait (e.g. '1000x Return')", "Distributing financial advice without proper disclaimers"]
        safe_content_strategy = [
            "Use clear financial disclaimers in the video and description.",
            "Support your claims with real-world charts, screenshots of tickers, and official reports.",
            "We strongly recommend a real human voice or a premium, indistinguishable AI clone of your own voice."
        ]
        recommended_tools = ["TradingView", "Figma", "Premiere Pro", "ElevenLabs (Professional Voice Clone)"]
        age_groups = ["25-34", "35-44"]
        gender_distribution = "60% Male, 40% Female"
        top_countries = ["United States", "United Kingdom", "Australia"]
        video_ideas = [
            {
                "title": "How I Budget My $5,000 Monthly Income (Step-by-Step)",
                "hook": "If you are using the 50/30/20 rule, you might be losing money. Try this instead.",
                "outline": "The budget breakdown -> The flaw in popular rules -> The wealth building flow -> Demo.",
                "ai_safety_tip": "Use real spreadsheet screencasts rather than generic cash graphics to prove original authorship."
            },
            {
                "title": "3 Index Funds to Buy and Hold Forever",
                "hook": "You don't need to pick individual stocks to retire wealthy. Buy these 3 instead.",
                "outline": "Why index funds win -> Fund 1 (S&P 500) -> Fund 2 (Growth) -> Fund 3 (International) -> Math.",
                "ai_safety_tip": "Ensure accurate stock ticker symbols and graphs are displayed; false tickers trigger spam reports."
            },
            {
                "title": "The Truth About the 2026 Housing Market",
                "hook": "The headlines say the market is crashing, but the numbers show something else.",
                "outline": "Media narrative vs data -> Mortgage rate trends -> Supply analysis -> Buyer strategy.",
                "ai_safety_tip": "Cite credible sources (e.g., Federal Reserve database, Reuters) in your slides and description."
            }
        ]

    elif any(k in query_lower for k in ["reddit", "story", "askreddit", "mcpe", "minecraft gameplay"]):
        niche_title = "Reddit Storytelling & Web Narratives"
        shield_rating = 35.0  # Extremely High Risk
        search_volume = "Very High"
        competition = "High"
        cpm_level = "Low"
        cpm_rpm_estimate = "$1.00 - $2.50"
        reuse_content_risk = "Very High"
        copyright_risk = "Low"
        advertiser_friendly_risk = "Medium"
        ai_viability = "Very High"
        summary = (
            "Reddit stories overlaying Minecraft gameplay or satisfying soap-cutting videos are highly viral "
            "but represent extreme risk. YouTube actively demonetizes these channels under 'Reused Content' "
            "because the gameplay is stock/reused and the stories are scraped text read by automated TTS. "
            "To survive, you must transform the text, add custom voice work, and unique visual edits."
        )
        pros = ["Viral traffic with minimal effort", "Infinite supply of text scripts", "Massive appeal to teenagers"]
        cons = ["Almost certain demonetization if un-edited", "Extremely low RPM", "Zero brand equity"]
        red_flags = ["Scraped Reddit text read verbatim", "Background Minecraft loops downloaded from YouTube"]
        safe_content_strategy = [
            "Rewrite stories completely to add your own opinion, commentary, or alternative endings.",
            "Record your own gameplay, drawing tutorials, or satisfying crafts to ensure visual uniqueness.",
            "Add animated avatar reactions or subtitles with custom fonts and icons matching the story."
        ]
        recommended_tools = ["Obs Studio (to record custom gameplay)", "CapCut", "Submagic", "ElevenLabs"]
        age_groups = ["13-17", "18-24"]
        gender_distribution = "50% Male, 50% Female"
        top_countries = ["United States", "United Kingdom", "Australia"]
        video_ideas = [
            {
                "title": "My Boss Tried to Fire Me, So I Took His Job",
                "hook": "My boss thought he had the perfect plan to get rid of me, until he forgot one detail...",
                "outline": "The conflict -> The retaliation plan -> The execution -> The victory.",
                "ai_safety_tip": "Record your own gaming clips. Using shared copyright-free loops will get your channel flagged."
            },
            {
                "title": "I Inherited a House, and Found This in the Walls",
                "hook": "When my grandfather left me his 1920s cabin, I expected dust. I didn't expect a locked safe...",
                "outline": "The inheritance -> The renovation finding -> The opening -> The consequence.",
                "ai_safety_tip": "Add a custom text intro ('Reddit Tales by [Your Channel]') to build custom trademark presence."
            },
            {
                "title": "Am I The Jerk For Canceling My Sister's Wedding?",
                "hook": "My sister expected me to pay $20,000 for her wedding, but then she insulted my wife...",
                "outline": "The setup -> The sister's demands -> The insult -> The cancellation -> Family drama.",
                "ai_safety_tip": "Use active subtitles and custom animations to highlight character roles (e.g. green for sister, red for bride)."
            }
        ]

    elif any(k in query_lower for k in ["crypto", "bitcoin", "ethereum", "web3"]):
        niche_title = "Cryptocurrency & Web3 Analysis"
        shield_rating = 60.0
        search_volume = "High"
        competition = "High"
        cpm_level = "Very High"
        cpm_rpm_estimate = "$10.00 - $22.00"
        reuse_content_risk = "Low"
        copyright_risk = "Low"
        advertiser_friendly_risk = "High"
        ai_viability = "Medium"
        summary = (
            "Crypto content yields massive RPM, but is heavily monitored by YouTube for spam and scam activities. "
            "Advertisers are cautious. Channels must avoid promising returns, promoting micro-cap pump-and-dump schemes, "
            "or using hyped-up clickbait. Compliance rests on objective news reporting and strict disclaimers."
        )
        pros = ["Highly lucrative sponsorships", "Passionate, high-spending audience", "Continuous news cycle"]
        cons = ["Extreme advertiser volatility", "High threat of community guideline strikes", "Prone to viewer scams in comments"]
        red_flags = ["Thumbnails with rocket ship emojis and '100x'", "Promoting unregistered tokens without disclaimer"]
        safe_content_strategy = [
            "Use clear warnings that crypto trading is volatile and not financial advice.",
            "Focus on blockchain developer updates, macroeconomics, and SEC regulatory news.",
            "Strictly filter comments to block telegram scam bots impersonating your channel."
        ]
        recommended_tools = ["TradingView", "CoinMarketCap", "Canva", "OBS Studio"]
        age_groups = ["18-24", "25-34"]
        gender_distribution = "85% Male, 15% Female"
        top_countries = ["United States", "Turkey", "Nigeria"]
        video_ideas = [
            {
                "title": "Will Bitcoin Reach $150k in 2026?",
                "hook": "The charts are printing a pattern we haven't seen since the 2020 halving...",
                "outline": "Macro chart analysis -> Supply scarcity data -> FED interest rates impact -> Bull case vs Bear case.",
                "ai_safety_tip": "Ensure the narration is objective and lists risk factors to avoid being flagged under YouTube's Financial Harm policy."
            },
            {
                "title": "SEC vs Crypto: The New Lawsuits Explained",
                "hook": "The government just filed a lawsuit that could change the future of decentralized finance...",
                "outline": "The breaking news -> Legal document breakdown -> Impact on tokens -> Expert opinions.",
                "ai_safety_tip": "Show actual court filing PDFs on screen to provide authoritative news reporting value."
            },
            {
                "title": "Top 3 Layer-2 Blockchains Solving Gas Fees",
                "hook": "Ethereum is still too slow, but these 3 networks are quietly scaling the entire ecosystem.",
                "outline": "The problem with gas fees -> Project 1 analysis -> Project 2 -> Project 3 -> Developer activity metrics.",
                "ai_safety_tip": "Cite Github repository commits and transaction volume statistics to verify technical authenticity."
            }
        ]

    return {
        "niche": niche_title,
        "shield_rating": shield_rating,
        "search_volume": search_volume,
        "competition": competition,
        "cpm_level": cpm_level,
        "cpm_rpm_estimate": cpm_rpm_estimate,
        "reuse_content_risk": reuse_content_risk,
        "copyright_risk": copyright_risk,
        "advertiser_friendly_risk": advertiser_friendly_risk,
        "ai_viability": ai_viability,
        "summary": summary,
        "pros": pros,
        "cons": cons,
        "red_flags": red_flags,
        "safe_content_strategy": safe_content_strategy,
        "recommended_tools": recommended_tools,
        "audience_demographics": {
            "age_groups": age_groups,
            "gender_distribution": gender_distribution,
            "top_countries": top_countries,
        },
        "sample_video_ideas": video_ideas,
    }


from app.rate_limiter import RateLimit

@router.post("/analyze", response_model=NicheAnalysisResponse, dependencies=[Depends(RateLimit(20, 3600))])
async def analyze_niche(
    payload: NicheAnalysisRequest,
    current_user: User = Depends(get_current_user),
) -> NicheAnalysisResponse:
    """Analyze a niche query using Gemini 2.5 Flash, falling back to a rule-based engine if needed."""
    query = payload.query.strip()
    format_type = payload.format or "Long-form"

    if not query:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query parameter is required",
        )

    # 1. Attempt to call Gemini Client
    if gemini_service._client is not None:
        try:
            prompt = (
                "You are an expert YouTube trust and safety officer, monetization policy auditor, and creator strategist.\n"
                f"Analyze the following content niche or keyword: '{query}' for content format '{format_type}'.\n\n"
                "Evaluate this niche specifically through the lens of YouTube's monetization policies, copyright enforcement, "
                "and advertiser safety. Identify common policy violations (e.g. Reused Content, Repetitious Content, Sensationalism). "
                "Provide a detailed, highly practical 'Human-in-the-Loop' content creation strategy that details how a creator can "
                "safely utilize AI workflows (e.g., ElevenLabs speech, Midjourney images, AI editors) in this niche without getting flagged.\n\n"
                "You must return a strict JSON payload that matches the following schema:\n"
                "- niche: string (Title of analyzed niche)\n"
                "- shield_rating: number (Monetization safety score out of 100. High means low policy risk)\n"
                "- search_volume: string ('High', 'Medium', or 'Low')\n"
                "- competition: string ('High', 'Medium', or 'Low')\n"
                "- cpm_level: string ('High', 'Medium', or 'Low')\n"
                "- cpm_rpm_estimate: string (e.g., '$5.00 - $12.00')\n"
                "- reuse_content_risk: string ('High', 'Medium', or 'Low')\n"
                "- copyright_risk: string ('High', 'Medium', or 'Low')\n"
                "- advertiser_friendly_risk: string ('High', 'Medium', or 'Low')\n"
                "- ai_viability: string ('Very High', 'High', 'Medium', or 'Low')\n"
                "- summary: string (3-4 sentences executive summary of the niche and its compliance outlook)\n"
                "- pros: list of 3 strings (core advantages)\n"
                "- cons: list of 3 strings (core challenges)\n"
                "- red_flags: list of strings (critical policies or triggers to watch out for)\n"
                "- safe_content_strategy: list of strings (step-by-step compliant production steps)\n"
                "- recommended_tools: list of strings (AI and editing tools)\n"
                "- audience_demographics: object with age_groups (list of strings), gender_distribution (string), top_countries (list of strings)\n"
                "- sample_video_ideas: list of 3 objects, each having title (string), hook (string), outline (string), ai_safety_tip (string)\n"
            )

            import asyncio
            from fastapi.concurrency import run_in_threadpool
            response = await asyncio.wait_for(
                run_in_threadpool(
                    lambda: gemini_service._client.models.generate_content(
                        model='gemini-2.5-flash',
                        contents=prompt,
                        config=types.GenerateContentConfig(
                            response_mime_type="application/json",
                            response_schema=NicheAnalysisResponse,
                            temperature=0.7,
                        ),
                    )
                ),
                timeout=3.5
            )

            # Parse response
            if response.parsed:
                return response.parsed
            else:
                parsed_json = json.loads(response.text)
                return NicheAnalysisResponse(**parsed_json)

        except Exception as e:
            logger.error("Failed to run Gemini niche analysis: %s. Falling back...", e)

    # 2. Heuristics fallback
    fallback_data = _generate_fallback_niche(query, format_type)
    return NicheAnalysisResponse(**fallback_data)
