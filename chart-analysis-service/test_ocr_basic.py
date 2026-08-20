"""
Basic test to verify OCR module imports and initializes correctly.
"""

import sys
import os

# Add app directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

def test_imports():
    """Test that all OCR module components can be imported"""
    print("Testing OCR module imports...")
    
    try:
        from app.ocr import (
            OCRResult,
            ExtractedPrice,
            ExtractedTimestamp,
            OCREngine,
            PriceExtractor,
            TimestampExtractor,
            TimeframeDetector,
            ChartOCRProcessor,
            get_ocr_processor
        )
        print("✓ All OCR classes imported successfully")
        
        # Test initialization
        print("\nTesting OCR component initialization...")
        
        price_extractor = PriceExtractor()
        print("✓ PriceExtractor initialized")
        
        timestamp_extractor = TimestampExtractor()
        print("✓ TimestampExtractor initialized")
        
        timeframe_detector = TimeframeDetector()
        print("✓ TimeframeDetector initialized")
        
        # Test singleton
        processor1 = get_ocr_processor()
        processor2 = get_ocr_processor()
        assert processor1 is processor2, "Singleton pattern failed"
        print("✓ Singleton OCR processor working")
        
        print("\n✅ All basic tests passed!")
        return True
        
    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def test_price_extraction():
    """Test price extraction patterns"""
    print("\nTesting price extraction patterns...")
    
    from app.ocr import PriceExtractor, OCRResult
    
    extractor = PriceExtractor()
    
    # Create mock OCR results
    test_cases = [
        ("1234.56", 1234.56),
        ("1,234.56", 1234.56),
        ("100", 100.0),
        ("0.0001", 0.0001),
    ]
    
    for text, expected in test_cases:
        ocr_result = OCRResult(text=text, confidence=0.9, bbox=(0, 0, 100, 20))
        prices = extractor.extract_prices([ocr_result])
        
        if prices and abs(prices[0].value - expected) < 0.0001:
            print(f"✓ '{text}' → {expected}")
        else:
            print(f"❌ '{text}' failed (expected {expected}, got {prices[0].value if prices else 'None'})")


def test_timeframe_patterns():
    """Test timeframe detection patterns"""
    print("\nTesting timeframe detection patterns...")
    
    from app.ocr import TimeframeDetector, OCRResult
    
    detector = TimeframeDetector()
    
    test_cases = [
        ("1H", "1H"),
        ("4H", "4H"),
        ("D1", "D1"),
        ("DAILY", "D1"),
        ("1M", "1M"),
        ("W1", "W1"),
    ]
    
    for text, expected in test_cases:
        ocr_result = OCRResult(text=text, confidence=0.9, bbox=(0, 0, 100, 20))
        timeframe = detector.detect_from_ocr([ocr_result])
        
        if timeframe == expected:
            print(f"✓ '{text}' → {expected}")
        else:
            print(f"❌ '{text}' failed (expected {expected}, got {timeframe})")


if __name__ == "__main__":
    print("=" * 60)
    print("OCR Module Basic Verification")
    print("=" * 60)
    
    success = test_imports()
    
    if success:
        test_price_extraction()
        test_timeframe_patterns()
        
        print("\n" + "=" * 60)
        print("✅ OCR Module verification completed successfully!")
        print("=" * 60)
    else:
        print("\n" + "=" * 60)
        print("❌ OCR Module verification failed")
        print("=" * 60)
        sys.exit(1)
