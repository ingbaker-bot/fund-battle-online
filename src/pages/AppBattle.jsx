import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, ResponsiveContainer, ComposedChart, ReferenceDot 
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Activity, MousePointer2, LogOut, Check, X, 
  Trophy, AlertCircle, Clock, Users, Zap, Shield, Sword, User, Loader2, Waves,
  BrainCircuit, Lightbulb, Award, ArrowUpRight, ArrowDownRight // ★ 新增 AI 相關圖示
} from 'lucide-react';
import { doc, getDoc, onSnapshot, updateDoc, arrayUnion } from 'firebase/firestore';
import { signInAnonymously, updateProfile } from 'firebase/auth'; 
import { db, auth } from '../config/firebase';

// ★★★ 1. 引入 AI 分析模組 (請確認 useAIAnalyst.js 已存在且 export 正確) ★★★
import { generateAIAnalysis } from '../hooks/useAIAnalyst';

// ============================================
// 1. 繪圖輔助函式 (保持 V11.0 原樣)
// ============================================
const renderTriangle = (props) => {
    const { cx, cy, fill } = props;
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
    return (
        <polygon 
            points={`${cx},${cy-6} ${cx-6},${cy+6} ${cx+6},${cy+6}`} 
            fill={fill} 
            stroke="white" 
            strokeWidth={2}
        />
    );
};

const calculateIndicators = (data, days, currentIndex) => {
  if (!data || currentIndex < days) return { ma: null, stdDev: null };
  let sum = 0;
  const values = [];
  for (let i = 0; i < days; i++) { 
      const val = data[currentIndex - i]?.nav;
      if (val && !isNaN(val)) { sum += val; values.push(val); }
  }
  const ma = sum / days;
  let sumDiffSq = 0;
  values.forEach(v => { const diff = v - ma; sumDiffSq += diff * diff; });
  const stdDev = Math.sqrt(sumDiffSq / days);
  return { ma: parseFloat(ma.toFixed(2)), stdDev: parseFloat(stdDev.toFixed(2)) };
};

// ============================================
// 主元件：AppBattle (V11.0 + AI Patch)
// ============================================
export default function AppBattle() {
  const { battleId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  
  // 戰鬥狀態
  const [battleData, setBattleData] = useState(null);
  const [fundData, setFundData] = useState([]);
  const [myPlayer, setMyPlayer] = useState(null);
  
  // 訪客加入狀態 (保持 V11.0 原樣)
  const [nickName, setNickName] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  // 交易操作 UI 狀態
  const [tradeMode, setTradeMode] = useState(null);
  const [inputAmount, setInputAmount] = useState('');
  
  // 圖表狀態
  const [showMA20, setShowMA20] = useState(true);
  const [showMA60, setShowMA60] = useState(true);
  const [showRiver, setShowRiver] = useState(false);
  const [chartPeriod, setChartPeriod] = useState(120); 

  // ★★★ 2. 新增 AI 分析所需的狀態 ★★★
  const [transactions, setTransactions] = useState([]); // 本地記錄交易，給 AI 算勝率用
  const [aiReport, setAiReport] = useState(null);       // 存放 AI 分析結果

  // 1. 驗證登入 (保持 V11.0 原樣)
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // 2. 監聽戰鬥室數據 (保持 V11.0 原樣)
  useEffect(() => {
    if (!battleId) return;
    const battleRef = doc(db, 'battles', battleId);
    const unsub = onSnapshot(battleRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setBattleData(data);
        
        // 檢查自己是否在玩家名單中
        if (auth.currentUser && data.players) {
          const me = data.players.find(p => p.uid === auth.currentUser.uid);
          setMyPlayer(me);
        }
      } else {
        alert('戰鬥室已關閉'); navigate('/');
      }
    });
    return () => unsub();
  }, [battleId, user, navigate]);

  // 3. 載入基金數據 (保持 V11.0 原樣)
  useEffect(() => {
    const loadFund = async () => {
      if (battleData && battleData.fundId && fundData.length === 0) {
        try {
          const fundUrl = battleData.fundUrl || '/data/fund_data_1.json'; 
          if (fundUrl) {
              const res = await fetch(fundUrl);
              const json = await res.json();
              const processed = json.map((item, index) => ({
                id: index,
                date: item.date,
                nav: parseFloat(item.nav)
              }));
              setFundData(processed);
          }
        } catch (err) {
          console.error("基金載入失敗", err);
        }
      }
    };
    loadFund();
  }, [battleData?.fundId]); 

  // ★★★ 4. 新增：結算時觸發 AI 分析 ★★★
  useEffect(() => {
      // 只有當遊戲狀態變成 'ended' 且還沒產生過報告時執行
      if (battleData?.status === 'ended' && fundData.length > 0 && myPlayer && !aiReport) {
          const currentIdx = battleData.currentDay;
          const battleHistory = fundData.slice(0, currentIdx + 1);
          const finalAssets = myPlayer.cash + (myPlayer.units * fundData[currentIdx].nav);
          
          // 呼叫 AI 分析函數
          const report = generateAIAnalysis(
              transactions,   
              battleHistory,  
              1000000,        
              finalAssets     
          );
          setAiReport(report);
      }
  }, [battleData?.status, fundData, myPlayer, transactions, battleData?.currentDay, aiReport]);

  // 5. 圖表數據計算 (保持 V11.0 原樣)
  const chartDataInfo = useMemo(() => {
    if (!fundData.length || !battleData) return { data: [], domain: [0, 100] };
    
    const currentIdx = battleData.currentDay;
    const start = Math.max(0, currentIdx - chartPeriod);
    const end = currentIdx + 1;
    
    // 河流圖參數
    const riverMode = 'fixed'; 
    const riverWidthInput = 10;
    const riverSDMultiplier = 2;

    const slice = fundData.slice(start, end).map((d, idx) => {
        const realIdx = start + idx;
        const ind20 = calculateIndicators(fundData, 20, realIdx);
        const ind60 = calculateIndicators(fundData, 60, realIdx);
        const ma20 = ind20.ma; const ma60 = ind60.ma; const stdDev60 = ind60.stdDev;
        
        let riverTop = null; let riverBottom = null;
        if (ma60) {
            if (riverMode === 'fixed') { 
                const ratio = riverWidthInput / 100; 
                riverTop = ma60 * (1 + ratio); 
                riverBottom = ma60 * (1 - ratio); 
            } else { 
                if (stdDev60) { 
                    riverTop = ma60 + (stdDev60 * riverSDMultiplier); 
                    riverBottom = ma60 - (stdDev60 * riverSDMultiplier); 
                } 
            }
        }
        return { ...d, displayDate: d.date, ma20, ma60, riverTop, riverBottom };
    });

    let min = Infinity, max = -Infinity;
    slice.forEach(d => {
        const values = [d.nav, showMA20 ? d.ma20 : null, showMA60 ? d.ma60 : null, showRiver ? d.riverTop : null, showRiver ? d.riverBottom : null];
        values.forEach(v => { if (v !== null && !isNaN(v)) { if (v < min) min = v; if (v > max) max = v; } });
    });
    if (min === Infinity) min = 0;
    const padding = (max - min) * 0.1;
    const domainMin = Math.max(0, Math.floor(min - padding));
    const domainMax = Math.ceil(max + padding);

    return { data: slice, domain: [domainMin, domainMax] };
  }, [fundData, battleData?.currentDay, showMA20, showMA60, showRiver, chartPeriod]);

  // 加入戰局邏輯 (保持 V11.0 原樣)
  const handleJoinBattle = async () => {
      if (!nickName.trim()) return alert("請輸入暱稱");
      setIsJoining(true);
      try {
          let currentUser = auth.currentUser;
          if (!currentUser) {
              const userCred = await signInAnonymously(auth);
              currentUser = userCred.user;
          }
          await updateProfile(currentUser, { displayName: nickName });
          const newPlayer = {
              uid: currentUser.uid,
              displayName: nickName,
              cash: 1000000,
              units: 0,
              avgCost: 0,
              isReady: true
          };
          const battleRef = doc(db, 'battles', battleId);
          await updateDoc(battleRef, { players: arrayUnion(newPlayer) });
      } catch (error) {
          console.error("加入失敗", error);
          alert("加入失敗，請重試");
      } finally {
          setIsJoining(false);
      }
  };

  // 交易執行邏輯 (微調：加入 setTransactions)
  const executeTrade = async (type) => {
    if (!myPlayer || !battleData) return;
    const currentNav = fundData[battleData.currentDay]?.nav;
    if (!currentNav) return;

    let amount = parseFloat(inputAmount);
    if (!amount || amount <= 0) return;

    let newCash = myPlayer.cash;
    let newUnits = myPlayer.units;
    let newAvgCost = myPlayer.avgCost;
    
    // 交易計算
    if (type === 'BUY') {
        if (amount > newCash) amount = newCash; 
        if (amount < 1) return;
        const buyUnits = amount / currentNav;
        newAvgCost = ((newUnits * newAvgCost) + amount) / (newUnits + buyUnits);
        newUnits += buyUnits;
        newCash -= amount;

        // ★ 新增：紀錄買入 (給 AI 用)
        setTransactions(prev => [...prev, {
            day: battleData.currentDay,
            type: 'BUY',
            price: currentNav,
            units: buyUnits,
            amount: amount,
            balance: newCash
        }]);

    } else {
        let sellUnits = amount / currentNav;
        if (sellUnits > newUnits) sellUnits = newUnits;
        const sellAmount = sellUnits * currentNav;
        const pnl = sellAmount - (sellUnits * newAvgCost); // 計算損益
        newCash += sellAmount;
        newUnits -= sellUnits;
        if (newUnits < 0.0001) { newUnits = 0; newAvgCost = 0; }

        // ★ 新增：紀錄賣出 (給 AI 用)
        setTransactions(prev => [...prev, {
            day: battleData.currentDay,
            type: 'SELL',
            price: currentNav,
            units: sellUnits,
            amount: sellAmount,
            balance: newCash,
            pnl: pnl
        }]);
    }

    const playerIndex = battleData.players.findIndex(p => p.uid === auth.currentUser.uid);
    if (playerIndex === -1) return;

    const updatedPlayers = [...battleData.players];
    updatedPlayers[playerIndex] = {
        ...updatedPlayers[playerIndex],
        cash: newCash,
        units: newUnits,
        avgCost: newAvgCost,
    };

    const battleRef = doc(db, 'battles', battleId);
    await updateDoc(battleRef, { players: updatedPlayers });
    setTradeMode(null);
    setInputAmount('');
  };

  const setTradePercent = (pct, type) => {
      if (type === 'BUY') {
          if (pct === 1) setInputAmount(myPlayer.cash.toString());
          else setInputAmount(Math.floor(myPlayer.cash * pct).toString());
      } else {
          const totalValue = myPlayer.units * fundData[battleData.currentDay].nav;
          if (pct === 1) setInputAmount(totalValue.toString());
          else setInputAmount((totalValue * pct).toFixed(0));
      }
  };

  // === 畫面渲染 ===

  if (!battleData) return <div className="h-screen flex items-center justify-center bg-slate-900 text-white"><Loader2 className="animate-spin mr-2"/> 連線戰場中...</div>;

  // 訪客加入大廳 (保留 V11.0 邏輯：沒加入前顯示這個)
  if (!myPlayer) {
      return (
          <div className="h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white">
              <div className="w-full max-w-sm bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-2xl">
                  <div className="text-center mb-6">
                      <Sword size={48} className="mx-auto text-amber-500 mb-2"/>
                      <h2 className="text-2xl font-bold">加入戰局</h2>
                      <p className="text-slate-400 text-sm mt-1">S1 賽季多人對戰</p>
                  </div>
                  <div className="space-y-4">
                      <div>
                          <label className="text-xs text-slate-400 ml-1">您的暱稱</label>
                          <input type="text" value={nickName} onChange={(e) => setNickName(e.target.value)} placeholder="請輸入暱稱 (例: 股海小童)" className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white focus:border-amber-500 outline-none mt-1"/>
                      </div>
                      <button onClick={handleJoinBattle} disabled={isJoining} className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                          {isJoining ? <Loader2 className="animate-spin"/> : <UserPlus size={20}/>} 立即參戰
                      </button>
                  </div>
              </div>
          </div>
      );
  }

  // 等待數據
  if (fundData.length === 0) return <div className="h-screen flex items-center justify-center bg-slate-900 text-white"><Loader2 className="animate-spin mr-2"/> 下載數據中...</div>;

  const currentNav = fundData[battleData.currentDay]?.nav || 0;
  const totalAssets = myPlayer.cash + (myPlayer.units * currentNav);
  const roi = ((totalAssets - 1000000) / 1000000 * 100);

  return (
    <div className="h-screen bg-slate-50 flex flex-col font-sans text-slate-800 relative">
      
      {/* ★★★ 5. AI 結算視窗 (Overlay) - 只有結束且有報告時才顯示 ★★★ */}
      {battleData.status === 'ended' && aiReport && (
          <div className="absolute inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-in fade-in duration-500 overflow-y-auto">
              <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 my-auto">
                  <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-6 text-white text-center relative overflow-hidden">
                      <div className="relative z-10"><h2 className="text-lg font-bold opacity-90 flex items-center justify-center gap-2"><BrainCircuit size={20} /> AI 投資診斷室</h2><div className="mt-4 mb-2"><span className="text-6xl font-black tracking-tighter drop-shadow-lg">{aiReport.score}</span><span className="text-xl opacity-80 ml-1">分</span></div><div className="inline-block bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold border border-white/30">{aiReport.title}</div></div>
                      <div className="absolute -bottom-10 -right-10 opacity-10"><Trophy size={150} /></div>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-100">
                      <div className="p-4 text-center"><div className="text-xs text-slate-400 mb-1 flex items-center justify-center gap-1"><Award size={12}/> 勝率</div><div className="text-lg font-bold text-slate-700">{aiReport.details.winRate}%</div></div>
                      <div className="p-4 text-center"><div className="text-xs text-slate-400 mb-1 flex items-center justify-center gap-1"><TrendingDown size={12}/> 最大回撤</div><div className="text-lg font-bold text-green-600">{aiReport.details.maxDrawdown}%</div></div>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-100">
                      <div className="p-4 text-center"><div className="text-xs text-slate-400 mb-1 flex items-center justify-center gap-1"><ArrowUpRight size={12}/> 平均獲利</div><div className="text-lg font-bold text-red-500">{aiReport.details.avgProfit}%</div></div>
                      <div className="p-4 text-center"><div className="text-xs text-slate-400 mb-1 flex items-center justify-center gap-1"><ArrowDownRight size={12}/> 平均虧損</div><div className="text-lg font-bold text-green-600">{aiReport.details.avgLoss}%</div></div>
                  </div>
                  <div className="p-5"><div className="bg-slate-50 rounded-xl p-4 border border-slate-200"><h4 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><Lightbulb size={16} className="text-amber-500"/> 策略建議</h4><p className="text-xs text-slate-600 leading-relaxed text-justify">{aiReport.summary}</p></div></div>
                  <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3"><button onClick={() => navigate('/')} className="flex-1 py-3 bg-white border border-slate-300 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors">離開</button></div>
              </div>
          </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-2 flex justify-between items-center shrink-0 shadow-sm z-20">
        <div className="flex items-center gap-3">
            <div className="bg-amber-100 p-1.5 rounded-lg text-amber-600"><Sword size={18} /></div>
            <div>
                <h1 className="font-bold text-sm text-slate-800 leading-tight">多人競技場</h1>
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <span className="bg-slate-100 px-1.5 rounded">S1 賽季</span>
                    <span className="flex items-center gap-1"><Users size={10}/> {battleData.players.length}人</span>
                </div>
            </div>
        </div>
        <div className="flex flex-col items-end">
            <span className={`text-lg font-mono font-bold ${roi >= 0 ? 'text-red-500' : 'text-green-600'}`}>{roi > 0 ? '+' : ''}{roi.toFixed(2)}%</span>
            <span className="text-[10px] text-slate-400">總資產 ${Math.round(totalAssets).toLocaleString()}</span>
        </div>
      </header>

      {/* Main Chart Area */}
      <div className="flex-1 relative bg-white">
        <div className="absolute top-4 left-4 z-10">
            <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-slate-800 tracking-tight font-mono">${currentNav.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-mono">Day {battleData.currentDay}</span>
                {myPlayer.avgCost > 0 && (
                    <span className="text-xs text-slate-400 font-mono">均價 ${myPlayer.avgCost.toFixed(2)}</span>
                )}
            </div>
        </div>

        {/* Chart Controls */}
        <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2">
            <div className="flex gap-1 bg-white/90 p-1 rounded-lg backdrop-blur-sm border border-slate-200 shadow-sm">
                <button onClick={() => setShowMA20(!showMA20)} className={`px-2 py-1 rounded text-[10px] font-bold border ${showMA20 ? 'bg-sky-50 text-sky-600 border-sky-200' : 'bg-transparent text-slate-400 border-transparent hover:text-slate-600'}`}>月線</button>
                <button onClick={() => setShowMA60(!showMA60)} className={`px-2 py-1 rounded text-[10px] font-bold border ${showMA60 ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-transparent text-slate-400 border-transparent hover:text-slate-600'}`}>季線</button>
                <button onClick={() => setShowRiver(!showRiver)} className={`px-2 py-1 rounded text-[10px] font-bold border ${showRiver ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-transparent text-slate-400 border-slate-200 hover:text-slate-600'}`}>河流</button>
            </div>
        </div>

        {/* Chart */}
        <div className="w-full h-full pt-16 pb-4 pr-2">
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartDataInfo.data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <YAxis domain={chartDataInfo.domain} orientation="right" tick={{fill: '#94a3b8', fontSize: 10}} width={40} tickFormatter={(v) => Math.round(v)} />
                    <XAxis dataKey="displayDate" hide />
                    
                    {showRiver && (<><Line type="monotone" dataKey="riverTop" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} opacity={0.3} /><Line type="monotone" dataKey="riverBottom" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} opacity={0.3} /></>)}
                    {showMA20 && <Line type="monotone" dataKey="ma20" stroke="#38bdf8" strokeWidth={2} dot={false} isAnimationActive={false} opacity={0.8} />}
                    {showMA60 && <Line type="monotone" dataKey="ma60" stroke="#1d4ed8" strokeWidth={2} dot={false} isAnimationActive={false} opacity={0.8} />}
                    <Line type="monotone" dataKey="nav" stroke="#1e293b" strokeWidth={2} dot={false} isAnimationActive={false} animationDuration={300} />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
      </div>

      {/* Control Panel (Bottom) */}
      <div className="bg-white border-t border-slate-200 shrink-0 z-30 pb-safe">
        <div className="flex justify-between px-4 py-2 bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
            <div className="flex gap-4">
                <span>現金 ${Math.round(myPlayer.cash).toLocaleString()}</span>
                <span>持倉 {myPlayer.units.toFixed(2)} 單位</span>
            </div>
            <div className="flex items-center gap-1 text-slate-400 font-bold">
               {battleData.status === 'waiting' ? '等待開始' : (battleData.status === 'playing' ? '對戰中' : '已結束')}
            </div>
        </div>

        <div className="grid grid-cols-2 gap-2 p-2">
            <button onClick={() => setTradeMode('BUY')} disabled={myPlayer.cash < 100 || battleData.status !== 'playing'} className="bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all disabled:opacity-50 disabled:bg-slate-300">
                <TrendingUp size={20} /> 買進
            </button>
            <button onClick={() => setTradeMode('SELL')} disabled={myPlayer.units <= 0 || battleData.status !== 'playing'} className="bg-rose-500 hover:bg-rose-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all disabled:opacity-50 disabled:bg-slate-300">
                <TrendingDown size={20} /> 賣出
            </button>
        </div>
      </div>

      {/* Trade Modal */}
      {tradeMode && (
        <div className="absolute inset-0 bg-black/50 z-50 flex flex-col justify-end">
            <div className="bg-white rounded-t-2xl p-4 animate-in slide-in-from-bottom duration-200">
                <div className="flex justify-between items-center mb-4">
                    <h3 className={`text-lg font-bold flex items-center gap-2 ${tradeMode === 'BUY' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {tradeMode === 'BUY' ? <TrendingUp/> : <TrendingDown/>}
                        {tradeMode === 'BUY' ? '買入金額' : '賣出金額'}
                    </h3>
                    <button onClick={() => setTradeMode(null)} className="p-1 bg-slate-100 rounded-full text-slate-500"><X size={20}/></button>
                </div>
                
                <div className="bg-slate-100 rounded-xl p-3 mb-4 flex items-center">
                    <span className="text-xl font-bold text-slate-400 mr-2">$</span>
                    <input type="number" value={inputAmount} onChange={e => setInputAmount(e.target.value)} className="w-full bg-transparent text-2xl font-bold text-slate-800 outline-none" autoFocus placeholder="0"/>
                </div>

                <div className="flex gap-2 mb-4">
                    {[0.25, 0.5, 1].map(pct => (
                        <button key={pct} onClick={() => setTradePercent(pct, tradeMode)} className="flex-1 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-500 hover:bg-slate-50">
                            {pct * 100}%
                        </button>
                    ))}
                </div>

                <button onClick={() => executeTrade(tradeMode)} className={`w-full py-3.5 rounded-xl font-bold text-white shadow-lg active:scale-[0.98] transition-all ${tradeMode === 'BUY' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                    確認{tradeMode === 'BUY' ? '買入' : '賣出'}
                </button>
            </div>
        </div>
      )}
    </div>
  );
}