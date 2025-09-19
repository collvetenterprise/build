"""
Configuration Manager
Handles loading and validation of configuration files
"""

import yaml
import logging
import os
from pathlib import Path
from typing import Dict, Any, Optional
from utils.validation import validate_config


class ConfigManager:
    """Configuration management class"""
    
    def __init__(self, config_path: str = "config/main.yml"):
        self.config_path = Path(config_path)
        self.logger = logging.getLogger(__name__)
        self._config = None
        
    def load_config(self) -> Dict[str, Any]:
        """Load configuration from YAML file"""
        try:
            if not self.config_path.exists():
                self.logger.warning(f"Config file {self.config_path} not found, creating default")
                self._create_default_config()
            
            with open(self.config_path, 'r') as file:
                self._config = yaml.safe_load(file)
            
            # Validate configuration
            if not validate_config(self._config):
                raise ValueError("Invalid configuration")
            
            self.logger.info(f"Configuration loaded from {self.config_path}")
            return self._config
            
        except Exception as e:
            self.logger.error(f"Failed to load configuration: {e}")
            raise
    
    def _create_default_config(self):
        """Create default configuration file"""
        default_config = {
            "automation": {
                "check_interval": 60,
                "retry_attempts": 3,
                "timeout": 30
            },
            "devices": {
                "franklin_t10": {
                    "enabled": True,
                    "ip_address": "192.168.0.1",
                    "username": "admin",
                    "password": "admin",
                    "check_interval": 30,
                    "reboot_on_failure": True,
                    "max_failures": 3
                },
                "hp_proliant": {
                    "enabled": True,
                    "ilo_ip": "192.168.1.100",
                    "username": "Administrator",
                    "password": "password",
                    "check_interval": 60,
                    "monitor_thermal": True,
                    "monitor_power": True,
                    "monitor_storage": True
                }
            },
            "monitoring": {
                "enabled": True,
                "web_dashboard": {
                    "enabled": True,
                    "host": "0.0.0.0",
                    "port": 5000,
                    "debug": False
                },
                "alerts": {
                    "email": {
                        "enabled": False,
                        "smtp_server": "smtp.gmail.com",
                        "smtp_port": 587,
                        "username": "",
                        "password": "",
                        "recipients": []
                    },
                    "slack": {
                        "enabled": False,
                        "webhook_url": "",
                        "channel": "#alerts"
                    }
                }
            },
            "ai": {
                "enabled": True,
                "predictive_maintenance": {
                    "enabled": True,
                    "model_path": "ai/models/",
                    "training_data_days": 30
                },
                "anomaly_detection": {
                    "enabled": True,
                    "sensitivity": 0.8
                }
            },
            "logging": {
                "level": "INFO",
                "file": "logs/automation.log",
                "max_size_mb": 10,
                "backup_count": 5
            }
        }
        
        # Ensure config directory exists
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(self.config_path, 'w') as file:
            yaml.dump(default_config, file, default_flow_style=False, indent=2)
        
        self.logger.info(f"Default configuration created at {self.config_path}")
    
    def get_device_config(self, device_name: str) -> Optional[Dict[str, Any]]:
        """Get configuration for a specific device"""
        if not self._config:
            self.load_config()
        
        return self._config.get("devices", {}).get(device_name)
    
    def get_monitoring_config(self) -> Dict[str, Any]:
        """Get monitoring configuration"""
        if not self._config:
            self.load_config()
        
        return self._config.get("monitoring", {})
    
    def get_ai_config(self) -> Dict[str, Any]:
        """Get AI configuration"""
        if not self._config:
            self.load_config()
        
        return self._config.get("ai", {})
    
    def update_config(self, updates: Dict[str, Any]) -> bool:
        """Update configuration with new values"""
        try:
            if not self._config:
                self.load_config()
            
            # Deep merge updates into config
            self._deep_merge(self._config, updates)
            
            # Validate updated configuration
            if not validate_config(self._config):
                raise ValueError("Updated configuration is invalid")
            
            # Save to file
            with open(self.config_path, 'w') as file:
                yaml.dump(self._config, file, default_flow_style=False, indent=2)
            
            self.logger.info("Configuration updated successfully")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to update configuration: {e}")
            return False
    
    def _deep_merge(self, base: Dict[str, Any], updates: Dict[str, Any]):
        """Deep merge two dictionaries"""
        for key, value in updates.items():
            if key in base and isinstance(base[key], dict) and isinstance(value, dict):
                self._deep_merge(base[key], value)
            else:
                base[key] = value