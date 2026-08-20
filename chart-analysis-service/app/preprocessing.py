"""
Image preprocessing pipeline for chart analysis.

This module handles the preprocessing of chart images to prepare them for OCR
and pattern recognition. It includes grayscale conversion, contrast enhancement,
noise reduction, edge detection, and candlestick region isolation.
"""

import cv2
import numpy as np
from typing import List, Tuple
from dataclasses import dataclass
from app.logging_config import get_logger

logger = get_logger(__name__)


@dataclass
class PreprocessedImage:
    """Container for preprocessed image data at various stages"""
    original: np.ndarray
    grayscale: np.ndarray
    enhanced: np.ndarray
    candlestick_regions: List[np.ndarray]
    edges: np.ndarray


class ImagePreprocessor:
    """
    Preprocesses chart images for OCR and pattern recognition.
    
    The preprocessing pipeline includes:
    1. Image downsampling for optimization
    2. Grayscale conversion
    3. CLAHE contrast enhancement
    4. Gaussian blur for noise reduction
    5. Canny edge detection
    6. Candlestick region isolation via contour detection
    """
    
    def __init__(
        self,
        max_width: int = 1600,
        clahe_clip_limit: float = 2.0,
        clahe_tile_size: Tuple[int, int] = (8, 8),
        gaussian_kernel_size: Tuple[int, int] = (5, 5),
        gaussian_sigma: float = 0,
        canny_threshold1: int = 50,
        canny_threshold2: int = 150,
        min_contour_area: int = 100
    ):
        """
        Initialize the preprocessor with configurable parameters.
        
        Args:
            max_width: Maximum width for image downsampling (default: 1600px)
            clahe_clip_limit: Contrast limiting threshold for CLAHE (default: 2.0)
            clahe_tile_size: Grid size for CLAHE histogram equalization (default: 8x8)
            gaussian_kernel_size: Kernel size for Gaussian blur (default: 5x5)
            gaussian_sigma: Standard deviation for Gaussian blur (default: 0, auto-calculated)
            canny_threshold1: Lower threshold for Canny edge detection (default: 50)
            canny_threshold2: Upper threshold for Canny edge detection (default: 150)
            min_contour_area: Minimum area for valid contours in pixels (default: 100)
        """
        self.max_width = max_width
        self.clahe_clip_limit = clahe_clip_limit
        self.clahe_tile_size = clahe_tile_size
        self.gaussian_kernel_size = gaussian_kernel_size
        self.gaussian_sigma = gaussian_sigma
        self.canny_threshold1 = canny_threshold1
        self.canny_threshold2 = canny_threshold2
        self.min_contour_area = min_contour_area
        
        # Create CLAHE object for reuse
        self.clahe = cv2.createCLAHE(
            clipLimit=self.clahe_clip_limit,
            tileGridSize=self.clahe_tile_size
        )
        
        logger.info("ImagePreprocessor initialized with max_width=%d", max_width)
    
    def load_image(self, image_bytes: bytes) -> np.ndarray:
        """
        Load image from bytes into OpenCV format.
        
        Args:
            image_bytes: Raw image data as bytes
            
        Returns:
            np.ndarray: Image in BGR format (OpenCV default)
            
        Raises:
            ValueError: If image cannot be decoded
        """
        # Convert bytes to numpy array
        nparr = np.frombuffer(image_bytes, np.uint8)
        
        # Decode image
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            raise ValueError("Failed to decode image. Invalid image data.")
        
        logger.info("Image loaded: shape=%s, dtype=%s", image.shape, image.dtype)
        return image
    
    def optimize_image_size(self, image: np.ndarray) -> np.ndarray:
        """
        Downsample large images while preserving chart details.
        
        Resizes images wider than max_width to max_width while maintaining
        aspect ratio. Uses high-quality Lanczos interpolation.
        
        Args:
            image: Input image array
            
        Returns:
            np.ndarray: Optimized image (resized if necessary)
        """
        height, width = image.shape[:2]
        
        if width <= self.max_width:
            logger.debug("Image width %d <= max_width %d, no resizing needed", width, self.max_width)
            return image
        
        # Calculate new dimensions maintaining aspect ratio
        scale = self.max_width / width
        new_width = self.max_width
        new_height = int(height * scale)
        new_dims = (new_width, new_height)
        
        # Resize with high-quality interpolation
        resized = cv2.resize(image, new_dims, interpolation=cv2.INTER_LANCZOS4)
        
        logger.info("Image resized from %dx%d to %dx%d (scale=%.2f)", 
                   width, height, new_width, new_height, scale)
        
        return resized
    
    def convert_to_grayscale(self, image: np.ndarray) -> np.ndarray:
        """
        Convert BGR image to grayscale.
        
        Args:
            image: Input image in BGR format
            
        Returns:
            np.ndarray: Grayscale image
        """
        if len(image.shape) == 2:
            # Already grayscale
            logger.debug("Image is already grayscale")
            return image
        
        grayscale = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        logger.debug("Converted to grayscale: shape=%s", grayscale.shape)
        return grayscale
    
    def apply_clahe(self, grayscale: np.ndarray) -> np.ndarray:
        """
        Apply Contrast Limited Adaptive Histogram Equalization (CLAHE).
        
        CLAHE enhances local contrast in the image, making text and patterns
        more visible while preventing over-amplification of noise.
        
        Args:
            grayscale: Input grayscale image
            
        Returns:
            np.ndarray: Contrast-enhanced image
        """
        enhanced = self.clahe.apply(grayscale)
        logger.debug("Applied CLAHE contrast enhancement")
        return enhanced
    
    def apply_gaussian_blur(self, image: np.ndarray) -> np.ndarray:
        """
        Apply Gaussian blur for noise reduction.
        
        Smooths the image to reduce noise while preserving edges.
        
        Args:
            image: Input image
            
        Returns:
            np.ndarray: Blurred image
        """
        blurred = cv2.GaussianBlur(
            image,
            self.gaussian_kernel_size,
            self.gaussian_sigma
        )
        logger.debug("Applied Gaussian blur with kernel=%s", self.gaussian_kernel_size)
        return blurred
    
    def detect_edges(self, image: np.ndarray) -> np.ndarray:
        """
        Detect edges using Canny edge detection.
        
        Args:
            image: Input grayscale image
            
        Returns:
            np.ndarray: Binary edge map
        """
        edges = cv2.Canny(
            image,
            threshold1=self.canny_threshold1,
            threshold2=self.canny_threshold2
        )
        logger.debug("Detected edges: %d edge pixels", np.sum(edges > 0))
        return edges
    
    def filter_candlestick_contours(
        self,
        contours: List[np.ndarray],
        image: np.ndarray
    ) -> List[np.ndarray]:
        """
        Filter contours to identify likely candlestick regions.
        
        Filters based on:
        - Minimum area threshold
        - Aspect ratio (vertical orientation)
        - Spatial distribution (regular spacing)
        
        Args:
            contours: List of detected contours
            image: Original image for extracting regions
            
        Returns:
            List[np.ndarray]: Filtered list of candlestick region images
        """
        candlestick_regions = []
        valid_contours = []
        
        image_height, image_width = image.shape[:2]
        
        for contour in contours:
            # Calculate contour properties
            area = cv2.contourArea(contour)
            
            # Filter by minimum area
            if area < self.min_contour_area:
                continue
            
            # Get bounding rectangle
            x, y, w, h = cv2.boundingRect(contour)
            
            # Filter by aspect ratio (candlesticks are typically vertical)
            # Allow aspect ratios between 0.1 and 2.0 (height/width)
            aspect_ratio = h / w if w > 0 else 0
            if aspect_ratio < 0.1 or aspect_ratio > 10.0:
                continue
            
            # Filter out contours that are too large (likely chart borders)
            if w > image_width * 0.8 or h > image_height * 0.8:
                continue
            
            # Filter out contours that are too small relative to image
            if w < image_width * 0.01 or h < image_height * 0.02:
                continue
            
            valid_contours.append((x, y, w, h))
        
        # Extract regions from original image
        for x, y, w, h in valid_contours:
            # Add small padding around region
            padding = 2
            x1 = max(0, x - padding)
            y1 = max(0, y - padding)
            x2 = min(image_width, x + w + padding)
            y2 = min(image_height, y + h + padding)
            
            region = image[y1:y2, x1:x2]
            candlestick_regions.append(region)
        
        logger.info("Filtered %d candlestick regions from %d contours",
                   len(candlestick_regions), len(contours))
        
        return candlestick_regions
    
    def isolate_candlestick_regions(
        self,
        edges: np.ndarray,
        original_image: np.ndarray
    ) -> List[np.ndarray]:
        """
        Isolate candlestick regions using contour detection.
        
        Args:
            edges: Binary edge map from Canny detection
            original_image: Original image for extracting regions
            
        Returns:
            List[np.ndarray]: List of isolated candlestick region images
        """
        # Find contours
        contours, hierarchy = cv2.findContours(
            edges,
            cv2.RETR_EXTERNAL,
            cv2.CHAIN_APPROX_SIMPLE
        )
        
        logger.debug("Found %d contours", len(contours))
        
        # Filter for candlestick-like regions
        candlestick_regions = self.filter_candlestick_contours(
            contours,
            original_image
        )
        
        return candlestick_regions
    
    def preprocess(self, image_bytes: bytes) -> PreprocessedImage:
        """
        Execute the complete preprocessing pipeline.
        
        Pipeline stages:
        1. Load image from bytes
        2. Optimize image size (downsample if needed)
        3. Convert to grayscale
        4. Apply CLAHE contrast enhancement
        5. Apply Gaussian blur for noise reduction
        6. Detect edges with Canny
        7. Isolate candlestick regions via contour detection
        
        Args:
            image_bytes: Raw image data as bytes
            
        Returns:
            PreprocessedImage: Container with all preprocessing results
            
        Raises:
            ValueError: If image loading or processing fails
        """
        logger.info("Starting image preprocessing pipeline")
        
        # Stage 1: Load image
        original = self.load_image(image_bytes)
        
        # Stage 2: Optimize size
        optimized = self.optimize_image_size(original)
        
        # Stage 3: Convert to grayscale
        grayscale = self.convert_to_grayscale(optimized)
        
        # Stage 4: Apply CLAHE
        enhanced = self.apply_clahe(grayscale)
        
        # Stage 5: Apply Gaussian blur
        denoised = self.apply_gaussian_blur(enhanced)
        
        # Stage 6: Detect edges
        edges = self.detect_edges(denoised)
        
        # Stage 7: Isolate candlestick regions
        candlestick_regions = self.isolate_candlestick_regions(edges, optimized)
        
        logger.info("Preprocessing pipeline completed successfully")
        
        return PreprocessedImage(
            original=optimized,  # Use optimized version as "original"
            grayscale=grayscale,
            enhanced=enhanced,
            candlestick_regions=candlestick_regions,
            edges=edges
        )
    
    def cleanup(self, preprocessed: PreprocessedImage) -> None:
        """
        Release memory from preprocessed images.
        
        Important for managing memory with large images or high request volume.
        
        Args:
            preprocessed: PreprocessedImage object to clean up
        """
        del preprocessed.original
        del preprocessed.grayscale
        del preprocessed.enhanced
        del preprocessed.candlestick_regions
        del preprocessed.edges
        
        import gc
        gc.collect()
        
        logger.debug("Preprocessed image memory released")


# Singleton instance for reuse across requests
_preprocessor_instance = None


def get_preprocessor() -> ImagePreprocessor:
    """
    Get or create singleton ImagePreprocessor instance.
    
    Returns:
        ImagePreprocessor: Shared preprocessor instance
    """
    global _preprocessor_instance
    
    if _preprocessor_instance is None:
        _preprocessor_instance = ImagePreprocessor()
        logger.info("Created new ImagePreprocessor singleton instance")
    
    return _preprocessor_instance
