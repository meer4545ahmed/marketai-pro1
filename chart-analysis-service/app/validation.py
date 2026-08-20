"""
File Validation Module

Provides comprehensive validation for uploaded chart images including:
- MIME type validation (PNG, JPG, JPEG)
- File size validation (max 10MB)
- File signature verification (magic numbers) for security

Requirements: 1.1, 1.2, 6.5
"""

import logging
from typing import Tuple, Optional
from fastapi import UploadFile

from app.config import settings


logger = logging.getLogger(__name__)


# File signature magic numbers for security verification
# These are the first bytes of valid image files
MAGIC_NUMBERS = {
    "image/png": [
        b"\x89PNG\r\n\x1a\n",  # PNG signature
    ],
    "image/jpeg": [
        b"\xff\xd8\xff\xe0",  # JPEG with JFIF
        b"\xff\xd8\xff\xe1",  # JPEG with EXIF
        b"\xff\xd8\xff\xe2",  # JPEG with ICC
        b"\xff\xd8\xff\xe3",  # JPEG with SPIFF
        b"\xff\xd8\xff\xee",  # JPEG with Adobe
        b"\xff\xd8\xff\xdb",  # JPEG raw
    ],
}


class ValidationError(Exception):
    """Base exception for validation errors"""
    def __init__(self, message: str, error_code: str, suggestions: list):
        self.message = message
        self.error_code = error_code
        self.suggestions = suggestions
        super().__init__(self.message)


class InvalidImageFormatError(ValidationError):
    """Raised when image format is not PNG/JPG/JPEG"""
    def __init__(self, content_type: str):
        super().__init__(
            message=f"Invalid image format '{content_type}'. Please upload PNG, JPG, or JPEG files.",
            error_code="INVALID_FORMAT",
            suggestions=[
                "Ensure file extension is .png, .jpg, or .jpeg",
                "Convert your image to a supported format"
            ]
        )


class ImageSizeExceededError(ValidationError):
    """Raised when image exceeds 10MB limit"""
    def __init__(self, file_size: int, max_size: int):
        size_mb = file_size / (1024 * 1024)
        max_mb = max_size / (1024 * 1024)
        super().__init__(
            message=f"Image file too large ({size_mb:.2f}MB). Maximum size is {max_mb:.0f}MB.",
            error_code="SIZE_EXCEEDED",
            suggestions=[
                "Compress image before uploading",
                "Crop to chart area only",
                "Reduce image resolution"
            ]
        )


class InvalidFileSignatureError(ValidationError):
    """Raised when file signature doesn't match MIME type"""
    def __init__(self, expected_type: str):
        super().__init__(
            message=f"File signature does not match expected type '{expected_type}'. File may be corrupted or mislabeled.",
            error_code="INVALID_SIGNATURE",
            suggestions=[
                "Ensure file is not corrupted",
                "Verify file has correct extension",
                "Try re-saving or re-exporting the image"
            ]
        )


def validate_mime_type(content_type: str) -> Tuple[bool, Optional[str]]:
    """
    Validate that the uploaded file has an allowed MIME type.
    
    Checks against PNG, JPG, and JPEG MIME types as specified
    in requirements 1.1 and design section 6.1.
    
    Args:
        content_type: The MIME type from the uploaded file
        
    Returns:
        Tuple of (is_valid, error_message)
        - is_valid: True if MIME type is allowed, False otherwise
        - error_message: None if valid, error description if invalid
        
    Examples:
        >>> validate_mime_type("image/png")
        (True, None)
        >>> validate_mime_type("image/gif")
        (False, "Invalid MIME type 'image/gif'. Allowed types: image/png, image/jpeg")
    """
    if not content_type:
        error_msg = "No content type provided"
        logger.warning(error_msg)
        return False, error_msg
    
    # Normalize MIME type (lowercase, strip whitespace)
    normalized_type = content_type.lower().strip()
    
    if normalized_type in settings.ALLOWED_MIME_TYPES:
        logger.debug(f"MIME type validated: {normalized_type}")
        return True, None
    
    allowed_types = ", ".join(settings.ALLOWED_MIME_TYPES)
    error_msg = f"Invalid MIME type '{content_type}'. Allowed types: {allowed_types}"
    logger.warning(error_msg)
    return False, error_msg


def validate_file_size(file_size: int) -> Tuple[bool, Optional[str]]:
    """
    Validate that the uploaded file does not exceed maximum size limit.
    
    Enforces 10MB maximum size as specified in requirements 1.2
    and design section 6.1 to prevent resource exhaustion.
    
    Args:
        file_size: Size of the file in bytes
        
    Returns:
        Tuple of (is_valid, error_message)
        - is_valid: True if size is within limit, False otherwise
        - error_message: None if valid, error description if invalid
        
    Examples:
        >>> validate_file_size(5 * 1024 * 1024)  # 5MB
        (True, None)
        >>> validate_file_size(15 * 1024 * 1024)  # 15MB
        (False, "File size 15.00MB exceeds maximum allowed size of 10MB")
    """
    if file_size <= 0:
        error_msg = "File size must be greater than 0 bytes"
        logger.warning(error_msg)
        return False, error_msg
    
    max_size = settings.MAX_FILE_SIZE
    
    if file_size <= max_size:
        size_mb = file_size / (1024 * 1024)
        logger.debug(f"File size validated: {size_mb:.2f}MB")
        return True, None
    
    size_mb = file_size / (1024 * 1024)
    max_mb = max_size / (1024 * 1024)
    error_msg = f"File size {size_mb:.2f}MB exceeds maximum allowed size of {max_mb:.0f}MB"
    logger.warning(error_msg)
    return False, error_msg


def verify_file_signature(file_content: bytes, content_type: str) -> Tuple[bool, Optional[str]]:
    """
    Verify file signature (magic numbers) matches the declared MIME type.
    
    Provides security validation by checking the actual file header bytes
    against known signatures for PNG and JPEG formats. This prevents
    malicious files disguised with incorrect extensions or MIME types.
    
    As specified in design section 12.1 (Input Validation), this check
    verifies file signatures to detect potential security threats.
    
    Args:
        file_content: The first bytes of the file (at least 8 bytes)
        content_type: The declared MIME type
        
    Returns:
        Tuple of (is_valid, error_message)
        - is_valid: True if signature matches, False otherwise
        - error_message: None if valid, error description if invalid
        
    Examples:
        >>> png_bytes = b"\\x89PNG\\r\\n\\x1a\\n" + b"..."
        >>> verify_file_signature(png_bytes, "image/png")
        (True, None)
        >>> verify_file_signature(b"invalid", "image/png")
        (False, "File signature does not match MIME type 'image/png'")
    """
    if len(file_content) < 8:
        error_msg = f"File too small ({len(file_content)} bytes) for signature verification"
        logger.warning(error_msg)
        return False, error_msg
    
    # Normalize MIME type
    normalized_type = content_type.lower().strip()
    
    # Get expected signatures for this MIME type
    expected_signatures = MAGIC_NUMBERS.get(normalized_type)
    
    if not expected_signatures:
        error_msg = f"No signature verification available for MIME type '{content_type}'"
        logger.warning(error_msg)
        # Return True for unknown types - allow them through if MIME validation passed
        return True, None
    
    # Check if file content starts with any of the valid signatures
    for signature in expected_signatures:
        sig_len = len(signature)
        if file_content[:sig_len] == signature:
            logger.debug(f"File signature verified for {content_type}")
            return True, None
    
    # Log first 16 bytes for debugging (in hex)
    file_hex = file_content[:16].hex()
    error_msg = f"File signature does not match MIME type '{content_type}'. Found: {file_hex}"
    logger.warning(error_msg)
    return False, error_msg


async def validate_upload_file(file: UploadFile) -> Tuple[bytes, int]:
    """
    Perform comprehensive validation on uploaded file.
    
    Combines all validation checks:
    1. MIME type validation (requirement 1.1)
    2. File size validation (requirement 1.2)
    3. File signature verification (design section 12.1)
    
    This is the main validation function to be called by API endpoints.
    
    Args:
        file: FastAPI UploadFile object
        
    Returns:
        Tuple of (file_content, file_size) if all validations pass
        
    Raises:
        InvalidImageFormatError: If MIME type is not allowed
        ImageSizeExceededError: If file size exceeds limit
        InvalidFileSignatureError: If file signature doesn't match MIME type
        
    Example:
        >>> from fastapi import UploadFile
        >>> # In your endpoint:
        >>> try:
        >>>     content, size = await validate_upload_file(file)
        >>>     # Proceed with processing
        >>> except ValidationError as e:
        >>>     # Handle validation error
        >>>     raise HTTPException(status_code=400, detail=e.message)
    """
    logger.info(f"Validating upload: {file.filename} (content_type: {file.content_type})")
    
    # Step 1: Validate MIME type
    is_valid_mime, mime_error = validate_mime_type(file.content_type)
    if not is_valid_mime:
        logger.warning(f"MIME type validation failed for {file.filename}: {mime_error}")
        raise InvalidImageFormatError(file.content_type)
    
    # Step 2: Read file content and validate size
    file_content = await file.read()
    file_size = len(file_content)
    
    is_valid_size, size_error = validate_file_size(file_size)
    if not is_valid_size:
        logger.warning(f"File size validation failed for {file.filename}: {size_error}")
        raise ImageSizeExceededError(file_size, settings.MAX_FILE_SIZE)
    
    # Step 3: Verify file signature (magic numbers)
    is_valid_sig, sig_error = verify_file_signature(file_content, file.content_type)
    if not is_valid_sig:
        logger.warning(f"File signature verification failed for {file.filename}: {sig_error}")
        raise InvalidFileSignatureError(file.content_type)
    
    # Reset file pointer for potential downstream use
    await file.seek(0)
    
    size_mb = file_size / (1024 * 1024)
    logger.info(
        f"File validation successful: {file.filename} "
        f"({size_mb:.2f}MB, {file.content_type})"
    )
    
    return file_content, file_size


def format_validation_error_response(error: ValidationError) -> dict:
    """
    Convert validation exception to API error response format.
    
    Provides user-friendly error messages as specified in
    requirement 6.5 and design section 6.2.
    
    Args:
        error: ValidationError or subclass instance
        
    Returns:
        Dictionary formatted for JSON API response
        
    Example:
        >>> try:
        >>>     await validate_upload_file(file)
        >>> except ValidationError as e:
        >>>     return format_validation_error_response(e)
    """
    return {
        "success": False,
        "error": error.message,
        "error_code": error.error_code,
        "suggestions": error.suggestions
    }
