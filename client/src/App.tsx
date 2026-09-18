import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Login from './pages/Login';
import Register from './pages/Register';
import Setup from './pages/Setup';
import Dashboard from './pages/Dashboard';
import Navbar from './components/Navbar';
import api from './services/api';

function App() {
  const [user, setUser] = useState<any>(null);
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    api.get('/setup/status')
      .then((response) => setSetupRequired(response.data.setupRequired))
      .catch(() => setSetupRequired(false));
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <Router>
      <div className="min-h-screen bg-slate-950 text-slate-100">
        {user && <Navbar user={user} onLogout={logout} />}
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route
              path="/login"
              element={user ? <Navigate to="/" /> : setupRequired ? <Navigate to="/setup" /> : <Login onLogin={setUser} />}
            />
            <Route
              path="/register"
              element={!user && !setupRequired ? <Register /> : <Navigate to={setupRequired ? '/setup' : '/'} />}
            />
            <Route path="/setup" element={!user && setupRequired ? <Setup /> : <Navigate to={user ? '/' : '/login'} />} />
            <Route path="/" element={user ? <Dashboard user={user} /> : <Navigate to="/login" />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;