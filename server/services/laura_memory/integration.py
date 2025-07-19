"""
Integración de Laura Memory con el agente JavaScript.
"""

import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime

from memory import add_public_memory, search_public_memory
from detectors import should_save_to_memory

logger = logging.getLogger(__name__)


class LauraMemoryIntegration:
    """
    Clase para integrar el sistema de memoria con el agente Laura.
    """
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    def process_tool_result(self, tool_name: str, tool_result: Dict[str, Any], 
                          user_query: str = "") -> Dict[str, Any]:
        """
        Procesa el resultado de una herramienta y determina si debe guardarse en memoria.
        
        Args:
            tool_name: Nombre de la herramienta utilizada.
            tool_result: Resultado de la herramienta.
            user_query: Query original del usuario.
            
        Returns:
            Dict con información sobre el procesamiento.
        """
        try:
            # Extraer contenido relevante del resultado
            content = self._extract_content_from_tool_result(tool_name, tool_result)
            
            if not content:
                return {"saved": False, "reason": "No hay contenido relevante"}
            
            # Preparar metadatos
            metadata = {
                "source": tool_name,
                "user_query": user_query,
                "tool_result_keys": list(tool_result.keys()),
                "ts": datetime.utcnow().isoformat()
            }
            
            # Determinar si guardar
            save_decision = should_save_to_memory(content, metadata)
            
            if not save_decision["should_save"]:
                return {"saved": False, "reason": save_decision["reason"]}
            
            # Guardar en memoria
            add_public_memory(content, save_decision["metadata"])
            
            return {
                "saved": True,
                "content": content[:100] + "..." if len(content) > 100 else content,
                "metadata": save_decision["metadata"],
                "reasons": save_decision["reasons"]
            }
            
        except Exception as e:
            logger.error(f"❌ Error procesando resultado de {tool_name}: {e}")
            return {"saved": False, "error": str(e)}
    
    def _extract_content_from_tool_result(self, tool_name: str, tool_result: Dict[str, Any]) -> str:
        """
        Extrae contenido relevante del resultado de una herramienta.
        
        Args:
            tool_name: Nombre de la herramienta.
            tool_result: Resultado de la herramienta.
            
        Returns:
            Contenido extraído como string.
        """
        content_parts = []
        
        if tool_name == "nitter_profile":
            # Extraer información del perfil
            if "profile_info" in tool_result:
                profile = tool_result["profile_info"]
                content_parts.append(f"Perfil: {profile.get('display_name', 'N/A')} (@{profile.get('username', 'N/A')})")
                if profile.get('bio'):
                    content_parts.append(f"Bio: {profile['bio']}")
            
            # Extraer tweets relevantes
            if "tweets" in tool_result:
                tweets = tool_result["tweets"][:3]  # Primeros 3 tweets
                for tweet in tweets:
                    if isinstance(tweet, dict) and "content" in tweet:
                        content_parts.append(f"Tweet: {tweet['content']}")
        
        elif tool_name == "nitter_context":
            # Extraer información del contexto
            if "summary" in tool_result:
                content_parts.append(f"Contexto: {tool_result['summary']}")
            
            # Extraer tweets relevantes
            if "tweets" in tool_result:
                tweets = tool_result["tweets"][:3]  # Primeros 3 tweets
                for tweet in tweets:
                    if isinstance(tweet, dict) and "content" in tweet:
                        content_parts.append(f"Tweet: {tweet['content']}")
        
        elif tool_name == "perplexity_search":
            # Extraer información de Perplexity
            if "content" in tool_result:
                content_parts.append(f"Información: {tool_result['content']}")
            
            if "summary" in tool_result:
                content_parts.append(f"Resumen: {tool_result['summary']}")
        
        elif tool_name == "ml_discovery":
            # Extraer información de ML Discovery
            if "entity" in tool_result:
                content_parts.append(f"Usuario descubierto: {tool_result['entity']}")
            
            if "twitter_username" in tool_result:
                content_parts.append(f"Username: @{tool_result['twitter_username']}")
            
            if "description" in tool_result:
                content_parts.append(f"Descripción: {tool_result['description']}")
        
        return " | ".join(content_parts)
    
    def enhance_query_with_memory(self, query: str, limit: int = 3) -> Dict[str, Any]:
        """
        Mejora una query buscando información relevante en la memoria.
        
        Args:
            query: Query original.
            limit: Número máximo de resultados de memoria.
            
        Returns:
            Dict con query mejorada y contexto de memoria.
        """
        try:
            # Buscar en memoria
            memory_results = search_public_memory(query, limit)
            
            if not memory_results:
                return {
                    "enhanced_query": query,
                    "memory_context": "",
                    "memory_results": []
                }
            
            # Crear contexto de memoria
            memory_context = "Información relevante de memoria:\n"
            for i, result in enumerate(memory_results, 1):
                memory_context += f"{i}. {result}\n"
            
            # Mejorar query con contexto
            enhanced_query = f"{query}\n\nCONTEXTO DE MEMORIA:\n{memory_context}"
            
            return {
                "enhanced_query": enhanced_query,
                "memory_context": memory_context,
                "memory_results": memory_results
            }
            
        except Exception as e:
            logger.error(f"❌ Error mejorando query con memoria: {e}")
            return {
                "enhanced_query": query,
                "memory_context": "",
                "memory_results": [],
                "error": str(e)
            }
    
    def save_user_discovery(self, user_name: str, twitter_username: str, 
                           description: str = "", category: str = "") -> bool:
        """
        Guarda información de un usuario descubierto con ML.
        
        Args:
            user_name: Nombre completo del usuario.
            twitter_username: Username de Twitter.
            description: Descripción del usuario.
            category: Categoría del usuario.
            
        Returns:
            True si se guardó exitosamente.
        """
        try:
            content = f"Usuario descubierto: {user_name} (@{twitter_username})"
            if description:
                content += f" - {description}"
            
            metadata = {
                "source": "ml_discovery",
                "tags": ["new_user", "ml_discovery", category] if category else ["new_user", "ml_discovery"],
                "twitter_username": twitter_username,
                "category": category,
                "ts": datetime.utcnow().isoformat()
            }
            
            add_public_memory(content, metadata)
            logger.info(f"✅ Usuario guardado en memoria: {user_name} (@{twitter_username})")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error guardando usuario en memoria: {e}")
            return False


# Instancia global para uso desde JavaScript
laura_memory_integration = LauraMemoryIntegration()