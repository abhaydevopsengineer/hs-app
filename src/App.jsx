import React, { useState, useMemo, useEffect } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, deleteDoc, collection, onSnapshot } from 'firebase/firestore';
import { 
  LayoutDashboard, ArrowRightLeft, UserCheck, Target, Plus, Search, X, 
  FileSpreadsheet, Settings, Trash2, Pencil, Wallet, PlusCircle, 
  CheckCircle2, Loader2, Cloud, Banknote, History, 
  ArrowRightLeft as NetIcon, ArrowDownLeft, ArrowUpRight, Database, 
  Clock, CalendarDays, BellRing, TrendingUp, CreditCard as CardIcon, FileText 
} from 'lucide-react';

// --- UPDATED FIREBASE CONFIG (Latest Data Provided) ---
const firebaseConfig = {
  apiKey: "AIzaSyDE3sdmPG3TGKV0CJDWHYPzDRE-8OKIanw",
  authDomain: "hs-expensemanager.firebaseapp.com",
  projectId: "hs-expensemanager",
  storageBucket: "hs-expensemanager.firebasestorage.app",
  messagingSenderId: "500261749602",
  appId: "1:500261749602:web:9840d9da48d8ace202223b",
  measurementId: "G-PFS0S1EKBC"
};

// Singleton initialization to prevent multiple instances
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'hs-expenses-manager-pro';

const App = () => {
  // --- 1. ALL HOOKS DEFINED AT TOP (MANDATORY) ---
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
  
  const [transactions, setTransactions] = useState([]);
  const [debts, setDebts] = useState([]);
  const [goals, setGoals] = useState([]);
  const [accountRecords, setAccountRecords] = useState([]);

  const defaultCategories = ['Salary', 'Rent', 'Grocery', 'Investment', 'Fuel', 'Shopping', 'Medical', 'Insurance', 'EMI', 'LIC', 'Policy', 'Transfer'];
  const defaultSubcategories = ['Monthly Pay', 'Milk', 'Petrol', 'Electricity', 'LIC Premium', 'HDFC EMI', 'Home Savings', 'Internal Transfer'];
  
  const [categories] = useState(defaultCategories);
  const [subcategories] = useState(defaultSubcategories);
  const accounts = ['Bank', 'Cash', 'Credit Card', 'UPI', 'Wallet'];
  const entryTypes = ['Expense', 'Income', 'EMI_Payment', 'Goal_Deposit', 'Insurance_Premium', 'Investment', 'Balance_Transfer'];

  // --- AUTH & DATA SYNC ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Firebase Auth Error:", err.message);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const sync = (collName, setter) => {
      const q = collection(db, 'artifacts', appId, 'users', user.uid, collName);
      return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        setter(data);
      }, (error) => console.error(`Sync error (${collName}):`, error.message));
    };
    const unsubTx = sync('transactions', setTransactions);
    const unsubDebt = sync('debts', setDebts);
    const unsubGoal = sync('goals', setGoals);
    const unsubAcc = sync('accountRecords', setAccountRecords);
    
    return () => { unsubTx(); unsubDebt(); unsubGoal(); unsubAcc(); };
  }, [user]);

  // --- CALCULATIONS (Hooks before return guard) ---
  const totals = useMemo(() => {
    const openingBal = accountRecords.reduce((acc, curr) => acc + Number(curr.balance || 0), 0);
    const income = transactions.filter(t => t.type === 'Income').reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
    const expense = transactions.filter(t => ['Expense', 'EMI_Payment', 'Insurance_Premium', 'Goal_Deposit', 'Investment'].includes(t.type)).reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
    const rec = debts.filter(d => d.type === 'Given').reduce((acc, curr) => acc + (Number(curr.total || 0) - Number(curr.paid || 0)), 0);
    const pay = debts.filter(d => d.type === 'Taken' || d.type === 'Subscription').reduce((acc, curr) => acc + (Number(curr.total || 0) - Number(curr.paid || 0)), 0);
    
    const dynamicAccounts = [...new Set([...accounts, ...transactions.map(t => t.account), ...accountRecords.map(r => r.name)])].filter(Boolean);
    const accBreakdown = dynamicAccounts.map(acc => {
       const op = Number(accountRecords.find(r => r.name === acc)?.balance || 0);
       const inc = transactions.filter(t => (t.account === acc && t.type === 'Income') || (t.toAccount === acc && t.type === 'Balance_Transfer')).reduce((a,c) => a + Number(c.amount || 0), 0);
       const exp = transactions.filter(t => (t.account === acc && (t.type !== 'Income' && t.type !== 'Balance_Transfer')) || (t.account === acc && t.type === 'Balance_Transfer')).reduce((a,c) => a + Number(c.amount || 0), 0);
       return { name: acc, balance: op + inc - exp };
    });
    return { balance: openingBal + income - expense, rec, pay, accBreakdown };
  }, [transactions, debts, accountRecords]);

  const nameLedgers = useMemo(() => {
    const map = {};
    debts.forEach(d => {
      const normKey = d.name.trim().toLowerCase();
      if (!map[normKey]) map[normKey] = { name: d.name.trim(), receivables: 0, payables: 0, records: [], linkedTx: [] };
      const bal = Number(d.total || 0) - Number(d.paid || 0);
      if (d.type === 'Given') map[normKey].receivables += bal;
      else if (d.type === 'Taken' || d.type === 'Subscription') map[normKey].payables += bal;
      map[normKey].records.push(d);
    });
    transactions.forEach(t => {
      const txSubName = (t.subcategory || "").trim().toLowerCase();
      Object.keys(map).forEach(normKey => {
        const isExplicitlyLinked = t.linkedId && map[normKey].records.some(r => r.id === t.linkedId);
        if (isExplicitlyLinked || txSubName === normKey) {
          if (!map[normKey].linkedTx.some(existing => existing.id === t.id)) map[normKey].linkedTx.push(t);
        }
      });
    });
    Object.values(map).forEach(group => group.linkedTx.sort((a, b) => new Date(b.date) - new Date(a.date)));
    return Object.values(map);
  }, [debts, transactions]);

  const goalReport = useMemo(() => {
    return goals.map(g => {
      const remaining = Number(g.target || 0) - Number(g.current || 0);
      const diffMonths = Math.ceil(Math.abs(new Date(g.targetDate) - new Date()) / (1000 * 60 * 60 * 24 * 30.44)) || 1;
      const history = transactions.filter(t => t.linkedId === g.id).sort((a, b) => new Date(b.date) - new Date(a.date));
      return { ...g, remaining, diffMonths, monthlyRequired: remaining > 0 ? Math.ceil(remaining / diffMonths) : 0, history };
    });
  }, [goals, transactions]);

  const filteredTx = useMemo(() => {
    return transactions.filter(t => {
      const searchStr = `${t.category || ""} ${t.subcategory || ""} ${t.note || ""}`.toLowerCase();
      return searchStr.includes(searchQuery.toLowerCase()) && (filterType === 'All' || t.type === filterType);
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [transactions, searchQuery, filterType]);

  const [formData, setFormData] = useState({ date: new Date().toISOString().split('T')[0], type: 'Expense', category: 'Grocery', subcategory: '', status: 'Done', amount: '', account: 'Bank', toAccount: '', paymentName: '', note: '', linkedId: '' });
  const [debtFormData, setDebtFormData] = useState({ name: '', type: 'Given', total: '', paid: '0', dueDate: new Date().toISOString().split('T')[0] });
  const [goalFormData, setGoalFormData] = useState({ name: '', target: '', current: '0', targetDate: '' });

  // --- ACTIONS ---
  const saveToCloud = async (coll, id, data) => { if (user) await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, coll, id.toString()), data); };
  const handleDelete = async (coll, id) => { if (user) await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, coll, id.toString())); };

  const handleTransaction = async (e) => {
    e.preventDefault();
    const id = editingId || Date.now();
    const amt = Number(formData.amount);
    await saveToCloud('transactions', id, { ...formData, id, amount: amt });
    if (formData.linkedId) {
      const d = debts.find(x => x.id === formData.linkedId);
      if(d) await saveToCloud('debts', d.id, { ...d, paid: Number(d.paid) + amt });
      const g = goals.find(x => x.id === formData.linkedId);
      if(g) await saveToCloud('goals', g.id, { ...g, current: Number(g.current) + amt });
    }
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 1500);
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({ ...formData, amount: '', note: '', subcategory: '' });
  };

  const handleDebt = async (e) => {
    e.preventDefault();
    const id = editingDebtId || Date.now();
    await saveToCloud('debts', id, { ...debtFormData, id, total: Number(debtFormData.total), paid: Number(debtFormData.paid) });
    setIsDebtModalOpen(false);
    setEditingDebtId(null);
  };

  const handleGoal = async (e) => {
    e.preventDefault();
    const id = editingGoalId || Date.now();
    await saveToCloud('goals', id, { ...goalFormData, id, target: Number(goalFormData.target), current: Number(goalFormData.current) });
    setIsGoalModalOpen(false);
    setEditingGoalId(null);
  };

  // --- RENDER LOGIC ---
  if (!user) return (
    <div className="h-screen flex flex-col items-center justify-center bg-[#F8F9FA] text-black p-6 text-center">
      <Loader2 className="animate-spin mb-4 text-blue-500" size={40}/>
      <p className="font-black uppercase tracking-widest text-sm text-gray-800">Connecting Cloud Database...</p>
      <p className="text-[10px] text-gray-400 mt-2 italic max-w-xs">Agar ye screen hategi nahi, toh check karein ki aapne Firebase Console mein 'Anonymous Authentication' enable kiya hai ya nahi.</p>
    </div>
  );

  const exportToSheets = () => {
    let csv = "\ufeffTimeline,Type,Category,Transaction,Account,Amount\n";
    transactions.forEach(t => {
      csv += `${t.date},${t.type},${t.category},"${t.subcategory || ""}",${t.account},${t.amount}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `HS_Report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col md:flex-row font-sans text-gray-900 overflow-x-hidden">
      
      {/* SIDEBAR (Desktop) */}
      <div className="hidden md:flex w-72 bg-white border-r p-8 flex-col h-screen sticky top-0 shadow-sm">
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
            { id: 'settings', icon: <Settings size={20}/> }
          ].map(tab => (
            <button key={tab.id} onClick={()=>setActiveTab(tab.id)} className={`w-full flex items-center gap-4 p-4 rounded-2xl text-sm transition-all ${activeTab === tab.id ? 'bg-black text-white shadow-xl translate-x-2' : 'text-gray-400 hover:bg-gray-50'}`}>
              {tab.icon} <span className="capitalize">{tab.id}</span>
            </button>
          ))}
        </nav>
        <button onClick={exportToSheets} className="w-full bg-green-50 text-green-700 p-4 rounded-2xl text-[10px] font-black border-2 border-green-100 flex items-center justify-center gap-2 hover:bg-green-100 transition-all uppercase tracking-widest"><FileSpreadsheet size={16}/> EXPORT REPORT</button>
      </div>

      <main className="flex-grow p-4 md:p-10 max-w-7xl mx-auto w-full pb-32">
        <header className="flex justify-between items-start mb-10">
          <div>
            <h2 className="text-4xl font-black tracking-tighter uppercase">{activeTab} View</h2>
            <p className="text-gray-400 text-[10px] font-black tracking-widest mt-1 uppercase">HS_Manager LIVE • Secure</p>
          </div>
          <button onClick={()=>{setEditingId(null); setIsModalOpen(true);}} className="bg-black text-white px-8 py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-2xl active:scale-95 transition-all flex items-center gap-3">
            <PlusCircle size={18}/> Quick Entry
          </button>
        </header>

        {/* DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-10 animate-in fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-black uppercase tracking-widest">
              <div className="bg-white p-8 rounded-[2.5rem] border-l-[12px] border-blue-500 shadow-sm transition-all hover:scale-[1.02]">
                <span className="text-[10px] text-gray-300">Net Balance</span>
                <h3 className="text-3xl text-gray-900 mt-2">₹{totals.balance.toLocaleString()}</h3>
              </div>
              <div className="bg-white p-8 rounded-[2.5rem] border-l-[12px] border-green-500 shadow-sm transition-all hover:scale-[1.02]">
                <span className="text-[10px] text-gray-300">Receivables</span>
                <h3 className="text-3xl text-green-600 mt-2">₹{totals.rec.toLocaleString()}</h3>
              </div>
              <div className="bg-white p-8 rounded-[2.5rem] border-l-[12px] border-red-500 shadow-sm transition-all hover:scale-[1.02]">
                <span className="text-[10px] text-gray-300">Payables</span>
                <h3 className="text-3xl text-red-600 mt-2">₹{totals.pay.toLocaleString()}</h3>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[3.5rem] border shadow-sm transition-all">
               <h4 className="font-black text-xl uppercase mb-6 flex items-center gap-3 tracking-tighter text-gray-800"><Database className="text-orange-500" size={24}/> Account Breakdown</h4>
               <div className="grid grid-cols-2 md:grid-cols-4 gap-6 font-black uppercase">
                  {totals.accBreakdown.map(acc => (
                    <div key={acc.name} className="p-4 bg-gray-50 rounded-2xl border-2 border-transparent hover:border-black transition-all group">
                       <p className="text-[10px] text-gray-400">{acc.name}</p>
                       <p className={`text-xl mt-1 ${acc.balance < 0 ? 'text-red-500' : 'text-gray-900'}`}>₹{acc.balance.toLocaleString()}</p>
                    </div>
                  ))}
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               <div className="bg-white p-10 rounded-[3rem] border shadow-sm border-t-[12px] border-t-red-500 font-black uppercase">
                  <h4 className="text-xl mb-6 flex items-center gap-3 tracking-tighter text-gray-800"><BellRing className="text-red-500" size={22}/> Active Loans</h4>
                  <div className="space-y-4">
                    {debts.filter(d => d.type === 'Taken' && (Number(d.total)-Number(d.paid)) > 0).map(d => (
                      <div key={d.id} className="p-4 border-b flex justify-between items-center group hover:bg-gray-50 rounded-xl transition-all">
                        <div><p className="text-xs text-gray-900">{d.name}</p><p className="text-[9px] text-gray-400 mt-1">Due: {d.dueDate}</p></div>
                        <p className="text-red-600 font-black">₹{(Number(d.total) - Number(d.paid)).toLocaleString()}</p>
                      </div>
                    ))}
                    {debts.filter(d => d.type === 'Taken' && (Number(d.total)-Number(d.paid)) > 0).length === 0 && <p className="text-center py-4 text-gray-300 text-xs italic">No active dues</p>}
                  </div>
               </div>
               <div className="bg-white p-10 rounded-[3rem] border shadow-sm border-t-[12px] border-t-purple-500 font-black uppercase">
                  <h4 className="text-xl mb-6 flex items-center gap-3 tracking-tighter text-gray-800"><TrendingUp className="text-purple-500" size={22}/> Goal Savings</h4>
                  <div className="space-y-4">
                    {goalReport.map(g => (
                      <div key={g.id} className="p-4 bg-gray-50 rounded-2xl flex justify-between items-center transition-all border-2 border-transparent hover:border-purple-100 group">
                        <div><p className="text-[10px] text-gray-900">{g.name}</p><p className="text-[8px] text-purple-400 font-bold">{g.diffMonths} Months To Go</p></div>
                        <div className="text-right"><p className="text-sm text-purple-600 font-black">₹{g.monthlyRequired.toLocaleString()}</p></div>
                      </div>
                    ))}
                    {goalReport.length === 0 && <p className="text-center py-4 text-gray-300 text-xs italic">No goals added</p>}
                  </div>
               </div>
            </div>
          </div>
        )}

        {/* HISTORY */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-[3rem] border shadow-sm overflow-hidden animate-in slide-in-from-bottom-5 font-black uppercase">
            <div className="p-8 border-b flex flex-col md:flex-row gap-4 bg-gray-50/30">
               <div className="relative flex-grow max-w-xl w-full">
                  <Search size={16} className="absolute left-4 top-3 text-gray-300"/><input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Search records..." className="w-full pl-12 bg-white rounded-2xl py-3 outline-none focus:ring-1 focus:ring-black text-xs font-bold"/>
               </div>
               <select value={filterType} onChange={e=>setFilterType(e.target.value)} className="rounded-2xl px-6 py-3 text-xs bg-white border font-black outline-none transition-all hover:bg-gray-100"><option value="All">All Entries</option><option value="Income">Income</option><option value="Expense">Expense</option><option value="EMI_Payment">EMI</option></select>
            </div>
            <div className="overflow-x-auto"><table className="w-full text-left tracking-tighter"><thead className="bg-gray-50 text-[9px] text-gray-400 border-b"><tr><th className="p-5">Timeline</th><th className="p-5">Summary</th><th className="p-5 text-right">Amount</th><th className="p-5 text-center">Manage</th></tr></thead><tbody className="divide-y text-xs">{filteredTx.map(t => (
              <tr key={t.id} className="hover:bg-gray-50 transition-all font-black">
                <td className="p-5 text-gray-400 text-xs">{t.date}</td>
                <td className="p-5"><p className="text-xs text-gray-900">{t.subcategory || t.category}</p><p className="text-[9px] text-gray-400 italic">{t.account}</p></td>
                <td className={`p-5 text-sm text-right ${t.type==='Income'?'text-green-600':'text-red-600'}`}>₹{Number(t.amount).toLocaleString()}</td>
                <td className="p-5 flex justify-center gap-2"><button onClick={()=>{setFormData({...t, amount:t.amount.toString()}); setEditingId(t.id); setIsModalOpen(true);}} className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl"><Pencil size={14}/></button><button onClick={()=>handleDelete('transactions', t.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-xl"><Trash2 size={14}/></button></td>
              </tr>
            ))}</tbody></table></div>
          </div>
        )}

        {activeTab === 'debts' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-5 font-black uppercase">
             <div className="flex justify-between items-center bg-white p-8 rounded-[2.5rem] border shadow-sm">
                <h3 className="text-xl tracking-tighter">Net Ledgers (Hisab)</h3>
                <button onClick={()=>{setEditingDebtId(null); setIsDebtModalOpen(true);}} className="bg-black text-white px-10 py-4 rounded-3xl text-xs tracking-widest active:scale-95 transition-all">New Master Entry</button>
             </div>
             <div className="space-y-12">
               {nameLedgers.map(ledger => {
                 const net = ledger.receivables - ledger.payables;
                 return (
                   <div key={ledger.name} className="bg-white rounded-[3.5rem] border shadow-md overflow-hidden transition-all hover:shadow-2xl">
                    <div className="p-10 border-b bg-gray-50/50 flex flex-col md:flex-row justify-between items-center gap-6">
                       <div><h2 className="text-4xl tracking-tighter text-gray-900">{ledger.name}</h2><div className={`mt-3 flex items-center gap-3 px-6 py-3 rounded-2xl border-2 text-lg tracking-widest shadow-sm ${net >= 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}><NetIcon size={20}/> Net: ₹{Math.abs(net).toLocaleString()} <span>{net >= 0 ? '(Lena Hai)' : '(Dena Hai)'}</span></div></div>
                       <div className="flex gap-8 text-center"><div className="bg-green-50/50 p-4 rounded-3xl border border-green-100 min-w-[120px] font-black"><p className="text-[10px] text-gray-400 mb-1 flex items-center gap-1 justify-center"><ArrowDownLeft size={12}/> Lena Hai</p><p className="text-2xl text-green-600">₹{ledger.receivables.toLocaleString()}</p></div><div className="bg-red-50/50 p-4 rounded-3xl border border-red-100 min-w-[120px] font-black"><p className="text-[10px] text-gray-400 mb-1 flex items-center gap-1 justify-center"><ArrowUpRight size={12}/> Dena Hai</p><p className="text-2xl text-red-600">₹{ledger.payables.toLocaleString()}</p></div></div>
                    </div>
                    <div className="p-10 grid grid-cols-1 lg:grid-cols-2 gap-10">
                       <div><h4 className="text-xs text-gray-400 tracking-[0.2em] mb-4">Activity history</h4><div className="space-y-3 max-h-[350px] overflow-y-auto pr-3">{ledger.linkedTx.map(t => (<div key={t.id} className="flex justify-between items-center p-4 border shadow-sm bg-white rounded-2xl transition-all group font-black"><div className="flex items-center gap-3"><div className={`p-2 rounded-lg ${t.type === 'Income' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}><Banknote size={14}/></div><div><p className="text-[10px] text-gray-900 tracking-tighter">{t.date}</p><p className="text-[9px] text-gray-400">{t.account}</p></div></div><p className={`text-sm ${t.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>{t.type === 'Income' ? '+' : '-'} ₹{t.amount.toLocaleString()}</p></div>))}</div></div>
                    </div>
                 </div>
               );})}
             </div>
          </div>
        )}

        {activeTab === 'goals' && (
          <div className="space-y-10 animate-in slide-in-from-bottom-5 font-black uppercase">
            <div className="flex justify-between items-center bg-white p-8 rounded-[2.5rem] border shadow-sm transition-all hover:shadow-md">
               <h3 className="text-xl tracking-tighter text-gray-900">Savings Goals Tracker</h3>
               <button onClick={()=>setIsGoalModalOpen(true)} className="bg-black text-white px-10 py-4 rounded-3xl text-xs tracking-widest active:scale-95 transition-all"><PlusCircle size={18} className="inline mr-2"/> Setup New Goal</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {goalReport.map(g => (
                <div key={g.id} className="bg-white p-10 rounded-[3rem] border shadow-lg group relative overflow-hidden transition-all hover:shadow-2xl">
                   <div className="absolute top-8 right-8 flex gap-2 opacity-0 group-hover:opacity-100 transition-all font-black"><button onClick={()=>{setGoalFormData(g); setEditingGoalId(g.id); setIsGoalModalOpen(true);}} className="text-blue-500 hover:bg-blue-50 p-2 rounded-xl"><Pencil size={18}/></button><button onClick={()=>handleDelete('goals', g.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-xl"><Trash2 size={18}/></button></div>
                   <h3 className="text-3xl tracking-tighter text-gray-900">{g.name}</h3><p className="text-xs text-purple-500 mt-1">Due: {g.targetDate}</p>
                   <div className="text-right mt-4 font-black"><p className="text-3xl text-blue-600">{Math.round((Number(g.current)/Number(g.target))*100)}%</p><p className="text-[10px] text-gray-300">Target Achieved</p></div>
                   <div className="w-full bg-gray-100 h-5 rounded-full overflow-hidden mt-4 border shadow-inner"><div className="bg-black h-full transition-all duration-1000 shadow-xl" style={{width:`${Math.min((g.current/g.target)*100, 100)}%`}}></div></div>
                   <div className="mt-8 pt-6 border-t border-gray-100 grid grid-cols-2 gap-6 text-center font-black">
                      <div><p className="text-[10px] text-gray-400 uppercase">Monthly Needed</p><p className="text-xl text-purple-600">₹{g.monthlyRequired.toLocaleString()}</p></div>
                      <div><p className="text-[10px] text-gray-400 uppercase">Remaining</p><p className="text-xl text-gray-900">₹{g.remaining.toLocaleString()}</p></div>
                   </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-3xl mx-auto animate-in zoom-in duration-300 font-black uppercase">
             <div className="bg-white p-10 rounded-[3rem] border shadow-sm">
                <h3 className="text-2xl mb-8 flex items-center gap-3 text-gray-800"><Database size={24} className="text-orange-500"/> Account Setup</h3>
                <form onSubmit={async (e) => { e.preventDefault(); const name = e.target.accName.value; const bal = e.target.accBal.value; await saveToCloud('accountRecords', Date.now(), { name, balance: Number(bal) }); e.target.reset(); }} className="flex gap-3 mb-10"><input name="accName" required placeholder="Bank/Cash Name" className="flex-[2] border-2 border-gray-100 bg-gray-50 p-4 rounded-2xl text-xs font-bold outline-none focus:border-black transition-all" /><input name="accBal" type="number" required placeholder="Opening Balance ₹" className="flex-1 border-2 border-gray-100 bg-gray-50 p-4 rounded-2xl text-xs font-bold outline-none focus:border-black transition-all" /><button type="submit" className="bg-black text-white px-8 rounded-2xl text-[10px] font-black active:scale-95 transition-all">Set</button></form>
                <div className="space-y-3 uppercase font-black text-xs text-gray-600">
                   {accountRecords.map(acc => (<div key={acc.id} className="flex justify-between items-center p-5 bg-gray-50 rounded-[1.5rem] border-2 border-transparent hover:border-black transition-all group"><span>{acc.name}</span><div className="flex items-center gap-4"><span>₹{Number(acc.balance).toLocaleString()}</span><button onClick={()=>handleDelete('accountRecords', acc.id)} className="text-red-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button></div></div>))}
                </div>
             </div>
          </div>
        )}
      </main>

      {/* MOBILE NAV BAR */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around p-4 z-40 backdrop-blur-xl bg-white/90 shadow-2xl">
        {[{ id: 'dashboard', icon: <LayoutDashboard size={24}/> }, { id: 'history', icon: <ArrowRightLeft size={24}/> }, { id: 'debts', icon: <UserCheck size={24}/> }, { id: 'goals', icon: <Target size={24}/> }, { id: 'settings', icon: <Settings size={24}/> }].map(tab => (
          <button key={tab.id} onClick={()=>setActiveTab(tab.id)} className={`p-3 rounded-2xl transition-all ${activeTab===tab.id?'bg-black text-white shadow-md':'text-gray-400'}`}>{tab.icon}</button>
        ))}
        <button onClick={()=>{setIsModalOpen(true); setEditingId(null);}} className="p-4 bg-black text-white rounded-3xl -mt-10 border-4 border-white shadow-xl active:scale-90 transition-all font-black"><Plus size={32}/></button>
      </div>

      {/* --- MODALS --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
           <div className="bg-white rounded-[2.5rem] w-full max-w-xl max-h-[95vh] shadow-2xl overflow-hidden flex flex-col p-8 font-black uppercase">
              <div className="flex justify-between items-center mb-6"><h3>New Transaction</h3><button onClick={() => setIsModalOpen(false)}><X size={24}/></button></div>
              <form onSubmit={handleTransaction} className="space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-[10px] text-gray-400">Entry Date</label><input type="date" required value={formData.date} onChange={e=>setFormData({...formData, date:e.target.value})} className="w-full border-2 border-gray-100 bg-gray-50 p-4 rounded-2xl text-xs font-black outline-none focus:border-black transition-all" /></div>
                  <div><label className="text-[10px] text-blue-600">Type</label><select value={formData.type} onChange={e=>setFormData({...formData, type:e.target.value, linkedId:''})} className="w-full border-2 border-gray-100 bg-gray-50 p-4 rounded-2xl text-xs font-black outline-none focus:border-black transition-all"><option value="Expense">Expense</option><option value="Income">Income</option><option value="EMI_Payment">EMI Payment</option></select></div>
                </div>
                <div><label className="text-[10px] text-gray-400">Category</label><input list="cats" required value={formData.category} onChange={e=>setFormData({...formData, category:e.target.value})} className="w-full border-2 border-gray-100 bg-gray-50 p-4 rounded-2xl text-xs font-black outline-none focus:border-black transition-all" /></div>
                <div><label className="text-[10px] text-gray-400">Name (Sub)</label><input required value={formData.subcategory} onChange={e=>setFormData({...formData, subcategory:e.target.value})} placeholder="Transaction Detail" className="w-full border-2 border-gray-100 bg-gray-50 p-4 rounded-2xl text-xs font-black outline-none focus:border-black transition-all" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-[10px] text-orange-600">Paid Via</label><input list="accs" required value={formData.account} onChange={e=>setFormData({...formData, account:e.target.value})} className="w-full border-2 border-gray-100 bg-gray-50 p-4 rounded-2xl text-xs font-black outline-none focus:border-black transition-all" /></div>
                  <div><label className="text-[10px] text-gray-400">Amount ₹</label><input type="number" required value={formData.amount} onChange={e=>setFormData({...formData, amount:e.target.value})} className="w-full border-2 border-gray-100 bg-gray-50 p-4 rounded-2xl text-sm font-black outline-none focus:border-black transition-all" /></div>
                </div>
                <button type="submit" className="w-full bg-black text-white p-5 rounded-[1.5rem] text-xs font-black mt-4 shadow-xl active:scale-95 transition-all">Submit Entry</button>
              </form>
           </div>
        </div>
      )}

      {isDebtModalOpen && (<div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm"><div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl font-black uppercase"><h3>Master Ledger Entry</h3><form onSubmit={handleDebt} className="space-y-4 mt-6"><input required value={debtFormData.name} onChange={e=>setDebtFormData({...debtFormData, name:e.target.value})} placeholder="Person Name" className="w-full border-2 p-4 rounded-2xl text-xs"/><select value={debtFormData.type} onChange={e=>setDebtFormData({...debtFormData, type:e.target.value})} className="w-full border-2 p-4 rounded-2xl text-xs"><option value="Given">Lent (Lena Hai)</option><option value="Taken">Borrowed (Dena Hai)</option><option value="Subscription">Policy / LIC</option></select><input type="number" required value={debtFormData.total} onChange={e=>setDebtFormData({...debtFormData, total:e.target.value})} placeholder="Total Principal ₹" className="w-full border-2 p-4 rounded-2xl text-xs"/><input type="date" required value={debtFormData.dueDate} onChange={e=>setDebtFormData({...debtFormData, dueDate:e.target.value})} className="w-full border-2 p-4 rounded-2xl text-xs"/><div className="flex gap-3"><button type="button" onClick={()=>setIsDebtModalOpen(false)} className="flex-1 bg-gray-100 p-4 rounded-2xl text-xs">Back</button><button type="submit" className="flex-1 bg-black text-white p-4 rounded-2xl text-xs">Save</button></div></form></div></div>)}
      
      {isGoalModalOpen && (<div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm"><div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl font-black uppercase"><h3>Goal Setup</h3><form onSubmit={handleGoal} className="space-y-4 mt-6"><input required value={goalFormData.name} onChange={e=>setGoalFormData({...goalFormData, name:e.target.value})} placeholder="Goal Name (e.g. Car)" className="w-full border-2 p-4 rounded-2xl text-xs"/><input type="number" required value={goalFormData.target} onChange={e=>setGoalFormData({...goalFormData, target:e.target.value})} placeholder="Target Amount ₹" className="w-full border-2 p-4 rounded-2xl text-xs"/><input type="date" required value={goalFormData.targetDate} onChange={e=>setGoalFormData({...goalFormData, targetDate:e.target.value})} className="w-full border-2 p-4 rounded-2xl text-xs"/><div className="flex gap-3"><button type="button" onClick={()=>setIsGoalModalOpen(false)} className="flex-1 bg-gray-100 p-4 rounded-2xl text-xs">Back</button><button type="submit" className="flex-1 bg-black text-white p-4 rounded-2xl text-xs">Save</button></div></form></div></div>)}

      <datalist id="cats">{categories.map(c=><option key={c} value={c}/>)}</datalist>
      <datalist id="accs">{(['Bank', 'Cash', 'Credit Card', 'UPI', 'Wallet']).map(a=><option key={a} value={a}/>)}</datalist>
    </div>
  );
};

export default App;
