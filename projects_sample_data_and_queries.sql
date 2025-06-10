-- ===================================================================
-- DATOS DE MUESTRA Y CONSULTAS ÚTILES PARA SISTEMA DE PROYECTOS
-- Ejemplos de inserción y consultas comunes
-- ===================================================================

-- ===================================================================
-- EJEMPLOS DE INSERCIÓN DE DATOS
-- ===================================================================

-- 1. CREAR UN PROYECTO DE EJEMPLO
INSERT INTO public.projects (
    user_id,
    title,
    description,
    status,
    priority,
    category,
    tags,
    start_date,
    target_date,
    visibility
) VALUES (
    auth.uid(), -- El usuario actual
    'Investigación sobre Crisis Política en Guatemala',
    'Análisis profundo de los factores que llevaron a la crisis política actual, incluyendo actores clave, decisiones gubernamentales y impacto social.',
    'active',
    'high',
    'Política',
    ARRAY['crisis', 'política', 'guatemala', 'gobierno', 'análisis'],
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '3 months',
    'private'
);

-- 2. OBTENER EL PROJECT_ID RECIÉN CREADO (para usar en los siguientes ejemplos)
-- En una aplicación real, obtendrías esto desde la respuesta del INSERT
-- Para este ejemplo, usaremos una variable

-- 3. CREAR CONTEXTO PARA EL PROYECTO
INSERT INTO public.project_contexts (
    project_id,
    situation_description,
    data_sources,
    objectives,
    key_actors,
    main_problem,
    geographic_scope,
    time_frame,
    source_references,
    external_links
) VALUES (
    (SELECT id FROM public.projects WHERE title = 'Investigación sobre Crisis Política en Guatemala' LIMIT 1),
    'Guatemala enfrenta una crisis política sin precedentes con enfrentamientos entre poderes del Estado, protestas ciudadanas y tensiones internacionales.',
    ARRAY[
        'Reportes de medios locales',
        'Comunicados oficiales del gobierno',
        'Análisis de organizaciones internacionales',
        'Redes sociales y opinión pública',
        'Entrevistas con expertos'
    ],
    ARRAY[
        'Identificar los factores clave de la crisis',
        'Mapear actores influyentes y sus posiciones',
        'Analizar impacto en la economía y sociedad',
        'Evaluar posibles escenarios futuros',
        'Documentar cronología de eventos'
    ],
    '[
        {"name": "Bernardo Arévalo", "role": "Presidente electo", "influence": "high", "position": "gobierno"},
        {"name": "Alejandro Giammattei", "role": "Presidente saliente", "influence": "medium", "position": "gobierno"},
        {"name": "Consuelo Porras", "role": "Fiscal General", "influence": "high", "position": "ministerio_publico"},
        {"name": "Semilla", "role": "Partido político", "influence": "high", "position": "oposicion"},
        {"name": "CICIG", "role": "Organismo internacional", "influence": "medium", "position": "internacional"}
    ]'::jsonb,
    'Erosión del estado de derecho y crisis de gobernabilidad que amenaza la estabilidad democrática del país.',
    'Guatemala',
    '2023-2024',
    '[
        {"type": "article", "title": "Crisis en Guatemala: Un análisis", "url": "https://ejemplo.com/analisis", "date": "2024-01-15"},
        {"type": "document", "title": "Informe CIDH sobre Guatemala", "url": "https://cidh.org/guatemala", "date": "2024-01-10"}
    ]'::jsonb,
    ARRAY[
        'https://www.prensalibre.com',
        'https://www.bbc.com/mundo/topics/guatemala',
        'https://www.oas.org/es/cidh/'
    ]
);

-- 4. CREAR DECISIONES DE EJEMPLO
INSERT INTO public.project_decisions (
    project_id,
    title,
    description,
    decision_type,
    sequence_number,
    rationale,
    expected_impact,
    resources_required,
    risks_identified,
    status,
    urgency,
    tags,
    success_metrics
) VALUES 
-- Primera decisión
(
    (SELECT id FROM public.projects WHERE title = 'Investigación sobre Crisis Política en Guatemala' LIMIT 1),
    'Establecer línea de tiempo detallada de eventos',
    'Crear una cronología exhaustiva de todos los eventos relevantes desde enero 2023 hasta la actualidad.',
    'research',
    1,
    'Es fundamental tener una línea de tiempo clara para entender la secuencia de eventos y sus interrelaciones.',
    'Mejor comprensión de la evolución de la crisis y identificación de puntos de inflexión clave.',
    'Investigador dedicado, acceso a fuentes primarias, herramientas de análisis temporal.',
    ARRAY['Información sesgada de fuentes', 'Eventos no documentados', 'Cronología compleja'],
    'implemented',
    'high',
    ARRAY['cronología', 'investigación', 'análisis temporal'],
    '{"completitud": {"target": 90, "actual": 85, "unit": "porcentaje"}, "precision_fechas": {"target": 95, "actual": 92, "unit": "porcentaje"}}'::jsonb
),
-- Segunda decisión
(
    (SELECT id FROM public.projects WHERE title = 'Investigación sobre Crisis Política en Guatemala' LIMIT 1),
    'Mapear red de influencia de actores clave',
    'Desarrollar un mapa detallado de las relaciones, alianzas y conflictos entre los principales actores políticos.',
    'analytical',
    2,
    'Las relaciones entre actores son complejas y determinan muchas de las dinámicas de la crisis.',
    'Identificación de actores más influyentes y predicción de posibles alianzas futuras.',
    'Analista político, herramientas de mapeo de redes, acceso a información sobre relaciones.',
    ARRAY['Información confidencial limitada', 'Relaciones cambiantes', 'Sesgo en fuentes'],
    'approved',
    'medium',
    ARRAY['actores', 'redes', 'influencia', 'mapeo'],
    '{"actores_mapeados": {"target": 50, "actual": 0, "unit": "número"}, "relaciones_identificadas": {"target": 100, "actual": 0, "unit": "número"}}'::jsonb
);

-- 5. AGREGAR ENTRADAS MANUALES A LA MEMORIA (además de las automáticas del trigger)
INSERT INTO public.project_memory (
    project_id,
    memory_type,
    title,
    description,
    date_recorded,
    key_findings,
    impact_assessment,
    importance_level,
    evidence,
    tags
) VALUES (
    (SELECT id FROM public.projects WHERE title = 'Investigación sobre Crisis Política en Guatemala' LIMIT 1),
    'insight',
    'Patrón de escalamiento en crisis anteriores',
    'Al analizar crisis políticas anteriores en Guatemala (2015, 2019), se identifica un patrón similar de escalamiento que podría aplicarse a la situación actual.',
    CURRENT_DATE - INTERVAL '5 days',
    ARRAY[
        'Las crisis siguen un patrón: tensión inicial, evento catalizador, movilización ciudadana, presión internacional',
        'El papel de la comunidad internacional es crucial en la resolución',
        'Los medios de comunicación amplifican o mitigan la crisis dependiendo de su posición'
    ],
    'Este insight permite anticipar posibles escenarios y preparar análisis más profundos sobre los próximos pasos.',
    'high',
    '[
        {"type": "document", "description": "Análisis comparativo crisis 2015 vs 2023", "source": "Investigación propia"},
        {"type": "url", "description": "Reportes internacionales sobre patrones", "source": "Freedom House"}
    ]'::jsonb,
    ARRAY['patrones', 'crisis anteriores', 'comparativo', 'escalamiento']
);

-- ===================================================================
-- CONSULTAS ÚTILES PARA EL SISTEMA
-- ===================================================================

-- 1. OBTENER TODOS LOS PROYECTOS DE UN USUARIO CON SU CONTEXTO
SELECT 
    p.id,
    p.title,
    p.description,
    p.status,
    p.priority,
    p.category,
    p.created_at,
    pc.situation_description,
    pc.main_problem,
    array_length(pc.objectives, 1) as objectives_count
FROM public.projects p
LEFT JOIN public.project_contexts pc ON p.id = pc.project_id
WHERE p.user_id = auth.uid()
ORDER BY p.created_at DESC;

-- 2. OBTENER DECISIONES DE UN PROYECTO EN ORDEN SECUENCIAL
SELECT 
    pd.sequence_number,
    pd.title,
    pd.description,
    pd.decision_type,
    pd.status,
    pd.urgency,
    pd.created_at,
    pd.implementation_date,
    pd.success_metrics
FROM public.project_decisions pd
WHERE pd.project_id = 'PROJECT_UUID_AQUI'
ORDER BY pd.sequence_number;

-- 3. OBTENER LA MEMORIA COMPLETA DE UN PROYECTO
SELECT 
    pm.memory_type,
    pm.title,
    pm.description,
    pm.date_recorded,
    pm.importance_level,
    pm.key_findings,
    pd.title as related_decision,
    pc.situation_description as related_context
FROM public.project_memory pm
LEFT JOIN public.project_decisions pd ON pm.related_decision_id = pd.id
LEFT JOIN public.project_contexts pc ON pm.related_context_id = pc.id
WHERE pm.project_id = 'PROJECT_UUID_AQUI'
ORDER BY pm.date_recorded DESC;

-- 4. DASHBOARD: RESUMEN DE PROYECTOS POR USUARIO
SELECT 
    COUNT(*) as total_projects,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_projects,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_projects,
    COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority_projects,
    COUNT(CASE WHEN priority = 'urgent' THEN 1 END) as urgent_projects
FROM public.projects 
WHERE user_id = auth.uid();

-- 5. OBTENER PROYECTOS CON MÁS DECISIONES (MÁS ACTIVOS)
SELECT 
    p.id,
    p.title,
    p.status,
    COUNT(pd.id) as decisions_count,
    MAX(pd.created_at) as last_decision_date
FROM public.projects p
LEFT JOIN public.project_decisions pd ON p.id = pd.project_id
WHERE p.user_id = auth.uid()
GROUP BY p.id, p.title, p.status
ORDER BY decisions_count DESC, last_decision_date DESC;

-- 6. BÚSQUEDA DE PROYECTOS POR TAGS O CATEGORÍA
SELECT 
    p.id,
    p.title,
    p.category,
    p.tags,
    p.status,
    p.priority
FROM public.projects p
WHERE p.user_id = auth.uid()
AND (
    p.category ILIKE '%política%' 
    OR p.tags && ARRAY['política', 'crisis', 'gobierno']
    OR p.title ILIKE '%crisis%'
)
ORDER BY p.updated_at DESC;

-- 7. OBTENER DECISIONES PENDIENTES DE IMPLEMENTACIÓN
SELECT 
    p.title as project_title,
    pd.title as decision_title,
    pd.description,
    pd.urgency,
    pd.expected_impact,
    pd.created_at,
    CASE 
        WHEN pd.urgency = 'critical' THEN 1
        WHEN pd.urgency = 'high' THEN 7
        WHEN pd.urgency = 'medium' THEN 14
        ELSE 30
    END as suggested_deadline_days
FROM public.project_decisions pd
JOIN public.projects p ON pd.project_id = p.id
WHERE p.user_id = auth.uid()
AND pd.status IN ('pending', 'approved')
ORDER BY 
    CASE pd.urgency 
        WHEN 'critical' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        ELSE 4 
    END,
    pd.created_at;

-- 8. ANÁLISIS DE PROGRESO: DECISIONES IMPLEMENTADAS VS PENDIENTES POR PROYECTO
SELECT 
    p.id,
    p.title,
    COUNT(pd.id) as total_decisions,
    COUNT(CASE WHEN pd.status = 'implemented' THEN 1 END) as implemented_decisions,
    COUNT(CASE WHEN pd.status IN ('pending', 'approved') THEN 1 END) as pending_decisions,
    ROUND(
        COUNT(CASE WHEN pd.status = 'implemented' THEN 1 END) * 100.0 / 
        NULLIF(COUNT(pd.id), 0), 
        2
    ) as implementation_percentage
FROM public.projects p
LEFT JOIN public.project_decisions pd ON p.id = pd.project_id
WHERE p.user_id = auth.uid()
GROUP BY p.id, p.title
ORDER BY implementation_percentage DESC;

-- 9. OBTENER INSIGHTS Y LECCIONES APRENDIDAS RECIENTES
SELECT 
    p.title as project_title,
    pm.title,
    pm.description,
    pm.key_findings,
    pm.date_recorded,
    pm.importance_level
FROM public.project_memory pm
JOIN public.projects p ON pm.project_id = p.id
WHERE p.user_id = auth.uid()
AND pm.memory_type IN ('insight', 'lesson', 'breakthrough')
AND pm.date_recorded >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY pm.date_recorded DESC, pm.importance_level DESC;

-- 10. FUNCIÓN PARA OBTENER EL SIGUIENTE NÚMERO DE SECUENCIA (PARA USO EN APLICACIÓN)
-- Ejemplo de uso:
-- SELECT get_next_decision_sequence('project-uuid-here');

-- ===================================================================
-- FUNCIONES UTILITARIAS ADICIONALES
-- ===================================================================

-- Función para obtener estadísticas de un proyecto
CREATE OR REPLACE FUNCTION get_project_stats(project_uuid UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_decisions', COUNT(pd.id),
        'implemented_decisions', COUNT(CASE WHEN pd.status = 'implemented' THEN 1 END),
        'pending_decisions', COUNT(CASE WHEN pd.status IN ('pending', 'approved') THEN 1 END),
        'memory_entries', (SELECT COUNT(*) FROM public.project_memory WHERE project_id = project_uuid),
        'latest_activity', GREATEST(
            COALESCE(MAX(pd.updated_at), '1970-01-01'::timestamp),
            COALESCE((SELECT MAX(updated_at) FROM public.project_memory WHERE project_id = project_uuid), '1970-01-01'::timestamp)
        ),
        'context_updates', (SELECT COUNT(*) FROM public.project_contexts WHERE project_id = project_uuid)
    ) INTO result
    FROM public.project_decisions pd
    WHERE pd.project_id = project_uuid;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Función para marcar un proyecto como completado y agregar entrada en memoria
CREATE OR REPLACE FUNCTION complete_project(project_uuid UUID, completion_notes TEXT DEFAULT '')
RETURNS BOOLEAN AS $$
BEGIN
    -- Actualizar estado del proyecto
    UPDATE public.projects 
    SET 
        status = 'completed',
        completed_date = CURRENT_DATE,
        updated_at = NOW()
    WHERE id = project_uuid AND user_id = auth.uid();
    
    -- Agregar entrada en memoria
    INSERT INTO public.project_memory (
        project_id,
        memory_type,
        title,
        description,
        importance_level
    ) VALUES (
        project_uuid,
        'milestone',
        'Proyecto completado',
        COALESCE(completion_notes, 'Proyecto marcado como completado'),
        'high'
    );
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ===================================================================
-- CONSULTAS PARA REPORTES Y ANÁLISIS
-- ===================================================================

-- Reporte mensual de actividad
SELECT 
    DATE_TRUNC('month', p.created_at) as month,
    COUNT(p.id) as projects_created,
    COUNT(CASE WHEN p.status = 'completed' THEN 1 END) as projects_completed,
    AVG(
        CASE WHEN p.status = 'completed' 
        THEN EXTRACT(days FROM p.completed_date - p.start_date)
        END
    ) as avg_completion_days
FROM public.projects p
WHERE p.user_id = auth.uid()
AND p.created_at >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', p.created_at)
ORDER BY month DESC;

-- Análisis de tipos de decisiones más comunes
SELECT 
    pd.decision_type,
    COUNT(*) as total_decisions,
    COUNT(CASE WHEN pd.status = 'implemented' THEN 1 END) as implemented,
    ROUND(AVG(
        CASE WHEN pd.status = 'implemented' 
        THEN EXTRACT(days FROM pd.implementation_date - pd.created_at)
        END
    ), 2) as avg_implementation_days
FROM public.project_decisions pd
JOIN public.projects p ON pd.project_id = p.id
WHERE p.user_id = auth.uid()
GROUP BY pd.decision_type
ORDER BY total_decisions DESC; 