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

// --- HS_MANAGER_V4 STANDALONE CONFIG (Directly Supported) ---
const firebaseConfig = {
  apiKey: "AIzaSyDE3sdmPG3TGKV0CJDWHYPzDRE-8OKIanw",
  authDomain: "hs-expensemanager.firebaseapp.com",
  projectId: "hs-expensemanager",
  storageBucket: "hs-expensemanager.firebasestorage.app",
  messagingSenderId: "500261749602",
  appId: "1:500261749602:web:9840d9da48d8ace202223b",
  measurementId: "G-PFS0S1EKBC"
};

// Singleton initialization to prevent "app already exists" error
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'hs-expenses-manager-v3-prod';

const App = () => {
  // --- 1. ALL HOOKS DEFINED AT TOP (MANDATORY FOR REACT RULES) ---
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
  const entryTypes = ['Expense', 'Income', 'EMI_Payment', 'Goal_Deposit', 'Insurance_Premium', 'Investment', 'Balance_Transfer'];

  // --- 2. AUTH & CLOUD SYNC ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("V4 Cloud Auth Fail:", err.message);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const sync = (collName, setter) => {
      const q = collection(db, 'artifacts', appId, 'users', user.uid, collName);
      return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        setter(data);
      }, (err) => console.error(`Sync error on ${collName}:`, err));
    };
    const unsubTx = sync('transactions', setTransactions);
    const unsubDebt = sync('debts', setDebts);
    const unsubGoal = sync('goals', setGoals);
    const unsubAcc = sync('accountRecords', setAccountRecords);
    return () => { unsubTx(); unsubDebt(); unsubGoal(); unsubAcc(); };
  }, [user]);

  // --- 3. LOGIC CALCULATIONS ---
  const totals = useMemo(() => {
    const openingBal = accountRecords.reduce((acc, curr) => acc + Number(curr.balance || 0), 0);
    const income = transactions.filter(t => t.type === 'Income').reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
    const expense = transactions.filter(t => ['Expense', 'EMI_Payment', 'Insurance_Premium', 'Goal_Deposit', 'Investment'].includes(t.type)).reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
    const rec = debts.filter(d => d.type === 'Given').reduce((acc, curr) => acc + (Number(curr.total || 0) - Number(curr.paid || 0)), 0);
    const pay = debts.filter(d => d.type === 'Taken' || d.type === 'Subscription').reduce((acc, curr) => acc + (Number(curr.total || 0) - Number(curr.paid || 0)), 0);
    
    const dynamicAccounts = [...new Set(['Bank', 'Cash', 'Credit Card', 'UPI', 'Wallet', ...transactions.map(t => t.account), ...accountRecords.map(r => r.name)])].filter(Boolean);
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

  // --- 4. FORM STATES ---
  const [formData, setFormData] = useState({ date: new Date().toISOString().split('T')[0], type: 'Expense', category: 'Grocery', subcategory: '', status: 'Done', amount: '', account: 'Bank', toAccount: '', paymentName: '', note: '', linkedId: '' });
  const [debtFormData, setDebtFormData] = useState({ name: '', type: 'Given', total: '', paid: '0', dueDate: new Date().toISOString().split('T')[0] });
  const [goalFormData, setGoalFormData] = useState({ name: '', target: '', current: '0', targetDate: '' });

  // --- 5. ACTIONS ---
  const saveToCloud = async (coll, id, data) => { if (user) await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, coll, id.toString()), data); };
  const handleDelete = async (coll, id) => { if (user) await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, coll, id.toString())); };

  const handleTransaction = async (e) => {
    e.preventDefault();
    const id = editingId || Date.now();
    await saveToCloud('transactions', id, { ...formData, id, amount: Number(formData.amount) });
    if (formData.linkedId) {
      const d = debts.find(x => x.id === formData.linkedId);
      if(d) await saveToCloud('debts', d.id, { ...d, paid: Number(d.paid) + Number(formData.amount) });
      const g = goals.find(x => x.id === formData.linkedId);
      if(g) await saveToCloud('goals', g.id, { ...g, current: Number(g.current) + Number(formData.amount) });
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

  const exportToSheets = () => {
    let csv = "\ufeffTimeline,Type,Category,Transaction,Account,Amount\n";
    transactions.forEach(t => {
      csv += `${t.date},${t.type},${t.category},"${t.subcategory || ""}",${t.account},${t.amount}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `HS_Report_V4_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // --- 6. RENDER LOGIC ---
  if (!user) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-800 p-6 text-center font-sans">
      <div className="bg-indigo-600 p-6 rounded-3xl shadow-2xl mb-8 animate-bounce">
        <Loader2 className="animate-spin text-white" size={48}/>
      </div>
      <p className="font-black uppercase tracking-[0.4em] text-xl text-slate-900 italic underline decoration-indigo-500">HS_MANAGER_V4</p>
      <p className="text-slate-400 mt-4 text-xs font-bold uppercase tracking-widest">Waking up secure cloud servers...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col md:flex-row font-sans text-slate-900 overflow-x-hidden selection:bg-indigo-100 uppercase font-black tracking-tight">
      
      {/* MOBILE HEADER - Fixed on Top */}
      <div className="md:hidden bg-white border-b border-slate-200 p-6 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 text-white p-2 rounded-xl shadow-lg"><Wallet size={20}/></div>
          <h1 className="text-lg font-black tracking-tighter text-slate-900">HS_MANAGER_V4</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-[10px] text-slate-400 tracking-widest">v4.0 LIVE</span>
        </div>
      </div>

      {/* SIDEBAR (Desktop) */}
      <div className="hidden md:flex w-80 bg-white border-r border-slate-200 p-10 flex-col h-screen sticky top-0 shadow-sm z-30">
        <div className="flex items-center gap-4 mb-14">
          <div className="bg-indigo-600 text-white p-3 rounded-2xl shadow-xl shadow-indigo-100"><Wallet size={32}/></div>
          <h1 className="text-2xl font-black tracking-tighter text-slate-900">HS_MANAGER_V4</h1>
        </div>
        <nav className="space-y-3 flex-grow">
          {[
            { id: 'dashboard', label: 'Overview', icon: <LayoutDashboard size={24}/> },
            { id: 'history', label: 'Transactions', icon: <ArrowRightLeft size={24}/> },
            { id: 'debts', label: 'Net Ledgers', icon: <UserCheck size={24}/> },
            { id: 'goals', label: 'Future Plans', icon: <Target size={24}/> },
            { id: 'settings', label: 'System Setup', icon: <Settings size={24}/> }
          ].map(tab => (
            <button 
              key={tab.id} 
              onClick={()=>setActiveTab(tab.id)} 
              className={`w-full flex items-center gap-4 px-6 py-4 rounded-[2rem] text-xs transition-all duration-300 tracking-[0.1em] ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-2xl shadow-indigo-200 scale-[1.05]' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-800'}`}
            >
              {tab.icon} <span>{tab.label}</span>
            </button>
          ))}
        </nav>
        <div className="pt-10 border-t border-slate-100">
           <button onClick={exportToSheets} className="w-full bg-emerald-50 text-emerald-700 p-4 rounded-[1.5rem] text-[10px] font-black border border-emerald-100 flex items-center justify-center gap-2 hover:bg-emerald-100 transition-all uppercase tracking-widest"><FileSpreadsheet size={16}/> EXPORT REPORT</button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <main className="flex-grow p-6 md:p-14 max-w-7xl mx-auto w-full pb-40">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-16 gap-8 px-4">
          <div className="animate-in slide-in-from-left duration-700">
            <div className="flex items-center gap-3 mb-4">
              <span className="bg-indigo-600 text-white px-4 py-1.5 rounded-full text-[11px] tracking-[0.2em] shadow-lg shadow-indigo-100">HS_MANAGER_V4</span>
            </div>
            <h2 className="text-7xl font-black text-slate-900 tracking-tighter uppercase">{activeTab}</h2>
            <div className="flex items-center gap-3 mt-5">
              <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 animate-pulse border-4 border-emerald-100"></div>
              <p className="text-slate-400 text-[11px] tracking-[0.4em] font-black">CLOUD_SYSTEM_ACTIVE • VERCEL_STABLE</p>
            </div>
          </div>
          <button 
            onClick={()=>{setEditingId(null); setIsModalOpen(true);}} 
            className="w-full sm:w-auto bg-slate-900 text-white px-14 py-6 rounded-[2.5rem] text-[11px] tracking-[0.3em] shadow-[0_20px_50px_rgba(0,0,0,0.15)] hover:bg-black hover:-translate-y-2 active:translate-y-0 transition-all flex items-center justify-center gap-4 border-b-4 border-slate-700"
          >
            <PlusCircle size={24}/> NEW RECORD
          </button>
        </header>

        {activeTab === 'dashboard' && (
          <div className="space-y-14 animate-in fade-in duration-700 px-2">
            {/* Top Stat Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">
              {[
                { label: 'NET CASH FLOW', val: totals.balance, color: 'indigo', icon: <Wallet size={40}/> },
                { label: 'LENT TOTAL', val: totals.rec, color: 'emerald', icon: <ArrowDownLeft size={40}/> },
                { label: 'DEBT TOTAL', val: totals.pay, color: 'rose', icon: <ArrowUpRight size={40}/> }
              ].map(stat => (
                <div key={stat.label} className="bg-white p-12 rounded-[4.5rem] shadow-sm border border-slate-100 flex flex-col items-center text-center relative overflow-hidden group hover:shadow-2xl hover:-translate-y-2 transition-all duration-500">
                  <div className={`bg-${stat.color}-50 text-${stat.color}-600 p-6 rounded-[2.5rem] mb-6 group-hover:scale-110 transition-transform duration-500`}>{stat.icon}</div>
                  <p className="text-[10px] text-slate-400 tracking-[0.4em] font-black">{stat.label}</p>
                  <h3 className="text-4xl text-slate-900 mt-5 tracking-tighter">₹{stat.val.toLocaleString()}</h3>
                </div>
              ))}
            </div>

            {/* Account Breakdown Glass Panel */}
            <div className="bg-white p-14 rounded-[5rem] shadow-sm border border-slate-100 relative overflow-hidden">
               <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600"></div>
               <h4 className="text-2xl text-slate-900 flex items-center gap-5 mb-14 tracking-tighter uppercase font-black"><Database className="text-indigo-600" size={36}/> Wallet Status v4</h4>
               <div className="grid grid-cols-2 lg:grid-cols-4 gap-10">
                  {totals.accBreakdown.map(acc => (
                    <div key={acc.name} className="p-10 bg-slate-50 rounded-[3rem] border-2 border-transparent hover:border-indigo-100 hover:bg-white hover:shadow-2xl transition-all group">
                       <p className="text-[10px] text-slate-400 tracking-[0.3em] group-hover:text-indigo-600 font-black mb-4">{acc.name}</p>
                       <p className={`text-3xl font-black tracking-tighter ${acc.balance < 0 ? 'text-rose-500' : 'text-slate-900'}`}>₹{acc.balance.toLocaleString()}</p>
                    </div>
                  ))}
               </div>
            </div>
          </div>
        )}

        {/* HISTORY TABLE VIEW */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-[5rem] shadow-sm border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-5 duration-700">
            <div className="p-14 border-b border-slate-50 flex flex-col lg:flex-row gap-8 bg-slate-50/30 items-center">
               <div className="relative flex-grow w-full max-w-3xl">
                  <Search size={24} className="absolute left-7 top-6 text-slate-400"/>
                  <input 
                    value={searchQuery} 
                    onChange={e=>setSearchQuery(e.target.value)} 
                    placeholder="SEARCH MASTER LEDGER..." 
                    className="w-full pl-20 pr-10 py-7 bg-white border-2 border-slate-100 rounded-[3rem] text-sm tracking-widest outline-none focus:border-indigo-500 transition-all shadow-sm font-black"
                  />
               </div>
               <select 
                 value={filterType} 
                 onChange={e=>setFilterType(e.target.value)} 
                 className="w-full lg:w-auto px-12 py-7 bg-white border-2 border-slate-100 rounded-[3rem] text-[12px] tracking-[0.3em] text-slate-700 outline-none hover:border-indigo-400 transition-colors font-black"
               >
                  <option value="All">ALL FLOWS</option>
                  <option value="Income">CREDITS (+)</option>
                  <option value="Expense">DEBITS (-)</option>
               </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[900px] tracking-tighter">
                <thead>
                  <tr className="bg-slate-50 text-[11px] text-slate-400 tracking-[0.4em] border-b border-slate-100 uppercase font-black">
                    <th className="p-12">DATE</th>
                    <th className="p-12">TRANSACTION DETAIL</th>
                    <th className="p-12 text-right">AMOUNT</th>
                    <th className="p-12 text-center">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredTx.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-all group font-black">
                      <td className="p-12 text-[13px] text-slate-400 tracking-tighter italic font-black">{t.date}</td>
                      <td className="p-12">
                        <p className="text-base text-slate-900 tracking-[0.1em] uppercase font-black">{t.subcategory || t.category}</p>
                        <p className="text-[11px] text-indigo-500 mt-4 tracking-[0.2em] font-black underline underline-offset-4">{t.account}</p>
                      </td>
                      <td className="p-12 text-right">
                        <span className={`text-3xl tracking-tighter font-black ${t.type === 'Income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {t.type === 'Income' ? '+' : '-'}₹{Number(t.amount).toLocaleString()}
                        </span>
                      </td>
                      <td className="p-12">
                        <div className="flex justify-center gap-6 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={()=>{setFormData({...t, amount:t.amount.toString()}); setEditingId(t.id); setIsModalOpen(true);}} className="p-5 text-indigo-600 bg-indigo-50 rounded-3xl hover:bg-indigo-600 hover:text-white transition-all shadow-xl"><Pencil size={24}/></button>
                          <button onClick={()=>handleDelete('transactions', t.id)} className="p-5 text-rose-600 bg-rose-50 rounded-3xl hover:bg-rose-600 hover:text-white transition-all shadow-xl"><Trash2 size={24}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* DEBTS/LEDGER VIEW */}
        {activeTab === 'debts' && (
          <div className="space-y-14 animate-in slide-in-from-bottom-5 duration-700 font-black">
             <div className="flex justify-between items-center bg-white p-14 rounded-[5rem] shadow-sm border border-slate-100">
                <h3 className="text-3xl text-slate-900 tracking-tighter px-4">MASTER HISAB V4</h3>
                <button onClick={()=>{setEditingDebtId(null); setIsDebtModalOpen(true);}} className="bg-slate-900 text-white px-12 py-6 rounded-[2.5rem] text-[11px] tracking-[0.4em] shadow-2xl active:scale-95 transition-all">ADD NEW PERSON</button>
             </div>
             
             <div className="grid grid-cols-1 gap-14">
               {nameLedgers.map(ledger => {
                 const net = ledger.receivables - ledger.payables;
                 return (
                   <div key={ledger.name} className="bg-white rounded-[6rem] shadow-sm border border-slate-100 overflow-hidden hover:shadow-[0_40px_80px_rgba(0,0,0,0.05)] transition-all duration-700">
                    <div className="p-16 bg-slate-50/50 border-b border-slate-100 flex flex-col xl:flex-row justify-between items-center gap-16 text-center xl:text-left">
                       <div>
                          <h2 className="text-8xl tracking-tighter text-slate-900 uppercase font-black">{ledger.name}</h2>
                          <div className={`mt-10 inline-flex items-center gap-6 px-14 py-6 rounded-[3rem] border-4 text-3xl tracking-widest font-black ${net >= 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
                            <NetIcon size={40}/> ₹{Math.abs(net).toLocaleString()} 
                            <span className="text-[12px] uppercase ml-4 opacity-60 tracking-[0.4em]">{net >= 0 ? 'RECEIVABLE' : 'PAYABLE'}</span>
                          </div>
                       </div>
                       <div className="flex flex-wrap justify-center gap-10">
                          <div className="bg-white p-12 rounded-[4.5rem] shadow-sm border border-slate-100 min-w-[240px]">
                             <p className="text-[12px] text-slate-400 mb-6 tracking-[0.4em]">CREDIT (+)</p>
                             <p className="text-6xl text-emerald-600 tracking-tighter font-black">₹{ledger.receivables.toLocaleString()}</p>
                          </div>
                          <div className="bg-white p-12 rounded-[4.5rem] shadow-sm border border-slate-100 min-w-[240px]">
                             <p className="text-[12px] text-slate-400 mb-6 tracking-[0.4em]">DEBIT (-)</p>
                             <p className="text-6xl text-rose-600 tracking-tighter font-black">₹{ledger.payables.toLocaleString()}</p>
                          </div>
                       </div>
                    </div>
                 </div>
               );})}
             </div>
          </div>
        )}
      </main>

      {/* MOBILE NAV - Floating Premium Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-3xl border-t border-slate-100 flex justify-around items-center p-8 z-40 shadow-[0_-30px_60px_rgba(0,0,0,0.1)]">
        {[
          { id: 'dashboard', icon: <LayoutDashboard size={32}/> },
          { id: 'history', icon: <ArrowRightLeft size={32}/> },
          { id: 'debts', icon: <UserCheck size={32}/> },
          { id: 'settings', icon: <Settings size={32}/> }
        ].map(tab => (
          <button 
            key={tab.id} 
            onClick={()=>setActiveTab(tab.id)} 
            className={`p-5 rounded-[2.5rem] transition-all duration-500 ${activeTab===tab.id ? 'bg-indigo-600 text-white shadow-2xl shadow-indigo-300 scale-125 -translate-y-5' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            {tab.icon}
          </button>
        ))}
        <button 
          onClick={()=>{setEditingId(null); setIsModalOpen(true);}} 
          className="p-7 bg-slate-900 text-white rounded-full -mt-28 border-[10px] border-slate-50 shadow-2xl active:scale-90 transition-all flex items-center justify-center"
        >
          <Plus size={48} strokeWidth={4}/>
        </button>
      </div>

      {/* --- ALL MODALS (Synced v4.0 UI) --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-3xl z-50 flex items-center justify-center p-4 transition-all animate-in fade-in duration-500 font-black">
           <div className="bg-white rounded-[5rem] w-full max-w-3xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col p-14 md:p-20 border border-slate-100">
              <div className="flex justify-between items-center mb-16 px-8 text-center">
                <div className="flex-1">
                  <h3 className="text-6xl text-slate-900 tracking-tighter uppercase font-black italic underline decoration-indigo-600 underline-offset-8 decoration-8">NEW ENTRY</h3>
                  <p className="text-indigo-600 text-[12px] tracking-[0.5em] mt-8 font-black">HS_MANAGER_V4 • SECURE_SYNC</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-8 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-[3rem] transition-all absolute top-10 right-10"><X size={48}/></button>
              </div>
              <form onSubmit={handleTransaction} className="space-y-10 overflow-y-auto px-8 custom-scrollbar pr-10 pb-16 font-black uppercase">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
                  <div className="space-y-5 text-center">
                    <label className="text-[12px] text-slate-400 tracking-[0.4em] font-black">TIMELINE_DATE</label>
                    <input type="date" required value={formData.date} onChange={e=>setFormData({...formData, date:e.target.value})} className="w-full bg-slate-50 border-8 border-transparent p-8 rounded-[3rem] text-base outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner font-black text-center" />
                  </div>
                  <div className="space-y-5 text-center">
                    <label className="text-[12px] text-indigo-500 tracking-[0.4em] font-black">ACCOUNT_TYPE</label>
                    <select value={formData.type} onChange={e=>setFormData({...formData, type:e.target.value, linkedId:''})} className="w-full bg-slate-50 border-8 border-transparent p-8 rounded-[3rem] text-base outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner font-black uppercase text-center">
                      <option value="Expense">EXPENSE (-)</option>
                      <option value="Income">INCOME (+)</option>
                      <option value="EMI_Payment">EMI PAYMENT</option>
                      <option value="Goal_Deposit">GOAL DEPOSIT</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-4">
                  <input list="cats" required value={formData.category} onChange={e=>setFormData({...formData, category:e.target.value})} placeholder="MAIN CATEGORY" className="w-full bg-slate-50 border-8 border-transparent p-8 rounded-[3rem] text-base outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner font-black text-center" />
                </div>
                <div className="space-y-4">
                  <input required value={formData.subcategory} onChange={e=>setFormData({...formData, subcategory:e.target.value})} placeholder="DESCRIPTION / DETAIL" className="w-full bg-slate-50 border-8 border-transparent p-8 rounded-[3rem] text-base outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner font-black text-center" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
                  <input list="accs" required value={formData.account} onChange={e=>setFormData({...formData, account:e.target.value})} placeholder="WALLET SOURCE" className="w-full bg-slate-50 border-8 border-transparent p-8 rounded-[3rem] text-base outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner font-black text-center" />
                  <input type="number" required value={formData.amount} onChange={e=>setFormData({...formData, amount:e.target.value})} placeholder="AMOUNT ₹" className="w-full bg-slate-50 border-8 border-transparent p-8 rounded-[3rem] text-5xl tracking-tighter outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner font-black text-center" />
                </div>
                <div className="flex gap-8 mt-14">
                   <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 bg-slate-100 text-slate-400 p-10 rounded-[3rem] font-black text-sm tracking-[0.4em] uppercase hover:bg-slate-200 transition-all">BACK</button>
                   <button type="submit" className="flex-[3] bg-slate-900 text-white p-10 rounded-[3.5rem] text-sm tracking-[0.6em] shadow-2xl hover:bg-black active:scale-95 transition-all uppercase border-b-8 border-slate-700">CONFIRM ENTRY</button>
                </div>
              </form>
           </div>
        </div>
      )}

      {/* DATALISTS */}
      <datalist id="cats">{defaultCategories.map(c=><option key={c} value={c}/>)}</datalist>
      <datalist id="accs">{(['Bank', 'Cash', 'Credit Card', 'UPI', 'Wallet', ...accountRecords.map(r => r.name)]).map(a=><option key={a} value={a}/>)}</datalist>
    </div>
  );
};

export default App;
