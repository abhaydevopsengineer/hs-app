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

// --- PRODUCTION FIREBASE CONFIG ---
const firebaseConfig = {
  apiKey: "AIzaSyDE3sdmPG3TGKV0CJDWHYPzDRE-8OKIanw",
  authDomain: "hs-expensemanager.firebaseapp.com",
  projectId: "hs-expensemanager",
  storageBucket: "hs-expensemanager.firebasestorage.app",
  messagingSenderId: "500261749602",
  appId: "1:500261749602:web:9840d9da48d8ace202223b",
  measurementId: "G-PFS0S1EKBC"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'hs-expenses-manager-pro';

const App = () => {
  // --- 1. STATES ---
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

  // --- 2. AUTH & SYNC ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Auth Fail:", err.message);
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
      });
    };
    const unsubTx = sync('transactions', setTransactions);
    const unsubDebt = sync('debts', setDebts);
    const unsubGoal = sync('goals', setGoals);
    const unsubAcc = sync('accountRecords', setAccountRecords);
    
    return () => { unsubTx(); unsubDebt(); unsubGoal(); unsubAcc(); };
  }, [user]);

  // --- 3. CALCULATIONS ---
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
    link.download = `HS_Report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // --- 6. RENDER LOGIC ---
  if (!user) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-800 p-6 text-center font-sans">
      <div className="bg-white p-8 rounded-3xl shadow-xl flex flex-col items-center">
        <Loader2 className="animate-spin mb-4 text-indigo-600" size={48}/>
        <p className="font-bold uppercase tracking-widest text-lg">HS Manager</p>
        <p className="text-slate-400 mt-2">Connecting to cloud database...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-900 overflow-x-hidden selection:bg-indigo-100">
      
      {/* SIDEBAR (Desktop) */}
      <div className="hidden md:flex w-72 bg-white border-r border-slate-200 p-6 flex-col h-screen sticky top-0 shadow-sm z-30">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="bg-indigo-600 text-white p-2.5 rounded-2xl shadow-lg shadow-indigo-200"><Wallet size={24}/></div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-800 uppercase">HS_Manager</h1>
        </div>
        <nav className="space-y-1.5 flex-grow">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20}/> },
            { id: 'history', label: 'History', icon: <ArrowRightLeft size={20}/> },
            { id: 'debts', label: 'Hisab (Debts)', icon: <UserCheck size={20}/> },
            { id: 'goals', label: 'Goals', icon: <Target size={20}/> },
            { id: 'settings', label: 'Settings', icon: <Settings size={20}/> }
          ].map(tab => (
            <button 
              key={tab.id} 
              onClick={()=>setActiveTab(tab.id)} 
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${activeTab === tab.id ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
            >
              {tab.icon} <span>{tab.label}</span>
            </button>
          ))}
        </nav>
        <div className="pt-6 border-t border-slate-100">
          <button onClick={exportToSheets} className="w-full bg-emerald-50 text-emerald-700 p-4 rounded-2xl text-xs font-bold border border-emerald-100 flex items-center justify-center gap-2 hover:bg-emerald-100 transition-all uppercase tracking-widest shadow-sm"><FileSpreadsheet size={16}/> EXPORT REPORT</button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <main className="flex-grow p-4 md:p-8 max-w-7xl mx-auto w-full pb-32">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 px-2">
          <div className="animate-in slide-in-from-left duration-500">
            <h2 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight capitalize">{activeTab}</h2>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <p className="text-slate-400 text-[11px] font-bold tracking-widest uppercase">Live Workspace</p>
            </div>
          </div>
          <button 
            onClick={()=>{setEditingId(null); setIsModalOpen(true);}} 
            className="w-full sm:w-auto bg-indigo-600 text-white px-6 py-3.5 rounded-2xl font-bold text-sm uppercase tracking-wider shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2"
          >
            <PlusCircle size={20}/> Quick Entry
          </button>
        </header>

        {/* DASHBOARD VIEW */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
            {/* Top Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col items-center text-center relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-50 rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform"></div>
                <div className="bg-indigo-100 text-indigo-600 p-3 rounded-2xl mb-4"><Wallet size={24}/></div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Net Balance</p>
                <h3 className="text-3xl font-black text-slate-800 mt-1">₹{totals.balance.toLocaleString()}</h3>
              </div>
              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col items-center text-center relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-50 rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform"></div>
                <div className="bg-emerald-100 text-emerald-600 p-3 rounded-2xl mb-4"><ArrowDownLeft size={24}/></div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Receivables</p>
                <h3 className="text-3xl text-emerald-600 font-black mt-1">₹{totals.rec.toLocaleString()}</h3>
              </div>
              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col items-center text-center relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-16 h-16 bg-rose-50 rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform"></div>
                <div className="bg-rose-100 text-rose-600 p-3 rounded-2xl mb-4"><ArrowUpRight size={24}/></div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Payables</p>
                <h3 className="text-3xl text-rose-600 font-black mt-1">₹{totals.pay.toLocaleString()}</h3>
              </div>
            </div>

            {/* Account Status Grid */}
            <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
               <div className="flex items-center justify-between mb-8">
                <h4 className="font-extrabold text-xl text-slate-800 flex items-center gap-3 tracking-tight"><Database className="text-indigo-500" size={24}/> Accounts</h4>
                <div className="h-1 flex-grow mx-6 bg-slate-50 rounded-full"></div>
               </div>
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
                  {totals.accBreakdown.map(acc => (
                    <div key={acc.name} className="p-5 bg-slate-50 rounded-3xl border border-transparent hover:border-indigo-200 hover:bg-white hover:shadow-md transition-all group cursor-default">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider group-hover:text-indigo-500 transition-colors">{acc.name}</p>
                       <p className={`text-xl font-black mt-2 ${acc.balance < 0 ? 'text-rose-500' : 'text-slate-800'}`}>₹{acc.balance.toLocaleString()}</p>
                    </div>
                  ))}
               </div>
            </div>

            {/* Loans & Goals Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               {/* Loans Card */}
               <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="bg-rose-100 text-rose-600 p-2 rounded-xl"><BellRing size={20}/></div>
                    <h4 className="font-extrabold text-lg text-slate-800 tracking-tight">Pending Dues</h4>
                  </div>
                  <div className="space-y-3">
                    {debts.filter(d => d.type === 'Taken' && (Number(d.total)-Number(d.paid)) > 0).map(d => (
                      <div key={d.id} className="p-4 bg-slate-50 rounded-2xl flex justify-between items-center hover:bg-slate-100 transition-all">
                        <div>
                          <p className="text-sm font-bold text-slate-800 uppercase">{d.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold flex items-center gap-1 mt-0.5"><Clock size={10}/> Due: {d.dueDate}</p>
                        </div>
                        <p className="text-sm font-black text-rose-600">₹{(Number(d.total) - Number(d.paid)).toLocaleString()}</p>
                      </div>
                    ))}
                    {debts.filter(d => d.type === 'Taken' && (Number(d.total)-Number(d.paid)) > 0).length === 0 && (
                      <div className="py-10 text-center flex flex-col items-center opacity-40">
                        <CheckCircle2 size={32} className="text-emerald-500 mb-2"/>
                        <p className="text-xs font-bold uppercase tracking-wider">All dues cleared!</p>
                      </div>
                    )}
                  </div>
               </div>

               {/* Goals Progress Card */}
               <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="bg-indigo-100 text-indigo-600 p-2 rounded-xl"><TrendingUp size={20}/></div>
                    <h4 className="font-extrabold text-lg text-slate-800 tracking-tight">Goals Status</h4>
                  </div>
                  <div className="space-y-6">
                    {goalReport.slice(0, 3).map(g => (
                      <div key={g.id} className="group cursor-default">
                        <div className="flex justify-between items-end mb-2 px-1">
                          <div>
                            <p className="text-xs font-black text-slate-700 uppercase">{g.name}</p>
                            <p className="text-[10px] text-slate-400 font-bold">{g.diffMonths} months remaining</p>
                          </div>
                          <p className="text-xs font-black text-indigo-600">{Math.round((Number(g.current)/Number(g.target))*100)}%</p>
                        </div>
                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200">
                          <div className="h-full bg-indigo-600 transition-all duration-1000 shadow-sm" style={{width: `${Math.min((g.current/g.target)*100, 100)}%`}}></div>
                        </div>
                      </div>
                    ))}
                    {goalReport.length === 0 && (
                      <div className="py-10 text-center flex flex-col items-center opacity-40">
                        <Target size={32} className="text-indigo-500 mb-2"/>
                        <p className="text-xs font-bold uppercase tracking-wider">Plan your first goal</p>
                      </div>
                    )}
                  </div>
               </div>
            </div>
          </div>
        )}

        {/* HISTORY VIEW */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-5 duration-500">
            <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row gap-4 bg-slate-50/30 items-center">
               <div className="relative flex-grow w-full max-w-md">
                  <Search size={18} className="absolute left-4 top-3 text-slate-400"/>
                  <input 
                    value={searchQuery} 
                    onChange={e=>setSearchQuery(e.target.value)} 
                    placeholder="Search transactions..." 
                    className="w-full pl-12 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
               </div>
               <div className="flex gap-2 w-full md:w-auto">
                 <select 
                   value={filterType} 
                   onChange={e=>setFilterType(e.target.value)} 
                   className="flex-grow md:flex-grow-0 px-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none hover:bg-slate-50 transition-colors"
                 >
                    <option value="All">All Transactions</option>
                    <option value="Income">Income Only</option>
                    <option value="Expense">Expense Only</option>
                    <option value="EMI_Payment">EMIs</option>
                 </select>
               </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[600px]">
                <thead>
                  <tr className="bg-slate-50/80 text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                    <th className="p-5">Timeline</th>
                    <th className="p-5">Transaction Details</th>
                    <th className="p-5 text-right">Amount</th>
                    <th className="p-5 text-center">Manage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredTx.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50/50 transition-all group">
                      <td className="p-5">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-700">{t.date}</span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Verified</span>
                        </div>
                      </td>
                      <td className="p-5">
                        <div className="flex flex-col">
                          <p className="text-sm font-extrabold text-slate-800 uppercase tracking-tight">{t.subcategory || t.category}</p>
                          <p className="text-[11px] text-slate-400 font-semibold italic flex items-center gap-1.5 mt-0.5"><div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>{t.account}</p>
                        </div>
                      </td>
                      <td className="p-5 text-right">
                        <span className={`text-base font-black ${t.type === 'Income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {t.type === 'Income' ? '+' : '-'}₹{Number(t.amount).toLocaleString()}
                        </span>
                      </td>
                      <td className="p-5">
                        <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={()=>{setFormData({...t, amount:t.amount.toString()}); setEditingId(t.id); setIsModalOpen(true);}} className="p-2 text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm"><Pencil size={14}/></button>
                          <button onClick={()=>handleDelete('transactions', t.id)} className="p-2 text-rose-600 bg-rose-50 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm"><Trash2 size={14}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredTx.length === 0 && (
                    <tr>
                      <td colSpan="4" className="p-20 text-center">
                        <div className="flex flex-col items-center opacity-30">
                          <Search size={48} className="mb-4"/>
                          <p className="text-lg font-black uppercase tracking-widest">No Records Found</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* NET LEDGERS (DEBTS) VIEW */}
        {activeTab === 'debts' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-5 duration-500">
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 gap-4">
                <div className="px-2">
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Net Hisab Ledgers</h3>
                  <p className="text-slate-400 text-xs font-bold mt-1 uppercase tracking-widest">Grouped by Person/entity</p>
                </div>
                <button onClick={()=>{setEditingDebtId(null); setIsDebtModalOpen(true);}} className="w-full sm:w-auto bg-slate-800 text-white px-8 py-3.5 rounded-2xl font-bold text-sm uppercase tracking-widest shadow-xl hover:bg-slate-900 transition-all flex items-center justify-center gap-2"><PlusCircle size={18}/> Master Record</button>
             </div>
             
             <div className="grid grid-cols-1 gap-8">
               {nameLedgers.map(ledger => {
                 const net = ledger.receivables - ledger.payables;
                 return (
                   <div key={ledger.name} className="bg-white rounded-[3.5rem] shadow-sm border border-slate-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    <div className="p-8 md:p-10 bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-8">
                       <div className="flex flex-col items-center md:items-start">
                          <h2 className="text-4xl font-black text-slate-800 tracking-tighter uppercase">{ledger.name}</h2>
                          <div className={`mt-4 flex items-center gap-3 px-6 py-2.5 rounded-2xl border-2 font-black text-base uppercase tracking-wider ${net >= 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
                            <NetIcon size={18}/> 
                            Net Hisab: ₹{Math.abs(net).toLocaleString()} 
                            <span className="text-[10px] ml-1">{net >= 0 ? '(Lena Hai)' : '(Dena Hai)'}</span>
                          </div>
                       </div>
                       <div className="flex gap-6">
                          <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 min-w-[140px] text-center group">
                             <p className="text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest group-hover:text-emerald-500 transition-colors">Receivable</p>
                             <p className="text-2xl text-emerald-600 font-black">₹{ledger.receivables.toLocaleString()}</p>
                          </div>
                          <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 min-w-[140px] text-center group">
                             <p className="text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest group-hover:text-rose-500 transition-colors">Payable</p>
                             <p className="text-2xl text-rose-600 font-black">₹{ledger.payables.toLocaleString()}</p>
                          </div>
                       </div>
                    </div>
                    <div className="p-8 md:p-10 bg-white">
                       <h4 className="text-[11px] font-black text-slate-400 tracking-[0.2em] mb-6 flex items-center gap-2 uppercase"><History size={16}/> Recent Transactions</h4>
                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {ledger.linkedTx.slice(0, 6).map(t => (
                            <div key={t.id} className="flex justify-between items-center p-5 bg-slate-50 rounded-[2rem] border border-transparent hover:border-slate-200 transition-all group">
                               <div className="flex items-center gap-4">
                                  <div className={`p-2 rounded-xl ${t.type === 'Income' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}><Banknote size={16}/></div>
                                  <div>
                                     <p className="text-[10px] font-bold text-slate-400">{t.date}</p>
                                     <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{t.account}</p>
                                  </div>
                               </div>
                               <p className={`text-sm font-black ${t.type === 'Income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                 {t.type === 'Income' ? '+' : '-'}₹{t.amount.toLocaleString()}
                               </p>
                            </div>
                          ))}
                          {ledger.linkedTx.length === 0 && <p className="col-span-full py-10 text-center text-slate-300 font-bold uppercase text-[10px] tracking-widest">No direct entries</p>}
                       </div>
                    </div>
                 </div>
               );})}
             </div>
          </div>
        )}

        {/* GOALS VIEW */}
        {activeTab === 'goals' && (
          <div className="space-y-10 animate-in slide-in-from-bottom-5 duration-500 font-sans px-2">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 gap-4">
               <div className="px-2">
                 <h3 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Goal Tracker</h3>
                 <p className="text-slate-400 text-xs font-bold mt-1 uppercase tracking-widest">Saving for the future</p>
               </div>
               <button onClick={()=>setIsGoalModalOpen(true)} className="w-full sm:w-auto bg-indigo-600 text-white px-8 py-3.5 rounded-2xl font-bold text-sm uppercase tracking-widest shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"><PlusCircle size={18}/> Create New Goal</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-10">
              {goalReport.map(g => (
                <div key={g.id} className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-slate-100 group relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                   <div className="absolute top-8 right-8 flex gap-3 opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={()=>{setGoalFormData(g); setEditingGoalId(g.id); setIsGoalModalOpen(true);}} className="p-2.5 text-indigo-600 bg-indigo-50 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all"><Pencil size={18}/></button>
                      <button onClick={()=>handleDelete('goals', g.id)} className="p-2.5 text-rose-600 bg-rose-50 rounded-2xl hover:bg-rose-600 hover:text-white transition-all"><Trash2 size={18}/></button>
                   </div>
                   <div className="flex justify-between items-start mb-10 font-black uppercase tracking-tight px-2">
                     <div>
                        <h3 className="text-3xl text-slate-800">{g.name}</h3>
                        <p className="text-xs text-indigo-500 mt-1 flex items-center gap-1.5 font-bold"><CalendarDays size={14}/> {g.targetDate}</p>
                     </div>
                     <div className="text-right">
                        <p className="text-4xl text-indigo-600">{Math.round((Number(g.current)/Number(g.target))*100)}%</p>
                        <p className="text-[10px] text-slate-400 mt-1 font-bold">Achieved</p>
                     </div>
                   </div>
                   
                   <div className="relative mb-10">
                      <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden border border-slate-50 shadow-inner">
                        <div className="bg-indigo-600 h-full transition-all duration-[2000ms] ease-out rounded-full shadow-lg" style={{width:`${Math.min((g.current/g.target)*100, 100)}%`}}></div>
                      </div>
                      <div className="flex justify-between mt-3 px-1 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                         <span>Saved: ₹{Number(g.current).toLocaleString()}</span>
                         <span>Target: ₹{Number(g.target).toLocaleString()}</span>
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-6 mt-6">
                      <div className="bg-slate-50 p-6 rounded-[2.5rem] text-center border border-transparent hover:border-indigo-100 transition-all group">
                         <p className="text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Monthly Target</p>
                         <p className="text-2xl text-indigo-600 font-black">₹{g.monthlyRequired.toLocaleString()}</p>
                      </div>
                      <div className="bg-slate-50 p-6 rounded-[2.5rem] text-center border border-transparent hover:border-slate-200 transition-all">
                         <p className="text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Still Needed</p>
                         <p className="text-2xl text-slate-800 font-black">₹{g.remaining.toLocaleString()}</p>
                      </div>
                   </div>
                </div>
              ))}
              {goalReport.length === 0 && (
                <div className="col-span-full py-20 bg-white rounded-[3.5rem] border border-dashed border-slate-200 flex flex-col items-center justify-center opacity-40">
                  <div className="bg-slate-50 p-6 rounded-full mb-4"><Target size={48} className="text-slate-400"/></div>
                  <p className="text-xl font-black text-slate-500 uppercase tracking-[0.2em]">Start Planning Today</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SETTINGS VIEW */}
        {activeTab === 'settings' && (
          <div className="max-w-3xl mx-auto animate-in zoom-in duration-500 font-sans">
             <div className="bg-white p-8 md:p-12 rounded-[3.5rem] shadow-sm border border-slate-100">
                <div className="flex items-center gap-4 mb-10 px-2">
                  <div className="bg-amber-100 text-amber-600 p-3 rounded-2xl"><Database size={24}/></div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Account Management</h3>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Opening Balances & Names</p>
                  </div>
                </div>
                
                <form onSubmit={async (e) => { 
                  e.preventDefault(); 
                  const name = e.target.accName.value; 
                  const bal = e.target.accBal.value; 
                  await saveToCloud('accountRecords', Date.now(), { name, balance: Number(bal) }); 
                  e.target.reset(); 
                }} className="flex flex-col sm:flex-row gap-4 mb-12">
                  <input name="accName" required placeholder="Account Name (e.g. SBI Bank)" className="flex-[2] bg-slate-50 border-2 border-transparent p-4 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner" />
                  <input name="accBal" type="number" required placeholder="Balance ₹" className="flex-1 bg-slate-50 border-2 border-transparent p-4 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner" />
                  <button type="submit" className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">Add</button>
                </form>

                <div className="space-y-3">
                   {accountRecords.map(acc => (
                     <div key={acc.id} className="flex justify-between items-center p-5 bg-slate-50 rounded-2xl border border-transparent hover:border-slate-200 transition-all group">
                       <span className="text-sm font-black text-slate-700 uppercase tracking-tight">{acc.name}</span>
                       <div className="flex items-center gap-6">
                          <span className="text-base font-black text-slate-900">₹{Number(acc.balance).toLocaleString()}</span>
                          <button onClick={()=>handleDelete('accountRecords', acc.id)} className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"><Trash2 size={18}/></button>
                       </div>
                     </div>
                   ))}
                   {accountRecords.length === 0 && <p className="text-center py-10 text-slate-300 font-bold uppercase text-[10px] tracking-widest">No custom accounts</p>}
                </div>
             </div>
          </div>
        )}
      </main>

      {/* MOBILE NAVIGATION BAR */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-100 flex justify-around items-center p-3 z-40 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
        {[
          { id: 'dashboard', icon: <LayoutDashboard size={22}/> },
          { id: 'history', icon: <ArrowRightLeft size={22}/> },
          { id: 'debts', icon: <UserCheck size={22}/> },
          { id: 'goals', icon: <Target size={22}/> },
          { id: 'settings', icon: <Settings size={22}/> }
        ].map(tab => (
          <button 
            key={tab.id} 
            onClick={()=>setActiveTab(tab.id)} 
            className={`p-3 rounded-2xl transition-all duration-200 ${activeTab===tab.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-110' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            {tab.icon}
          </button>
        ))}
        <button 
          onClick={()=>{setEditingId(null); setIsModalOpen(true);}} 
          className="p-3.5 bg-slate-800 text-white rounded-full -mt-14 border-4 border-slate-50 shadow-xl active:scale-90 transition-all flex items-center justify-center"
        >
          <Plus size={28} strokeWidth={3}/>
        </button>
      </div>

      {/* --- ALL MODALS (FIXED UI) --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all animate-in fade-in duration-300">
           <div className="bg-white rounded-[3rem] w-full max-w-xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col p-6 md:p-10 border border-slate-100">
              <div className="flex justify-between items-center mb-8 px-2">
                <div>
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Quick Transaction</h3>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Add new income or expense</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-3 text-slate-400 hover:text-slate-800 hover:bg-slate-50 rounded-2xl transition-all"><X size={24}/></button>
              </div>
              <form onSubmit={handleTransaction} className="space-y-6 overflow-y-auto px-2 custom-scrollbar pr-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Timeline</label>
                    <input type="date" required value={formData.date} onChange={e=>setFormData({...formData, date:e.target.value})} className="w-full bg-slate-50 border-2 border-transparent p-4 rounded-2xl text-xs font-black outline-none focus:bg-white focus:border-indigo-500 transition-all" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest ml-1">Entry Type</label>
                    <select value={formData.type} onChange={e=>setFormData({...formData, type:e.target.value, linkedId:''})} className="w-full bg-slate-50 border-2 border-transparent p-4 rounded-2xl text-xs font-black outline-none focus:bg-white focus:border-indigo-500 transition-all">
                      <option value="Expense">Expense (-)</option>
                      <option value="Income">Income (+)</option>
                      <option value="EMI_Payment">EMI Payment</option>
                      <option value="Goal_Deposit">Goal Saving</option>
                    </select>
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Category</label>
                  <input list="cats" required value={formData.category} onChange={e=>setFormData({...formData, category:e.target.value})} placeholder="Select or type..." className="w-full bg-slate-50 border-2 border-transparent p-4 rounded-2xl text-xs font-black outline-none focus:bg-white focus:border-indigo-500 transition-all" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Description (Sub)</label>
                  <input required value={formData.subcategory} onChange={e=>setFormData({...formData, subcategory:e.target.value})} placeholder="What is this for?" className="w-full bg-slate-50 border-2 border-transparent p-4 rounded-2xl text-xs font-black outline-none focus:bg-white focus:border-indigo-500 transition-all" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-amber-600 uppercase tracking-widest ml-1">Payment Source</label>
                    <input list="accs" required value={formData.account} onChange={e=>setFormData({...formData, account:e.target.value})} placeholder="Cash/Bank..." className="w-full bg-slate-50 border-2 border-transparent p-4 rounded-2xl text-xs font-black outline-none focus:bg-white focus:border-indigo-500 transition-all" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Amount ₹</label>
                    <input type="number" required value={formData.amount} onChange={e=>setFormData({...formData, amount:e.target.value})} placeholder="0.00" className="w-full bg-slate-50 border-2 border-transparent p-4 rounded-2xl text-base font-black outline-none focus:bg-white focus:border-indigo-500 transition-all" />
                  </div>
                </div>

                {['EMI_Payment', 'Income', 'Expense', 'Goal_Deposit'].includes(formData.type) && (
                  <div className="space-y-1.5 bg-indigo-50/50 p-4 rounded-3xl border border-indigo-50">
                    <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest ml-1">Link to Master Hisab</label>
                    <select value={formData.linkedId} onChange={e=>setFormData({...formData, linkedId:e.target.value})} className="w-full bg-white border border-indigo-100 p-4 rounded-2xl text-xs font-black outline-none focus:border-indigo-500 shadow-sm transition-all">
                      <option value="">-- No link (Independent entry) --</option>
                      {debts.map(d=><option key={d.id} value={d.id}>{d.name} ({d.type})</option>)}
                      {goals.map(g=><option key={g.id} value={g.id}>Goal: {g.name}</option>)}
                    </select>
                  </div>
                )}
                
                <button type="submit" className="w-full bg-slate-900 text-white p-5 rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-xl hover:bg-slate-800 active:scale-95 transition-all mt-6">Submit Record</button>
              </form>
           </div>
        </div>
      )}

      {/* DEBT MODAL */}
      {isDebtModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-[3rem] w-full max-w-md p-8 shadow-2xl border border-slate-100 font-sans">
            <h3 className="text-2xl font-black text-slate-800 tracking-tight uppercase mb-8 px-2">Master Record Entry</h3>
            <form onSubmit={handleDebt} className="space-y-5 px-1">
              <input required value={debtFormData.name} onChange={e=>setDebtFormData({...debtFormData, name:e.target.value})} placeholder="Person or Loan Name" className="w-full bg-slate-50 border-2 border-transparent p-4 rounded-2xl text-xs font-black outline-none focus:bg-white focus:border-indigo-500 transition-all" />
              <select value={debtFormData.type} onChange={e=>setDebtFormData({...debtFormData, type:e.target.value})} className="w-full bg-slate-50 border-2 border-transparent p-4 rounded-2xl text-xs font-black outline-none focus:bg-white focus:border-indigo-500 transition-all">
                <option value="Given">Given (Receivable)</option>
                <option value="Taken">Taken (Payable / Loan)</option>
                <option value="Subscription">Policy / Subscription</option>
              </select>
              <div className="grid grid-cols-2 gap-4">
                <input type="number" required value={debtFormData.total} onChange={e=>setDebtFormData({...debtFormData, total:e.target.value})} placeholder="Principal ₹" className="w-full bg-slate-50 border-2 border-transparent p-4 rounded-2xl text-xs font-black outline-none focus:bg-white focus:border-indigo-500 transition-all" />
                <input type="date" required value={debtFormData.dueDate} onChange={e=>setDebtFormData({...debtFormData, dueDate:e.target.value})} className="w-full bg-slate-50 border-2 border-transparent p-4 rounded-2xl text-xs font-black outline-none focus:bg-white focus:border-indigo-500 transition-all" />
              </div>
              <div className="flex gap-4 mt-8">
                <button type="button" onClick={()=>setIsDebtModalOpen(false)} className="flex-1 bg-slate-100 text-slate-600 p-4 rounded-2xl font-bold uppercase text-xs hover:bg-slate-200 transition-all tracking-widest">Cancel</button>
                <button type="submit" className="flex-1 bg-slate-900 text-white p-4 rounded-2xl font-black uppercase text-xs hover:bg-slate-800 transition-all tracking-widest shadow-lg shadow-slate-200">Save Hisab</button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* GOAL MODAL */}
      {isGoalModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-[3rem] w-full max-w-md p-8 shadow-2xl border border-slate-100 font-sans">
            <h3 className="text-2xl font-black text-slate-800 tracking-tight uppercase mb-8 px-2">Goal Planning</h3>
            <form onSubmit={handleGoal} className="space-y-5 px-1">
              <input required value={goalFormData.name} onChange={e=>setGoalFormData({...goalFormData, name:e.target.value})} placeholder="Goal Name (e.g. Dream House)" className="w-full bg-slate-50 border-2 border-transparent p-4 rounded-2xl text-xs font-black outline-none focus:bg-white focus:border-indigo-500 transition-all" />
              <div className="grid grid-cols-2 gap-4">
                <input type="number" required value={goalFormData.target} onChange={e=>setGoalFormData({...goalFormData, target:e.target.value})} placeholder="Target ₹" className="w-full bg-slate-50 border-2 border-transparent p-4 rounded-2xl text-xs font-black outline-none focus:bg-white focus:border-indigo-500 transition-all" />
                <input type="date" required value={goalFormData.targetDate} onChange={e=>setGoalFormData({...goalFormData, targetDate:e.target.value})} className="w-full bg-slate-50 border-2 border-transparent p-4 rounded-2xl text-xs font-black outline-none focus:bg-white focus:border-indigo-500 transition-all" />
              </div>
              <div className="flex gap-4 mt-8">
                <button type="button" onClick={()=>{setIsGoalModalOpen(false); setEditingGoalId(null);}} className="flex-1 bg-slate-100 text-slate-600 p-4 rounded-2xl font-bold uppercase text-xs hover:bg-slate-200 transition-all tracking-widest">Back</button>
                <button type="submit" className="flex-1 bg-indigo-600 text-white p-4 rounded-2xl font-black uppercase text-xs hover:bg-indigo-700 transition-all tracking-widest shadow-lg shadow-indigo-100">Set Goal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DATALISTS */}
      <datalist id="cats">{categories.map(c=><option key={c} value={c}/>)}</datalist>
      <datalist id="accs">{(['Bank', 'Cash', 'Credit Card', 'UPI', 'Wallet']).map(a=><option key={a} value={a}/>)}</datalist>
      <datalist id="subs">{defaultSubcategories.map(s=><option key={s} value={s}/>)}</datalist>
      <datalist id="types">{entryTypes.map(t=><option key={t} value={t}/>)}</datalist>
    </div>
  );
};

export default App;
