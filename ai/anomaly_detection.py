"""
Anomaly Detection Engine for network devices
"""

import logging
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from collections import deque
import json

try:
    from sklearn.ensemble import IsolationForest
    from sklearn.preprocessing import StandardScaler
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False
    logging.warning("scikit-learn not available, anomaly detection features disabled")

from utils.database import DatabaseManager


class AnomalyDetector:
    """Real-time anomaly detection for network devices"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = logging.getLogger(__name__)
        self.db_manager = DatabaseManager()
        
        # Configuration
        self.sensitivity = config.get("anomaly_detection", {}).get("sensitivity", 0.8)
        self.window_size = 50  # Number of recent data points to consider
        
        # Store recent data for each device
        self.device_data = {}
        self.device_models = {}
        self.device_scalers = {}
        
        if not SKLEARN_AVAILABLE:
            self.logger.warning("Anomaly detection disabled - scikit-learn not available")
    
    def detect_anomaly(self, device_name: str, status_data: Dict[str, Any]) -> bool:
        """Detect if current status represents an anomaly"""
        if not SKLEARN_AVAILABLE:
            return False
        
        try:
            # Extract numerical features
            features = self._extract_numerical_features(status_data)
            if not features:
                return False
            
            # Initialize device data storage if needed
            if device_name not in self.device_data:
                self.device_data[device_name] = deque(maxlen=self.window_size)
                self.device_models[device_name] = None
                self.device_scalers[device_name] = None
            
            # Add current data point
            self.device_data[device_name].append(features)
            
            # Need sufficient data to detect anomalies
            if len(self.device_data[device_name]) < 10:
                return False
            
            # Update model if we have enough data
            if len(self.device_data[device_name]) >= 20:
                self._update_device_model(device_name)
            
            # Detect anomaly
            if self.device_models[device_name] is not None:
                is_anomaly = self._check_anomaly(device_name, features)
                
                if is_anomaly:
                    # Store anomaly detection result
                    anomaly_data = {
                        "features": features,
                        "anomaly_score": self._get_anomaly_score(device_name, features),
                        "status_data": status_data
                    }
                    
                    self.db_manager.store_ai_prediction(
                        device_name,
                        "anomaly_detection",
                        anomaly_data,
                        confidence=self.sensitivity
                    )
                
                return is_anomaly
            
            return False
            
        except Exception as e:
            self.logger.error(f"Anomaly detection error for {device_name}: {e}")
            return False
    
    def _extract_numerical_features(self, status_data: Dict[str, Any]) -> List[float]:
        """Extract numerical features from status data"""
        features = []
        
        try:
            # Generic numerical extraction
            for key, value in status_data.items():
                if isinstance(value, (int, float)):
                    features.append(float(value))
                elif isinstance(value, str):
                    # Try to extract numbers from strings
                    try:
                        if "%" in value:
                            features.append(float(value.replace("%", "")))
                        elif "dBm" in value:
                            features.append(float(value.replace("dBm", "")))
                        elif value.replace(".", "").replace("-", "").isdigit():
                            features.append(float(value))
                    except:
                        pass
                elif isinstance(value, dict):
                    # Recursively extract from nested dictionaries
                    nested_features = self._extract_from_dict(value)
                    features.extend(nested_features)
            
            # Add time-based features
            current_time = datetime.now()
            features.extend([
                current_time.hour,
                current_time.weekday(),
                current_time.minute / 60.0  # Fractional hour
            ])
            
        except Exception as e:
            self.logger.warning(f"Feature extraction error: {e}")
        
        return features
    
    def _extract_from_dict(self, data: Dict[str, Any], max_depth: int = 2) -> List[float]:
        """Recursively extract numerical values from nested dictionaries"""
        features = []
        
        if max_depth <= 0:
            return features
        
        try:
            for key, value in data.items():
                if isinstance(value, (int, float)):
                    features.append(float(value))
                elif isinstance(value, str) and value.replace(".", "").replace("-", "").isdigit():
                    features.append(float(value))
                elif isinstance(value, dict):
                    nested_features = self._extract_from_dict(value, max_depth - 1)
                    features.extend(nested_features)
                elif isinstance(value, list) and len(value) > 0:
                    # Handle lists of numbers
                    if all(isinstance(item, (int, float)) for item in value):
                        features.extend([float(item) for item in value])
        except:
            pass
        
        return features
    
    def _update_device_model(self, device_name: str):
        """Update anomaly detection model for device"""
        try:
            data_points = list(self.device_data[device_name])
            
            # Ensure all data points have the same number of features
            if not data_points:
                return
            
            # Find the most common feature length
            feature_lengths = [len(point) for point in data_points]
            target_length = max(set(feature_lengths), key=feature_lengths.count)
            
            # Pad or truncate to uniform length
            uniform_data = []
            for point in data_points:
                if len(point) == target_length:
                    uniform_data.append(point)
                elif len(point) < target_length:
                    # Pad with zeros
                    padded_point = point + [0.0] * (target_length - len(point))
                    uniform_data.append(padded_point)
                else:
                    # Truncate
                    truncated_point = point[:target_length]
                    uniform_data.append(truncated_point)
            
            if len(uniform_data) < 10:
                return
            
            # Convert to numpy array
            data_array = np.array(uniform_data)
            
            # Handle invalid values
            data_array = np.nan_to_num(data_array, nan=0.0, posinf=0.0, neginf=0.0)
            
            # Scale features
            scaler = StandardScaler()
            scaled_data = scaler.fit_transform(data_array)
            
            # Train isolation forest
            contamination = 1.0 - self.sensitivity  # Higher sensitivity = lower contamination
            model = IsolationForest(
                contamination=contamination,
                random_state=42,
                n_estimators=100
            )
            model.fit(scaled_data)
            
            # Store model and scaler
            self.device_models[device_name] = model
            self.device_scalers[device_name] = scaler
            
            self.logger.debug(f"Updated anomaly detection model for {device_name} with {len(uniform_data)} samples")
            
        except Exception as e:
            self.logger.error(f"Error updating model for {device_name}: {e}")
    
    def _check_anomaly(self, device_name: str, features: List[float]) -> bool:
        """Check if current features represent an anomaly"""
        try:
            model = self.device_models[device_name]
            scaler = self.device_scalers[device_name]
            
            if model is None or scaler is None:
                return False
            
            # Get expected feature length from scaler
            expected_length = scaler.n_features_in_
            
            # Pad or truncate features to match expected length
            if len(features) < expected_length:
                features = features + [0.0] * (expected_length - len(features))
            elif len(features) > expected_length:
                features = features[:expected_length]
            
            # Convert to numpy array and handle invalid values
            feature_array = np.array([features])
            feature_array = np.nan_to_num(feature_array, nan=0.0, posinf=0.0, neginf=0.0)
            
            # Scale features
            scaled_features = scaler.transform(feature_array)
            
            # Predict anomaly
            prediction = model.predict(scaled_features)[0]
            
            # -1 indicates anomaly, 1 indicates normal
            return prediction == -1
            
        except Exception as e:
            self.logger.error(f"Anomaly check error for {device_name}: {e}")
            return False
    
    def _get_anomaly_score(self, device_name: str, features: List[float]) -> float:
        """Get anomaly score for current features"""
        try:
            model = self.device_models[device_name]
            scaler = self.device_scalers[device_name]
            
            if model is None or scaler is None:
                return 0.0
            
            # Prepare features
            expected_length = scaler.n_features_in_
            if len(features) < expected_length:
                features = features + [0.0] * (expected_length - len(features))
            elif len(features) > expected_length:
                features = features[:expected_length]
            
            feature_array = np.array([features])
            feature_array = np.nan_to_num(feature_array, nan=0.0, posinf=0.0, neginf=0.0)
            
            # Scale and get score
            scaled_features = scaler.transform(feature_array)
            score = model.decision_function(scaled_features)[0]
            
            # Convert to 0-1 range (lower scores indicate more anomalous)
            normalized_score = max(0.0, min(1.0, (score + 0.5) * -1))
            
            return normalized_score
            
        except Exception as e:
            self.logger.error(f"Anomaly score error for {device_name}: {e}")
            return 0.0
    
    def get_anomaly_history(self, device_name: str, hours: int = 24) -> List[Dict[str, Any]]:
        """Get anomaly detection history for device"""
        return self.db_manager.get_ai_predictions(device_name, "anomaly_detection", hours)
    
    def get_device_statistics(self, device_name: str) -> Dict[str, Any]:
        """Get anomaly detection statistics for device"""
        try:
            stats = {
                "data_points": len(self.device_data.get(device_name, [])),
                "model_trained": self.device_models.get(device_name) is not None,
                "sensitivity": self.sensitivity,
                "window_size": self.window_size
            }
            
            # Get recent anomaly count
            recent_anomalies = self.get_anomaly_history(device_name, hours=24)
            stats["recent_anomalies_24h"] = len(recent_anomalies)
            
            return stats
            
        except Exception as e:
            self.logger.error(f"Error getting statistics for {device_name}: {e}")
            return {}
    
    def update_models(self):
        """Update all device models with latest data"""
        if not SKLEARN_AVAILABLE:
            return
        
        for device_name in self.device_data.keys():
            if len(self.device_data[device_name]) >= 20:
                self.logger.info(f"Updating anomaly detection model for {device_name}")
                self._update_device_model(device_name)
    
    def reset_device_model(self, device_name: str):
        """Reset anomaly detection model for a specific device"""
        if device_name in self.device_data:
            self.device_data[device_name].clear()
            self.device_models[device_name] = None
            self.device_scalers[device_name] = None
            self.logger.info(f"Reset anomaly detection model for {device_name}")
    
    def set_sensitivity(self, sensitivity: float):
        """Update anomaly detection sensitivity"""
        if 0.0 <= sensitivity <= 1.0:
            self.sensitivity = sensitivity
            self.logger.info(f"Updated anomaly detection sensitivity to {sensitivity}")
            
            # Retrain models with new sensitivity
            for device_name in self.device_data.keys():
                if len(self.device_data[device_name]) >= 20:
                    self._update_device_model(device_name)
        else:
            self.logger.warning(f"Invalid sensitivity value: {sensitivity}")
    
    def get_system_info(self) -> Dict[str, Any]:
        """Get anomaly detection system information"""
        info = {
            "sklearn_available": SKLEARN_AVAILABLE,
            "sensitivity": self.sensitivity,
            "window_size": self.window_size,
            "devices_monitored": len(self.device_data),
            "models_trained": sum(1 for model in self.device_models.values() if model is not None),
            "device_details": {}
        }
        
        for device_name in self.device_data.keys():
            info["device_details"][device_name] = self.get_device_statistics(device_name)
        
        return info