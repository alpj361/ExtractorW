-- ===================================================================
-- ACTUALIZACIONES INCREMENTALES PARA CODEX_ITEMS
-- Este script crea la tabla si no existe y añade las columnas necesarias
-- ===================================================================

-- Verificar si la tabla existe, si no, crearla
CREATE TABLE IF NOT EXISTS public.codex_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    tipo TEXT,
    titulo TEXT,
    descripcion TEXT,
    etiquetas TEXT[],
    proyecto TEXT,
    storage_path TEXT,
    url TEXT,
    nombre_archivo TEXT,
    tamano BIGINT,
    fecha DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Añadir columnas para Google Drive integration (usando snake_case)
ALTER TABLE public.codex_items 
ADD COLUMN IF NOT EXISTS is_drive BOOLEAN DEFAULT FALSE;

ALTER TABLE public.codex_items 
ADD COLUMN IF NOT EXISTS drive_file_id TEXT;

-- Crear índices básicos si no existen
CREATE INDEX IF NOT EXISTS idx_codex_items_user_id ON public.codex_items(user_id);
CREATE INDEX IF NOT EXISTS idx_codex_items_tipo ON public.codex_items(tipo);
CREATE INDEX IF NOT EXISTS idx_codex_items_created_at ON public.codex_items(created_at);

-- Crear índices para Google Drive (si no existen)
CREATE INDEX IF NOT EXISTS idx_codex_items_is_drive ON public.codex_items(is_drive);
CREATE INDEX IF NOT EXISTS idx_codex_items_drive_file_id ON public.codex_items(drive_file_id);

-- ===================================================================
-- ACTUALIZACIÓN PARA INTEGRACIÓN CON PROYECTOS
-- Agregar referencia directa a proyectos via UUID
-- ===================================================================

-- Añadir columna project_id para referenciar directamente a la tabla projects
ALTER TABLE public.codex_items 
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

-- Crear índice para project_id
CREATE INDEX IF NOT EXISTS idx_codex_items_project_id ON public.codex_items(project_id);

-- Enable RLS
ALTER TABLE public.codex_items ENABLE ROW LEVEL SECURITY;

-- Crear políticas RLS con verificaciones condicionales
DO $$
BEGIN
    -- Política para SELECT
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'codex_items' 
        AND policyname = 'Users can view own codex items'
    ) THEN
        CREATE POLICY "Users can view own codex items" ON public.codex_items
            FOR SELECT USING (auth.uid() = user_id);
    END IF;

    -- Política para INSERT
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'codex_items' 
        AND policyname = 'Users can insert own codex items'
    ) THEN
        CREATE POLICY "Users can insert own codex items" ON public.codex_items
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    -- Política para UPDATE
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'codex_items' 
        AND policyname = 'Users can update own codex items'
    ) THEN
        CREATE POLICY "Users can update own codex items" ON public.codex_items
            FOR UPDATE USING (auth.uid() = user_id);
    END IF;

    -- Política para DELETE
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'codex_items' 
        AND policyname = 'Users can delete own codex items'
    ) THEN
        CREATE POLICY "Users can delete own codex items" ON public.codex_items
            FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

-- Verificar que todo se creó correctamente con información de debug
DO $$
DECLARE
    table_exists BOOLEAN;
    is_drive_exists BOOLEAN;
    drive_file_id_exists BOOLEAN;
BEGIN
    -- Verificar que la tabla existe
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'codex_items' AND table_schema = 'public'
    ) INTO table_exists;
    
    IF NOT table_exists THEN
        RAISE EXCEPTION 'Error: La tabla codex_items no existe';
    END IF;
    
    RAISE NOTICE 'Tabla codex_items existe: %', table_exists;
    
    -- Verificar que las columnas existen
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'codex_items' AND column_name = 'is_drive' AND table_schema = 'public'
    ) INTO is_drive_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'codex_items' AND column_name = 'drive_file_id' AND table_schema = 'public'
    ) INTO drive_file_id_exists;
    
    RAISE NOTICE 'Columna is_drive existe: %', is_drive_exists;
    RAISE NOTICE 'Columna drive_file_id existe: %', drive_file_id_exists;
    
    IF NOT is_drive_exists THEN
        RAISE EXCEPTION 'Error: La columna is_drive no existe';
    END IF;
    
    IF NOT drive_file_id_exists THEN
        RAISE EXCEPTION 'Error: La columna drive_file_id no existe';
    END IF;
    
    RAISE NOTICE 'Actualización exitosa: tabla codex_items configurada correctamente con columnas is_drive y drive_file_id';
END $$; 