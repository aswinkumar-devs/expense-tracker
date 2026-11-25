import { useEffect, useMemo, useState } from 'react';
import { BarChart3, ChevronLeft, ChevronRight, Download, History, Home, Moon, MoreHorizontal, Plus, RotateCcw, Search, Settings, Sun, Upload, X, Trash2, Pencil, Undo2 } from 'lucide-react';
import type { ExpenseRow, Store } from './lib/types';
import { loadStore, saveStore, ensureCurrentMonth, getActiveMonth, setActiveMonth, upsertRow, deleteRow, clearMonth, setBudget, updateSchema, deleteHistoryMonth } from './lib/storage';
import { monthlyTotal, todaysExpense, averageDaily, remainingBudget } from './lib/calculator';
import { currentMonthKey, formatINR, formatMonthLabel, MONTH_NAMES, shiftMonth, todayISO, uid } from './lib/utils';
import { exportMonthCSV } from './lib/csv';
import { ToastProvider, useToast } from './components/Toast';

const LS_LAST_BACKUP='busExpenseTracker.lastBackup';

type Tab='home'|'history'|'stats'|'settings';

function Tracker(){
  const {notify}=useToast();
  const [store,setStore]=useState<Store>(()=>ensureCurrentMonth(loadStore()));
  const [tab,setTab]=useState<Tab>('home');
  const [sheet,setSheet]=useState(false);
  const [editing,setEditing]=useState<ExpenseRow|null>(null);
  const [draftAmount,setDraftAmount]=useState('');
  const [draftColumn,setDraftColumn]=useState('');
  const [draftDate,setDraftDate]=useState(todayISO());
  const [draftNote,setDraftNote]=useState('');
  const [query,setQuery]=useState('');
  const [openDay,setOpenDay]=useState<string|null>(null);
  const [undo,setUndo]=useState<{label:string;action:()=>void}|null>(null);
  const [dark,setDark]=useState(()=>localStorage.getItem('bet-dark')?localStorage.getItem('bet-dark')==='1':matchMedia('(prefers-color-scheme: dark)').matches);
  const [clearConfirm,setClearConfirm]=useState(false);

  useEffect(()=>{saveStore(store)},[store]);
  useEffect(()=>{document.documentElement.classList.toggle('dark',dark);localStorage.setItem('bet-dark',dark?'1':'0')},[dark]);
  useEffect(()=>{const id=setInterval(()=>setStore(s=>ensureCurrentMonth(s)),60000);return()=>clearInterval(id)},[]);
  useEffect(()=>{if(!navigator.storage?.persist)return; navigator.storage.persist().catch(()=>{})},[]);

  const month=getActiveMonth(store); const rows=month.rows;
  const today=todayISO();
  const total=monthlyTotal(rows); const todayTotal=todaysExpense(rows,today); const left=remainingBudget(month.budget,rows); const avg=averageDaily(rows,month.monthKey);
  const projection=month.monthKey===currentMonthKey()?(total/Math.max(1,new Date().getDate()))*new Date(new Date().getFullYear(),new Date().getMonth()+1,0).getDate():0;
  const budgetPct=month.budget>0?total/month.budget*100:0;
  const visibleColumns=store.schema.columns.filter(c=>!c.hidden);

  const filtered=useMemo(()=>{const q=query.trim().toLowerCase(); if(!q)return rows; return rows.filter(r=>r.date.includes(q)||r.note?.toLowerCase().includes(q)||store.schema.columns.find(c=>c.id===r.columnId)?.label.toLowerCase().includes(q))},[rows,query,store.schema]);

  function openSheet(row?:ExpenseRow,columnId?:string){
    setEditing(row||null); setDraftAmount(row?String(row.amount):''); setDraftColumn(row?.columnId||columnId||visibleColumns[0]?.id||''); setDraftDate(row?.date||todayISO()); setDraftNote(row?.note||''); setSheet(true);
  }
  function closeSheet(){setSheet(false);setEditing(null)}
  function saveEntry(){
    const amount=Number(draftAmount); if(!draftDate||!draftColumn||!draftAmount||amount<=0){notify('Enter an amount above ₹0','error');return}
    if(draftDate>todayISO()&&Math.floor((new Date(draftDate).getTime()-new Date(todayISO()).getTime())/86400000)>1){notify('Date is more than one day in the future','error');return}
    if(draftDate>todayISO()&&new Date(draftDate).getTime()>new Date(todayISO()).getTime()) notify('Future date selected','info');
    if(amount>5000&&!confirm(`₹${amount.toLocaleString('en-IN')} is above ₹5,000. Save this entry?`))return;
    if(amount>1000000){notify('Amount is above the safe maximum','error');return}
    const row:ExpenseRow={id:editing?.id||uid(),date:draftDate,columnId:draftColumn,amount,note:draftNote.trim()||undefined,time:new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:false})};
    setStore(s=>upsertRow(s,row)); closeSheet(); notify(editing?'Entry updated':'Entry saved');
  }
  function addQuick(columnId:string){
    const col=visibleColumns.find(c=>c.id===columnId); const amount=col?.defaultFare||0;
    if(amount>0){const row={id:uid(),date:today,columnId,amount,note:undefined};setStore(s=>upsertRow(s,row));notify(`Added ${formatINR(amount)}`,'success');setUndo({label:'Entry removed',action:()=>setStore(s=>deleteRow(s,row.id,row.date.slice(0,7)))})}else openSheet(undefined,columnId)
  }
  function repeatYesterday(){
    const d=new Date();d.setDate(d.getDate()-1);const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;const source=store.months[key]?.rows.filter(r=>r.date===d.toISOString().slice(0,10))||[];
    if(!source.length){notify('No entries found yesterday','info');return} const copies=source.map(r=>({...r,id:uid(),date:today,time:r.time}));setStore(s=>{let next=s;for(const r of copies)next=upsertRow(next,r);return next});notify(`Repeated ${copies.length} entries`,`success`);setUndo({label:`Repeated entries removed`,action:()=>setStore(s=>{let next=s;for(const r of copies)next=deleteRow(next,r.id,today.slice(0,7));return next})})
  }
  function removeRow(row:ExpenseRow){const monthKey=row.date.slice(0,7);setStore(s=>deleteRow(s,row.id,monthKey));notify('Entry deleted','info');setUndo({label:'Entry restored',action:()=>setStore(s=>upsertRow(s,row))})}
  function clearMonthNow(){setClearConfirm(false);const snapshot=rows;setStore(s=>clearMonth(s,month.monthKey));notify('Month entries cleared','info');setUndo({label:'Entries restored',action:()=>setStore(s=>{let next=s;for(const r of snapshot)next=upsertRow(next,r);return next})})}
  function deleteMonth(key:string){if(key===currentMonthKey()){notify('Cannot delete the active month','error');return}const snapshot=store.months[key];setStore(s=>deleteHistoryMonth(s,key));notify('Month deleted','info');setUndo({label:'Month restored',action:()=>setStore(s=>({...s,months:{...s.months,[key]:snapshot}}))})}

  const dayGroups=useMemo(()=>{const map=new Map<string,ExpenseRow[]>;for(const r of filtered){const a=map.get(r.date)||[];a.push(r);map.set(r.date,a)}return [...map.entries()].sort((a,b)=>b[0].localeCompare(a[0]))},[filtered]);

  return <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 pb-20">
    <header className="sticky top-0 z-30 h-12 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-b border-gray-200 dark:border-gray-800 flex items-center px-3 gap-2">
      <button className="icon-btn" aria-label="Previous month" onClick={()=>setStore(s=>setActiveMonth(s,shiftMonth(month.monthKey,-1)))}><ChevronLeft size={18}/></button>
      <button className="mx-auto text-sm font-semibold" onClick={()=>setStore(s=>setActiveMonth(s,currentMonthKey()))}>{formatMonthLabel(month.monthKey)}</button>
      <button className="icon-btn" aria-label="Next month" onClick={()=>setStore(s=>setActiveMonth(s,shiftMonth(month.monthKey,1)))}><ChevronRight size={18}/></button>
      <button className="icon-btn" aria-label="Toggle dark mode" onClick={()=>setDark(d=>!d)}>{dark?<Sun size={18}/>:<Moon size={18}/>}</button>
      <button className="icon-btn" aria-label="Open settings" onClick={()=>setTab('settings')}><MoreHorizontal size={18}/></button>
    </header>

    {tab==='home'&&<main className="max-w-lg mx-auto px-3 sm:px-4 pt-3 pb-4 space-y-3">
      <section className={`overflow-hidden rounded-xl border shadow-sm ${budgetPct>=100?'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30':budgetPct>=80?'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30':'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900'}`}>
        <div className="grid grid-cols-3 divide-x divide-gray-200 dark:divide-gray-800">
          <div className="px-2 py-3 text-center"><span className="block text-[11px] text-gray-500 dark:text-gray-400">Spent</span><strong className="mt-0.5 block text-base text-gray-950 dark:text-white">{formatINR(total)}</strong></div>
          <div className="px-2 py-3 text-center"><span className="block text-[11px] text-gray-500 dark:text-gray-400">Today</span><strong className="mt-0.5 block text-base text-gray-950 dark:text-white">{formatINR(todayTotal)}</strong></div>
          <div className="px-2 py-3 text-center"><span className="block text-[11px] text-gray-500 dark:text-gray-400">Left</span><strong className={`mt-0.5 block text-base ${left<0?'text-red-600':'text-gray-950 dark:text-white'}`}>{formatINR(left)}</strong></div>
        </div>
        <div className="h-1.5 bg-gray-100 dark:bg-gray-800"><div className={`h-full rounded-r-full transition-all ${budgetPct>=100?'bg-red-500':budgetPct>=80?'bg-amber-500':'bg-blue-500'}`} style={{width:`${Math.min(100,budgetPct)}%`}}/></div>
        {month.monthKey===currentMonthKey()&&<div className="flex items-center justify-between px-3 py-2 text-[11px] text-gray-500 dark:text-gray-400"><span>Projected {formatINR(projection)}</span><span>{formatINR(avg)} / day avg</span></div>}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold">Quick add</h2><button onClick={()=>openSheet()} className="text-xs font-medium text-blue-600 dark:text-blue-400">Custom entry</button></div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {visibleColumns.map(c=>{
            const routeName=c.shortLabel||c.label;
            return <div key={c.id} className="relative min-w-0 rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <button onClick={()=>addQuick(c.id)} onContextMenu={e=>{e.preventDefault();openSheet(undefined,c.id)}} className="w-full min-h-[58px] px-3 pr-8 py-2 text-left active:scale-[0.98] transition-transform" aria-label={`Add ${c.label}`}>
                <span className="block truncate text-[13px] font-semibold text-gray-900 dark:text-gray-100">{routeName}</span>
                <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{c.defaultFare?formatINR(c.defaultFare):'Set fare'}</span>
              </button>
              <button onClick={()=>openSheet(undefined,c.id)} className="absolute right-1.5 top-1.5 icon-btn !min-h-[34px] !min-w-[34px]" aria-label={`Edit ${c.label}`}><Pencil size={13}/></button>
            </div>
          })}
        </div>
      </section>

      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search date, route or note" className="input-base pl-9"/></div>
        <button onClick={repeatYesterday} className="h-[40px] shrink-0 rounded-lg border border-blue-200 px-3 text-xs font-semibold text-blue-700 dark:border-blue-900 dark:text-blue-300">Repeat yesterday</button>
      </div>

      {dayGroups.length===0?<section className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 px-5 text-center dark:border-gray-800"><div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400"><Plus size={22}/></div><h3 className="text-sm font-semibold">No expenses yet</h3><p className="mt-1 max-w-[220px] text-xs leading-5 text-gray-500 dark:text-gray-400">Tap a route above or add a custom entry to get started.</p><button onClick={()=>openSheet()} className="mt-3 min-h-[40px] rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white">Add first entry</button></section>:<div className="space-y-2">{dayGroups.map(([date,entries])=>{const dayTotal=entries.reduce((s,r)=>s+r.amount,0);return <section key={date} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"><button onClick={()=>setOpenDay(openDay===date?null:date)} className="flex min-h-[54px] w-full items-center gap-3 px-3 text-left" aria-expanded={openDay===date}><div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800"><span className="text-[10px] uppercase text-gray-500">{MONTH_NAMES[Number(date.slice(5,7))-1].slice(0,3)}</span><b className="text-sm leading-none">{Number(date.slice(8))}</b></div><div className="min-w-0 flex-1"><span className="block truncate text-xs text-gray-500 dark:text-gray-400">{entries.map(r=>visibleColumns.find(c=>c.id===r.columnId)?.shortLabel||'Other').join(' · ')}</span><span className="mt-0.5 block text-xs text-gray-400">{entries.length} {entries.length===1?'entry':'entries'}</span></div><b className="text-base">{formatINR(dayTotal)}</b></button>{openDay===date&&<div className="border-t border-gray-100 dark:border-gray-800">{entries.map(r=><div key={r.id} className="flex min-h-[52px] items-center border-b px-3 last:border-0 border-gray-100 dark:border-gray-800"><button className="min-w-0 flex-1 text-left" onClick={()=>openSheet(r)}><span className="block truncate text-sm">{store.schema.columns.find(c=>c.id===r.columnId)?.label}</span>{r.note&&<span className="block truncate text-xs text-gray-400">{r.note}</span>}</button><b className="ml-2 text-sm">{formatINR(r.amount)}</b><button aria-label="Delete entry" onClick={()=>removeRow(r)} className="icon-btn ml-1 text-red-500"><Trash2 size={15}/></button></div>)}</div>}</section>})}</div>}
      <p className="pb-1 text-center text-[11px] text-gray-400">{rows.length} entries · {formatINR(total)} this month</p>
    </main>}

    {tab==='history'&&<main className="max-w-xl mx-auto px-3 py-3 space-y-2"><h2 className="font-semibold text-sm">Month History</h2>{Object.keys(store.months).sort().reverse().map(key=>{const m=store.months[key];return <div key={key} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 flex items-center"><button className="flex-1 text-left" onClick={()=>setStore(s=>setActiveMonth(s,key))}><b className="text-sm">{formatMonthLabel(key)}</b><span className="block text-xs text-gray-400">{formatINR(monthlyTotal(m.rows))} · {m.rows.length} entries</span></button>{key!==currentMonthKey()&&<button aria-label="Delete month" onClick={()=>deleteMonth(key)} className="icon-btn text-red-500"><Trash2 size={16}/></button>}</div>})}</main>}

    {tab==='stats'&&<main className="max-w-xl mx-auto px-3 py-3"><ExpenseStats store={store} month={month}/></main>}

    {tab==='settings'&&<main className="max-w-xl mx-auto px-3 py-3 space-y-3"><h2 className="font-semibold text-sm">Settings</h2>
      {shouldBackupNudge()&&<div className="text-xs border border-amber-300 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-2">Backup recommended · your last JSON backup is over 30 days old</div>}
      <label className="block text-xs text-gray-500">Monthly budget<input type="number" min="0" value={month.budget} onChange={e=>setStore(s=>setBudget(s,Math.max(0,Number(e.target.value))))} className="input-base mt-1"/></label>
      <button onClick={()=>setClearConfirm(true)} className="settings-btn text-red-600"><RotateCcw size={16}/>Clear this month's entries</button>
      <button onClick={()=>exportMonthCSV(month,store.schema)} className="settings-btn"><Download size={16}/>Export CSV</button>
      <button onClick={()=>exportJSON(store,setStore,notify)} className="settings-btn"><Download size={16}/>JSON backup export</button>
      <button onClick={()=>importJSON(setStore,notify)} className="settings-btn"><Upload size={16}/>Import JSON (merge)</button>
      <ColumnSettings store={store} setStore={setStore} notify={notify}/>
    </main>}

    <nav className="safe-bottom fixed bottom-0 inset-x-0 z-40 h-14 bg-white/95 dark:bg-gray-900/95 border-t border-gray-200 dark:border-gray-800 flex"><TabButton icon={<Home size={19}/>} label="Home" active={tab==='home'} onClick={()=>setTab('home')}/><TabButton icon={<History size={19}/>} label="History" active={tab==='history'} onClick={()=>setTab('history')}/><TabButton icon={<BarChart3 size={19}/>} label="Stats" active={tab==='stats'} onClick={()=>setTab('stats')}/><TabButton icon={<Settings size={19}/>} label="Settings" active={tab==='settings'} onClick={()=>setTab('settings')}/></nav>
    {tab==='home'&&<button onClick={()=>openSheet()} className="fixed bottom-16 right-3 z-30 w-12 h-12 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center" aria-label="Add entry"><Plus size={24}/></button>}

    {sheet&&<div className="fixed inset-0 z-50"><button className="absolute inset-0 bg-black/40" aria-label="Close entry sheet" onClick={closeSheet}/><div className="absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-xl bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 p-3 pb-[calc(12px+env(safe-area-inset-bottom))]"><div className="flex justify-between mb-2"><b className="text-sm">{editing?'Edit entry':'Add entry'}</b><button className="icon-btn" aria-label="Close" onClick={closeSheet}><X size={18}/></button></div><input autoFocus inputMode="decimal" type="text" value={draftAmount} onChange={e=>setDraftAmount(e.target.value)} placeholder="₹ Amount" className="input-base text-lg font-semibold"/><div className="flex gap-1.5 overflow-x-auto py-2">{visibleColumns.map(c=><button key={c.id} onClick={()=>setDraftColumn(c.id)} className={`chip ${draftColumn===c.id?'ring-2 ring-blue-500':''}`}>{c.shortLabel||c.label}</button>)}</div><input type="date" value={draftDate} onChange={e=>setDraftDate(e.target.value)} className="input-base"/><input value={draftNote} onChange={e=>setDraftNote(e.target.value)} placeholder="Note (optional)" className="input-base mt-2"/><button onClick={saveEntry} className="w-full mt-2 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold">Save</button></div></div>}

    {undo&&<div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-[60] bg-gray-900 text-white rounded-lg px-3 py-2 text-sm flex gap-3"><span>{undo.label}</span><button onClick={()=>{undo.action();setUndo(null)}} className="font-bold flex items-center gap-1"><Undo2 size={14}/>Undo</button></div>}
    {clearConfirm&&<div className="fixed inset-0 z-[70] bg-black/40 flex items-end sm:items-center justify-center p-3"><div className="bg-white dark:bg-gray-900 rounded-xl p-4 w-full max-w-sm"><b className="text-sm">Clear this month's entries?</b><p className="text-xs text-gray-500 my-2">Entries can be restored with Undo.</p><div className="flex gap-2"><button onClick={()=>setClearConfirm(false)} className="flex-1 py-2 border rounded-lg">Cancel</button><button onClick={clearMonthNow} className="flex-1 py-2 rounded-lg bg-red-600 text-white">Clear</button></div></div></div>}
  </div>
}

function TabButton({icon,label,active,onClick}:{icon:React.ReactNode;label:string;active:boolean;onClick:()=>void}){return <button onClick={onClick} className={`flex-1 flex flex-col items-center justify-center text-[11px] ${active?'text-blue-600':'text-gray-500'}`}>{icon}<span>{label}</span></button>}

function ExpenseStats({store,month}:{store:Store;month:ReturnType<typeof getActiveMonth>}){
 const daily=new Map<string,number>();for(const r of month.rows)daily.set(r.date,(daily.get(r.date)||0)+r.amount);const entries=[...daily.entries()].sort((a,b)=>a[0].localeCompare(b[0])).slice(-30);const max=Math.max(...entries.map(v=>v[1]),1);
 const sums=store.schema.columns.filter(c=>!c.hidden).map(c=>({c,value:month.rows.filter(r=>r.columnId===c.id).reduce((s,r)=>s+r.amount,0)})).filter(v=>v.value>0);const maxSum=Math.max(...sums.map(v=>v.value),1);
 const weekStart=new Date();weekStart.setDate(weekStart.getDate()-6);const weekly=month.rows.filter(r=>r.date>=weekStart.toISOString().slice(0,10)).reduce((s,r)=>s+r.amount,0);
 const keys=Object.keys(store.months).sort();const i=keys.indexOf(month.monthKey);const prev=i>0?store.months[keys[i-1]]:undefined;const prevTotal=prev?monthlyTotal(prev.rows):0;const delta=prevTotal?((monthlyTotal(month.rows)-prevTotal)/prevTotal)*100:0;
 return <div className="space-y-3"><div className="grid grid-cols-2 gap-2"><div className="stat"><span>Last 7 days</span><b>{formatINR(weekly)}</b></div><div className="stat"><span>vs last month</span><b className={delta>0?'text-red-500':'text-emerald-600'}>{delta>=0?'+' : ''}{delta.toFixed(0)}%</b></div></div><section className="panel"><b className="text-sm">30-day spending</b><div className="h-[120px] flex items-end gap-1 mt-2">{entries.map(([date,value])=>{const h=10+value/max*86;return <div key={date} title={`${date}: ${formatINR(value)}`} className="flex-1 flex items-end"><div className={`w-full rounded-t ${date===todayISO()?'bg-amber-500':'bg-blue-500'}`} style={{height:`${h}%`}}/></div>})}</div></section><section className="panel"><b className="text-sm">Route breakdown</b><div className="mt-2 space-y-2">{sums.map(({c,value})=>{const pct=value/maxSum*100;return <div key={c.id}><div className="flex justify-between text-xs mb-1"><span>{c.shortLabel||c.label}</span><b>{formatINR(value)}</b></div><div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded"><div className="h-full bg-blue-500 rounded" style={{width:`${pct}%`}}/></div></div>})}{!sums.length&&<p className="text-xs text-gray-400">No route data</p>}</div></section></div>
}

function ColumnSettings({store,setStore,notify}:{store:Store;setStore:(updater:(s:Store)=>Store)=>void;notify:(m:string,t?:'success'|'error'|'info')=>void}){
 function archive(id:string){const used=Object.values(store.months).some(m=>m.rows.some(r=>r.columnId===id));const schema={...store.schema,columns:store.schema.columns.map(c=>c.id===id?{...c,hidden:true}:c)};setStore(s=>updateSchema(s,schema));notify(used?'Route archived; past entries remain':'Route hidden','info')}
 function remove(id:string){const used=Object.values(store.months).some(m=>m.rows.some(r=>r.columnId===id));if(used){notify('Archive routes instead; entries exist','error');return}const schema={...store.schema,columns:store.schema.columns.filter(c=>c.id!==id)};setStore(s=>updateSchema(s,schema));notify('Route deleted')}
 return <section className="panel"><b className="text-sm">Routes</b><div className="mt-2 space-y-2">{store.schema.columns.map(c=><div key={c.id} className={`grid grid-cols-[1fr_58px_32px] gap-1 items-center ${c.hidden?'opacity-50':''}`}><input aria-label="Route label" value={c.label} onChange={e=>{const schema={...store.schema,columns:store.schema.columns.map(x=>x.id===c.id?{...x,label:e.target.value}:x)};setStore(s=>updateSchema(s,schema))}} className="input-base py-1.5"/><input aria-label="Default fare" type="number" value={c.defaultFare||''} onChange={e=>{const schema={...store.schema,columns:store.schema.columns.map(x=>x.id===c.id?{...x,defaultFare:Number(e.target.value)||0}:x)};setStore(s=>updateSchema(s,schema))}} className="input-base py-1.5"/><button aria-label={c.hidden?'Show route':'Archive route'} onClick={()=>{if(c.hidden){const schema={...store.schema,columns:store.schema.columns.map(x=>x.id===c.id?{...x,hidden:false}:x)};setStore(s=>updateSchema(s,schema))}else archive(c.id)}} className="icon-btn">{c.hidden?<Plus size={15}/>:<X size={15}/>}</button>{!c.hidden&&<button onClick={()=>remove(c.id)} className="col-start-3 text-[10px] text-red-500">Delete</button>}</div>)}</div></section>
}

function shouldBackupNudge(){const last=localStorage.getItem(LS_LAST_BACKUP);if(!last)return true;return Date.now()-Number(last)>30*86400000}
function exportJSON(store:Store,_setStore:(u:(s:Store)=>Store)=>void,notify:(m:string,t?:'success'|'error'|'info')=>void){const blob=new Blob([JSON.stringify(store,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`expense-backup-${todayISO()}.json`;a.click();URL.revokeObjectURL(url);localStorage.setItem(LS_LAST_BACKUP,String(Date.now()));notify('JSON backup exported')}
function importJSON(setStore:(u:(s:Store)=>Store)=>void,notify:(m:string,t?:'success'|'error'|'info')=>void){const input=document.createElement('input');input.type='file';input.accept='application/json';input.onchange=()=>{const file=input.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const parsed=JSON.parse(String(reader.result)) as Store;if(!parsed.months||typeof parsed.months!=='object'||!parsed.schema)throw new Error();const replace=confirm('Replace existing data? Cancel to merge.');setStore(s=>replace?parsed:mergeStores(s,parsed));notify('Backup imported')}catch{notify('Invalid JSON backup','error')}};reader.readAsText(file)};input.click()}
function mergeStores(base:Store,incoming:Store):Store{const months={...base.months};for(const [key,m] of Object.entries(incoming.months)){const existing=months[key]?.rows||[];months[key]={...m,rows:[...existing,...m.rows.filter(r=>!existing.some(x=>x.id===r.id))]}}return {...base,months,schema:incoming.schema||base.schema}}

export default function App(){return <ToastProvider><Tracker/></ToastProvider>}
