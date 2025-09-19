"""
Franklin T10 Gateway Automation Module
Handles web interface automation, monitoring, and configuration
"""

import requests
import logging
import time
import json
from typing import Dict, Any, Optional
from urllib3.exceptions import InsecureRequestWarning
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, WebDriverException

# Suppress SSL warnings for internal devices
requests.packages.urllib3.disable_warnings(InsecureRequestWarning)


class FranklinT10Gateway:
    """Franklin T10 Gateway automation and monitoring class"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.ip_address = config.get('ip_address', '192.168.0.1')
        self.username = config.get('username', 'admin')
        self.password = config.get('password', 'admin')
        self.session = requests.Session()
        self.session.verify = False
        self.logger = logging.getLogger(__name__)
        self.driver = None
        
    def _setup_selenium(self) -> webdriver.Chrome:
        """Setup Chrome WebDriver for web interface automation"""
        chrome_options = Options()
        chrome_options.add_argument('--headless')
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-gpu')
        chrome_options.add_argument('--ignore-certificate-errors')
        chrome_options.add_argument('--ignore-ssl-errors')
        
        try:
            driver = webdriver.Chrome(options=chrome_options)
            return driver
        except WebDriverException as e:
            self.logger.error(f"Failed to initialize Chrome WebDriver: {e}")
            return None
    
    def authenticate_web(self) -> bool:
        """Authenticate via web interface using Selenium"""
        try:
            if not self.driver:
                self.driver = self._setup_selenium()
                if not self.driver:
                    return False
            
            login_url = f"http://{self.ip_address}/login"
            self.driver.get(login_url)
            
            # Wait for login form and fill credentials
            wait = WebDriverWait(self.driver, 10)
            username_field = wait.until(EC.presence_of_element_located((By.NAME, "username")))
            password_field = self.driver.find_element(By.NAME, "password")
            
            username_field.send_keys(self.username)
            password_field.send_keys(self.password)
            
            # Submit form
            login_button = self.driver.find_element(By.TYPE, "submit")
            login_button.click()
            
            # Wait for successful login (check for dashboard or status page)
            time.sleep(2)
            return "dashboard" in self.driver.current_url.lower() or "status" in self.driver.current_url.lower()
            
        except (TimeoutException, WebDriverException) as e:
            self.logger.error(f"Web authentication failed: {e}")
            return False
    
    def authenticate_api(self) -> bool:
        """Authenticate via REST API if available"""
        try:
            login_url = f"http://{self.ip_address}/api/login"
            payload = {
                "username": self.username,
                "password": self.password
            }
            
            response = self.session.post(login_url, json=payload, timeout=10)
            if response.status_code == 200:
                self.logger.info("API authentication successful")
                return True
            else:
                self.logger.warning(f"API authentication failed: {response.status_code}")
                return False
                
        except requests.RequestException as e:
            self.logger.warning(f"API authentication not available: {e}")
            return False
    
    def get_device_status(self) -> Dict[str, Any]:
        """Get comprehensive device status"""
        status = {
            "timestamp": time.time(),
            "device_ip": self.ip_address,
            "online": False,
            "signal_strength": None,
            "network_type": None,
            "data_usage": None,
            "temperature": None,
            "battery_level": None,
            "connected_devices": 0,
            "uptime": None
        }
        
        try:
            # Try API first, fall back to web scraping
            if self.authenticate_api():
                status.update(self._get_status_api())
            elif self.authenticate_web():
                status.update(self._get_status_web())
            
            status["online"] = True
            self.logger.info(f"Device status retrieved: {status['network_type']} signal at {status['signal_strength']}")
            
        except Exception as e:
            self.logger.error(f"Failed to get device status: {e}")
            
        return status
    
    def _get_status_api(self) -> Dict[str, Any]:
        """Get status via API"""
        try:
            response = self.session.get(f"http://{self.ip_address}/api/status", timeout=10)
            if response.status_code == 200:
                return response.json()
        except requests.RequestException as e:
            self.logger.warning(f"API status request failed: {e}")
        return {}
    
    def _get_status_web(self) -> Dict[str, Any]:
        """Get status via web scraping"""
        status = {}
        try:
            if not self.driver:
                return status
                
            # Navigate to status page
            self.driver.get(f"http://{self.ip_address}/status")
            time.sleep(2)
            
            # Extract signal strength
            try:
                signal_element = self.driver.find_element(By.CLASS_NAME, "signal-strength")
                status["signal_strength"] = signal_element.text
            except:
                pass
            
            # Extract network type
            try:
                network_element = self.driver.find_element(By.CLASS_NAME, "network-type")
                status["network_type"] = network_element.text
            except:
                pass
            
            # Extract connected devices count
            try:
                devices_element = self.driver.find_element(By.CLASS_NAME, "connected-devices")
                status["connected_devices"] = int(devices_element.text)
            except:
                pass
                
        except Exception as e:
            self.logger.warning(f"Web status scraping failed: {e}")
            
        return status
    
    def reboot_device(self) -> bool:
        """Reboot the gateway device"""
        try:
            if self.authenticate_api():
                response = self.session.post(f"http://{self.ip_address}/api/reboot", timeout=10)
                if response.status_code == 200:
                    self.logger.info("Device reboot initiated via API")
                    return True
            
            elif self.authenticate_web():
                # Navigate to admin/reboot page
                self.driver.get(f"http://{self.ip_address}/admin/reboot")
                time.sleep(1)
                
                # Find and click reboot button
                reboot_button = self.driver.find_element(By.ID, "reboot-button")
                reboot_button.click()
                
                # Confirm reboot if confirmation dialog appears
                try:
                    confirm_button = WebDriverWait(self.driver, 3).until(
                        EC.element_to_be_clickable((By.ID, "confirm-reboot"))
                    )
                    confirm_button.click()
                except TimeoutException:
                    pass
                
                self.logger.info("Device reboot initiated via web interface")
                return True
                
        except Exception as e:
            self.logger.error(f"Failed to reboot device: {e}")
            
        return False
    
    def get_connected_devices(self) -> list:
        """Get list of connected devices"""
        devices = []
        try:
            if self.authenticate_api():
                response = self.session.get(f"http://{self.ip_address}/api/devices", timeout=10)
                if response.status_code == 200:
                    devices = response.json().get('devices', [])
            
            elif self.authenticate_web():
                self.driver.get(f"http://{self.ip_address}/devices")
                time.sleep(2)
                
                # Parse device table
                device_rows = self.driver.find_elements(By.CSS_SELECTOR, ".device-table tr")
                for row in device_rows[1:]:  # Skip header
                    cells = row.find_elements(By.TAG_NAME, "td")
                    if len(cells) >= 3:
                        device = {
                            "mac_address": cells[0].text,
                            "ip_address": cells[1].text,
                            "device_name": cells[2].text,
                            "connected_time": cells[3].text if len(cells) > 3 else None
                        }
                        devices.append(device)
                        
        except Exception as e:
            self.logger.error(f"Failed to get connected devices: {e}")
            
        return devices
    
    def update_configuration(self, config_updates: Dict[str, Any]) -> bool:
        """Update device configuration"""
        try:
            if self.authenticate_api():
                response = self.session.put(
                    f"http://{self.ip_address}/api/config",
                    json=config_updates,
                    timeout=10
                )
                if response.status_code == 200:
                    self.logger.info("Configuration updated via API")
                    return True
            
            # Web-based configuration update would be implemented here
            # This would involve navigating to config pages and updating fields
            
        except Exception as e:
            self.logger.error(f"Failed to update configuration: {e}")
            
        return False
    
    def cleanup(self):
        """Clean up resources"""
        if self.driver:
            self.driver.quit()
            self.driver = None
        if self.session:
            self.session.close()