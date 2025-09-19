"""
API Routes for AI Automation System
REST API endpoints for system management and monitoring
"""

from fastapi import APIRouter, HTTPException, Depends, Request, BackgroundTasks
from fastapi.responses import JSONResponse
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from datetime import datetime
import asyncio


router = APIRouter()


# Pydantic models for request/response validation
class CallRequest(BaseModel):
    caller_id: str = Field(..., description="Caller phone number")
    destination: str = Field(..., description="Destination phone number")
    call_type: str = Field(default="voice", description="Type of call")
    timestamp: Optional[str] = Field(default=None, description="Call timestamp")


class CallRoutingResponse(BaseModel):
    queue: str
    agent: Optional[str]
    confidence: float
    reasoning: List[str]
    estimated_wait_time: int
    priority_level: str


class VoiceProcessingRequest(BaseModel):
    audio_data: bytes = Field(..., description="Audio data to process")


class TrafficData(BaseModel):
    bandwidth_in: float
    bandwidth_out: float
    packet_loss: float
    latency: float
    connection_count: int
    protocol_breakdown: Dict[str, float]


class SecurityIncident(BaseModel):
    type: str
    severity: str
    source_ip: str
    description: str
    details: Dict[str, Any]


def get_system_manager(request: Request):
    """Dependency to get system manager from app state"""
    return request.app.state.system_manager


@router.get("/status")
async def get_system_status(system_manager=Depends(get_system_manager)):
    """Get overall system status"""
    try:
        status = await system_manager.get_system_status()
        return JSONResponse(content={
            "status": "success",
            "data": status,
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/gateway/stats")
async def get_gateway_statistics(system_manager=Depends(get_system_manager)):
    """Get Franklin T10 gateway statistics"""
    try:
        stats = await system_manager.franklin_gateway.get_statistics()
        return JSONResponse(content={
            "status": "success",
            "data": stats,
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/gateway/interfaces")
async def get_gateway_interfaces(system_manager=Depends(get_system_manager)):
    """Get gateway interface status"""
    try:
        interfaces = await system_manager.franklin_gateway.get_interface_status()
        return JSONResponse(content={
            "status": "success",
            "data": interfaces,
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/gateway/devices")
async def get_connected_devices(system_manager=Depends(get_system_manager)):
    """Get devices connected to gateway"""
    try:
        devices = await system_manager.franklin_gateway.get_connected_devices()
        return JSONResponse(content={
            "status": "success",
            "data": devices,
            "count": len(devices),
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/gateway/signal")
async def get_signal_strength(system_manager=Depends(get_system_manager)):
    """Get cellular signal strength"""
    try:
        signal_info = await system_manager.franklin_gateway.get_signal_strength()
        return JSONResponse(content={
            "status": "success",
            "data": signal_info,
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/gateway/qos")
async def adjust_qos_settings(
    qos_settings: Dict[str, Any],
    system_manager=Depends(get_system_manager)
):
    """Adjust Quality of Service settings"""
    try:
        await system_manager.franklin_gateway.adjust_qos(qos_settings)
        return JSONResponse(content={
            "status": "success",
            "message": "QoS settings updated",
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/server/health")
async def get_server_health(system_manager=Depends(get_system_manager)):
    """Get HP ProLiant server health metrics"""
    try:
        # Simulate server health data
        health_data = {
            'cpu_usage': 45.2,
            'memory_usage': 67.8,
            'disk_usage': 78.3,
            'temperature': 42.5,
            'network_throughput': 234.5,
            'power_consumption': 320.5,
            'fan_speeds': [2400, 2380, 2420, 2390],
            'raid_status': 'healthy',
            'overall_status': 'healthy'
        }
        
        return JSONResponse(content={
            "status": "success",
            "data": health_data,
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/calls/route")
async def route_call(
    call_request: CallRequest,
    system_manager=Depends(get_system_manager)
):
    """AI-powered call routing"""
    try:
        call_data = call_request.dict()
        if not call_data.get('timestamp'):
            call_data['timestamp'] = datetime.now()
        
        routing_decision = await system_manager.call_routing_ai.route_call(call_data)
        
        return JSONResponse(content={
            "status": "success",
            "data": routing_decision,
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/voice/process")
async def process_voice(
    audio_data: bytes,
    system_manager=Depends(get_system_manager)
):
    """Process voice input for recognition and intent detection"""
    try:
        result = await system_manager.voice_recognition_ai.process_audio_stream(audio_data)
        
        return JSONResponse(content={
            "status": "success",
            "data": result,
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/voice/detect-intent")
async def detect_intent(
    text: str,
    system_manager=Depends(get_system_manager)
):
    """Detect intent from text"""
    try:
        result = await system_manager.voice_recognition_ai.detect_intent(text)
        
        return JSONResponse(content={
            "status": "success",
            "data": result,
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/fraud/analyze")
async def analyze_fraud(
    call_data: Dict[str, Any],
    system_manager=Depends(get_system_manager)
):
    """Analyze call for fraud indicators"""
    try:
        if 'timestamp' not in call_data:
            call_data['timestamp'] = datetime.now()
        
        result = await system_manager.fraud_detection_ai.analyze_call(call_data)
        
        return JSONResponse(content={
            "status": "success",
            "data": result,
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/fraud/statistics")
async def get_fraud_statistics(system_manager=Depends(get_system_manager)):
    """Get fraud detection statistics"""
    try:
        stats = await system_manager.fraud_detection_ai.get_fraud_statistics()
        
        return JSONResponse(content={
            "status": "success",
            "data": stats,
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/fraud/blacklist")
async def add_to_blacklist(
    phone_number: str,
    reason: str = "Manual addition",
    system_manager=Depends(get_system_manager)
):
    """Add phone number to blacklist"""
    try:
        await system_manager.fraud_detection_ai.add_to_blacklist(phone_number, reason)
        
        return JSONResponse(content={
            "status": "success",
            "message": f"Phone number {phone_number} added to blacklist",
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/network/traffic")
async def get_traffic_analysis(system_manager=Depends(get_system_manager)):
    """Get real-time traffic analysis"""
    try:
        # Get current traffic data from gateway
        traffic_data = await system_manager.franklin_gateway.get_statistics()
        
        # Analyze with AI
        analysis = await system_manager.traffic_analysis_ai.analyze_traffic(traffic_data)
        
        return JSONResponse(content={
            "status": "success",
            "data": analysis,
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/network/statistics")
async def get_traffic_statistics(system_manager=Depends(get_system_manager)):
    """Get traffic analysis statistics"""
    try:
        stats = await system_manager.traffic_analysis_ai.get_traffic_statistics()
        
        return JSONResponse(content={
            "status": "success",
            "data": stats,
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/security/scan")
async def security_scan(system_manager=Depends(get_system_manager)):
    """Perform security scan"""
    try:
        threats = await system_manager.security_monitor.scan_for_threats()
        
        return JSONResponse(content={
            "status": "success",
            "data": {
                "threats_detected": len(threats),
                "threats": threats
            },
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/security/status")
async def get_security_status(system_manager=Depends(get_system_manager)):
    """Get security monitoring status"""
    try:
        status = await system_manager.security_monitor.get_security_status()
        
        return JSONResponse(content={
            "status": "success",
            "data": status,
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/security/mitigate")
async def mitigate_threat(
    threat: SecurityIncident,
    background_tasks: BackgroundTasks,
    system_manager=Depends(get_system_manager)
):
    """Mitigate a security threat"""
    try:
        # Add mitigation to background tasks
        background_tasks.add_task(
            system_manager.security_monitor.mitigate_threat,
            threat.dict()
        )
        
        return JSONResponse(content={
            "status": "success",
            "message": "Threat mitigation initiated",
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/calls/active")
async def get_active_calls(system_manager=Depends(get_system_manager)):
    """Get active calls"""
    try:
        active_calls = await system_manager.sip_server.get_active_calls()
        
        return JSONResponse(content={
            "status": "success",
            "data": {
                "count": len(active_calls),
                "calls": active_calls
            },
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/calls/statistics")
async def get_call_statistics(system_manager=Depends(get_system_manager)):
    """Get call statistics"""
    try:
        stats = await system_manager.sip_server.get_call_statistics()
        
        return JSONResponse(content={
            "status": "success",
            "data": stats,
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/calls/history")
async def get_call_history(
    limit: int = 100,
    system_manager=Depends(get_system_manager)
):
    """Get call history"""
    try:
        history = await system_manager.sip_server.get_call_history(limit)
        
        return JSONResponse(content={
            "status": "success",
            "data": {
                "count": len(history),
                "calls": history
            },
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/calls/{call_id}/terminate")
async def terminate_call(
    call_id: str,
    reason: str = "user_request",
    system_manager=Depends(get_system_manager)
):
    """Terminate an active call"""
    try:
        result = await system_manager.sip_server.terminate_call(call_id, reason)
        
        return JSONResponse(content={
            "status": "success",
            "data": result,
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ai/models/status")
async def get_ai_models_status(system_manager=Depends(get_system_manager)):
    """Get AI models status"""
    try:
        status = {
            "call_routing": {
                "loaded": system_manager.call_routing_ai.is_loaded(),
                "accuracy": await system_manager.call_routing_ai.get_current_accuracy()
            },
            "voice_recognition": {
                "loaded": system_manager.voice_recognition_ai.is_loaded(),
                "accuracy": await system_manager.voice_recognition_ai.get_current_accuracy()
            },
            "fraud_detection": {
                "loaded": system_manager.fraud_detection_ai.is_loaded(),
                "accuracy": await system_manager.fraud_detection_ai.get_current_accuracy()
            },
            "traffic_analysis": {
                "loaded": system_manager.traffic_analysis_ai.is_loaded(),
                "accuracy": await system_manager.traffic_analysis_ai.get_current_accuracy()
            }
        }
        
        return JSONResponse(content={
            "status": "success",
            "data": status,
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ai/models/{model_name}/retrain")
async def retrain_model(
    model_name: str,
    background_tasks: BackgroundTasks,
    system_manager=Depends(get_system_manager)
):
    """Retrain an AI model"""
    try:
        model_map = {
            "call_routing": system_manager.call_routing_ai,
            "voice_recognition": system_manager.voice_recognition_ai,
            "fraud_detection": system_manager.fraud_detection_ai,
            "traffic_analysis": system_manager.traffic_analysis_ai
        }
        
        if model_name not in model_map:
            raise HTTPException(status_code=404, detail="Model not found")
        
        # Add retraining to background tasks
        background_tasks.add_task(model_map[model_name].retrain)
        
        return JSONResponse(content={
            "status": "success",
            "message": f"Model {model_name} retraining initiated",
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard/summary")
async def get_dashboard_summary(system_manager=Depends(get_system_manager)):
    """Get dashboard summary data"""
    try:
        # Get summary from database
        summary = await system_manager.db.get_dashboard_summary()
        
        # Add real-time data
        summary["real_time"] = {
            "active_calls": await system_manager.sip_server.get_active_call_count(),
            "gateway_connected": await system_manager.franklin_gateway.is_connected(),
            "security_monitoring": system_manager.security_monitor.is_running
        }
        
        return JSONResponse(content={
            "status": "success",
            "data": summary,
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/logs/events")
async def get_system_events(
    limit: int = 100,
    event_type: Optional[str] = None,
    system_manager=Depends(get_system_manager)
):
    """Get system events"""
    try:
        events = await system_manager.db.get_recent_events(limit, event_type)
        
        return JSONResponse(content={
            "status": "success",
            "data": {
                "count": len(events),
                "events": events
            },
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/maintenance/alerts")
async def get_maintenance_alerts(
    resolved: bool = False,
    system_manager=Depends(get_system_manager)
):
    """Get maintenance alerts"""
    try:
        alerts = await system_manager.db.get_maintenance_alerts(resolved)
        
        return JSONResponse(content={
            "status": "success",
            "data": {
                "count": len(alerts),
                "alerts": alerts
            },
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/maintenance/alerts/{alert_id}/resolve")
async def resolve_maintenance_alert(
    alert_id: int,
    system_manager=Depends(get_system_manager)
):
    """Mark maintenance alert as resolved"""
    try:
        await system_manager.db.mark_alert_resolved(alert_id)
        
        return JSONResponse(content={
            "status": "success",
            "message": f"Alert {alert_id} marked as resolved",
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reports/security")
async def generate_security_report(system_manager=Depends(get_system_manager)):
    """Generate security report"""
    try:
        report = await system_manager.security_monitor.generate_security_report()
        
        return JSONResponse(content={
            "status": "success",
            "data": report,
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))