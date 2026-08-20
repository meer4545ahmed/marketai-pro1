# Implementation Plan: Chart Image Analysis

## Overview

This implementation plan breaks down the Chart Image Analysis feature into discrete, actionable tasks. The feature consists of three main components:

1. **Backend Service**: Python FastAPI microservice with OCR, image processing, and ML integration
2. **Frontend Interface**: React components for image upload and result display
3. **Integration Layer**: API endpoints, error handling, and performance optimization

The implementation follows an incremental approach where each task builds on previous work, with checkpoints to validate functionality and ensure quality.

## Tasks

- [x] 1. Set up Python FastAPI service infrastructure
  - Create new Python project directory structure
  - Set up virtual environment and install dependencies (FastAPI, uvicorn, OpenCV, EasyOCR, Tesseract, XGBoost, pandas, numpy)
  - Create main FastAPI application file with health check endpoint
  - Configure CORS middleware for frontend integration
  - Set up logging configuration
  - Create Dockerfile for containerized deployment
  - _Requirements: 7.1, 7.2, 7.3, 8.1_

- [x] 2. Implement image validation and preprocessing
  - [x] 2.1 Create file validation module
    - Write function to validate MIME types (PNG, JPG, JPEG)
    - Write function to validate file size (max 10MB)
    - Implement file signature verification for security
    - _Requirements: 1.1, 1.2, 6.5_

  - [x] 2.2 Build image preprocessing pipeline
    - Implement image loading with OpenCV
    - Create grayscale conversion function
    - Implement CLAHE contrast enhancement
    - Add Gaussian blur for noise reduction
    - Implement Canny edge detection
    - Create candlestick region isolation using contour detection
    - Implement image downsampling for optimization (max 1600px width)
    - _Requirements: 2.1, 8.4_

  - [x]* 2.3 Write unit tests for validation and preprocessing
    - Test file format validation with valid and invalid formats
    - Test file size limits with edge cases
    - Test preprocessing pipeline with sample chart images
    - Test image optimization for various input sizes
    - _Requirements: 1.1, 1.2_

- [x] 3. Checkpoint - Ensure preprocessing tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement OCR extraction module
  - [x] 4.1 Create OCR engine with EasyOCR and Tesseract fallback
    - Implement EasyOCR text extraction function
    - Implement Tesseract OCR fallback function
    - Create confidence scoring mechanism for extracted text
    - Implement retry logic with fallback chain
    - _Requirements: 2.1, 2.4, 6.1_

  - [x] 4.2 Build price and timestamp extraction logic
    - Write function to parse OHLC numerical values from OCR results
    - Write function to extract dates and timestamps
    - Implement timeframe detection (1M, 5M, 1H, 4H, D1, etc.)
    - Create regex patterns for common timeframe formats
    - Implement timeframe inference from timestamp intervals
    - _Requirements: 2.2, 2.3, 2.6_

  - [-] 4.3 Implement minimum data point validation
    - Create validation function to check for at least 10 extracted data points
    - Implement error response for insufficient data scenarios
    - _Requirements: 2.5_

  - [ ]* 4.4 Write property test for OCR extraction
    - **Property 6: OCR Extraction Execution**
    - **Validates: Requirements 2.1**
    - Test that OCR engine attempts extraction for any valid chart image
    - Test confidence scoring across various image qualities

  - [ ]* 4.5 Write unit tests for OCR module
    - Test price extraction with various number formats
    - Test timestamp parsing with different date formats
    - Test timeframe detection with standard patterns
    - Test fallback mechanism when EasyOCR fails
    - Test minimum data point validation
    - _Requirements: 2.1, 2.2, 2.3, 2.5_

- [ ] 5. Implement candlestick pattern analyzer
  - [-] 5.1 Create visual pattern detection module
    - Implement HSV color space conversion for candle color detection
    - Write function to identify red (bearish) vs green (bullish) candles
    - Create body boundary detection using geometry analysis
    - Create wick boundary detection (upper and lower wicks)
    - Implement OHLC calculation from geometric positions
    - Add visual confidence scoring for pattern quality
    - _Requirements: 2.1, 2.2_

  - [-] 5.2 Build price scale mapping
    - Create function to establish price scale from OCR labels
    - Implement pixel-to-price conversion logic
    - Write function to scale visual OHLC data to actual prices
    - _Requirements: 2.2_

  - [ ]* 5.3 Write unit tests for pattern analyzer
    - Test candle color detection with various chart styles
    - Test OHLC geometry extraction accuracy
    - Test price scale mapping with different axis configurations
    - _Requirements: 2.2_

- [ ] 6. Implement data merging and validation
  - [~] 6.1 Create OCR and visual data merger
    - Write function to merge OCR-extracted values with visual patterns
    - Implement confidence-based data selection logic (OCR >80%, visual <70%, average 70-80%)
    - Create timestamp assignment from date labels
    - Build cross-validation mechanism for OCR vs visual discrepancies
    - Implement low-confidence flagging for unreliable data points
    - _Requirements: 2.4, 5.7_

  - [~] 6.2 Build OHLC dataset construction
    - Create OHLCDataPoint data class with timestamp, OHLC values, volume, and confidence
    - Implement function to construct ordered OHLC dataset from merged data
    - Add dataset validation and sorting by timestamp
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ]* 6.3 Write property test for data merging
    - **Property 8: Timestamp Extraction**
    - **Validates: Requirements 2.3**
    - Test that timestamps are extracted for any chart with date/time information

  - [ ]* 6.4 Write unit tests for data merging
    - Test merge logic with various confidence score combinations
    - Test timestamp assignment accuracy
    - Test low-confidence flagging thresholds
    - _Requirements: 2.4_

- [~] 7. Checkpoint - Ensure data extraction pipeline works end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement feature engineering integration
  - [~] 8.1 Create feature engineering module interface
    - Implement function to convert OHLC dataset to pandas DataFrame
    - Create volume availability checker (≥80% non-zero values)
    - Build wrapper function to call existing indicator calculation logic
    - Implement validation to ensure all 37 indicators are returned
    - _Requirements: 3.1, 3.5, 3.6_

  - [~] 8.2 Implement indicator calculation with volume handling
    - Integrate existing technical indicator calculation functions
    - Implement trend indicators: SMA (5,10,20,50,200), EMA (12,26), MACD, Parabolic SAR
    - Implement momentum indicators: RSI, Stochastic, CCI, Williams %R, ROC
    - Implement volatility indicators: Bollinger Bands, ATR, Standard Deviation, Keltner Channels
    - Implement volume indicators with conditional logic (OBV, Volume SMA, A/D Line, Chaikin MF, VWAP, Force Index)
    - Add default value handling (zero) for insufficient data scenarios
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [ ]* 8.3 Write property test for indicator completeness
    - **Property 13: Complete Indicator Calculation**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
    - Test that all 37 indicators are calculated for any valid OHLC dataset

  - [ ]* 8.4 Write property test for volume-conditional calculation
    - **Property 14: Volume-Conditional Indicator Calculation**
    - **Validates: Requirements 3.5, 3.6**
    - Test that volume indicators are calculated when volume is available
    - Test that price-only indicators work when volume is unavailable

  - [ ]* 8.5 Write unit tests for feature engineering
    - Test indicator calculation with complete OHLC data
    - Test volume availability detection logic
    - Test default value handling for insufficient data
    - Test pandas DataFrame conversion
    - _Requirements: 3.1, 3.5, 3.6, 3.7_

- [ ] 9. Implement XGBoost model integration
  - [~] 9.1 Create model loading and caching system
    - Implement singleton model cache class
    - Create function to load pretrained XGBoost model from file
    - Add error handling for missing or corrupted model files
    - _Requirements: 4.1, 7.4, 6.3_

  - [~] 9.2 Build prediction interface
    - Create function to format 37 indicators for model input
    - Implement prediction generation (direction and confidence)
    - Add direction mapping (model output to up/down/neutral)
    - Implement confidence score conversion to percentage (0-100%)
    - _Requirements: 4.2, 4.5, 4.6_

  - [ ]* 9.3 Write property test for model integration
    - **Property 16: Model Integration**
    - **Validates: Requirements 4.1**
    - Test that indicator values are passed to XGBoost model for any complete feature extraction

  - [ ]* 9.4 Write property test for prediction structure
    - **Property 17: Prediction Result Structure**
    - **Validates: Requirements 4.2, 4.4, 4.5, 4.6**
    - Test that prediction results contain direction, confidence (0-100), and all 37 indicators

  - [ ]* 9.5 Write unit tests for model integration
    - Test model loading and caching
    - Test prediction generation with sample indicator data
    - Test direction mapping accuracy
    - Test confidence score range validation
    - _Requirements: 4.1, 4.2, 4.5, 4.6_

- [ ] 10. Implement API endpoint and error handling
  - [~] 10.1 Create main analysis pipeline orchestrator
    - Write main `analyze_chart_image` function that orchestrates all steps
    - Implement validation → preprocessing → OCR → visual analysis → merging → feature extraction → prediction flow
    - Add timeout enforcement (30 seconds)
    - Implement resource cleanup after processing
    - _Requirements: 4.3, 8.3_

  - [~] 10.2 Build comprehensive error handling
    - Create custom exception classes for each error type
    - Implement error response formatting function
    - Add error logging with detailed context
    - Create user-friendly error messages with actionable suggestions
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [~] 10.3 Implement POST /api/analyze-chart endpoint
    - Create FastAPI route handler for image upload
    - Implement multipart/form-data parsing
    - Add request validation and error handling
    - Build JSON response formatting (success, prediction, indicators, metadata)
    - Implement authentication integration (if enabled in existing system)
    - _Requirements: 7.1, 7.2, 7.3, 7.5, 7.6_

  - [ ]* 10.4 Write property test for error handling
    - **Property 18: Error Response Format**
    - **Validates: Requirements 4.7**
    - Test that errors return descriptive messages for any failure scenario

  - [ ]* 10.5 Write property test for API response format
    - **Property 29: JSON Response Format**
    - **Validates: Requirements 7.3**
    - Test that all completed analyses return valid JSON format

  - [ ]* 10.6 Write integration tests for API endpoint
    - Test end-to-end flow with valid chart images
    - Test error responses for invalid formats
    - Test timeout handling with slow processing
    - Test authentication enforcement (if enabled)
    - Test response schema validation
    - _Requirements: 7.1, 7.2, 7.3, 7.5, 7.6_

- [ ] 11. Implement performance optimizations
  - [~] 11.1 Add concurrent processing support
    - Implement asyncio support for parallel OCR and visual processing
    - Create async versions of extraction functions
    - Add semaphore-based request queuing (max 10 concurrent)
    - Implement request timeout management
    - _Requirements: 8.1, 8.2_

  - [~] 11.2 Optimize processing pipeline
    - Add image optimization before processing
    - Implement memory cleanup after analysis
    - Add processing time tracking for monitoring
    - _Requirements: 8.3, 8.4, 8.5_

  - [ ]* 11.3 Write performance tests
    - Test concurrent request handling (10 simultaneous)
    - Test processing time under normal load (<30 seconds)
    - Test OCR extraction time (<15 seconds)
    - Test feature calculation time (<5 seconds)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [~] 12. Checkpoint - Ensure backend service is fully functional
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Implement frontend chart upload component
  - [~] 13.1 Create ChartUploadComponent in React
    - Set up component structure with TypeScript
    - Integrate react-dropzone for drag-and-drop functionality
    - Implement file selection via click and drag-drop
    - Add accepted file types configuration (PNG, JPG, JPEG)
    - _Requirements: 1.1_

  - [~] 13.2 Build file validation in upload component
    - Implement MIME type validation in frontend
    - Add file size validation (max 10MB)
    - Create error state management
    - Display validation error messages
    - _Requirements: 1.1, 1.2, 6.5_

  - [~] 13.3 Implement image preview functionality
    - Create FileReader integration for preview generation
    - Add preview image display with proper styling
    - Implement preview URL state management
    - _Requirements: 1.3_

  - [~] 13.4 Build upload submission logic
    - Create FormData construction from selected file
    - Implement fetch API call to /api/analyze-chart endpoint
    - Add loading state management during analysis
    - Display loading spinner with status message
    - Handle successful and error responses
    - _Requirements: 1.4, 1.5_

  - [ ]* 13.5 Write property test for upload component
    - **Property 3: Preview Display**
    - **Validates: Requirements 1.3**
    - Test that preview displays for any valid image file selected

  - [ ]* 13.6 Write unit tests for upload component
    - Test file validation logic
    - Test drag-drop functionality
    - Test preview generation
    - Test loading state transitions
    - Test error message display
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 14. Implement frontend analysis display component
  - [~] 14.1 Create AnalysisDisplayComponent in React
    - Set up component structure with TypeScript interfaces
    - Create PredictionResult and metadata type definitions
    - Implement props interface for result and chart image URL
    - _Requirements: 5.1, 5.2, 5.3_

  - [~] 14.2 Build prediction summary section
    - Create direction badge display (up/down/neutral) with styling
    - Implement confidence score formatting as percentage
    - Display metadata (timeframe, data points, processing time)
    - _Requirements: 5.1, 5.2_

  - [~] 14.3 Implement chart image display
    - Add uploaded chart image preview section
    - Ensure responsive image sizing
    - Position image alongside prediction results
    - _Requirements: 5.5_

  - [~] 14.4 Build technical indicators display
    - Create indicator grouping logic (trend, momentum, volatility, volume)
    - Implement indicator grid layout for each category
    - Format indicator names (snake_case to Title Case)
    - Display indicator values with proper decimal formatting
    - Add low-confidence visual markers (warning icons)
    - Apply consistent styling with existing prediction page
    - _Requirements: 5.3, 5.4, 5.6, 5.7_

  - [ ]* 14.5 Write property test for analysis display
    - **Property 21: Complete Indicator Display**
    - **Validates: Requirements 5.3**
    - Test that all 37 indicators are rendered for any prediction result

  - [ ]* 14.6 Write property test for low-confidence marking
    - **Property 24: Low-Confidence Marking**
    - **Validates: Requirements 5.7**
    - Test that visual markers appear for any flagged low-confidence indicators

  - [ ]* 14.7 Write unit tests for analysis display
    - Test prediction summary rendering
    - Test indicator grouping logic
    - Test indicator name formatting
    - Test low-confidence indicator marking
    - Test chart image display
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [ ] 15. Implement API client integration
  - [~] 15.1 Create TypeScript API client module
    - Define ChartAnalysisRequest and ChartAnalysisResponse interfaces
    - Implement `analyzeChartImage` function with fetch API
    - Add multipart/form-data construction
    - Include credential handling for authentication
    - Add error handling and response parsing
    - _Requirements: 7.2, 7.3, 7.6_

  - [~] 15.2 Wire components together
    - Import and integrate ChartUploadComponent in main application
    - Connect upload component to analysis display component
    - Implement state management for analysis results
    - Add routing or modal logic for display component
    - _Requirements: 1.4, 5.1_

  - [ ]* 15.3 Write integration tests for frontend flow
    - Test upload → analysis → display flow with mocked API
    - Test error handling in UI
    - Test loading states during processing
    - _Requirements: 1.4, 1.5_

- [ ] 16. Implement security and monitoring
  - [~] 16.1 Add security measures
    - Implement rate limiting (10 requests/minute per IP)
    - Add authentication verification in API endpoint
    - Implement file signature verification for uploaded images
    - Add input sanitization for file paths
    - _Requirements: 7.6_

  - [~] 16.2 Add logging and monitoring
    - Implement structured logging for analysis attempts
    - Add success/failure logging with metrics
    - Log OCR confidence scores and data point counts
    - Track processing time and performance metrics
    - _Requirements: 8.1, 8.3_

  - [ ]* 16.3 Write security tests
    - Test rate limiting enforcement
    - Test authentication when enabled
    - Test file signature verification
    - _Requirements: 7.6_

- [ ] 17. Create deployment configuration
  - [~] 17.1 Finalize Dockerfile and dependencies
    - Review and optimize Dockerfile
    - Create requirements.txt with pinned versions
    - Add system dependencies for OpenCV and Tesseract
    - _Requirements: 8.1_

  - [~] 17.2 Create deployment documentation
    - Write README with setup instructions
    - Document environment variables and configuration
    - Add API endpoint documentation
    - Include sample curl commands for testing
    - _Requirements: 7.1, 7.2_

- [~] 18. Final checkpoint and end-to-end testing
  - Run complete end-to-end test with real chart images
  - Verify all 37 indicators are calculated correctly
  - Test error scenarios (invalid format, insufficient data, etc.)
  - Validate response schema compatibility with existing prediction API
  - Verify authentication integration (if applicable)
  - Test concurrent request handling
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Each task references specific requirements from the requirements document for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties defined in the design document
- Unit tests validate specific functionality and edge cases
- Integration tests verify end-to-end workflows
- The implementation reuses existing XGBoost model and feature engineering code without modification
- Backend runs as independent Python FastAPI service alongside existing Express API
- Frontend components integrate seamlessly with existing React application
- All 37 technical indicators must be calculated and returned in prediction results

## Task Dependency Graph

```json
{
  "waves": [
    {
      "id": 0,
      "tasks": ["1"]
    },
    {
      "id": 1,
      "tasks": ["2.1", "2.2"]
    },
    {
      "id": 2,
      "tasks": ["2.3", "4.1", "4.2"]
    },
    {
      "id": 3,
      "tasks": ["4.3", "4.4", "4.5", "5.1", "5.2"]
    },
    {
      "id": 4,
      "tasks": ["5.3", "6.1", "6.2"]
    },
    {
      "id": 5,
      "tasks": ["6.3", "6.4", "8.1", "8.2"]
    },
    {
      "id": 6,
      "tasks": ["8.3", "8.4", "8.5", "9.1", "9.2"]
    },
    {
      "id": 7,
      "tasks": ["9.3", "9.4", "9.5", "10.1", "10.2"]
    },
    {
      "id": 8,
      "tasks": ["10.3"]
    },
    {
      "id": 9,
      "tasks": ["10.4", "10.5", "10.6", "11.1", "11.2"]
    },
    {
      "id": 10,
      "tasks": ["11.3", "13.1"]
    },
    {
      "id": 11,
      "tasks": ["13.2", "13.3", "13.4"]
    },
    {
      "id": 12,
      "tasks": ["13.5", "13.6", "14.1", "14.2", "14.3", "14.4"]
    },
    {
      "id": 13,
      "tasks": ["14.5", "14.6", "14.7", "15.1"]
    },
    {
      "id": 14,
      "tasks": ["15.2"]
    },
    {
      "id": 15,
      "tasks": ["15.3", "16.1", "16.2"]
    },
    {
      "id": 16,
      "tasks": ["16.3", "17.1", "17.2"]
    }
  ]
}
```
