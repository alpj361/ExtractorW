#!/usr/bin/env python3
"""
Interfaz interna entre JavaScript y el módulo Python laura_memory
Recibe comandos via stdin y devuelve resultados via stdout
"""

import sys
import json
import logging
from typing import Dict, Any

# Importar funciones del módulo memory
try:
    # Intentar usar Graph API primero
    from memory import (
        add_to_userhandles, 
        search_userhandles,
        add_to_pulsepolitics, 
        search_pulsepolitics,
        get_userhandles_stats,
        get_pulsepolitics_stats
    )
    USE_GRAPH_API = True
except:
    # Fallback a Memory API clásica si Graph API no está disponible
    from memory_fallback import (
        add_to_userhandles_fallback as add_to_userhandles,
        search_userhandles_fallback as search_userhandles,
        add_to_pulsepolitics_fallback as add_to_pulsepolitics,
        search_pulsepolitics_fallback as search_pulsepolitics,
        get_userhandles_stats_fallback as get_userhandles_stats,
        get_pulsepolitics_stats_fallback as get_pulsepolitics_stats
    )
    USE_GRAPH_API = False

from integration import LauraMemoryIntegration

# Configurar logging para que no interfiera con stdout
logging.basicConfig(
    level=logging.WARNING,  # Solo errores críticos
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

def execute_function(function_name: str, args: Dict[str, Any]) -> Dict[str, Any]:
    """
    Ejecuta la función solicitada con los argumentos dados
    
    Args:
        function_name: Nombre de la función a ejecutar
        args: Argumentos para la función
        
    Returns:
        Dict con el resultado de la función
    """
    try:
        if function_name == 'save_user_discovery':
            user_name = args.get('user_name', '')
            twitter_username = args.get('twitter_username', '')
            description = args.get('description', '')
            category = args.get('category', '')
            
            # Crear contenido para userhandles
            content = f"Usuario: {user_name} (@{twitter_username})"
            if description:
                content += f" - {description}"
            
            metadata = {
                "source": "laura_agent",
                "twitter_username": twitter_username,
                "full_name": user_name,
                "category": category,
                "ts": "2025-01-28T10:00:00Z"
            }
            
            try:
                # Usar directamente add_to_userhandles
                success = add_to_userhandles(content, metadata)
                
                return {
                    "success": bool(success),
                    "function": function_name,
                    "user_name": user_name,
                    "twitter_username": twitter_username,
                    "saved": bool(success)
                }
            except Exception as e:
                return {
                    "success": False,
                    "function": function_name,
                    "error": str(e),
                    "user_name": user_name,
                    "twitter_username": twitter_username
                }
            
        elif function_name == 'search_userhandles':
            query = args.get('query', '')
            limit = args.get('limit', 5)
            
            try:
                results = search_userhandles(query, limit)
                
                return {
                    "success": True,
                    "function": function_name,
                    "results": results if results else [],
                    "query": query,
                    "count": len(results) if results else 0
                }
            except Exception as e:
                return {
                    "success": False,
                    "function": function_name,
                    "error": str(e),
                    "query": query,
                    "results": []
                }
            
        elif function_name == 'add_to_pulsepolitics':
            content = args.get('content', '')
            metadata = args.get('metadata', {})
            
            try:
                success = add_to_pulsepolitics(content, metadata)
                
                return {
                    "success": bool(success),
                    "function": function_name,
                    "content": content[:100] + "..." if len(content) > 100 else content,
                    "saved": bool(success)
                }
            except Exception as e:
                return {
                    "success": False,
                    "function": function_name,
                    "error": str(e),
                    "content": content[:100] + "..." if len(content) > 100 else content
                }
            
        elif function_name == 'search_pulsepolitics':
            query = args.get('query', '')
            limit = args.get('limit', 5)
            
            try:
                results = search_pulsepolitics(query, limit)
                
                return {
                    "success": True,
                    "function": function_name,
                    "results": results if results else [],
                    "query": query,
                    "count": len(results) if results else 0
                }
            except Exception as e:
                return {
                    "success": False,
                    "function": function_name,
                    "error": str(e),
                    "query": query,
                    "results": []
                }
            
        elif function_name == 'health_check':
            # Verificar que las funciones básicas funcionan
            stats_uh = get_userhandles_stats()
            stats_pp = get_pulsepolitics_stats()
            
            return {
                "success": True,
                "function": function_name,
                "userhandles_available": isinstance(stats_uh, dict),
                "pulsepolitics_available": isinstance(stats_pp, dict),
                "zep_connection": True  # Si llegamos aquí, la conexión funciona
            }
            
        elif function_name == 'get_stats':
            stats_uh = get_userhandles_stats()
            stats_pp = get_pulsepolitics_stats()
            
            return {
                "success": True,
                "function": function_name,
                "userhandles_stats": stats_uh,
                "pulsepolitics_stats": stats_pp
            }
            
        else:
            return {
                "success": False,
                "error": f"Función desconocida: {function_name}",
                "available_functions": [
                    "save_user_discovery",
                    "search_userhandles", 
                    "add_to_pulsepolitics",
                    "search_pulsepolitics",
                    "health_check",
                    "get_stats"
                ]
            }
            
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "function": function_name,
            "error_type": type(e).__name__
        }

def main():
    """
    Función principal que lee de stdin y ejecuta comandos
    """
    try:
        # Leer input JSON desde stdin
        input_data = sys.stdin.read().strip()
        
        if not input_data:
            result = {
                "success": False,
                "error": "No se recibieron datos de entrada"
            }
        else:
            # Parse JSON
            command_data = json.loads(input_data)
            function_name = command_data.get('function', '')
            args = command_data.get('args', {})
            
            # Ejecutar función
            result = execute_function(function_name, args)
            
    except json.JSONDecodeError as e:
        result = {
            "success": False,
            "error": f"Error parsing JSON: {str(e)}",
            "input_received": input_data[:100] if 'input_data' in locals() else "None"
        }
    except Exception as e:
        result = {
            "success": False,
            "error": f"Error inesperado: {str(e)}",
            "error_type": type(e).__name__
        }
    
    # Devolver resultado como JSON
    print(json.dumps(result, ensure_ascii=False, indent=None))
    sys.stdout.flush()

if __name__ == "__main__":
    main() 