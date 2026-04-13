from transformers import AutoTokenizer, AutoModelForSequenceClassification
from langdetect import detect
import torch
import re
import os

# ── Model loading ──────────────────────────────────────────────────────────────
MODEL_PATH    = "models/scam-detector"
FALLBACK_MODEL = "mrm8488/bert-tiny-finetuned-sms-spam-detection"

print("Loading scam detection model...")
if os.path.exists(MODEL_PATH) and os.path.exists(f"{MODEL_PATH}/config.json"):
    print(f"✓ Using trained model from {MODEL_PATH}")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
    model     = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)
else:
    print(f"⚠ Trained model not found — using fallback: {FALLBACK_MODEL}")
    tokenizer = AutoTokenizer.from_pretrained(FALLBACK_MODEL)
    model     = AutoModelForSequenceClassification.from_pretrained(FALLBACK_MODEL)

model.eval()
USE_GPU = torch.cuda.is_available()
if USE_GPU:
    model = model.cuda()
    print("✓ Model running on GPU")
else:
    print("✓ Model running on CPU")

# ── Multilingual keyword bank ──────────────────────────────────────────────────
MULTILINGUAL_KEYWORDS = {
    "en": ["won","winner","prize","claim","urgent","immediately","click","verify",
           "account","suspended","kyc","lottery","free","congratulations","selected",
           "reward","bank","password","credit","debit","expire","blocked","crypto",
           "bitcoin","investment","double","guaranteed","transfer","wallet","limited",
           "offer","exclusive","otp","phishing","fraud","scam"],
    "hi": ["जीते","पुरस्कार","तुरंत","क्लिक","सत्यापित","खाता","निलंबित","लॉटरी",
           "मुफ्त","बधाई","चुना","बैंक","पासवर्ड","समाप्त","ब्लॉक","निवेश","गारंटी"],
    "ml": ["ജയിച്ചു","സമ്മാനം","ഉടൻ","ക്ലിക്ക്","അക്കൗണ്ട്","സസ്പെൻഡ്","ലോട്ടറി",
           "സൗജന്യ","അഭിനന്ദനങ്ങൾ","ബ്ലോക്ക്","നിക്ഷേപം","ഗ്യാരണ്ടി"],
    "ta": ["வென்றீர்கள்","பரிசு","உடனே","கிளிக்","கணக்கு","நிறுத்தப்பட்டது",
           "லாட்டரி","இலவசம்","வாழ்த்துகள்","தடுக்கப்பட்டது"],
    "te": ["గెలిచారు","బహుమతి","వెంటనే","క్లిక్","ఖాతా","నిలిపివేయబడింది",
           "లాటరీ","ఉచితం","అభినందనలు"],
    "kn": ["ಗೆದ್ದಿದ್ದೀರಿ","ಬಹುಮಾನ","ತಕ್ಷಣ","ಕ್ಲಿಕ್","ಖಾತೆ","ಅಮಾನತು",
           "ಲಾಟರಿ","ಉಚಿತ","ಅಭಿನಂದನೆ"],
    "bn": ["জিতেছেন","পুরস্কার","তাৎক্ষণিক","ক্লিক","অ্যাকাউন্ট","স্থগিত",
           "লটারি","বিনামূল্যে","অভিনন্দন"],
    "ur": ["جیتا","انعام","فوری","کلک","اکاؤنٹ","معطل","لاٹری","مفت","مبارک"],
    "ar": ["فزت","جائزة","عاجل","انقر","حساب","معلق","يانصيب","مجاني","تهانينا"],
    "es": ["ganado","premio","urgente","clic","verificar","cuenta","suspendida",
           "lotería","gratis","felicitaciones"],
    "fr": ["gagné","prix","urgent","cliquez","vérifier","compte","suspendu",
           "loterie","gratuit","félicitations"],
    "de": ["gewonnen","preis","dringend","klicken","konto","gesperrt",
           "lotterie","kostenlos","glückwunsch"],
    "id": ["menang","hadiah","segera","klik","akun","ditangguhkan","lotere",
           "gratis","selamat"],
    "tr": ["kazandınız","ödül","acil","tıklayın","hesap","askıya","piyango",
           "ücretsiz","tebrikler"],
    "pt": ["ganhou","prêmio","urgente","clique","conta","suspensa","loteria",
           "grátis","parabéns"],
    "mr": ["जिंकले","बक्षीस","तातडीने","खाते","निलंबित","लॉटरी","मोफत","अभिनंदन"],
    "gu": ["જીત્યા","ઇનામ","તાત્કાલિક","ખાતું","સસ્પેન્ડ","લોટરી","મફત","અભિનંદન"],
    "pa": ["ਜਿੱਤਿਆ","ਇਨਾਮ","ਤੁਰੰਤ","ਖਾਤਾ","ਮੁਅੱਤਲ","ਲਾਟਰੀ","ਮੁਫਤ","ਵਧਾਈ"],
    "it": ["vinto","premio","urgente","clicca","conto","sospeso","lotteria",
           "gratis","congratulazioni"],
    "nl": ["gewonnen","prijs","dringend","klik","account","opgeschort",
           "loterij","gratis","gefeliciteerd"],
    "ru": ["выиграли","приз","срочно","нажмите","счёт","заблокирован",
           "лотерея","бесплатно","поздравляем"],
}

# ── Threat indicator patterns ──────────────────────────────────────────────────
THREAT_PATTERNS = {
    "urgency": [
        r"\b(urgent|urgently|immediately|right now|act fast|expire[sd]?|last chance|hurry|asap|limited time)\b",
        r"\b(तुरंत|अभी|turant|jaldi|فوری|عاجل|segera|dringend|immédiatement|срочно)\b",
    ],
    "financial_bait": [
        r"\b(won|win|winner|prize|reward|lottery|jackpot|free|gift|bonus|₹|\$|€|£)\b",
        r"\b(जीत|पुरस्कार|लॉटरी|بجائزة|ganado|premio|gagné|gewonnen)\b",
        r"\b(congratulation|félicitation|glückwunsch|تهانينا|бधाई|बधाई)\b",
    ],
    "account_threat": [
        r"\b(suspended|blocked|locked|disabled|expired|terminated|closed|frozen)\b",
        r"\b(kyc|suspended|blocked|locked|freeze|terminate|deactivat)\b",
        r"\b(निलंबित|ब्लॉक|معطل|مسدود|suspendu|gesperrt|askıya)\b",
    ],
    "social_engineering": [
        r"\b(click|tap|open|download|install)\b.{0,20}\b(link|here|now|button)\b",
        r"\b(confirm|provide|share|send|submit|enter).{0,20}\b(details|information|data)\b",
        r"\b(selected|chosen|eligible|qualified|pre.?approved|exclusively for you)\b",
    ],
    "payment_request": [
        r"\b(send|transfer|pay|deposit|invest|wire).{0,20}\b(money|cash|amount|fee|bitcoin|crypto|btc)\b",
        r"\b(bitcoin|crypto|wallet|ethereum|usdt|blockchain|btc)\b",
        r"\b(guaranteed return|double your|500%|1000%)\b",
    ],
    "suspicious_link": [
        r"https?://[^\s]+",
        r"\b\w+\.(xyz|club|online|site|link|tk|ml|ga|cf)/[^\s]*",
        r"\b(bit\.ly|tinyurl|t\.me|wa\.me)/[^\s]+",
    ],
    "external_contact": [
        r"(\+?[\d][\d\s\-\.]{6,}[\d])",
        r"\b(whatsapp|telegram|signal|wechat|viber)\b",
        r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",
    ],
}

# ── Regex patterns ─────────────────────────────────────────────────────────────
URL_PATTERN    = re.compile(r"https?://[^\s]+")
PHONE_PATTERN  = re.compile(r"(\+?[\d][\d\s\-\.]{6,}[\d])")
EMAIL_PATTERN  = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
CRYPTO_PATTERN = re.compile(
    r"\b(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}\b|"
    r"\b0x[a-fA-F0-9]{40}\b"
)

# ── Helper functions ───────────────────────────────────────────────────────────
def detect_language(text: str) -> str:
    try:
        return detect(text)
    except Exception:
        return "en"


def extract_indicators(text: str) -> dict:
    urls   = URL_PATTERN.findall(text)
    phones = [
        p.strip() for p in PHONE_PATTERN.findall(text)
        if len(re.sub(r"\D", "", p)) >= 7
    ]
    emails = EMAIL_PATTERN.findall(text)
    crypto = CRYPTO_PATTERN.findall(text)
    return {
        "urls":           list(set(urls)),
        "phones":         list(set(phones)),
        "emails":         list(set(emails)),
        "crypto_wallets": [
            c[0] if isinstance(c, tuple) else c
            for c in list(set(crypto))
        ],
    }


def detect_threat_indicators(text: str) -> dict:
    text_lower = text.lower()
    found = {}
    for category, patterns in THREAT_PATTERNS.items():
        matches = []
        for pattern in patterns:
            hits = re.findall(pattern, text_lower, re.IGNORECASE)
            matches.extend([
                h if isinstance(h, str) else h[0]
                for h in hits
            ])
        if matches:
            found[category] = list(set(matches))[:3]
    return found


def highlight_suspicious(text: str, language: str) -> list:
    keywords = list(MULTILINGUAL_KEYWORDS.get(language, []))
    keywords += MULTILINGUAL_KEYWORDS.get("en", [])
    highlights = []
    words = text.split()
    for word in words:
        clean = re.sub(r"[^\w]", "", word).lower()
        if any(
            kw.lower() in clean or clean in kw.lower()
            for kw in keywords
            if len(clean) > 2
        ):
            highlights.append(word)
    return list(set(highlights))


def get_model_score(text: str) -> float:
    try:
        inputs = tokenizer(
            text[:512],
            return_tensors="pt",
            truncation=True,
            padding=True,
            max_length=128,
        )
        if USE_GPU:
            inputs = {k: v.cuda() for k, v in inputs.items()}
        with torch.no_grad():
            outputs = model(**inputs)
            probs   = torch.softmax(outputs.logits, dim=-1).cpu()

        # label 1 = SCAM in our trained model
        # handle both trained model and fallback model label schemes
        config_labels = model.config.id2label
        scam_idx = None
        for idx, lbl in config_labels.items():
            if lbl.upper() in ["SCAM", "SPAM", "1"]:
                scam_idx = idx
                break
        if scam_idx is None:
            scam_idx = 1
        return probs[0][scam_idx].item()
    except Exception as e:
        print(f"Model inference error: {e}")
        return 0.3


def calculate_risk(
    model_score: float,
    indicators:  dict,
    threats:     dict,
    keyword_count: int,
) -> dict:
    base           = model_score * 100
    threat_boost   = len(threats)  * 10
    keyword_boost  = min(keyword_count * 5, 20)
    url_boost      = 10 if indicators["urls"]   else 0
    phone_boost    = 8  if indicators["phones"] else 0
    email_boost    = 5  if indicators["emails"] else 0

    risk_score = int(min(
        base + threat_boost + keyword_boost + url_boost + phone_boost + email_boost,
        100
    ))

    if   risk_score <= 30: level = "LOW"
    elif risk_score <= 60: level = "MEDIUM"
    elif risk_score <= 85: level = "HIGH"
    else:                  level = "CRITICAL"

    return {"score": risk_score, "level": level}


# ── Main scan function ─────────────────────────────────────────────────────────
def scan_message(text: str, use_ai_reasoning: bool = True) -> dict:
    language    = detect_language(text)
    indicators  = extract_indicators(text)
    threats     = detect_threat_indicators(text)
    highlights  = highlight_suspicious(text, language)
    model_score = get_model_score(text)
    risk        = calculate_risk(model_score, indicators, threats, len(highlights))

    result = {
        "language":          language,
        "risk_score":        risk["score"],
        "risk_level":        risk["level"],
        "highlights":        highlights,
        "indicators":        indicators,
        "threat_indicators": threats,
        "scam_probability":  risk["score"],
        "ai_reasoning":      None,
    }

    if use_ai_reasoning:
        try:
            from app.ml.reasoner import get_ai_reasoning
            ai = get_ai_reasoning(
                message    = text,
                risk_score = risk["score"],
                risk_level = risk["level"],
                language   = language,
                indicators = indicators,
                threats    = threats,
                highlights = highlights,
            )
            result["ai_reasoning"] = ai

            # Score fusion — AI verdict corrects ML score
            if ai:
                verdict    = ai.get("verdict", "").upper()
                confidence = ai.get("confidence", "").upper()
                ml_score   = risk["score"]

                if verdict == "LEGITIMATE" and confidence in ["HIGH", "MEDIUM"]:
                    # AI says safe — cap score at 35 regardless of ML
                    fused_score = min(ml_score, 35)
                elif verdict == "SCAM" and confidence == "HIGH":
                    # AI says scam with high confidence — floor score at 70
                    fused_score = max(ml_score, 70)
                elif verdict == "SCAM" and confidence == "MEDIUM":
                    fused_score = max(ml_score, 55)
                elif verdict == "SUSPICIOUS":
                    fused_score = max(ml_score, 45)
                else:
                    fused_score = ml_score

                fused_score = int(min(fused_score, 100))

                if   fused_score <= 30: fused_level = "LOW"
                elif fused_score <= 60: fused_level = "MEDIUM"
                elif fused_score <= 85: fused_level = "HIGH"
                else:                   fused_level = "CRITICAL"

                result["risk_score"]       = fused_score
                result["risk_level"]       = fused_level
                result["scam_probability"] = fused_score

        except Exception as e:
            print(f"AI reasoning skipped: {e}")

    return result