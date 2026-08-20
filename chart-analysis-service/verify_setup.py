"""
Verification script for Chart Analysis Service setup

Run this after installing dependencies to verify the setup is correct.
"""

import sys
import importlib.util


def check_module(module_name: str, package_name: str = None) -> bool:
    """Check if a Python module is installed"""
    try:
        spec = importlib.util.find_spec(module_name)
        if spec is not None:
            print(f"✓ {package_name or module_name} is installed")
            return True
        else:
            print(f"✗ {package_name or module_name} is NOT installed")
            return False
    except (ImportError, ModuleNotFoundError):
        print(f"✗ {package_name or module_name} is NOT installed")
        return False


def main():
    """Verify all required dependencies are installed"""
    print("=" * 50)
    print("Chart Analysis Service - Setup Verification")
    print("=" * 50)
    print()
    
    print(f"Python Version: {sys.version}")
    print()
    
    # Check Python version
    if sys.version_info < (3, 10):
        print("⚠ WARNING: Python 3.10+ is recommended")
        print(f"  Current version: {sys.version_info.major}.{sys.version_info.minor}")
        print()
    
    # Required modules
    required_modules = [
        ("fastapi", "FastAPI"),
        ("uvicorn", "Uvicorn"),
        ("pydantic", "Pydantic"),
        ("cv2", "OpenCV (opencv-python-headless)"),
        ("easyocr", "EasyOCR"),
        ("pytesseract", "PyTesseract"),
        ("numpy", "NumPy"),
        ("pandas", "Pandas"),
        ("xgboost", "XGBoost"),
        ("PIL", "Pillow"),
        ("slowapi", "SlowAPI"),
    ]
    
    print("Checking required dependencies:")
    print("-" * 50)
    
    all_installed = True
    for module_name, package_name in required_modules:
        if not check_module(module_name, package_name):
            all_installed = False
    
    print()
    print("=" * 50)
    
    if all_installed:
        print("✓ All dependencies are installed!")
        print()
        print("Next steps:")
        print("  1. Run the service: uvicorn app.main:app --reload --port 8000")
        print("  2. Access API docs: http://localhost:8000/docs")
        print("  3. Test health check: http://localhost:8000/health")
    else:
        print("✗ Some dependencies are missing")
        print()
        print("To install dependencies, run:")
        print("  pip install -r requirements.txt")
    
    print("=" * 50)
    
    return 0 if all_installed else 1


if __name__ == "__main__":
    sys.exit(main())
