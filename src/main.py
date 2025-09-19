#!/usr/bin/env python3
"""
AI-Driven Phone Server & Internet Gateway Automation Engine

This is the main orchestration engine that coordinates all AI innovations
for phone server and internet gateway automation and execution.
"""

import asyncio
import logging
import sys
from pathlib import Path
from typing import Dict, List, Optional

# Add src to path for imports
sys.path.append(str(Path(__file__).parent))

from automation.orchestrator import AutomationOrchestrator
from phone_server.manager import PhoneServerManager
from internet_gateway.manager import InternetGatewayManager
from utils.config import ConfigManager
from utils.logger import setup_logging


class AIInnovationEngine:
    """
    Main engine that coordinates all AI-driven innovations for phone server
    and internet gateway automation and execution.
    """
    
    def __init__(self, config_path: Optional[str] = None):
        """Initialize the AI Innovation Engine."""
        self.config = ConfigManager(config_path)
        self.logger = setup_logging(self.config.get('logging', {}))
        
        # Initialize core components
        self.orchestrator = AutomationOrchestrator(self.config)
        self.phone_server = PhoneServerManager(self.config)
        self.gateway = InternetGatewayManager(self.config)
        
        self.running = False
        
    async def start(self):
        """Start all AI innovation systems."""
        try:
            self.logger.info("Starting AI Innovation Engine...")
            self.running = True
            
            # Start all core components
            tasks = [
                self.orchestrator.start(),
                self.phone_server.start(),
                self.gateway.start()
            ]
            
            await asyncio.gather(*tasks)
            self.logger.info("All systems started successfully")
            
        except Exception as e:
            self.logger.error(f"Failed to start AI Innovation Engine: {e}")
            await self.stop()
            raise
            
    async def stop(self):
        """Stop all systems gracefully."""
        if not self.running:
            return
            
        self.logger.info("Stopping AI Innovation Engine...")
        self.running = False
        
        # Stop all components
        await asyncio.gather(
            self.orchestrator.stop(),
            self.phone_server.stop(),
            self.gateway.stop(),
            return_exceptions=True
        )
        
        self.logger.info("AI Innovation Engine stopped")
        
    async def monitor_health(self):
        """Monitor the health of all systems."""
        while self.running:
            try:
                health_status = {
                    'orchestrator': await self.orchestrator.health_check(),
                    'phone_server': await self.phone_server.health_check(),
                    'gateway': await self.gateway.health_check()
                }
                
                self.logger.debug(f"Health status: {health_status}")
                
                # Check for any unhealthy components
                unhealthy = [k for k, v in health_status.items() if not v['healthy']]
                if unhealthy:
                    self.logger.warning(f"Unhealthy components: {unhealthy}")
                    # Trigger self-healing procedures
                    await self.orchestrator.trigger_healing(unhealthy)
                    
            except Exception as e:
                self.logger.error(f"Health monitoring error: {e}")
                
            await asyncio.sleep(30)  # Check every 30 seconds
            
    async def run(self):
        """Main run loop for the AI Innovation Engine."""
        try:
            # Start all systems
            await self.start()
            
            # Start health monitoring
            health_task = asyncio.create_task(self.monitor_health())
            
            # Run until interrupted
            await asyncio.Event().wait()
            
        except KeyboardInterrupt:
            self.logger.info("Received shutdown signal")
        except Exception as e:
            self.logger.error(f"Unexpected error: {e}")
        finally:
            await self.stop()


async def main():
    """Main entry point."""
    engine = AIInnovationEngine()
    await engine.run()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nShutdown complete")
    except Exception as e:
        print(f"Fatal error: {e}")
        sys.exit(1)