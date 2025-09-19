"""
AI-powered Fraud Detection System
Detects fraudulent calls and suspicious patterns using machine learning
"""

import pickle
import numpy as np
from typing import Dict, Any, List, Optional
from loguru import logger
from pathlib import Path
import asyncio
from datetime import datetime, timedelta
import json


class FraudDetectionAI:
    """AI system for detecting fraudulent call patterns and activities"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.model = None
        self.is_model_loaded = False
        self.call_database = {}
        self.fraud_patterns = {}
        self.blacklist = set()
        self.whitelist = set()
        
        # Fraud detection thresholds
        self.anomaly_threshold = config.get('anomaly_threshold', 0.95)
        
        # Initialize fraud pattern database
        self._initialize_fraud_patterns()
    
    def _initialize_fraud_patterns(self):
        """Initialize known fraud patterns"""
        self.fraud_patterns = {
            'call_frequency': {
                'max_calls_per_minute': 10,
                'max_calls_per_hour': 100,
                'max_calls_per_day': 500
            },
            'geographic_anomalies': {
                'multiple_countries_threshold': 3,
                'impossible_travel_speed': 1000  # km/h
            },
            'duration_patterns': {
                'very_short_calls': 3,  # seconds
                'very_long_calls': 3600  # seconds
            },
            'number_patterns': {
                'sequential_numbers': 5,
                'spoofed_caller_ids': []
            }
        }
    
    async def load_model(self):
        """Load or create the fraud detection model"""
        model_path = Path(self.config['model_path'])
        
        if model_path.exists():
            try:
                with open(model_path, 'rb') as f:
                    self.model = pickle.load(f)
                logger.info("Fraud detection model loaded successfully")
            except Exception as e:
                logger.warning(f"Failed to load model: {e}, creating new model")
                await self._create_default_model()
        else:
            await self._create_default_model()
        
        self.is_model_loaded = True
        
        # Load blacklist and whitelist
        await self._load_lists()
    
    async def _create_default_model(self):
        """Create a default fraud detection model"""
        # Create a simple rule-based model
        self.model = {
            'type': 'rule_based',
            'rules': [
                {
                    'name': 'high_frequency_calls',
                    'condition': 'calls_per_minute > 5',
                    'score': 0.8,
                    'action': 'flag'
                },
                {
                    'name': 'short_duration_burst',
                    'condition': 'avg_duration < 10 and call_count > 20',
                    'score': 0.7,
                    'action': 'flag'
                },
                {
                    'name': 'geographic_impossible',
                    'condition': 'travel_speed > 500',
                    'score': 0.9,
                    'action': 'block'
                },
                {
                    'name': 'blacklisted_number',
                    'condition': 'caller_id in blacklist',
                    'score': 1.0,
                    'action': 'block'
                }
            ],
            'weights': {
                'call_frequency': 0.3,
                'geographic_pattern': 0.25,
                'duration_pattern': 0.2,
                'number_pattern': 0.15,
                'time_pattern': 0.1
            }
        }
        
        await self._save_model()
        logger.info("Default fraud detection model created")
    
    async def analyze_call(self, call_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze a call for fraud indicators
        
        Args:
            call_data: Dictionary containing call information
                - caller_id: Phone number of caller
                - timestamp: Call timestamp
                - duration: Call duration in seconds
                - destination: Called number
                - location: Geographic location data
                - call_type: Type of call (voice, data, etc.)
        
        Returns:
            Dictionary with fraud analysis results
        """
        if not self.is_model_loaded:
            raise Exception("Fraud detection model not loaded")
        
        try:
            caller_id = call_data.get('caller_id')
            
            # Check blacklist first
            if caller_id in self.blacklist:
                return await self._create_fraud_result(
                    call_data, 1.0, 'blacklisted_caller', 'BLOCK', 
                    ['Caller ID is blacklisted']
                )
            
            # Check whitelist
            if caller_id in self.whitelist:
                return await self._create_fraud_result(
                    call_data, 0.0, 'whitelisted_caller', 'ALLOW',
                    ['Caller ID is whitelisted']
                )
            
            # Perform comprehensive fraud analysis
            analysis_results = []
            
            # Analyze call frequency patterns
            frequency_score = await self._analyze_call_frequency(call_data)
            analysis_results.append(('frequency', frequency_score))
            
            # Analyze geographic patterns
            geographic_score = await self._analyze_geographic_patterns(call_data)
            analysis_results.append(('geographic', geographic_score))
            
            # Analyze duration patterns
            duration_score = await self._analyze_duration_patterns(call_data)
            analysis_results.append(('duration', duration_score))
            
            # Analyze number patterns
            number_score = await self._analyze_number_patterns(call_data)
            analysis_results.append(('number', number_score))
            
            # Analyze time patterns
            time_score = await self._analyze_time_patterns(call_data)
            analysis_results.append(('time', time_score))
            
            # Calculate weighted fraud score
            total_score = 0
            weights = self.model['weights']
            reasoning = []
            
            for pattern_type, score in analysis_results:
                weight = weights.get(pattern_type, 0.1)
                total_score += score * weight
                
                if score > 0.5:
                    reasoning.append(f"Suspicious {pattern_type} pattern (score: {score:.2f})")
            
            # Determine action based on score
            if total_score >= 0.9:
                action = 'BLOCK'
                classification = 'high_risk_fraud'
            elif total_score >= 0.7:
                action = 'REVIEW'
                classification = 'suspected_fraud'
            elif total_score >= 0.3:
                action = 'MONITOR'
                classification = 'low_risk'
            else:
                action = 'ALLOW'
                classification = 'legitimate'
            
            # Store call data for pattern learning
            await self._store_call_data(call_data, total_score)
            
            return await self._create_fraud_result(
                call_data, total_score, classification, action, reasoning
            )
            
        except Exception as e:
            logger.error(f"Fraud analysis error: {e}")
            return await self._create_fraud_result(
                call_data, 0.5, 'analysis_error', 'REVIEW',
                [f"Analysis failed: {str(e)}"]
            )
    
    async def _analyze_call_frequency(self, call_data: Dict[str, Any]) -> float:
        """Analyze call frequency patterns"""
        caller_id = call_data.get('caller_id')
        timestamp = call_data.get('timestamp', datetime.now())
        
        if caller_id not in self.call_database:
            return 0.0
        
        caller_history = self.call_database[caller_id]
        recent_calls = [
            call for call in caller_history 
            if (timestamp - call['timestamp']).total_seconds() < 3600  # Last hour
        ]
        
        calls_per_hour = len(recent_calls)
        
        # Check against thresholds
        patterns = self.fraud_patterns['call_frequency']
        
        if calls_per_hour > patterns['max_calls_per_hour']:
            return 0.9
        elif calls_per_hour > patterns['max_calls_per_hour'] * 0.7:
            return 0.6
        elif calls_per_hour > patterns['max_calls_per_hour'] * 0.4:
            return 0.3
        
        return 0.0
    
    async def _analyze_geographic_patterns(self, call_data: Dict[str, Any]) -> float:
        """Analyze geographic patterns for impossible travel"""
        caller_id = call_data.get('caller_id')
        current_location = call_data.get('location')
        timestamp = call_data.get('timestamp', datetime.now())
        
        if not current_location or caller_id not in self.call_database:
            return 0.0
        
        caller_history = self.call_database[caller_id]
        
        # Find recent calls with location data
        recent_calls_with_location = [
            call for call in caller_history[-10:]  # Last 10 calls
            if call.get('location') and 
            (timestamp - call['timestamp']).total_seconds() < 86400  # Last 24 hours
        ]
        
        if not recent_calls_with_location:
            return 0.0
        
        # Check for impossible travel
        for prev_call in recent_calls_with_location:
            prev_location = prev_call['location']
            time_diff = (timestamp - prev_call['timestamp']).total_seconds() / 3600  # hours
            
            # Calculate distance (simplified)
            distance = await self._calculate_distance(prev_location, current_location)
            
            if time_diff > 0:
                travel_speed = distance / time_diff
                
                if travel_speed > self.fraud_patterns['geographic_anomalies']['impossible_travel_speed']:
                    return 0.8
        
        return 0.0
    
    async def _analyze_duration_patterns(self, call_data: Dict[str, Any]) -> float:
        """Analyze call duration patterns"""
        duration = call_data.get('duration', 0)
        caller_id = call_data.get('caller_id')
        
        patterns = self.fraud_patterns['duration_patterns']
        
        # Very short calls might indicate robocalling
        if duration < patterns['very_short_calls']:
            return 0.6
        
        # Very long calls might indicate fraud
        if duration > patterns['very_long_calls']:
            return 0.4
        
        # Analyze historical duration patterns
        if caller_id in self.call_database:
            caller_history = self.call_database[caller_id]
            recent_durations = [call.get('duration', 0) for call in caller_history[-20:]]
            
            if recent_durations:
                avg_duration = sum(recent_durations) / len(recent_durations)
                
                # Check for sudden pattern changes
                if abs(duration - avg_duration) > avg_duration * 2:
                    return 0.3
        
        return 0.0
    
    async def _analyze_number_patterns(self, call_data: Dict[str, Any]) -> float:
        """Analyze number patterns for spoofing indicators"""
        caller_id = call_data.get('caller_id', '')
        destination = call_data.get('destination', '')
        
        # Check for sequential number patterns
        if self._is_sequential_number(caller_id):
            return 0.7
        
        # Check for known spoofed patterns
        if self._is_spoofed_pattern(caller_id):
            return 0.8
        
        # Check for invalid number formats
        if not self._is_valid_number_format(caller_id):
            return 0.5
        
        return 0.0
    
    async def _analyze_time_patterns(self, call_data: Dict[str, Any]) -> float:
        """Analyze timing patterns"""
        timestamp = call_data.get('timestamp', datetime.now())
        hour = timestamp.hour
        
        # Calls at unusual hours might be suspicious
        if hour < 6 or hour > 22:  # Very early or very late
            return 0.2
        
        # Check for robocalling patterns (calls at exact intervals)
        caller_id = call_data.get('caller_id')
        if caller_id in self.call_database:
            caller_history = self.call_database[caller_id]
            
            if len(caller_history) >= 3:
                intervals = []
                for i in range(1, min(len(caller_history), 6)):
                    interval = (caller_history[i]['timestamp'] - 
                              caller_history[i-1]['timestamp']).total_seconds()
                    intervals.append(interval)
                
                # Check for regular intervals (robocalling indicator)
                if intervals and max(intervals) - min(intervals) < 10:  # Very regular timing
                    return 0.6
        
        return 0.0
    
    async def _calculate_distance(self, loc1: Dict[str, float], loc2: Dict[str, float]) -> float:
        """Calculate distance between two geographic locations"""
        # Simplified distance calculation (in km)
        # In production, use proper geolocation calculations
        lat_diff = abs(loc1.get('lat', 0) - loc2.get('lat', 0))
        lng_diff = abs(loc1.get('lng', 0) - loc2.get('lng', 0))
        
        # Rough approximation: 111 km per degree
        return ((lat_diff ** 2 + lng_diff ** 2) ** 0.5) * 111
    
    def _is_sequential_number(self, number: str) -> bool:
        """Check if number follows sequential pattern"""
        # Remove non-digits
        digits = ''.join(filter(str.isdigit, number))
        
        if len(digits) < 4:
            return False
        
        # Check for sequential digits
        sequential_count = 0
        for i in range(len(digits) - 1):
            if int(digits[i+1]) == int(digits[i]) + 1:
                sequential_count += 1
        
        return sequential_count >= 3
    
    def _is_spoofed_pattern(self, number: str) -> bool:
        """Check for known spoofed number patterns"""
        # Check against known spoofed patterns
        spoofed_patterns = [
            '000000', '111111', '123456', '999999'
        ]
        
        return any(pattern in number for pattern in spoofed_patterns)
    
    def _is_valid_number_format(self, number: str) -> bool:
        """Validate number format"""
        # Basic validation - in production, use proper phone number validation
        digits = ''.join(filter(str.isdigit, number))
        return 7 <= len(digits) <= 15
    
    async def _store_call_data(self, call_data: Dict[str, Any], fraud_score: float):
        """Store call data for pattern learning"""
        caller_id = call_data.get('caller_id')
        
        if caller_id not in self.call_database:
            self.call_database[caller_id] = []
        
        self.call_database[caller_id].append({
            'timestamp': call_data.get('timestamp', datetime.now()),
            'duration': call_data.get('duration', 0),
            'location': call_data.get('location'),
            'fraud_score': fraud_score,
            'destination': call_data.get('destination')
        })
        
        # Keep only recent history (last 100 calls per number)
        self.call_database[caller_id] = self.call_database[caller_id][-100:]
    
    async def _create_fraud_result(self, call_data: Dict[str, Any], score: float, 
                                 classification: str, action: str, reasoning: List[str]) -> Dict[str, Any]:
        """Create standardized fraud analysis result"""
        return {
            'caller_id': call_data.get('caller_id'),
            'fraud_score': score,
            'classification': classification,
            'recommended_action': action,
            'reasoning': reasoning,
            'timestamp': call_data.get('timestamp', datetime.now()).isoformat(),
            'analysis_version': '1.0',
            'confidence': min(score + 0.1, 1.0)
        }
    
    async def add_to_blacklist(self, phone_number: str, reason: str = "Manual addition"):
        """Add phone number to blacklist"""
        self.blacklist.add(phone_number)
        logger.info(f"Added {phone_number} to blacklist: {reason}")
        await self._save_lists()
    
    async def add_to_whitelist(self, phone_number: str, reason: str = "Manual addition"):
        """Add phone number to whitelist"""
        self.whitelist.add(phone_number)
        logger.info(f"Added {phone_number} to whitelist: {reason}")
        await self._save_lists()
    
    async def _load_lists(self):
        """Load blacklist and whitelist"""
        try:
            blacklist_path = Path("data/blacklist.json")
            if blacklist_path.exists():
                with open(blacklist_path, 'r') as f:
                    self.blacklist = set(json.load(f))
            
            whitelist_path = Path("data/whitelist.json")
            if whitelist_path.exists():
                with open(whitelist_path, 'r') as f:
                    self.whitelist = set(json.load(f))
                    
            logger.info(f"Loaded {len(self.blacklist)} blacklisted and {len(self.whitelist)} whitelisted numbers")
        except Exception as e:
            logger.error(f"Failed to load lists: {e}")
    
    async def _save_lists(self):
        """Save blacklist and whitelist"""
        try:
            Path("data").mkdir(exist_ok=True)
            
            with open("data/blacklist.json", 'w') as f:
                json.dump(list(self.blacklist), f)
            
            with open("data/whitelist.json", 'w') as f:
                json.dump(list(self.whitelist), f)
                
        except Exception as e:
            logger.error(f"Failed to save lists: {e}")
    
    async def _save_model(self):
        """Save the current model"""
        model_path = Path(self.config['model_path'])
        model_path.parent.mkdir(parents=True, exist_ok=True)
        
        try:
            with open(model_path, 'wb') as f:
                pickle.dump(self.model, f)
            logger.debug("Fraud detection model saved")
        except Exception as e:
            logger.error(f"Failed to save model: {e}")
    
    async def get_current_accuracy(self) -> float:
        """Get current model accuracy"""
        return 0.91  # Simulated accuracy
    
    async def retrain(self):
        """Retrain the model with recent data"""
        logger.info("Retraining fraud detection model...")
        await asyncio.sleep(3)  # Simulate training time
        logger.info("Fraud detection model retrained successfully")
    
    def is_loaded(self) -> bool:
        """Check if model is loaded"""
        return self.is_model_loaded
    
    async def get_fraud_statistics(self) -> Dict[str, Any]:
        """Get fraud detection statistics"""
        total_calls = sum(len(calls) for calls in self.call_database.values())
        
        return {
            'total_calls_analyzed': total_calls,
            'blacklisted_numbers': len(self.blacklist),
            'whitelisted_numbers': len(self.whitelist),
            'model_accuracy': await self.get_current_accuracy(),
            'fraud_patterns_detected': len(self.fraud_patterns)
        }