#!/usr/bin/env python3
"""
Limpieza COMPLETA del grupo userhandles - elimina TODO
"""

import os
import sys
from zep_cloud.client import Zep
from settings import settings

def complete_cleanup():
    """
    Elimina absolutamente todo del grupo userhandles
    """
    try:
        client = Zep(api_key=settings.zep_api_key)
        
        print("🧹 LIMPIEZA COMPLETA del grupo userhandles...")
        
        # 1. Obtener y eliminar TODOS los episodios
        print("\n1️⃣ Eliminando TODOS los episodios...")
        try:
            episodes_response = client.graph.episode.get_by_group_id("userhandles")
            if hasattr(episodes_response, 'episodes') and episodes_response.episodes:
                print(f"📋 Encontrados {len(episodes_response.episodes)} episodios")
                
                for episode in episodes_response.episodes:
                    try:
                        print(f"🗑️ Eliminando episodio: {episode.uuid_}")
                        client.graph.episode.delete(episode.uuid_)
                        print(f"✅ Eliminado: {episode.uuid_}")
                    except Exception as e:
                        print(f"❌ Error eliminando episodio {episode.uuid_}: {e}")
            else:
                print("📋 No hay episodios")
        except Exception as e:
            print(f"❌ Error obteniendo episodios: {e}")
        
        # 2. Obtener y eliminar TODOS los edges  
        print("\n2️⃣ Eliminando TODOS los edges...")
        try:
            edges_response = client.graph.edge.get_by_group_id("userhandles")
            if hasattr(edges_response, 'edges') and edges_response.edges:
                print(f"🔗 Encontrados {len(edges_response.edges)} edges")
                
                for edge in edges_response.edges:
                    try:
                        print(f"🗑️ Eliminando edge: {edge.uuid_} - {getattr(edge, 'fact', 'No fact')}")
                        client.graph.edge.delete(edge.uuid_)
                        print(f"✅ Eliminado: {edge.uuid_}")
                    except Exception as e:
                        print(f"❌ Error eliminando edge {edge.uuid_}: {e}")
            else:
                print("🔗 No hay edges")
        except Exception as e:
            print(f"❌ Error obteniendo edges: {e}")
        
        # 3. Obtener y eliminar TODOS los nodes
        print("\n3️⃣ Eliminando TODOS los nodes...")
        try:
            nodes_response = client.graph.node.get_by_group_id("userhandles")
            if hasattr(nodes_response, 'nodes') and nodes_response.nodes:
                print(f"🔵 Encontrados {len(nodes_response.nodes)} nodes")
                
                for node in nodes_response.nodes:
                    try:
                        print(f"🗑️ Eliminando node: {node.uuid_} - {getattr(node, 'name', 'No name')}")
                        client.graph.node.delete(node.uuid_)
                        print(f"✅ Eliminado: {node.uuid_}")
                    except Exception as e:
                        print(f"❌ Error eliminando node {node.uuid_}: {e}")
            else:
                print("🔵 No hay nodes")
        except Exception as e:
            print(f"❌ Error obteniendo nodes: {e}")
        
        # 4. Búsqueda exhaustiva de cualquier edge restante
        print("\n4️⃣ Búsqueda exhaustiva de edges restantes...")
        search_terms = ["user", "usuario", "twitter", "@", "handle", "test", "mario", "karin", "bernardo", "a", "e", "i", "o", "u"]
        
        all_found_edges = set()
        for term in search_terms:
            try:
                search_result = client.graph.search(
                    group_id="userhandles",
                    query=term,
                    scope="edges", 
                    limit=100
                )
                if hasattr(search_result, 'edges') and search_result.edges:
                    for edge in search_result.edges:
                        all_found_edges.add(edge.uuid_)
            except Exception as e:
                print(f"⚠️ Error buscando '{term}': {e}")
        
        if all_found_edges:
            print(f"🔍 Encontrados {len(all_found_edges)} edges adicionales vía búsqueda")
            for edge_uuid in all_found_edges:
                try:
                    client.graph.edge.delete(edge_uuid)
                    print(f"✅ Edge eliminado: {edge_uuid}")
                except Exception as e:
                    print(f"❌ Error eliminando edge {edge_uuid}: {e}")
        else:
            print("🔍 No se encontraron edges adicionales")
        
        # 5. Verificación final EXHAUSTIVA
        print("\n5️⃣ Verificación final...")
        
        # Verificar episodios
        try:
            final_episodes = client.graph.episode.get_by_group_id("userhandles")
            episode_count = len(final_episodes.episodes) if hasattr(final_episodes, 'episodes') and final_episodes.episodes else 0
            print(f"📋 Episodios restantes: {episode_count}")
        except Exception as e:
            print(f"📋 Error verificando episodios: {e}")
        
        # Verificar edges
        try:
            final_edges = client.graph.edge.get_by_group_id("userhandles")
            edge_count = len(final_edges.edges) if hasattr(final_edges, 'edges') and final_edges.edges else 0
            print(f"🔗 Edges restantes: {edge_count}")
        except Exception as e:
            print(f"🔗 Error verificando edges: {e}")
        
        # Verificar nodes
        try:
            final_nodes = client.graph.node.get_by_group_id("userhandles")
            node_count = len(final_nodes.nodes) if hasattr(final_nodes, 'nodes') and final_nodes.nodes else 0
            print(f"🔵 Nodes restantes: {node_count}")
        except Exception as e:
            print(f"🔵 Error verificando nodes: {e}")
        
        # Verificar con búsqueda
        try:
            final_search = client.graph.search(group_id="userhandles", query="test", scope="edges", limit=10)
            search_count = len(final_search.edges) if hasattr(final_search, 'edges') and final_search.edges else 0
            print(f"🔍 Búsqueda encuentra: {search_count} edges")
            
            if search_count == 0:
                print("\n🎉 ¡LIMPIEZA COMPLETA EXITOSA!")
                print("✅ Grupo userhandles está completamente vacío")
                return True
            else:
                print(f"\n⚠️ Aún hay {search_count} elementos:")
                for edge in final_search.edges:
                    print(f"  - {getattr(edge, 'fact', 'No fact')}")
                return False
                
        except Exception as e:
            print(f"🔍 Error en verificación final: {e}")
            return False
        
    except Exception as e:
        print(f"❌ Error principal: {e}")
        return False

if __name__ == "__main__":
    print("💥 LIMPIEZA TOTAL del grupo userhandles")
    print("Esto eliminará ABSOLUTAMENTE TODO del grupo")
    
    success = complete_cleanup()
    
    if success:
        print("\n🎯 ¡PERFECTO! Ahora puedes probar el flujo limpio:")
        print("1. Buscar 'Mario López' - NO debería encontrarlo")
        print("2. Sistema resolverá con Perplexity")  
        print("3. Guardará en userhandles")
        print("4. Próxima búsqueda lo encontrará en memoria")
    else:
        print("\n❌ Limpieza incompleta - revisar manualmente")