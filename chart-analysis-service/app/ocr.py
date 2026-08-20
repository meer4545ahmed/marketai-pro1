"""
OCR extraction module for chart analysis.

This module implements text extraction from chart images using EasyOCR (primary)
and Tesseract (fallback). It extracts OHLC values, timestamps, and timeframe
information from financial charts.
"""

import re
import easyocr
import pytesseract
import numpy as np
from typing import List, Tuple, Optional, Dict, Any
from dataclasses import dataclass
from datetime import datetime, timedelta
from app.logging_config import get_logger
from app.preprocessing import PreprocessedImage

logger = get_logger(__name__)


@dataclass
class OCRResult:
    """Container for OCR extraction result with confidence score"""
    text: str
    confidence: float
    bbox: Tuple[int, int, int, int]  # (x, y, width, height)


@dataclass
class ExtractedPrice:
    """Container for extracted price value with metadata"""
    value: float
    confidence: float
    position: Tuple[int, int]  # (x, y) pixel coordinates


@dataclass
class ExtractedTimestamp:
    """Container for extracted timestamp with metadata"""
    timestamp: datetime
    confidence: float
    position: Tuple[int, int]  # (x, y) pixel coordinates


class OCREngine:
    """
    OCR engine with EasyOCR (primary) and Tesseract (fallback) support.
    
    Provides robust text extraction with confidence scoring and fallback
    mechanisms for various chart image qualities.
    """
    
    def __init__(
        self,
        easyocr_languages: List[str] = ['en'],
        easyocr_gpu: bool = False,
        min_confidence_threshold: float = 0.7,
        low_confidence_threshold: float = 0.7
    ):
        """
        Initialize OCR engine with configurable parameters.
        
        Args:
            easyocr_languages: Languages for EasyOCR (default: ['en'])
            easyocr_gpu: Enable GPU acceleration for EasyOCR (default: False)
            min_confidence_threshold: Minimum confidence to accept results (default: 0.7)
            low_confidence_threshold: Threshold for low-confidence flagging (default: 0.7)
        """
        self.min_confidence_threshold = min_confidence_threshold
        self.low_confidence_threshold = low_confidence_threshold
        
        # Initialize EasyOCR reader (lazy loading)
        self._easyocr_reader = None
        self.easyocr_languages = easyocr_languages
        self.easyocr_gpu = easyocr_gpu
        
        logger.info("OCREngine initialized with min_confidence=%.2f", min_confidence_threshold)
    
    @property
    def easyocr_reader(self):
        """Lazy load EasyOCR reader to avoid initialization overhead"""
        if self._easyocr_reader is None:
            logger.info("Initializing EasyOCR reader (languages=%s, gpu=%s)",
                       self.easyocr_languages, self.easyocr_gpu)
            self._easyocr_reader = easyocr.Reader(
                self.easyocr_languages,
                gpu=self.easyocr_gpu
            )
        return self._easyocr_reader
    
    def extract_with_easyocr(self, image: np.ndarray) -> List[OCRResult]:
        """
        Extract text using EasyOCR.
        
        Args:
            image: Input image array (grayscale or BGR)
            
        Returns:
            List[OCRResult]: List of extracted text with confidence scores
            
        Raises:
            RuntimeError: If EasyOCR extraction fails
        """
        try:
            logger.debug("Starting EasyOCR text extraction")
            
            # EasyOCR returns: [([bbox], text, confidence), ...]
            results = self.easyocr_reader.readtext(image)
            
            ocr_results = []
            for detection in results:
                bbox_points, text, confidence = detection
                
                # Convert bbox points to x, y, w, h format
                bbox_array = np.array(bbox_points)
                x_min, y_min = bbox_array.min(axis=0).astype(int)
                x_max, y_max = bbox_array.max(axis=0).astype(int)
                bbox = (x_min, y_min, x_max - x_min, y_max - y_min)
                
                ocr_results.append(OCRResult(
                    text=text.strip(),
                    confidence=confidence,
                    bbox=bbox
                ))
            
            logger.info("EasyOCR extracted %d text elements (avg confidence: %.2f)",
                       len(ocr_results),
                       np.mean([r.confidence for r in ocr_results]) if ocr_results else 0)
            
            return ocr_results
            
        except Exception as e:
            logger.error("EasyOCR extraction failed: %s", str(e))
            raise RuntimeError(f"EasyOCR extraction failed: {str(e)}")
    
    def extract_with_tesseract(self, image: np.ndarray) -> List[OCRResult]:
        """
        Extract text using Tesseract OCR as fallback.
        
        Args:
            image: Input image array (grayscale or BGR)
            
        Returns:
            List[OCRResult]: List of extracted text with confidence scores
            
        Raises:
            RuntimeError: If Tesseract extraction fails
        """
        try:
            logger.debug("Starting Tesseract OCR text extraction")
            
            # Get detailed OCR data: (level, page_num, block_num, par_num, line_num,
            #                          word_num, left, top, width, height, conf, text)
            data = pytesseract.image_to_data(
                image,
                output_type=pytesseract.Output.DICT,
                config='--psm 11'  # Sparse text mode for charts
            )
            
            ocr_results = []
            n_boxes = len(data['text'])
            
            for i in range(n_boxes):
                text = data['text'][i].strip()
                conf = float(data['conf'][i])
                
                # Skip empty text or low confidence (-1 indicates no text detected)
                if not text or conf < 0:
                    continue
                
                # Convert confidence from 0-100 to 0-1 scale
                confidence = conf / 100.0
                
                bbox = (
                    data['left'][i],
                    data['top'][i],
                    data['width'][i],
                    data['height'][i]
                )
                
                ocr_results.append(OCRResult(
                    text=text,
                    confidence=confidence,
                    bbox=bbox
                ))
            
            logger.info("Tesseract extracted %d text elements (avg confidence: %.2f)",
                       len(ocr_results),
                       np.mean([r.confidence for r in ocr_results]) if ocr_results else 0)
            
            return ocr_results
            
        except Exception as e:
            logger.error("Tesseract extraction failed: %s", str(e))
            raise RuntimeError(f"Tesseract extraction failed: {str(e)}")
    
    def extract_text(self, preprocessed: PreprocessedImage) -> List[OCRResult]:
        """
        Extract text with fallback chain: EasyOCR → Tesseract.
        
        Args:
            preprocessed: PreprocessedImage object with enhanced image
            
        Returns:
            List[OCRResult]: List of extracted text elements
            
        Raises:
            RuntimeError: If all OCR engines fail
        """
        logger.info("Starting OCR extraction with fallback chain")
        
        # Use enhanced image for best OCR results
        image = preprocessed.enhanced
        
        # Try primary OCR engine (EasyOCR)
        try:
            results = self.extract_with_easyocr(image)
            if results:
                logger.info("EasyOCR extraction successful")
                return results
            else:
                logger.warning("EasyOCR returned no results, trying fallback")
        except RuntimeError as e:
            logger.warning("EasyOCR failed: %s, trying fallback", str(e))
        
        # Try fallback OCR engine (Tesseract)
        try:
            results = self.extract_with_tesseract(image)
            if results:
                logger.info("Tesseract fallback extraction successful")
                return results
            else:
                logger.error("Tesseract returned no results")
        except RuntimeError as e:
            logger.error("Tesseract fallback failed: %s", str(e))
        
        # Both engines failed
        logger.error("All OCR engines failed to extract text")
        raise RuntimeError("OCR extraction failed: both EasyOCR and Tesseract failed")


class PriceExtractor:
    """Extracts OHLC price values from OCR results"""
    
    # Regex patterns for price detection
    PRICE_PATTERNS = [
        r'\b\d+\.?\d*\b',           # Basic decimal: 1234.56 or 1234
        r'\b\d{1,3}(?:,\d{3})*\.?\d*\b',  # With commas: 1,234.56
    ]
    
    def __init__(self, min_confidence: float = 0.7):
        """
        Initialize price extractor.
        
        Args:
            min_confidence: Minimum confidence threshold for extracted prices
        """
        self.min_confidence = min_confidence
        logger.info("PriceExtractor initialized")
    
    def extract_prices(self, ocr_results: List[OCRResult]) -> List[ExtractedPrice]:
        """
        Extract numerical price values from OCR results.
        
        Args:
            ocr_results: List of OCR text extraction results
            
        Returns:
            List[ExtractedPrice]: Extracted price values with confidence scores
        """
        extracted_prices = []
        
        for result in ocr_results:
            # Try each price pattern
            for pattern in self.PRICE_PATTERNS:
                matches = re.findall(pattern, result.text)
                
                for match in matches:
                    try:
                        # Remove commas and convert to float
                        value = float(match.replace(',', ''))
                        
                        # Skip unrealistic values (too small or too large)
                        if value < 0.0001 or value > 1e9:
                            continue
                        
                        # Calculate center position of bbox
                        x = result.bbox[0] + result.bbox[2] // 2
                        y = result.bbox[1] + result.bbox[3] // 2
                        
                        extracted_prices.append(ExtractedPrice(
                            value=value,
                            confidence=result.confidence,
                            position=(x, y)
                        ))
                        
                    except ValueError:
                        continue
        
        # Sort by y-position (top to bottom) for price axis labels
        extracted_prices.sort(key=lambda p: p.position[1])
        
        logger.info("Extracted %d price values", len(extracted_prices))
        return extracted_prices


class TimestampExtractor:
    """Extracts timestamps and dates from OCR results"""
    
    # Common date/time formats found in charts
    DATETIME_PATTERNS = [
        # ISO-like formats
        (r'\b(\d{4})-(\d{1,2})-(\d{1,2})\b', '%Y-%m-%d'),
        (r'\b(\d{4})/(\d{1,2})/(\d{1,2})\b', '%Y/%m/%d'),
        
        # US format
        (r'\b(\d{1,2})/(\d{1,2})/(\d{4})\b', '%m/%d/%Y'),
        (r'\b(\d{1,2})-(\d{1,2})-(\d{4})\b', '%m-%d-%Y'),
        
        # European format
        (r'\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b', '%d.%m.%Y'),
        
        # Month name formats
        (r'\b([A-Za-z]{3})\s+(\d{1,2}),?\s+(\d{4})\b', '%b %d %Y'),
        (r'\b(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\b', '%d %b %Y'),
        
        # Time formats
        (r'\b(\d{1,2}):(\d{2})\s*(AM|PM)?\b', '%H:%M'),
    ]
    
    def __init__(self, min_confidence: float = 0.7):
        """
        Initialize timestamp extractor.
        
        Args:
            min_confidence: Minimum confidence threshold for extracted timestamps
        """
        self.min_confidence = min_confidence
        logger.info("TimestampExtractor initialized")
    
    def extract_timestamps(self, ocr_results: List[OCRResult]) -> List[ExtractedTimestamp]:
        """
        Extract timestamp/date values from OCR results.
        
        Args:
            ocr_results: List of OCR text extraction results
            
        Returns:
            List[ExtractedTimestamp]: Extracted timestamps with confidence scores
        """
        extracted_timestamps = []
        
        for result in ocr_results:
            # Try each datetime pattern
            for pattern, fmt in self.DATETIME_PATTERNS:
                matches = re.finditer(pattern, result.text, re.IGNORECASE)
                
                for match in matches:
                    try:
                        # Parse timestamp
                        timestamp = datetime.strptime(match.group(0), fmt)
                        
                        # Calculate center position of bbox
                        x = result.bbox[0] + result.bbox[2] // 2
                        y = result.bbox[1] + result.bbox[3] // 2
                        
                        extracted_timestamps.append(ExtractedTimestamp(
                            timestamp=timestamp,
                            confidence=result.confidence,
                            position=(x, y)
                        ))
                        
                    except ValueError:
                        continue
        
        # Sort by x-position (left to right) for time axis labels
        extracted_timestamps.sort(key=lambda t: t.position[0])
        
        logger.info("Extracted %d timestamps", len(extracted_timestamps))
        return extracted_timestamps


class TimeframeDetector:
    """Detects chart timeframe from OCR results and timestamp intervals"""
    
    # Timeframe pattern mappings
    TIMEFRAME_PATTERNS = {
        # Minute patterns
        r'\b1\s*M\b': '1M',
        r'\b5\s*M\b': '5M',
        r'\b15\s*M\b': '15M',
        r'\b30\s*M\b': '30M',
        
        # Hour patterns
        r'\b1\s*H\b': '1H',
        r'\b4\s*H\b': '4H',
        r'\b8\s*H\b': '8H',
        r'\b12\s*H\b': '12H',
        
        # Day patterns
        r'\b(?:D1|1D|DAILY)\b': 'D1',
        
        # Week patterns
        r'\b(?:W1|1W|WEEKLY)\b': 'W1',
        
        # Month patterns
        r'\b(?:M1|MN|MONTHLY)\b': 'MN',
    }
    
    # Interval to timeframe mapping (in seconds)
    INTERVAL_TIMEFRAME_MAP = [
        (60, '1M'),           # 1 minute
        (300, '5M'),          # 5 minutes
        (900, '15M'),         # 15 minutes
        (1800, '30M'),        # 30 minutes
        (3600, '1H'),         # 1 hour
        (14400, '4H'),        # 4 hours
        (28800, '8H'),        # 8 hours
        (43200, '12H'),       # 12 hours
        (86400, 'D1'),        # 1 day
        (604800, 'W1'),       # 1 week
        (2592000, 'MN'),      # ~1 month (30 days)
    ]
    
    def __init__(self):
        """Initialize timeframe detector"""
        logger.info("TimeframeDetector initialized")
    
    def detect_from_ocr(self, ocr_results: List[OCRResult]) -> Optional[str]:
        """
        Detect timeframe from explicit labels in OCR text.
        
        Args:
            ocr_results: List of OCR text extraction results
            
        Returns:
            Optional[str]: Detected timeframe (e.g., '1H', 'D1') or None
        """
        for result in ocr_results:
            text = result.text.upper()
            
            # Check each pattern
            for pattern, timeframe in self.TIMEFRAME_PATTERNS.items():
                if re.search(pattern, text, re.IGNORECASE):
                    logger.info("Detected timeframe '%s' from OCR text: '%s'",
                               timeframe, result.text)
                    return timeframe
        
        return None
    
    def detect_from_timestamps(self, timestamps: List[ExtractedTimestamp]) -> Optional[str]:
        """
        Infer timeframe from timestamp intervals.
        
        Args:
            timestamps: List of extracted timestamps
            
        Returns:
            Optional[str]: Inferred timeframe or None
        """
        if len(timestamps) < 2:
            logger.warning("Not enough timestamps to infer timeframe")
            return None
        
        # Calculate intervals between consecutive timestamps
        intervals = []
        for i in range(len(timestamps) - 1):
            delta = timestamps[i + 1].timestamp - timestamps[i].timestamp
            intervals.append(delta.total_seconds())
        
        if not intervals:
            return None
        
        # Calculate average interval
        avg_interval = np.median(intervals)  # Use median for robustness
        
        logger.debug("Average timestamp interval: %.2f seconds", avg_interval)
        
        # Find closest matching timeframe
        best_match = None
        min_diff = float('inf')
        
        for expected_interval, timeframe in self.INTERVAL_TIMEFRAME_MAP:
            diff = abs(avg_interval - expected_interval)
            
            # Allow 20% tolerance
            if diff / expected_interval < 0.2 and diff < min_diff:
                min_diff = diff
                best_match = timeframe
        
        if best_match:
            logger.info("Inferred timeframe '%s' from timestamp intervals (avg=%.2fs)",
                       best_match, avg_interval)
        else:
            logger.warning("Could not infer timeframe from intervals (avg=%.2fs)",
                          avg_interval)
        
        return best_match
    
    def detect_timeframe(
        self,
        ocr_results: List[OCRResult],
        timestamps: List[ExtractedTimestamp]
    ) -> str:
        """
        Detect timeframe using multiple strategies.
        
        Strategy priority:
        1. Explicit OCR labels (highest confidence)
        2. Timestamp interval inference
        3. Default to 'UNKNOWN'
        
        Args:
            ocr_results: List of OCR text extraction results
            timestamps: List of extracted timestamps
            
        Returns:
            str: Detected timeframe (e.g., '1H', 'D1', or 'UNKNOWN')
        """
        # Try explicit OCR labels first
        timeframe = self.detect_from_ocr(ocr_results)
        if timeframe:
            return timeframe
        
        # Fall back to timestamp interval inference
        timeframe = self.detect_from_timestamps(timestamps)
        if timeframe:
            return timeframe
        
        # Default to unknown
        logger.warning("Could not detect timeframe, defaulting to 'UNKNOWN'")
        return 'UNKNOWN'


class ChartOCRProcessor:
    """
    Main OCR processor that orchestrates text extraction, price/timestamp parsing,
    and timeframe detection.
    """
    
    def __init__(
        self,
        min_confidence: float = 0.7,
        low_confidence_threshold: float = 0.7,
        min_data_points: int = 10
    ):
        """
        Initialize the OCR processor.
        
        Args:
            min_confidence: Minimum confidence for accepting OCR results
            low_confidence_threshold: Threshold for flagging low confidence
            min_data_points: Minimum number of data points required
        """
        self.ocr_engine = OCREngine(
            min_confidence_threshold=min_confidence,
            low_confidence_threshold=low_confidence_threshold
        )
        self.price_extractor = PriceExtractor(min_confidence=min_confidence)
        self.timestamp_extractor = TimestampExtractor(min_confidence=min_confidence)
        self.timeframe_detector = TimeframeDetector()
        self.min_data_points = min_data_points
        
        logger.info("ChartOCRProcessor initialized (min_data_points=%d)", min_data_points)
    
    def process(self, preprocessed: PreprocessedImage) -> Dict[str, Any]:
        """
        Process chart image and extract all OCR data.
        
        Args:
            preprocessed: PreprocessedImage object
            
        Returns:
            Dict containing:
                - ocr_results: Raw OCR text extractions
                - prices: Extracted price values
                - timestamps: Extracted timestamps
                - timeframe: Detected timeframe
                - data_point_count: Number of extracted data points
                - low_confidence_flags: List of low-confidence items
                
        Raises:
            ValueError: If insufficient data points extracted
        """
        logger.info("Starting OCR processing pipeline")
        
        # Step 1: Extract text via OCR
        ocr_results = self.ocr_engine.extract_text(preprocessed)
        
        # Step 2: Extract prices
        prices = self.price_extractor.extract_prices(ocr_results)
        
        # Step 3: Extract timestamps
        timestamps = self.timestamp_extractor.extract_timestamps(ocr_results)
        
        # Step 4: Detect timeframe
        timeframe = self.timeframe_detector.detect_timeframe(ocr_results, timestamps)
        
        # Step 5: Validate minimum data points
        # Use the lesser of prices or timestamps as data point count
        data_point_count = min(len(prices), len(timestamps)) if timestamps else len(prices)
        
        if data_point_count < self.min_data_points:
            logger.error("Insufficient data points: %d < %d",
                        data_point_count, self.min_data_points)
            raise ValueError(
                f"Insufficient data extracted. Found {data_point_count} data points, "
                f"need at least {self.min_data_points}."
            )
        
        # Step 6: Flag low-confidence items
        low_confidence_flags = []
        
        for i, price in enumerate(prices):
            if price.confidence < self.ocr_engine.low_confidence_threshold:
                low_confidence_flags.append(f"price_{i}")
        
        for i, timestamp in enumerate(timestamps):
            if timestamp.confidence < self.ocr_engine.low_confidence_threshold:
                low_confidence_flags.append(f"timestamp_{i}")
        
        logger.info("OCR processing completed: %d prices, %d timestamps, timeframe=%s, "
                   "%d low-confidence flags",
                   len(prices), len(timestamps), timeframe, len(low_confidence_flags))
        
        return {
            'ocr_results': ocr_results,
            'prices': prices,
            'timestamps': timestamps,
            'timeframe': timeframe,
            'data_point_count': data_point_count,
            'low_confidence_flags': low_confidence_flags
        }


# Singleton instance for reuse across requests
_ocr_processor_instance = None


def get_ocr_processor() -> ChartOCRProcessor:
    """
    Get or create singleton ChartOCRProcessor instance.
    
    Returns:
        ChartOCRProcessor: Shared OCR processor instance
    """
    global _ocr_processor_instance
    
    if _ocr_processor_instance is None:
        _ocr_processor_instance = ChartOCRProcessor()
        logger.info("Created new ChartOCRProcessor singleton instance")
    
    return _ocr_processor_instance
