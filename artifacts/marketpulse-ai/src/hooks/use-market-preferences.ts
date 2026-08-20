import { useEffect, useState } from 'react';

export type MarketPreferences = {
  asset: string;
  timeframe: string;
};

const defaults: MarketPreferences = { asset: 'XAUUSD', timeframe: '1h' };
const storageKey = 'marketpulse-preferences';

export function useMarketPreferences() {
  const [preferences, setPreferences] = useState<MarketPreferences>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    } catch {
      return defaults;
    }
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(preferences));
  }, [preferences]);

  return {
    preferences,
    setPreferences,
    defaults,
  };
}