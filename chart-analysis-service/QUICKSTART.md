# Chart Analysis Service - Quick Start

## 🚀 30-Second Setup

```bash
cd chart-analysis-service
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Visit: http://localhost:8000/docs

## 📋 Essential Commands

### Setup
```bash
# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (macOS/Linux)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Run Service
```bash
# Development mode (auto-reload)
uvicorn app.main:app --reload --port 8000

# Production mode
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Docker
```bash
# Build
docker build -t chart-analysis-service .

# Run
docker run -p 8000:8000 chart-analysis-service

# Docker Compose
docker-compose up -d
```

### Testing
```bash
# Health check
curl http://localhost:8000/health

# Status
curl http://localhost:8000/api/status

# Upload test (when ready)
curl -X POST http://localhost:8000/api/analyze-chart \
  -F "file=@chart.png"
```

## 🔧 Configuration

Copy `.env.example` to `.env` and customize:
- `DEBUG`: Enable/disable debug mode
- `LOG_LEVEL`: Set logging level (DEBUG, INFO, WARNING, ERROR)
- `CORS_ORIGINS`: Frontend URLs (comma-separated)
- `MAX_CONCURRENT_REQUESTS`: Concurrent processing limit
- `ANALYSIS_TIMEOUT`: Request timeout in seconds

## 📡 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/status` | GET | Service status |
| `/api/analyze-chart` | POST | Analyze chart image |
| `/docs` | GET | Swagger UI |
| `/redoc` | GET | ReDoc UI |

## 🐛 Troubleshooting

**Port in use?**
```bash
uvicorn app.main:app --port 8001
```

**Module not found?**
```bash
pip install -r requirements.txt
```

**OpenCV errors?**
```bash
# Linux
sudo apt-get install libgl1-mesa-glx libglib2.0-0
```

## 📚 Documentation

- Full setup: `SETUP_GUIDE.md`
- Project info: `README.md`
- API docs: http://localhost:8000/docs

## 🔗 Integration

Frontend integration example:
```typescript
const formData = new FormData();
formData.append('file', imageFile);

const response = await fetch('http://localhost:8000/api/analyze-chart', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log(result);
```

---

**Need help?** Check `SETUP_GUIDE.md` or contact the dev team.
