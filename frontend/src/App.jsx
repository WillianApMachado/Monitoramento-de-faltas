import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  BarChart3, 
  XCircle, 
  Clock,
  LayoutDashboard,
  CheckCircle2,
  Trophy,
  UserCircle,
  Save,
  RefreshCw,
  Wifi,
  WifiOff
} from 'lucide-react';

// URL do servidor Python (usa variavel de ambiente em producao)
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const TODAY = new Date();
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const App = () => {
  const [userId] = useState(() => {
    let id = localStorage.getItem('app_user_id');
    if (!id) {
      id = 'user_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('app_user_id', id);
    }
    return id;
  });

  const [username, setUsername] = useState('');
  const [absentLogs, setAbsentLogs] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const fetchData = async () => {
    try {
      const resAbsences = await fetch(`${API_BASE_URL}/absences/${userId}`);
      if (resAbsences.ok) setAbsentLogs(await resAbsences.json());

      const resRanking = await fetch(`${API_BASE_URL}/ranking/`);
      if (resRanking.ok) {
        const data = await resRanking.json();
        setLeaderboard(data);
        const myProfile = data.find(u => u.user_id === userId);
        if (myProfile) setUsername(myProfile.display_name);
        else setShowProfileModal(true);
      }
      setIsOnline(true);
    } catch (err) {
      setIsOnline(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [userId]);

  const calculatedStats = useMemo(() => {
    const stats = MOCK_SUBJECTS.map(subject => {
      const absences = absentLogs.filter(log => log.subject_id === subject.id).length;
      const maxAbsences = subject.total_hours * 0.25; // Limite de 25%
      const absencePercentage = Number(((absences / subject.total_hours) * 100).toFixed(1));
      return {
        ...subject,
        presents: subject.total_hours - absences,
        absences,
        total_absence_percentage: absencePercentage,
        maxHoursAllowedToMiss: maxAbsences,
        remainingAbsences: Math.max(0, maxAbsences - absences)
      };
    });

    const totalPresents = stats.reduce((acc, curr) => acc + curr.presents, 0);
    if (username && isOnline) {
      fetch(`${API_BASE_URL}/profile/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, display_name: username, total_presents: totalPresents })
      });
    }
    return stats;
  }, [absentLogs, username, isOnline]);

  const toggleAbsence = async (date, sessionId) => {
    const dateKey = date.toISOString().split('T')[0];
    const logId = `${userId}_${dateKey}_${sessionId}`;
    const exists = absentLogs.find(l => l.id === logId);

    try {
      if (exists) {
        await fetch(`${API_BASE_URL}/absences/${logId}`, { method: 'DELETE' });
        setAbsentLogs(prev => prev.filter(l => l.id !== logId));
      } else {
        const newAbsence = { id: logId, user_id: userId, subject_id: sessionId.split('-')[0], date: dateKey };
        await fetch(`${API_BASE_URL}/absences/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newAbsence)
        });
        setAbsentLogs(prev => [...prev, newAbsence]);
      }
    } catch (err) {
      alert("Servidor local offline!");
    }
  };

  const saveProfile = async (name) => {
    if (!name.trim()) return;
    try {
      const totalPresents = calculatedStats.reduce((acc, curr) => acc + curr.presents, 0);
      await fetch(`${API_BASE_URL}/profile/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, display_name: name, total_presents: totalPresents })
      });
      setUsername(name);
      setShowProfileModal(false);
      fetchData();
    } catch (err) {
      alert("Erro ao salvar perfil.");
    }
  };

  if (loading && isOnline) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
      <RefreshCw className="w-10 h-10 text-blue-500 animate-spin mb-4" />
      <p className="text-slate-400">Iniciando sistema local...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-32">
      <div className="max-w-md mx-auto p-4">
        <header className="py-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black italic text-blue-500 uppercase">Monitoramento</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">
              {isOnline ? <><Wifi size={10} className="text-emerald-500 inline mr-1" /> Conectado</> : <><WifiOff size={10} className="text-rose-500 inline mr-1" /> Servidor Offline</>}
            </p>
          </div>
          <button onClick={() => setShowProfileModal(true)} className="bg-slate-900 p-2 rounded-xl border border-slate-800">
            <UserCircle className={username ? "text-blue-500" : "text-slate-600"} />
          </button>
        </header>

        <main>
          {activeTab === 'dashboard' && <Dashboard todaysSessions={SCHEDULE.filter(s => s.weekday === WEEKDAYS[TODAY.getDay()])} absentLogs={absentLogs} toggleAbsence={toggleAbsence} userId={userId} />}
          {activeTab === 'calendar' && <Calendar selectedDate={selectedDate} setSelectedDate={setSelectedDate} absentLogs={absentLogs} toggleAbsence={toggleAbsence} userId={userId} />}
          {activeTab === 'stats' && <Stats stats={calculatedStats} />}
          {activeTab === 'ranking' && <Ranking leaderboard={leaderboard} currentUserId={userId} onRefresh={fetchData} />}
        </main>
      </div>

      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-xl border border-slate-800 p-2 rounded-3xl shadow-2xl flex gap-1 z-50">
        <NavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={20} />} label="Início" />
        <NavItem active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')} icon={<CalendarIcon size={20} />} label="Agenda" />
        <NavItem active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} icon={<BarChart3 size={20} />} label="Status" />
        <NavItem active={activeTab === 'ranking'} onClick={() => setActiveTab('ranking')} icon={<Trophy size={20} />} label="Social" />
      </nav>

      {showProfileModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl w-full max-w-xs shadow-2xl">
            <h3 className="text-xl font-black mb-1 uppercase italic tracking-tighter">Identificação</h3>
            <p className="text-slate-500 text-xs mb-6">Como quer ser chamado no ranking?</p>
            <input type="text" defaultValue={username} placeholder="Seu apelido..." className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl mb-4 text-white outline-none focus:border-blue-500 font-bold" id="username-input" autoFocus />
            <button onClick={() => saveProfile(document.getElementById('username-input').value)} className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-blue-500 transition-all">
              <Save size={18} /> SALVAR PERFIL
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const Dashboard = ({ todaysSessions, absentLogs, toggleAbsence, userId }) => {
  const dateKey = TODAY.toISOString().split('T')[0];
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-6 shadow-xl text-white">
        <h2 className="text-xs font-bold opacity-80 uppercase tracking-widest mb-1">Hoje</h2>
        <p className="text-3xl font-black capitalize italic">{TODAY.toLocaleDateString('pt-BR', { weekday: 'long' })}</p>
      </div>
      <div className="space-y-3">
        {todaysSessions.length > 0 ? todaysSessions.map(session => {
          const sessionId = `${session.subjectId}-${session.time}`;
          const isAbsent = absentLogs.some(l => l.id === `${userId}_${dateKey}_${sessionId}`);
          return (
            <div key={sessionId} className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${isAbsent ? 'bg-rose-500/10 border-rose-500/30' : 'bg-slate-800 border-slate-700'}`}>
              <div className="flex gap-4 items-center">
                {isAbsent ? <XCircle className="text-rose-500" size={20} /> : <CheckCircle2 className="text-emerald-500" size={20} />}
                <div className="flex flex-col">
                  <span className="font-bold text-sm truncate max-w-[150px]">{MOCK_SUBJECTS.find(s => s.id === session.subjectId).name}</span>
                  <span className="text-[10px] text-slate-500 font-bold uppercase">{session.time}</span>
                </div>
              </div>
              <button onClick={() => toggleAbsence(TODAY, sessionId)} className={`text-[9px] font-black uppercase px-4 py-2 rounded-xl transition-all ${isAbsent ? 'bg-rose-500 text-white shadow-lg' : 'bg-slate-700 text-slate-400 hover:text-white'}`}>
                {isAbsent ? 'Faltei' : 'Presença'}
              </button>
            </div>
          );
        }) : <div className="text-center py-16 text-slate-700 font-bold italic opacity-50">Sem aulas hoje! 🎉</div>}
      </div>
    </div>
  );
};

const Calendar = ({ selectedDate, setSelectedDate, absentLogs, toggleAbsence, userId }) => {
  const dateKey = selectedDate.toISOString().split('T')[0];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-7 gap-1.5 bg-slate-900/50 p-3 rounded-3xl border border-slate-800 shadow-inner">
        {Array.from({ length: 28 }, (_, i) => {
          const d = new Date(2026, 1, i + 1);
          const hasClasses = SCHEDULE.some(s => s.weekday === WEEKDAYS[d.getDay()]);
          const missed = absentLogs.some(l => l.date === d.toISOString().split('T')[0]);
          const isSelected = d.toDateString() === selectedDate.toDateString();
          return (
            <button key={i} onClick={() => setSelectedDate(d)} className={`aspect-square rounded-xl text-[10px] relative flex items-center justify-center font-black transition-all ${isSelected ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'} ${!hasClasses && 'opacity-20'}`}>
              {i + 1}
              {missed && <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-rose-500 rounded-full animate-pulse"></div>}
            </button>
          );
        })}
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl">
        <h4 className="font-black text-blue-400 text-[10px] mb-4 uppercase flex items-center gap-2 border-b border-slate-800 pb-3 tracking-widest italic leading-none">
          <Clock size={14}/> {selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </h4>
        <div className="space-y-2">
          {SCHEDULE.filter(s => s.weekday === WEEKDAYS[selectedDate.getDay()]).map(session => {
            const sessionId = `${session.subjectId}-${session.time}`;
            const isAbsent = absentLogs.some(l => l.id === `${userId}_${dateKey}_${sessionId}`);
            return (
              <div key={sessionId} className="flex items-center justify-between p-4 bg-slate-800/30 rounded-2xl border border-white/5">
                <span className="text-[11px] font-black uppercase text-slate-300 leading-none">{MOCK_SUBJECTS.find(sub => sub.id === session.subjectId).name}</span>
                <input type="checkbox" checked={!!isAbsent} onChange={() => toggleAbsence(selectedDate, sessionId)} className="w-6 h-6 accent-blue-600 rounded cursor-pointer" />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const Stats = ({ stats }) => (
  <div className="grid grid-cols-1 gap-4">
    {stats.map(item => {
      const usedQuotaPercent = Number(((item.absences / item.maxHoursAllowedToMiss) * 100).toFixed(1));
      const isDanger = usedQuotaPercent >= 80;
      return (
        <div key={item.id} className="bg-slate-800 border border-slate-700 rounded-3xl p-5 shadow-lg relative overflow-hidden backdrop-blur-sm">
          {isDanger && <div className="absolute top-0 right-0 w-1.5 h-full bg-rose-500 animate-pulse"></div>}
          <div className="flex justify-between items-start mb-5 leading-none">
            <h3 className="font-black text-[11px] leading-tight w-2/3 uppercase italic tracking-tight">{item.name}</h3>
            <span className="text-[8px] bg-slate-950 px-2 py-1 rounded text-slate-500 font-bold border border-white/5 uppercase tracking-widest">{item.total_hours}h</span>
          </div>
          <div className="flex justify-between text-[8px] mb-2 font-black uppercase tracking-widest italic">
            <span className="text-slate-500">Faltas: {item.absences}h de {item.maxHoursAllowedToMiss}h permitidas</span>
            <span className={isDanger ? "text-rose-500 font-black animate-pulse" : "text-blue-400"}>{usedQuotaPercent}%</span>
          </div>
          <div className="w-full bg-slate-950 rounded-full h-1.5 mb-6 relative">
            <div className="absolute left-[80%] top-0 bottom-0 w-0.5 bg-rose-500/30 z-10"></div>
            <div className={`h-full rounded-full transition-all duration-1000 ${isDanger ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]' : 'bg-blue-500'}`} style={{ width: `${Math.min(usedQuotaPercent, 100)}%` }}></div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center text-[10px] font-bold italic">
            <div className="bg-slate-950/50 p-3 rounded-2xl border border-white/5">
              <p className="text-slate-500 uppercase tracking-widest mb-1 text-[7px] font-black">Faltas</p>
              <p className="text-rose-400 text-base font-black italic">{item.absences}h</p>
            </div>
            <div className="bg-slate-950/50 p-3 rounded-2xl border border-white/5">
              <p className="text-slate-500 uppercase tracking-widest mb-1 text-[7px] font-black">Ainda Pode Faltar</p>
              <p className="text-emerald-400 text-base font-black italic">{item.remainingAbsences.toFixed(0)}h</p>
            </div>
          </div>
        </div>
      );
    })}
  </div>
);

const Ranking = ({ leaderboard, currentUserId, onRefresh }) => (
  <div className="space-y-4">
    <div className="bg-gradient-to-br from-amber-500/20 to-orange-600/20 rounded-3xl p-6 border border-amber-500/30 text-white flex justify-between items-center">
      <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3 italic"><Trophy size={28} className="text-amber-500"/> Ranking</h2>
      <button onClick={onRefresh} className="p-3 bg-slate-900/50 rounded-xl hover:bg-slate-800 transition-all">
        <RefreshCw size={20} className="text-slate-400" />
      </button>
    </div>
    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden divide-y divide-slate-800/50 shadow-2xl">
      {leaderboard.length > 0 ? leaderboard.map((u, idx) => (
        <div key={u.user_id} className={`flex items-center justify-between p-5 transition-all ${u.user_id === currentUserId ? 'bg-blue-500/10 border-l-4 border-l-blue-500' : 'hover:bg-white/5'}`}>
          <div className="flex items-center gap-4">
            <span className={`w-8 text-center font-black italic text-base ${idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-slate-300' : 'text-slate-700'}`}>{idx + 1}º</span>
            <div className="flex flex-col">
              <span className="font-black text-sm uppercase tracking-tight">{u.display_name || "Anônimo"}</span>
              {u.user_id === currentUserId && <span className="text-[7px] text-blue-400 font-black uppercase tracking-widest mt-1 italic">Sua Conta</span>}
            </div>
          </div>
          <div className="text-right">
            <span className="text-xl font-black text-emerald-400 italic tracking-tighter">{u.total_presents}H</span>
          </div>
        </div>
      )) : <div className="p-10 text-center text-slate-700 font-black uppercase tracking-[0.3em] text-[10px] italic">Aguardando dados...</div>}
    </div>
  </div>
);

const NavItem = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex flex-col items-center justify-center px-5 py-3 rounded-2xl transition-all duration-300 ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 scale-105 z-10' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>
    {icon}
    <span className="text-[8px] font-black mt-2 uppercase tracking-[0.1em] italic">{label}</span>
  </button>
);

const MOCK_SUBJECTS = [
  {"id": "76B3", "name": "Análise de Algoritmos", "total_hours": 30},
  {"id": "76B4", "name": "Fund. Realidade Virtual", "total_hours": 30},
  {"id": "76B5", "name": "Sistemas Distribuídos", "total_hours": 60},
  {"id": "D541", "name": "Administração", "total_hours": 30},
  {"id": "J964", "name": "Engenharia de Software", "total_hours": 60},
  {"id": "D36B", "name": "CC Integrada", "total_hours": 30},
  {"id": "J732", "name": "Trabalho de Curso I", "total_hours": 30},
];

const SCHEDULE = [
  { subjectId: "76B3", weekday: "Wednesday", time: "19:10" },
  { subjectId: "76B4", weekday: "Wednesday", time: "20:45" },
  { subjectId: "76B5", weekday: "Friday", time: "19:10" },
  { subjectId: "76B5", weekday: "Friday", time: "20:45" },
  { subjectId: "D541", weekday: "Tuesday", time: "18:20" },
  { subjectId: "J964", weekday: "Thursday", time: "19:10" },
  { subjectId: "J964", weekday: "Thursday", time: "20:45" },
  { subjectId: "D36B", weekday: "Thursday", time: "18:20" },
  { subjectId: "J732", weekday: "Tuesday", time: "19:10" },
  { subjectId: "J732", weekday: "Tuesday", time: "20:45" },
];

export default App;