const KEY="ultreia-expenses-web-v1";
const concepts=["Desayuno","Comida","Cena","Dormir","Otros"];
const emojis={Desayuno:"🥐",Comida:"🥪",Cena:"🍽️",Dormir:"🛌",Otros:"🐚"};
let state=load();
let editingId=null;

function load(){
  try{
    const x=JSON.parse(localStorage.getItem(KEY)||"{}");
    return {expenses:Array.isArray(x.expenses)?x.expenses:[],plan:x.plan||{budget:0,start:null,end:null}};
  }catch{return {expenses:[],plan:{budget:0,start:null,end:null}}}
}
function save(){localStorage.setItem(KEY,JSON.stringify(state))}
function money(n){return Number(n||0).toLocaleString("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2})+" €"}
function isoDate(d=new Date()){return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)}
function parseAmount(v){return Number(String(v).replace(",","."))}
function dateEs(s){if(!s)return "";const [y,m,d]=s.split("-");return `${d}/${m}/${y}`}
function dayExpenses(date){return state.expenses.filter(e=>e.date===date).reduce((a,e)=>a+e.amount,0)}
function total(){return state.expenses.reduce((a,e)=>a+e.amount,0)}
function daysInclusive(a,b){
  if(!a||!b)return 0;
  const x=new Date(a+"T00:00:00"),y=new Date(b+"T00:00:00");
  return y<x?0:Math.floor((y-x)/86400000)+1;
}
function remainingDays(){
  if(!state.plan.end)return 0;
  const today=isoDate();
  return today>state.plan.end?0:daysInclusive(today,state.plan.end);
}
function periodBudget(){return Number(state.plan.budget||0)}
function remainingBudget(){return Math.max(0,periodBudget()-total())}
function dailyBudget(){
  const end=state.plan.end,start=state.plan.start,b=periodBudget();
  if(!start||!end||b<=0)return 0;
  const today=isoDate();
  if(today<start||today>end)return b/daysInclusive(start,end);
  const spentBefore=state.expenses.filter(e=>e.date>=start&&e.date<today).reduce((a,e)=>a+e.amount,0);
  return Math.max(0,b-spentBefore)/Math.max(1,daysInclusive(today,end));
}
function averageDaily(){
  if(!state.plan.start)return 0;
  const today=isoDate();
  if(today<state.plan.start)return 0;
  return total()/daysInclusive(state.plan.start,today);
}
function pace(){
  const {start,end}=state.plan,b=periodBudget();
  if(!start||!end||b<=0)return ["—",""];
  const totalDays=daysInclusive(start,end),today=isoDate();
  if(today<start)return ["Antes del Camino",""];
  const elapsed=Math.min(totalDays,daysInclusive(start,today));
  const expected=b*elapsed/totalDays;
  const actual=state.expenses.filter(e=>e.date>=start&&e.date<=today).reduce((a,e)=>a+e.amount,0);
  const ratio=expected?actual/expected:0;
  if(Math.abs(ratio-1)<=.10)return ["→ En ritmo","on"];
  return ratio>1?["↗ Por encima","high"]:["↘ Por debajo","low"];
}
function render(){
  document.getElementById("today").textContent=money(dayExpenses(isoDate()));
  document.getElementById("average").textContent=money(averageDaily());
  document.getElementById("total").textContent=money(total());
  document.getElementById("dailyBudget").textContent=money(dailyBudget());
  const [p,cls]=pace(),paceEl=document.getElementById("pace");
  paceEl.textContent=p;paceEl.className="pace "+cls;
  const b=periodBudget(),t=total();
  document.getElementById("progressBar").style.width=(b?Math.min(100,t/b*100):0)+"%";
  document.getElementById("remaining").textContent=`Presupuesto restante: ${money(remainingBudget())}`;
  document.getElementById("budgetInfo").textContent=
    b&&state.plan.start&&state.plan.end
    ? `${money(b)} · ${remainingDays()} días restantes · ${dateEs(state.plan.start)} — ${dateEs(state.plan.end)}`
    : "Configura tu presupuesto y las fechas del Camino.";
  renderCategories();renderExpenses();
}
function renderCategories(){const box=document.getElementById("categories");if(box)box.innerHTML="";}
function openCategories(){const box=document.getElementById("categorySummaryRows");box.innerHTML="";concepts.forEach(c=>{const sum=state.expenses.filter(e=>e.concept===c).reduce((a,e)=>a+e.amount,0);const b=document.createElement("button");b.className="category-modal-row";b.innerHTML=`<span class="emoji">${emojis[c]}</span><span class="name">${c}</span><span class="value">${money(sum)}</span><span class="arrow">›</span>`;b.onclick=()=>showCategory(c);box.appendChild(b)});document.getElementById("categoryDialog").showModal();}
function renderExpenses(){
  const box=document.getElementById("expenses"),empty=document.getElementById("empty");
  box.innerHTML="";
  [...state.expenses].sort((a,b)=>b.date.localeCompare(a.date)).forEach(e=>{
    const row=document.createElement("div");row.className="expense";
    row.innerHTML=`<span class="emoji">${emojis[e.concept]||"🐚"}</span>
      <div class="expense-main"><div class="expense-title">${e.concept.toUpperCase()}</div>
      <div class="expense-sub">${dateEs(e.date)}${e.comment?" · "+escapeHtml(e.comment):""}</div></div>
      <span class="expense-amount">${money(e.amount)}</span>
      <button class="expense-delete" type="button" aria-label="Borrar movimiento">BORRAR</button>`;
    row.querySelector(".expense-main").onclick=()=>openExpense(e);
    const del=row.querySelector(".expense-delete");
    del.onclick=()=>deleteExpense(e);
    enableSwipeDelete(row,e);
    box.appendChild(row);
  });
  empty.style.display=state.expenses.length?"none":"block";
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function deleteExpense(e){
  if(confirm("¿Borrar este movimiento?")){state.expenses=state.expenses.filter(x=>x.id!==e.id);save();render()}
}
function enableSwipeDelete(row,e){
  let startX=0,startY=0,dx=0,tracking=false;
  const reveal=88;
  row.addEventListener("touchstart",ev=>{
    if(!ev.touches.length)return;
    startX=ev.touches[0].clientX;startY=ev.touches[0].clientY;dx=0;tracking=true;row.classList.add("swiping");
  },{passive:true});
  row.addEventListener("touchmove",ev=>{
    if(!tracking||!ev.touches.length)return;
    const x=ev.touches[0].clientX,y=ev.touches[0].clientY;
    const diffX=x-startX,diffY=y-startY;
    if(Math.abs(diffY)>Math.abs(diffX)+8){tracking=false;row.classList.remove("swiping");row.style.transform="translateX(0)";return}
    dx=Math.max(-reveal,Math.min(0,diffX));
    if(diffX<0)row.style.transform=`translateX(${dx}px)`;
  },{passive:true});
  row.addEventListener("touchend",()=>{
    if(!tracking)return;
    tracking=false;row.classList.remove("swiping");
    if(dx<-40)row.style.transform=`translateX(-${reveal}px)`;else row.style.transform="translateX(0)";
    dx=0;
  });
  row.addEventListener("touchcancel",()=>{tracking=false;row.classList.remove("swiping");row.style.transform="translateX(0)"});
}
function openExpense(e=null){
  editingId=e?.id||null;
  document.getElementById("expenseDialogTitle").textContent=e?"Editar gasto":"Registrar gasto";
  document.getElementById("concept").value=e?.concept||"Desayuno";
  document.getElementById("amount").value=e?String(e.amount).replace(".",","):"";
  document.getElementById("comment").value=e?.comment||"";
  document.getElementById("expenseDate").value=e?.date||isoDate();
  if(state.plan.start)document.getElementById("expenseDate").min=state.plan.start;
  if(state.plan.end)document.getElementById("expenseDate").max=state.plan.end;
  document.getElementById("expenseDialog").showModal();
}
function showCategory(c){const rows=state.expenses.filter(e=>e.concept===c).sort((a,b)=>b.date.localeCompare(a.date));document.getElementById("categoryTitle").textContent=`${emojis[c]}  ${c}`;const box=document.getElementById("categoryRows");box.innerHTML="";if(!rows.length)box.innerHTML='<div class="empty">No hay gastos en esta categoría.</div>';rows.forEach(e=>{const r=document.createElement("div");r.className="cat-row";r.innerHTML=`<div class="cat-detail"><span class="cat-date">${dateEs(e.date)}</span><span class="cat-comment">${escapeHtml(e.comment)||"—"}</span></div><strong>${money(e.amount)}</strong>`;box.appendChild(r)});document.getElementById("categoryDialog").close();document.getElementById("categoryDetailDialog").showModal();}
function openPlan(){
  document.getElementById("budget").value=state.plan.budget?String(state.plan.budget).replace(".",","):"";
  document.getElementById("startDate").value=state.plan.start||"";
  document.getElementById("endDate").value=state.plan.end||"";
  document.getElementById("planDialog").showModal();
}
document.getElementById("newExpenseBtn").onclick=()=>{
  if(!state.plan.start||!state.plan.end){alert("Primero configura el presupuesto y las fechas del Camino.");openPlan();return}
  openExpense();
};
document.getElementById("planBtn").onclick=openPlan;document.getElementById("categoriesBtn").onclick=openCategories;
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>document.getElementById(b.dataset.close).close());

document.getElementById("expenseForm").onsubmit=e=>{
  e.preventDefault();
  const amount=parseAmount(document.getElementById("amount").value),date=document.getElementById("expenseDate").value;
  if(!amount||amount<=0||!date)return;
  if(state.plan.start&&date<state.plan.start||state.plan.end&&date>state.plan.end){alert("La fecha está fuera del periodo del Camino.");return}
  const item={id:editingId||crypto.randomUUID(),concept:document.getElementById("concept").value,
    comment:document.getElementById("comment").value.trim(),amount,date};
  if(editingId)state.expenses=state.expenses.map(x=>x.id===editingId?item:x);else state.expenses.push(item);
  save();document.getElementById("expenseDialog").close();render();
};
document.getElementById("planForm").onsubmit=e=>{
  e.preventDefault();
  const budget=parseAmount(document.getElementById("budget").value),start=document.getElementById("startDate").value,end=document.getElementById("endDate").value;
  if(!budget||budget<=0||!start||!end||end<start){alert("Revisa presupuesto y fechas.");return}
  state.plan={budget,start,end};save();document.getElementById("planDialog").close();render();
};
document.getElementById("resetPlan").onclick=()=>{
  if(confirm("¿Restablecer el plan y borrar todos los gastos?")){
    state={expenses:[],plan:{budget:0,start:null,end:null}};save();document.getElementById("planDialog").close();render();
  }
};
document.getElementById("exportBtn").onclick=()=>{
  const rows=[["Fecha","Categoría","Comentario","Importe (€)"],...state.expenses.sort((a,b)=>b.date.localeCompare(a.date)).map(e=>[dateEs(e.date),e.concept,e.comment,e.amount.toFixed(2)])];
  const csv="\ufeff"+rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(";")).join("\r\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");
  a.href=URL.createObjectURL(blob);a.download="ultreia_gastos.csv";a.click();URL.revokeObjectURL(a.href);
};
render();
