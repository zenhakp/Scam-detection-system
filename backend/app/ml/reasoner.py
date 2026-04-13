import json
import os
from app.config import ANTHROPIC_API_KEY, GROQ_API_KEY


def build_prompt(message, risk_score, risk_level, language,
                 indicators, threats, highlights) -> str:
    indicator_summary = []
    if indicators.get("urls"):
        indicator_summary.append(f"URLs: {', '.join(indicators['urls'])}")
    if indicators.get("phones"):
        indicator_summary.append(f"Phones: {', '.join(indicators['phones'])}")
    if indicators.get("emails"):
        indicator_summary.append(f"Emails: {', '.join(indicators['emails'])}")
    if indicators.get("crypto_wallets"):
        indicator_summary.append(f"Crypto: {', '.join(indicators['crypto_wallets'])}")

    return f"""You are a cybersecurity expert specializing in scam and fraud detection.

A message has been analyzed by an ML model. Here are the results:

MESSAGE:
\"\"\"{message}\"\"\"

ML MODEL RESULTS:
- Risk Score: {risk_score}/100
- Risk Level: {risk_level}
- Detected Language: {language}
- Threat Categories: {', '.join(threats.keys()) if threats else 'none'}
- Suspicious Keywords: {', '.join(highlights) if highlights else 'none'}
- Indicators Found: {chr(10).join(indicator_summary) if indicator_summary else 'none'}

Respond ONLY in this exact JSON format with no extra text or markdown:
{{
  "verdict": "SCAM" or "LEGITIMATE" or "SUSPICIOUS",
  "confidence": "HIGH" or "MEDIUM" or "LOW",
  "summary": "One sentence verdict explanation",
  "tactics_used": ["list", "of", "scam", "tactics"],
  "red_flags": ["specific", "red", "flags"],
  "safe_to_ignore": true or false,
  "recommended_action": "What the user should do",
  "explanation": "2-3 sentence detailed explanation"
}}

If the message is clearly legitimate (OTP, delivery, salary credit), set verdict LEGITIMATE and safe_to_ignore true."""


def fallback_response(risk_score, risk_level, threats, highlights):
    return {
        "verdict":            "LEGITIMATE" if risk_score < 40 else risk_level,
        "confidence":         "LOW",
        "summary":            f"ML model detected {risk_level} risk. AI reasoning unavailable.",
        "tactics_used":       list(threats.keys()),
        "red_flags":          highlights[:5],
        "safe_to_ignore":     risk_score < 40,
        "recommended_action": "Exercise caution" if risk_score > 40 else "This appears safe",
        "explanation":        f"Automated ML analysis only. Risk score: {risk_score}/100.",
    }


def get_ai_reasoning(message, risk_score, risk_level, language,
                     indicators, threats, highlights) -> dict:

    prompt = build_prompt(message, risk_score, risk_level, language,
                          indicators, threats, highlights)

    # Try Anthropic first
    if ANTHROPIC_API_KEY:
        try:
            import anthropic
            client   = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            response = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=600,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = response.content[0].text.strip()
            raw = raw.replace("```json", "").replace("```", "").strip()
            return json.loads(raw)
        except Exception as e:
            print(f"Anthropic error: {e}")

    # Try Groq as fallback
    if GROQ_API_KEY:
        try:
            from groq import Groq
            client   = Groq(api_key=GROQ_API_KEY)
            response = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=600,
                temperature=0.1,
            )
            raw = response.choices[0].message.content.strip()
            raw = raw.replace("```json", "").replace("```", "").strip()
            return json.loads(raw)
        except Exception as e:
            print(f"Groq error: {e}")

    # Both failed — return ML-only result
    return fallback_response(risk_score, risk_level, threats, highlights)