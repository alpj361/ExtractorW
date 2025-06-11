-- Verificar si el usuario admin está correctamente configurado
SELECT id, email, role FROM public.profiles WHERE email = 'pablojosea361@gmail.com';

-- Si el usuario existe pero no tiene rol admin, actualizar
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'pablojosea361@gmail.com' 
AND role != 'admin';

-- Si el usuario no existe en profiles, pero sí en auth.users, insertar
INSERT INTO public.profiles (id, email, role)
SELECT id, email, 'admin'
FROM auth.users 
WHERE email = 'pablojosea361@gmail.com'
AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE email = 'pablojosea361@gmail.com');

-- Verificar permisos de las políticas RLS
SELECT tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('usage_logs', 'profiles');

-- Verificar que la tabla profiles tenga RLS activado
SELECT 
    relname, 
    relrowsecurity 
FROM 
    pg_class 
WHERE 
    relname IN ('profiles', 'usage_logs');

-- Verificar si existen restricciones de permisos en perfiles de admin
SELECT * FROM auth.users WHERE email = 'pablojosea361@gmail.com'; 