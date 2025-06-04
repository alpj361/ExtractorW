-- Tabla para códigos de invitación
CREATE TABLE IF NOT EXISTS public.invitation_codes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE,
    used BOOLEAN DEFAULT FALSE,
    used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    max_uses INTEGER DEFAULT 1,
    current_uses INTEGER DEFAULT 0,
    user_type VARCHAR(20) DEFAULT 'Beta',
    credits INTEGER DEFAULT 100
);

-- Añadir columnas a tabla existente si no existen
ALTER TABLE public.invitation_codes 
ADD COLUMN IF NOT EXISTS user_type VARCHAR(20) DEFAULT 'Beta',
ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 100;

-- Índices para mejor performance
CREATE INDEX IF NOT EXISTS idx_invitation_codes_code ON public.invitation_codes(code);
CREATE INDEX IF NOT EXISTS idx_invitation_codes_used ON public.invitation_codes(used);
CREATE INDEX IF NOT EXISTS idx_invitation_codes_created_by ON public.invitation_codes(created_by);
CREATE INDEX IF NOT EXISTS idx_invitation_codes_expires_at ON public.invitation_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_invitation_codes_user_type ON public.invitation_codes(user_type);

-- Enable RLS
ALTER TABLE public.invitation_codes ENABLE ROW LEVEL SECURITY;

-- Política para que solo admins puedan ver todos los códigos
CREATE POLICY "Admins can view all invitation codes" ON public.invitation_codes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- Política para que solo admins puedan insertar códigos
CREATE POLICY "Admins can insert invitation codes" ON public.invitation_codes
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- Política para que solo admins puedan actualizar códigos
CREATE POLICY "Admins can update invitation codes" ON public.invitation_codes
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- Política para que solo admins puedan eliminar códigos
CREATE POLICY "Admins can delete invitation codes" ON public.invitation_codes
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- Política para que cualquiera pueda verificar códigos válidos (para registro)
CREATE POLICY "Anyone can check valid codes for registration" ON public.invitation_codes
    FOR SELECT USING (
        used = FALSE 
        AND (expires_at IS NULL OR expires_at > NOW())
        AND current_uses < max_uses
    );

-- Función para generar códigos únicos (actualizada)
CREATE OR REPLACE FUNCTION generate_invitation_code(
    code_prefix TEXT DEFAULT 'PRESS',
    code_length INTEGER DEFAULT 8
) RETURNS TEXT AS $$
DECLARE
    characters TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    result TEXT := '';
    i INTEGER := 0;
    random_char TEXT;
    final_code TEXT;
    code_exists BOOLEAN := TRUE;
BEGIN
    WHILE code_exists LOOP
        result := '';
        
        -- Generar parte aleatoria
        FOR i IN 1..code_length LOOP
            random_char := substr(characters, floor(random() * length(characters) + 1)::integer, 1);
            result := result || random_char;
        END loop;
        
        -- Formar código final
        final_code := code_prefix || '-' || result;
        
        -- Verificar si ya existe
        SELECT EXISTS(
            SELECT 1 FROM public.invitation_codes WHERE code = final_code
        ) INTO code_exists;
    END LOOP;
    
    RETURN final_code;
END;
$$ LANGUAGE plpgsql;

-- Eliminar función existente si existe (para cambiar tipo de retorno)
DROP FUNCTION IF EXISTS mark_invitation_code_used(text, uuid);

-- Crear función actualizada para marcar código como usado (ahora retorna JSON con datos del código)
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
    
    -- Retornar datos del código para aplicar al perfil
    result := json_build_object(
        'success', true,
        'user_type', COALESCE(code_record.user_type, 'Beta'),
        'credits', COALESCE(code_record.credits, 100),
        'description', code_record.description
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Insertar algunos códigos de ejemplo para desarrollo con tipos y créditos
INSERT INTO public.invitation_codes (code, description, created_by, user_type, credits) VALUES 
('JOURNALIST2024', 'Código de desarrollo para periodistas', (SELECT id FROM auth.users LIMIT 1), 'Beta', 150),
('PRESS-INVITE', 'Código de desarrollo para prensa', (SELECT id FROM auth.users LIMIT 1), 'Alpha', 300),
('MEDIA-ACCESS', 'Código de desarrollo para medios', (SELECT id FROM auth.users LIMIT 1), 'Creador', 500)
ON CONFLICT (code) DO UPDATE SET 
    user_type = EXCLUDED.user_type,
    credits = EXCLUDED.credits;

-- Actualizar códigos de ejemplo existentes con los nuevos campos
UPDATE public.invitation_codes 
SET 
    user_type = CASE 
        WHEN code = 'JOURNALIST2024' THEN 'Beta'
        WHEN code = 'PRESS-INVITE' THEN 'Alpha'
        WHEN code = 'MEDIA-ACCESS' THEN 'Creador'
        ELSE 'Beta'
    END,
    credits = CASE 
        WHEN code = 'JOURNALIST2024' THEN 150
        WHEN code = 'PRESS-INVITE' THEN 300
        WHEN code = 'MEDIA-ACCESS' THEN 500
        ELSE 100
    END
WHERE code IN ('JOURNALIST2024', 'PRESS-INVITE', 'MEDIA-ACCESS')
AND (user_type IS NULL OR credits IS NULL);

-- Verificar que las columnas se agregaron correctamente
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'invitation_codes' AND column_name = 'user_type') 
    AND EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'invitation_codes' AND column_name = 'credits') THEN
        RAISE NOTICE 'Actualización exitosa: columnas user_type y credits añadidas a invitation_codes';
    ELSE
        RAISE EXCEPTION 'Error: No se pudieron agregar las nuevas columnas';
    END IF;
END $$; 