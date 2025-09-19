"""
Predictive Maintenance Engine using machine learning
"""

import logging
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from pathlib import Path
import joblib
import json

try:
    from sklearn.ensemble import IsolationForest, RandomForestRegressor
    from sklearn.preprocessing import StandardScaler
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import mean_squared_error, r2_score
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False
    logging.warning("scikit-learn not available, predictive maintenance features disabled")

from utils.database import DatabaseManager


class PredictiveMaintenanceEngine:
    """AI-powered predictive maintenance engine"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = logging.getLogger(__name__)
        self.db_manager = DatabaseManager()
        self.models = {}
        self.scalers = {}
        
        # Model storage path
        self.model_path = Path(config.get("predictive_maintenance", {}).get("model_path", "ai/models"))
        self.model_path.mkdir(parents=True, exist_ok=True)
        
        if not SKLEARN_AVAILABLE:
            self.logger.warning("Predictive maintenance engine disabled - scikit-learn not available")
            return
        
        # Load existing models
        self._load_models()
    
    def predict_failure(self, device_name: str, current_status: Dict[str, Any]) -> Dict[str, Any]:
        """Predict potential device failure"""
        if not SKLEARN_AVAILABLE:
            return {"error": "Predictive maintenance not available"}
        
        try:
            # Extract features from current status
            features = self._extract_features(device_name, current_status)
            if not features:
                return {"failure_risk": 0.0, "confidence": 0.0, "recommendation": "Insufficient data"}
            
            # Get model for this device
            model_key = f"{device_name}_failure"
            if model_key not in self.models:
                # Train model if not exists
                self._train_failure_model(device_name)
            
            if model_key not in self.models:
                return {"failure_risk": 0.0, "confidence": 0.0, "recommendation": "Model not available"}
            
            # Predict failure risk
            feature_array = np.array([features])
            
            # Scale features
            scaler_key = f"{device_name}_scaler"
            if scaler_key in self.scalers:
                feature_array = self.scalers[scaler_key].transform(feature_array)
            
            # Get prediction
            failure_score = self.models[model_key].decision_function(feature_array)[0]
            
            # Convert to risk probability (0-1)
            failure_risk = max(0.0, min(1.0, (failure_score + 0.5) * -1))
            
            # Generate recommendation
            recommendation = self._generate_recommendation(device_name, failure_risk, features)
            
            # Store prediction
            prediction_data = {
                "failure_risk": failure_risk,
                "features": features,
                "recommendation": recommendation
            }
            
            self.db_manager.store_ai_prediction(
                device_name, 
                "failure_prediction", 
                prediction_data, 
                confidence=1.0 - abs(failure_score)
            )
            
            return {
                "failure_risk": failure_risk,
                "confidence": 1.0 - abs(failure_score),
                "recommendation": recommendation,
                "features_analyzed": list(features.keys())
            }
            
        except Exception as e:
            self.logger.error(f"Failure prediction error for {device_name}: {e}")
            return {"error": str(e)}
    
    def _extract_features(self, device_name: str, status: Dict[str, Any]) -> Dict[str, float]:
        """Extract numerical features from device status"""
        features = {}
        
        try:
            if device_name == "franklin_t10":
                # Extract Franklin T10 specific features
                if status.get("signal_strength"):
                    # Extract numeric value from signal strength
                    signal_str = str(status["signal_strength"])
                    if "%" in signal_str:
                        features["signal_strength_percent"] = float(signal_str.replace("%", ""))
                    elif "dBm" in signal_str:
                        features["signal_strength_dbm"] = float(signal_str.replace("dBm", ""))
                
                features["connected_devices"] = float(status.get("connected_devices", 0))
                
                if status.get("temperature"):
                    features["temperature"] = float(status["temperature"])
                
                if status.get("battery_level"):
                    features["battery_level"] = float(status["battery_level"])
                
                if status.get("uptime"):
                    features["uptime_hours"] = float(status["uptime"]) / 3600  # Convert to hours
            
            elif device_name == "hp_proliant":
                # Extract HP ProLiant specific features
                thermal_metrics = status.get("thermal_metrics", {})
                if thermal_metrics.get("temperatures"):
                    temps = [t.get("reading_celsius", 0) for t in thermal_metrics["temperatures"] 
                           if t.get("reading_celsius")]
                    if temps:
                        features["avg_temperature"] = np.mean(temps)
                        features["max_temperature"] = max(temps)
                
                # Fan speeds
                if thermal_metrics.get("fans"):
                    fan_speeds = [f.get("reading_rpm", 0) for f in thermal_metrics["fans"] 
                                if f.get("reading_rpm")]
                    if fan_speeds:
                        features["avg_fan_speed"] = np.mean(fan_speeds)
                        features["min_fan_speed"] = min(fan_speeds)
                
                # Power metrics
                power_metrics = status.get("power_metrics", {})
                power_consumption = power_metrics.get("power_consumption", {})
                if power_consumption.get("power_consumed_watts"):
                    features["power_consumed"] = float(power_consumption["power_consumed_watts"])
                
                # Storage health
                storage_summary = status.get("storage_summary", {})
                total_drives = storage_summary.get("total_drives", 0)
                healthy_drives = storage_summary.get("healthy_drives", 0)
                if total_drives > 0:
                    features["drive_health_ratio"] = healthy_drives / total_drives
                
                # Memory and processor utilization would need additional monitoring
                memory_summary = status.get("memory_summary", {})
                if memory_summary.get("TotalSystemMemoryGiB"):
                    features["total_memory_gb"] = float(memory_summary["TotalSystemMemoryGiB"])
            
            # Add timestamp-based features
            current_time = datetime.now()
            features["hour_of_day"] = current_time.hour
            features["day_of_week"] = current_time.weekday()
            
        except Exception as e:
            self.logger.warning(f"Feature extraction error: {e}")
        
        return features
    
    def _train_failure_model(self, device_name: str):
        """Train failure prediction model for device"""
        if not SKLEARN_AVAILABLE:
            return
        
        try:
            # Get historical data
            training_data_days = self.config.get("predictive_maintenance", {}).get("training_data_days", 30)
            cutoff_date = datetime.now() - timedelta(days=training_data_days)
            
            status_history = self.db_manager.get_device_status_history(device_name, hours=training_data_days * 24)
            
            if len(status_history) < 10:
                self.logger.warning(f"Insufficient data to train model for {device_name}")
                return
            
            # Extract features from historical data
            feature_data = []
            for status in status_history:
                features = self._extract_features(device_name, status)
                if features:
                    feature_data.append(features)
            
            if len(feature_data) < 10:
                self.logger.warning(f"Insufficient feature data for {device_name}")
                return
            
            # Create DataFrame
            df = pd.DataFrame(feature_data)
            
            # Handle missing values
            df = df.fillna(df.mean())
            
            # Train Isolation Forest for anomaly detection (proxy for failure prediction)
            scaler = StandardScaler()
            scaled_features = scaler.fit_transform(df)
            
            model = IsolationForest(contamination=0.1, random_state=42)
            model.fit(scaled_features)
            
            # Store model and scaler
            model_key = f"{device_name}_failure"
            scaler_key = f"{device_name}_scaler"
            
            self.models[model_key] = model
            self.scalers[scaler_key] = scaler
            
            # Save to disk
            joblib.dump(model, self.model_path / f"{model_key}.pkl")
            joblib.dump(scaler, self.model_path / f"{scaler_key}.pkl")
            
            self.logger.info(f"Trained failure prediction model for {device_name} with {len(feature_data)} samples")
            
        except Exception as e:
            self.logger.error(f"Model training error for {device_name}: {e}")
    
    def _generate_recommendation(self, device_name: str, failure_risk: float, features: Dict[str, float]) -> str:
        """Generate maintenance recommendation based on failure risk"""
        
        if failure_risk < 0.3:
            return "System operating normally. Continue regular monitoring."
        
        elif failure_risk < 0.6:
            recommendations = []
            
            if device_name == "franklin_t10":
                if features.get("signal_strength_percent", 100) < 30:
                    recommendations.append("Check antenna placement and orientation")
                if features.get("temperature", 0) > 60:
                    recommendations.append("Monitor device temperature and ventilation")
                if features.get("connected_devices", 0) > 10:
                    recommendations.append("Consider reducing connected device load")
            
            elif device_name == "hp_proliant":
                if features.get("max_temperature", 0) > 70:
                    recommendations.append("Check cooling system and clean air filters")
                if features.get("min_fan_speed", 1000) < 500:
                    recommendations.append("Inspect fan functionality")
                if features.get("drive_health_ratio", 1.0) < 0.9:
                    recommendations.append("Check storage drive health")
                if features.get("power_consumed", 0) > 400:
                    recommendations.append("Monitor power consumption trends")
            
            if not recommendations:
                recommendations.append("Schedule preventive maintenance check")
            
            return "Warning: " + "; ".join(recommendations)
        
        else:
            return "High failure risk detected. Schedule immediate maintenance inspection."
    
    def _load_models(self):
        """Load existing models from disk"""
        if not SKLEARN_AVAILABLE:
            return
        
        try:
            for model_file in self.model_path.glob("*.pkl"):
                if "scaler" in model_file.name:
                    key = model_file.stem
                    self.scalers[key] = joblib.load(model_file)
                else:
                    key = model_file.stem
                    self.models[key] = joblib.load(model_file)
            
            self.logger.info(f"Loaded {len(self.models)} models and {len(self.scalers)} scalers")
            
        except Exception as e:
            self.logger.error(f"Error loading models: {e}")
    
    def retrain_models(self):
        """Retrain all models with latest data"""
        if not SKLEARN_AVAILABLE:
            return
        
        device_configs = ["franklin_t10", "hp_proliant"]  # Could be dynamic
        
        for device_name in device_configs:
            self.logger.info(f"Retraining model for {device_name}")
            self._train_failure_model(device_name)
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get information about trained models"""
        info = {
            "sklearn_available": SKLEARN_AVAILABLE,
            "models_loaded": len(self.models),
            "scalers_loaded": len(self.scalers),
            "model_names": list(self.models.keys()),
            "model_path": str(self.model_path)
        }
        
        return info