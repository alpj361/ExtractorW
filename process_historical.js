/**
 * Script para reprocesar datos históricos de Supabase
 * Este script busca registros con raw_data que no tengan 10 keywords
 * y los reprocesa para asegurar que cumplen con el nuevo estándar.
 */

require('dotenv').config(); // Cargar variables de entorno desde .env
const { createClient } = require('@supabase/supabase-js');

// Supabase config
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Error: SUPABASE_URL y SUPABASE_ANON_KEY deben estar configurados en las variables de entorno.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Función para obtener color aleatorio
function getRandomColor() {
  const colors = [
    '#3B82F6', '#0EA5E9', '#14B8A6', '#10B981', '#F97316', 
    '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B', '#84CC16'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Función para mapear un valor de un rango a otro
function mapRange(value, inMin, inMax, outMin, outMax) {
  return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}

// Función para procesar localmente los datos crudos
function processRawData(rawData) {
  try {
    console.log('Iniciando procesamiento de datos históricos con estructura:', typeof rawData);
    
    // Determinar la estructura de los datos de entrada
    let trendsArray = [];
    
    if (!rawData) {
      console.log('rawData es nulo o indefinido');
      return null;
    } else if (rawData.trends && Array.isArray(rawData.trends)) {
      console.log(`Formato esperado: rawData.trends contiene ${rawData.trends.length} elementos`);
      trendsArray = rawData.trends;
    } else if (Array.isArray(rawData)) {
      console.log(`rawData es un array con ${rawData.length} elementos`);
      trendsArray = rawData.map(item => {
        // Intentar extraer nombre y volumen según diferentes formatos
        return {
          name: item.name || item.keyword || item.text || item.value || 'Desconocido',
          volume: item.volume || item.count || item.value || 1,
          category: item.category || 'General'
        };
      });
    } else if (typeof rawData === 'object') {
      console.log('rawData es un objeto, buscando elementos de tendencia');
      // Intentar extraer un array de alguna propiedad del objeto
      const possibleArrayProps = ['trends', 'data', 'items', 'results', 'keywords', 'topics'];
      
      for (const prop of possibleArrayProps) {
        if (rawData[prop] && Array.isArray(rawData[prop]) && rawData[prop].length > 0) {
          console.log(`Encontrado array en rawData.${prop} con ${rawData[prop].length} elementos`);
          trendsArray = rawData[prop];
          break;
        }
      }
      
      // Si todavía no tenemos un array y hay propiedades en el objeto, convertirlas en tendencias
      if (trendsArray.length === 0) {
        console.log('No se encontró un array, intentando usar propiedades del objeto como tendencias');
        trendsArray = Object.entries(rawData)
          .filter(([key, value]) => typeof value !== 'object' && key !== 'timestamp')
          .map(([key, value]) => ({
            name: key,
            volume: typeof value === 'number' ? value : 1,
            category: 'General'
          }));
      }
    }
    
    // Si no tenemos datos, retornar null
    if (trendsArray.length === 0) {
      console.log('No se pudieron extraer tendencias del registro');
      return null;
    }
    
    console.log(`Procesando ${trendsArray.length} tendencias históricas`);
    
    // Ordenar tendencias por volumen o métrica relevante
    const sortedTrends = [...trendsArray].sort((a, b) => {
      const volumeA = a.volume || a.count || 1;
      const volumeB = b.volume || b.count || 1;
      return volumeB - volumeA;
    });
    
    // Tomar los primeros 10
    const top10 = sortedTrends.slice(0, 10);
    
    // Si hay menos de 10, repetir los primeros
    while (top10.length < 10) {
      top10.push(top10[top10.length % Math.max(1, top10.length)]);
    }
    
    // Calcular valores para escalar
    const volumes = top10.map(t => t.volume || t.count || 1);
    const minVol = Math.min(...volumes);
    const maxVol = Math.max(...volumes);
    
    // Crear estructura para topKeywords
    const topKeywords = top10.map(trend => ({
      keyword: trend.name || trend.keyword || 'Unknown',
      count: trend.volume || trend.count || 1
    }));
    
    // Crear estructura para wordCloudData
    const wordCloudData = top10.map(trend => ({
      text: trend.name || trend.keyword || 'Unknown',
      value: mapRange(
        trend.volume || trend.count || 1, 
        minVol === maxVol ? 0 : minVol, 
        maxVol, 
        20, 
        100
      ),
      color: getRandomColor()
    }));
    
    // Extraer o generar categorías
    const categories = {};
    top10.forEach(trend => {
      const category = trend.category || 'Otros';
      if (categories[category]) {
        categories[category]++;
      } else {
        categories[category] = 1;
      }
    });
    
    const categoryData = Object.entries(categories).map(([category, count]) => ({
      category,
      count
    })).sort((a, b) => b.count - a.count);
    
    console.log('Procesamiento de datos históricos completado exitosamente');
    
    return {
      topKeywords,
      wordCloudData,
      categoryData
    };
  } catch (error) {
    console.error('Error procesando datos históricos:', error);
    return null;
  }
}

async function main() {
  console.log('Iniciando reprocesamiento de datos históricos...');
  
  // Buscar registros con raw_data que tengan menos de 10 keywords
  const { data, error } = await supabase
    .from('trends')
    .select('*')
    .not('raw_data', 'is', null)
    .order('timestamp', { ascending: false });
  
  if (error) {
    console.error('Error al consultar Supabase:', error);
    process.exit(1);
  }
  
  console.log(`Se encontraron ${data.length} registros con raw_data.`);
  
  let updatedCount = 0;
  
  // Procesar cada registro
  for (const record of data) {
    // Verificar si necesita actualización (menos de 10 keywords)
    if (!record.top_keywords || record.top_keywords.length !== 10) {
      console.log(`Procesando registro ${record.id} (${record.timestamp}) - tiene ${record.top_keywords?.length || 0} keywords`);
      
      // Reprocesar los datos crudos
      const processed = processRawData(record.raw_data);
      
      if (processed) {
        // Actualizar el registro
        const { error: updateError } = await supabase
          .from('trends')
          .update({
            top_keywords: processed.topKeywords,
            word_cloud_data: processed.wordCloudData,
            category_data: processed.categoryData
          })
          .eq('id', record.id);
        
        if (updateError) {
          console.error(`Error al actualizar el registro ${record.id}:`, updateError);
        } else {
          updatedCount++;
          console.log(`Registro ${record.id} actualizado correctamente.`);
        }
      } else {
        console.error(`No se pudo procesar el registro ${record.id}.`);
      }
    }
  }
  
  console.log(`Proceso completado. Se actualizaron ${updatedCount} registros.`);
}

// Ejecutar el script
main().catch(error => {
  console.error('Error en la ejecución del script:', error);
  process.exit(1);
}); 