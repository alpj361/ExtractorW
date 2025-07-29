#!/usr/bin/env python3
"""
Eliminar TODOS los episodios del grupo userhandles usando la API correcta
Basado en documentación oficial de Zep
"""

import os
import sys
from zep_cloud.client import Zep
from settings import settings

def delete_all_episodes_from_group():
    """
    Elimina TODOS los episodios del grupo userhandles usando el método correcto
    """
    try:
        client = Zep(api_key=settings.zep_api_key)
        
        print("🔍 Obteniendo TODOS los episodios del grupo userhandles...")
        
        # Paso 1: Obtener TODOS los episodios del grupo
        episodes_response = client.graph.episode.get_by_group_id("userhandles")
        
        if not hasattr(episodes_response, 'episodes') or not episodes_response.episodes:
            print("📋 No hay episodios en el grupo userhandles")
            return True
            
        episodes = episodes_response.episodes
        print(f"📋 Encontrados {len(episodes)} episodios en userhandles:")
        
        # Mostrar todos los episodios antes de eliminar
        for i, episode in enumerate(episodes, 1):
            episode_data = getattr(episode, 'data', 'No data')
            episode_preview = episode_data[:100] if episode_data else 'Sin datos'
            print(f"  {i}. {episode.uuid_}: {episode_preview}")
        
        print(f"\n🗑️ Eliminando {len(episodes)} episodios...")
        
        # Paso 2: Eliminar cada episodio usando client.graph.episode.delete()
        successful_deletions = 0
        failed_deletions = 0
        
        for i, episode in enumerate(episodes, 1):
            try:
                print(f"🗑️ [{i}/{len(episodes)}] Eliminando: {episode.uuid_}")
                
                # USAR EL MÉTODO CORRECTO según documentación
                client.graph.episode.delete(uuid_=episode.uuid_)
                
                successful_deletions += 1
                print(f"✅ [{i}/{len(episodes)}] Eliminado exitosamente: {episode.uuid_}")
                
            except Exception as e:
                failed_deletions += 1
                print(f"❌ [{i}/{len(episodes)}] Error eliminando {episode.uuid_}: {e}")
        
        print(f"\n📊 Resultado:")
        print(f"✅ Eliminados exitosamente: {successful_deletions}")
        print(f"❌ Fallos: {failed_deletions}")
        print(f"📋 Total procesados: {len(episodes)}")
        
        # Paso 3: VERIFICACIÓN EXHAUSTIVA
        print(f"\n🔍 Verificación final...")
        
        try:
            # Verificar que NO hay episodios
            final_check = client.graph.episode.get_by_group_id("userhandles")
            remaining_episodes = len(final_check.episodes) if hasattr(final_check, 'episodes') and final_check.episodes else 0
            
            print(f"📋 Episodios restantes después de eliminación: {remaining_episodes}")
            
            if remaining_episodes > 0:
                print(f"⚠️ AÚN QUEDAN {remaining_episodes} EPISODIOS:")
                for ep in final_check.episodes:
                    print(f"  - {ep.uuid_}: {getattr(ep, 'data', 'No data')[:100]}")
                    
                return False
            
            # Verificar búsqueda también
            search_test = client.graph.search(
                group_id="userhandles",
                query="test",
                scope="edges",
                limit=5
            )
            
            search_results = len(search_test.edges) if hasattr(search_test, 'edges') and search_test.edges else 0
            print(f"🔍 Búsqueda encuentra: {search_results} edges")
            
            if remaining_episodes == 0 and search_results == 0:
                print("\n🎉 ¡ÉXITO TOTAL!")
                print("✅ Grupo userhandles completamente vacío")
                print("✅ No hay episodios")
                print("✅ No hay edges en búsqueda")
                print("\n🎯 Listo para probar flujo limpio:")
                print("1. Buscar usuario nuevo → NO encontrará en memoria")
                print("2. Resolverá con Perplexity")
                print("3. Guardará en userhandles") 
                print("4. Próxima búsqueda lo encontrará en memoria")
                return True
            else:
                print(f"\n⚠️ Limpieza incompleta:")
                print(f"   - Episodios: {remaining_episodes}")
                print(f"   - Edges en búsqueda: {search_results}")
                return False
                
        except Exception as e:
            print(f"❌ Error en verificación final: {e}")
            return False
            
    except Exception as e:
        print(f"❌ Error principal: {e}")
        return False

if __name__ == "__main__":
    print("💥 ELIMINACIÓN TOTAL DE EPISODIOS - GRUPO USERHANDLES")
    print("Usando método oficial: client.graph.episode.delete(uuid_=episode.uuid_)")
    print("=" * 60)
    
    success = delete_all_episodes_from_group()
    
    if success:
        print("\n" + "=" * 60)
        print("🎯 ¡PERFECTO! Grupo userhandles completamente limpio")
        print("✅ Ahora puedes probar el flujo completo desde cero")
    else:
        print("\n" + "=" * 60)
        print("❌ Limpieza INCOMPLETA - revisar manualmente")
        print("⚠️ Algunos episodios no se eliminaron correctamente")
        sys.exit(1)