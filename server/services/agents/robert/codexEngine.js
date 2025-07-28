/**
 * Codex Engine - Manejo del Codex y Documentos del Usuario
 * Accede y gestiona documentos, notas y referencias personales
 */

const supabaseClient = require('../../../utils/supabase');

class CodexEngine {
  constructor(robertAgent) {
    this.robert = robertAgent;
    this.supabase = supabaseClient;
  }

  /**
   * Obtener codex del usuario
   */
  async getUserCodex(user, options = {}) {
    try {
      const { 
        limit = 10, 
        type = null,
        category = null,
        sortBy = 'created_at',
        sortOrder = 'desc',
        includeContent = true
      } = options;

      let selectFields = `
        id,
        titulo,
        tipo,
        tags,
        source_url,
        source_type,
        created_at,
        updated_at,
        metadata,
        resumen
      `;

      if (includeContent) {
        selectFields += `, contenido`;
      }

      let query = this.supabase
        .from('codex_items')
        .select(selectFields)
        .eq('user_id', user.id);

      // Filtros opcionales
      if (type) {
        query = query.eq('tipo', type);
      }

      // Nota: columna 'categoria' no existe en la tabla actual
      // if (category) {
      //   query = query.eq('categoria', category);
      // }

      // Ordenar y limitar
      query = query.order(sortBy, { ascending: sortOrder === 'asc' }).limit(limit);

      const { data: codexItems, error } = await query;

      if (error) throw error;

      console.log(`[ROBERT/CODEX] 📚 Obtenidos ${codexItems.length} elementos del codex para usuario ${user.id}`);

      return {
        codex: codexItems || [],
        total: codexItems.length,
        hasMore: codexItems.length === limit,
        metadata: {
          filter: { type, category },
          sort: { sortBy, sortOrder },
          includeContent,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error(`[ROBERT/CODEX] ❌ Error obteniendo codex:`, error);
      throw new Error(`Error accediendo al codex: ${error.message}`);
    }
  }

  /**
   * Buscar en el codex del usuario
   */
  async searchCodex(user, searchQuery, options = {}) {
    try {
      const { 
        limit = 10,
        searchFields = ['titulo', 'contenido', 'resumen', 'tags'],
        type = null,
        category = null
      } = options;

      // Obtener todos los elementos del codex para buscar
      const allCodex = await this.getUserCodex(user, { 
        limit: 1000, 
        type, 
        category,
        includeContent: true 
      });

      // Realizar búsqueda en el contenido
      const searchLower = searchQuery.toLowerCase();
      const searchResults = allCodex.codex.filter(item => {
        return searchFields.some(field => {
          const fieldValue = item[field];
          if (Array.isArray(fieldValue)) {
            return fieldValue.some(val => val.toLowerCase().includes(searchLower));
          }
          return fieldValue && fieldValue.toLowerCase().includes(searchLower);
        });
      });

      // Ordenar por relevancia (número de coincidencias)
      const rankedResults = searchResults.map(item => {
        let score = 0;
        searchFields.forEach(field => {
          const fieldValue = item[field];
          if (Array.isArray(fieldValue)) {
            fieldValue.forEach(val => {
              if (val.toLowerCase().includes(searchLower)) score++;
            });
          } else if (fieldValue && fieldValue.toLowerCase().includes(searchLower)) {
            score++;
          }
        });
        return { ...item, relevanceScore: score };
      }).sort((a, b) => b.relevanceScore - a.relevanceScore);

      console.log(`[ROBERT/CODEX] 🔍 Búsqueda "${searchQuery}" encontró ${rankedResults.length} resultados`);

      return {
        results: rankedResults.slice(0, limit),
        totalResults: rankedResults.length,
        query: searchQuery,
        searchFields: searchFields,
        metadata: {
          filter: { type, category },
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error(`[ROBERT/CODEX] ❌ Error buscando en codex:`, error);
      throw new Error(`Error buscando en codex: ${error.message}`);
    }
  }

  /**
   * Obtener elementos recientes del codex
   */
  async getRecentCodex(user, options = {}) {
    const { limit = 5 } = options;
    
    return this.getUserCodex(user, { 
      limit,
      sortBy: 'created_at',
      sortOrder: 'desc',
      includeContent: false
    });
  }

  /**
   * Buscar elementos relevantes del codex basado en una consulta
   */
  async searchRelevantCodex(user, query) {
    try {
      // Extraer palabras clave de la consulta
      const keywords = this.extractKeywords(query.toLowerCase());
      
      if (keywords.length === 0) {
        // Si no hay palabras clave, devolver elementos recientes
        return this.getRecentCodex(user, { limit: 3 });
      }

      // Buscar usando las palabras clave
      const searchPromises = keywords.map(keyword => 
        this.searchCodex(user, keyword, { limit: 5 })
      );

      const searchResults = await Promise.all(searchPromises);
      
      // Combinar y deduplicar resultados
      const allResults = [];
      const seenIds = new Set();
      
      searchResults.forEach(result => {
        result.results.forEach(item => {
          if (!seenIds.has(item.id)) {
            seenIds.add(item.id);
            allResults.push(item);
          }
        });
      });

      // Ordenar por relevancia combinada
      allResults.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

      console.log(`[ROBERT/CODEX] 🎯 ${allResults.length} elementos del codex relevantes para: "${query}"`);

      return {
        codex: allResults.slice(0, 3), // Top 3 más relevantes
        totalRelevant: allResults.length,
        keywords: keywords,
        query: query,
        reasoning: `Encontré documentos relacionados con: ${keywords.join(', ')}`
      };

    } catch (error) {
      console.error(`[ROBERT/CODEX] ❌ Error obteniendo codex relevante:`, error);
      throw new Error(`Error buscando codex relevante: ${error.message}`);
    }
  }

  /**
   * Obtener contexto completo del codex para otros agentes
   */
  async getAllCodexContext(user) {
    try {
      const [recent, categories, types] = await Promise.all([
        this.getRecentCodex(user, { limit: 5 }),
        this.getCodexCategories(user),
        this.getCodexTypes(user)
      ]);

      return {
        recentCodex: recent.codex,
        categories: categories,
        types: types,
        summary: {
          totalRecent: recent.total,
          categoriesCount: categories.length,
          typesCount: types.length
        },
        context: 'full_codex_context'
      };

    } catch (error) {
      console.error(`[ROBERT/CODEX] ❌ Error obteniendo contexto del codex:`, error);
      return { error: error.message };
    }
  }

  /**
   * Obtener categorías únicas del codex del usuario
   */
  async getCodexCategories(user) {
    try {
      const { data: categories, error } = await this.supabase
        .from('codex_items')
        .select('tipo')
        .eq('user_id', user.id)
        .not('tipo', 'is', null);

      if (error) throw error;

      const uniqueCategories = [...new Set(categories.map(item => item.tipo))];
      return uniqueCategories.filter(cat => cat && cat.trim().length > 0);

    } catch (error) {
      console.error(`[ROBERT/CODEX] ❌ Error obteniendo categorías:`, error);
      return [];
    }
  }

  /**
   * Obtener tipos únicos del codex del usuario
   */
  async getCodexTypes(user) {
    try {
      const { data: types, error } = await this.supabase
        .from('codex_items')
        .select('tipo')
        .eq('user_id', user.id)
        .not('tipo', 'is', null);

      if (error) throw error;

      const uniqueTypes = [...new Set(types.map(item => item.tipo))];
      return uniqueTypes.filter(type => type && type.trim().length > 0);

    } catch (error) {
      console.error(`[ROBERT/CODEX] ❌ Error obteniendo tipos:`, error);
      return [];
    }
  }

  /**
   * Crear nuevo elemento en el codex
   */
  async createCodexEntry(user, entryData) {
    try {
      const newEntry = {
        ...entryData,
        user_id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: entry, error } = await this.supabase
        .from('codex_items')
        .insert([newEntry])
        .select()
        .single();

      if (error) throw error;

      console.log(`[ROBERT/CODEX] ✅ Entrada del codex creada: ${entry.titulo}`);

      return {
        success: true,
        entry: entry,
        message: `Entrada "${entry.titulo}" añadida al codex`
      };

    } catch (error) {
      console.error(`[ROBERT/CODEX] ❌ Error creando entrada del codex:`, error);
      throw new Error(`Error creando entrada del codex: ${error.message}`);
    }
  }

  /**
   * Actualizar elemento del codex
   */
  async updateCodexEntry(user, entryId, updates) {
    try {
      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      };

      const { data: entry, error } = await this.supabase
        .from('codex_items')
        .update(updateData)
        .eq('id', entryId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      console.log(`[ROBERT/CODEX] 🔄 Entrada del codex actualizada: ${entry.titulo}`);

      return {
        success: true,
        entry: entry,
        message: `Entrada "${entry.titulo}" actualizada`
      };

    } catch (error) {
      console.error(`[ROBERT/CODEX] ❌ Error actualizando entrada del codex:`, error);
      throw new Error(`Error actualizando entrada del codex: ${error.message}`);
    }
  }

  /**
   * Extraer palabras clave de una consulta
   */
  extractKeywords(query) {
    // Palabras comunes a ignorar
    const stopWords = ['el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'es', 'se', 'no', 'te', 'lo', 'le', 'da', 'su', 'por', 'son', 'con', 'para', 'como', 'está', 'tú', 'me', 'él', 'del', 'al', 'sobre', 'este', 'esta', 'más', 'pero', 'sus', 'ha', 'mi', 'muy'];
    
    return query
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.includes(word))
      .map(word => word.replace(/[^\w]/g, ''))
      .filter(word => word.length > 0);
  }

  /**
   * Obtener estadísticas del codex
   */
  async getCodexStats(user) {
    try {
      const { data: stats, error } = await this.supabase
        .from('codex_items')
        .select('tipo, created_at')
        .eq('user_id', user.id);

      if (error) throw error;

      const codexStats = {
        total: stats.length,
        byType: {},
        byCategory: {},
        recentActivity: 0
      };

      // Contar por tipo y categoría
      stats.forEach(entry => {
        if (entry.tipo) {
          codexStats.byType[entry.tipo] = (codexStats.byType[entry.tipo] || 0) + 1;
        }
        // Nota: columna 'categoria' removida - usando 'tipo' como categoría
        // if (entry.categoria) {
        //   codexStats.byCategory[entry.categoria] = (codexStats.byCategory[entry.categoria] || 0) + 1;
        // }
      });

      // Actividad reciente (últimos 30 días)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      codexStats.recentActivity = stats.filter(e => new Date(e.created_at) > thirtyDaysAgo).length;

      return codexStats;

    } catch (error) {
      console.error(`[ROBERT/CODEX] ❌ Error obteniendo estadísticas del codex:`, error);
      return { error: error.message };
    }
  }
}

module.exports = {
  CodexEngine
}; 