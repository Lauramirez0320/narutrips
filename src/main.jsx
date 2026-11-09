import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Plane, CalendarDays, Wallet, Plus, Trash2, ChevronLeft, ChevronRight,
  MapPin, CheckCircle2, BriefcaseBusiness, Clock3, Sparkles, Info, X, LogOut
} from "lucide-react";
import { supabase, supabaseConfigError } from "./lib/supabase";
import "./style.css";
import "./auth.css";

const START_MONTH = "2026-11";
const HOLIDAYS = [
  ["2026-11-02","Todos los Santos"],
  ["2026-12-08","Inmaculada Concepción"],["2026-12-25","Navidad"],
  ["2027-01-01","Año Nuevo"],["2027-01-11","Día de los Reyes Magos"],
  ["2027-03-22","Día de San José"],["2027-03-25","Jueves Santo"],["2027-03-26","Viernes Santo"],
  ["2027-05-01","Día del Trabajo"],["2027-05-10","Ascensión del Señor"],["2027-05-31","Corpus Christi"],
  ["2027-06-07","Sagrado Corazón"],["2027-06-28","San Pedro y San Pablo"],["2027-07-20","Independencia de Colombia"],
  ["2027-08-07","Batalla de Boyacá"],["2027-08-16","Asunción de la Virgen"],["2027-10-18","Día de la Raza"],
  ["2027-11-01","Todos los Santos"],
  ["2027-12-08","Inmaculada Concepción"],["2027-12-25","Navidad"]
].map(([date,name])=>({date,name}));

const money = n => new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(Number(n||0));
const monthLabel = key => new Date(key+"-15T12:00:00").toLocaleDateString("es-CO",{month:"long",year:"numeric"});
const monthKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
const dateKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const parseDate = s => new Date(s+"T12:00:00");
const addMonths = (key,n) => { const [y,m]=key.split("-").map(Number); return monthKey(new Date(y,m-1+n,15)); };
const daysInMonth = key => { const [y,m]=key.split("-").map(Number); return new Date(y,m,0).getDate(); };
const isWeekday = d => d.getDay()!==0 && d.getDay()!==6;
const emptyData = () => ({events:[], holidays:[], flights:[], budgets:{}});

function NaruTrips({ session }){
  const [data,setData]=useState(emptyData);
  const [isLoadingData,setIsLoadingData]=useState(true);
  const [dataError,setDataError]=useState("");
  const [month,setMonth]=useState(START_MONTH);
  const [tab,setTab]=useState("overview");
  const [eventDate,setEventDate]=useState(START_MONTH+"-03");
  const [eventType,setEventType]=useState("office");
  const [holidayDate,setHolidayDate]=useState("");
  const [holidayName,setHolidayName]=useState("");
  const [flight,setFlight]=useState({type:"Ida",date:"",price:"",airline:"",direct:true});
  const [budget,setBudget]=useState("");
  const [toast,setToast]=useState("");

  const notify = msg => { setToast(msg); setTimeout(()=>setToast(""),2200); };

  useEffect(()=>{
    let isMounted=true;
    const loadRemoteData=async()=>{
      setIsLoadingData(true);
      setDataError("");
      const [eventsResult,holidaysResult,flightsResult,budgetsResult]=await Promise.all([
        supabase.from("attendance_records").select("date,type").eq("user_id",session.user.id).order("date"),
        supabase.from("holidays").select("id,date,name").eq("user_id",session.user.id).order("date"),
        supabase.from("flight_options").select("id,type,date,price,airline,direct").eq("user_id",session.user.id).order("date"),
        supabase.from("monthly_budgets").select("month,amount").eq("user_id",session.user.id)
      ]);
      const results=[eventsResult,holidaysResult,flightsResult,budgetsResult];
      const failed=results.find(result=>result.error);
      if(!isMounted) return;
      if(failed){setDataError("No se pudieron cargar tus datos. Inténtalo de nuevo.");setIsLoadingData(false);return;}
      const budgets=Object.fromEntries(budgetsResult.data.map(item=>[item.month,String(item.amount ?? "")]));
      setData({events:eventsResult.data,holidays:holidaysResult.data,flights:flightsResult.data,budgets});
      setIsLoadingData(false);
    };
    loadRemoteData();
    return ()=>{isMounted=false;};
  },[session.user.id]);

  useEffect(()=>setBudget(data.budgets[month]||""),[data.budgets,month]);

  const holidayMap = useMemo(()=>new Map(data.holidays.map(h=>[h.date,h.name])),[data.holidays]);
  const eventMap = useMemo(()=>new Map(data.events.map(e=>[e.date,e.type])),[data.events]);

  const monthStats = key => {
    let weekdays=0, holidays=0, wfa=0, leave=0, computable=0, attendance=0;
    for(let day=1;day<=daysInMonth(key);day++){
      const d=parseDate(`${key}-${String(day).padStart(2,"0")}`);
      if(!isWeekday(d)) continue;
      weekdays++;
      const k=dateKey(d), type=eventMap.get(k);
      if(holidayMap.has(k)) holidays++;
      else if(type==="wfa") wfa++;
      else if(type==="leave") leave++;
      else {
        computable++;
        if(type==="office") attendance++;
      }
    }
    return {weekdays,holidays,wfa,leave,computable,attendance};
  };

  const rollingStats = key => {
    const [y,m]=key.split("-").map(Number);
    const start = new Date(y,m-1-2,1,12);
    const end = new Date(y,m,0,12);
    let computable=0, attendance=0, holidayDays=0, wfa=0, leave=0;
    // Initial ramp-up: November starts alone, December includes Nov-Dec, January onward uses 3 months.
    const actualStart = start < parseDate(START_MONTH+"-01") ? parseDate(START_MONTH+"-01") : start;
    for(let d=new Date(actualStart);d<=end;d.setDate(d.getDate()+1)){
      if(!isWeekday(d)) continue;
      const k=dateKey(d), type=eventMap.get(k);
      if(holidayMap.has(k)){holidayDays++;continue;}
      if(type==="wfa"){wfa++;continue;}
      if(type==="leave"){leave++;continue;}
      computable++;
      if(type==="office") attendance++;
    }
    const required=Math.ceil(computable*0.20);
    return {computable,attendance,required,remaining:Math.max(0,required-attendance),holidayDays,wfa,leave,start:monthKey(actualStart)};
  };

  const stats=monthStats(month);
  const rolling=rollingStats(month);
  const flightsInMonth=data.flights.filter(f=>f.date?.startsWith(month));
  const totalTravel=flightsInMonth.reduce((s,f)=>s+Number(f.price||0),0);
  const monthDays=daysInMonth(month);
  const firstDay=parseDate(month+"-01").getDay();
  const offset=(firstDay+6)%7;
  const cells=[...Array(offset).fill(null),...Array.from({length:monthDays},(_,i)=>i+1)];
  while(cells.length%7) cells.push(null);

  const addEvent=async()=>{
    if(!eventDate || eventDate<START_MONTH+"-01"){notify("El historial comienza en noviembre de 2026.");return;}
    if(!isWeekday(parseDate(eventDate))){notify("Selecciona un día de lunes a viernes.");return;}
    if(holidayMap.has(eventDate) && eventType!=="office"){notify("Ese día ya está marcado como festivo.");return;}
    const existing=data.events.some(event=>event.date===eventDate);
    const query=existing
      ? supabase.from("attendance_records").update({type:eventType}).eq("user_id",session.user.id).eq("date",eventDate)
      : supabase.from("attendance_records").insert({user_id:session.user.id,date:eventDate,type:eventType});
    const {error}=await query;
    if(error){notify("No se pudo guardar el registro.");return;}
    setData(current=>({...current,events:[...current.events.filter(event=>event.date!==eventDate),{date:eventDate,type:eventType}]}));
    notify("Registro guardado.");
  };
  const removeEvent=async date=>{
    const {error}=await supabase.from("attendance_records").delete().eq("user_id",session.user.id).eq("date",date);
    if(error){notify("No se pudo eliminar el registro.");return;}
    setData(current=>({...current,events:current.events.filter(event=>event.date!==date)}));
  };
  const addHoliday=async()=>{
    if(!holidayDate||!holidayName.trim()) return;
    const existing=data.holidays.find(holiday=>holiday.date===holidayDate);
    const query=existing
      ? supabase.from("holidays").update({name:holidayName.trim()}).eq("id",existing.id).eq("user_id",session.user.id).select("id,date,name").single()
      : supabase.from("holidays").insert({user_id:session.user.id,date:holidayDate,name:holidayName.trim()}).select("id,date,name").single();
    const {data:holiday,error}=await query;
    if(error){notify("No se pudo guardar el festivo.");return;}
    setData(current=>({...current,holidays:[...current.holidays.filter(item=>item.date!==holidayDate),holiday]}));
    setHolidayDate("");setHolidayName("");notify("Festivo agregado.");
  };
  const removeHoliday=async id=>{
    const {error}=await supabase.from("holidays").delete().eq("id",id).eq("user_id",session.user.id);
    if(error){notify("No se pudo eliminar el festivo.");return;}
    setData(current=>({...current,holidays:current.holidays.filter(holiday=>holiday.id!==id)}));
  };
  const addFlight=async()=>{
    if(!flight.date||!flight.price){notify("Completa fecha y precio del vuelo.");return;}
    const {data:createdFlight,error}=await supabase.from("flight_options").insert({user_id:session.user.id,...flight,price:Number(flight.price)}).select("id,type,date,price,airline,direct").single();
    if(error){notify("No se pudo guardar el vuelo.");return;}
    setData(current=>({...current,flights:[...current.flights,createdFlight]}));
    setFlight({...flight,date:"",price:"",airline:""});notify("Vuelo agregado.");
  };
  const removeFlight=async id=>{
    const {error}=await supabase.from("flight_options").delete().eq("id",id).eq("user_id",session.user.id);
    if(error){notify("No se pudo eliminar el vuelo.");return;}
    setData(current=>({...current,flights:current.flights.filter(flight=>flight.id!==id)}));
  };
  const updateBudget=async value=>{
    setBudget(value);
    const amount=value===""?0:Number(value);
    const {error}=await supabase.from("monthly_budgets").upsert({user_id:session.user.id,month,amount},{onConflict:"user_id,month"});
    if(error){notify("No se pudo actualizar el presupuesto.");return;}
    setData(current=>({...current,budgets:{...current.budgets,[month]:value}}));
  };
  const resetData=async()=>{
    if(!confirm("¿Borrar todos los registros guardados en tu cuenta?")) return;
    const results=await Promise.all([
      supabase.from("attendance_records").delete().eq("user_id",session.user.id),
      supabase.from("holidays").delete().eq("user_id",session.user.id),
      supabase.from("flight_options").delete().eq("user_id",session.user.id),
      supabase.from("monthly_budgets").delete().eq("user_id",session.user.id)
    ]);
    if(results.some(result=>result.error)){notify("No se pudieron reiniciar todos los datos.");return;}
    setData(emptyData());
    notify("Datos reiniciados.");
  };
  const changeMonth=delta=>setMonth(addMonths(month,delta));

  if(isLoadingData) return <main className="auth-page"><p className="auth-loading">Cargando tus datos...</p></main>;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Plane size={20}/></div><div><b>Naru Trips</b><small>Tu agenda de viajes</small></div></div>
      <nav>
        {[["overview","Resumen",Sparkles],["calendar","Presencialidad",CalendarDays],["flights","Vuelos",Plane],["settings","Configuración",BriefcaseBusiness]].map(([id,label,Icon])=>
          <button key={id} className={tab===id?"nav-item active":"nav-item"} onClick={()=>setTab(id)}><Icon size={18}/>{label}</button>)}
      </nav>
      <div className="sidebar-note"><Sparkles size={16}/><span>Cartagena <b>↔</b> Bogotá</span></div>
      <div className="sidebar-foot">MVP 1.0 · Datos sincronizados con Supabase</div>
    </aside>

    <main className="main">
      {dataError&&<div className="hint" role="alert">{dataError}</div>}
      <header className="topbar"><div><span className="eyebrow">PLANIFICACIÓN PERSONAL</span><h1>{tab==="overview"?"Tu presencialidad, bajo control":tab==="calendar"?"Calendario de presencialidad":tab==="flights"?"Planificador de vuelos":"Configuración"}</h1></div><div className="account-actions"><span className="user-email">{session.user.email}</span><button className="logout-button" onClick={()=>supabase.auth.signOut()} title="Cerrar sesión"><LogOut size={16}/><span>Cerrar sesión</span></button><div className="avatar">N</div></div></header>

      {tab==="overview" && <section className="content">
        <div className="welcome-card"><div><span className="eyebrow light">TRIMESTRE MÓVIL · COLOMBIA</span><h2>Viaja con calma.<br/><em>Organiza con inteligencia.</em></h2><p>Tu objetivo es cumplir el 20% de presencialidad sin perder de vista el costo de cada viaje.</p><button className="light-button" onClick={()=>setTab("calendar")}>Ver calendario <ChevronRight size={16}/></button></div><div className="hero-orbit"><div className="orbit-circle"><Plane size={34}/></div><span className="orbit-dot dot-a"/><span className="orbit-dot dot-b"/></div></div>
        <div className="month-switch"><button className="icon-btn" onClick={()=>changeMonth(-1)} disabled={month===START_MONTH}><ChevronLeft/></button><div><span className="eyebrow">MES DE CONSULTA</span><h2>{monthLabel(month)}</h2></div><button className="icon-btn" onClick={()=>changeMonth(1)}><ChevronRight/></button></div>
        <div className="stats-grid">
          <div className="stat-card accent"><div className="stat-label">Objetivo del período</div><div className="stat-value">20%</div><div className="stat-foot">Últimos 3 meses disponibles</div></div>
          <div className="stat-card"><div className="stat-label">Días computables</div><div className="stat-value">{rolling.computable}</div><div className="stat-foot">Desde {monthLabel(rolling.start)}</div></div>
          <div className="stat-card"><div className="stat-label">Asistencias requeridas</div><div className="stat-value">{rolling.required}</div><div className="stat-foot">En la ventana de cálculo</div></div>
          <div className="stat-card"><div className="stat-label">Te faltan</div><div className="stat-value">{rolling.remaining}</div><div className="stat-foot">{rolling.attendance} registradas</div></div>
        </div>
        <div className="two-col">
          <div className="panel"><div className="panel-heading"><div><span className="eyebrow">SEGUIMIENTO</span><h3>Tu avance trimestral</h3></div><span className="soft-icon"><CheckCircle2/></span></div>
            <div className="progress-row"><strong>{rolling.attendance} / {rolling.required}</strong><span>{rolling.required?Math.min(100,Math.round(rolling.attendance/rolling.required*100)):0}%</span></div>
            <div className="progress"><div style={{width:`${rolling.required?Math.min(100,rolling.attendance/rolling.required*100):0}%`}}/></div>
            <div className="mini-grid"><div><small>Días excluidos</small><b>{rolling.holidayDays+rolling.wfa+rolling.leave}</b></div><div><small>Ventana</small><b>{rolling.start.slice(5)} – {month}</b></div></div>
            <button className="text-button" onClick={()=>setTab("calendar")}>Registrar una asistencia <ChevronRight size={15}/></button>
          </div>
          <div className="panel"><div className="panel-heading"><div><span className="eyebrow">VIAJES</span><h3>Presupuesto del mes</h3></div><span className="soft-icon"><Wallet/></span></div>
            <div className="budget-total">{money(totalTravel)}</div><p className="muted">Suma de los vuelos que registraste en {monthLabel(month)}.</p>
            <button className="text-button" onClick={()=>setTab("flights")}>Planificar vuelos <ChevronRight size={15}/></button>
          </div>
        </div>
        <div className="panel month-summary"><div className="panel-heading"><div><span className="eyebrow">MES SELECCIONADO</span><h3>Desglose de días</h3></div><CalendarDays className="muted-icon"/></div>
          <div className="breakdown"><div><span>Días de lunes a viernes</span><b>{stats.weekdays}</b></div><div><span>Festivos descontados</span><b>{stats.holidays}</b></div><div><span>WFA</span><b>{stats.wfa}</b></div><div><span>Licencias</span><b>{stats.leave}</b></div><div className="total"><span>Días computables del mes</span><b>{stats.computable}</b></div></div>
        </div>
      </section>}

      {tab==="calendar" && <section className="content">
        <div className="month-switch"><button className="icon-btn" onClick={()=>changeMonth(-1)} disabled={month===START_MONTH}><ChevronLeft/></button><div><span className="eyebrow">CALENDARIO</span><h2>{monthLabel(month)}</h2></div><button className="icon-btn" onClick={()=>changeMonth(1)}><ChevronRight/></button></div>
        <div className="calendar-layout">
          <div className="panel calendar-panel">
            <div className="calendar-legend"><span><i className="dot office"/>Presencial</span><span><i className="dot holiday"/>Festivo</span><span><i className="dot wfa"/>WFA</span><span><i className="dot leave"/>Licencia</span></div>
            <div className="calendar-grid">{["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].map(d=><div className="weekday" key={d}>{d}</div>)}
              {cells.map((day,i)=>{if(!day)return <div key={"e"+i}/>;const key=`${month}-${String(day).padStart(2,"0")}`,d=parseDate(key),type=eventMap.get(key),holiday=holidayMap.get(key);return <div key={key} className={`day-cell ${!isWeekday(d)?"weekend":""} ${holiday?"holiday":type||""}`}><b>{day}</b>{holiday&&<small title={holiday}>Festivo</small>}{type==="office"&&<small>Site</small>}{type==="wfa"&&<small>WFA</small>}{type==="leave"&&<small>Licencia</small>}</div>})}
            </div>
          </div>
          <div className="panel register-panel"><span className="eyebrow">REGISTRAR DÍA</span><h3>Actualizar calendario</h3>
            <label>Fecha<input type="date" min={START_MONTH+"-01"} value={eventDate} onChange={e=>setEventDate(e.target.value)}/></label>
            <label>Tipo de registro<select value={eventType} onChange={e=>setEventType(e.target.value)}><option value="office">Presencialidad (site)</option><option value="wfa">Work from Anywhere</option><option value="leave">Licencia registrada</option></select></label>
            <button className="primary-button" onClick={addEvent}><Plus size={16}/> Guardar registro</button>
            <div className="hint"><Info size={15}/> Los festivos se descuentan automáticamente. Los registros pueden editarse reemplazando el tipo del mismo día.</div>
          </div>
        </div>
        <div className="panel"><div className="panel-heading"><div><span className="eyebrow">REGISTROS DEL MES</span><h3>Actividad registrada</h3></div></div>
          {data.events.filter(e=>e.date.startsWith(month)).length===0?<p className="muted">Todavía no hay registros para este mes.</p>:<div className="record-list">{data.events.filter(e=>e.date.startsWith(month)).sort((a,b)=>a.date.localeCompare(b.date)).map(e=><div className="record" key={e.date}><span>{parseDate(e.date).toLocaleDateString("es-CO",{day:"numeric",month:"long",year:"numeric"})}</span><b className={`tag ${e.type}`}>{e.type==="office"?"Presencial":e.type==="wfa"?"WFA":"Licencia"}</b><button className="delete-btn" onClick={()=>removeEvent(e.date)}><Trash2 size={15}/></button></div>)}</div>}
        </div>
      </section>}

      {tab==="flights" && <section className="content">
        <div className="flight-banner"><div><span className="eyebrow light">CARTAGENA ↔ BOGOTÁ</span><h2>Encuentra el viaje<br/><em>que mejor encaja contigo.</em></h2><p>Registra opciones de vuelos directos y compara el costo de tus trayectos.</p></div><Plane size={52}/></div>
        <div className="panel"><div className="panel-heading"><div><span className="eyebrow">NUEVO VUELO</span><h3>Agregar opción de vuelo</h3></div></div>
          <div className="form-grid">
            <label>Trayecto<select value={flight.type} onChange={e=>setFlight({...flight,type:e.target.value})}><option>Ida</option><option>Regreso</option></select></label>
            <label>Fecha<input type="date" min={START_MONTH+"-01"} value={flight.date} onChange={e=>setFlight({...flight,date:e.target.value})}/></label>
            <label>Precio (COP)<input type="number" min="0" placeholder="Ej. 180000" value={flight.price} onChange={e=>setFlight({...flight,price:e.target.value})}/></label>
            <label>Aerolínea<input placeholder="Ej. Avianca" value={flight.airline} onChange={e=>setFlight({...flight,airline:e.target.value})}/></label>
          </div>
          <label className="check-label"><input type="checkbox" checked={flight.direct} onChange={e=>setFlight({...flight,direct:e.target.checked})}/> Vuelo directo</label>
          <button className="primary-button" onClick={addFlight}><Plus size={16}/> Guardar vuelo</button>
          <div className="api-note"><Info size={15}/> Esta versión no consulta tarifas en vivo. Los vuelos se registran manualmente; la conexión con una API se implementará después.</div>
        </div>
        <div className="panel"><div className="panel-heading"><div><span className="eyebrow">OPCIONES GUARDADAS</span><h3>{monthLabel(month)}</h3></div><b className="budget-total small">{money(totalTravel)}</b></div>
          {flightsInMonth.length===0?<p className="muted">Aún no has guardado opciones de vuelo para este mes.</p>:<div className="flight-list">{flightsInMonth.sort((a,b)=>a.date.localeCompare(b.date)).map(f=><div className="flight-row" key={f.id}><div className="flight-icon"><Plane size={18}/></div><div className="flight-info"><b>{f.type} · {parseDate(f.date).toLocaleDateString("es-CO",{day:"numeric",month:"short"})}</b><small>{f.airline||"Aerolínea sin especificar"} · {f.direct?"Directo":"Con escala"}</small></div><strong>{money(f.price)}</strong><button className="delete-btn" onClick={()=>removeFlight(f.id)}><Trash2 size={15}/></button></div>)}</div>}
        </div>
        <div className="panel"><span className="eyebrow">PREFERENCIAS DE VIAJE</span><h3>Tu criterio de búsqueda</h3><div className="preference-chips"><span className="chip selected">Vuelos directos primero</span><span className="chip">Ida y regreso separados</span><span className="chip">Estadía flexible</span><span className="chip">Precios en COP</span></div></div>
      </section>}

      {tab==="settings" && <section className="content">
        <div className="panel"><span className="eyebrow">REGLAS DEL CÁLCULO</span><h3>Tu configuración</h3>
          <div className="settings-list"><div><span>Porcentaje objetivo</span><b>20% trimestral móvil</b></div><div><span>Inicio del historial</span><b>Noviembre de 2026</b></div><div><span>Ruta habitual</span><b>CTG ↔ BOG</b></div><div><span>Prioridad de vuelos</span><b>Directos</b></div><div><span>Moneda</span><b>COP</b></div></div>
          <div className="hint"><Info size={15}/> El historial comienza en noviembre de 2026. Noviembre usa solo noviembre; diciembre usa noviembre y diciembre; desde enero de 2027 se usan los últimos tres meses disponibles. Es una convención de seguimiento del MVP, no una confirmación de cómo Employee Agent resuelve el período inicial.</div>
        </div>
        <div className="panel"><span className="eyebrow">FESTIVOS</span><h3>Administrar festivos</h3><p className="muted">Puedes agregar o quitar fechas. Revisa especialmente los festivos locales y el calendario oficial aplicable a tu site.</p>
          <div className="form-grid"><label>Fecha<input type="date" value={holidayDate} onChange={e=>setHolidayDate(e.target.value)}/></label><label>Nombre<input placeholder="Nombre del festivo" value={holidayName} onChange={e=>setHolidayName(e.target.value)}/></label></div>
          <button className="primary-button" onClick={addHoliday}><Plus size={16}/> Agregar festivo</button>
          <div className="record-list holiday-list">{data.holidays.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(h=><div className="record" key={h.id}><span>{parseDate(h.date).toLocaleDateString("es-CO",{day:"numeric",month:"short",year:"numeric"})} · {h.name}</span><button className="delete-btn" onClick={()=>removeHoliday(h.id)}><Trash2 size={15}/></button></div>)}</div>
        </div>
        <div className="panel"><span className="eyebrow">PRESUPUESTO</span><h3>Referencia mensual</h3><label>Presupuesto de vuelos (COP)<input type="number" min="0" value={budget} onChange={e=>updateBudget(e.target.value)} placeholder="Ej. 600000"/></label><p className="muted">Tu gasto registrado del mes seleccionado: {money(totalTravel)}.</p></div>
        <div className="panel danger-zone"><h3>Datos de la aplicación</h3><p className="muted">Tus datos se guardan de forma segura en tu cuenta.</p><button className="outline-button" onClick={resetData}>Restablecer datos</button></div>
      </section>}
      <footer className="footer">Hecho para organizar tus viajes con un poquito más de calma <span>✦</span></footer>
    </main>
    {toast&&<div className="toast"><CheckCircle2 size={17}/>{toast}</div>}
  </div>;
}

function LoginForm(){
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [error,setError]=useState("");
  const [isSubmitting,setIsSubmitting]=useState(false);

  const handleSubmit=async event=>{
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    const { error: signInError }=await supabase.auth.signInWithPassword({email,password});
    if(signInError) setError(signInError.message);
    setIsSubmitting(false);
  };

  return <main className="auth-page"><section className="auth-card"><div className="brand auth-brand"><div className="brand-mark"><Plane size={20}/></div><div><b>Naru Trips</b><small>Tu agenda de viajes</small></div></div><div className="auth-copy"><span className="eyebrow">BIENVENIDA</span><h1>Inicia sesión</h1><p>Accede a tu planificación de viajes y presencialidad.</p></div><form onSubmit={handleSubmit} className="auth-form"><label>Correo electrónico<input type="email" value={email} onChange={event=>setEmail(event.target.value)} autoComplete="email" required/></label><label>Contraseña<input type="password" value={password} onChange={event=>setPassword(event.target.value)} autoComplete="current-password" required/></label>{error&&<p className="auth-error" role="alert">{error}</p>}<button className="primary-button auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting?"Ingresando...":"Iniciar sesión"}</button></form></section></main>;
}

function App(){
  if(supabaseConfigError) return <main className="auth-page"><section className="auth-card"><p className="auth-error" role="alert">{supabaseConfigError}</p></section></main>;
  const [session,setSession]=useState(null);
  const [isLoading,setIsLoading]=useState(true);

  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session},error})=>{
      if(error) console.error("No se pudo recuperar la sesión:",error.message);
      setSession(session);
      setIsLoading(false);
    });
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,nextSession)=>setSession(nextSession));
    return ()=>subscription.unsubscribe();
  },[]);

  if(isLoading) return <main className="auth-page"><p className="auth-loading">Cargando Naru Trips...</p></main>;
  return session?<NaruTrips session={session}/>:<LoginForm/>;
}

createRoot(document.getElementById("root")).render(<App/>);
