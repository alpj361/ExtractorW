#!/usr/bin/env python3
"""
Script para limpiar memoria usando Memory API clásica (sessions)
Ya que Graph API no está disponible en zep-cloud==2.22.0
"""

import json
import logging
from datetime import datetime

try:
    from zep_cloud.client import Zep
except ImportError as e:
    print(f"Error importing Zep: {e}")
    exit(1)

from settings import LauraMemorySettings

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_zep_client():
    """Obtener cliente Zep configurado"""
    settings = LauraMemorySettings()
    
    if not settings.zep_api_key:
        raise ValueError("ZEP_API_KEY no configurado")
        
    return Zep(
        api_key=settings.zep_api_key,
        base_url=settings.zep_url
    )

def get_session_info(client, session_id: str) -> dict:
    """Obtener información de una sesión"""
    try:
        session = client.memory.get(session_id=session_id)
        
        if hasattr(session, 'messages') and session.messages:
            message_count = len(session.messages)
            logger.info(f"📋 Sesión '{session_id}': {message_count} mensajes")
            
            # Mostrar algunos ejemplos
            for i, msg in enumerate(session.messages[:3]):
                content_preview = msg.content[:80] + "..." if len(msg.content) > 80 else msg.content
                logger.info(f"   {i+1}. {content_preview}")
                
            return {
                "session_id": session_id,
                "message_count": message_count,
                "exists": True
            }
        else:
            logger.info(f"📋 Sesión '{session_id}': vacía o sin mensajes")
            return {
                "session_id": session_id,
                "message_count": 0,
                "exists": True
            }
            
    except Exception as e:
        if "not found" in str(e).lower():
            logger.info(f"📋 Sesión '{session_id}': no existe")
            return {
                "session_id": session_id,
                "message_count": 0,
                "exists": False,
                "error": "not_found"
            }
        else:
            logger.error(f"❌ Error obteniendo sesión '{session_id}': {e}")
            return {
                "session_id": session_id,
                "message_count": 0,
                "exists": False,
                "error": str(e)
            }

def delete_session(client, session_id: str) -> bool:
    """Eliminar una sesión completa"""
    try:
        client.memory.delete(session_id=session_id)
        logger.info(f"🗑️ Sesión eliminada: {session_id}")
        return True
    except Exception as e:
        if "not found" in str(e).lower():
            logger.info(f"ℹ️ Sesión '{session_id}' ya no existe")
            return True
        else:
            logger.error(f"❌ Error eliminando sesión '{session_id}': {e}")
            return False

def clean_all_sessions():
    """
    Limpiar todas las sesiones de memoria de Laura
    """
    logger.info("🧹 Iniciando limpieza de sesiones de memoria")
    
    try:
        client = get_zep_client()
        settings = LauraMemorySettings()
        
        # Lista de todas las sesiones que pueden contener datos
        session_ids = [
            # De settings.py
            settings.userhandles_session_id,  # "userhandles_shared_session"
            settings.pulsepolitics_session_id,  # "group:pulsepolitics"
            settings.session_id,  # "laura_memory_session"
            
            # Posibles sesiones adicionales de fallback
            "userhandles_session",
            "pulsepolitics_session",
            
            # Sesiones que pueden haberse creado durante pruebas
            "laura_memory",
            "public/global",
            "userhandles_shared_group",
            "pulsepolitics_shared_group"
        ]
        
        # Analizar todas las sesiones
        logger.info(f"🔍 Analizando {len(session_ids)} posibles sesiones...")
        session_info = {}
        
        for session_id in session_ids:
            info = get_session_info(client, session_id)
            session_info[session_id] = info
        
        # Mostrar resumen
        logger.info("\n📊 Resumen de sesiones encontradas:")
        sessions_to_clean = []
        
        for session_id, info in session_info.items():
            if info["exists"] and info["message_count"] > 0:
                logger.info(f"   🔴 {session_id}: {info['message_count']} mensajes (LIMPIAR)")
                sessions_to_clean.append(session_id)
            elif info["exists"]:
                logger.info(f"   🟡 {session_id}: vacía")
            else:
                logger.info(f"   ⚫ {session_id}: no existe")
        
        if not sessions_to_clean:
            logger.info("✅ No hay sesiones que limpiar")
            return {
                "success": True,
                "sessions_cleaned": 0,
                "sessions_analyzed": len(session_ids),
                "details": session_info
            }
        
        # Confirmar limpieza
        logger.info(f"\n🗑️ Se limpiarán {len(sessions_to_clean)} sesiones:")
        for session_id in sessions_to_clean:
            logger.info(f"   - {session_id} ({session_info[session_id]['message_count']} mensajes)")
        
        # Limpiar sesiones
        cleaned_count = 0
        error_count = 0
        
        for session_id in sessions_to_clean:
            if delete_session(client, session_id):
                cleaned_count += 1
            else:
                error_count += 1
        
        logger.info(f"\n🎉 Limpieza completada:")
        logger.info(f"   • Sesiones limpiadas: {cleaned_count}")
        logger.info(f"   • Errores: {error_count}")
        
        return {
            "success": True,
            "sessions_cleaned": cleaned_count,
            "sessions_with_errors": error_count,
            "sessions_analyzed": len(session_ids),
            "cleaned_sessions": sessions_to_clean,
            "details": session_info,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Error durante limpieza: {e}")
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

if __name__ == "__main__":
    print("🧹 Limpieza de Sesiones de Memoria Laura")
    print("=" * 50)
    
    # Ejecutar análisis sin confirmación primero
    print("🔍 Analizando sesiones existentes...")
    result = clean_all_sessions()
    
    print("\n📋 Resultado:")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    
    if result["success"]:
        if result["sessions_cleaned"] > 0:
            print(f"\n✅ ¡{result['sessions_cleaned']} sesiones limpiadas exitosamente!")
        else:
            print("\n✅ ¡No había sesiones que limpiar!")
    else:
        print(f"\n❌ Error durante limpieza: {result['error']}")
        exit(1) 