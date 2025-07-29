#!/usr/bin/env python3
"""
Script para eliminar todos los episodios del grupo userhandles
manteniendo el grupo intacto para poder probar el flujo completo.
"""

import os
import sys
from zep_cloud.client import Zep
from settings import settings

def clear_userhandles_episodes():
    """
    Elimina todos los episodios del grupo userhandles
    """
    try:
        # Inicializar cliente Zep
        client = Zep(api_key=settings.zep_api_key)
        
        print("🔍 Obteniendo episodios del grupo userhandles...")
        
        # Obtener todos los episodios del grupo userhandles
        episodes_response = client.graph.episode.get_by_group_id("userhandles")
        
        if hasattr(episodes_response, 'episodes') and episodes_response.episodes:
            episodes = episodes_response.episodes
            print(f"📋 Encontrados {len(episodes)} episodios en userhandles")
            
            # Eliminar cada episodio
            deleted_count = 0
            for episode in episodes:
                try:
                    client.graph.episode.delete(episode.uuid_)
                    deleted_count += 1
                    print(f"🗑️ Eliminado episodio {episode.uuid_}")
                except Exception as e:
                    print(f"❌ Error eliminando episodio {episode.uuid_}: {e}")
            
            print(f"✅ Eliminados {deleted_count} de {len(episodes)} episodios del grupo userhandles")
            
        else:
            print("📋 No se encontraron episodios en el grupo userhandles")
            
        # Verificar que se eliminaron
        print("\n🔍 Verificando eliminación...")
        try:
            verification = client.graph.episode.get_by_group_id("userhandles")
            remaining = len(verification.episodes) if hasattr(verification, 'episodes') and verification.episodes else 0
            print(f"📊 Episodios restantes: {remaining}")
            
            if remaining == 0:
                print("✅ Grupo userhandles limpiado exitosamente - listo para nuevas pruebas")
            else:
                print(f"⚠️ Aún quedan {remaining} episodios")
                
        except Exception as e:
            print(f"⚠️ Error verificando: {e}")
            
    except Exception as e:
        print(f"❌ Error principal: {e}")
        return False
    
    return True

if __name__ == "__main__":
    print("🧹 Limpiando episodios del grupo userhandles...")
    success = clear_userhandles_episodes()
    
    if success:
        print("\n🎯 Ahora puedes probar el flujo completo:")
        print("1. Buscar usuario que no existe en userhandles")
        print("2. Sistema resolverá con Perplexity")
        print("3. Guardará en userhandles")
        print("4. Próxima búsqueda lo encontrará en memoria")
    else:
        print("\n❌ Error en la limpieza")
        sys.exit(1)