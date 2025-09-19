#!/usr/bin/env python3
"""
Quick test script to validate the AI Automation System structure
"""

import os
import sys
from pathlib import Path

def test_file_structure():
    """Test that all required files exist"""
    required_files = [
        'main.py',
        'config.yaml',
        'requirements.txt',
        'README.md',
        'deploy.sh',
        '.gitignore',
        'src/__init__.py',
        'src/core/__init__.py',
        'src/core/system_manager.py',
        'src/ai/__init__.py',
        'src/ai/call_routing.py',
        'src/ai/voice_recognition.py',
        'src/ai/fraud_detection.py',
        'src/ai/traffic_analysis.py',
        'src/network/__init__.py',
        'src/network/franklin_gateway.py',
        'src/network/security_monitor.py',
        'src/phone/__init__.py',
        'src/phone/sip_server.py',
        'src/api/__init__.py',
        'src/api/routes.py',
        'src/utils/__init__.py',
        'src/utils/database.py'
    ]
    
    missing_files = []
    for file_path in required_files:
        if not Path(file_path).exists():
            missing_files.append(file_path)
        else:
            print(f"✅ {file_path}")
    
    if missing_files:
        print(f"\n❌ Missing files: {missing_files}")
        return False
    
    print(f"\n✅ All {len(required_files)} required files present")
    return True

def test_python_syntax():
    """Test Python syntax of all Python files"""
    python_files = list(Path('.').rglob('*.py'))
    syntax_errors = []
    
    for py_file in python_files:
        try:
            with open(py_file, 'r') as f:
                compile(f.read(), py_file, 'exec')
            print(f"✅ {py_file}")
        except SyntaxError as e:
            syntax_errors.append((py_file, str(e)))
            print(f"❌ {py_file}: {e}")
    
    if syntax_errors:
        print(f"\n❌ Syntax errors in {len(syntax_errors)} files")
        return False
    
    print(f"\n✅ All {len(python_files)} Python files have valid syntax")
    return True

def test_configuration():
    """Test configuration file validity"""
    try:
        import yaml
        with open('config.yaml', 'r') as f:
            config = yaml.safe_load(f)
        
        required_sections = ['system', 'hardware', 'ai_models', 'network', 'phone_server', 'api', 'database']
        missing_sections = [section for section in required_sections if section not in config]
        
        if missing_sections:
            print(f"❌ Missing config sections: {missing_sections}")
            return False
        
        print("✅ Configuration file is valid")
        return True
        
    except Exception as e:
        print(f"❌ Configuration validation failed: {e}")
        return False

def test_directory_structure():
    """Test that required directories can be created"""
    required_dirs = ['logs', 'data', 'models', 'recordings']
    
    for dir_name in required_dirs:
        try:
            Path(dir_name).mkdir(exist_ok=True)
            print(f"✅ Directory {dir_name} ready")
        except Exception as e:
            print(f"❌ Failed to create {dir_name}: {e}")
            return False
    
    print("✅ All required directories ready")
    return True

def main():
    print("🔍 AI Automation System Structure Test")
    print("=" * 50)
    
    tests = [
        ("File Structure", test_file_structure),
        ("Python Syntax", test_python_syntax),
        ("Directory Structure", test_directory_structure),
    ]
    
    # Only test config if PyYAML is available
    try:
        import yaml
        tests.append(("Configuration", test_configuration))
    except ImportError:
        print("⚠️ PyYAML not available, skipping config test")
    
    results = []
    for test_name, test_func in tests:
        print(f"\n📋 Testing {test_name}:")
        results.append(test_func())
    
    print("\n" + "=" * 50)
    if all(results):
        print("🎉 All tests passed! System structure is valid.")
        print("\nNext steps:")
        print("1. Install dependencies: pip install -r requirements.txt")
        print("2. Run deployment script: ./deploy.sh")
        print("3. Start the system: python main.py")
        return 0
    else:
        print("❌ Some tests failed. Please fix the issues above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())