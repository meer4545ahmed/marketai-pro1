"""
features.py  – Technical indicator feature engineering (no look-ahead bias).
All features are computed using only past/current bar information.
"""
import numpy as np
import pandas as pd


# ── helpers ───────────────────────────────────────────────────────────────────
def _ema(series, span):
    return series.ewm(span=span, adjust=False).mean()

def _sma(series, window):
    return series.rolling(window).mean()

def _rsi(series, period=14):
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1/period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1/period, min_periods=period, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs))

def _macd(series, fast=12, slow=26, signal=9):
    ema_fast = _ema(series, fast)
    ema_slow = _ema(series, slow)
    macd_line = ema_fast - ema_slow
    signal_line = _ema(macd_line, signal)
    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram

def _atr(high, low, close, period=14):
    hl = high - low
    hc = (high - close.shift(1)).abs()
    lc = (low  - close.shift(1)).abs()
    tr = pd.concat([hl, hc, lc], axis=1).max(axis=1)
    return tr.ewm(alpha=1/period, min_periods=period, adjust=False).mean()

def _bollinger(series, window=20, num_std=2):
    mid = _sma(series, window)
    std = series.rolling(window).std()
    upper = mid + num_std * std
    lower = mid - num_std * std
    return upper, mid, lower


# ── main feature builder ──────────────────────────────────────────────────────
def add_features(df: pd.DataFrame,
                 rsi_period: int = 14,
                 macd_fast: int = 12,
                 macd_slow: int = 26,
                 macd_signal: int = 9,
                 bb_window: int = 20,
                 bb_std: float = 2.0,
                 atr_period: int = 14) -> pd.DataFrame:
    """
    Add all technical features to df (must have Open, High, Low, Close, Volume).
    Returns a new dataframe; never modifies in-place to avoid side effects.
    """
    d = df.copy()
    c, o, h, l, v = d["Close"], d["Open"], d["High"], d["Low"], d["Volume"]

    # ── price-action ──────────────────────────────────────────────────────────
    d["returns"]       = c.pct_change()
    d["log_returns"]   = np.log(c / c.shift(1))
    d["body_size"]     = (c - o).abs() / o
    d["hl_range"]      = (h - l) / o
    d["upper_wick"]    = (h - c.clip(lower=o).combine(o, max)) / o
    d["lower_wick"]    = (c.clip(upper=o).combine(o, min) - l) / o
    d["body_direction"]= np.sign(c - o)          # +1 bull, -1 bear

    # ── momentum ─────────────────────────────────────────────────────────────
    for lag in [1, 2, 3, 5, 10]:
        d[f"ret_{lag}d"]  = c.pct_change(lag)
        d[f"close_lag{lag}"] = c.shift(lag)

    # ── volume ────────────────────────────────────────────────────────────────
    d["vol_sma20"]     = _sma(v, 20)
    d["vol_ratio"]     = v / d["vol_sma20"]

    # ── moving averages ───────────────────────────────────────────────────────
    d["ema9"]   = _ema(c, 9)
    d["ema21"]  = _ema(c, 21)
    d["sma20"]  = _sma(c, 20)
    d["sma50"]  = _sma(c, 50)
    d["sma100"] = _sma(c, 100)
    d["sma200"] = _sma(c, 200)

    # distances from MAs (normalised by close)
    for col in ["ema9", "ema21", "sma20", "sma50", "sma100"]:
        d[f"dist_{col}"] = (c - d[col]) / c

    # MA crosses (1 = fast above slow, -1 = below)
    d["ema9_vs_ema21"] = np.sign(d["ema9"] - d["ema21"])
    d["ema21_vs_sma50"]= np.sign(d["ema21"] - d["sma50"])
    d["price_vs_sma50"]= np.sign(c - d["sma50"])
    d["price_vs_sma200"]= np.sign(c - d["sma200"])

    # ── RSI ───────────────────────────────────────────────────────────────────
    d["rsi"]           = _rsi(c, rsi_period)
    d["rsi_prev"]      = d["rsi"].shift(1)
    d["rsi_delta"]     = d["rsi"] - d["rsi_prev"]

    # ── MACD ─────────────────────────────────────────────────────────────────
    d["macd"], d["macd_signal"], d["macd_hist"] = _macd(c, macd_fast, macd_slow, macd_signal)
    d["macd_cross"]    = np.sign(d["macd"] - d["macd_signal"])

    # ── Bollinger Bands ───────────────────────────────────────────────────────
    d["bb_upper"], d["bb_mid"], d["bb_lower"] = _bollinger(c, bb_window, bb_std)
    d["bb_width"]  = (d["bb_upper"] - d["bb_lower"]) / d["bb_mid"]
    d["bb_pct"]    = (c - d["bb_lower"]) / (d["bb_upper"] - d["bb_lower"] + 1e-9)

    # ── ATR & volatility ─────────────────────────────────────────────────────
    d["atr"]           = _atr(h, l, c, atr_period)
    d["atr_pct"]       = d["atr"] / c
    d["volatility_10"] = d["log_returns"].rolling(10).std()
    d["volatility_20"] = d["log_returns"].rolling(20).std()

    # ── calendar ──────────────────────────────────────────────────────────────
    d["day_of_week"]   = d["Date"].dt.dayofweek
    d["month"]         = d["Date"].dt.month
    d["quarter"]       = d["Date"].dt.quarter

    # ── target: next-candle direction (no leakage – shifted back) ─────────────
    d["target"] = (c.shift(-1) > c).astype(int)   # 1=BULLISH next bar, 0=BEARISH

    return d


FEATURE_COLS = [
    "returns","log_returns","body_size","hl_range","upper_wick","lower_wick",
    "body_direction","ret_1d","ret_2d","ret_3d","ret_5d","ret_10d",
    "vol_ratio",
    "dist_ema9","dist_ema21","dist_sma20","dist_sma50","dist_sma100",
    "ema9_vs_ema21","ema21_vs_sma50","price_vs_sma50","price_vs_sma200",
    "rsi","rsi_prev","rsi_delta",
    "macd","macd_signal","macd_hist","macd_cross",
    "bb_width","bb_pct",
    "atr_pct","volatility_10","volatility_20",
    "day_of_week","month","quarter",
]
