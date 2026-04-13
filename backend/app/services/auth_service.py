from sqlalchemy.orm import Session
from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta
from app.models.user import User
from app.schemas.auth import SignupRequest, LoginRequest
from app.config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
import uuid

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def signup_user(db: Session, data: SignupRequest):
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        return None, "Email already registered"

    user = User(
        id=str(uuid.uuid4()),
        name=data.name,
        email=data.email,
        password=hash_password(data.password),
        role="user"
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user, None

def login_user(db: Session, data: LoginRequest):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not user.password:
        return None, "Invalid email or password"
    if not verify_password(data.password, user.password):
        return None, "Invalid email or password"
    return user, None