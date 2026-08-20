"""
build_dataset.py
Reads XAUUSD-D1.csv, validates columns, and saves a clean version.
The raw file must be placed at data/XAUUSD-D1.csv
Column format: <DTYYYYMMDD>,<TIME>,<OPEN>,<HIGH>,<LOW>,<CLOSE>,<VOL>
"""
import pandas as pd
import os, sys

RAW = os.path.join(os.path.dirname(__file__), "..", "data", "XAUUSD-D1.csv")
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "XAUUSD_clean.csv")

def load_raw(path):
    df = pd.read_csv(path)
    df.columns = [c.strip().strip("<>") for c in df.columns]
    rename = {
        "DTYYYYMMDD": "Date", "TIME": "Time",
        "OPEN": "Open", "HIGH": "High",
        "LOW": "Low",  "CLOSE": "Close", "VOL": "Volume"
    }
    df.rename(columns=rename, inplace=True)
    df["Date"] = pd.to_datetime(df["Date"].astype(str), format="%Y%m%d")
    df.drop(columns=["Time"], errors="ignore", inplace=True)
    df.sort_values("Date", inplace=True)
    df.drop_duplicates(subset="Date", inplace=True)
    df.reset_index(drop=True, inplace=True)
    return df

def inspect(df):
    print(f"Shape: {df.shape}")
    print(f"Date range: {df['Date'].min().date()} -> {df['Date'].max().date()}")
    print(f"Missing values:\n{df.isnull().sum()}")
    print(f"Duplicates: {df.duplicated().sum()}")
    print(df.head(3))

if __name__ == "__main__":
    df = load_raw(RAW)
    inspect(df)
    df.to_csv(OUT, index=False)
    print(f"\nClean data saved to {OUT}")
