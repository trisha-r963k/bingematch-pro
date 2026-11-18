# BingeMatch Pro - Anti-Regret Streaming and Movie Decision Hub

End-semester group project (SITM Guwahati, Group N). Tells you which movies fit the time you have
and how likely you are to regret them.

## What it does
- "I have X minutes" recommendations (X between 40 and 300), runtime always respected
- Verdict (Crowd Pleaser, Hidden Gem, Overhyped, Arthouse Slog) with probability
- Regret Score 0-100 = 100 * (0.7 * (0.6*P(Overhyped) + 0.4*P(Arthouse Slog)) + 0.3 * (1 - audience/100))
- Critic vs Audience gauge, Ending and Pacing badges (approximate, keyword based), "Why this verdict?"
- Recommender: SVD collaborative filtering + content similarity + optional age/gender cold start

## Results (honest numbers)
- Sentiment (IMDb 50K): LinearSVC 91.45% accuracy, Logistic Regression 90.36%
- Verdict model: Macro-F1 about 0.52 vs 0.17 majority baseline (critic/audience scores excluded to avoid leakage)
- Recommender (MovieLens 1M, Precision@10): popularity 0.1307, SVD 0.2406; cold start 0.4072 with age+gender vs 0.3877 without

## Datasets (not included in this repo, download yourself)
IMDb 50K reviews, Rotten Tomatoes movies and critic reviews, MovieLens 1M (GroupLens). Check each licence.

## Folders
ml/ (recommender), api/ (FastAPI), web/ (React), data/ (small sample files), docs/API_CONTRACT.md

## Run
pip install -r requirements.txt, then see docs/API_CONTRACT.md

## Limitations
Verdicts are model estimates, not facts. Only about 64 percent of MovieLens titles match Rotten Tomatoes.
Demographics are a small cold-start signal only.

## Team
Sanchita Dey (data, ML, integration), Homraj Sharma (frontend), Jayeed Mohammad Kawsar (backend).
