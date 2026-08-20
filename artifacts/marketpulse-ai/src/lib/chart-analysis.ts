import type { ChartAnalysisRequest } from '@workspace/api-client-react';

type ScanPoint = { bullish: number; bearish: number; y: number };
type ChartScale = { priceScaleTop?: number; priceScaleBottom?: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function isBullishPixel(r: number, g: number, b: number) {
  return g > r * 1.15 && g > b * 0.9 && g > 95;
}

function isBearishPixel(r: number, g: number, b: number) {
  return r > g * 1.2 && r > b * 1.05 && r > 105;
}

export async function scanChartImage(file: File, priceScale: ChartScale = {}, asset = 'XAUUSD'): Promise<ChartAnalysisRequest & { previewUrl: string }> {
  const previewUrl = URL.createObjectURL(file);
  const image = new Image();
  image.src = previewUrl;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('The image could not be decoded.'));
  });

  const imageScale = Math.min(1, 1400 / image.width);
  const width = Math.max(1, Math.round(image.width * imageScale));
  const height = Math.max(1, Math.round(image.height * imageScale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('The browser could not read image pixels.');
  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;

  const points: ScanPoint[] = [];
  const top = Math.floor(height * 0.1);
  const bottom = Math.floor(height * 0.9);
  for (let x = 0; x < width; x += Math.max(1, Math.floor(width / 700))) {
    let bullish = 0;
    let bearish = 0;
    let weightedY = 0;
    let weight = 0;
    for (let y = top; y < bottom; y += 2) {
      const offset = (y * width + x) * 4;
      const r = pixels[offset] ?? 0;
      const g = pixels[offset + 1] ?? 0;
      const b = pixels[offset + 2] ?? 0;
      const bull = isBullishPixel(r, g, b);
      const bear = isBearishPixel(r, g, b);
      if (bull || bear) {
        if (bull) bullish++;
        if (bear) bearish++;
        weightedY += y;
        weight++;
      }
    }
    if (bullish + bearish >= Math.max(2, Math.floor((bottom - top) / 90))) {
      points.push({ bullish, bearish, y: weightedY / Math.max(1, weight) });
    }
  }

  const bullishColumns = points.filter(point => point.bullish > point.bearish).length;
  const bearishColumns = points.filter(point => point.bearish > point.bullish).length;
  const totalDirectional = bullishColumns + bearishColumns;
  const bullishCandleRatio = totalDirectional ? bullishColumns / totalDirectional : 0;
  const bearishCandleRatio = totalDirectional ? bearishColumns / totalDirectional : 0;
  const split = Math.max(1, Math.floor(points.length / 3));
  const early = points.slice(0, split);
  const late = points.slice(-split);
  const average = (group: ScanPoint[]) => group.reduce((sum, point) => sum + point.y, 0) / Math.max(1, group.length);
  // Image coordinates grow downward, so a positive score means price moved up.
  const trajectoryScore = clamp((average(early) - average(late)) / Math.max(1, height * 0.42), -1, 1);
  const directionalScore = bullishCandleRatio - bearishCandleRatio;
  const combinedScore = clamp(trajectoryScore * 0.7 + directionalScore * 0.3, -1, 1);
  const visualBias = combinedScore > 0.08 ? 'BULLISH' : combinedScore < -0.08 ? 'BEARISH' : 'NEUTRAL';
  const visualConfidence = visualBias === 'NEUTRAL'
    ? 0.2
    : Number(clamp(0.35 + Math.abs(combinedScore) * 0.55 + Math.min(points.length / 500, 0.15), 0.2, 0.9).toFixed(4));
  const chartHeight = Math.max(1, bottom - top);
  const visibleHighPosition = points.length
    ? clamp((Math.min(...points.map(point => point.y)) - top) / chartHeight, 0, 1)
    : 0.25;
  const visibleLowPosition = points.length
    ? clamp((Math.max(...points.map(point => point.y)) - top) / chartHeight, 0, 1)
    : 0.75;
  const lastPricePosition = points.length
    ? clamp((points[points.length - 1]!.y - top) / chartHeight, 0, 1)
    : 0.5;
  const priceRangeConfidence = Number(clamp(
    Math.min(0.88, 0.28 + Math.min(points.length / 120, 0.35) + (totalDirectional > 0 ? 0.18 : 0)),
    0.12,
    0.88,
  ).toFixed(4));

  const signals = [
    points.length >= 12 ? `Detected ${points.length} active chart columns.` : 'Few colored candle columns were detected; crop to the chart area for a cleaner read.',
    Math.abs(trajectoryScore) > 0.08 ? `${trajectoryScore > 0 ? 'Higher' : 'Lower'}-price trajectory across the screenshot.` : 'No clear left-to-right price trajectory detected.',
    totalDirectional > 0 ? `${Math.round(bullishCandleRatio * 100)}% bullish vs ${Math.round(bearishCandleRatio * 100)}% bearish colored columns.` : 'No reliable bullish/bearish candle colors detected.',
    `Visible chart span covers roughly ${Math.round((visibleLowPosition - visibleHighPosition) * 100)}% of the plot height.`,
  ];

  return {
    asset,
    filename: file.name,
    imageWidth: width,
    imageHeight: height,
    bullishCandleRatio: Number(bullishCandleRatio.toFixed(4)),
    bearishCandleRatio: Number(bearishCandleRatio.toFixed(4)),
    trendScore: Number(combinedScore.toFixed(4)),
    sampledColumns: Math.max(1, points.length),
    visualConfidence,
    visualBias,
    visibleHighPosition: Number(visibleHighPosition.toFixed(4)),
    visibleLowPosition: Number(visibleLowPosition.toFixed(4)),
    lastPricePosition: Number(lastPricePosition.toFixed(4)),
    priceRangeConfidence,
    ...priceScale,
    signals,
    previewUrl,
  };
}