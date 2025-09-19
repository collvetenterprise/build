"""
Core System Manager for AI Automation System
Orchestrates all components and manages system lifecycle
"""

import asyncio
from typing import Dict, Any
from loguru import logger
from pathlib import Path

from ..ai.call_routing import CallRoutingAI
from ..ai.voice_recognition import VoiceRecognitionAI
from ..ai.fraud_detection import FraudDetectionAI
from ..ai.traffic_analysis import TrafficAnalysisAI
from ..network.franklin_gateway import FranklinT10Gateway
from ..network.security_monitor import SecurityMonitor
from ..phone.sip_server import SIPServer
from ..utils.database import DatabaseManager


class SystemManager:
    """Main system manager coordinating all AI automation components"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.running = False
        
        # Initialize database
        self.db = DatabaseManager(config['database'])
        
        # Initialize AI components
        self.call_routing_ai = CallRoutingAI(config['ai_models']['call_routing'])
        self.voice_recognition_ai = VoiceRecognitionAI(config['ai_models']['voice_recognition'])
        self.fraud_detection_ai = FraudDetectionAI(config['ai_models']['fraud_detection'])
        self.traffic_analysis_ai = TrafficAnalysisAI(config['ai_models']['traffic_analysis'])
        
        # Initialize network components
        self.franklin_gateway = FranklinT10Gateway(config['hardware']['gateway'])
        self.security_monitor = SecurityMonitor(config['security'])
        
        # Initialize phone server
        self.sip_server = SIPServer(config['phone_server'])
        
        # Task tracking
        self.background_tasks = []
        
        logger.info("System Manager initialized")
    
    async def start(self):
        """Start all system components"""
        try:
            logger.info("Starting AI Automation System...")
            
            # Initialize database
            await self.db.initialize()
            
            # Load AI models
            await self._load_ai_models()
            
            # Start network monitoring
            await self.franklin_gateway.connect()
            await self.security_monitor.start()
            
            # Start phone server
            await self.sip_server.start()
            
            # Start background tasks
            await self._start_background_tasks()
            
            self.running = True
            logger.info("AI Automation System started successfully")
            
        except Exception as e:
            logger.error(f"Failed to start system: {e}")
            raise
    
    async def stop(self):
        """Stop all system components"""
        logger.info("Stopping AI Automation System...")
        
        self.running = False
        
        # Cancel background tasks
        for task in self.background_tasks:
            task.cancel()
        
        # Stop components
        await self.sip_server.stop()
        await self.security_monitor.stop()
        await self.franklin_gateway.disconnect()
        
        logger.info("AI Automation System stopped")
    
    async def _load_ai_models(self):
        """Load all AI models"""
        logger.info("Loading AI models...")
        
        try:
            await self.call_routing_ai.load_model()
            await self.voice_recognition_ai.initialize()
            await self.fraud_detection_ai.load_model()
            await self.traffic_analysis_ai.load_model()
            
            logger.info("All AI models loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load AI models: {e}")
            raise
    
    async def _start_background_tasks(self):
        """Start background monitoring and maintenance tasks"""
        # Network monitoring task
        task1 = asyncio.create_task(self._network_monitoring_loop())
        self.background_tasks.append(task1)
        
        # Server health monitoring task
        task2 = asyncio.create_task(self._server_health_monitoring())
        self.background_tasks.append(task2)
        
        # AI model retraining task
        task3 = asyncio.create_task(self._ai_model_maintenance())
        self.background_tasks.append(task3)
        
        # Security monitoring task
        task4 = asyncio.create_task(self._security_monitoring_loop())
        self.background_tasks.append(task4)
        
        logger.info("Background tasks started")
    
    async def _network_monitoring_loop(self):
        """Continuous network monitoring and analysis"""
        while self.running:
            try:
                # Get network statistics from Franklin T10
                stats = await self.franklin_gateway.get_statistics()
                
                # Analyze traffic patterns
                analysis = await self.traffic_analysis_ai.analyze_traffic(stats)
                
                # Store analysis results
                await self.db.store_traffic_analysis(analysis)
                
                # Check for anomalies and respond
                if analysis.get('anomaly_detected'):
                    logger.warning("Network anomaly detected, taking automated action")
                    await self._handle_network_anomaly(analysis)
                
                await asyncio.sleep(self.config['network']['monitoring_interval'])
                
            except Exception as e:
                logger.error(f"Network monitoring error: {e}")
                await asyncio.sleep(60)  # Wait before retrying
    
    async def _server_health_monitoring(self):
        """Monitor HP ProLiant Server 380 health"""
        while self.running:
            try:
                # This would connect to HP iLO for real hardware monitoring
                # For now, we'll simulate health checks
                health_data = {
                    'cpu_usage': 45.2,
                    'memory_usage': 67.8,
                    'temperature': 42.5,
                    'disk_usage': 78.3,
                    'network_throughput': 234.5
                }
                
                # Use predictive maintenance AI
                prediction = await self._predict_maintenance_needs(health_data)
                
                if prediction.get('maintenance_needed'):
                    logger.warning("Predictive maintenance alert triggered")
                    await self._handle_maintenance_alert(prediction)
                
                await asyncio.sleep(300)  # Check every 5 minutes
                
            except Exception as e:
                logger.error(f"Server health monitoring error: {e}")
                await asyncio.sleep(300)
    
    async def _security_monitoring_loop(self):
        """Continuous security monitoring"""
        while self.running:
            try:
                # Monitor for security threats
                threats = await self.security_monitor.scan_for_threats()
                
                if threats:
                    logger.warning(f"Security threats detected: {len(threats)}")
                    await self._handle_security_threats(threats)
                
                await asyncio.sleep(60)  # Check every minute
                
            except Exception as e:
                logger.error(f"Security monitoring error: {e}")
                await asyncio.sleep(60)
    
    async def _ai_model_maintenance(self):
        """Periodic AI model maintenance and retraining"""
        while self.running:
            try:
                # Check model performance and retrain if necessary
                await self._check_and_retrain_models()
                
                await asyncio.sleep(3600)  # Check every hour
                
            except Exception as e:
                logger.error(f"AI model maintenance error: {e}")
                await asyncio.sleep(3600)
    
    async def _handle_network_anomaly(self, analysis: Dict[str, Any]):
        """Handle detected network anomalies"""
        # Implement automated response to network issues
        logger.info("Implementing automated network anomaly response")
        
        # Example: Adjust QoS settings
        await self.franklin_gateway.adjust_qos(analysis.get('recommended_settings', {}))
    
    async def _predict_maintenance_needs(self, health_data: Dict[str, Any]) -> Dict[str, Any]:
        """Predict maintenance needs using AI"""
        # Simple rule-based prediction for demonstration
        # In production, this would use a trained ML model
        
        maintenance_needed = False
        alerts = []
        
        if health_data['cpu_usage'] > 80:
            maintenance_needed = True
            alerts.append("High CPU usage detected")
        
        if health_data['temperature'] > 60:
            maintenance_needed = True
            alerts.append("High temperature detected")
        
        if health_data['disk_usage'] > 90:
            maintenance_needed = True
            alerts.append("Disk space running low")
        
        return {
            'maintenance_needed': maintenance_needed,
            'alerts': alerts,
            'health_score': 100 - max(health_data['cpu_usage'], health_data['disk_usage'])
        }
    
    async def _handle_maintenance_alert(self, prediction: Dict[str, Any]):
        """Handle maintenance alerts"""
        logger.info(f"Maintenance alert: {prediction['alerts']}")
        # Store alert in database
        await self.db.store_maintenance_alert(prediction)
    
    async def _handle_security_threats(self, threats: list):
        """Handle detected security threats"""
        for threat in threats:
            logger.warning(f"Security threat: {threat}")
            # Implement automated response
            await self.security_monitor.mitigate_threat(threat)
    
    async def _check_and_retrain_models(self):
        """Check AI model performance and retrain if necessary"""
        # Check model accuracy and retrain if below threshold
        models_to_check = [
            ('call_routing', self.call_routing_ai),
            ('fraud_detection', self.fraud_detection_ai),
            ('traffic_analysis', self.traffic_analysis_ai)
        ]
        
        for model_name, model_instance in models_to_check:
            accuracy = await model_instance.get_current_accuracy()
            if accuracy < 0.85:  # Retrain if accuracy drops below 85%
                logger.info(f"Retraining {model_name} model (accuracy: {accuracy:.2f})")
                await model_instance.retrain()
    
    async def get_system_status(self) -> Dict[str, Any]:
        """Get comprehensive system status"""
        return {
            'running': self.running,
            'gateway_connected': await self.franklin_gateway.is_connected(),
            'sip_server_active': self.sip_server.is_active(),
            'active_calls': await self.sip_server.get_active_call_count(),
            'ai_models_loaded': {
                'call_routing': self.call_routing_ai.is_loaded(),
                'voice_recognition': self.voice_recognition_ai.is_loaded(),
                'fraud_detection': self.fraud_detection_ai.is_loaded(),
                'traffic_analysis': self.traffic_analysis_ai.is_loaded()
            },
            'background_tasks': len([t for t in self.background_tasks if not t.done()])
        }