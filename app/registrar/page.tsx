'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase'; 
import { useRouter } from 'next/navigation';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function OperadorDashboard() {
  const router = useRouter();
  const [perfil, setPerfil] = useState<any>(null);
  const [carreras, setCarreras] = useState<any[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const [form, setForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    hora_salida: '', cliente: '', servicio_a: '', inicio: '', destino: '',
    proveedor_id: '', centro_costo: '', metodo_pago: 'Efectivo', valor: ''
  });

  const fetchDatos = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return router.replace('/');

    const { data: userPerfil } = await supabase
      .from('perfiles_usuario')
      .select('*, unidades(*)')
      .eq('id', session.user.id)
      .single();
    setPerfil(userPerfil);

    const { data: provs } = await supabase.from('proveedores').select('*').order('nombre_proveedor');
    setProveedores(provs || []);

    const { data: listado } = await supabase
      .from('carreras').select('*, proveedores(nombre_proveedor)')
      .eq('perfil_id', session.user.id)
      .order('fecha', { ascending: false }).order('hora_salida', { ascending: false }).limit(10);
    
    setCarreras(listado || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchDatos();
  }, []);

  const handleRegistrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { error } = await supabase.from('carreras').insert([{
        perfil_id: session?.user.id, unidad_id: perfil?.unidad_id,
        ...form, valor: parseFloat(form.valor)
      }]);
      if (error) throw error;
      toast.success('Servicio Guardado');
      setModalAbierto(false);
      setForm({ ...form, hora_salida: '', cliente: '', servicio_a: '', inicio: '', destino: '', centro_costo: '', valor: '' });
      fetchDatos();
    } catch (err: any) { toast.error('Error al guardar'); } finally { setEnviando(false); }
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#F4F4F7]"><div className="ios-spinner"></div></div>;

  return (
    <div className="min-h-screen bg-[#F4F4F7] pb-10 font-[-apple-system,BlinkMacSystemFont,sans-serif]">
      <ToastContainer position="top-center" />

      <nav className="sticky top-0 z-30 bg-[#F4F4F7]/90 backdrop-blur-xl px-5 pt-12 pb-4">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-[#8E8E93] text-[11px] font-black uppercase tracking-widest mb-1">Urbania</p>
            <h1 className="text-[32px] font-black text-black tracking-tight leading-none">Hola, {perfil?.nombre_completo?.split(' ')[0]}</h1>
          </div>
          <button onClick={() => { supabase.auth.signOut(); router.push('/'); }} className="text-[#007AFF] font-bold text-[16px] active:opacity-40 transition-opacity">Salir</button>
        </div>
      </nav>

      <main className="px-5 mt-4 space-y-6 max-w-lg mx-auto">
        <div className="bg-white rounded-[24px] p-4 flex items-center justify-between shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
          <div className="flex items-center gap-4">
            <div className="bg-[#5856D6] p-3 rounded-[14px] text-white shadow-sm">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div>
              <p className="text-[11px] text-[#8E8E93] font-bold uppercase tracking-widest">Unidad</p>
              <p className="text-[22px] font-black text-black leading-none mt-0.5">{perfil?.unidades?.numero_equipo || 'S/N'}</p>
            </div>
          </div>
          <span className="bg-[#E5F9E0] text-[#34C759] text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-wider">Activa</span>
        </div>

        <button onClick={() => setModalAbierto(true)} className="w-full bg-[#007AFF] text-white py-[18px] rounded-[20px] font-bold text-[15px] shadow-[0_8px_20px_rgba(0,122,255,0.25)] active:scale-[0.98] transition-all uppercase tracking-widest">
           Nueva Carrera
        </button>

        <div className="pt-4">
          <h3 className="text-[#8E8E93] text-[11px] font-bold uppercase tracking-widest ml-2 mb-3">Historial de hoy</h3>
          <div className="bg-white rounded-[24px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden">
            {carreras.length > 0 ? carreras.map((c, i) => (
              <div key={c.id} className={`p-5 flex justify-between items-center transition-colors ${c.pagado ? 'bg-[#FF3B30]/5 border-l-4 border-l-[#FF3B30]' : 'active:bg-[#F2F2F7]'} ${i !== carreras.length - 1 && !c.pagado ? 'border-b border-[#F2F2F7]' : ''}`}>
                <div className="flex-1 pr-4">
                  <div className="flex items-center gap-2 mb-1">
                    <p className={`font-black text-[15px] uppercase tracking-tight ${c.pagado ? 'text-[#FF3B30]' : 'text-black'}`}>{c.cliente}</p>
                    <span className={`text-[9px] px-2 py-0.5 rounded-md font-black uppercase tracking-wider ${c.pagado ? 'bg-[#FF3B30]/10 text-[#FF3B30]' : 'bg-[#F4F4F7] text-[#007AFF]'}`}>{c.metodo_pago}</span>
                  </div>
                  <p className={`text-[13px] font-medium leading-tight ${c.pagado ? 'text-[#FF3B30]/70' : 'text-[#8E8E93]'}`}>{c.inicio} <span className="opacity-40 mx-1">→</span> {c.destino}</p>
                  
                  <p className={`text-[11px] font-bold mt-1.5 flex items-center gap-1 ${c.pagado ? 'text-[#FF3B30]/60' : 'text-[#C7C7CC]'}`}>
                    Reg: {c.fecha.split('-').reverse().join('/')} a las {c.hora_salida}
                  </p>
                </div>
                <div className="flex flex-col items-end">
                  <p className={`text-[22px] font-black tracking-tighter ${c.pagado ? 'text-[#FF3B30]' : 'text-black'}`}>${parseFloat(c.valor).toFixed(2)}</p>
                  {c.pagado && <span className="text-[9px] text-[#FF3B30] font-black uppercase mt-1 tracking-widest border border-[#FF3B30] px-1.5 py-0.5 rounded">Cancelada</span>}
                </div>
              </div>
            )) : (
              <div className="p-8 text-center text-[#8E8E93] font-medium text-sm">No hay carreras registradas hoy</div>
            )}
          </div>
        </div>
      </main>

      {/* --- EL MODAL QUEDA IGUAL, SE OMITIÓ POR ESPACIO PERO NO DEBES BORRARLO EN TU CÓDIGO --- */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          {/* Mismo código de tu modal... */}
        </div>
      )}
    </div>
  );
}