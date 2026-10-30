"""Sanity checks for the signal window and portfolio math using synthetic prices (no network).

Usage: python scripts/test_backtest_momentum.py
"""
from __future__ import annotations

import sys

import numpy as np
import pandas as pd

sys.path.insert(0, __file__.rsplit("scripts", 1)[0] + "scripts")
from backtest_momentum import backtest, momentum_signal  # noqa: E402

idx = pd.date_range("2000-01-31", periods=40, freq="ME")


def test_signal_window() -> None:
    # One price jump per month index k: signal must see it only if k is inside the window.
    for lookback, months_seen in {"12-1": range(-11, 0), "12-7": range(-11, -5)}.items():
        for k in range(-14, 2):
            p = pd.Series(1.0, index=idx)
            t = 20
            p.iloc[t + k:] = 2.0  # return realised during month t+k
            sig = momentum_signal(p.to_frame("X"), lookback)["X"].iloc[t]
            assert (sig > 0) == (k in months_seen), (lookback, k, sig)


def test_long_short_and_costs() -> None:
    # 25 stocks with constant, distinct monthly growth: past winners keep winning.
    g = np.linspace(-0.02, 0.02, 25)
    prices = pd.DataFrame(np.cumprod(np.tile(1 + g, (len(idx), 1)), axis=0), index=idx,
                          columns=[f"S{i}" for i in range(25)])
    window = (pd.Period("2001-02", "M"), pd.Period("2003-03", "M"))
    gross = backtest(prices, "12-1", window, costs_bps=0)
    net = backtest(prices, "12-1", window, costs_bps=30)
    expected = g[-5:].mean() - g[:5].mean()
    assert abs(gross["mean_gross"] - expected) < 1e-12
    assert gross["turnover"] == 0.0  # same names every month after the first
    # only the first month trades (sum|dw| = 2), so total cost = 2 * 30bps spread over n months
    assert abs((gross["mean_net"] - net["mean_net"]) - 2 * 0.003 / net["n_months"]) < 1e-12
    assert net["max_dd"] <= 0


if __name__ == "__main__":
    test_signal_window()
    test_long_short_and_costs()
    print("PASS: backtest_momentum sanity checks")
