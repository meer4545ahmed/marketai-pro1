"""
Candlestick pattern analyzer for extracting OHLC data from chart images.

This module detects candlestick patterns using color and geometry analysis,
extracts OHLC values from visual positions, and maps pixel coordinates to
price scales using OCR-extracted labels.
"""

import cv2
import numpy as np
from typing import List, Tuple, Optional, Dict
from dataclasses import dataclass
from enum import Enum
from app.logging_config import get_logger

logger = get_logger(__name__)


class CandleType(Enum):
    """Candlestick color type"""
    BULLISH = "bullish"  # Green candle (close > open)
    BEARISH = "bearish"  # Red candle (open > close)
    UNKNOWN = "unknown"  # Unable to determine


@dataclass
class CandleBoundaries:
    """Geometric boundaries of a candlestick"""
    body_top: int      # Top of candle body (pixel y-coordinate)
    body_bottom: int   # Bottom of candle body (pixel y-coordinate)
    wick_top: int      # Top of upper wick (pixel y-coordinate)
    wick_bottom: int   # Bottom of lower wick (pixel y-coordinate)
    center_x: int      # Horizontal center of candle (pixel x-coordinate)
    width: int         # Width of candle body


@dataclass
class VisualOHLC:
    """OHLC values extracted from visual geometry"""
    open: float        # Opening price (pixel position or scaled price)
    high: float        # Highest price (pixel position or scaled price)
    low: float         # Lowest price (pixel position or scaled price)
    close: float       # Closing price (pixel position or scaled price)
    confidence: float  # Visual extraction confidence score (0.0-1.0)
    candle_type: CandleType  # Bullish or bearish
    x_position: int    # Horizontal position for ordering


@dataclass
class PriceScale:
    """Price scale mapping from pixel positions to actual prices"""
    min_price: float         # Minimum price value
    max_price: float         # Maximum price value
    min_pixel: int          # Pixel y-coordinate of minimum price
    max_pixel: int          # Pixel y-coordinate of maximum price
    pixels_per_unit: float  # Pixels per price unit


class CandlestickAnalyzer:
    """
    Analyzes candlestick patterns from chart images.
    
    Features:
    - HSV color space conversion for robust candle color detection
    - Identifies red (bearish) vs green (bullish) candles
    - Extracts body and wick boundaries using geometry analysis
    - Calculates OHLC from geometric positions
    - Maps pixel positions to actual prices using OCR labels
    """
    
    def __init__(
        self,
        # HSV color ranges for candle detection
        green_hue_range: Tuple[int, int] = (35, 85),     # Green hue in HSV (40-80 typical)
        red_hue_range_1: Tuple[int, int] = (0, 10),      # Red hue wraps around: 0-10
        red_hue_range_2: Tuple[int, int] = (170, 180),   # Red hue wraps around: 170-180
        min_saturation: int = 30,                         # Minimum saturation for color detection
        min_value: int = 30,                              # Minimum value/brightness
        # Confidence thresholds
        min_confidence: float = 0.5,                      # Minimum acceptable confidence
        # Geometric constraints
        min_body_height: int = 3,                         # Minimum candle body height in pixels
        max_wick_ratio: float = 5.0,                      # Max ratio of wick to body length
    ):
        """
        Initialize the candlestick analyzer with configurable parameters.
        
        Args:
            green_hue_range: HSV hue range for green/bullish candles
            red_hue_range_1: First HSV hue range for red/bearish candles (0-10)
            red_hue_range_2: Second HSV hue range for red/bearish candles (170-180)
            min_saturation: Minimum saturation threshold for color detection
            min_value: Minimum value/brightness threshold
            min_confidence: Minimum confidence score to accept extraction
            min_body_height: Minimum pixel height for valid candle body
            max_wick_ratio: Maximum allowed wick-to-body ratio
        """
        self.green_hue_range = green_hue_range
        self.red_hue_range_1 = red_hue_range_1
        self.red_hue_range_2 = red_hue_range_2
        self.min_saturation = min_saturation
        self.min_value = min_value
        self.min_confidence = min_confidence
        self.min_body_height = min_body_height
        self.max_wick_ratio = max_wick_ratio
        
        logger.info("CandlestickAnalyzer initialized")
    
    def detect_candle_color(self, candle_region: np.ndarray) -> CandleType:
        """
        Detect if a candlestick is bullish (green) or bearish (red).
        
        Uses HSV color space for robust color detection across different
        chart styles and lighting conditions.
        
        Args:
            candle_region: Image region containing the candlestick
            
        Returns:
            CandleType: BULLISH, BEARISH, or UNKNOWN
        """
        # Handle grayscale images
        if len(candle_region.shape) == 2:
            logger.debug("Grayscale candle region, cannot detect color")
            return CandleType.UNKNOWN
        
        # Convert to HSV color space
        hsv = cv2.cvtColor(candle_region, cv2.COLOR_BGR2HSV)
        
        # Extract HSV channels
        hue = hsv[:, :, 0]
        saturation = hsv[:, :, 1]
        value = hsv[:, :, 2]
        
        # Create masks for sufficient saturation and value
        color_mask = (saturation > self.min_saturation) & (value > self.min_value)
        
        if not np.any(color_mask):
            logger.debug("No sufficiently saturated pixels found")
            return CandleType.UNKNOWN
        
        # Extract hues of colored pixels
        colored_hues = hue[color_mask]
        
        # Count pixels in green range
        green_mask = (colored_hues >= self.green_hue_range[0]) & \
                     (colored_hues <= self.green_hue_range[1])
        green_count = np.sum(green_mask)
        
        # Count pixels in red range (wraps around at 0/180)
        red_mask = ((colored_hues >= self.red_hue_range_1[0]) & 
                    (colored_hues <= self.red_hue_range_1[1])) | \
                   ((colored_hues >= self.red_hue_range_2[0]) & 
                    (colored_hues <= self.red_hue_range_2[1]))
        red_count = np.sum(red_mask)
        
        # Determine candle type based on dominant color
        total_colored = len(colored_hues)
        green_ratio = green_count / total_colored if total_colored > 0 else 0
        red_ratio = red_count / total_colored if total_colored > 0 else 0
        
        logger.debug(f"Color detection: green_ratio={green_ratio:.2f}, red_ratio={red_ratio:.2f}")
        
        # Require at least 20% of pixels to be the dominant color
        if green_ratio > red_ratio and green_ratio > 0.2:
            return CandleType.BULLISH
        elif red_ratio > green_ratio and red_ratio > 0.2:
            return CandleType.BEARISH
        else:
            return CandleType.UNKNOWN
    
    def find_body_boundaries(self, candle_region: np.ndarray) -> Tuple[int, int]:
        """
        Find the top and bottom boundaries of the candle body.
        
        The body is typically the thicker part of the candlestick.
        Uses edge detection and contour analysis to identify body edges.
        
        Args:
            candle_region: Image region containing the candlestick
            
        Returns:
            Tuple[int, int]: (body_top, body_bottom) as pixel y-coordinates
        """
        height, width = candle_region.shape[:2]
        
        # Convert to grayscale if needed
        if len(candle_region.shape) == 3:
            gray = cv2.cvtColor(candle_region, cv2.COLOR_BGR2GRAY)
        else:
            gray = candle_region
        
        # Apply binary threshold to separate candle from background
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        # Find vertical projection (sum across rows)
        vertical_projection = np.sum(binary, axis=1)
        
        # Find the densest region (likely the body)
        # Apply smoothing to vertical projection
        kernel_size = max(3, height // 20)
        if kernel_size % 2 == 0:
            kernel_size += 1
        smoothed = cv2.GaussianBlur(
            vertical_projection.reshape(-1, 1).astype(np.float32),
            (1, kernel_size),
            0
        ).flatten()
        
        # Find peaks in the projection (body edges)
        threshold = np.max(smoothed) * 0.5
        body_rows = np.where(smoothed > threshold)[0]
        
        if len(body_rows) == 0:
            # Fallback: use middle 60% of region
            body_top = int(height * 0.2)
            body_bottom = int(height * 0.8)
            logger.debug("Body detection fallback: using middle 60% of region")
        else:
            body_top = body_rows[0]
            body_bottom = body_rows[-1]
        
        logger.debug(f"Body boundaries: top={body_top}, bottom={body_bottom}")
        return body_top, body_bottom
    
    def find_wick_boundaries(self, candle_region: np.ndarray) -> Tuple[int, int]:
        """
        Find the top and bottom boundaries of the wicks (shadows).
        
        Wicks are the thin lines extending above and below the body.
        
        Args:
            candle_region: Image region containing the candlestick
            
        Returns:
            Tuple[int, int]: (wick_top, wick_bottom) as pixel y-coordinates
        """
        height, width = candle_region.shape[:2]
        
        # Convert to grayscale if needed
        if len(candle_region.shape) == 3:
            gray = cv2.cvtColor(candle_region, cv2.COLOR_BGR2GRAY)
        else:
            gray = candle_region
        
        # Apply binary threshold
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        # Find center column (where wick is typically located)
        center_col = width // 2
        margin = max(1, width // 4)
        
        # Extract center region
        center_region = binary[:, max(0, center_col - margin):min(width, center_col + margin)]
        
        # Find any non-zero pixels in center column (wick pixels)
        wick_pixels = np.where(np.any(center_region > 0, axis=1))[0]
        
        if len(wick_pixels) == 0:
            # No wick detected, use full height
            wick_top = 0
            wick_bottom = height - 1
            logger.debug("No wick detected, using full height")
        else:
            wick_top = wick_pixels[0]
            wick_bottom = wick_pixels[-1]
        
        logger.debug(f"Wick boundaries: top={wick_top}, bottom={wick_bottom}")
        return wick_top, wick_bottom
    
    def extract_boundaries(self, candle_region: np.ndarray) -> CandleBoundaries:
        """
        Extract all geometric boundaries of a candlestick.
        
        Args:
            candle_region: Image region containing the candlestick
            
        Returns:
            CandleBoundaries: Complete boundary information
        """
        height, width = candle_region.shape[:2]
        
        # Find body and wick boundaries
        body_top, body_bottom = self.find_body_boundaries(candle_region)
        wick_top, wick_bottom = self.find_wick_boundaries(candle_region)
        
        # Ensure wick encompasses body
        wick_top = min(wick_top, body_top)
        wick_bottom = max(wick_bottom, body_bottom)
        
        return CandleBoundaries(
            body_top=body_top,
            body_bottom=body_bottom,
            wick_top=wick_top,
            wick_bottom=wick_bottom,
            center_x=width // 2,
            width=width
        )
    
    def calculate_visual_confidence(
        self,
        candle_region: np.ndarray,
        boundaries: CandleBoundaries,
        candle_type: CandleType
    ) -> float:
        """
        Calculate confidence score for visual pattern extraction.
        
        Factors:
        - Color detection clarity (known vs unknown type)
        - Body size (larger bodies are more reliable)
        - Wick-to-body ratio (extreme ratios are less reliable)
        - Image quality (contrast, noise)
        
        Args:
            candle_region: Image region containing the candlestick
            boundaries: Extracted boundaries
            candle_type: Detected candle type
            
        Returns:
            float: Confidence score between 0.0 and 1.0
        """
        confidence = 1.0
        
        # Penalty for unknown candle type
        if candle_type == CandleType.UNKNOWN:
            confidence *= 0.5
            logger.debug("Unknown candle type: confidence *= 0.5")
        
        # Check body height
        body_height = abs(boundaries.body_bottom - boundaries.body_top)
        if body_height < self.min_body_height:
            confidence *= 0.6
            logger.debug(f"Small body height ({body_height}px): confidence *= 0.6")
        
        # Check wick-to-body ratio
        upper_wick = abs(boundaries.body_top - boundaries.wick_top)
        lower_wick = abs(boundaries.wick_bottom - boundaries.body_bottom)
        max_wick = max(upper_wick, lower_wick)
        
        if body_height > 0:
            wick_ratio = max_wick / body_height
            if wick_ratio > self.max_wick_ratio:
                confidence *= 0.7
                logger.debug(f"High wick ratio ({wick_ratio:.2f}): confidence *= 0.7")
        
        # Check image quality (contrast)
        if len(candle_region.shape) == 3:
            gray = cv2.cvtColor(candle_region, cv2.COLOR_BGR2GRAY)
        else:
            gray = candle_region
        
        std_dev = np.std(gray)
        if std_dev < 20:  # Low contrast
            confidence *= 0.8
            logger.debug(f"Low contrast (std={std_dev:.2f}): confidence *= 0.8")
        
        confidence = max(0.0, min(1.0, confidence))
        logger.debug(f"Visual confidence: {confidence:.2f}")
        
        return confidence
    
    def extract_ohlc_from_geometry(
        self,
        boundaries: CandleBoundaries,
        candle_type: CandleType,
        image_height: int
    ) -> Tuple[float, float, float, float]:
        """
        Calculate OHLC values from geometric positions.
        
        Note: Returns pixel y-coordinates that need to be scaled to prices.
        In image coordinates, y=0 is at the top, so we flip for price interpretation.
        
        Args:
            boundaries: Extracted boundaries
            candle_type: Bullish or bearish
            image_height: Total image height for coordinate conversion
            
        Returns:
            Tuple[float, float, float, float]: (open, high, low, close) in pixel coordinates
        """
        # High and low are always at wick extremes
        high = image_height - boundaries.wick_top  # Flip y-coordinate
        low = image_height - boundaries.wick_bottom  # Flip y-coordinate
        
        # Open and close depend on candle type
        if candle_type == CandleType.BULLISH:
            # Green candle: close > open
            open_price = image_height - boundaries.body_bottom  # Bottom is open (lower price)
            close_price = image_height - boundaries.body_top     # Top is close (higher price)
        elif candle_type == CandleType.BEARISH:
            # Red candle: open > close
            open_price = image_height - boundaries.body_top      # Top is open (higher price)
            close_price = image_height - boundaries.body_bottom   # Bottom is close (lower price)
        else:
            # Unknown type: assume bullish (arbitrary choice)
            open_price = image_height - boundaries.body_bottom
            close_price = image_height - boundaries.body_top
        
        logger.debug(f"Extracted OHLC (pixels): O={open_price:.1f}, H={high:.1f}, L={low:.1f}, C={close_price:.1f}")
        
        return open_price, high, low, close_price
    
    def analyze_candlestick(
        self,
        candle_region: np.ndarray,
        x_position: int,
        image_height: int
    ) -> Optional[VisualOHLC]:
        """
        Analyze a single candlestick region and extract OHLC data.
        
        Args:
            candle_region: Image region containing the candlestick
            x_position: Horizontal position of candle for ordering
            image_height: Total image height for coordinate conversion
            
        Returns:
            VisualOHLC: Extracted OHLC data with confidence, or None if extraction fails
        """
        try:
            # Detect candle color
            candle_type = self.detect_candle_color(candle_region)
            
            # Extract boundaries
            boundaries = self.extract_boundaries(candle_region)
            
            # Calculate confidence
            confidence = self.calculate_visual_confidence(
                candle_region,
                boundaries,
                candle_type
            )
            
            # Skip if confidence too low
            if confidence < self.min_confidence:
                logger.debug(f"Confidence {confidence:.2f} below threshold {self.min_confidence}")
                return None
            
            # Extract OHLC from geometry
            open_price, high, low, close_price = self.extract_ohlc_from_geometry(
                boundaries,
                candle_type,
                image_height
            )
            
            return VisualOHLC(
                open=open_price,
                high=high,
                low=low,
                close=close_price,
                confidence=confidence,
                candle_type=candle_type,
                x_position=x_position
            )
            
        except Exception as e:
            logger.error(f"Error analyzing candlestick: {e}", exc_info=True)
            return None
    
    def analyze_all_candlesticks(
        self,
        candlestick_regions: List[np.ndarray],
        image_height: int
    ) -> List[VisualOHLC]:
        """
        Analyze all candlestick regions and extract OHLC data.
        
        Args:
            candlestick_regions: List of candlestick region images
            image_height: Total image height for coordinate conversion
            
        Returns:
            List[VisualOHLC]: List of extracted OHLC data, ordered by x-position
        """
        visual_ohlc_list = []
        
        for i, region in enumerate(candlestick_regions):
            visual_ohlc = self.analyze_candlestick(
                region,
                x_position=i,  # Use index as position for now
                image_height=image_height
            )
            
            if visual_ohlc is not None:
                visual_ohlc_list.append(visual_ohlc)
        
        # Sort by x-position (left to right, chronological order)
        visual_ohlc_list.sort(key=lambda x: x.x_position)
        
        logger.info(f"Analyzed {len(candlestick_regions)} regions, extracted {len(visual_ohlc_list)} valid OHLC data points")
        
        return visual_ohlc_list


class PriceScaleMapper:
    """
    Maps pixel positions to actual price values using OCR-extracted labels.
    
    Establishes a linear mapping between y-coordinates and prices based on
    price axis labels detected by OCR.
    """
    
    def __init__(self):
        """Initialize the price scale mapper."""
        logger.info("PriceScaleMapper initialized")
    
    def create_price_scale(
        self,
        price_labels: List[Tuple[float, int]],
        image_height: int
    ) -> Optional[PriceScale]:
        """
        Create price scale from OCR-extracted price labels.
        
        Args:
            price_labels: List of (price_value, y_pixel_position) tuples
            image_height: Total image height
            
        Returns:
            PriceScale: Price scale mapping, or None if insufficient labels
        """
        if len(price_labels) < 2:
            logger.warning(f"Insufficient price labels ({len(price_labels)}), need at least 2")
            return None
        
        # Sort by price value
        sorted_labels = sorted(price_labels, key=lambda x: x[0])
        
        # Use min and max prices for scale
        min_price, min_pixel = sorted_labels[0]
        max_price, max_pixel = sorted_labels[-1]
        
        # Calculate pixels per price unit
        # Note: In image coordinates, lower pixel values are at top (higher prices)
        # So we need to account for inverted y-axis
        pixel_range = abs(max_pixel - min_pixel)
        price_range = max_price - min_price
        
        if price_range == 0:
            logger.warning("Price range is zero, cannot create scale")
            return None
        
        pixels_per_unit = pixel_range / price_range
        
        scale = PriceScale(
            min_price=min_price,
            max_price=max_price,
            min_pixel=min_pixel,
            max_pixel=max_pixel,
            pixels_per_unit=pixels_per_unit
        )
        
        logger.info(f"Created price scale: ${min_price:.2f}-${max_price:.2f}, "
                   f"{pixels_per_unit:.2f} pixels/unit")
        
        return scale
    
    def pixel_to_price(self, pixel_y: float, scale: PriceScale) -> float:
        """
        Convert pixel y-coordinate to price value.
        
        Args:
            pixel_y: Y-coordinate in pixels (flipped, where higher values = higher prices)
            scale: Price scale mapping
            
        Returns:
            float: Price value
        """
        # The pixel_y we receive is already flipped (image_height - original_y)
        # Now we map it linearly to the price range
        
        # Determine if scale is inverted (lower pixel = higher price)
        if scale.min_pixel < scale.max_pixel:
            # Normal: min_pixel corresponds to min_price
            pixel_offset = pixel_y - scale.min_pixel
        else:
            # Inverted: max_pixel corresponds to min_price
            pixel_offset = pixel_y - scale.max_pixel
        
        price = scale.min_price + (pixel_offset / scale.pixels_per_unit)
        
        return price
    
    def scale_visual_to_prices(
        self,
        visual_ohlc_list: List[VisualOHLC],
        scale: PriceScale
    ) -> List[VisualOHLC]:
        """
        Scale visual OHLC data from pixel coordinates to actual prices.
        
        Args:
            visual_ohlc_list: List of OHLC data in pixel coordinates
            scale: Price scale mapping
            
        Returns:
            List[VisualOHLC]: List of OHLC data in actual price values
        """
        scaled_list = []
        
        for visual_ohlc in visual_ohlc_list:
            scaled = VisualOHLC(
                open=self.pixel_to_price(visual_ohlc.open, scale),
                high=self.pixel_to_price(visual_ohlc.high, scale),
                low=self.pixel_to_price(visual_ohlc.low, scale),
                close=self.pixel_to_price(visual_ohlc.close, scale),
                confidence=visual_ohlc.confidence,
                candle_type=visual_ohlc.candle_type,
                x_position=visual_ohlc.x_position
            )
            scaled_list.append(scaled)
            
            logger.debug(f"Scaled OHLC: O=${scaled.open:.2f}, H=${scaled.high:.2f}, "
                        f"L=${scaled.low:.2f}, C=${scaled.close:.2f}")
        
        logger.info(f"Scaled {len(scaled_list)} OHLC data points to price values")
        
        return scaled_list


# Singleton instances for reuse across requests
_candlestick_analyzer_instance = None
_price_scale_mapper_instance = None


def get_candlestick_analyzer() -> CandlestickAnalyzer:
    """
    Get or create singleton CandlestickAnalyzer instance.
    
    Returns:
        CandlestickAnalyzer: Shared analyzer instance
    """
    global _candlestick_analyzer_instance
    
    if _candlestick_analyzer_instance is None:
        _candlestick_analyzer_instance = CandlestickAnalyzer()
        logger.info("Created new CandlestickAnalyzer singleton instance")
    
    return _candlestick_analyzer_instance


def get_price_scale_mapper() -> PriceScaleMapper:
    """
    Get or create singleton PriceScaleMapper instance.
    
    Returns:
        PriceScaleMapper: Shared mapper instance
    """
    global _price_scale_mapper_instance
    
    if _price_scale_mapper_instance is None:
        _price_scale_mapper_instance = PriceScaleMapper()
        logger.info("Created new PriceScaleMapper singleton instance")
    
    return _price_scale_mapper_instance
