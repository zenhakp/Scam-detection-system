from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import Base, engine
from app.routers import auth, scan, admin, dataset

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Scam Detection API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(scan.router)
app.include_router(admin.router)
app.include_router(dataset.router)

@app.get("/")
def root():
    return {"message": "Scam Detection API is running"}

@app.get("/health")
def health():
    return {"status": "ok"}