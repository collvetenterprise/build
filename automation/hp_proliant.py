"""
HP ProLiant DL380 Server Automation Module
Handles iLO API integration, health monitoring, and power management
"""

import requests
import logging
import time
import json
import base64
from typing import Dict, Any, Optional, List
from urllib3.exceptions import InsecureRequestWarning
from requests.auth import HTTPBasicAuth

# Suppress SSL warnings for internal devices
requests.packages.urllib3.disable_warnings(InsecureRequestWarning)


class HPProLiantDL380:
    """HP ProLiant DL380 server automation and monitoring class"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.ilo_ip = config.get('ilo_ip', '192.168.1.100')
        self.username = config.get('username', 'Administrator')
        self.password = config.get('password', 'password')
        self.session = requests.Session()
        self.session.verify = False
        self.session.auth = HTTPBasicAuth(self.username, self.password)
        self.logger = logging.getLogger(__name__)
        self.redfish_base = f"https://{self.ilo_ip}/redfish/v1"
        
    def test_connection(self) -> bool:
        """Test connection to iLO interface"""
        try:
            response = self.session.get(f"{self.redfish_base}/", timeout=10)
            if response.status_code == 200:
                self.logger.info("iLO connection successful")
                return True
            else:
                self.logger.error(f"iLO connection failed: {response.status_code}")
                return False
        except requests.RequestException as e:
            self.logger.error(f"iLO connection error: {e}")
            return False
    
    def get_system_info(self) -> Dict[str, Any]:
        """Get comprehensive system information"""
        info = {
            "timestamp": time.time(),
            "server_ip": self.ilo_ip,
            "online": False,
            "power_state": "Unknown",
            "health_status": "Unknown",
            "model": None,
            "serial_number": None,
            "bios_version": None,
            "processor_summary": {},
            "memory_summary": {},
            "thermal_metrics": {},
            "power_metrics": {},
            "storage_summary": {}
        }
        
        try:
            if not self.test_connection():
                return info
            
            # Get system information
            system_response = self.session.get(f"{self.redfish_base}/Systems/1/", timeout=10)
            if system_response.status_code == 200:
                system_data = system_response.json()
                info.update({
                    "online": True,
                    "power_state": system_data.get("PowerState", "Unknown"),
                    "health_status": system_data.get("Status", {}).get("Health", "Unknown"),
                    "model": system_data.get("Model"),
                    "serial_number": system_data.get("SerialNumber"),
                    "bios_version": system_data.get("BiosVersion"),
                    "processor_summary": system_data.get("ProcessorSummary", {}),
                    "memory_summary": system_data.get("MemorySummary", {})
                })
            
            # Get thermal metrics
            thermal_response = self.session.get(f"{self.redfish_base}/Chassis/1/Thermal/", timeout=10)
            if thermal_response.status_code == 200:
                thermal_data = thermal_response.json()
                info["thermal_metrics"] = self._parse_thermal_data(thermal_data)
            
            # Get power metrics
            power_response = self.session.get(f"{self.redfish_base}/Chassis/1/Power/", timeout=10)
            if power_response.status_code == 200:
                power_data = power_response.json()
                info["power_metrics"] = self._parse_power_data(power_data)
            
            # Get storage summary
            storage_response = self.session.get(f"{self.redfish_base}/Systems/1/Storage/", timeout=10)
            if storage_response.status_code == 200:
                storage_data = storage_response.json()
                info["storage_summary"] = self._parse_storage_data(storage_data)
            
            self.logger.info(f"System info retrieved: {info['model']} - {info['power_state']} - {info['health_status']}")
            
        except Exception as e:
            self.logger.error(f"Failed to get system info: {e}")
            
        return info
    
    def _parse_thermal_data(self, thermal_data: Dict[str, Any]) -> Dict[str, Any]:
        """Parse thermal sensor data"""
        thermal_info = {
            "temperatures": [],
            "fans": [],
            "overall_status": "OK"
        }
        
        try:
            # Parse temperature sensors
            for temp in thermal_data.get("Temperatures", []):
                temp_info = {
                    "name": temp.get("Name"),
                    "reading_celsius": temp.get("ReadingCelsius"),
                    "status": temp.get("Status", {}).get("Health", "Unknown"),
                    "upper_threshold": temp.get("UpperThresholdCritical"),
                    "lower_threshold": temp.get("LowerThresholdCritical")
                }
                thermal_info["temperatures"].append(temp_info)
                
                if temp_info["status"] not in ["OK", "Unknown"]:
                    thermal_info["overall_status"] = "Warning"
            
            # Parse fan sensors
            for fan in thermal_data.get("Fans", []):
                fan_info = {
                    "name": fan.get("Name"),
                    "reading_rpm": fan.get("Reading"),
                    "status": fan.get("Status", {}).get("Health", "Unknown"),
                    "reading_units": fan.get("ReadingUnits")
                }
                thermal_info["fans"].append(fan_info)
                
                if fan_info["status"] not in ["OK", "Unknown"]:
                    thermal_info["overall_status"] = "Warning"
                    
        except Exception as e:
            self.logger.warning(f"Error parsing thermal data: {e}")
            
        return thermal_info
    
    def _parse_power_data(self, power_data: Dict[str, Any]) -> Dict[str, Any]:
        """Parse power consumption and supply data"""
        power_info = {
            "power_supplies": [],
            "power_consumption": {},
            "overall_status": "OK"
        }
        
        try:
            # Parse power supplies
            for psu in power_data.get("PowerSupplies", []):
                psu_info = {
                    "name": psu.get("Name"),
                    "status": psu.get("Status", {}).get("Health", "Unknown"),
                    "power_capacity_watts": psu.get("PowerCapacityWatts"),
                    "power_output_watts": psu.get("PowerOutputWatts"),
                    "efficiency_percent": psu.get("EfficiencyPercent")
                }
                power_info["power_supplies"].append(psu_info)
                
                if psu_info["status"] not in ["OK", "Unknown"]:
                    power_info["overall_status"] = "Warning"
            
            # Parse power consumption
            for power_control in power_data.get("PowerControl", []):
                power_info["power_consumption"] = {
                    "power_consumed_watts": power_control.get("PowerConsumedWatts"),
                    "power_capacity_watts": power_control.get("PowerCapacityWatts"),
                    "power_allocated_watts": power_control.get("PowerAllocatedWatts"),
                    "power_metrics": power_control.get("PowerMetrics", {})
                }
                
        except Exception as e:
            self.logger.warning(f"Error parsing power data: {e}")
            
        return power_info
    
    def _parse_storage_data(self, storage_data: Dict[str, Any]) -> Dict[str, Any]:
        """Parse storage controller and drive data"""
        storage_info = {
            "controllers": [],
            "total_drives": 0,
            "healthy_drives": 0,
            "overall_status": "OK"
        }
        
        try:
            for member in storage_data.get("Members", []):
                storage_id = member.get("@odata.id", "").split("/")[-1]
                controller_response = self.session.get(
                    f"{self.redfish_base}/Systems/1/Storage/{storage_id}/",
                    timeout=10
                )
                
                if controller_response.status_code == 200:
                    controller_data = controller_response.json()
                    controller_info = {
                        "id": storage_id,
                        "name": controller_data.get("Name"),
                        "status": controller_data.get("Status", {}).get("Health", "Unknown"),
                        "drives": []
                    }
                    
                    # Parse drives
                    for drive in controller_data.get("Drives", []):
                        drive_id = drive.get("@odata.id", "").split("/")[-1]
                        drive_response = self.session.get(drive.get("@odata.id"), timeout=5)
                        
                        if drive_response.status_code == 200:
                            drive_data = drive_response.json()
                            drive_info = {
                                "id": drive_id,
                                "name": drive_data.get("Name"),
                                "status": drive_data.get("Status", {}).get("Health", "Unknown"),
                                "capacity_bytes": drive_data.get("CapacityBytes"),
                                "media_type": drive_data.get("MediaType"),
                                "protocol": drive_data.get("Protocol")
                            }
                            controller_info["drives"].append(drive_info)
                            storage_info["total_drives"] += 1
                            
                            if drive_info["status"] == "OK":
                                storage_info["healthy_drives"] += 1
                            else:
                                storage_info["overall_status"] = "Warning"
                    
                    storage_info["controllers"].append(controller_info)
                    
        except Exception as e:
            self.logger.warning(f"Error parsing storage data: {e}")
            
        return storage_info
    
    def power_on(self) -> bool:
        """Power on the server"""
        try:
            power_action = {
                "Action": "ComputerSystem.Reset",
                "ResetType": "On"
            }
            
            response = self.session.post(
                f"{self.redfish_base}/Systems/1/Actions/ComputerSystem.Reset/",
                json=power_action,
                timeout=10
            )
            
            if response.status_code in [200, 204]:
                self.logger.info("Server power on initiated")
                return True
            else:
                self.logger.error(f"Power on failed: {response.status_code}")
                return False
                
        except Exception as e:
            self.logger.error(f"Failed to power on server: {e}")
            return False
    
    def power_off(self, force: bool = False) -> bool:
        """Power off the server"""
        try:
            reset_type = "ForceOff" if force else "GracefulShutdown"
            power_action = {
                "Action": "ComputerSystem.Reset",
                "ResetType": reset_type
            }
            
            response = self.session.post(
                f"{self.redfish_base}/Systems/1/Actions/ComputerSystem.Reset/",
                json=power_action,
                timeout=10
            )
            
            if response.status_code in [200, 204]:
                self.logger.info(f"Server {reset_type.lower()} initiated")
                return True
            else:
                self.logger.error(f"Power off failed: {response.status_code}")
                return False
                
        except Exception as e:
            self.logger.error(f"Failed to power off server: {e}")
            return False
    
    def reboot(self, force: bool = False) -> bool:
        """Reboot the server"""
        try:
            reset_type = "ForceRestart" if force else "GracefulRestart"
            power_action = {
                "Action": "ComputerSystem.Reset",
                "ResetType": reset_type
            }
            
            response = self.session.post(
                f"{self.redfish_base}/Systems/1/Actions/ComputerSystem.Reset/",
                json=power_action,
                timeout=10
            )
            
            if response.status_code in [200, 204]:
                self.logger.info(f"Server {reset_type.lower()} initiated")
                return True
            else:
                self.logger.error(f"Reboot failed: {response.status_code}")
                return False
                
        except Exception as e:
            self.logger.error(f"Failed to reboot server: {e}")
            return False
    
    def get_system_logs(self, log_type: str = "System") -> List[Dict[str, Any]]:
        """Get system event logs"""
        logs = []
        try:
            logs_response = self.session.get(
                f"{self.redfish_base}/Systems/1/LogServices/{log_type}/Entries/",
                timeout=10
            )
            
            if logs_response.status_code == 200:
                logs_data = logs_response.json()
                for entry in logs_data.get("Members", []):
                    log_entry = {
                        "id": entry.get("Id"),
                        "name": entry.get("Name"),
                        "created": entry.get("Created"),
                        "entry_type": entry.get("EntryType"),
                        "severity": entry.get("Severity"),
                        "message": entry.get("Message")
                    }
                    logs.append(log_entry)
                    
        except Exception as e:
            self.logger.error(f"Failed to get system logs: {e}")
            
        return logs
    
    def clear_system_logs(self, log_type: str = "System") -> bool:
        """Clear system event logs"""
        try:
            clear_action = {
                "Action": "LogService.ClearLog"
            }
            
            response = self.session.post(
                f"{self.redfish_base}/Systems/1/LogServices/{log_type}/Actions/LogService.ClearLog/",
                json=clear_action,
                timeout=10
            )
            
            if response.status_code in [200, 204]:
                self.logger.info(f"{log_type} logs cleared")
                return True
            else:
                self.logger.error(f"Clear logs failed: {response.status_code}")
                return False
                
        except Exception as e:
            self.logger.error(f"Failed to clear logs: {e}")
            return False
    
    def get_firmware_inventory(self) -> List[Dict[str, Any]]:
        """Get firmware inventory information"""
        firmware_list = []
        try:
            firmware_response = self.session.get(
                f"{self.redfish_base}/UpdateService/FirmwareInventory/",
                timeout=10
            )
            
            if firmware_response.status_code == 200:
                firmware_data = firmware_response.json()
                for member in firmware_data.get("Members", []):
                    firmware_id = member.get("@odata.id", "").split("/")[-1]
                    fw_response = self.session.get(member.get("@odata.id"), timeout=5)
                    
                    if fw_response.status_code == 200:
                        fw_data = fw_response.json()
                        firmware_info = {
                            "id": firmware_id,
                            "name": fw_data.get("Name"),
                            "version": fw_data.get("Version"),
                            "updateable": fw_data.get("Updateable"),
                            "status": fw_data.get("Status", {}).get("Health", "Unknown")
                        }
                        firmware_list.append(firmware_info)
                        
        except Exception as e:
            self.logger.error(f"Failed to get firmware inventory: {e}")
            
        return firmware_list
    
    def cleanup(self):
        """Clean up resources"""
        if self.session:
            self.session.close()