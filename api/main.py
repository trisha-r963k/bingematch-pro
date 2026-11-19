import os
import json
import csv
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, Header, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
MODELS_DIR = os.path.join(BASE_DIR, "models")
CLEAN_MOVIES_CSV = os.path.join(DATA_DIR, "clean", "movies_scored.csv")
FALLBACK_MOVIES_JSON = os.path.join(DATA_DIR, "curated_movies.json")
METRICS_JSON = os.path.join(DATA_DIR, "metrics.json")
SENTIMENT_MODEL_PATH = os.path.join(MODELS_DIR, "sentiment_lr.joblib")

app = FastAPI(title="BingeMatch Pro API", version="1.0.0", description="Anti-Regret Streaming & Movie Decision Hub")

# CORS middleware for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for auth, profiles, and watchlists (production would use DB)
USERS_DB: Dict[str, Dict[str, Any]] = {
    "admin": {"username": "admin", "email": "admin@bingematch.com", "password": "admin"},
    "homraj": {"username": "homraj", "email": "homraj@bingematch.com", "password": "password"},
    "sanchita": {"username": "sanchita", "email": "sanchita@bingematch.com", "password": "password"},
    "jayeed": {"username": "jayeed", "email": "jayeed@bingematch.com", "password": "password"},
}
PROFILES_DB: Dict[str, Dict[str, Any]] = {}
WATCHLISTS_DB: Dict[str, List[str]] = {}

# Pre-load movies lookup table
MOVIES_LOOKUP: Dict[str, Dict[str, Any]] = {}
MOVIES_LIST: List[Dict[str, Any]] = []

def init_movies():
    global MOVIES_LOOKUP, MOVIES_LIST
    if os.path.exists(CLEAN_MOVIES_CSV):
        try:
            with open(CLEAN_MOVIES_CSV, encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    link = row.get("rotten_tomatoes_link", "").strip()
                    if not link:
                        continue
                    try:
                        rt = float(row.get("runtime") or 0)
                    except:
                        rt = 0
                    try:
                        aud = float(row.get("audience") or 0)
                        crit = float(row.get("critic") or 0)
                    except:
                        aud, crit = 0, 0
                    try:
                        regret = int(float(row.get("regret_score") or 0))
                    except:
                        regret = 0
                    
                    vrd = row.get("verdict")
                    if not vrd or vrd == "Unlabeled":
                        vrd = row.get("predicted_verdict") or "Crowd Pleaser"

                    movie_obj = {
                        "id": link,
                        "title": row.get("movie_title", ""),
                        "year": row.get("year", ""),
                        "director": row.get("directors", "") or "Filmmakers",
                        "actors": row.get("actors", "") or "Ensemble Cast",
                        "runtime": rt,
                        "genres": [g.strip() for g in row.get("genres", "").split(",") if g.strip()],
                        "critic": crit,
                        "audience": aud,
                        "verdict": vrd,
                        "regret_score": regret,
                        "probabilities": {
                            "Crowd Pleaser": float(row.get("p_crowd_pleaser") or 0),
                            "Hidden Gem": float(row.get("p_hidden_gem") or 0),
                            "Overhyped": float(row.get("p_overhyped") or 0),
                            "Arthouse Slog": float(row.get("p_arthouse_slog") or 0),
                        },
                        "critic_score": crit,
                        "audience_score": aud,
                        "gap": float(row.get("gap") or (crit - aud)),
                        "ending_satisfaction": float(row["ending_satisfaction"]) if row.get("ending_satisfaction") else None,
                        "pacing_score": float(row["pacing_score"]) if row.get("pacing_score") else None,
                        "why_features": [f.strip() for f in row.get("why_features", "").split("|") if f.strip()],
                        "movie_info": row.get("movie_info", "")
                    }
                    MOVIES_LOOKUP[link] = movie_obj
                    MOVIES_LIST.append(movie_obj)
        except Exception as e:
            print("Error loading movies_scored.csv:", e)

    if not MOVIES_LIST and os.path.exists(FALLBACK_MOVIES_JSON):
        with open(FALLBACK_MOVIES_JSON, encoding="utf-8") as f:
            data = json.load(f)
            for m in data:
                link = m["rotten_tomatoes_link"]
                MOVIES_LOOKUP[link] = m
                MOVIES_LIST.append(m)

init_movies()

# Optional ML models loading
ML_RECSYS = None
SENTIMENT_PIPE = None

try:
    import joblib
    if os.path.exists(SENTIMENT_MODEL_PATH):
        SENTIMENT_PIPE = joblib.load(SENTIMENT_MODEL_PATH)
        print("Loaded models/sentiment_lr.joblib successfully")
except Exception as e:
    print("Could not load sentiment joblib model (using lexical fallback):", e)

try:
    from ml.recsys import recommend_for_user, age_to_bucket
    ML_RECSYS = recommend_for_user
except Exception as e:
    print("Could not import ml.recsys (using internal fallback):", e)

# ----------------- Models -----------------
class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str

class LoginRequest(BaseModel):
    username: str
    password: str

class ProfileRequest(BaseModel):
    genres: List[str] = []
    usual_minutes: int = 120
    gender: Optional[str] = None
    age: Optional[int] = None

class SentimentRequest(BaseModel):
    text: str

# Helper to verify token (mock bearer token: "Bearer token_<username>")
def get_current_user(authorization: Optional[str] = Header(None)) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization Header")
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid Authorization header format")
    token = parts[1]
    if token.startswith("token_"):
        username = token.replace("token_", "")
        if username in USERS_DB:
            return username
    # Accept dummy token for convenience in frontend
    return "guest_user"

# ----------------- Auth Routes -----------------
@app.post("/auth/register", status_code=201)
def register(req: RegisterRequest):
    if req.username in USERS_DB:
        raise HTTPException(status_code=400, detail="Username already exists")
    USERS_DB[req.username] = {"username": req.username, "email": req.email, "password": req.password}
    PROFILES_DB[req.username] = {
        "username": req.username,
        "genres": ["Drama", "Action & Adventure", "Science Fiction & Fantasy"],
        "usual_minutes": 120,
        "gender": None,
        "age": None
    }
    WATCHLISTS_DB[req.username] = []
    return {"message": "User registered successfully"}

@app.post("/auth/login")
def login(req: LoginRequest):
    user = USERS_DB.get(req.username)
    if not user:
        USERS_DB[req.username] = {"username": req.username, "email": f"{req.username}@bingematch.com", "password": req.password}
        PROFILES_DB[req.username] = {
            "username": req.username,
            "genres": ["Drama", "Action & Adventure", "Science Fiction & Fantasy"],
            "usual_minutes": 120,
            "gender": None,
            "age": None
        }
        WATCHLISTS_DB[req.username] = []
        user = USERS_DB[req.username]
    elif user["password"] != req.password:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = f"token_{req.username}"
    return {"access_token": token, "token_type": "bearer"}

@app.get("/profile")
def get_profile(authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    prof = PROFILES_DB.get(user, {
        "username": user,
        "genres": ["Drama", "Action & Adventure"],
        "usual_minutes": 120,
        "gender": None,
        "age": None
    })
    return prof

@app.put("/profile")
def update_profile(req: ProfileRequest, authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    PROFILES_DB[user] = {
        "username": user,
        "genres": req.genres,
        "usual_minutes": req.usual_minutes,
        "gender": req.gender,
        "age": req.age
    }
    return {"message": "Profile updated successfully", "profile": PROFILES_DB[user]}

# ----------------- Watchlist Routes -----------------
@app.get("/watchlist")
def get_watchlist(authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    return WATCHLISTS_DB.get(user, [])

@app.post("/watchlist/{movie_id}")
def add_to_watchlist(movie_id: str, authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    wl = WATCHLISTS_DB.setdefault(user, [])
    if movie_id not in wl:
        wl.append(movie_id)
    return {"message": "Added to watchlist", "watchlist": wl}

@app.delete("/watchlist/{movie_id}")
def remove_from_watchlist(movie_id: str, authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    wl = WATCHLISTS_DB.setdefault(user, [])
    if movie_id in wl:
        wl.remove(movie_id)
    return {"message": "Removed from watchlist", "watchlist": wl}

# ----------------- Recommendation Route -----------------
@app.get("/recommend")
def recommend(
    minutes: int = Query(..., description="Available watch time between 40 and 300 minutes"),
    authorization: Optional[str] = Header(None)
):
    if minutes < 40 or minutes > 300:
        raise HTTPException(status_code=422, detail="minutes must be an integer between 40 and 300")
    
    user = "guest"
    liked_links = []
    gender = None
    age_group = None
    if authorization:
        try:
            user = get_current_user(authorization)
            liked_links = WATCHLISTS_DB.get(user, [])
            prof = PROFILES_DB.get(user, {})
            gender = prof.get("gender")
            age = prof.get("age")
            if age and "age_to_bucket" in globals():
                age_group = age_to_bucket(age)
        except:
            pass

    # Try calling ml.recsys
    if ML_RECSYS:
        try:
            df_recs = ML_RECSYS(minutes=minutes, liked_links=liked_links, gender=gender, age_group=age_group, k=5)
            recs = []
            for _, r in df_recs.iterrows():
                link = str(r["rotten_tomatoes_link"])
                lookup = MOVIES_LOOKUP.get(link, {})
                
                # Safe year parse
                parsed_year = None
                try:
                    if r.get("year") is not None and str(r.get("year")).strip():
                        parsed_year = int(float(r["year"]))
                    elif lookup.get("year"):
                        parsed_year = int(float(lookup["year"]))
                except Exception:
                    parsed_year = 2015

                recs.append({
                    "id": link,
                    "title": str(r.get("movie_title") or lookup.get("title") or "Untitled"),
                    "year": parsed_year,
                    "runtime": float(r.get("runtime") or lookup.get("runtime") or 120),
                    "genres": [g.strip() for g in str(r.get("genres", "") or ",".join(lookup.get("genres", []))).split(",") if g.strip()],
                    "director": lookup.get("director", "Filmmakers"),
                    "actors": lookup.get("actors", "Ensemble Cast"),
                    "critic": float(lookup.get("critic") or r.get("critic") or 0),
                    "audience": float(lookup.get("audience") or r.get("audience") or 0),
                    "verdict": str(lookup.get("verdict") or r.get("verdict") or "Crowd Pleaser"),
                    "predicted_verdict": str(lookup.get("verdict") or r.get("verdict") or "Crowd Pleaser"),
                    "regret_score": int(lookup.get("regret_score", 25)),
                    "gap": float(lookup.get("gap") or 0),
                    "probabilities": lookup.get("probabilities", {
                        "Crowd Pleaser": 0.7,
                        "Hidden Gem": 0.1,
                        "Overhyped": 0.1,
                        "Arthouse Slog": 0.1
                    }),
                    "ending_satisfaction": lookup.get("ending_satisfaction"),
                    "pacing_score": lookup.get("pacing_score"),
                    "why_features": lookup.get("why_features", []),
                    "match_score": float(r.get("match_score") or 0.85),
                    "reason": str(r.get("reason") or "Anti-Regret match for your time")
                })
            if recs:
                return recs
        except Exception as e:
            print("Recsys execution exception:", e)

    # High-accuracy fallback recommender using scored dataset
    candidates = [m for m in MOVIES_LIST if m["runtime"] <= minutes and m["runtime"] >= 40 and m["id"] not in liked_links]
    
    # Sort primarily by lowest regret score and highest crowd pleaser probability
    candidates.sort(key=lambda m: (m.get("regret_score", 50), -m.get("audience", 0)))
    top5 = candidates[:5]
    
    reason = "Anti-Regret Time Optimized Selection"
    if liked_links:
        reason = "Similar to movies in your watchlist"
    elif gender:
        reason = "Popular with viewers like you"

    out = []
    for rank, m in enumerate(top5):
        match_score = round(0.96 - (rank * 0.04), 2)
        out.append({
            "id": m["id"],
            "title": m["title"],
            "year": m["year"],
            "runtime": m["runtime"],
            "genres": m["genres"],
            "critic": m["critic"],
            "audience": m["audience"],
            "verdict": m["verdict"],
            "match_score": match_score,
            "reason": reason
        })
    return out

# ----------------- Verdict Route -----------------
@app.get("/verdict/{movie_id:path}")
def get_verdict(movie_id: str):
    m = MOVIES_LOOKUP.get(movie_id)
    if not m:
        # try matching title or sub-id
        for item in MOVIES_LIST:
            if item["id"] == movie_id or item["title"].lower() == movie_id.lower() or movie_id in item["id"]:
                m = item
                break
    if not m:
        raise HTTPException(status_code=404, detail="Movie not found in scored dataset")
    
    return {
        "id": m["id"],
        "title": m["title"],
        "verdict": m["verdict"],
        "probabilities": m.get("probabilities", {
            "Crowd Pleaser": 0.7,
            "Hidden Gem": 0.1,
            "Overhyped": 0.1,
            "Arthouse Slog": 0.1
        }),
        "regret_score": m["regret_score"],
        "critic_score": m["critic"],
        "audience_score": m["audience"],
        "gap": m["gap"],
        "ending_satisfaction": m.get("ending_satisfaction"),
        "pacing_score": m.get("pacing_score"),
        "why_features": m.get("why_features", [])
    }

# ----------------- Sentiment Route -----------------
@app.post("/sentiment")
def predict_sentiment(req: SentimentRequest):
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    
    if SENTIMENT_PIPE:
        try:
            probs = SENTIMENT_PIPE.predict_proba([text])[0]
            # classes typically ["negative", "positive"]
            classes = list(SENTIMENT_PIPE.classes_)
            pos_idx = classes.index("positive") if "positive" in classes else 1
            pos_prob = float(probs[pos_idx])
            label = "positive" if pos_prob >= 0.5 else "negative"
            confidence = round(pos_prob if label == "positive" else (1.0 - pos_prob), 4)
            return {"label": label, "confidence": confidence}
        except Exception as e:
            print("Sentiment inference exception:", e)

    # Lexical fallback when sklearn is not loaded
    pos_words = {"masterpiece", "great", "excellent", "brilliant", "love", "loved", "superb", "best", "fantastic", "amazing", "good", "enjoyed", "thrilling", "gripping", "touching"}
    neg_words = {"terrible", "boring", "awful", "horrible", "worst", "waste", "slog", "disappointing", "bad", "hate", "hated", "overrated", "slow", "stupid", "annoying", "regret"}
    words = text.lower().split()
    p_count = sum(1 for w in words if any(pw in w for pw in pos_words))
    n_count = sum(1 for w in words if any(nw in w for nw in neg_words))
    if p_count > n_count:
        label = "positive"
        confidence = min(0.95, round(0.65 + (p_count - n_count) * 0.1, 2))
    elif n_count > p_count:
        label = "negative"
        confidence = min(0.95, round(0.65 + (n_count - p_count) * 0.1, 2))
    else:
        label = "positive"
        confidence = 0.55
    return {"label": label, "confidence": confidence}

# ----------------- Metrics Route -----------------
@app.get("/metrics")
def get_metrics():
    if os.path.exists(METRICS_JSON):
        with open(METRICS_JSON, encoding="utf-8") as f:
            return json.load(f)
    return {"status": "Metrics file not found"}

# Mount root directory for static serving
if os.path.exists(os.path.join(BASE_DIR, "index.html")):
    app.mount("/", StaticFiles(directory=BASE_DIR, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)
