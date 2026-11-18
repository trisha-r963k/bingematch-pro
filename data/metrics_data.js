// BingeMatch Pro ML Metrics & Evaluation Data
window.BINGEMATCH_METRICS = {
  "sentiment": {
    "best": "LinearSVC",
    "results": {
      "LogisticRegression": {
        "accuracy": 0.9036,
        "macro_precision": 0.9039,
        "macro_recall": 0.9035,
        "macro_f1": 0.9036,
        "confusion_matrix": [
          [
            4396,
            544
          ],
          [
            412,
            4565
          ]
        ]
      },
      "LinearSVC": {
        "accuracy": 0.9145,
        "macro_precision": 0.9146,
        "macro_recall": 0.9145,
        "macro_f1": 0.9145,
        "confusion_matrix": [
          [
            4471,
            469
          ],
          [
            379,
            4598
          ]
        ]
      }
    },
    "labels": [
      "negative",
      "positive"
    ]
  },
  "verdict": {
    "labels": [
      "Arthouse Slog",
      "Crowd Pleaser",
      "Hidden Gem",
      "Overhyped"
    ],
    "results": {
      "Baseline (majority)": {
        "cv_macro_f1_mean": 0.1722,
        "cv_macro_f1_std": 0.0001,
        "test_accuracy": 0.5253,
        "test_macro_precision": 0.1313,
        "test_macro_recall": 0.25,
        "test_macro_f1": 0.1722,
        "confusion_matrix": [
          [
            0,
            274,
            0,
            0
          ],
          [
            0,
            841,
            0,
            0
          ],
          [
            0,
            246,
            0,
            0
          ],
          [
            0,
            240,
            0,
            0
          ]
        ]
      },
      "RandomForest": {
        "cv_macro_f1_mean": 0.5114,
        "cv_macro_f1_std": 0.0054,
        "test_accuracy": 0.6059,
        "test_macro_precision": 0.5226,
        "test_macro_recall": 0.5419,
        "test_macro_f1": 0.5198,
        "confusion_matrix": [
          [
            137,
            102,
            11,
            24
          ],
          [
            86,
            604,
            61,
            90
          ],
          [
            33,
            106,
            46,
            61
          ],
          [
            11,
            33,
            13,
            183
          ]
        ]
      },
      "SVC (rbf)": {
        "cv_macro_f1_mean": 0.5121,
        "cv_macro_f1_std": 0.0152,
        "test_accuracy": 0.5659,
        "test_macro_precision": 0.51,
        "test_macro_recall": 0.5569,
        "test_macro_f1": 0.524,
        "confusion_matrix": [
          [
            148,
            70,
            23,
            33
          ],
          [
            133,
            491,
            128,
            89
          ],
          [
            37,
            71,
            88,
            50
          ],
          [
            12,
            20,
            29,
            179
          ]
        ]
      }
    }
  },
  "recommender": {
    "warm_start": {
      "Popularity (baseline)": {
        "precision_at_10": 0.1307,
        "recall_at_10": 0.087
      },
      "Item-based CF": {
        "precision_at_10": 0.2038,
        "recall_at_10": 0.1423
      },
      "SVD (50 factors)": {
        "precision_at_10": 0.2406,
        "recall_at_10": 0.1741
      },
      "Hybrid (CF + SVD + popularity)": {
        "precision_at_10": 0.2269,
        "recall_at_10": 0.1574
      }
    },
    "cold_start": {
      "Global popularity (no demographics)": 0.3877,
      "Age + gender popularity": 0.4072
    },
    "k": 10,
    "note": "Leave-20%-out per user; liked = rating >= 4; MovieLens 1M"
  }
};
window.BINGEMATCH_L1_L2 = {
  "l1": [
    {
      "C": 0.01,
      "train_acc": 0.6235,
      "test_acc": 0.6272,
      "nonzero_weights": 3
    },
    {
      "C": 0.03,
      "train_acc": 0.7591,
      "test_acc": 0.759,
      "nonzero_weights": 34
    },
    {
      "C": 0.1,
      "train_acc": 0.8318,
      "test_acc": 0.8269,
      "nonzero_weights": 152
    },
    {
      "C": 0.3,
      "train_acc": 0.8712,
      "test_acc": 0.869,
      "nonzero_weights": 419
    },
    {
      "C": 1,
      "train_acc": 0.9062,
      "test_acc": 0.8912,
      "nonzero_weights": 1358
    },
    {
      "C": 3,
      "train_acc": 0.9458,
      "test_acc": 0.8939,
      "nonzero_weights": 4230
    },
    {
      "C": 10,
      "train_acc": 0.9929,
      "test_acc": 0.8841,
      "nonzero_weights": 7882
    },
    {
      "C": 30,
      "train_acc": 1.0,
      "test_acc": 0.8758,
      "nonzero_weights": 9188
    }
  ],
  "l2": [
    {
      "C": 0.01,
      "train_acc": 0.8134,
      "test_acc": 0.8123,
      "nonzero_weights": 30000
    },
    {
      "C": 0.03,
      "train_acc": 0.8449,
      "test_acc": 0.836,
      "nonzero_weights": 30000
    },
    {
      "C": 0.1,
      "train_acc": 0.8788,
      "test_acc": 0.8632,
      "nonzero_weights": 30000
    },
    {
      "C": 0.3,
      "train_acc": 0.9039,
      "test_acc": 0.883,
      "nonzero_weights": 30000
    },
    {
      "C": 1,
      "train_acc": 0.9296,
      "test_acc": 0.8971,
      "nonzero_weights": 30000
    },
    {
      "C": 3,
      "train_acc": 0.9524,
      "test_acc": 0.9009,
      "nonzero_weights": 30000
    },
    {
      "C": 10,
      "train_acc": 0.9778,
      "test_acc": 0.8996,
      "nonzero_weights": 30000
    },
    {
      "C": 30,
      "train_acc": 0.9934,
      "test_acc": 0.8941,
      "nonzero_weights": 30000
    }
  ]
};
