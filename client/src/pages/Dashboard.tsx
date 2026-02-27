import { useState, useEffect } from 'react';
import api from '../services/api';
import { Plus, Users, ClipboardList, Lock, RefreshCw, UserCheck, Calendar as CalendarIcon, Archive } from 'lucide-react';
import TaskCard from '../components/TaskCard';
import TaskModal from '../components/TaskModal';
import Calendar from '../components/Calendar';
import GroceryList from '../components/GroceryList';
import { clsx } from 'clsx';
import { AnimatePresence } from 'framer-motion';
import { ShoppingCart } from 'lucide-react';

interface DashboardProps {
  user: any;
}

const Dashboard = ({ user }: DashboardProps) => {
  const [mainTab, setMainTab] = useState('TASKS');
  const [activeTab, setActiveTab] = useState('FAMILY');
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTasks = async () => {
    if (mainTab === 'CALENDAR' || activeTab === 'GROCERY') return;
    setLoading(true);
    try {
      let endpoint = '';
      if (activeTab === 'MY_TASKS') {
        endpoint = '/tasks?assignedToMe=true';
      } else if (activeTab === 'ARCHIVE') {
        endpoint = '/tasks?status=DONE';
      } else {
        endpoint = `/tasks?type=${activeTab}`;
      }
      
      const res = await api.get(endpoint);
      setTasks(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    if (activeTab === 'FAMILY') fetchUsers();
  }, [activeTab, mainTab]);

  const taskTabs = [
    { id: 'MY_TASKS', label: 'My Tasks', icon: UserCheck },
    { id: 'FAMILY', label: 'Family Board', icon: Users },
    { id: 'CHORE', label: 'Chore Board', icon: ClipboardList },
    { id: 'GROCERY', label: 'Grocery List', icon: ShoppingCart },
    { id: 'PRIVATE', label: 'Private Tasks', icon: Lock },
    { id: 'ARCHIVE', label: 'Archive', icon: Archive },
  ];

  const renderFamilyBoard = () => {
    const columns = [
      { id: 'unassigned', name: 'Unassigned', tasks: tasks.filter((t: any) => !t.assigneeId) },
      ...users.map(u => ({
        id: u.id,
        name: u.name,
        tasks: tasks.filter((t: any) => t.assigneeId === u.id)
      }))
    ];

    return (
      <div className="flex space-x-6 overflow-x-auto pb-6 min-h-[600px] items-start custom-scrollbar">
        {columns.map(col => (
          <div key={col.id} className="flex-shrink-0 w-80 bg-slate-900/40 rounded-2xl border border-slate-800/50 p-4">
            <div className="flex items-center justify-between mb-4 px-2">
              <h3 className="font-bold text-slate-300 flex items-center">
                <span className="w-2 h-2 rounded-full bg-sky-500 mr-2"></span>
                {col.name}
              </h3>
              <span className="bg-slate-800 text-slate-500 text-[10px] px-2 py-0.5 rounded-full font-bold">
                {col.tasks.length}
              </span>
            </div>
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {col.tasks.map((task: any) => (
                  <TaskCard 
                    key={task.id} 
                    task={task} 
                    onRefresh={fetchTasks} 
                    onEdit={(t) => {
                      setEditingTask(t);
                      setShowModal(true);
                    }}
                  />
                ))}
              </AnimatePresence>
              {col.tasks.length === 0 && (
                <div className="py-8 text-center border-2 border-dashed border-slate-800/30 rounded-xl">
                  <p className="text-xs text-slate-600 italic">No tasks</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      <div className="flex flex-col space-y-6 mb-8">
        {/* Main Hierarchy Tabs */}
        <div className="flex space-x-1 p-1 bg-slate-900/50 rounded-xl border border-slate-800 w-fit">
          <button
            onClick={() => setMainTab('TASKS')}
            className={clsx(
              "flex items-center space-x-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all",
              mainTab === 'TASKS' ? "bg-sky-600 text-white shadow-lg" : "text-slate-400 hover:text-slate-200"
            )}
          >
            <ClipboardList size={18} />
            <span>Tasks</span>
          </button>
          <button
            onClick={() => setMainTab('CALENDAR')}
            className={clsx(
              "flex items-center space-x-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all",
              mainTab === 'CALENDAR' ? "bg-sky-600 text-white shadow-lg" : "text-slate-400 hover:text-slate-200"
            )}
          >
            <CalendarIcon size={18} />
            <span>Calendar</span>
          </button>
        </div>

        {mainTab === 'TASKS' && (
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex p-1 bg-slate-900 rounded-lg border border-slate-800 overflow-x-auto max-w-full">
              {taskTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    "flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all shrink-0",
                    activeTab === tab.id ? "bg-slate-800 text-sky-400 shadow-sm" : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  <tab.icon size={16} />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
            
            {activeTab !== 'GROCERY' && (
              <button 
                onClick={() => setShowModal(true)}
                className="flex items-center space-x-2 bg-sky-600 hover:bg-sky-500 text-white px-6 py-2.5 rounded-lg font-semibold transition-colors shadow-lg shadow-sky-900/20"
              >
                <Plus size={20} />
                <span>New Task</span>
              </button>
            )}
          </div>
        )}
      </div>

      {mainTab === 'CALENDAR' ? (
        <Calendar />
      ) : loading && activeTab !== 'GROCERY' ? (
        <div className="flex justify-center py-20">
          <RefreshCw className="animate-spin text-sky-500" size={32} />
        </div>
      ) : activeTab === 'GROCERY' ? (
        <GroceryList />
      ) : activeTab === 'FAMILY' ? (
        renderFamilyBoard()
      ) : tasks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {tasks.map((task: any) => (
              <TaskCard 
                key={task.id} 
                task={task} 
                onRefresh={fetchTasks} 
                onEdit={(t) => {
                  setEditingTask(t);
                  setShowModal(true);
                }}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="text-center py-20 bg-slate-900/50 rounded-2xl border border-dashed border-slate-800">
          <p className="text-slate-500 text-lg">No tasks found in this category.</p>
          <button onClick={() => setShowModal(true)} className="text-sky-500 hover:underline mt-2">Create your first task</button>
        </div>
      )}

      {showModal && (
        <TaskModal 
          currentUser={user}
          defaultType={activeTab === 'MY_TASKS' || activeTab === 'ARCHIVE' ? 'FAMILY' : activeTab} 
          isMyTasks={activeTab === 'MY_TASKS'}
          editingTask={editingTask}
          onClose={() => {
            setShowModal(false);
            setEditingTask(null);
          }} 
          onSuccess={fetchTasks} 
        />
      )}
    </div>
  );
};

export default Dashboard;
