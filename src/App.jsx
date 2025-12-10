import React, { useState, useEffect } from 'react';
import { 
  MapPin, Calendar, CreditCard, CheckSquare, Users, Plus, 
  Plane, Ticket, Trash2, Utensils, ArrowLeft, Settings, 
  Car, RefreshCw, MoreVertical, Palmtree
} from 'lucide-react';

// ⚠️ 重要：請將此網址替換為您 Google Apps Script 部署後產生的網址
// 網址格式通常為: https://script.google.com/macros/s/您的ID/exec
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/您的ID/exec";

// --- API Helper (負責跟 Google Sheet 溝通) ---
const api = {
  fetch: async (sheet, tripId = null) => {
    let url = `${GOOGLE_SCRIPT_URL}?action=get&sheet=${sheet}`;
    if (tripId) url += `&tripId=${tripId}`;
    try {
        const res = await fetch(url);
        return await res.json();
    } catch (e) {
        console.error("Fetch error", e);
        return [];
    }
  },
  // 傳送資料到 Google Sheet
  post: async (action, sheet, data) => {
    // 使用 text/plain 避免瀏覽器發送 CORS 預檢請求 (Preflight)
    // Google Apps Script 會直接解析內容
    const payload = JSON.stringify({ action, sheet, data });
    await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        body: payload 
    });
  }
};

// --- Custom Hook (資料讀取掛鉤) ---
const useSheetData = (sheetName, tripId, refreshTrigger) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
        if (sheetName !== 'trips' && !tripId) return; // 如果不是旅程列表且沒選旅程，就不抓
        
        setLoading(true);
        const items = await api.fetch(sheetName, tripId);
        
        if (Array.isArray(items)) {
            // 簡單排序：如果有 createdAt 欄位就依時間倒序
            items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
            setData(items);
        }
        setLoading(false);
    };
    load();
  }, [sheetName, tripId, refreshTrigger]);

  return { data, loading };
};

// --- UI Components (樣式設定) ---
const theme = {
  bg: '#F7F4EB',
  text: '#5D5745',
  primary: '#88C9A1',
  shadow: '4px 4px 0px #E0E5D5',
};

const Card = ({ children, className = '', onClick }) => (
  <div 
    onClick={onClick}
    className={`bg-white rounded-3xl border-2 border-[#E6E0D0] transition-all relative overflow-hidden ${className}`}
    style={{ boxShadow: onClick ? theme.shadow : 'none', color: theme.text }}
  >
    <div className="p-4">{children}</div>
  </div>
);

const Button = ({ children, onClick, loading, className = '' }) => (
  <button 
    onClick={onClick}
    disabled={loading}
    className={`bg-[#88C9A1] text-white px-4 py-3 w-full rounded-2xl font-bold border-2 border-transparent active:scale-95 transition-all flex items-center justify-center gap-2 shadow-[0_4px_0_rgba(0,0,0,0.1)] disabled:opacity-50 ${className}`}
  >
    {loading ? <RefreshCw className="animate-spin" size={20} /> : children}
  </button>
);

// --- 頁面 1: 旅程選擇 (Trip Selection) ---
const TripSelection = ({ onSelectTrip, triggerRefresh }) => {
    const { data: trips, loading } = useSheetData('trips', null, triggerRefresh);

    const handleCreate = async () => {
        const title = prompt("旅程名稱 (例如: 東京跨年):");
        if (!title) return;
        const startDate = prompt("出發日期 (YYYY-MM-DD):", new Date().toISOString().split('T')[0]);
        
        // 呼叫 API 新增
        await api.post('add', 'trips', {
            title,
            startDate,
            coverEmoji: ['🇯🇵', '🇹🇭', '🇺🇸', '🇰🇷', '🇫🇷'][Math.floor(Math.random() * 5)]
        });
        
        // 強制重整頁面以讀取新資料 (簡單作法)
        window.location.reload();
    };

    return (
        <div className="space-y-6 animate-fade-in pb-20">
             <div className="flex justify-between items-end px-2">
                <div>
                    <h1 className="text-3xl font-black text-[#5D5745]">My Trips</h1>
                    <p className="text-gray-500 font-bold">Google Sheets 版</p>
                </div>
                <Palmtree size={32} className="text-[#88C9A1]" />
            </div>

            <div className="space-y-4">
                {loading ? <div className="text-center py-10 text-gray-400">讀取中...</div> : 
                 trips.length === 0 ? <div className="text-center py-10 opacity-50 border-2 border-dashed rounded-3xl">尚無旅程</div> :
                 trips.map(trip => (
                    <Card key={trip.id} onClick={() => onSelectTrip(trip)} className="active:scale-95 group">
                        <div className="flex gap-4 items-center">
                            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-3xl shadow-inner">
                                {trip.coverEmoji}
                            </div>
                            <div>
                                <h3 className="text-xl font-bold">{trip.title}</h3>
                                <div className="flex items-center gap-1 text-gray-400 text-sm mt-1 font-bold">
                                    <Calendar size={14} />
                                    {trip.startDate}
                                </div>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
            <Button onClick={handleCreate}><Plus /> 建立新旅程</Button>
        </div>
    );
};

// --- 頁面 2: 行程表 (Schedule) ---
const ScheduleTab = ({ trip, refreshTrigger, onUpdate }) => {
    const { data: events, loading } = useSheetData('events', trip.id, refreshTrigger);
    
    // 依時間排序
    const sortedEvents = events ? [...events].sort((a,b) => (a.time || '').localeCompare(b.time || '')) : [];

    const handleAdd = async () => {
        const title = prompt("行程名稱:");
        if (!title) return;
        const time = prompt("時間 (HH:MM):", "10:00");
        
        await api.post('add', 'events', {
            tripId: trip.id,
            title,
            time,
            type: 'spot',
            location: 'TBD'
        });
        onUpdate();
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if(confirm("刪除此行程?")) {
            await api.post('delete', 'events', { id });
            onUpdate();
        }
    };

    return (
        <div className="space-y-6 pb-24">
            {loading && <p className="text-center text-gray-400 text-xs animate-pulse">同步中...</p>}
            
            <div className="relative pl-4 border-l-2 border-dashed border-gray-300 ml-4 space-y-6 min-h-[300px]">
                {sortedEvents.length === 0 && !loading && <p className="text-gray-400 text-sm pl-4 pt-4">點擊下方按鈕新增行程</p>}
                
                {sortedEvents.map(event => (
                    <div key={event.id} className="relative pl-6 animate-fade-in">
                        <div className="absolute -left-[25px] top-3 w-4 h-4 rounded-full bg-white border-4 border-[#F2D0A4]"></div>
                        <Card>
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-lg">{event.title}</h3>
                                    <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
                                        <span className="font-mono bg-gray-100 px-1 rounded text-xs text-gray-600 font-bold">{event.time}</span>
                                        <span className="flex items-center gap-1"><MapPin size={12}/> {event.location}</span>
                                    </div>
                                </div>
                                <button onClick={(e) => handleDelete(e, event.id)} className="text-gray-200 hover:text-red-400">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </Card>
                    </div>
                ))}
            </div>
            <Button onClick={handleAdd}><Plus /> 新增行程</Button>
        </div>
    );
};

// --- 頁面 3: 記帳 (Expense) ---
const ExpenseTab = ({ trip, refreshTrigger, onUpdate }) => {
    const { data: expenses } = useSheetData('expenses', trip.id, refreshTrigger);
    const total = expenses ? expenses.reduce((acc, cur) => acc + Number(cur.amount || 0), 0) : 0;

    const handleAdd = async () => {
        const amount = prompt("金額 (TWD):");
        if (!amount) return;
        const item = prompt("項目名稱:");
        
        await api.post('add', 'expenses', {
            tripId: trip.id,
            amount,
            item: item || '未命名',
            payer: 'Me'
        });
        onUpdate();
    };

    return (
        <div className="space-y-6 pb-24">
            <Card className="!bg-[#5D5745] !text-white text-center py-6 !border-none">
                <p className="text-sm opacity-70 font-bold">總支出 (TWD)</p>
                <p className="text-4xl font-mono font-black mt-2">${total.toLocaleString()}</p>
                <div className="mt-4 pt-4 border-t border-white/10 text-xs opacity-50">
                    目前只有您可以檢視此帳本
                </div>
            </Card>

            <div className="space-y-3">
                {expenses && expenses.map(e => (
                    <div key={e.id} className="flex justify-between items-center bg-white p-4 rounded-2xl border border-[#E6E0D0] shadow-sm animate-fade-in">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-[#5D5745]">
                                <CreditCard size={18}/>
                            </div>
                            <span className="font-bold">{e.item}</span>
                        </div>
                        <span className="font-mono font-bold text-lg">${Number(e.amount).toLocaleString()}</span>
                    </div>
                ))}
            </div>
            <Button onClick={handleAdd} className="fixed bottom-24 left-6 right-6 w-auto shadow-xl z-10"><Plus /> 記一筆</Button>
        </div>
    );
};

// --- 頁面 4: 待辦清單 (Todos) ---
const TodoTab = ({ trip, refreshTrigger, onUpdate }) => {
    const { data: todos } = useSheetData('todos', trip.id, refreshTrigger);

    const handleAdd = async () => {
        const text = prompt("待辦事項:");
        if (!text) return;
        await api.post('add', 'todos', { tripId: trip.id, text, done: false });
        onUpdate();
    };

    const toggle = async (todo) => {
        // Optimistic UI (先在前端假裝變更，實際 API 請求在背景跑)
        // 這裡為了簡化，直接發送請求並重整
        const newStatus = !(todo.done === true || todo.done === 'TRUE');
        await api.post('update', 'todos', { id: todo.id, updates: { done: newStatus } });
        onUpdate();
    };

    return (
        <div className="space-y-3 pb-24">
            {todos && todos.map(t => {
                const isDone = t.done === true || t.done === 'TRUE';
                return (
                    <div key={t.id} onClick={() => toggle(t)} className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-[#E6E0D0] shadow-sm cursor-pointer active:scale-95 transition-all">
                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${isDone ? 'bg-[#88C9A1] border-[#88C9A1]' : 'border-gray-300'}`}>
                            {isDone && <CheckSquare size={14} className="text-white"/>}
                        </div>
                        <span className={`font-bold flex-1 ${isDone ? 'line-through text-gray-400' : ''}`}>{t.text}</span>
                    </div>
                );
            })}
            <div 
                onClick={handleAdd}
                className="border-2 border-dashed border-[#E6E0D0] rounded-2xl p-4 flex items-center justify-center gap-2 text-gray-400 cursor-pointer hover:bg-white/50 transition-colors"
            >
                <Plus size={18} /> 添加新項目
            </div>
        </div>
    );
};

// --- 主應用程式 (App Root) ---
export default function App() {
  const [currentTrip, setCurrentTrip] = useState(null);
  const [activeTab, setActiveTab] = useState('schedule');
  const [refreshCount, setRefreshCount] = useState(0);

  const triggerRefresh = () => setRefreshCount(c => c + 1);

  // 根據 Google Apps Script 的資料結構，我們使用 tabs 來切換介面
  const tabs = [
    { id: 'schedule', icon: Calendar, label: '行程' },
    { id: 'bookings', icon: Ticket, label: '預訂' }, // 暫未實作完整邏輯
    { id: 'expense', icon: CreditCard, label: '記帳' },
    { id: 'planning', icon: CheckSquare, label: '清單' },
  ];

  return (
    <div className="min-h-screen font-sans text-[#5D5745]" style={{ backgroundColor: theme.bg }}>
      <div className="max-w-md mx-auto min-h-screen relative bg-[#F7F4EB] shadow-2xl flex flex-col overflow-hidden">
        {/* 背景紋理 */}
        <div 
            className="fixed inset-0 pointer-events-none opacity-20"
            style={{ backgroundImage: `radial-gradient(#5D5745 1px, transparent 1px)`, backgroundSize: '24px 24px' }}
        />

        <main className="flex-1 p-6 relative z-10 overflow-y-auto hide-scrollbar">
            {!currentTrip ? (
                <TripSelection onSelectTrip={setCurrentTrip} triggerRefresh={refreshCount} />
            ) : (
                <div className="animate-fade-in">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <button onClick={() => setCurrentTrip(null)} className="p-2 -ml-2 text-gray-400 hover:text-[#5D5745] flex items-center gap-1 transition-colors">
                            <ArrowLeft size={20} />
                            <span className="font-bold text-xs">返回</span>
                        </button>
                        <div className="text-center">
                            <h2 className="font-black text-lg">{currentTrip.title}</h2>
                            <p className="text-xs text-gray-500 font-bold">{currentTrip.startDate}</p>
                        </div>
                        <button className="p-2 -mr-2 text-gray-400"><Settings size={20}/></button>
                    </div>

                    {/* Content */}
                    {activeTab === 'schedule' && <ScheduleTab trip={currentTrip} refreshTrigger={refreshCount} onUpdate={triggerRefresh} />}
                    {activeTab === 'expense' && <ExpenseTab trip={currentTrip} refreshTrigger={refreshCount} onUpdate={triggerRefresh} />}
                    {activeTab === 'planning' && <TodoTab trip={currentTrip} refreshTrigger={refreshCount} onUpdate={triggerRefresh} />}
                    {activeTab === 'bookings' && <div className="text-center py-20 text-gray-400">預訂功能開發中...</div>}
                </div>
            )}
        </main>

        {/* Bottom Navigation */}
        {currentTrip && (
            <div className="fixed bottom-0 left-0 w-full bg-white border-t border-[#E6E0D0] px-6 py-2 pb-6 flex justify-between items-end z-50 rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.05)] max-w-md mx-auto left-0 right-0">
                {tabs.map(tab => {
                    const isActive = activeTab === tab.id;
                    const Icon = tab.icon;
                    return (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)} className="relative flex flex-col items-center gap-1 w-12 transition-all">
                            <div className={`p-3 rounded-2xl transition-all ${isActive ? 'bg-[#5D5745] text-white -translate-y-4 shadow-lg scale-110' : 'text-gray-300'}`}>
                                <Icon size={20} strokeWidth={isActive ? 3 : 2} />
                            </div>
                            <span className={`text-[10px] font-bold absolute -bottom-1 transition-opacity ${isActive ? 'opacity-100 text-[#5D5745]' : 'opacity-0'}`}>
                                {tab.label}
                            </span>
                        </button>
                    )
                })}
            </div>
        )}
      </div>
      
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Varela+Round&display=swap');
        body { font-family: 'Varela Round', sans-serif; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
}
