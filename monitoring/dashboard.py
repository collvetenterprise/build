"""
Web dashboard for monitoring and controlling devices
"""

from flask import Flask, render_template, jsonify, request, redirect, url_for
import logging
import threading
import json
from datetime import datetime, timedelta
from typing import Dict, Any

from utils.database import DatabaseManager


class WebDashboard:
    """Web-based dashboard for monitoring and control"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.dashboard_config = config.get("monitoring", {}).get("web_dashboard", {})
        self.logger = logging.getLogger(__name__)
        self.db_manager = DatabaseManager()
        self.orchestrator = None  # Will be set by the main orchestrator
        
        # Initialize Flask app
        self.app = Flask(__name__)
        self.app.secret_key = "automation-platform-secret-key"
        
        # Setup routes
        self._setup_routes()
        
        # Configure logging for Flask
        log = logging.getLogger('werkzeug')
        log.setLevel(logging.WARNING)
    
    def _setup_routes(self):
        """Setup Flask routes"""
        
        @self.app.route('/')
        def dashboard():
            """Main dashboard page"""
            try:
                # Get recent device status
                devices_status = {}
                device_configs = self.config.get("devices", {})
                
                for device_name in device_configs.keys():
                    if device_configs[device_name].get("enabled", True):
                        status_history = self.db_manager.get_device_status_history(device_name, hours=1)
                        if status_history:
                            devices_status[device_name] = status_history[0]
                        else:
                            devices_status[device_name] = {"online": False, "last_seen": "Never"}
                
                # Get recent alerts
                recent_alerts = self.db_manager.get_recent_alerts(hours=24, acknowledged=False)
                
                # Get database stats
                db_stats = self.db_manager.get_database_stats()
                
                return render_template('dashboard.html', 
                                     devices=devices_status,
                                     alerts=recent_alerts[:10],  # Show latest 10
                                     db_stats=db_stats)
                                     
            except Exception as e:
                self.logger.error(f"Dashboard error: {e}")
                return f"Dashboard error: {e}", 500
        
        @self.app.route('/api/devices')
        def api_devices():
            """API endpoint for device status"""
            try:
                devices_status = {}
                device_configs = self.config.get("devices", {})
                
                for device_name in device_configs.keys():
                    if device_configs[device_name].get("enabled", True):
                        status_history = self.db_manager.get_device_status_history(device_name, hours=1)
                        if status_history:
                            devices_status[device_name] = status_history[0]
                        else:
                            devices_status[device_name] = {"online": False, "last_seen": "Never"}
                
                return jsonify(devices_status)
                
            except Exception as e:
                return jsonify({"error": str(e)}), 500
        
        @self.app.route('/api/device/<device_name>/status')
        def api_device_status(device_name):
            """API endpoint for specific device status"""
            try:
                if self.orchestrator:
                    status = self.orchestrator.get_device_status(device_name)
                    return jsonify(status)
                else:
                    # Fall back to database
                    status_history = self.db_manager.get_device_status_history(device_name, hours=1)
                    if status_history:
                        return jsonify(status_history[0])
                    else:
                        return jsonify({"error": "No status available"}), 404
                        
            except Exception as e:
                return jsonify({"error": str(e)}), 500
        
        @self.app.route('/api/device/<device_name>/history')
        def api_device_history(device_name):
            """API endpoint for device status history"""
            try:
                hours = request.args.get('hours', 24, type=int)
                history = self.db_manager.get_device_status_history(device_name, hours)
                return jsonify(history)
                
            except Exception as e:
                return jsonify({"error": str(e)}), 500
        
        @self.app.route('/api/device/<device_name>/action', methods=['POST'])
        def api_device_action(device_name):
            """API endpoint for device actions"""
            try:
                if not self.orchestrator:
                    return jsonify({"error": "Orchestrator not available"}), 503
                
                data = request.get_json()
                action = data.get('action')
                kwargs = data.get('parameters', {})
                
                result = self.orchestrator.execute_device_action(device_name, action, **kwargs)
                return jsonify(result)
                
            except Exception as e:
                return jsonify({"error": str(e)}), 500
        
        @self.app.route('/api/alerts')
        def api_alerts():
            """API endpoint for alerts"""
            try:
                hours = request.args.get('hours', 24, type=int)
                acknowledged = request.args.get('acknowledged')
                
                if acknowledged is not None:
                    acknowledged = acknowledged.lower() == 'true'
                
                alerts = self.db_manager.get_recent_alerts(hours, acknowledged)
                return jsonify(alerts)
                
            except Exception as e:
                return jsonify({"error": str(e)}), 500
        
        @self.app.route('/api/alerts/<int:alert_id>/acknowledge', methods=['POST'])
        def api_acknowledge_alert(alert_id):
            """API endpoint to acknowledge alert"""
            try:
                success = self.db_manager.acknowledge_alert(alert_id)
                return jsonify({"success": success})
                
            except Exception as e:
                return jsonify({"error": str(e)}), 500
        
        @self.app.route('/api/metrics/<device_name>/<metric_name>')
        def api_metrics(device_name, metric_name):
            """API endpoint for performance metrics"""
            try:
                hours = request.args.get('hours', 24, type=int)
                metrics = self.db_manager.get_performance_metrics(device_name, metric_name, hours)
                return jsonify(metrics)
                
            except Exception as e:
                return jsonify({"error": str(e)}), 500
        
        @self.app.route('/api/stats')
        def api_stats():
            """API endpoint for system statistics"""
            try:
                db_stats = self.db_manager.get_database_stats()
                
                # Add device counts
                device_configs = self.config.get("devices", {})
                enabled_devices = sum(1 for config in device_configs.values() 
                                    if config.get("enabled", True))
                
                stats = {
                    "enabled_devices": enabled_devices,
                    "total_devices": len(device_configs),
                    "database": db_stats,
                    "uptime": self._get_uptime()
                }
                
                return jsonify(stats)
                
            except Exception as e:
                return jsonify({"error": str(e)}), 500
        
        @self.app.route('/device/<device_name>')
        def device_details(device_name):
            """Device details page"""
            try:
                # Get device configuration
                device_config = self.config.get("devices", {}).get(device_name, {})
                if not device_config:
                    return "Device not found", 404
                
                # Get recent status
                status_history = self.db_manager.get_device_status_history(device_name, hours=24)
                
                # Get recent alerts for this device
                all_alerts = self.db_manager.get_recent_alerts(hours=72)
                device_alerts = [alert for alert in all_alerts 
                               if alert.get('device_name') == device_name]
                
                return render_template('device_details.html',
                                     device_name=device_name,
                                     device_config=device_config,
                                     status_history=status_history,
                                     alerts=device_alerts)
                                     
            except Exception as e:
                self.logger.error(f"Device details error: {e}")
                return f"Device details error: {e}", 500
        
        @self.app.route('/alerts')
        def alerts_page():
            """Alerts management page"""
            try:
                # Get all recent alerts
                hours = request.args.get('hours', 24, type=int)
                acknowledged = request.args.get('acknowledged')
                
                if acknowledged is not None:
                    acknowledged = acknowledged.lower() == 'true'
                
                alerts = self.db_manager.get_recent_alerts(hours, acknowledged)
                
                return render_template('alerts.html', alerts=alerts, hours=hours)
                
            except Exception as e:
                self.logger.error(f"Alerts page error: {e}")
                return f"Alerts page error: {e}", 500
    
    def _get_uptime(self) -> str:
        """Get system uptime (placeholder)"""
        # This would typically track when the system started
        return "Unknown"
    
    def set_orchestrator(self, orchestrator):
        """Set reference to orchestrator for real-time data"""
        self.orchestrator = orchestrator
    
    def run(self, host: str = None, port: int = None, debug: bool = None):
        """Run the Flask application"""
        host = host or self.dashboard_config.get("host", "0.0.0.0")
        port = port or self.dashboard_config.get("port", 5000)
        debug = debug or self.dashboard_config.get("debug", False)
        
        self.logger.info(f"Starting web dashboard on {host}:{port}")
        self.app.run(host=host, port=port, debug=debug, threaded=True)
    
    def start_background(self):
        """Start the web dashboard in background thread"""
        if not self.dashboard_config.get("enabled", True):
            return
        
        host = self.dashboard_config.get("host", "0.0.0.0")
        port = self.dashboard_config.get("port", 5000)
        
        thread = threading.Thread(
            target=self.run,
            kwargs={"host": host, "port": port, "debug": False},
            daemon=True
        )
        thread.start()
        self.logger.info(f"Web dashboard started in background on {host}:{port}")


# HTML Templates (inline for simplicity)
def create_templates():
    """Create template files"""
    import os
    
    templates_dir = "templates"
    os.makedirs(templates_dir, exist_ok=True)
    
    # Base template
    base_template = '''
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{% block title %}Enterprise Network Automation Platform{% endblock %}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: #2c3e50; color: white; padding: 15px; margin-bottom: 20px; }
        .nav { background: #34495e; padding: 10px; margin-bottom: 20px; }
        .nav a { color: white; text-decoration: none; margin-right: 20px; }
        .nav a:hover { text-decoration: underline; }
        .card { background: white; padding: 20px; margin: 10px 0; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .device-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .status-online { color: #27ae60; }
        .status-offline { color: #e74c3c; }
        .alert-critical { border-left: 5px solid #e74c3c; }
        .alert-warning { border-left: 5px solid #f39c12; }
        .alert-info { border-left: 5px solid #3498db; }
        .btn { background: #3498db; color: white; padding: 8px 16px; border: none; border-radius: 3px; cursor: pointer; }
        .btn:hover { background: #2980b9; }
        .btn-danger { background: #e74c3c; }
        .btn-danger:hover { background: #c0392b; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Enterprise Network Automation Platform</h1>
    </div>
    <div class="nav">
        <a href="/">Dashboard</a>
        <a href="/alerts">Alerts</a>
    </div>
    <div class="container">
        {% block content %}{% endblock %}
    </div>
    <script>
        // Auto-refresh every 30 seconds
        setTimeout(() => location.reload(), 30000);
    </script>
</body>
</html>
    '''
    
    # Dashboard template
    dashboard_template = '''
{% extends "base.html" %}
{% block content %}
<div class="device-grid">
    {% for device_name, status in devices.items() %}
    <div class="card">
        <h3>{{ device_name.replace('_', ' ').title() }}</h3>
        <p>Status: <span class="{% if status.online %}status-online{% else %}status-offline{% endif %}">
            {% if status.online %}Online{% else %}Offline{% endif %}
        </span></p>
        {% if status.network_type %}
        <p>Network: {{ status.network_type }}</p>
        {% endif %}
        {% if status.signal_strength %}
        <p>Signal: {{ status.signal_strength }}</p>
        {% endif %}
        {% if status.power_state %}
        <p>Power: {{ status.power_state }}</p>
        {% endif %}
        <a href="/device/{{ device_name }}" class="btn">Details</a>
    </div>
    {% endfor %}
</div>

<div class="card">
    <h3>Recent Alerts</h3>
    {% if alerts %}
        {% for alert in alerts %}
        <div class="card alert-{{ alert.severity }}">
            <strong>{{ alert.title }}</strong>
            <p>{{ alert.message }}</p>
            <small>{{ alert.timestamp }}</small>
        </div>
        {% endfor %}
    {% else %}
        <p>No recent alerts</p>
    {% endif %}
</div>

<div class="card">
    <h3>System Statistics</h3>
    <p>Database Records: {{ db_stats.device_status_count + db_stats.alerts_count + db_stats.metrics_count }}</p>
    <p>Database Size: {{ "%.2f"|format(db_stats.database_size_mb) }} MB</p>
</div>
{% endblock %}
    '''
    
    with open(f"{templates_dir}/base.html", "w") as f:
        f.write(base_template.strip())
    
    with open(f"{templates_dir}/dashboard.html", "w") as f:
        f.write(dashboard_template.strip())
    
    # Create other templates
    device_details_template = '''
{% extends "base.html" %}
{% block title %}{{ device_name }} Details{% endblock %}
{% block content %}
<h2>{{ device_name.replace('_', ' ').title() }} Details</h2>

<div class="card">
    <h3>Current Status</h3>
    {% if status_history %}
        {% set current = status_history[0] %}
        <p>Last Update: {{ current.timestamp }}</p>
        <p>Online: {{ current.online }}</p>
        {% for key, value in current.items() %}
            {% if key not in ['timestamp', 'online'] %}
            <p>{{ key.replace('_', ' ').title() }}: {{ value }}</p>
            {% endif %}
        {% endfor %}
    {% else %}
        <p>No status data available</p>
    {% endif %}
</div>

<div class="card">
    <h3>Device Actions</h3>
    <button onclick="rebootDevice()" class="btn btn-danger">Reboot Device</button>
    <button onclick="refreshStatus()" class="btn">Refresh Status</button>
</div>

<div class="card">
    <h3>Recent Alerts</h3>
    {% for alert in alerts %}
    <div class="card alert-{{ alert.severity }}">
        <strong>{{ alert.title }}</strong>
        <p>{{ alert.message }}</p>
        <small>{{ alert.timestamp }}</small>
    </div>
    {% endfor %}
</div>

<script>
function rebootDevice() {
    if (confirm('Are you sure you want to reboot this device?')) {
        fetch(`/api/device/{{ device_name }}/action`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({action: 'reboot'})
        }).then(response => response.json())
          .then(data => alert(data.message || 'Action completed'));
    }
}

function refreshStatus() {
    location.reload();
}
</script>
{% endblock %}
    '''
    
    alerts_template = '''
{% extends "base.html" %}
{% block title %}Alerts{% endblock %}
{% block content %}
<h2>System Alerts</h2>

{% for alert in alerts %}
<div class="card alert-{{ alert.severity }}">
    <h4>{{ alert.title }}</h4>
    <p>{{ alert.message }}</p>
    <p><strong>Severity:</strong> {{ alert.severity.upper() }}</p>
    <p><strong>Time:</strong> {{ alert.timestamp }}</p>
    {% if alert.device_name %}
    <p><strong>Device:</strong> {{ alert.device_name }}</p>
    {% endif %}
    {% if not alert.acknowledged %}
    <button onclick="acknowledgeAlert({{ alert.id }})" class="btn">Acknowledge</button>
    {% endif %}
</div>
{% endfor %}

<script>
function acknowledgeAlert(alertId) {
    fetch(`/api/alerts/${alertId}/acknowledge`, {method: 'POST'})
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                location.reload();
            }
        });
}
</script>
{% endblock %}
    '''
    
    with open(f"{templates_dir}/device_details.html", "w") as f:
        f.write(device_details_template.strip())
    
    with open(f"{templates_dir}/alerts.html", "w") as f:
        f.write(alerts_template.strip())


# Create templates when module is imported
create_templates()