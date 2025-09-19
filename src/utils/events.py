"""
Event Bus System

Provides publish-subscribe event system for inter-component communication.
"""

import asyncio
import logging
from typing import Dict, List, Any, Callable, Optional
from datetime import datetime
import fnmatch


class EventBus:
    """
    Event bus for decoupled communication between system components.
    Supports pattern-based subscriptions and async event handling.
    """
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.subscribers = {}  # pattern -> list of callbacks
        self.event_history = []
        
    def subscribe(self, pattern: str, callback: Callable[[Dict[str, Any]], None]):
        """Subscribe to events matching a pattern."""
        if pattern not in self.subscribers:
            self.subscribers[pattern] = []
        self.subscribers[pattern].append(callback)
        
        self.logger.debug(f"Subscribed to pattern '{pattern}'")
        
    def unsubscribe(self, pattern: str, callback: Callable[[Dict[str, Any]], None]):
        """Unsubscribe from events."""
        if pattern in self.subscribers:
            try:
                self.subscribers[pattern].remove(callback)
                if not self.subscribers[pattern]:
                    del self.subscribers[pattern]
            except ValueError:
                pass
                
    def unsubscribe_all(self):
        """Unsubscribe all listeners."""
        self.subscribers.clear()
        
    async def publish(self, event_type: str, data: Dict[str, Any]):
        """Publish an event to all matching subscribers."""
        event = {
            'type': event_type,
            'data': data,
            'timestamp': datetime.now().isoformat()
        }
        
        # Store in history
        self.event_history.append(event)
        if len(self.event_history) > 1000:
            self.event_history.pop(0)
            
        # Find matching subscribers
        matching_callbacks = []
        for pattern, callbacks in self.subscribers.items():
            if fnmatch.fnmatch(event_type, pattern):
                matching_callbacks.extend(callbacks)
                
        # Call all matching callbacks
        for callback in matching_callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(event)
                else:
                    callback(event)
            except Exception as e:
                self.logger.error(f"Error in event callback: {e}")
                
        self.logger.debug(f"Published event '{event_type}' to {len(matching_callbacks)} subscribers")
        
    def get_history(self, event_type_pattern: Optional[str] = None, 
                   limit: int = 100) -> List[Dict[str, Any]]:
        """Get event history, optionally filtered by pattern."""
        if event_type_pattern:
            filtered_events = [
                event for event in self.event_history
                if fnmatch.fnmatch(event['type'], event_type_pattern)
            ]
        else:
            filtered_events = self.event_history
            
        return filtered_events[-limit:] if limit else filtered_events