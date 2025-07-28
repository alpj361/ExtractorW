"""
Módulo principal para la memoria pública de Laura usando Zep Cloud.
"""

import json
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


def _create_groups_if_needed(client: Zep) -> None:
    """
    Crea los grupos necesarios si no existen.
    
    Args:
        client: Cliente Zep configurado.
    """
    groups_to_create = [
        {
            "group_id": "userhandles",
            "name": "User Handles", 
            "description": "Grupo para almacenar usuarios descubiertos con ML"
        }
        # pulsepolitics ya existe, no lo creamos
    ]
    
    for group_info in groups_to_create:
        try:
            client.group.add(
                group_id=group_info["group_id"],
                name=group_info["name"],
                description=group_info["description"]
            )
            logger.info(f"✅ Grupo creado: {group_info['group_id']}")
        except Exception as e:
            # Si el grupo ya existe, ignorar el error
            if "already exists" in str(e).lower() or "conflict" in str(e).lower():
                logger.info(f"📋 Grupo ya existe: {group_info['group_id']}")
            else:
                logger.warning(f"⚠️ Error creando grupo {group_info['group_id']}: {e}")


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
            
            # Crear grupos necesarios si no existen
            _create_groups_if_needed(_zep)
            
            logger.info("✅ Cliente Zep inicializado correctamente con grupos")
            
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


# === FUNCIONES ESPECÍFICAS PARA USERHANDLES GROUP ===

def add_to_pulsepolitics(content: str, metadata: Optional[Dict[str, Any]] = None) -> bool:
    """
    Añade contenido al grupo PulsePolitics usando Zep Graph API.
    
    Args:
        content: Contenido a guardar en PulsePolitics.
        metadata: Metadatos opcionales con información adicional.
                 
    Returns:
        bool: True si se guardó, False si ya existía o hubo error.
    """
    if not content or not content.strip():
        logger.warning("⚠️ Contenido vacío, no se guardará en PulsePolitics")
        return False
    
    try:
        client = _get_zep_client()
        
        # Preparar metadatos con timestamp y marcador de PulsePolitics
        final_metadata = metadata or {}
        final_metadata.update({
            "ts": datetime.utcnow().isoformat(),
            "source_system": "pulsepolitics",
            "memory_type": "shared_political_graph",
            "entity_type": "political_content"
        })
        
        # Añadir al grupo usando Graph API con texto plano (mejor para indexación)
        client.graph.add(
            group_id="pulsepolitics",
            data=content,  # Usar contenido como texto plano
            type="text"
        )
        
        logger.info(f"🏛️ Nuevo en PulsePolitics: {content[:50]}...")
        return True
        
    except Exception as e:
        logger.error(f"❌ Error guardando en PulsePolitics: {e}")
        return False


def search_pulsepolitics(query: str, limit: int = 5) -> List[str]:
    """
    Busca en el grupo PulsePolitics usando Zep Graph API.
    
    Args:
        query: Consulta de búsqueda.
        limit: Número máximo de resultados a retornar.
        
    Returns:
        Lista de strings con los mensajes más relevantes encontrados en PulsePolitics.
    """
    if not query or not query.strip():
        logger.warning("⚠️ Query vacía para búsqueda en PulsePolitics")
        return []
    
    try:
        client = _get_zep_client()
        
        # Usar búsqueda en grupo de Graph API con retry
        def _search_operation():
            return client.graph.search(
                group_id="pulsepolitics",
                query=query,
                scope="episodes",  # Buscar en episodios (datos guardados con graph.add)
                limit=limit
            )
        
        search_results = _retry_with_backoff(_search_operation)
        
        facts = []
        # Procesar episodios (la respuesta principal para datos guardados con graph.add)
        if hasattr(search_results, 'episodes') and search_results.episodes:
            for episode in search_results.episodes:
                try:
                    # Los datos están en episode.data según el formato de episodios
                    if hasattr(episode, 'data') and episode.data:
                        facts.append(episode.data)
                        logger.debug(f"[DEBUG] Episode data encontrado: {episode.data[:100]}")
                    elif hasattr(episode, 'content') and episode.content:
                        facts.append(episode.content)
                        logger.debug(f"[DEBUG] Episode content encontrado: {episode.content[:100]}")
                except Exception as e:
                    logger.error(f"[DEBUG] Error procesando episode PulsePolitics: {e}")
                    continue
        
        logger.info(f"🏛️ Búsqueda PulsePolitics: '{query}' → {len(facts)} resultados")
        return facts
        
    except Exception as e:
        logger.error(f"❌ Error buscando en PulsePolitics: {e}")
        return []  # Return empty list instead of raising exception


def get_pulsepolitics_stats() -> Dict[str, Any]:
    """
    Obtiene estadísticas del grupo PulsePolitics usando Graph API.
    
    Returns:
        Dict con estadísticas de PulsePolitics.
    """
    try:
        client = _get_zep_client()
        
        # Obtener nodes del grupo PulsePolitics
        try:
            nodes = client.graph.node.get_by_group_id(group_id="pulsepolitics")
            node_count = len(nodes.nodes) if hasattr(nodes, 'nodes') and nodes.nodes else 0
        except Exception:
            node_count = 0
            
        # Obtener edges del grupo PulsePolitics  
        try:
            edges = client.graph.edge.get_by_group_id(group_id="pulsepolitics")
            edge_count = len(edges.edges) if hasattr(edges, 'edges') and edges.edges else 0
        except Exception:
            edge_count = 0
        
        return {
            "group_id": "pulsepolitics",
            "node_count": node_count,
            "edge_count": edge_count,
            "total_items": node_count + edge_count,
            "memory_type": "shared_political_graph"
        }
        
    except Exception as e:
        logger.error(f"❌ Error obteniendo estadísticas PulsePolitics: {e}")
        return {"error": str(e)}


# === FUNCIONES ESPECÍFICAS PARA USERHANDLES ===

def add_to_userhandles(content: str, metadata: Optional[Dict[str, Any]] = None) -> bool:
    """
    Añade contenido al grupo UserHandles usando Zep Graph API.
    
    Args:
        content: Contenido a guardar en UserHandles.
        metadata: Metadatos opcionales con información adicional.
                 
    Returns:
        bool: True si se guardó, False si ya existía o hubo error.
    """
    if not content or not content.strip():
        logger.warning("⚠️ Contenido vacío, no se guardará en UserHandles")
        return False
    
    try:
        client = _get_zep_client()
        
        # Verificar si ya existe usando el twitter_username como clave única
        twitter_username = metadata.get("twitter_username", "") if metadata else ""
        if twitter_username:
            # Buscar si ya existe este usuario
            existing_results = search_userhandles(f"@{twitter_username}", limit=10)
            for result in existing_results:
                if f"@{twitter_username}" in result:
                    logger.info(f"👥 Usuario ya existe en UserHandles: @{twitter_username}")
                    return False
        
        # Preparar metadatos con timestamp y marcador de UserHandles
        final_metadata = metadata or {}
        final_metadata.update({
            "ts": datetime.utcnow().isoformat(),
            "source_system": "userhandles",
            "memory_type": "shared_user_handles",
            "entity_type": "twitter_user"
        })
        
        # Añadir al grupo usando Graph API con texto plano (mejor para indexación)
        client.graph.add(
            group_id="userhandles",
            data=content,  # Usar contenido como texto plano
            type="text"
        )
        
        logger.info(f"👥 Nuevo en UserHandles: {content[:50]}...")
        return True
        
    except Exception as e:
        logger.error(f"❌ Error guardando en UserHandles: {e}")
        return False


def search_userhandles(query: str, limit: int = 5) -> List[str]:
    """
    Busca en el grupo UserHandles usando Zep Graph API.
    
    Args:
        query: Consulta de búsqueda.
        limit: Número máximo de resultados a retornar.
        
    Returns:
        Lista de strings con los mensajes más relevantes encontrados en UserHandles.
    """
    if not query or not query.strip():
        logger.warning("⚠️ Query vacía para búsqueda en UserHandles")
        return []
    
    try:
        client = _get_zep_client()
        
        # Usar búsqueda en grupo de Graph API con retry
        def _search_operation():
            return client.graph.search(
                group_id="userhandles",
                query=query,
                scope="episodes",  # Buscar en episodios (datos guardados con graph.add)
                limit=limit
            )
        
        search_results = _retry_with_backoff(_search_operation)
        
        facts = []
        # Procesar episodios (la respuesta principal para datos guardados con graph.add)
        if hasattr(search_results, 'episodes') and search_results.episodes:
            for episode in search_results.episodes:
                try:
                    # Los datos están en episode.data según el formato de episodios
                    if hasattr(episode, 'data') and episode.data:
                        facts.append(episode.data)
                        logger.debug(f"[DEBUG] Episode data encontrado: {episode.data[:100]}")
                    elif hasattr(episode, 'content') and episode.content:
                        facts.append(episode.content)
                        logger.debug(f"[DEBUG] Episode content encontrado: {episode.content[:100]}")
                except Exception as e:
                    logger.error(f"[DEBUG] Error procesando episode UserHandles: {e}")
                    continue
        
        logger.info(f"👥 Búsqueda UserHandles: '{query}' → {len(facts)} resultados")
        return facts
        
    except Exception as e:
        logger.error(f"❌ Error buscando en UserHandles: {e}")
        return []


def get_userhandles_stats() -> Dict[str, Any]:
    """
    Obtiene estadísticas del grupo UserHandles usando Graph API.
    
    Returns:
        Dict con estadísticas de UserHandles.
    """
    try:
        client = _get_zep_client()
        
        # Obtener nodes del grupo UserHandles
        try:
            nodes = client.graph.node.get_by_group_id(group_id="userhandles")
            node_count = len(nodes.nodes) if hasattr(nodes, 'nodes') and nodes.nodes else 0
        except Exception:
            node_count = 0
            
        # Obtener edges del grupo UserHandles
        try:
            edges = client.graph.edge.get_by_group_id(group_id="userhandles")
            edge_count = len(edges.edges) if hasattr(edges, 'edges') and edges.edges else 0
        except Exception:
            edge_count = 0
        
        return {
            "group_id": "userhandles",
            "node_count": node_count,
            "edge_count": edge_count,
            "total_items": node_count + edge_count,
            "memory_type": "shared_user_handles"
        }
        
    except Exception as e:
        logger.error(f"❌ Error obteniendo estadísticas UserHandles: {e}")
        return {"error": str(e)}