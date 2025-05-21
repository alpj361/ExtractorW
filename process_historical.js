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
    // Verificar si tenemos datos válidos
    if (!rawData || !rawData.trends || !Array.isArray(rawData.trends)) {
      throw new Error('Formato de datos inválido');
    }

    // Ordenar por volumen o métrica relevante
    const sortedTrends = [...rawData.trends].sort((a, b) => (b.volume || 0) - (a.volume || 0));
    const top10 = sortedTrends.slice(0, 10);
    
    // Si hay menos de 10, repetir los primeros
    while (top10.length < 10) {
      top10.push(top10[top10.length % Math.max(1, top10.length)]);
    }
    
    // Calcular valores para escalar
    const volumes = top10.map(t => t.volume || 1);
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
      value: mapRange(trend.volume || trend.count || 1, minVol, maxVol, 20, 100),
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
    
    return {
      topKeywords,
      wordCloudData,
      categoryData
    };
  } catch (error) {
    console.error('Error procesando datos:', error);
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