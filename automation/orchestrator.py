"""
Automation Orchestrator
Central coordinator for all automation tasks
"""

import logging
import time
import threading
import schedule
from typing import Dict, Any, List
from datetime import datetime, timedelta

from automation.franklin_t10 import FranklinT10Gateway
from automation.hp_proliant import HPProLiantDL380
from automation.config_manager import ConfigManager
from monitoring.alerting import AlertManager
from ai.predictive_maintenance import PredictiveMaintenanceEngine
from ai.anomaly_detection import AnomalyDetector
from utils.database import DatabaseManager


class AutomationOrchestrator:
    """Main orchestrator for automation tasks"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = logging.getLogger(__name__)
        self.running = False
        self.devices = {}
        self.alert_manager = AlertManager(config.get("monitoring", {}).get("alerts", {}))
        self.db_manager = DatabaseManager()
        
        # Initialize AI components if enabled
        ai_config = config.get("ai", {})
        if ai_config.get("enabled", True):
            self.predictive_engine = PredictiveMaintenanceEngine(ai_config)
            self.anomaly_detector = AnomalyDetector(ai_config)
        else:
            self.predictive_engine = None
            self.anomaly_detector = None
        
        self._setup_devices()
        self._setup_schedules()
        
    def _setup_devices(self):
        """Initialize device automation objects"""
        device_configs = self.config.get("devices", {})
        
        # Initialize Franklin T10 Gateway
        franklin_config = device_configs.get("franklin_t10", {})
        if franklin_config.get("enabled", True):
            self.devices["franklin_t10"] = FranklinT10Gateway(franklin_config)
            self.logger.info("Franklin T10 Gateway automation initialized")
        
        # Initialize HP ProLiant Server
        hp_config = device_configs.get("hp_proliant", {})
        if hp_config.get("enabled", True):
            self.devices["hp_proliant"] = HPProLiantDL380(hp_config)
            self.logger.info("HP ProLiant DL380 automation initialized")
    
    def _setup_schedules(self):
        """Setup scheduled tasks"""
        automation_config = self.config.get("automation", {})
        
        # Schedule device health checks
        check_interval = automation_config.get("check_interval", 60)
        schedule.every(check_interval).seconds.do(self._run_health_checks)
        
        # Schedule AI model updates
        if self.predictive_engine:
            schedule.every().day.at("02:00").do(self._update_ai_models)
        
        # Schedule data cleanup
        schedule.every().week.do(self._cleanup_old_data)
        
        self.logger.info("Scheduled tasks configured")
    
    def start(self):
        """Start the automation orchestrator"""
        self.running = True
        self.logger.info("Starting automation orchestrator")
        
        # Start background thread for scheduled tasks
        scheduler_thread = threading.Thread(target=self._run_scheduler, daemon=True)
        scheduler_thread.start()
        
        # Run initial health check
        self._run_health_checks()
        
        try:
            # Main monitoring loop
            while self.running:
                time.sleep(10)  # Check every 10 seconds for new tasks
                
        except KeyboardInterrupt:
            self.stop()
    
    def stop(self):
        """Stop the automation orchestrator"""
        self.running = False
        self.logger.info("Stopping automation orchestrator")
        
        # Cleanup device connections
        for device in self.devices.values():
            if hasattr(device, 'cleanup'):
                device.cleanup()
    
    def _run_scheduler(self):
        """Run scheduled tasks in background thread"""
        while self.running:
            schedule.run_pending()
            time.sleep(1)
    
    def _run_health_checks(self):
        """Run health checks on all devices"""
        self.logger.info("Running health checks on all devices")
        
        for device_name, device in self.devices.items():
            try:
                self._check_device_health(device_name, device)
            except Exception as e:
                self.logger.error(f"Health check failed for {device_name}: {e}")
    
    def _check_device_health(self, device_name: str, device):
        """Check health of a specific device"""
        try:
            if device_name == "franklin_t10":
                status = device.get_device_status()
                self._process_franklin_status(status)
                
            elif device_name == "hp_proliant":
                info = device.get_system_info()
                self._process_hp_status(info)
            
        except Exception as e:
            self.logger.error(f"Error checking {device_name} health: {e}")
            self._handle_device_failure(device_name, str(e))
    
    def _process_franklin_status(self, status: Dict[str, Any]):
        """Process Franklin T10 status and take actions"""
        device_name = "franklin_t10"
        
        # Store status in database
        self.db_manager.store_device_status(device_name, status)
        
        # Check for issues
        if not status.get("online", False):
            self.alert_manager.send_alert(
                "Franklin T10 Gateway Offline",
                f"Gateway at {status.get('device_ip')} is not responding",
                "critical"
            )
            self._handle_franklin_failure(status)
            return
        
        # Check signal strength
        signal_strength = status.get("signal_strength")
        if signal_strength and self._is_low_signal(signal_strength):
            self.alert_manager.send_alert(
                "Low Signal Strength",
                f"Franklin T10 signal strength is low: {signal_strength}",
                "warning"
            )
        
        # Run anomaly detection if available
        if self.anomaly_detector:
            is_anomaly = self.anomaly_detector.detect_anomaly("franklin_t10", status)
            if is_anomaly:
                self.alert_manager.send_alert(
                    "Anomaly Detected",
                    f"Unusual behavior detected on Franklin T10: {status}",
                    "warning"
                )
        
        self.logger.debug(f"Franklin T10 status processed: {status.get('network_type')} signal")
    
    def _process_hp_status(self, info: Dict[str, Any]):
        """Process HP ProLiant status and take actions"""
        device_name = "hp_proliant"
        
        # Store status in database
        self.db_manager.store_device_status(device_name, info)
        
        # Check overall health
        if not info.get("online", False):
            self.alert_manager.send_alert(
                "HP ProLiant Server Offline",
                f"Server at {info.get('server_ip')} is not responding",
                "critical"
            )
            return
        
        # Check power state
        power_state = info.get("power_state", "Unknown")
        if power_state not in ["On", "PoweringOn"]:
            self.alert_manager.send_alert(
                "Server Power Issue",
                f"HP ProLiant server power state: {power_state}",
                "critical"
            )
        
        # Check health status
        health_status = info.get("health_status", "Unknown")
        if health_status not in ["OK", "Warning"]:
            self.alert_manager.send_alert(
                "Server Health Issue",
                f"HP ProLiant server health: {health_status}",
                "critical"
            )
        
        # Check thermal metrics
        thermal_metrics = info.get("thermal_metrics", {})
        if thermal_metrics.get("overall_status") != "OK":
            self.alert_manager.send_alert(
                "Thermal Warning",
                f"Server thermal status: {thermal_metrics.get('overall_status')}",
                "warning"
            )
        
        # Check power metrics
        power_metrics = info.get("power_metrics", {})
        if power_metrics.get("overall_status") != "OK":
            self.alert_manager.send_alert(
                "Power Supply Warning",
                f"Server power supply status: {power_metrics.get('overall_status')}",
                "warning"
            )
        
        # Run predictive maintenance if available
        if self.predictive_engine:
            prediction = self.predictive_engine.predict_failure("hp_proliant", info)
            if prediction.get("failure_risk", 0) > 0.7:
                self.alert_manager.send_alert(
                    "Predictive Maintenance Alert",
                    f"High failure risk detected: {prediction.get('recommendation')}",
                    "warning"
                )
        
        self.logger.debug(f"HP ProLiant status processed: {power_state} - {health_status}")
    
    def _handle_device_failure(self, device_name: str, error: str):
        """Handle device failure scenarios"""
        device_config = self.config.get("devices", {}).get(device_name, {})
        
        if device_name == "franklin_t10":
            self._handle_franklin_failure({"error": error})
        elif device_name == "hp_proliant":
            self._handle_hp_failure({"error": error})
    
    def _handle_franklin_failure(self, status: Dict[str, Any]):
        """Handle Franklin T10 specific failures"""
        device_config = self.config.get("devices", {}).get("franklin_t10", {})
        
        if device_config.get("reboot_on_failure", True):
            self.logger.info("Attempting to reboot Franklin T10 due to failure")
            device = self.devices.get("franklin_t10")
            if device and device.reboot_device():
                self.alert_manager.send_alert(
                    "Franklin T10 Auto-Recovery",
                    "Gateway was automatically rebooted due to failure",
                    "info"
                )
    
    def _handle_hp_failure(self, info: Dict[str, Any]):
        """Handle HP ProLiant specific failures"""
        self.logger.warning("HP ProLiant failure detected, manual intervention may be required")
        # HP servers typically require more careful handling, so we mainly alert
    
    def _is_low_signal(self, signal_strength: str) -> bool:
        """Check if signal strength is considered low"""
        try:
            # Extract numeric value from signal strength string
            if "%" in signal_strength:
                value = int(signal_strength.replace("%", ""))
                return value < 30
            elif "dBm" in signal_strength:
                value = int(signal_strength.replace("dBm", ""))
                return value < -90
        except:
            pass
        return False
    
    def _update_ai_models(self):
        """Update AI models with recent data"""
        if self.predictive_engine:
            self.logger.info("Updating predictive maintenance models")
            self.predictive_engine.retrain_models()
        
        if self.anomaly_detector:
            self.logger.info("Updating anomaly detection models")
            self.anomaly_detector.update_models()
    
    def _cleanup_old_data(self):
        """Clean up old monitoring data"""
        self.logger.info("Cleaning up old monitoring data")
        cutoff_date = datetime.now() - timedelta(days=90)
        self.db_manager.cleanup_old_data(cutoff_date)
    
    def get_device_status(self, device_name: str) -> Dict[str, Any]:
        """Get current status of a specific device"""
        device = self.devices.get(device_name)
        if not device:
            return {"error": f"Device {device_name} not found"}
        
        try:
            if device_name == "franklin_t10":
                return device.get_device_status()
            elif device_name == "hp_proliant":
                return device.get_system_info()
        except Exception as e:
            return {"error": str(e)}
    
    def execute_device_action(self, device_name: str, action: str, **kwargs) -> Dict[str, Any]:
        """Execute an action on a specific device"""
        device = self.devices.get(device_name)
        if not device:
            return {"success": False, "error": f"Device {device_name} not found"}
        
        try:
            if device_name == "franklin_t10":
                return self._execute_franklin_action(device, action, **kwargs)
            elif device_name == "hp_proliant":
                return self._execute_hp_action(device, action, **kwargs)
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def _execute_franklin_action(self, device, action: str, **kwargs) -> Dict[str, Any]:
        """Execute Franklin T10 specific actions"""
        if action == "reboot":
            success = device.reboot_device()
            return {"success": success, "message": "Reboot initiated" if success else "Reboot failed"}
        elif action == "get_devices":
            devices = device.get_connected_devices()
            return {"success": True, "devices": devices}
        elif action == "update_config":
            config_updates = kwargs.get("config", {})
            success = device.update_configuration(config_updates)
            return {"success": success, "message": "Configuration updated" if success else "Update failed"}
        else:
            return {"success": False, "error": f"Unknown action: {action}"}
    
    def _execute_hp_action(self, device, action: str, **kwargs) -> Dict[str, Any]:
        """Execute HP ProLiant specific actions"""
        if action == "power_on":
            success = device.power_on()
            return {"success": success, "message": "Power on initiated" if success else "Power on failed"}
        elif action == "power_off":
            force = kwargs.get("force", False)
            success = device.power_off(force)
            return {"success": success, "message": "Power off initiated" if success else "Power off failed"}
        elif action == "reboot":
            force = kwargs.get("force", False)
            success = device.reboot(force)
            return {"success": success, "message": "Reboot initiated" if success else "Reboot failed"}
        elif action == "get_logs":
            log_type = kwargs.get("log_type", "System")
            logs = device.get_system_logs(log_type)
            return {"success": True, "logs": logs}
        elif action == "clear_logs":
            log_type = kwargs.get("log_type", "System")
            success = device.clear_system_logs(log_type)
            return {"success": success, "message": "Logs cleared" if success else "Clear logs failed"}
        else:
            return {"success": False, "error": f"Unknown action: {action}"}