"""
Módulo principal para la memoria pública de Laura usando Zep Cloud.
"""

import logging
import time
from datetime import datetime
from typing import Dict, List, Optional, Any

from zep_cloud.client import Zep
from zep_cloud.types import Message

from settings import settings

logger = logging.getLogger(__name__)

# Cliente global de Zep
_zep: Optional[Zep] = None


def _retry_with_backoff(func, max_retries: int = 3, base_delay: float = 1.0):
    """
    Ejecuta una función con reintentos y backoff exponencial.
    
    Args:
        func: Función a ejecutar
        max_retries: Número máximo de reintentos
        base_delay: Delay base en segundos
        
    Returns:
        Resultado de la función
        
    Raises:
        La última excepción si todos los reintentos fallan
    """
    for attempt in range(max_retries + 1):
        try:
            return func()
        except Exception as e:
            if attempt == max_retries:
                raise e
            
            delay = base_delay * (2 ** attempt)
            logger.warning(f"⏳ Intento {attempt + 1} falló, reintentando en {delay}s: {e}")
            time.sleep(delay)


def _get_zep_client() -> Zep:
    """
    Obtiene el cliente de Zep, inicializándolo si es necesario.
    
    Returns:
        Zep: Cliente configurado de Zep Cloud.
        
    Raises:
        ValueError: Si no se puede inicializar el cliente.
    """
    global _zep
    
    if _zep is None:
        try:
            # Validar configuración antes de inicializar
            if not settings.zep_api_key:
                raise ValueError("ZEP_API_KEY no está configurada")
            
            if settings.zep_api_key in ["test_key_for_development", "your_zep_api_key_here"]:
                logger.warning("⚠️ Usando API key de prueba - funcionalidad limitada")
            
            _zep = Zep(
                api_key=settings.zep_api_key
            )
            logger.info("✅ Cliente Zep inicializado correctamente")
            
        except Exception as e:
            logger.error(f"❌ Error inicializando cliente Zep: {e}")
            raise ValueError(f"No se pudo inicializar cliente Zep: {e}")
    
    return _zep


def add_public_memory(content: str, metadata: Optional[Dict[str, Any]] = None) -> None:
    """
    Añade contenido a la memoria pública de Laura.
    
    Args:
        content: Contenido a guardar en la memoria.
        metadata: Metadatos opcionales con información adicional.
                 Puede incluir 'source', 'tags', 'ts', etc.
                 
    Raises:
        ValueError: Si hay error al guardar en Zep.
    """
    if not content or not content.strip():
        logger.warning("⚠️ Contenido vacío, no se guardará en memoria")
        return
    
    try:
        client = _get_zep_client()
        
        # Preparar metadatos con timestamp por defecto
        final_metadata = metadata or {}
        if "ts" not in final_metadata:
            final_metadata["ts"] = datetime.utcnow().isoformat()
        
        # Crear mensaje para Zep
        message = Message(
            role="assistant",
            content=content,
            metadata=final_metadata
        )
        
        # Añadir a la memoria
        client.memory.add(
            session_id=settings.session_id,
            messages=[message]
        )
        
        logger.info(f"📚 Memoria añadida: {content[:50]}...")
        
    except Exception as e:
        logger.error(f"❌ Error guardando en memoria: {e}")
        raise ValueError(f"Error al guardar en memoria pública: {e}")


def search_public_memory(query: str, limit: int = 5) -> List[str]:
    """
    Busca en la memoria pública de Laura usando búsqueda semántica de Zep.
    Args:
        query: Consulta de búsqueda.
        limit: Número máximo de resultados a retornar.
    Returns:
        Lista de strings con los mensajes más relevantes encontrados.
    Raises:
        ValueError: Si hay error en la búsqueda.
    """
    if not query or not query.strip():
        logger.warning("⚠️ Query vacía para búsqueda en memoria")
        return []
    
    try:
        client = _get_zep_client()
        
        # Usar búsqueda semántica de Zep con retry
        def _search_operation():
            return client.memory.search(
                session_id=settings.session_id,
                text=query,
                limit=limit
            )
        
        search_results = _retry_with_backoff(_search_operation)
        
        facts = []
        if hasattr(search_results, 'results') and search_results.results:
            for result in search_results.results:
                try:
                    # Extraer contenido del resultado de búsqueda
                    if hasattr(result, 'message') and result.message:
                        content = str(result.message.content)
                        facts.append(content)
                    elif hasattr(result, 'content'):
                        content = str(result.content)
                        facts.append(content)
                except Exception as e:
                    logger.error(f"[DEBUG] Error procesando resultado de búsqueda: {e}")
                    continue
        
        # Fallback: búsqueda básica si no hay resultados semánticos
        if not facts:
            logger.info("🔄 Fallback a búsqueda básica")
            session = client.memory.get(session_id=settings.session_id)
            if hasattr(session, 'messages') and session.messages:
                for message in session.messages:
                    try:
                        content = str(message.content)
                        if query.lower() in content.lower():
                            facts.append(content)
                            if len(facts) >= limit:
                                break
                    except Exception as e:
                        logger.error(f"[DEBUG] Error en fallback: {e}")
                        continue
        
        logger.info(f"🔍 Búsqueda en memoria: '{query}' → {len(facts)} resultados")
        return facts
        
    except Exception as e:
        logger.error(f"❌ Error buscando en memoria: {e}")
        return []  # Return empty list instead of raising exception


def get_memory_stats() -> Dict[str, Any]:
    """
    Obtiene estadísticas de la memoria pública.
    
    Returns:
        Dict con estadísticas de la memoria.
    """
    try:
        client = _get_zep_client()
        
        # Obtener información de la sesión
        session_info = client.memory.get(session_id=settings.session_id)
        
        return {
            "session_id": settings.session_id,
            "message_count": len(session_info.messages) if session_info.messages else 0,
            "created_at": session_info.created_at if hasattr(session_info, 'created_at') else None,
            "updated_at": session_info.updated_at if hasattr(session_info, 'updated_at') else None
        }
        
    except Exception as e:
        logger.error(f"❌ Error obteniendo estadísticas: {e}")
        return {"error": str(e)}


def clear_memory() -> None:
    """
    Limpia toda la memoria pública (usar con precaución).
    
    Raises:
        ValueError: Si hay error al limpiar la memoria.
    """
    try:
        client = _get_zep_client()
        
        # Eliminar toda la memoria de la sesión
        client.memory.delete(session_id=settings.session_id)
        
        logger.info("🗑️ Memoria pública limpiada completamente")
        
    except Exception as e:
        logger.error(f"❌ Error limpiando memoria: {e}")
        raise ValueError(f"Error al limpiar memoria pública: {e}")