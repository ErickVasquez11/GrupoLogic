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

  // Función para obtener la hora actual segura
  const obtenerHoraActual = () => {
    const ahora = new Date();
    const horas = String(ahora.getHours()).padStart(2, '0');
    const minutos = String(ahora.getMinutes()).padStart(2, '0');
    return `${horas}:${minutos}`;
  };

  const [form, setForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    hora_salida: obtenerHoraActual(), 
    cliente: '', servicio_a: '', inicio: '', destino: '',
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
      
      // 1. ESCUDO ANTI-ERRORES DE HORA (IOS)
      // Si por algún motivo la hora viene vacía, tomamos la actual.
      let horaFinal = form.hora_salida || obtenerHoraActual();
      const partesHora = horaFinal.split(':');
      
      // Forzamos la hora al formato estricto HH:MM:SS para PostgreSQL
      const horaPostgres = `${partesHora[0].padStart(2, '0')}:${partesHora[1] ? partesHora[1].padStart(2, '0') : '00'}:00`;

      const { error } = await supabase.from('carreras').insert([{
        perfil_id: session?.user.id, 
        unidad_id: perfil?.unidad_id,
        ...form,
        hora_salida: horaPostgres, // <-- Enviamos la hora blindada
        valor: parseFloat(form.valor)
      }]);

      if (error) throw error;
      
      // 2. MENSAJE DE ÉXITO ESTILO IOS
      toast.success('Registro de Carrera Exitoso!');
      setModalAbierto(false);
      
      setForm({ 
        ...form, 
        hora_salida: obtenerHoraActual(), 
        cliente: '', servicio_a: '', inicio: '', destino: '', centro_costo: '', valor: '' 
      });
      fetchDatos();
    } catch (err: any) { 
      toast.error('Error al guardar: Verifique los datos.'); 
    } finally { 
      setEnviando(false); 
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#F4F4F7]"><div className="ios-spinner"></div></div>;

  return (
    <div className="min-h-screen bg-[#F4F4F7] pb-10 font-[-apple-system,BlinkMacSystemFont,sans-serif]">
      {/* Estilos del Toast para que parezca notificación nativa de iOS */}
      <ToastContainer 
        position="top-center" 
        autoClose={3000} 
        hideProgressBar={true}
        toastStyle={{ 
          borderRadius: '16px', 
          fontWeight: 'bold',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          color: '#1C1C1E',
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
        }} 
      />

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

        <button onClick={() => setModalAbierto(true)} className="w-full bg-[#007AFF] text-white py-[18px] rounded-[20px] font-bold text-[15px] shadow-[0_8px_20px_rgba(0,122,255,0.25)] active:scale-[0.98] transition-all flex items-center justify-center uppercase tracking-widest">
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
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    Reg: {c.fecha.split('-').reverse().join('/')} a las {c.hora_salida.substring(0, 5)}
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

      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-md transition-opacity" onClick={() => setModalAbierto(false)}></div>
          
          <div className="relative w-full max-w-lg bg-[#F4F4F7] rounded-t-[32px] sm:rounded-[32px] shadow-2xl flex flex-col max-h-[96vh] animate-slide-up overflow-hidden">
            <div className="sm:hidden w-12 h-1.5 bg-[#C7C7CC] rounded-full mx-auto mt-4 mb-2 opacity-60"></div>
            
            <div className="px-6 py-4 flex justify-between items-center">
              <h2 className="text-[24px] font-black text-black tracking-tighter uppercase">Registro</h2>
              <button type="button" onClick={() => setModalAbierto(false)} className="bg-[#007AFF] text-white py-1.5 px-4 rounded-full font-black text-[11px] shadow-md uppercase tracking-wider active:scale-95 transition-transform">Cerrar</button>
            </div>
            
            <form onSubmit={handleRegistrar} className="overflow-y-auto px-5 pb-12 pt-2 space-y-5">
              <div className="bg-white rounded-[24px] overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
                <IOSRow label="Fecha" value={form.fecha} type="date" onChange={(e: any) => setForm({...form, fecha: e.target.value})} />
                <IOSRow label="Salida" value={form.hora_salida} type="time" onChange={(e: any) => setForm({...form, hora_salida: e.target.value})} />
                <IOSRow label="Cliente" placeholder="Empresa o particular" value={form.cliente} onChange={(e: any) => setForm({...form, cliente: e.target.value})} />
                <IOSRow label="Servicio" placeholder="Nombre pasajero" border={false} value={form.servicio_a} onChange={(e: any) => setForm({...form, servicio_a: e.target.value})} />
              </div>

              <div className="bg-white rounded-[24px] overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
                <IOSRow label="Inicio" placeholder="Origen" value={form.inicio} onChange={(e: any) => setForm({...form, inicio: e.target.value})} />
                <IOSRow label="Destino" placeholder="Llegada" border={false} value={form.destino} onChange={(e: any) => setForm({...form, destino: e.target.value})} />
              </div>

              <div className="bg-white rounded-[24px] overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
                <div className="flex items-center px-5 py-4 border-b border-[#F2F2F7] min-h-[56px]">
                  <label className="w-24 text-[12px] text-[#8E8E93] font-bold uppercase tracking-wider">Proveedor</label>
                  <select required value={form.proveedor_id} onChange={e => setForm({...form, proveedor_id: e.target.value})} className="flex-1 bg-transparent text-right outline-none appearance-none font-bold text-[#333333] cursor-pointer">
                    <option value="">Seleccionar...</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre_proveedor}</option>)}
                  </select>
                </div>
                <IOSRow label="C. Costo" placeholder="Opcional" border={false} value={form.centro_costo} onChange={(e: any) => setForm({...form, centro_costo: e.target.value})} />
              </div>
              
              <div className="bg-[#E3E3E8] p-1 rounded-[14px] flex gap-1 shadow-inner">
                {['Efectivo', 'Credito', 'Transferencia'].map((m) => (
                  <button key={m} type="button" onClick={() => setForm({...form, metodo_pago: m})} className={`flex-1 py-3 rounded-[10px] text-[11px] font-black transition-all duration-200 uppercase tracking-wide ${form.metodo_pago === m ? 'bg-white text-black shadow-[0_2px_8px_rgba(0,0,0,0.1)]' : 'text-[#8E8E93]'}`}>
                    {m === 'Credito' ? 'CRÉDITO' : m}
                  </button>
                ))}
              </div>

              <div className="bg-white rounded-[28px] p-6 sm:p-8 flex justify-between items-center shadow-[0_2px_15px_rgba(0,0,0,0.03)] mt-2">
                <span className="text-[15px] font-black text-black uppercase tracking-wider">Valor Total</span>
                <div className="flex items-center text-[40px] sm:text-[48px] font-black text-black tracking-tighter">
                  <span className="text-[28px] text-[#007AFF] mr-2 mt-1">$</span>
                  <input type="number" step="0.01" required placeholder="0.00" value={form.valor} onChange={e => setForm({...form, valor: e.target.value})} className="w-32 text-right outline-none bg-transparent placeholder:text-[#C7C7CC]" />
                </div>
              </div>

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

function IOSRow({ label, border = true, ...props }: any) {
  return (
    <div className={`flex items-center px-5 py-4 min-h-[56px] ${border ? 'border-b border-[#F2F2F7]' : ''}`}>
      <label className="w-24 text-[12px] text-[#8E8E93] font-bold uppercase tracking-wider">{label}</label>
      <input className="flex-1 bg-transparent text-right outline-none font-bold text-[#333333] placeholder:text-[#C7C7CC]" required={label !== 'C. Costo'} {...props} />
    </div>
  );
}