"""
Database Manager
Handles data storage and retrieval for the automation system
"""

import sqlite3
import aiosqlite
import json
from typing import Dict, Any, List, Optional
from loguru import logger
from pathlib import Path
from datetime import datetime


class DatabaseManager:
    """Database manager for storing system data"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.db_type = config.get('type', 'sqlite')
        self.db_path = config.get('path', 'data/automation_system.db')
        self.connection = None
        
        # Ensure data directory exists
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
    
    async def initialize(self):
        """Initialize database and create tables"""
        try:
            if self.db_type == 'sqlite':
                await self._initialize_sqlite()
            else:
                raise Exception(f"Unsupported database type: {self.db_type}")
            
            await self._create_tables()
            logger.info("Database initialized successfully")
            
        except Exception as e:
            logger.error(f"Database initialization failed: {e}")
            raise
    
    async def _initialize_sqlite(self):
        """Initialize SQLite database"""
        self.connection = await aiosqlite.connect(self.db_path)
        await self.connection.execute("PRAGMA foreign_keys = ON")
        await self.connection.commit()
    
    async def _create_tables(self):
        """Create database tables"""
        
        # System events table
        await self.connection.execute("""
            CREATE TABLE IF NOT EXISTS system_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                event_type TEXT NOT NULL,
                component TEXT NOT NULL,
                severity TEXT NOT NULL,
                message TEXT NOT NULL,
                details TEXT,
                resolved BOOLEAN DEFAULT FALSE
            )
        """)
        
        # Traffic analysis table
        await self.connection.execute("""
            CREATE TABLE IF NOT EXISTS traffic_analysis (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                bandwidth_in REAL,
                bandwidth_out REAL,
                latency REAL,
                packet_loss REAL,
                connection_count INTEGER,
                health_score REAL,
                anomaly_detected BOOLEAN,
                analysis_data TEXT
            )
        """)
        
        # Call records table
        await self.connection.execute("""
            CREATE TABLE IF NOT EXISTS call_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                call_id TEXT UNIQUE NOT NULL,
                caller_id TEXT NOT NULL,
                destination TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT,
                duration REAL,
                status TEXT NOT NULL,
                quality_metrics TEXT,
                routing_decision TEXT,
                fraud_score REAL
            )
        """)
        
        # Security incidents table
        await self.connection.execute("""
            CREATE TABLE IF NOT EXISTS security_incidents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                incident_type TEXT NOT NULL,
                severity TEXT NOT NULL,
                source_ip TEXT,
                description TEXT NOT NULL,
                mitigated BOOLEAN DEFAULT FALSE,
                mitigation_action TEXT,
                details TEXT
            )
        """)
        
        # AI model performance table
        await self.connection.execute("""
            CREATE TABLE IF NOT EXISTS ai_model_performance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                model_name TEXT NOT NULL,
                accuracy REAL,
                precision_score REAL,
                recall REAL,
                f1_score REAL,
                training_samples INTEGER,
                performance_metrics TEXT
            )
        """)
        
        # Device status table
        await self.connection.execute("""
            CREATE TABLE IF NOT EXISTS device_status (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                device_type TEXT NOT NULL,
                device_id TEXT NOT NULL,
                status TEXT NOT NULL,
                health_metrics TEXT,
                alerts TEXT
            )
        """)
        
        # Maintenance alerts table
        await self.connection.execute("""
            CREATE TABLE IF NOT EXISTS maintenance_alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                device_type TEXT NOT NULL,
                device_id TEXT NOT NULL,
                alert_type TEXT NOT NULL,
                severity TEXT NOT NULL,
                description TEXT NOT NULL,
                prediction_data TEXT,
                acknowledged BOOLEAN DEFAULT FALSE,
                resolved BOOLEAN DEFAULT FALSE
            )
        """)
        
        await self.connection.commit()
        logger.debug("Database tables created successfully")
    
    async def store_system_event(self, event_type: str, component: str, 
                                severity: str, message: str, details: Dict[str, Any] = None):
        """Store a system event"""
        try:
            await self.connection.execute("""
                INSERT INTO system_events 
                (timestamp, event_type, component, severity, message, details)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                datetime.now().isoformat(),
                event_type,
                component,
                severity,
                message,
                json.dumps(details) if details else None
            ))
            await self.connection.commit()
            
        except Exception as e:
            logger.error(f"Failed to store system event: {e}")
    
    async def store_traffic_analysis(self, analysis: Dict[str, Any]):
        """Store traffic analysis results"""
        try:
            await self.connection.execute("""
                INSERT INTO traffic_analysis 
                (timestamp, bandwidth_in, bandwidth_out, latency, packet_loss, 
                 connection_count, health_score, anomaly_detected, analysis_data)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                analysis.get('timestamp', datetime.now().isoformat()),
                analysis.get('analysis', {}).get('bandwidth', {}).get('bandwidth_in', 0),
                analysis.get('analysis', {}).get('bandwidth', {}).get('bandwidth_out', 0),
                analysis.get('analysis', {}).get('performance', {}).get('latency', {}).get('value', 0),
                analysis.get('analysis', {}).get('performance', {}).get('packet_loss', {}).get('value', 0),
                analysis.get('analysis', {}).get('bandwidth', {}).get('connection_count', 0),
                analysis.get('health_score', 0),
                analysis.get('anomaly_detected', False),
                json.dumps(analysis)
            ))
            await self.connection.commit()
            
        except Exception as e:
            logger.error(f"Failed to store traffic analysis: {e}")
    
    async def store_call_record(self, call_data: Dict[str, Any]):
        """Store call record"""
        try:
            await self.connection.execute("""
                INSERT OR REPLACE INTO call_records 
                (call_id, caller_id, destination, start_time, end_time, duration, 
                 status, quality_metrics, routing_decision, fraud_score)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                call_data.get('call_id'),
                call_data.get('caller_id'),
                call_data.get('destination'),
                call_data.get('start_time'),
                call_data.get('end_time'),
                call_data.get('duration'),
                call_data.get('status'),
                json.dumps(call_data.get('quality_metrics', {})),
                json.dumps(call_data.get('routing_decision', {})),
                call_data.get('fraud_score', 0)
            ))
            await self.connection.commit()
            
        except Exception as e:
            logger.error(f"Failed to store call record: {e}")
    
    async def store_security_incident(self, incident: Dict[str, Any]):
        """Store security incident"""
        try:
            await self.connection.execute("""
                INSERT INTO security_incidents 
                (timestamp, incident_type, severity, source_ip, description, 
                 mitigated, mitigation_action, details)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                incident.get('timestamp', datetime.now().isoformat()),
                incident.get('type'),
                incident.get('severity'),
                incident.get('source_ip'),
                incident.get('description'),
                incident.get('mitigated', False),
                incident.get('mitigation_action'),
                json.dumps(incident.get('details', {}))
            ))
            await self.connection.commit()
            
        except Exception as e:
            logger.error(f"Failed to store security incident: {e}")
    
    async def store_maintenance_alert(self, alert: Dict[str, Any]):
        """Store maintenance alert"""
        try:
            await self.connection.execute("""
                INSERT INTO maintenance_alerts 
                (timestamp, device_type, device_id, alert_type, severity, 
                 description, prediction_data)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                datetime.now().isoformat(),
                alert.get('device_type', 'server'),
                alert.get('device_id', 'hp_proliant_380'),
                alert.get('alert_type', 'maintenance'),
                'medium' if alert.get('maintenance_needed') else 'low',
                ', '.join(alert.get('alerts', [])),
                json.dumps(alert)
            ))
            await self.connection.commit()
            
        except Exception as e:
            logger.error(f"Failed to store maintenance alert: {e}")
    
    async def get_recent_events(self, limit: int = 100, event_type: str = None) -> List[Dict[str, Any]]:
        """Get recent system events"""
        try:
            if event_type:
                cursor = await self.connection.execute("""
                    SELECT * FROM system_events 
                    WHERE event_type = ? 
                    ORDER BY timestamp DESC 
                    LIMIT ?
                """, (event_type, limit))
            else:
                cursor = await self.connection.execute("""
                    SELECT * FROM system_events 
                    ORDER BY timestamp DESC 
                    LIMIT ?
                """, (limit,))
            
            rows = await cursor.fetchall()
            columns = [description[0] for description in cursor.description]
            
            events = []
            for row in rows:
                event = dict(zip(columns, row))
                if event['details']:
                    event['details'] = json.loads(event['details'])
                events.append(event)
            
            return events
            
        except Exception as e:
            logger.error(f"Failed to get recent events: {e}")
            return []
    
    async def get_traffic_statistics(self, hours: int = 24) -> Dict[str, Any]:
        """Get traffic statistics for specified time period"""
        try:
            since_time = (datetime.now() - datetime.timedelta(hours=hours)).isoformat()
            
            cursor = await self.connection.execute("""
                SELECT 
                    AVG(bandwidth_in) as avg_bandwidth_in,
                    AVG(bandwidth_out) as avg_bandwidth_out,
                    AVG(latency) as avg_latency,
                    AVG(packet_loss) as avg_packet_loss,
                    AVG(health_score) as avg_health_score,
                    COUNT(*) as total_samples,
                    SUM(CASE WHEN anomaly_detected THEN 1 ELSE 0 END) as anomalies_detected
                FROM traffic_analysis 
                WHERE timestamp > ?
            """, (since_time,))
            
            row = await cursor.fetchone()
            columns = [description[0] for description in cursor.description]
            
            if row:
                return dict(zip(columns, row))
            else:
                return {}
                
        except Exception as e:
            logger.error(f"Failed to get traffic statistics: {e}")
            return {}
    
    async def get_call_statistics(self, hours: int = 24) -> Dict[str, Any]:
        """Get call statistics for specified time period"""
        try:
            since_time = (datetime.now() - datetime.timedelta(hours=hours)).isoformat()
            
            cursor = await self.connection.execute("""
                SELECT 
                    COUNT(*) as total_calls,
                    AVG(duration) as avg_duration,
                    SUM(CASE WHEN status = 'connected' THEN 1 ELSE 0 END) as successful_calls,
                    AVG(fraud_score) as avg_fraud_score
                FROM call_records 
                WHERE start_time > ?
            """, (since_time,))
            
            row = await cursor.fetchone()
            columns = [description[0] for description in cursor.description]
            
            if row:
                stats = dict(zip(columns, row))
                if stats['total_calls'] > 0:
                    stats['success_rate'] = (stats['successful_calls'] / stats['total_calls']) * 100
                else:
                    stats['success_rate'] = 0
                return stats
            else:
                return {}
                
        except Exception as e:
            logger.error(f"Failed to get call statistics: {e}")
            return {}
    
    async def get_security_incidents(self, hours: int = 24, resolved: bool = None) -> List[Dict[str, Any]]:
        """Get security incidents for specified time period"""
        try:
            since_time = (datetime.now() - datetime.timedelta(hours=hours)).isoformat()
            
            if resolved is not None:
                cursor = await self.connection.execute("""
                    SELECT * FROM security_incidents 
                    WHERE timestamp > ? AND mitigated = ?
                    ORDER BY timestamp DESC
                """, (since_time, resolved))
            else:
                cursor = await self.connection.execute("""
                    SELECT * FROM security_incidents 
                    WHERE timestamp > ?
                    ORDER BY timestamp DESC
                """, (since_time,))
            
            rows = await cursor.fetchall()
            columns = [description[0] for description in cursor.description]
            
            incidents = []
            for row in rows:
                incident = dict(zip(columns, row))
                if incident['details']:
                    incident['details'] = json.loads(incident['details'])
                incidents.append(incident)
            
            return incidents
            
        except Exception as e:
            logger.error(f"Failed to get security incidents: {e}")
            return []
    
    async def get_maintenance_alerts(self, resolved: bool = False) -> List[Dict[str, Any]]:
        """Get maintenance alerts"""
        try:
            cursor = await self.connection.execute("""
                SELECT * FROM maintenance_alerts 
                WHERE resolved = ?
                ORDER BY timestamp DESC
            """, (resolved,))
            
            rows = await cursor.fetchall()
            columns = [description[0] for description in cursor.description]
            
            alerts = []
            for row in rows:
                alert = dict(zip(columns, row))
                if alert['prediction_data']:
                    alert['prediction_data'] = json.loads(alert['prediction_data'])
                alerts.append(alert)
            
            return alerts
            
        except Exception as e:
            logger.error(f"Failed to get maintenance alerts: {e}")
            return []
    
    async def mark_alert_resolved(self, alert_id: int):
        """Mark maintenance alert as resolved"""
        try:
            await self.connection.execute("""
                UPDATE maintenance_alerts 
                SET resolved = TRUE 
                WHERE id = ?
            """, (alert_id,))
            await self.connection.commit()
            
        except Exception as e:
            logger.error(f"Failed to mark alert as resolved: {e}")
    
    async def get_dashboard_summary(self) -> Dict[str, Any]:
        """Get summary data for dashboard"""
        try:
            # Get recent statistics
            traffic_stats = await self.get_traffic_statistics(24)
            call_stats = await self.get_call_statistics(24)
            security_incidents = await self.get_security_incidents(24, resolved=False)
            maintenance_alerts = await self.get_maintenance_alerts(resolved=False)
            
            return {
                'traffic': traffic_stats,
                'calls': call_stats,
                'security': {
                    'open_incidents': len(security_incidents),
                    'recent_incidents': security_incidents[:5]
                },
                'maintenance': {
                    'open_alerts': len(maintenance_alerts),
                    'recent_alerts': maintenance_alerts[:5]
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to get dashboard summary: {e}")
            return {}
    
    async def cleanup_old_data(self, days: int = 30):
        """Clean up old data to maintain database size"""
        try:
            cutoff_time = (datetime.now() - datetime.timedelta(days=days)).isoformat()
            
            # Clean up old traffic analysis data
            await self.connection.execute("""
                DELETE FROM traffic_analysis 
                WHERE timestamp < ?
            """, (cutoff_time,))
            
            # Clean up old call records (keep longer for compliance)
            call_cutoff = (datetime.now() - datetime.timedelta(days=days*3)).isoformat()
            await self.connection.execute("""
                DELETE FROM call_records 
                WHERE start_time < ?
            """, (call_cutoff,))
            
            # Clean up resolved security incidents
            await self.connection.execute("""
                DELETE FROM security_incidents 
                WHERE timestamp < ? AND mitigated = TRUE
            """, (cutoff_time,))
            
            # Clean up resolved maintenance alerts
            await self.connection.execute("""
                DELETE FROM maintenance_alerts 
                WHERE timestamp < ? AND resolved = TRUE
            """, (cutoff_time,))
            
            await self.connection.commit()
            logger.info(f"Cleaned up data older than {days} days")
            
        except Exception as e:
            logger.error(f"Failed to cleanup old data: {e}")
    
    async def close(self):
        """Close database connection"""
        if self.connection:
            await self.connection.close()
            logger.debug("Database connection closed")