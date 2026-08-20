# Chart Analysis Service

A Python FastAPI microservice that analyzes financial chart images and generates technical analysis predictions using OCR, computer vision, and machine learning.

## Features

- **Image Processing**: Accepts PNG, JPG, JPEG chart images up to 10MB
- **OCR Extraction**: Extracts OHLC data using EasyOCR and Tesseract
- **Visual Analysis**: Detects candlestick patterns using OpenCV
- **Technical Indicators**: Calculates 37 technical indicators
- **ML Predictions**: Generates predictions using XGBoost model
- **RESTful API**: FastAPI-based endpoints with automatic documentation
- **Rate Limiting**: 10 requests per minute per IP
- **CORS Support**: Configured for frontend integration

## Project Structure

```
chart-analysis-service/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application and endpoints
│   ├── config.py            # Configuration settings
│   └── logging_config.py    # Logging configuration
├── Dockerfile               # Container configuration
├── .dockerignore
├── .gitignore
├── requirements.txt         # Python dependencies
└── README.md
```

## Setup

### Prerequisites

- Python 3.10 or higher
- pip or pipenv
- Tesseract OCR (for OCR fallback)

### Local Development

1. **Create virtual environment**:
   ```bash
   python -m venv venv
   ```

2. **Activate virtual environment**:
   - Windows:
     ```bash
     venv\Scripts\activate
     ```
   - macOS/Linux:
     ```bash
     source venv/bin/activate
     ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the service**:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

5. **Access API documentation**:
   - Swagger UI: http://localhost:8000/docs
   - ReDoc: http://localhost:8000/redoc

### Docker Deployment

1. **Build the image**:
   ```bash
   docker build -t chart-analysis-service .
   ```

2. **Run the container**:
   ```bash
   docker run -p 8000:8000 chart-analysis-service
   ```

3. **Run with environment variables**:
   ```bash
   docker run -p 8000:8000 \
     -e DEBUG=false \
     -e LOG_LEVEL=INFO \
     -e CORS_ORIGINS=http://localhost:3000 \
     chart-analysis-service
   ```

## API Endpoints

### Health Check
```
GET /health
```
Returns service health status.

**Response**:
```json
{
  "status": "healthy",
  "service": "Chart Analysis Service",
  "version": "1.0.0"
}
```

### Status
```
GET /api/status
```
Returns detailed service information.

**Response**:
```json
{
  "service": "Chart Analysis Service",
  "version": "1.0.0",
  "status": "operational",
  "debug": false,
  "max_concurrent_requests": 10,
  "analysis_timeout": 30,
  "max_file_size_mb": 10
}
```

### Analyze Chart
```
POST /api/analyze-chart
```
Analyzes a chart image and returns predictions.

**Request**: `multipart/form-data`
- `file`: Image file (PNG, JPG, JPEG, max 10MB)

**Response**:
```json
{
  "success": true,
  "prediction": {
    "direction": "up",
    "confidence": 85.5
  },
  "indicators": {
    "sma_5": 123.45,
    "rsi_14": 65.2,
    ...
  },
  "metadata": {
    "extracted_data_points": 50,
    "timeframe": "1H",
    "low_confidence_indicators": [],
    "processing_time_ms": 2500
  }
}
```

## Configuration

Environment variables can be set to configure the service:

| Variable | Default | Description |
|----------|---------|-------------|
| `DEBUG` | `False` | Enable debug mode |
| `LOG_LEVEL` | `INFO` | Logging level (DEBUG, INFO, WARNING, ERROR) |
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:5173` | Allowed CORS origins (comma-separated) |
| `MAX_CONCURRENT_REQUESTS` | `10` | Maximum concurrent analysis requests |
| `ANALYSIS_TIMEOUT` | `30` | Analysis timeout in seconds |
| `MODEL_PATH` | `models/xgboost_model.json` | Path to XGBoost model file |

## Development

### Adding New Features

1. Create new modules in the `app/` directory
2. Import and register in `app/main.py`
3. Update `requirements.txt` if adding dependencies
4. Add tests for new functionality

### Code Style

- Follow PEP 8 style guide
- Use type hints for function parameters and returns
- Document functions with docstrings
- Keep functions focused and single-purpose

## Testing

(Tests to be added in subsequent tasks)

```bash
pytest
```

## Troubleshooting

### Import Errors
Ensure virtual environment is activated and all dependencies are installed:
```bash
pip install -r requirements.txt
```

### CORS Issues
Check `CORS_ORIGINS` setting matches your frontend URL.

### File Upload Errors
- Verify file is PNG, JPG, or JPEG
- Check file size is under 10MB
- Ensure `python-multipart` is installed

## License

(Add license information)

## Support

For issues and questions, contact the development team.
