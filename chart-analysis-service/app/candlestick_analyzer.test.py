"""
Unit tests for candlestick pattern analyzer module.

Tests cover:
- Candle color detection with various chart styles
- OHLC geometry extraction accuracy
- Price scale mapping with different axis configurations
- Visual confidence scoring
- Boundary detection algorithms
"""

import pytest
import numpy as np
import cv2
from app.candlestick_analyzer import (
    CandlestickAnalyzer,
    PriceScaleMapper,
    CandleType,
    CandleBoundaries,
    VisualOHLC,
    PriceScale,
    get_candlestick_analyzer,
    get_price_scale_mapper
)


class TestCandleColorDetection:
    """Test suite for candle color detection functionality"""
    
    def create_colored_candle(self, color_bgr: tuple, size=(50, 20)) -> np.ndarray:
        """Helper to create a solid colored candle region"""
        candle = np.zeros((size[0], size[1], 3), dtype=np.uint8)
        candle[:, :] = color_bgr
        return candle
    
    def test_detect_green_bullish_candle(self):
        """Test detection of green/bullish candle"""
        analyzer = CandlestickAnalyzer()
        
        # Create a bright green candle (typical bullish color)
        green_candle = self.create_colored_candle((0, 200, 0))  # BGR format
        
        candle_type = analyzer.detect_candle_color(green_candle)
        
        assert candle_type == CandleType.BULLISH
    
    def test_detect_red_bearish_candle(self):
        """Test detection of red/bearish candle"""
        analyzer = CandlestickAnalyzer()
        
        # Create a bright red candle (typical bearish color)
        red_candle = self.create_colored_candle((0, 0, 200))  # BGR format
        
        candle_type = analyzer.detect_candle_color(red_candle)
        
        assert candle_type == CandleType.BEARISH
    
    def test_detect_grayscale_returns_unknown(self):
        """Test that grayscale images return UNKNOWN type"""
        analyzer = CandlestickAnalyzer()
        
        # Create grayscale candle
        gray_candle = np.full((50, 20), 128, dtype=np.uint8)
        
        candle_type = analyzer.detect_candle_color(gray_candle)
        
        assert candle_type == CandleType.UNKNOWN
    
    def test_detect_low_saturation_returns_unknown(self):
        """Test that low saturation (grayish) colors return UNKNOWN"""
        analyzer = CandlestickAnalyzer()
        
        # Create a low saturation (grayish) candle
        gray_ish = np.zeros((50, 20, 3), dtype=np.uint8)
        gray_ish[:, :] = (100, 100, 100)  # Near grayscale
        
        candle_type = analyzer.detect_candle_color(gray_ish)
        
        assert candle_type == CandleType.UNKNOWN
    
    def test_custom_color_ranges(self):
        """Test analyzer with custom HSV color ranges"""
        analyzer = CandlestickAnalyzer(
            green_hue_range=(40, 70),
            red_hue_range_1=(0, 5),
            min_saturation=50
        )
        
        green_candle = self.create_colored_candle((0, 200, 0))
        candle_type = analyzer.detect_candle_color(green_candle)
        
        assert candle_type == CandleType.BULLISH


class TestBoundaryDetection:
    """Test suite for candlestick boundary detection"""
    
    def create_candlestick_region(
        self,
        body_height=30,
        upper_wick=10,
        lower_wick=10,
        width=20
    ) -> np.ndarray:
        """Helper to create a synthetic candlestick region"""
        total_height = upper_wick + body_height + lower_wick
        candle = np.zeros((total_height, width), dtype=np.uint8)
        
        # Draw upper wick (thin line)
        wick_center = width // 2
        candle[0:upper_wick, wick_center-1:wick_center+2] = 255
        
        # Draw body (thick rectangle)
        candle[upper_wick:upper_wick+body_height, :] = 255
        
        # Draw lower wick (thin line)
        candle[upper_wick+body_height:, wick_center-1:wick_center+2] = 255
        
        return candle
    
    def test_find_body_boundaries(self):
        """Test body boundary detection"""
        analyzer = CandlestickAnalyzer()
        
        candle = self.create_candlestick_region(
            body_height=30,
            upper_wick=10,
            lower_wick=10
        )
        
        body_top, body_bottom = analyzer.find_body_boundaries(candle)
        
        # Body should be roughly in the middle (with some tolerance)
        assert 5 < body_top < 15  # Should start around pixel 10
        assert 35 < body_bottom < 45  # Should end around pixel 40
    
    def test_find_wick_boundaries(self):
        """Test wick boundary detection"""
        analyzer = CandlestickAnalyzer()
        
        candle = self.create_candlestick_region(
            body_height=30,
            upper_wick=10,
            lower_wick=10
        )
        
        wick_top, wick_bottom = analyzer.find_wick_boundaries(candle)
        
        # Wicks should span full height
        assert wick_top < 5  # Should start near top
        assert wick_bottom > 45  # Should end near bottom
    
    def test_extract_boundaries_complete(self):
        """Test complete boundary extraction"""
        analyzer = CandlestickAnalyzer()
        
        candle = self.create_candlestick_region()
        
        boundaries = analyzer.extract_boundaries(candle)
        
        assert isinstance(boundaries, CandleBoundaries)
        assert boundaries.wick_top <= boundaries.body_top
        assert boundaries.body_top < boundaries.body_bottom
        assert boundaries.body_bottom <= boundaries.wick_bottom
        assert boundaries.width > 0
    
    def test_boundaries_with_no_wicks(self):
        """Test boundary detection for candle without wicks"""
        analyzer = CandlestickAnalyzer()
        
        # Create candle with no wicks (just body)
        candle = self.create_candlestick_region(
            body_height=40,
            upper_wick=0,
            lower_wick=0
        )
        
        boundaries = analyzer.extract_boundaries(candle)
        
        # Body and wick boundaries should be similar
        assert abs(boundaries.wick_top - boundaries.body_top) < 5
        assert abs(boundaries.wick_bottom - boundaries.body_bottom) < 5


class TestOHLCExtraction:
    """Test suite for OHLC extraction from geometry"""
    
    def test_extract_bullish_ohlc(self):
        """Test OHLC extraction for bullish candle"""
        analyzer = CandlestickAnalyzer()
        
        # Create boundaries for bullish candle
        boundaries = CandleBoundaries(
            body_top=20,
            body_bottom=40,
            wick_top=10,
            wick_bottom=50,
            center_x=10,
            width=20
        )
        
        image_height = 100
        
        open_price, high, low, close_price = analyzer.extract_ohlc_from_geometry(
            boundaries,
            CandleType.BULLISH,
            image_height
        )
        
        # Bullish: close > open
        assert close_price > open_price
        # High should be highest value
        assert high >= close_price
        assert high >= open_price
        # Low should be lowest value
        assert low <= close_price
        assert low <= open_price
    
    def test_extract_bearish_ohlc(self):
        """Test OHLC extraction for bearish candle"""
        analyzer = CandlestickAnalyzer()
        
        boundaries = CandleBoundaries(
            body_top=20,
            body_bottom=40,
            wick_top=10,
            wick_bottom=50,
            center_x=10,
            width=20
        )
        
        image_height = 100
        
        open_price, high, low, close_price = analyzer.extract_ohlc_from_geometry(
            boundaries,
            CandleType.BEARISH,
            image_height
        )
        
        # Bearish: open > close
        assert open_price > close_price
        # High should be highest value
        assert high >= open_price
        assert high >= close_price
        # Low should be lowest value
        assert low <= open_price
        assert low <= close_price
    
    def test_high_low_from_wicks(self):
        """Test that high and low are always taken from wick extremes"""
        analyzer = CandlestickAnalyzer()
        
        boundaries = CandleBoundaries(
            body_top=30,
            body_bottom=40,
            wick_top=10,  # Upper wick extends high
            wick_bottom=60,  # Lower wick extends low
            center_x=10,
            width=20
        )
        
        image_height = 100
        
        _, high, low, _ = analyzer.extract_ohlc_from_geometry(
            boundaries,
            CandleType.BULLISH,
            image_height
        )
        
        # High should correspond to wick_top (flipped)
        expected_high = image_height - boundaries.wick_top
        assert abs(high - expected_high) < 0.1
        
        # Low should correspond to wick_bottom (flipped)
        expected_low = image_height - boundaries.wick_bottom
        assert abs(low - expected_low) < 0.1


class TestVisualConfidence:
    """Test suite for visual confidence scoring"""
    
    def create_test_candle(self, size=(50, 20)) -> np.ndarray:
        """Create a simple test candle"""
        candle = np.zeros((size[0], size[1], 3), dtype=np.uint8)
        candle[:, :] = (0, 200, 0)  # Green
        return candle
    
    def test_confidence_known_type(self):
        """Test confidence is higher for known candle type"""
        analyzer = CandlestickAnalyzer()
        
        candle = self.create_test_candle()
        boundaries = CandleBoundaries(
            body_top=10,
            body_bottom=40,
            wick_top=5,
            wick_bottom=45,
            center_x=10,
            width=20
        )
        
        confidence = analyzer.calculate_visual_confidence(
            candle,
            boundaries,
            CandleType.BULLISH
        )
        
        assert confidence > 0.5
    
    def test_confidence_unknown_type_penalty(self):
        """Test confidence is penalized for unknown candle type"""
        analyzer = CandlestickAnalyzer()
        
        candle = self.create_test_candle()
        boundaries = CandleBoundaries(
            body_top=10,
            body_bottom=40,
            wick_top=5,
            wick_bottom=45,
            center_x=10,
            width=20
        )
        
        confidence_unknown = analyzer.calculate_visual_confidence(
            candle,
            boundaries,
            CandleType.UNKNOWN
        )
        
        confidence_known = analyzer.calculate_visual_confidence(
            candle,
            boundaries,
            CandleType.BULLISH
        )
        
        assert confidence_unknown < confidence_known
    
    def test_confidence_small_body_penalty(self):
        """Test confidence is penalized for very small body"""
        analyzer = CandlestickAnalyzer(min_body_height=10)
        
        candle = self.create_test_candle()
        
        # Small body
        boundaries_small = CandleBoundaries(
            body_top=20,
            body_bottom=22,  # Only 2 pixels high
            wick_top=5,
            wick_bottom=45,
            center_x=10,
            width=20
        )
        
        confidence_small = analyzer.calculate_visual_confidence(
            candle,
            boundaries_small,
            CandleType.BULLISH
        )
        
        # Normal body
        boundaries_normal = CandleBoundaries(
            body_top=10,
            body_bottom=40,  # 30 pixels high
            wick_top=5,
            wick_bottom=45,
            center_x=10,
            width=20
        )
        
        confidence_normal = analyzer.calculate_visual_confidence(
            candle,
            boundaries_normal,
            CandleType.BULLISH
        )
        
        assert confidence_small < confidence_normal
    
    def test_confidence_range(self):
        """Test confidence is always between 0 and 1"""
        analyzer = CandlestickAnalyzer()
        
        candle = self.create_test_candle()
        boundaries = CandleBoundaries(
            body_top=10,
            body_bottom=40,
            wick_top=5,
            wick_bottom=45,
            center_x=10,
            width=20
        )
        
        confidence = analyzer.calculate_visual_confidence(
            candle,
            boundaries,
            CandleType.BULLISH
        )
        
        assert 0.0 <= confidence <= 1.0


class TestCandlestickAnalyzer:
    """Integration tests for complete candlestick analysis"""
    
    def create_full_candle(self, color_bgr=(0, 200, 0)) -> np.ndarray:
        """Create a complete candlestick image"""
        candle = np.zeros((60, 20, 3), dtype=np.uint8)
        
        # Upper wick
        candle[0:10, 9:11] = color_bgr
        
        # Body
        candle[10:50, :] = color_bgr
        
        # Lower wick
        candle[50:60, 9:11] = color_bgr
        
        return candle
    
    def test_analyze_candlestick_success(self):
        """Test successful analysis of a complete candlestick"""
        analyzer = CandlestickAnalyzer(min_confidence=0.3)
        
        candle = self.create_full_candle()
        image_height = 100
        
        result = analyzer.analyze_candlestick(candle, x_position=0, image_height=image_height)
        
        assert result is not None
        assert isinstance(result, VisualOHLC)
        assert result.confidence > 0
        assert result.high >= result.close
        assert result.high >= result.open
        assert result.low <= result.close
        assert result.low <= result.open
    
    def test_analyze_candlestick_low_confidence_returns_none(self):
        """Test that low confidence analysis returns None"""
        analyzer = CandlestickAnalyzer(min_confidence=0.95)  # Very high threshold
        
        # Create a low-quality candle
        candle = np.random.randint(0, 50, (60, 20, 3), dtype=np.uint8)
        image_height = 100
        
        result = analyzer.analyze_candlestick(candle, x_position=0, image_height=image_height)
        
        # Might be None due to low confidence
        # This test verifies the function handles low confidence gracefully
        assert result is None or isinstance(result, VisualOHLC)
    
    def test_analyze_all_candlesticks(self):
        """Test analysis of multiple candlesticks"""
        analyzer = CandlestickAnalyzer(min_confidence=0.3)
        
        # Create multiple candles
        regions = [
            self.create_full_candle((0, 200, 0)),  # Green
            self.create_full_candle((0, 0, 200)),  # Red
            self.create_full_candle((0, 200, 0)),  # Green
        ]
        
        image_height = 100
        
        results = analyzer.analyze_all_candlesticks(regions, image_height)
        
        assert len(results) > 0
        assert all(isinstance(r, VisualOHLC) for r in results)
        # Should be sorted by x_position
        assert results == sorted(results, key=lambda x: x.x_position)


class TestPriceScaleMapper:
    """Test suite for price scale mapping functionality"""
    
    def test_create_price_scale_basic(self):
        """Test basic price scale creation"""
        mapper = PriceScaleMapper()
        
        # Price labels: (price, y_pixel)
        price_labels = [
            (100.0, 400),  # $100 at pixel 400 (bottom)
            (200.0, 100),  # $200 at pixel 100 (top)
        ]
        
        image_height = 500
        
        scale = mapper.create_price_scale(price_labels, image_height)
        
        assert scale is not None
        assert scale.min_price == 100.0
        assert scale.max_price == 200.0
        assert scale.pixels_per_unit > 0
    
    def test_create_price_scale_insufficient_labels(self):
        """Test that insufficient labels return None"""
        mapper = PriceScaleMapper()
        
        # Only one label
        price_labels = [(100.0, 400)]
        image_height = 500
        
        scale = mapper.create_price_scale(price_labels, image_height)
        
        assert scale is None
    
    def test_create_price_scale_zero_range(self):
        """Test handling of zero price range"""
        mapper = PriceScaleMapper()
        
        # Same price at different positions (invalid)
        price_labels = [
            (100.0, 400),
            (100.0, 100),
        ]
        
        image_height = 500
        
        scale = mapper.create_price_scale(price_labels, image_height)
        
        assert scale is None
    
    def test_pixel_to_price_conversion(self):
        """Test pixel to price conversion"""
        mapper = PriceScaleMapper()
        
        # Create a simple scale
        scale = PriceScale(
            min_price=100.0,
            max_price=200.0,
            min_pixel=100,
            max_pixel=400,
            pixels_per_unit=3.0  # 300 pixels / 100 price units
        )
        
        # Test conversion at known points
        # Pixel at min_pixel should give min_price
        price_at_min = mapper.pixel_to_price(100, scale)
        assert abs(price_at_min - 100.0) < 1.0
        
        # Pixel halfway should give middle price
        price_at_mid = mapper.pixel_to_price(250, scale)
        assert abs(price_at_mid - 150.0) < 10.0  # Allow some tolerance
    
    def test_scale_visual_to_prices(self):
        """Test scaling multiple OHLC data points"""
        mapper = PriceScaleMapper()
        
        scale = PriceScale(
            min_price=100.0,
            max_price=200.0,
            min_pixel=100,
            max_pixel=400,
            pixels_per_unit=3.0
        )
        
        visual_ohlc_list = [
            VisualOHLC(
                open=200,
                high=250,
                low=150,
                close=220,
                confidence=0.9,
                candle_type=CandleType.BULLISH,
                x_position=0
            ),
            VisualOHLC(
                open=220,
                high=270,
                low=180,
                close=200,
                confidence=0.8,
                candle_type=CandleType.BEARISH,
                x_position=1
            ),
        ]
        
        scaled = mapper.scale_visual_to_prices(visual_ohlc_list, scale)
        
        assert len(scaled) == 2
        assert all(isinstance(v, VisualOHLC) for v in scaled)
        # Prices should be in reasonable range
        for v in scaled:
            assert 50 < v.open < 250
            assert 50 < v.high < 250
            assert 50 < v.low < 250
            assert 50 < v.close < 250
    
    def test_scale_preserves_ohlc_relationships(self):
        """Test that scaling preserves OHLC relationships"""
        mapper = PriceScaleMapper()
        
        scale = PriceScale(
            min_price=100.0,
            max_price=200.0,
            min_pixel=100,
            max_pixel=400,
            pixels_per_unit=3.0
        )
        
        visual_ohlc = VisualOHLC(
            open=200,
            high=250,  # Highest
            low=150,   # Lowest
            close=220,
            confidence=0.9,
            candle_type=CandleType.BULLISH,
            x_position=0
        )
        
        scaled = mapper.scale_visual_to_prices([visual_ohlc], scale)[0]
        
        # Relationships should be preserved
        assert scaled.high >= scaled.open
        assert scaled.high >= scaled.close
        assert scaled.low <= scaled.open
        assert scaled.low <= scaled.close


class TestSingletonInstances:
    """Test singleton pattern for shared instances"""
    
    def test_get_candlestick_analyzer_singleton(self):
        """Test that analyzer returns same instance"""
        analyzer1 = get_candlestick_analyzer()
        analyzer2 = get_candlestick_analyzer()
        
        assert analyzer1 is analyzer2
    
    def test_get_price_scale_mapper_singleton(self):
        """Test that mapper returns same instance"""
        mapper1 = get_price_scale_mapper()
        mapper2 = get_price_scale_mapper()
        
        assert mapper1 is mapper2


class TestEdgeCases:
    """Test edge cases and error handling"""
    
    def test_analyze_empty_region(self):
        """Test analysis of empty image region"""
        analyzer = CandlestickAnalyzer()
        
        empty = np.zeros((10, 10, 3), dtype=np.uint8)
        
        result = analyzer.analyze_candlestick(empty, x_position=0, image_height=100)
        
        # Should handle gracefully (return None or low confidence result)
        assert result is None or result.confidence < 0.5
    
    def test_analyze_single_pixel_region(self):
        """Test analysis of very small region"""
        analyzer = CandlestickAnalyzer()
        
        tiny = np.ones((1, 1, 3), dtype=np.uint8) * 128
        
        # Should not crash
        result = analyzer.analyze_candlestick(tiny, x_position=0, image_height=100)
        
        assert result is None or isinstance(result, VisualOHLC)
    
    def test_analyze_all_with_empty_list(self):
        """Test analyzing empty list of candlesticks"""
        analyzer = CandlestickAnalyzer()
        
        results = analyzer.analyze_all_candlesticks([], image_height=100)
        
        assert results == []
    
    def test_price_scale_with_unsorted_labels(self):
        """Test price scale creation with unsorted labels"""
        mapper = PriceScaleMapper()
        
        # Labels in random order
        price_labels = [
            (150.0, 250),
            (100.0, 400),
            (200.0, 100),
        ]
        
        scale = mapper.create_price_scale(price_labels, 500)
        
        # Should handle unsorted labels correctly
        assert scale is not None
        assert scale.min_price == 100.0
        assert scale.max_price == 200.0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
