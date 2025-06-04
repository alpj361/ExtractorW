-- Tabla de perfiles de usuario
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email VARCHAR(255),
    phone VARCHAR(20),
    role VARCHAR(20) DEFAULT 'user',
    user_type VARCHAR(20) DEFAULT 'Beta', -- Tipo de usuario (Alpha, Beta, Admin, Creador)
    credits INTEGER DEFAULT 100, -- Créditos del usuario
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Añadir columnas a tabla existente si no existen
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS user_type VARCHAR(20) DEFAULT 'Beta',
ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Índices para mejor performance
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON public.profiles(user_type);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Política para que los usuarios puedan ver su propio perfil
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

-- Política para que los usuarios puedan actualizar su propio perfil (excepto role, user_type y credits)
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id AND
        role = (SELECT role FROM public.profiles WHERE id = auth.uid()) AND
        user_type = (SELECT user_type FROM public.profiles WHERE id = auth.uid()) AND
        credits = (SELECT credits FROM public.profiles WHERE id = auth.uid())
    );

-- Política para que los admins puedan ver todos los perfiles
CREATE POLICY "Admins can view all profiles" ON public.profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- Política para que los admins puedan actualizar todos los perfiles
CREATE POLICY "Admins can update all profiles" ON public.profiles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- Política para que se puedan insertar perfiles durante el registro
CREATE POLICY "Allow profile creation during signup" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Función para actualizar timestamp de updated_at
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at automáticamente
DROP TRIGGER IF EXISTS set_updated_at ON public.profiles;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at();

-- Función para aplicar datos del código de invitación al perfil
CREATE OR REPLACE FUNCTION apply_invitation_code_to_profile(
    user_id UUID,
    invitation_user_type VARCHAR(20),
    invitation_credits INTEGER
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.profiles 
    SET 
        user_type = invitation_user_type,
        credits = invitation_credits,
        updated_at = NOW()
    WHERE id = user_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Verificar que las columnas se agregaron correctamente
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'profiles' AND column_name = 'user_type') 
    AND EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'profiles' AND column_name = 'credits') THEN
        RAISE NOTICE 'Actualización exitosa: columnas user_type y credits añadidas a profiles';
    ELSE
        RAISE EXCEPTION 'Error: No se pudieron agregar las nuevas columnas a profiles';
    END IF;
END $$;

-- Actualizar política para que los usuarios no puedan cambiar su user_type y credits
-- Primero eliminar la política existente si existe
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' 
        AND policyname = 'Users can update own profile'
    ) THEN
        DROP POLICY "Users can update own profile" ON public.profiles;
    END IF;
END $$;

-- Crear nueva política actualizada
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id AND
        COALESCE(role, 'user') = COALESCE((SELECT role FROM public.profiles WHERE id = auth.uid()), 'user') AND
        COALESCE(user_type, 'Beta') = COALESCE((SELECT user_type FROM public.profiles WHERE id = auth.uid()), 'Beta') AND
        COALESCE(credits, 100) = COALESCE((SELECT credits FROM public.profiles WHERE id = auth.uid()), 100)
    );

-- Función para actualizar timestamp de updated_at
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para actualizar updated_at automáticamente (si no existe)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'set_updated_at' 
        AND tgrelid = 'public.profiles'::regclass
    ) THEN
        CREATE TRIGGER set_updated_at
            BEFORE UPDATE ON public.profiles
            FOR EACH ROW
            EXECUTE FUNCTION handle_updated_at();
    END IF;
END $$;

-- Función para aplicar datos del código de invitación al perfil
CREATE OR REPLACE FUNCTION apply_invitation_code_to_profile(
    user_id UUID,
    invitation_user_type VARCHAR(20),
    invitation_credits INTEGER
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.profiles 
    SET 
        user_type = invitation_user_type,
        credits = invitation_credits,
        updated_at = NOW()
    WHERE id = user_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql; 