import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, BarChart3, ChevronLeft, ChevronRight, Download, Eye, EyeOff, GripVertical, History, Home, Moon, MoreHorizontal, Plus, RotateCcw, Search, Settings, Sun, Upload, Wallet, X, Trash2, Pencil, Undo2 } from 'lucide-react';
import type { ExpenseRow, Store } from './lib/types';
import { loadStore, saveStore, ensureCurrentMonth, getActiveMonth, setActiveMonth, upsertRow, deleteRow, clearMonth, setBudget, updateSchema, deleteHistoryMonth } from './lib/storage';
import { monthlyTotal, todaysExpense, averageDaily, remainingBudget } from './lib/calculator';
import { currentMonthKey, formatINR, formatMonthLabel, MONTH_NAMES, shiftMonth, todayISO, uid } from './lib/utils';
import { exportMonthCSV } from './lib/csv';
import { ToastProvider, useToast } from './components/Toast';
import { SalaryTracker } from './components/SalaryTracker';

const LS_LAST_BACKUP='busExpenseTracker.lastBackup';

type Tab='home'|'history'|'stats'|'salary'|'settings';

function Tracker(){
  const {notify}=useToast();
  const [store,setStore]=useState<Store>(()=>ensureCurrentMonth(loadStore()));
  const [tab,setTab]=useState<Tab>('home');
  const [sheet,setSheet]=useState(false);
  const [editing,setEditing]=useState<ExpenseRow|null>(null);
  const [draftAmount,setDraftAmount]=useState('');
  const [draftAmounts,setDraftAmounts]=useState<Record<string,string>>({});
  const [draftColumn,setDraftColumn]=useState('');
  const [focusColumn,setFocusColumn]=useState('');
  const [draftDate,setDraftDate]=useState(todayISO());
  const [draftNote,setDraftNote]=useState('');
  const [query,setQuery]=useState('');
  const [openDay,setOpenDay]=useState<string|null>(null);
  const [undo,setUndo]=useState<{label:string;action:()=>void}|null>(null);
  const [dark,setDark]=useState(()=>localStorage.getItem('bet-dark')?localStorage.getItem('bet-dark')==='1':matchMedia('(prefers-color-scheme: dark)').matches);
  const [clearConfirm,setClearConfirm]=useState(false);
  const [editingBudget,setEditingBudget]=useState(false);
  const [budgetInput,setBudgetInput]=useState('');
  const [kbInset,setKbInset]=useState<{bottom:number;maxH?:number}>({bottom:0});

  useEffect(()=>{
    if(!sheet){setKbInset({bottom:0});return}
    const vv=window.visualViewport;
    if(!vv)return;
    const update=()=>{
      const bottom=Math.max(0,Math.round(window.innerHeight-(vv.height+vv.offsetTop)));
      setKbInset({bottom,maxH:Math.round(vv.height-12)});
    };
    update();
    vv.addEventListener('resize',update);
    vv.addEventListener('scroll',update);
    return()=>{vv.removeEventListener('resize',update);vv.removeEventListener('scroll',update)};
  },[sheet]);

  useEffect(()=>{saveStore(store)},[store]);
  useEffect(()=>{document.documentElement.classList.toggle('dark',dark);localStorage.setItem('bet-dark',dark?'1':'0')},[dark]);
  useEffect(()=>{const id=setInterval(()=>setStore(s=>ensureCurrentMonth(s)),60000);return()=>clearInterval(id)},[]);
  useEffect(()=>{if(!navigator.storage?.persist)return; navigator.storage.persist().catch(()=>{})},[]);
  useEffect(()=>{if(!undo)return;const t=setTimeout(()=>setUndo(null),5000);return()=>clearTimeout(t)},[undo]);
  useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'){if(clearConfirm)setClearConfirm(false);else if(sheet)closeSheet()}};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[sheet,clearConfirm]);

  const month=getActiveMonth(store); const rows=month.rows;
  const today=todayISO();
  const total=monthlyTotal(rows); const todayTotal=todaysExpense(rows,today); const left=remainingBudget(month.budget,rows); const avg=averageDaily(rows,month.monthKey);
  const projection=month.monthKey===currentMonthKey()?(total/Math.max(1,new Date().getDate()))*new Date(new Date().getFullYear(),new Date().getMonth()+1,0).getDate():0;
  const budgetPct=month.budget>0?total/month.budget*100:0;
  const visibleColumns=store.schema.columns.filter(c=>!c.hidden);

  const filtered=useMemo(()=>{const q=query.trim().toLowerCase(); if(!q)return rows; return rows.filter(r=>r.date.includes(q)||r.note?.toLowerCase().includes(q)||store.schema.columns.find(c=>c.id===r.columnId)?.label.toLowerCase().includes(q))},[rows,query,store.schema]);

  function prefillBatchDate(targetDate:string,columnId?:string){
    const existing=(store.months[targetDate.slice(0,7)]?.rows||[]).filter(r=>r.date===targetDate);
    const map:Record<string,number>={};
    for(const r of existing)map[r.columnId]=(map[r.columnId]||0)+r.amount;
    const next:Record<string,string>={};
    for(const [k,v] of Object.entries(map))if(v>0)next[k]=String(v);
    if(columnId&&!next[columnId]){
      const col=visibleColumns.find(c=>c.id===columnId);
      if(col?.defaultFare)next[col.id]=String(col.defaultFare);
    }
    const existingNote=existing.map(r=>r.note).filter(Boolean).pop()||'';
    setDraftDate(targetDate);
    setDraftAmounts(next);
    setDraftNote(existingNote);
  }
  function openSheet(row?:ExpenseRow,columnId?:string,date?:string){
    const defaultDate=date||(month.monthKey===currentMonthKey()?todayISO():`${month.monthKey}-01`);
    setEditing(row||null);
    setDraftAmount(row?String(row.amount):'');
    setDraftColumn(row?.columnId||columnId||visibleColumns[0]?.id||'');
    setFocusColumn(columnId||visibleColumns[0]?.id||'');
    if(row){
      setDraftDate(row.date);
      setDraftNote(row.note||'');
    }else{
      prefillBatchDate(defaultDate,columnId);
    }
    setSheet(true);
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
  function saveBatch(){
    if(!draftDate){notify('Select a date','error');return}
    if(draftDate>todayISO()&&Math.floor((new Date(draftDate).getTime()-new Date(todayISO()).getTime())/86400000)>1){notify('Date is more than one day in the future','error');return}
    const entries=visibleColumns.map(c=>({columnId:c.id,amount:Number(draftAmounts[c.id])||0})).filter(e=>e.amount>0);
    if(!entries.length){notify('Enter at least one route amount above ₹0','error');return}
    if(entries.some(e=>e.amount>1000000)){notify('Amount is above the safe maximum','error');return}
    const batchTotal=entries.reduce((s,e)=>s+e.amount,0);
    if(batchTotal>5000&&!confirm(`Total ₹${batchTotal.toLocaleString('en-IN')} is above ₹5,000. Save these entries?`))return;
    if(draftDate>todayISO()&&new Date(draftDate).getTime()>new Date(todayISO()).getTime()) notify('Future date selected','info');
    const time=new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:false});
    const note=draftNote.trim()||undefined;
    const mKey=draftDate.slice(0,7);
    const prevRows=(store.months[mKey]?.rows||[]).filter(r=>r.date===draftDate);
    const created:ExpenseRow[]=entries.map((e,idx)=>({id:uid(),date:draftDate,columnId:e.columnId,amount:e.amount,note:idx===entries.length-1?note:undefined,time}));
    setStore(s=>{let next=s;for(const old of prevRows)next=deleteRow(next,old.id,mKey);for(const r of created)next=upsertRow(next,r);return next});
    closeSheet();
    notify(prevRows.length?`Updated ${created.length} ${created.length===1?'entry':'entries'}`:created.length===1?'Entry saved':`Saved ${created.length} entries`);
    setUndo({label:prevRows.length?'Day entries updated':created.length===1?'Entry saved':`Saved ${created.length} entries`,action:()=>setStore(s=>{let next=s;for(const r of created)next=deleteRow(next,r.id,mKey);for(const old of prevRows)next=upsertRow(next,old);return next})});
  }
  function addQuick(columnId:string){
    const col=visibleColumns.find(c=>c.id===columnId); const amount=col?.defaultFare||0;
    if(amount>0){const row={id:uid(),date:today,columnId,amount,note:undefined};setStore(s=>upsertRow(s,row));notify(`Added ${formatINR(amount)}`,'success');setUndo({label:`Added ${formatINR(amount)}`,action:()=>setStore(s=>deleteRow(s,row.id,row.date.slice(0,7)))})}else openSheet(undefined,columnId)
  }
  function repeatYesterday(){
    const d=new Date();d.setDate(d.getDate()-1);const yISO=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;const key=yISO.slice(0,7);const source=store.months[key]?.rows.filter(r=>r.date===yISO)||[];
    if(!source.length){notify('No entries found yesterday','info');return} const copies=source.map(r=>({...r,id:uid(),date:today,time:r.time}));setStore(s=>{let next=s;for(const r of copies)next=upsertRow(next,r);return next});notify(`Repeated ${copies.length} entries`,`success`);setUndo({label:`Repeated ${copies.length} entries`,action:()=>setStore(s=>{let next=s;for(const r of copies)next=deleteRow(next,r.id,today.slice(0,7));return next})})
  }
  function removeRow(row:ExpenseRow){const monthKey=row.date.slice(0,7);setStore(s=>deleteRow(s,row.id,monthKey));notify('Entry deleted','info');setUndo({label:'Entry restored',action:()=>setStore(s=>upsertRow(s,row))})}
  function clearMonthNow(){setClearConfirm(false);const snapshot=rows;setStore(s=>clearMonth(s,month.monthKey));notify('Month entries cleared','info');setUndo({label:'Entries restored',action:()=>setStore(s=>{let next=s;for(const r of snapshot)next=upsertRow(next,r);return next})})}
  function deleteMonth(key:string){if(key===currentMonthKey()){notify('Cannot delete the active month','error');return}const snapshot=store.months[key];setStore(s=>deleteHistoryMonth(s,key));notify('Month deleted','info');setUndo({label:'Month restored',action:()=>setStore(s=>({...s,months:{...s.months,[key]:snapshot}}))})}

  const dayGroups=useMemo(()=>{const map=new Map<string,ExpenseRow[]>;for(const r of filtered){const a=map.get(r.date)||[];a.push(r);map.set(r.date,a)}return [...map.entries()].sort((a,b)=>b[0].localeCompare(a[0]))},[filtered]);

  return <div className="min-h-screen bg-gradient-to-br from-[#f3f6ff] via-[#f8f9ff] to-[#eef2ff] dark:from-[#070b14] dark:via-[#0b101d] dark:to-[#0f1629] text-slate-900 dark:text-slate-100 pb-20">
    <header className="sticky top-0 z-30 h-12 bg-white/75 dark:bg-slate-900/80 backdrop-blur-xl border-b border-indigo-100/80 dark:border-slate-800/80 shadow-[0_1px_12px_rgba(79,70,229,0.05)] flex items-center px-3 gap-2">
      <button className="icon-btn" aria-label="Previous month" onClick={()=>setStore(s=>setActiveMonth(s,shiftMonth(month.monthKey,-1)))}><ChevronLeft size={18}/></button>
      <button className="mx-auto text-center leading-tight" onClick={()=>setStore(s=>setActiveMonth(s,currentMonthKey()))}>
        <span className="block text-sm font-semibold">{formatMonthLabel(month.monthKey)}</span>
        <span className="block text-[10px] font-medium text-slate-500 dark:text-slate-400">{new Date().toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short',year:'numeric'})}</span>
      </button>
      <button className="icon-btn" aria-label="Next month" onClick={()=>setStore(s=>setActiveMonth(s,shiftMonth(month.monthKey,1)))}><ChevronRight size={18}/></button>
      <button className="icon-btn" aria-label="Toggle dark mode" onClick={()=>setDark(d=>!d)}>{dark?<Sun size={18} className="text-amber-400"/>:<Moon size={18} className="text-indigo-600"/>}</button>
      <button className="icon-btn" aria-label="Open settings" onClick={()=>setTab('settings')}><MoreHorizontal size={18}/></button>
    </header>

    {tab==='home'&&<main className="max-w-lg mx-auto px-3 sm:px-4 pt-3 pb-4 space-y-3">
      {month.monthKey!==currentMonthKey()&&<div className="flex justify-end px-1 text-xs"><button onClick={()=>setStore(s=>setActiveMonth(s,currentMonthKey()))} className="font-medium text-indigo-600 dark:text-indigo-400">Back to today</button></div>}
      <section className={`overflow-hidden rounded-2xl border ${budgetPct>=100?'border-rose-300/80 bg-gradient-to-br from-rose-50 to-white shadow-sm dark:border-rose-900/70 dark:from-rose-950/40 dark:to-slate-900':budgetPct>=80?'border-amber-300/80 bg-gradient-to-br from-amber-50 to-white shadow-sm dark:border-amber-900/70 dark:from-amber-950/30 dark:to-slate-900':'border-indigo-200/80 bg-gradient-to-br from-white via-indigo-50/60 to-violet-100/50 shadow-[0_8px_24px_-6px_rgba(79,70,229,0.14)] dark:shadow-sm dark:border-indigo-500/20 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/35'}`}>
        <div className="grid grid-cols-3 divide-x divide-slate-200/70 dark:divide-slate-800/80">
          <div className="px-2 py-3 text-center"><span className="block text-[11px] text-slate-500 dark:text-slate-400">Spent</span><strong className="mt-0.5 block text-base text-slate-950 dark:text-white">{formatINR(total)}</strong></div>
          <div className="px-2 py-3 text-center"><span className="block text-[11px] text-slate-500 dark:text-slate-400">Today</span><strong className="mt-0.5 block text-base text-slate-950 dark:text-white">{formatINR(todayTotal)}</strong></div>
          <div className="px-2 py-3 text-center"><span className="block text-[11px] text-slate-500 dark:text-slate-400">Left</span><strong className={`mt-0.5 block text-base ${left<0?'text-rose-600 dark:text-rose-400':'text-emerald-600 dark:text-emerald-400'}`}>{formatINR(left)}</strong></div>
        </div>
        <div className="h-1.5 bg-slate-100 dark:bg-slate-800/90"><div className={`h-full rounded-r-full transition-all ${budgetPct>=100?'bg-gradient-to-r from-rose-500 to-red-500':budgetPct>=80?'bg-gradient-to-r from-amber-500 to-orange-500':'bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500'}`} style={{width:`${Math.min(100,budgetPct)}%`}}/></div>
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          {editingBudget?<form onSubmit={e=>{e.preventDefault();const v=Math.max(0,Number(budgetInput)||0);setStore(s=>setBudget(s,v));setEditingBudget(false);notify('Budget updated')}} className="flex items-center gap-1.5 w-full">
            <span className="shrink-0">Budget</span>
            <input autoFocus inputMode="decimal" type="number" min="0" value={budgetInput} onChange={e=>setBudgetInput(e.target.value)} className="input-base !w-24 py-0.5 px-1.5 text-base sm:text-xs font-semibold"/>
            <button type="submit" className="px-2 py-0.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-[11px] font-semibold">Save</button>
            <button type="button" onClick={()=>setEditingBudget(false)} className="px-1.5 py-0.5 text-[11px] text-slate-500">Cancel</button>
          </form>:<>
            <button type="button" onClick={()=>{setBudgetInput(String(month.budget||''));setEditingBudget(true)}} className="inline-flex items-center gap-1 font-medium hover:text-indigo-600 dark:hover:text-indigo-400">
              <span>Budget <b className="text-slate-800 dark:text-slate-200">{formatINR(month.budget)}</b></span>
              <Pencil size={11}/>
            </button>
            {month.monthKey===currentMonthKey()&&<span className="truncate">{formatINR(avg)}/day · Proj {formatINR(projection)}</span>}
          </>}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold">Quick add</h2><button onClick={()=>openSheet()} className="text-xs font-medium text-indigo-600 dark:text-indigo-400">Custom entry</button></div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {visibleColumns.map(c=>{
            const routeName=c.shortLabel||c.label;
            return <div key={c.id} className="relative min-w-0 rounded-2xl border border-indigo-100/90 bg-white/95 shadow-[0_2px_10px_rgba(79,70,229,0.05)] hover:shadow-[0_6px_18px_rgba(79,70,229,0.12)] hover:border-indigo-300 dark:border-slate-800/80 dark:bg-slate-900/90 dark:shadow-sm dark:hover:border-indigo-500/40 transition">
              <button onClick={()=>addQuick(c.id)} onContextMenu={e=>{e.preventDefault();openSheet(undefined,c.id)}} className="w-full min-h-[58px] px-3 pr-8 py-2 text-left active:scale-[0.98] transition-transform" aria-label={`Add ${c.label}`}>
                <span className="block truncate text-[13px] font-semibold text-slate-900 dark:text-slate-100">{routeName}</span>
                <span className="mt-0.5 block text-xs font-medium text-indigo-600/85 dark:text-slate-400">{c.defaultFare?formatINR(c.defaultFare):'Set fare'}</span>
              </button>
              <button onClick={()=>openSheet(undefined,c.id)} className="absolute right-1.5 top-1.5 icon-btn !min-h-[34px] !min-w-[34px]" aria-label={`Edit ${c.label}`}><Pencil size={13}/></button>
            </div>
          })}
        </div>
      </section>

      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search date, route or note" className="input-base pl-9"/></div>
        <button onClick={repeatYesterday} className="h-[40px] shrink-0 rounded-xl border border-indigo-200 bg-indigo-50/50 dark:bg-indigo-950/30 px-3 text-xs font-semibold text-indigo-700 dark:border-indigo-800/70 dark:text-indigo-300 hover:bg-indigo-100/60 dark:hover:bg-indigo-950/50 transition">Repeat yesterday</button>
      </div>

      {dayGroups.length===0?<section className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 px-5 text-center dark:border-slate-800"><div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400"><Plus size={22}/></div><h3 className="text-sm font-semibold">No expenses yet</h3><p className="mt-1 max-w-[220px] text-xs leading-5 text-slate-500 dark:text-slate-400">Tap a route above or add a custom entry to get started.</p><button onClick={()=>openSheet()} className="mt-3 min-h-[40px] rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 text-sm font-semibold text-white shadow-md shadow-indigo-500/20">Add first entry</button></section>:<div className="space-y-2">{dayGroups.map(([date,entries])=>{const dayTotal=entries.reduce((s,r)=>s+r.amount,0);return <section key={date} className="overflow-hidden rounded-2xl border border-indigo-100/90 bg-white/95 shadow-[0_4px_14px_-4px_rgba(79,70,229,0.07)] dark:border-slate-800/80 dark:bg-slate-900/90 dark:shadow-sm"><button onClick={()=>setOpenDay(openDay===date?null:date)} className="flex min-h-[54px] w-full items-center gap-3 px-3 text-left" aria-expanded={openDay===date}><div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 dark:bg-slate-800 dark:text-slate-200"><span className="text-[10px] uppercase text-indigo-500 dark:text-slate-400">{MONTH_NAMES[Number(date.slice(5,7))-1].slice(0,3)}</span><b className="text-sm leading-none">{Number(date.slice(8))}</b></div><div className="min-w-0 flex-1"><span className="block truncate text-xs text-slate-500 dark:text-slate-400">{entries.map(r=>{const col=visibleColumns.find(c=>c.id===r.columnId);return col?.shortLabel||col?.label||'Other'}).join(' · ')}</span><span className="mt-0.5 block text-xs text-slate-400">{entries.length} {entries.length===1?'entry':'entries'}</span></div><b className="text-base">{formatINR(dayTotal)}</b></button>{openDay===date&&<div className="border-t border-slate-100 dark:border-slate-800">{entries.map(r=><div key={r.id} className="flex min-h-[52px] items-center border-b px-3 last:border-0 border-slate-100 dark:border-slate-800"><button className="min-w-0 flex-1 text-left" onClick={()=>openSheet(r)}><span className="block truncate text-sm">{store.schema.columns.find(c=>c.id===r.columnId)?.label}</span>{r.note&&<span className="block truncate text-xs text-slate-400">{r.note}</span>}</button><b className="ml-2 text-sm">{formatINR(r.amount)}</b><button aria-label="Edit entry" onClick={()=>openSheet(r)} className="icon-btn ml-1 text-slate-500 hover:text-indigo-600"><Pencil size={15}/></button><button aria-label="Delete entry" onClick={()=>removeRow(r)} className="icon-btn text-rose-500"><Trash2 size={15}/></button></div>)}<button onClick={()=>openSheet(undefined,undefined,date)} className="flex w-full items-center justify-center gap-1 py-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 border-t border-slate-100 dark:border-slate-800"><Plus size={14}/>Add entries for {Number(date.slice(8))} {MONTH_NAMES[Number(date.slice(5,7))-1].slice(0,3)}</button></div>}</section>})}</div>}
      <p className="pb-1 text-center text-[11px] text-slate-400">{rows.length} entries · {formatINR(total)} this month</p>
    </main>}

    {tab==='history'&&<main className="max-w-xl mx-auto px-3 py-3 space-y-3"><ExpenseHistory store={store} month={month} onSelectMonth={key=>setStore(s=>setActiveMonth(s,key))} onDeleteMonth={deleteMonth} onEditRow={openSheet} onDeleteRow={removeRow} onExportCSV={()=>exportMonthCSV(month,store.schema)}/></main>}

    {tab==='stats'&&<main className="max-w-xl mx-auto px-3 py-3"><ExpenseStats store={store} month={month}/></main>}

    {tab==='salary'&&<main className="max-w-xl mx-auto px-3 py-3"><SalaryTracker monthKey={month.monthKey} notify={notify}/></main>}

    {tab==='settings'&&<main className="max-w-xl mx-auto px-3 py-3 space-y-3"><h2 className="font-semibold text-sm">Settings</h2>
      {shouldBackupNudge()&&<div className="text-xs border border-amber-300 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-2">Backup recommended · your last JSON backup is over 30 days old</div>}
      <label className="block text-xs text-gray-500">Monthly budget<input type="number" min="0" value={month.budget} onChange={e=>setStore(s=>setBudget(s,Math.max(0,Number(e.target.value))))} className="input-base mt-1"/></label>
      <button onClick={()=>setClearConfirm(true)} className="settings-btn text-red-600"><RotateCcw size={16}/>Clear this month's entries</button>
      <button onClick={()=>exportMonthCSV(month,store.schema)} className="settings-btn"><Download size={16}/>Export CSV</button>
      <button onClick={()=>exportJSON(store,setStore,notify)} className="settings-btn"><Download size={16}/>JSON backup export</button>
      <button onClick={()=>importJSON(setStore,notify)} className="settings-btn"><Upload size={16}/>Import JSON (merge)</button>
      <ColumnSettings store={store} setStore={setStore} notify={notify}/>
    </main>}

    <nav className="safe-bottom fixed bottom-0 inset-x-0 z-40 h-14 bg-white/80 dark:bg-slate-900/85 backdrop-blur-xl border-t border-indigo-100/80 dark:border-slate-800/80 shadow-[0_-2px_12px_rgba(79,70,229,0.05)] flex"><TabButton icon={<Home size={19}/>} label="Home" active={tab==='home'} onClick={()=>setTab('home')}/><TabButton icon={<History size={19}/>} label="History" active={tab==='history'} onClick={()=>setTab('history')}/><TabButton icon={<BarChart3 size={19}/>} label="Stats" active={tab==='stats'} onClick={()=>setTab('stats')}/><TabButton icon={<Wallet size={19}/>} label="Salary" active={tab==='salary'} onClick={()=>setTab('salary')}/><TabButton icon={<Settings size={19}/>} label="Settings" active={tab==='settings'} onClick={()=>setTab('settings')}/></nav>
    {tab==='home'&&<button onClick={()=>openSheet()} className="fixed bottom-16 right-3 z-30 w-12 h-12 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-lg shadow-indigo-500/30 flex items-center justify-center transition" aria-label="Add entry"><Plus size={24}/></button>}

    {sheet&&<div className="fixed inset-0 z-50"><button className="absolute inset-0 bg-slate-950/50 backdrop-blur-[1px]" aria-label="Close entry sheet" onClick={closeSheet}/><div style={{bottom:kbInset.bottom,maxHeight:kbInset.maxH?`${kbInset.maxH}px`:'92dvh'}} className="absolute inset-x-0 flex flex-col rounded-t-2xl bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-2xl">
      {editing?<>
        <div className="p-2.5 pb-[calc(10px+env(safe-area-inset-bottom))] overflow-y-auto">
          <div className="flex items-center justify-between mb-1.5"><b className="text-sm">Edit entry</b><button className="icon-btn !min-h-[32px] !min-w-[32px]" aria-label="Close" onClick={closeSheet}><X size={16}/></button></div>
          <input autoFocus inputMode="decimal" type="text" value={draftAmount} onChange={e=>setDraftAmount(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();saveEntry()}}} placeholder="₹ Amount" className="input-base text-base font-semibold py-1.5"/>
          <div className="flex gap-1.5 overflow-x-auto py-1.5">{visibleColumns.map(c=><button key={c.id} type="button" onClick={()=>setDraftColumn(c.id)} className={`chip !min-h-[34px] px-2.5 ${draftColumn===c.id?'ring-2 ring-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300':''}`}>{c.shortLabel||c.label}</button>)}</div>
          <div className="grid grid-cols-[132px_1fr] gap-1.5"><input type="date" value={draftDate} onChange={e=>setDraftDate(e.target.value)} className="input-base text-base sm:text-sm py-1.5 px-2"/><input value={draftNote} onChange={e=>setDraftNote(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();saveEntry()}}} placeholder="Note (optional)" className="input-base text-base sm:text-sm py-1.5"/></div>
          <button onClick={saveEntry} className="w-full mt-2 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-semibold shadow-sm">Save</button>
        </div>
      </>:(()=>{
        const batchCount=visibleColumns.filter(c=>(Number(draftAmounts[c.id])||0)>0).length;
        const batchSum=visibleColumns.reduce((s,c)=>s+(Number(draftAmounts[c.id])||0),0);
        return <>
          <div className="flex items-center justify-between gap-1.5 px-2.5 py-2 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <b className="text-sm shrink-0">Add entries</b>
            <div className="flex items-center gap-1">
              <button type="button" onClick={()=>{const d=new Date();d.setDate(d.getDate()-1);prefillBatchDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`)}} className="rounded-lg px-2 py-1 text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600">Yesterday</button>
              <input aria-label="Entry date" type="date" value={draftDate} onChange={e=>prefillBatchDate(e.target.value)} className="input-base !w-auto text-base sm:text-xs py-1 px-2"/>
            </div>
            <button className="icon-btn !min-h-[32px] !min-w-[32px] shrink-0" aria-label="Close" onClick={closeSheet}><X size={16}/></button>
          </div>
          <div className="overflow-y-auto px-2.5 py-1.5 space-y-1.5 flex-1">
            {visibleColumns.map(c=><div key={c.id} className="flex items-center gap-2">
              <div className="min-w-0 flex-1 flex items-center gap-1.5">
                <span className="truncate text-xs font-medium text-slate-800 dark:text-slate-200">{c.shortLabel||c.label}</span>
                {!!c.defaultFare&&<button type="button" onClick={()=>setDraftAmounts(a=>({...a,[c.id]:String(c.defaultFare)}))} className="shrink-0 rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-300">₹{c.defaultFare}</button>}
              </div>
              <input autoFocus={focusColumn===c.id} inputMode="decimal" type="text" value={draftAmounts[c.id]||''} onChange={e=>setDraftAmounts(a=>({...a,[c.id]:e.target.value}))} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();saveBatch()}}} placeholder="₹ 0" className="input-base !w-24 text-right text-base sm:text-sm font-semibold py-1 px-2"/>
            </div>)}
          </div>
          <div className="px-2.5 pt-1.5 pb-[calc(10px+env(safe-area-inset-bottom))] border-t border-slate-100 dark:border-slate-800 shrink-0 flex items-center gap-1.5">
            <input value={draftNote} onChange={e=>setDraftNote(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();saveBatch()}}} placeholder="Note (optional)" className="input-base flex-1 text-base sm:text-sm py-1.5"/>
            <button onClick={saveBatch} className="shrink-0 px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-semibold shadow-sm">
              {batchCount>0?`Save (${batchCount}) · ${formatINR(batchSum)}`:'Save'}
            </button>
          </div>
        </>;
      })()}
    </div></div>}

    {undo&&<div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-[60] bg-gray-900 text-white rounded-lg px-3 py-2 text-sm flex items-center gap-3 shadow-lg"><span>{undo.label}</span><button onClick={()=>{undo.action();setUndo(null)}} className="font-bold flex items-center gap-1 text-blue-400"><Undo2 size={14}/>Undo</button><button aria-label="Dismiss" onClick={()=>setUndo(null)} className="text-gray-400 hover:text-white"><X size={14}/></button></div>}
    {clearConfirm&&<div className="fixed inset-0 z-[70] bg-black/40 flex items-end sm:items-center justify-center p-3"><div className="bg-white dark:bg-gray-900 rounded-xl p-4 w-full max-w-sm"><b className="text-sm">Clear this month's entries?</b><p className="text-xs text-gray-500 my-2">Entries can be restored with Undo.</p><div className="flex gap-2"><button onClick={()=>setClearConfirm(false)} className="flex-1 py-2 border rounded-lg">Cancel</button><button onClick={clearMonthNow} className="flex-1 py-2 rounded-lg bg-red-600 text-white">Clear</button></div></div></div>}
  </div>
}

function TabButton({icon,label,active,onClick}:{icon:React.ReactNode;label:string;active:boolean;onClick:()=>void}){return <button onClick={onClick} className={`flex-1 flex flex-col items-center justify-center text-[11px] transition ${active?'text-indigo-600 dark:text-indigo-400 font-semibold':'text-slate-500 dark:text-slate-400'}`}>{icon}<span>{label}</span></button>}

function ExpenseHistory({store,month,onSelectMonth,onDeleteMonth,onEditRow,onDeleteRow,onExportCSV}:{store:Store;month:ReturnType<typeof getActiveMonth>;onSelectMonth:(key:string)=>void;onDeleteMonth:(key:string)=>void;onEditRow:(row:ExpenseRow)=>void;onDeleteRow:(row:ExpenseRow)=>void;onExportCSV:()=>void}){
 const [expandedDate,setExpandedDate]=useState<string|null>(null);
 const dayRows=useMemo(()=>{
  const map=new Map<string,ExpenseRow[]>();
  for(const r of month.rows){const arr=map.get(r.date)||[];arr.push(r);map.set(r.date,arr)}
  return [...map.entries()].sort((a,b)=>b[0].localeCompare(a[0]));
 },[month.rows]);
 const total=monthlyTotal(month.rows);
 const left=remainingBudget(month.budget,month.rows);
 return <div className="space-y-3">
  <div className="flex items-center justify-between">
   <h2 className="font-semibold text-sm">Month History</h2>
   <button onClick={onExportCSV} className="inline-flex items-center gap-1 rounded-xl border border-indigo-100 dark:border-slate-700 bg-white/95 dark:bg-slate-900 px-2.5 py-1 text-xs font-medium hover:bg-indigo-50/70 dark:hover:bg-slate-800"><Download size={13}/>CSV</button>
  </div>
  <div className="flex gap-2 overflow-x-auto pb-1">
   {Object.keys(store.months).sort().reverse().map(key=>{
    const m=store.months[key];
    const active=key===month.monthKey;
    return <div key={key} className={`shrink-0 rounded-xl border px-3 py-2 flex items-center gap-2 transition ${active?'border-indigo-400 bg-indigo-50/80 dark:border-indigo-500/60 dark:bg-indigo-950/35':'border-indigo-100/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900'}`}>
     <button className="text-left" onClick={()=>onSelectMonth(key)}>
      <b className="block text-xs">{formatMonthLabel(key)}</b>
      <span className="block text-[11px] text-slate-500 dark:text-slate-400">{formatINR(monthlyTotal(m.rows))} · {m.rows.length}</span>
     </button>
     {key!==currentMonthKey()&&<button aria-label="Delete month" onClick={()=>onDeleteMonth(key)} className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg"><Trash2 size={14}/></button>}
    </div>;
   })}
  </div>
  <section className="panel !p-0 overflow-hidden">
   <div className="flex items-center justify-between px-3 py-2 border-b border-indigo-100/80 dark:border-slate-800 text-xs">
    <b>{formatMonthLabel(month.monthKey)}</b>
    <span className="text-slate-500 dark:text-slate-400">Spent <b className="text-slate-900 dark:text-slate-100">{formatINR(total)}</b> · Left <b className={left<0?'text-rose-600 dark:text-rose-400':'text-emerald-600 dark:text-emerald-400'}>{formatINR(left)}</b></span>
   </div>
   {dayRows.length===0?<p className="p-6 text-center text-xs text-slate-400">No expenses recorded for {formatMonthLabel(month.monthKey)}.</p>:<div className="overflow-x-auto">
    <table className="w-full text-left border-collapse text-xs">
     <thead>
      <tr className="border-b border-indigo-100/80 dark:border-slate-800 bg-indigo-50/40 dark:bg-slate-800/50 text-[11px] text-slate-500 dark:text-slate-400">
       <th className="py-2 px-2.5 font-medium whitespace-nowrap">Date</th>
       <th className="py-2 px-2 font-medium">Routes &amp; Details</th>
       <th className="py-2 px-2.5 font-medium text-right whitespace-nowrap">Total</th>
      </tr>
     </thead>
     <tbody className="divide-y divide-indigo-100/70 dark:divide-slate-800">
      {dayRows.map(([date,entries])=>{
       const dayTotal=entries.reduce((s,r)=>s+r.amount,0);
       const dObj=new Date(`${date}T00:00:00`);
       const dayLabel=`${Number(date.slice(8))} ${MONTH_NAMES[Number(date.slice(5,7))-1].slice(0,3)}`;
       const weekday=dObj.toLocaleDateString('en-IN',{weekday:'short'});
       const notes=[...new Set(entries.map(r=>r.note).filter(Boolean))];
       const isOpen=expandedDate===date;
       return <>
        <tr key={date} onClick={()=>setExpandedDate(isOpen?null:date)} className="cursor-pointer hover:bg-indigo-50/35 dark:hover:bg-slate-800/30 transition">
         <td className="py-2 px-2.5 whitespace-nowrap align-top">
          <span className="font-semibold text-slate-900 dark:text-slate-100 block">{dayLabel}</span>
          <span className="text-[10px] text-slate-400">{weekday}</span>
         </td>
         <td className="py-2 px-2 align-top">
          <div className="flex flex-wrap gap-1">
           {entries.map(r=>{
            const col=store.schema.columns.find(c=>c.id===r.columnId);
            return <span key={r.id} className="inline-flex items-center gap-1 rounded-md bg-indigo-50/70 dark:bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-700 dark:text-slate-300">
             <span>{col?.shortLabel||col?.label||'Other'}</span>
             <b className="text-indigo-700 dark:text-indigo-300">{formatINR(r.amount)}</b>
            </span>;
           })}
          </div>
          {notes.length>0&&<p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[220px]">{notes.join(' · ')}</p>}
         </td>
         <td className="py-2 px-2.5 text-right font-bold tabular-nums whitespace-nowrap align-top text-slate-950 dark:text-white">{formatINR(dayTotal)}</td>
        </tr>
        {isOpen&&<tr key={`${date}-detail`} className="bg-slate-50/70 dark:bg-slate-950/40">
         <td colSpan={3} className="px-2.5 py-1.5">
          <div className="space-y-1">
           {entries.map(r=>{
            const col=store.schema.columns.find(c=>c.id===r.columnId);
            return <div key={r.id} className="flex items-center justify-between gap-2 text-[11px] py-0.5">
             <span className="truncate text-slate-700 dark:text-slate-300">{col?.label||'Other'}{r.note?` — ${r.note}`:''}</span>
             <div className="flex items-center gap-1 shrink-0">
              <b className="tabular-nums">{formatINR(r.amount)}</b>
              <button aria-label="Edit entry" onClick={e=>{e.stopPropagation();onEditRow(r)}} className="p-1 text-slate-500 hover:text-indigo-600 rounded"><Pencil size={12}/></button>
              <button aria-label="Delete entry" onClick={e=>{e.stopPropagation();onDeleteRow(r)}} className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded"><Trash2 size={12}/></button>
             </div>
            </div>;
           })}
          </div>
         </td>
        </tr>}
       </>;
      })}
     </tbody>
     <tfoot>
      <tr className="border-t border-indigo-100 dark:border-slate-700 bg-indigo-50/40 dark:bg-slate-800/40 font-semibold">
       <td colSpan={2} className="py-2 px-2.5">Total ({dayRows.length} {dayRows.length===1?'day':'days'} · {month.rows.length} entries)</td>
       <td className="py-2 px-2.5 text-right tabular-nums">{formatINR(total)}</td>
      </tr>
     </tfoot>
    </table>
   </div>}
  </section>
 </div>;
}

function ExpenseStats({store,month}:{store:Store;month:ReturnType<typeof getActiveMonth>}){
 const [selectedDay,setSelectedDay]=useState<string|null>(null);
 const daily=new Map<string,number>();for(const r of month.rows)daily.set(r.date,(daily.get(r.date)||0)+r.amount);const entries=[...daily.entries()].sort((a,b)=>a[0].localeCompare(b[0])).slice(-30);const max=Math.max(...entries.map(v=>v[1]),1);
 const peakEntry=entries.reduce<[string,number]|null>((best,cur)=>!best||cur[1]>best[1]?cur:best,null);
 const sums=store.schema.columns.map(c=>({c,value:month.rows.filter(r=>r.columnId===c.id).reduce((s,r)=>s+r.amount,0)})).filter(v=>v.value>0);const maxSum=Math.max(...sums.map(v=>v.value),1);
 const weekStart=new Date();weekStart.setDate(weekStart.getDate()-6);const weekStartISO=`${weekStart.getFullYear()}-${String(weekStart.getMonth()+1).padStart(2,'0')}-${String(weekStart.getDate()).padStart(2,'0')}`;const weekly=month.rows.filter(r=>r.date>=weekStartISO).reduce((s,r)=>s+r.amount,0);
 const keys=Object.keys(store.months).sort();const i=keys.indexOf(month.monthKey);const prev=i>0?store.months[keys[i-1]]:undefined;const prevTotal=prev?monthlyTotal(prev.rows):0;const delta=prevTotal?((monthlyTotal(month.rows)-prevTotal)/prevTotal)*100:0;
 const activeEntry=selectedDay?entries.find(([d])=>d===selectedDay):peakEntry||entries[entries.length-1];
 const W=320,H=110,PX=14,PT=18,PB=18,usableW=W-PX*2,usableH=H-PT-PB;
 const pts=entries.map(([date,value],idx)=>({
  date,value,
  x:entries.length===1?W/2:PX+(idx/(entries.length-1))*usableW,
  y:PT+usableH-(value/max)*usableH
 }));
 const linePath=pts.map((p,idx)=>`${idx===0?'M':'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
 const areaPath=pts.length>1?`${linePath} L${pts[pts.length-1].x.toFixed(1)},${PT+usableH} L${pts[0].x.toFixed(1)},${PT+usableH} Z`:'';
 const fmtDay=(d:string)=>`${Number(d.slice(8))} ${MONTH_NAMES[Number(d.slice(5,7))-1].slice(0,3)}`;
 return <div className="space-y-3">
  <div className="grid grid-cols-2 gap-2">
   <div className="stat"><span>Last 7 days</span><b>{formatINR(weekly)}</b></div>
   <div className="stat"><span>vs last month</span><b className={delta>0?'text-red-500':'text-emerald-600'}>{delta>=0?'+':''}{delta.toFixed(0)}%</b></div>
  </div>
  <section className="panel">
   <div className="flex items-center justify-between gap-2">
    <b className="text-sm">Spending trend</b>
    {peakEntry&&<span className="rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">Peak: {fmtDay(peakEntry[0])} · {formatINR(peakEntry[1])}</span>}
   </div>
   {entries.length===0?<p className="py-8 text-center text-xs text-gray-400">No spending data for this month</p>:<>
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[132px] mt-2 overflow-visible select-none">
     <defs>
      <linearGradient id="spendArea" x1="0" y1="0" x2="0" y2="1">
       <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.32"/>
       <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02"/>
      </linearGradient>
     </defs>
     {[0,0.5,1].map(t=>{const y=PT+usableH*(1-t);return <line key={t} x1={PX} y1={y} x2={W-PX} y2={y} stroke="currentColor" strokeOpacity="0.08" strokeDasharray="3 3"/>})}
     {areaPath&&<path d={areaPath} fill="url(#spendArea)"/>}
     {pts.length>1&&<path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>}
     {pts.map(p=>{
      const isPeak=peakEntry?.[0]===p.date;
      const isSel=activeEntry?.[0]===p.date;
      return <g key={p.date} className="cursor-pointer" onClick={()=>setSelectedDay(p.date)}>
       <circle cx={p.x} cy={p.y} r="10" fill="transparent"/>
       {isPeak&&<circle cx={p.x} cy={p.y} r="7" fill="#f59e0b" fillOpacity="0.22"/>}
       <circle cx={p.x} cy={p.y} r={isPeak||isSel?4.2:2.8} fill={isPeak?'#f59e0b':isSel?'#1d4ed8':'#3b82f6'} stroke="#fff" strokeWidth="1.5"/>
       {isPeak&&<text x={p.x} y={Math.max(10,p.y-9)} textAnchor="middle" className="fill-amber-600 dark:fill-amber-400 text-[9px] font-bold">{formatINR(p.value)}</text>}
       <text x={p.x} y={H-3} textAnchor="middle" className="fill-gray-400 text-[8px]">{Number(p.date.slice(8))}</text>
      </g>;
     })}
    </svg>
    {activeEntry&&<div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-800"><span>Selected: <b className="text-gray-800 dark:text-gray-200">{fmtDay(activeEntry[0])}</b></span><b className="text-gray-900 dark:text-gray-100">{formatINR(activeEntry[1])}</b></div>}
   </>}
  </section>
  <section className="panel"><div className="flex items-center justify-between gap-2"><b className="text-sm">30-day spending</b>{activeEntry&&<span className="text-xs text-gray-500 dark:text-gray-400">{fmtDay(activeEntry[0])}: <b className="text-gray-900 dark:text-gray-100">{formatINR(activeEntry[1])}</b></span>}</div>{entries.length===0?<p className="py-8 text-center text-xs text-gray-400">No spending data for this month</p>:<div className="h-[136px] flex items-end gap-1.5 mt-3">{entries.map(([date,value])=>{const h=Math.max(12,Math.round((value/max)*100));const isSelected=activeEntry?.[0]===date;const isPeak=peakEntry?.[0]===date;const ratio=value/max;const barColor=isPeak?'bg-gradient-to-t from-rose-500 to-amber-400':isSelected?'bg-gradient-to-t from-violet-600 to-fuchsia-500':ratio>=0.65?'bg-gradient-to-t from-indigo-600 to-violet-500':ratio>=0.3?'bg-gradient-to-t from-emerald-500 to-teal-400':'bg-gradient-to-t from-sky-500 to-cyan-400';return <button key={date} type="button" onClick={()=>setSelectedDay(date)} title={`${date}: ${formatINR(value)}`} className="flex-1 h-full flex flex-col items-center justify-end gap-1 min-w-[10px]"><div className="w-full flex-1 flex items-end"><div className={`w-full rounded-t transition-all ${barColor}`} style={{height:`${h}%`}}/></div><span className="text-[9px] text-gray-400 leading-none">{Number(date.slice(8))}</span></button>})}</div>}</section>
  <section className="panel"><b className="text-sm">Route breakdown</b><div className="mt-2 space-y-2">{sums.map(({c,value})=>{const pct=value/maxSum*100;return <div key={c.id}><div className="flex justify-between text-xs mb-1"><span>{c.shortLabel||c.label}</span><b>{formatINR(value)}</b></div><div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full"><div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full" style={{width:`${pct}%`}}/></div></div>})}{!sums.length&&<p className="text-xs text-slate-400">No route data</p>}</div></section>
 </div>
}

function ColumnSettings({store,setStore,notify}:{store:Store;setStore:(updater:(s:Store)=>Store)=>void;notify:(m:string,t?:'success'|'error'|'info')=>void}){
 const [newLabel,setNewLabel]=useState('');
 const [newFare,setNewFare]=useState('');
 const [dragId,setDragId]=useState<string|null>(null);
 function addRoute(){
  const label=newLabel.trim();
  if(!label){notify('Route name cannot be empty','error');return}
  if(store.schema.columns.some(c=>c.label.toLowerCase()===label.toLowerCase())){notify('A route with this name already exists','error');return}
  const fare=Math.max(0,Number(newFare)||0);
  const schema={...store.schema,columns:[...store.schema.columns,{id:uid(),label,defaultFare:fare}]};
  setStore(s=>updateSchema(s,schema));
  setNewLabel('');setNewFare('');
  notify('Route added');
 }
 function move(idx:number,dir:-1|1){
  const target=idx+dir;
  if(target<0||target>=store.schema.columns.length)return;
  const cols=store.schema.columns.slice();
  [cols[idx],cols[target]]=[cols[target],cols[idx]];
  setStore(s=>updateSchema(s,{...store.schema,columns:cols}));
 }
 function reorder(fromId:string,toId:string){
  if(fromId===toId)return;
  const cols=store.schema.columns.slice();
  const fromIdx=cols.findIndex(c=>c.id===fromId);
  const toIdx=cols.findIndex(c=>c.id===toId);
  if(fromIdx<0||toIdx<0)return;
  const [item]=cols.splice(fromIdx,1);
  cols.splice(toIdx,0,item);
  setStore(s=>updateSchema(s,{...store.schema,columns:cols}));
 }
 function toggleHidden(id:string,hidden?:boolean){
  const used=Object.values(store.months).some(m=>m.rows.some(r=>r.columnId===id));
  const schema={...store.schema,columns:store.schema.columns.map(c=>c.id===id?{...c,hidden:!hidden}:c)};
  setStore(s=>updateSchema(s,schema));
  notify(!hidden?(used?'Route hidden; past entries remain':'Route hidden'):'Route visible','info');
 }
 function remove(id:string){
  if(store.schema.columns.length<=1){notify('At least one route is required','error');return}
  const used=Object.values(store.months).some(m=>m.rows.some(r=>r.columnId===id));
  if(used&&!confirm('This route has existing entries. Delete the route and its entries?'))return;
  const schema={...store.schema,columns:store.schema.columns.filter(c=>c.id!==id)};
  setStore(s=>updateSchema(s,schema));
  notify('Route deleted');
 }
 return <section className="panel"><b className="text-sm">Routes</b><p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Drag or use arrows to reorder. Hide to keep past entries, or delete to remove.</p><div className="mt-2 space-y-1.5">{store.schema.columns.map((c,idx)=><div key={c.id} draggable onDragStart={()=>setDragId(c.id)} onDragOver={e=>e.preventDefault()} onDrop={()=>{if(dragId)reorder(dragId,c.id);setDragId(null)}} onDragEnd={()=>setDragId(null)} className={`flex items-center gap-1 rounded-lg border border-gray-100 dark:border-gray-800 p-1 ${c.hidden?'opacity-50':''} ${dragId===c.id?'ring-2 ring-blue-500 bg-blue-50/40 dark:bg-blue-950/20':''}`}>
  <span className="cursor-grab text-gray-400 px-0.5 hidden sm:inline-flex" title="Drag to reorder"><GripVertical size={14}/></span>
  <div className="flex flex-col">
   <button type="button" onClick={()=>move(idx,-1)} disabled={idx===0} aria-label="Move route up" className="p-0.5 text-gray-400 hover:text-blue-600 disabled:opacity-25"><ArrowUp size={12}/></button>
   <button type="button" onClick={()=>move(idx,1)} disabled={idx===store.schema.columns.length-1} aria-label="Move route down" className="p-0.5 text-gray-400 hover:text-blue-600 disabled:opacity-25"><ArrowDown size={12}/></button>
  </div>
  <input aria-label="Route label" value={c.label} onChange={e=>{const schema={...store.schema,columns:store.schema.columns.map(x=>x.id===c.id?{...x,label:e.target.value}:x)};setStore(s=>updateSchema(s,schema))}} className="input-base flex-1 min-w-0 py-1.5 px-2"/>
  <input aria-label="Default fare" type="number" min="0" value={c.defaultFare||''} placeholder="₹" onChange={e=>{const schema={...store.schema,columns:store.schema.columns.map(x=>x.id===c.id?{...x,defaultFare:Number(e.target.value)||0}:x)};setStore(s=>updateSchema(s,schema))}} className="input-base !w-14 py-1.5 px-1.5 text-center"/>
  <button type="button" aria-label={c.hidden?'Show route':'Hide route'} title={c.hidden?'Show route':'Hide route'} onClick={()=>toggleHidden(c.id,c.hidden)} className="icon-btn !min-h-[34px] !min-w-[30px]">{c.hidden?<EyeOff size={15}/>:<Eye size={15}/>}</button>
  <button type="button" aria-label="Delete route" title="Delete route" onClick={()=>remove(c.id)} className="icon-btn !min-h-[34px] !min-w-[30px] text-red-500"><Trash2 size={15}/></button>
 </div>)}<div className="flex items-center gap-1 pt-2 border-t border-slate-100 dark:border-slate-800"><input aria-label="New route name" value={newLabel} onChange={e=>setNewLabel(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addRoute()}}} placeholder="New route name…" className="input-base flex-1 min-w-0 py-1.5"/><input aria-label="New route default fare" type="number" min="0" value={newFare} onChange={e=>setNewFare(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addRoute()}}} placeholder="Fare" className="input-base !w-16 py-1.5 px-2 text-center"/><button type="button" onClick={addRoute} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-semibold hover:from-indigo-500 hover:to-violet-500 shrink-0"><Plus size={14}/>Add</button></div></div></section>
}

function shouldBackupNudge(){const last=localStorage.getItem(LS_LAST_BACKUP);if(!last)return true;return Date.now()-Number(last)>30*86400000}
function exportJSON(store:Store,_setStore:(u:(s:Store)=>Store)=>void,notify:(m:string,t?:'success'|'error'|'info')=>void){const blob=new Blob([JSON.stringify(store,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`expense-backup-${todayISO()}.json`;a.click();URL.revokeObjectURL(url);localStorage.setItem(LS_LAST_BACKUP,String(Date.now()));notify('JSON backup exported')}
function importJSON(setStore:(u:(s:Store)=>Store)=>void,notify:(m:string,t?:'success'|'error'|'info')=>void){const input=document.createElement('input');input.type='file';input.accept='application/json';input.onchange=()=>{const file=input.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const parsed=JSON.parse(String(reader.result)) as Store;if(!parsed.months||typeof parsed.months!=='object'||!parsed.schema)throw new Error();const replace=confirm('Replace existing data? Cancel to merge.');setStore(s=>replace?parsed:mergeStores(s,parsed));notify('Backup imported')}catch{notify('Invalid JSON backup','error')}};reader.readAsText(file)};input.click()}
function mergeStores(base:Store,incoming:Store):Store{const months={...base.months};for(const [key,m] of Object.entries(incoming.months)){const existing=months[key]?.rows||[];months[key]={...m,rows:[...existing,...m.rows.filter(r=>!existing.some(x=>x.id===r.id))]}}return {...base,months,schema:incoming.schema||base.schema}}

export default function App(){return <ToastProvider><Tracker/></ToastProvider>}
