# Chart Analysis Service - Architecture Overview

## Service Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Chart Analysis Service                        │
│                      (Port 8000)                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │         FastAPI Application             │
        │         (app/main.py)                   │
        └─────────────────────────────────────────┘
                │                 │
                ▼                 ▼
    ┌──────────────────┐  ┌──────────────────┐
    │   Middleware     │  │    Endpoints     │
    ├──────────────────┤  ├──────────────────┤
    │ • CORS           │  │ GET /health      │
    │ • Rate Limiter   │  │ GET /api/status  │
    │ • Exception      │  │ POST /api/       │
    │   Handlers       │  │   analyze-chart  │
    └──────────────────┘  └──────────────────┘
```

## File Structure

```
chart-analysis-service/
│
├── app/                          # Main application package
│   ├── __init__.py              # Package initialization
│   ├── main.py                  # FastAPI app & endpoints
│   ├── config.py                # Settings & configuration
│   └── logging_config.py        # Logging setup
│
├── models/                       # ML model storage
│   └── .gitkeep                 # Directory placeholder
│
├── venv/                        # Virtual environment (created during setup)
│
├── .env                         # Environment variables (create from .env.example)
├── .env.example                 # Environment template
├── .dockerignore                # Docker build exclusions
├── .gitignore                   # Git exclusions
├── ARCHITECTURE.md              # This file
├── docker-compose.yml           # Docker Compose config
├── Dockerfile                   # Container definition
├── INTEGRATION_CHECKLIST.md    # Integration tracking
├── QUICKSTART.md               # Quick reference
├── README.md                    # Main documentation
├── requirements.txt             # Python dependencies
├── setup.bat                    # Windows setup script
├── setup.sh                     # Unix setup script
├── SETUP_GUIDE.md              # Detailed setup guide
└── verify_setup.py             # Installation verification
```

## Request Flow

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │ 1. POST /api/analyze-chart
       │    (multipart/form-data with image)
       ▼
┌─────────────────────────────────────┐
│      FastAPI Application            │
│  ┌───────────────────────────────┐  │
│  │  Rate Limiter Middleware      │  │
│  │  (10 requests/minute)         │  │
│  └───────────┬───────────────────┘  │
│              ▼                       │
│  ┌───────────────────────────────┐  │
│  │  CORS Middleware              │  │
│  │  (Check origin)               │  │
│  └───────────┬───────────────────┘  │
│              ▼                       │
│  ┌───────────────────────────────┐  │
│  │  Endpoint Handler             │  │
│  │  analyze_chart()              │  │
│  └───────────┬───────────────────┘  │
│              ▼                       │
│  ┌───────────────────────────────┐  │
│  │  File Validation              │  │
│  │  • Check MIME type            │  │
│  │  • Check file size (<10MB)    │  │
│  └───────────┬───────────────────┘  │
│              ▼                       │
│  ┌───────────────────────────────┐  │
│  │  Analysis Pipeline            │  │
│  │  (To be implemented)          │  │
│  │  • Preprocess image           │  │
│  │  • Extract OCR data           │  │
│  │  • Detect patterns            │  │
│  │  • Calculate indicators       │  │
│  │  • Generate prediction        │  │
│  └───────────┬───────────────────┘  │
│              ▼                       │
│  ┌───────────────────────────────┐  │
│  │  Response Formatter           │  │
│  │  (JSON with prediction)       │  │
│  └───────────┬───────────────────┘  │
└──────────────┼───────────────────────┘
               │ 2. JSON Response
               ▼
       ┌──────────────┐
       │   Client     │
       │  (Browser)   │
       └──────────────┘
```

## Component Responsibilities

### app/main.py
**Responsibilities:**
- Define FastAPI application
- Configure middleware (CORS, rate limiting)
- Implement API endpoints
- Handle HTTP requests/responses
- Orchestrate analysis pipeline
- Manage error handling

**Key Functions:**
- `lifespan()` - Startup/shutdown management
- `health_check()` - Health status endpoint
- `status()` - Detailed service status
- `analyze_chart()` - Main analysis endpoint
- `http_exception_handler()` - HTTP error handling
- `general_exception_handler()` - Unexpected error handling

### app/config.py
**Responsibilities:**
- Define configuration settings
- Load environment variables
- Provide default values
- Validate configuration

**Key Settings:**
- Application metadata (name, version)
- API configuration (prefix, endpoints)
- CORS origins
- File upload limits
- Processing parameters
- Logging configuration
- Model paths

### app/logging_config.py
**Responsibilities:**
- Configure logging system
- Set up console handlers
- Define log format
- Control log levels

**Features:**
- Timestamp formatting
- Structured log messages
- Third-party library logging
- Environment-based log levels

## API Endpoints

### GET /health
**Purpose:** Basic health check
**Response:**
```json
{
  "status": "healthy",
  "service": "Chart Analysis Service",
  "version": "1.0.0"
}
```

### GET /api/status
**Purpose:** Detailed service information
**Response:**
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

### POST /api/analyze-chart
**Purpose:** Analyze chart image
**Request:** multipart/form-data with `file` field
**Response:** (Implementation pending)
```json
{
  "success": true,
  "prediction": {
    "direction": "up",
    "confidence": 85.5
  },
  "indicators": { ... },
  "metadata": { ... }
}
```

## Configuration System

### Environment Variables
```
DEBUG               # Enable/disable debug mode
LOG_LEVEL           # Logging level (DEBUG, INFO, WARNING, ERROR)
CORS_ORIGINS        # Allowed origins (comma-separated)
MAX_CONCURRENT_REQUESTS  # Concurrent request limit
ANALYSIS_TIMEOUT    # Request timeout (seconds)
MODEL_PATH          # XGBoost model file path
```

### Defaults
- Port: 8000
- Max file size: 10MB
- Allowed formats: PNG, JPG, JPEG
- Rate limit: 10 requests/minute
- Concurrent requests: 10
- Analysis timeout: 30 seconds

## Middleware Stack

1. **CORS Middleware**
   - Allows cross-origin requests
   - Configured origins from environment
   - Supports credentials
   - Methods: GET, POST

2. **Rate Limiter**
   - 10 requests per minute per IP
   - Based on remote address
   - Returns 429 on limit exceeded
   - Per-endpoint configuration

3. **Exception Handlers**
   - HTTP exceptions (400, 404, 500, etc.)
   - General exceptions
   - Structured error responses
   - Logging integration

## Error Handling Strategy

### Error Types
1. **Validation Errors** (400)
   - Invalid file format
   - File size exceeded
   - Missing required fields

2. **Rate Limit Errors** (429)
   - Too many requests
   - Retry-after header

3. **Server Errors** (500)
   - Unexpected exceptions
   - Model loading failures
   - Processing timeouts

### Error Response Format
```json
{
  "success": false,
  "error": "User-friendly message",
  "error_code": "ERROR_TYPE",
  "suggestions": [
    "Actionable guidance 1",
    "Actionable guidance 2"
  ]
}
```

## Logging Strategy

### Log Levels
- **DEBUG**: Development troubleshooting
- **INFO**: Normal operations, request tracking
- **WARNING**: Recoverable issues
- **ERROR**: Request failures, exceptions

### Log Format
```
YYYY-MM-DD HH:MM:SS - module_name - LEVEL - message
```

### Logged Events
- Service startup/shutdown
- Request received (endpoint, file info)
- Validation failures
- Processing errors
- Performance metrics

## Security Measures

### Current (Task 1)
- ✅ File type validation (MIME type)
- ✅ File size limits (10MB)
- ✅ Rate limiting (10/min)
- ✅ CORS configuration
- ✅ Error message sanitization

### Planned (Future Tasks)
- [ ] Authentication/Authorization
- [ ] Input sanitization
- [ ] API key management
- [ ] Request signing
- [ ] Content scanning

## Performance Considerations

### Resource Management
- Concurrent request limiting (10)
- Request timeout (30s)
- File size limits (10MB)
- Rate limiting (10/min)

### Optimization Strategies (To Implement)
- Image downsampling
- Parallel OCR/visual processing
- Model caching
- Request queueing
- Memory cleanup

## Docker Configuration

### Dockerfile
- Base: Python 3.10-slim
- System dependencies: OpenCV, Tesseract
- Python dependencies: From requirements.txt
- Exposed port: 8000
- Command: uvicorn server

### docker-compose.yml
- Service definition
- Port mapping (8000:8000)
- Environment variables
- Volume mounting (models)
- Health check configuration
- Restart policy

## Integration Points

### Frontend Integration
- Accepts multipart form-data
- Returns JSON responses
- CORS enabled
- Error messages in UI-friendly format

### ML Pipeline Integration
- Model loading from file system
- Feature engineering module reuse
- XGBoost model compatibility
- Indicator calculation consistency

### Existing API Integration
- Runs alongside Express API
- Compatible response schemas
- Shared authentication (future)
- Same deployment infrastructure

## Next Implementation Phases

### Phase 2: OCR & Image Processing
- Image preprocessing module
- EasyOCR integration
- Tesseract fallback
- Pattern detection

### Phase 3: Feature Engineering
- Technical indicator calculation
- Volume handling
- Data validation
- Error handling

### Phase 4: Model Integration
- XGBoost model loading
- Prediction generation
- Result formatting
- Performance optimization

### Phase 5: Frontend
- React upload component
- Display component
- Error handling
- User feedback

### Phase 6: Testing
- Unit tests
- Integration tests
- Property-based tests
- Performance tests

## Monitoring & Observability

### Metrics to Track (Future)
- Request volume
- Success rate
- Processing time
- Error rates
- OCR confidence
- Model performance

### Logging Destinations
- Console (current)
- File (future)
- Centralized logging (future)
- APM tools (future)

---

**Status:** Infrastructure complete ✅  
**Next:** Implement OCR and image processing pipeline
