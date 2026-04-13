from sqlalchemy.orm import Session
from app.models.scan import Scan
from app.models.campaign import Campaign
from collections import defaultdict
from datetime import datetime
import uuid
import re
import numpy as np

# ── Multilingual sentence embeddings model ────────────────────────────────────
# paraphrase-multilingual-MiniLM-L12-v2 supports 50+ languages
# It's fast, small (~120MB), and great for semantic similarity
_embedder = None

def get_embedder():
    global _embedder
    if _embedder is None:
        from sentence_transformers import SentenceTransformer
        print("Loading multilingual sentence embedder...")
        _embedder = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
        print("Embedder loaded.")
    return _embedder


# ── Campaign definitions with multilingual example phrases ────────────────────
# These are ANCHOR SENTENCES — the embedder computes similarity against these
CAMPAIGN_ANCHORS = {
    "KYC / SIM Deactivation": [
        "Your SIM card will be deactivated due to incomplete KYC verification",
        "KYC pending, mobile service will stop within 24 hours",
        "आपका SIM KYC पूरा न होने के कारण बंद हो जाएगा",
        "നിങ്ങളുടെ SIM KYC പൂർത്തിയാക്കാത്തതിനാൽ നിർത്തലാക്കും",
        "உங்கள் SIM KYC முடிக்கப்படாததால் நிறுத்தப்படும்",
        "Votre SIM sera désactivé en raison d'un KYC incomplet",
    ],
    "Bank Account Freeze / Security Alert": [
        "Your bank account has been frozen due to suspicious activity",
        "Unauthorized transaction detected on your account, verify immediately",
        "आपका बैंक खाता संदिग्ध गतिविधि के कारण फ्रीज कर दिया गया है",
        "നിങ്ങളുടെ ബാങ്ക് അക്കൗണ്ട് സംശയാസ്പദ പ്രവർത്തനം കാരണം മരവിപ്പിച്ചു",
        "Your account will be blocked unless you verify now",
    ],
    "Delivery / Courier Failure": [
        "Your package could not be delivered, confirm your address",
        "Delivery attempt failed, reschedule your shipment",
        "आपका पार्सल डिलीवर नहीं हो सका, अपना पता कन्फर्म करें",
        "நிலுவையில் உள்ள பார்சல் கஸ்டம்ஸில் வைக்கப்பட்டுள்ளது",
        "Your parcel is held at customs, pay release fee",
    ],
    "Legal Threat / Government Notice": [
        "A legal complaint has been filed against you, respond immediately",
        "Court notice issued under your name, immediate response required",
        "आपके नाम पर कानूनी शिकायत दर्ज की गई है",
        "Cybercrime department has issued a warrant for your arrest",
        "FIR registered against you, contact immediately",
    ],
    "Account Security / Login Alert": [
        "Unusual login detected on your account from a new device",
        "Someone logged into your account from an unrecognized location",
        "आपके अकाउंट पर एक नए डिवाइस से लॉगिन हुआ",
        "Suspicious sign-in attempt detected, secure your account now",
    ],
    "Lottery / Prize / Giveaway": [
        "Congratulations you have won a cash prize of 50000",
        "You are the lucky winner of our monthly lottery draw",
        "बधाई हो आपने ₹50,000 की लॉटरी जीती है",
        "அஞ்சுகோடி ரூபாய் லாட்டரி வென்றீர்கள்",
        "Claim your reward before it expires",
    ],
    "Payment Failure / Billing Issue": [
        "Your payment was declined, update your billing information",
        "Invoice overdue, pay now to avoid service interruption",
        "आपका पेमेंट फेल हो गया, बिलिंग जानकारी अपडेट करें",
        "Credit card expired, update to continue subscription",
    ],
    "Email / Account Suspension": [
        "Your email account will be suspended due to policy violation",
        "Account access has been limited, verify to restore",
        "आपका अकाउंट सस्पेंड किया जाएगा",
        "Your social media account will be permanently disabled",
    ],
    "Tax Refund / Government Benefits": [
        "You are eligible for a tax refund from income tax department",
        "Government subsidy of 5000 approved in your name",
        "आपके नाम पर टैक्स रिफंड स्वीकृत हुआ है",
        "PM scheme benefit approved, claim your subsidy now",
        "Income tax refund pending, verify your account",
    ],
    "Job Offer / Work From Home": [
        "Earn 5000 rupees daily working from home, apply now",
        "Part time job opportunity, guaranteed weekly payment",
        "घर बैठे रोज ₹5000 कमाएं, अभी अप्लाई करें",
        "Data entry job available, no experience required",
        "Work from home and earn daily income guaranteed",
    ],
    "Investment / Crypto Scam": [
        "Double your investment in 7 days, guaranteed crypto returns",
        "Bitcoin investment opportunity with 500 percent profit",
        "क्रिप्टो में निवेश करें, 500% रिटर्न की गारंटी",
        "Guaranteed passive income from our trading platform",
        "Send cryptocurrency to receive double returns",
    ],
    "Romance / Relationship Scam": [
        "I need urgent financial help, please send money",
        "I want to visit you but need money for travel",
        "मैं आपसे मिलना चाहता हूं पर मुझे पैसों की जरूरत है",
        "I am stranded abroad and need emergency funds",
        "We have a strong connection, please help me financially",
    ],
    "Tech Support Scam": [
        "Your device has been hacked, call our tech support immediately",
        "Virus detected on your computer, immediate action required",
        "आपका फोन हैक हो गया है, तुरंत कॉल करें",
        "Your system has been compromised, download our security tool",
        "Malware detected, your data is at risk",
    ],
    "Subscription Renewal / Hidden Charges": [
        "Your subscription will auto renew, cancel now to avoid charges",
        "Hidden charges will be applied unless you respond",
        "आपकी सदस्यता अपने आप नवीनीकृत हो जाएगी",
        "Free trial ending, you will be charged automatically",
    ],
    "Identity Verification / Document Update": [
        "Verify your identity to continue using our services",
        "Update your Aadhaar and PAN card details immediately",
        "आपकी पहचान सत्यापित करें अन्यथा खाता बंद हो जाएगा",
        "Provide identity documents to avoid account restriction",
        "Personal details required for account continuation",
    ],
    "OTP / Verification Code Theft": [
        "Share your OTP to confirm your account transaction",
        "Provide the verification code sent to your phone",
        "अपना OTP शेयर करें अकाउंट कन्फर्म करने के लिए",
        "Enter the code to complete your bank verification",
        "OTP required to process your refund",
    ],
    "Account Ban / Policy Violation": [
        "Your account violated our community guidelines and will be banned",
        "Policy violation detected, account will be permanently suspended",
        "आपका खाता नीति उल्लंघन के कारण बैन हो जाएगा",
        "Multiple violations detected, account removal in progress",
    ],
    "Scholarship / Education Scam": [
        "You have been selected for a government scholarship",
        "Pay registration fee to secure your university admission",
        "आपको सरकारी छात्रवृत्ति के लिए चुना गया है",
        "Study abroad opportunity available, apply now",
        "Education loan approved, pay processing fee",
    ],
    "Medical / Emergency Scam": [
        "Urgent medical funds required for emergency treatment",
        "Hospital payment needed immediately for surgery",
        "आपात चिकित्सा के लिए तुरंत पैसे चाहिए",
        "Accident victim needs urgent financial help",
        "Medical emergency, please send funds immediately",
    ],
    "Impersonation (Boss / Bank / Govt)": [
        "This is your manager, please share your account details immediately",
        "Bank officer calling, verify your credentials urgently",
        "यह आपका मैनेजर बोल रहा है, तुरंत डिटेल्स दें",
        "RBI directive requires immediate account verification",
        "Government official requesting personal information",
    ],
}

# Pre-computed anchor embeddings cache
_anchor_embeddings: dict = {}


def get_anchor_embeddings():
    global _anchor_embeddings
    if _anchor_embeddings:
        return _anchor_embeddings

    embedder = get_embedder()
    print("Pre-computing campaign anchor embeddings...")
    for campaign, phrases in CAMPAIGN_ANCHORS.items():
        embeddings = embedder.encode(phrases, convert_to_numpy=True)
        _anchor_embeddings[campaign] = embeddings
    print("Anchor embeddings ready.")
    return _anchor_embeddings


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Compute cosine similarity between two vectors."""
    a_norm = np.linalg.norm(a)
    b_norm = np.linalg.norm(b)
    if a_norm == 0 or b_norm == 0:
        return 0.0
    return float(np.dot(a, b) / (a_norm * b_norm))


def detect_campaign_semantic(message: str) -> tuple[str, float]:
    """
    Uses multilingual sentence embeddings + cosine similarity
    to find the most semantically similar campaign type.
    Works for ALL languages the model supports (50+).
    Returns (campaign_name, confidence_score)
    """
    try:
        embedder        = get_embedder()
        anchor_embeddings = get_anchor_embeddings()

        msg_embedding = embedder.encode([message], convert_to_numpy=True)[0]

        best_campaign   = "General Scam"
        best_similarity = 0.0

        for campaign, anchors in anchor_embeddings.items():
            # Compare against all anchors, take max similarity
            sims = [cosine_similarity(msg_embedding, anchor) for anchor in anchors]
            max_sim = max(sims)

            if max_sim > best_similarity:
                best_similarity = max_sim
                best_campaign   = campaign

        # Only assign a specific campaign if similarity is above threshold
        # Below 0.35 = too generic, classify as General Scam
        if best_similarity < 0.35:
            return "General Scam", best_similarity

        return best_campaign, best_similarity

    except Exception as e:
        print(f"Semantic detection error: {e}")
        return _keyword_fallback(message), 0.0


def _keyword_fallback(message: str) -> str:
    """Simple keyword fallback if embedder fails."""
    m = message.lower()
    if any(w in m for w in ["kyc", "sim card", "deactivat"]):
        return "KYC / SIM Deactivation"
    if any(w in m for w in ["lottery", "won", "prize", "winner"]):
        return "Lottery / Prize / Giveaway"
    if any(w in m for w in ["crypto", "bitcoin", "invest", "double"]):
        return "Investment / Crypto Scam"
    if any(w in m for w in ["otp", "verification code"]):
        return "OTP / Verification Code Theft"
    if any(w in m for w in ["delivery", "parcel", "courier", "package"]):
        return "Delivery / Courier Failure"
    if any(w in m for w in ["legal", "court", "fir", "arrest"]):
        return "Legal Threat / Government Notice"
    if any(w in m for w in ["tax refund", "subsidy", "government benefit"]):
        return "Tax Refund / Government Benefits"
    if any(w in m for w in ["job", "work from home", "earn daily"]):
        return "Job Offer / Work From Home"
    if any(w in m for w in ["bank account", "frozen", "suspicious activity"]):
        return "Bank Account Freeze / Security Alert"
    return "General Scam"


def update_campaigns(db: Session, scan: Scan):
    if scan.risk_level not in ["HIGH", "CRITICAL"]:
        return

    try:
        # Semantic detection — works for all languages
        category, confidence = detect_campaign_semantic(scan.message)

        existing = db.query(Campaign).filter(Campaign.name == category).first()

        all_indicators = []
        if scan.indicators:
            for key, vals in scan.indicators.items():
                if isinstance(vals, list):
                    all_indicators.extend(vals)

        now = datetime.utcnow()

        if existing:
            existing.message_count += 1
            samples = list(existing.sample_messages or [])
            if len(samples) < 5 and scan.message not in samples:
                samples.append(scan.message[:120])
            existing.sample_messages = samples
            existing_indicators = list(existing.indicators or [])
            for ind in all_indicators:
                if ind and ind not in existing_indicators:
                    existing_indicators.append(ind)
            existing.indicators = existing_indicators[:20]
            existing.updated_at = now
        else:
            campaign = Campaign(
                id              = str(uuid.uuid4()),
                name            = category,
                category        = category,
                message_count   = 1,
                indicators      = all_indicators[:20],
                sample_messages = [scan.message[:120]],
                first_seen      = now,
                updated_at      = now,
            )
            db.add(campaign)

        db.commit()
        print(f"Campaign '{category}' updated (similarity: {confidence:.2f})")

    except Exception as e:
        db.rollback()
        print(f"Campaign update error (non-fatal): {e}")


def get_threat_intelligence(db: Session) -> dict:
    scans = db.query(Scan).all()
    indicator_freq: dict = defaultdict(int)
    for scan in scans:
        if not scan.indicators:
            continue
        for key, vals in scan.indicators.items():
            if isinstance(vals, list):
                for val in vals:
                    if val:
                        indicator_freq[val] += 1

    top_indicators = sorted(
        [{"indicator": k, "count": v} for k, v in indicator_freq.items()],
        key=lambda x: x["count"],
        reverse=True,
    )[:20]
    return {"top_indicators": top_indicators}