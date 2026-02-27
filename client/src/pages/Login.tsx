import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const Login = ({ onLogin }: { onLogin: (user: any) => void }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/users/login', { username, password });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      onLogin(res.data.user);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20">
      <div className="bg-slate-900 p-8 rounded-xl border border-slate-800 shadow-2xl">
        <h2 className="text-3xl font-bold mb-6 text-center">Login</h2>
        {error && <div className="bg-red-900/30 border border-red-500 text-red-200 p-3 rounded-md mb-4 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Username</label>
            <input 
              type="text" 
              className="w-full"
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              required 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Password</label>
            <input 
              type="password" 
              className="w-full"
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
          </div>
          <button type="submit" className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 rounded-md mt-4 transition-colors">
            Enter the House
          </button>
        </form>
        <p className="mt-6 text-center text-slate-400 text-sm">
          New here? <Link to="/register" className="text-sky-500 hover:underline">Register your account</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
