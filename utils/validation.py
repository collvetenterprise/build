"""
Configuration validation utilities
"""

from typing import Dict, Any, List


def validate_config(config: Dict[str, Any]) -> bool:
    """Validate configuration structure and values"""
    
    required_sections = ["automation", "devices", "monitoring"]
    
    # Check required top-level sections
    for section in required_sections:
        if section not in config:
            return False
    
    # Validate automation section
    if not validate_automation_config(config["automation"]):
        return False
    
    # Validate devices section
    if not validate_devices_config(config["devices"]):
        return False
    
    # Validate monitoring section
    if not validate_monitoring_config(config["monitoring"]):
        return False
    
    return True


def validate_automation_config(automation: Dict[str, Any]) -> bool:
    """Validate automation configuration"""
    required_fields = ["check_interval", "retry_attempts", "timeout"]
    
    for field in required_fields:
        if field not in automation:
            return False
        
        # Check if values are positive integers
        if not isinstance(automation[field], int) or automation[field] <= 0:
            return False
    
    return True


def validate_devices_config(devices: Dict[str, Any]) -> bool:
    """Validate devices configuration"""
    
    # Validate Franklin T10 config if present
    if "franklin_t10" in devices:
        if not validate_franklin_config(devices["franklin_t10"]):
            return False
    
    # Validate HP ProLiant config if present
    if "hp_proliant" in devices:
        if not validate_hp_config(devices["hp_proliant"]):
            return False
    
    return True


def validate_franklin_config(franklin: Dict[str, Any]) -> bool:
    """Validate Franklin T10 configuration"""
    required_fields = ["enabled", "ip_address", "username", "password"]
    
    for field in required_fields:
        if field not in franklin:
            return False
    
    # Validate IP address format (basic check)
    ip = franklin["ip_address"]
    if not isinstance(ip, str) or not _is_valid_ip(ip):
        return False
    
    return True


def validate_hp_config(hp: Dict[str, Any]) -> bool:
    """Validate HP ProLiant configuration"""
    required_fields = ["enabled", "ilo_ip", "username", "password"]
    
    for field in required_fields:
        if field not in hp:
            return False
    
    # Validate IP address format (basic check)
    ip = hp["ilo_ip"]
    if not isinstance(ip, str) or not _is_valid_ip(ip):
        return False
    
    return True


def validate_monitoring_config(monitoring: Dict[str, Any]) -> bool:
    """Validate monitoring configuration"""
    required_fields = ["enabled"]
    
    for field in required_fields:
        if field not in monitoring:
            return False
    
    # Validate web dashboard config if present
    if "web_dashboard" in monitoring:
        dashboard = monitoring["web_dashboard"]
        if "enabled" not in dashboard or "host" not in dashboard or "port" not in dashboard:
            return False
        
        # Check port is valid
        port = dashboard["port"]
        if not isinstance(port, int) or port <= 0 or port > 65535:
            return False
    
    return True


def _is_valid_ip(ip: str) -> bool:
    """Basic IP address validation"""
    try:
        parts = ip.split('.')
        if len(parts) != 4:
            return False
        
        for part in parts:
            num = int(part)
            if num < 0 or num > 255:
                return False
        
        return True
    except (ValueError, AttributeError):
        return False