# MarketPulse model drop zone

Place the trained model and its accompanying metadata in this directory. The
API intentionally starts in a safe sample mode until metadata is present.

## `metadata.json`

```json
{
  "modelName": "Random Forest",
  "version": "2026-08-14",
  "selectedModel": "Random Forest",
  "features": ["ema_9", "ema_21", "sma_50", "rsi", "macd", "bb_width", "atr", "momentum"],
  "metrics": {
    "Accuracy": 0.0,
    "Precision": 0.0,
    "Recall": 0.0,
    "F1 Score": 0.0,
    "ROC-AUC": 0.0
  },
  "comparison": [
    { "model": "Logistic Regression", "accuracy": null, "f1": null },
    { "model": "Random Forest", "accuracy": null, "f1": null },
    { "model": "XGBoost", "accuracy": null, "f1": null },
    { "model": "LSTM", "accuracy": null, "f1": null }
  ],
  "trainingPeriod": "YYYY-MM-DD to YYYY-MM-DD",
  "datasetInfo": "Describe the exported training and testing data here."
}
```

Replace the example values with metrics exported by the Colab training
pipeline. The runtime never invents performance metrics when this file is
missing. Add the serialized model and preprocessing artifacts beside it, then
connect the Python inference service to the same feature list and ordering.