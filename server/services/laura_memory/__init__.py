"""
Laura Memory - Sistema de memoria pública con Zep Cloud.

Este módulo proporciona funcionalidades para que Laura pueda guardar y buscar
información relevante en una memoria global usando Zep Cloud como backend.
"""

from .memory import add_public_memory, search_public_memory
from .detectors import is_new_user, is_new_term, is_relevant_fact

__all__ = [
    "add_public_memory",
    "search_public_memory", 
    "is_new_user",
    "is_new_term",
    "is_relevant_fact"
]

__version__ = "1.0.0"