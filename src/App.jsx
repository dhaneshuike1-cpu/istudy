
import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  AlarmClock, BookOpen, CalendarDays, Check, ChevronDown, CircleHelp,
  Coffee, Flame, Goal, History, LayoutDashboard, Pause, Play, Plus,
  RotateCcw, Settings2, Square, TimerReset, TrendingUp, Volume2, VolumeX
} from 'lucide-react';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';

const STUDY_SECONDS = 60 * 60;
const BREAK_SECONDS = 15 * 60;
const SUBJECTS = ['DSA', 'Java', 'Computer Networks', 'Machine Learning', 'Other'];
const STORAGE_KEY = 'istudy-v1';


function localDay(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatTime(total) {
  const seconds = Math.max(0, Math.floor(total));
  return `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
function readStore() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      logs: Array.isArray(saved.logs) ? saved.logs : [],
      timer: saved.timer || null,
      subject: saved.subject || 'DSA',
      goalHours: Number(saved.goalHours) || 4
    };
  } catch {
    return { logs: [], timer: null, subject: 'DSA', goalHours: 4 };
  }
}
function saveStore(value) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch (error) {
    console.error("Could not save iStudy data:", error);
  }
}
function getRemaining(timer, now = Date.now()) {
  if (!timer) return STUDY_SECONDS;
  const duration = timer.phase === 'study' ? STUDY_SECONDS : BREAK_SECONDS;
  if (timer.status !== 'running') return timer.remaining ?? duration;
  return Math.max(0, Math.ceil((timer.endsAt - now) / 1000));
}
function getTodayStudy(logs) {
  return logs.filter(log => log.date === localDay() && log.type === 'study')
    .reduce((sum, log) => sum + log.seconds, 0);
}
function getStreak(logs) {
  const days = new Set(logs.filter(l => l.type === 'study' && l.seconds > 0).map(l => l.date));
  let streak = 0;
  const date = new Date();
  if (!days.has(localDay(date))) date.setDate(date.getDate() - 1);
  while (days.has(localDay(date))) {
    streak++;
    date.setDate(date.getDate() - 1);
  }
  return streak;
}
function makeChart(logs) {
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const key = localDay(date);
    const seconds = logs.filter(l => l.date === key && l.type === 'study')
      .reduce((sum, l) => sum + l.seconds, 0);
    return { day: date.toLocaleDateString('en', { weekday: 'short' }), hours: +(seconds / 3600).toFixed(2) };
  });
}
function playBeep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 880; gain.gain.value = 0.12;
    osc.start(); osc.stop(ctx.currentTime + 0.22);
    osc.onended = () => ctx.close();
  } catch {}
}

export default function App() {
  const initial = useMemo(readStore, []);
  const [logs, setLogs] = useState(initial.logs);
  const [timer, setTimer] = useState(initial.timer || {
    phase: 'study', status: 'idle', remaining: STUDY_SECONDS, subject: initial.subject
  });
  const [subject, setSubject] = useState(initial.subject);
  const [goalHours, setGoalHours] = useState(initial.goalHours);
  const [now, setNow] = useState(Date.now());
  const [sound, setSound] = useState(true);
  const [newSubject, setNewSubject] = useState('');
  const [subjects, setSubjects] = useState(SUBJECTS);
  const [showAddSubject, setShowAddSubject] = useState(false);
  const lastPhaseRef = useRef(timer.phase);

  useEffect(() => {
    saveStore({ logs, timer, subject, goalHours });
  }, [logs, timer, subject, goalHours]);

  // Use end timestamps instead of counting ticks so the timer stays accurate if a tab sleeps.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (timer.status !== 'running') return;
    const remaining = getRemaining(timer, now);
    if (remaining > 0) return;

    if (timer.phase === 'study') {
      setLogs(old => [...old, {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        date: localDay(), type: 'study', subject: timer.subject || subject,
        seconds: STUDY_SECONDS, completedAt: new Date().toISOString()
      }]);
      setTimer({
        phase: 'break', status: 'running', remaining: BREAK_SECONDS,
        startedAt: Date.now(), endsAt: Date.now() + BREAK_SECONDS * 1000,
        subject: timer.subject || subject
      });
      lastPhaseRef.current = 'break';
      if (sound) playBeep();
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('iStudy: Break time!', { body: 'You completed 60 minutes. Take a 15-minute break.' });
      }
    } else {
      setTimer({
        phase: 'study', status: 'running', remaining: STUDY_SECONDS,
        startedAt: Date.now(), endsAt: Date.now() + STUDY_SECONDS * 1000,
        subject
      });
      lastPhaseRef.current = 'study';
      if (sound) playBeep();
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('iStudy: Back to focus', { body: 'Your break is over. A new study session has started.' });
      }
    }
  }, [now, timer, subject, sound]);

  const phaseDuration = timer.phase === 'study' ? STUDY_SECONDS : BREAK_SECONDS;
  const remaining = getRemaining(timer, now);
  const elapsed = phaseDuration - remaining;
  const progress = Math.min(100, Math.max(0, (elapsed / phaseDuration) * 100));
  const todaySeconds = getTodayStudy(logs);
  const chartData = useMemo(() => makeChart(logs), [logs]);
  const streak = getStreak(logs);
  const sessionsToday = logs.filter(l => l.date === localDay() && l.type === 'study').length;
  const subjectTotals = useMemo(() => subjects.map(name => ({
    name,
    seconds: logs.filter(l => l.type === 'study' && l.subject === name)
      .reduce((sum, l) => sum + l.seconds, 0)
  })).filter(s => s.seconds > 0).sort((a, b) => b.seconds - a.seconds), [logs, subjects]);

  function startTimer() {
    const currentPhase = timer.phase || 'study';
    const duration = currentPhase === 'study' ? STUDY_SECONDS : BREAK_SECONDS;
    const left = timer.status === 'paused' ? (timer.remaining ?? duration) : duration;
    setTimer({
      ...timer, phase: currentPhase, status: 'running', remaining: left,
      startedAt: Date.now(), endsAt: Date.now() + left * 1000,
      subject: currentPhase === 'study' ? subject : timer.subject
    });
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }
  function pauseTimer() {
    setTimer({ ...timer, status: 'paused', remaining: getRemaining(timer), endsAt: null });
  }
  function resetTimer() {
    setTimer({ phase: 'study', status: 'idle', remaining: STUDY_SECONDS, subject });
  }
  function skipPhase() {
    if (timer.phase === 'study') {
      setLogs(old => [...old, {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        date: localDay(), type: 'study', subject: timer.subject || subject,
        seconds: Math.max(0, STUDY_SECONDS - remaining), completedAt: new Date().toISOString()
      }].filter(l => l.seconds > 0));
      setTimer({ phase: 'break', status: 'running', remaining: BREAK_SECONDS, startedAt: Date.now(), endsAt: Date.now() + BREAK_SECONDS * 1000, subject });
    } else {
      setTimer({ phase: 'study', status: 'running', remaining: STUDY_SECONDS, startedAt: Date.now(), endsAt: Date.now() + STUDY_SECONDS * 1000, subject });
    }
  }
  function clearHistory() {
    if (window.confirm('Delete all study history? This cannot be undone.')) setLogs([]);
  }
  function addSubject(e) {
    e.preventDefault();
    const clean = newSubject.trim();
    if (clean && !subjects.some(s => s.toLowerCase() === clean.toLowerCase())) {
      setSubjects(old => [...old, clean]);
      setSubject(clean);
      setNewSubject('');
      setShowAddSubject(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><BookOpen size={21} /></div><span>iStudy</span><span className="brand-dot">.</span></div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          <a className="nav-item active" href="#dashboard"><LayoutDashboard size={18}/><span>Dashboard</span></a>
          <a className="nav-item" href="#subjects"><BookOpen size={18}/><span>Subjects</span></a>
          <a className="nav-item" href="#history"><History size={18}/><span>Study history</span></a>
        </nav>
        <div className="sidebar-bottom">
          <div className="quote-icon"><Goal size={20}/></div>
          <p className="quote-title">Small steps every day.</p>
          <p className="quote-copy">Consistency beats intensity. Keep showing up.</p>
          <div className="sidebar-foot"><span className="status-dot"></span> Your progress is saved on this device</div>
        </div>
      </aside>

      <main className="main-content" id="dashboard">
        <header className="topbar">
          <div><div className="eyebrow"><CalendarDays size={14}/> YOUR PERSONAL STUDY SPACE</div><h1>Good focus starts here.</h1><p className="subtitle">A little progress each day adds up to big results.</p></div>
          <div className="date-pill"><CalendarDays size={16}/>{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</div>
        </header>

        <section className="stats-grid">
          <div className="stat-card"><div className="stat-icon violet"><AlarmClock size={19}/></div><div className="stat-label">STUDY TIME TODAY</div><div className="stat-value">{(todaySeconds / 3600).toFixed(1)}<small> hrs</small></div><div className="stat-foot">Across completed sessions</div></div>
          <div className="stat-card"><div className="stat-icon blue"><Check size={19}/></div><div className="stat-label">SESSIONS COMPLETED</div><div className="stat-value">{sessionsToday}<small> sessions</small></div><div className="stat-foot">60-minute focus blocks</div></div>
          <div className="stat-card"><div className="stat-icon orange"><Flame size={19}/></div><div className="stat-label">STUDY STREAK</div><div className="stat-value">{streak}<small> days</small></div><div className="stat-foot">Keep your momentum going</div></div>
          <div className="stat-card"><div className="stat-icon green"><Goal size={19}/></div><div className="stat-label">DAILY GOAL</div><div className="stat-value">{Math.min(100, Math.round(todaySeconds / (goalHours * 3600) * 100))}<small>%</small></div><div className="goal-mini"><span style={{width:`${Math.min(100, todaySeconds / (goalHours * 3600) * 100)}%`}}/></div><div className="stat-foot">{(todaySeconds / 3600).toFixed(1)} of {goalHours} hours</div></div>
        </section>

        <section className="content-grid">
          <div className={`timer-card ${timer.phase === 'break' ? 'break-mode' : ''}`}>
            <div className="card-heading"><div><div className="section-kicker">FOCUS ROOM</div><h2>{timer.phase === 'study' ? 'Time to focus' : 'Take a breather'}</h2></div><span className={`phase-badge ${timer.phase}`}>{timer.phase === 'study' ? <><BookOpen size={13}/> STUDY SESSION</> : <><Coffee size={13}/> BREAK TIME</>}</span></div>
            <div className="timer-wrap">
              <svg className="timer-ring" viewBox="0 0 260 260" role="img" aria-label={`${formatTime(remaining)} remaining`}>
                <circle className="ring-track" cx="130" cy="130" r="112"/>
                <circle className="ring-progress" cx="130" cy="130" r="112" style={{strokeDasharray: 2 * Math.PI * 112, strokeDashoffset: 2 * Math.PI * 112 * (1 - progress / 100)}}/>
              </svg>
              <div className="timer-center"><div className="timer-phase">{timer.status === 'paused' ? 'PAUSED' : timer.status === 'running' ? (timer.phase === 'study' ? 'STAY FOCUSED' : 'REST & RESET') : 'READY WHEN YOU ARE'}</div><div className="time-digits">{formatTime(remaining)}</div><div className="timer-hint">{timer.phase === 'study' ? 'minutes of deep work' : 'minutes to recharge'}</div></div>
            </div>
            <div className="timer-meta"><span><span className={`live-dot ${timer.status === 'running' ? 'on' : ''}`}></span>{timer.status === 'running' ? 'Timer is running' : timer.status === 'paused' ? 'Timer paused' : 'Timer not started'}</span><span>{timer.phase === 'study' ? '60 min focus' : '15 min break'}</span></div>
            {timer.phase === 'study' && <div className="subject-picker"><label htmlFor="subject">STUDYING</label><div className="select-wrap"><BookOpen size={16}/><select id="subject" value={subject} onChange={e => {setSubject(e.target.value); if(timer.status === 'idle' || timer.status === 'paused') setTimer(t => ({...t, subject:e.target.value}));}} disabled={timer.status === 'running'}>{subjects.map(s => <option key={s}>{s}</option>)}</select><ChevronDown size={15}/></div><button className="add-subject" title="Add subject" onClick={() => setShowAddSubject(v => !v)}><Plus size={17}/></button></div>}
            {showAddSubject && <form className="add-subject-form" onSubmit={addSubject}><input autoFocus value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="New subject name" maxLength={35}/><button type="submit">Add</button></form>}
            <div className="timer-actions">
              {timer.status === 'running' ? <button className="primary-button" onClick={pauseTimer}><Pause size={17} fill="currentColor"/> Pause</button> : <button className="primary-button" onClick={startTimer}><Play size={17} fill="currentColor"/> {timer.status === 'paused' ? 'Resume timer' : 'Start studying'}</button>}
              <button className="secondary-button" onClick={resetTimer} title="Reset timer"><RotateCcw size={17}/> Reset</button>
              <button className="icon-button" onClick={() => setSound(v => !v)} title={sound ? 'Mute sounds' : 'Enable sounds'}>{sound ? <Volume2 size={17}/> : <VolumeX size={17}/>}</button>
              <button className="icon-button" onClick={skipPhase} title="Skip to next phase"><TimerReset size={17}/></button>
            </div>
            <div className="cycle-note"><CircleHelp size={14}/> Study → 15-minute break → study again, automatically.</div>
          </div>

          <div className="right-column">
            <div className="panel chart-panel">
              <div className="panel-header"><div><div className="section-kicker">YOUR CONSISTENCY</div><h2>Study activity</h2></div><span className="chart-period">Last 7 days <ChevronDown size={13}/></span></div>
              <div className="chart-summary"><strong>{chartData.reduce((s,d)=>s+d.hours,0).toFixed(1)}h</strong><span>total focused time this week</span></div>
              <div className="chart-area"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{top:10,right:4,left:-22,bottom:0}}><defs><linearGradient id="studyFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8172f3" stopOpacity={0.25}/><stop offset="95%" stopColor="#8172f3" stopOpacity={0.01}/></linearGradient></defs><CartesianGrid strokeDasharray="3 4" vertical={false} stroke="#263147"/><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill:'#8590a7',fontSize:11}} dy={9}/><YAxis axisLine={false} tickLine={false} tick={{fill:'#8590a7',fontSize:11}} tickFormatter={v=>`${v}h`} width={34}/><Tooltip contentStyle={{background:'#151f31',border:'1px solid #303c53',borderRadius:10,color:'#f4f6fb'}} formatter={v=>[`${v} hours`,'Study time']}/><Area type="monotone" dataKey="hours" stroke="#9b8cff" strokeWidth={2.5} fill="url(#studyFill)" activeDot={{r:5,fill:'#b7adff',stroke:'#151f31',strokeWidth:2}}/></AreaChart></ResponsiveContainer></div>
              <div className="chart-legend"><span><i></i> Study hours</span><span>Daily goal: {goalHours}h</span></div>
            </div>

            <div className="panel goal-panel">
              <div className="panel-header"><div><div className="section-kicker">DAILY TARGET</div><h2>Today's goal</h2></div><div className="goal-icon"><Goal size={18}/></div></div>
              <div className="goal-progress-row"><div><strong>{(todaySeconds/3600).toFixed(1)}<small>h</small></strong><span> completed</span></div><div className="goal-percent">{Math.min(100,Math.round(todaySeconds/(goalHours*3600)*100))}%</div></div>
              <div className="goal-track"><span style={{width:`${Math.min(100,todaySeconds/(goalHours*3600)*100)}%`}}/></div>
              <div className="goal-bottom"><span>{Math.max(0,goalHours-todaySeconds/3600).toFixed(1)} hours left to reach goal</span><label>Daily goal <select value={goalHours} onChange={e=>setGoalHours(Number(e.target.value))}>{[1,2,3,4,5,6,8,10].map(h=><option key={h} value={h}>{h}h</option>)}</select></label></div>
            </div>
          </div>
        </section>

        <section className="bottom-grid">
          <div className="panel subjects-panel" id="subjects">
            <div className="panel-header"><div><div className="section-kicker">WHERE YOUR TIME GOES</div><h2>Subject breakdown</h2></div><BookOpen className="muted-icon" size={19}/></div>
            {subjectTotals.length ? <div className="subject-list">{subjectTotals.slice(0,5).map((item,i)=>{const total=subjectTotals.reduce((s,x)=>s+x.seconds,0);return <div className="subject-row" key={item.name}><div className={`subject-symbol color-${i%5}`}>{item.name.slice(0,1).toUpperCase()}</div><div className="subject-details"><div className="subject-name-row"><strong>{item.name}</strong><span>{(item.seconds/3600).toFixed(1)}h</span></div><div className="subject-track"><span className={`bar-${i%5}`} style={{width:`${total ? item.seconds/total*100 : 0}%`}}/></div></div></div>})}</div> : <div className="empty-state"><div className="empty-icon"><TrendingUp size={22}/></div><strong>Your subject stats will appear here</strong><span>Complete a study session to start building your history.</span></div>}
          </div>
          <div className="panel history-panel" id="history">
            <div className="panel-header"><div><div className="section-kicker">RECENT ACTIVITY</div><h2>Study history</h2></div><button className="text-button" onClick={clearHistory} disabled={!logs.length}>Clear history</button></div>
            {logs.length ? <div className="history-list">{[...logs].reverse().slice(0,5).map(log=><div className="history-row" key={log.id}><div className="history-symbol"><Check size={16}/></div><div className="history-detail"><strong>{log.subject}</strong><span>{new Date(log.completedAt).toLocaleDateString('en-IN',{day:'numeric',month:'short'})} · {new Date(log.completedAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</span></div><div className="history-duration">+{(log.seconds/3600).toFixed(2)}h</div></div>)}</div> : <div className="empty-state compact"><div className="empty-icon"><History size={21}/></div><strong>No sessions yet</strong><span>Your completed study blocks will show up here.</span></div>}
          </div>
        </section>
        <footer className="footer"><span>iStudy <span className="brand-dot">.</span> Built for better focus.</span><span><span className="status-dot"></span> Your data stays in this browser</span></footer>
      </main>
    </div>
  );
}