"""
Detectores heurísticos para determinar qué información es relevante 
para guardar en la memoria pública de Laura.
"""

import re
from typing import Dict, List, Any
from datetime import datetime


def is_new_user(content: str, metadata: Dict[str, Any] = None) -> bool:
    """
    Detecta si el contenido menciona un usuario nuevo relevante.
    
    Args:
        content: Contenido a analizar.
        metadata: Metadatos adicionales del contexto.
        
    Returns:
        True si parece ser un usuario nuevo relevante.
    """
    # Patrones para detectar usuarios nuevos
    new_user_patterns = [
        r'nuevo usuario.*?(@\w+)',
        r'descubrí.*?(@\w+)',
        r'encontré.*?(@\w+)',
        r'ml discovery.*?(@\w+)',  # Buscar en minúsculas
        r'persona.*?(@\w+)',
        r'usuario.*?(@\w+)'
    ]
    
    content_lower = content.lower()
    
    # Verificar patrones de usuario nuevo
    for pattern in new_user_patterns:
        if re.search(pattern, content_lower):
            return True
    
    # Verificar en metadatos si viene de ML Discovery
    if metadata and metadata.get('source') == 'ml_discovery':
        return True
    
    return False


def is_new_term(content: str, metadata: Dict[str, Any] = None) -> bool:
    """
    Detecta si el contenido contiene términos nuevos relevantes.
    
    Args:
        content: Contenido a analizar.
        metadata: Metadatos adicionales del contexto.
        
    Returns:
        True si contiene términos nuevos relevantes.
    """
    # Patrones para términos importantes
    important_terms = [
        r'\b(ley|decreto|acuerdo|resolución)\s+\w+',
        r'\b(proyecto|iniciativa)\s+\w+',
        r'\b(reforma|modificación)\s+\w+',
        r'\b(congreso|diputado|ministro)\s+\w+',
        r'\b(elección|candidato|partido)\s+\w+',
        r'\b(crisis|emergencia|alerta)\s+\w+',
        r'\b(política|gobierno|estado)\s+\w+',
        r'#\w+',  # Hashtags (sin word boundary al principio)
        r'@\w+',  # Mentions
    ]
    
    content_lower = content.lower()
    
    # Verificar patrones de términos importantes
    for pattern in important_terms:
        if re.search(pattern, content_lower):
            return True
    
    # Verificar longitud mínima para considerar relevante
    if len(content.split()) >= 5:
        return True
    
    return False


def is_relevant_fact(content: str, metadata: Dict[str, Any] = None) -> bool:
    """
    Detecta si el contenido representa un hecho relevante.
    
    Args:
        content: Contenido a analizar.
        metadata: Metadatos adicionales del contexto.
        
    Returns:
        True si es un hecho relevante para guardar.
    """
    # Patrones para hechos relevantes
    fact_patterns = [
        r'\b(aprobó|rechazó|votó|decidió)\b',
        r'\b(anunció|declaró|confirmó|negó)\b',
        r'\b(presentó|propuso|sugirió)\b',
        r'\b(ocurrió|sucedió|pasó)\b',
        r'\b(ganó|perdió|empató)\b',
        r'\b(aumentó|aumentaron|disminuyó|disminuyeron|cambió|cambiaron)\b',  # Incluir formas plurales
        r'\b(nueva|nuevo|primer|primera)\b',
        r'\b(crisis|problema|conflicto)\b',
        r'\b(acuerdo|tratado|convenio)\b',
        r'\b(elección|resultado|ganador)\b'
    ]
    
    content_lower = content.lower()
    
    # Verificar patrones de hechos
    for pattern in fact_patterns:
        if re.search(pattern, content_lower):
            return True
    
    # Verificar si viene de fuentes confiables
    if metadata:
        source = metadata.get('source', '')
        if source in ['nitter_profile', 'nitter_context', 'perplexity_search']:
            return True
        
        # Verificar tags relevantes
        tags = metadata.get('tags', [])
        relevant_tags = ['politica', 'gobierno', 'congreso', 'noticia', 'importante']
        if any(tag in relevant_tags for tag in tags):
            return True
    
    return False


def should_save_to_memory(content: str, metadata: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Determina si el contenido debe guardarse en memoria y con qué metadatos.
    
    Args:
        content: Contenido a evaluar.
        metadata: Metadatos existentes.
        
    Returns:
        Dict con información sobre si guardar y metadatos sugeridos.
    """
    if not content or len(content.strip()) < 10:
        return {"should_save": False, "reason": "Contenido demasiado corto"}
    
    # Verificar condiciones
    new_user = is_new_user(content, metadata)
    new_term = is_new_term(content, metadata)
    relevant_fact = is_relevant_fact(content, metadata)
    
    # Determinar si guardar
    should_save = new_user or new_term or relevant_fact
    
    if not should_save:
        return {"should_save": False, "reason": "No cumple criterios de relevancia"}
    
    # Preparar metadatos sugeridos
    suggested_metadata = metadata.copy() if metadata else {}
    
    # Agregar tags automáticos
    auto_tags = []
    if new_user:
        auto_tags.append("new_user")
    if new_term:
        auto_tags.append("new_term")
    if relevant_fact:
        auto_tags.append("relevant_fact")
    
    # Detectar categorías adicionales
    if re.search(r'\b(congreso|diputado|política)\b', content.lower()):
        auto_tags.append("politica")
    if re.search(r'\b(elección|candidato|partido)\b', content.lower()):
        auto_tags.append("electoral")
    if re.search(r'\b(ley|decreto|legal)\b', content.lower()):
        auto_tags.append("legal")
    if re.search(r'\b(crisis|emergencia|problema)\b', content.lower()):
        auto_tags.append("urgente")
    
    # Combinar tags existentes con automáticos
    existing_tags = suggested_metadata.get('tags', [])
    all_tags = list(set(existing_tags + auto_tags))
    
    suggested_metadata.update({
        'tags': all_tags,
        'ts': datetime.utcnow().isoformat(),
        'confidence': 'high' if (new_user and relevant_fact) else 'medium'
    })
    
    return {
        "should_save": True,
        "metadata": suggested_metadata,
        "reasons": {
            "new_user": new_user,
            "new_term": new_term,
            "relevant_fact": relevant_fact
        }
    }