import React, { useState, useMemo, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, deleteDoc, collection, onSnapshot } from 'firebase/firestore';
import { 
  LayoutDashboard, ArrowRightLeft, UserCheck, Target, Plus, Search, X, 
  FileSpreadsheet, Settings, Trash2, Pencil, Wallet, PlusCircle, 
  CheckCircle2, Loader2, Cloud, Banknote, History, 
  ArrowRightLeft as NetIcon, ArrowDownLeft, ArrowUpRight, Database, 
  Clock, CalendarDays, BellRing, TrendingUp, CreditCard as CardIcon, FileText 
} from 'lucide-react';

// --- PRODUCTION FIREBASE CONFIG ---
// Bhai, yahan apne GitHub wale firebase.js se details copy karke paste karein
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'hs-expenses-manager-pro';

const App = () => {
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
  
  const [transactions, setTransactions] = useState([]);
  const [debts, setDebts] = useState([]);
  const [goals, setGoals] = useState([]);
  const [accountRecords, setAccountRecords] = useState([]);

  const defaultCategories = ['Salary', 'Rent', 'Grocery', 'Investment', 'Fuel', 'Shopping', 'Medical', 'Insurance', 'EMI', 'LIC', 'Policy', 'Transfer'];
  const defaultSubcategories = ['Monthly Pay', 'Milk', 'Petrol', 'Electricity', 'LIC Premium', 'HDFC EMI', 'Home Savings', 'Internal Transfer'];
  
  const [categories, setCategories] = useState(defaultCategories);
  const [subcategories, setSubcategories] = useState(defaultSubcategories);
  const accounts = ['Bank', 'Cash', 'Credit Card', 'UPI', 'Wallet'];
  const entryTypes = ['Expense', 'Income', 'EMI_Payment', 'Goal_Deposit', 'Insurance_Premium', 'Investment', 'Balance_Transfer'];

  // --- AUTH & DATA SYNC ---
  useEffect(() => {
    const initAuth = async () => {
      // Production mein hamesha anonymous sign-in use karenge
      await signInAnonymously(auth);
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const sync = (collName, setter) => {
      const q = collection(db, 'artifacts', appId, 'users', user.uid, collName);
      return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        setter(data);
      }, (error) => console.error(`Sync error (${collName}):`, error));
    };
    const unsubTx = sync('transactions', setTransactions);
    const unsubDebt = sync('debts', setDebts);
    const unsubGoal = sync('goals', setGoals);
    const unsubAcc = sync('accountRecords', setAccountRecords);
    
    return () => { unsubTx(); unsubDebt(); unsubGoal(); unsubAcc(); };
  }, [user]);

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
       const inc = transactions.filter(t => (t.account === acc && t.type === 'Income') || (t.toAccount === acc && t.type === 'Balance_Transfer')).reduce((a,c) => a + Number(c.amount), 0);
       const exp = transactions.filter(t => (t.account === acc && (t.type !== 'Income' && t.type !== 'Balance_Transfer')) || (t.account === acc && t.type === 'Balance_Transfer')).reduce((a,c) => a + Number(c.amount), 0);
       return { name: acc, balance: op + inc - exp };
    });
    return { balance: openingBal + income - expense, rec, pay, accBreakdown };
  }, [transactions, debts, accountRecords]);

  const nameLedgers = useMemo(() => {
    const map = {};
    debts.forEach(d => {
      const normKey = d.name.trim().toLowerCase();
      if (!map[normKey]) map[normKey] = { name: d.name.trim(), receivables: 0, payables: 0, records: [], linkedTx: [] };
      const bal = Number(d.total) - Number(d.paid);
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
      const remaining = Number(g.target) - Number(g.current);
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

  // --- FORMS ---
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
    if(editingId) { setIsModalOpen(false); setEditingId(null); }
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

  if (!user) return <div className="h-screen flex items-center justify-center bg-[#F8F9FA] text-black font-black uppercase tracking-widest text-xs"><Loader2 className="animate-spin mr-3"/> Connecting Cloud...</div>;

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
      </div>

      {/* MAIN CONTENT */}
      <main className="flex-grow p-4 md:p-10 max-w-7xl mx-auto w-full pb-32">
        <header className="flex justify-between items-start mb-10">
          <div>
            <h2 className="text-4xl font-black tracking-tighter uppercase">{activeTab} View</h2>
            <p className="text-gray-400 text-[10px] font-black tracking-widest mt-1">HS_MANAGER LIVE PRO</p>
          </div>
          <button onClick={()=>{setEditingId(null); setIsModalOpen(true);}} className="bg-black text-white px-8 py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-2xl active:scale-95 transition-all flex items-center gap-3">
            <PlusCircle size={18}/> Quick Entry
          </button>
        </header>

        {/* DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-10 animate-in fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-black uppercase">
              <div className="bg-white p-8 rounded-[2.5rem] border-l-[12px] border-blue-500 shadow-sm transition-all hover:scale-[1.02]">
                <span className="text-[10px] text-gray-300">Net Saving</span>
                <h3 className="text-3xl mt-2">₹{totals.balance.toLocaleString()}</h3>
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

            <div className="bg-white p-8 rounded-[3.5rem] border shadow-sm">
               <h4 className="font-black text-xl uppercase mb-6 flex items-center gap-3 tracking-tighter"><Database className="text-orange-500" size={24}/> Account Status</h4>
               <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {totals.accBreakdown.map(acc => (
                    <div key={acc.name} className="p-4 bg-gray-50 rounded-2xl border-2 border-transparent hover:border-black transition-all group font-black uppercase">
                       <p className="text-[10px] text-gray-400">{acc.name}</p>
                       <p className={`text-xl mt-1 ${acc.balance < 0 ? 'text-red-500' : 'text-gray-900'}`}>₹{acc.balance.toLocaleString()}</p>
                    </div>
                  ))}
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               <div className="bg-white p-10 rounded-[3rem] border shadow-sm border-t-[12px] border-t-red-500">
                  <h4 className="font-black text-xl uppercase mb-6 flex items-center gap-3 tracking-tighter"><BellRing className="text-red-500" size={22}/> Active Loans</h4>
                  <div className="space-y-4">
                    {debts.filter(d => d.type === 'Taken' && (d.total - d.paid) > 0).map(d => (
                      <div key={d.id} className="p-4 border-b flex justify-between items-center group hover:bg-gray-50 rounded-xl transition-all font-black uppercase">
                        <div><p className="text-xs">{d.name}</p><p className="text-[9px] text-gray-400 mt-1">Due: {d.dueDate}</p></div>
                        <p className="text-sm text-red-600">₹{(Number(d.total) - Number(d.paid)).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
               </div>
               <div className="bg-white p-10 rounded-[3rem] border shadow-sm border-t-[12px] border-t-purple-500">
                  <h4 className="font-black text-xl uppercase mb-6 flex items-center gap-3 tracking-tighter"><TrendingUp className="text-purple-500" size={22}/> Goal Planner</h4>
                  <div className="space-y-4">
                    {goalReport.map(g => (
                      <div key={g.id} className="p-4 bg-gray-50 rounded-2xl flex justify-between items-center transition-all border-2 border-transparent hover:border-purple-100 group font-black uppercase">
                        <div><p className="text-[10px]">{g.name}</p><p className="text-[8px] text-purple-400">{g.diffMonths} Months Left</p></div>
                        <div className="text-right"><p className="text-sm text-purple-600">₹{g.monthlyRequired.toLocaleString()}</p><p className="text-[8px] text-gray-400">Monthly Target</p></div>
                      </div>
                    ))}
                  </div>
               </div>
            </div>
          </div>
        )}

        {/* HISTORY */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-[3rem] border shadow-sm overflow-hidden animate-in slide-in-from-bottom-5">
            <div className="p-8 border-b flex flex-col md:flex-row gap-4 bg-gray-50/30 font-black uppercase">
               <div className="relative flex-grow max-w-xl w-full">
                  <Search size={16} className="absolute left-4 top-3.5 text-gray-300"/><input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Search Ledger..." className="w-full pl-12 border-none bg-white rounded-2xl text-xs font-bold shadow-sm py-3 outline-none focus:ring-1 focus:ring-black"/>
               </div>
               <select value={filterType} onChange={e=>setFilterType(e.target.value)} className="rounded-2xl px-6 py-3 text-xs bg-white border font-black outline-none transition-all hover:bg-gray-100"><option value="All">All Transactions</option><option value="Income">Income</option><option value="Expense">Expense</option><option value="EMI_Payment">EMI</option></select>
            </div>
            <div className="overflow-x-auto"><table className="w-full text-left font-black uppercase tracking-tighter"><thead className="bg-gray-50 text-[9px] text-gray-400 border-b"><tr><th className="p-5">Timeline</th><th className="p-5">Details</th><th className="p-5 text-right">Amount</th><th className="p-5 text-center">Action</th></tr></thead><tbody className="divide-y text-xs">{filteredTx.map(t => (<tr key={t.id} className="hover:bg-gray-50 transition-all font-black"><td className="p-5 text-gray-400 text-xs">{t.date}</td><td className="p-5"><p className="text-xs text-gray-900">{t.subcategory || t.category}</p><p className="text-[9px] text-gray-400 italic">{t.account} • {t.status}</p></td><td className={`p-5 text-sm text-right ${t.type==='Income'?'text-green-600':'text-red-600'}`}>₹{Number(t.amount).toLocaleString()}</td><td className="p-5 flex justify-center gap-2"><button onClick={()=>{setFormData({...t, amount:t.amount.toString()}); setEditingId(t.id); setIsModalOpen(true);}} className="p-2 text-blue-500"><Pencil size={14}/></button><button onClick={()=>handleDelete('transactions', t.id)} className="p-2 text-red-400"><Trash2 size={14}/></button></td></tr>))}</tbody></table></div>
          </div>
        )}

        {/* DEBTS */}
        {activeTab === 'debts' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-5">
             <div className="flex justify-between items-center bg-white p-8 rounded-[2.5rem] border shadow-sm">
                <h3 className="font-black text-xl uppercase tracking-tighter">Net Ledgers</h3>
                <button onClick={()=>{setEditingDebtId(null); setIsDebtModalOpen(true);}} className="bg-black text-white px-10 py-4 rounded-3xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all">New Entry</button>
             </div>
             <div className="space-y-12">
               {nameLedgers.map(ledger => {
                 const net = ledger.receivables - ledger.payables;
                 return (
                   <div key={ledger.name} className="bg-white rounded-[3.5rem] border shadow-md overflow-hidden transition-all hover:shadow-2xl font-black uppercase">
                    <div className="p-10 border-b bg-gray-50/50 flex flex-col md:flex-row justify-between items-center gap-6">
                       <div><h2 className="text-4xl tracking-tighter">{ledger.name}</h2><div className={`mt-3 flex items-center gap-3 px-6 py-3 rounded-2xl border-2 text-lg ${net >= 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}><NetIcon size={20}/> Net: ₹{Math.abs(net).toLocaleString()} <span>{net >= 0 ? '(Lena Hai)' : '(Dena Hai)'}</span></div></div>
                    </div>
                    <div className="p-10 grid grid-cols-1 lg:grid-cols-2 gap-10">
                       <div><h4 className="text-xs text-gray-400 tracking-[0.2em] mb-4">Activity history</h4><div className="space-y-3 max-h-[350px] overflow-y-auto pr-3">{ledger.linkedTx.map(t => (<div key={t.id} className="flex justify-between items-center p-4 border shadow-sm bg-white rounded-2xl transition-all font-black"><div className="flex items-center gap-3"><div className={`p-2 rounded-lg ${t.type === 'Income' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}><Banknote size={14}/></div><div><p className="text-[10px]">{t.date}</p><p className="text-[9px] text-gray-400">{t.account}</p></div></div><p className={`text-sm ${t.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>{t.type === 'Income' ? '+' : '-'} ₹{t.amount.toLocaleString()}</p></div>))}</div></div>
                    </div>
                 </div>
               );})}
             </div>
          </div>
        )}

        {/* GOALS */}
        {activeTab === 'goals' && (
          <div className="space-y-10 animate-in slide-in-from-bottom-5">
            <div className="flex justify-between items-center bg-white p-8 rounded-[2.5rem] border shadow-sm transition-all hover:shadow-md">
               <h3 className="font-black text-xl uppercase tracking-tighter">Savings Goals</h3>
               <button onClick={()=>setIsGoalModalOpen(true)} className="bg-black text-white px-10 py-4 rounded-3xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all"><PlusCircle size={18} className="inline mr-2"/> Setup New Goal</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {goalReport.map(g => (
                <div key={g.id} className="bg-white p-10 rounded-[3rem] border shadow-lg group relative overflow-hidden transition-all hover:shadow-2xl font-black uppercase">
                   <div className="absolute top-8 right-8 flex gap-2 opacity-0 group-hover:opacity-100 transition-all"><button onClick={()=>{setGoalFormData(g); setEditingGoalId(g.id); setIsGoalModalOpen(true);}} className="text-blue-500"><Pencil size={18}/></button><button onClick={()=>handleDelete('goals', g.id)} className="text-red-500"><Trash2 size={18}/></button></div>
                   <h3 className="text-3xl tracking-tighter">{g.name}</h3><p className="text-xs text-purple-500 mt-1">Date: {g.targetDate}</p>
                   <div className="text-right mt-4"><p className="text-3xl text-blue-600">{Math.round((Number(g.current)/Number(g.target))*100)}%</p><p className="text-[10px] text-gray-300">Achieved</p></div>
                   <div className="w-full bg-gray-100 h-4 rounded-full overflow-hidden mt-4 border"><div className="bg-black h-full transition-all duration-1000" style={{width:`${Math.min((g.current/g.target)*100, 100)}%`}}></div></div>
                   <div className="mt-8 pt-6 border-t border-gray-100 grid grid-cols-2 gap-6">
                      <div className="text-center"><p className="text-[10px] text-gray-400">Monthly Saving</p><p className="text-xl text-purple-600">₹{g.monthlyRequired.toLocaleString()}</p></div>
                      <div className="text-center"><p className="text-[10px] text-gray-400">Remaining</p><p className="text-xl">₹{g.remaining.toLocaleString()}</p></div>
                   </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SETTINGS */}
        {activeTab === 'settings' && (
          <div className="max-w-3xl mx-auto animate-in zoom-in duration-300">
             <div className="bg-white p-10 rounded-[3rem] border shadow-sm">
                <h3 className="font-black text-2xl uppercase mb-8 flex items-center gap-3 text-gray-800"><Database size={24} className="text-orange-500"/> Account Setup</h3>
                <form onSubmit={async (e) => { e.preventDefault(); const name = e.target.accName.value; const bal = e.target.accBal.value; await saveToCloud('accountRecords', Date.now(), { name, balance: Number(bal) }); e.target.reset(); }} className="flex gap-3 mb-10"><input name="accName" required placeholder="Account Name" className="flex-[2] border-2 border-gray-100 bg-gray-50 p-4 rounded-2xl text-xs font-bold outline-none focus:border-black transition-all" /><input name="accBal" type="number" required placeholder="Opening Balance ₹" className="flex-1 border-2 border-gray-100 bg-gray-50 p-4 rounded-2xl text-xs font-bold outline-none focus:border-black transition-all" /><button type="submit" className="bg-black text-white px-8 rounded-2xl font-black uppercase text-[10px] active:scale-95 transition-all">Set</button></form>
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

      {/* MODAL WRAPPERS */}
      {isDebtModalOpen && (<div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm"><div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl"><h3 className="font-black text-xl uppercase mb-6">Master Record</h3><form onSubmit={handleDebt} className="space-y-5"><input required value={debtFormData.name} onChange={e=>setDebtFormData({...debtFormData, name:e.target.value})} placeholder="Name" className="w-full border-2 p-4 rounded-2xl font-black uppercase text-xs"/><select value={debtFormData.type} onChange={e=>setDebtFormData({...debtFormData, type:e.target.value})} className="w-full border-2 p-4 rounded-2xl font-black uppercase text-xs"><option value="Given">Lent (Receivable)</option><option value="Taken">Borrowed (Payable/EMI)</option><option value="Subscription">Subscription/LIC</option></select><input type="number" required value={debtFormData.total} onChange={e=>setDebtFormData({...debtFormData, total:e.target.value})} placeholder="Total ₹" className="w-full border-2 p-4 rounded-2xl font-black text-xs"/><input type="date" required value={debtFormData.dueDate} onChange={e=>setDebtFormData({...debtFormData, dueDate:e.target.value})} className="w-full border-2 p-4 rounded-2xl font-black text-xs"/><div className="flex gap-3"><button type="button" onClick={()=>setIsDebtModalOpen(false)} className="flex-1 bg-gray-100 p-4 rounded-2xl font-black uppercase text-xs">Back</button><button type="submit" className="flex-1 bg-black text-white p-4 rounded-2xl font-black uppercase text-xs">Save</button></div></form></div></div>)}
      {isGoalModalOpen && (<div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm"><div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl"><h3 className="font-black text-xl uppercase mb-6">Goal Setup</h3><form onSubmit={handleGoal} className="space-y-5"><input required value={goalFormData.name} onChange={e=>setGoalFormData({...goalFormData, name:e.target.value})} placeholder="Goal Name" className="w-full border-2 p-4 rounded-2xl font-black uppercase text-xs"/><input type="number" required value={goalFormData.target} onChange={e=>setGoalFormData({...goalFormData, target:e.target.value})} placeholder="Target ₹" className="w-full border-2 p-4 rounded-2xl font-black text-xs"/><input type="date" required value={goalFormData.targetDate} onChange={e=>setGoalFormData({...goalFormData, targetDate:e.target.value})} className="w-full border-2 p-4 rounded-2xl font-black text-xs"/><div className="flex gap-3"><button type="button" onClick={()=>{setIsGoalModalOpen(false); setEditingGoalId(null);}} className="flex-1 bg-gray-100 p-4 rounded-2xl font-black uppercase text-xs">Back</button><button type="submit" className="flex-1 bg-black text-white p-4 rounded-2xl font-black uppercase text-xs">Save</button></div></form></div></div>)}

      {/* DATALISTS */}
      <datalist id="accs">{accounts.map(a=><option key={a} value={a}/>)}</datalist>
      <datalist id="types">{entryTypes.map(t=><option key={t} value={t}/>)}</datalist>
      <datalist id="cats">{categories.map(c=><option key={c} value={c}/>)}</datalist>
      <datalist id="subs">{subcategories.map(s=><option key={s} value={s}/>)}</datalist>
    </div>
  );
};

export default App;
