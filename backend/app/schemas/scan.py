from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime


class ScanRequest(BaseModel):
    message: str


class IndicatorResult(BaseModel):
    urls:           list[str]
    phones:         list[str]
    emails:         list[str]
    crypto_wallets: list[str]


class AIReasoning(BaseModel):
    verdict:            str
    confidence:         str
    summary:            str
    tactics_used:       list[str]
    red_flags:          list[str]
    safe_to_ignore:     bool
    recommended_action: str
    explanation:        str


class ScanResponse(BaseModel):
    id:                str
    message:           str
    risk_score:        int
    risk_level:        str
    language:          str
    scam_probability:  int
    highlights:        list[str]
    indicators:        IndicatorResult
    threat_indicators: dict
    ai_reasoning:      Optional[AIReasoning]
    created_at:        datetime

    class Config:
        from_attributes = True


class ScanHistoryItem(BaseModel):
    id:          str
    message:     str
    risk_score:  int
    risk_level:  str
    language:    Optional[str]
    indicators:  Optional[Any]
    threats:     Optional[Any]
    ai_reasoning: Optional[Any]
    created_at:  datetime

    class Config:
        from_attributes = True