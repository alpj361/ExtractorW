"""
Servidor HTTP para exponer la funcionalidad de Laura Memory al backend JavaScript.
"""

from flask import Flask, request, jsonify
import logging
from typing import Dict, Any

from integration import laura_memory_integration
from memory import search_public_memory, get_memory_stats, search_pulsepolitics, get_pulsepolitics_stats, search_userhandles, get_userhandles_stats

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)


@app.route('/api/laura-memory/process-tool-result', methods=['POST'])
def process_tool_result():
    """
    Procesa el resultado de una herramienta y determina si guardarlo en memoria.
    
    Expected JSON:
    {
        "tool_name": "nitter_profile",
        "tool_result": {...},
        "user_query": "busca a Juan Pérez"
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'tool_name' not in data or 'tool_result' not in data:
            return jsonify({"error": "Faltan campos requeridos"}), 400
        
        result = laura_memory_integration.process_tool_result(
            tool_name=data['tool_name'],
            tool_result=data['tool_result'],
            user_query=data.get('user_query', '')
        )
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"❌ Error procesando resultado de herramienta: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/laura-memory/enhance-query', methods=['POST'])
def enhance_query():
    """
    Mejora una query con información de la memoria.
    
    Expected JSON:
    {
        "query": "¿Qué pasó con el congreso?",
        "limit": 3
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'query' not in data:
            return jsonify({"error": "Falta el campo 'query'"}), 400
        
        result = laura_memory_integration.enhance_query_with_memory(
            query=data['query'],
            limit=data.get('limit', 3)
        )
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"❌ Error mejorando query: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/laura-memory/save-user-discovery', methods=['POST'])
def save_user_discovery():
    """
    Guarda información de un usuario descubierto con ML.
    
    Expected JSON:
    {
        "user_name": "Juan Pérez",
        "twitter_username": "juanperez_gt",
        "description": "Diputado del Congreso",
        "category": "politico"
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'user_name' not in data or 'twitter_username' not in data:
            return jsonify({"error": "Faltan campos requeridos"}), 400
        
        success = laura_memory_integration.save_user_discovery(
            user_name=data['user_name'],
            twitter_username=data['twitter_username'],
            description=data.get('description', ''),
            category=data.get('category', '')
        )
        
        return jsonify({"success": success})
        
    except Exception as e:
        logger.error(f"❌ Error guardando usuario: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/laura-memory/search', methods=['POST'])
def search_memory():
    """
    Busca en la memoria pública.
    
    Expected JSON:
    {
        "query": "congreso",
        "limit": 5
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'query' not in data:
            return jsonify({"error": "Falta el campo 'query'"}), 400
        
        results = search_public_memory(
            query=data['query'],
            limit=data.get('limit', 5)
        )
        
        return jsonify({"results": results})
        
    except Exception as e:
        logger.error(f"❌ Error buscando en memoria: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/laura-memory/stats', methods=['GET'])
def memory_stats():
    """
    Obtiene estadísticas de la memoria.
    """
    try:
        stats = get_memory_stats()
        return jsonify(stats)
        
    except Exception as e:
        logger.error(f"❌ Error obteniendo estadísticas: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/laura-memory/search-pulsepolitics', methods=['POST'])
def search_pulsepolitics_endpoint():
    """
    Busca específicamente en el grupo compartido UserHandles.
    
    Expected JSON:
    {
        "query": "Bernardo Arévalo",
        "limit": 5
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'query' not in data:
            return jsonify({"error": "Falta el campo 'query'"}), 400
        
        results = search_pulsepolitics(
            query=data['query'],
            limit=data.get('limit', 5)
        )
        
        return jsonify({"results": results, "source": "userhandles_shared_group"})
        
    except Exception as e:
        logger.error(f"❌ Error buscando en PulsePolitics: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/laura-memory/pulsepolitics-stats', methods=['GET'])
def pulsepolitics_stats():
    """
    Obtiene estadísticas del grupo compartido UserHandles.
    """
    try:
        stats = get_pulsepolitics_stats()
        return jsonify(stats)
        
    except Exception as e:
        logger.error(f"❌ Error obteniendo estadísticas PulsePolitics: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/laura-memory/search-userhandles', methods=['POST'])
def search_userhandles_endpoint():
    """
    Busca específicamente en el grupo UserHandles.
    
    Expected JSON:
    {
        "query": "Bernardo Arévalo",
        "limit": 5
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'query' not in data:
            return jsonify({"error": "Falta el campo 'query'"}), 400
        
        results = search_userhandles(
            query=data['query'],
            limit=data.get('limit', 5)
        )
        
        return jsonify({"results": results, "source": "userhandles_shared_group"})
        
    except Exception as e:
        logger.error(f"❌ Error buscando en UserHandles: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/laura-memory/userhandles-stats', methods=['GET'])
def userhandles_stats():
    """
    Obtiene estadísticas del grupo UserHandles.
    """
    try:
        stats = get_userhandles_stats()
        return jsonify(stats)
        
    except Exception as e:
        logger.error(f"❌ Error obteniendo estadísticas UserHandles: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/health', methods=['GET'])
def health_check():
    """
    Health check endpoint.
    """
    return jsonify({"status": "healthy", "service": "laura-memory"})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)