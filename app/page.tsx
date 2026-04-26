'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import { supabase } from '../lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Intentar Autenticación
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        toast.error('Credenciales incorrectas.');
        setLoading(false);
        return;
      }

      // 2. Consultar Perfil
      const { data: perfil, error: perfilError } = await supabase
        .from('perfiles_usuario') 
        .select('rol')
        .eq('id', authData.user?.id)
        .single();

      if (perfilError || !perfil) {
        console.error("Error buscando perfil:", perfilError);
        toast.error('Usuario autenticado, pero no se encontró su perfil en la tabla perfiles_usuario.');
        setLoading(false);
        return;
      }

      const userRol = perfil.rol?.toLowerCase().trim();

      // 3. Redirección con Mensaje de Éxito
      if (userRol === 'admin') {
        toast.success('Bienvenido, Administrador');
        await new Promise((resolve) => setTimeout(resolve, 1500));
        router.push('/admin');
      } 
      else if (userRol === 'proveedor') {
        toast.success('Centro de Servicios LOGIC');
        await new Promise((resolve) => setTimeout(resolve, 1500));
        router.push('/proveedor');
      } 
      else {
        // Para roles 'unidad' o 'user'
        toast.success('Bienvenido al centro de registro');
        await new Promise((resolve) => setTimeout(resolve, 1500));
        router.push('/registrar');
      }

    } catch (err) {
      toast.error('Error inesperado de conexión.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F4F7] flex flex-col items-center justify-center px-6 font-[-apple-system,BlinkMacSystemFont,sans-serif]">
      
      {/* --- LOGO Y TÍTULOS --- */}
      <div className="mb-10 text-center flex flex-col items-center animate-in fade-in duration-500">
        <div className="w-[120px] h-[120px] bg-white rounded-[32px] shadow-[0_10px_30px_rgba(0,0,0,0.08)] flex items-center justify-center mb-6">
          <Image 
            src="/logo.png" 
            alt="Logo LOGIC" 
            width={90} 
            height={90} 
            priority 
            className="object-contain" 
          />
        </div>
        <h1 className="text-[34px] font-black text-black tracking-tight leading-none mb-1.5">
          URBANIA
        </h1>
        <p className="text-[12px] font-bold text-[#8E8E93] uppercase tracking-[0.25em]">
          Grupo LOGIC
        </p>
      </div>

      {/* --- FORMULARIO --- */}
      <form onSubmit={handleLogin} className="w-full max-w-sm flex flex-col gap-6">
        
        {/* Contenedor de Inputs Inset Grouped */}
        <div className="bg-white rounded-[24px] shadow-[0_2px_15px_rgba(0,0,0,0.03)] overflow-hidden w-full">
          <div className="flex items-center px-5 py-4 border-b border-[#F2F2F7]">
            <label className="w-[85px] text-[12px] text-[#8E8E93] font-bold uppercase tracking-wider">
              Correo
            </label>
            <input 
              type="email" 
              className="flex-1 bg-transparent text-[16px] text-[#333333] font-medium outline-none placeholder:text-[#C7C7CC]"
              placeholder="ejemplo@logic.com"
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required
            />
          </div>
          <div className="flex items-center px-5 py-4">
            <label className="w-[85px] text-[12px] text-[#8E8E93] font-bold uppercase tracking-wider">
              Clave
            </label>
            <input 
              type="password" 
              className="flex-1 bg-transparent text-[16px] text-[#333333] font-medium outline-none placeholder:text-[#C7C7CC] tracking-widest"
              placeholder="••••••••"
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required
            />
          </div>
        </div>

        {/* Botón de Acción */}
        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-[#007AFF] text-white py-[18px] rounded-[20px] font-bold text-[16px] uppercase tracking-wider shadow-[0_8px_20px_rgba(0,122,255,0.25)] active:scale-[0.98] active:bg-[#0062CC] transition-all disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center"
        >
          {loading ? <div className="ios-spinner"></div> : 'INGRESAR'}
        </button>
        
      </form>

      {/* --- ESTILOS SPINNER --- */}
      <style jsx>{`
        .ios-spinner { 
          width: 22px; 
          height: 22px; 
          border: 3px solid rgba(255,255,255,0.3); 
          border-top-color: #fff; 
          border-radius: 50%; 
          animation: spin 0.8s linear infinite; 
        }
        @keyframes spin { 
          to { transform: rotate(360deg); } 
        }
      `}</style>
    </div>
  );
}