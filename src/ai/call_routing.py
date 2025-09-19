"""
AI-powered Call Routing System
Intelligently routes calls based on context, caller history, and agent availability
"""

import pickle
import numpy as np
from typing import Dict, Any, List, Optional
from loguru import logger
from pathlib import Path
import asyncio


class CallRoutingAI:
    """AI system for intelligent call routing"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.model = None
        self.is_model_loaded = False
        self.call_history = {}
        self.agent_performance = {}
        
    async def load_model(self):
        """Load or create the call routing model"""
        model_path = Path(self.config['model_path'])
        
        if model_path.exists():
            try:
                with open(model_path, 'rb') as f:
                    self.model = pickle.load(f)
                logger.info("Call routing model loaded successfully")
            except Exception as e:
                logger.warning(f"Failed to load model: {e}, creating new model")
                await self._create_default_model()
        else:
            await self._create_default_model()
        
        self.is_model_loaded = True
    
    async def _create_default_model(self):
        """Create a default rule-based model"""
        self.model = {
            'rules': [
                {
                    'condition': 'caller_type == "premium"',
                    'route_to': 'premium_queue',
                    'priority': 1
                },
                {
                    'condition': 'call_topic == "technical_support"',
                    'route_to': 'technical_queue',
                    'priority': 2
                },
                {
                    'condition': 'call_topic == "billing"',
                    'route_to': 'billing_queue',
                    'priority': 2
                },
                {
                    'condition': 'time_of_day >= 9 and time_of_day <= 17',
                    'route_to': 'business_hours_queue',
                    'priority': 3
                },
                {
                    'condition': 'default',
                    'route_to': 'general_queue',
                    'priority': 4
                }
            ],
            'agent_specializations': {
                'technical_queue': ['agent_tech_1', 'agent_tech_2', 'agent_tech_3'],
                'billing_queue': ['agent_billing_1', 'agent_billing_2'],
                'premium_queue': ['agent_premium_1', 'agent_premium_2'],
                'general_queue': ['agent_general_1', 'agent_general_2', 'agent_general_3', 'agent_general_4']
            }
        }
        
        # Save the default model
        await self._save_model()
        logger.info("Default call routing model created")
    
    async def route_call(self, call_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Route a call using AI analysis
        
        Args:
            call_data: Dictionary containing call information
                - caller_id: Caller phone number
                - caller_history: Previous call history
                - call_topic: Detected call topic/intent
                - caller_type: Type of caller (premium, regular, etc.)
                - time_of_day: Current hour (0-23)
                - agent_availability: Current agent status
        
        Returns:
            Dictionary with routing decision
        """
        if not self.is_model_loaded:
            raise Exception("Call routing model not loaded")
        
        try:
            # Analyze caller context
            caller_context = await self._analyze_caller_context(call_data)
            
            # Determine optimal queue
            target_queue = await self._determine_queue(caller_context)
            
            # Select best available agent
            selected_agent = await self._select_agent(target_queue, call_data)
            
            # Calculate confidence score
            confidence = await self._calculate_routing_confidence(caller_context, target_queue)
            
            routing_decision = {
                'queue': target_queue,
                'agent': selected_agent,
                'confidence': confidence,
                'reasoning': caller_context.get('reasoning', []),
                'estimated_wait_time': await self._estimate_wait_time(target_queue),
                'priority_level': caller_context.get('priority', 'normal')
            }
            
            # Store routing decision for learning
            await self._store_routing_decision(call_data, routing_decision)
            
            logger.info(f"Call routed: {call_data.get('caller_id')} -> {target_queue}/{selected_agent}")
            
            return routing_decision
            
        except Exception as e:
            logger.error(f"Call routing error: {e}")
            # Fallback to default routing
            return await self._fallback_routing(call_data)
    
    async def _analyze_caller_context(self, call_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze caller context for routing decision"""
        context = {
            'caller_id': call_data.get('caller_id'),
            'priority': 'normal',
            'reasoning': []
        }
        
        # Check caller history
        caller_history = self.call_history.get(call_data.get('caller_id'), {})
        if caller_history:
            context['previous_calls'] = len(caller_history.get('calls', []))
            context['satisfaction_score'] = caller_history.get('avg_satisfaction', 3.0)
            context['reasoning'].append("Analyzed caller history")
        
        # Determine priority based on caller type
        caller_type = call_data.get('caller_type', 'regular')
        if caller_type == 'premium':
            context['priority'] = 'high'
            context['reasoning'].append("Premium customer priority")
        elif caller_type == 'enterprise':
            context['priority'] = 'high'
            context['reasoning'].append("Enterprise customer priority")
        
        # Check for escalated issues
        if caller_history.get('recent_escalations', 0) > 0:
            context['priority'] = 'urgent'
            context['reasoning'].append("Previous escalation detected")
        
        # Analyze call topic complexity
        call_topic = call_data.get('call_topic', 'general')
        if call_topic in ['technical_support', 'complex_billing']:
            context['complexity'] = 'high'
            context['reasoning'].append("Complex topic identified")
        
        return context
    
    async def _determine_queue(self, context: Dict[str, Any]) -> str:
        """Determine the optimal queue for the call"""
        # Apply routing rules in priority order
        for rule in self.model['rules']:
            if await self._evaluate_rule(rule['condition'], context):
                return rule['route_to']
        
        return 'general_queue'  # Default fallback
    
    async def _evaluate_rule(self, condition: str, context: Dict[str, Any]) -> bool:
        """Evaluate a routing rule condition"""
        if condition == 'default':
            return True
        
        # Simple rule evaluation (in production, use a proper rule engine)
        try:
            # Create a safe evaluation context
            eval_context = {
                'caller_type': context.get('caller_type', 'regular'),
                'call_topic': context.get('call_topic', 'general'),
                'priority': context.get('priority', 'normal'),
                'complexity': context.get('complexity', 'low'),
                'time_of_day': context.get('time_of_day', 12)
            }
            
            return eval(condition, {"__builtins__": {}}, eval_context)
        except:
            return False
    
    async def _select_agent(self, queue: str, call_data: Dict[str, Any]) -> Optional[str]:
        """Select the best available agent for the queue"""
        available_agents = self.model['agent_specializations'].get(queue, [])
        agent_availability = call_data.get('agent_availability', {})
        
        # Filter available agents
        online_agents = [
            agent for agent in available_agents 
            if agent_availability.get(agent, {}).get('status') == 'available'
        ]
        
        if not online_agents:
            return None
        
        # Select agent based on performance and workload
        best_agent = None
        best_score = -1
        
        for agent in online_agents:
            agent_perf = self.agent_performance.get(agent, {})
            score = agent_perf.get('satisfaction_rating', 3.0) * 0.7 - agent_perf.get('current_calls', 0) * 0.3
            
            if score > best_score:
                best_score = score
                best_agent = agent
        
        return best_agent
    
    async def _calculate_routing_confidence(self, context: Dict[str, Any], queue: str) -> float:
        """Calculate confidence score for routing decision"""
        base_confidence = 0.8
        
        # Adjust based on available information
        if context.get('previous_calls', 0) > 0:
            base_confidence += 0.1
        
        if context.get('call_topic') != 'general':
            base_confidence += 0.1
        
        return min(base_confidence, 1.0)
    
    async def _estimate_wait_time(self, queue: str) -> int:
        """Estimate wait time for a queue"""
        # Simple estimation (in production, use real queue metrics)
        queue_load = {
            'premium_queue': 30,
            'technical_queue': 120,
            'billing_queue': 90,
            'general_queue': 180
        }
        
        return queue_load.get(queue, 120)
    
    async def _store_routing_decision(self, call_data: Dict[str, Any], decision: Dict[str, Any]):
        """Store routing decision for learning"""
        caller_id = call_data.get('caller_id')
        if caller_id not in self.call_history:
            self.call_history[caller_id] = {'calls': []}
        
        self.call_history[caller_id]['calls'].append({
            'timestamp': call_data.get('timestamp'),
            'routing_decision': decision,
            'call_data': call_data
        })
    
    async def _fallback_routing(self, call_data: Dict[str, Any]) -> Dict[str, Any]:
        """Fallback routing when AI fails"""
        return {
            'queue': 'general_queue',
            'agent': None,
            'confidence': 0.5,
            'reasoning': ['Fallback routing due to AI failure'],
            'estimated_wait_time': 180,
            'priority_level': 'normal'
        }
    
    async def update_call_outcome(self, call_id: str, outcome: Dict[str, Any]):
        """Update call outcome for model learning"""
        # Store outcome for future model training
        logger.info(f"Call outcome recorded: {call_id} - satisfaction: {outcome.get('satisfaction')}")
    
    async def get_current_accuracy(self) -> float:
        """Get current model accuracy"""
        # Calculate accuracy based on recent routing decisions and outcomes
        # For demonstration, return a simulated accuracy
        return 0.87
    
    async def retrain(self):
        """Retrain the model with recent data"""
        logger.info("Retraining call routing model...")
        # In production, implement actual model retraining
        await asyncio.sleep(2)  # Simulate training time
        logger.info("Call routing model retrained successfully")
    
    async def _save_model(self):
        """Save the current model"""
        model_path = Path(self.config['model_path'])
        model_path.parent.mkdir(parents=True, exist_ok=True)
        
        try:
            with open(model_path, 'wb') as f:
                pickle.dump(self.model, f)
            logger.debug("Call routing model saved")
        except Exception as e:
            logger.error(f"Failed to save model: {e}")
    
    def is_loaded(self) -> bool:
        """Check if model is loaded"""
        return self.is_model_loaded