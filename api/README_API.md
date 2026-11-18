# BingeMatch Pro: Backend API (`api/`)

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
