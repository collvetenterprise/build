#!/usr/bin/env python3
"""
Device Control Script
Provides command-line interface for device operations
"""

import sys
import argparse
import json
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from automation.config_manager import ConfigManager
from automation.franklin_t10 import FranklinT10Gateway
from automation.hp_proliant import HPProLiantDL380
from utils.logger import setup_logging


def main():
    parser = argparse.ArgumentParser(description='Device Control Script')
    parser.add_argument('device', choices=['franklin_t10', 'hp_proliant'], 
                       help='Device to control')
    parser.add_argument('action', help='Action to perform')
    parser.add_argument('--config', '-c', default='../config/main.yml',
                       help='Configuration file path')
    parser.add_argument('--force', action='store_true',
                       help='Force action (for power operations)')
    parser.add_argument('--verbose', '-v', action='store_true',
                       help='Verbose output')
    
    args = parser.parse_args()
    
    # Setup logging
    setup_logging(level=logging.DEBUG if args.verbose else logging.INFO)
    
    try:
        # Load configuration
        config_manager = ConfigManager(args.config)
        config = config_manager.load_config()
        
        device_config = config.get("devices", {}).get(args.device)
        if not device_config:
            print(f"Device {args.device} not found in configuration")
            return 1
        
        # Initialize device
        if args.device == "franklin_t10":
            device = FranklinT10Gateway(device_config)
            result = execute_franklin_action(device, args.action, args.force)
        elif args.device == "hp_proliant":
            device = HPProLiantDL380(device_config)
            result = execute_hp_action(device, args.action, args.force)
        
        # Output result
        print(json.dumps(result, indent=2))
        
        # Cleanup
        if hasattr(device, 'cleanup'):
            device.cleanup()
        
        return 0 if result.get("success", True) else 1
        
    except Exception as e:
        print(f"Error: {e}")
        return 1


def execute_franklin_action(device, action, force=False):
    """Execute Franklin T10 actions"""
    if action == "status":
        return device.get_device_status()
    elif action == "reboot":
        success = device.reboot_device()
        return {"success": success, "message": "Reboot initiated" if success else "Reboot failed"}
    elif action == "devices":
        devices = device.get_connected_devices()
        return {"success": True, "connected_devices": devices}
    else:
        return {"success": False, "error": f"Unknown action: {action}"}


def execute_hp_action(device, action, force=False):
    """Execute HP ProLiant actions"""
    if action == "status":
        return device.get_system_info()
    elif action == "power_on":
        success = device.power_on()
        return {"success": success, "message": "Power on initiated" if success else "Power on failed"}
    elif action == "power_off":
        success = device.power_off(force)
        return {"success": success, "message": "Power off initiated" if success else "Power off failed"}
    elif action == "reboot":
        success = device.reboot(force)
        return {"success": success, "message": "Reboot initiated" if success else "Reboot failed"}
    elif action == "logs":
        logs = device.get_system_logs()
        return {"success": True, "logs": logs}
    elif action == "firmware":
        firmware = device.get_firmware_inventory()
        return {"success": True, "firmware": firmware}
    else:
        return {"success": False, "error": f"Unknown action: {action}"}


if __name__ == "__main__":
    import logging
    sys.exit(main())