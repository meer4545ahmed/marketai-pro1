#!/bin/bash
# Setup script for Chart Analysis Service (macOS/Linux)

echo "========================================"
echo "Chart Analysis Service Setup"
echo "========================================"
echo ""

echo "Creating virtual environment..."
python3 -m venv venv

echo ""
echo "Activating virtual environment..."
source venv/bin/activate

echo ""
echo "Installing dependencies..."
pip install -r requirements.txt

echo ""
echo "========================================"
echo "Setup complete!"
echo "========================================"
echo ""
echo "To start the service:"
echo "  1. Activate virtual environment: source venv/bin/activate"
echo "  2. Run the service: uvicorn app.main:app --reload --port 8000"
echo "  3. Access API docs: http://localhost:8000/docs"
echo ""
