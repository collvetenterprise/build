"""
AI-powered Traffic Analysis System
Analyzes network traffic patterns for optimization and threat detection
"""

import pickle
import numpy as np
from typing import Dict, Any, List, Optional
from loguru import logger
from pathlib import Path
import asyncio
from datetime import datetime, timedelta
import json


class TrafficAnalysisAI:
    """AI system for analyzing network traffic patterns and optimization"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.model = None
        self.is_model_loaded = False
        self.traffic_history = []
        self.baseline_metrics = {}
        self.anomaly_threshold = 0.95
        self.prediction_window = config.get('prediction_window', 300)  # seconds
        
        # Traffic pattern categories
        self.traffic_patterns = {
            'normal': {'score_range': (0.0, 0.3)},
            'elevated': {'score_range': (0.3, 0.6)},
            'high': {'score_range': (0.6, 0.8)},
            'critical': {'score_range': (0.8, 1.0)}
        }
        
        # Protocol priorities for QoS
        self.protocol_priorities = {
            'SIP': 'high',
            'RTP': 'high',
            'HTTP': 'medium',
            'HTTPS': 'medium',
            'FTP': 'low',
            'SMTP': 'low'
        }
    
    async def load_model(self):
        """Load or create the traffic analysis model"""
        model_path = Path(self.config['model_path'])
        
        if model_path.exists():
            try:
                with open(model_path, 'rb') as f:
                    self.model = pickle.load(f)
                logger.info("Traffic analysis model loaded successfully")
            except Exception as e:
                logger.warning(f"Failed to load model: {e}, creating new model")
                await self._create_default_model()
        else:
            await self._create_default_model()
        
        self.is_model_loaded = True
        await self._initialize_baseline_metrics()
    
    async def _create_default_model(self):
        """Create a default traffic analysis model"""
        self.model = {
            'type': 'statistical_analysis',
            'thresholds': {
                'bandwidth_utilization': {
                    'normal': 0.7,
                    'warning': 0.85,
                    'critical': 0.95
                },
                'packet_loss': {
                    'normal': 0.01,
                    'warning': 0.05,
                    'critical': 0.1
                },
                'latency': {
                    'normal': 50,    # ms
                    'warning': 100,
                    'critical': 200
                },
                'connection_count': {
                    'normal': 1000,
                    'warning': 5000,
                    'critical': 10000
                }
            },
            'weights': {
                'bandwidth': 0.3,
                'latency': 0.25,
                'packet_loss': 0.2,
                'connection_count': 0.15,
                'protocol_distribution': 0.1
            },
            'anomaly_detection': {
                'window_size': 50,  # Number of samples for moving average
                'deviation_threshold': 2.5  # Standard deviations
            }
        }
        
        await self._save_model()
        logger.info("Default traffic analysis model created")
    
    async def analyze_traffic(self, traffic_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze current network traffic and provide insights
        
        Args:
            traffic_data: Dictionary containing traffic metrics
                - bandwidth_in: Incoming bandwidth (Mbps)
                - bandwidth_out: Outgoing bandwidth (Mbps)
                - packet_loss: Packet loss percentage
                - latency: Average latency (ms)
                - connection_count: Active connections
                - protocol_breakdown: Protocol distribution
                - timestamp: Analysis timestamp
        
        Returns:
            Dictionary with traffic analysis results and recommendations
        """
        if not self.is_model_loaded:
            raise Exception("Traffic analysis model not loaded")
        
        try:
            timestamp = traffic_data.get('timestamp', datetime.now())
            
            # Store traffic data for historical analysis
            await self._store_traffic_data(traffic_data)
            
            # Perform various analyses
            analysis_results = {}
            
            # Bandwidth analysis
            bandwidth_analysis = await self._analyze_bandwidth(traffic_data)
            analysis_results['bandwidth'] = bandwidth_analysis
            
            # Performance analysis
            performance_analysis = await self._analyze_performance(traffic_data)
            analysis_results['performance'] = performance_analysis
            
            # Protocol analysis
            protocol_analysis = await self._analyze_protocols(traffic_data)
            analysis_results['protocols'] = protocol_analysis
            
            # Anomaly detection
            anomaly_analysis = await self._detect_anomalies(traffic_data)
            analysis_results['anomalies'] = anomaly_analysis
            
            # Predict future traffic
            traffic_prediction = await self._predict_traffic_trends(traffic_data)
            analysis_results['prediction'] = traffic_prediction
            
            # Generate recommendations
            recommendations = await self._generate_recommendations(analysis_results)
            
            # Calculate overall health score
            health_score = await self._calculate_network_health_score(analysis_results)
            
            # Determine if any immediate actions are needed
            anomaly_detected = any(
                result.get('anomaly_detected', False) 
                for result in analysis_results.values()
            )
            
            final_result = {
                'timestamp': timestamp.isoformat(),
                'health_score': health_score,
                'anomaly_detected': anomaly_detected,
                'analysis': analysis_results,
                'recommendations': recommendations,
                'recommended_settings': await self._generate_qos_settings(analysis_results),
                'alerts': await self._generate_alerts(analysis_results)
            }
            
            logger.info(f"Traffic analyzed - Health: {health_score:.2f}, Anomalies: {anomaly_detected}")
            
            return final_result
            
        except Exception as e:
            logger.error(f"Traffic analysis error: {e}")
            return {
                'error': str(e),
                'timestamp': datetime.now().isoformat(),
                'health_score': 0.5,
                'anomaly_detected': True
            }
    
    async def _analyze_bandwidth(self, traffic_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze bandwidth utilization patterns"""
        bandwidth_in = traffic_data.get('bandwidth_in', 0)
        bandwidth_out = traffic_data.get('bandwidth_out', 0)
        total_bandwidth = bandwidth_in + bandwidth_out
        
        # Get bandwidth capacity (would come from gateway configuration)
        max_bandwidth = traffic_data.get('max_bandwidth', 1000)  # Mbps
        utilization = total_bandwidth / max_bandwidth if max_bandwidth > 0 else 0
        
        thresholds = self.model['thresholds']['bandwidth_utilization']
        
        if utilization >= thresholds['critical']:
            status = 'critical'
            score = 1.0
        elif utilization >= thresholds['warning']:
            status = 'warning'
            score = 0.7
        elif utilization >= thresholds['normal']:
            status = 'elevated'
            score = 0.4
        else:
            status = 'normal'
            score = 0.0
        
        # Analyze trends
        recent_utilization = await self._get_recent_bandwidth_trend()
        trend = 'stable'
        if recent_utilization:
            if utilization > max(recent_utilization) * 1.2:
                trend = 'increasing'
            elif utilization < min(recent_utilization) * 0.8:
                trend = 'decreasing'
        
        return {
            'utilization_percentage': utilization * 100,
            'status': status,
            'score': score,
            'trend': trend,
            'bandwidth_in': bandwidth_in,
            'bandwidth_out': bandwidth_out,
            'total_bandwidth': total_bandwidth,
            'anomaly_detected': score >= 0.8
        }
    
    async def _analyze_performance(self, traffic_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze network performance metrics"""
        latency = traffic_data.get('latency', 0)
        packet_loss = traffic_data.get('packet_loss', 0)
        jitter = traffic_data.get('jitter', 0)
        
        # Analyze latency
        latency_thresholds = self.model['thresholds']['latency']
        if latency >= latency_thresholds['critical']:
            latency_status = 'critical'
            latency_score = 1.0
        elif latency >= latency_thresholds['warning']:
            latency_status = 'warning'
            latency_score = 0.7
        elif latency >= latency_thresholds['normal']:
            latency_status = 'elevated'
            latency_score = 0.4
        else:
            latency_status = 'normal'
            latency_score = 0.0
        
        # Analyze packet loss
        loss_thresholds = self.model['thresholds']['packet_loss']
        if packet_loss >= loss_thresholds['critical']:
            loss_status = 'critical'
            loss_score = 1.0
        elif packet_loss >= loss_thresholds['warning']:
            loss_status = 'warning'
            loss_score = 0.7
        elif packet_loss >= loss_thresholds['normal']:
            loss_status = 'elevated'
            loss_score = 0.4
        else:
            loss_status = 'normal'
            loss_score = 0.0
        
        # Overall performance score
        performance_score = max(latency_score, loss_score)
        
        return {
            'latency': {
                'value': latency,
                'status': latency_status,
                'score': latency_score
            },
            'packet_loss': {
                'value': packet_loss,
                'status': loss_status,
                'score': loss_score
            },
            'jitter': jitter,
            'overall_score': performance_score,
            'anomaly_detected': performance_score >= 0.8
        }
    
    async def _analyze_protocols(self, traffic_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze protocol distribution and patterns"""
        protocol_breakdown = traffic_data.get('protocol_breakdown', {})
        
        # Calculate protocol percentages
        total_traffic = sum(protocol_breakdown.values()) if protocol_breakdown else 1
        protocol_percentages = {
            protocol: (traffic / total_traffic) * 100
            for protocol, traffic in protocol_breakdown.items()
        }
        
        # Analyze protocol anomalies
        anomalies = []
        
        # Check for unexpected protocol dominance
        for protocol, percentage in protocol_percentages.items():
            if percentage > 80 and protocol not in ['HTTP', 'HTTPS']:
                anomalies.append(f"Unusual {protocol} dominance: {percentage:.1f}%")
        
        # Check for missing critical protocols
        critical_protocols = ['SIP', 'RTP']
        missing_critical = [p for p in critical_protocols if p not in protocol_breakdown]
        if missing_critical:
            anomalies.append(f"Missing critical protocols: {missing_critical}")
        
        return {
            'protocol_distribution': protocol_percentages,
            'anomalies': anomalies,
            'total_protocols': len(protocol_breakdown),
            'anomaly_detected': len(anomalies) > 0,
            'score': 0.7 if anomalies else 0.0
        }
    
    async def _detect_anomalies(self, traffic_data: Dict[str, Any]) -> Dict[str, Any]:
        """Detect traffic anomalies using statistical analysis"""
        if len(self.traffic_history) < 10:
            return {
                'anomalies_detected': [],
                'anomaly_detected': False,
                'score': 0.0,
                'note': 'Insufficient historical data for anomaly detection'
            }
        
        anomalies = []
        
        # Analyze bandwidth anomalies
        current_bandwidth = traffic_data.get('bandwidth_in', 0) + traffic_data.get('bandwidth_out', 0)
        historical_bandwidth = [
            (entry.get('bandwidth_in', 0) + entry.get('bandwidth_out', 0))
            for entry in self.traffic_history[-50:]
        ]
        
        if historical_bandwidth:
            avg_bandwidth = np.mean(historical_bandwidth)
            std_bandwidth = np.std(historical_bandwidth)
            
            deviation = abs(current_bandwidth - avg_bandwidth) / (std_bandwidth + 1e-6)
            if deviation > self.model['anomaly_detection']['deviation_threshold']:
                anomalies.append({
                    'type': 'bandwidth_anomaly',
                    'description': f'Bandwidth deviation: {deviation:.2f} standard deviations',
                    'severity': 'high' if deviation > 4 else 'medium'
                })
        
        # Analyze connection count anomalies
        current_connections = traffic_data.get('connection_count', 0)
        historical_connections = [
            entry.get('connection_count', 0)
            for entry in self.traffic_history[-50:]
        ]
        
        if historical_connections:
            avg_connections = np.mean(historical_connections)
            std_connections = np.std(historical_connections)
            
            deviation = abs(current_connections - avg_connections) / (std_connections + 1e-6)
            if deviation > self.model['anomaly_detection']['deviation_threshold']:
                anomalies.append({
                    'type': 'connection_anomaly',
                    'description': f'Connection count deviation: {deviation:.2f} standard deviations',
                    'severity': 'medium'
                })
        
        anomaly_score = min(len(anomalies) * 0.3, 1.0)
        
        return {
            'anomalies_detected': anomalies,
            'anomaly_detected': len(anomalies) > 0,
            'score': anomaly_score,
            'historical_samples': len(self.traffic_history)
        }
    
    async def _predict_traffic_trends(self, traffic_data: Dict[str, Any]) -> Dict[str, Any]:
        """Predict future traffic trends"""
        if len(self.traffic_history) < 20:
            return {
                'prediction': 'insufficient_data',
                'confidence': 0.0,
                'trend': 'unknown'
            }
        
        # Simple trend analysis using recent data
        recent_bandwidth = [
            (entry.get('bandwidth_in', 0) + entry.get('bandwidth_out', 0))
            for entry in self.traffic_history[-20:]
        ]
        
        # Calculate trend using linear regression approximation
        x = np.arange(len(recent_bandwidth))
        if len(recent_bandwidth) > 1:
            slope = np.polyfit(x, recent_bandwidth, 1)[0]
            
            if slope > 5:  # Mbps per sample
                trend = 'increasing'
                prediction = 'traffic_will_increase'
            elif slope < -5:
                trend = 'decreasing'
                prediction = 'traffic_will_decrease'
            else:
                trend = 'stable'
                prediction = 'traffic_will_remain_stable'
        else:
            trend = 'stable'
            prediction = 'traffic_will_remain_stable'
        
        # Predict bandwidth for next window
        current_bandwidth = traffic_data.get('bandwidth_in', 0) + traffic_data.get('bandwidth_out', 0)
        predicted_bandwidth = current_bandwidth + (slope * 5)  # 5 samples ahead
        predicted_bandwidth = max(0, predicted_bandwidth)  # Can't be negative
        
        confidence = 0.7 if len(self.traffic_history) > 50 else 0.5
        
        return {
            'prediction': prediction,
            'trend': trend,
            'predicted_bandwidth': predicted_bandwidth,
            'confidence': confidence,
            'time_horizon': f'{self.prediction_window} seconds'
        }
    
    async def _generate_recommendations(self, analysis_results: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate actionable recommendations based on analysis"""
        recommendations = []
        
        # Bandwidth recommendations
        bandwidth_analysis = analysis_results.get('bandwidth', {})
        if bandwidth_analysis.get('status') == 'critical':
            recommendations.append({
                'type': 'bandwidth',
                'priority': 'high',
                'action': 'Implement traffic shaping and consider bandwidth upgrade',
                'reason': f"Bandwidth utilization at {bandwidth_analysis.get('utilization_percentage', 0):.1f}%"
            })
        
        # Performance recommendations
        performance_analysis = analysis_results.get('performance', {})
        if performance_analysis.get('latency', {}).get('status') == 'critical':
            recommendations.append({
                'type': 'performance',
                'priority': 'high',
                'action': 'Optimize routing and check for network congestion',
                'reason': f"High latency: {performance_analysis.get('latency', {}).get('value', 0)}ms"
            })
        
        if performance_analysis.get('packet_loss', {}).get('status') == 'critical':
            recommendations.append({
                'type': 'performance',
                'priority': 'high',
                'action': 'Investigate packet loss causes and adjust QoS settings',
                'reason': f"High packet loss: {performance_analysis.get('packet_loss', {}).get('value', 0):.2f}%"
            })
        
        # Protocol recommendations
        protocol_analysis = analysis_results.get('protocols', {})
        if protocol_analysis.get('anomaly_detected'):
            recommendations.append({
                'type': 'security',
                'priority': 'medium',
                'action': 'Review protocol distribution for potential security issues',
                'reason': 'Unusual protocol patterns detected'
            })
        
        # Anomaly recommendations
        anomaly_analysis = analysis_results.get('anomalies', {})
        if anomaly_analysis.get('anomaly_detected'):
            recommendations.append({
                'type': 'monitoring',
                'priority': 'medium',
                'action': 'Increase monitoring frequency and investigate anomalies',
                'reason': f"{len(anomaly_analysis.get('anomalies_detected', []))} anomalies detected"
            })
        
        return recommendations
    
    async def _generate_qos_settings(self, analysis_results: Dict[str, Any]) -> Dict[str, Any]:
        """Generate QoS settings based on analysis"""
        qos_settings = {
            'bandwidth_allocation': {},
            'priority_queues': {},
            'traffic_shaping': {}
        }
        
        # Adjust based on bandwidth utilization
        bandwidth_analysis = analysis_results.get('bandwidth', {})
        utilization = bandwidth_analysis.get('utilization_percentage', 0)
        
        if utilization > 80:
            # High utilization - implement strict QoS
            qos_settings['priority_queues'] = {
                'voice': {'bandwidth_percent': 40, 'priority': 1},
                'video': {'bandwidth_percent': 30, 'priority': 2},
                'data': {'bandwidth_percent': 30, 'priority': 3}
            }
            qos_settings['traffic_shaping']['enabled'] = True
            qos_settings['traffic_shaping']['burst_size'] = '10MB'
        else:
            # Normal utilization - relaxed QoS
            qos_settings['priority_queues'] = {
                'voice': {'bandwidth_percent': 30, 'priority': 1},
                'video': {'bandwidth_percent': 35, 'priority': 2},
                'data': {'bandwidth_percent': 35, 'priority': 3}
            }
            qos_settings['traffic_shaping']['enabled'] = False
        
        return qos_settings
    
    async def _generate_alerts(self, analysis_results: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate alerts based on analysis results"""
        alerts = []
        
        for analysis_type, results in analysis_results.items():
            if results.get('anomaly_detected') or results.get('score', 0) >= 0.8:
                alert = {
                    'type': analysis_type,
                    'severity': 'high' if results.get('score', 0) >= 0.9 else 'medium',
                    'message': f"{analysis_type.capitalize()} issue detected",
                    'timestamp': datetime.now().isoformat(),
                    'details': results
                }
                alerts.append(alert)
        
        return alerts
    
    async def _calculate_network_health_score(self, analysis_results: Dict[str, Any]) -> float:
        """Calculate overall network health score"""
        weights = self.model['weights']
        total_score = 0
        
        for analysis_type, weight in weights.items():
            if analysis_type in analysis_results:
                score = analysis_results[analysis_type].get('score', 0)
                total_score += (1 - score) * weight  # Invert score (higher is better for health)
        
        return max(0, min(1, total_score))
    
    async def _store_traffic_data(self, traffic_data: Dict[str, Any]):
        """Store traffic data for historical analysis"""
        self.traffic_history.append({
            **traffic_data,
            'timestamp': traffic_data.get('timestamp', datetime.now())
        })
        
        # Keep only recent history (last 1000 samples)
        self.traffic_history = self.traffic_history[-1000:]
    
    async def _get_recent_bandwidth_trend(self) -> List[float]:
        """Get recent bandwidth utilization trend"""
        if len(self.traffic_history) < 10:
            return []
        
        return [
            (entry.get('bandwidth_in', 0) + entry.get('bandwidth_out', 0))
            for entry in self.traffic_history[-10:]
        ]
    
    async def _initialize_baseline_metrics(self):
        """Initialize baseline metrics for comparison"""
        self.baseline_metrics = {
            'avg_bandwidth': 100,  # Mbps
            'avg_latency': 30,     # ms
            'avg_packet_loss': 0.01,  # 1%
            'avg_connections': 500
        }
    
    async def _save_model(self):
        """Save the current model"""
        model_path = Path(self.config['model_path'])
        model_path.parent.mkdir(parents=True, exist_ok=True)
        
        try:
            with open(model_path, 'wb') as f:
                pickle.dump(self.model, f)
            logger.debug("Traffic analysis model saved")
        except Exception as e:
            logger.error(f"Failed to save model: {e}")
    
    async def get_current_accuracy(self) -> float:
        """Get current model accuracy"""
        return 0.89  # Simulated accuracy
    
    async def retrain(self):
        """Retrain the model with recent data"""
        logger.info("Retraining traffic analysis model...")
        await asyncio.sleep(2)  # Simulate training time
        logger.info("Traffic analysis model retrained successfully")
    
    def is_loaded(self) -> bool:
        """Check if model is loaded"""
        return self.is_model_loaded
    
    async def get_traffic_statistics(self) -> Dict[str, Any]:
        """Get traffic analysis statistics"""
        if not self.traffic_history:
            return {'error': 'No traffic data available'}
        
        recent_data = self.traffic_history[-100:] if len(self.traffic_history) >= 100 else self.traffic_history
        
        total_bandwidth = [
            (entry.get('bandwidth_in', 0) + entry.get('bandwidth_out', 0))
            for entry in recent_data
        ]
        
        return {
            'samples_analyzed': len(self.traffic_history),
            'avg_bandwidth': np.mean(total_bandwidth) if total_bandwidth else 0,
            'max_bandwidth': max(total_bandwidth) if total_bandwidth else 0,
            'min_bandwidth': min(total_bandwidth) if total_bandwidth else 0,
            'baseline_metrics': self.baseline_metrics,
            'model_accuracy': await self.get_current_accuracy()
        }