"""BingeMatch Pro recommender: SVD collaborative filtering + content similarity + age/gender cold start.

Usage:
    from ml.recsys import recommend_for_user, age_to_bucket
    recommend_for_user(minutes=120, liked_links=["m/toy_story"], gender="F", age_group=age_to_bucket(22))
"""
import os
import joblib
import numpy as np
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity

_DEFAULT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "models", "recsys.joblib")
_STATE = {}


def _load(path=None):
    path = path or _DEFAULT_PATH
    if _STATE.get("path") != path:
        art = joblib.load(path)
        movies = art["movies"].reset_index(drop=True)
        n = len(movies)
        row_to_item = np.full(n, -1, dtype=int)
        row_to_item[art["map_row"]] = art["map_item"]
        _STATE.update(path=path, art=art, movies=movies, n=n, row_to_item=row_to_item,
                      link_to_row={l: i for i, l in enumerate(movies["rotten_tomatoes_link"])})
    return _STATE


def age_to_bucket(age):
    """Convert a real age to the MovieLens age group (1, 18, 25, 35, 45, 50, 56)."""
    if age is None:
        return None
    age = int(age)
    for upper, bucket in [(18, 1), (25, 18), (35, 25), (45, 35), (50, 45), (56, 50)]:
        if age < upper:
            return bucket
    return 56


def _norm(v):
    v = np.asarray(v, dtype=float)
    return v / v.max() if v.size and v.max() > 0 else v


def recommend_for_user(minutes, liked_links=None, gender=None, age_group=None, k=5,
                       min_votes=500, path=None):
    """Return a DataFrame with the top-k movies that fit in `minutes`.

    liked_links : list of rotten_tomatoes_link values (watchlist / liked movies). Can be empty for a new user.
    gender      : "M" or "F" (optional).  age_group : value from age_to_bucket() (optional).
    """
    s = _load(path)
    art, movies, n = s["art"], s["movies"], s["n"]
    liked_rows = [s["link_to_row"][l] for l in (liked_links or []) if l in s["link_to_row"]]

    if liked_rows:
        # Content part: similarity to the average of the liked movies
        profile = np.asarray(art["content_matrix"][liked_rows].mean(axis=0))
        content = _norm(np.clip(cosine_similarity(profile, art["content_matrix"]).ravel(), 0, None))
        # Collaborative part: fold the liked movies into the SVD space
        liked_items = [s["row_to_item"][r] for r in liked_rows if s["row_to_item"][r] >= 0]
        cf = np.zeros(n)
        if liked_items:
            x = np.zeros(art["components"].shape[1], dtype="float32")
            x[liked_items] = 1.0
            item_scores = (x @ art["components"].T) @ art["components"]
            mapped = s["row_to_item"] >= 0
            cf[mapped] = np.clip(item_scores[s["row_to_item"][mapped]], 0, None)
            cf = _norm(cf)
            score, reason = 0.6 * cf + 0.4 * content, "Similar viewers + similar movies"
        else:
            score, reason = content, "Similar to movies you liked"
    else:
        # New user: popularity among viewers of the same gender and age group
        key = f"{gender}_{age_group}"
        counts = art["total_counts"]
        reason = "Popular overall"
        if key in art["group_counts"]:
            g = art["group_counts"][key]
            counts = 0.7 * g / g.max() + 0.3 * art["total_counts"] / art["total_counts"].max()
            reason = "Popular with viewers like you"
        score = np.zeros(n)
        mapped = s["row_to_item"] >= 0
        score[mapped] = counts[s["row_to_item"][mapped]]
        score = _norm(score)

    ok = ((movies["runtime"] <= minutes) & (movies["audience_count"] >= min_votes)).to_numpy().copy()
    ok[liked_rows] = False
    score = np.where(ok, score, -1.0)
    top = np.argsort(-score)[:k]
    top = [i for i in top if score[i] >= 0]
    out = movies.loc[top, ["rotten_tomatoes_link", "movie_title", "year", "runtime", "genres",
                           "critic", "audience", "verdict"]].copy()
    out["match_score"] = np.round(score[top], 3)
    out["reason"] = reason
    return out.reset_index(drop=True)
