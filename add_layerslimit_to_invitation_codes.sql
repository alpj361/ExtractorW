-- Migración: Agregar campo layerslimit a invitation_codes
-- Este campo permite definir límites personalizados de capas en códigos de invitación

-- Agregar columna layerslimit si no existe
ALTER TABLE public.invitation_codes 
ADD COLUMN IF NOT EXISTS layerslimit INTEGER DEFAULT 3;

-- Crear índice para performance
CREATE INDEX IF NOT EXISTS idx_invitation_codes_layerslimit ON public.invitation_codes(layerslimit);

-- Actualizar códigos existentes con límites diferenciados según tipo de usuario
UPDATE public.invitation_codes 
SET layerslimit = CASE 
    WHEN user_type = 'Alpha' THEN 5     -- Alpha: 5 capas por tipo
    WHEN user_type = 'Beta' THEN 3      -- Beta: 3 capas por tipo (default)
    WHEN user_type = 'Creador' THEN 10  -- Creador: 10 capas por tipo
    WHEN user_type = 'Premium' THEN 20  -- Premium: 20 capas por tipo
    ELSE 3                              -- Default: 3 capas por tipo
END
WHERE layerslimit IS NULL;

-- Actualizar función mark_invitation_code_used para incluir layerslimit
CREATE OR REPLACE FUNCTION mark_invitation_code_used(
    invitation_code TEXT,
    user_id UUID
) RETURNS JSON AS $$
DECLARE
    code_record RECORD;
    result JSON;
BEGIN
    -- Buscar el código y verificar que esté disponible
    SELECT * INTO code_record 
    FROM public.invitation_codes 
    WHERE code = invitation_code 
    AND used = FALSE 
    AND (expires_at IS NULL OR expires_at > NOW())
    AND current_uses < max_uses;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Código no válido o ya usado');
    END IF;
    
    -- Marcar como usado
    UPDATE public.invitation_codes 
    SET 
        current_uses = current_uses + 1,
        used = CASE WHEN current_uses + 1 >= max_uses THEN TRUE ELSE FALSE END,
        used_by = CASE WHEN used_by IS NULL THEN user_id ELSE used_by END,
        used_at = CASE WHEN used_at IS NULL THEN NOW() ELSE used_at END
    WHERE code = invitation_code;
    
    -- Retornar datos del código para aplicar al perfil (incluyendo layerslimit)
    result := json_build_object(
        'success', true,
        'user_type', COALESCE(code_record.user_type, 'Beta'),
        'credits', COALESCE(code_record.credits, 100),
        'layerslimit', COALESCE(code_record.layerslimit, 3),
        'description', code_record.description
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Insertar códigos de ejemplo con límites diferenciados
INSERT INTO public.invitation_codes (code, description, created_by, user_type, credits, layerslimit, max_uses) VALUES 
('PREMIUM-2024', 'Código premium con límites altos', (SELECT id FROM auth.users LIMIT 1), 'Premium', 1000, 20, 5),
('CREATOR-EARLY', 'Acceso temprano para creadores', (SELECT id FROM auth.users LIMIT 1), 'Creador', 500, 10, 10),
('BETA-TRIAL', 'Prueba beta estándar', (SELECT id FROM auth.users LIMIT 1), 'Beta', 100, 3, 50),
('ALPHA-TEST', 'Acceso alpha ampliado', (SELECT id FROM auth.users LIMIT 1), 'Alpha', 250, 5, 20)
ON CONFLICT (code) DO UPDATE SET 
    user_type = EXCLUDED.user_type,
    credits = EXCLUDED.credits,
    layerslimit = EXCLUDED.layerslimit,
    max_uses = EXCLUDED.max_uses;

-- Verificar que la migración fue exitosa
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'invitation_codes' AND column_name = 'layerslimit') THEN
        RAISE NOTICE 'Migración exitosa: campo layerslimit agregado a invitation_codes';
        RAISE NOTICE 'Códigos actualizados con límites diferenciados por tipo de usuario';
        RAISE NOTICE 'Función mark_invitation_code_used actualizada para incluir layerslimit';
    ELSE
        RAISE EXCEPTION 'Error: No se pudo agregar la columna layerslimit';
    END IF;
END $$; 