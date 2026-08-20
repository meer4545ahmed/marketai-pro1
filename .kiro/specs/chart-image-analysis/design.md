# Design Document: Chart Image Analysis

## 1. Overview

The Chart Image Analysis feature introduces a new Python-based FastAPI microservice that extends the existing technical analysis platform by enabling users to upload financial chart images and receive automated predictions. The service leverages Optical Character Recognition (OCR) to extract OHLC data from chart images, reuses the existing XGBoost model and feature engineering logic to calculate 37 technical indicators, and returns predictions in a format compatible with the current prediction API.

### 1.1 Design Goals

- **Reusability**: Leverage existing XGBoost model and feature engineering code without modification
- **Consistency**: Maintain API response format compatibility with existing `/api/prediction` endpoint
- **Separation of Concerns**: Deploy as independent Python service alongside existing Express API
- **User Experience**: Provide intuitive drag-drop upload interface with visual feedback
- **Performance**: Complete end-to-end analysis within 30 seconds

### 1.2 Technology Stack

- **Backend Service**: Python 3.10+, FastAPI
- **OCR Engine**: EasyOCR (primary) with Tesseract fallback
- **Image Processing**: OpenCV (cv2) for preprocessing and pattern recognition
- **ML Framework**: XGBoost (existing trained model)
- **Frontend**: React component with drag-drop support
- **API Communication**: Multipart form-data for upload, JSON for responses

## 2. Architecture

### 2.1 System Context

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Browser                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Chart Upload Component (React)                           │  │
│  │  - Drag-drop interface                                    │  │
│  │  - File validation                                        │  │
│  │  - Preview display                                        │  │
│  └────────────────────┬─────────────────────────────────────┘  │
└─────────────────────────┼─────────────────────────────────────────┘
                         │ HTTP POST multipart/form-data
                         │ (image file)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│            Chart Analysis Service (Python FastAPI)               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  API Layer: POST /api/analyze-chart                       │  │
│  └────────────────────┬─────────────────────────────────────┘  │
│                       │                                          │
│  ┌────────────────────▼─────────────────────────────────────┐  │
│  │  Image Preprocessing Pipeline (OpenCV)                    │  │
│  │  - Contrast enhancement                                   │  │
│  │  - Edge detection                                         │  │
│  │  - Candlestick region isolation                           │  │
│  └────────────────────┬─────────────────────────────────────┘  │
│                       │                                          │
│  ┌────────────────────▼─────────────────────────────────────┐  │
│  │  OCR Engine (EasyOCR/Tesseract)                           │  │
│  │  - Text extraction (prices, dates, timeframe)             │  │
│  │  - Confidence scoring                                     │  │
│  └────────────────────┬─────────────────────────────────────┘  │
│                       │                                          │
│  ┌────────────────────▼─────────────────────────────────────┐  │
│  │  Candlestick Pattern Analyzer (OpenCV)                    │  │
│  │  - Color detection (red/green candles)                    │  │
│  │  - OHLC value extraction from visual geometry             │  │
│  │  - Wick position analysis                                 │  │
│  └────────────────────┬─────────────────────────────────────┘  │
│                       │                                          │
│  ┌────────────────────▼─────────────────────────────────────┐  │
│  │  Feature Engineering Module (Reused)                      │  │
│  │  - Calculate 37 technical indicators                      │  │
│  │  - Moving averages (SMA, EMA)                             │  │
│  │  - Momentum (RSI, MACD, Stochastic)                       │  │
│  │  - Volatility (Bollinger Bands, ATR)                      │  │
│  │  - Volume-based indicators (when available)               │  │
│  └────────────────────┬─────────────────────────────────────┘  │
│                       │                                          │
│  ┌────────────────────▼─────────────────────────────────────┐  │
│  │  XGBoost Prediction Model (Existing)                      │  │
│  │  - Load pretrained model                                  │  │
│  │  - Generate prediction (direction, confidence)            │  │
│  └────────────────────┬─────────────────────────────────────┘  │
└─────────────────────────┼─────────────────────────────────────────┘
                         │ JSON response
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Analysis Display (React)                     │
│  - Prediction direction                                          │
│  - Confidence score                                              │
│  - 37 indicator values grouped by category                       │
│  - Original chart image preview                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Responsibilities

#### 2.2.1 Frontend Components

**ChartUploadComponent**
- Accept PNG, JPG, JPEG files via drag-drop or file picker
- Validate file size (max 10MB) and format before upload
- Display image preview upon selection
- Show loading spinner during analysis
- Handle and display error messages

**AnalysisDisplayComponent**
- Render prediction results in existing prediction page format
- Display uploaded chart image alongside results
- Group 37 indicators by category (trend, momentum, volatility, volume)
- Highlight low-confidence indicators with visual markers
- Use consistent styling with existing prediction UI

#### 2.2.2 Backend Services

**API Endpoint Handler** (`/api/analyze-chart`)
- Accept multipart/form-data POST requests
- Validate image format and size
- Orchestrate processing pipeline
- Return JSON response matching existing prediction schema
- Handle errors with descriptive messages
- Enforce authentication (if enabled in existing system)

**Image Preprocessor**
- Convert image to grayscale for OCR optimization
- Apply contrast enhancement using CLAHE (Contrast Limited Adaptive Histogram Equalization)
- Perform edge detection to identify chart boundaries
- Isolate candlestick regions using contour detection
- Normalize image dimensions for consistent processing

**OCR Engine**
- Primary: EasyOCR for robust text extraction
- Fallback: Tesseract OCR for redundancy
- Extract visible numbers (OHLC values)
- Extract dates and timestamps
- Detect timeframe indicators (look for "1H", "4H", "D1", "1M", etc.)
- Return confidence scores per extracted element
- Flag elements with confidence <70% as low-confidence

**Candlestick Pattern Analyzer**
- Detect candlestick visual patterns using color and geometry
- Identify red (bearish) vs green (bullish) candles via HSV color space
- Calculate OHLC from geometric positions:
  - Open: Start of candle body
  - High: Top of upper wick
  - Low: Bottom of lower wick
  - Close: End of candle body
- Cross-reference with OCR-extracted values for validation
- Handle various chart styles (solid, hollow, filled candles)

**Feature Engineering Module**
- Accept OHLC data array with optional volume
- Calculate all 37 technical indicators:
  - **Trend Indicators**: SMA (5, 10, 20, 50, 200), EMA (12, 26), MACD, Parabolic SAR
  - **Momentum Indicators**: RSI (14), Stochastic (14,3,3), CCI (20), Williams %R, ROC
  - **Volatility Indicators**: Bollinger Bands (20,2), ATR (14), Standard Deviation, Keltner Channels
  - **Volume Indicators** (if available): OBV, Volume SMA, A/D Line, Chaikin Money Flow
- Handle missing volume data by calculating only price-based indicators
- Use zero as default for indicators requiring insufficient data points
- Return indicator dictionary with 37 key-value pairs

**XGBoost Model Interface**
- Load pretrained model from existing model file
- Accept 37-feature indicator array
- Generate prediction: direction (up/down/neutral) and confidence (0-100%)
- Return structured prediction result

## 3. Data Models

### 3.1 API Request Schema

```python
# Multipart form-data upload
POST /api/analyze-chart
Content-Type: multipart/form-data

file: <binary image data>  # Required, PNG/JPG/JPEG, max 10MB
```

### 3.2 API Response Schema

```python
{
  "success": bool,                    # True if analysis completed
  "prediction": {
    "direction": str,                 # "up", "down", or "neutral"
    "confidence": float               # 0.0 to 100.0
  },
  "indicators": {
    # Trend Indicators
    "sma_5": float,
    "sma_10": float,
    "sma_20": float,
    "sma_50": float,
    "sma_200": float,
    "ema_12": float,
    "ema_26": float,
    "macd": float,
    "macd_signal": float,
    "macd_histogram": float,
    "parabolic_sar": float,
    
    # Momentum Indicators
    "rsi_14": float,
    "stochastic_k": float,
    "stochastic_d": float,
    "cci_20": float,
    "williams_r": float,
    "roc": float,
    "momentum": float,
    
    # Volatility Indicators
    "bollinger_upper": float,
    "bollinger_middle": float,
    "bollinger_lower": float,
    "atr_14": float,
    "std_dev": float,
    "keltner_upper": float,
    "keltner_middle": float,
    "keltner_lower": float,
    "historical_volatility": float,
    
    # Volume Indicators (0 if volume unavailable)
    "obv": float,
    "volume_sma": float,
    "ad_line": float,
    "chaikin_mf": float,
    "volume_roc": float,
    "vwap": float,
    "force_index": float,
    "ease_of_movement": float,
    "volume_weighted_macd": float
  },
  "metadata": {
    "extracted_data_points": int,     # Number of candles extracted
    "timeframe": str,                 # "1H", "4H", "D1", etc.
    "low_confidence_indicators": [str], # List of flagged indicators
    "processing_time_ms": int         # Total processing time
  },
  "error": str | null                 # Error message if success=false
}
```

### 3.3 Internal Data Structures

```python
class OHLCDataPoint:
    """Single candlestick data point"""
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float | None  # Optional
    confidence: float     # OCR confidence score

class ChartMetadata:
    """Extracted chart information"""
    timeframe: str        # "1H", "4H", "D1", etc.
    asset_type: str       # "stock", "forex", "crypto"
    date_range: tuple[datetime, datetime]
    has_volume: bool

class PreprocessedImage:
    """Processed image data"""
    original: np.ndarray
    grayscale: np.ndarray
    enhanced: np.ndarray
    candlestick_regions: list[np.ndarray]
```

## 4. Processing Pipeline

### 4.1 End-to-End Flow

```python
def analyze_chart_image(image_file: UploadFile) -> PredictionResult:
    """
    Main pipeline for chart image analysis
    
    Steps:
    1. Validate image (format, size)
    2. Preprocess image (contrast, edge detection)
    3. Extract text via OCR (prices, dates, timeframe)
    4. Analyze candlestick patterns (OHLC from visual geometry)
    5. Construct OHLC dataset
    6. Calculate 37 technical indicators
    7. Generate XGBoost prediction
    8. Return formatted result
    """
    
    # Step 1: Validation
    validate_image_format(image_file)  # PNG/JPG/JPEG only
    validate_image_size(image_file)     # Max 10MB
    
    # Step 2: Preprocessing
    image = load_image(image_file)
    preprocessed = preprocess_image(image)
    
    # Step 3: OCR Text Extraction
    ocr_results = extract_text_with_ocr(preprocessed)
    timeframe = detect_timeframe(ocr_results)
    price_labels = extract_price_labels(ocr_results)
    date_labels = extract_date_labels(ocr_results)
    
    # Step 4: Visual Pattern Analysis
    candlestick_regions = isolate_candlesticks(preprocessed)
    visual_ohlc = extract_ohlc_from_patterns(candlestick_regions)
    
    # Step 5: Data Construction
    ohlc_data = merge_ocr_and_visual_data(
        ocr_results=ocr_results,
        visual_ohlc=visual_ohlc,
        price_labels=price_labels,
        date_labels=date_labels
    )
    
    # Validation: Minimum 10 data points required
    if len(ohlc_data) < 10:
        raise InsufficientDataError("Need at least 10 candlesticks")
    
    # Step 6: Feature Engineering
    indicators = calculate_technical_indicators(ohlc_data)
    
    # Step 7: Prediction
    prediction = xgboost_model.predict(indicators)
    
    # Step 8: Response Construction
    return construct_response(
        prediction=prediction,
        indicators=indicators,
        metadata=extract_metadata(ohlc_data, ocr_results)
    )
```

### 4.2 Image Preprocessing Details

```python
def preprocess_image(image: np.ndarray) -> PreprocessedImage:
    """
    Enhance image for optimal OCR and pattern recognition
    
    Techniques:
    - Grayscale conversion
    - CLAHE for contrast enhancement
    - Gaussian blur for noise reduction
    - Canny edge detection for boundary identification
    - Morphological operations for candlestick isolation
    """
    
    # Convert to grayscale
    grayscale = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Apply CLAHE for adaptive contrast enhancement
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
    enhanced = clahe.apply(grayscale)
    
    # Noise reduction
    denoised = cv2.GaussianBlur(enhanced, (5,5), 0)
    
    # Edge detection
    edges = cv2.Canny(denoised, threshold1=50, threshold2=150)
    
    # Isolate candlestick regions via contour detection
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    candlestick_regions = filter_candlestick_contours(contours, image)
    
    return PreprocessedImage(
        original=image,
        grayscale=grayscale,
        enhanced=enhanced,
        candlestick_regions=candlestick_regions
    )
```

### 4.3 Timeframe Detection

```python
def detect_timeframe(ocr_results: list[OCRResult]) -> str:
    """
    Identify chart timeframe from OCR text
    
    Strategy:
    - Search for common timeframe patterns: "1M", "5M", "15M", "1H", "4H", "D1", "W1"
    - Check axis labels for time intervals
    - Infer from date/time stamps if explicit label missing
    
    Returns:
    - Detected timeframe string (e.g., "1H", "D1")
    - "UNKNOWN" if detection fails
    """
    
    timeframe_patterns = [
        r'\b1M\b', r'\b5M\b', r'\b15M\b', r'\b30M\b',
        r'\b1H\b', r'\b4H\b', r'\b8H\b', r'\b12H\b',
        r'\bD1\b', r'\b1D\b', r'\bDAILY\b',
        r'\bW1\b', r'\b1W\b', r'\bWEEKLY\b',
        r'\bM1\b', r'\bMONTHLY\b'
    ]
    
    for result in ocr_results:
        text = result.text.upper()
        for pattern in timeframe_patterns:
            if re.search(pattern, text):
                return normalize_timeframe(re.findall(pattern, text)[0])
    
    # Fallback: Infer from timestamp intervals
    timestamps = extract_timestamps(ocr_results)
    if len(timestamps) >= 2:
        interval = calculate_average_interval(timestamps)
        return infer_timeframe_from_interval(interval)
    
    return "UNKNOWN"
```

### 4.4 OHLC Extraction from Visual Patterns

```python
def extract_ohlc_from_patterns(candlestick_regions: list[np.ndarray]) -> list[dict]:
    """
    Extract OHLC values from candlestick visual geometry
    
    Process:
    1. Detect candle color (red/green) via HSV color space
    2. Identify body and wick boundaries
    3. Map pixel coordinates to price scale
    4. Calculate OHLC from geometry
    
    Returns:
    - List of OHLC dictionaries with visual confidence scores
    """
    
    ohlc_data = []
    
    for region in candlestick_regions:
        # Convert to HSV for robust color detection
        hsv = cv2.cvtColor(region, cv2.COLOR_BGR2HSV)
        
        # Detect candle type: green (bullish) or red (bearish)
        is_bullish = detect_candle_color(hsv)
        
        # Find body and wick boundaries
        body_top, body_bottom = find_body_boundaries(region)
        wick_top, wick_bottom = find_wick_boundaries(region)
        
        # Determine OHLC based on candle type
        if is_bullish:  # Green candle: close > open
            open_price = body_bottom
            close_price = body_top
        else:  # Red candle: open > close
            open_price = body_top
            close_price = body_bottom
        
        ohlc_data.append({
            'open': open_price,
            'high': wick_top,
            'low': wick_bottom,
            'close': close_price,
            'confidence': calculate_visual_confidence(region)
        })
    
    return ohlc_data
```

### 4.5 Data Merging Strategy

```python
def merge_ocr_and_visual_data(
    ocr_results: list[OCRResult],
    visual_ohlc: list[dict],
    price_labels: list[float],
    date_labels: list[datetime]
) -> list[OHLCDataPoint]:
    """
    Combine OCR text extraction with visual pattern analysis
    
    Strategy:
    1. Use OCR price labels as absolute reference points
    2. Scale visual OHLC pixel positions to price scale
    3. Use OCR dates to assign timestamps
    4. Cross-validate OCR vs visual data
    5. Flag discrepancies with low confidence scores
    
    Priority:
    - OCR data preferred when confidence >80%
    - Visual data used when OCR confidence <70%
    - Average both when confidence 70-80%
    """
    
    # Establish price scale from OCR labels
    price_scale = create_price_scale(price_labels, image_height)
    
    # Map visual pixel positions to prices
    scaled_visual_ohlc = scale_visual_to_prices(visual_ohlc, price_scale)
    
    # Assign timestamps from date labels
    timestamped_data = assign_timestamps(scaled_visual_ohlc, date_labels)
    
    # Merge with OCR-extracted values where available
    merged_data = []
    for visual, ocr in zip(timestamped_data, ocr_results):
        merged = merge_single_datapoint(visual, ocr)
        merged_data.append(merged)
    
    return merged_data
```

## 5. Technical Indicator Calculation

### 5.1 Indicator Module Integration

The feature engineering module is reused from the existing codebase without modification. The module accepts OHLC data and returns a dictionary with 37 indicator values.

```python
# Existing feature engineering module (reused)
from feature_engineering import calculate_all_indicators

def calculate_technical_indicators(ohlc_data: list[OHLCDataPoint]) -> dict[str, float]:
    """
    Calculate all 37 technical indicators using existing logic
    
    Input: List of OHLC data points
    Output: Dictionary with 37 indicator key-value pairs
    
    Handles:
    - Missing volume data (calculates only price-based indicators)
    - Insufficient data for specific indicators (defaults to 0)
    - Indicator calculation errors (logs and uses fallback values)
    """
    
    # Convert to pandas DataFrame (expected by existing module)
    df = convert_to_dataframe(ohlc_data)
    
    # Call existing indicator calculation logic
    indicators = calculate_all_indicators(
        df=df,
        has_volume=check_volume_availability(ohlc_data)
    )
    
    # Validate all 37 indicators present
    assert len(indicators) == 37, "Missing indicators in calculation"
    
    return indicators
```

### 5.2 Volume Data Handling

```python
def check_volume_availability(ohlc_data: list[OHLCDataPoint]) -> bool:
    """
    Determine if volume data is available and reliable
    
    Criteria:
    - At least 80% of data points have non-zero volume
    - Volume values are positive and reasonable
    """
    
    volume_count = sum(1 for dp in ohlc_data if dp.volume and dp.volume > 0)
    volume_ratio = volume_count / len(ohlc_data)
    
    return volume_ratio >= 0.8

def calculate_all_indicators(df: pd.DataFrame, has_volume: bool) -> dict[str, float]:
    """
    Calculate 37 indicators with volume-conditional logic
    
    If has_volume=False:
    - Volume-based indicators (OBV, Volume SMA, etc.) set to 0
    - All price-based indicators calculated normally
    """
    
    indicators = {}
    
    # Always calculate price-based indicators (30 indicators)
    indicators.update(calculate_trend_indicators(df))
    indicators.update(calculate_momentum_indicators(df))
    indicators.update(calculate_volatility_indicators(df))
    
    # Conditionally calculate volume indicators (7 indicators)
    if has_volume:
        indicators.update(calculate_volume_indicators(df))
    else:
        # Default to zero for volume indicators
        indicators.update({
            'obv': 0.0,
            'volume_sma': 0.0,
            'ad_line': 0.0,
            'chaikin_mf': 0.0,
            'volume_roc': 0.0,
            'vwap': 0.0,
            'force_index': 0.0
        })
    
    return indicators
```

## 6. Error Handling

### 6.1 Error Categories

```python
class ChartAnalysisError(Exception):
    """Base exception for chart analysis errors"""
    pass

class InvalidImageFormatError(ChartAnalysisError):
    """Raised when image format is not PNG/JPG/JPEG"""
    pass

class ImageSizeExceededError(ChartAnalysisError):
    """Raised when image exceeds 10MB limit"""
    pass

class OCRExtractionError(ChartAnalysisError):
    """Raised when OCR fails to extract data"""
    pass

class InsufficientDataError(ChartAnalysisError):
    """Raised when fewer than 10 data points extracted"""
    pass

class InvalidChartFormatError(ChartAnalysisError):
    """Raised when image doesn't contain recognizable chart"""
    pass

class ModelUnavailableError(ChartAnalysisError):
    """Raised when XGBoost model cannot be loaded"""
    pass

class IndicatorCalculationError(ChartAnalysisError):
    """Raised when feature engineering fails"""
    pass
```

### 6.2 Error Response Format

```python
def format_error_response(error: Exception) -> dict:
    """
    Convert exceptions to user-friendly error responses
    
    Returns:
    {
        "success": false,
        "error": "User-friendly error message",
        "error_code": "ERROR_CATEGORY",
        "suggestions": ["Actionable guidance for user"]
    }
    """
    
    error_mappings = {
        InvalidImageFormatError: {
            "message": "Invalid image format. Please upload PNG, JPG, or JPEG files.",
            "code": "INVALID_FORMAT",
            "suggestions": ["Ensure file extension is .png, .jpg, or .jpeg"]
        },
        ImageSizeExceededError: {
            "message": "Image file too large. Maximum size is 10MB.",
            "code": "SIZE_EXCEEDED",
            "suggestions": ["Compress image before uploading", "Crop to chart area only"]
        },
        OCRExtractionError: {
            "message": "Failed to extract data from image. Please ensure chart is clear and readable.",
            "code": "OCR_FAILURE",
            "suggestions": [
                "Use higher resolution image",
                "Ensure chart has clear axis labels",
                "Remove watermarks or overlays"
            ]
        },
        InsufficientDataError: {
            "message": "Not enough data points detected. Please upload chart with at least 10 candlesticks.",
            "code": "INSUFFICIENT_DATA",
            "suggestions": [
                "Zoom out to show more candlesticks",
                "Use chart with longer time range"
            ]
        },
        InvalidChartFormatError: {
            "message": "Image does not contain a recognizable financial chart.",
            "code": "INVALID_CHART",
            "suggestions": [
                "Ensure image shows candlestick chart",
                "Use chart from trading platform",
                "Verify chart has price axis and time axis"
            ]
        },
        ModelUnavailableError: {
            "message": "Prediction service temporarily unavailable. Please try again later.",
            "code": "SERVICE_UNAVAILABLE",
            "suggestions": ["Wait a few minutes and retry"]
        }
    }
    
    error_type = type(error)
    error_info = error_mappings.get(error_type, {
        "message": "An unexpected error occurred. Please try again.",
        "code": "UNKNOWN_ERROR",
        "suggestions": ["Contact support if problem persists"]
    })
    
    # Log detailed error for debugging
    logger.error(f"{error_type.__name__}: {str(error)}", exc_info=True)
    
    return {
        "success": False,
        "error": error_info["message"],
        "error_code": error_info["code"],
        "suggestions": error_info["suggestions"]
    }
```

### 6.3 Retry and Fallback Logic

```python
def analyze_chart_with_fallback(image_file: UploadFile) -> PredictionResult:
    """
    Main analysis with OCR fallback and retry logic
    
    Fallback chain:
    1. Try EasyOCR (primary)
    2. If fails, try Tesseract OCR
    3. If both fail, rely on visual pattern analysis only
    """
    
    preprocessed = preprocess_image(load_image(image_file))
    
    # Try primary OCR engine
    try:
        ocr_results = extract_with_easyocr(preprocessed)
    except OCRExtractionError:
        logger.warning("EasyOCR failed, falling back to Tesseract")
        try:
            ocr_results = extract_with_tesseract(preprocessed)
        except OCRExtractionError:
            logger.warning("Both OCR engines failed, using visual-only analysis")
            ocr_results = []  # Empty OCR results
    
    # Visual analysis always runs (independent of OCR)
    visual_ohlc = extract_ohlc_from_patterns(preprocessed.candlestick_regions)
    
    # Merge available data
    ohlc_data = merge_ocr_and_visual_data(ocr_results, visual_ohlc)
    
    # Continue with feature engineering and prediction
    return complete_analysis_pipeline(ohlc_data)
```

## 7. Performance Optimization

### 7.1 Performance Targets

- **Total Processing Time**: ≤30 seconds per image
- **OCR Extraction**: ≤15 seconds
- **Feature Calculation**: ≤5 seconds
- **Concurrent Requests**: ≥10 simultaneous analyses

### 7.2 Optimization Strategies

```python
# 1. Image Downsampling
def optimize_image_size(image: np.ndarray) -> np.ndarray:
    """
    Downsample large images while preserving chart details
    
    Strategy:
    - Resize images >2000px width to 1600px
    - Maintain aspect ratio
    - Use high-quality interpolation
    """
    max_width = 1600
    height, width = image.shape[:2]
    
    if width > max_width:
        scale = max_width / width
        new_dims = (max_width, int(height * scale))
        return cv2.resize(image, new_dims, interpolation=cv2.INTER_LANCZOS4)
    
    return image

# 2. Parallel OCR and Visual Processing
import asyncio

async def parallel_extraction(preprocessed: PreprocessedImage):
    """
    Run OCR and visual pattern analysis concurrently
    """
    ocr_task = asyncio.create_task(extract_with_ocr_async(preprocessed))
    visual_task = asyncio.create_task(extract_visual_patterns_async(preprocessed))
    
    ocr_results, visual_ohlc = await asyncio.gather(ocr_task, visual_task)
    
    return ocr_results, visual_ohlc

# 3. Model Caching
class ModelCache:
    """Singleton cache for XGBoost model"""
    _instance = None
    _model = None
    
    @classmethod
    def get_model(cls):
        if cls._model is None:
            cls._model = load_xgboost_model()
        return cls._model

# 4. Request Queueing
from asyncio import Queue, Semaphore

class AnalysisQueue:
    """
    Queue system for managing concurrent requests
    
    Features:
    - Limit concurrent processing to 10 requests
    - Queue additional requests with FIFO order
    - Timeout requests after 45 seconds
    """
    
    def __init__(self, max_concurrent: int = 10):
        self.semaphore = Semaphore(max_concurrent)
        self.queue = Queue()
    
    async def process_request(self, image_file: UploadFile) -> PredictionResult:
        async with self.semaphore:
            return await analyze_chart_image(image_file)
```

### 7.3 Resource Management

```python
# Memory cleanup after processing
def cleanup_resources(preprocessed: PreprocessedImage):
    """
    Release memory from image processing
    
    Important: OpenCV and OCR can consume significant memory
    """
    del preprocessed.original
    del preprocessed.grayscale
    del preprocessed.enhanced
    del preprocessed.candlestick_regions
    
    import gc
    gc.collect()

# Timeout handling
from asyncio import wait_for, TimeoutError

async def analyze_with_timeout(image_file: UploadFile, timeout: int = 30) -> PredictionResult:
    """
    Enforce 30-second timeout on analysis
    """
    try:
        result = await wait_for(
            analyze_chart_image(image_file),
            timeout=timeout
        )
        return result
    except TimeoutError:
        raise ChartAnalysisError("Analysis timed out after 30 seconds")
```

## 8. Frontend Implementation

### 8.1 Chart Upload Component

```typescript
// ChartUploadComponent.tsx
import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

interface ChartUploadProps {
  onAnalysisComplete: (result: PredictionResult) => void;
}

const ChartUploadComponent: React.FC<ChartUploadProps> = ({ onAnalysisComplete }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // File validation
  const validateFile = (file: File): string | null => {
    const validFormats = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!validFormats.includes(file.type)) {
      return 'Invalid format. Please upload PNG, JPG, or JPEG files.';
    }
    
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return 'File too large. Maximum size is 10MB.';
    }
    
    return null;
  };

  // Handle file drop
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    const validationError = validateFile(file);
    
    if (validationError) {
      setError(validationError);
      return;
    }
    
    setError(null);
    setSelectedFile(file);
    
    // Generate preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg']
    },
    maxFiles: 1,
    multiple: false
  });

  // Submit for analysis
  const handleAnalyze = async () => {
    if (!selectedFile) return;
    
    setIsAnalyzing(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      
      const response = await fetch('/api/analyze-chart', {
        method: 'POST',
        body: formData,
        // Include credentials if authentication enabled
        credentials: 'include'
      });
      
      const result = await response.json();
      
      if (!result.success) {
        setError(result.error);
        return;
      }
      
      onAnalysisComplete(result);
    } catch (err) {
      setError('Failed to analyze chart. Please try again.');
      console.error('Analysis error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="chart-upload-container">
      <div
        {...getRootProps()}
        className={`dropzone ${isDragActive ? 'active' : ''}`}
      >
        <input {...getInputProps()} />
        {isDragActive ? (
          <p>Drop chart image here...</p>
        ) : (
          <p>Drag & drop chart image, or click to select</p>
        )}
        <p className="format-hint">PNG, JPG, JPEG (max 10MB)</p>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {previewUrl && (
        <div className="preview-section">
          <h3>Preview</h3>
          <img src={previewUrl} alt="Chart preview" className="chart-preview" />
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="analyze-button"
          >
            {isAnalyzing ? 'Analyzing...' : 'Analyze Chart'}
          </button>
        </div>
      )}

      {isAnalyzing && (
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Analyzing chart... This may take up to 30 seconds</p>
        </div>
      )}
    </div>
  );
};

export default ChartUploadComponent;
```

### 8.2 Analysis Display Component

```typescript
// AnalysisDisplayComponent.tsx
import React from 'react';

interface PredictionResult {
  success: boolean;
  prediction: {
    direction: string;
    confidence: number;
  };
  indicators: { [key: string]: number };
  metadata: {
    extracted_data_points: number;
    timeframe: string;
    low_confidence_indicators: string[];
    processing_time_ms: number;
  };
}

interface AnalysisDisplayProps {
  result: PredictionResult;
  chartImageUrl: string;
}

const AnalysisDisplayComponent: React.FC<AnalysisDisplayProps> = ({ 
  result, 
  chartImageUrl 
}) => {
  // Group indicators by category
  const groupedIndicators = {
    trend: [
      'sma_5', 'sma_10', 'sma_20', 'sma_50', 'sma_200',
      'ema_12', 'ema_26', 'macd', 'macd_signal', 'macd_histogram',
      'parabolic_sar'
    ],
    momentum: [
      'rsi_14', 'stochastic_k', 'stochastic_d', 'cci_20',
      'williams_r', 'roc', 'momentum'
    ],
    volatility: [
      'bollinger_upper', 'bollinger_middle', 'bollinger_lower',
      'atr_14', 'std_dev', 'keltner_upper', 'keltner_middle',
      'keltner_lower', 'historical_volatility'
    ],
    volume: [
      'obv', 'volume_sma', 'ad_line', 'chaikin_mf',
      'volume_roc', 'vwap', 'force_index', 'ease_of_movement',
      'volume_weighted_macd'
    ]
  };

  const isLowConfidence = (indicatorName: string): boolean => {
    return result.metadata.low_confidence_indicators.includes(indicatorName);
  };

  const formatIndicatorName = (name: string): string => {
    return name
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="analysis-display-container">
      {/* Prediction Summary */}
      <div className="prediction-summary">
        <div className={`direction-badge ${result.prediction.direction}`}>
          {result.prediction.direction.toUpperCase()}
        </div>
        <div className="confidence-score">
          Confidence: {result.prediction.confidence.toFixed(1)}%
        </div>
        <div className="metadata-info">
          Timeframe: {result.metadata.timeframe} | 
          Data Points: {result.metadata.extracted_data_points} | 
          Processing: {result.metadata.processing_time_ms}ms
        </div>
      </div>

      {/* Chart Image */}
      <div className="chart-image-section">
        <h3>Analyzed Chart</h3>
        <img src={chartImageUrl} alt="Analyzed chart" className="analyzed-chart" />
      </div>

      {/* Technical Indicators */}
      <div className="indicators-section">
        <h3>Technical Indicators</h3>
        
        {Object.entries(groupedIndicators).map(([category, indicators]) => (
          <div key={category} className="indicator-category">
            <h4>{category.charAt(0).toUpperCase() + category.slice(1)}</h4>
            <div className="indicator-grid">
              {indicators.map(indicatorKey => (
                <div 
                  key={indicatorKey} 
                  className={`indicator-item ${isLowConfidence(indicatorKey) ? 'low-confidence' : ''}`}
                >
                  <span className="indicator-name">
                    {formatIndicatorName(indicatorKey)}
                    {isLowConfidence(indicatorKey) && (
                      <span className="warning-icon" title="Low confidence">⚠️</span>
                    )}
                  </span>
                  <span className="indicator-value">
                    {result.indicators[indicatorKey]?.toFixed(4) ?? 'N/A'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AnalysisDisplayComponent;
```

## 9. Deployment and Integration

### 9.1 Service Deployment

```yaml
# Docker configuration for Python FastAPI service
# Dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies for OpenCV and OCR
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Run FastAPI with uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```txt
# requirements.txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
python-multipart==0.0.6
opencv-python-headless==4.8.1.78
easyocr==1.7.1
pytesseract==0.3.10
numpy==1.24.3
pandas==2.0.3
xgboost==2.0.2
pillow==10.1.0
pydantic==2.5.0
```

### 9.2 API Endpoint Registration

```python
# main.py - FastAPI application
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import logging

app = FastAPI(title="Chart Analysis Service", version="1.0.0")

# Configure CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Frontend origin
    allow_credentials=True,
    allow_methods=["POST"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.post("/api/analyze-chart")
async def analyze_chart(file: UploadFile = File(...)):
    """
    Analyze chart image and return prediction
    
    Request: multipart/form-data with 'file' field
    Response: JSON with prediction, indicators, and metadata
    """
    try:
        # Validate file format
        if file.content_type not in ["image/png", "image/jpeg"]:
            raise HTTPException(
                status_code=400,
                detail="Invalid file format. Use PNG or JPEG."
            )
        
        # Process chart
        result = await analyze_chart_with_timeout(file)
        
        return result
        
    except ChartAnalysisError as e:
        logger.error(f"Analysis error: {str(e)}")
        return format_error_response(e)
    
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "chart-analysis"}
```

### 9.3 Integration with Existing System

```typescript
// API client integration
// api/chartAnalysis.ts

export interface ChartAnalysisRequest {
  file: File;
}

export interface ChartAnalysisResponse {
  success: boolean;
  prediction: {
    direction: 'up' | 'down' | 'neutral';
    confidence: number;
  };
  indicators: { [key: string]: number };
  metadata: {
    extracted_data_points: number;
    timeframe: string;
    low_confidence_indicators: string[];
    processing_time_ms: number;
  };
  error?: string;
}

export const analyzeChartImage = async (
  file: File
): Promise<ChartAnalysisResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('http://localhost:8000/api/analyze-chart', {
    method: 'POST',
    body: formData,
    credentials: 'include', // Include auth cookies if needed
  });

  if (!response.ok) {
    throw new Error(`Analysis failed: ${response.statusText}`);
  }

  return await response.json();
};
```

## 10. Testing Strategy

Testing for this feature will be addressed in the tasks phase, but the design includes the following testable components:

### 10.1 Unit Testing Targets

- **File validation**: Format and size checks
- **Image preprocessing**: Contrast enhancement, edge detection
- **OCR extraction**: Text parsing and confidence scoring
- **Candlestick pattern recognition**: Color detection, OHLC geometry
- **Timeframe detection**: Pattern matching and inference
- **Data merging**: OCR and visual data combination
- **Indicator calculation**: All 37 technical indicators
- **Error handling**: Exception mapping and response formatting

### 10.2 Integration Testing Targets

- **End-to-end pipeline**: Upload to prediction response
- **API endpoint**: Request/response format validation
- **Model integration**: XGBoost model loading and prediction
- **Performance**: 30-second timeout compliance
- **Concurrency**: 10 simultaneous request handling

### 10.3 Property-Based Testing

Property-based tests will verify universal properties across diverse inputs, such as:
- For any valid image file, the upload interface accepts it
- For any OHLC dataset, all 37 indicators are calculated
- For any prediction result, the response schema is complete

## 11. Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: File Format Validation

*For any* uploaded file, the system SHALL accept the file if and only if it has a MIME type of `image/png`, `image/jpeg`, or `image/jpg`.

**Validates: Requirements 1.1**

### Property 2: File Size Validation

*For any* uploaded file, the system SHALL reject the file if its size exceeds 10MB and display an appropriate error message.

**Validates: Requirements 1.2**

### Property 3: Preview Display

*For any* valid image file selected by the user, the upload interface SHALL display a preview of that image.

**Validates: Requirements 1.3**

### Property 4: Service Request Transmission

*For any* valid image submission, the upload interface SHALL transmit the image data to the Chart Analysis Service via HTTP POST.

**Validates: Requirements 1.4**

### Property 5: Loading State Display

*For any* chart analysis request in progress, the upload interface SHALL display a loading indicator until the analysis completes or fails.

**Validates: Requirements 1.5**

### Property 6: OCR Extraction Execution

*For any* chart image received by the service, the OCR engine SHALL attempt to extract text and numerical values from the image.

**Validates: Requirements 2.1**

### Property 7: OHLC Parsing

*For any* chart image with visible candlesticks, the OCR engine SHALL identify and parse OHLC values for each detected data point.

**Validates: Requirements 2.2**

### Property 8: Timestamp Extraction

*For any* chart image with date/time information, the OCR engine SHALL extract timestamp data associated with each data point.

**Validates: Requirements 2.3**

### Property 9: Confidence Flagging

*For any* OCR-extracted data point with confidence below 70%, the system SHALL flag that data point as low-confidence.

**Validates: Requirements 2.4**

### Property 10: Minimum Data Point Validation

*For any* chart analysis where fewer than 10 data points are extracted, the system SHALL return an error indicating insufficient data.

**Validates: Requirements 2.5**

### Property 11: Timeframe Support

*For any* chart image with a timeframe between 1 minute and 1 month, the system SHALL successfully process the image.

**Validates: Requirements 2.6**

### Property 12: Asset Type Agnosticism

*For any* chart image representing stocks, forex, or cryptocurrency, the system SHALL process the image without asset-specific requirements.

**Validates: Requirements 2.7**

### Property 13: Complete Indicator Calculation

*For any* valid OHLC dataset, the feature extractor SHALL calculate all 37 technical indicators (including trend, momentum, volatility, and volume-based indicators when applicable).

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

### Property 14: Volume-Conditional Indicator Calculation

*For any* OHLC dataset, the feature extractor SHALL calculate volume-based indicators when volume data is available, and SHALL calculate all 37 indicators using only price-based methods when volume data is unavailable.

**Validates: Requirements 3.5, 3.6**

### Property 15: Insufficient Data Default Values

*For any* indicator that cannot be calculated due to insufficient data points, the feature extractor SHALL use a default value of zero.

**Validates: Requirements 3.7**

### Property 16: Model Integration

*For any* completed feature extraction, the system SHALL pass the calculated indicator values to the XGBoost model for prediction.

**Validates: Requirements 4.1**

### Property 17: Prediction Result Structure

*For any* successful prediction, the result SHALL include a direction value (one of: up, down, neutral), a confidence score between 0 and 100, and all 37 calculated indicator values.

**Validates: Requirements 4.2, 4.4, 4.5, 4.6**

### Property 18: Error Response Format

*For any* error occurring during prediction generation, the system SHALL return an error response containing a descriptive message.

**Validates: Requirements 4.7**

### Property 19: Direction Display

*For any* prediction result received, the analysis display SHALL prominently present the predicted direction.

**Validates: Requirements 5.1**

### Property 20: Confidence Formatting

*For any* prediction result, the analysis display SHALL format and display the confidence score as a percentage.

**Validates: Requirements 5.2**

### Property 21: Complete Indicator Display

*For any* prediction result, the analysis display SHALL render all 37 technical indicator values in a structured format.

**Validates: Requirements 5.3**

### Property 22: Chart Image Display

*For any* uploaded chart image, the analysis display SHALL show the image alongside the prediction results.

**Validates: Requirements 5.5**

### Property 23: Indicator Categorization

*For any* set of technical indicators, the analysis display SHALL group them into four categories: trend, momentum, volatility, and volume.

**Validates: Requirements 5.6**

### Property 24: Low-Confidence Marking

*For any* technical indicator flagged as low-confidence, the analysis display SHALL apply a visual marker to indicate potential unreliability.

**Validates: Requirements 5.7**

### Property 25: Invalid Chart Detection

*For any* uploaded image that does not contain a recognizable financial chart, the system SHALL return an error message indicating invalid chart format.

**Validates: Requirements 6.2**

### Property 26: Unexpected Error Handling

*For any* unexpected error encountered during processing, the system SHALL log the error details and return a generic error message to the user.

**Validates: Requirements 6.4**

### Property 27: Error Message Presentation

*For any* error condition, the upload interface SHALL display the error message in a user-friendly format with actionable guidance.

**Validates: Requirements 6.5**

### Property 28: Multipart Form-Data Acceptance

*For any* image upload request, the API endpoint SHALL accept image data transmitted as multipart/form-data.

**Validates: Requirements 7.2**

### Property 29: JSON Response Format

*For any* completed analysis (successful or failed), the API SHALL return results in JSON format.

**Validates: Requirements 7.3**

### Property 30: Schema Compatibility

*For any* prediction result, the output schema SHALL be compatible with the existing prediction result format used by the `/api/prediction` endpoint.

**Validates: Requirements 7.5**

### Property 31: Authentication Enforcement

*For any* system configuration where authentication is enabled, the Chart Analysis Service SHALL enforce the same authentication mechanism as the existing application.

**Validates: Requirements 7.6**

## 12. Security Considerations

### 12.1 Input Validation

- **File type validation**: Verify MIME type and file signature (magic numbers)
- **File size limits**: Enforce 10MB maximum to prevent resource exhaustion
- **Image content scanning**: Check for embedded malicious payloads
- **Path traversal prevention**: Sanitize all file paths

### 12.2 Authentication and Authorization

```python
from fastapi import Depends, HTTPException, Header

async def verify_auth_token(authorization: str = Header(None)):
    """
    Validate authentication token
    
    If existing system uses JWT, verify token signature
    If using session cookies, validate session
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authentication")
    
    # Integrate with existing auth system
    user = await validate_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid authentication")
    
    return user

@app.post("/api/analyze-chart")
async def analyze_chart(
    file: UploadFile = File(...),
    user = Depends(verify_auth_token)  # Enforce auth if enabled
):
    # Process authenticated request
    pass
```

### 12.3 Rate Limiting

```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.post("/api/analyze-chart")
@limiter.limit("10/minute")  # 10 requests per minute per IP
async def analyze_chart(file: UploadFile = File(...)):
    pass
```

## 13. Monitoring and Logging

### 13.1 Metrics to Track

- **Request volume**: Total analyses per hour/day
- **Success rate**: Percentage of successful vs failed analyses
- **Processing time**: Average, median, p95, p99 latencies
- **Error rates**: By error type (OCR failure, invalid format, etc.)
- **OCR confidence**: Average confidence scores
- **Data point extraction**: Average candlesticks extracted per image

### 13.2 Logging Strategy

```python
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

def log_analysis_attempt(file_name: str, file_size: int):
    """Log start of analysis"""
    logger.info(f"Analysis started: {file_name} ({file_size} bytes)")

def log_analysis_success(file_name: str, processing_time: float, data_points: int):
    """Log successful analysis"""
    logger.info(
        f"Analysis completed: {file_name} | "
        f"Time: {processing_time:.2f}s | "
        f"Data points: {data_points}"
    )

def log_analysis_error(file_name: str, error_type: str, error_message: str):
    """Log analysis failure"""
    logger.error(
        f"Analysis failed: {file_name} | "
        f"Error: {error_type} | "
        f"Message: {error_message}"
    )

def log_ocr_confidence(avg_confidence: float, low_confidence_count: int):
    """Log OCR quality metrics"""
    logger.info(
        f"OCR confidence: avg={avg_confidence:.2f}%, "
        f"low_confidence_count={low_confidence_count}"
    )
```

## 14. Future Enhancements

While not part of the current scope, these enhancements could be considered in future iterations:

1. **Multi-Chart Analysis**: Support uploading multiple charts for comparison
2. **Real-Time Feedback**: Stream analysis progress to frontend via WebSockets
3. **Chart Type Support**: Extend beyond candlesticks to line charts, bar charts
4. **Manual Corrections**: Allow users to correct OCR misreadings
5. **Historical Storage**: Save analyzed charts and predictions for user history
6. **Batch Processing**: API endpoint for analyzing multiple charts in one request
7. **Model Fine-Tuning**: Train chart-specific OCR model for improved accuracy
8. **Mobile Support**: Optimize for mobile device photo uploads
9. **Drawing Recognition**: Extract user-drawn trendlines and annotations
10. **PDF Support**: Accept multi-page PDF documents containing charts
