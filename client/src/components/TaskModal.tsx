import { useState, useEffect } from 'react';
import api from '../services/api';
import { X, Plus, Minus } from 'lucide-react';

interface TaskModalProps {
  onClose: () => void;
  onSuccess: () => void;
  defaultType: string;
  editingTask?: any;
  currentUser: any;
  isMyTasks?: boolean;
}

const TaskModal = ({ onClose, onSuccess, defaultType, editingTask, currentUser, isMyTasks }: TaskModalProps) => {
  const [title, setTitle] = useState(editingTask?.title || '');
  const [description, setDescription] = useState(editingTask?.description || '');
  const [priority, setPriority] = useState(editingTask?.priority || 'MEDIUM');
  const [assigneeId, setAssigneeId] = useState(
    editingTask?.assigneeId || 
    ((defaultType === 'PRIVATE' || isMyTasks) ? currentUser?.id : '')
  );
  const [dueDate, setDueDate] = useState(editingTask?.dueDate ? new Date(editingTask.dueDate).toISOString().split('T')[0] : '');
  const [isRepeating, setIsRepeating] = useState(editingTask?.isRepeating || false);
  const [repeatFrequency, setRepeatFrequency] = useState(editingTask?.repeatFrequency || 'WEEKLY');
  const [steps, setSteps] = useState<string[]>(editingTask?.steps?.map((s: any) => s.content) || []);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      const res = await api.get('/users');
      setUsers(res.data);
    };
    fetchUsers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        title, 
        description, 
        priority, 
        assigneeId, 
        steps, 
        type: editingTask?.type || defaultType,
        dueDate: dueDate || null,
        isRepeating,
        repeatFrequency: isRepeating ? repeatFrequency : null
      };

      if (editingTask) {
        await api.put(`/tasks/${editingTask.id}`, payload);
      } else {
        await api.post('/tasks', payload);
      }
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const addStep = () => setSteps([...steps, '']);
  const updateStep = (index: number, val: string) => {
    const newSteps = [...steps];
    newSteps[index] = val;
    setSteps(newSteps);
  };
  const removeStep = (index: number) => setSteps(steps.filter((_, i) => i !== index));

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-slate-800">
          <h2 className="text-xl font-bold">{editingTask ? 'Edit' : 'New'} {(editingTask?.type || defaultType).toLowerCase()} Task</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={24} /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Title</label>
            <input type="text" className="w-full" value={title} onChange={e => setTitle(e.target.value)} required />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Description (Optional)</label>
            <textarea className="w-full h-24" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Priority</label>
              <select className="w-full" value={priority} onChange={e => setPriority(e.target.value)}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Assign to</label>
              <select className="w-full" value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>
                <option value="">Anyone</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Due Date (Optional)</label>
              <input type="date" className="w-full" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
            <div className="flex flex-col justify-end">
              <label className="flex items-center space-x-2 cursor-pointer py-2">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-sky-600 focus:ring-sky-500" 
                  checked={isRepeating} 
                  onChange={e => setIsRepeating(e.target.checked)} 
                />
                <span className="text-sm font-medium text-slate-400">Repeating Task</span>
              </label>
            </div>
          </div>

          {isRepeating && (
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Repeat Frequency</label>
              <select className="w-full" value={repeatFrequency} onChange={e => setRepeatFrequency(e.target.value)}>
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="YEARLY">Yearly</option>
              </select>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2 flex justify-between items-center">
              Steps / Sub-tasks
              <button type="button" onClick={addStep} className="text-sky-500 hover:text-sky-400 text-xs flex items-center">
                <Plus size={14} className="mr-1" /> Add Step
              </button>
            </label>
            <div className="space-y-2">
              {steps.map((step, i) => (
                <div key={i} className="flex items-center space-x-2">
                  <input type="text" className="flex-1" value={step} onChange={e => updateStep(i, e.target.value)} placeholder={`Step ${i+1}`} />
                  <button type="button" onClick={() => removeStep(i)} className="text-slate-500 hover:text-red-400">
                    <Minus size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 text-white font-bold py-3 rounded-md mt-6 transition-colors"
          >
            {loading ? (editingTask ? 'Updating...' : 'Creating...') : (editingTask ? 'Update Task' : 'Create Task')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default TaskModal;
