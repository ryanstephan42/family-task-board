import { useState, useEffect } from 'react';
import api from '../services/api';
import { ChevronLeft, ChevronRight, X, MapPin, Clock } from 'lucide-react';
import { clsx } from 'clsx';

const Calendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [, setSelectedDate] = useState<Date | null>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('');
  const [location, setLocation] = useState('');
  const [color, setColor] = useState('#0ea5e9');
  const [loading, setLoading] = useState(false);

  const fetchEvents = async () => {
    try {
      const res = await api.get('/events');
      setEvents(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const totalDays = daysInMonth(year, month);
  const startDay = firstDayOfMonth(year, month);

  const days = [];
  for (let i = 0; i < startDay; i++) days.push(null);
  for (let i = 1; i <= totalDays; i++) days.push(new Date(year, month, i));

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    const dateStr = date.toISOString().split('T')[0];
    setStartTime(`${dateStr}T12:00`);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/events', {
        title, description, startTime, location, color
      });
      fetchEvents();
      setShowModal(false);
      resetForm();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setStartTime('');
    setLocation('');
    setColor('#0ea5e9');
  };

  const deleteEvent = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this event?')) return;
    try {
      await api.delete(`/events/${id}`);
      fetchEvents();
    } catch (err) {
      console.error(err);
    }
  };

  const getUpcomingEvents = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const dayAfter = new Date(today);
    dayAfter.setDate(dayAfter.getDate() + 2);

    const filterByDate = (date: Date) => events.filter(e => {
      const eDate = new Date(e.startTime);
      return eDate.toDateString() === date.toDateString();
    });

    return [
      { label: 'Today', events: filterByDate(today) },
      { label: 'Tomorrow', events: filterByDate(tomorrow) },
      { label: dayAfter.toLocaleDateString([], { weekday: 'long' }), events: filterByDate(dayAfter) },
    ];
  };

  const colors = [
    { name: 'Sky', value: '#0ea5e9' },
    { name: 'Rose', value: '#f43f5e' },
    { name: 'Amber', value: '#f59e0b' },
    { name: 'Emerald', value: '#10b981' },
    { name: 'Violet', value: '#8b5cf6' },
  ];

  return (
    <div className="space-y-6">
      {/* Upcoming Events Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {getUpcomingEvents().map(group => (
          <div key={group.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center justify-between">
              {group.label}
              <span className="bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded-full">
                {group.events.length} {group.events.length === 1 ? 'Event' : 'Events'}
              </span>
            </h3>
            <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1 custom-scrollbar">
              {group.events.length > 0 ? group.events.map(event => (
                <div 
                  key={event.id} 
                  className="p-2 rounded-lg border border-white/5 flex items-start space-x-3 transition-colors hover:bg-white/5"
                  style={{ borderLeft: `4px solid ${event.color}` }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-200 truncate">{event.title}</p>
                    <div className="flex items-center text-[10px] text-slate-500 mt-1 space-x-2">
                      <span className="flex items-center"><Clock size={10} className="mr-1" /> {new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {event.location && <span className="flex items-center"><MapPin size={10} className="mr-1" /> {event.location}</span>}
                    </div>
                  </div>
                </div>
              )) : (
                <p className="text-xs text-slate-600 italic py-2">No events scheduled.</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Main Calendar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
          <h2 className="text-2xl font-bold text-white flex items-center">
            {monthNames[month]} <span className="text-slate-500 ml-2 font-normal">{year}</span>
          </h2>
          <div className="flex items-center space-x-2">
            <button onClick={prevMonth} className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white">
              <ChevronLeft size={20} />
            </button>
            <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1 text-sm font-medium hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white border border-slate-800">
              Today
            </button>
            <button onClick={nextMonth} className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-slate-800">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-900/30">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 auto-rows-[160px]">
          {days.map((date, i) => {
            const isToday = date?.toDateString() === new Date().toDateString();
            const dayEvents = date ? events.filter(e => new Date(e.startTime).toDateString() === date.toDateString()) : [];
            
            return (
              <div 
                key={i} 
                className={clsx(
                  "border-r border-b border-slate-800 p-2 transition-colors relative group",
                  date ? "hover:bg-slate-800/30 cursor-pointer" : "bg-slate-950/20"
                )}
                onClick={() => date && handleDayClick(date)}
              >
                {date && (
                  <>
                    <span className={clsx(
                      "text-sm font-semibold flex items-center justify-center w-7 h-7 rounded-full mb-1",
                      isToday ? "bg-sky-600 text-white" : "text-slate-400 group-hover:text-slate-200"
                    )}>
                      {date.getDate()}
                    </span>
                    
                    <div className="space-y-1 overflow-y-auto max-h-[120px] scrollbar-hide">
                      {dayEvents.map(event => (
                        <div 
                          key={event.id}
                          className="text-[10px] px-1.5 py-1 rounded border border-white/10 flex flex-col group/event"
                          style={{ backgroundColor: `${event.color}20`, borderColor: `${event.color}40`, color: event.color }}
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-bold truncate">{event.title}</span>
                            <button 
                              onClick={(e) => deleteEvent(event.id, e)}
                              className="opacity-0 group-event-hover:opacity-100 transition-opacity hover:text-white"
                            >
                              <X size={10} />
                            </button>
                          </div>
                          <div className="flex items-center justify-between mt-0.5 opacity-70 text-[8px]">
                            <span>{new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {event.location && <span className="truncate ml-1 max-w-[50%]">{event.location}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-6 border-b border-slate-800">
              <h2 className="text-xl font-bold">Add Event</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white"><X size={24} /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Event Title</label>
                <input type="text" className="w-full" value={title} onChange={e => setTitle(e.target.value)} required placeholder="Family Dinner, etc." />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Description (Optional)</label>
                <textarea className="w-full h-20" value={description} onChange={e => setDescription(e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Time</label>
                  <input type="datetime-local" className="w-full" value={startTime} onChange={e => setStartTime(e.target.value)} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Location</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 text-slate-500" size={16} />
                    <input type="text" className="w-full pl-10" value={location} onChange={e => setLocation(e.target.value)} placeholder="Home, Park..." />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Highlight Color</label>
                <div className="flex space-x-3">
                  {colors.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setColor(c.value)}
                      className={clsx(
                        "w-8 h-8 rounded-full border-2 transition-transform",
                        color === c.value ? "border-white scale-110" : "border-transparent hover:scale-105"
                      )}
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
              
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 text-white font-bold py-3 rounded-md mt-4 transition-colors shadow-lg shadow-sky-900/20"
              >
                {loading ? 'Adding...' : 'Add to Calendar'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;
