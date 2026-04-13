from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.scan import ScanRequest, ScanResponse, ScanHistoryItem
from app.models.scan import Scan
from app.ml.scanner import scan_message
from app.routers.auth_middleware import get_current_user
from app.services.campaign_service import update_campaigns
from typing import List
import uuid

router = APIRouter(prefix="/scan", tags=["scan"])


@router.post("/", response_model=ScanResponse)
def scan(
    data: ScanRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not data.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    result = scan_message(data.message)

    scan_record = Scan(
        id           = str(uuid.uuid4()),
        user_id      = current_user["id"],
        message      = data.message,
        risk_score   = result["risk_score"],
        risk_level   = result["risk_level"],
        language     = result["language"],
        indicators   = result["indicators"],
        highlights   = result["highlights"],
        threats      = result.get("threat_indicators", {}),
        ai_reasoning = result.get("ai_reasoning"),
    )
    db.add(scan_record)
    db.commit()
    db.refresh(scan_record)

    try:
        update_campaigns(db, scan_record)
    except Exception as e:
        print(f"Campaign update failed (non-fatal): {e}")

    # Push to real-time alert feed if HIGH or CRITICAL
    if result["risk_level"] in ["HIGH", "CRITICAL"]:
        try:
            from app.routers.admin import push_alert
            from datetime import datetime
            import pytz
            IST = pytz.timezone("Asia/Kolkata")
            ist_now = datetime.utcnow().replace(
                tzinfo=pytz.utc
            ).astimezone(IST).strftime("%H:%M:%S")

            ai = result.get("ai_reasoning") or {}
            push_alert({
                "type":        "new_scan",
                "id":          scan_record.id,
                "message":     data.message[:80] + ("..." if len(data.message) > 80 else ""),
                "risk_level":  result["risk_level"],
                "risk_score":  result["risk_score"],
                "language":    result["language"],
                "verdict":     ai.get("verdict", result["risk_level"]),
                "time":        ist_now,
                "indicators":  sum(
                    len(v) for v in result["indicators"].values()
                    if isinstance(v, list)
                ),
            })
        except Exception as e:
            print(f"Alert push failed (non-fatal): {e}")

    return {
        **result,
        "id":         scan_record.id,
        "message":    data.message,
        "created_at": scan_record.created_at,
    }


@router.get("/history", response_model=list[ScanHistoryItem])
def get_history(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    risk_level: str = Query(None),
    language:   str = Query(None),
    limit:      int = Query(50),
    offset:     int = Query(0),
):
    query = db.query(Scan).filter(Scan.user_id == current_user["id"])
    if risk_level:
        query = query.filter(Scan.risk_level == risk_level.upper())
    if language:
        query = query.filter(Scan.language == language)
    return query.order_by(Scan.created_at.desc()).offset(offset).limit(limit).all()


@router.get("/history/stats")
def get_stats(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    scans      = db.query(Scan).filter(Scan.user_id == current_user["id"]).all()
    total      = len(scans)
    scam_count = sum(1 for s in scans if s.risk_level in ["HIGH", "CRITICAL"])
    by_level:    dict = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}
    by_language: dict = {}
    for s in scans:
        if s.risk_level in by_level:
            by_level[s.risk_level] += 1
        lang = s.language or "unknown"
        by_language[lang] = by_language.get(lang, 0) + 1
    return {
        "total":       total,
        "scam_count":  scam_count,
        "safe_count":  total - scam_count,
        "by_level":    by_level,
        "by_language": by_language,
    }


@router.get("/history/{scan_id}")
def get_scan_detail(
    scan_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    scan = db.query(Scan).filter(
        Scan.id == scan_id,
        Scan.user_id == current_user["id"],
    ).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    return scan


@router.delete("/history/bulk")
def delete_multiple_scans(
    scan_ids: List[str] = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    deleted = db.query(Scan).filter(
        Scan.id.in_(scan_ids),
        Scan.user_id == current_user["id"],
    ).delete(synchronize_session=False)
    db.commit()
    return {"message": f"Deleted {deleted} scans"}


@router.delete("/history/{scan_id}")
def delete_scan(
    scan_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    scan = db.query(Scan).filter(
        Scan.id == scan_id,
        Scan.user_id == current_user["id"],
    ).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    db.delete(scan)
    db.commit()
    return {"message": "Deleted successfully"}