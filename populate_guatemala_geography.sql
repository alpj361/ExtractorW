-- ===================================================================
-- POBLACIÓN DE DATOS GEOGRÁFICOS: GUATEMALA
-- Incluye departamentos, municipios principales y sistema de aliases
-- ===================================================================

BEGIN;

-- ===================================================================
-- 1. DEPARTAMENTOS DE GUATEMALA CON ALIASES Y APODOS
-- ===================================================================

-- Guatemala (Ciudad/Departamento)
INSERT INTO public.geographic_locations (
    location_id, country_code, hierarchy_level, level_code,
    name, local_name, official_name, full_path, path_ids,
    parent_location_id, coordinates, detection_source, confidence_score,
    aliases, alternative_names
) VALUES (
    'GTM-DEPT-GUATEMALA',
    'GTM', 2, 'DEPARTMENT',
    'Guatemala', 'Guatemala', 'Departamento de Guatemala',
    'Guatemala > Guatemala', 'GTM > GTM-DEPT-GUATEMALA',
    'GTM',
    '{"lat": 14.6349, "lng": -90.5069, "center": true}',
    'manual', 1.0,
    '{"common_names": ["Guatemala", "Capital"], "local_slang": ["La Capital"], "formal_variants": ["Departamento de Guatemala"], "abbreviations": ["GT"]}',
    ARRAY['Capital', 'La Capital', 'Departamento de Guatemala']
) ON CONFLICT (location_id) DO NOTHING;

-- Quetzaltenango 
INSERT INTO public.geographic_locations (
    location_id, country_code, hierarchy_level, level_code,
    name, local_name, official_name, full_path, path_ids,
    parent_location_id, coordinates, detection_source, confidence_score,
    aliases, alternative_names
) VALUES (
    'GTM-DEPT-QUETZALTENANGO',
    'GTM', 2, 'DEPARTMENT',
    'Quetzaltenango', 'Quetzaltenango', 'Departamento de Quetzaltenango',
    'Guatemala > Quetzaltenango', 'GTM > GTM-DEPT-QUETZALTENANGO',
    'GTM',
    '{"lat": 14.8333, "lng": -91.5167}',
    'manual', 1.0,
    '{"common_names": ["Xela"], "local_slang": ["Xela", "La Ciudad de los Altos"], "k_iche_name": "Xela", "formal_variants": ["Departamento de Quetzaltenango"], "abbreviations": ["QUETZ"]}',
    ARRAY['Xela', 'La Ciudad de los Altos', 'Departamento de Quetzaltenango']
) ON CONFLICT (location_id) DO NOTHING;

-- Petén
INSERT INTO public.geographic_locations (
    location_id, country_code, hierarchy_level, level_code,
    name, local_name, official_name, full_path, path_ids,
    parent_location_id, coordinates, detection_source, confidence_score,
    aliases, alternative_names
) VALUES (
    'GTM-DEPT-PETEN',
    'GTM', 2, 'DEPARTMENT',
    'Petén', 'Petén', 'Departamento de Petén',
    'Guatemala > Petén', 'GTM > GTM-DEPT-PETEN',
    'GTM',
    '{"lat": 16.9167, "lng": -89.9167}',
    'manual', 1.0,
    '{"common_names": ["Peten"], "local_slang": ["El Norte", "La Selva"], "formal_variants": ["Departamento de Petén"], "abbreviations": ["PET"], "cultural_notes": ["Región selvática", "Tierras mayas"]}',
    ARRAY['El Norte', 'La Selva', 'Departamento de Petén', 'Peten']
) ON CONFLICT (location_id) DO NOTHING;

-- Sacatepéquez
INSERT INTO public.geographic_locations (
    location_id, country_code, hierarchy_level, level_code,
    name, local_name, official_name, full_path, path_ids,
    parent_location_id, coordinates, detection_source, confidence_score,
    aliases, alternative_names
) VALUES (
    'GTM-DEPT-SACATEPEQUEZ',
    'GTM', 2, 'DEPARTMENT',
    'Sacatepéquez', 'Sacatepéquez', 'Departamento de Sacatepéquez',
    'Guatemala > Sacatepéquez', 'GTM > GTM-DEPT-SACATEPEQUEZ',
    'GTM',
    '{"lat": 14.5597, "lng": -90.7328}',
    'manual', 1.0,
    '{"common_names": ["Sacatepequez"], "local_slang": ["Antigua"], "formal_variants": ["Departamento de Sacatepéquez"], "abbreviations": ["SACA"], "cultural_notes": ["Ciudad colonial"]}',
    ARRAY['Antigua', 'Departamento de Sacatepéquez', 'Sacatepequez']
) ON CONFLICT (location_id) DO NOTHING;

-- Alta Verapaz
INSERT INTO public.geographic_locations (
    location_id, country_code, hierarchy_level, level_code,
    name, local_name, official_name, full_path, path_ids,
    parent_location_id, coordinates, detection_source, confidence_score,
    aliases, alternative_names
) VALUES (
    'GTM-DEPT-ALTAVERAPAZ',
    'GTM', 2, 'DEPARTMENT',
    'Alta Verapaz', 'Alta Verapaz', 'Departamento de Alta Verapaz',
    'Guatemala > Alta Verapaz', 'GTM > GTM-DEPT-ALTAVERAPAZ',
    'GTM',
    '{"lat": 15.4667, "lng": -90.3667}',
    'manual', 1.0,
    '{"common_names": ["Alta Verapaz"], "local_slang": ["Las Verapaces", "Cobán"], "qeqchi_name": ["Tezulutlán"], "formal_variants": ["Departamento de Alta Verapaz"], "abbreviations": ["AV"], "cultural_notes": ["Región Qeqchí", "Tierra de paz"]}',
    ARRAY['Las Verapaces', 'Departamento de Alta Verapaz', 'Tezulutlán']
) ON CONFLICT (location_id) DO NOTHING;

-- Izabal
INSERT INTO public.geographic_locations (
    location_id, country_code, hierarchy_level, level_code,
    name, local_name, official_name, full_path, path_ids,
    parent_location_id, coordinates, detection_source, confidence_score,
    aliases, alternative_names
) VALUES (
    'GTM-DEPT-IZABAL',
    'GTM', 2, 'DEPARTMENT',
    'Izabal', 'Izabal', 'Departamento de Izabal',
    'Guatemala > Izabal', 'GTM > GTM-DEPT-IZABAL',
    'GTM',
    '{"lat": 15.7333, "lng": -88.5833}',
    'manual', 1.0,
    '{"common_names": ["Izabal"], "local_slang": ["El Caribe", "La Costa"], "garifuna_presence": true, "formal_variants": ["Departamento de Izabal"], "abbreviations": ["IZ"], "cultural_notes": ["Costa caribeña", "Cultura garífuna"]}',
    ARRAY['El Caribe', 'La Costa', 'Departamento de Izabal']
) ON CONFLICT (location_id) DO NOTHING;

-- ===================================================================
-- 2. CIUDADES PRINCIPALES CON ALIASES Y APODOS
-- ===================================================================

-- Ciudad de Guatemala
INSERT INTO public.geographic_locations (
    location_id, country_code, hierarchy_level, level_code,
    name, local_name, official_name, full_path, path_ids,
    parent_location_id, coordinates, detection_source, confidence_score,
    aliases, alternative_names
) VALUES (
    'GTM-CITY-GUATEMALA',
    'GTM', 3, 'MUNICIPALITY',
    'Guatemala', 'Ciudad de Guatemala', 'Guatemala',
    'Guatemala > Guatemala > Guatemala', 'GTM > GTM-DEPT-GUATEMALA > GTM-CITY-GUATEMALA',
    'GTM-DEPT-GUATEMALA',
    '{"lat": 14.6349, "lng": -90.5069}',
    'manual', 1.0,
    '{"common_names": ["Ciudad", "Guatemala"], "local_slang": ["La Ciudad", "Guate", "La Capital"], "formal_variants": ["Ciudad de Guatemala", "Nueva Guatemala de la Asunción"], "abbreviations": ["GT", "GUA"], "zones": ["Zona 1", "Zona 4", "Zona 9", "Zona 10", "Zona 14", "Zona 15"]}',
    ARRAY['Ciudad', 'La Ciudad', 'Guate', 'Capital', 'Ciudad de Guatemala', 'Nueva Guatemala de la Asunción']
) ON CONFLICT (location_id) DO NOTHING;

-- Quetzaltenango (Xela)
INSERT INTO public.geographic_locations (
    location_id, country_code, hierarchy_level, level_code,
    name, local_name, official_name, full_path, path_ids,
    parent_location_id, coordinates, detection_source, confidence_score,
    aliases, alternative_names
) VALUES (
    'GTM-CITY-QUETZALTENANGO',
    'GTM', 3, 'MUNICIPALITY',
    'Quetzaltenango', 'Xela', 'Quetzaltenango',
    'Guatemala > Quetzaltenango > Quetzaltenango', 'GTM > GTM-DEPT-QUETZALTENANGO > GTM-CITY-QUETZALTENANGO',
    'GTM-DEPT-QUETZALTENANGO',
    '{"lat": 14.8333, "lng": -91.5167}',
    'manual', 1.0,
    '{"common_names": ["Xela"], "local_slang": ["Xela", "La Ciudad de los Altos"], "k_iche_name": "Xela", "formal_variants": ["Quetzaltenango", "Muy Noble y Leal Ciudad de Quetzaltenango"], "abbreviations": ["QUETZ"], "cultural_notes": ["Segunda ciudad de Guatemala", "Capital de occidente"]}',
    ARRAY['Xela', 'La Ciudad de los Altos', 'Segunda ciudad', 'Capital de occidente']
) ON CONFLICT (location_id) DO NOTHING;

-- Antigua Guatemala
INSERT INTO public.geographic_locations (
    location_id, country_code, hierarchy_level, level_code,
    name, local_name, official_name, full_path, path_ids,
    parent_location_id, coordinates, detection_source, confidence_score,
    aliases, alternative_names
) VALUES (
    'GTM-CITY-ANTIGUA',
    'GTM', 3, 'MUNICIPALITY',
    'Antigua Guatemala', 'Antigua', 'Antigua Guatemala',
    'Guatemala > Sacatepéquez > Antigua Guatemala', 'GTM > GTM-DEPT-SACATEPEQUEZ > GTM-CITY-ANTIGUA',
    'GTM-DEPT-SACATEPEQUEZ',
    '{"lat": 14.5597, "lng": -90.7328}',
    'manual', 1.0,
    '{"common_names": ["Antigua"], "local_slang": ["Antigua", "La Colonial"], "formal_variants": ["Antigua Guatemala", "Santiago de Guatemala"], "abbreviations": ["ANT"], "cultural_notes": ["Ciudad colonial", "Patrimonio de la humanidad", "Ex capital"]}',
    ARRAY['Antigua', 'La Colonial', 'Santiago de Guatemala', 'Ex capital']
) ON CONFLICT (location_id) DO NOTHING;

-- Cobán
INSERT INTO public.geographic_locations (
    location_id, country_code, hierarchy_level, level_code,
    name, local_name, official_name, full_path, path_ids,
    parent_location_id, coordinates, detection_source, confidence_score,
    aliases, alternative_names
) VALUES (
    'GTM-CITY-COBAN',
    'GTM', 3, 'MUNICIPALITY',
    'Cobán', 'Cobán', 'Cobán',
    'Guatemala > Alta Verapaz > Cobán', 'GTM > GTM-DEPT-ALTAVERAPAZ > GTM-CITY-COBAN',
    'GTM-DEPT-ALTAVERAPAZ',
    '{"lat": 15.4667, "lng": -90.3667}',
    'manual', 1.0,
    '{"common_names": ["Coban"], "local_slang": ["La Imperial", "Cobán Imperial"], "qeqchi_name": ["Kob'an"], "formal_variants": ["Cobán", "Santa Cruz de Cobán"], "abbreviations": ["COB"], "cultural_notes": ["Ciudad imperial", "Capital qeqchí", "Ciudad de las orquídeas"]}',
    ARRAY['La Imperial', 'Cobán Imperial', 'Coban', 'Ciudad imperial', 'Capital qeqchí']
) ON CONFLICT (location_id) DO NOTHING;

-- Puerto Barrios
INSERT INTO public.geographic_locations (
    location_id, country_code, hierarchy_level, level_code,
    name, local_name, official_name, full_path, path_ids,
    parent_location_id, coordinates, detection_source, confidence_score,
    aliases, alternative_names
) VALUES (
    'GTM-CITY-PUERTOBARRIOS',
    'GTM', 3, 'MUNICIPALITY',
    'Puerto Barrios', 'Puerto Barrios', 'Puerto Barrios',
    'Guatemala > Izabal > Puerto Barrios', 'GTM > GTM-DEPT-IZABAL > GTM-CITY-PUERTOBARRIOS',
    'GTM-DEPT-IZABAL',
    '{"lat": 15.7167, "lng": -88.6000}',
    'manual', 1.0,
    '{"common_names": ["Puerto Barrios"], "local_slang": ["El Puerto", "Barrios"], "formal_variants": ["Puerto Barrios", "Puerto Santo Tomás de Castilla"], "abbreviations": ["PB"], "cultural_notes": ["Puerto principal", "Costa atlántica", "Entrada al Caribe"]}',
    ARRAY['El Puerto', 'Barrios', 'Puerto principal', 'Costa atlántica']
) ON CONFLICT (location_id) DO NOTHING;

-- Flores (Petén)
INSERT INTO public.geographic_locations (
    location_id, country_code, hierarchy_level, level_code,
    name, local_name, official_name, full_path, path_ids,
    parent_location_id, coordinates, detection_source, confidence_score,
    aliases, alternative_names
) VALUES (
    'GTM-CITY-FLORES',
    'GTM', 3, 'MUNICIPALITY',
    'Flores', 'Flores', 'Flores',
    'Guatemala > Petén > Flores', 'GTM > GTM-DEPT-PETEN > GTM-CITY-FLORES',
    'GTM-DEPT-PETEN',
    '{"lat": 16.9167, "lng": -89.9167}',
    'manual', 1.0,
    '{"common_names": ["Flores"], "local_slang": ["Flores", "Capital del Petén"], "maya_name": ["Tayasal"], "formal_variants": ["Nuestra Señora de los Remedios y San Pablo de Flores"], "abbreviations": ["FLO"], "cultural_notes": ["Capital del Petén", "Isla en el lago", "Puerta a Tikal"]}',
    ARRAY['Capital del Petén', 'Isla del lago', 'Puerta a Tikal', 'Tayasal']
) ON CONFLICT (location_id) DO NOTHING;

-- ===================================================================
-- 3. ALGUNOS DEPARTAMENTOS ADICIONALES
-- ===================================================================

-- San Marcos
INSERT INTO public.geographic_locations (
    location_id, country_code, hierarchy_level, level_code,
    name, local_name, official_name, full_path, path_ids,
    parent_location_id, coordinates, detection_source, confidence_score,
    aliases, alternative_names
) VALUES (
    'GTM-DEPT-SANMARCOS',
    'GTM', 2, 'DEPARTMENT',
    'San Marcos', 'San Marcos', 'Departamento de San Marcos',
    'Guatemala > San Marcos', 'GTM > GTM-DEPT-SANMARCOS',
    'GTM',
    '{"lat": 14.9667, "lng": -91.8000}',
    'manual', 1.0,
    '{"common_names": ["San Marcos"], "local_slang": ["La Frontera"], "formal_variants": ["Departamento de San Marcos"], "abbreviations": ["SM"], "cultural_notes": ["Frontera con México", "Volcán Tajumulco"]}',
    ARRAY['La Frontera', 'Departamento de San Marcos']
) ON CONFLICT (location_id) DO NOTHING;

-- Huehuetenango
INSERT INTO public.geographic_locations (
    location_id, country_code, hierarchy_level, level_code,
    name, local_name, official_name, full_path, path_ids,
    parent_location_id, coordinates, detection_source, confidence_score,
    aliases, alternative_names
) VALUES (
    'GTM-DEPT-HUEHUETENANGO',
    'GTM', 2, 'DEPARTMENT',
    'Huehuetenango', 'Huehuetenango', 'Departamento de Huehuetenango',
    'Guatemala > Huehuetenango', 'GTM > GTM-DEPT-HUEHUETENANGO',
    'GTM',
    '{"lat": 15.3167, "lng": -91.4667}',
    'manual', 1.0,
    '{"common_names": ["Huehuetenango", "Huehue"], "local_slang": ["Huehue", "Los Cuchumatanes"], "mam_name": ["Xinabajul"], "formal_variants": ["Departamento de Huehuetenango"], "abbreviations": ["HUE"], "cultural_notes": ["Sierra de los Cuchumatanes", "Tierra mam"]}',
    ARRAY['Huehue', 'Los Cuchumatanes', 'Departamento de Huehuetenango', 'Xinabajul']
) ON CONFLICT (location_id) DO NOTHING;

-- Escuintla
INSERT INTO public.geographic_locations (
    location_id, country_code, hierarchy_level, level_code,
    name, local_name, official_name, full_path, path_ids,
    parent_location_id, coordinates, detection_source, confidence_score,
    aliases, alternative_names
) VALUES (
    'GTM-DEPT-ESCUINTLA',
    'GTM', 2, 'DEPARTMENT',
    'Escuintla', 'Escuintla', 'Departamento de Escuintla',
    'Guatemala > Escuintla', 'GTM > GTM-DEPT-ESCUINTLA',
    'GTM',
    '{"lat": 14.3000, "lng": -90.7833}',
    'manual', 1.0,
    '{"common_names": ["Escuintla"], "local_slang": ["Costa Sur", "El Pacífico"], "formal_variants": ["Departamento de Escuintla"], "abbreviations": ["ESC"], "cultural_notes": ["Costa del Pacífico", "Zona cañera", "Puerto San José"]}',
    ARRAY['Costa Sur', 'El Pacífico', 'Departamento de Escuintla']
) ON CONFLICT (location_id) DO NOTHING;

-- ===================================================================
-- 4. ZONAS IMPORTANTES DE CIUDAD DE GUATEMALA
-- ===================================================================

-- Zona 1 (Centro Histórico)
INSERT INTO public.geographic_locations (
    location_id, country_code, hierarchy_level, level_code,
    name, local_name, official_name, full_path, path_ids,
    parent_location_id, coordinates, detection_source, confidence_score,
    aliases, alternative_names
) VALUES (
    'GTM-ZONE-ZONA1',
    'GTM', 4, 'ZONE',
    'Zona 1', 'Centro Histórico', 'Zona 1',
    'Guatemala > Guatemala > Guatemala > Zona 1', 'GTM > GTM-DEPT-GUATEMALA > GTM-CITY-GUATEMALA > GTM-ZONE-ZONA1',
    'GTM-CITY-GUATEMALA',
    '{"lat": 14.6417, "lng": -90.5133}',
    'manual', 1.0,
    '{"common_names": ["Zona 1", "Centro"], "local_slang": ["El Centro", "Centro Histórico"], "formal_variants": ["Zona 1 Centro Histórico"], "abbreviations": ["Z1"], "cultural_notes": ["Palacio Nacional", "Catedral", "Plaza Central"]}',
    ARRAY['Centro', 'El Centro', 'Centro Histórico', 'Z1']
) ON CONFLICT (location_id) DO NOTHING;

-- Zona 10 (Zona Viva)
INSERT INTO public.geographic_locations (
    location_id, country_code, hierarchy_level, level_code,
    name, local_name, official_name, full_path, path_ids,
    parent_location_id, coordinates, detection_source, confidence_score,
    aliases, alternative_names
) VALUES (
    'GTM-ZONE-ZONA10',
    'GTM', 4, 'ZONE',
    'Zona 10', 'Zona Viva', 'Zona 10',
    'Guatemala > Guatemala > Guatemala > Zona 10', 'GTM > GTM-DEPT-GUATEMALA > GTM-CITY-GUATEMALA > GTM-ZONE-ZONA10',
    'GTM-CITY-GUATEMALA',
    '{"lat": 14.5994, "lng": -90.5069}',
    'manual', 1.0,
    '{"common_names": ["Zona 10", "Zona Viva"], "local_slang": ["La Zona Viva", "Z10"], "formal_variants": ["Zona 10 Zona Viva"], "abbreviations": ["Z10"], "cultural_notes": ["Zona Rosa", "Restaurantes", "Vida nocturna", "Centro comercial"]}',
    ARRAY['Zona Viva', 'La Zona Viva', 'Z10', 'Zona Rosa']
) ON CONFLICT (location_id) DO NOTHING;

-- ===================================================================
-- 5. ACTUALIZAR CONTADORES
-- ===================================================================

-- Función para actualizar contadores de ubicaciones padre
CREATE OR REPLACE FUNCTION update_parent_location_stats() RETURNS VOID AS $$
DECLARE
    location_record RECORD;
BEGIN
    -- Actualizar contadores para todas las ubicaciones
    FOR location_record IN 
        SELECT location_id FROM geographic_locations 
        WHERE hierarchy_level > 1
        ORDER BY hierarchy_level DESC
    LOOP
        UPDATE geographic_locations 
        SET projects_count = (
            SELECT COUNT(DISTINCT project_id) 
            FROM project_geographic_coverage 
            WHERE location_id = location_record.location_id
        )
        WHERE location_id = location_record.location_id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Ejecutar actualización de contadores
SELECT update_parent_location_stats();

COMMIT;

-- ===================================================================
-- 6. VERIFICACIÓN DE DATOS POBLADOS
-- ===================================================================

DO $$
DECLARE
    dept_count INTEGER;
    city_count INTEGER;
    zone_count INTEGER;
    total_locations INTEGER;
BEGIN
    -- Contar por tipo
    SELECT COUNT(*) INTO dept_count FROM geographic_locations WHERE level_code = 'DEPARTMENT';
    SELECT COUNT(*) INTO city_count FROM geographic_locations WHERE level_code = 'MUNICIPALITY'; 
    SELECT COUNT(*) INTO zone_count FROM geographic_locations WHERE level_code = 'ZONE';
    SELECT COUNT(*) INTO total_locations FROM geographic_locations;
    
    RAISE NOTICE '✅ DATOS DE GUATEMALA POBLADOS EXITOSAMENTE:';
    RAISE NOTICE '   🏛️  % departamentos', dept_count;
    RAISE NOTICE '   🏙️  % municipios principales', city_count;
    RAISE NOTICE '   📍 % zonas específicas', zone_count;
    RAISE NOTICE '   📊 % ubicaciones totales', total_locations;
    RAISE NOTICE '   🏷️  Sistema de aliases configurado';
    RAISE NOTICE '   🔍 Listo para búsqueda inteligente por apodos';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 EJEMPLOS DE ALIASES CONFIGURADOS:';
    RAISE NOTICE '   "Xela" → Quetzaltenango';
    RAISE NOTICE '   "La Ciudad" → Ciudad de Guatemala'; 
    RAISE NOTICE '   "Antigua" → Antigua Guatemala';
    RAISE NOTICE '   "El Puerto" → Puerto Barrios';
    RAISE NOTICE '   "La Imperial" → Cobán';
    RAISE NOTICE '   "Zona Viva" → Zona 10';
END $$; 