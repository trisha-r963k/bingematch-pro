# BingeMatch Pro - API contract (v1)
All responses are JSON. Protected routes need header: Authorization: Bearer <token>

AUTH
POST /auth/register  {username, email, password} -> 201 {message}
POST /auth/login     {username, password} -> {access_token, token_type}
GET  /profile        -> {username, genres[], usual_minutes, gender?, age?}
PUT  /profile        {genres[], usual_minutes, gender?, age?}   (gender and age are OPTIONAL)

WATCHLIST
GET    /watchlist            -> [movie_id, ...]
POST   /watchlist/{movie_id}
DELETE /watchlist/{movie_id}

RECOMMEND  (Jayeed: call ml.recsys.recommend_for_user)
GET /recommend?minutes=120
  minutes must be an integer 40-300 (we only cover feature films), otherwise 422 {detail}
  liked_links = user's watchlist ids, gender = profile gender (M/F or None),
  age_group = ml.recsys.age_to_bucket(age) or None
  -> [{id, title, year, runtime, genres[], critic, audience, verdict, match_score, reason}] (max 5)
  Every runtime is <= minutes.

VERDICT  (lookup in data/movies_scored.csv, columns p_arthouse_slog, p_crowd_pleaser,
          p_hidden_gem, p_overhyped, predicted_verdict, regret_score)
GET /verdict/{movie_id}
  -> {id, title, verdict, probabilities{...}, regret_score (0-100), critic_score,
      audience_score, gap, ending_satisfaction|null, pacing_score|null}
  ending_satisfaction and pacing_score are null until badges are ready: UI shows "N/A".

SENTIMENT
POST /sentiment {text} -> {label: positive|negative, confidence: 0-1}
  use models/sentiment_lr.joblib (predict_proba)

METRICS
GET /metrics -> contents of data/metrics.json

UI RULES
- Show only the first 1-2 lines of description or put it behind Read more (spoilers).
- Show verdict as text AND colour.
- Regret Score = 100*(0.7*(0.6*P(Overhyped)+0.4*P(Arthouse Slog)) + 0.3*(1-audience/100))

WHY THIS VERDICT: /verdict/{id} also returns why_features (list of 6 strings, split the 'why_features' column on '|'). Show them as the 'Why this verdict?' panel.

BADGES: ending_satisfaction and pacing_score are now filled (0-1, higher = better) for movies with 3+ relevant critic reviews, otherwise empty -> show N/A. Never show review text.

METRICS PAGE EXTRA: data/l1_l2_train_test.png (L1 vs L2 train/test graph) and data/l1_l2_results.json. Show the PNG as an image.
