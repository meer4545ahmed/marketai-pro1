"""Configuration settings for Chart Analysis Service"""

import os
from typing import List


class Settings:
    """Application settings"""
    
    # Application
    APP_NAME: str = "Chart Analysis Service"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    
    # API
    API_PREFIX: str = "/api"
    
    # CORS
    CORS_ORIGINS: List[str] = os.getenv(
        "CORS_ORIGINS", 
        "http://localhost:3000,http://localhost:5173"
    ).split(",")
    
    # File Upload
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB in bytes
    ALLOWED_EXTENSIONS: List[str] = ["png", "jpg", "jpeg"]
    ALLOWED_MIME_TYPES: List[str] = ["image/png", "image/jpeg"]
    
    # Processing
    MAX_CONCURRENT_REQUESTS: int = int(os.getenv("MAX_CONCURRENT_REQUESTS", "10"))
    ANALYSIS_TIMEOUT: int = int(os.getenv("ANALYSIS_TIMEOUT", "30"))  # seconds
    MIN_DATA_POINTS: int = 10
    OCR_CONFIDENCE_THRESHOLD: float = 0.7
    
    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    LOG_FORMAT: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    
    # Model paths
    MODEL_PATH: str = os.getenv("MODEL_PATH", "models/xgboost_model.json")


settings = Settings()
