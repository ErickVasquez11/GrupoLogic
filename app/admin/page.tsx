'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase'; 
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function AdminDashboard() {
  const router = useRouter();
  const [carreras, setCarreras] = useState<any[]>([]);
  const [proveedoresTotales, setProveedoresTotales] = useState<any[]>([]); 
  const [operadoresTotales, setOperadoresTotales] = useState<any[]>([]); 
  
  const [loading, setLoading] = useState(true);
  const [verificandoSeguridad, setVerificandoSeguridad] = useState(true);

  const [filtroUsuario, setFiltroUsuario] = useState('');
  const [filtroProveedor, setFiltroProveedor] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  const [incluirPagadosEnCalculo, setIncluirPagadosEnCalculo] = useState(false);

  const [carreraEditando, setCarreraEditando] = useState<any>(null);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  const [usuarioEditando, setUsuarioEditando] = useState<any>(null);
  const [guardandoUsuario, setGuardandoUsuario] = useState(false);

  const [directorioAbierto, setDirectorioAbierto] = useState(false);
  const [dirTab, setDirTab] = useState('usuarios'); 
  const [creandoDato, setCreandoDato] = useState(false);

  const [altaRapidaAbierta, setAltaRapidaAbierta] = useState(false);
  const [formAltaRapida, setFormAltaRapida] = useState({ username: '', numero_equipo: '', password: '' });

  const [formUsuario, setFormUsuario] = useState({ 
    email: '', password: '', nombre_completo: '', rol: 'unidad', proveedor_id: '', 
    numero_equipo: '', tipo_cuota: 'Frecuencia', valor_cuota: '' 
  });
  const [formProveedor, setFormProveedor] = useState({ nombre_proveedor: '', cuota_frecuencia: '' });

  const [registroAdminAbierto, setRegistroAdminAbierto] = useState(false);
  const [formRegistroAdmin, setFormRegistroAdmin] = useState({
    perfil_id: '', fecha: new Date().toISOString().split('T')[0], hora_salida: '', cliente: '', 
    servicio_a: '', inicio: '', destino: '', proveedor_id: '', centro_costo: '', 
    metodo_pago: 'Efectivo', valor: ''
  });

  const fetchDatos = async () => {
    setLoading(true);
    try {
      const { data: carrerasData, error: carrerasError } = await supabase
        .from('carreras')
        .select(`*, perfiles_usuario!perfil_id(nombre_completo), proveedores(nombre_proveedor, cuota_frecuencia), unidades(numero_equipo, tipo_cuota, valor_cuota)`)
        .order('fecha', { ascending: false }).order('hora_salida', { ascending: false });

      if (carrerasError) throw new Error(carrerasError.message);
      setCarreras(carrerasData || []);

      const { data: provsData } = await supabase.from('proveedores').select('*').order('nombre_proveedor');
      if (provsData) setProveedoresTotales(provsData);

      const { data: opsData } = await supabase.from('perfiles_usuario').select('id, nombre_completo, unidades(id, numero_equipo, tipo_cuota, valor_cuota)').eq('rol', 'unidad'); 
      if (opsData) setOperadoresTotales(opsData);
    } catch (err: any) { toast.error(`Error cargando viajes: ${err.message}`); } finally { setLoading(false); }
  };

  useEffect(() => {
    const checkSessionAndRole = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.replace('/');
      const { data: perfil } = await supabase.from('perfiles_usuario').select('rol').eq('id', session.user.id).single();
      if (!perfil || perfil.rol !== 'admin') return router.replace('/'); 
      setVerificandoSeguridad(false); fetchDatos();
    };
    checkSessionAndRole();
  }, [router]);

  const limpiarFiltros = () => { setFiltroUsuario(''); setFiltroProveedor(''); setFechaInicio(''); setFechaFin(''); };

  const abrirRegistroAdminFiltro = () => {
    const opSeleccionado = operadoresTotales.find(op => op.nombre_completo === filtroUsuario);
    if (opSeleccionado) {
      setFormRegistroAdmin({ ...formRegistroAdmin, perfil_id: opSeleccionado.id });
      setRegistroAdminAbierto(true);
    }
  };

  const handleRegistroAdmin = async (e: any) => {
    e.preventDefault();
    if (!formRegistroAdmin.perfil_id) return toast.warning('Selecciona un operador');
    setLoading(true);
    try {
      const opSeleccionado = operadoresTotales.find(o => o.id === formRegistroAdmin.perfil_id);
      const unidadId = opSeleccionado?.unidades?.id || null;

      const { error } = await supabase.from('carreras').insert([{
        ...formRegistroAdmin, unidad_id: unidadId, valor: parseFloat(formRegistroAdmin.valor), ingreso_admin: true 
      }]);
      if (error) throw error;
      toast.success('Viaje registrado. Se aplicará $1.00 al operador.');
      setRegistroAdminAbierto(false);
      setFormRegistroAdmin({ ...formRegistroAdmin, hora_salida: '', cliente: '', servicio_a: '', inicio: '', destino: '', centro_costo: '', valor: '' });
      fetchDatos();
    } catch (err: any) { toast.error('Error al guardar'); } finally { setLoading(false); }
  };

  const handleCrearUsuario = async (e: any) => {
    e.preventDefault();
    setCreandoDato(true);
    try {
      const supabaseSecundario = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '', { auth: { persistSession: false, autoRefreshToken: false } });
      const { data: authData, error: authError } = await supabaseSecundario.auth.signUp({ email: formUsuario.email.trim(), password: formUsuario.password });
      if (authError) throw authError;

      if (authData.user) {
        let unidadId = null;
        const esConductor = formUsuario.rol === 'user' || formUsuario.rol === 'unidad' || formUsuario.rol === 'Operador (Conductor)';

        if (esConductor) {
          const { data: nuevaUnidad, error: unitError } = await supabase.from('unidades').insert([{ numero_equipo: formUsuario.numero_equipo, tipo_cuota: formUsuario.tipo_cuota, valor_cuota: parseFloat(formUsuario.valor_cuota || '0') }]).select().single();
          if (unitError) throw unitError;
          unidadId = nuevaUnidad.id; 
        }

        const { error: profileError } = await supabase.from('perfiles_usuario').upsert([{ id: authData.user.id, nombre_completo: formUsuario.nombre_completo, rol: esConductor ? 'unidad' : formUsuario.rol, proveedor_id: formUsuario.rol === 'proveedor' ? formUsuario.proveedor_id : null, unidad_id: unidadId }]);
        if (profileError) throw profileError;
        
        toast.success(esConductor ? 'Operador y Unidad registrados.' : 'Acceso registrado.');
        setFormUsuario({ email: '', password: '', nombre_completo: '', rol: 'unidad', proveedor_id: '', numero_equipo: '', tipo_cuota: 'Frecuencia', valor_cuota: '' });
        await fetchDatos();
      }
    } catch (err: any) { toast.error('Error: ' + err.message); }
    setCreandoDato(false);
  };

  const handleAltaRapida = async (e: any) => {
    e.preventDefault();
    setCreandoDato(true);
    try {
      const emailBase = formAltaRapida.username.trim().replace(/\s+/g, '').toLowerCase();
      const emailFormateado = emailBase.includes('@') ? emailBase : `${emailBase}@logic.com`;
      const supabaseSecundario = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '', { auth: { persistSession: false, autoRefreshToken: false } });
      const { data: authData, error: authError } = await supabaseSecundario.auth.signUp({ email: emailFormateado, password: formAltaRapida.password });
      if (authError) throw authError;

      if (authData.user) {
        const { data: nuevaUnidad, error: unitError } = await supabase.from('unidades').insert([{ numero_equipo: formAltaRapida.numero_equipo.trim().toUpperCase(), tipo_cuota: 'Frecuencia', valor_cuota: 0 }]).select().single();
        if (unitError) throw unitError;

        const { error: profileError } = await supabase.from('perfiles_usuario').insert([{ id: authData.user.id, nombre_completo: formAltaRapida.username.trim(), rol: 'unidad', unidad_id: nuevaUnidad.id }]);
        if (profileError) throw profileError;
        
        toast.success('Alta rápida exitosa.');
        setFormAltaRapida({ username: '', numero_equipo: '', password: '' });
        setAltaRapidaAbierta(false);
        fetchDatos(); 
      }
    } catch (err: any) { toast.error('Error: ' + err.message); }
    setCreandoDato(false);
  };

  const handleCrearProveedor = async (e: any) => {
    e.preventDefault();
    setCreandoDato(true);
    const { error } = await supabase.from('proveedores').insert([{ nombre_proveedor: formProveedor.nombre_proveedor, cuota_frecuencia: parseFloat(formProveedor.cuota_frecuencia || '0') }]);
    if (error) toast.error('Error: ' + error.message); else { toast.success('Proveedor creado.'); setFormProveedor({ nombre_proveedor: '', cuota_frecuencia: '' }); await fetchDatos(); }
    setCreandoDato(false);
  };

  const guardarEdicionUsuario = async () => {
    setGuardandoUsuario(true);
    try {
      const { error: errPerfil } = await supabase.from('perfiles_usuario').update({ nombre_completo: usuarioEditando.nombre_completo }).eq('id', usuarioEditando.id);
      if (errPerfil) throw errPerfil;
      if (usuarioEditando.unidad_id) {
        const { error: errUnidad } = await supabase.from('unidades').update({ tipo_cuota: usuarioEditando.tipo_cuota, valor_cuota: parseFloat(usuarioEditando.valor_cuota || 0) }).eq('id', usuarioEditando.unidad_id);
        if (errUnidad) throw errUnidad;
      }
      toast.success('Actualizado.'); setUsuarioEditando(null); fetchDatos();
    } catch (err: any) { toast.error('Error: ' + err.message); }
    setGuardandoUsuario(false);
  };

  const eliminarProveedor = async (id: string, nombre: string) => {
    if (!window.confirm(`¿Eliminar al proveedor "${nombre}"?`)) return;
    await supabase.from('perfiles_usuario').update({ proveedor_id: null }).eq('proveedor_id', id);
    await supabase.from('carreras').update({ proveedor_id: null }).eq('proveedor_id', id);
    await supabase.from('proveedores').delete().eq('id', id); fetchDatos();
  };

  const eliminarUnidad = async (id: string, equipo: string) => {
    if (!window.confirm(`¿Eliminar la unidad "${equipo}"?`)) return;
    await supabase.from('perfiles_usuario').update({ unidad_id: null }).eq('unidad_id', id);
    await supabase.from('carreras').update({ unidad_id: null }).eq('unidad_id', id);
    await supabase.from('unidades').delete().eq('id', id); fetchDatos();
  };

  const guardarEdicion = async () => {
    setGuardandoEdicion(true);
    const { error } = await supabase.from('carreras').update({
        cliente: carreraEditando.cliente, servicio_a: carreraEditando.servicio_a, inicio: carreraEditando.inicio,
        destino: carreraEditando.destino, valor: parseFloat(carreraEditando.valor),
        metodo_pago: carreraEditando.metodo_pago, exento_comision: carreraEditando.exento_comision,
        pagado: carreraEditando.pagado
      }).eq('id', carreraEditando.id);
    if (error) toast.error('Error: ' + error.message); else { toast.success('Actualizado.'); setCarreraEditando(null); fetchDatos(); }
    setGuardandoEdicion(false);
  };

  const eliminarCarrera = async (id: string) => {
    if (!window.confirm("¿Eliminar este viaje?")) return;
    await supabase.from('carreras').delete().eq('id', id); setCarreraEditando(null); fetchDatos();
  };

  const actualizarCuotaUnidad = async (id: string, equipo: string, tipo: string, valorActual: number) => {
    if (!id) return;
    const nuevoValor = prompt(`Nueva cuota para ${equipo}:`, valorActual.toString());
    if (nuevoValor === null || isNaN(parseFloat(nuevoValor))) return;
    await supabase.from('unidades').update({ valor_cuota: parseFloat(nuevoValor) }).eq('id', id); fetchDatos();
  };

  const actualizarCuotaProveedor = async (id: string, nombre: string, valorActual: number) => {
    if (!id) return;
    const nuevoValor = prompt(`Nueva frecuencia para ${nombre}:`, valorActual.toString());
    if (nuevoValor === null || isNaN(parseFloat(nuevoValor))) return;
    await supabase.from('proveedores').update({ cuota_frecuencia: parseFloat(nuevoValor) }).eq('id', id); fetchDatos();
  };

  if (verificandoSeguridad) return <div className="min-h-screen flex items-center justify-center bg-[#F2F2F7]"><div className="ios-spinner"></div></div>;

  const carrerasFiltradas = carreras.filter(c => {
    const coincideUsuario = filtroUsuario ? c.perfiles_usuario?.nombre_completo === filtroUsuario : true;
    const coincideProveedor = filtroProveedor ? c.proveedores?.nombre_proveedor === filtroProveedor : true;
    let coincideFecha = true;
    if (fechaInicio && fechaFin) coincideFecha = c.fecha >= fechaInicio && c.fecha <= fechaFin;
    else if (fechaInicio) coincideFecha = c.fecha >= fechaInicio;
    else if (fechaFin) coincideFecha = c.fecha <= fechaFin;
    return coincideUsuario && coincideProveedor && coincideFecha;
  });

  const resumenUsuarios: Record<string, any> = {};
  const resumenProveedores: Record<string, any> = {};

  proveedoresTotales.forEach(p => {
    if (filtroProveedor && filtroProveedor !== p.nombre_proveedor) return; 
    resumenProveedores[p.nombre_proveedor] = { proveedor: p.nombre_proveedor, proveedor_id: p.id, viajes: 0, bruto: 0, total_creditos: 0, comision_a_sumar: 0, cuota_frecuencia: parseFloat(p.cuota_frecuencia || 0) };
  });

  operadoresTotales.forEach(op => {
    if (filtroUsuario && filtroUsuario !== op.nombre_completo) return;
    resumenUsuarios[op.nombre_completo] = { id: op.id, usuario: op.nombre_completo, unidad: op.unidades?.numero_equipo || 'S/N', unidad_id: op.unidades?.id || null, viajes: 0, bruto: 0, creditos_a_favor: 0, comision_descontar: 0, tipo_cuota: op.unidades?.tipo_cuota || 'Frecuencia', valor_cuota: parseFloat(op.unidades?.valor_cuota || 0) };
  });

  carrerasFiltradas.forEach(c => {
    if (!incluirPagadosEnCalculo && c.pagado) return;

    const valor = parseFloat(c.valor || 0);
    const comision = (valor >= 6 && !c.exento_comision) ? (valor * 0.10) : 0;
    const penalidadAdmin = c.ingreso_admin ? 1.00 : 0; 
    
    const userKey = c.perfiles_usuario?.nombre_completo || 'Usuario Desconocido';
    const provKey = c.proveedores?.nombre_proveedor;
    const esCredito = c.metodo_pago === 'Credito';

    if (resumenUsuarios[userKey]) {
      resumenUsuarios[userKey].viajes += 1; 
      resumenUsuarios[userKey].bruto += valor; 
      resumenUsuarios[userKey].comision_descontar += (comision + penalidadAdmin);
      if (esCredito) resumenUsuarios[userKey].creditos_a_favor += valor;
    }
    
    if (provKey && resumenProveedores[provKey]) {
      resumenProveedores[provKey].viajes += 1; 
      resumenProveedores[provKey].bruto += valor; 
      resumenProveedores[provKey].comision_a_sumar += comision;
      if (esCredito) resumenProveedores[provKey].total_creditos += valor;
    }
  });

  const datosLiquidacionUsuarios = Object.values(resumenUsuarios).map(u => ({ ...u, neto: u.creditos_a_favor - u.comision_descontar - u.valor_cuota }));
  const datosLiquidacionProveedores = Object.values(resumenProveedores).map(p => ({ ...p, total_a_cancelar: p.total_creditos + p.comision_a_sumar + p.cuota_frecuencia }));

  // --- LÓGICA DE PDF Y MARCAR COMO PAGADO POR LOTES ---
  const generarPDF = async () => {
    if (carrerasFiltradas.length === 0) return alert("No hay datos para exportar.");
    const todasPagadas = carrerasFiltradas.every(c => c.pagado);

    if (todasPagadas && !window.confirm("✅ Todos estos viajes ya fueron PAGADOS.\n\n¿Descargar de todos modos como respaldo?")) return;

    const doc = new jsPDF();
    doc.setFontSize(18); doc.text('Reporte de Carreras - Grupo LOGIC', 14, 22);
    doc.setFontSize(11);
    
    let textoFiltro = `Generado el: ${new Date().toLocaleDateString()}`;
    if (fechaInicio && fechaFin) textoFiltro += ` | Período: ${fechaInicio.split('-').reverse().join('/')} al ${fechaFin.split('-').reverse().join('/')}`;
    if (filtroUsuario) textoFiltro += ` | Op: ${filtroUsuario}`;
    if (filtroProveedor) textoFiltro += ` | Prov: ${filtroProveedor}`;
    doc.text(textoFiltro, 14, 30);

    let startY = 38;

    if (filtroUsuario && datosLiquidacionUsuarios.length > 0) {
      const u = datosLiquidacionUsuarios[0]; 
      doc.setFont('', 'bold'); doc.text(`Liquidación de Unidad: ${u.usuario}`, 14, 40);
      doc.setFont('', 'normal'); doc.text(`Total Bruto: $${u.bruto.toFixed(2)}`, 14, 47); doc.text(`Credito a favor: $${u.creditos_a_favor.toFixed(2)}`, 14, 53);
      doc.text(`Comisiones/Multas: -$${u.comision_descontar.toFixed(2)}`, 14, 59); doc.text(`Frecuencia: -$${u.valor_cuota.toFixed(2)}`, 14, 65);
      doc.setFont('', 'bold'); doc.text(`Total Pagar: $${u.neto.toFixed(2)}`, 14, 73);
      startY = 82; 
    } else if (filtroProveedor && datosLiquidacionProveedores.length > 0) {
      const p = datosLiquidacionProveedores[0]; 
      doc.setFont('', 'bold'); doc.text(`Liquidación de Proveedor: ${p.proveedor}`, 14, 40);
      doc.setFont('', 'normal'); doc.text(`Total Bruto: $${p.bruto.toFixed(2)}`, 14, 47); doc.text(`Credito a pagar: $${p.total_creditos.toFixed(2)}`, 14, 53);
      doc.text(`Comisiones (+10%): +$${p.comision_a_sumar.toFixed(2)}`, 14, 59); doc.text(`Frecuencia: +$${p.cuota_frecuencia.toFixed(2)}`, 14, 65); 
      doc.setFont('', 'bold'); doc.text(`Total a Pagar: $${p.total_a_cancelar.toFixed(2)}`, 14, 73);
      startY = 82; 
    }

    const tableData = carrerasFiltradas.map(c => {
      const valorNum = parseFloat(c.valor || 0); 
      const comisionNum = (valorNum >= 6 && !c.exento_comision) ? (valorNum * 0.10) : 0;
      const penalidadAdmin = c.ingreso_admin ? '\n-$1.00 (Admin)' : '';
      const estado = c.pagado ? '[PAGADO]' : '';
      const detalleFinanzas = `$${valorNum.toFixed(2)} (${c.metodo_pago})\n${comisionNum > 0 ? `Com. $${comisionNum.toFixed(2)}` : 'Sin Com.'}${penalidadAdmin}`;
      return [ `${c.fecha}\n${c.hora_salida} ${estado}`, `${c.cliente}\n(${c.servicio_a})`, `${c.inicio} ->\n${c.destino}`, c.perfiles_usuario?.nombre_completo || 'N/A', `${c.proveedores?.nombre_proveedor || 'N/A'} - U:${c.unidades?.numero_equipo || ''}`, detalleFinanzas ];
    });

    autoTable(doc, { startY: startY, head: [['Fecha/Hora', 'Cliente', 'Ruta', 'Operador', 'Logística', 'Finanzas']], body: tableData, theme: 'grid', styles: { fontSize: 8, cellPadding: 3 }, headStyles: { fillColor: [0, 0, 0] } });
    doc.save('Reporte_LOGIC.pdf');

    // SOLUCIÓN AL BUG DE DATOS NO ACTUALIZADOS (CHUNK UPDATE)
    if (!todasPagadas && window.confirm("📄 PDF Generado.\n\n¿Deseas marcar las carreras como PAGADAS para que se sombreen de rojo?")) {
      const carrerasParaPagar = carrerasFiltradas.filter(c => !c.pagado).map(c => c.id);
      
      toast.info('Actualizando base de datos...');
      
      try {
        // Ejecutamos la actualización en "Lotes" (Chunks) de 100 en 100 para no saturar a Supabase
        for (let i = 0; i < carrerasParaPagar.length; i += 100) {
          const lote = carrerasParaPagar.slice(i, i + 100);
          const { error } = await supabase.from('carreras').update({ pagado: true }).in('id', lote);
          if (error) throw error;
        }
        
        toast.success('✅ Todas las carreras marcadas como PAGADAS.');
        fetchDatos(); // Refrescamos para pintar el color rojo en todos lados
      } catch (err: any) {
        toast.error('Error al actualizar los pagos: ' + err.message);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#F2F2F7] pb-10 font-[-apple-system,BlinkMacSystemFont,sans-serif] text-black">
      <ToastContainer position="top-center" />
      <nav className="bg-[#F2F2F7] pt-12 pb-4 px-6 md:px-10 sticky top-0 z-20 backdrop-blur-xl bg-opacity-80 border-b border-[#C6C6C8]/30">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <p className="text-[#8E8E93] text-[13px] font-bold uppercase tracking-widest mb-1">Liquidaciones & Reportes</p>
            <h1 className="text-3xl md:text-4xl font-black text-black tracking-tighter">Panel Admin</h1>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setAltaRapidaAbierta(true)} className="bg-[#FF9F0A] text-white px-4 py-2.5 rounded-xl font-bold active:scale-95 transition-transform shadow-sm">⚡ Alta Rápida</button>
            <button onClick={() => setDirectorioAbierto(true)} className="bg-white text-[#007AFF] px-4 py-2.5 rounded-xl font-bold active:scale-95 transition-transform shadow-sm">👥 Directorio</button>
            <button onClick={generarPDF} className="bg-black text-white px-4 py-2.5 rounded-xl font-bold active:scale-95 transition-transform shadow-sm flex items-center gap-2">Exportar y Pagar</button>
            <button onClick={() => { supabase.auth.signOut(); router.push('/'); }} className="bg-[#FF3B30]/10 text-[#FF3B30] px-4 py-2.5 rounded-xl font-bold active:scale-95 transition-transform">Salir</button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 md:px-10 mt-6">
        
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-white mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <div className="flex justify-between items-center mb-2 ml-2">
                 <label className="text-[11px] font-black text-[#8E8E93] uppercase tracking-widest">Operador</label>
                 {filtroUsuario && (
                   <button onClick={abrirRegistroAdminFiltro} className="text-[10px] font-bold text-white bg-[#5856D6] px-3 py-1 rounded-full shadow-sm active:scale-95 transition-transform uppercase tracking-wider animate-slide-up">
                     + Multa ($1.00)
                   </button>
                 )}
              </div>
              <select value={filtroUsuario} onChange={(e) => setFiltroUsuario(e.target.value)} className="w-full bg-[#F2F2F7] px-4 py-3.5 rounded-2xl font-bold outline-none appearance-none text-black">
                <option value="">Todos los operadores</option>
                {operadoresTotales.map((op: any) => <option key={op.id} value={op.nombre_completo}>{op.nombre_completo}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-black text-[#8E8E93] uppercase tracking-widest mb-2 ml-2 mt-1">Proveedor</label>
              <select value={filtroProveedor} onChange={(e) => setFiltroProveedor(e.target.value)} className="w-full bg-[#F2F2F7] px-4 py-3.5 rounded-2xl font-bold outline-none appearance-none text-black">
                <option value="">Todos los proveedores</option>
                {proveedoresTotales.map((prov: any) => <option key={prov.id} value={prov.nombre_proveedor}>{prov.nombre_proveedor}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end border-t border-[#C6C6C8]/20 pt-6">
            <div>
              <label className="block text-[11px] font-black text-[#8E8E93] uppercase tracking-widest mb-2 ml-2">Desde</label>
              <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="w-full bg-[#F2F2F7] px-4 py-3.5 rounded-2xl font-bold outline-none text-black" />
            </div>
            <div>
              <label className="block text-[11px] font-black text-[#8E8E93] uppercase tracking-widest mb-2 ml-2">Hasta</label>
              <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="w-full bg-[#F2F2F7] px-4 py-3.5 rounded-2xl font-bold outline-none text-black" />
            </div>
            <button onClick={limpiarFiltros} className="w-full py-3.5 bg-white text-[#FF3B30] font-bold rounded-2xl border border-[#FF3B30]/20 active:bg-[#FF3B30]/10 transition-colors">Limpiar Filtros</button>
          </div>
        </div>

        {!loading && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-3xl shadow-sm overflow-hidden border border-white">
              <div className="bg-[#F2F2F7]/50 px-6 py-4 border-b border-[#C6C6C8]/30 flex justify-between items-center">
                <h3 className="font-black text-black uppercase tracking-widest text-[13px]">Liquidación Operadores</h3>
                <button 
                  onClick={() => setIncluirPagadosEnCalculo(!incluirPagadosEnCalculo)} 
                  className={`text-[9px] uppercase tracking-widest px-2 py-1 rounded-md shadow-sm border transition-colors active:scale-95 ${incluirPagadosEnCalculo ? 'bg-[#007AFF] text-white border-[#007AFF]' : 'bg-white text-[#8E8E93] border-[#C6C6C8]/20'}`}
                >
                  {incluirPagadosEnCalculo ? 'Incluyendo Pagados' : 'Ocultar Pagados'}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-white border-b border-[#C6C6C8]/30">
                    <tr>
                      <th className="px-6 py-3 text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider">Unidad</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider text-right">Crédito</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider text-right">Desc.</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-black uppercase tracking-wider text-right">Neto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#C6C6C8]/20">
                    {datosLiquidacionUsuarios.length > 0 ? datosLiquidacionUsuarios.map((u, i) => (
                      <tr key={i} className="hover:bg-[#F2F2F7]/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-[#007AFF] cursor-pointer" onClick={() => setUsuarioEditando({ id: u.id, nombre_completo: u.usuario, unidad_id: u.unidad_id, numero_equipo: u.unidad, tipo_cuota: u.tipo_cuota, valor_cuota: u.valor_cuota })}>{u.usuario} <span className="text-xs opacity-50">✏️</span></div>
                          <div className="text-xs text-[#8E8E93] font-medium mt-1 flex items-center gap-2">U: {u.unidad} {u.unidad_id && <button onClick={() => eliminarUnidad(u.unidad_id, u.unidad)} className="text-[10px] text-[#FF3B30] bg-[#FF3B30]/10 px-1.5 rounded">🗑️</button>}</div>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-[#34C759]">${u.creditos_a_favor.toFixed(2)}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="text-[#FF3B30] font-bold">-${u.comision_descontar.toFixed(2)}</div>
                          <div className="text-[10px] text-[#8E8E93] flex justify-end items-center mt-1">-${u.valor_cuota.toFixed(2)} <span className="uppercase mx-1">({u.tipo_cuota.substring(0,4)})</span><button onClick={() => actualizarCuotaUnidad(u.unidad_id, u.unidad, u.tipo_cuota, u.valor_cuota)}>✏️</button></div>
                        </td>
                        <td className="px-6 py-4 text-right font-black text-lg">${u.neto.toFixed(2)}</td>
                      </tr>
                    )) : <tr><td colSpan={4} className="p-8 text-center text-[#8E8E93] font-medium">No hay operadores para calcular</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm overflow-hidden border border-white">
              <div className="bg-[#F2F2F7]/50 px-6 py-4 border-b border-[#C6C6C8]/30 flex justify-between items-center">
                <h3 className="font-black text-black uppercase tracking-widest text-[13px]">Liquidación Proveedores</h3>
                <button 
                  onClick={() => setIncluirPagadosEnCalculo(!incluirPagadosEnCalculo)} 
                  className={`text-[9px] uppercase tracking-widest px-2 py-1 rounded-md shadow-sm border transition-colors active:scale-95 ${incluirPagadosEnCalculo ? 'bg-[#007AFF] text-white border-[#007AFF]' : 'bg-white text-[#8E8E93] border-[#C6C6C8]/20'}`}
                >
                  {incluirPagadosEnCalculo ? 'Incluyendo Pagados' : 'Ocultar Pagados'}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-white border-b border-[#C6C6C8]/30">
                    <tr>
                      <th className="px-6 py-3 text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider">Proveedor</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider text-right">Crédito</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider text-right">+ Comisiones</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-black uppercase tracking-wider text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#C6C6C8]/20">
                    {datosLiquidacionProveedores.length > 0 ? datosLiquidacionProveedores.map((p, i) => (
                      <tr key={i} className="hover:bg-[#F2F2F7]/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-black">{p.proveedor} {p.proveedor_id && <button onClick={() => eliminarProveedor(p.proveedor_id, p.proveedor)} className="ml-2 text-[10px] text-[#FF3B30] bg-[#FF3B30]/10 px-1.5 rounded">🗑️</button>}</td>
                        <td className="px-6 py-4 text-right font-bold text-[#007AFF]">${p.total_creditos.toFixed(2)}</td>
                        <td className="px-6 py-4 text-right text-[#34C759] font-bold flex flex-col justify-end items-end pt-5">
                          +${p.comision_a_sumar.toFixed(2)}
                          <div className="text-[10px] text-[#8E8E93] mt-1 flex items-center">+ Frec. ${p.cuota_frecuencia.toFixed(2)} <button onClick={() => actualizarCuotaProveedor(p.proveedor_id, p.proveedor, p.cuota_frecuencia)} className="ml-1">✏️</button></div>
                        </td>
                        <td className="px-6 py-4 text-right font-black text-lg">${p.total_a_cancelar.toFixed(2)}</td>
                      </tr>
                    )) : <tr><td colSpan={4} className="p-8 text-center text-[#8E8E93] font-medium">No hay proveedores para calcular</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <h3 className="font-black text-[#8E8E93] uppercase tracking-widest text-[13px] ml-2 mb-4">Desglose General ({carrerasFiltradas.length})</h3>
        <div className="bg-white rounded-3xl shadow-sm border border-white overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#F2F2F7]/50 border-b border-[#C6C6C8]/30">
                <tr>
                  <th className="px-6 py-4 text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider">Fecha / Ruta</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider">Servicio</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider">Operador</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider text-right">Finanzas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#C6C6C8]/20">
                {carrerasFiltradas.map((c) => {
                  const valorNum = parseFloat(c.valor || 0);
                  const comisionNum = (valorNum >= 6 && !c.exento_comision) ? (valorNum * 0.10) : 0;
                  return (
                    <tr key={c.id} onClick={() => setCarreraEditando(c)} className={`cursor-pointer transition-colors group ${c.pagado ? 'bg-[#FF3B30]/5 hover:bg-[#FF3B30]/10 border-l-4 border-l-[#FF3B30]' : 'hover:bg-[#F2F2F7]/50 border-l-4 border-l-transparent'}`}>
                      <td className="px-6 py-5">
                        <div className={`font-bold text-[15px] ${c.pagado ? 'text-[#FF3B30]' : 'text-black'}`}>{c.fecha.split('-').reverse().join('/')} <span className={`${c.pagado ? 'text-[#FF3B30]/70' : 'text-[#8E8E93]'} text-xs ml-1`}>{c.hora_salida.substring(0, 5)}</span></div>
                        <div className={`text-[13px] font-medium mt-1 ${c.pagado ? 'text-[#FF3B30]/80' : 'text-[#8E8E93]'}`}>{c.inicio} → {c.destino}</div>
                      </td>
                      <td className="px-6 py-5">
                        <div className={`font-bold ${c.pagado ? 'text-[#FF3B30]' : 'text-black'}`}>{c.cliente}</div>
                        <div className={`text-[13px] mt-1 ${c.pagado ? 'text-[#FF3B30]/80' : 'text-[#8E8E93]'}`}>{c.servicio_a} {c.centro_costo && <span className="ml-1 bg-white/50 px-1.5 rounded">CC: {c.centro_costo}</span>}</div>
                      </td>
                      <td className="px-6 py-5">
                        <div className={`font-bold ${c.pagado ? 'text-[#FF3B30]' : 'text-black'}`}>{c.perfiles_usuario?.nombre_completo}</div>
                        <div className={`text-[12px] font-medium mt-1 ${c.pagado ? 'text-[#FF3B30]/80' : 'text-[#8E8E93]'}`}>{c.proveedores?.nombre_proveedor} (U:{c.unidades?.numero_equipo})</div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className={`font-black text-xl flex justify-end items-center gap-2 ${c.pagado ? 'text-[#FF3B30]' : 'text-black'}`}>
                          {c.ingreso_admin && <span className="text-[10px] bg-[#5856D6] text-white px-2 py-0.5 rounded-full uppercase tracking-widest shadow-sm">Admin</span>}
                          ${valorNum.toFixed(2)}
                        </div>
                        <div className="flex flex-col items-end gap-1 mt-1">
                          <span className={`text-[9px] px-2 py-0.5 rounded uppercase font-black tracking-wider ${c.pagado ? 'bg-[#FF3B30]/20 text-[#FF3B30]' : 'bg-[#F2F2F7] text-[#007AFF]'}`}>{c.metodo_pago}</span>
                          {c.pagado ? (
                             <span className="text-[10px] text-[#FF3B30] font-black uppercase mt-1 tracking-widest border border-[#FF3B30] px-2 rounded">PAGADO</span>
                          ) : (
                             comisionNum > 0 ? <span className="text-[10px] text-[#FF3B30] font-bold">- ${comisionNum.toFixed(2)} Com.</span> : c.exento_comision && <span className="text-[10px] text-[#34C759] font-bold">Exento</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* --- MODALES --- */}
      {altaRapidaAbierta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setAltaRapidaAbierta(false)}></div>
          <div className="relative bg-[#F2F2F7] w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden border border-white/20 animate-slide-up">
            <div className="bg-white px-6 py-5 text-center border-b border-[#C6C6C8]/30 relative">
              <h2 className="font-black text-black tracking-tighter uppercase text-lg">Alta Rápida</h2>
              <button onClick={() => setAltaRapidaAbierta(false)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#007AFF] font-bold text-sm bg-[#F2F2F7] px-3 py-1 rounded-full">Listo</button>
            </div>
            <form onSubmit={handleAltaRapida} className="p-4 space-y-4">
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
                <IOSRow label="Usuario" value={formAltaRapida.username} onChange={(e:any)=>setFormAltaRapida({...formAltaRapida, username: e.target.value})} placeholder="Ej: Juan Perez" />
                <IOSRow label="Unidad" value={formAltaRapida.numero_equipo} onChange={(e:any)=>setFormAltaRapida({...formAltaRapida, numero_equipo: e.target.value})} placeholder="Ej: U-19" />
                <IOSRow label="Clave" border={false} value={formAltaRapida.password} onChange={(e:any)=>setFormAltaRapida({...formAltaRapida, password: e.target.value})} placeholder="Mínimo 6" type="text" />
              </div>
              <button type="submit" disabled={creandoDato} className="w-full bg-[#007AFF] text-white py-4 rounded-2xl font-bold text-lg shadow-sm active:opacity-80 disabled:bg-[#C7C7CC]">{creandoDato ? 'Creando...' : 'Crear Acceso'}</button>
            </form>
          </div>
        </div>
      )}

      {directorioAbierto && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDirectorioAbierto(false)}></div>
          <div className="relative bg-[#F2F2F7] w-full max-w-2xl h-[90vh] md:h-auto md:max-h-[90vh] rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-slide-up">
            <div className="md:hidden w-12 h-1.5 bg-[#C7C7CC] rounded-full mx-auto mt-3 mb-1"></div>
            <div className="px-6 py-4 flex justify-between items-center">
              <h2 className="text-2xl font-black text-black tracking-tighter uppercase">Directorio</h2>
              <button onClick={() => setDirectorioAbierto(false)} className="bg-[#007AFF] text-white px-4 py-1.5 rounded-full font-bold text-xs shadow-sm">CERRAR</button>
            </div>
            <div className="bg-[#E3E3E8] p-1 rounded-xl flex mx-6 mt-2 mb-4">
              <button onClick={() => setDirTab('usuarios')} className={`flex-1 py-2 rounded-lg text-[13px] font-bold transition-all ${dirTab === 'usuarios' ? 'bg-white text-black shadow-sm' : 'text-[#8E8E93]'}`}>Operadores</button>
              <button onClick={() => setDirTab('proveedores')} className={`flex-1 py-2 rounded-lg text-[13px] font-bold transition-all ${dirTab === 'proveedores' ? 'bg-white text-black shadow-sm' : 'text-[#8E8E93]'}`}>Proveedores</button>
            </div>
            <div className="overflow-y-auto px-6 pb-10 flex-1">
              {dirTab === 'usuarios' && (
                <form onSubmit={handleCrearUsuario} className="space-y-6">
                  <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
                    <IOSRow label="Correo" type="email" required value={formUsuario.email} onChange={(e:any)=>setFormUsuario({...formUsuario, email: e.target.value})} placeholder="nuevo@logic.com" />
                    <IOSRow label="Clave" required value={formUsuario.password} onChange={(e:any)=>setFormUsuario({...formUsuario, password: e.target.value})} placeholder="Mínimo 6" />
                    <IOSRow label="Nombre" required value={formUsuario.nombre_completo} onChange={(e:any)=>setFormUsuario({...formUsuario, nombre_completo: e.target.value})} placeholder="Nombre Real" border={false} />
                  </div>
                  <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
                    <div className="flex items-center px-4 py-3 min-h-[50px] border-b border-[#C6C6C8]/30">
                      <label className="w-28 text-[13px] text-[#8E8E93] font-bold uppercase">Rol</label>
                      <select value={formUsuario.rol} onChange={e=>setFormUsuario({...formUsuario, rol: e.target.value})} className="flex-1 bg-transparent text-right outline-none font-bold text-black appearance-none"><option value="unidad">Operador</option><option value="proveedor">Proveedor</option><option value="admin">Admin</option></select>
                    </div>
                    {formUsuario.rol === 'proveedor' && (
                      <div className="flex items-center px-4 py-3 min-h-[50px]">
                        <label className="w-28 text-[13px] text-[#8E8E93] font-bold uppercase">Empresa</label>
                        <select required value={formUsuario.proveedor_id} onChange={e=>setFormUsuario({...formUsuario, proveedor_id: e.target.value})} className="flex-1 bg-transparent text-right outline-none font-bold text-black appearance-none"><option value="">Seleccionar...</option>{proveedoresTotales.map(p => <option key={p.id} value={p.id}>{p.nombre_proveedor}</option>)}</select>
                      </div>
                    )}
                  </div>
                  {(formUsuario.rol === 'user' || formUsuario.rol === 'unidad') && (
                    <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
                      <div className="bg-[#F2F2F7]/50 px-4 py-2 border-b border-[#C6C6C8]/30"><span className="text-[10px] font-black text-[#8E8E93] uppercase">Datos de Unidad</span></div>
                      <IOSRow label="Unidad" required value={formUsuario.numero_equipo} onChange={(e:any)=>setFormUsuario({...formUsuario, numero_equipo: e.target.value})} placeholder="U-01" />
                      <div className="flex items-center px-4 py-3 min-h-[50px] border-b border-[#C6C6C8]/30">
                        <label className="w-28 text-[13px] text-[#8E8E93] font-bold uppercase">Tipo Cuota</label>
                        <select value={formUsuario.tipo_cuota} onChange={e=>setFormUsuario({...formUsuario, tipo_cuota: e.target.value})} className="flex-1 bg-transparent text-right outline-none font-bold text-black appearance-none"><option value="Frecuencia">Frecuencia</option><option value="Cuadre">Cuadre</option></select>
                      </div>
                      <IOSRow label="Cuota $" type="number" step="0.01" required value={formUsuario.valor_cuota} onChange={(e:any)=>setFormUsuario({...formUsuario, valor_cuota: e.target.value})} placeholder="0.00" border={false} />
                    </div>
                  )}
                  <button type="submit" disabled={creandoDato} className="w-full bg-[#007AFF] text-white py-4 rounded-2xl font-bold text-lg active:scale-95 transition-transform disabled:bg-[#C7C7CC]">Guardar Nuevo</button>
                </form>
              )}
              {dirTab === 'proveedores' && (
                <form onSubmit={handleCrearProveedor} className="space-y-6">
                   <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
                      <IOSRow label="Nombre" required value={formProveedor.nombre_proveedor} onChange={(e:any)=>setFormProveedor({...formProveedor, nombre_proveedor: e.target.value})} placeholder="Empresa S.A." />
                      <IOSRow label="Frecuencia $" type="number" step="0.01" required value={formProveedor.cuota_frecuencia} onChange={(e:any)=>setFormProveedor({...formProveedor, cuota_frecuencia: e.target.value})} placeholder="0.00" border={false}/>
                   </div>
                   <button type="submit" disabled={creandoDato} className="w-full bg-[#007AFF] text-white py-4 rounded-2xl font-bold text-lg active:scale-95 transition-transform disabled:bg-[#C7C7CC]">Guardar Proveedor</button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {carreraEditando && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setCarreraEditando(null)}></div>
          <div className="relative bg-[#F2F2F7] w-full max-w-lg rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] animate-slide-up">
            <div className="md:hidden w-12 h-1.5 bg-[#C7C7CC] rounded-full mx-auto mt-3 mb-1"></div>
            <div className="px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-black text-black tracking-tighter uppercase">Editar Viaje</h2>
              <button onClick={() => eliminarCarrera(carreraEditando.id)} className="bg-[#FF3B30]/10 text-[#FF3B30] p-2 rounded-full font-bold text-[10px] px-4">ELIMINAR</button>
            </div>
            <div className="overflow-y-auto px-6 pb-8 space-y-4">
              <div className={`rounded-2xl p-4 shadow-sm flex items-center justify-between border ${carreraEditando.pagado ? 'bg-[#FF3B30]/10 border-[#FF3B30]/30' : 'bg-white border-transparent'}`}>
                 <span className={`font-black text-sm uppercase tracking-wider ${carreraEditando.pagado ? 'text-[#FF3B30]' : 'text-black'}`}>Estado del Pago</span>
                 <label className="flex items-center gap-3 cursor-pointer">
                   <span className={`text-xs font-bold ${carreraEditando.pagado ? 'text-[#FF3B30]' : 'text-[#8E8E93]'}`}>{carreraEditando.pagado ? 'PAGADO' : 'PENDIENTE'}</span>
                   <input type="checkbox" checked={carreraEditando.pagado || false} onChange={e => setCarreraEditando({...carreraEditando, pagado: e.target.checked})} className="w-6 h-6 accent-[#FF3B30]" />
                 </label>
              </div>
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
                <IOSRow label="Valor $" type="number" step="0.01" value={carreraEditando.valor} onChange={(e:any) => setCarreraEditando({...carreraEditando, valor: e.target.value})} />
                <div className="flex items-center px-4 py-3 min-h-[50px] border-b border-[#C6C6C8]/30">
                  <label className="w-24 text-[13px] text-[#8E8E93] font-bold uppercase">Pago</label>
                  <select value={carreraEditando.metodo_pago} onChange={e => setCarreraEditando({...carreraEditando, metodo_pago: e.target.value})} className="flex-1 bg-transparent text-right outline-none font-bold text-black appearance-none"><option value="Efectivo">Efectivo</option><option value="Credito">Crédito</option><option value="Transferencia">Transferencia</option></select>
                </div>
                <IOSRow label="Cliente" value={carreraEditando.cliente} onChange={(e:any) => setCarreraEditando({...carreraEditando, cliente: e.target.value})} border={false} />
              </div>
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
                <IOSRow label="De" value={carreraEditando.inicio} onChange={(e:any) => setCarreraEditando({...carreraEditando, inicio: e.target.value})} />
                <IOSRow label="A" value={carreraEditando.destino} onChange={(e:any) => setCarreraEditando({...carreraEditando, destino: e.target.value})} border={false} />
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
                 <span className="font-bold text-black text-sm">Exento de Comisión (10%)</span>
                 <input type="checkbox" checked={carreraEditando.exento_comision || false} onChange={e => setCarreraEditando({...carreraEditando, exento_comision: e.target.checked})} className="w-6 h-6 accent-[#34C759]" />
              </div>
              <div className="flex gap-4 pt-2">
                <button onClick={() => setCarreraEditando(null)} className="flex-1 bg-white text-black font-bold py-4 rounded-xl shadow-sm border border-[#C6C6C8]/30">Cancelar</button>
                <button onClick={guardarEdicion} disabled={guardandoEdicion} className="flex-1 bg-[#007AFF] text-white font-bold py-4 rounded-xl shadow-md active:scale-95 disabled:bg-[#C7C7CC]">Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {usuarioEditando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setUsuarioEditando(null)}></div>
          <div className="relative bg-[#F2F2F7] w-full max-w-md rounded-[2.5rem] shadow-2xl flex flex-col animate-slide-up overflow-hidden">
            <div className="px-6 py-5 flex justify-between items-center bg-white border-b border-[#C6C6C8]/30">
              <h2 className="text-lg font-black text-black tracking-tighter uppercase">Editar Operador</h2>
            </div>
            <div className="p-6 space-y-5">
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-[#C6C6C8]/30">
                <IOSRow label="Nombre" value={usuarioEditando.nombre_completo} onChange={(e:any) => setUsuarioEditando({...usuarioEditando, nombre_completo: e.target.value})} />
                <div className="flex items-center px-4 py-3 min-h-[50px] border-b border-[#C6C6C8]/30 bg-gray-50">
                  <label className="w-24 text-[13px] text-[#8E8E93] font-bold uppercase">Unidad</label>
                  <input className="flex-1 bg-transparent text-right outline-none font-bold text-gray-400" value={usuarioEditando.numero_equipo} disabled />
                </div>
                <div className="flex items-center px-4 py-3 min-h-[50px] border-b border-[#C6C6C8]/30">
                  <label className="w-24 text-[13px] text-[#8E8E93] font-bold uppercase">Tipo Cuota</label>
                  <select value={usuarioEditando.tipo_cuota} onChange={e => setUsuarioEditando({...usuarioEditando, tipo_cuota: e.target.value})} className="flex-1 bg-transparent text-right outline-none font-bold text-black appearance-none"><option value="Frecuencia">Frecuencia</option><option value="Cuadre">Cuadre</option></select>
                </div>
                <IOSRow label="Valor $" type="number" step="0.01" value={usuarioEditando.valor_cuota} onChange={(e:any) => setUsuarioEditando({...usuarioEditando, valor_cuota: e.target.value})} border={false} />
              </div>
              <div className="flex gap-4">
                <button onClick={() => setUsuarioEditando(null)} className="flex-1 bg-white text-black font-bold py-3.5 rounded-xl shadow-sm border border-[#C6C6C8]/30">Cancelar</button>
                <button onClick={guardarEdicionUsuario} disabled={guardandoUsuario} className="flex-1 bg-[#007AFF] text-white font-bold py-3.5 rounded-xl shadow-md active:scale-95 disabled:bg-[#C7C7CC]">Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {registroAdminAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setRegistroAdminAbierto(false)}></div>
          <div className="relative bg-[#F2F2F7] w-full max-w-lg rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-slide-up max-h-[90vh]">
            <div className="px-6 py-4 flex justify-between items-center bg-white border-b border-[#C6C6C8]/30">
              <h2 className="text-lg font-black text-[#5856D6] tracking-tighter uppercase">Viaje con Multa ($1)</h2>
              <button onClick={() => setRegistroAdminAbierto(false)} className="bg-[#F2F2F7] text-black px-3 py-1 rounded-full font-bold text-xs">Cerrar</button>
            </div>
            <form onSubmit={handleRegistroAdmin} className="overflow-y-auto p-6 space-y-4">
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
                <div className="flex items-center px-4 py-3 min-h-[50px] border-b border-[#C6C6C8]/30 bg-[#F2F2F7]/50">
                  <label className="w-24 text-[13px] text-[#8E8E93] font-bold uppercase">Operador</label>
                  <select required disabled value={formRegistroAdmin.perfil_id} onChange={e => setFormRegistroAdmin({...formRegistroAdmin, perfil_id: e.target.value})} className="flex-1 bg-transparent text-right outline-none font-bold text-black appearance-none opacity-80">
                    <option value="">Seleccionar...</option>
                    {operadoresTotales.map(op => <option key={op.id} value={op.id}>{op.nombre_completo}</option>)}
                  </select>
                </div>
                <div className="flex items-center px-4 py-3 min-h-[50px] border-b border-[#C6C6C8]/30">
                  <label className="w-24 text-[13px] text-[#8E8E93] font-bold uppercase">Proveedor</label>
                  <select required value={formRegistroAdmin.proveedor_id} onChange={e => setFormRegistroAdmin({...formRegistroAdmin, proveedor_id: e.target.value})} className="flex-1 bg-transparent text-right outline-none font-bold text-black appearance-none">
                    <option value="">Seleccionar...</option>
                    {proveedoresTotales.map(p => <option key={p.id} value={p.id}>{p.nombre_proveedor}</option>)}
                  </select>
                </div>
              </div>
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
                <IOSRow label="Fecha" type="date" value={formRegistroAdmin.fecha} onChange={(e:any) => setFormRegistroAdmin({...formRegistroAdmin, fecha: e.target.value})} />
                <IOSRow label="Salida" type="time" value={formRegistroAdmin.hora_salida} onChange={(e:any) => setFormRegistroAdmin({...formRegistroAdmin, hora_salida: e.target.value})} border={false}/>
              </div>
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
                 <IOSRow label="Cliente" value={formRegistroAdmin.cliente} onChange={(e:any) => setFormRegistroAdmin({...formRegistroAdmin, cliente: e.target.value})} />
                 <IOSRow label="De" value={formRegistroAdmin.inicio} onChange={(e:any) => setFormRegistroAdmin({...formRegistroAdmin, inicio: e.target.value})} />
                 <IOSRow label="A" value={formRegistroAdmin.destino} onChange={(e:any) => setFormRegistroAdmin({...formRegistroAdmin, destino: e.target.value})} border={false} />
              </div>
              <div className="bg-[#E3E3E8] p-1 rounded-xl flex gap-1 shadow-inner">
                {['Efectivo', 'Credito', 'Transferencia'].map((m) => (
                  <button key={m} type="button" onClick={() => setFormRegistroAdmin({...formRegistroAdmin, metodo_pago: m})} className={`flex-1 py-2 rounded-lg text-xs font-black transition-all uppercase ${formRegistroAdmin.metodo_pago === m ? 'bg-white text-black shadow-sm' : 'text-[#8E8E93]'}`}>{m}</button>
                ))}
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm flex justify-between items-center">
                <span className="text-sm font-black uppercase">Valor Total</span>
                <div className="flex items-center text-3xl font-black">
                  <span className="text-[#007AFF] mr-1">$</span>
                  <input type="number" step="0.01" required value={formRegistroAdmin.valor} onChange={e => setFormRegistroAdmin({...formRegistroAdmin, valor: e.target.value})} className="w-24 text-right outline-none bg-transparent placeholder:opacity-30" placeholder="0.00"/>
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full bg-[#5856D6] text-white py-4 rounded-2xl font-bold text-lg active:scale-95 mt-4 disabled:bg-gray-400">
                Guardar con Multa ($1.00)
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
    <div className={`flex items-center px-4 py-3 min-h-[50px] ${border ? 'border-b border-[#C6C6C8]/30' : ''}`}>
      <label className="w-24 text-[13px] text-[#8E8E93] font-bold uppercase tracking-tight">{label}</label>
      <input className="flex-1 bg-transparent text-right outline-none font-bold text-black placeholder:opacity-30" {...props} />
    </div>
  );
}