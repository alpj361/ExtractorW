#!/usr/bin/env python3
"""
Limpia userhandles usando búsqueda para encontrar y eliminar todos los edges
"""

import os
import sys
from zep_cloud.client import Zep
from settings import settings

def clear_userhandles_via_search():
    """
    Limpia userhandles buscando y eliminando todos los edges
    """
    try:
        client = Zep(api_key=settings.zep_api_key)
        
        print("🔍 Buscando todos los edges en userhandles...")
        
        # Búsqueda amplia para encontrar todos los edges
        search_queries = ["", "usuario", "twitter", "@", "handle", "test", "bernardo", "arevalo"]
        all_edges = []
        
        for query in search_queries:
            try:
                search_results = client.graph.search(
                    group_id="userhandles",
                    query=query if query else "user",
                    scope="edges",
                    limit=50
                )
                if hasattr(search_results, 'edges') and search_results.edges:
                    for edge in search_results.edges:
                        if edge.uuid_ not in [e.uuid_ for e in all_edges]:
                            all_edges.append(edge)
            except Exception as e:
                print(f"⚠️ Error buscando '{query}': {e}")
        
        print(f"📋 Encontrados {len(all_edges)} edges únicos:")
        for edge in all_edges:
            print(f"  - {edge.uuid_}: {getattr(edge, 'fact', 'No fact')}")
        
        # Eliminar todos los edges encontrados
        if all_edges:
            print(f"\n🗑️ Eliminando {len(all_edges)} edges...")
            deleted_count = 0
            for edge in all_edges:
                try:
                    client.graph.edge.delete(edge.uuid_)
                    deleted_count += 1
                    print(f"✅ Eliminado: {edge.uuid_}")
                except Exception as e:
                    print(f"❌ Error eliminando {edge.uuid_}: {e}")
            
            print(f"✅ Eliminados {deleted_count} de {len(all_edges)} edges")
        else:
            print("📋 No se encontraron edges para eliminar")
        
        # Verificación final
        print("\n🔍 Verificación final...")
        final_search = client.graph.search(
            group_id="userhandles",
            query="",
            scope="edges",
            limit=10
        )
        
        remaining = len(final_search.edges) if hasattr(final_search, 'edges') and final_search.edges else 0
        
        if remaining == 0:
            print("✅ Grupo userhandles completamente limpio")
        else:
            print(f"⚠️ Aún quedan {remaining} edges:")
            if hasattr(final_search, 'edges'):
                for edge in final_search.edges:
                    print(f"  - {getattr(edge, 'fact', 'No fact')}")
        
        return remaining == 0
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    print("🧹 Limpiando userhandles vía búsqueda...")
    success = clear_userhandles_via_search()
    
    if success:
        print("\n🎯 ¡Listo! Ahora puedes probar:")
        print("curl -X POST http://localhost:8080/api/vizta-chat/test-user-discovery \\")
        print('  -H "Content-Type: application/json" \\')
        print('  -d \'{"message":"busca Mario López"}\'')
        print("\nDebería:")
        print("1. No encontrar en userhandles (memoria vacía)")
        print("2. Resolver con Perplexity")
        print("3. Guardar en userhandles")
        print("4. En próxima búsqueda lo encontrará en memoria")
    else:
        print("\n❌ Limpieza incompleta")