# Chart Analysis Service - Setup Guide

## Overview

This guide will help you set up the Chart Analysis Service, a Python FastAPI microservice for analyzing financial chart images.

## Prerequisites

Before you begin, ensure you have the following installed:

1. **Python 3.10 or higher**
   - Download from [python.org](https://www.python.org/downloads/)
   - Verify installation: `python --version` or `python3 --version`

2. **pip** (Python package manager)
   - Usually comes with Python
   - Verify: `pip --version`

3. **Tesseract OCR** (optional, for OCR fallback)
   - Windows: Download installer from [GitHub](https://github.com/UB-Mannheim/tesseract/wiki)
   - macOS: `brew install tesseract`
   - Linux: `apt-get install tesseract-ocr`

## Quick Start

### Option 1: Automated Setup (Recommended)

**Windows:**
```bash
cd chart-analysis-service
setup.bat
```

**macOS/Linux:**
```bash
cd chart-analysis-service
chmod +x setup.sh
./setup.sh
```

### Option 2: Manual Setup

1. **Navigate to the service directory:**
   ```bash
   cd chart-analysis-service
   ```

2. **Create virtual environment:**
   ```bash
   # Windows
   python -m venv venv
   
   # macOS/Linux
   python3 -m venv venv
   ```

3. **Activate virtual environment:**
   ```bash
   # Windows
   venv\Scripts\activate
   
   # macOS/Linux
   source venv/bin/activate
   ```

4. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
   
   *Note: This may take several minutes as it installs OpenCV, EasyOCR, and other large packages.*

5. **Verify installation:**
   ```bash
   python verify_setup.py
   ```

## Running the Service

### Development Mode

```bash
# Ensure virtual environment is activated
uvicorn app.main:app --reload --port 8000
```

The service will be available at:
- API: http://localhost:8000
- Swagger Docs: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### Production Mode

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

## Docker Deployment

### Build and Run with Docker

```bash
# Build the image
docker build -t chart-analysis-service .

# Run the container
docker run -p 8000:8000 chart-analysis-service
```

### Using Docker Compose

```bash
# Start the service
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the service
docker-compose down
```

## Configuration

### Environment Variables

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Edit `.env` to customize settings:

```env
# Application
DEBUG=false
LOG_LEVEL=INFO

# CORS Origins (comma-separated)
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Processing
MAX_CONCURRENT_REQUESTS=10
ANALYSIS_TIMEOUT=30

# Model
MODEL_PATH=models/xgboost_model.json
```

## Testing the Service

### 1. Health Check

```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "Chart Analysis Service",
  "version": "1.0.0"
}
```

### 2. Status Endpoint

```bash
curl http://localhost:8000/api/status
```

### 3. Test File Upload (when pipeline is complete)

```bash
curl -X POST http://localhost:8000/api/analyze-chart \
  -F "file=@path/to/chart.png"
```

## Project Structure

```
chart-analysis-service/
├── app/
│   ├── __init__.py           # Package initialization
│   ├── main.py               # FastAPI application
│   ├── config.py             # Configuration settings
│   └── logging_config.py     # Logging setup
├── models/                   # XGBoost model files
│   └── .gitkeep
├── venv/                     # Virtual environment (created during setup)
├── .env                      # Environment variables (create from .env.example)
├── .env.example              # Example environment file
├── .dockerignore             # Docker ignore rules
├── .gitignore                # Git ignore rules
├── docker-compose.yml        # Docker Compose configuration
├── Dockerfile                # Docker image definition
├── README.md                 # Project documentation
├── requirements.txt          # Python dependencies
├── setup.bat                 # Windows setup script
├── setup.sh                  # macOS/Linux setup script
├── SETUP_GUIDE.md           # This file
└── verify_setup.py          # Setup verification script
```

## Troubleshooting

### Issue: "Python not found"

**Solution:** Ensure Python 3.10+ is installed and added to PATH.

```bash
# Windows: Add Python to PATH or use full path
C:\Python310\python.exe -m venv venv

# macOS/Linux: Use python3
python3 -m venv venv
```

### Issue: "Module not found" errors

**Solution:** Ensure virtual environment is activated and dependencies are installed.

```bash
# Activate venv
source venv/bin/activate  # macOS/Linux
venv\Scripts\activate     # Windows

# Reinstall dependencies
pip install -r requirements.txt
```

### Issue: OpenCV import errors

**Solution:** Install system dependencies.

**Linux:**
```bash
sudo apt-get install libgl1-mesa-glx libglib2.0-0
```

**macOS:** Usually works out of the box with pip installation.

**Windows:** Use `opencv-python-headless` (already in requirements.txt).

### Issue: EasyOCR download errors

**Solution:** EasyOCR downloads models on first use. Ensure internet connection and sufficient disk space (~1GB).

### Issue: Port 8000 already in use

**Solution:** Use a different port or stop the conflicting service.

```bash
# Use different port
uvicorn app.main:app --port 8001

# Find process using port 8000 (Windows)
netstat -ano | findstr :8000

# Find process using port 8000 (macOS/Linux)
lsof -i :8000
```

## Next Steps

After successful setup:

1. **Review the API documentation** at http://localhost:8000/docs
2. **Implement OCR and image processing** (Task 2)
3. **Add technical indicator calculation** (Task 3)
4. **Integrate XGBoost model** (Task 4)
5. **Create frontend integration** (Task 5)

## Support

For issues or questions:
- Check the troubleshooting section above
- Review the main README.md
- Contact the development team

## Additional Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [EasyOCR GitHub](https://github.com/JaidedAI/EasyOCR)
- [OpenCV Documentation](https://docs.opencv.org/)
- [XGBoost Documentation](https://xgboost.readthedocs.io/)
