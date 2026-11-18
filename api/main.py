"""
=====================================================================
 BingeMatch Pro - BACKEND (single file)          Owner: Jayeed
=====================================================================
This ONE file is the whole backend. It follows docs/API_CONTRACT.md.

What is inside (read top to bottom):
  1. Settings            - values read from environment variables
  2. Database            - SQLite tables: users, profiles, watchlist
  3. Security            - password hashing (bcrypt) + login token (JWT)
  4. Data shapes         - what requests / responses must look like
  5. ML adapter + STUB   - fake ML so the backend works before the real
                           models exist. Switches to Sanchita's real
                           ml/service.py automatically when it is ready.
  6. Helpers
  7. The API routes      - /auth /profile /watchlist /recommend ...
  8. Selftest            - python api/main.py selftest
  9. Setup               - python api/main.py setup   (creates .gitignore, .env,
                           requirements.txt, README_API.md, then runs the selftest)

Run the server (from the project ROOT folder):
    python -m uvicorn api.main:app --reload --port 8000
Run the self-check (from the project ROOT folder):
    python api/main.py selftest
Do the remaining one-time setup (from the project ROOT folder):
    python api/main.py setup
=====================================================================
"""
import copy
import importlib
import json
import logging
import os
import re
import secrets
import sqlite3
import sys
import tempfile
import time
from collections import Counter
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from importlib import metadata as importlib_metadata
from pathlib import Path
from typing import Annotated, Any, Literal

import bcrypt
import jwt
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field, ValidationError, field_validator, model_validator
from starlette.exceptions import HTTPException as StarletteHTTPException

# ---------------------------------------------------------------------
# 1. SETTINGS
# ---------------------------------------------------------------------
# ROOT_DIR is the project folder (bingematch-pro). We add it to Python's
# search path so that "from ml import service" can find Sanchita's code.
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

try:  # optional: read a .env file if python-dotenv is installed
    from dotenv import load_dotenv

    load_dotenv(ROOT_DIR / ".env")
except ImportError:
    pass

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("bingematch")

DEFAULT_SECRET = "dev-only-secret-change-me-please-0123456789"
SECRET_KEY = os.getenv("SECRET_KEY", DEFAULT_SECRET)
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "720"))
DB_PATH = os.getenv("DATABASE_PATH", str(Path(__file__).resolve().parent / "bingematch.db"))
CORS_ORIGINS = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
    if o.strip()
]
# ML_MODE:  auto = use real ML if it works, else stub | real = real only | stub = fake only
ML_MODE = os.getenv("ML_MODE", "auto").lower()
# STRICT_ML_OUTPUT=true  -> if ML returns a card that breaks the contract, return 503
# STRICT_ML_OUTPUT=false -> only log a warning and pass the card through
STRICT_ML_OUTPUT = os.getenv("STRICT_ML_OUTPUT", "true").lower() != "false"
MAX_MINUTES = 600
TOP_N = 5

VERDICTS = ("Crowd Pleaser", "Arthouse Slog", "Hidden Gem", "Overhyped")

if SECRET_KEY == DEFAULT_SECRET:
    log.warning("Using the default SECRET_KEY. Fine for a demo; set SECRET_KEY in .env for real use.")


# ---------------------------------------------------------------------
# 2. DATABASE  (SQLite, built into Python - nothing to install)
# ---------------------------------------------------------------------
SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS profiles (
    user_id         INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    favorite_genres TEXT NOT NULL DEFAULT '[]',
    usual_minutes   INTEGER
);
CREATE TABLE IF NOT EXISTS watchlist (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    movie_id INTEGER NOT NULL,
    added_at TEXT NOT NULL,
    UNIQUE (user_id, movie_id)
);
"""


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    conn = connect()
    try:
        conn.executescript(SCHEMA)
        conn.commit()
    finally:
        conn.close()


def get_db():
    """FastAPI dependency: gives each request its own DB connection, then closes it."""
    conn = connect()
    try:
        yield conn
    finally:
        conn.close()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------
# 3. SECURITY  (passwords + tokens)
# ---------------------------------------------------------------------
def hash_password(password: str) -> str:
    """Turn a password into a scrambled hash. The real password is never stored."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    raw = password.encode("utf-8")
    if len(raw) > 72:  # bcrypt limit; register already blocks such passwords
        return False
    try:
        return bcrypt.checkpw(raw, hashed.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(user_id: int) -> str:
    """The token is a 'digital wristband' proving the user logged in."""
    expires = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": str(user_id), "exp": expires}, SECRET_KEY, algorithm="HS256")


def decode_access_token(token: str) -> int | None:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError, TypeError):
        return None


bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    conn: sqlite3.Connection = Depends(get_db),
) -> dict:
    """Used by every protected route. Reads 'Authorization: Bearer <token>'."""
    if creds is None or not creds.credentials:
        raise HTTPException(status_code=401, detail="You are not logged in. Please log in first.")
    user_id = decode_access_token(creds.credentials)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Your session has expired or is invalid. Please log in again.")
    row = conn.execute("SELECT id, username, email FROM users WHERE id = ?", (user_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=401, detail="Your session has expired or is invalid. Please log in again.")
    return dict(row)


# ---------------------------------------------------------------------
# 4. DATA SHAPES  (validation of requests + the MovieCard contract)
# ---------------------------------------------------------------------
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
WHOLE_NUMBER_MSG = "Please enter the minutes you have as a whole number, for example 120."


class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str

    @field_validator("username")
    @classmethod
    def check_username(cls, v: str) -> str:
        v = v.strip()
        if not 3 <= len(v) <= 30:
            raise ValueError("Username must be 3 to 30 characters long.")
        return v

    @field_validator("email")
    @classmethod
    def check_email(cls, v: str) -> str:
        v = v.strip().lower()
        if len(v) > 254 or not EMAIL_RE.match(v):
            raise ValueError("Please enter a valid email address.")
        return v

    @field_validator("password")
    @classmethod
    def check_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        if len(v.encode("utf-8")) > 72:
            raise ValueError("Password is too long (maximum 72 bytes).")
        return v


class LoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def clean_email(cls, v: str) -> str:
        return v.strip().lower()


class ProfileBody(BaseModel):
    favorite_genres: list[str] = []
    usual_minutes: int | None = None

    @field_validator("favorite_genres")
    @classmethod
    def clean_genres(cls, v: list[str]) -> list[str]:
        cleaned: list[str] = []
        seen: set[str] = set()
        for genre in v:
            genre = genre.strip()
            if not genre:
                continue
            if len(genre) > 30:
                raise ValueError("Each genre must be at most 30 characters.")
            if genre.lower() in seen:
                continue
            seen.add(genre.lower())
            cleaned.append(genre)
        if len(cleaned) > 10:
            raise ValueError("You can choose at most 10 favorite genres.")
        return cleaned

    @field_validator("usual_minutes")
    @classmethod
    def check_minutes(cls, v: int | None) -> int | None:
        if v is not None and not 1 <= v <= MAX_MINUTES:
            raise ValueError(f"Usual minutes must be between 1 and {MAX_MINUTES}.")
        return v


class RecommendRequest(BaseModel):
    minutes: int

    @field_validator("minutes", mode="before")
    @classmethod
    def parse_minutes(cls, v: Any) -> Any:
        # Handles: empty, text like "abc", decimals, true/false
        if v is None or isinstance(v, bool):
            raise ValueError(WHOLE_NUMBER_MSG)
        if isinstance(v, str):
            v = v.strip()
            if not re.fullmatch(r"-?\d+", v):
                raise ValueError(WHOLE_NUMBER_MSG)
            return int(v)
        if isinstance(v, float):
            if not v.is_integer():
                raise ValueError(WHOLE_NUMBER_MSG)
            return int(v)
        return v

    @field_validator("minutes")
    @classmethod
    def check_range(cls, v: int) -> int:
        if not 1 <= v <= MAX_MINUTES:
            raise ValueError(f"Minutes must be between 1 and {MAX_MINUTES}.")
        return v


class WatchlistAddRequest(BaseModel):
    movie_id: int

    @field_validator("movie_id")
    @classmethod
    def check_id(cls, v: int) -> int:
        if v < 1:
            raise ValueError("Movie id must be a positive whole number.")
        return v


class SentimentRequest(BaseModel):
    text: str

    @field_validator("text")
    @classmethod
    def check_text(cls, v: str) -> str:
        v = v.strip()
        if not 5 <= len(v) <= 5000:
            raise ValueError("Please enter a review between 5 and 5000 characters.")
        return v


# ---- MovieCard: the object used everywhere (exactly as in the contract) ----
Score100 = Annotated[int | float, Field(ge=0, le=100)]


class EndingBadge(BaseModel):
    score: Score100
    label: Literal["Satisfying", "Mixed", "Unsatisfying"]


class PacingBadge(BaseModel):
    score: Score100
    label: Literal["Slow", "Steady", "Fast"]


class WhyFeature(BaseModel):
    feature: str
    weight: int | float


class MovieCard(BaseModel):
    movie_id: int
    title: str
    year: int
    runtime_minutes: int
    genres: list[str]
    verdict: Literal["Crowd Pleaser", "Arthouse Slog", "Hidden Gem", "Overhyped"]
    verdict_probabilities: dict[str, float]
    regret_score: Score100
    critic_score: Score100
    audience_score: Score100
    critic_audience_gap: int | float
    ending_satisfaction: EndingBadge
    pacing: PacingBadge
    why_features: list[WhyFeature] = Field(min_length=5)
    in_watchlist: bool = False

    @model_validator(mode="after")
    def check_probabilities(self) -> "MovieCard":
        probs = self.verdict_probabilities
        if set(probs.keys()) != set(VERDICTS):
            raise ValueError("verdict_probabilities must have exactly the 4 verdict labels as keys")
        if any(p < 0 or p > 1 for p in probs.values()):
            raise ValueError("each verdict probability must be between 0 and 1")
        if abs(sum(probs.values()) - 1.0) > 0.02:
            raise ValueError("verdict_probabilities must add up to about 1.0")
        return self


# ---------------------------------------------------------------------
# 5. ML ADAPTER + STUB (fake ML)
# ---------------------------------------------------------------------
# The backend NEVER imports the ml package directly. It only talks to
# "ml.impl" below, which is either Sanchita's real ml/service.py or this stub.
REQUIRED_ML_FUNCTIONS = (
    "load_all",
    "recommend",
    "get_movie",
    "search_movies",
    "predict_sentiment",
    "get_metrics",
)

# (id, title, year, runtime, genres, verdict, critic, audience, ending, pacing)
# These are FICTIONAL films with made-up scores, only for testing.
_STUB_ROWS = [
    (1, "The Last Lantern", 2019, 112, ["Drama", "Romance"], "Crowd Pleaser", 84, 90, 82, 55),
    (2, "Neon Harbor", 2021, 128, ["Action", "Thriller"], "Overhyped", 48, 78, 40, 70),
    (3, "Quiet Orchard", 2018, 141, ["Drama"], "Arthouse Slog", 88, 54, 35, 20),
    (4, "Paper Moons", 2017, 96, ["Comedy", "Romance"], "Crowd Pleaser", 79, 85, 78, 72),
    (5, "Signal Lost", 2022, 118, ["Sci-Fi", "Thriller"], "Hidden Gem", 82, 80, 75, 60),
    (6, "Salt and Smoke", 2020, 156, ["Drama", "History"], "Arthouse Slog", 91, 58, 50, 18),
    (7, "Turbo Cadets", 2023, 89, ["Animation", "Family", "Comedy"], "Crowd Pleaser", 74, 88, 85, 85),
    (8, "The Hollow Crown Jewel", 2016, 134, ["Crime", "Thriller"], "Overhyped", 55, 83, 38, 65),
    (9, "Lanterns at Dusk", 2015, 103, ["Documentary"], "Hidden Gem", 88, 76, 70, 45),
    (10, "Orbit Seven", 2024, 147, ["Sci-Fi", "Adventure"], "Overhyped", 49, 79, 42, 80),
    (11, "Small Hours", 2019, 85, ["Horror", "Mystery"], "Hidden Gem", 77, 70, 72, 68),
    (12, "Marathon of Rain", 2014, 168, ["Drama", "Romance"], "Arthouse Slog", 86, 50, 45, 15),
    (13, "Grand Detour", 2022, 124, ["Comedy", "Adventure"], "Crowd Pleaser", 81, 86, 80, 70),
    (14, "Echoes of Tomorrow", 2021, 139, ["Sci-Fi", "Drama"], "Hidden Gem", 84, 74, 78, 52),
    (15, "Brass Knuckle Blues", 2018, 107, ["Action", "Crime"], "Overhyped", 44, 77, 36, 78),
    (16, "Velvet Rooftops", 2020, 150, ["Romance", "Drama"], "Crowd Pleaser", 80, 87, 83, 50),
    (17, "Pocket Stories", 2023, 82, ["Family", "Animation"], "Hidden Gem", 83, 79, 76, 74),
]
_STUB_KEYS = ("id", "title", "year", "runtime", "genres", "verdict", "critic", "audience", "ending", "pacing")
STUB_MOVIES = [dict(zip(_STUB_KEYS, row)) for row in _STUB_ROWS]
STUB_BY_ID = {m["id"]: m for m in STUB_MOVIES}

_STUB_WORDS = {
    "Crowd Pleaser": ["fun", "charming", "heartwarming", "great cast", "satisfying", "feel-good"],
    "Arthouse Slog": ["slow", "meandering", "bleak", "self-indulgent", "long takes", "quiet"],
    "Hidden Gem": ["underrated", "clever", "surprising", "original", "tight script", "fresh"],
    "Overhyped": ["hype", "predictable", "shallow", "loud", "flashy", "disappointing"],
}


def _stub_regret(m: dict) -> float:
    gap = abs(m["critic"] - m["audience"])
    value = 0.4 * (100 - m["audience"]) + 0.3 * (100 - m["critic"]) + 0.2 * (100 - m["ending"]) + 0.1 * gap
    return round(max(0.0, min(100.0, value)), 1)


def _stub_card(m: dict) -> dict:
    others = [v for v in VERDICTS if v != m["verdict"]]
    probs = {v: round(0.38 * w, 4) for v, w in zip(others, (0.5, 0.3, 0.2))}
    probs[m["verdict"]] = round(1 - sum(probs.values()), 4)
    probs = {v: probs[v] for v in VERDICTS}  # keep the contract order
    ending_label = "Satisfying" if m["ending"] >= 70 else "Mixed" if m["ending"] >= 45 else "Unsatisfying"
    pacing_label = "Slow" if m["pacing"] < 40 else "Steady" if m["pacing"] < 70 else "Fast"
    return {
        "movie_id": m["id"],
        "title": m["title"],
        "year": m["year"],
        "runtime_minutes": m["runtime"],
        "genres": list(m["genres"]),
        "verdict": m["verdict"],
        "verdict_probabilities": probs,
        "regret_score": _stub_regret(m),
        "critic_score": m["critic"],
        "audience_score": m["audience"],
        "critic_audience_gap": m["critic"] - m["audience"],
        "ending_satisfaction": {"score": m["ending"], "label": ending_label},
        "pacing": {"score": m["pacing"], "label": pacing_label},
        "why_features": [
            {"feature": w, "weight": round(0.35 - i * 0.04, 2)} for i, w in enumerate(_STUB_WORDS[m["verdict"]])
        ],
    }


class StubML:
    """Fake ML with the same 6 functions as the real ml/service.py."""

    def load_all(self) -> None:
        return None

    def get_movie(self, movie_id: int) -> dict | None:
        m = STUB_BY_ID.get(movie_id)
        return copy.deepcopy(_stub_card(m)) if m else None

    def search_movies(self, q: str, limit: int = 10) -> list[dict]:
        q = q.lower()
        hits = [m for m in STUB_MOVIES if q in m["title"].lower()]
        return [
            {
                "movie_id": m["id"],
                "title": m["title"],
                "year": m["year"],
                "runtime_minutes": m["runtime"],
                "genres": list(m["genres"]),
            }
            for m in hits[:limit]
        ]

    def recommend(self, minutes: int, favorite_genres: list[str], watchlist_movie_ids: list[int], top_n: int = 5) -> list[dict]:
        fav = {g.lower() for g in favorite_genres}
        wl_genres: Counter = Counter()
        for mid in watchlist_movie_ids:
            if mid in STUB_BY_ID:
                wl_genres.update(g.lower() for g in STUB_BY_ID[mid]["genres"])

        def score(m: dict) -> float:
            genres = {g.lower() for g in m["genres"]}
            return 2.0 * len(genres & fav) + 1.0 * sum(wl_genres[g] for g in genres) + (100 - _stub_regret(m)) / 100

        fits = [m for m in STUB_MOVIES if m["runtime"] <= minutes]
        fits.sort(key=lambda m: (-score(m), m["id"]))
        return [_stub_card(m) for m in fits[:top_n]]

    def predict_sentiment(self, text: str) -> dict:
        positive = {"great", "good", "love", "loved", "amazing", "excellent", "brilliant", "fun", "wonderful", "best", "masterpiece"}
        negative = {"bad", "boring", "awful", "terrible", "worst", "hate", "hated", "slow", "waste", "disappointing", "dull"}
        words = re.findall(r"[a-z']+", text.lower())
        diff = sum(w in positive for w in words) - sum(w in negative for w in words)
        label = "negative" if diff < 0 else "positive"
        return {"label": label, "confidence": round(min(0.95, 0.5 + 0.1 * abs(diff)), 2)}

    def get_metrics(self) -> dict:
        def model(name: str, p: float, r: float, f1: float, cv: float, sd: float) -> dict:
            return {
                "name": name,
                "macro_precision": p,
                "macro_recall": r,
                "macro_f1": f1,
                "cv_macro_f1_mean": cv,
                "cv_macro_f1_std": sd,
            }

        return {
            "labels": list(VERDICTS),
            "verdict": {
                "models": [
                    model("Random Forest", 0.71, 0.69, 0.70, 0.68, 0.03),
                    model("SVC", 0.66, 0.64, 0.65, 0.63, 0.04),
                ],
                "best_model": "Random Forest",
                "baseline_macro_f1": 0.18,
                "confusion_matrix": [[42, 5, 6, 7], [4, 38, 8, 3], [6, 7, 35, 5], [8, 4, 5, 40]],
            },
            "sentiment": {
                "models": [
                    model("Logistic Regression", 0.89, 0.89, 0.89, 0.88, 0.01),
                    model("LinearSVC", 0.88, 0.88, 0.88, 0.87, 0.01),
                ],
                "best_model": "Logistic Regression",
            },
        }


class MLState:
    """Holds the ML implementation that is currently in use (real or stub)."""

    def __init__(self) -> None:
        self.impl: Any = None
        self.mode: str = "not_loaded"

    def use_stub(self) -> None:
        self.impl = StubML()
        self.impl.load_all()
        self.mode = "stub"

    def load(self) -> None:
        if ML_MODE == "stub":
            self.use_stub()
            return
        try:
            module = importlib.import_module("ml.service")
            missing = [n for n in REQUIRED_ML_FUNCTIONS if not callable(getattr(module, n, None))]
            if missing:
                raise RuntimeError(f"ml/service.py is missing these functions: {missing}")
            module.load_all()
            self.impl, self.mode = module, "real"
        except Exception as exc:  # noqa: BLE001
            if ML_MODE == "real":
                raise
            log.warning("Real ML not available (%s: %s). Using the STUB (fake data).", type(exc).__name__, exc)
            self.use_stub()
        log.info("ML mode: %s", self.mode)

    def get(self) -> Any:
        if self.impl is None:
            self.load()
        return self.impl


ml = MLState()


# ---------------------------------------------------------------------
# 6. HELPERS
# ---------------------------------------------------------------------
def ml_call(func_name: str, *args: Any, error_detail: str, **kwargs: Any) -> Any:
    """Call an ML function safely. Any crash becomes a friendly 503 (no stack trace for the user)."""
    try:
        return getattr(ml.get(), func_name)(*args, **kwargs)
    except Exception:  # noqa: BLE001
        log.exception("ML function '%s' failed", func_name)
        raise HTTPException(status_code=503, detail=error_detail)


def finalize_card(raw: Any, in_watchlist: bool) -> dict:
    """Check an ML card against the contract and add in_watchlist."""
    data = dict(raw) if isinstance(raw, dict) else {}
    data["in_watchlist"] = in_watchlist
    try:
        return MovieCard.model_validate(data).model_dump()
    except ValidationError as exc:
        movie_id = data.get("movie_id")
        log.error("ML returned a MovieCard that breaks the contract (movie_id=%s): %s", movie_id, exc)
        if STRICT_ML_OUTPUT and isinstance(raw, dict):
            raise HTTPException(
                status_code=503,
                detail="The movie data from the ML module has the wrong format. Please check the server log.",
            )
        if STRICT_ML_OUTPUT:
            raise HTTPException(status_code=503, detail="The ML module returned unusable data.")
        return data


def load_profile(conn: sqlite3.Connection, user_id: int) -> dict:
    row = conn.execute(
        "SELECT favorite_genres, usual_minutes FROM profiles WHERE user_id = ?", (user_id,)
    ).fetchone()
    if row is None:
        return {"favorite_genres": [], "usual_minutes": None}
    try:
        genres = json.loads(row["favorite_genres"])
        if not isinstance(genres, list):
            genres = []
    except (json.JSONDecodeError, TypeError):
        genres = []
    return {"favorite_genres": genres, "usual_minutes": row["usual_minutes"]}


def watchlist_ids(conn: sqlite3.Connection, user_id: int) -> list[int]:
    rows = conn.execute("SELECT movie_id FROM watchlist WHERE user_id = ? ORDER BY id", (user_id,)).fetchall()
    return [r["movie_id"] for r in rows]


def friendly_validation_message(errors: list[dict]) -> str:
    """Turn Pydantic's technical error into one readable sentence."""
    if not errors:
        return "The request is not valid."
    err = errors[0]
    loc = [str(p) for p in err.get("loc", ()) if p not in ("body", "query", "path")]
    field = loc[-1].replace("_", " ") if loc else ""
    etype = str(err.get("type", ""))
    msg = str(err.get("msg", ""))
    if etype == "json_invalid":
        return "The request body is not valid JSON."
    if etype == "missing":
        return f"Please provide '{field}'." if field else "Please send a JSON body."
    if etype.startswith("value_error"):
        return msg.removeprefix("Value error, ")
    if etype.startswith("int_"):
        return f"'{field}' must be a whole number."
    if etype == "string_type":
        return f"'{field}' must be text."
    if etype == "string_too_short":
        return f"'{field}' must not be empty."
    if etype in ("greater_than_equal", "less_than_equal", "less_than", "greater_than"):
        return f"'{field}' is out of the allowed range."
    return f"{field}: {msg}" if field else msg


# ---------------------------------------------------------------------
# 7. THE API
# ---------------------------------------------------------------------
@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()  # create tables if they do not exist
    ml.load()  # load the models ONCE at startup (fast responses later)
    yield


app = FastAPI(
    title="BingeMatch Pro API",
    version="1.0.0",
    description="Backend for BingeMatch Pro. Follows docs/API_CONTRACT.md.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---- Error handlers: every error looks like {"detail": "readable sentence"} ----
@app.exception_handler(StarletteHTTPException)
async def http_error_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    detail = exc.detail if isinstance(exc.detail, str) else "The request could not be completed."
    return JSONResponse(status_code=exc.status_code, content={"detail": detail}, headers=getattr(exc, "headers", None))


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"detail": friendly_validation_message(list(exc.errors()))})


@app.exception_handler(Exception)
async def unexpected_error_handler(_: Request, exc: Exception) -> JSONResponse:
    log.exception("Unexpected error: %s", exc)
    return JSONResponse(status_code=500, content={"detail": "Something went wrong on the server. Please try again."})


# ---- Health + metrics (public) ----
@app.get("/health", tags=["System"])
def health() -> dict:
    return {"status": "ok", "ml_mode": ml.mode}


@app.get("/metrics", tags=["ML"])
def metrics() -> dict:
    data = ml_call("get_metrics", error_detail="Model metrics are not available yet.")
    if not isinstance(data, dict):
        raise HTTPException(status_code=503, detail="Model metrics are not available yet.")
    return data


# ---- Auth ----
@app.post("/auth/register", status_code=201, tags=["Auth"])
def register(body: RegisterRequest, conn: sqlite3.Connection = Depends(get_db)) -> dict:
    if conn.execute("SELECT 1 FROM users WHERE email = ?", (body.email,)).fetchone():
        raise HTTPException(status_code=409, detail="This email is already registered. Please log in.")
    if conn.execute("SELECT 1 FROM users WHERE username = ?", (body.username,)).fetchone():
        raise HTTPException(status_code=409, detail="This username is already taken.")
    try:
        cur = conn.execute(
            "INSERT INTO users (username, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
            (body.username, body.email, hash_password(body.password), now_iso()),
        )
        user_id = cur.lastrowid
        conn.execute("INSERT INTO profiles (user_id, favorite_genres, usual_minutes) VALUES (?, '[]', NULL)", (user_id,))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.rollback()
        raise HTTPException(status_code=409, detail="This email or username is already in use.")
    return {"id": user_id, "username": body.username, "email": body.email}


@app.post("/auth/login", tags=["Auth"])
def login(body: LoginRequest, conn: sqlite3.Connection = Depends(get_db)) -> dict:
    row = conn.execute(
        "SELECT id, username, email, password_hash FROM users WHERE email = ?", (body.email,)
    ).fetchone()
    if row is None or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    return {
        "access_token": create_access_token(row["id"]),
        "token_type": "bearer",
        "user": {"id": row["id"], "username": row["username"], "email": row["email"]},
    }


@app.post("/auth/logout", tags=["Auth"])
def logout(user: dict = Depends(get_current_user)) -> dict:
    # Tokens are stateless; the frontend deletes its copy. We only confirm the token was valid.
    return {"message": "Logged out"}


@app.get("/auth/me", tags=["Auth"])
def me(user: dict = Depends(get_current_user)) -> dict:
    return user


# ---- Profile ----
@app.get("/profile", tags=["Profile"])
def get_profile(user: dict = Depends(get_current_user), conn: sqlite3.Connection = Depends(get_db)) -> dict:
    return load_profile(conn, user["id"])


@app.put("/profile", tags=["Profile"])
def update_profile(
    body: ProfileBody, user: dict = Depends(get_current_user), conn: sqlite3.Connection = Depends(get_db)
) -> dict:
    conn.execute(
        "INSERT INTO profiles (user_id, favorite_genres, usual_minutes) VALUES (?, ?, ?) "
        "ON CONFLICT(user_id) DO UPDATE SET favorite_genres = excluded.favorite_genres, "
        "usual_minutes = excluded.usual_minutes",
        (user["id"], json.dumps(body.favorite_genres), body.usual_minutes),
    )
    conn.commit()
    return load_profile(conn, user["id"])


# ---- Movie search + watchlist ----
@app.get("/movies/search", tags=["Movies"])
def search_movies(
    q: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=25),
    user: dict = Depends(get_current_user),
) -> dict:
    q = q.strip()
    if not q:
        raise HTTPException(status_code=422, detail="Please enter something to search for.")
    found = ml_call("search_movies", q, limit, error_detail="Movie search is not available right now.")
    if not isinstance(found, list):
        raise HTTPException(status_code=503, detail="Movie search is not available right now.")
    keys = ("movie_id", "title", "year", "runtime_minutes", "genres")
    return {"results": [{k: item.get(k) for k in keys} for item in found[:limit] if isinstance(item, dict)]}


@app.get("/watchlist", tags=["Watchlist"])
def get_watchlist(user: dict = Depends(get_current_user), conn: sqlite3.Connection = Depends(get_db)) -> dict:
    items = []
    for movie_id in watchlist_ids(conn, user["id"]):
        raw = ml_call("get_movie", movie_id, error_detail="Your watchlist is not available right now.")
        if raw is None:
            continue  # movie no longer exists in the dataset
        items.append(finalize_card(raw, True))
    return {"items": items}


@app.post("/watchlist", status_code=201, tags=["Watchlist"])
def add_to_watchlist(
    body: WatchlistAddRequest, user: dict = Depends(get_current_user), conn: sqlite3.Connection = Depends(get_db)
) -> dict:
    movie = ml_call("get_movie", body.movie_id, error_detail="The movie database is not available right now.")
    if movie is None:
        raise HTTPException(status_code=404, detail="Movie not found.")
    conn.execute(
        "INSERT OR IGNORE INTO watchlist (user_id, movie_id, added_at) VALUES (?, ?, ?)",
        (user["id"], body.movie_id, now_iso()),
    )
    conn.commit()
    return {"message": "Added", "movie_id": body.movie_id}


@app.delete("/watchlist/{movie_id}", tags=["Watchlist"])
def remove_from_watchlist(
    movie_id: int, user: dict = Depends(get_current_user), conn: sqlite3.Connection = Depends(get_db)
) -> dict:
    cur = conn.execute("DELETE FROM watchlist WHERE user_id = ? AND movie_id = ?", (user["id"], movie_id))
    conn.commit()
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="That movie is not in your watchlist.")
    return {"message": "Removed", "movie_id": movie_id}


# ---- The core features ----
@app.post("/recommend", tags=["ML"])
def recommend(
    body: RecommendRequest, user: dict = Depends(get_current_user), conn: sqlite3.Connection = Depends(get_db)
) -> dict:
    profile = load_profile(conn, user["id"])
    wl = watchlist_ids(conn, user["id"])
    started = time.perf_counter()
    raw_list = ml_call(
        "recommend",
        body.minutes,
        profile["favorite_genres"],
        wl,
        top_n=TOP_N,
        error_detail="The recommendation engine is not available right now. Please try again later.",
    )
    elapsed = time.perf_counter() - started
    if elapsed > 3:
        log.warning("/recommend took %.1f seconds (target is under 3).", elapsed)
    if not isinstance(raw_list, list):
        raise HTTPException(status_code=503, detail="The recommendation engine returned unusable data.")

    wl_set = set(wl)
    results = []
    for raw in raw_list:
        if not isinstance(raw, dict):
            continue
        runtime = raw.get("runtime_minutes")
        if isinstance(runtime, (int, float)) and runtime > body.minutes:
            log.warning("Dropped movie %s: runtime %s is longer than %s minutes.", raw.get("movie_id"), runtime, body.minutes)
            continue  # safety net: never return a film that is too long
        results.append(finalize_card(raw, raw.get("movie_id") in wl_set))
        if len(results) == TOP_N:
            break

    message = None
    if not results:
        message = f"No films fit within {body.minutes} minutes. Try a longer time."
    return {"minutes": body.minutes, "count": len(results), "results": results, "message": message}


@app.get("/verdict/{movie_id}", tags=["ML"])
def verdict(movie_id: int, user: dict = Depends(get_current_user), conn: sqlite3.Connection = Depends(get_db)) -> dict:
    raw = ml_call("get_movie", movie_id, error_detail="The verdict service is not available right now.")
    if raw is None:
        raise HTTPException(status_code=404, detail="Movie not found.")
    return finalize_card(raw, movie_id in set(watchlist_ids(conn, user["id"])))


@app.post("/sentiment", tags=["ML"])
def sentiment(body: SentimentRequest, user: dict = Depends(get_current_user)) -> dict:
    out = ml_call("predict_sentiment", body.text, error_detail="The sentiment service is not available right now.")
    try:
        label = out["label"]
        confidence = float(out["confidence"])
    except (KeyError, TypeError, ValueError):
        raise HTTPException(status_code=503, detail="The sentiment service returned unusable data.")
    if label not in ("positive", "negative"):
        raise HTTPException(status_code=503, detail="The sentiment service returned unusable data.")
    return {"label": label, "confidence": max(0.0, min(1.0, confidence))}


# ---------------------------------------------------------------------
# 8. SELFTEST  ->  python api/main.py selftest
# Checks the whole API against the contract using a temporary database.
# Works in stub mode AND real mode (set ML_MODE=real to test Sanchita's ML).
# ---------------------------------------------------------------------
def run_selftest() -> int:
    global DB_PATH
    from fastapi.testclient import TestClient

    tmp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
    DB_PATH = str(Path(tmp.name) / "selftest.db")
    outcome: list[bool] = []

    def check(name: str, ok: bool, extra: str = "") -> None:
        outcome.append(bool(ok))
        print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f"  -> {extra}" if (extra and not ok) else ""))

    def auth(token: str) -> dict:
        return {"Authorization": f"Bearer {token}"}

    def is_detail(r) -> bool:
        try:
            return isinstance(r.json().get("detail"), str)
        except Exception:  # noqa: BLE001
            return False

    print(f"\nBingeMatch Pro selftest (ML_MODE={ML_MODE})\n")
    with TestClient(app) as c:
        r = c.get("/health")
        check("health works", r.status_code == 200 and r.json().get("status") == "ok", r.text)
        print(f"        ML mode in use: {r.json().get('ml_mode')}")

        print("\nAuth (FR-01, FR-02)")
        reg = {"username": "alice", "email": "Alice@Example.com", "password": "password123"}
        r = c.post("/auth/register", json=reg)
        check("register -> 201", r.status_code == 201 and r.json().get("email") == "alice@example.com", r.text)
        check("register never returns a password", "password" not in r.text.lower())
        r = c.post("/auth/register", json=reg)
        check("duplicate email -> 409", r.status_code == 409 and is_detail(r), r.text)
        r = c.post("/auth/register", json={**reg, "email": "x@y.com", "password": "short"})
        check("short password -> 422 with readable message", r.status_code == 422 and is_detail(r), r.text)
        conn = sqlite3.connect(DB_PATH)
        stored = conn.execute("SELECT password_hash FROM users WHERE email = 'alice@example.com'").fetchone()[0]
        conn.close()
        check("database stores a bcrypt hash, not the password", stored.startswith("$2") and stored != "password123")
        r = c.post("/auth/login", json={"email": "alice@example.com", "password": "wrongpass1"})
        check("wrong password -> 401", r.status_code == 401 and is_detail(r), r.text)
        r = c.post("/auth/login", json={"email": "alice@example.com", "password": "password123"})
        ok = r.status_code == 200 and r.json().get("token_type") == "bearer" and "access_token" in r.json()
        check("login -> token", ok, r.text)
        token = r.json().get("access_token", "")
        check("protected route without token -> 401", c.get("/profile").status_code == 401)
        check("protected route with fake token -> 401", c.get("/profile", headers=auth("abc")).status_code == 401)
        r = c.get("/auth/me", headers=auth(token))
        check("/auth/me works", r.status_code == 200 and r.json().get("username") == "alice", r.text)

        print("\nProfile (FR-03)")
        r = c.get("/profile", headers=auth(token))
        check("new profile is empty", r.json() == {"favorite_genres": [], "usual_minutes": None}, r.text)
        r = c.put("/profile", headers=auth(token), json={"favorite_genres": ["Drama", " drama ", "Sci-Fi"], "usual_minutes": 120})
        check("save profile (duplicates removed)", r.status_code == 200 and r.json()["favorite_genres"] == ["Drama", "Sci-Fi"], r.text)
        r = c.post("/auth/login", json={"email": "alice@example.com", "password": "password123"})
        token2 = r.json()["access_token"]
        r = c.get("/profile", headers=auth(token2))
        check("profile still there after login again", r.json() == {"favorite_genres": ["Drama", "Sci-Fi"], "usual_minutes": 120}, r.text)
        r = c.put("/profile", headers=auth(token), json={"favorite_genres": [], "usual_minutes": 0})
        check("profile minutes 0 -> 422", r.status_code == 422 and is_detail(r), r.text)
        c.put("/profile", headers=auth(token), json={"favorite_genres": [], "usual_minutes": None})

        print("\nRecommend (FR-04 to FR-07)")
        first_list: list[dict] = []
        for minutes in (90, 120, 150):
            r = c.post("/recommend", headers=auth(token), json={"minutes": minutes})
            data = r.json() if r.status_code == 200 else {}
            results = data.get("results", [])
            fits = all(item["runtime_minutes"] <= minutes for item in results)
            check(f"{minutes} min: status 200, <=5 films, all runtimes fit", r.status_code == 200 and len(results) <= 5 and fits, r.text[:200])
            if minutes == 150:
                first_list = results
        for label, payload in (("empty", {"minutes": ""}), ("zero", {"minutes": 0}), ("text", {"minutes": "abc"}), ("missing", {}), ("too big", {"minutes": 9999})):
            r = c.post("/recommend", headers=auth(token), json=payload)
            check(f"invalid minutes ({label}) -> 422 + message", r.status_code == 422 and is_detail(r), r.text)
        r = c.post("/recommend", headers=auth(token))
        check("no body at all -> 422 + message", r.status_code == 422 and is_detail(r), r.text)
        if first_list:
            card = first_list[0]
            probs = sum(card["verdict_probabilities"].values())
            check("card: probabilities sum to ~1", abs(probs - 1) < 0.02)
            check("card: regret score within 0-100", 0 <= card["regret_score"] <= 100)
            check("card: at least 5 why_features", len(card["why_features"]) >= 5)
            check("card: has in_watchlist field", "in_watchlist" in card)
        else:
            check("recommend returned films to inspect", False, "no results for 150 minutes")

        print("\nMovies, verdict, watchlist (FR-09)")
        if first_list:
            movie_id = first_list[0]["movie_id"]
            title_word = first_list[0]["title"].split()[0]
            r = c.get("/movies/search", headers=auth(token), params={"q": title_word})
            check("search finds the film", r.status_code == 200 and any(x["movie_id"] == movie_id for x in r.json()["results"]), r.text[:200])
            r = c.get("/movies/search", headers=auth(token), params={"q": ""})
            check("search with empty q -> 422", r.status_code == 422 and is_detail(r), r.text)
            r = c.get(f"/verdict/{movie_id}", headers=auth(token))
            check("verdict for one film", r.status_code == 200 and r.json()["movie_id"] == movie_id, r.text[:200])
            check("verdict for unknown film -> 404", c.get("/verdict/999999", headers=auth(token)).status_code == 404)
            r = c.post("/watchlist", headers=auth(token), json={"movie_id": movie_id})
            check("add to watchlist -> 201", r.status_code == 201, r.text)
            r = c.post("/watchlist", headers=auth(token), json={"movie_id": movie_id})
            check("adding twice is fine", r.status_code == 201, r.text)
            r = c.get("/watchlist", headers=auth(token))
            items = r.json().get("items", [])
            check("watchlist shows the film once with in_watchlist=true", len(items) == 1 and items[0]["in_watchlist"] is True, r.text[:200])
            check("unknown film -> 404", c.post("/watchlist", headers=auth(token), json={"movie_id": 999999}).status_code == 404)

            # Two users with different watchlists should get different top-5 lists
            c.post("/auth/register", json={"username": "bob", "email": "bob@example.com", "password": "password123"})
            bob = c.post("/auth/login", json={"email": "bob@example.com", "password": "password123"}).json()["access_token"]
            c.post("/watchlist", headers=auth(bob), json={"movie_id": first_list[-1]["movie_id"]})
            a = [x["movie_id"] for x in c.post("/recommend", headers=auth(token), json={"minutes": 150}).json()["results"]]
            b = [x["movie_id"] for x in c.post("/recommend", headers=auth(bob), json={"minutes": 150}).json()["results"]]
            check("different watchlists -> different top-5 (FR-09)", a != b, f"alice={a} bob={b}")
            r = c.get("/watchlist", headers=auth(bob))
            check("users cannot see each other's watchlist", all(i["movie_id"] != movie_id for i in r.json()["items"]) or movie_id == first_list[-1]["movie_id"])

            r = c.delete(f"/watchlist/{movie_id}", headers=auth(token))
            check("remove from watchlist", r.status_code == 200, r.text)
            check("removing again -> 404", c.delete(f"/watchlist/{movie_id}", headers=auth(token)).status_code == 404)

        print("\nSentiment + metrics (FR-08, FR-12)")
        r = c.post("/sentiment", headers=auth(token), json={"text": "This movie was amazing, I loved every minute. Brilliant!"})
        check("positive review -> positive", r.status_code == 200 and r.json().get("label") == "positive", r.text)
        r = c.post("/sentiment", headers=auth(token), json={"text": "Boring, slow and a total waste of time. Terrible."})
        check("negative review -> negative", r.status_code == 200 and r.json().get("label") == "negative", r.text)
        r = c.post("/sentiment", headers=auth(token), json={"text": "ok"})
        check("too-short review -> 422", r.status_code == 422 and is_detail(r), r.text)
        r = c.get("/metrics")
        check("metrics is public and has verdict + sentiment", r.status_code == 200 and "verdict" in r.json() and "sentiment" in r.json(), r.text[:200])

        print("\nLogout + errors")
        check("logout -> 200", c.post("/auth/logout", headers=auth(token)).status_code == 200)
        r = c.get("/does-not-exist")
        check("unknown route -> 404 with detail", r.status_code == 404 and is_detail(r), r.text)

    tmp.cleanup()
    passed, total = sum(outcome), len(outcome)
    print(f"\nResult: {passed}/{total} checks passed.")
    print("ALL GOOD - backend matches the contract." if passed == total else "SOME CHECKS FAILED - read the FAIL lines above.")
    return 0 if passed == total else 1


# ---------------------------------------------------------------------
# 9. SETUP  ->  python api/main.py setup
# One-time chores: .gitignore, .env (random secret), .env.example,
# requirements.txt (real installed versions), README_API.md. Then selftest.
# Safe to run again and again (it never overwrites an existing .env).
# ---------------------------------------------------------------------
README_TEXT = r"""# BingeMatch Pro: Backend API (`api/`)

Owner: Jayeed Mohammad Kawsar. FastAPI + SQLite. The whole backend is one file: `api/main.py`.
The exact request/response formats are defined in `docs/API_CONTRACT.md`.

## 1. Setup (Windows PowerShell, from the project root)

```powershell
python -m venv venv
venv\Scripts\activate
python -m pip install -r api\requirements.txt
python api\main.py setup
```

`setup` creates the `.env` file (with a random SECRET_KEY) in the project root. It is never committed to Git.
See `api/.env.example` for all settings.

## 2. Run

```powershell
python -m uvicorn api.main:app --reload --port 8000
```

- Health check: http://localhost:8000/health (shows `"ml_mode": "real"` or `"stub"`)
- Interactive test page: http://localhost:8000/docs

## 3. Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `SECRET_KEY` | dev value (warns) | Signs login tokens. Set your own. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | 720 | Token lifetime (12 hours) |
| `ML_MODE` | `auto` | `auto`: real ML if it loads, else fake data. `real`: real only. `stub`: fake only. |
| `STRICT_ML_OUTPUT` | `true` | `true`: a film card that breaks the contract returns 503 and is logged. `false`: only logged. |
| `CORS_ORIGINS` | localhost:5173 | Allowed frontend addresses (add the deployed URL here). |
| `DATABASE_PATH` | `api/bingematch.db` | SQLite file location |

## 4. Endpoints

All errors look like `{"detail": "readable sentence"}`. Protected routes need the header
`Authorization: Bearer <token>`.

| Method and path | Login needed | What it does |
|---|---|---|
| `GET /health` | no | Server status and ML mode |
| `GET /metrics` | no | Model comparison, confusion matrix, Macro-F1 (from `metrics.json`) |
| `POST /auth/register` | no | Create account (password stored as a bcrypt hash) |
| `POST /auth/login` | no | Returns the access token |
| `POST /auth/logout` | yes | Confirms logout (frontend deletes the token) |
| `GET /auth/me` | yes | Current user |
| `GET /profile`, `PUT /profile` | yes | Favourite genres and usual minutes |
| `GET /movies/search?q=&limit=` | yes | Find films by title |
| `GET /watchlist`, `POST /watchlist`, `DELETE /watchlist/{movie_id}` | yes | Personal watchlist |
| `POST /recommend` | yes | Top 5 films that fit the minutes, personalised by profile and watchlist |
| `GET /verdict/{movie_id}` | yes | Verdict, Regret Score and badges for one film |
| `POST /sentiment` | yes | Review text to positive/negative with confidence |

## 5. How the backend works with the ML module

The backend only calls six functions of `ml/service.py` (`load_all`, `recommend`, `get_movie`,
`search_movies`, `predict_sentiment`, `get_metrics`). Models are loaded once at server start.
If `ml/service.py` is missing or fails to load in `auto` mode, a built-in fake (stub) is used so the
rest of the app keeps working. `/recommend` also drops any film longer than the minutes entered.

## 6. Testing

```powershell
python api\main.py selftest
$env:ML_MODE="real"; python api\main.py selftest
```

The selftest uses a temporary database and checks registration, login, wrong password, protected
routes, profile save and reload, recommendations for 90/120/150 minutes, invalid minutes
(empty, 0, text), the card format, watchlist add/remove, personalisation for two users, sentiment,
metrics, logout and the error format.

## 7. Requirements covered

FR-01 hashed passwords, FR-02 login/logout and protected routes, FR-03 profile, FR-04 top 5 within the
minutes, FR-05/06/07/10/11 card fields checked against the contract, FR-08 metrics, FR-09 watchlist
personalisation, FR-12 sentiment. Performance: models load once at startup and slow calls (over 3 s) are logged.
"""


def run_setup() -> int:
    print("\nBingeMatch Pro setup\n")

    # 1) .gitignore: add only the lines that are missing
    ignore_file = ROOT_DIR / ".gitignore"
    existing = ignore_file.read_text(encoding="utf-8").splitlines() if ignore_file.exists() else []
    missing = [line for line in ("venv/", "__pycache__/", "*.pyc", "*.db", ".env") if line not in existing]
    if missing:
        prefix = "\n" if existing and existing[-1] != "" else ""
        with open(ignore_file, "a", encoding="utf-8") as f:
            f.write(prefix + "\n".join(missing) + "\n")
        print(f"  [1/5] .gitignore updated (added: {', '.join(missing)})")
    else:
        print("  [1/5] .gitignore already complete")

    # 2) .env with a random secret (never overwritten)
    env_file = ROOT_DIR / ".env"
    if env_file.exists():
        print("  [2/5] .env already exists - left unchanged")
    else:
        env_file.write_text(
            f"SECRET_KEY={secrets.token_hex(32)}\n"
            "ACCESS_TOKEN_EXPIRE_MINUTES=720\n"
            "ML_MODE=auto\n"
            "CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173\n",
            encoding="utf-8",
        )
        print("  [2/5] .env created with a new random SECRET_KEY (ignored by Git)")

    # 3) .env.example
    (Path(__file__).resolve().parent / ".env.example").write_text(
        "# Copy this file to the project root as .env and fill in real values.\n"
        "# Never commit the real .env file.\n"
        "SECRET_KEY=put-a-long-random-string-here\n"
        "ACCESS_TOKEN_EXPIRE_MINUTES=720\n"
        "# ML_MODE: auto = real ML if it works, else fake (stub) | real = real only | stub = fake only\n"
        "ML_MODE=auto\n"
        "CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173\n",
        encoding="utf-8",
    )
    print("  [3/5] api/.env.example written")

    # 4) requirements.txt with the versions installed right now
    lines = []
    for package in ("fastapi", "uvicorn", "starlette", "pydantic", "bcrypt", "PyJWT", "httpx", "python-dotenv"):
        try:
            version = importlib_metadata.version(package)
        except importlib_metadata.PackageNotFoundError:
            continue
        name = "uvicorn[standard]" if package == "uvicorn" else package
        lines.append(f"{name}=={version}")
    (Path(__file__).resolve().parent / "requirements.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("  [4/5] api/requirements.txt written:")
    for line in lines:
        print(f"          {line}")

    # 5) README
    (Path(__file__).resolve().parent / "README_API.md").write_text(README_TEXT, encoding="utf-8")
    print("  [5/5] api/README_API.md written")

    print("\nNow running the selftest...")
    code = run_selftest()
    print("\nNext: save your work in Git:")
    print('    Set-Alias git "C:\\Program Files\\Git\\cmd\\git.exe"')
    print("    git add .")
    print("    git status        (venv and .env must NOT be in this list)")
    print('    git commit -m "Backend: complete API, tests and setup files"')
    return code


if __name__ == "__main__":
    command = sys.argv[1] if len(sys.argv) > 1 else ""
    if command == "selftest":
        sys.exit(run_selftest())
    if command == "setup":
        sys.exit(run_setup())
    print("To start the server, run this from the project ROOT folder:")
    print("    python -m uvicorn api.main:app --reload --port 8000")
    print("To do the one-time setup (.gitignore, .env, requirements, README) and run the checks:")
    print("    python api/main.py setup")
    print("To only run the checks:")
    print("    python api/main.py selftest")