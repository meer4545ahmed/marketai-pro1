"""Logging configuration for Chart Analysis Service"""

import logging
import sys
from app.config import settings


def setup_logging():
    """
    Configure logging for the application
    
    Sets up:
    - Console handler with formatting
    - Log level from settings
    - Structured log format with timestamps
    """
    
    # Create logger
    logger = logging.getLogger()
    logger.setLevel(getattr(logging, settings.LOG_LEVEL.upper()))
    
    # Remove existing handlers
    logger.handlers.clear()
    
    # Create console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(getattr(logging, settings.LOG_LEVEL.upper()))
    
    # Create formatter
    formatter = logging.Formatter(
        settings.LOG_FORMAT,
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    console_handler.setFormatter(formatter)
    
    # Add handler to logger
    logger.addHandler(console_handler)
    
    # Set logging level for third-party libraries
    logging.getLogger("uvicorn").setLevel(logging.INFO)
    logging.getLogger("fastapi").setLevel(logging.INFO)
    
    return logger


def get_logger(name: str):
    """
    Get a logger instance for a specific module
    
    Args:
        name: The logger name (typically __name__ from the module)
        
    Returns:
        logging.Logger: Configured logger instance
    """
    return logging.getLogger(name)


# Initialize logging
app_logger = setup_logging()
