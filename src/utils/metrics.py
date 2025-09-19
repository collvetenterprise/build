"""
Metrics Collection System

Provides comprehensive metrics collection for phone server and
internet gateway components.
"""

import asyncio
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from collections import defaultdict, deque


class MetricsCollector:
    """Base metrics collector for system-wide metrics."""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.metrics_history = defaultdict(deque)
        self.start_time = time.time()
        
    async def collect_all(self) -> Dict[str, Any]:
        """Collect all available metrics."""
        return {
            'system': await self.get_system_metrics(),
            'performance': await self.get_performance_metrics(),
            'timestamp': datetime.now().isoformat()
        }
        
    async def get_system_metrics(self) -> Dict[str, Any]:
        """Get basic system metrics."""
        # Simulate system metrics collection
        return {
            'uptime': time.time() - self.start_time,
            'cpu_count': 4,
            'memory_total': 8192,  # MB
            'disk_space': 512000  # MB
        }
        
    async def get_performance_metrics(self) -> Dict[str, Any]:
        """Get performance metrics."""
        # Simulate performance metrics
        return {
            'cpu_usage': 45.2,
            'memory_usage': 62.8,
            'disk_usage': 34.1,
            'network_io': {'in': 1024, 'out': 2048}
        }
        
    async def get_performance_history(self, hours: int = 24) -> List[Dict[str, Any]]:
        """Get performance history for the specified number of hours."""
        # Simulate historical data
        history = []
        for i in range(hours):
            timestamp = datetime.now() - timedelta(hours=i)
            history.append({
                'timestamp': timestamp.isoformat(),
                'cpu_usage': 45.0 + (i % 10),
                'memory_usage': 60.0 + (i % 15),
                'response_time': 100 + (i % 50)
            })
        return history
        
    def record_metric(self, metric_name: str, value: Any):
        """Record a metric value with timestamp."""
        self.metrics_history[metric_name].append({
            'timestamp': datetime.now().isoformat(),
            'value': value
        })
        
        # Keep only last 1000 entries per metric
        if len(self.metrics_history[metric_name]) > 1000:
            self.metrics_history[metric_name].popleft()


class PhoneServerMetrics(MetricsCollector):
    """Metrics collector specific to phone server operations."""
    
    def __init__(self):
        super().__init__()
        self.call_metrics = {
            'total_calls': 0,
            'active_calls': 0,
            'completed_calls': 0,
            'failed_calls': 0,
            'average_duration': 0.0
        }
        
    def record_call_handled(self, call_id: str, routing_decision: Dict[str, Any]):
        """Record metrics for a handled call."""
        self.call_metrics['total_calls'] += 1
        self.call_metrics['active_calls'] += 1
        
        self.record_metric('call_handled', {
            'call_id': call_id,
            'routing_type': routing_decision.get('type'),
            'timestamp': datetime.now().isoformat()
        })
        
    def record_call_ended(self, call_id: str, duration: timedelta, reason: str):
        """Record metrics for an ended call."""
        self.call_metrics['active_calls'] = max(0, self.call_metrics['active_calls'] - 1)
        
        if reason == 'normal':
            self.call_metrics['completed_calls'] += 1
        else:
            self.call_metrics['failed_calls'] += 1
            
        duration_seconds = duration.total_seconds()
        self._update_average_duration(duration_seconds)
        
        self.record_metric('call_ended', {
            'call_id': call_id,
            'duration': duration_seconds,
            'reason': reason
        })
        
    def record_call_error(self, call_id: str, error: str):
        """Record call error metrics."""
        self.call_metrics['failed_calls'] += 1
        
        self.record_metric('call_error', {
            'call_id': call_id,
            'error': error,
            'timestamp': datetime.now().isoformat()
        })
        
    async def get_cpu_usage(self) -> float:
        """Get current CPU usage."""
        # Simulate CPU usage
        return 45.0 + (time.time() % 30)
        
    async def get_memory_usage(self) -> float:
        """Get current memory usage."""
        # Simulate memory usage
        return 60.0 + (time.time() % 25)
        
    async def get_error_rate(self) -> float:
        """Get current error rate."""
        total = self.call_metrics['total_calls']
        if total == 0:
            return 0.0
        return self.call_metrics['failed_calls'] / total
        
    async def get_recent_calls(self, minutes: int = 30) -> List[Dict[str, Any]]:
        """Get recent call data for analysis."""
        # Simulate recent calls data
        calls = []
        for i in range(10):  # Simulate 10 recent calls
            call_time = datetime.now() - timedelta(minutes=i*3)
            calls.append({
                'call_id': f'call_{i}',
                'timestamp': call_time.isoformat(),
                'source': f'192.168.1.{100+i}',
                'duration': 120 + (i * 30),
                'status': 'completed' if i % 4 != 0 else 'failed'
            })
        return calls
        
    async def get_system_metrics(self) -> Dict[str, Any]:
        """Get phone server specific system metrics."""
        base_metrics = await super().get_system_metrics()
        base_metrics.update({
            'call_metrics': self.call_metrics.copy(),
            'queue_length': 5,  # Simulate queue length
            'agent_count': 10,
            'available_agents': 7
        })
        return base_metrics
        
    def _update_average_duration(self, new_duration: float):
        """Update average call duration."""
        completed = self.call_metrics['completed_calls']
        if completed <= 1:
            self.call_metrics['average_duration'] = new_duration
        else:
            current_avg = self.call_metrics['average_duration']
            self.call_metrics['average_duration'] = (
                (current_avg * (completed - 1) + new_duration) / completed
            )


class NetworkMetrics(MetricsCollector):
    """Metrics collector specific to network/gateway operations."""
    
    def __init__(self):
        super().__init__()
        self.network_metrics = {
            'total_connections': 0,
            'active_connections': 0,
            'bytes_transferred': 0,
            'packets_processed': 0,
            'threats_detected': 0,
            'threats_blocked': 0
        }
        
    def record_traffic_processed(self, connection_id: str, traffic_analysis: Dict[str, Any]):
        """Record metrics for processed traffic."""
        self.network_metrics['total_connections'] += 1
        self.network_metrics['active_connections'] += 1
        
        bytes_count = traffic_analysis.get('bytes', 0)
        self.network_metrics['bytes_transferred'] += bytes_count
        self.network_metrics['packets_processed'] += traffic_analysis.get('packets', 1)
        
        self.record_metric('traffic_processed', {
            'connection_id': connection_id,
            'bytes': bytes_count,
            'protocol': traffic_analysis.get('protocol', 'unknown'),
            'timestamp': datetime.now().isoformat()
        })
        
    def record_connection_closed(self, connection_id: str, duration: timedelta, 
                               bytes_transferred: int, reason: str):
        """Record metrics for a closed connection."""
        self.network_metrics['active_connections'] = max(0, self.network_metrics['active_connections'] - 1)
        
        self.record_metric('connection_closed', {
            'connection_id': connection_id,
            'duration': duration.total_seconds(),
            'bytes_transferred': bytes_transferred,
            'reason': reason
        })
        
    def record_threat_detected(self, threat_type: str, severity: str, blocked: bool):
        """Record threat detection metrics."""
        self.network_metrics['threats_detected'] += 1
        if blocked:
            self.network_metrics['threats_blocked'] += 1
            
        self.record_metric('threat_detected', {
            'type': threat_type,
            'severity': severity,
            'blocked': blocked,
            'timestamp': datetime.now().isoformat()
        })
        
    def record_traffic_error(self, connection_id: str, error: str):
        """Record traffic processing error."""
        self.record_metric('traffic_error', {
            'connection_id': connection_id,
            'error': error,
            'timestamp': datetime.now().isoformat()
        })
        
    async def get_bandwidth_utilization(self) -> float:
        """Get current bandwidth utilization percentage."""
        # Simulate bandwidth utilization
        return 65.0 + (time.time() % 20)
        
    async def get_average_latency(self) -> float:
        """Get average network latency in milliseconds."""
        # Simulate latency
        return 25.0 + (time.time() % 10)
        
    async def get_packet_loss_rate(self) -> float:
        """Get packet loss rate as percentage."""
        # Simulate packet loss rate
        return 0.001 + (time.time() % 0.01)
        
    async def get_traffic_patterns(self) -> Dict[str, Any]:
        """Get current traffic patterns for analysis."""
        return {
            'top_protocols': [
                {'protocol': 'HTTPS', 'percentage': 60.0},
                {'protocol': 'HTTP', 'percentage': 20.0},
                {'protocol': 'SSH', 'percentage': 10.0},
                {'protocol': 'FTP', 'percentage': 5.0},
                {'protocol': 'Other', 'percentage': 5.0}
            ],
            'traffic_by_hour': [
                {'hour': i, 'bytes': 1024000 + (i * 50000)} 
                for i in range(24)
            ],
            'geographic_distribution': {
                'US': 45.0,
                'EU': 30.0,
                'Asia': 20.0,
                'Other': 5.0
            }
        }
        
    async def get_recent_traffic(self, minutes: int = 5) -> List[Dict[str, Any]]:
        """Get recent traffic data for threat analysis."""
        traffic = []
        for i in range(50):  # Simulate 50 recent connections
            timestamp = datetime.now() - timedelta(minutes=i/10)
            traffic.append({
                'connection_id': f'conn_{i}',
                'timestamp': timestamp.isoformat(),
                'source_ip': f'192.168.1.{100 + (i % 50)}',
                'destination': f'server{i % 5}.example.com',
                'protocol': ['HTTPS', 'HTTP', 'SSH'][i % 3],
                'bytes': 1024 + (i * 100),
                'status': 'normal' if i % 10 != 0 else 'suspicious'
            })
        return traffic
        
    async def get_network_health(self) -> Dict[str, Any]:
        """Get comprehensive network health metrics."""
        return {
            'bandwidth_utilization': await self.get_bandwidth_utilization(),
            'latency': await self.get_average_latency(),
            'packet_loss': await self.get_packet_loss_rate(),
            'connection_count': self.network_metrics['active_connections'],
            'error_rate': self._calculate_error_rate(),
            'threat_level': self._calculate_threat_level()
        }
        
    def _calculate_error_rate(self) -> float:
        """Calculate current error rate."""
        # Simulate error rate calculation
        return 0.02  # 2% error rate
        
    def _calculate_threat_level(self) -> str:
        """Calculate current threat level."""
        detected = self.network_metrics['threats_detected']
        if detected > 100:
            return 'high'
        elif detected > 50:
            return 'medium'
        else:
            return 'low'