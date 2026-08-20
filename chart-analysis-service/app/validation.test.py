"""
Unit Tests for File Validation Module

Tests cover:
- MIME type validation (requirement 1.1)
- File size validation (requirement 1.2)
- File signature verification (design section 12.1)
- Error handling (requirement 6.5)
"""

import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi import UploadFile
from io import BytesIO

from app.validation import (
    validate_mime_type,
    validate_file_size,
    verify_file_signature,
    validate_upload_file,
    format_validation_error_response,
    InvalidImageFormatError,
    ImageSizeExceededError,
    InvalidFileSignatureError,
    ValidationError,
)
from app.config import settings


class TestValidateMimeType:
    """Tests for MIME type validation"""
    
    def test_valid_png_mime_type(self):
        """Should accept image/png MIME type"""
        is_valid, error = validate_mime_type("image/png")
        assert is_valid is True
        assert error is None
    
    def test_valid_jpeg_mime_type(self):
        """Should accept image/jpeg MIME type"""
        is_valid, error = validate_mime_type("image/jpeg")
        assert is_valid is True
        assert error is None
    
    def test_case_insensitive_mime_type(self):
        """Should accept MIME types regardless of case"""
        is_valid, error = validate_mime_type("IMAGE/PNG")
        assert is_valid is True
        assert error is None
    
    def test_mime_type_with_whitespace(self):
        """Should handle MIME types with leading/trailing whitespace"""
        is_valid, error = validate_mime_type("  image/png  ")
        assert is_valid is True
        assert error is None
    
    def test_invalid_gif_mime_type(self):
        """Should reject image/gif MIME type"""
        is_valid, error = validate_mime_type("image/gif")
        assert is_valid is False
        assert error is not None
        assert "image/gif" in error
    
    def test_invalid_webp_mime_type(self):
        """Should reject image/webp MIME type"""
        is_valid, error = validate_mime_type("image/webp")
        assert is_valid is False
        assert error is not None
    
    def test_invalid_text_mime_type(self):
        """Should reject non-image MIME types"""
        is_valid, error = validate_mime_type("text/plain")
        assert is_valid is False
        assert error is not None
    
    def test_empty_mime_type(self):
        """Should reject empty MIME type"""
        is_valid, error = validate_mime_type("")
        assert is_valid is False
        assert error is not None
    
    def test_none_mime_type(self):
        """Should reject None MIME type"""
        is_valid, error = validate_mime_type(None)
        assert is_valid is False
        assert error is not None


class TestValidateFileSize:
    """Tests for file size validation"""
    
    def test_valid_small_file(self):
        """Should accept files smaller than 10MB"""
        file_size = 5 * 1024 * 1024  # 5MB
        is_valid, error = validate_file_size(file_size)
        assert is_valid is True
        assert error is None
    
    def test_valid_exact_limit(self):
        """Should accept file at exactly 10MB"""
        file_size = 10 * 1024 * 1024  # 10MB
        is_valid, error = validate_file_size(file_size)
        assert is_valid is True
        assert error is None
    
    def test_valid_tiny_file(self):
        """Should accept very small files"""
        file_size = 1024  # 1KB
        is_valid, error = validate_file_size(file_size)
        assert is_valid is True
        assert error is None
    
    def test_invalid_oversized_file(self):
        """Should reject files larger than 10MB"""
        file_size = 15 * 1024 * 1024  # 15MB
        is_valid, error = validate_file_size(file_size)
        assert is_valid is False
        assert error is not None
        assert "15" in error
        assert "10" in error
    
    def test_invalid_slightly_oversized_file(self):
        """Should reject file just over 10MB limit"""
        file_size = (10 * 1024 * 1024) + 1  # 10MB + 1 byte
        is_valid, error = validate_file_size(file_size)
        assert is_valid is False
        assert error is not None
    
    def test_invalid_zero_size(self):
        """Should reject files with zero size"""
        is_valid, error = validate_file_size(0)
        assert is_valid is False
        assert error is not None
    
    def test_invalid_negative_size(self):
        """Should reject negative file sizes"""
        is_valid, error = validate_file_size(-1000)
        assert is_valid is False
        assert error is not None


class TestVerifyFileSignature:
    """Tests for file signature verification"""
    
    def test_valid_png_signature(self):
        """Should accept valid PNG signature"""
        png_signature = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
        is_valid, error = verify_file_signature(png_signature, "image/png")
        assert is_valid is True
        assert error is None
    
    def test_valid_jpeg_jfif_signature(self):
        """Should accept valid JPEG JFIF signature"""
        jpeg_signature = b"\xff\xd8\xff\xe0" + b"\x00" * 100
        is_valid, error = verify_file_signature(jpeg_signature, "image/jpeg")
        assert is_valid is True
        assert error is None
    
    def test_valid_jpeg_exif_signature(self):
        """Should accept valid JPEG EXIF signature"""
        jpeg_signature = b"\xff\xd8\xff\xe1" + b"\x00" * 100
        is_valid, error = verify_file_signature(jpeg_signature, "image/jpeg")
        assert is_valid is True
        assert error is None
    
    def test_valid_jpeg_raw_signature(self):
        """Should accept valid JPEG raw signature"""
        jpeg_signature = b"\xff\xd8\xff\xdb" + b"\x00" * 100
        is_valid, error = verify_file_signature(jpeg_signature, "image/jpeg")
        assert is_valid is True
        assert error is None
    
    def test_invalid_png_signature(self):
        """Should reject invalid PNG signature"""
        invalid_signature = b"\x00\x00\x00\x00\x00\x00\x00\x00" + b"\x00" * 100
        is_valid, error = verify_file_signature(invalid_signature, "image/png")
        assert is_valid is False
        assert error is not None
    
    def test_invalid_jpeg_signature(self):
        """Should reject invalid JPEG signature"""
        invalid_signature = b"\x00\x00\x00\x00" + b"\x00" * 100
        is_valid, error = verify_file_signature(invalid_signature, "image/jpeg")
        assert is_valid is False
        assert error is not None
    
    def test_mismatched_signature(self):
        """Should reject PNG signature with JPEG MIME type"""
        png_signature = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
        is_valid, error = verify_file_signature(png_signature, "image/jpeg")
        assert is_valid is False
        assert error is not None
    
    def test_file_too_small(self):
        """Should reject files too small for signature verification"""
        tiny_content = b"\x89PN"  # Only 3 bytes
        is_valid, error = verify_file_signature(tiny_content, "image/png")
        assert is_valid is False
        assert error is not None
        assert "too small" in error.lower()
    
    def test_empty_file(self):
        """Should reject empty files"""
        is_valid, error = verify_file_signature(b"", "image/png")
        assert is_valid is False
        assert error is not None


class TestValidateUploadFile:
    """Tests for comprehensive file validation"""
    
    @pytest.mark.asyncio
    async def test_valid_png_file(self):
        """Should accept valid PNG file"""
        png_content = b"\x89PNG\r\n\x1a\n" + b"\x00" * 1000
        
        file = AsyncMock(spec=UploadFile)
        file.filename = "test.png"
        file.content_type = "image/png"
        file.read = AsyncMock(return_value=png_content)
        file.seek = AsyncMock()
        
        content, size = await validate_upload_file(file)
        
        assert content == png_content
        assert size == len(png_content)
        file.seek.assert_called_once_with(0)
    
    @pytest.mark.asyncio
    async def test_valid_jpeg_file(self):
        """Should accept valid JPEG file"""
        jpeg_content = b"\xff\xd8\xff\xe0" + b"\x00" * 1000
        
        file = AsyncMock(spec=UploadFile)
        file.filename = "test.jpg"
        file.content_type = "image/jpeg"
        file.read = AsyncMock(return_value=jpeg_content)
        file.seek = AsyncMock()
        
        content, size = await validate_upload_file(file)
        
        assert content == jpeg_content
        assert size == len(jpeg_content)
    
    @pytest.mark.asyncio
    async def test_invalid_mime_type(self):
        """Should reject file with invalid MIME type"""
        file = AsyncMock(spec=UploadFile)
        file.filename = "test.gif"
        file.content_type = "image/gif"
        
        with pytest.raises(InvalidImageFormatError) as exc_info:
            await validate_upload_file(file)
        
        assert "image/gif" in str(exc_info.value)
        assert exc_info.value.error_code == "INVALID_FORMAT"
    
    @pytest.mark.asyncio
    async def test_oversized_file(self):
        """Should reject file exceeding size limit"""
        large_content = b"\x89PNG\r\n\x1a\n" + b"\x00" * (15 * 1024 * 1024)
        
        file = AsyncMock(spec=UploadFile)
        file.filename = "large.png"
        file.content_type = "image/png"
        file.read = AsyncMock(return_value=large_content)
        
        with pytest.raises(ImageSizeExceededError) as exc_info:
            await validate_upload_file(file)
        
        assert exc_info.value.error_code == "SIZE_EXCEEDED"
        assert "15" in str(exc_info.value) or "MB" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_invalid_signature(self):
        """Should reject file with invalid signature"""
        invalid_content = b"\x00\x00\x00\x00" + b"\x00" * 1000
        
        file = AsyncMock(spec=UploadFile)
        file.filename = "fake.png"
        file.content_type = "image/png"
        file.read = AsyncMock(return_value=invalid_content)
        
        with pytest.raises(InvalidFileSignatureError) as exc_info:
            await validate_upload_file(file)
        
        assert exc_info.value.error_code == "INVALID_SIGNATURE"


class TestValidationErrors:
    """Tests for validation error classes"""
    
    def test_invalid_image_format_error(self):
        """Should create InvalidImageFormatError with correct attributes"""
        error = InvalidImageFormatError("image/gif")
        
        assert "image/gif" in error.message
        assert error.error_code == "INVALID_FORMAT"
        assert isinstance(error.suggestions, list)
        assert len(error.suggestions) > 0
    
    def test_image_size_exceeded_error(self):
        """Should create ImageSizeExceededError with correct attributes"""
        file_size = 15 * 1024 * 1024
        max_size = 10 * 1024 * 1024
        error = ImageSizeExceededError(file_size, max_size)
        
        assert "15" in error.message
        assert "10" in error.message
        assert error.error_code == "SIZE_EXCEEDED"
        assert isinstance(error.suggestions, list)
        assert len(error.suggestions) > 0
    
    def test_invalid_file_signature_error(self):
        """Should create InvalidFileSignatureError with correct attributes"""
        error = InvalidFileSignatureError("image/png")
        
        assert "image/png" in error.message
        assert error.error_code == "INVALID_SIGNATURE"
        assert isinstance(error.suggestions, list)
        assert len(error.suggestions) > 0


class TestFormatValidationErrorResponse:
    """Tests for error response formatting"""
    
    def test_format_invalid_format_error(self):
        """Should format InvalidImageFormatError correctly"""
        error = InvalidImageFormatError("image/gif")
        response = format_validation_error_response(error)
        
        assert response["success"] is False
        assert "error" in response
        assert "error_code" in response
        assert response["error_code"] == "INVALID_FORMAT"
        assert "suggestions" in response
        assert isinstance(response["suggestions"], list)
    
    def test_format_size_exceeded_error(self):
        """Should format ImageSizeExceededError correctly"""
        error = ImageSizeExceededError(15 * 1024 * 1024, 10 * 1024 * 1024)
        response = format_validation_error_response(error)
        
        assert response["success"] is False
        assert response["error_code"] == "SIZE_EXCEEDED"
        assert isinstance(response["suggestions"], list)
    
    def test_format_invalid_signature_error(self):
        """Should format InvalidFileSignatureError correctly"""
        error = InvalidFileSignatureError("image/png")
        response = format_validation_error_response(error)
        
        assert response["success"] is False
        assert response["error_code"] == "INVALID_SIGNATURE"
        assert isinstance(response["suggestions"], list)


class TestEdgeCases:
    """Tests for edge cases and boundary conditions"""
    
    @pytest.mark.asyncio
    async def test_file_exactly_at_size_limit(self):
        """Should accept file at exactly 10MB"""
        exact_size = 10 * 1024 * 1024
        content = b"\x89PNG\r\n\x1a\n" + b"\x00" * (exact_size - 8)
        
        file = AsyncMock(spec=UploadFile)
        file.filename = "exact.png"
        file.content_type = "image/png"
        file.read = AsyncMock(return_value=content)
        file.seek = AsyncMock()
        
        result_content, result_size = await validate_upload_file(file)
        
        assert result_size == exact_size
    
    @pytest.mark.asyncio
    async def test_file_one_byte_over_limit(self):
        """Should reject file just 1 byte over 10MB"""
        over_size = (10 * 1024 * 1024) + 1
        content = b"\x89PNG\r\n\x1a\n" + b"\x00" * (over_size - 8)
        
        file = AsyncMock(spec=UploadFile)
        file.filename = "over.png"
        file.content_type = "image/png"
        file.read = AsyncMock(return_value=content)
        
        with pytest.raises(ImageSizeExceededError):
            await validate_upload_file(file)
    
    def test_mime_type_with_charset(self):
        """Should handle MIME types with charset parameter"""
        # Note: This tests current behavior - may need adjustment
        is_valid, error = validate_mime_type("image/png; charset=utf-8")
        # Current implementation strips but doesn't handle parameters
        # This is expected to fail with current implementation
        assert is_valid is False
