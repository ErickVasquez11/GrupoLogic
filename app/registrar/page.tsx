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

  // --- EL SECRETO DEL MENSAJE DE BIENVENIDA ---
  useEffect(() => {
    const checkAcceso = async () => {
      await fetchDatos();
      
      const notaBienvenida = sessionStorage.getItem('mostrar_bienvenida');
      if (notaBienvenida === 'true') {
        setTimeout(() => {
          toast.success('Bienvenido al centro de registro', {
            position: "top-center",
            autoClose: 3000,
            theme: "light",
          });
          sessionStorage.removeItem('mostrar_bienvenida');
        }, 600);
      }
    };
    checkAcceso();
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
      {/* Contenedor Toast configurado para iOS */}
      <ToastContainer 
        position="top-center" 
        toastStyle={{ borderRadius: '20px', fontWeight: 'bold', border: '1px solid #E5E5EA', boxShadow: '0 8px 20px rgba(0,0,0,0.06)' }}
      />

      {/* --- NAV BAR --- */}
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
        
        {/* CARD UNIDAD */}
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

        {/* BOTÓN NUEVA CARRERA */}
        <button onClick={() => setModalAbierto(true)} className="w-full bg-[#007AFF] text-white py-[18px] rounded-[20px] font-bold text-[15px] shadow-[0_8px_20px_rgba(0,122,255,0.25)] active:scale-[0.98] transition-all flex items-center justify-center uppercase tracking-widest">
           Nueva Carrera
        </button>

        {/* ACTIVIDAD RECIENTE */}
        <div className="pt-4">
          <h3 className="text-[#8E8E93] text-[11px] font-bold uppercase tracking-widest ml-2 mb-3">Historial de hoy</h3>
          <div className="bg-white rounded-[24px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden">
            {carreras.length > 0 ? carreras.map((c, i) => (
              <div key={c.id} className={`p-5 flex justify-between items-center active:bg-[#F2F2F7] transition-colors ${i !== carreras.length - 1 ? 'border-b border-[#F2F2F7]' : ''}`}>
                <div className="flex-1 pr-4">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-black text-[15px] text-black uppercase tracking-tight">{c.cliente}</p>
                    <span className="text-[9px] bg-[#F4F4F7] text-[#007AFF] px-2 py-0.5 rounded-md font-black uppercase tracking-wider">{c.metodo_pago}</span>
                  </div>
                  <p className="text-[13px] text-[#8E8E93] font-medium">{c.inicio} <span className="opacity-40 mx-1">→</span> {c.destino}</p>
                </div>
                <p className="text-[22px] font-black text-black tracking-tighter">${parseFloat(c.valor).toFixed(0)}</p>
              </div>
            )) : (
              <div className="p-8 text-center text-[#8E8E93] font-medium text-sm">No hay carreras registradas hoy</div>
            )}
          </div>
        </div>
      </main>

      {/* --- MODAL REGISTRO (iOS BOTTOM SHEET) --- */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-md transition-opacity" onClick={() => setModalAbierto(false)}></div>
          
          <div className="relative w-full max-w-lg bg-[#F4F4F7] rounded-t-[32px] sm:rounded-[32px] shadow-2xl flex flex-col max-h-[96vh] animate-slide-up overflow-hidden">
            <div className="sm:hidden w-12 h-1.5 bg-[#C7C7CC] rounded-full mx-auto mt-4 mb-2 opacity-60"></div>
            
            <div className="px-6 py-4 flex justify-between items-center">
              <h2 className="text-[24px] font-black text-black tracking-tighter uppercase">Registro</h2>
              <button onClick={() => setModalAbierto(false)} className="bg-[#007AFF] text-white py-1.5 px-4 rounded-full font-black text-[11px] shadow-md uppercase tracking-wider active:scale-95 transition-transform">Cerrar</button>
            </div>
            
            <form onSubmit={handleRegistrar} className="overflow-y-auto px-5 pb-12 pt-2 space-y-5">
              
              {/* Bloque 1 */}
              <div className="bg-white rounded-[24px] overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
                <IOSRow label="Fecha" value={form.fecha} type="date" onChange={e => setForm({...form, fecha: e.target.value})} />
                <IOSRow label="Salida" value={form.hora_salida} type="time" onChange={e => setForm({...form, hora_salida: e.target.value})} />
                <IOSRow label="Cliente" placeholder="Empresa o particular" value={form.cliente} onChange={e => setForm({...form, cliente: e.target.value})} />
                <IOSRow label="Servicio" placeholder="Nombre pasajero" border={false} value={form.servicio_a} onChange={e => setForm({...form, servicio_a: e.target.value})} />
              </div>
              
              {/* Bloque 2 */}
              <div className="bg-white rounded-[24px] overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
                <IOSRow label="Inicio" placeholder="Origen" value={form.inicio} onChange={e => setForm({...form, inicio: e.target.value})} />
                <IOSRow label="Destino" placeholder="Llegada" border={false} value={form.destino} onChange={e => setForm({...form, destino: e.target.value})} />
              </div>
              
              {/* Bloque 3 */}
              <div className="bg-white rounded-[24px] overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
                <div className="flex items-center px-5 py-4 border-b border-[#F2F2F7] min-h-[56px]">
                  <label className="w-24 text-[12px] text-[#8E8E93] font-bold uppercase tracking-wider">Proveedor</label>
                  <select required value={form.proveedor_id} onChange={e => setForm({...form, proveedor_id: e.target.value})} className="flex-1 bg-transparent text-right outline-none appearance-none font-bold text-[#333333]">
                    <option value="">Seleccionar...</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre_proveedor}</option>)}
                  </select>
                </div>
                <IOSRow label="C. Costo" placeholder="Opcional" border={false} value={form.centro_costo} onChange={e => setForm({...form, centro_costo: e.target.value})} />
              </div>
              
              {/* Bloque 4: Método de Pago (Segmented Control iOS) */}
              <div className="bg-[#E3E3E8] p-1 rounded-[14px] flex gap-1 shadow-inner">
                {['Efectivo', 'Credito', 'Transferencia'].map((m) => (
                  <button key={m} type="button" onClick={() => setForm({...form, metodo_pago: m})} className={`flex-1 py-3 rounded-[10px] text-[11px] font-black transition-all duration-200 uppercase tracking-wide ${form.metodo_pago === m ? 'bg-white text-black shadow-[0_2px_8px_rgba(0,0,0,0.1)]' : 'text-[#8E8E93]'}`}>
                    {m === 'Credito' ? 'CRÉDITO' : m}
                  </button>
                ))}
              </div>

              {/* Valor Total */}
              <div className="bg-white rounded-[28px] p-6 sm:p-8 flex justify-between items-center shadow-[0_2px_15px_rgba(0,0,0,0.03)] mt-2">
                <span className="text-[15px] font-black text-black uppercase tracking-wider">Valor Total</span>
                <div className="flex items-center text-[40px] sm:text-[48px] font-black text-black tracking-tighter">
                  <span className="text-[28px] text-[#007AFF] mr-2 mt-1">$</span>
                  <input type="number" step="0.01" required placeholder="0.00" value={form.valor} onChange={e => setForm({...form, valor: e.target.value})} className="w-32 text-right outline-none bg-transparent placeholder:text-[#C7C7CC]" />
                </div>
              </div>

              {/* Botón Finalizar */}
              <button type="submit" disabled={enviando} className="w-full bg-[#007AFF] text-white py-[20px] rounded-[22px] font-black text-[16px] shadow-[0_8px_20px_rgba(0,122,255,0.25)] active:scale-[0.98] disabled:bg-[#C7C7CC] disabled:shadow-none transition-all uppercase tracking-[0.15em] mt-4">
                {enviando ? 'Guardando...' : 'Finalizar Registro'}
              </button>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .animate-slide-up { animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        .ios-spinner { width: 32px; height: 32px; border: 4px solid rgba(0, 122, 255, 0.1); border-top-color: #007AFF; border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// Componente para inputs agrupados tipo iOS
function IOSRow({ label, border = true, ...props }: any) {
  return (
    <div className={`flex items-center px-5 py-4 min-h-[56px] ${border ? 'border-b border-[#F2F2F7]' : ''}`}>
      <label className="w-24 text-[12px] text-[#8E8E93] font-bold uppercase tracking-wider">{label}</label>
      <input className="flex-1 bg-transparent text-right outline-none font-bold text-[#333333] placeholder:text-[#C7C7CC]" required={label !== 'C. Costo'} {...props} />
    </div>
  );
}