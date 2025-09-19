#!/usr/bin/env python3
"""
Enterprise Network Automation Platform
Main entry point for the automation system
"""

import os
import sys
import logging
import argparse
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from automation.orchestrator import AutomationOrchestrator
from automation.config_manager import ConfigManager
from monitoring.dashboard import WebDashboard
from utils.logger import setup_logging


def main():
    """Main entry point for the automation platform"""
    parser = argparse.ArgumentParser(description='Enterprise Network Automation Platform')
    parser.add_argument('--config', '-c', default='config/main.yml',
                       help='Configuration file path')
    parser.add_argument('--verbose', '-v', action='store_true',
                       help='Enable verbose logging')
    parser.add_argument('--web-only', action='store_true',
                       help='Run only the web dashboard')
    parser.add_argument('--no-web', action='store_true',
                       help='Run without web dashboard')
    
    args = parser.parse_args()
    
    # Setup logging
    log_level = logging.DEBUG if args.verbose else logging.INFO
    setup_logging(log_level)
    logger = logging.getLogger(__name__)
    
    try:
        # Load configuration
        config_manager = ConfigManager(args.config)
        config = config_manager.load_config()
        
        logger.info("Starting Enterprise Network Automation Platform")
        
        if args.web_only:
            # Run only web dashboard
            dashboard = WebDashboard(config)
            dashboard.run()
        else:
            # Start the main orchestrator
            orchestrator = AutomationOrchestrator(config)
            
            if not args.no_web:
                # Start web dashboard in background
                dashboard = WebDashboard(config)
                dashboard.start_background()
            
            # Start automation tasks
            orchestrator.start()
            
    except KeyboardInterrupt:
        logger.info("Shutting down automation platform...")
    except Exception as e:
        logger.error(f"Error starting automation platform: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()