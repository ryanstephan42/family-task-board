import { LogOut, CheckSquare } from 'lucide-react';

interface NavbarProps {
  user: any;
  onLogout: () => void;
}

const Navbar = ({ user, onLogout }: NavbarProps) => {
  return (
    <nav className="bg-slate-900 border-b border-slate-800 py-4">
      <div className="container mx-auto px-4 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <CheckSquare className="text-sky-500 w-8 h-8" />
          <span className="text-xl font-bold tracking-tight">FamilyTask<span className="text-sky-500">Board</span></span>
        </div>
        
        <div className="flex items-center space-x-6">
          <span className="text-slate-400 hidden sm:block">Welcome, <span className="text-slate-100 font-medium">{user.name}</span></span>
          <button 
            onClick={onLogout}
            className="flex items-center space-x-1 text-slate-400 hover:text-red-400 transition-colors"
          >
            <LogOut size={18} />
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
