// App.jsx – Main component with UI and logic for Expense Manager
import React, { useState, useEffect } from 'react';
import { auth, db } from './firebaseConfig'; // Our Firebase setup
import { signInAnonymously, onAuthStateChanged, signOut } from 'firebase/auth';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy
} from 'firebase/firestore';
import { FiEdit3, FiTrash2, FiLogOut } from 'react-icons/fi'; // Icons (install via `npm install react-icons`)

// Ensure Tailwind CSS is set up in your project (global CSS includes @tailwind directives).
function App() {
  const [user, setUser] = useState(null);               // Firebase user (anonymous)
  const [expenses, setExpenses] = useState([]);         // List of expense objects
  const [loading, setLoading] = useState(true);         // Loading state for Firestore data
  const [title, setTitle] = useState('');               // Form field: expense title
  const [amount, setAmount] = useState('');             // Form field: expense amount (string)
  const [editingId, setEditingId] = useState(null);     // If non-null, we're editing this expense

  // Authenticate user anonymously on component mount
  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
    // Listen for auth state changes (to get the user object)
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      // When user is available, you could do user-specific setup here
    });
    return () => unsubscribeAuth();
  }, []);

  // Subscribe to Firestore "expenses" collection (real-time updates)
  useEffect(() => {
    // Create a query on "expenses", e.g., order by title for consistent ordering
    const q = query(collection(db, 'expenses'), orderBy('title'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Map Firestore docs to local state objects
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setExpenses(items);
      setLoading(false);
    }, (error) => {
      console.error("Firestore error:", error);
      setLoading(false);
    });
    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  // Handle form submission for adding or updating an expense
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !amount) return; // Simple validation

    const expenseData = {
      title: title,
      amount: parseFloat(amount), // Convert to number
    };

    try {
      if (editingId) {
        // Update existing expense in Firestore
        await updateDoc(doc(db, 'expenses', editingId), expenseData);
        setEditingId(null);
      } else {
        // Add new expense to Firestore
        await addDoc(collection(db, 'expenses'), expenseData);
      }
      // Reset form fields
      setTitle('');
      setAmount('');
    } catch (error) {
      console.error("Error saving expense:", error);
    }
  };

  // Start editing an existing expense: populate form with its data
  const handleEdit = (expense) => {
    setTitle(expense.title);
    setAmount(expense.amount.toString());
    setEditingId(expense.id);
  };

  // Delete an expense from Firestore
  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, 'expenses', id));
    } catch (error) {
      console.error("Error deleting expense:", error);
    }
  };

  // Cancel editing mode and reset form
  const handleCancelEdit = () => {
    setEditingId(null);
    setTitle('');
    setAmount('');
  };

  // If auth is not ready yet, show a loading state
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-gray-500">Signing in...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header with title and logout */}
      <header className="bg-blue-600 text-white p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">HS Expense Manager</h1>
        <button 
          onClick={() => signOut(auth)} 
          title="Sign Out" 
          className="hover:text-gray-200"
        >
          <FiLogOut className="w-6 h-6" />
        </button>
      </header>

      {/* Main content area */}
      <div className="container mx-auto p-4">
        <div className="flex flex-col md:flex-row md:space-x-4">
          
          {/* Expense Form */}
          <form 
            onSubmit={handleSubmit} 
            className="bg-white p-4 rounded shadow md:w-1/3"
          >
            <h2 className="text-lg font-semibold mb-4">
              {editingId ? 'Edit Expense' : 'Add New Expense'}
            </h2>
            <label className="block mb-2">
              <span className="text-gray-700">Title</span>
              <input
                className="mt-1 block w-full border border-gray-300 rounded p-2"
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Expense title"
              />
            </label>
            <label className="block mb-4">
              <span className="text-gray-700">Amount</span>
              <input
                className="mt-1 block w-full border border-gray-300 rounded p-2"
                type="number"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </label>
            <div className="flex space-x-2">
              <button 
                type="submit" 
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
              >
                {editingId ? 'Update' : 'Add'}
              </button>
              {editingId && (
                <button 
                  type="button" 
                  onClick={handleCancelEdit} 
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          {/* Expense List */}
          <div className="mt-4 md:mt-0 flex-1">
            <h2 className="text-lg font-semibold mb-4">Expenses</h2>
            {loading ? (
              <p>Loading expenses...</p>
            ) : expenses.length === 0 ? (
              <p>No expenses added yet.</p>
            ) : (
              <ul className="space-y-2">
                {expenses.map(expense => (
                  <li 
                    key={expense.id} 
                    className="flex justify-between items-center bg-white p-4 rounded shadow"
                  >
                    <div>
                      <div className="font-medium">{expense.title}</div>
                      <div className="text-gray-600">${expense.amount.toFixed(2)}</div>
                    </div>
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => handleEdit(expense)} 
                        className="text-blue-500 hover:text-blue-700"
                        title="Edit"
                      >
                        <FiEdit3 className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleDelete(expense.id)} 
                        className="text-red-500 hover:text-red-700"
                        title="Delete"
                      >
                        <FiTrash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

export default App;
