"""
Fallback implementation para Zep 2.22.0 usando Memory API clásica
En lugar de Graph API que no está disponible en esta versión
"""

import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
import time

# Usar la importación correcta para Zep 2.22.0
try:
    from zep_cloud.client import Zep
    from zep_cloud.types import Message, CreateMessageRequest
except ImportError as e:
    print(f"Error importing Zep: {e}")
    Zep = None

logger = logging.getLogger(__name__)

# Cliente Zep global
_zep_client = None

def _get_zep_client():
    """
    Obtiene el cliente Zep singleton
    """
    global _zep_client
    if _zep_client is None:
        from settings import get_settings
        settings = get_settings()
        
        if not settings.ZEP_API_KEY:
            raise ValueError("ZEP_API_KEY no configurado")
            
        _zep_client = Zep(
            api_key=settings.ZEP_API_KEY,
            base_url=settings.ZEP_URL
        )
        logger.info(f"🔗 Zep client inicializado (Fallback Mode)")
    
    return _zep_client

def add_to_userhandles_fallback(content: str, metadata: Dict[str, Any] = {}) -> bool:
    """
    Guardar usuario en sesión dedicada para UserHandles usando Memory API clásica
    """
    try:
        client = _get_zep_client()
        session_id = "userhandles_session"
        
        # Crear mensaje con el contenido
        message = CreateMessageRequest(
            role="user",
            content=content,
            metadata=metadata
        )
        
        # Añadir a la sesión
        client.message.add(session_id=session_id, messages=[message])
        
        logger.info(f"👥 Usuario guardado en UserHandles (fallback): {content[:50]}...")
        return True
        
    except Exception as e:
        logger.error(f"❌ Error guardando en UserHandles (fallback): {e}")
        return False

def search_userhandles_fallback(query: str, limit: int = 5) -> List[str]:
    """
    Buscar usuarios en UserHandles usando Memory API clásica
    """
    try:
        client = _get_zep_client()
        session_id = "userhandles_session"
        
        # Buscar en la memoria de la sesión
        search_results = client.memory.search(
            session_id=session_id,
            text=query,
            limit=limit
        )
        
        results = []
        if hasattr(search_results, 'results') and search_results.results:
            for result in search_results.results:
                if hasattr(result, 'message') and result.message:
                    results.append(result.message.content)
                elif hasattr(result, 'content'):
                    results.append(result.content)
        
        logger.info(f"👥 Búsqueda UserHandles (fallback): '{query}' → {len(results)} resultados")
        return results
        
    except Exception as e:
        logger.error(f"❌ Error buscando en UserHandles (fallback): {e}")
        return []

def add_to_pulsepolitics_fallback(content: str, metadata: Dict[str, Any] = {}) -> bool:
    """
    Guardar información política en sesión dedicada usando Memory API clásica
    """
    try:
        client = _get_zep_client()
        session_id = "pulsepolitics_session"
        
        # Crear mensaje con el contenido
        message = CreateMessageRequest(
            role="user",
            content=content,
            metadata=metadata
        )
        
        # Añadir a la sesión
        client.message.add(session_id=session_id, messages=[message])
        
        logger.info(f"🏛️ Info guardada en PulsePolitics (fallback): {content[:50]}...")
        return True
        
    except Exception as e:
        logger.error(f"❌ Error guardando en PulsePolitics (fallback): {e}")
        return False

def search_pulsepolitics_fallback(query: str, limit: int = 5) -> List[str]:
    """
    Buscar información política usando Memory API clásica
    """
    try:
        client = _get_zep_client()
        session_id = "pulsepolitics_session"
        
        # Buscar en la memoria de la sesión
        search_results = client.memory.search(
            session_id=session_id,
            text=query,
            limit=limit
        )
        
        results = []
        if hasattr(search_results, 'results') and search_results.results:
            for result in search_results.results:
                if hasattr(result, 'message') and result.message:
                    results.append(result.message.content)
                elif hasattr(result, 'content'):
                    results.append(result.content)
        
        logger.info(f"🏛️ Búsqueda PulsePolitics (fallback): '{query}' → {len(results)} resultados")
        return results
        
    except Exception as e:
        logger.error(f"❌ Error buscando en PulsePolitics (fallback): {e}")
        return []

def get_userhandles_stats_fallback() -> Dict[str, Any]:
    """
    Obtener estadísticas de UserHandles usando Memory API clásica
    """
    try:
        client = _get_zep_client()
        session_id = "userhandles_session"
        
        # Intentar obtener información de la sesión
        try:
            session_info = client.memory.get(session_id=session_id)
            message_count = len(session_info.messages) if hasattr(session_info, 'messages') and session_info.messages else 0
        except:
            message_count = 0
        
        return {
            "session_id": session_id,
            "mode": "fallback_memory_api",
            "message_count": message_count,
            "last_access": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Error obteniendo stats UserHandles (fallback): {e}")
        return {
            "session_id": "userhandles_session", 
            "mode": "fallback_memory_api",
            "message_count": 0,
            "error": str(e)
        }

def get_pulsepolitics_stats_fallback() -> Dict[str, Any]:
    """
    Obtener estadísticas de PulsePolitics usando Memory API clásica
    """
    try:
        client = _get_zep_client()
        session_id = "pulsepolitics_session"
        
        # Intentar obtener información de la sesión
        try:
            session_info = client.memory.get(session_id=session_id)
            message_count = len(session_info.messages) if hasattr(session_info, 'messages') and session_info.messages else 0
        except:
            message_count = 0
        
        return {
            "session_id": session_id,
            "mode": "fallback_memory_api", 
            "message_count": message_count,
            "last_access": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Error obteniendo stats PulsePolitics (fallback): {e}")
        return {
            "session_id": "pulsepolitics_session",
            "mode": "fallback_memory_api",
            "message_count": 0,
            "error": str(e)
        } 