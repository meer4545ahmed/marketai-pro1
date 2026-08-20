"""
Unit tests for image preprocessing module.

Tests cover:
- Image loading and validation
- Grayscale conversion
- CLAHE contrast enhancement
- Gaussian blur noise reduction
- Canny edge detection
- Candlestick region isolation
- Image downsampling optimization
- Complete preprocessing pipeline
"""

import pytest
import numpy as np
import cv2
from io import BytesIO
from PIL import Image
from app.preprocessing import ImagePreprocessor, PreprocessedImage, get_preprocessor


class TestImagePreprocessor:
    """Test suite for ImagePreprocessor class"""
    
    @pytest.fixture
    def preprocessor(self):
        """Create a preprocessor instance for testing"""
        return ImagePreprocessor(
            max_width=1600,
            clahe_clip_limit=2.0,
            clahe_tile_size=(8, 8),
            gaussian_kernel_size=(5, 5),
            canny_threshold1=50,
            canny_threshold2=150,
            min_contour_area=100
        )
    
    @pytest.fixture
    def sample_image_bytes(self):
        """Create sample PNG image bytes for testing"""
        # Create a simple test image with PIL
        img = Image.new('RGB', (800, 600), color='white')
        
        # Add some content (simple rectangles to simulate candlesticks)
        pixels = img.load()
        # Draw a few vertical rectangles
        for x in range(100, 120):
            for y in range(200, 400):
                pixels[x, y] = (0, 255, 0)  # Green
        
        for x in range(200, 220):
            for y in range(250, 450):
                pixels[x, y] = (255, 0, 0)  # Red
        
        # Convert to bytes
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        return buffer.getvalue()
    
    @pytest.fixture
    def large_image_bytes(self):
        """Create a large image for downsampling tests"""
        img = Image.new('RGB', (2000, 1500), color='blue')
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        return buffer.getvalue()
    
    @pytest.fixture
    def grayscale_image_bytes(self):
        """Create grayscale image bytes"""
        img = Image.new('L', (800, 600), color=128)
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        return buffer.getvalue()
    
    def test_load_image_valid(self, preprocessor, sample_image_bytes):
        """Test loading a valid image"""
        image = preprocessor.load_image(sample_image_bytes)
        
        assert isinstance(image, np.ndarray)
        assert len(image.shape) == 3  # BGR format
        assert image.shape[2] == 3  # 3 channels
        assert image.shape[0] == 600  # Height
        assert image.shape[1] == 800  # Width
    
    def test_load_image_invalid(self, preprocessor):
        """Test loading invalid image data"""
        invalid_bytes = b"not an image"
        
        with pytest.raises(ValueError, match="Failed to decode image"):
            preprocessor.load_image(invalid_bytes)
    
    def test_optimize_image_size_no_resize(self, preprocessor, sample_image_bytes):
        """Test that images smaller than max_width are not resized"""
        image = preprocessor.load_image(sample_image_bytes)
        original_shape = image.shape
        
        optimized = preprocessor.optimize_image_size(image)
        
        assert optimized.shape == original_shape
        assert np.array_equal(optimized, image)
    
    def test_optimize_image_size_with_resize(self, preprocessor, large_image_bytes):
        """Test that large images are downsampled correctly"""
        image = preprocessor.load_image(large_image_bytes)
        assert image.shape[1] == 2000  # Original width
        
        optimized = preprocessor.optimize_image_size(image)
        
        assert optimized.shape[1] == 1600  # Max width
        # Check aspect ratio maintained
        expected_height = int(1500 * (1600 / 2000))
        assert optimized.shape[0] == expected_height
    
    def test_convert_to_grayscale_color_image(self, preprocessor, sample_image_bytes):
        """Test grayscale conversion from color image"""
        image = preprocessor.load_image(sample_image_bytes)
        
        grayscale = preprocessor.convert_to_grayscale(image)
        
        assert isinstance(grayscale, np.ndarray)
        assert len(grayscale.shape) == 2  # 2D array
        assert grayscale.shape[0] == image.shape[0]  # Same height
        assert grayscale.shape[1] == image.shape[1]  # Same width
    
    def test_convert_to_grayscale_already_gray(self, preprocessor, grayscale_image_bytes):
        """Test grayscale conversion when image is already grayscale"""
        image = preprocessor.load_image(grayscale_image_bytes)
        grayscale_input = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        grayscale = preprocessor.convert_to_grayscale(grayscale_input)
        
        assert np.array_equal(grayscale, grayscale_input)
    
    def test_apply_clahe(self, preprocessor, sample_image_bytes):
        """Test CLAHE contrast enhancement"""
        image = preprocessor.load_image(sample_image_bytes)
        grayscale = preprocessor.convert_to_grayscale(image)
        
        enhanced = preprocessor.apply_clahe(grayscale)
        
        assert isinstance(enhanced, np.ndarray)
        assert enhanced.shape == grayscale.shape
        assert enhanced.dtype == grayscale.dtype
        # Enhanced image should have different values (contrast changed)
        assert not np.array_equal(enhanced, grayscale)
    
    def test_apply_gaussian_blur(self, preprocessor, sample_image_bytes):
        """Test Gaussian blur noise reduction"""
        image = preprocessor.load_image(sample_image_bytes)
        grayscale = preprocessor.convert_to_grayscale(image)
        
        blurred = preprocessor.apply_gaussian_blur(grayscale)
        
        assert isinstance(blurred, np.ndarray)
        assert blurred.shape == grayscale.shape
        # Blurred image should be smoother (different from original)
        assert not np.array_equal(blurred, grayscale)
    
    def test_detect_edges(self, preprocessor, sample_image_bytes):
        """Test Canny edge detection"""
        image = preprocessor.load_image(sample_image_bytes)
        grayscale = preprocessor.convert_to_grayscale(image)
        
        edges = preprocessor.detect_edges(grayscale)
        
        assert isinstance(edges, np.ndarray)
        assert edges.shape == grayscale.shape
        assert edges.dtype == np.uint8
        # Edge map should be binary (0 or 255)
        assert set(np.unique(edges)).issubset({0, 255})
        # Should detect some edges
        assert np.sum(edges > 0) > 0
    
    def test_isolate_candlestick_regions(self, preprocessor, sample_image_bytes):
        """Test candlestick region isolation"""
        image = preprocessor.load_image(sample_image_bytes)
        grayscale = preprocessor.convert_to_grayscale(image)
        enhanced = preprocessor.apply_clahe(grayscale)
        blurred = preprocessor.apply_gaussian_blur(enhanced)
        edges = preprocessor.detect_edges(blurred)
        
        regions = preprocessor.isolate_candlestick_regions(edges, image)
        
        assert isinstance(regions, list)
        # Each region should be a numpy array
        for region in regions:
            assert isinstance(region, np.ndarray)
    
    def test_filter_candlestick_contours_minimum_area(self, preprocessor):
        """Test that contours below minimum area are filtered out"""
        # Create a small image with tiny contours
        image = np.zeros((500, 500, 3), dtype=np.uint8)
        edges = np.zeros((500, 500), dtype=np.uint8)
        
        # Draw a very small contour
        cv2.rectangle(edges, (10, 10), (15, 15), 255, -1)
        
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        regions = preprocessor.filter_candlestick_contours(contours, image)
        
        # Should be filtered out due to small area
        assert len(regions) == 0
    
    def test_preprocess_complete_pipeline(self, preprocessor, sample_image_bytes):
        """Test complete preprocessing pipeline"""
        result = preprocessor.preprocess(sample_image_bytes)
        
        assert isinstance(result, PreprocessedImage)
        assert isinstance(result.original, np.ndarray)
        assert isinstance(result.grayscale, np.ndarray)
        assert isinstance(result.enhanced, np.ndarray)
        assert isinstance(result.edges, np.ndarray)
        assert isinstance(result.candlestick_regions, list)
        
        # Check dimensions are consistent
        height, width = result.grayscale.shape
        assert result.enhanced.shape == (height, width)
        assert result.edges.shape == (height, width)
    
    def test_preprocess_with_large_image(self, preprocessor, large_image_bytes):
        """Test preprocessing pipeline with large image requiring downsampling"""
        result = preprocessor.preprocess(large_image_bytes)
        
        # Image should be downsampled
        assert result.original.shape[1] == 1600
        assert isinstance(result, PreprocessedImage)
    
    def test_cleanup(self, preprocessor, sample_image_bytes):
        """Test memory cleanup after preprocessing"""
        result = preprocessor.preprocess(sample_image_bytes)
        
        # Store references to check they exist
        assert result.original is not None
        assert result.grayscale is not None
        
        # Cleanup should not raise errors
        preprocessor.cleanup(result)
    
    def test_get_preprocessor_singleton(self):
        """Test that get_preprocessor returns singleton instance"""
        preprocessor1 = get_preprocessor()
        preprocessor2 = get_preprocessor()
        
        assert preprocessor1 is preprocessor2
        assert isinstance(preprocessor1, ImagePreprocessor)
    
    def test_custom_parameters(self):
        """Test preprocessor initialization with custom parameters"""
        custom_preprocessor = ImagePreprocessor(
            max_width=1200,
            clahe_clip_limit=3.0,
            clahe_tile_size=(16, 16),
            gaussian_kernel_size=(7, 7),
            canny_threshold1=100,
            canny_threshold2=200,
            min_contour_area=200
        )
        
        assert custom_preprocessor.max_width == 1200
        assert custom_preprocessor.clahe_clip_limit == 3.0
        assert custom_preprocessor.clahe_tile_size == (16, 16)
        assert custom_preprocessor.gaussian_kernel_size == (7, 7)
        assert custom_preprocessor.canny_threshold1 == 100
        assert custom_preprocessor.canny_threshold2 == 200
        assert custom_preprocessor.min_contour_area == 200


class TestEdgeCases:
    """Test edge cases and error conditions"""
    
    @pytest.fixture
    def preprocessor(self):
        return ImagePreprocessor()
    
    def test_empty_bytes(self, preprocessor):
        """Test handling of empty byte array"""
        with pytest.raises(ValueError):
            preprocessor.load_image(b"")
    
    def test_corrupted_image_bytes(self, preprocessor):
        """Test handling of corrupted image data"""
        # Create partially valid PNG header but corrupted data
        corrupted = b'\x89PNG\r\n\x1a\n\x00\x00corrupted'
        
        with pytest.raises(ValueError):
            preprocessor.load_image(corrupted)
    
    def test_very_small_image(self, preprocessor):
        """Test preprocessing of very small image"""
        # Create 10x10 image
        img = Image.new('RGB', (10, 10), color='red')
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        image_bytes = buffer.getvalue()
        
        result = preprocessor.preprocess(image_bytes)
        
        # Should still process without errors
        assert isinstance(result, PreprocessedImage)
        assert result.grayscale.shape == (10, 10)
    
    def test_monochrome_image(self, preprocessor):
        """Test preprocessing of completely uniform image"""
        # Create solid color image
        img = Image.new('RGB', (800, 600), color='white')
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        image_bytes = buffer.getvalue()
        
        result = preprocessor.preprocess(image_bytes)
        
        # Should process but may not find edges
        assert isinstance(result, PreprocessedImage)
        # Uniform image should have few or no edges
        edge_pixels = np.sum(result.edges > 0)
        assert edge_pixels >= 0  # May be zero


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
