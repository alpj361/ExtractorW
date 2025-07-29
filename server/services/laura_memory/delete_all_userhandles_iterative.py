#!/usr/bin/env python3
"""
Eliminación ITERATIVA de episodios - continúa hasta eliminar TODO
"""

import os
import sys
import time
from zep_cloud.client import Zep
from settings import settings

def delete_all_iteratively():
    """
    Elimina episodios de forma iterativa hasta que no quede ninguno
    """
    try:
        client = Zep(api_key=settings.zep_api_key)
        
        iteration = 1
        total_deleted = 0
        
        while True:
            print(f"\n🔄 ITERACIÓN {iteration}")
            print("=" * 50)
            
            # Obtener episodios actuales
            try:
                episodes_response = client.graph.episode.get_by_group_id("userhandles")
                
                if not hasattr(episodes_response, 'episodes') or not episodes_response.episodes:
                    print("✅ No hay más episodios en userhandles")
                    break
                    
                episodes = episodes_response.episodes
                print(f"📋 Encontrados {len(episodes)} episodios en esta iteración")
                
                # Eliminar todos los episodios de esta iteración
                deleted_this_round = 0
                for i, episode in enumerate(episodes, 1):
                    try:
                        print(f"🗑️ [{i}/{len(episodes)}] Eliminando: {episode.uuid_}")
                        client.graph.episode.delete(uuid_=episode.uuid_)
                        deleted_this_round += 1
                        total_deleted += 1
                        print(f"✅ Eliminado: {episode.uuid_}")
                        
                        # Pequeña pausa para evitar rate limiting
                        time.sleep(0.1)
                        
                    except Exception as e:
                        print(f"❌ Error eliminando {episode.uuid_}: {e}")
                
                print(f"📊 Eliminados en esta iteración: {deleted_this_round}")
                print(f"📊 Total eliminados: {total_deleted}")
                
                # Pausa entre iteraciones
                time.sleep(1)
                iteration += 1
                
                # Límite de seguridad
                if iteration > 10:
                    print("⚠️ Límite de 10 iteraciones alcanzado - abortando")
                    break
                    
            except Exception as e:
                print(f"❌ Error obteniendo episodios en iteración {iteration}: {e}")
                break
        
        # Verificación final exhaustiva
        print("\n" + "=" * 60)
        print("🔍 VERIFICACIÓN FINAL EXHAUSTIVA")
        print("=" * 60)
        
        # Verificar episodios
        try:
            final_episodes = client.graph.episode.get_by_group_id("userhandles")
            episode_count = len(final_episodes.episodes) if hasattr(final_episodes, 'episodes') and final_episodes.episodes else 0
            print(f"📋 Episodios finales: {episode_count}")
            
            if episode_count > 0:
                print("⚠️ EPISODIOS RESTANTES:")
                for ep in final_episodes.episodes:
                    print(f"  - {ep.uuid_}")
        except Exception as e:
            print(f"❌ Error verificando episodios: {e}")
            
        # Verificar edges
        try:
            final_edges = client.graph.edge.get_by_group_id("userhandles")
            edge_count = len(final_edges.edges) if hasattr(final_edges, 'edges') and final_edges.edges else 0
            print(f"🔗 Edges finales: {edge_count}")
        except Exception as e:
            print(f"❌ Error verificando edges: {e}")
            edge_count = -1
            
        # Verificar con búsqueda
        try:
            search_test = client.graph.search(
                group_id="userhandles",
                query="test",
                scope="edges",
                limit=10
            )
            search_count = len(search_test.edges) if hasattr(search_test, 'edges') and search_test.edges else 0
            print(f"🔍 Búsqueda encuentra: {search_count} elementos")
        except Exception as e:
            print(f"❌ Error en búsqueda: {e}")
            search_count = -1
        
        # Resultado final
        if episode_count == 0 and edge_count == 0 and search_count == 0:
            print("\n" + "🎉" * 20)
            print("✅ ¡ÉXITO TOTAL! GRUPO USERHANDLES COMPLETAMENTE VACÍO")
            print("🎉" * 20)
            print(f"📊 Total eliminados: {total_deleted} episodios")
            print(f"📊 Iteraciones necesarias: {iteration - 1}")
            print("\n🎯 Ahora puedes probar el flujo limpio:")
            print("1. Buscar usuario → NO encontrará en memoria")
            print("2. Resolverá con Perplexity")
            print("3. Guardará en userhandles")
            print("4. Próxima búsqueda lo encontrará en memoria")
            return True
        else:
            print("\n" + "❌" * 20)
            print("⚠️ LIMPIEZA INCOMPLETA")
            print("❌" * 20)
            print(f"   - Episodios restantes: {episode_count}")
            print(f"   - Edges restantes: {edge_count}")
            print(f"   - Búsqueda encuentra: {search_count}")
            return False
            
    except Exception as e:
        print(f"❌ Error principal: {e}")
        return False

if __name__ == "__main__":
    print("🔥 ELIMINACIÓN ITERATIVA COMPLETA - USERHANDLES")
    print("Continuará hasta eliminar ABSOLUTAMENTE TODO")
    print("=" * 60)
    
    success = delete_all_iteratively()
    
    if success:
        print("\n✅ ¡PERFECTO! Grupo userhandles está 100% limpio")
    else:
        print("\n❌ Algunos elementos persistieron - revisar manualmente")
        sys.exit(1)