// 🔥 FIREBASE SETUP (ONLY ONCE)
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDE3sdmPG3TGKV0CJDWHYPzDRE-8OKIanw",
  authDomain: "hs-expensemanager.firebaseapp.com",
  projectId: "hs-expensemanager",
  storageBucket: "hs-expensemanager.firebasestorage.app",
  messagingSenderId: "500261749602",
  appId: "1:500261749602:web:9840d9da48d8ace202223b",
  measurementId: "G-PFS0S1EKBC"
};

const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

import React, { useState, useMemo, useEffect } from "react";
import {
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged
} from "firebase/auth";
import {
  doc,
  setDoc,
  deleteDoc,
  collection,
  onSnapshot
} from "firebase/firestore";

import { 
  LayoutDashboard, 
  ArrowRightLeft, 
  UserCheck, 
  UserMinus, 
  Target, 
  Plus, 
  Search, 
  X, 
  FileSpreadsheet, 
  Settings, 
  Trash2, 
  Pencil,
  Wallet, 
  PlusCircle, 
  RotateCcw, 
  CheckCircle2, 
  Sparkles, 
  Loader2, 
  Cloud, 
  Banknote, 
  ChevronDown, 
  History, 
  ArrowRightLeft as NetIcon, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Database, 
  Clock, 
  CalendarDays, 
  BellRing, 
  Plane, 
  Car, 
  TrendingUp, 
  RefreshCcw, 
  CreditCard as CardIcon, 
  FileText 
} from 'lucide-react';


const appId = 'hs-expenses-manager-pro';

const App = () => {
  const apiKey = ""; 

  // --- STATES ---
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingDebtId, setEditingDebtId] = useState(null);
  const [editingGoalId, setEditingGoalId] = useState(null); 
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [showSuccess, setShowSuccess] = useState(false);
  
  // Data States
  const [transactions, setTransactions] = useState([]);
  const [debts, setDebts] = useState([]);
  const [goals, setGoals] = useState([]);
  const [accountRecords, setAccountRecords] = useState([]);
  const [aiInsight, setAiInsight] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Suggested Lists
  const defaultCategories = ['Salary', 'Rent', 'Grocery', 'Investment', 'Fuel', 'Shopping', 'Medical', 'Insurance', 'EMI', 'LIC', 'Policy', 'Transfer'];
  const defaultSubcategories = ['Monthly Pay', 'Milk', 'Petrol', 'Electricity', 'LIC Premium', 'HDFC EMI', 'Home Savings', 'Internal Transfer'];
  
  const [categories, setCategories] = useState(defaultCategories);
  const [subcategories, setSubcategories] = useState(defaultSubcategories);
  const [accounts, setAccounts] = useState(['Bank', 'Cash', 'Credit Card', 'UPI', 'Wallet']);
  const entryTypes = ['Expense', 'Income', 'EMI_Payment', 'Goal_Deposit', 'Insurance_Premium', 'Investment', 'Balance_Transfer'];

  // --- FIREBASE AUTH ---
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // --- FIREBASE DATA SYNC ---
  useEffect(() => {
    if (!user) return;
    const sync = (collName, setter) => {
      const q = collection(db, 'artifacts', appId, 'users', user.uid, collName);
      return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        setter(data);
      });
    };
    const unsubTx = sync('transactions', setTransactions);
    const unsubDebt = sync('debts', setDebts);
    const unsubGoal = sync('goals', setGoals);
    const unsubAcc = sync('accountRecords', setAccountRecords);
    
    const unsubCat = sync('categories', (data) => {
      const names = data.map(d => d.name);
      setCategories([...new Set([...defaultCategories, ...names])]);
    });
    const unsubSub = sync('subcategories', (data) => {
      const names = data.map(d => d.name);
      setSubcategories([...new Set([...defaultSubcategories, ...names])]);
    });
    
    return () => { unsubTx(); unsubDebt(); unsubGoal(); unsubAcc(); unsubCat(); unsubSub(); };
  }, [user]);

  const initialFormState = {
    date: new Date().toISOString().split('T')[0],
    type: 'Expense',
    category: 'Grocery',
    subcategory: '', 
    status: 'Done',
    amount: '', 
    account: 'Bank',
    toAccount: '', 
    paymentName: '',
    note: '',
    linkedId: ''
  };

  const initialDebtState = {
    name: '',
    type: 'Given',
    total: '',
    paid: '0',
    dueDate: new Date().toISOString().split('T')[0]
  };

  const [formData, setFormData] = useState(initialFormState);
  const [debtFormData, setDebtFormData] = useState(initialDebtState);
  const [goalFormData, setGoalFormData] = useState({ name: '', target: '', current: '0', targetDate: '' });

  // --- CALCULATIONS ---
  const totals = useMemo(() => {
    const openingBal = accountRecords.reduce((acc, curr) => acc + Number(curr.balance || 0), 0);
    const income = transactions.filter(t => t.type === 'Income').reduce((acc, curr) => acc + Number(curr.amount), 0);
    const expense = transactions.filter(t => ['Expense', 'EMI_Payment', 'Insurance_Premium', 'Goal_Deposit', 'Investment'].includes(t.type)).reduce((acc, curr) => acc + Number(curr.amount), 0);
    
    const rec = debts.filter(d => d.type === 'Given').reduce((acc, curr) => acc + (Number(curr.total) - Number(curr.paid)), 0);
    const pay = debts.filter(d => d.type === 'Taken' || d.type === 'Subscription').reduce((acc, curr) => acc + (Number(curr.total) - Number(curr.paid)), 0);
    
    const dynamicAccounts = [...new Set([...accounts, ...transactions.map(t => t.account), ...transactions.filter(t => t.type === 'Balance_Transfer').map(t => t.toAccount), ...accountRecords.map(r => r.name)])].filter(Boolean);
    const accBreakdown = dynamicAccounts.map(acc => {
       const op = Number(accountRecords.find(r => r.name === acc)?.balance || 0);
       const inc = transactions.filter(t => (t.account === acc && t.type === 'Income') || (t.toAccount === acc && t.type === 'Balance_Transfer')).reduce((acc_sum,curr_tx) => acc_sum + Number(curr_tx.amount), 0);
       const exp = transactions.filter(t => (t.account === acc && (t.type !== 'Income' && t.type !== 'Balance_Transfer')) || (t.account === acc && t.type === 'Balance_Transfer')).reduce((acc_sum,curr_tx) => acc_sum + Number(curr_tx.amount), 0);
       return { name: acc, balance: op + inc - exp };
    });

    return { balance: openingBal + income - expense, rec, pay, accBreakdown };
  }, [transactions, debts, accountRecords, accounts]);

  // Ledger Logic
  const nameLedgers = useMemo(() => {
    const map = {};
    debts.forEach(d => {
      const normKey = d.name.trim().toLowerCase();
      if (!map[normKey]) {
        map[normKey] = { name: d.name.trim(), receivables: 0, payables: 0, records: [], linkedTx: [] };
      }
      const bal = Number(d.total) - Number(d.paid);
      if (d.type === 'Given') map[normKey].receivables += bal;
      else if (d.type === 'Taken' || d.type === 'Subscription') map[normKey].payables += bal;
      map[normKey].records.push(d);
    });
    transactions.forEach(t => {
      const txSubName = (t.subcategory || "").trim().toLowerCase();
      Object.keys(map).forEach(normKey => {
        const isExplicitlyLinked = t.linkedId && map[normKey].records.some(r => r.id === t.linkedId);
        const isNameMatched = txSubName === normKey;
        if (isExplicitlyLinked || isNameMatched) {
          if (!map[normKey].linkedTx.some(existing => existing.id === t.id)) {
            map[normKey].linkedTx.push(t);
          }
        }
      });
    });
    Object.values(map).forEach(group => { group.linkedTx.sort((a, b) => new Date(b.date) - new Date(a.date)); });
    return Object.values(map);
  }, [debts, transactions]);

  // Group Reports Logic
  const groupedReports = useMemo(() => {
    const groups = {};
    transactions.forEach(t => {
      const key = (t.subcategory || t.category || "General").trim().toLowerCase();
      if (!groups[key]) groups[key] = { label: t.subcategory || t.category, total: 0, items: [] };
      groups[key].total += Number(t.amount);
      groups[key].items.push(t);
    });
    return Object.values(groups).sort((a,b) => b.total - a.total);
  }, [transactions]);

  // Goal Planner Logic
  const goalReport = useMemo(() => {
    return goals.map(g => {
      const remaining = Number(g.target) - Number(g.current);
      const diffMonths = Math.ceil(Math.abs(new Date(g.targetDate) - new Date()) / (1000 * 60 * 60 * 24 * 30.44)) || 1;
      const history = transactions.filter(t => t.linkedId === g.id).sort((a, b) => new Date(b.date) - new Date(a.date));
      return { ...g, remaining, diffMonths, monthlyRequired: remaining > 0 ? Math.ceil(remaining / diffMonths) : 0, history };
    });
  }, [goals, transactions]);

  const filteredTx = useMemo(() => {
    return transactions
      .filter(t => {
        const searchStr = `${t.category || ""} ${t.subcategory || ""} ${t.note || ""} ${t.account || ""}`.toLowerCase();
        const matchSearch = searchStr.includes(searchQuery.toLowerCase());
        const matchType = filterType === 'All' || t.type === filterType;
        return matchSearch && matchType;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [transactions, searchQuery, filterType]);

  // --- ACTIONS ---
  const saveToCloud = async (coll, id, data) => { if (user) await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, coll, id.toString()), data); };
  const handleDelete = async (coll, id) => { if (user) await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, coll, id.toString())); };

  const handleTransaction = async (e) => {
    e.preventDefault();
    if (!user) return;
    const id = editingId || Date.now();
    const amt = Number(formData.amount);
    await saveToCloud('transactions', id, { ...formData, id, amount: amt });
    if (formData.linkedId) {
      const d = debts.find(x => x.id === formData.linkedId);
      if(d) await saveToCloud('debts', d.id, { ...d, paid: Number(d.paid) + amt });
      const g = goals.find(x => x.id === formData.linkedId);
      if(g) await saveToCloud('goals', g.id, { ...g, current: Number(g.current) + amt });
    }
    if (formData.category && !categories.includes(formData.category)) await saveToCloud('categories', Date.now(), { name: formData.category });
    if (formData.subcategory && !subcategories.includes(formData.subcategory)) await saveToCloud('subcategories', Date.now(), { name: formData.subcategory });
    
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 1500);
    if(editingId) { setIsModalOpen(false); setEditingId(null); }
    setFormData(initialFormState);
  };

  const handleDebt = async (e) => {
    e.preventDefault();
    const id = editingDebtId || Date.now();
    await saveToCloud('debts', id, { ...debtFormData, id, total: Number(debtFormData.total), paid: Number(debtFormData.paid) });
    setIsDebtModalOpen(false);
    setDebtFormData(initialDebtState);
    setEditingDebtId(null);
  };

  const handleGoal = async (e) => {
    e.preventDefault();
    const id = editingGoalId || Date.now();
    await saveToCloud('goals', id, { ...goalFormData, id, target: Number(goalFormData.target), current: Number(goalFormData.current) });
    setIsGoalModalOpen(false);
    setGoalFormData({ name: '', target: '', current: '0', targetDate: '' });
    setEditingGoalId(null);
  };

  const exportToSheets = () => {
    let csv = "\ufeff"; 
    csv += "Timeline,Entry Type,Main Category,Transaction Name,Account/Mode,Note,Status,Amount\n";
    transactions.forEach(t => {
      const row = [t.date, t.type, t.category, `"${(t.subcategory || "").replace(/"/g, '""')}"`, t.account, `"${(t.note || "").replace(/"/g, '""')}"`, t.status, t.amount];
      csv += row.join(",") + "\n";
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `HS_Expenses_Report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!user) return <div className="h-screen flex items-center justify-center bg-black text-white italic tracking-widest text-xs uppercase"><Loader2 className="animate-spin mr-3"/> Connecting...</div>;

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col md:flex-row font-sans selection:bg-black selection:text-white text-gray-900">
      
      {/* QUICK ENTRY MODAL */}
      <div className={`fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm transition-all ${isModalOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="bg-white rounded-[2.5rem] w-full max-w-xl max-h-[95vh] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in duration-300">
          <div className="p-6 border-b flex justify-between items-center bg-gray-50/50 sticky top-0 z-10">
            <h3 className="font-black text-lg uppercase tracking-tighter flex items-center gap-2 text-gray-800"><Cloud size={20} className="text-blue-500" /> Quick Add Transaction</h3>
            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-all"><X size={24}/></button>
          </div>
          <div className="flex-grow overflow-y-auto p-8 space-y-6 custom-scrollbar">
            {showSuccess && <div className="p-4 bg-green-50 text-green-700 rounded-2xl text-xs font-black border border-green-200 animate-in slide-in-from-top-2 flex items-center gap-2"><CheckCircle2 size={16}/> Saved Successfully!</div>}
            <form id="tx-form" onSubmit={handleTransaction} className="space-y-6 pb-4">
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5"><label className="text-[10px] font-black uppercase text-gray-400 ml-1 tracking-widest">Entry Date</label><input type="date" required value={formData.date} onChange={e=>setFormData({...formData, date:e.target.value})} className="w-full border-2 border-gray-100 bg-gray-50 p-3.5 rounded-2xl text-xs font-bold outline-none focus:border-black focus:bg-white transition-all" /></div>
                  <div className="space-y-1.5"><label className="text-[10px] font-black uppercase text-blue-600 ml-1 tracking-widest">Entry Type</label><input list="types" placeholder="Income, Expense..." required value={formData.type} onChange={e=>setFormData({...formData, type:e.target.value, linkedId:''})} className="w-full border-2 border-gray-100 bg-gray-50 p-3.5 rounded-2xl text-xs font-black outline-none focus:border-black focus:bg-white transition-all" /></div>
               </div>
               {formData.type === 'Balance_Transfer' ? (
                 <div className="p-5 bg-orange-50 rounded-[2rem] border-2 border-orange-100 animate-in fade-in space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-1.5"><label className="text-[10px] font-black uppercase text-orange-600 tracking-widest">From Account</label><input list="accs" required value={formData.account} onChange={e=>setFormData({...formData, account:e.target.value})} placeholder="Source" className="w-full border-2 border-white p-3.5 rounded-xl text-xs font-black outline-none focus:border-orange-500" /></div>
                       <div className="space-y-1.5"><label className="text-[10px] font-black uppercase text-orange-600 tracking-widest">To Account</label><input list="accs" required value={formData.toAccount} onChange={e=>setFormData({...formData, toAccount:e.target.value})} placeholder="Destination" className="w-full border-2 border-white p-3.5 rounded-xl text-xs font-black outline-none focus:border-orange-500" /></div>
                    </div>
                 </div>
               ) : (
                 <div className="grid grid-cols-2 gap-4 animate-in fade-in">
                    <div className="space-y-1.5"><label className="text-[10px] font-black uppercase text-gray-400 ml-1 tracking-widest">Main Category</label><input list="cats" placeholder="Food, Rent..." required value={formData.category} onChange={e=>setFormData({...formData, category:e.target.value})} className="w-full border-2 border-gray-100 bg-gray-50 p-3.5 rounded-2xl text-xs font-bold outline-none focus:border-black focus:bg-white transition-all" /></div>
                    <div className="space-y-1.5"><label className="text-[10px] font-black uppercase text-gray-400 ml-1 tracking-widest">Transaction Name (Sub)</label><input list="subs" placeholder="Milk, LIC..." required value={formData.subcategory} onChange={e=>setFormData({...formData, subcategory:e.target.value})} className="w-full border-2 border-gray-100 bg-gray-50 p-3.5 rounded-2xl text-xs font-bold outline-none focus:border-black focus:bg-white transition-all" /></div>
                 </div>
               )}
               <div className="grid grid-cols-2 gap-4">
                  {formData.type !== 'Balance_Transfer' && (<div className="space-y-1.5"><label className="text-[10px] font-black uppercase text-orange-600 ml-1 tracking-widest">Paid Via (Mode)</label><input list="accs" required value={formData.account} onChange={e=>setFormData({...formData, account:e.target.value})} placeholder="UPI, Cash..." className="w-full border-2 border-gray-100 bg-gray-50 p-3.5 rounded-2xl text-xs font-black outline-none focus:border-black focus:bg-white transition-all" /></div>)}
                  <div className="space-y-1.5"><label className="text-[10px] font-black uppercase text-orange-600 ml-1 tracking-widest">Bank / UPI Detail (Sub)</label><input placeholder="SBI, PhonePe..." value={formData.paymentName} onChange={e=>setFormData({...formData, paymentName:e.target.value})} className="w-full border-2 border-gray-100 bg-gray-50 p-3.5 rounded-2xl text-xs font-bold outline-none focus:border-black focus:bg-white transition-all" /></div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5"><label className="text-[10px] font-black uppercase text-purple-600 ml-1 tracking-widest">Tx Status</label><select value={formData.status} onChange={e=>setFormData({...formData, status:e.target.value})} className="w-full border-2 border-gray-100 bg-gray-50 p-3.5 rounded-2xl text-xs font-black outline-none focus:border-black focus:bg-white transition-all"><option value="Done">Done ✅</option><option value="Hold">Hold ⏸</option><option value="Incomplete">Fail ❌</option></select></div>
                  <div className="space-y-1.5"><label className="text-[10px] font-black uppercase text-gray-400 ml-1 tracking-widest">Amount (₹)</label><div className="relative"><span className="absolute left-4 top-3.5 text-xs text-gray-400 font-black italic">₹</span><input type="number" required value={formData.amount} onChange={e=>setFormData({...formData, amount:e.target.value})} placeholder="0.00" className="w-full pl-8 border-2 border-gray-100 bg-gray-50 p-3.5 rounded-2xl text-sm font-black outline-none focus:border-black focus:bg-white transition-all" /></div></div>
               </div>
               {['EMI_Payment', 'Income', 'Expense', 'Insurance_Premium', 'Goal_Deposit'].includes(formData.type) && (
                 <div className="space-y-1.5 p-5 bg-blue-50/50 rounded-[2rem] border-2 border-blue-50"><label className="text-[10px] font-black uppercase text-blue-600 tracking-widest ml-1">Link to Master Record (Relation)</label><select value={formData.linkedId} onChange={e=>setFormData({...formData, linkedId:e.target.value})} className="w-full border-2 border-blue-100 p-4 rounded-2xl text-xs font-black bg-white outline-none focus:border-blue-500 shadow-sm transition-all"><option value="">-- No link (Independent Tx) --</option>{debts.map(d=><option key={d.id} value={d.id}>{d.name} ({d.type}) - Bal: ₹{Number(d.total) - Number(d.paid)}</option>)}{goals.map(g=><option key={g.id} value={g.id}>Goal: {g.name} (Need: ₹{Number(g.target)-Number(g.current)})</option>)}</select></div>
               )}
               <div className="space-y-1.5"><label className="text-[10px] font-black uppercase text-gray-400 ml-1 tracking-widest">Extra Remarks</label><textarea placeholder="Write details here..." value={formData.note} onChange={e=>setFormData({...formData, note:e.target.value})} className="w-full border-2 border-gray-100 bg-gray-50 p-4 rounded-2xl text-xs font-bold outline-none focus:border-black focus:bg-white transition-all resize-none" rows="2" /></div>
            </form>
          </div>
          <div className="p-6 border-t flex gap-4 bg-gray-50 sticky bottom-0"><button onClick={()=>setIsModalOpen(false)} className="flex-1 border-2 border-gray-200 p-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 hover:bg-white transition-all">Back</button><button form="tx-form" type="submit" className="flex-[2] bg-black text-white p-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all">Submit Entry</button></div>
        </div>
      </div>

      {/* SIDEBAR */}
      <div className="hidden md:flex w-72 bg-white border-r p-8 flex-col h-screen sticky top-0 transition-all shadow-sm">
        <div className="flex items-center gap-3 mb-10">
          <div className="bg-black text-white p-2 rounded-xl shadow-lg"><Wallet size={24}/></div>
          <h1 className="text-xl font-black uppercase tracking-tighter">HS_Manager</h1>
        </div>
        <nav className="space-y-3 flex-grow font-bold">
          {[
            { id: 'dashboard', icon: <LayoutDashboard size={20}/> },
            { id: 'history', icon: <ArrowRightLeft size={20}/> },
            { id: 'debts', icon: <UserCheck size={20}/> },
            { id: 'goals', icon: <Target size={20}/> },
            { id: 'report', icon: <FileText size={20}/> },
            { id: 'settings', icon: <Settings size={20}/> }
          ].map(tab => (
            <button 
              key={tab.id} 
              onClick={()=>setActiveTab(tab.id)} 
              className={`w-full flex items-center gap-4 p-4 rounded-2xl text-sm transition-all ${activeTab === tab.id ? 'bg-black text-white shadow-xl translate-x-2' : 'text-gray-400 hover:bg-gray-50'}`}
            >
              {tab.icon}
              <span className="capitalize">{tab.id}</span>
            </button>
          ))}
        </nav>
        <button onClick={exportToSheets} className="w-full bg-green-50 text-green-700 p-4 rounded-2xl text-[10px] font-black border-2 border-green-100 flex items-center justify-center gap-2 hover:bg-green-100 transition-all uppercase tracking-widest"><FileSpreadsheet size={16}/> EXPORT REPORT</button>
      </div>

      <main className="flex-grow p-4 md:p-10 max-w-7xl mx-auto w-full pb-32 overflow-x-hidden">
        <header className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-10">
          <div><h2 className="text-4xl font-black text-gray-900 tracking-tighter uppercase">{activeTab} View</h2><p className="text-gray-400 text-[10px] font-black tracking-widest mt-1 uppercase tracking-widest">HS_Manager PRO • Real-time Sync</p></div>
          <button onClick={()=>{setEditingId(null); setFormData(initialFormState); setIsModalOpen(true);}} className="bg-black text-white px-8 py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3"><PlusCircle size={18}/> Quick Entry</button>
        </header>

        {activeTab === 'dashboard' && (
          <div className="space-y-10 animate-in fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-black uppercase tracking-widest">
              <div className="bg-white p-8 rounded-[2.5rem] border-l-[12px] border-blue-500 shadow-sm transition-all hover:scale-[1.02]"><span className="text-[10px] text-gray-300">Net Flow</span><h3 className="text-3xl text-gray-900 mt-2">₹{totals.balance.toLocaleString()}</h3></div>
              <div className="bg-white p-8 rounded-[2.5rem] border-l-[12px] border-green-500 shadow-sm transition-all hover:scale-[1.02]"><span className="text-[10px] text-gray-300">Receivables</span><h3 className="text-3xl text-green-600 mt-2">₹{totals.rec.toLocaleString()}</h3></div>
              <div className="bg-white p-8 rounded-[2.5rem] border-l-[12px] border-red-500 shadow-sm transition-all hover:scale-[1.02]"><span className="text-[10px] text-gray-300">Payables</span><h3 className="text-3xl text-red-600 mt-2">₹{totals.pay.toLocaleString()}</h3></div>
            </div>
            <div className="bg-white p-8 rounded-[3.5rem] border shadow-sm transition-all">
               <h4 className="font-black text-xl uppercase mb-6 flex items-center gap-3 tracking-tighter text-gray-800"><Database className="text-orange-500" size={24}/> Account Status</h4>
               <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {totals.accBreakdown.map(acc => (
                    <div key={acc.name} className="p-4 bg-gray-50 rounded-2xl border-2 border-transparent hover:border-black transition-all group">
                       <div className="flex justify-between items-start"><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest group-hover:text-gray-900 transition-colors">{acc.name}</p>{acc.name.toLowerCase().includes('card') ? <CardIcon size={12} className="text-red-400"/> : <Banknote size={12} className="text-green-400"/>}</div>
                       <p className={`text-xl font-black mt-1 ${acc.balance < 0 ? 'text-red-500' : 'text-gray-900'}`}>₹{acc.balance.toLocaleString()}</p>
                    </div>
                  ))}
               </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               <div className="bg-white p-10 rounded-[3rem] border shadow-sm border-t-[12px] border-t-red-500">
                  <h4 className="font-black text-xl uppercase mb-6 flex items-center gap-3 tracking-tighter text-gray-800"><BellRing className="text-red-500" size={22}/> Active Loans & EMI</h4>
                  <div className="space-y-6">
                    {debts.filter(d => d.type === 'Taken' && (d.total - d.paid) > 0).map(d => (
                      <div key={d.id} className="p-4 border-b border-gray-100 flex justify-between items-center group hover:bg-gray-50 rounded-xl transition-all">
                        <div><p className="font-black text-xs uppercase text-gray-900">{d.name}</p><p className="text-[9px] font-bold text-gray-400 mt-1 flex items-center gap-1"><Clock size={10}/> Due: {d.dueDate}</p></div>
                        <p className="font-black text-sm text-red-600">₹{(Number(d.total) - Number(d.paid)).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
               </div>
               <div className="bg-white p-10 rounded-[3rem] border shadow-sm border-t-[12px] border-t-blue-500">
                  <h4 className="font-black text-xl uppercase mb-6 flex items-center gap-3 tracking-tighter text-gray-800"><CalendarDays className="text-blue-500" size={22}/> LIC & Subscriptions</h4>
                  <div className="space-y-6">
                    {debts.filter(d => d.type === 'Subscription' && (d.total - d.paid) > 0).map(d => (
                      <div key={d.id} className="p-4 border-b border-gray-100 flex justify-between items-center">
                        <div><p className="font-black text-xs uppercase text-gray-900">{d.name}</p><p className="text-[9px] font-bold text-gray-400 mt-1">Expiry: {d.dueDate}</p></div>
                        <p className="font-black text-sm text-blue-600">₹{(Number(d.total) - Number(d.paid)).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
               </div>
            </div>
            <div className="bg-white p-10 rounded-[3.5rem] border shadow-sm border-t-[12px] border-t-purple-500">
               <h4 className="font-black text-2xl uppercase tracking-tighter flex items-center gap-3 text-gray-800 mb-8"><TrendingUp className="text-purple-500" size={28}/> Future Goal Planner</h4>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {goalReport.map(g => (
                    <div key={g.id} className="p-6 bg-gray-50 rounded-[2.5rem] border-2 border-transparent hover:border-purple-200 transition-all group">
                       <div className="flex justify-between items-start mb-4"><h5 className="font-black text-lg uppercase text-gray-900 tracking-tighter">{g.name}</h5><TrendingUp size={20} className="text-gray-300"/></div>
                       <div className="space-y-4 font-black uppercase">
                          <div className="flex justify-between items-center"><p className="text-[9px] text-gray-400">Months To Go</p><p className="text-sm text-gray-900">{g.diffMonths}</p></div>
                          <div className="p-4 bg-white rounded-2xl border-2 border-purple-50 text-center">
                             <p className="text-[8px] text-purple-400 mb-1">Monthly Plan</p>
                             <p className="text-2xl text-purple-600 tracking-tighter">₹{g.monthlyRequired.toLocaleString()}</p>
                          </div>
                       </div>
                    </div>
                  ))}
               </div>
            </div>
          </div>
        )}

        {/* ... Rest of the views (debts, goals, report, settings, history) ... */}
        {activeTab === 'debts' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-5">
             <div className="flex justify-between items-center bg-white p-8 rounded-[2.5rem] border shadow-sm">
                <div><h3 className="font-black text-xl uppercase tracking-tighter text-gray-900">Name Based Ledgers</h3><p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mt-1">Grouped Transactions</p></div>
                <button onClick={()=>{setEditingDebtId(null); setIsDebtModalOpen(true);}} className="bg-black text-white px-10 py-4 rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all">New Master Entry</button>
             </div>
             <div className="space-y-12">
               {nameLedgers.map(ledger => {
                 const net = ledger.receivables - ledger.payables;
                 return (
                   <div key={ledger.name} className="bg-white rounded-[3.5rem] border shadow-md overflow-hidden transition-all hover:shadow-2xl font-black uppercase">
                    <div className="p-10 border-b bg-gray-50/50 flex flex-col md:flex-row justify-between items-center gap-6">
                       <div><h2 className="text-4xl tracking-tighter text-gray-900">{ledger.name}</h2><div className={`mt-3 flex items-center gap-3 px-6 py-3 rounded-2xl border-2 text-lg tracking-widest shadow-sm ${net >= 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}><NetIcon size={20}/> Net Balance: ₹{Math.abs(net).toLocaleString()} <span>{net >= 0 ? '(Lena Hai)' : '(Dena Hai)'}</span></div></div>
                       <div className="flex gap-8 text-center uppercase font-black tracking-widest font-black uppercase tracking-widest"><div className="bg-green-50/50 p-4 rounded-3xl border border-green-100 min-w-[120px]"><p className="text-[10px] text-gray-400 mb-1 flex items-center gap-1 justify-center"><ArrowDownLeft size={12}/> Lena Hai</p><p className="text-2xl text-green-600 font-black">₹{ledger.receivables.toLocaleString()}</p></div><div className="bg-red-50/50 p-4 rounded-3xl border border-red-100 min-w-[120px]"><p className="text-[10px] text-gray-400 mb-1 flex items-center gap-1 justify-center"><ArrowUpRight size={12}/> Dena Hai</p><p className="text-2xl text-red-600 font-black">₹{ledger.payables.toLocaleString()}</p></div></div>
                    </div>
                    <div className="p-10 grid grid-cols-1 lg:grid-cols-2 gap-10 font-black uppercase">
                       <div><h4 className="text-xs text-gray-400 tracking-[0.2em] mb-4">Account Master Records</h4><div className="space-y-3">{ledger.records.map(r => (<div key={r.id} className={`p-5 rounded-2xl border-2 flex justify-between items-center group transition-all hover:bg-gray-50 ${r.type==='Given'?'border-green-100 bg-green-50/10':'border-red-100 bg-red-50/10'}`}><div><p className="text-[10px] text-gray-400 tracking-tighter">{r.dueDate} • {r.type}</p><p className="font-black text-sm text-gray-900 tracking-tighter">Initial: ₹{Number(r.total).toLocaleString()}</p></div><div className="flex items-center gap-4 text-right"><div><p className="font-black text-sm text-gray-900 tracking-tighter">Bal: ₹{(Number(r.total) - Number(r.paid)).toLocaleString()}</p><p className="text-[8px] font-bold text-gray-400 tracking-widest">Left</p></div><button onClick={()=>handleDelete('debts', r.id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 p-2"><Trash2 size={16}/></button></div></div>))}</div></div>
                       <div><h4 className="text-xs text-gray-400 tracking-[0.2em] mb-4 flex items-center gap-2 tracking-widest border-b pb-2"><History size={16}/> Payments history</h4><div className="space-y-3 max-h-[350px] overflow-y-auto custom-scrollbar pr-3">{ledger.linkedTx.map(t => (<div key={t.id} className="flex justify-between items-center p-4 border shadow-sm bg-white rounded-2xl border-transparent hover:border-gray-200 transition-all group font-black"><div className="flex items-center gap-3"><div className={`p-2 rounded-lg ${t.type === 'Income' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}><Banknote size={14}/></div><div><p className="uppercase text-[10px] text-gray-900 tracking-tighter">{t.date}</p><p className="text-[9px] text-gray-400 uppercase font-bold">{t.account} • {t.type === 'Income' ? 'Got Back' : 'Paid'}</p></div></div><p className={`font-black text-sm ${t.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>{t.type === 'Income' ? '+' : '-'} ₹{t.amount.toLocaleString()}</p></div>))}</div></div>
                    </div>
                 </div>
               );})}
             </div>
          </div>
        )}

        {activeTab === 'goals' && (
          <div className="space-y-10 animate-in slide-in-from-bottom-5">
            <div className="flex justify-between items-center bg-white p-8 rounded-[2.5rem] border shadow-sm transition-all hover:shadow-md">
               <div><h3 className="font-black text-xl uppercase tracking-tighter text-gray-900">Savings Goals & Progress Bar</h3><p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mt-1">Goal Saving Timeline</p></div>
               <button onClick={()=>setIsGoalModalOpen(true)} className="bg-black text-white px-10 py-4 rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all font-black"><PlusCircle size={18} className="inline mr-2"/> Setup New Goal</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {goalReport.map(g => (
                <div key={g.id} className="bg-white p-10 rounded-[3rem] border shadow-lg group relative overflow-hidden transition-all hover:shadow-2xl">
                   <div className="absolute top-8 right-8 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={() => { setGoalFormData({ name: g.name, target: g.target, current: g.current, targetDate: g.targetDate }); setEditingGoalId(g.id); setIsGoalModalOpen(true); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition-all"><Pencil size={18}/></button>
                      <button onClick={()=>handleDelete('goals', g.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18}/></button>
                   </div>
                   <div className="flex justify-between items-start mb-8 font-black uppercase">
                     <div><h3 className="text-3xl tracking-tighter text-gray-900">{g.name}</h3><p className="text-xs text-purple-500 tracking-widest">Date: {g.targetDate}</p></div>
                     <div className="text-right"><p className="text-3xl text-blue-600 tracking-tight">{Math.round((Number(g.current)/Number(g.target))*100)}%</p><p className="text-[10px] text-gray-300">Achieved</p></div>
                   </div>
                   <div className="w-full bg-gray-100 h-6 rounded-full overflow-hidden mb-10 border shadow-inner"><div className="bg-black h-full transition-all duration-1000 shadow-xl" style={{width:`${Math.min((g.current/g.target)*100, 100)}%`}}></div></div>
                   <div className="space-y-4">
                      <h4 className="text-[10px] font-black uppercase text-gray-400 flex items-center gap-2 tracking-widest border-b pb-2"><History size={12}/> Deposit History</h4>
                      <div className="space-y-2 max-h-[150px] overflow-y-auto custom-scrollbar uppercase font-black">
                         {g.history.map(tx => (
                           <div key={tx.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-transparent hover:border-blue-100 transition-all">
                              <p className="text-[10px] text-gray-700">{tx.date}</p><p className="text-[10px] font-black text-green-600">₹{Number(tx.amount).toLocaleString()}</p>
                           </div>
                         ))}
                      </div>
                   </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'report' && (
          <div className="space-y-10 animate-in slide-in-from-bottom-5">
             <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm transition-all hover:shadow-lg font-black uppercase">
                <h3 className="text-2xl tracking-tighter text-gray-900 flex items-center gap-3"><FileText className="text-blue-500" /> Grouped Statement Report</h3>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {groupedReports.map(group => (
                   <div key={group.label} className="bg-white p-6 rounded-[2.5rem] border shadow-sm hover:shadow-xl transition-all border-t-[8px] border-t-black">
                      <div className="flex justify-between items-start mb-4"><h4 className="font-black uppercase text-gray-900 tracking-tighter">{group.label}</h4><span className="bg-gray-100 text-gray-500 text-[9px] font-black px-2 py-1 rounded-full">{group.items.length} TXs</span></div>
                      <div className="mb-6"><p className="text-[10px] font-black text-gray-400 uppercase">Total Flow</p><p className="text-3xl font-black text-gray-900">₹{group.total.toLocaleString()}</p></div>
                      <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-2 uppercase text-[10px] font-black">
                         {group.items.map(item => (<div key={item.id} className="flex justify-between items-center p-2 bg-gray-50 rounded-xl text-[10px] font-bold"><span>{item.date}</span><span className={item.type === 'Income' ? 'text-green-600' : 'text-red-600'}>₹{Number(item.amount).toLocaleString()}</span></div>))}
                      </div>
                   </div>
                ))}
             </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-8 animate-in zoom-in duration-300">
             <div className="bg-white p-10 rounded-[3rem] border shadow-sm max-w-3xl mx-auto">
                <h3 className="font-black text-2xl uppercase mb-8 flex items-center gap-3 text-gray-800"><Database size={24} className="text-orange-500"/> Account Configuration</h3>
                <form onSubmit={async (e) => { e.preventDefault(); const name = e.target.accName.value; const bal = e.target.accBal.value; await saveToCloud('accountRecords', Date.now(), { name, balance: Number(bal) }); e.target.reset(); }} className="flex gap-3 mb-10"><input name="accName" list="accs" required placeholder="Account Name" className="flex-[2] border-2 border-gray-100 bg-gray-50 p-4 rounded-2xl text-xs font-bold outline-none focus:border-black transition-all" /><input name="accBal" type="number" required placeholder="Opening Balance ₹" className="flex-1 border-2 border-gray-100 bg-gray-50 p-4 rounded-2xl text-xs font-black outline-none focus:border-black transition-all" /><button type="submit" className="bg-black text-white px-8 rounded-2xl font-black uppercase text-[10px] active:scale-95 transition-all">Set</button></form>
                <div className="space-y-3 uppercase font-black text-xs text-gray-600">
                   {accountRecords.map(acc => (
                     <div key={acc.id} className="flex justify-between items-center p-5 bg-gray-50 rounded-[1.5rem] border-2 border-transparent hover:border-black transition-all group"><span>{acc.name}</span><div className="flex items-center gap-4"><span>₹{Number(acc.balance).toLocaleString()}</span><button onClick={()=>handleDelete('accountRecords', acc.id)} className="text-red-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button></div></div>
                   ))}
                </div>
             </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white rounded-[3rem] border shadow-sm overflow-hidden animate-in slide-in-from-bottom-5">
            <div className="p-8 border-b flex flex-col md:flex-row gap-4 bg-gray-50/30 font-black uppercase"><div className="relative flex-grow max-w-xl w-full"><Search size={16} className="absolute left-4 top-3.5 text-gray-300"/><input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Search Ledger..." className="w-full pl-12 border-none bg-white rounded-2xl text-xs font-bold shadow-sm py-3 outline-none focus:ring-1 focus:ring-black"/></div><select value={filterType} onChange={e=>setFilterType(e.target.value)} className="rounded-2xl px-6 py-3 text-xs bg-white border font-black uppercase outline-none transition-all hover:bg-gray-100"><option value="All">All Transactions</option><option value="Income">Income</option><option value="Expense">Expense</option><option value="Balance_Transfer">Transfers</option><option value="EMI_Payment">EMI</option><option value="Goal_Deposit">Goal Save</option></select></div>
            <div className="overflow-x-auto"><table className="w-full text-left font-bold text-gray-700 uppercase tracking-tighter font-black"><thead className="bg-gray-50 text-[9px] font-black text-gray-400 uppercase tracking-widest border-b"><tr><th className="p-5">Timeline</th><th className="p-5">Record Details</th><th className="p-5 text-right">Amount</th><th className="p-5 text-center">Manage</th></tr></thead><tbody className="divide-y text-xs">{filteredTx.map(t => (<tr key={t.id} className="hover:bg-gray-50 transition-all group font-black uppercase"><td className="p-5 text-gray-400 text-xs font-black tracking-tighter">{t.date}</td><td className="p-5"><p className="font-black text-xs text-gray-900">{t.subcategory || t.category}</p><p className="text-[9px] text-gray-400 italic">{t.account} {t.toAccount ? `→ ${t.toAccount}` : ''} • {t.status}</p></td><td className={`p-5 font-black text-sm text-right ${t.type==='Income'?'text-green-600':t.type==='Balance_Transfer'?'text-orange-500':'text-red-600'}`}>₹{Number(t.amount).toLocaleString()}</td><td className="p-5 flex justify-center gap-2"><button onClick={()=>{setFormData({...t, amount:t.amount.toString()}); setEditingId(t.id); setIsModalOpen(true);}} className="p-2 bg-blue-50 text-blue-500 rounded-xl hover:scale-110 transition-transform"><Pencil size={14}/></button><button onClick={()=>handleDelete('transactions', t.id)} className="p-2 bg-red-50 text-red-400 rounded-xl hover:scale-110 transition-transform"><Trash2 size={14}/></button></td></tr>))}</tbody></table></div>
          </div>
        )}
      </main>

      {/* --- MOBILE NAVIGATION --- */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around p-4 z-40 backdrop-blur-xl bg-white/90">
        {[
          { id: 'dashboard', icon: <LayoutDashboard size={24}/> },
          { id: 'history', icon: <ArrowRightLeft size={24}/> },
          { id: 'debts', icon: <UserCheck size={24}/> },
          { id: 'report', icon: <FileText size={24}/> },
          { id: 'settings', icon: <Settings size={24}/> }
        ].map(tab => (
          <button key={tab.id} onClick={()=>setActiveTab(tab.id)} className={`p-3 rounded-2xl transition-all ${activeTab===tab.id?'bg-black text-white shadow-md':'text-gray-400'}`}>{tab.icon}</button>
        ))}
        <button onClick={()=>{setIsModalOpen(true); setEditingId(null);}} className="p-4 bg-black text-white rounded-3xl -mt-10 border-4 border-white shadow-xl active:scale-90 transition-all font-black"><Plus size={32}/></button>
      </div>

      {/* MODALS: GOAL & DEBT */}
      <div className={`fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm transition-all ${isGoalModalOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}><div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in duration-300"><div className="p-8 border-b bg-gray-50 flex justify-between items-center"><h3 className="font-black uppercase tracking-tight text-lg flex items-center gap-2 text-gray-800"><Target className="text-blue-500"/> {editingGoalId ? 'Edit Future Goal' : 'Plan Future Goal'}</h3><button onClick={() => { setIsGoalModalOpen(false); setEditingGoalId(null); }}><X size={20}/></button></div><form onSubmit={handleGoal} className="p-8 space-y-5"><input required value={goalFormData.name} onChange={e=>setGoalFormData({...goalFormData, name:e.target.value})} placeholder="Goal Name" className="w-full border-2 border-gray-100 p-4 rounded-2xl font-black uppercase text-xs outline-none focus:border-black transition-all" /><div className="grid grid-cols-2 gap-4"><input type="number" required value={goalFormData.target} onChange={e=>setGoalFormData({...goalFormData, target:e.target.value})} placeholder="Target ₹" className="w-full border-2 border-gray-100 p-4 rounded-2xl font-black text-xs outline-none" /><input type="date" required value={goalFormData.targetDate} onChange={e=>setGoalFormData({...goalFormData, targetDate:e.target.value})} className="w-full border-2 border-gray-100 p-4 rounded-2xl font-black text-xs outline-none" /></div><input type="number" value={goalFormData.current} onChange={e=>setGoalFormData({...goalFormData, current:e.target.value})} placeholder="Initial Savings ₹" className="w-full border-2 border-gray-100 p-4 rounded-2xl font-black text-xs outline-none" />{goalFormData.target && goalFormData.targetDate && (<div className="p-4 bg-purple-50 rounded-2xl border-2 border-purple-100 animate-in fade-in zoom-in"><p className="text-[9px] font-black text-purple-400 uppercase tracking-widest mb-1 text-center">Live Estimation</p><div className="flex justify-between items-center px-2"><span className="text-[10px] font-black text-gray-500 uppercase tracking-tighter">Required Monthly:</span><span className="text-lg font-black text-purple-600">₹{(() => { const rem = Number(goalFormData.target) - Number(goalFormData.current); const diff = Math.abs(new Date(goalFormData.targetDate) - new Date()); const mos = Math.ceil(diff / (1000 * 60 * 60 * 24 * 30.44)) || 1; return (rem > 0 ? Math.ceil(rem / mos) : 0).toLocaleString(); })()}</span></div></div>)}<button type="submit" className="w-full bg-black text-white py-5 rounded-[1.5rem] font-black uppercase text-xs shadow-xl active:scale-95">Save Goal</button></form></div></div>
      <div className={`fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm transition-all ${isDebtModalOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}><div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in duration-300"><div className="p-8 border-b bg-gray-50 flex justify-between items-center"><h3 className="font-black uppercase tracking-tight text-lg text-gray-800">Master Record Setup</h3><button onClick={()=>setIsDebtModalOpen(false)}><X size={20}/></button></div><form onSubmit={handleDebt} className="p-8 space-y-5"><input required value={debtFormData.name} onChange={e=>setDebtFormData({...debtFormData, name:e.target.value})} placeholder="Name" className="w-full border-2 border-gray-100 p-4 rounded-2xl font-black uppercase text-xs" /><div className="space-y-1.5"><label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Record Type</label><select value={debtFormData.type} onChange={e=>setDebtFormData({...debtFormData, type:e.target.value})} className="w-full border-2 border-gray-100 p-4 rounded-2xl font-black uppercase text-xs bg-white focus:border-black"><option value="Given">Lent (Receivable)</option><option value="Taken">Borrowed (Payable/EMI)</option><option value="Subscription">Subscription/LIC</option></select></div><input type="number" required value={debtFormData.total} onChange={e=>setDebtFormData({...debtFormData, total:e.target.value})} placeholder="Total ₹" className="w-full border-2 border-gray-100 p-4 rounded-2xl font-black uppercase text-xs" /><input type="date" required value={debtFormData.dueDate} onChange={e=>setDebtFormData({...debtFormData, dueDate:e.target.value})} className="w-full border-2 border-gray-100 p-4 rounded-2xl font-black uppercase text-xs" /><button type="submit" className="w-full bg-black text-white py-5 rounded-[1.5rem] font-black uppercase text-xs">Save Master Record</button></form></div></div>

      <datalist id="accs">{accounts.map(a=><option key={a} value={a}/>)}</datalist>
      <datalist id="types">{entryTypes.map(t=><option key={t} value={t}/>)}</datalist>
      <datalist id="cats">{categories.map(c=><option key={c} value={c}/>)}</datalist>
      <datalist id="subs">{subcategories.map(s=><option key={s} value={s}/>)}</datalist>
    </div>
  );
};


export default App;

