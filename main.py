#!/usr/bin/env python3
"""
AI Automation System for Android Franklin T10 Gateway and HP ProLiant Server 380
Main entry point for the automation system
"""

import asyncio
import yaml
from pathlib import Path
from loguru import logger
import uvicorn
from fastapi import FastAPI

from src.core.system_manager import SystemManager
from src.api.routes import router


def load_config():
    """Load system configuration"""
    config_path = Path("config.yaml")
    with open(config_path, 'r') as file:
        return yaml.safe_load(file)


def setup_logging(log_level="INFO"):
    """Setup logging configuration"""
    logger.remove()
    logger.add(
        "logs/automation_system.log",
        level=log_level,
        rotation="10 MB",
        retention="30 days",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {name}:{function}:{line} | {message}"
    )
    logger.add(
        lambda msg: print(msg, end=""),
        level=log_level,
        format="<green>{time:HH:mm:ss}</green> | <level>{level}</level> | {message}"
    )


async def main():
    """Main application entry point"""
    # Load configuration
    config = load_config()
    
    # Setup logging
    setup_logging(config['system']['log_level'])
    
    logger.info(f"Starting {config['system']['name']} v{config['system']['version']}")
    
    # Initialize system manager
    system_manager = SystemManager(config)
    
    # Initialize FastAPI app
    app = FastAPI(
        title="AI Gateway Automation System",
        description="AI-powered automation for Franklin T10 Gateway and HP ProLiant Server 380",
        version=config['system']['version']
    )
    
    # Include API routes
    app.include_router(router, prefix="/api/v1")
    
    # Store system manager in app state
    app.state.system_manager = system_manager
    
    # Start system manager
    await system_manager.start()
    
    # Start API server
    api_config = config['api']
    logger.info(f"Starting API server on {api_config['host']}:{api_config['port']}")
    
    config_uvicorn = uvicorn.Config(
        app,
        host=api_config['host'],
        port=api_config['port'],
        log_level=config['system']['log_level'].lower()
    )
    
    server = uvicorn.Server(config_uvicorn)
    await server.serve()


if __name__ == "__main__":
    # Create necessary directories
    Path("logs").mkdir(exist_ok=True)
    Path("data").mkdir(exist_ok=True)
    Path("models").mkdir(exist_ok=True)
    
    # Run the application
    asyncio.run(main())