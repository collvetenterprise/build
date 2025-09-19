# API Reference

## REST API Endpoints

The web dashboard provides a REST API for programmatic access to device management and monitoring.

### Base URL
```
http://localhost:5000/api
```

## Device Management

### Get All Devices Status
```http
GET /api/devices
```

**Response:**
```json
{
  "franklin_t10": {
    "online": true,
    "signal_strength": "85%",
    "network_type": "LTE",
    "connected_devices": 5,
    "timestamp": 1640995200
  },
  "hp_proliant": {
    "online": true,
    "power_state": "On",
    "health_status": "OK",
    "model": "ProLiant DL380 Gen10",
    "timestamp": 1640995200
  }
}
```

### Get Specific Device Status
```http
GET /api/device/{device_name}/status
```

**Parameters:**
- `device_name`: `franklin_t10` or `hp_proliant`

**Response:**
```json
{
  "online": true,
  "power_state": "On",
  "health_status": "OK",
  "thermal_metrics": {
    "temperatures": [...],
    "fans": [...],
    "overall_status": "OK"
  },
  "timestamp": 1640995200
}
```

### Get Device History
```http
GET /api/device/{device_name}/history?hours=24
```

**Parameters:**
- `device_name`: Device identifier
- `hours`: Number of hours of history (optional, default: 24)

**Response:**
```json
[
  {
    "timestamp": "2023-01-01T12:00:00",
    "online": true,
    "power_state": "On",
    "health_status": "OK"
  }
]
```

### Execute Device Action
```http
POST /api/device/{device_name}/action
```

**Request Body:**
```json
{
  "action": "reboot",
  "parameters": {
    "force": false
  }
}
```

**Franklin T10 Actions:**
- `reboot`: Reboot the gateway
- `get_devices`: Get connected devices
- `update_config`: Update configuration

**HP ProLiant Actions:**
- `power_on`: Power on the server
- `power_off`: Power off the server
- `reboot`: Reboot the server
- `get_logs`: Get system logs
- `clear_logs`: Clear system logs

**Response:**
```json
{
  "success": true,
  "message": "Action completed successfully"
}
```

## Alert Management

### Get Alerts
```http
GET /api/alerts?hours=24&acknowledged=false
```

**Parameters:**
- `hours`: Number of hours to look back (optional, default: 24)
- `acknowledged`: Filter by acknowledgment status (optional)

**Response:**
```json
[
  {
    "id": 1,
    "title": "High Temperature Alert",
    "message": "Server temperature exceeded threshold",
    "severity": "warning",
    "device_name": "hp_proliant",
    "timestamp": "2023-01-01T12:00:00",
    "acknowledged": false
  }
]
```

### Acknowledge Alert
```http
POST /api/alerts/{alert_id}/acknowledge
```

**Response:**
```json
{
  "success": true
}
```

## Performance Metrics

### Get Performance Metrics
```http
GET /api/metrics/{device_name}/{metric_name}?hours=24
```

**Parameters:**
- `device_name`: Device identifier
- `metric_name`: Metric name (e.g., "temperature", "power_consumption")
- `hours`: Number of hours of data (optional, default: 24)

**Response:**
```json
[
  {
    "timestamp": "2023-01-01T12:00:00",
    "value": 45.5,
    "unit": "°C"
  }
]
```

## System Statistics

### Get System Stats
```http
GET /api/stats
```

**Response:**
```json
{
  "enabled_devices": 2,
  "total_devices": 2,
  "database": {
    "device_status_count": 1440,
    "alerts_count": 25,
    "metrics_count": 5760,
    "database_size_mb": 2.5
  },
  "uptime": "2 days, 5 hours"
}
```

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "error": "Error description"
}
```

**HTTP Status Codes:**
- `200`: Success
- `400`: Bad Request
- `404`: Not Found
- `500`: Internal Server Error
- `503`: Service Unavailable

## Python Client Example

```python
import requests
import json

# Base URL
base_url = "http://localhost:5000/api"

# Get device status
response = requests.get(f"{base_url}/device/hp_proliant/status")
if response.status_code == 200:
    status = response.json()
    print(f"Server power state: {status['power_state']}")

# Execute device action
action_data = {
    "action": "reboot",
    "parameters": {"force": False}
}
response = requests.post(
    f"{base_url}/device/hp_proliant/action",
    json=action_data
)
if response.status_code == 200:
    result = response.json()
    print(f"Action result: {result['message']}")

# Get recent alerts
response = requests.get(f"{base_url}/alerts?hours=24")
if response.status_code == 200:
    alerts = response.json()
    print(f"Found {len(alerts)} alerts")
```

## WebSocket Support (Future)

Real-time updates will be available via WebSocket connections:

```javascript
// Connect to WebSocket
const ws = new WebSocket('ws://localhost:5000/ws');

// Receive real-time updates
ws.onmessage = function(event) {
    const data = JSON.parse(event.data);
    console.log('Real-time update:', data);
};

// Subscribe to device updates
ws.send(JSON.stringify({
    type: 'subscribe',
    device: 'hp_proliant'
}));
```