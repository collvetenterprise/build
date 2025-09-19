"""
Configuration Manager

Handles loading and managing configuration for the AI innovation system.
"""

import os
import yaml
import json
from pathlib import Path
from typing import Dict, Any, Optional


class ConfigManager:
    """Manages configuration loading and access for the AI system."""
    
    def __init__(self, config_path: Optional[str] = None):
        self.config_path = config_path or self._find_config_file()
        self.config = self._load_config()
        
    def _find_config_file(self) -> str:
        """Find the configuration file in standard locations."""
        possible_paths = [
            os.environ.get('AI_CONFIG_PATH'),
            './config/config.yaml',
            './config/config.json',
            './config.yaml',
            './config.json'
        ]
        
        for path in possible_paths:
            if path and Path(path).exists():
                return path
                
        # Return default path
        return './config/config.yaml'
        
    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from file or environment variables."""
        config = self._get_default_config()
        
        if Path(self.config_path).exists():
            try:
                with open(self.config_path, 'r') as f:
                    if self.config_path.endswith('.yaml') or self.config_path.endswith('.yml'):
                        file_config = yaml.safe_load(f)
                    else:
                        file_config = json.load(f)
                        
                # Merge with defaults
                config.update(file_config)
            except Exception as e:
                print(f"Warning: Failed to load config file {self.config_path}: {e}")
                
        # Override with environment variables
        config.update(self._load_env_config())
        
        return config
        
    def _get_default_config(self) -> Dict[str, Any]:
        """Get default configuration values."""
        return {
            'logging': {
                'level': 'INFO',
                'format': '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
                'file': None
            },
            'ai_models': {
                'model_path': './models',
                'update_interval': 3600,
                'training_enabled': True
            },
            'phone_server': {
                'enabled': True,
                'port': 5060,
                'max_concurrent_calls': 1000,
                'call_timeout': 300,
                'voice_models': {
                    'speech_to_text': 'whisper-base',
                    'text_to_speech': 'tacotron2',
                    'intent_detection': 'bert-base'
                }
            },
            'internet_gateway': {
                'enabled': True,
                'interfaces': ['eth0'],
                'max_connections': 10000,
                'bandwidth_limit': '1Gbps',
                'threat_detection': {
                    'enabled': True,
                    'sensitivity': 'medium',
                    'whitelist': []
                }
            },
            'automation': {
                'self_healing': {
                    'enabled': True,
                    'max_restart_attempts': 3,
                    'escalation_delay': 300
                },
                'learning': {
                    'enabled': True,
                    'update_interval': 3600,
                    'min_data_points': 100
                }
            },
            'apis': {
                'twilio': {
                    'account_sid': os.environ.get('TWILIO_ACCOUNT_SID'),
                    'auth_token': os.environ.get('TWILIO_AUTH_TOKEN')
                },
                'network': {
                    'management_interface': '127.0.0.1:8080',
                    'snmp_community': 'public'
                }
            },
            'security': {
                'encryption_key': os.environ.get('ENCRYPTION_KEY'),
                'api_keys': {
                    'admin': os.environ.get('ADMIN_API_KEY')
                }
            },
            'monitoring': {
                'prometheus_port': 9090,
                'grafana_port': 3000,
                'metrics_retention': '30d'
            }
        }
        
    def _load_env_config(self) -> Dict[str, Any]:
        """Load configuration from environment variables."""
        env_config = {}
        
        # Map environment variables to config keys
        env_mappings = {
            'AI_LOG_LEVEL': 'logging.level',
            'AI_MODEL_PATH': 'ai_models.model_path',
            'PHONE_SERVER_PORT': 'phone_server.port',
            'GATEWAY_MAX_CONNECTIONS': 'internet_gateway.max_connections',
            'SELF_HEALING_ENABLED': 'automation.self_healing.enabled'
        }
        
        for env_var, config_key in env_mappings.items():
            value = os.environ.get(env_var)
            if value is not None:
                # Convert string values to appropriate types
                if value.lower() in ('true', 'false'):
                    value = value.lower() == 'true'
                elif value.isdigit():
                    value = int(value)
                    
                # Set nested config value
                self._set_nested_value(env_config, config_key, value)
                
        return env_config
        
    def _set_nested_value(self, config: Dict[str, Any], key_path: str, value: Any):
        """Set a nested configuration value using dot notation."""
        keys = key_path.split('.')
        current = config
        
        for key in keys[:-1]:
            if key not in current:
                current[key] = {}
            current = current[key]
            
        current[keys[-1]] = value
        
    def get(self, key_path: str, default: Any = None) -> Any:
        """Get a configuration value using dot notation."""
        keys = key_path.split('.')
        current = self.config
        
        try:
            for key in keys:
                current = current[key]
            return current
        except (KeyError, TypeError):
            return default
            
    def set(self, key_path: str, value: Any):
        """Set a configuration value using dot notation."""
        self._set_nested_value(self.config, key_path, value)
        
    def update(self, new_config: Dict[str, Any]):
        """Update configuration with new values."""
        self.config.update(new_config)
        
    def save(self, path: Optional[str] = None):
        """Save current configuration to file."""
        save_path = path or self.config_path
        
        # Create directory if it doesn't exist
        Path(save_path).parent.mkdir(parents=True, exist_ok=True)
        
        with open(save_path, 'w') as f:
            if save_path.endswith('.yaml') or save_path.endswith('.yml'):
                yaml.dump(self.config, f, default_flow_style=False)
            else:
                json.dump(self.config, f, indent=2)
                
    def reload(self):
        """Reload configuration from file."""
        self.config = self._load_config()
        
    def to_dict(self) -> Dict[str, Any]:
        """Return configuration as dictionary."""
        return self.config.copy()