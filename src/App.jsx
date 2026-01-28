// HS_Manager Smart Finance — FULL App.jsx (Quick Entry Restored Safely)
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, deleteDoc, collection, onSnapshot } from 'firebase/firestore';
import * as Icons from 'lucide-react';

// --- FIREBASE CONFIG ---
const firebaseConfig = {
  apiKey: "AIzaSyDE3sdmPG3TGKV0CJDWHYPzDRE-8OKIanw",
  authDomain: "hs-expensemanager.firebaseapp.com",
  projectId: "hs-expensemanager",
  storageBucket: "hs-expensemanager.firebasestorage.app",
  messagingSenderId: "500261749602",
  appId: "1:500261749602:web:9840d9da48d8ace202223b",
  measurementId: "G-PFS0S1EKBC",
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'hs-expenses-manager-v3-prod';

const App = () => {
  const restoreInputRef = useRef(null);

  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [transactions, setTransactions] = useState([]);
  const [emis, setEmis] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [goals, setGoals] = useState([]);

  const [categories, setCategories] = useState(() => JSON.parse(localStorage.getItem('hs_categories') || '[]'));
  const [subCategories, setSubCategories] = useState(() => JSON.parse(localStorage.getItem('hs_subcategories') || '[]'));
  const [accounts, setAccounts] = useState(() => JSON.parse(localStorage.getItem('hs_accounts') || '[]'));
  const [paymentDetails, setPaymentDetails] = useState(() => JSON.parse(localStorage.getItem('hs_payment_details') || '[]'));

  useEffect(() => {
    localStorage.setItem('hs_categories', JSON.stringify(categories));
    localStorage.setItem('hs_subcategories', JSON.stringify(subCategories));
    localStorage.setItem('hs_accounts', JSON.stringify(accounts));
    localStorage.setItem('hs_payment_details', JSON.stringify(paymentDetails));
  }, [categories, subCategories, accounts, paymentDetails]);

  const entryTypes = ['Expense', 'Income', 'EMI_Payment', 'Subscription_Payment', 'Goal_Deposit', 'Insurance_Premium', 'Investment', 'Balance_Transfer'];
  const statusOptions = ['Done', 'Hold', 'Lena Hai', 'Dena Hai'];

  const initialFormState = {
    date: new Date().toISOString().split('T')[0],
    type: 'Expense',
    category: '',
    subcategory: '',
    status: 'Done',
    amount: '',
    account: 'Bank',
    toAccount: '',
    paymentName: '',
    note: '',
    linkedId: '',
    linkedType: '',
    totalAmount: '',
    tenure: '',
    downPayment: '',
  };

  const [formData, setFormData] = useState(initialFormState);

  // --- AUTH ---
  useEffect(() => {
    const init = async () => { try { await signInAnonymously(auth); } catch(e){} };
    init();
    const unsub = onAuthStateChanged(auth, (u)=>setUser(u));
    return ()=>unsub();
  }, []);

  // --- FIRESTORE SYNC ---
  useEffect(() => {
    if(!user) return;
    const base = ['transactions','emis','subscriptions','goals'];
    const unsubs = base.map(col=>
      onSnapshot(collection(db,'artifacts',appId,'users',user.uid,col),(s)=>{
        const data = s.docs.map(d=>({...d.data(),id:d.id}));
        if(col==='transactions') setTransactions(data);
        if(col==='emis') setEmis(data);
        if(col==='subscriptions') setSubscriptions(data);
        if(col==='goals') setGoals(data);
      })
    );
    return ()=>unsubs.forEach(u=>u());
  },[user]);

  const dashboardTotals = useMemo(()=>{
    const income = transactions.filter(t=>t.type==='Income').reduce((a,c)=>a+Number(c.amount||0),0);
    const emiPaid = transactions.filter(t=>t.type==='EMI_Payment').reduce((a,c)=>a+Number(c.amount||0),0);
    const expenseOnly = transactions.filter(t=>t.type==='Expense').reduce((a,c)=>a+Number(c.amount||0),0);
    const expense = expenseOnly + emiPaid;
    return { income, expense, emiPaid, net: income-expense };
  },[transactions]);

  const handleTransaction = async(e)=>{
    e.preventDefault();
    if(!user) return;
    const id = editingId || Date.now();

    if(formData.category && !categories.includes(formData.category)) setCategories([...categories,formData.category]);
    if(formData.subcategory && !subCategories.includes(formData.subcategory)) setSubCategories([...subCategories,formData.subcategory]);
    if(formData.account && !accounts.includes(formData.account)) setAccounts([...accounts,formData.account]);
    if(formData.paymentName && !paymentDetails.includes(formData.paymentName)) setPaymentDetails([...paymentDetails,formData.paymentName]);

    let txAmount = Number(formData.amount);

    // --- EMI / Loan Automation Logic ---
    if(formData.type==='EMI_Payment'){
      const emiId = formData.linkedId || Date.now().toString();
      const existing = emis.find(e=>e.id===emiId);

      if(existing){
        const newPaid = Number(existing.paid||0) + txAmount;
        const remaining = Number(existing.total||0) - newPaid;
        const nextDate = new Date(existing.nextDate||existing.startDate);
        nextDate.setMonth(nextDate.getMonth()+1);

        await setDoc(doc(db,'artifacts',appId,'users',user.uid,'emis',emiId),{
          ...existing,
          paid:newPaid,
          remaining,
          nextDate:nextDate.toISOString().split('T')[0]
        });
      } else {
        const total = Number(formData.totalAmount||0);
        const paid = txAmount;
        const remaining = total - paid;
        const nextDate = new Date(formData.date);
        nextDate.setMonth(nextDate.getMonth()+1);

        await setDoc(doc(db,'artifacts',appId,'users',user.uid,'emis',emiId),{
          id:emiId,
          name: formData.category || formData.subcategory || 'Loan',
          total,
          paid,
          remaining,
          emiAmount: Math.round(total/Number(formData.tenure||1)),
          months: Number(formData.tenure||0),
          startDate: formData.date,
          nextDate: nextDate.toISOString().split('T')[0]
        });

        formData.linkedId = emiId;
      }
    }

    const linkedType = formData.type==='EMI_Payment' ? 'emis' : formData.type==='Subscription_Payment' ? 'subscriptions' : formData.type==='Goal_Deposit' ? 'goals' : '';

    await setDoc(doc(db,'artifacts',appId,'users',user.uid,'transactions',id.toString()),{
      ...formData,id,amount:txAmount,linkedType
    });

    setEditingId(null);
    setFormData({ ...initialFormState, type: formData.type });
  };

  if(!user){
    return <div className="h-screen flex items-center justify-center"><Icons.Loader2 className="animate-spin"/></div>;
  }

  return(
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-64 bg-white border-r p-6 hidden md:block">
        <h1 className="font-black text-xl flex items-center gap-2"><Icons.Wallet size={20}/> HS_Manager_v8</h1>
        <nav className="mt-8 space-y-2">
          {['Dashboard','History','Goals','Settings'].map(t=>
            <button key={t} onClick={()=>setActiveTab(t)} className={`w-full p-3 rounded-xl ${activeTab===t?'bg-black text-white':'text-gray-500'}`}>{t}</button>
          )}
        </nav>
      </aside>

      <main className="flex-1 p-6">
        <header className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black">{activeTab}</h2>
          <button onClick={()=>{setFormData(initialFormState);setIsModalOpen(true);}} className="bg-black text-white px-5 py-2 rounded-xl flex gap-2"><Icons.PlusCircle size={18}/> Quick Entry</button>
        </header>

        {activeTab==='Dashboard' && (
          (() => {
            const income = transactions.filter(t=>t.type==='Income').reduce((a,c)=>a+Number(c.amount||0),0);
            const emiPaid = transactions.filter(t=>t.type==='EMI_Payment').reduce((a,c)=>a+Number(c.amount||0),0);
            const expenseOnly = transactions.filter(t=>t.type==='Expense').reduce((a,c)=>a+Number(c.amount||0),0);
            const expense = expenseOnly + emiPaid;
            const net = income - expense;

            const emiPending = emis.reduce((a,c)=>a+(Number(c.total||0)-Number(c.paid||0)),0);
            const emiTotal = emis.reduce((a,c)=>a+Number(c.total||0),0);
            const emiPaidSum = emis.reduce((a,c)=>a+Number(c.paid||0),0);
            const emiPct = emiTotal ? Math.min(100, Math.round((emiPaidSum/emiTotal)*100)) : 0;

            const subCount = subscriptions.length;

            const receivable = transactions.filter(t=>t.status==='Lena Hai').reduce((a,c)=>a+Number(c.amount||0),0);
            const payable = transactions.filter(t=>t.status==='Dena Hai').reduce((a,c)=>a+Number(c.amount||0),0);

            const investments = transactions.filter(t=>t.type==='Investment').reduce((a,c)=>a+Number(c.amount||0),0);
            const licTotal = transactions.filter(t=>t.type==='Insurance_Premium').reduce((a,c)=>a+Number(c.amount||0),0);

            const creditDue = transactions.filter(t=>t.type==='Credit_Card').reduce((a,c)=>a+Number(c.amount||0),0);

            const balances = transactions.reduce((m,t)=>{
              const amt = Number(t.amount||0);
              if(t.type==='Balance_Transfer'){
                if(t.account) m[t.account]=(m[t.account]||0)-amt;
                if(t.toAccount) m[t.toAccount]=(m[t.toAccount]||0)+amt;
              } else if(t.type==='Income'){
                if(t.account) m[t.account]=(m[t.account]||0)+amt;
              } else {
                if(t.account) m[t.account]=(m[t.account]||0)-amt;
              }
              return m;
            },{});

            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(threeMonthsAgo.getMonth()-3);
            const last3 = transactions.filter(t=>new Date(t.date)>=threeMonthsAgo);
            const predIncome = last3.filter(t=>t.type==='Income').reduce((a,c)=>a+Number(c.amount||0),0)/3;
            const predExpense = (last3.filter(t=>t.type==='Expense').reduce((a,c)=>a+Number(c.amount||0),0) + last3.filter(t=>t.type==='EMI_Payment').reduce((a,c)=>a+Number(c.amount||0),0))/3;

            return (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-green-600 text-white p-4 rounded-xl">Income ₹{income}</div>
                  <div className="bg-red-600 text-white p-4 rounded-xl">Expense ₹{expense}</div>
                  <div className="bg-blue-600 text-white p-4 rounded-xl">Net Balance ₹{net}</div>
                  <div className="bg-orange-500 text-white p-4 rounded-xl">EMI Pending ₹{emiPending}</div>

                  <div className="bg-purple-600 text-white p-4 rounded-xl">Subscriptions {subCount}</div>
                  <div className="bg-teal-600 text-white p-4 rounded-xl">Receivable ₹{receivable}</div>
                  <div className="bg-rose-600 text-white p-4 rounded-xl">Payable ₹{payable}</div>
                  <div className="bg-indigo-600 text-white p-4 rounded-xl">Investments ₹{investments}</div>

                  <div className="bg-cyan-600 text-white p-4 rounded-xl">LIC ₹{licTotal}</div>
                  <div className="bg-slate-700 text-white p-4 rounded-xl">Bank ₹{balances['Bank']||0}</div>
                  <div className="bg-slate-700 text-white p-4 rounded-xl">Cash ₹{balances['Cash']||0}</div>
                  <div className="bg-slate-700 text-white p-4 rounded-xl">Wallet ₹{balances['Wallet']||0}</div>

                  <div className="bg-yellow-600 text-white p-4 rounded-xl">Credit Card Due ₹{creditDue}</div>
                  <div className="bg-lime-600 text-white p-4 rounded-xl">Pred Income ₹{Math.round(predIncome)}</div>
                  <div className="bg-amber-600 text-white p-4 rounded-xl">Pred Expense ₹{Math.round(predExpense)}</div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow">
                  <p className="font-black mb-2">EMI Progress</p>
                  <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                    <div className="bg-green-600 h-4" style={{width: emiPct+'%'}}></div>
                  </div>
                  <p className="text-sm mt-1">{emiPaidSum} / {emiTotal} ({emiPct}%)</p>
                </div>

                <div className="bg-white p-4 rounded-xl shadow">
                  <p className="font-black mb-2">Subscriptions</p>
                  <div className="space-y-2">
                    {subscriptions.slice(0,5).map(s=>{
                      const d = new Date(s.expiryDate||s.nextDate||new Date());
                      const diff = Math.ceil((d-new Date())/(1000*60*60*24));
                      const color = diff<=0?'text-red-600':diff<=5?'text-yellow-600':'text-green-600';
                      return <div key={s.id} className={`text-sm ${color}`}>{s.name||'Subscription'} - {diff<=0?'Expired':diff+' days'}</div>;
                    })}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow">
                  <p className="font-black mb-2">Income vs Expense</p>
                  <div className="flex items-end gap-4 h-32">
                    <div className="bg-green-600 w-12" style={{height: Math.min(100,(income/(income+expense||1))*100)+'%'}}></div>
                    <div className="bg-red-600 w-12" style={{height: Math.min(100,(expense/(income+expense||1))*100)+'%'}}></div>
                  </div>
                </div>
              </div>
            );
          })()
        )}

        {activeTab==='Goals' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-black">Savings Goals</h3>
              <button onClick={()=>setIsGoalModalOpen(true)} className="bg-black text-white px-4 py-2 rounded-xl text-xs flex gap-2 items-center"><Icons.Plus size={16}/> New Goal</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {goals.map(g => {
                const pct = Math.round((Number(g.current||0)/Number(g.target||1))*100);
                return (
                  <div key={g.id} className="bg-white p-6 rounded-2xl shadow-sm border">
                    <div className="flex justify-between items-start mb-4">
                      <h4 className="font-black text-lg">{g.name}</h4>
                      <button onClick={()=>deleteDoc(doc(db,'artifacts',appId,'users',user.uid,'goals',g.id))} className="text-red-400 hover:text-red-600"><Icons.Trash2 size={16}/></button>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">Target: ₹{Number(g.target).toLocaleString()}</p>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden mb-2">
                      <div className="bg-indigo-600 h-2" style={{width: Math.min(100, pct)+'%'}}></div>
                    </div>
                    <div className="flex justify-between text-xs font-bold">
                      <span>₹{Number(g.current).toLocaleString()} Saved</span>
                      <span className="text-indigo-600">{pct}%</span>
                    </div>
                  </div>
                );
              })}
              {goals.length === 0 && <p className="text-gray-400 italic">No goals set yet.</p>}
            </div>
          </div>
        )}

        {activeTab==='History' && (
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Account</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(t=>
                  <tr key={t.id} className="border-t">
                    <td className="p-3 text-sm">{t.date}</td>
                    <td className="p-3 text-sm">{t.type}</td>
                    <td className="p-3 text-sm">{t.category}</td>
                    <td className="p-3 text-sm">{t.account}</td>
                    <td className={`p-3 text-sm font-bold ${t.type==='Income'?'text-green-600':'text-red-600'}`}>₹{t.amount}</td>
                    <td className="p-3 flex gap-2 justify-center">
                      <button onClick={()=>{setFormData(t);setEditingId(t.id);setIsModalOpen(true);}} className="text-blue-600">
                        <Icons.Pencil size={16}/>
                      </button>
                      <button onClick={()=>deleteDoc(doc(db,'artifacts',appId,'users',user.uid,'transactions',t.id.toString()))} className="text-red-600">
                        <Icons.Trash2 size={16}/>
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-lg">
            <div className="flex justify-between mb-4"><h3 className="font-black">Quick Entry</h3><button onClick={()=>setIsModalOpen(false)}><Icons.X/></button></div>
            <form onSubmit={handleTransaction} className="space-y-3">
              <input type="date" value={formData.date} onChange={e=>setFormData({...formData,date:e.target.value})} className="border p-2 w-full rounded-lg"/>
              <select value={formData.type} onChange={e=>setFormData({...formData,type:e.target.value})} className="border p-2 w-full rounded-lg">{entryTypes.map(t=><option key={t}>{t}</option>)}</select>
              <input list="cats" placeholder="Category" value={formData.category} onChange={e=>setFormData({...formData,category:e.target.value})} className="border p-2 w-full rounded-lg"/>
              <input list="subs" placeholder="Sub Category" value={formData.subcategory} onChange={e=>setFormData({...formData,subcategory:e.target.value})} className="border p-2 w-full rounded-lg"/>

              {formData.type==='EMI_Payment' && (
                <>
                  <select value={formData.linkedId} onChange={e=>setFormData({...formData,linkedId:e.target.value})} className="border p-2 w-full rounded-lg">
                    <option value="">Select Existing Loan (Optional)</option>
                    {emis.map(e=><option key={e.id} value={e.id}>{e.name} (₹{e.remaining})</option>)}
                  </select>
                  <input type="number" placeholder="Total Loan Amount" value={formData.totalAmount} onChange={e=>setFormData({...formData,totalAmount:e.target.value})} className="border p-2 w-full rounded-lg"/>
                  <input type="number" placeholder="Tenure (Months)" value={formData.tenure} onChange={e=>setFormData({...formData,tenure:e.target.value})} className="border p-2 w-full rounded-lg"/>
                </>
              )}

              {formData.type==='Goal_Deposit' && (
                <select value={formData.linkedId} onChange={e=>setFormData({...formData,linkedId:e.target.value})} className="border p-2 w-full rounded-lg">
                  <option value="">Select Target Goal</option>
                  {goals.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              )}

              <input list="accs" placeholder="Account / Wallet" value={formData.account} onChange={e=>setFormData({...formData,account:e.target.value})} className="border p-2 w-full rounded-lg"/>
              <input list="pays" placeholder="Payment Detail" value={formData.paymentName} onChange={e=>setFormData({...formData,paymentName:e.target.value})} className="border p-2 w-full rounded-lg"/>
              <input type="number" placeholder="Amount" value={formData.amount} onChange={e=>setFormData({...formData,amount:e.target.value})} className="border p-2 w-full rounded-lg"/>
              <select value={formData.status} onChange={e=>setFormData({...formData,status:e.target.value})} className="border p-2 w-full rounded-lg">{statusOptions.map(s=><option key={s}>{s}</option>)}</select>
              <textarea placeholder="Notes" value={formData.note} onChange={e=>setFormData({...formData,note:e.target.value})} className="border p-2 w-full rounded-lg"/>
              <button className="bg-black text-white w-full py-2 rounded-xl">Save & Next</button>
            </form>
          </div>
        </div>
      )}

      {isGoalModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm">
            <h3 className="font-black mb-4">Add Savings Goal</h3>
            <form onSubmit={async (e)=>{
              e.preventDefault();
              const fd = new FormData(e.target);
              const name = fd.get('name');
              const target = fd.get('target');
              if(!user) return;
              await setDoc(doc(db,'artifacts',appId,'users',user.uid,'goals',Date.now().toString()), { name, target, current: 0 });
              setIsGoalModalOpen(false);
            }} className="space-y-4">
              <input name="name" placeholder="Goal Name" required className="border p-2 w-full rounded-lg"/>
              <input name="target" type="number" placeholder="Target Amount ₹" required className="border p-2 w-full rounded-lg"/>
              <button type="submit" className="bg-black text-white w-full py-2 rounded-xl font-black">Create Goal</button>
              <button type="button" onClick={()=>setIsGoalModalOpen(false)} className="w-full text-gray-400 text-xs uppercase font-bold">Cancel</button>
            </form>
          </div>
        </div>
      )}

      <datalist id="cats">{categories.map(c=><option key={c} value={c}/> )}</datalist>
      <datalist id="subs">{subCategories.map(c=><option key={c} value={c}/> )}</datalist>
      <datalist id="accs">{accounts.map(c=><option key={c} value={c}/> )}</datalist>
      <datalist id="pays">{paymentDetails.map(c=><option key={c} value={c}/> )}</datalist>
    </div>
  );
};

export default App;
