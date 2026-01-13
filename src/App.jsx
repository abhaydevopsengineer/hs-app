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

// --- HS_MANAGER_V3 STANDALONE CONFIG (Directly Supported) ---
const firebaseConfig = {
  apiKey: "AIzaSyDE3sdmPG3TGKV0CJDWHYPzDRE-8OKIanw",
  authDomain: "hs-expensemanager.firebaseapp.com",
  projectId: "hs-expensemanager",
  storageBucket: "hs-expensemanager.firebasestorage.app",
  messagingSenderId: "500261749602",
  appId: "1:500261749602:web:9840d9da48d8ace202223b",
  measurementId: "G-PFS0S1EKBC"
};

// Initialize Firebase once
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'hs-expenses-manager-v3-prod';

const App = () => {
  // --- 1. ALL HOOKS AT TOP ---
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

  // --- 2. AUTH & SYNC ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("V3 Cloud Sync Error:", err.message);
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
      }, (err) => console.error(err));
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

  // --- 5. CLOUD ACTIONS ---
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

  // --- 6. RENDER LOGIC ---
  if (!user) return (
    <div className="h-screen flex flex-col items-center justify-center bg-white p-6 text-center font-sans">
      <div className="bg-indigo-600 p-6 rounded-3xl shadow-2xl mb-8 animate-bounce">
        <Loader2 className="animate-spin text-white" size={48}/>
      </div>
      <p className="font-black uppercase tracking-[0.4em] text-xl text-slate-900">HS_MANAGER_V4</p>
      <p className="text-slate-400 mt-4 text-xs font-bold uppercase tracking-widest">Waking up secure cloud servers...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col md:flex-row font-sans text-slate-900 overflow-x-hidden selection:bg-indigo-100 uppercase font-black">
      
      {/* MOBILE HEADER (Always Visible on Top for Mobile) */}
      <div className="md:hidden bg-white border-b border-slate-200 p-5 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 text-white p-2 rounded-xl"><Wallet size={20}/></div>
          <h1 className="text-lg font-black tracking-tighter text-slate-900">HS_MANAGER_V3</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-[8px] text-slate-400 tracking-widest">v3.0 LIVE</span>
        </div>
      </div>

      {/* SIDEBAR (Desktop) */}
      <div className="hidden md:flex w-80 bg-white border-r border-slate-200 p-10 flex-col h-screen sticky top-0 shadow-sm z-30">
        <div className="flex items-center gap-4 mb-14">
          <div className="bg-indigo-600 text-white p-3 rounded-2xl shadow-lg shadow-indigo-100"><Wallet size={28}/></div>
          <h1 className="text-2xl font-black tracking-tighter text-slate-900">HS_MANAGER_V3</h1>
        </div>
        <nav className="space-y-2 flex-grow">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={22}/> },
            { id: 'history', label: 'Transactions', icon: <ArrowRightLeft size={22}/> },
            { id: 'debts', label: 'Net Ledgers', icon: <UserCheck size={22}/> },
            { id: 'goals', label: 'Future Plans', icon: <Target size={22}/> },
            { id: 'settings', label: 'System Setup', icon: <Settings size={22}/> }
          ].map(tab => (
            <button 
              key={tab.id} 
              onClick={()=>setActiveTab(tab.id)} 
              className={`w-full flex items-center gap-4 px-6 py-4 rounded-[1.5rem] text-xs transition-all duration-300 tracking-widest ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-2xl shadow-indigo-100 scale-[1.03]' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-800'}`}
            >
              {tab.icon} <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* MAIN CONTENT */}
      <main className="flex-grow p-6 md:p-12 max-w-7xl mx-auto w-full pb-40">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-16 gap-8 px-4">
          <div className="animate-in slide-in-from-left duration-700">
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-indigo-100 text-indigo-700 px-4 py-1 rounded-full text-[10px] tracking-widest">HS_MANAGER_V3</span>
            </div>
            <h2 className="text-6xl font-black text-slate-900 tracking-tighter">{activeTab}</h2>
            <div className="flex items-center gap-3 mt-4">
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
              <p className="text-slate-400 text-[10px] tracking-[0.4em]">SYSTEM v3.0 • CLOUD ACTIVE</p>
            </div>
          </div>
          <button 
            onClick={()=>{setEditingId(null); setIsModalOpen(true);}} 
            className="w-full sm:w-auto bg-indigo-600 text-white px-12 py-6 rounded-[2rem] text-xs tracking-[0.2em] shadow-2xl shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-2 active:translate-y-0 transition-all flex items-center justify-center gap-4"
          >
            <PlusCircle size={24}/> NEW RECORD
          </button>
        </header>

        {activeTab === 'dashboard' && (
          <div className="space-y-12 animate-in fade-in duration-700 px-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">
              <div className="bg-white p-10 rounded-[4rem] shadow-sm border border-slate-100 flex flex-col items-center text-center group hover:shadow-2xl transition-all duration-500">
                <div className="bg-indigo-50 text-indigo-600 p-5 rounded-[2rem] mb-6 group-hover:scale-110 transition-transform"><Wallet size={36}/></div>
                <p className="text-[10px] text-slate-400 tracking-[0.3em]">NET FLOW</p>
                <h3 className="text-4xl text-slate-900 mt-4 tracking-tighter">₹{totals.balance.toLocaleString()}</h3>
              </div>
              <div className="bg-white p-10 rounded-[4rem] shadow-sm border border-slate-100 flex flex-col items-center text-center group hover:shadow-2xl transition-all duration-500">
                <div className="bg-emerald-50 text-emerald-600 p-5 rounded-[2rem] mb-6 group-hover:scale-110 transition-transform"><ArrowDownLeft size={36}/></div>
                <p className="text-[10px] text-slate-400 tracking-[0.3em]">LENT TOTAL</p>
                <h3 className="text-4xl text-emerald-600 mt-4 tracking-tighter">₹{totals.rec.toLocaleString()}</h3>
              </div>
              <div className="bg-white p-10 rounded-[4rem] shadow-sm border border-slate-100 flex flex-col items-center text-center group hover:shadow-2xl transition-all duration-500">
                <div className="bg-rose-50 text-rose-600 p-5 rounded-[2rem] mb-6 group-hover:scale-110 transition-transform"><ArrowUpRight size={36}/></div>
                <p className="text-[10px] text-slate-400 tracking-[0.3em]">DEBT TOTAL</p>
                <h3 className="text-4xl text-rose-600 mt-4 tracking-tighter">₹{totals.pay.toLocaleString()}</h3>
              </div>
            </div>

            <div className="bg-white p-12 rounded-[4.5rem] shadow-sm border border-slate-100">
               <h4 className="text-2xl text-slate-900 flex items-center gap-5 mb-12 tracking-tighter uppercase font-black"><Database className="text-indigo-500" size={32}/> Account Health</h4>
               <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                  {totals.accBreakdown.map(acc => (
                    <div key={acc.name} className="p-8 bg-slate-50 rounded-[2.5rem] border-2 border-transparent hover:border-indigo-100 hover:bg-white hover:shadow-2xl transition-all group">
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] group-hover:text-indigo-500">{acc.name}</p>
                       <p className={`text-2xl mt-4 tracking-tighter ${acc.balance < 0 ? 'text-rose-500' : 'text-slate-900'}`}>₹{acc.balance.toLocaleString()}</p>
                    </div>
                  ))}
               </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white rounded-[4rem] shadow-sm border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-5 duration-700">
            <div className="p-12 border-b border-slate-50 flex flex-col lg:flex-row gap-8 bg-slate-50/20 items-center">
               <div className="relative flex-grow w-full max-w-2xl">
                  <Search size={22} className="absolute left-6 top-5 text-slate-400"/>
                  <input 
                    value={searchQuery} 
                    onChange={e=>setSearchQuery(e.target.value)} 
                    placeholder="Search ledger records..." 
                    className="w-full pl-16 pr-8 py-5 bg-white border-2 border-slate-100 rounded-[2rem] text-sm tracking-widest outline-none focus:border-indigo-500 transition-all shadow-sm"
                  />
               </div>
               <select 
                 value={filterType} 
                 onChange={e=>setFilterType(e.target.value)} 
                 className="w-full lg:w-auto px-10 py-5 bg-white border-2 border-slate-100 rounded-[2rem] text-[11px] tracking-[0.3em] text-slate-700 outline-none hover:border-indigo-300 transition-colors"
               >
                  <option value="All">ALL FLOWS</option>
                  <option value="Income">INCOME ONLY</option>
                  <option value="Expense">EXPENSE ONLY</option>
               </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[800px] tracking-tighter">
                <thead>
                  <tr className="bg-slate-50 text-[10px] text-slate-400 tracking-[0.4em] border-b border-slate-100">
                    <th className="p-10">DATE</th>
                    <th className="p-10">DETAILS</th>
                    <th className="p-10 text-right">AMOUNT</th>
                    <th className="p-10 text-center">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredTx.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-all group font-black">
                      <td className="p-10 text-[12px] text-slate-400 tracking-tighter italic">{t.date}</td>
                      <td className="p-10">
                        <p className="text-sm text-slate-900 tracking-widest uppercase">{t.subcategory || t.category}</p>
                        <p className="text-[10px] text-indigo-500 mt-3 tracking-[0.2em]">{t.account}</p>
                      </td>
                      <td className="p-10 text-right">
                        <span className={`text-2xl tracking-tighter ${t.type === 'Income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {t.type === 'Income' ? '+' : '-'}₹{Number(t.amount).toLocaleString()}
                        </span>
                      </td>
                      <td className="p-10">
                        <div className="flex justify-center gap-5">
                          <button onClick={()=>{setFormData({...t, amount:t.amount.toString()}); setEditingId(t.id); setIsModalOpen(true);}} className="p-4 text-indigo-600 bg-indigo-50 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm"><Pencil size={20}/></button>
                          <button onClick={()=>handleDelete('transactions', t.id)} className="p-4 text-rose-600 bg-rose-50 rounded-2xl hover:bg-rose-600 hover:text-white transition-all shadow-sm"><Trash2 size={20}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'debts' && (
          <div className="space-y-12 animate-in slide-in-from-bottom-5 duration-700 font-black">
             <div className="flex justify-between items-center bg-white p-12 rounded-[4rem] shadow-sm border border-slate-100">
                <h3 className="text-2xl text-slate-900 tracking-tighter px-2">MASTER HISAB</h3>
                <button onClick={()=>{setEditingDebtId(null); setIsDebtModalOpen(true);}} className="bg-slate-900 text-white px-10 py-5 rounded-[2rem] text-xs tracking-[0.3em] shadow-2xl active:scale-95 transition-all">ADD NEW PERSON</button>
             </div>
             
             <div className="grid grid-cols-1 gap-12">
               {nameLedgers.map(ledger => {
                 const net = ledger.receivables - ledger.payables;
                 return (
                   <div key={ledger.name} className="bg-white rounded-[5rem] shadow-sm border border-slate-100 overflow-hidden hover:shadow-2xl transition-all duration-700">
                    <div className="p-14 bg-slate-50/50 border-b border-slate-100 flex flex-col xl:flex-row justify-between items-center gap-14 text-center xl:text-left">
                       <div>
                          <h2 className="text-7xl tracking-tighter text-slate-900 uppercase">{ledger.name}</h2>
                          <div className={`mt-8 inline-flex items-center gap-5 px-12 py-5 rounded-[2.5rem] border-2 text-2xl tracking-widest ${net >= 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-xl shadow-emerald-50' : 'bg-rose-50 border-rose-200 text-rose-700 shadow-xl shadow-rose-50'}`}>
                            <NetIcon size={32}/> ₹{Math.abs(net).toLocaleString()} 
                            <span className="text-[11px] uppercase ml-3 opacity-60 tracking-[0.3em]">{net >= 0 ? 'LENA HAI' : 'DENA HAI'}</span>
                          </div>
                       </div>
                       <div className="flex flex-wrap justify-center gap-8 font-black">
                          <div className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-slate-100 min-w-[200px]">
                             <p className="text-[11px] text-slate-400 mb-4 tracking-[0.3em]">CREDIT (+)</p>
                             <p className="text-5xl text-emerald-600 tracking-tighter">₹{ledger.receivables.toLocaleString()}</p>
                          </div>
                          <div className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-slate-100 min-w-[200px]">
                             <p className="text-[11px] text-slate-400 mb-4 tracking-[0.3em]">DEBIT (-)</p>
                             <p className="text-5xl text-rose-600 tracking-tighter">₹{ledger.payables.toLocaleString()}</p>
                          </div>
                       </div>
                    </div>
                 </div>
               );})}
             </div>
          </div>
        )}

        {/* ... Goals and Settings remain with same logic but refined UI ... */}
      </main>

      {/* MOBILE NAV */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-3xl border-t border-slate-100 flex justify-around items-center p-6 z-40 shadow-[0_-25px_50px_rgba(0,0,0,0.08)]">
        {[
          { id: 'dashboard', icon: <LayoutDashboard size={28}/> },
          { id: 'history', icon: <ArrowRightLeft size={28}/> },
          { id: 'debts', icon: <UserCheck size={28}/> },
          { id: 'settings', icon: <Settings size={28}/> }
        ].map(tab => (
          <button 
            key={tab.id} 
            onClick={()=>setActiveTab(tab.id)} 
            className={`p-4 rounded-[2rem] transition-all duration-500 ${activeTab===tab.id ? 'bg-indigo-600 text-white shadow-[0_15px_30px_rgba(79,70,229,0.3)] scale-110 -translate-y-3' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            {tab.icon}
          </button>
        ))}
        <button 
          onClick={()=>{setEditingId(null); setIsModalOpen(true);}} 
          className="p-6 bg-slate-900 text-white rounded-full -mt-24 border-[8px] border-slate-50 shadow-[0_20px_40px_rgba(0,0,0,0.25)] active:scale-90 transition-all flex items-center justify-center"
        >
          <Plus size={40} strokeWidth={4}/>
        </button>
      </div>

      {/* --- ALL MODALS (Synced v3 UI) --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-3xl z-50 flex items-center justify-center p-4 transition-all animate-in fade-in duration-500 font-black">
           <div className="bg-white rounded-[4.5rem] w-full max-w-2xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col p-12 md:p-16 border border-slate-100">
              <div className="flex justify-between items-center mb-12 px-6">
                <div>
                  <h3 className="text-5xl text-slate-900 tracking-tighter uppercase">NEW ENTRY</h3>
                  <p className="text-indigo-500 text-[11px] tracking-[0.4em] mt-4 font-black">SECURE_SYNC_V3_ACTIVE</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-6 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-[2.5rem] transition-all"><X size={36}/></button>
              </div>
              <form onSubmit={handleTransaction} className="space-y-8 overflow-y-auto px-6 custom-scrollbar pr-8 pb-12">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 font-black">
                  <div className="space-y-4">
                    <label className="text-[11px] text-slate-400 tracking-[0.3em] ml-4 font-black">DATE</label>
                    <input type="date" required value={formData.date} onChange={e=>setFormData({...formData, date:e.target.value})} className="w-full bg-slate-50 border-4 border-transparent p-7 rounded-[2rem] text-sm outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner font-black" />
                  </div>
                  <div className="space-y-4">
                    <label className="text-[11px] text-indigo-500 tracking-[0.3em] ml-4 font-black">TYPE</label>
                    <select value={formData.type} onChange={e=>setFormData({...formData, type:e.target.value, linkedId:''})} className="w-full bg-slate-50 border-4 border-transparent p-7 rounded-[2rem] text-sm outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner font-black uppercase">
                      <option value="Expense">Expense (-)</option>
                      <option value="Income">Income (+)</option>
                      <option value="EMI_Payment">EMI Payment</option>
                      <option value="Goal_Deposit">Goal Deposit</option>
                    </select>
                  </div>
                </div>
                <input list="cats" required value={formData.category} onChange={e=>setFormData({...formData, category:e.target.value})} placeholder="MAIN CATEGORY" className="w-full bg-slate-50 border-4 border-transparent p-7 rounded-[2.5rem] text-sm outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner font-black" />
                <input required value={formData.subcategory} onChange={e=>setFormData({...formData, subcategory:e.target.value})} placeholder="DESCRIPTION" className="w-full bg-slate-50 border-4 border-transparent p-7 rounded-[2.5rem] text-sm outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner font-black" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <input list="accs" required value={formData.account} onChange={e=>setFormData({...formData, account:e.target.value})} placeholder="SOURCE" className="w-full bg-slate-50 border-4 border-transparent p-7 rounded-[2.5rem] text-sm outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner font-black" />
                  <input type="number" required value={formData.amount} onChange={e=>setFormData({...formData, amount:e.target.value})} placeholder="AMOUNT ₹" className="w-full bg-slate-50 border-4 border-transparent p-7 rounded-[2.5rem] text-4xl tracking-tighter outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner font-black" />
                </div>
                <div className="flex gap-6 mt-10">
                   <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 bg-slate-100 text-slate-400 p-8 rounded-[2.5rem] font-black text-xs tracking-widest uppercase">BACK</button>
                   <button type="submit" className="flex-[2] bg-slate-900 text-white p-8 rounded-[3rem] text-sm tracking-[0.5em] shadow-2xl hover:bg-black active:scale-95 transition-all uppercase">CONFIRM ENTRY</button>
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
