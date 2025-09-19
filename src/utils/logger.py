"""
Logging Setup Utility

Configures advanced logging for the AI innovation system.
"""

import logging
import logging.handlers
import sys
from pathlib import Path
from typing import Dict, Any, Optional


def setup_logging(config: Dict[str, Any]) -> logging.Logger:
    """Setup comprehensive logging configuration."""
    
    # Get logging configuration
    log_level = config.get('level', 'INFO').upper()
    log_format = config.get('format', '%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    log_file = config.get('file')
    
    # Create formatter
    formatter = logging.Formatter(log_format)
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, log_level))
    
    # Clear existing handlers
    root_logger.handlers.clear()
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(getattr(logging, log_level))
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)
    
    # File handler (if specified)
    if log_file:
        # Create log directory if it doesn't exist
        log_path = Path(log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Rotating file handler
        file_handler = logging.handlers.RotatingFileHandler(
            log_file,
            maxBytes=10 * 1024 * 1024,  # 10MB
            backupCount=5
        )
        file_handler.setLevel(getattr(logging, log_level))
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)
    
    # Configure specific logger levels
    logging.getLogger('urllib3').setLevel(logging.WARNING)
    logging.getLogger('requests').setLevel(logging.WARNING)
    logging.getLogger('asyncio').setLevel(logging.WARNING)
    
    # Return the main application logger
    app_logger = logging.getLogger('ai_innovation')
    app_logger.info("Logging system initialized")
    
    return app_logger


class StructuredLogger:
    """Structured logger for better log analysis."""
    
    def __init__(self, name: str, extra_fields: Optional[Dict[str, Any]] = None):
        self.logger = logging.getLogger(name)
        self.extra_fields = extra_fields or {}
        
    def _log_with_structure(self, level: int, message: str, 
                          extra: Optional[Dict[str, Any]] = None):
        """Log with structured fields."""
        fields = self.extra_fields.copy()
        if extra:
            fields.update(extra)
            
        # Format message with structured data
        if fields:
            structured_msg = f"{message} | {' | '.join(f'{k}={v}' for k, v in fields.items())}"
        else:
            structured_msg = message
            
        self.logger.log(level, structured_msg)
        
    def info(self, message: str, **kwargs):
        """Log info message with structured data."""
        self._log_with_structure(logging.INFO, message, kwargs)
        
    def warning(self, message: str, **kwargs):
        """Log warning message with structured data."""
        self._log_with_structure(logging.WARNING, message, kwargs)
        
    def error(self, message: str, **kwargs):
        """Log error message with structured data."""
        self._log_with_structure(logging.ERROR, message, kwargs)
        
    def debug(self, message: str, **kwargs):
        """Log debug message with structured data."""
        self._log_with_structure(logging.DEBUG, message, kwargs)
        
    def critical(self, message: str, **kwargs):
        """Log critical message with structured data."""
        self._log_with_structure(logging.CRITICAL, message, kwargs)


def get_component_logger(component_name: str, **extra_fields) -> StructuredLogger:
    """Get a structured logger for a specific component."""
    return StructuredLogger(f'ai_innovation.{component_name}', extra_fields)