import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Ultreia Camino Web V3 — Control de Gastos + Seguimiento de Grupo real con Supabase.
const SUPABASE_URL = 'https://bzjsniaecbccgxaeoedc.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_ZAq7GYD2M8nn8S0z4j6QaA_gRWrhG7w';
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const HOME='homeView', EXP='expenseView', GROUP='groupView';
let currentView=HOME;
let mapFollowMode='all';
function showView(id){
  currentView=id;
  try{sessionStorage.setItem('ultreia-last-view',id)}catch{}
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if(id===GROUP){ renderGroup(); setTimeout(()=>{ if(window._map) window._map.invalidateSize(); },150); }
  if(id===EXP) renderExpense();
// Si ya perteneces a un grupo, al volver a abrir la PWA retomamos directamente el seguimiento.
if(groupState.group){ showView(GROUP); initGroup(); }
}
document.getElementById('goExpenses').onclick=()=>showView(EXP);
document.getElementById('goGroup').onclick=async()=>{showView(GROUP); await initGroup();};
document.querySelectorAll('[data-home]').forEach(b=>b.onclick=()=>showView(HOME));

// ---------------- Control de Gastos ----------------
const KEY='ultreia-expenses-web-v3', concepts=['Desayuno','Comida','Cena','Dormir','Otros'], emojis={Desayuno:'🥐',Comida:'🥪',Cena:'🍽️',Dormir:'🛌',Otros:'🐚'};
let state=loadExpense(),editingId=null;
function loadExpense(){try{const x=JSON.parse(localStorage.getItem(KEY)||'{}');return{expenses:Array.isArray(x.expenses)?x.expenses:[],plan:x.plan||{budget:0,start:null,end:null}}}catch{return{expenses:[],plan:{budget:0,start:null,end:null}}}}
function saveExpense(){localStorage.setItem(KEY,JSON.stringify(state))}
function money(n){return Number(n||0).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €'}
function isoDate(d=new Date()){return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)}
function parseAmount(v){return Number(String(v).replace(',','.'))}
function dateEs(s){if(!s)return '';const[y,m,d]=s.split('-');return `${d}/${m}/${y}`}
function dayExpenses(date){return state.expenses.filter(e=>e.date===date).reduce((a,e)=>a+e.amount,0)}
function total(){return state.expenses.reduce((a,e)=>a+e.amount,0)}
function daysInclusive(a,b){if(!a||!b)return 0;const x=new Date(a+'T00:00:00'),y=new Date(b+'T00:00:00');return y<x?0:Math.floor((y-x)/86400000)+1}
function remainingDays(){if(!state.plan.end)return 0;const today=isoDate();return today>state.plan.end?0:daysInclusive(today,state.plan.end)}
function periodBudget(){return Number(state.plan.budget||0)}
function remainingBudget(){return Math.max(0,periodBudget()-total())}
function dailyBudget(){const{end,start}=state.plan,b=periodBudget();if(!start||!end||b<=0)return 0;const today=isoDate();if(today<start||today>end)return b/daysInclusive(start,end);const spentBefore=state.expenses.filter(e=>e.date>=start&&e.date<today).reduce((a,e)=>a+e.amount,0);return Math.max(0,b-spentBefore)/Math.max(1,daysInclusive(today,end))}
function averageDaily(){if(!state.plan.start)return 0;const today=isoDate();if(today<state.plan.start)return 0;return total()/daysInclusive(state.plan.start,today)}
function pace(){const{start,end}=state.plan,b=periodBudget();if(!start||!end||b<=0)return['—',''];const totalDays=daysInclusive(start,end),today=isoDate();if(today<start)return['Antes del Camino',''];const elapsed=Math.min(totalDays,daysInclusive(start,today)),expected=b*elapsed/totalDays,actual=state.expenses.filter(e=>e.date>=start&&e.date<=today).reduce((a,e)=>a+e.amount,0),ratio=expected?actual/expected:0;if(Math.abs(ratio-1)<=.10)return['→ En ritmo','on'];return ratio>1?['↗ Por encima','high']:['↘ Por debajo','low']}
function renderExpense(){document.getElementById('today').textContent=money(dayExpenses(isoDate()));document.getElementById('average').textContent=money(averageDaily());document.getElementById('total').textContent=money(total());document.getElementById('dailyBudget').textContent=money(dailyBudget());const[p,cls]=pace(),pe=document.getElementById('pace');pe.textContent=p;pe.className='pace '+cls;const b=periodBudget(),t=total();document.getElementById('progressBar').style.width=(b?Math.min(100,t/b*100):0)+'%';document.getElementById('remaining').textContent=`Presupuesto restante: ${money(remainingBudget())}`;document.getElementById('budgetInfo').textContent=b&&state.plan.start&&state.plan.end?`${money(b)} · ${remainingDays()} días restantes · ${dateEs(state.plan.start)} — ${dateEs(state.plan.end)}`:'Configura tu presupuesto y las fechas del Camino.';renderExpenses()}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function renderExpenses(){const box=document.getElementById('expenses'),empty=document.getElementById('empty');box.innerHTML='';[...state.expenses].sort((a,b)=>b.date.localeCompare(a.date)).forEach(e=>{const row=document.createElement('div');row.className='expense';row.innerHTML=`<span class="emoji">${emojis[e.concept]||'🐚'}</span><div class="expense-main"><div class="expense-title">${e.concept.toUpperCase()}</div><div class="expense-sub">${dateEs(e.date)}${e.comment?' · '+escapeHtml(e.comment):''}</div></div><span class="expense-amount">${money(e.amount)}</span><button class="expense-delete" type="button">BORRAR</button>`;row.querySelector('.expense-main').onclick=()=>openExpense(e);row.querySelector('.expense-delete').onclick=()=>{if(confirm('¿Borrar este movimiento?')){state.expenses=state.expenses.filter(x=>x.id!==e.id);saveExpense();renderExpense()}};enableSwipeDelete(row);box.appendChild(row)});empty.style.display=state.expenses.length?'none':'block'}
function enableSwipeDelete(row){let sx=0,sy=0,dx=0,track=false;const reveal=88;row.addEventListener('touchstart',e=>{if(!e.touches.length)return;sx=e.touches[0].clientX;sy=e.touches[0].clientY;dx=0;track=true},{passive:true});row.addEventListener('touchmove',e=>{if(!track||!e.touches.length)return;const x=e.touches[0].clientX,y=e.touches[0].clientY,ax=x-sx,ay=y-sy;if(Math.abs(ay)>Math.abs(ax)+8){track=false;row.style.transform='translateX(0)';return}dx=Math.max(-reveal,Math.min(0,ax));if(ax<0)row.style.transform=`translateX(${dx}px)`},{passive:true});row.addEventListener('touchend',()=>{if(!track)return;track=false;row.style.transform=dx<-40?`translateX(-${reveal}px)`:'translateX(0)';dx=0})}
function openExpense(e=null){editingId=e?.id||null;document.getElementById('expenseDialogTitle').textContent=e?'Editar gasto':'Registrar gasto';document.getElementById('concept').value=e?.concept||'Desayuno';document.getElementById('amount').value=e?String(e.amount).replace('.',','):'';document.getElementById('comment').value=e?.comment||'';document.getElementById('expenseDate').value=e?.date||isoDate();document.getElementById('expenseDialog').showModal()}
function openCategories(){const box=document.getElementById('categorySummaryRows');box.innerHTML='';concepts.forEach(c=>{const sum=state.expenses.filter(e=>e.concept===c).reduce((a,e)=>a+e.amount,0),b=document.createElement('button');b.className='category-modal-row';b.innerHTML=`<span class="emoji">${emojis[c]}</span><span class="name">${c}</span><span class="value">${money(sum)}</span><span>›</span>`;b.onclick=()=>showCategory(c);box.appendChild(b)});document.getElementById('categoryDialog').showModal()}
function showCategory(c){const rows=state.expenses.filter(e=>e.concept===c).sort((a,b)=>b.date.localeCompare(a.date));document.getElementById('categoryTitle').textContent=`${emojis[c]} ${c}`;const box=document.getElementById('categoryRows');box.innerHTML='';if(!rows.length)box.innerHTML='<div class="empty">No hay gastos en esta categoría.</div>';rows.forEach(e=>{const r=document.createElement('div');r.className='cat-row';r.innerHTML=`<div class="cat-detail"><span class="cat-date">${dateEs(e.date)}</span><span class="cat-comment">${escapeHtml(e.comment)||'—'}</span></div><strong>${money(e.amount)}</strong>`;box.appendChild(r)});document.getElementById('categoryDialog').close();document.getElementById('categoryDetailDialog').showModal()}
function openPlan(){document.getElementById('budget').value=state.plan.budget?String(state.plan.budget).replace('.',','):'';document.getElementById('startDate').value=state.plan.start||'';document.getElementById('endDate').value=state.plan.end||'';document.getElementById('planDialog').showModal()}
document.getElementById('newExpenseBtn').onclick=()=>{if(!state.plan.start||!state.plan.end){alert('Primero configura el presupuesto y las fechas.');openPlan();return}openExpense()};document.getElementById('categoriesBtn').onclick=openCategories;document.getElementById('planBtn')?.addEventListener('click',openPlan);document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>document.getElementById(b.dataset.close).close());document.getElementById('expenseForm').onsubmit=e=>{e.preventDefault();const amount=parseAmount(document.getElementById('amount').value),date=document.getElementById('expenseDate').value;if(!amount||amount<=0||!date)return;const item={id:editingId||crypto.randomUUID(),concept:document.getElementById('concept').value,comment:document.getElementById('comment').value.trim(),amount,date};if(editingId)state.expenses=state.expenses.map(x=>x.id===editingId?item:x);else state.expenses.push(item);saveExpense();document.getElementById('expenseDialog').close();renderExpense()};document.getElementById('planForm').onsubmit=e=>{e.preventDefault();const budget=parseAmount(document.getElementById('budget').value),start=document.getElementById('startDate').value,end=document.getElementById('endDate').value;if(!budget||!start||!end||end<start){alert('Revisa presupuesto y fechas.');return}state.plan={budget,start,end};saveExpense();document.getElementById('planDialog').close();renderExpense()};document.getElementById('resetPlan').onclick=()=>{if(confirm('¿Restablecer el plan y borrar todos los gastos?')){state={expenses:[],plan:{budget:0,start:null,end:null}};saveExpense();document.getElementById('planDialog').close();renderExpense()}};document.getElementById('exportBtn').onclick=()=>{const rows=[['Fecha','Categoría','Comentario','Importe (€)'],...state.expenses.sort((a,b)=>b.date.localeCompare(a.date)).map(e=>[dateEs(e.date),e.concept,e.comment,e.amount.toFixed(2)])],csv='\ufeff'+rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(';')).join('\r\n'),blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='ultreia_gastos.csv';a.click();URL.revokeObjectURL(a.href)};

// ---------------- Seguimiento de Grupo — Supabase real ----------------
const GROUP_KEY='ultreia-group-web-v3';
let groupState=loadGroup();
let map=null,userMarker=null,groupMarkers=new Map(),watchId=null,realtimeChannel=null,groupInitialized=false;
function loadGroup(){try{return JSON.parse(localStorage.getItem(GROUP_KEY)||'{}')}catch{return {}}}
function saveGroup(){localStorage.setItem(GROUP_KEY,JSON.stringify(groupState))}
function localAlias(){return groupState.alias||''}
function ensureGroupDefaults(){groupState={alias:groupState.alias||'',sharing:false,...groupState};}
ensureGroupDefaults();

async function initGroup(){
  if(groupInitialized){ renderGroup(); return; }
  groupInitialized=true;
  renderGroup('Cargando…');
  try{
    const {data:{session}}=await supabase.auth.getSession();
    if(!session){const {error}=await supabase.auth.signInAnonymously();if(error)throw error;}
    await ensureProfile();
    await loadGroupFromSupabase();
  }catch(error){
    console.error(error);
    renderGroup('No se ha podido conectar. Comprueba la conexión a Internet e inténtalo de nuevo.');
  }
}
async function ensureProfile(){
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user)throw authError||new Error('No se pudo crear la identidad');
  groupState.userId=user.id;
  const {data:existing,error}=await supabase.from('profiles').select('id,alias,created_at').eq('id',user.id).maybeSingle();
  if(error)throw error;
  if(existing){groupState.alias=existing.alias||groupState.alias||'';groupState.profileCreatedAt=existing.created_at;saveGroup();return existing;}
  const alias=groupState.alias?.trim()||`Peregrino ${user.id.slice(0,4).toUpperCase()}`;
  const {error:insertError}=await supabase.from('profiles').insert({id:user.id,alias});
  if(insertError)throw insertError;
  groupState.alias=alias;saveGroup();
  return {id:user.id,alias};
}
async function updateAlias(alias){
  const clean=alias.trim(); if(clean.length<2)return;
  const {error}=await supabase.from('profiles').update({alias:clean}).eq('id',groupState.userId);if(error)throw error;
  groupState.alias=clean;saveGroup();
}
async function loadGroupFromSupabase(){
  const userId=groupState.userId;
  const {data:membershipRows,error:membershipError}=await supabase.from('group_members').select('group_id').eq('user_id',userId).limit(1);
  if(membershipError)throw membershipError;
  if(!membershipRows?.length){
    groupState.group=null;groupState.members=[];groupState.positions=[];groupState.sharing=false;saveGroup();await stopRealtime();stopGps();renderGroup();return;
  }
  const groupId=membershipRows[0].group_id;
  const [g,m,p]=await Promise.all([
    supabase.from('groups').select('id,name,invite_code,invite_expires_at,created_by,created_at').eq('id',groupId).single(),
    supabase.from('group_members').select('user_id,role,joined_at,profiles!group_members_user_id_fkey(alias)').eq('group_id',groupId).order('joined_at'),
    supabase.from('group_locations').select().eq('group_id',groupId)
  ]);
  if(g.error)throw g.error;if(m.error)throw m.error;if(p.error)throw p.error;
  groupState.group=g.data;
  groupState.members=(m.data||[]).map(row=>({userId:row.user_id,alias:row.profiles?.alias||'Peregrino',role:row.role,joinedAt:row.joined_at}));
  groupState.positions=p.data||[];
  const me=(groupState.positions||[]).find(x=>x.user_id===userId);
  groupState.sharing=!!me?.sharing_enabled;
  saveGroup();
  await connectRealtime(groupId);
  if(groupState.sharing) startGps(); else stopGps();
  renderGroup();
}
async function createGroup(alias,name){
  await updateAlias(alias);
  const {error}=await supabase.rpc('create_group',{group_name:name.trim()});
  if(error)throw error;
  await loadGroupFromSupabase();
}
async function joinGroup(alias,code){
  await updateAlias(alias);
  const {error}=await supabase.rpc('join_group',{code:code.trim().toUpperCase()});
  if(error)throw error;
  await loadGroupFromSupabase();
}
async function leaveGroup(){
  stopGps();
  if(!groupState.group)return;
  const {error}=await supabase.rpc('leave_current_group');if(error)throw error;
  groupState.group=null;groupState.members=[];groupState.positions=[];groupState.sharing=false;saveGroup();await stopRealtime();renderGroup();showList();
}
async function regenerateInvite(){
  const {error}=await supabase.rpc('regenerate_group_invite');if(error)throw error;
  await loadGroupFromSupabase();
}
async function connectRealtime(groupId){
  await stopRealtime();
  const {data:{session}}=await supabase.auth.getSession();
  if(!session)return;
  realtimeChannel=supabase.channel(`group:${groupId}`,{config:{private:true}})
    .on('broadcast',{event:'location'},payload=>{
      const data=payload.payload||payload;
      if(!data?.user_id||data.group_id!==groupId||data.user_id===groupState.userId)return;
      upsertLocalPosition(data);renderGroupMarkers();renderGroup(false);
    })
    .subscribe(status=>{groupState.realtimeConnected=status==='SUBSCRIBED';saveGroup();});
}
async function stopRealtime(){if(realtimeChannel){await supabase.removeChannel(realtimeChannel);realtimeChannel=null}groupState.realtimeConnected=false}
function upsertLocalPosition(pos){const arr=groupState.positions||[];const i=arr.findIndex(x=>x.user_id===pos.user_id);if(i<0)arr.push(pos);else arr[i]=pos;groupState.positions=arr;saveGroup()}

function positionAgeText(iso){
  if(!iso) return 'Sin posición';
  const sec=Math.max(0,Math.round((Date.now()-new Date(iso).getTime())/1000));
  if(sec<60) return `hace ${sec} s`;
  const min=Math.round(sec/60);
  if(min<60) return `hace ${min} min`;
  const h=Math.round(min/60);
  return `hace ${h} h`;
}
function memberStatus(p){
  if(!p) return {text:'Sin posición',cls:'none'};
  if(!p.sharing_enabled) return {text:'Ubicación parada',cls:'off'};
  const sec=Math.max(0,Math.round((Date.now()-new Date(p.recorded_at).getTime())/1000));
  if(sec<90) return {text:`Ubicación activa · ${positionAgeText(p.recorded_at)}`,cls:'live'};
  return {text:`Última posición · ${positionAgeText(p.recorded_at)}`,cls:'stale'};
}
function renderGroup(message=''){
  const box=document.getElementById('groupList');
  if(message){box.innerHTML=`<div class="panel"><h3>Seguimiento de Grupo</h3><p>${escapeHtml(message)}</p></div>`;return;}
  if(!groupState.group){
    box.innerHTML=`<div class="panel group-start"><h3>Seguimiento de Grupo</h3><p>Camina junto a tus compañeros y comparte tu posición.</p><div class="choice-stack"><button class="primary choice-btn" id="openCreate">👥 Crear un grupo</button><button class="secondary choice-btn" id="openJoin">🔑 Unirse a un grupo</button></div></div>`;
    document.getElementById('openCreate').onclick=()=>document.getElementById('createGroupDialog').showModal();
    document.getElementById('openJoin').onclick=()=>document.getElementById('joinGroupDialog').showModal();
    return;
  }
  const positions=groupState.positions||[];
  const me=positions.find(p=>p.user_id===groupState.userId);
  const admin=groupState.group.created_by===groupState.userId || groupState.members.some(m=>m.userId===groupState.userId&&m.role==='admin');
  const membersHtml=groupState.members.map(m=>{
    const p=positions.find(x=>x.user_id===m.userId);
    const st=memberStatus(p);
    return `<button type="button" class="member member-button" data-member-id="${escapeHtml(m.userId)}"><div class="avatar">${escapeHtml((m.alias||'?')[0].toUpperCase())}</div><div class="member-info"><strong>${escapeHtml(m.alias)}${m.userId===groupState.userId?' (tú)':''}</strong><div class="small member-status ${st.cls}"><span class="status-dot"></span>${st.text}</div></div><span class="member-arrow">›</span></button>`;
  }).join('');
  box.innerHTML=`
    <div class="panel"><div class="row"><div><div class="small">TU NOMBRE</div><strong>${escapeHtml(groupState.alias)}</strong></div><span class="status ${groupState.sharing?'ok':'warn'}">${groupState.sharing?'Ubicación activa':'Ubicación parada'}</span></div></div>
    <div class="panel"><div class="small">GRUPO</div><h3>${escapeHtml(groupState.group.name)}</h3><div class="group-code"><div class="small invite-label">CÓDIGO DE INVITACIÓN</div><strong>${escapeHtml(groupState.group.invite_code)}</strong><div class="invite-actions"><button type="button" class="invite-btn" id="copyInvite">Copiar</button><button type="button" class="invite-btn" id="shareInvite">Compartir</button></div></div><div class="row group-actions"><button class="primary" id="shareToggle">${groupState.sharing?'Detener ubicación':'Compartir ubicación'}</button><button class="secondary" id="openMapFromGroup">🗺️ Ver mapa</button></div>${admin?`<div class="row admin-actions"><button class="secondary" id="regenerateInvite">Nuevo código</button><button class="danger" id="leaveGroup">Salir del grupo</button></div>`:`<div class="row admin-actions"><button class="danger" id="leaveGroup">Salir del grupo</button></div>`}</div>
    <div class="panel"><div class="row"><h3 style="margin:0;flex:1">Compañeros</h3><span class="small">${groupState.members.length} ${groupState.members.length===1?'persona':'personas'}</span></div><div class="member-list">${membersHtml||'<div class="small">Todavía no hay compañeros.</div>'}</div></div>`;
  document.getElementById('shareToggle').onclick=()=>toggleSharing();
  document.getElementById('openMapFromGroup').onclick=showMap;
  document.getElementById('leaveGroup').onclick=async()=>{if(confirm('¿Quieres salir de este grupo?'))await safeAction(leaveGroup)};
  document.getElementById('regenerateInvite')?.addEventListener('click',()=>safeAction(regenerateInvite));
  document.getElementById('copyInvite').onclick=()=>copyInviteCode();
  document.getElementById('shareInvite').onclick=()=>shareInviteCode();
  box.querySelectorAll('[data-member-id]').forEach(btn=>btn.onclick=()=>focusMember(btn.dataset.memberId));
  if(me)updateMapCard();
}
async function copyInviteCode(){
  const code=groupState.group?.invite_code||''; if(!code)return;
  try{await navigator.clipboard.writeText(code);toast('Código copiado');}
  catch{prompt('Copia este código:',code)}
}
async function shareInviteCode(){
  const code=groupState.group?.invite_code||''; if(!code)return;
  const text=`Únete a mi grupo de Ultreia Camino. Código: ${code}`;
  try{if(navigator.share) await navigator.share({title:'Ultreia Camino',text}); else {await navigator.clipboard.writeText(text);toast('Invitación copiada');}}
  catch(e){if(e?.name!=='AbortError')toast('No se pudo compartir la invitación');}
}
function toast(message){
  let el=document.getElementById('ultreiaToast');
  if(!el){el=document.createElement('div');el.id='ultreiaToast';el.className='toast';document.body.appendChild(el)}
  el.textContent=message;el.classList.add('show');clearTimeout(el._timer);el._timer=setTimeout(()=>el.classList.remove('show'),1800);
}
function focusMember(userId){
  const p=(groupState.positions||[]).find(x=>x.user_id===userId);
  if(!p){toast('Este compañero todavía no tiene posición');return;}
  showMap();
  setTimeout(()=>{
    map.setView([p.latitude,p.longitude],16);
    const marker=userId===groupState.userId?userMarker:groupMarkers.get(userId);
    marker?.openPopup();
  },100);
}
async function safeAction(fn){try{await fn()}catch(error){console.error(error);alert(friendlyError(error))}}
function friendlyError(error){return error?.message||'No se pudo completar la operación. Inténtalo de nuevo.'}

function startGps(){
  if(watchId!==null)return;
  if(!navigator.geolocation){alert('Este dispositivo no permite obtener la ubicación.');groupState.sharing=false;saveGroup();renderGroup();return;}
  watchId=navigator.geolocation.watchPosition(onPosition,geoError,{enableHighAccuracy:true,maximumAge:10000,timeout:20000});
}
function stopGps(){if(watchId!==null){navigator.geolocation.clearWatch(watchId);watchId=null}}
async function toggleSharing(){
  if(!groupState.group)return;
  if(groupState.sharing){
    groupState.sharing=false;saveGroup();stopGps();
    const prev=(groupState.positions||[]).find(p=>p.user_id===groupState.userId);
    if(prev){const stopped={...prev,sharing_enabled:false,recorded_at:new Date().toISOString()};upsertLocalPosition(stopped);try{await publishPosition(stopped,true)}catch(e){console.error(e)}}
    renderGroup();showMap();return;
  }
  groupState.sharing=true;saveGroup();renderGroup();startGps();showMap();
}
async function onPosition(pos){
  if(!groupState.sharing||!groupState.group||!groupState.userId)return;
  const p={user_id:groupState.userId,group_id:groupState.group.id,latitude:pos.coords.latitude,longitude:pos.coords.longitude,recorded_at:new Date().toISOString(),sharing_enabled:true,accuracy:Number.isFinite(pos.coords.accuracy)?pos.coords.accuracy:null,bearing:Number.isFinite(pos.coords.heading)&&pos.coords.heading>=0?pos.coords.heading:null};
  upsertLocalPosition(p);drawOwn(p);updateMapCard();
  try{await publishPosition(p,false)}catch(error){console.error(error)}
}
async function publishPosition(p,force){
  const {error}=await supabase.from('group_locations').upsert(p,{onConflict:'user_id,group_id'});if(error)throw error;
  if(realtimeChannel){await realtimeChannel.send({type:'broadcast',event:'location',payload:p})}
}
function geoError(e){alert('No se pudo obtener la ubicación: '+(e?.message||'comprueba los permisos de ubicación.'))}

function initMap(){
  if(map)return;
  map=L.map('map',{zoomControl:false}).setView([43.36,-8.41],10);
  L.control.zoom({position:'bottomright'}).addTo(map);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);
  window._map=map;
}
function markerIcon(isMe){return L.divIcon({className:'ultreia-marker',html:`<div class="marker-pin ${isMe?'me':''}">${isMe?'●':'👤'}</div>`,iconSize:[34,34],iconAnchor:[17,17],popupAnchor:[0,-16]})}
function drawOwn(p,center=true){
  initMap();
  if(!userMarker){userMarker=L.marker([p.latitude,p.longitude],{icon:markerIcon(true)}).addTo(map).bindPopup(`<strong>${escapeHtml(groupState.alias||'Yo')}</strong><br>Mi posición`)}else userMarker.setLatLng([p.latitude,p.longitude]);
  if(center) map.setView([p.latitude,p.longitude],16);
  renderGroupMarkers();
}
function renderGroupMarkers(){
  if(!map)return;
  const positions=groupState.positions||[];
  const memberById=new Map((groupState.members||[]).map(m=>[m.userId,m]));
  const wanted=new Set();
  positions.forEach(p=>{
    if(!Number.isFinite(Number(p.latitude))||!Number.isFinite(Number(p.longitude))||p.user_id===groupState.userId)return;
    const member=memberById.get(p.user_id);if(!member)return;
    wanted.add(p.user_id);
    const label=escapeHtml(member.alias||'Peregrino');
    let marker=groupMarkers.get(p.user_id);
    if(!marker){marker=L.marker([p.latitude,p.longitude],{icon:markerIcon(false)}).addTo(map);groupMarkers.set(p.user_id,marker)}else marker.setLatLng([p.latitude,p.longitude]);
    const st=memberStatus(p);
    marker.bindPopup(`<strong>${label}</strong><br>${st.text}<br><span class="small">${new Date(p.recorded_at).toLocaleTimeString('es-ES')}</span>`);
  });
  for(const [id,marker] of groupMarkers){if(!wanted.has(id)){map.removeLayer(marker);groupMarkers.delete(id)}}
}
function allVisiblePoints(){
  const points=[];
  if(userMarker){const ll=userMarker.getLatLng();points.push([ll.lat,ll.lng])}
  (groupState.positions||[]).forEach(p=>{if(Number.isFinite(Number(p.latitude))&&Number.isFinite(Number(p.longitude)))points.push([Number(p.latitude),Number(p.longitude)])});
  return points;
}
function fitGroup(){
  initMap(); const pts=allVisiblePoints();
  if(!pts.length){map.setView([43.36,-8.41],10);return}
  if(pts.length===1){map.setView(pts[0],16);return}
  map.fitBounds(L.latLngBounds(pts),{padding:[55,55],maxZoom:16});
}
function showMap(){
  document.getElementById('groupList').style.display='none';document.getElementById('mapWrap').style.display='block';
  initMap();renderGroupMarkers();
  const me=(groupState.positions||[]).find(p=>p.user_id===groupState.userId);if(me)drawOwn(me,false);
  fitGroup();updateMapCard();setTimeout(()=>map.invalidateSize(),80);
}
function showList(){document.getElementById('mapWrap').style.display='none';document.getElementById('groupList').style.display='block'}
function updateMapCard(){
  const p=(groupState.positions||[]).find(x=>x.user_id===groupState.userId);
  const others=(groupState.positions||[]).filter(x=>x.sharing_enabled&&x.user_id!==groupState.userId).length;
  const totalMembers=groupState.members?.length||0;
  const connection=groupState.realtimeConnected?'En directo':'Conexión interrumpida';
  document.getElementById('mapCard').innerHTML=p?`<div class="map-card-top"><strong>${escapeHtml(groupState.alias||'Yo')}</strong><span class="connection ${groupState.realtimeConnected?'live':'offline'}"><span class="status-dot"></span>${connection}</span></div><div>${p.sharing_enabled?'Ubicación activa':'Ubicación parada'} · ${positionAgeText(p.recorded_at)}</div><span class="small">${others} de ${Math.max(0,totalMembers-1)} compañero${Math.max(0,totalMembers-1)===1?'':'s'} con ubicación</span>`:'Activa «Compartir ubicación» para enviar tu posición.';
}
document.getElementById('groupMapBtn').onclick=showMap;
document.getElementById('groupListBtn').onclick=showList;
document.getElementById('locateBtn').onclick=()=>{const p=(groupState.positions||[]).find(x=>x.user_id===groupState.userId);if(p)drawOwn(p,true);else navigator.geolocation?.getCurrentPosition(onPosition,geoError,{enableHighAccuracy:true})};
document.getElementById('fitGroupBtn').onclick=()=>{mapFollowMode='all';fitGroup()};
document.getElementById('refreshGroupBtn').onclick=()=>safeAction(loadGroupFromSupabase);
document.getElementById('createGroupForm').onsubmit=async e=>{e.preventDefault();const alias=document.getElementById('createAlias').value.trim(),name=document.getElementById('createGroupName').value.trim();if(!alias||!name)return;const btn=e.submitter;btn.disabled=true;try{await createGroup(alias,name);document.getElementById('createGroupDialog').close();renderGroup()}catch(error){alert(friendlyError(error))}finally{btn.disabled=false}};
document.getElementById('joinGroupForm').onsubmit=async e=>{e.preventDefault();const alias=document.getElementById('joinAlias').value.trim(),code=document.getElementById('joinCode').value.trim().toUpperCase();if(!alias||!code)return;const btn=e.submitter;btn.disabled=true;try{await joinGroup(alias,code);document.getElementById('joinGroupDialog').close();renderGroup()}catch(error){alert(friendlyError(error))}finally{btn.disabled=false}};
document.getElementById('createGroupBtn').onclick=()=>{document.getElementById('groupChoiceDialog').close();document.getElementById('createGroupDialog').showModal()};
document.getElementById('joinGroupBtn').onclick=()=>{document.getElementById('groupChoiceDialog').close();document.getElementById('joinGroupDialog').showModal()};

renderExpense();
