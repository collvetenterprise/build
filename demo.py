#!/usr/bin/env python3
"""
Demo script showing the automation platform capabilities
"""

import sys
import time
import json
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from automation.config_manager import ConfigManager
from utils.database import DatabaseManager
from utils.logger import setup_logging
from monitoring.alerting import AlertManager


def demo_configuration():
    """Demonstrate configuration management"""
    print("=== Configuration Management Demo ===")
    
    try:
        config_manager = ConfigManager('config/main.yml')
        config = config_manager.load_config()
        
        print("✓ Configuration loaded successfully")
        print(f"✓ Monitoring enabled: {config['monitoring']['enabled']}")
        print(f"✓ AI features enabled: {config['ai']['enabled']}")
        print(f"✓ Web dashboard port: {config['monitoring']['web_dashboard']['port']}")
        
        devices = config.get('devices', {})
        for device_name, device_config in devices.items():
            status = "enabled" if device_config.get('enabled') else "disabled"
            print(f"✓ Device {device_name}: {status}")
        
    except Exception as e:
        print(f"✗ Configuration error: {e}")


def demo_database():
    """Demonstrate database operations"""
    print("\n=== Database Operations Demo ===")
    
    try:
        db = DatabaseManager('data/demo.db')
        print("✓ Database initialized")
        
        # Store sample device status
        sample_status = {
            "timestamp": time.time(),
            "online": True,
            "power_state": "On",
            "temperature": 45.2,
            "signal_strength": "85%"
        }
        
        db.store_device_status('demo_device', sample_status)
        print("✓ Device status stored")
        
        # Store sample alert
        db.store_alert("Demo Alert", "This is a demonstration alert", "info", "demo_device")
        print("✓ Alert stored")
        
        # Retrieve data
        history = db.get_device_status_history('demo_device', hours=1)
        alerts = db.get_recent_alerts(hours=1)
        stats = db.get_database_stats()
        
        print(f"✓ Retrieved {len(history)} status records")
        print(f"✓ Retrieved {len(alerts)} alerts")
        print(f"✓ Database size: {stats.get('database_size_mb', 0):.2f} MB")
        
    except Exception as e:
        print(f"✗ Database error: {e}")


def demo_alerting():
    """Demonstrate alerting system"""
    print("\n=== Alerting System Demo ===")
    
    try:
        # Note: Email/Slack disabled in demo config
        alert_config = {
            "email": {"enabled": False},
            "slack": {"enabled": False}
        }
        
        alert_manager = AlertManager(alert_config)
        print("✓ Alert manager initialized")
        
        # Send test alert (will only store in database)
        alert_manager.send_alert(
            "Demo System Alert",
            "This is a demonstration of the alerting system",
            "info",
            "demo_device"
        )
        print("✓ Demo alert sent (stored in database)")
        
        # Test alert channels (will show disabled status)
        test_results = alert_manager.test_alert_channels()
        print(f"✓ Alert channels tested: {test_results}")
        
    except Exception as e:
        print(f"✗ Alerting error: {e}")


def demo_ai_features():
    """Demonstrate AI capabilities"""
    print("\n=== AI Features Demo ===")
    
    try:
        # Import AI modules
        from ai.predictive_maintenance import PredictiveMaintenanceEngine
        from ai.anomaly_detection import AnomalyDetector
        
        ai_config = {
            "predictive_maintenance": {
                "enabled": True,
                "model_path": "ai/models/",
                "training_data_days": 30
            },
            "anomaly_detection": {
                "enabled": True,
                "sensitivity": 0.8
            }
        }
        
        # Initialize AI components
        predictive_engine = PredictiveMaintenanceEngine(ai_config)
        anomaly_detector = AnomalyDetector(ai_config)
        
        print("✓ AI components initialized")
        
        # Test predictive maintenance
        sample_server_status = {
            "thermal_metrics": {
                "temperatures": [{"reading_celsius": 65}],
                "fans": [{"reading_rpm": 2500}],
                "overall_status": "OK"
            },
            "power_metrics": {
                "power_consumption": {"power_consumed_watts": 350}
            },
            "storage_summary": {
                "total_drives": 4,
                "healthy_drives": 4
            }
        }
        
        prediction = predictive_engine.predict_failure('demo_server', sample_server_status)
        print(f"✓ Failure prediction: {prediction.get('failure_risk', 0):.2f} risk")
        print(f"✓ Recommendation: {prediction.get('recommendation', 'N/A')}")
        
        # Test anomaly detection
        sample_gateway_status = {
            "signal_strength": "85%",
            "connected_devices": 5,
            "temperature": 42.0
        }
        
        # Add some data points first
        for i in range(5):
            anomaly_detector.detect_anomaly('demo_gateway', sample_gateway_status)
        
        # Test with normal data
        is_anomaly = anomaly_detector.detect_anomaly('demo_gateway', sample_gateway_status)
        print(f"✓ Anomaly detection: {'Anomaly detected' if is_anomaly else 'Normal operation'}")
        
        # Get system info
        model_info = predictive_engine.get_model_info()
        anomaly_info = anomaly_detector.get_system_info()
        
        print(f"✓ ML models available: {model_info['sklearn_available']}")
        print(f"✓ Anomaly detection sensitivity: {anomaly_info['sensitivity']}")
        
    except Exception as e:
        print(f"✗ AI features error: {e}")


def demo_web_dashboard():
    """Demonstrate web dashboard features"""
    print("\n=== Web Dashboard Demo ===")
    
    try:
        from monitoring.dashboard import WebDashboard
        
        config = {
            "monitoring": {
                "web_dashboard": {
                    "enabled": True,
                    "host": "127.0.0.1",
                    "port": 5000,
                    "debug": False
                }
            },
            "devices": {
                "demo_device": {"enabled": True}
            }
        }
        
        dashboard = WebDashboard(config)
        print("✓ Web dashboard initialized")
        print("✓ Dashboard available at http://127.0.0.1:5000")
        print("✓ API endpoints configured:")
        print("  - GET /api/devices")
        print("  - GET /api/device/{name}/status")
        print("  - POST /api/device/{name}/action")
        print("  - GET /api/alerts")
        print("  - GET /api/stats")
        
        # Note: Not starting the server in demo mode
        print("✓ (Dashboard server not started in demo mode)")
        
    except Exception as e:
        print(f"✗ Web dashboard error: {e}")


def main():
    """Run all demos"""
    print("Enterprise Network Automation Platform - Demo")
    print("=" * 50)
    
    # Setup logging
    setup_logging()
    
    # Run demos
    demo_configuration()
    demo_database()
    demo_alerting()
    demo_ai_features()
    demo_web_dashboard()
    
    print("\n" + "=" * 50)
    print("Demo completed successfully!")
    print("\nTo start the full automation platform:")
    print("  python main.py")
    print("\nTo access the web dashboard:")
    print("  http://localhost:5000")
    print("\nTo control devices via CLI:")
    print("  python scripts/device_control.py [device] [action]")


if __name__ == "__main__":
    main()