import { CheckCircle2, Circle, Clock, User, Trash2, ExternalLink, Check } from 'lucide-react';
import api from '../services/api';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

interface TaskCardProps {
  task: any;
  onRefresh: () => void;
  onEdit: (task: any) => void;
}

const TaskCard = ({ task, onRefresh, onEdit }: TaskCardProps) => {
  const [isCompleting, setIsCompleting] = useState(false);

  const toggleStep = async (stepId: string, completed: boolean) => {
    try {
      await api.patch(`/tasks/${task.id}/steps/${stepId}`, { completed });
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const completeTask = async () => {
    setIsCompleting(true);
    try {
      // Small delay for animation
      await new Promise(resolve => setTimeout(resolve, 600));
      await api.put(`/tasks/${task.id}`, { status: 'DONE' });
      onRefresh();
    } catch (err) {
      console.error(err);
      setIsCompleting(false);
    }
  };

  const deleteTask = async () => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      await api.delete(`/tasks/${task.id}`);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'HIGH': return 'text-red-400 border-red-900/50 bg-red-950/20';
      case 'MEDIUM': return 'text-amber-400 border-amber-900/50 bg-amber-950/20';
      default: return 'text-emerald-400 border-emerald-900/50 bg-emerald-950/20';
    }
  };

  const getDaysTill = (date: string) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const due = new Date(date);
    due.setHours(0, 0, 0, 0);
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Due Today';
    if (diffDays === 1) return 'Due Tomorrow';
    if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
    return `${diffDays} days till`;
  };

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ 
        opacity: isCompleting ? 0 : 1, 
        scale: isCompleting ? 0.95 : 1,
        y: 0 
      }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.4 }}
      className={clsx(
        "bg-slate-900 border border-slate-800 rounded-lg p-5 hover:border-slate-700 transition-all shadow-lg group relative overflow-hidden",
        task.status === 'DONE' && "opacity-60 grayscale-[0.5]"
      )}
    >
      <AnimatePresence>
        {isCompleting && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-sky-500/10 flex items-center justify-center z-10 backdrop-blur-[1px]"
          >
            <motion.div
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: 1.5, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 10 }}
              className="bg-sky-500 text-white rounded-full p-2"
            >
              <Check size={32} strokeWidth={3} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className={clsx("text-lg font-semibold text-slate-100", task.status === 'DONE' && "line-through text-slate-500")}>
            {task.title}
          </h3>
        </div>
        <div className="flex items-center space-x-2">
          {task.status !== 'DONE' && (
            <button 
              onClick={completeTask}
              className="text-slate-500 hover:text-emerald-400 transition-colors p-1 hover:bg-emerald-400/10 rounded-full"
              title="Complete Task"
            >
              <CheckCircle2 size={20} />
            </button>
          )}
          <div className="flex flex-col items-end">
            <span className={clsx("text-[10px] font-bold px-2 py-0.5 rounded border uppercase", getPriorityColor(task.priority))}>
              {task.priority}
            </span>
            {task.dueDate && task.status !== 'DONE' && (
              <span className="text-[11px] font-medium text-sky-400 mt-1">
                {getDaysTill(task.dueDate)}
              </span>
            )}
            {task.isRepeating && (
              <span className="text-[9px] text-slate-500 mt-1 flex items-center">
                <Clock size={10} className="mr-1" /> {task.repeatFrequency}
              </span>
            )}
          </div>
          <button onClick={() => onEdit(task)} className="text-slate-500 hover:text-sky-400 opacity-0 group-hover:opacity-100 transition-opacity">
            <ExternalLink size={16} />
          </button>
          <button onClick={deleteTask} className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      
      {task.description && <p className="text-slate-400 text-sm mb-4 line-clamp-2">{task.description}</p>}
      
      {task.steps && task.steps.length > 0 && (
        <div className="space-y-2 mb-4">
          {task.steps.map((step: any) => (
            <div 
              key={step.id} 
              className="flex items-center space-x-2 text-sm cursor-pointer"
              onClick={() => task.status !== 'DONE' && toggleStep(step.id, !step.completed)}
            >
              {step.completed ? 
                <CheckCircle2 size={16} className="text-sky-500 shrink-0" /> : 
                <Circle size={16} className="text-slate-600 shrink-0" />
              }
              <span className={clsx(step.completed || task.status === 'DONE' ? "text-slate-500 line-through" : "text-slate-300")}>
                {step.content}
              </span>
            </div>
          ))}
        </div>
      )}
      
      <div className="flex justify-between items-center pt-4 border-t border-slate-800 text-[12px] text-slate-500">
        <div className="flex items-center space-x-1">
          <User size={12} />
          <span>{task.assignee?.name || 'Unassigned'}</span>
        </div>
        {task.dueDate && (
          <div className="flex items-center space-x-1">
            <Clock size={12} />
            <span>{new Date(task.dueDate).toLocaleDateString()}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default TaskCard;
