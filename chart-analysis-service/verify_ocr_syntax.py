"""
Syntax verification for OCR module - checks imports without requiring dependencies.
"""

import ast
import sys

def verify_syntax(filepath):
    """Verify Python file has valid syntax"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            code = f.read()
        
        ast.parse(code)
        return True, None
    except SyntaxError as e:
        return False, str(e)

if __name__ == "__main__":
    print("=" * 60)
    print("OCR Module Syntax Verification")
    print("=" * 60)
    
    filepath = "app/ocr.py"
    
    print(f"\nChecking {filepath}...")
    success, error = verify_syntax(filepath)
    
    if success:
        print(f"✅ {filepath} has valid Python syntax")
        
        # Try to parse and check structure
        with open(filepath, 'r', encoding='utf-8') as f:
            tree = ast.parse(f.read())
        
        classes = [node.name for node in ast.walk(tree) if isinstance(node, ast.ClassDef)]
        functions = [node.name for node in ast.walk(tree) if isinstance(node, ast.FunctionDef)]
        
        print(f"\n📦 Found {len(classes)} classes:")
        for cls in classes:
            print(f"   - {cls}")
        
        print(f"\n🔧 Found {len(functions)} functions")
        
        # Check for required classes
        required_classes = [
            'OCRResult',
            'ExtractedPrice',
            'ExtractedTimestamp',
            'OCREngine',
            'PriceExtractor',
            'TimestampExtractor',
            'TimeframeDetector',
            'ChartOCRProcessor'
        ]
        
        print(f"\n✓ Checking required classes:")
        all_present = True
        for req_cls in required_classes:
            if req_cls in classes:
                print(f"   ✓ {req_cls}")
            else:
                print(f"   ❌ {req_cls} - MISSING!")
                all_present = False
        
        if all_present:
            print("\n" + "=" * 60)
            print("✅ OCR Module syntax verification PASSED!")
            print("=" * 60)
            sys.exit(0)
        else:
            print("\n" + "=" * 60)
            print("❌ Some required classes are missing")
            print("=" * 60)
            sys.exit(1)
    else:
        print(f"❌ Syntax error in {filepath}:")
        print(f"   {error}")
        print("\n" + "=" * 60)
        print("❌ OCR Module syntax verification FAILED")
        print("=" * 60)
        sys.exit(1)
