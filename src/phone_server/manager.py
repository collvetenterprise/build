"""
AI-Powered Phone Server Manager

Implements intelligent call routing, voice recognition, fraud detection,
and predictive maintenance for phone server systems.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple

try:
    from ..ai_models.call_routing_ai import CallRoutingAI
    from ..ai_models.voice_recognition import VoiceRecognitionEngine
    from ..ai_models.fraud_detection import FraudDetectionSystem
    from ..ai_models.predictive_maintenance import PredictiveMaintenanceEngine
    from ..apis.telephony import TelephonyAPIManager
    from ..utils.metrics import PhoneServerMetrics
except ImportError:
    # For direct execution
    import sys
    from pathlib import Path
    sys.path.append(str(Path(__file__).parent.parent))
    from ai_models.call_routing_ai import CallRoutingAI
    from ai_models.voice_recognition import VoiceRecognitionEngine
    from ai_models.fraud_detection import FraudDetectionSystem
    from ai_models.predictive_maintenance import PredictiveMaintenanceEngine
    from apis.telephony import TelephonyAPIManager
    from utils.metrics import PhoneServerMetrics


class PhoneServerManager:
    """
    Manages AI-powered phone server functionality including intelligent
    call routing, voice processing, fraud detection, and maintenance.
    """
    
    def __init__(self, config):
        self.config = config
        self.logger = logging.getLogger(__name__)
        
        # AI-powered components
        self.call_routing_ai = CallRoutingAI(config)
        self.voice_engine = VoiceRecognitionEngine(config)
        self.fraud_detector = FraudDetectionSystem(config)
        self.maintenance_engine = PredictiveMaintenanceEngine(config)
        
        # External integrations
        self.telephony_api = TelephonyAPIManager(config)
        self.metrics = PhoneServerMetrics()
        
        # Server state
        self.active_calls = {}
        self.call_queue = asyncio.Queue()
        self.agent_pool = {}
        self.server_health = {
            'cpu_usage': 0.0,
            'memory_usage': 0.0,
            'active_calls': 0,
            'queue_length': 0,
            'error_rate': 0.0
        }
        
        self.running = False
        
    async def start(self):
        """Start the AI-powered phone server."""
        self.logger.info("Starting AI-Powered Phone Server...")
        self.running = True
        
        # Initialize AI components
        await asyncio.gather(
            self.call_routing_ai.initialize(),
            self.voice_engine.initialize(),
            self.fraud_detector.initialize(),
            self.maintenance_engine.initialize()
        )
        
        # Start server components
        asyncio.create_task(self._call_processing_loop())
        asyncio.create_task(self._health_monitoring_loop())
        asyncio.create_task(self._fraud_monitoring_loop())
        asyncio.create_task(self._maintenance_monitoring_loop())
        
        # Initialize telephony API connections
        await self.telephony_api.connect()
        
        self.logger.info("AI-Powered Phone Server started")
        
    async def stop(self):
        """Stop the phone server gracefully."""
        self.logger.info("Stopping AI-Powered Phone Server...")
        self.running = False
        
        # Gracefully end active calls
        for call_id in list(self.active_calls.keys()):
            await self._end_call(call_id, reason="server_shutdown")
            
        # Shutdown AI components
        await asyncio.gather(
            self.call_routing_ai.shutdown(),
            self.voice_engine.shutdown(),
            self.fraud_detector.shutdown(),
            self.maintenance_engine.shutdown(),
            return_exceptions=True
        )
        
        await self.telephony_api.disconnect()
        
        self.logger.info("AI-Powered Phone Server stopped")
        
    async def health_check(self) -> Dict[str, Any]:
        """Perform comprehensive health check."""
        health_status = {
            'healthy': self.running,
            'server_metrics': self.server_health.copy(),
            'ai_components': {
                'call_routing': await self.call_routing_ai.health_check(),
                'voice_engine': await self.voice_engine.health_check(),
                'fraud_detector': await self.fraud_detector.health_check(),
                'maintenance': await self.maintenance_engine.health_check()
            },
            'telephony_api': await self.telephony_api.health_check()
        }
        
        # Determine overall health
        health_status['healthy'] = (
            health_status['healthy'] and
            all(component['healthy'] for component in health_status['ai_components'].values()) and
            health_status['telephony_api']['healthy'] and
            health_status['server_metrics']['error_rate'] < 0.05
        )
        
        return health_status
        
    async def handle_incoming_call(self, call_data: Dict[str, Any]) -> str:
        """Handle incoming call with AI-powered routing and processing."""
        call_id = call_data.get('call_id') or f"call_{datetime.now().timestamp()}"
        
        try:
            self.logger.info(f"Handling incoming call: {call_id}")
            
            # Step 1: Fraud detection analysis
            fraud_result = await self.fraud_detector.analyze_call(call_data)
            if fraud_result['is_suspicious']:
                self.logger.warning(f"Suspicious call detected: {call_id} - {fraud_result['reason']}")
                return await self._handle_suspicious_call(call_id, call_data, fraud_result)
                
            # Step 2: Voice recognition and intent analysis
            if 'audio_data' in call_data:
                voice_analysis = await self.voice_engine.analyze_audio(call_data['audio_data'])
                call_data.update(voice_analysis)
                
            # Step 3: Intelligent call routing
            routing_decision = await self.call_routing_ai.route_call(call_data)
            
            # Step 4: Execute routing decision
            await self._execute_routing(call_id, call_data, routing_decision)
            
            # Track active call
            self.active_calls[call_id] = {
                'start_time': datetime.now(),
                'call_data': call_data,
                'routing_decision': routing_decision,
                'status': 'active'
            }
            
            # Update metrics
            self.metrics.record_call_handled(call_id, routing_decision)
            
            return call_id
            
        except Exception as e:
            self.logger.error(f"Error handling call {call_id}: {e}")
            await self._handle_call_error(call_id, call_data, str(e))
            raise
            
    async def _execute_routing(self, call_id: str, call_data: Dict[str, Any], 
                             routing_decision: Dict[str, Any]):
        """Execute the AI-generated routing decision."""
        routing_type = routing_decision.get('type')
        target = routing_decision.get('target')
        
        self.logger.info(f"Routing call {call_id} - Type: {routing_type}, Target: {target}")
        
        if routing_type == 'agent':
            await self._route_to_agent(call_id, target, routing_decision)
        elif routing_type == 'ivr':
            await self._route_to_ivr(call_id, target, routing_decision)
        elif routing_type == 'automated_response':
            await self._handle_automated_response(call_id, routing_decision)
        elif routing_type == 'callback':
            await self._schedule_callback(call_id, routing_decision)
        else:
            raise ValueError(f"Unknown routing type: {routing_type}")
            
    async def _route_to_agent(self, call_id: str, agent_id: str, 
                            routing_decision: Dict[str, Any]):
        """Route call to a specific agent."""
        try:
            # Check agent availability
            if not await self._is_agent_available(agent_id):
                # Find alternative agent using AI
                alternative = await self.call_routing_ai.find_alternative_agent(
                    agent_id, routing_decision
                )
                if alternative:
                    agent_id = alternative['agent_id']
                else:
                    # Add to queue
                    await self.call_queue.put((call_id, routing_decision))
                    return
                    
            # Connect call to agent
            await self.telephony_api.connect_call_to_agent(call_id, agent_id)
            
            # Update agent status
            self.agent_pool[agent_id] = {
                'status': 'busy',
                'current_call': call_id,
                'call_start': datetime.now()
            }
            
        except Exception as e:
            self.logger.error(f"Failed to route call {call_id} to agent {agent_id}: {e}")
            # Fallback to queue
            await self.call_queue.put((call_id, routing_decision))
            
    async def _route_to_ivr(self, call_id: str, ivr_flow: str, 
                          routing_decision: Dict[str, Any]):
        """Route call to Interactive Voice Response system."""
        # Personalize IVR flow based on caller data
        personalized_flow = await self.call_routing_ai.personalize_ivr(
            ivr_flow, routing_decision.get('caller_data', {})
        )
        
        await self.telephony_api.start_ivr_flow(call_id, personalized_flow)
        
    async def _handle_automated_response(self, call_id: str, 
                                       routing_decision: Dict[str, Any]):
        """Handle call with automated AI response."""
        response_text = routing_decision.get('response_text')
        
        # Generate natural voice response
        audio_response = await self.voice_engine.text_to_speech(response_text)
        
        # Play response to caller
        await self.telephony_api.play_audio(call_id, audio_response)
        
        # Check if further interaction is needed
        if routing_decision.get('expect_response', False):
            # Record caller response and analyze
            caller_response = await self.telephony_api.record_response(call_id)
            intent = await self.voice_engine.analyze_intent(caller_response)
            
            # Generate follow-up action
            follow_up = await self.call_routing_ai.generate_follow_up(intent)
            await self._execute_routing(call_id, {}, follow_up)
            
    async def _schedule_callback(self, call_id: str, routing_decision: Dict[str, Any]):
        """Schedule a callback for the caller."""
        callback_time = routing_decision.get('callback_time')
        caller_number = routing_decision.get('caller_number')
        
        # Schedule callback in the system
        await self.telephony_api.schedule_callback(
            caller_number, callback_time, routing_decision.get('context', {})
        )
        
        # Inform caller
        message = f"Thank you for calling. We will call you back at {callback_time}."
        await self.telephony_api.send_voice_message(call_id, message)
        
    async def _handle_suspicious_call(self, call_id: str, call_data: Dict[str, Any], 
                                    fraud_result: Dict[str, Any]) -> str:
        """Handle calls flagged as suspicious by fraud detection."""
        risk_level = fraud_result.get('risk_level', 'medium')
        
        if risk_level == 'high':
            # Block call immediately
            await self.telephony_api.block_call(call_id)
            self.logger.warning(f"High-risk call blocked: {call_id}")
            return call_id
        elif risk_level == 'medium':
            # Route to specialized fraud investigation team
            await self._route_to_agent(call_id, 'fraud_specialist', {
                'type': 'agent',
                'target': 'fraud_specialist',
                'priority': 'high',
                'context': fraud_result
            })
        else:
            # Log and monitor but proceed normally
            self.logger.info(f"Low-risk suspicious call monitored: {call_id}")
            return await self.handle_incoming_call({**call_data, 'fraud_flagged': True})
            
        return call_id
        
    async def _call_processing_loop(self):
        """Main loop for processing queued calls."""
        while self.running:
            try:
                # Process calls from queue
                if not self.call_queue.empty():
                    call_id, routing_decision = await asyncio.wait_for(
                        self.call_queue.get(), timeout=1.0
                    )
                    
                    # Find available agent
                    available_agent = await self._find_available_agent(routing_decision)
                    if available_agent:
                        await self._route_to_agent(call_id, available_agent, routing_decision)
                    else:
                        # Re-queue if no agent available
                        await self.call_queue.put((call_id, routing_decision))
                        
            except asyncio.TimeoutError:
                pass  # No calls in queue
            except Exception as e:
                self.logger.error(f"Call processing error: {e}")
                
            await asyncio.sleep(1)
            
    async def _health_monitoring_loop(self):
        """Monitor server health metrics."""
        while self.running:
            try:
                # Update health metrics
                self.server_health.update({
                    'cpu_usage': await self.metrics.get_cpu_usage(),
                    'memory_usage': await self.metrics.get_memory_usage(),
                    'active_calls': len(self.active_calls),
                    'queue_length': self.call_queue.qsize(),
                    'error_rate': await self.metrics.get_error_rate()
                })
                
                # Check for performance issues
                if self.server_health['cpu_usage'] > 90:
                    self.logger.warning("High CPU usage detected")
                    
                if self.server_health['memory_usage'] > 90:
                    self.logger.warning("High memory usage detected")
                    
            except Exception as e:
                self.logger.error(f"Health monitoring error: {e}")
                
            await asyncio.sleep(30)
            
    async def _fraud_monitoring_loop(self):
        """Continuously monitor for fraud patterns."""
        while self.running:
            try:
                # Analyze recent call patterns
                recent_calls = await self.metrics.get_recent_calls(minutes=30)
                fraud_patterns = await self.fraud_detector.analyze_patterns(recent_calls)
                
                if fraud_patterns:
                    self.logger.warning(f"Fraud patterns detected: {fraud_patterns}")
                    # Update fraud detection models
                    await self.fraud_detector.update_models(fraud_patterns)
                    
            except Exception as e:
                self.logger.error(f"Fraud monitoring error: {e}")
                
            await asyncio.sleep(300)  # Check every 5 minutes
            
    async def _maintenance_monitoring_loop(self):
        """Monitor system health for predictive maintenance."""
        while self.running:
            try:
                # Collect system metrics
                system_metrics = await self.metrics.get_system_metrics()
                
                # Predict potential issues
                maintenance_alerts = await self.maintenance_engine.predict_issues(
                    system_metrics
                )
                
                for alert in maintenance_alerts:
                    self.logger.warning(f"Predictive maintenance alert: {alert}")
                    
            except Exception as e:
                self.logger.error(f"Maintenance monitoring error: {e}")
                
            await asyncio.sleep(600)  # Check every 10 minutes
            
    async def _is_agent_available(self, agent_id: str) -> bool:
        """Check if an agent is available to take calls."""
        agent_status = self.agent_pool.get(agent_id, {})
        return agent_status.get('status') == 'available'
        
    async def _find_available_agent(self, routing_decision: Dict[str, Any]) -> Optional[str]:
        """Find an available agent based on routing requirements."""
        required_skills = routing_decision.get('required_skills', [])
        
        for agent_id, agent_info in self.agent_pool.items():
            if (agent_info.get('status') == 'available' and
                all(skill in agent_info.get('skills', []) for skill in required_skills)):
                return agent_id
                
        return None
        
    async def _end_call(self, call_id: str, reason: str = "normal"):
        """End a call and clean up resources."""
        if call_id in self.active_calls:
            call_info = self.active_calls[call_id]
            call_duration = datetime.now() - call_info['start_time']
            
            # Update metrics
            self.metrics.record_call_ended(call_id, call_duration, reason)
            
            # Clean up
            del self.active_calls[call_id]
            
            # Free up agent if applicable
            for agent_id, agent_info in self.agent_pool.items():
                if agent_info.get('current_call') == call_id:
                    self.agent_pool[agent_id]['status'] = 'available'
                    self.agent_pool[agent_id]['current_call'] = None
                    break
                    
        await self.telephony_api.end_call(call_id)
        
    async def _handle_call_error(self, call_id: str, call_data: Dict[str, Any], error: str):
        """Handle call processing errors."""
        self.logger.error(f"Call error for {call_id}: {error}")
        
        # Record error metrics
        self.metrics.record_call_error(call_id, error)
        
        # Attempt graceful fallback
        try:
            await self.telephony_api.play_error_message(call_id)
        except Exception:
            pass  # Best effort
            
        await self._end_call(call_id, reason="error")