-- ===================================================================
-- ESQUEMA DE BASE DE DATOS PARA SECCIÓN DE PROYECTOS
-- Sistema de investigación con contexto, decisiones y memoria
-- Para uso con Supabase/PostgreSQL
-- ===================================================================

-- 1. TABLA PRINCIPAL DE PROYECTOS
-- Unidad principal que contiene toda la investigación
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- Información básica del proyecto
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'archived')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    
    -- Categorización
    category VARCHAR(100),
    tags TEXT[],
    
    -- Fechas importantes
    start_date DATE,
    target_date DATE,
    completed_date DATE,
    
    -- Metadatos
    visibility VARCHAR(20) DEFAULT 'private' CHECK (visibility IN ('private', 'team', 'public')),
    collaborators UUID[],
    
    -- Timestamps automáticos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TABLA DE CONTEXTO DE PROYECTOS
-- Base o situación general (fuente de datos, objetivo, actores, problema)
CREATE TABLE IF NOT EXISTS public.project_contexts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    
    -- Información del contexto base
    situation_description TEXT NOT NULL,
    data_sources TEXT[],
    objectives TEXT[],
    key_actors JSONB DEFAULT '[]'::jsonb,
    main_problem TEXT,
    
    -- Contexto geográfico y temporal
    geographic_scope VARCHAR(100),
    time_frame VARCHAR(100),
    
    -- Referencias y fuentes
    source_references JSONB DEFAULT '[]'::jsonb,
    external_links TEXT[],
    
    -- Metadatos del contexto
    context_type VARCHAR(50) DEFAULT 'initial' CHECK (context_type IN ('initial', 'updated', 'revision')),
    version INTEGER DEFAULT 1,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABLA DE DECISIONES
-- Capas secuenciales o acumulativas que representan acciones o cambios estratégicos
CREATE TABLE IF NOT EXISTS public.project_decisions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    
    -- Información de la decisión
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    decision_type VARCHAR(50) DEFAULT 'enfoque' CHECK (decision_type IN ('enfoque', 'alcance', 'configuracion')),
    
    -- Secuenciación
    sequence_number INTEGER NOT NULL,
    parent_decision_id UUID REFERENCES public.project_decisions(id) ON DELETE SET NULL,
    
    -- Campos generales para el sistema de capas
    change_description TEXT,
    objective TEXT,
    next_steps TEXT,
    deadline DATE,
    
    -- Campos específicos para ENFOQUE
    focus_area TEXT, -- "¿En qué te quieres enfocar?"
    focus_context TEXT, -- Contexto adicional opcional
    
    -- Campos específicos para ALCANCE
    geographic_scope TEXT, -- Ámbito geográfico
    monetary_scope TEXT, -- Ámbito monetario
    time_period_start DATE, -- Inicio del período temporal
    time_period_end DATE, -- Fin del período temporal
    target_entities TEXT, -- Entidades objetivo
    scope_limitations TEXT, -- Limitaciones del alcance
    
    -- Campos específicos para CONFIGURACIÓN
    output_format TEXT[], -- Formato de salida (selección múltiple)
    methodology TEXT, -- Metodología
    data_sources TEXT, -- Fuentes de datos (para configuración)
    search_locations TEXT, -- Ubicaciones de búsqueda
    tools_required TEXT, -- Herramientas requeridas
    references TEXT[], -- Referencias (array de links con add/remove)
    
    -- Contenido de la decisión (campos existentes mantenidos por compatibilidad)
    rationale TEXT, -- Justificación
    expected_impact TEXT, -- Impacto esperado
    resources_required TEXT, -- Recursos necesarios
    risks_identified TEXT[], -- Riesgos identificados
    
    -- Resultados y seguimiento
    actual_impact TEXT,
    lessons_learned TEXT,
    success_metrics JSONB DEFAULT '{}'::jsonb,
    
    -- Metadatos
    urgency VARCHAR(20) DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
    stakeholders UUID[],
    tags TEXT[],
    
    -- Attachments y referencias
    attachments JSONB DEFAULT '[]'::jsonb,
    decision_references JSONB DEFAULT '[]'::jsonb,
    implementation_date DATE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraint para evitar decisiones duplicadas en la misma secuencia
    UNIQUE(project_id, sequence_number)
);

-- 4. TABLA DE MEMORIA DEL PROYECTO
-- Registra la evolución (desde el contexto base hasta la última decisión aplicada)
CREATE TABLE IF NOT EXISTS public.project_memory (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    
    -- Información del registro de memoria
    memory_type VARCHAR(50) NOT NULL CHECK (memory_type IN ('milestone', 'insight', 'change', 'lesson', 'breakthrough', 'setback')),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    
    -- Contexto temporal
    date_recorded DATE DEFAULT CURRENT_DATE,
    phase VARCHAR(100), -- En qué fase del proyecto ocurrió
    
    -- Relaciones con otros elementos
    related_decision_id UUID REFERENCES public.project_decisions(id) ON DELETE SET NULL,
    related_context_id UUID REFERENCES public.project_contexts(id) ON DELETE SET NULL,
    
    -- Contenido estructurado
    key_findings TEXT[],
    impact_assessment TEXT,
    future_implications TEXT,
    action_items TEXT[],
    
    -- Metadatos
    importance_level VARCHAR(20) DEFAULT 'medium' CHECK (importance_level IN ('low', 'medium', 'high', 'critical')),
    tags TEXT[],
    
    -- Attachments y evidencia
    evidence JSONB DEFAULT '[]'::jsonb,
    attachments JSONB DEFAULT '[]'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. TABLA DE COLABORADORES DE PROYECTO
-- Para manejar equipos y permisos
CREATE TABLE IF NOT EXISTS public.project_collaborators (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- Información del colaborador
    role VARCHAR(50) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'editor', 'viewer', 'analyst')),
    permissions JSONB DEFAULT '{"read": true, "write": false, "delete": false, "manage": false}'::jsonb,
    
    -- Fechas
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Estado
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
    
    -- Constraint para evitar duplicados
    UNIQUE(project_id, user_id)
);

-- ===================================================================
-- ÍNDICES PARA OPTIMIZACIÓN DE CONSULTAS
-- ===================================================================

-- Índices para projects
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_category ON public.projects(category);
CREATE INDEX IF NOT EXISTS idx_projects_priority ON public.projects(priority);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON public.projects(created_at);
CREATE INDEX IF NOT EXISTS idx_projects_tags ON public.projects USING GIN(tags);

-- Índices para project_contexts  
CREATE INDEX IF NOT EXISTS idx_project_contexts_project_id ON public.project_contexts(project_id);
CREATE INDEX IF NOT EXISTS idx_project_contexts_type ON public.project_contexts(context_type);
CREATE INDEX IF NOT EXISTS idx_project_contexts_version ON public.project_contexts(version);

-- Índices para project_decisions
CREATE INDEX IF NOT EXISTS idx_project_decisions_project_id ON public.project_decisions(project_id);
CREATE INDEX IF NOT EXISTS idx_project_decisions_sequence ON public.project_decisions(sequence_number);
CREATE INDEX IF NOT EXISTS idx_project_decisions_parent ON public.project_decisions(parent_decision_id);
CREATE INDEX IF NOT EXISTS idx_project_decisions_status ON public.project_decisions(status);
CREATE INDEX IF NOT EXISTS idx_project_decisions_type ON public.project_decisions(decision_type);
CREATE INDEX IF NOT EXISTS idx_project_decisions_tags ON public.project_decisions USING GIN(tags);

-- Índices para project_memory
CREATE INDEX IF NOT EXISTS idx_project_memory_project_id ON public.project_memory(project_id);
CREATE INDEX IF NOT EXISTS idx_project_memory_type ON public.project_memory(memory_type);
CREATE INDEX IF NOT EXISTS idx_project_memory_date ON public.project_memory(date_recorded);
CREATE INDEX IF NOT EXISTS idx_project_memory_decision ON public.project_memory(related_decision_id);
CREATE INDEX IF NOT EXISTS idx_project_memory_context ON public.project_memory(related_context_id);
CREATE INDEX IF NOT EXISTS idx_project_memory_tags ON public.project_memory USING GIN(tags);

-- Índices para project_collaborators
CREATE INDEX IF NOT EXISTS idx_project_collaborators_project_id ON public.project_collaborators(project_id);
CREATE INDEX IF NOT EXISTS idx_project_collaborators_user_id ON public.project_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_project_collaborators_role ON public.project_collaborators(role);

-- ===================================================================
-- FUNCIONES Y TRIGGERS
-- ===================================================================

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para actualizar updated_at automáticamente
CREATE TRIGGER update_projects_updated_at 
BEFORE UPDATE ON public.projects 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_contexts_updated_at 
BEFORE UPDATE ON public.project_contexts 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_decisions_updated_at 
BEFORE UPDATE ON public.project_decisions 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_memory_updated_at 
BEFORE UPDATE ON public.project_memory 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Función para obtener la secuencia siguiente para decisiones
CREATE OR REPLACE FUNCTION get_next_decision_sequence(project_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
    next_seq INTEGER;
BEGIN
    SELECT COALESCE(MAX(sequence_number), 0) + 1 
    INTO next_seq 
    FROM public.project_decisions 
    WHERE project_id = project_uuid;
    
    RETURN next_seq;
END;
$$ LANGUAGE plpgsql;

-- Función para agregar entrada automática en memoria cuando se crea una decisión
CREATE OR REPLACE FUNCTION add_decision_to_memory()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.project_memory (
        project_id,
        memory_type,
        title,
        description,
        related_decision_id,
        importance_level
    ) VALUES (
        NEW.project_id,
        'milestone',
        'Decisión creada: ' || NEW.title,
        'Se ha creado una nueva decisión: ' || NEW.description,
        NEW.id,
        CASE 
            WHEN NEW.urgency = 'critical' THEN 'critical'
            WHEN NEW.urgency = 'high' THEN 'high'
            ELSE 'medium'
        END
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para agregar decisiones automáticamente a la memoria
CREATE TRIGGER add_decision_to_memory_trigger
AFTER INSERT ON public.project_decisions
FOR EACH ROW EXECUTE FUNCTION add_decision_to_memory();

-- ===================================================================
-- POLÍTICAS RLS (ROW LEVEL SECURITY)
-- ===================================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_collaborators ENABLE ROW LEVEL SECURITY;

-- Políticas para projects
CREATE POLICY "Users can view own projects" ON public.projects
    FOR SELECT USING (
        auth.uid() = user_id OR 
        auth.uid() = ANY(collaborators) OR
        visibility = 'public'
    );

CREATE POLICY "Users can insert own projects" ON public.projects
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects" ON public.projects
    FOR UPDATE USING (
        auth.uid() = user_id OR 
        EXISTS (
            SELECT 1 FROM public.project_collaborators 
            WHERE project_id = projects.id 
            AND user_id = auth.uid() 
            AND role IN ('owner', 'admin', 'editor')
        )
    );

CREATE POLICY "Users can delete own projects" ON public.projects
    FOR DELETE USING (auth.uid() = user_id);

-- Políticas para project_contexts
CREATE POLICY "Users can view project contexts" ON public.project_contexts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.projects 
            WHERE id = project_contexts.project_id 
            AND (user_id = auth.uid() OR auth.uid() = ANY(collaborators) OR visibility = 'public')
        )
    );

CREATE POLICY "Users can manage project contexts" ON public.project_contexts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.projects 
            WHERE id = project_contexts.project_id 
            AND (
                user_id = auth.uid() OR 
                EXISTS (
                    SELECT 1 FROM public.project_collaborators 
                    WHERE project_id = projects.id 
                    AND user_id = auth.uid() 
                    AND role IN ('owner', 'admin', 'editor')
                )
            )
        )
    );

-- Políticas para project_decisions
CREATE POLICY "Users can view project decisions" ON public.project_decisions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.projects 
            WHERE id = project_decisions.project_id 
            AND (user_id = auth.uid() OR auth.uid() = ANY(collaborators) OR visibility = 'public')
        )
    );

CREATE POLICY "Users can manage project decisions" ON public.project_decisions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.projects 
            WHERE id = project_decisions.project_id 
            AND (
                user_id = auth.uid() OR 
                EXISTS (
                    SELECT 1 FROM public.project_collaborators 
                    WHERE project_id = projects.id 
                    AND user_id = auth.uid() 
                    AND role IN ('owner', 'admin', 'editor')
                )
            )
        )
    );

-- Políticas para project_memory
CREATE POLICY "Users can view project memory" ON public.project_memory
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.projects 
            WHERE id = project_memory.project_id 
            AND (user_id = auth.uid() OR auth.uid() = ANY(collaborators) OR visibility = 'public')
        )
    );

CREATE POLICY "Users can manage project memory" ON public.project_memory
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.projects 
            WHERE id = project_memory.project_id 
            AND (
                user_id = auth.uid() OR 
                EXISTS (
                    SELECT 1 FROM public.project_collaborators 
                    WHERE project_id = projects.id 
                    AND user_id = auth.uid() 
                    AND role IN ('owner', 'admin', 'editor')
                )
            )
        )
    );

-- Políticas para project_collaborators
CREATE POLICY "Users can view project collaborators" ON public.project_collaborators
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.projects 
            WHERE id = project_collaborators.project_id 
            AND (user_id = auth.uid() OR auth.uid() = ANY(collaborators))
        )
    );

CREATE POLICY "Project owners can manage collaborators" ON public.project_collaborators
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.projects 
            WHERE id = project_collaborators.project_id 
            AND (
                user_id = auth.uid() OR 
                EXISTS (
                    SELECT 1 FROM public.project_collaborators pc 
                    WHERE pc.project_id = projects.id 
                    AND pc.user_id = auth.uid() 
                    AND pc.role IN ('owner', 'admin')
                )
            )
        )
    );

-- ===================================================================
-- COMENTARIOS DE DOCUMENTACIÓN
-- ===================================================================

COMMENT ON TABLE public.projects IS 'Tabla principal de proyectos de investigación';
COMMENT ON TABLE public.project_contexts IS 'Contexto base de cada proyecto (fuentes, objetivos, actores, problemas)';
COMMENT ON TABLE public.project_decisions IS 'Decisiones secuenciales del proyecto (estratégicas, tácticas, operacionales)';
COMMENT ON TABLE public.project_memory IS 'Memoria evolutiva del proyecto (hitos, insights, lecciones aprendidas)';
COMMENT ON TABLE public.project_collaborators IS 'Colaboradores y permisos de cada proyecto';

-- Comentarios específicos para campos importantes
COMMENT ON COLUMN public.projects.collaborators IS 'Array de UUIDs de usuarios colaboradores';
COMMENT ON COLUMN public.project_contexts.key_actors IS 'JSONB con información de actores clave: [{"name": "Actor", "role": "Rol", "influence": "high/medium/low"}]';
COMMENT ON COLUMN public.project_contexts.source_references IS 'JSONB con referencias: [{"type": "url/document/article", "title": "Título", "url": "URL", "date": "fecha"}]';
COMMENT ON COLUMN public.project_decisions.success_metrics IS 'JSONB con métricas de éxito: {"metric_name": {"target": value, "actual": value, "unit": "unit"}}';
COMMENT ON COLUMN public.project_memory.evidence IS 'JSONB con evidencia: [{"type": "document/image/url", "description": "desc", "source": "fuente"}]';

-- ===================================================================
-- VERIFICACIÓN FINAL
-- ===================================================================

-- Verificar que todas las tablas se crearon correctamente  
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('projects', 'project_contexts', 'project_decisions', 'project_memory', 'project_collaborators');
    
    IF table_count = 5 THEN
        RAISE NOTICE '✅ Esquema de proyectos creado exitosamente: % tablas creadas', table_count;
    ELSE
        RAISE EXCEPTION '❌ Error: Solo se crearon % de 5 tablas esperadas', table_count;
    END IF;
END $$;

-- Mostrar estructura de tablas para verificación
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name IN ('projects', 'project_contexts', 'project_decisions', 'project_memory', 'project_collaborators')
ORDER BY table_name, ordinal_position; 