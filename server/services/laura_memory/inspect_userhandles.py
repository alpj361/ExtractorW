#!/usr/bin/env python3
"""
Script para inspeccionar y limpiar completamente el grupo userhandles
"""

import os
import sys
from zep_cloud.client import Zep
from settings import settings

def inspect_and_clear_userhandles():
    """
    Inspecciona y limpia completamente el grupo userhandles
    """
    try:
        # Inicializar cliente Zep
        client = Zep(api_key=settings.zep_api_key)
        
        print("🔍 Inspeccionando grupo userhandles...")
        
        # 1. Verificar episodios
        try:
            episodes_response = client.graph.episode.get_by_group_id("userhandles")
            if hasattr(episodes_response, 'episodes') and episodes_response.episodes:
                print(f"📋 Episodios encontrados: {len(episodes_response.episodes)}")
                for ep in episodes_response.episodes:
                    print(f"  - {ep.uuid_}: {getattr(ep, 'data', 'No data')[:100]}")
            else:
                print("📋 No hay episodios")
        except Exception as e:
            print(f"❌ Error obteniendo episodios: {e}")
        
        # 2. Verificar edges
        try:
            edges_response = client.graph.edge.get_by_group_id("userhandles")
            if hasattr(edges_response, 'edges') and edges_response.edges:
                print(f"🔗 Edges encontrados: {len(edges_response.edges)}")
                for edge in edges_response.edges:
                    print(f"  - {edge.uuid_}: {getattr(edge, 'fact', 'No fact')}")
                    
                # Eliminar edges
                print("🗑️ Eliminando edges...")
                for edge in edges_response.edges:
                    try:
                        client.graph.edge.delete(edge.uuid_)
                        print(f"✅ Edge eliminado: {edge.uuid_}")
                    except Exception as e:
                        print(f"❌ Error eliminando edge {edge.uuid_}: {e}")
            else:
                print("🔗 No hay edges")
        except Exception as e:
            print(f"❌ Error obteniendo edges: {e}")
        
        # 3. Verificar nodes
        try:
            nodes_response = client.graph.node.get_by_group_id("userhandles")
            if hasattr(nodes_response, 'nodes') and nodes_response.nodes:
                print(f"🔵 Nodes encontrados: {len(nodes_response.nodes)}")
                for node in nodes_response.nodes:
                    print(f"  - {node.uuid_}: {getattr(node, 'name', 'No name')}")
            else:
                print("🔵 No hay nodes")
        except Exception as e:
            print(f"❌ Error obteniendo nodes: {e}")
        
        # 4. Verificar con búsqueda
        try:
            search_results = client.graph.search(
                group_id="userhandles",
                query="usuario",
                scope="edges",
                limit=10
            )
            if hasattr(search_results, 'edges') and search_results.edges:
                print(f"🔍 Búsqueda encontró: {len(search_results.edges)} edges")
                for edge in search_results.edges:
                    print(f"  - {getattr(edge, 'fact', 'No fact')}")
            else:
                print("🔍 Búsqueda no encontró edges")
        except Exception as e:
            print(f"❌ Error en búsqueda: {e}")
            
        print("\n✅ Inspección completa. El grupo userhandles debería estar limpio para nuevas pruebas.")
            
    except Exception as e:
        print(f"❌ Error principal: {e}")
        return False
    
    return True

if __name__ == "__main__":
    print("🔎 Inspeccionando y limpiando grupo userhandles...")
    success = inspect_and_clear_userhandles()
    
    if success:
        print("\n🎯 Grupo limpio - listo para probar:")
        print("1. Buscar usuario nuevo (ej: 'Mario López')")
        print("2. Verificar que no lo encuentra en memoria")
        print("3. Sistema lo resuelve con Perplexity")
        print("4. Lo guarda en userhandles")
        print("5. Próxima búsqueda lo encuentra en memoria")