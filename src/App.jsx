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
  // --- 1. STATES (Preserving Logic) ---
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

  // --- 2. AUTH & SYNC (Preserving Logic) ---
  useEffect(() => {
    const initAuth = async () => {
      try { await signInAnonymously(auth); } catch (err) { console.error("Auth Fail:", err.message); }
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

  // --- 3. CALCULATIONS (Preserving Hook Order) ---
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
      <div className="bg-white p-10 rounded-[3rem] shadow-2xl flex flex-col items-center border border-slate-100 animate-pulse">
        <Loader2 className="animate-spin mb-4 text-indigo-600" size={48}/>
        <p className="font-black uppercase tracking-widest text-lg text-slate-800">HS Manager Pro</p>
        <p className="text-slate-400 mt-2 text-sm font-medium">Authenticating Securely...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-900 overflow-x-hidden selection:bg-indigo-100">
      
      {/* SIDEBAR (Desktop) */}
      <div className="hidden md:flex w-72 bg-white border-r border-slate-200 p-6 flex-col h-screen sticky top-0 shadow-sm z-30">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="bg-indigo-600 text-white p-2.5 rounded-2xl shadow-lg shadow-indigo-100"><Wallet size={24}/></div>
          <h1 className="text-xl font-black tracking-tight text-slate-800 uppercase">HS_Manager_v2</h1>
        </div>
        <nav className="space-y-1 flex-grow">
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
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all duration-300 ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
            >
              {tab.icon} <span className="capitalize">{tab.label}</span>
            </button>
          ))}
        </nav>
        <div className="pt-6 border-t border-slate-100">
          <button onClick={exportToSheets} className="w-full bg-slate-900 text-white p-4 rounded-2xl text-xs font-black border border-slate-800 flex items-center justify-center gap-2 hover:bg-slate-800 transition-all uppercase tracking-widest shadow-lg shadow-slate-100"><FileSpreadsheet size={16}/> EXPORT REPORT</button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <main className="flex-grow p-4 md:p-8 max-w-7xl mx-auto w-full pb-32">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4 px-2">
          <div className="animate-in slide-in-from-left duration-500">
            <h2 className="text-4xl font-black text-slate-800 tracking-tighter uppercase">{activeTab}</h2>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
              <p className="text-slate-400 text-[10px] font-black tracking-[0.2em] uppercase">Status: Syncing Live</p>
            </div>
          </div>
          <button 
            onClick={()=>{setEditingId(null); setIsModalOpen(true);}} 
            className="w-full sm:w-auto bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.15em] shadow-2xl shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-3"
          >
            <PlusCircle size={20}/> Quick Entry
          </button>
        </header>

        {/* DASHBOARD VIEW */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
            {/* Top Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col items-center text-center group">
                <div className="bg-indigo-50 text-indigo-600 p-4 rounded-3xl mb-4 group-hover:scale-110 transition-transform duration-300"><Wallet size={28}/></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Balance</p>
                <h3 className="text-3xl font-black text-slate-800 mt-2">₹{totals.balance.toLocaleString()}</h3>
              </div>
              <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col items-center text-center group">
                <div className="bg-emerald-50 text-emerald-600 p-4 rounded-3xl mb-4 group-hover:scale-110 transition-transform duration-300"><ArrowDownLeft size={28}/></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Receivables</p>
                <h3 className="text-3xl text-emerald-600 font-black mt-2">₹{totals.rec.toLocaleString()}</h3>
              </div>
              <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col items-center text-center group">
                <div className="bg-rose-50 text-rose-600 p-4 rounded-3xl mb-4 group-hover:scale-110 transition-transform duration-300"><ArrowUpRight size={28}/></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Payables</p>
                <h3 className="text-3xl text-rose-600 font-black mt-2">₹{totals.pay.toLocaleString()}</h3>
              </div>
            </div>

            {/* Account Status Grid */}
            <div className="bg-white p-8 md:p-10 rounded-[3.5rem] shadow-sm border border-slate-100">
               <h4 className="font-black text-xl text-slate-800 flex items-center gap-3 mb-8 uppercase tracking-tighter"><Database className="text-indigo-500" size={24}/> Wallet Status</h4>
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
                  {totals.accBreakdown.map(acc => (
                    <div key={acc.name} className="p-6 bg-slate-50 rounded-[2rem] border-2 border-transparent hover:border-indigo-100 hover:bg-white hover:shadow-xl transition-all group">
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest group-hover:text-indigo-500">{acc.name}</p>
                       <p className={`text-xl font-black mt-2 ${acc.balance < 0 ? 'text-rose-500' : 'text-slate-800'}`}>₹{acc.balance.toLocaleString()}</p>
                    </div>
                  ))}
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               <div className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-slate-100 border-t-[10px] border-t-rose-500">
                  <h4 className="font-black text-xl text-slate-800 flex items-center gap-3 mb-8 uppercase tracking-tighter"><BellRing className="text-rose-500" size={22}/> Active Dues</h4>
                  <div className="space-y-4">
                    {debts.filter(d => d.type === 'Taken' && (Number(d.total)-Number(d.paid)) > 0).map(d => (
                      <div key={d.id} className="p-5 bg-slate-50 rounded-[2rem] flex justify-between items-center hover:bg-white hover:shadow-lg transition-all border border-transparent hover:border-slate-100">
                        <div>
                          <p className="text-xs font-black text-slate-800 uppercase tracking-wide">{d.name}</p>
                          <p className="text-[9px] text-slate-400 font-bold flex items-center gap-1 mt-1 uppercase"><Clock size={12}/> Due: {d.dueDate}</p>
                        </div>
                        <p className="text-sm font-black text-rose-600">₹{(Number(d.total) - Number(d.paid)).toLocaleString()}</p>
                      </div>
                    ))}
                    {debts.filter(d => d.type === 'Taken' && (Number(d.total)-Number(d.paid)) > 0).length === 0 && (
                      <div className="py-12 text-center opacity-30">
                        <CheckCircle2 size={40} className="mx-auto text-emerald-500 mb-3"/>
                        <p className="text-[10px] font-black uppercase tracking-widest">All accounts cleared</p>
                      </div>
                    )}
                  </div>
               </div>

               <div className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-slate-100 border-t-[10px] border-t-indigo-500">
                  <h4 className="font-black text-xl text-slate-800 flex items-center gap-3 mb-8 uppercase tracking-tighter"><Target className="text-indigo-500" size={22}/> Goal Status</h4>
                  <div className="space-y-5">
                    {goalReport.slice(0, 3).map(g => (
                      <div key={g.id} className="group">
                        <div className="flex justify-between items-end mb-2 px-1">
                          <div>
                            <p className="text-xs font-black text-slate-700 uppercase tracking-wide">{g.name}</p>
                            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{g.diffMonths} months left</p>
                          </div>
                          <p className="text-xs font-black text-indigo-600">{Math.round((Number(g.current)/Number(g.target))*100)}%</p>
                        </div>
                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200">
                          <div className="h-full bg-indigo-600 transition-all duration-[1500ms] rounded-full shadow-sm" style={{width: `${Math.min((g.current/g.target)*100, 100)}%`}}></div>
                        </div>
                      </div>
                    ))}
                    {goalReport.length === 0 && (
                      <div className="py-12 text-center opacity-30">
                        <Target size={40} className="mx-auto text-indigo-500 mb-3"/>
                        <p className="text-[10px] font-black uppercase tracking-widest">No goals set</p>
                      </div>
                    )}
                  </div>
               </div>
            </div>
          </div>
        )}

        {/* HISTORY VIEW */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-5 duration-500">
            <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row gap-4 bg-slate-50/20 items-center">
               <div className="relative flex-grow w-full max-w-md">
                  <Search size={18} className="absolute left-4 top-3.5 text-slate-400"/>
                  <input 
                    value={searchQuery} 
                    onChange={e=>setSearchQuery(e.target.value)} 
                    placeholder="Search ledger..." 
                    className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-xs font-bold outline-none focus:border-indigo-500 transition-all"
                  />
               </div>
               <select 
                 value={filterType} 
                 onChange={e=>setFilterType(e.target.value)} 
                 className="w-full md:w-auto px-6 py-3 bg-white border-2 border-slate-100 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-700 outline-none"
               >
                  <option value="All">All Entries</option>
                  <option value="Income">Income (+)</option>
                  <option value="Expense">Expense (-)</option>
               </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[600px] font-black uppercase">
                <thead>
                  <tr className="bg-slate-50 text-[10px] text-slate-400 tracking-[0.2em] border-b border-slate-100">
                    <th className="p-6">Date</th>
                    <th className="p-6">Record Details</th>
                    <th className="p-6 text-right">Amount</th>
                    <th className="p-6 text-center">Manage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredTx.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-all group">
                      <td className="p-6 text-[11px] text-slate-400 tracking-tighter">{t.date}</td>
                      <td className="p-6">
                        <p className="text-xs font-black text-slate-800 tracking-tight">{t.subcategory || t.category}</p>
                        <p className="text-[9px] text-indigo-500 font-bold mt-1 tracking-widest">{t.account}</p>
                      </td>
                      <td className="p-6 text-right font-black">
                        <span className={`text-base ${t.type === 'Income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {t.type === 'Income' ? '+' : '-'}₹{Number(t.amount).toLocaleString()}
                        </span>
                      </td>
                      <td className="p-6">
                        <div className="flex justify-center gap-3">
                          <button onClick={()=>{setFormData({...t, amount:t.amount.toString()}); setEditingId(t.id); setIsModalOpen(true);}} className="p-2.5 text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-600 hover:text-white transition-all"><Pencil size={14}/></button>
                          <button onClick={()=>handleDelete('transactions', t.id)} className="p-2.5 text-rose-600 bg-rose-50 rounded-xl hover:bg-rose-600 hover:text-white transition-all"><Trash2 size={14}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* DEBTS VIEW */}
        {activeTab === 'debts' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-5 duration-500">
             <div className="flex justify-between items-center bg-white p-8 rounded-[3.5rem] shadow-sm border border-slate-100">
                <h3 className="text-2xl font-black text-slate-800 tracking-tight uppercase px-2">Net Hisab Ledgers</h3>
                <button onClick={()=>{setEditingDebtId(null); setIsDebtModalOpen(true);}} className="bg-slate-900 text-white px-8 py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all">New Entry</button>
             </div>
             
             <div className="grid grid-cols-1 gap-10">
               {nameLedgers.map(ledger => {
                 const net = ledger.receivables - ledger.payables;
                 return (
                   <div key={ledger.name} className="bg-white rounded-[4rem] shadow-sm border border-slate-100 overflow-hidden hover:shadow-2xl transition-all duration-500 font-black uppercase">
                    <div className="p-10 bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-10">
                       <div className="text-center md:text-left">
                          <h2 className="text-5xl tracking-tighter text-slate-800">{ledger.name}</h2>
                          <div className={`mt-5 flex items-center gap-4 px-8 py-3.5 rounded-2xl border-2 text-lg tracking-widest ${net >= 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
                            <NetIcon size={24}/> ₹{Math.abs(net).toLocaleString()} 
                            <span className="text-xs opacity-60 ml-2">{net >= 0 ? 'To Get' : 'To Pay'}</span>
                          </div>
                       </div>
                       <div className="flex gap-8">
                          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 min-w-[160px] text-center">
                             <p className="text-[10px] text-slate-400 mb-2 tracking-widest">Lent</p>
                             <p className="text-3xl text-emerald-600">₹{ledger.receivables.toLocaleString()}</p>
                          </div>
                          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 min-w-[160px] text-center">
                             <p className="text-[10px] text-slate-400 mb-2 tracking-widest">Borrowed</p>
                             <p className="text-3xl text-rose-600">₹{ledger.payables.toLocaleString()}</p>
                          </div>
                       </div>
                    </div>
                 </div>
               );})}
             </div>
          </div>
        )}

        {/* GOALS VIEW */}
        {activeTab === 'goals' && (
          <div className="space-y-12 animate-in slide-in-from-bottom-5 duration-500 font-sans px-2">
            <div className="flex justify-between items-center bg-white p-10 rounded-[3.5rem] shadow-sm border border-slate-100">
               <h3 className="text-2xl font-black text-slate-800 tracking-tight uppercase px-2">Savings Goals</h3>
               <button onClick={()=>setIsGoalModalOpen(true)} className="bg-indigo-600 text-white px-10 py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-3"><PlusCircle size={18}/> Add Goal</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {goalReport.map(g => (
                <div key={g.id} className="bg-white p-10 rounded-[4rem] shadow-sm border border-slate-100 group relative overflow-hidden transition-all duration-500 hover:shadow-2xl">
                   <div className="absolute top-10 right-10 flex gap-4 opacity-0 group-hover:opacity-100 transition-all font-black uppercase">
                      <button onClick={()=>{setGoalFormData(g); setEditingGoalId(g.id); setIsGoalModalOpen(true);}} className="p-3 text-indigo-600 bg-indigo-50 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all"><Pencil size={20}/></button>
                      <button onClick={()=>handleDelete('goals', g.id)} className="p-3 text-rose-600 bg-rose-50 rounded-2xl hover:bg-rose-600 hover:text-white transition-all"><Trash2 size={20}/></button>
                   </div>
                   <div className="flex justify-between items-start mb-12 font-black uppercase tracking-tighter px-2">
                     <div>
                        <h3 className="text-4xl text-slate-800">{g.name}</h3>
                        <p className="text-sm text-indigo-500 mt-2 flex items-center gap-2 font-black tracking-widest"><CalendarDays size={18}/> {g.targetDate}</p>
                     </div>
                     <div className="text-right">
                        <p className="text-5xl text-indigo-600">{Math.round((Number(g.current)/Number(g.target))*100)}%</p>
                        <p className="text-[11px] text-slate-400 mt-1 font-black tracking-widest">Achieved</p>
                     </div>
                   </div>
                   
                   <div className="relative mb-12">
                      <div className="w-full bg-slate-100 h-5 rounded-full overflow-hidden border border-slate-50 shadow-inner p-1">
                        <div className="h-full bg-indigo-600 transition-all duration-[2500ms] ease-out rounded-full shadow-lg" style={{width:`${Math.min((g.current/g.target)*100, 100)}%`}}></div>
                      </div>
                      <div className="flex justify-between mt-4 px-1 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                         <span>Saved: ₹{Number(g.current).toLocaleString()}</span>
                         <span>Target: ₹{Number(g.target).toLocaleString()}</span>
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-8 mt-10">
                      <div className="bg-slate-50 p-8 rounded-[3rem] text-center border-2 border-transparent hover:border-indigo-100 hover:bg-white transition-all group">
                         <p className="text-[10px] font-black text-slate-400 mb-3 uppercase tracking-[0.2em]">Monthly Goal</p>
                         <p className="text-3xl text-indigo-600 font-black">₹{g.monthlyRequired.toLocaleString()}</p>
                      </div>
                      <div className="bg-slate-50 p-8 rounded-[3rem] text-center border-2 border-transparent hover:border-slate-200 hover:bg-white transition-all">
                         <p className="text-[10px] font-black text-slate-400 mb-3 uppercase tracking-[0.2em]">Remaining</p>
                         <p className="text-3xl text-slate-800 font-black">₹{g.remaining.toLocaleString()}</p>
                      </div>
                   </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SETTINGS VIEW */}
        {activeTab === 'settings' && (
          <div className="max-w-3xl mx-auto animate-in zoom-in duration-500 font-sans">
             <div className="bg-white p-10 md:p-14 rounded-[4rem] shadow-sm border border-slate-100 font-black uppercase">
                <div className="flex items-center gap-5 mb-12 px-2">
                  <div className="bg-indigo-100 text-indigo-600 p-4 rounded-3xl"><Database size={28}/></div>
                  <div>
                    <h3 className="text-3xl text-slate-800 tracking-tight uppercase">Master Accounts</h3>
                    <p className="text-slate-400 text-xs font-black uppercase tracking-widest mt-1">Configure opening balances</p>
                  </div>
                </div>
                
                <form onSubmit={async (e) => { 
                  e.preventDefault(); 
                  const name = e.target.accName.value; 
                  const bal = e.target.accBal.value; 
                  await saveToCloud('accountRecords', Date.now(), { name, balance: Number(bal) }); 
                  e.target.reset(); 
                }} className="flex flex-col sm:flex-row gap-5 mb-14">
                  <input name="accName" required placeholder="Account Name" className="flex-[2] bg-slate-50 border-2 border-transparent p-5 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner" />
                  <input name="accBal" type="number" required placeholder="Balance ₹" className="flex-1 bg-slate-50 border-2 border-transparent p-5 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner" />
                  <button type="submit" className="bg-indigo-600 text-white px-10 py-5 rounded-[1.5rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all">Set</button>
                </form>

                <div className="space-y-4">
                   {accountRecords.map(acc => (
                     <div key={acc.id} className="flex justify-between items-center p-6 bg-slate-50 rounded-[2rem] border-2 border-transparent hover:border-indigo-100 hover:bg-white transition-all group">
                       <span className="text-sm font-black text-slate-700 uppercase tracking-widest">{acc.name}</span>
                       <div className="flex items-center gap-8">
                          <span className="text-xl font-black text-slate-900 tracking-tight">₹{Number(acc.balance).toLocaleString()}</span>
                          <button onClick={()=>handleDelete('accountRecords', acc.id)} className="p-3 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all opacity-0 group-hover:opacity-100"><Trash2 size={20}/></button>
                       </div>
                     </div>
                   ))}
                </div>
             </div>
          </div>
        )}
      </main>

      {/* MOBILE NAVIGATION BAR */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-2xl border-t border-slate-100 flex justify-around items-center p-4 z-40 shadow-[0_-15px_30px_rgba(0,0,0,0.05)]">
        {[
          { id: 'dashboard', icon: <LayoutDashboard size={24}/> },
          { id: 'history', icon: <ArrowRightLeft size={24}/> },
          { id: 'debts', icon: <UserCheck size={24}/> },
          { id: 'goals', icon: <Target size={24}/> },
          { id: 'settings', icon: <Settings size={24}/> }
        ].map(tab => (
          <button 
            key={tab.id} 
            onClick={()=>setActiveTab(tab.id)} 
            className={`p-3 rounded-2xl transition-all duration-300 ${activeTab===tab.id ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200 scale-110' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            {tab.icon}
          </button>
        ))}
        <button 
          onClick={()=>{setEditingId(null); setIsModalOpen(true);}} 
          className="p-4 bg-slate-900 text-white rounded-full -mt-16 border-4 border-slate-50 shadow-2xl active:scale-90 transition-all flex items-center justify-center"
        >
          <Plus size={32} strokeWidth={3}/>
        </button>
      </div>

      {/* --- ALL MODALS (Synced UI) --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all animate-in fade-in duration-300">
           <div className="bg-white rounded-[3.5rem] w-full max-w-xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col p-8 md:p-12 border border-slate-100 font-black uppercase">
              <div className="flex justify-between items-center mb-10 px-2">
                <div>
                  <h3 className="text-3xl text-slate-800 tracking-tighter">New Entry</h3>
                  <p className="text-slate-400 text-[10px] tracking-widest mt-2 uppercase font-black">Secure Cloud Transaction</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-4 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-3xl transition-all"><X size={24}/></button>
              </div>
              <form onSubmit={handleTransaction} className="space-y-6 overflow-y-auto px-2 custom-scrollbar pr-4 pb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] text-slate-400 tracking-widest ml-2 font-black uppercase">Date</label>
                    <input type="date" required value={formData.date} onChange={e=>setFormData({...formData, date:e.target.value})} className="w-full bg-slate-50 border-2 border-transparent p-5 rounded-2xl text-xs font-black outline-none focus:bg-white focus:border-indigo-500 transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-indigo-500 tracking-widest ml-2 font-black uppercase">Type</label>
                    <select value={formData.type} onChange={e=>setFormData({...formData, type:e.target.value, linkedId:''})} className="w-full bg-slate-50 border-2 border-transparent p-5 rounded-2xl text-xs font-black outline-none focus:bg-white focus:border-indigo-500 transition-all">
                      <option value="Expense">Expense (-)</option>
                      <option value="Income">Income (+)</option>
                      <option value="EMI_Payment">EMI Payment</option>
                      <option value="Goal_Deposit">Goal Saving</option>
                    </select>
                  </div>
                </div>
                <input list="cats" required value={formData.category} onChange={e=>setFormData({...formData, category:e.target.value})} placeholder="Main Category" className="w-full bg-slate-50 border-2 border-transparent p-5 rounded-2xl text-xs font-black outline-none focus:bg-white focus:border-indigo-500 transition-all" />
                <input required value={formData.subcategory} onChange={e=>setFormData({...formData, subcategory:e.target.value})} placeholder="Transaction Details" className="w-full bg-slate-50 border-2 border-transparent p-5 rounded-2xl text-xs font-black outline-none focus:bg-white focus:border-indigo-500 transition-all" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <input list="accs" required value={formData.account} onChange={e=>setFormData({...formData, account:e.target.value})} placeholder="Account (Cash/Bank)" className="w-full bg-slate-50 border-2 border-transparent p-5 rounded-2xl text-xs font-black outline-none focus:bg-white focus:border-indigo-500 transition-all" />
                  <input type="number" required value={formData.amount} onChange={e=>setFormData({...formData, amount:e.target.value})} placeholder="Amount ₹" className="w-full bg-slate-50 border-2 border-transparent p-5 rounded-2xl text-xl font-black outline-none focus:bg-white focus:border-indigo-500 transition-all" />
                </div>
                <button type="submit" className="w-full bg-slate-900 text-white p-6 rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl hover:bg-slate-800 active:scale-95 transition-all mt-6">Save Transaction</button>
              </form>
           </div>
        </div>
      )}

      {/* MASTER RECORD MODAL */}
      {isDebtModalOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-[3.5rem] w-full max-w-md p-10 shadow-2xl border border-slate-100 font-black uppercase">
            <h3 className="text-3xl text-slate-800 tracking-tighter mb-10 px-2 uppercase">Master Hisab</h3>
            <form onSubmit={handleDebt} className="space-y-6">
              <input required value={debtFormData.name} onChange={e=>setDebtFormData({...debtFormData, name:e.target.value})} placeholder="Person Name" className="w-full bg-slate-50 border-2 border-transparent p-5 rounded-2xl text-xs font-black outline-none focus:bg-white focus:border-indigo-500 transition-all" />
              <select value={debtFormData.type} onChange={e=>setDebtFormData({...debtFormData, type:e.target.value})} className="w-full bg-slate-50 border-2 border-transparent p-5 rounded-2xl text-xs font-black outline-none focus:bg-white focus:border-indigo-500 transition-all">
                <option value="Given">Given (To Get)</option>
                <option value="Taken">Taken (To Pay)</option>
              </select>
              <div className="grid grid-cols-2 gap-4">
                <input type="number" required value={debtFormData.total} onChange={e=>setDebtFormData({...debtFormData, total:e.target.value})} placeholder="Amount ₹" className="w-full bg-slate-50 border-2 border-transparent p-5 rounded-2xl text-xs font-black outline-none focus:bg-white focus:border-indigo-500 transition-all" />
                <input type="date" required value={debtFormData.dueDate} onChange={e=>setDebtFormData({...debtFormData, dueDate:e.target.value})} className="w-full bg-slate-50 border-2 border-transparent p-5 rounded-2xl text-xs font-black outline-none focus:bg-white focus:border-indigo-500 transition-all" />
              </div>
              <div className="flex gap-4 mt-10">
                <button type="button" onClick={()=>setIsDebtModalOpen(false)} className="flex-1 bg-slate-100 text-slate-600 p-5 rounded-2xl font-black text-xs tracking-widest hover:bg-slate-200 transition-all">Back</button>
                <button type="submit" className="flex-1 bg-slate-900 text-white p-5 rounded-2xl font-black text-xs tracking-widest shadow-xl hover:bg-slate-800 transition-all">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* GOAL MODAL */}
      {isGoalModalOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-[3.5rem] w-full max-w-md p-10 shadow-2xl border border-slate-100 font-black uppercase">
            <h3 className="text-3xl text-slate-800 tracking-tighter mb-10 px-2 uppercase">New Goal</h3>
            <form onSubmit={handleGoal} className="space-y-6">
              <input required value={goalFormData.name} onChange={e=>setGoalFormData({...goalFormData, name:e.target.value})} placeholder="Goal Name" className="w-full bg-slate-50 border-2 border-transparent p-5 rounded-2xl text-xs font-black outline-none focus:bg-white focus:border-indigo-500 transition-all" />
              <div className="grid grid-cols-2 gap-4">
                <input type="number" required value={goalFormData.target} onChange={e=>setGoalFormData({...goalFormData, target:e.target.value})} placeholder="Target ₹" className="w-full bg-slate-50 border-2 border-transparent p-5 rounded-2xl text-xs font-black outline-none focus:bg-white focus:border-indigo-500 transition-all" />
                <input type="date" required value={goalFormData.targetDate} onChange={e=>setGoalFormData({...goalFormData, targetDate:e.target.value})} className="w-full bg-slate-50 border-2 border-transparent p-5 rounded-2xl text-xs font-black outline-none focus:bg-white focus:border-indigo-500 transition-all" />
              </div>
              <div className="flex gap-4 mt-10">
                <button type="button" onClick={()=>{setIsGoalModalOpen(false); setEditingGoalId(null);}} className="flex-1 bg-slate-100 text-slate-600 p-5 rounded-2xl font-black text-xs tracking-widest hover:bg-slate-200 transition-all">Back</button>
                <button type="submit" className="flex-1 bg-indigo-600 text-white p-5 rounded-2xl font-black text-xs tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">Set Goal</button>
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
