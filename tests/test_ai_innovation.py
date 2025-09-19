"""
Test AI Innovation Engine

Basic tests to validate the core functionality of the AI innovation system.
"""

import pytest
import asyncio
import sys
from pathlib import Path

# Add src to path for imports
sys.path.append(str(Path(__file__).parent.parent / 'src'))

from main import AIInnovationEngine
from utils.config import ConfigManager


@pytest.fixture
def config_manager():
    """Create a test configuration manager."""
    return ConfigManager()


@pytest.fixture
async def ai_engine(config_manager):
    """Create an AI innovation engine for testing."""
    engine = AIInnovationEngine()
    yield engine
    if engine.running:
        await engine.stop()


class TestConfigManager:
    """Test configuration management."""
    
    def test_default_config_loading(self, config_manager):
        """Test that default configuration loads correctly."""
        assert config_manager.get('logging.level') == 'INFO'
        assert config_manager.get('phone_server.enabled') is True
        assert config_manager.get('internet_gateway.enabled') is True
        
    def test_nested_config_access(self, config_manager):
        """Test nested configuration access."""
        assert config_manager.get('ai_models.update_interval') == 3600
        assert config_manager.get('automation.self_healing.enabled') is True
        
    def test_config_defaults(self, config_manager):
        """Test configuration defaults for missing values."""
        assert config_manager.get('nonexistent.key', 'default') == 'default'
        assert config_manager.get('missing.nested.key') is None


class TestAIInnovationEngine:
    """Test the main AI innovation engine."""
    
    @pytest.mark.asyncio
    async def test_engine_initialization(self, ai_engine):
        """Test that the AI engine initializes correctly."""
        assert not ai_engine.running
        assert ai_engine.config is not None
        assert ai_engine.orchestrator is not None
        assert ai_engine.phone_server is not None
        assert ai_engine.gateway is not None
        
    @pytest.mark.asyncio
    async def test_engine_health_monitoring(self, ai_engine):
        """Test health monitoring functionality."""
        # Start the engine components
        await ai_engine.orchestrator.start()
        await ai_engine.phone_server.start()
        await ai_engine.gateway.start()
        
        # Check health status
        orchestrator_health = await ai_engine.orchestrator.health_check()
        phone_health = await ai_engine.phone_server.health_check()
        gateway_health = await ai_engine.gateway.health_check()
        
        assert orchestrator_health['healthy'] is True
        assert phone_health['healthy'] is True
        assert gateway_health['healthy'] is True
        
        # Cleanup
        await ai_engine.orchestrator.stop()
        await ai_engine.phone_server.stop()
        await ai_engine.gateway.stop()


class TestPhoneServerManager:
    """Test phone server functionality."""
    
    @pytest.mark.asyncio
    async def test_call_handling(self):
        """Test basic call handling functionality."""
        from phone_server.manager import PhoneServerManager
        from utils.config import ConfigManager
        
        config = ConfigManager()
        phone_server = PhoneServerManager(config)
        
        await phone_server.start()
        
        # Test call data
        call_data = {
            'call_id': 'test_call_001',
            'caller_number': '+1234567890',
            'caller_name': 'Test Caller',
            'intent': 'general'
        }
        
        # Handle the call
        call_id = await phone_server.handle_incoming_call(call_data)
        assert call_id == 'test_call_001'
        assert call_id in phone_server.active_calls
        
        # Check call status
        call_info = phone_server.active_calls[call_id]
        assert call_info['status'] == 'active'
        assert call_info['call_data']['caller_number'] == '+1234567890'
        
        await phone_server.stop()


class TestInternetGatewayManager:
    """Test internet gateway functionality."""
    
    @pytest.mark.asyncio
    async def test_traffic_processing(self):
        """Test basic traffic processing functionality."""
        from internet_gateway.manager import InternetGatewayManager
        from utils.config import ConfigManager
        
        config = ConfigManager()
        gateway = InternetGatewayManager(config)
        
        await gateway.start()
        
        # Test traffic data
        traffic_data = {
            'connection_id': 'conn_001',
            'source_ip': '192.168.1.100',
            'destination': 'example.com',
            'protocol': 'HTTPS',
            'bytes': 1024
        }
        
        # Process the traffic
        result = await gateway.process_traffic(traffic_data)
        assert result['connection_id'] == 'conn_001'
        assert result['status'] in ['success', 'blocked', 'monitored']
        
        await gateway.stop()


class TestAutomationOrchestrator:
    """Test automation orchestration functionality."""
    
    @pytest.mark.asyncio
    async def test_orchestrator_startup(self):
        """Test orchestrator startup and health check."""
        from automation.orchestrator import AutomationOrchestrator
        from utils.config import ConfigManager
        
        config = ConfigManager()
        orchestrator = AutomationOrchestrator(config)
        
        await orchestrator.start()
        
        health = await orchestrator.health_check()
        assert health['healthy'] is True
        assert health['status'] == 'running'
        
        await orchestrator.stop()
        
    @pytest.mark.asyncio
    async def test_healing_plan_generation(self):
        """Test healing plan generation."""
        from automation.orchestrator import AutomationOrchestrator
        from utils.config import ConfigManager
        
        config = ConfigManager()
        orchestrator = AutomationOrchestrator(config)
        
        await orchestrator.start()
        
        # Test healing plan for unhealthy component
        system_state = {
            'phone_server': {'status': 'degraded', 'health': 0.4}
        }
        
        healing_plan = await orchestrator.generate_healing_plan('phone_server', system_state)
        
        assert healing_plan['component'] == 'phone_server'
        assert healing_plan['health_score'] == 0.4
        assert len(healing_plan['actions']) > 0
        
        # Should include restart action for low health
        action_types = [action['type'] for action in healing_plan['actions']]
        assert 'restart' in action_types
        
        await orchestrator.stop()


class TestAIModels:
    """Test AI model functionality."""
    
    @pytest.mark.asyncio
    async def test_orchestration_ai(self):
        """Test orchestration AI model."""
        from ai_models.orchestration_ai import OrchestrationAI
        from utils.config import ConfigManager
        
        config = ConfigManager()
        ai_model = OrchestrationAI(config)
        
        await ai_model.initialize()
        
        assert await ai_model.is_healthy()
        
        # Test metrics analysis
        metrics = {
            'performance': {
                'cpu_usage': 0.85,
                'memory_usage': 0.75,
                'response_time': 200
            }
        }
        
        policies = {
            'scaling': {
                'cpu_threshold': 0.8
            }
        }
        
        decisions = await ai_model.analyze_metrics(metrics, policies)
        assert isinstance(decisions, list)
        
        # Should generate decisions for high CPU usage
        if decisions:
            assert any(decision.get('action') == 'scale_up' for decision in decisions)
        
        await ai_model.shutdown()
        
    @pytest.mark.asyncio
    async def test_call_routing_ai(self):
        """Test call routing AI model."""
        from ai_models.call_routing_ai import CallRoutingAI
        from utils.config import ConfigManager
        
        config = ConfigManager()
        routing_ai = CallRoutingAI(config)
        
        await routing_ai.initialize()
        
        health = await routing_ai.health_check()
        assert health['healthy'] is True
        
        # Test call routing
        call_data = {
            'caller_number': '+1234567890',
            'intent': 'billing',
            'priority': 'normal'
        }
        
        routing_decision = await routing_ai.route_call(call_data)
        
        assert 'type' in routing_decision
        assert routing_decision['type'] in ['agent', 'ivr', 'automated_response', 'callback']
        
        if routing_decision['type'] == 'agent':
            assert 'target' in routing_decision
            
        await routing_ai.shutdown()


if __name__ == '__main__':
    # Run tests
    pytest.main([__file__, '-v'])