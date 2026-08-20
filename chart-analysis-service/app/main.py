"""
Chart Analysis Service - Main FastAPI Application

This service provides chart image analysis functionality by:
1. Accepting chart image uploads (PNG, JPG, JPEG)
2. Extracting OHLC data using OCR and visual pattern recognition
3. Calculating 37 technical indicators
4. Generating predictions using XGBoost model
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.logging_config import setup_logging

# Initialize logging
logger = logging.getLogger(__name__)


# Rate limiter
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager
    
    Handles startup and shutdown events:
    - Startup: Initialize models, logging
    - Shutdown: Cleanup resources
    """
    # Startup
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"Debug mode: {settings.DEBUG}")
    logger.info(f"Max concurrent requests: {settings.MAX_CONCURRENT_REQUESTS}")
    
    # TODO: Load XGBoost model here during startup
    # model = load_xgboost_model(settings.MODEL_PATH)
    
    yield
    
    # Shutdown
    logger.info(f"Shutting down {settings.APP_NAME}")


# Initialize FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Analyze financial chart images and generate technical analysis predictions",
    lifespan=lifespan
)

# Add rate limiter state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# Configure CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """
    Health check endpoint
    
    Returns:
        JSON with service status and version
    """
    logger.debug("Health check requested")
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION
    }


@app.get(f"{settings.API_PREFIX}/status")
async def status():
    """
    Detailed status endpoint
    
    Returns:
        JSON with detailed service information
    """
    return {
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "operational",
        "debug": settings.DEBUG,
        "max_concurrent_requests": settings.MAX_CONCURRENT_REQUESTS,
        "analysis_timeout": settings.ANALYSIS_TIMEOUT,
        "max_file_size_mb": settings.MAX_FILE_SIZE / (1024 * 1024)
    }


@app.post(f"{settings.API_PREFIX}/analyze-chart")
@limiter.limit("10/minute")
async def analyze_chart(
    request: Request,
    file: UploadFile = File(...)
):
    """
    Analyze chart image and return prediction
    
    Accepts multipart/form-data with image file and returns:
    - Prediction (direction, confidence)
    - 37 technical indicators
    - Metadata (timeframe, data points, processing time)
    
    Args:
        file: Uploaded image file (PNG, JPG, JPEG, max 10MB)
    
    Returns:
        JSON response with prediction results or error message
    
    Raises:
        HTTPException: For invalid input or processing errors
    """
    logger.info(f"Chart analysis requested: {file.filename}")
    
    # Validate file format
    if file.content_type not in settings.ALLOWED_MIME_TYPES:
        logger.warning(f"Invalid file format: {file.content_type}")
        raise HTTPException(
            status_code=400,
            detail={
                "success": False,
                "error": "Invalid image format. Please upload PNG, JPG, or JPEG files.",
                "error_code": "INVALID_FORMAT",
                "suggestions": ["Ensure file extension is .png, .jpg, or .jpeg"]
            }
        )
    
    # Validate file size
    file_content = await file.read()
    file_size = len(file_content)
    await file.seek(0)  # Reset file pointer
    
    if file_size > settings.MAX_FILE_SIZE:
        logger.warning(f"File size exceeded: {file_size} bytes")
        raise HTTPException(
            status_code=400,
            detail={
                "success": False,
                "error": "Image file too large. Maximum size is 10MB.",
                "error_code": "SIZE_EXCEEDED",
                "suggestions": [
                    "Compress image before uploading",
                    "Crop to chart area only"
                ]
            }
        )
    
    logger.info(f"File validated: {file.filename} ({file_size} bytes)")
    
    # TODO: Implement analysis pipeline
    # This will be implemented in subsequent tasks:
    # 1. Preprocess image
    # 2. Extract data via OCR
    # 3. Analyze visual patterns
    # 4. Calculate indicators
    # 5. Generate prediction
    
    # Placeholder response
    return {
        "success": True,
        "message": "Analysis endpoint is operational. Full pipeline to be implemented.",
        "received_file": file.filename,
        "file_size": file_size,
        "content_type": file.content_type
    }


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """
    Custom HTTP exception handler
    
    Provides consistent error response format
    """
    logger.error(f"HTTP error {exc.status_code}: {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.detail if isinstance(exc.detail, dict) else {"error": str(exc.detail)}
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """
    General exception handler for unexpected errors
    
    Logs full error details and returns user-friendly message
    """
    logger.error(f"Unexpected error: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "An unexpected error occurred. Please try again.",
            "error_code": "INTERNAL_ERROR",
            "suggestions": ["Contact support if problem persists"]
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower()
    )
