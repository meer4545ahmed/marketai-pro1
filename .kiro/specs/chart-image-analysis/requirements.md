# Requirements Document

## Introduction

The Chart Image Analysis feature enables users to upload financial chart images and receive automated technical analysis predictions. The system extracts Open-High-Low-Close (OHLC) data from chart images using Optical Character Recognition (OCR), calculates 37 technical indicators, and generates predictions using an existing XGBoost machine learning model. This feature extends the current prediction capabilities to support image-based input alongside existing data sources.

## Glossary

- **Chart_Analysis_Service**: A Python-based backend service responsible for processing chart images and generating predictions
- **OCR_Engine**: The optical character recognition component (Tesseract or EasyOCR) that extracts text and numerical data from images
- **OHLC_Data**: Open, High, Low, and Close price data extracted from chart images
- **Technical_Indicator**: A mathematical calculation derived from price and volume data (37 indicators total)
- **Feature_Extractor**: The component that calculates technical indicators from OHLC data
- **XGBoost_Model**: The existing trained machine learning model that generates predictions
- **Prediction_Result**: The output containing predicted direction, confidence score, and technical indicator values
- **Upload_Interface**: The user interface component for selecting and uploading chart images
- **Analysis_Display**: The user interface component that presents prediction results and technical indicators
- **Timeframe**: The duration represented by each candlestick or data point (e.g., 1 minute, 1 hour, 1 day)
- **Asset**: The financial instrument being analyzed (e.g., stocks, forex, cryptocurrency)

## Requirements

### Requirement 1: Chart Image Upload

**User Story:** As a trader, I want to upload chart images, so that I can receive technical analysis predictions without manual data entry

#### Acceptance Criteria

1. THE Upload_Interface SHALL accept image files in PNG, JPG, and JPEG formats
2. WHEN an image file exceeds 10MB in size, THE Upload_Interface SHALL reject the upload and display an error message
3. WHEN a user selects a valid image file, THE Upload_Interface SHALL display a preview of the selected image
4. WHEN a user submits an image for analysis, THE Upload_Interface SHALL send the image to the Chart_Analysis_Service
5. WHILE an image is being processed, THE Upload_Interface SHALL display a loading indicator

### Requirement 2: OCR Data Extraction

**User Story:** As a system, I want to extract OHLC data from chart images, so that technical indicators can be calculated

#### Acceptance Criteria

1. WHEN the Chart_Analysis_Service receives a chart image, THE OCR_Engine SHALL extract visible text and numerical values from the image
2. THE OCR_Engine SHALL identify and parse OHLC values for each visible candlestick or data point
3. THE OCR_Engine SHALL extract timestamp or date information associated with each data point
4. WHEN OCR extraction confidence falls below 70% for any data point, THE Chart_Analysis_Service SHALL flag the data point as low-confidence
5. IF the OCR_Engine cannot extract at least 10 data points, THEN THE Chart_Analysis_Service SHALL return an error indicating insufficient data
6. THE Chart_Analysis_Service SHALL support chart images containing any timeframe from 1 minute to 1 month
7. THE Chart_Analysis_Service SHALL support chart images for any asset type including stocks, forex, and cryptocurrency

### Requirement 3: Technical Indicator Calculation

**User Story:** As a system, I want to calculate 37 technical indicators from extracted OHLC data, so that the prediction model has sufficient input features

#### Acceptance Criteria

1. WHEN the Chart_Analysis_Service obtains valid OHLC data, THE Feature_Extractor SHALL calculate all 37 technical indicators
2. THE Feature_Extractor SHALL calculate moving averages including SMA and EMA with multiple periods
3. THE Feature_Extractor SHALL calculate momentum indicators including RSI, MACD, and Stochastic
4. THE Feature_Extractor SHALL calculate volatility indicators including Bollinger Bands and ATR
5. THE Feature_Extractor SHALL calculate volume-based indicators when volume data is available
6. WHEN volume data is not available in the chart image, THE Feature_Extractor SHALL calculate the 37 indicators using only price-based calculations
7. IF insufficient data points exist to calculate an indicator, THEN THE Feature_Extractor SHALL use the default value of zero for that indicator

### Requirement 4: Prediction Generation

**User Story:** As a trader, I want to receive prediction results from my chart image, so that I can make informed trading decisions

#### Acceptance Criteria

1. WHEN the Feature_Extractor completes indicator calculation, THE Chart_Analysis_Service SHALL pass the indicator values to the XGBoost_Model
2. THE XGBoost_Model SHALL generate a prediction containing direction (up, down, or neutral) and confidence score
3. THE Chart_Analysis_Service SHALL return the Prediction_Result within 30 seconds of receiving the chart image
4. THE Prediction_Result SHALL include all 37 calculated technical indicator values
5. THE Prediction_Result SHALL include the predicted direction as a categorical value
6. THE Prediction_Result SHALL include the confidence score as a percentage between 0% and 100%
7. IF an error occurs during prediction generation, THEN THE Chart_Analysis_Service SHALL return an error response with a descriptive message

### Requirement 5: Analysis Display

**User Story:** As a trader, I want to view prediction results in a format similar to the current prediction page, so that I can easily interpret the analysis

#### Acceptance Criteria

1. WHEN the Analysis_Display receives a Prediction_Result, THE Analysis_Display SHALL present the predicted direction prominently
2. THE Analysis_Display SHALL display the confidence score as a percentage
3. THE Analysis_Display SHALL display all 37 technical indicator values in a structured format
4. THE Analysis_Display SHALL use visual styling consistent with the existing prediction page
5. THE Analysis_Display SHALL display the uploaded chart image alongside the prediction results
6. THE Analysis_Display SHALL group technical indicators by category (trend, momentum, volatility, volume)
7. WHEN a technical indicator has a low-confidence flag, THE Analysis_Display SHALL visually mark the indicator as potentially unreliable

### Requirement 6: Error Handling

**User Story:** As a user, I want to receive clear error messages when analysis fails, so that I can understand what went wrong and take corrective action

#### Acceptance Criteria

1. WHEN the OCR_Engine fails to process an image, THE Chart_Analysis_Service SHALL return an error message indicating OCR failure
2. WHEN the uploaded image does not contain a recognizable chart, THE Chart_Analysis_Service SHALL return an error message indicating invalid chart format
3. WHEN the XGBoost_Model is unavailable, THE Chart_Analysis_Service SHALL return an error message indicating service unavailability
4. IF the Chart_Analysis_Service encounters an unexpected error, THEN THE Chart_Analysis_Service SHALL log the error details and return a generic error message to the user
5. THE Upload_Interface SHALL display error messages in a user-friendly format with actionable guidance

### Requirement 7: Service Integration

**User Story:** As a system architect, I want the Chart Analysis Service to integrate with existing infrastructure, so that the feature works seamlessly within the current application

#### Acceptance Criteria

1. THE Chart_Analysis_Service SHALL expose a RESTful API endpoint for image upload and analysis
2. THE Chart_Analysis_Service SHALL accept image data as multipart form-data in HTTP POST requests
3. THE Chart_Analysis_Service SHALL return prediction results as JSON responses
4. THE Chart_Analysis_Service SHALL use the existing XGBoost_Model without requiring model retraining
5. THE Chart_Analysis_Service SHALL maintain compatibility with the existing prediction result schema
6. WHERE the existing application uses authentication, THE Chart_Analysis_Service SHALL enforce the same authentication mechanism

### Requirement 8: Performance and Scalability

**User Story:** As a system operator, I want the service to handle multiple concurrent requests efficiently, so that users experience minimal wait times

#### Acceptance Criteria

1. THE Chart_Analysis_Service SHALL process at least 10 concurrent image analysis requests
2. WHEN system load exceeds capacity, THE Chart_Analysis_Service SHALL queue incoming requests
3. THE Chart_Analysis_Service SHALL process a single chart image analysis request within 30 seconds under normal load
4. THE OCR_Engine SHALL complete text extraction within 15 seconds for images up to 10MB
5. THE Feature_Extractor SHALL complete indicator calculation within 5 seconds for datasets up to 1000 data points
