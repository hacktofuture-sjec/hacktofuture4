from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer, util

app = FastAPI(title="Aegis-DID Analytics Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

active_state = {"trust_score": 1.0, "intent_drift_detected": False}

# Preload lightweight NLP model for intent verification
model = SentenceTransformer('all-MiniLM-L6-v2')

class TrustRequest(BaseModel):
    assigned_intent: str
    current_action: str

class TrustResponse(BaseModel):
    trust_score: float
    intent_drift_detected: bool

@app.post("/calculate_trust", response_model=TrustResponse)
def calculate_trust(req: TrustRequest):
    # Encode vectors for the textual descriptions of what the agent is supposed to do vs what it is about to do
    embeddings = model.encode([req.assigned_intent, req.current_action])
    
    # Calculate dimensional cosine similarity
    score = util.cos_sim(embeddings[0], embeddings[1]).item()
    
    # Simple deterministic heuristic thresholding
    drift_detected = score < 0.5
    
    active_state["trust_score"] = float(score)
    active_state["intent_drift_detected"] = bool(drift_detected)
    
    return TrustResponse(
        trust_score=score,
        intent_drift_detected=drift_detected
    )

@app.get("/latest_score", response_model=TrustResponse)
def get_latest_score():
    return TrustResponse(
        trust_score=active_state["trust_score"],
        intent_drift_detected=active_state["intent_drift_detected"]
    )

@app.get("/health")
def health():
    return {"status": "operational", "model_loaded": True, "version": "2.4.0"}

@app.get("/model_info")
def model_info():
    return {
        "model_name": "all-MiniLM-L6-v2",
        "embedding_dimensions": 384,
        "task": "Semantic Similarity (Cosine Distance)",
        "framework": "PyTorch + sentence-transformers",
        "threshold": 0.5,
        "active_state": active_state
    }
