"""
AI-Driven Internet Gateway Manager

Implements smart traffic management, threat detection, QoS optimization,
and self-healing network capabilities for internet gateway systems.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple

try:
    from ..ai_models.traffic_ai import TrafficManagementAI
    from ..ai_models.threat_detection import ThreatDetectionSystem
    from ..ai_models.qos_optimizer import QoSOptimizer
    from ..ai_models.network_healing import NetworkHealingEngine
    from ..apis.network import NetworkAPIManager
    from ..utils.metrics import NetworkMetrics
except ImportError:
    # For direct execution
    import sys
    from pathlib import Path
    sys.path.append(str(Path(__file__).parent.parent))
    from ai_models.traffic_ai import TrafficManagementAI
    from ai_models.threat_detection import ThreatDetectionSystem
    from ai_models.qos_optimizer import QoSOptimizer
    from ai_models.network_healing import NetworkHealingEngine
    from apis.network import NetworkAPIManager
    from utils.metrics import NetworkMetrics


class InternetGatewayManager:
    """
    Manages AI-driven internet gateway functionality including smart traffic
    management, threat detection, QoS optimization, and self-healing networks.
    """
    
    def __init__(self, config):
        self.config = config
        self.logger = logging.getLogger(__name__)
        
        # AI-powered components
        self.traffic_ai = TrafficManagementAI(config)
        self.threat_detector = ThreatDetectionSystem(config)
        self.qos_optimizer = QoSOptimizer(config)
        self.healing_engine = NetworkHealingEngine(config)
        
        # Network management
        self.network_api = NetworkAPIManager(config)
        self.metrics = NetworkMetrics()
        
        # Gateway state
        self.active_connections = {}
        self.traffic_flows = {}
        self.threat_alerts = []
        self.network_health = {
            'bandwidth_utilization': 0.0,
            'latency': 0.0,
            'packet_loss': 0.0,
            'connection_count': 0,
            'threat_level': 'low'
        }
        
        # Traffic management rules
        self.traffic_rules = []
        self.qos_policies = {}
        self.blocked_ips = set()
        
        self.running = False
        
    async def start(self):
        """Start the AI-driven internet gateway."""
        self.logger.info("Starting AI-Driven Internet Gateway...")
        self.running = True
        
        # Initialize AI components
        await asyncio.gather(
            self.traffic_ai.initialize(),
            self.threat_detector.initialize(),
            self.qos_optimizer.initialize(),
            self.healing_engine.initialize()
        )
        
        # Start gateway components
        asyncio.create_task(self._traffic_management_loop())
        asyncio.create_task(self._threat_monitoring_loop())
        asyncio.create_task(self._qos_optimization_loop())
        asyncio.create_task(self._network_healing_loop())
        asyncio.create_task(self._connection_monitoring_loop())
        
        # Initialize network API connections
        await self.network_api.connect()
        
        # Load initial traffic rules and policies
        await self._load_traffic_rules()
        await self._load_qos_policies()
        
        self.logger.info("AI-Driven Internet Gateway started")
        
    async def stop(self):
        """Stop the internet gateway gracefully."""
        self.logger.info("Stopping AI-Driven Internet Gateway...")
        self.running = False
        
        # Gracefully close active connections
        for conn_id in list(self.active_connections.keys()):
            await self._close_connection(conn_id, reason="gateway_shutdown")
            
        # Shutdown AI components
        await asyncio.gather(
            self.traffic_ai.shutdown(),
            self.threat_detector.shutdown(),
            self.qos_optimizer.shutdown(),
            self.healing_engine.shutdown(),
            return_exceptions=True
        )
        
        await self.network_api.disconnect()
        
        self.logger.info("AI-Driven Internet Gateway stopped")
        
    async def health_check(self) -> Dict[str, Any]:
        """Perform comprehensive health check."""
        health_status = {
            'healthy': self.running,
            'network_metrics': self.network_health.copy(),
            'ai_components': {
                'traffic_ai': await self.traffic_ai.health_check(),
                'threat_detector': await self.threat_detector.health_check(),
                'qos_optimizer': await self.qos_optimizer.health_check(),
                'healing_engine': await self.healing_engine.health_check()
            },
            'network_api': await self.network_api.health_check(),
            'active_connections': len(self.active_connections),
            'threat_alerts': len([alert for alert in self.threat_alerts 
                                if alert['timestamp'] > datetime.now() - timedelta(hours=1)])
        }
        
        # Determine overall health
        health_status['healthy'] = (
            health_status['healthy'] and
            all(component['healthy'] for component in health_status['ai_components'].values()) and
            health_status['network_api']['healthy'] and
            health_status['network_metrics']['packet_loss'] < 0.01 and
            health_status['network_metrics']['latency'] < 100.0
        )
        
        return health_status
        
    async def process_traffic(self, traffic_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process incoming traffic with AI-driven analysis and routing."""
        connection_id = traffic_data.get('connection_id')
        source_ip = traffic_data.get('source_ip')
        destination = traffic_data.get('destination')
        
        try:
            self.logger.debug(f"Processing traffic: {connection_id} from {source_ip}")
            
            # Step 1: Threat detection analysis
            threat_result = await self.threat_detector.analyze_traffic(traffic_data)
            if threat_result['is_threat']:
                return await self._handle_threat(connection_id, traffic_data, threat_result)
                
            # Step 2: Traffic classification and analysis
            traffic_analysis = await self.traffic_ai.analyze_traffic(traffic_data)
            
            # Step 3: Apply QoS policies
            qos_decision = await self.qos_optimizer.apply_policies(
                traffic_data, traffic_analysis
            )
            
            # Step 4: Smart traffic routing
            routing_decision = await self.traffic_ai.route_traffic(
                traffic_data, traffic_analysis, qos_decision
            )
            
            # Step 5: Execute traffic management
            result = await self._execute_traffic_management(
                connection_id, traffic_data, routing_decision
            )
            
            # Track connection
            self.active_connections[connection_id] = {
                'start_time': datetime.now(),
                'source_ip': source_ip,
                'destination': destination,
                'traffic_analysis': traffic_analysis,
                'qos_class': qos_decision.get('class', 'normal'),
                'bytes_transferred': 0,
                'status': 'active'
            }
            
            # Update metrics
            self.metrics.record_traffic_processed(connection_id, traffic_analysis)
            
            return result
            
        except Exception as e:
            self.logger.error(f"Error processing traffic {connection_id}: {e}")
            await self._handle_traffic_error(connection_id, traffic_data, str(e))
            raise
            
    async def _execute_traffic_management(self, connection_id: str, 
                                        traffic_data: Dict[str, Any],
                                        routing_decision: Dict[str, Any]) -> Dict[str, Any]:
        """Execute AI-generated traffic management decisions."""
        action = routing_decision.get('action')
        priority = routing_decision.get('priority', 'normal')
        bandwidth_limit = routing_decision.get('bandwidth_limit')
        
        self.logger.debug(f"Executing traffic management for {connection_id}: {action}")
        
        result = {
            'connection_id': connection_id,
            'action': action,
            'status': 'success'
        }
        
        if action == 'allow':
            # Apply bandwidth and priority settings
            await self.network_api.set_connection_priority(connection_id, priority)
            if bandwidth_limit:
                await self.network_api.set_bandwidth_limit(connection_id, bandwidth_limit)
                
        elif action == 'throttle':
            # Apply throttling based on analysis
            throttle_rate = routing_decision.get('throttle_rate', 0.5)
            await self.network_api.throttle_connection(connection_id, throttle_rate)
            
        elif action == 'block':
            # Block the connection
            await self.network_api.block_connection(connection_id)
            result['status'] = 'blocked'
            
        elif action == 'redirect':
            # Redirect to alternative route
            redirect_target = routing_decision.get('redirect_target')
            await self.network_api.redirect_connection(connection_id, redirect_target)
            
        elif action == 'cache':
            # Apply intelligent caching
            cache_params = routing_decision.get('cache_params', {})
            await self.network_api.enable_caching(connection_id, cache_params)
            
        return result
        
    async def _handle_threat(self, connection_id: str, traffic_data: Dict[str, Any], 
                           threat_result: Dict[str, Any]) -> Dict[str, Any]:
        """Handle detected threats with appropriate responses."""
        threat_type = threat_result.get('type')
        severity = threat_result.get('severity', 'medium')
        source_ip = traffic_data.get('source_ip')
        
        self.logger.warning(f"Threat detected: {threat_type} from {source_ip} (severity: {severity})")
        
        # Record threat alert
        alert = {
            'timestamp': datetime.now(),
            'connection_id': connection_id,
            'source_ip': source_ip,
            'threat_type': threat_type,
            'severity': severity,
            'details': threat_result
        }
        self.threat_alerts.append(alert)
        
        # Take appropriate action based on severity
        if severity == 'critical':
            # Immediate block and add to blacklist
            await self.network_api.block_connection(connection_id)
            self.blocked_ips.add(source_ip)
            await self.network_api.add_to_blacklist(source_ip)
            
            # Trigger incident response
            await self._trigger_incident_response(alert)
            
        elif severity == 'high':
            # Block connection and monitor
            await self.network_api.block_connection(connection_id)
            await self._enhanced_monitoring(source_ip)
            
        elif severity == 'medium':
            # Throttle and monitor
            await self.network_api.throttle_connection(connection_id, rate=0.1)
            await self._monitor_connection(connection_id)
            
        else:  # low severity
            # Log and continue monitoring
            await self._monitor_connection(connection_id)
            
        return {
            'connection_id': connection_id,
            'action': 'threat_handled',
            'threat_type': threat_type,
            'severity': severity,
            'status': 'blocked' if severity in ['critical', 'high'] else 'monitored'
        }
        
    async def _traffic_management_loop(self):
        """Main loop for AI-driven traffic management."""
        while self.running:
            try:
                # Analyze current traffic patterns
                traffic_patterns = await self.metrics.get_traffic_patterns()
                
                # Generate traffic management decisions
                management_decisions = await self.traffic_ai.optimize_traffic(
                    traffic_patterns, self.network_health
                )
                
                # Apply traffic management decisions
                for decision in management_decisions:
                    await self._apply_traffic_decision(decision)
                    
                # Update traffic rules based on learning
                new_rules = await self.traffic_ai.generate_traffic_rules(traffic_patterns)
                await self._update_traffic_rules(new_rules)
                
            except Exception as e:
                self.logger.error(f"Traffic management loop error: {e}")
                
            await asyncio.sleep(60)  # Optimize every minute
            
    async def _threat_monitoring_loop(self):
        """Continuous threat monitoring and detection."""
        while self.running:
            try:
                # Analyze network traffic for threats
                recent_traffic = await self.metrics.get_recent_traffic(minutes=5)
                
                # Detect new threat patterns
                threat_patterns = await self.threat_detector.analyze_patterns(recent_traffic)
                
                if threat_patterns:
                    self.logger.warning(f"New threat patterns detected: {threat_patterns}")
                    
                    # Update threat detection models
                    await self.threat_detector.update_models(threat_patterns)
                    
                    # Take proactive measures
                    await self._proactive_threat_response(threat_patterns)
                    
                # Clean up old alerts
                self._cleanup_old_alerts()
                
            except Exception as e:
                self.logger.error(f"Threat monitoring error: {e}")
                
            await asyncio.sleep(30)  # Check every 30 seconds
            
    async def _qos_optimization_loop(self):
        """Continuous QoS optimization using reinforcement learning."""
        while self.running:
            try:
                # Collect performance metrics
                performance_data = await self.metrics.get_performance_metrics()
                
                # Optimize QoS policies
                optimizations = await self.qos_optimizer.optimize_policies(
                    performance_data, self.qos_policies
                )
                
                if optimizations:
                    self.logger.info(f"Applying QoS optimizations: {optimizations}")
                    await self._apply_qos_optimizations(optimizations)
                    
                # Learn from user behavior
                user_behavior = await self.metrics.get_user_behavior_patterns()
                await self.qos_optimizer.learn_from_behavior(user_behavior)
                
            except Exception as e:
                self.logger.error(f"QoS optimization error: {e}")
                
            await asyncio.sleep(300)  # Optimize every 5 minutes
            
    async def _network_healing_loop(self):
        """Self-healing network monitoring and recovery."""
        while self.running:
            try:
                # Monitor network health
                health_metrics = await self.metrics.get_network_health()
                
                # Detect network issues
                issues = await self.healing_engine.detect_issues(health_metrics)
                
                if issues:
                    self.logger.warning(f"Network issues detected: {issues}")
                    
                    # Generate healing plans
                    for issue in issues:
                        healing_plan = await self.healing_engine.generate_healing_plan(issue)
                        await self._execute_healing_plan(issue, healing_plan)
                        
                # Proactive health optimization
                optimizations = await self.healing_engine.suggest_optimizations(
                    health_metrics
                )
                await self._apply_health_optimizations(optimizations)
                
            except Exception as e:
                self.logger.error(f"Network healing error: {e}")
                
            await asyncio.sleep(120)  # Check every 2 minutes
            
    async def _connection_monitoring_loop(self):
        """Monitor active connections and update metrics."""
        while self.running:
            try:
                # Update network health metrics
                self.network_health.update({
                    'bandwidth_utilization': await self.metrics.get_bandwidth_utilization(),
                    'latency': await self.metrics.get_average_latency(),
                    'packet_loss': await self.metrics.get_packet_loss_rate(),
                    'connection_count': len(self.active_connections),
                    'threat_level': self._calculate_threat_level()
                })
                
                # Clean up completed connections
                await self._cleanup_completed_connections()
                
                # Update connection statistics
                for conn_id, conn_info in self.active_connections.items():
                    bytes_transferred = await self.network_api.get_bytes_transferred(conn_id)
                    conn_info['bytes_transferred'] = bytes_transferred
                    
            except Exception as e:
                self.logger.error(f"Connection monitoring error: {e}")
                
            await asyncio.sleep(30)
            
    async def _apply_traffic_decision(self, decision: Dict[str, Any]):
        """Apply a traffic management decision."""
        decision_type = decision.get('type')
        target = decision.get('target')
        params = decision.get('params', {})
        
        self.logger.debug(f"Applying traffic decision: {decision_type} for {target}")
        
        try:
            if decision_type == 'bandwidth_adjustment':
                await self.network_api.adjust_bandwidth(target, params['new_limit'])
            elif decision_type == 'priority_change':
                await self.network_api.set_priority(target, params['priority'])
            elif decision_type == 'route_optimization':
                await self.network_api.optimize_route(target, params['route'])
            elif decision_type == 'load_balancing':
                await self.network_api.balance_load(target, params['distribution'])
                
        except Exception as e:
            self.logger.error(f"Failed to apply traffic decision: {e}")
            
    async def _trigger_incident_response(self, alert: Dict[str, Any]):
        """Trigger incident response for critical threats."""
        self.logger.critical(f"Triggering incident response for: {alert}")
        
        # Notify security team
        await self.network_api.send_security_alert(alert)
        
        # Implement additional security measures
        await self.network_api.enable_enhanced_monitoring()
        
        # Update threat intelligence
        await self.threat_detector.report_incident(alert)
        
    async def _execute_healing_plan(self, issue: Dict[str, Any], 
                                  healing_plan: Dict[str, Any]):
        """Execute a network healing plan."""
        self.logger.info(f"Executing healing plan for {issue['type']}: {healing_plan}")
        
        try:
            for action in healing_plan.get('actions', []):
                if action['type'] == 'restart_service':
                    await self.network_api.restart_service(action['service'])
                elif action['type'] == 'reroute_traffic':
                    await self.network_api.reroute_traffic(action['from'], action['to'])
                elif action['type'] == 'scale_resources':
                    await self.network_api.scale_resources(action['resource'], action['factor'])
                elif action['type'] == 'update_config':
                    await self.network_api.update_config(action['component'], action['config'])
                    
        except Exception as e:
            self.logger.error(f"Failed to execute healing plan: {e}")
            
    def _calculate_threat_level(self) -> str:
        """Calculate current threat level based on recent alerts."""
        recent_alerts = [alert for alert in self.threat_alerts 
                        if alert['timestamp'] > datetime.now() - timedelta(hours=1)]
        
        if not recent_alerts:
            return 'low'
            
        critical_count = sum(1 for alert in recent_alerts if alert['severity'] == 'critical')
        high_count = sum(1 for alert in recent_alerts if alert['severity'] == 'high')
        
        if critical_count > 0:
            return 'critical'
        elif high_count > 3:
            return 'high'
        elif len(recent_alerts) > 10:
            return 'medium'
        else:
            return 'low'
            
    def _cleanup_old_alerts(self):
        """Clean up alerts older than 24 hours."""
        cutoff_time = datetime.now() - timedelta(hours=24)
        self.threat_alerts = [alert for alert in self.threat_alerts 
                             if alert['timestamp'] > cutoff_time]
        
    async def _cleanup_completed_connections(self):
        """Clean up connections that have been completed."""
        completed_connections = []
        
        for conn_id, conn_info in self.active_connections.items():
            if await self.network_api.is_connection_closed(conn_id):
                completed_connections.append(conn_id)
                
        for conn_id in completed_connections:
            await self._close_connection(conn_id, reason="completed")
            
    async def _close_connection(self, connection_id: str, reason: str = "normal"):
        """Close a connection and clean up resources."""
        if connection_id in self.active_connections:
            conn_info = self.active_connections[connection_id]
            duration = datetime.now() - conn_info['start_time']
            
            # Update metrics
            self.metrics.record_connection_closed(
                connection_id, duration, conn_info['bytes_transferred'], reason
            )
            
            # Clean up
            del self.active_connections[connection_id]
            
        await self.network_api.close_connection(connection_id)
        
    async def _load_traffic_rules(self):
        """Load initial traffic management rules."""
        # Load from configuration or previous learning
        self.traffic_rules = self.config.get('traffic_rules', [])
        
    async def _load_qos_policies(self):
        """Load QoS policies."""
        # Load from configuration
        self.qos_policies = self.config.get('qos_policies', {})
        
    async def _update_traffic_rules(self, new_rules: List[Dict[str, Any]]):
        """Update traffic rules based on AI learning."""
        if new_rules:
            self.traffic_rules.extend(new_rules)
            self.logger.info(f"Updated traffic rules: {len(new_rules)} new rules added")
            
    async def _apply_qos_optimizations(self, optimizations: List[Dict[str, Any]]):
        """Apply QoS optimizations."""
        for optimization in optimizations:
            policy_name = optimization.get('policy')
            new_params = optimization.get('params')
            
            if policy_name in self.qos_policies:
                self.qos_policies[policy_name].update(new_params)
                await self.network_api.update_qos_policy(policy_name, new_params)
                
    async def _apply_health_optimizations(self, optimizations: List[Dict[str, Any]]):
        """Apply network health optimizations."""
        for optimization in optimizations:
            opt_type = optimization.get('type')
            params = optimization.get('params', {})
            
            if opt_type == 'buffer_optimization':
                await self.network_api.optimize_buffers(params)
            elif opt_type == 'congestion_control':
                await self.network_api.adjust_congestion_control(params)
            elif opt_type == 'routing_optimization':
                await self.network_api.optimize_routing(params)
                
    async def _enhanced_monitoring(self, ip_address: str):
        """Enable enhanced monitoring for suspicious IP."""
        await self.network_api.enable_enhanced_monitoring(ip_address)
        
    async def _monitor_connection(self, connection_id: str):
        """Start monitoring a specific connection."""
        await self.network_api.monitor_connection(connection_id)
        
    async def _proactive_threat_response(self, threat_patterns: List[Dict[str, Any]]):
        """Take proactive measures against detected threat patterns."""
        for pattern in threat_patterns:
            if pattern['confidence'] > 0.8:
                # High confidence pattern - take immediate action
                await self.network_api.implement_threat_countermeasures(pattern)
                
    async def _handle_traffic_error(self, connection_id: str, 
                                  traffic_data: Dict[str, Any], error: str):
        """Handle traffic processing errors."""
        self.logger.error(f"Traffic error for {connection_id}: {error}")
        
        # Record error metrics
        self.metrics.record_traffic_error(connection_id, error)
        
        # Attempt graceful handling
        try:
            await self.network_api.handle_connection_error(connection_id)
        except Exception:
            pass  # Best effort