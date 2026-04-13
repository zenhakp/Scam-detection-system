from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from app.database import get_db, SessionLocal
from app.models.scan import Scan
from app.models.campaign import Campaign
from app.models.user import User
from app.routers.auth_middleware import require_admin
from app.services.campaign_service import get_threat_intelligence
from datetime import datetime, timedelta
from collections import defaultdict
from fastapi import Request, Query as FastAPIQuery
import asyncio
import json
import queue
import threading

router = APIRouter(prefix="/admin", tags=["admin"])

# Global alert queue — new scans get pushed here
alert_queue: queue.Queue = queue.Queue(maxsize=100)


def push_alert(scan_data: dict):
    """Called from scan router when a new HIGH/CRITICAL scan comes in"""
    try:
        alert_queue.put_nowait(scan_data)
    except queue.Full:
        # Drop oldest if queue is full
        try:
            alert_queue.get_nowait()
            alert_queue.put_nowait(scan_data)
        except Exception:
            pass


@router.get("/alerts/stream")
async def alert_stream(
    request: Request,
    token: str = FastAPIQuery(...),
):
    """Server-Sent Events — token passed as query param since EventSource
    doesn't support custom headers in browsers"""
    from jose import jwt, JWTError
    from app.config import SECRET_KEY, ALGORITHM

    # Verify token manually since we can't use the bearer dependency
    try:
        payload  = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        role     = payload.get("role", "user")
        if role != "admin":
            from fastapi import HTTPException
            raise HTTPException(status_code=403, detail="Admin only")
    except JWTError:
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Invalid token")

    async def event_generator():
        yield f"data: {json.dumps({'type': 'connected', 'message': 'Alert stream connected'})}\n\n"

        while True:
            if await request.is_disconnected():
                break
            try:
                alert = alert_queue.get_nowait()
                yield f"data: {json.dumps(alert)}\n\n"
            except queue.Empty:
                yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"
                await asyncio.sleep(3)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":               "no-cache",
            "Connection":                  "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "X-Accel-Buffering":           "no",
        },
    )


@router.get("/dashboard")
def get_dashboard(
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin),
):
    total_scans     = db.query(Scan).count()
    total_users     = db.query(User).count()
    total_campaigns = db.query(Campaign).count()
    scam_scans      = db.query(Scan).filter(
        Scan.risk_level.in_(["HIGH", "CRITICAL"])
    ).count()

    total_indicators = 0
    scans = db.query(Scan).all()
    for scan in scans:
        if scan.indicators:
            for vals in scan.indicators.values():
                if isinstance(vals, list):
                    total_indicators += len(vals)

    by_level = {}
    rows = db.execute(
        text('SELECT "riskLevel", COUNT(id) FROM scans GROUP BY "riskLevel"')
    ).fetchall()
    for level, count in rows:
        by_level[level] = count

    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    recent_scans = db.query(Scan).filter(
        Scan.created_at >= thirty_days_ago
    ).order_by(Scan.created_at).all()

    timeline: dict = defaultdict(lambda: {"total": 0, "scam": 0})
    for scan in recent_scans:
        day = scan.created_at.strftime("%Y-%m-%d")
        timeline[day]["total"] += 1
        if scan.risk_level in ["HIGH", "CRITICAL"]:
            timeline[day]["scam"] += 1

    timeline_data = [
        {"date": date, "total": vals["total"], "scam": vals["scam"]}
        for date, vals in sorted(timeline.items())
    ]

    by_language: dict = defaultdict(int)
    for scan in scans:
        lang = scan.language or "unknown"
        by_language[lang] += 1

    top_languages = sorted(
        [{"language": k, "count": v} for k, v in by_language.items()],
        key=lambda x: x["count"],
        reverse=True,
    )[:10]

    return {
        "total_scans":      total_scans,
        "total_users":      total_users,
        "total_campaigns":  total_campaigns,
        "scam_scans":       scam_scans,
        "total_indicators": total_indicators,
        "by_level":         by_level,
        "timeline":         timeline_data,
        "top_languages":    top_languages,
    }


@router.get("/campaigns")
def get_campaigns(
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin),
):
    campaigns = db.query(Campaign).order_by(
        Campaign.message_count.desc()
    ).all()
    return campaigns


@router.get("/threat-intelligence")
def threat_intelligence(
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin),
):
    return get_threat_intelligence(db)


@router.get("/recent-scans")
def recent_scans(
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin),
):
    scans = db.query(Scan).order_by(
        Scan.created_at.desc()
    ).limit(20).all()
    return scans


@router.get("/network-graph")
def network_graph(
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin),
):
    import re
    scans = db.query(Scan).filter(
        Scan.risk_level.in_(["HIGH", "CRITICAL"])
    ).order_by(Scan.created_at.desc()).limit(30).all()

    scans_with_indicators = [
        s for s in scans
        if s.indicators and any(
            len(v) > 0
            for v in s.indicators.values()
            if isinstance(v, list)
        )
    ]

    nodes = []
    edges = []
    seen_nodes = set()
    seen_edges = set()

    indicator_frequency: dict = {}
    for scan in scans_with_indicators:
        if not scan.indicators:
            continue
        for key in ["urls", "phones", "emails", "crypto_wallets"]:
            for val in scan.indicators.get(key, []):
                indicator_frequency[val] = indicator_frequency.get(val, 0) + 1

    def add_node(node_id, label, node_type, data=None):
        if node_id not in seen_nodes:
            seen_nodes.add(node_id)
            nodes.append({
                "id":    node_id,
                "label": label[:35] if len(label) > 35 else label,
                "type":  node_type,
                "data":  data or {},
            })

    def add_edge(source, target, label):
        edge_key = f"{source}_{target}"
        if edge_key not in seen_edges:
            seen_edges.add(edge_key)
            edges.append({
                "id":     edge_key,
                "source": source,
                "target": target,
                "label":  label,
            })

    for scan in scans_with_indicators:
        scan_id    = f"scan_{scan.id[:8]}"
        scan_label = scan.message[:40] + "..." if len(scan.message) > 40 else scan.message
        add_node(scan_id, scan_label, "message", {
            "risk_level": scan.risk_level,
            "language":   scan.language or "unknown",
        })

        for url in scan.indicators.get("urls", []):
            url_id = f"url_{url[:40]}"
            add_node(url_id, url[:35], "url", {"frequency": str(indicator_frequency.get(url, 1))})
            add_edge(scan_id, url_id, "url")

        for phone in scan.indicators.get("phones", []):
            clean    = re.sub(r"\s", "", phone)
            phone_id = f"phone_{clean}"
            add_node(phone_id, phone[:20], "phone", {"frequency": str(indicator_frequency.get(phone, 1))})
            add_edge(scan_id, phone_id, "phone")

        for email in scan.indicators.get("emails", []):
            email_id = f"email_{email[:40]}"
            add_node(email_id, email[:30], "email", {"frequency": str(indicator_frequency.get(email, 1))})
            add_edge(scan_id, email_id, "email")

        for wallet in scan.indicators.get("crypto_wallets", []):
            wallet_id = f"wallet_{wallet[:20]}"
            add_node(wallet_id, wallet[:20], "wallet", {})
            add_edge(scan_id, wallet_id, "wallet")

    shared_indicators = [ind for ind, freq in indicator_frequency.items() if freq > 1]

    return {
        "nodes":             nodes,
        "edges":             edges,
        "shared_indicators": shared_indicators,
        "stats": {
            "total_messages":   len(scans_with_indicators),
            "total_indicators": len([n for n in nodes if n["type"] != "message"]),
            "shared_count":     len(shared_indicators),
        }
    }


@router.get("/timeline")
def timeline_analytics(
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin),
):
    try:
        import pytz
        IST = pytz.timezone("Asia/Kolkata")
    except ImportError:
        IST = None

    scans = db.query(Scan).order_by(Scan.created_at.desc()).all()

    daily:   dict = {}
    weekly:  dict = {}
    by_hour: dict = {str(h): 0 for h in range(24)}
    by_day:  dict = {"Mon": 0, "Tue": 0, "Wed": 0, "Thu": 0, "Fri": 0, "Sat": 0, "Sun": 0}

    for scan in scans:
        if IST:
            import pytz as _pytz
            utc_time = scan.created_at.replace(tzinfo=_pytz.utc)
            ist_time = utc_time.astimezone(IST)
        else:
            ist_time = scan.created_at

        day  = ist_time.strftime("%Y-%m-%d")
        week = ist_time.strftime("%Y-W%W")
        hour = str(ist_time.hour)
        dow  = ist_time.strftime("%a")

        if day not in daily:
            daily[day] = {"date": day, "total": 0, "scam": 0, "safe": 0}
        daily[day]["total"] += 1
        if scan.risk_level in ["HIGH", "CRITICAL"]:
            daily[day]["scam"] += 1
        else:
            daily[day]["safe"] += 1

        if week not in weekly:
            weekly[week] = {"week": week, "total": 0, "scam": 0}
        weekly[week]["total"] += 1
        if scan.risk_level in ["HIGH", "CRITICAL"]:
            weekly[week]["scam"] += 1

        by_hour[hour] = by_hour.get(hour, 0) + 1
        by_day[dow]   = by_day.get(dow, 0) + 1

    return {
        "daily":    sorted(daily.values(),  key=lambda x: x["date"])[-30:],
        "weekly":   sorted(weekly.values(), key=lambda x: x["week"])[-12:],
        "by_hour":  [{"hour": f"{h}:00", "scans": by_hour[str(h)]} for h in range(24)],
        "by_day":   [{"day": d, "scans": by_day[d]} for d in ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]],
        "timezone": "Asia/Kolkata (IST)",
    }