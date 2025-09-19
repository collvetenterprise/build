"""
Alert manager for sending notifications
"""

import smtplib
import logging
import requests
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any, List
from datetime import datetime

from utils.database import DatabaseManager


class AlertManager:
    """Manages alert notifications via email, Slack, etc."""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = logging.getLogger(__name__)
        self.db_manager = DatabaseManager()
        
        # Initialize email settings
        self.email_config = config.get("email", {})
        self.email_enabled = self.email_config.get("enabled", False)
        
        # Initialize Slack settings
        self.slack_config = config.get("slack", {})
        self.slack_enabled = self.slack_config.get("enabled", False)
        
    def send_alert(self, title: str, message: str, severity: str = "info", 
                   device_name: str = None):
        """Send alert via configured channels"""
        try:
            # Store alert in database
            self.db_manager.store_alert(title, message, severity, device_name)
            
            # Format alert message
            formatted_message = self._format_alert_message(title, message, severity, device_name)
            
            # Send via enabled channels
            if self.email_enabled:
                self._send_email_alert(title, formatted_message, severity)
            
            if self.slack_enabled:
                self._send_slack_alert(title, formatted_message, severity)
            
            self.logger.info(f"Alert sent: {title} [{severity}]")
            
        except Exception as e:
            self.logger.error(f"Failed to send alert: {e}")
    
    def _format_alert_message(self, title: str, message: str, severity: str, 
                             device_name: str = None) -> str:
        """Format alert message with timestamp and details"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        formatted = f"""
🚨 AUTOMATION PLATFORM ALERT

Title: {title}
Severity: {severity.upper()}
Time: {timestamp}
"""
        
        if device_name:
            formatted += f"Device: {device_name}\n"
        
        formatted += f"""
Message:
{message}

---
Enterprise Network Automation Platform
        """
        
        return formatted.strip()
    
    def _send_email_alert(self, title: str, message: str, severity: str):
        """Send alert via email"""
        try:
            if not self.email_config.get("recipients"):
                return
            
            # Create message
            msg = MIMEMultipart()
            msg['From'] = self.email_config.get("username", "automation@company.com")
            msg['Subject'] = f"[{severity.upper()}] {title}"
            
            # Add message body
            msg.attach(MIMEText(message, 'plain'))
            
            # Connect to SMTP server
            server = smtplib.SMTP(
                self.email_config.get("smtp_server", "smtp.gmail.com"),
                self.email_config.get("smtp_port", 587)
            )
            server.starttls()
            
            if self.email_config.get("username") and self.email_config.get("password"):
                server.login(
                    self.email_config["username"],
                    self.email_config["password"]
                )
            
            # Send to all recipients
            recipients = self.email_config["recipients"]
            if isinstance(recipients, str):
                recipients = [recipients]
            
            for recipient in recipients:
                msg['To'] = recipient
                server.send_message(msg)
                del msg['To']
            
            server.quit()
            self.logger.debug("Email alert sent successfully")
            
        except Exception as e:
            self.logger.error(f"Failed to send email alert: {e}")
    
    def _send_slack_alert(self, title: str, message: str, severity: str):
        """Send alert via Slack webhook"""
        try:
            webhook_url = self.slack_config.get("webhook_url")
            if not webhook_url:
                return
            
            # Map severity to Slack colors
            color_map = {
                "critical": "#FF0000",
                "warning": "#FFA500",
                "info": "#0000FF",
                "success": "#00FF00"
            }
            
            # Create Slack message payload
            payload = {
                "channel": self.slack_config.get("channel", "#alerts"),
                "username": "Automation Platform",
                "icon_emoji": ":robot_face:",
                "attachments": [
                    {
                        "color": color_map.get(severity, "#808080"),
                        "title": title,
                        "text": message,
                        "fields": [
                            {
                                "title": "Severity",
                                "value": severity.upper(),
                                "short": True
                            },
                            {
                                "title": "Time",
                                "value": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                                "short": True
                            }
                        ],
                        "footer": "Enterprise Network Automation Platform",
                        "ts": int(datetime.now().timestamp())
                    }
                ]
            }
            
            # Send to Slack
            response = requests.post(webhook_url, json=payload, timeout=10)
            if response.status_code == 200:
                self.logger.debug("Slack alert sent successfully")
            else:
                self.logger.error(f"Slack alert failed: {response.status_code}")
                
        except Exception as e:
            self.logger.error(f"Failed to send Slack alert: {e}")
    
    def get_recent_alerts(self, hours: int = 24) -> List[Dict[str, Any]]:
        """Get recent alerts from database"""
        return self.db_manager.get_recent_alerts(hours)
    
    def acknowledge_alert(self, alert_id: int) -> bool:
        """Acknowledge an alert"""
        return self.db_manager.acknowledge_alert(alert_id)
    
    def test_alert_channels(self) -> Dict[str, bool]:
        """Test all configured alert channels"""
        results = {}
        
        # Test email
        if self.email_enabled:
            try:
                self._send_email_alert(
                    "Test Alert", 
                    "This is a test message from the automation platform.", 
                    "info"
                )
                results["email"] = True
            except Exception as e:
                self.logger.error(f"Email test failed: {e}")
                results["email"] = False
        
        # Test Slack
        if self.slack_enabled:
            try:
                self._send_slack_alert(
                    "Test Alert", 
                    "This is a test message from the automation platform.", 
                    "info"
                )
                results["slack"] = True
            except Exception as e:
                self.logger.error(f"Slack test failed: {e}")
                results["slack"] = False
        
        return results