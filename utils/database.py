"""
Database manager for storing monitoring data and metrics
"""

import sqlite3
import logging
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any, List, Optional
from contextlib import contextmanager


class DatabaseManager:
    """Database manager for automation platform"""
    
    def __init__(self, db_path: str = "data/automation.db"):
        self.db_path = Path(db_path)
        self.logger = logging.getLogger(__name__)
        self._init_database()
    
    def _init_database(self):
        """Initialize database tables"""
        # Create data directory
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Device status table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS device_status (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    device_name TEXT NOT NULL,
                    timestamp DATETIME NOT NULL,
                    status_data TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # Alerts table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS alerts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    message TEXT NOT NULL,
                    severity TEXT NOT NULL,
                    device_name TEXT,
                    timestamp DATETIME NOT NULL,
                    acknowledged BOOLEAN DEFAULT FALSE,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # AI predictions table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS ai_predictions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    device_name TEXT NOT NULL,
                    prediction_type TEXT NOT NULL,
                    prediction_data TEXT NOT NULL,
                    confidence REAL,
                    timestamp DATETIME NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # Performance metrics table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS performance_metrics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    device_name TEXT NOT NULL,
                    metric_name TEXT NOT NULL,
                    metric_value REAL NOT NULL,
                    unit TEXT,
                    timestamp DATETIME NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # Create indexes for better performance
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_device_status_timestamp ON device_status(timestamp)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_device_status_device ON device_status(device_name)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON alerts(timestamp)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_alerts_device ON alerts(device_name)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_performance_timestamp ON performance_metrics(timestamp)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_performance_device ON performance_metrics(device_name)')
            
            conn.commit()
        
        self.logger.info("Database initialized successfully")
    
    @contextmanager
    def get_connection(self):
        """Get database connection with context manager"""
        conn = sqlite3.connect(str(self.db_path), timeout=30.0)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()
    
    def store_device_status(self, device_name: str, status_data: Dict[str, Any]):
        """Store device status data"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                timestamp = datetime.fromtimestamp(status_data.get('timestamp', datetime.now().timestamp()))
                status_json = json.dumps(status_data)
                
                cursor.execute('''
                    INSERT INTO device_status (device_name, timestamp, status_data)
                    VALUES (?, ?, ?)
                ''', (device_name, timestamp, status_json))
                
                conn.commit()
                
        except Exception as e:
            self.logger.error(f"Failed to store device status: {e}")
    
    def get_device_status_history(self, device_name: str, hours: int = 24) -> List[Dict[str, Any]]:
        """Get device status history for specified hours"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                since = datetime.now() - timedelta(hours=hours)
                
                cursor.execute('''
                    SELECT timestamp, status_data FROM device_status
                    WHERE device_name = ? AND timestamp >= ?
                    ORDER BY timestamp DESC
                ''', (device_name, since))
                
                results = []
                for row in cursor.fetchall():
                    status_data = json.loads(row['status_data'])
                    status_data['timestamp'] = row['timestamp']
                    results.append(status_data)
                
                return results
                
        except Exception as e:
            self.logger.error(f"Failed to get device status history: {e}")
            return []
    
    def store_alert(self, title: str, message: str, severity: str, device_name: str = None):
        """Store alert in database"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                cursor.execute('''
                    INSERT INTO alerts (title, message, severity, device_name, timestamp)
                    VALUES (?, ?, ?, ?, ?)
                ''', (title, message, severity, device_name, datetime.now()))
                
                conn.commit()
                
        except Exception as e:
            self.logger.error(f"Failed to store alert: {e}")
    
    def get_recent_alerts(self, hours: int = 24, acknowledged: Optional[bool] = None) -> List[Dict[str, Any]]:
        """Get recent alerts"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                since = datetime.now() - timedelta(hours=hours)
                
                query = '''
                    SELECT * FROM alerts
                    WHERE timestamp >= ?
                '''
                params = [since]
                
                if acknowledged is not None:
                    query += ' AND acknowledged = ?'
                    params.append(acknowledged)
                
                query += ' ORDER BY timestamp DESC'
                
                cursor.execute(query, params)
                
                results = []
                for row in cursor.fetchall():
                    results.append(dict(row))
                
                return results
                
        except Exception as e:
            self.logger.error(f"Failed to get recent alerts: {e}")
            return []
    
    def acknowledge_alert(self, alert_id: int) -> bool:
        """Acknowledge an alert"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                cursor.execute('''
                    UPDATE alerts SET acknowledged = TRUE
                    WHERE id = ?
                ''', (alert_id,))
                
                conn.commit()
                return cursor.rowcount > 0
                
        except Exception as e:
            self.logger.error(f"Failed to acknowledge alert: {e}")
            return False
    
    def store_performance_metric(self, device_name: str, metric_name: str, 
                                metric_value: float, unit: str = None):
        """Store performance metric"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                cursor.execute('''
                    INSERT INTO performance_metrics (device_name, metric_name, metric_value, unit, timestamp)
                    VALUES (?, ?, ?, ?, ?)
                ''', (device_name, metric_name, metric_value, unit, datetime.now()))
                
                conn.commit()
                
        except Exception as e:
            self.logger.error(f"Failed to store performance metric: {e}")
    
    def get_performance_metrics(self, device_name: str, metric_name: str, 
                              hours: int = 24) -> List[Dict[str, Any]]:
        """Get performance metrics for specified time period"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                since = datetime.now() - timedelta(hours=hours)
                
                cursor.execute('''
                    SELECT timestamp, metric_value, unit FROM performance_metrics
                    WHERE device_name = ? AND metric_name = ? AND timestamp >= ?
                    ORDER BY timestamp ASC
                ''', (device_name, metric_name, since))
                
                results = []
                for row in cursor.fetchall():
                    results.append({
                        'timestamp': row['timestamp'],
                        'value': row['metric_value'],
                        'unit': row['unit']
                    })
                
                return results
                
        except Exception as e:
            self.logger.error(f"Failed to get performance metrics: {e}")
            return []
    
    def store_ai_prediction(self, device_name: str, prediction_type: str, 
                           prediction_data: Dict[str, Any], confidence: float = None):
        """Store AI prediction result"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                prediction_json = json.dumps(prediction_data)
                
                cursor.execute('''
                    INSERT INTO ai_predictions (device_name, prediction_type, prediction_data, confidence, timestamp)
                    VALUES (?, ?, ?, ?, ?)
                ''', (device_name, prediction_type, prediction_json, confidence, datetime.now()))
                
                conn.commit()
                
        except Exception as e:
            self.logger.error(f"Failed to store AI prediction: {e}")
    
    def get_ai_predictions(self, device_name: str, prediction_type: str = None, 
                          hours: int = 24) -> List[Dict[str, Any]]:
        """Get AI predictions for device"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                since = datetime.now() - timedelta(hours=hours)
                
                query = '''
                    SELECT * FROM ai_predictions
                    WHERE device_name = ? AND timestamp >= ?
                '''
                params = [device_name, since]
                
                if prediction_type:
                    query += ' AND prediction_type = ?'
                    params.append(prediction_type)
                
                query += ' ORDER BY timestamp DESC'
                
                cursor.execute(query, params)
                
                results = []
                for row in cursor.fetchall():
                    prediction_data = json.loads(row['prediction_data'])
                    result = dict(row)
                    result['prediction_data'] = prediction_data
                    results.append(result)
                
                return results
                
        except Exception as e:
            self.logger.error(f"Failed to get AI predictions: {e}")
            return []
    
    def cleanup_old_data(self, cutoff_date: datetime):
        """Clean up old data before cutoff date"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                # Clean up old device status records
                cursor.execute('DELETE FROM device_status WHERE timestamp < ?', (cutoff_date,))
                device_count = cursor.rowcount
                
                # Clean up old performance metrics
                cursor.execute('DELETE FROM performance_metrics WHERE timestamp < ?', (cutoff_date,))
                metrics_count = cursor.rowcount
                
                # Clean up old AI predictions
                cursor.execute('DELETE FROM ai_predictions WHERE timestamp < ?', (cutoff_date,))
                predictions_count = cursor.rowcount
                
                # Keep alerts longer (1 year)
                alert_cutoff = datetime.now() - timedelta(days=365)
                cursor.execute('DELETE FROM alerts WHERE timestamp < ?', (alert_cutoff,))
                alerts_count = cursor.rowcount
                
                conn.commit()
                
                self.logger.info(f"Cleaned up old data: {device_count} device status, "
                               f"{metrics_count} metrics, {predictions_count} predictions, "
                               f"{alerts_count} alerts")
                
        except Exception as e:
            self.logger.error(f"Failed to cleanup old data: {e}")
    
    def get_database_stats(self) -> Dict[str, Any]:
        """Get database statistics"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                stats = {}
                
                # Count records in each table
                cursor.execute('SELECT COUNT(*) FROM device_status')
                stats['device_status_count'] = cursor.fetchone()[0]
                
                cursor.execute('SELECT COUNT(*) FROM alerts')
                stats['alerts_count'] = cursor.fetchone()[0]
                
                cursor.execute('SELECT COUNT(*) FROM performance_metrics')
                stats['metrics_count'] = cursor.fetchone()[0]
                
                cursor.execute('SELECT COUNT(*) FROM ai_predictions')
                stats['predictions_count'] = cursor.fetchone()[0]
                
                # Get database file size
                stats['database_size_mb'] = self.db_path.stat().st_size / (1024 * 1024)
                
                return stats
                
        except Exception as e:
            self.logger.error(f"Failed to get database stats: {e}")
            return {}