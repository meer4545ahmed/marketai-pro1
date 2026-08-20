"""
Example usage of candlestick analyzer module.

This script demonstrates how to use the candlestick analyzer to:
1. Detect candle colors (bullish/bearish)
2. Extract OHLC from visual geometry
3. Map pixel positions to actual prices
4. Process multiple candlesticks
"""

import numpy as np
import cv2
from candlestick_analyzer import (
    CandlestickAnalyzer,
    PriceScaleMapper,
    CandleType
)


def create_sample_chart():
    """Create a synthetic chart image with 3 candlesticks"""
    # Create blank white canvas
    height, width = 400, 300
    chart = np.ones((height, width, 3), dtype=np.uint8) * 255
    
    # Define 3 candlesticks with different characteristics
    candles = [
        # (x_start, body_top, body_bottom, wick_top, wick_bottom, is_bullish)
        (50, 150, 200, 120, 230, True),   # Bullish (green)
        (130, 180, 220, 160, 250, False),  # Bearish (red)
        (210, 140, 170, 130, 190, True),   # Bullish (green)
    ]
    
    for x_start, body_top, body_bottom, wick_top, wick_bottom, is_bullish in candles:
        # Choose color based on type
        if is_bullish:
            color = (0, 200, 0)  # Green in BGR
        else:
            color = (0, 0, 200)  # Red in BGR
        
        # Draw upper wick (thin line)
        wick_center = x_start + 10
        cv2.line(chart, (wick_center, wick_top), (wick_center, body_top), (0, 0, 0), 2)
        
        # Draw body (filled rectangle)
        cv2.rectangle(chart, (x_start, body_top), (x_start + 20, body_bottom), color, -1)
        
        # Draw lower wick (thin line)
        cv2.line(chart, (wick_center, body_bottom), (wick_center, wick_bottom), (0, 0, 0), 2)
    
    # Add price labels on the right axis
    prices_and_positions = [
        ("$200", 100),
        ("$175", 175),
        ("$150", 250),
        ("$125", 325),
    ]
    
    for price_text, y_pos in prices_and_positions:
        cv2.putText(chart, price_text, (250, y_pos), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 0), 1)
    
    return chart


def extract_candlestick_regions(chart):
    """Extract individual candlestick regions from the chart"""
    # For this example, manually extract regions (in real use, this comes from preprocessing)
    regions = []
    x_positions = [50, 130, 210]
    
    for x in x_positions:
        # Extract a region around the candlestick
        region = chart[100:280, x:x+20]
        regions.append(region)
    
    return regions


def main():
    """Demonstrate candlestick analyzer usage"""
    print("=" * 60)
    print("Candlestick Analyzer Example")
    print("=" * 60)
    
    # Create sample chart
    print("\n1. Creating sample chart with 3 candlesticks...")
    chart = create_sample_chart()
    print(f"   Chart size: {chart.shape[1]}x{chart.shape[0]} pixels")
    
    # Extract candlestick regions
    print("\n2. Extracting candlestick regions...")
    regions = extract_candlestick_regions(chart)
    print(f"   Extracted {len(regions)} regions")
    
    # Initialize analyzer
    print("\n3. Initializing CandlestickAnalyzer...")
    analyzer = CandlestickAnalyzer(min_confidence=0.3)
    
    # Analyze each candlestick
    print("\n4. Analyzing candlesticks...")
    image_height = chart.shape[0]
    
    visual_ohlc_list = analyzer.analyze_all_candlesticks(regions, image_height)
    
    print(f"\n   Successfully analyzed {len(visual_ohlc_list)} candlesticks:")
    print("\n   " + "-" * 56)
    print(f"   {'#':<3} {'Type':<10} {'Open':<8} {'High':<8} {'Low':<8} {'Close':<8} {'Conf':<6}")
    print("   " + "-" * 56)
    
    for i, ohlc in enumerate(visual_ohlc_list, 1):
        candle_type = ohlc.candle_type.value
        print(f"   {i:<3} {candle_type:<10} {ohlc.open:<8.1f} {ohlc.high:<8.1f} "
              f"{ohlc.low:<8.1f} {ohlc.close:<8.1f} {ohlc.confidence:<6.2f}")
    print("   " + "-" * 56)
    
    # Create price scale from OCR labels
    print("\n5. Creating price scale from OCR labels...")
    price_labels = [
        (200.0, 100),   # $200 at pixel 100
        (175.0, 175),   # $175 at pixel 175
        (150.0, 250),   # $150 at pixel 250
        (125.0, 325),   # $125 at pixel 325
    ]
    
    mapper = PriceScaleMapper()
    scale = mapper.create_price_scale(price_labels, image_height)
    
    if scale:
        print(f"   Scale created: ${scale.min_price:.2f} - ${scale.max_price:.2f}")
        print(f"   Pixels per dollar: {scale.pixels_per_unit:.2f}")
    
    # Scale visual data to actual prices
    print("\n6. Scaling pixel positions to actual prices...")
    if scale:
        scaled_ohlc = mapper.scale_visual_to_prices(visual_ohlc_list, scale)
        
        print("\n   " + "-" * 56)
        print(f"   {'#':<3} {'Type':<10} {'Open':<8} {'High':<8} {'Low':<8} {'Close':<8} {'Conf':<6}")
        print("   " + "-" * 56)
        
        for i, ohlc in enumerate(scaled_ohlc, 1):
            candle_type = ohlc.candle_type.value
            print(f"   {i:<3} {candle_type:<10} ${ohlc.open:<7.2f} ${ohlc.high:<7.2f} "
                  f"${ohlc.low:<7.2f} ${ohlc.close:<7.2f} {ohlc.confidence:<6.2f}")
        print("   " + "-" * 56)
    
    # Verify OHLC relationships
    print("\n7. Verifying OHLC relationships...")
    all_valid = True
    for i, ohlc in enumerate(scaled_ohlc, 1):
        # Check high is highest
        if not (ohlc.high >= ohlc.open and ohlc.high >= ohlc.close):
            print(f"   ❌ Candle {i}: High is not the highest value")
            all_valid = False
        
        # Check low is lowest
        if not (ohlc.low <= ohlc.open and ohlc.low <= ohlc.close):
            print(f"   ❌ Candle {i}: Low is not the lowest value")
            all_valid = False
        
        # Check candle type consistency
        if ohlc.candle_type == CandleType.BULLISH:
            if ohlc.close <= ohlc.open:
                print(f"   ❌ Candle {i}: Marked bullish but close <= open")
                all_valid = False
        elif ohlc.candle_type == CandleType.BEARISH:
            if ohlc.open <= ohlc.close:
                print(f"   ❌ Candle {i}: Marked bearish but open <= close")
                all_valid = False
    
    if all_valid:
        print("   ✓ All OHLC relationships are valid!")
    
    # Summary
    print("\n" + "=" * 60)
    print("Summary:")
    print(f"  • Analyzed {len(visual_ohlc_list)} candlesticks")
    print(f"  • Average confidence: {np.mean([o.confidence for o in visual_ohlc_list]):.2f}")
    print(f"  • Bullish candles: {sum(1 for o in visual_ohlc_list if o.candle_type == CandleType.BULLISH)}")
    print(f"  • Bearish candles: {sum(1 for o in visual_ohlc_list if o.candle_type == CandleType.BEARISH)}")
    print(f"  • Price range: ${scale.min_price:.2f} - ${scale.max_price:.2f}")
    print("=" * 60)
    
    print("\n✅ Example completed successfully!")


if __name__ == "__main__":
    main()
