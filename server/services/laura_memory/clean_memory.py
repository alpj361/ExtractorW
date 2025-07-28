#!/usr/bin/env python3
"""
Script para limpiar todos los episodios de los grupos de memoria
Usando Zep Graph API para eliminar episodios
"""

import json
import logging
from typing import List
from datetime import datetime

try:
    from zep_cloud.client import Zep
except ImportError as e:
    print(f"Error importing Zep: {e}")
    exit(1)

from settings import LauraMemorySettings
import os

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

def get_group_episodes(client, group_id: str) -> List[str]:
    """
    Obtener todos los UUIDs de episodios de un grupo
    """
    try:
        # Buscar todos los episodios del grupo
        search_results = client.graph.search(
            group_id=group_id,
            query="*",  # Buscar todo
            scope="episodes",
            limit=100  # Máximo por request
        )
        
        episode_uuids = []
        if hasattr(search_results, 'episodes') and search_results.episodes:
            for episode in search_results.episodes:
                if hasattr(episode, 'uuid'):
                    episode_uuids.append(episode.uuid)
                    
        logger.info(f"📋 Encontrados {len(episode_uuids)} episodios en grupo '{group_id}'")
        return episode_uuids
        
    except Exception as e:
        logger.error(f"❌ Error obteniendo episodios del grupo '{group_id}': {e}")
        return []

def delete_episode(client, episode_uuid: str) -> bool:
    """
    Eliminar un episodio específico por UUID
    """
    try:
        client.graph.episode.delete(uuid_=episode_uuid)
        logger.info(f"🗑️ Episodio eliminado: {episode_uuid}")
        return True
    except Exception as e:
        logger.error(f"❌ Error eliminando episodio {episode_uuid}: {e}")
        return False

def clean_group(client, group_id: str) -> dict:
    """
    Limpiar todos los episodios de un grupo específico
    """
    logger.info(f"🧹 Iniciando limpieza del grupo: {group_id}")
    
    # Obtener episodios del grupo
    episode_uuids = get_group_episodes(client, group_id)
    
    if not episode_uuids:
        logger.info(f"✅ Grupo '{group_id}' ya está limpio (0 episodios)")
        return {"group_id": group_id, "deleted": 0, "errors": 0}
    
    # Eliminar cada episodio
    deleted_count = 0
    error_count = 0
    
    for uuid in episode_uuids:
        if delete_episode(client, uuid):
            deleted_count += 1
        else:
            error_count += 1
    
    result = {
        "group_id": group_id,
        "total_found": len(episode_uuids),
        "deleted": deleted_count,
        "errors": error_count
    }
    
    logger.info(f"✅ Limpieza de '{group_id}' completada: {deleted_count} eliminados, {error_count} errores")
    return result

def clean_all_memory():
    """
    Limpiar toda la memoria de Laura (ambos grupos)
    """
    logger.info("🧹 Iniciando limpieza completa de memoria Laura")
    
    try:
        client = get_zep_client()
        
        # Limpiar grupo userhandles
        userhandles_result = clean_group(client, "userhandles")
        
        # Limpiar grupo pulsepolitics
        pulsepolitics_result = clean_group(client, "pulsepolitics")
        
        # Resumen final
        total_deleted = userhandles_result["deleted"] + pulsepolitics_result["deleted"]
        total_errors = userhandles_result["errors"] + pulsepolitics_result["errors"]
        
        logger.info("🎉 Limpieza completa terminada")
        logger.info(f"📊 Resumen:")
        logger.info(f"   • UserHandles: {userhandles_result['deleted']} eliminados")
        logger.info(f"   • PulsePolitics: {pulsepolitics_result['deleted']} eliminados")
        logger.info(f"   • Total eliminados: {total_deleted}")
        logger.info(f"   • Errores: {total_errors}")
        
        return {
            "success": True,
            "userhandles": userhandles_result,
            "pulsepolitics": pulsepolitics_result,
            "total_deleted": total_deleted,
            "total_errors": total_errors,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Error durante limpieza: {e}")
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }

if __name__ == "__main__":
    print("🧹 Limpieza de Memoria Laura")
    print("=" * 50)
    
    # Confirmar antes de proceder
    confirm = input("¿Estás seguro de que quieres eliminar TODOS los episodios de memoria? (y/N): ")
    
    if confirm.lower() not in ['y', 'yes', 'sí', 'si']:
        print("❌ Operación cancelada")
        exit(0)
    
    print("\n🚀 Iniciando limpieza...")
    result = clean_all_memory()
    
    print("\n📋 Resultado final:")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    
    if result["success"]:
        print("\n✅ ¡Memoria limpia exitosamente!")
    else:
        print(f"\n❌ Error durante limpieza: {result['error']}")
        exit(1) 