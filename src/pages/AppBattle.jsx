import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Line, XAxis, YAxis, CartesianGrid, ReferenceLine, ResponsiveContainer, ComposedChart, ReferenceDot 
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Activity, X, 
  Trophy, Users, Sword, Loader2, BrainCircuit, Target, Lightbulb,
  Award, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db, auth } from '../config/firebase';

// ★★★ 關鍵修正：這裡名稱必須是 generateAIAnalysis，不能是 useAIAnalyst ★★★
import { generateAIAnalysis } from '../hooks/useAIAnalyst';

// ============================================
// 1. 輔助函式
// ============================================

const calculateIndicators = (data, days, currentIndex) => {
  if (!data || currentIndex < days) return { ma: null, stdDev: null };
  let sum = 0;
  for (let i = 0; i < days; i++) { 
      const val = data[currentIndex - i]?.nav;
      if (val && !isNaN(val)) sum += val;
  }
  const ma = sum / days;
  return { ma: parseFloat(ma.toFixed(2)) };
};

// ============================================
// 主元件：AppBattle (Final Fix)
// ============================================
export default function AppBattle() {
  const { battleId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  
  // 戰鬥狀態
  const [battleData, setBattleData] = useState(null);
  const [fundData, setFundData] = useState([]);
  const [myPlayer, setMyPlayer] = useState(null);
  const [gameStatus, setGameStatus] = useState('waiting'); 
  
  // 本地交易紀錄 (AI 分析用)
  const [transactions, setTransactions] = useState([]);

  // 交易操作 UI
  const [tradeMode, setTradeMode] = useState(null);
  const [inputAmount, setInputAmount] = useState('');
  
  // 圖表狀態
  const [showMA20, setShowMA20] = useState(true);
  const [showMA60, setShowMA60] = useState(true);
  const [chartPeriod, setChartPeriod] = useState(120); 

  // AI 分析報告
  const [aiReport, setAiReport] = useState(null);

  // 1. 驗證登入
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      if (!u) navigate('/'); else setUser(u);
    });
    return () => unsubscribe();
  }, [navigate]);

  // 2. 監聽戰鬥室
  useEffect(() => {
    if (!battleId || !user) return;
    const battleRef = doc(db, 'battles', battleId);
    const unsub = onSnapshot(battleRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setBattleData(data);
        setGameStatus(data.status); 

        if (data.players) {
          const me = data.players.find(p => p.uid === user.uid);
          setMyPlayer(me);
        }
      } else {
        alert('戰鬥室已關閉'); navigate('/');
      }
    });
    return () => unsub();
  }, [battleId, user, navigate]);

  // 3. 載入基金
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
  }, [battleData?.fundId, battleData?.fundUrl, fundData.length]); 

  // 4. 結算觸發 AI 分析
  useEffect(() => {
      if (gameStatus === 'ended' && fundData.length > 0 && myPlayer && !aiReport) {
          const currentIdx = battleData.currentDay;
          const battleHistory = fundData.slice(0, currentIdx + 1);
          const finalAssets = myPlayer.cash + (myPlayer.units * fundData[currentIdx].nav);
          
          const report = generateAIAnalysis(
              transactions,   
              battleHistory,  
              1000000,        
              finalAssets     
          );
          setAiReport(report);
      }
  }, [gameStatus, fundData, myPlayer, transactions, battleData?.currentDay, aiReport]);

  // 5. 圖表數據
  const chartDataInfo = useMemo(() => {
    if (!fundData.length || !battleData) return { data: [], domain: [0, 100] };
    
    const currentIdx = battleData.currentDay;
    const start = Math.max(0, currentIdx - chartPeriod);
    const end = currentIdx + 1;
    
    const slice = fundData.slice(start, end).map((d, idx) => {
        const realIdx = start + idx;
        const ind20 = calculateIndicators(fundData, 20, realIdx);
        const ind60 = calculateIndicators(fundData, 60, realIdx);
        return { ...d, displayDate: d.date, ma20: ind20.ma, ma60: ind60.ma };
    });

    let min = Infinity, max = -Infinity;
    slice.forEach(d => {
        const values = [d.nav, showMA20 ? d.ma20 : null, showMA60 ? d.ma60 : null];
        values.forEach(v => { if (v !== null && !isNaN(v)) { if (v < min) min = v; if (v > max) max = v; } });
    });
    if (min === Infinity) min = 0;
    const padding = (max - min) * 0.1;
    return { data: slice, domain: [Math.floor(min - padding), Math.ceil(max + padding)] };
  }, [fundData, battleData?.currentDay, showMA20, showMA60, chartPeriod]);

  // 6. 交易執行
  const executeTrade = async (type) => {
    if (!myPlayer || !battleData || gameStatus !== 'playing') return;
    const currentNav = fundData[battleData.currentDay]?.nav;
    
    let amount = parseFloat(inputAmount);
    if (!amount || amount <= 0) return;

    let newCash = myPlayer.cash;
    let newUnits = myPlayer.units;
    let newAvgCost = myPlayer.avgCost;

    if (type === 'BUY') {
        if (amount > newCash) amount = newCash; 
        const buyUnits = amount / currentNav;
        newAvgCost = ((newUnits * newAvgCost) + amount) / (newUnits + buyUnits);
        newUnits += buyUnits;
        newCash -= amount;
        
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
        const pnl = sellAmount - (sellUnits * newAvgCost);
        newCash += sellAmount;
        newUnits -= sellUnits;
        if (newUnits < 0.0001) { newUnits = 0; newAvgCost = 0; }

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

    const playerIndex = battleData.players.findIndex(p => p.uid === user.uid);
    if (playerIndex === -1) return;

    const updatedPlayers = [...battleData.players];
    updatedPlayers[playerIndex] = {
        ...updatedPlayers[playerIndex],
        cash: newCash,
        units: newUnits,
        avgCost: newAvgCost
    };

    const battleRef = doc(db, 'battles', battleId);
    await updateDoc(battleRef, { players: updatedPlayers });
    setTradeMode(null); setInputAmount('');
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

  if (!battleData || !myPlayer || fundData.length === 0) return <div className="h-screen flex items-center justify-center bg-slate-900 text-white"><Loader2 className="animate-spin mr-2"/> 連線戰場中...</div>;

  const currentNav = fundData[battleData.currentDay]?.nav || 0;
  const totalAssets = myPlayer.cash + (myPlayer.units * currentNav);
  const roi = ((totalAssets - 1000000) / 1000000 * 100);

  return (
    <div className="h-screen bg-slate-50 flex flex-col font-sans text-slate-800 relative">
      
      {/* 結算畫面 */}
      {gameStatus === 'ended' && aiReport && (
          <div className="absolute inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-in fade-in duration-500 overflow-y-auto">
              <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 my-auto">
                  <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-6 text-white text-center relative overflow-hidden">
                      <div className="relative z-10">
                          <h2 className="text-lg font-bold opacity-90 flex items-center justify-center gap-2">
                              <BrainCircuit size={20} /> AI 投資診斷室
                          </h2>
                          <div className="mt-4 mb-2">
                              <span className="text-6xl font-black tracking-tighter drop-shadow-lg">{aiReport.score}</span>
                              <span className="text-xl opacity-80 ml-1">分</span>
                          </div>
                          <div className="inline-block bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold border border-white/30">
                              {aiReport.title}
                          </div>
                      </div>
                      <div className="absolute -bottom-10 -right-10 opacity-10"><Trophy size={150} /></div>
                  </div>
                  
                  <div className="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-100">
                      <div className="p-4 text-center">
                          <div className="text-xs text-slate-400 mb-1 flex items-center justify-center gap-1"><Award size={12}/> 勝率</div>
                          <div className="text-lg font-bold text-slate-700">{aiReport.details.winRate}%</div>
                      </div>
                      <div className="p-4 text-center">
                          <div className="text-xs text-slate-400 mb-1 flex items-center justify-center gap-1"><TrendingDown size={12}/> 最大回撤</div>
                          <div className="text-lg font-bold text-green-600">{aiReport.details.maxDrawdown}%</div>
                      </div>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-100">
                      <div className="p-4 text-center">
                          <div className="text-xs text-slate-400 mb-1 flex items-center justify-center gap-1"><ArrowUpRight size={12}/> 平均獲利</div>
                          <div className="text-lg font-bold text-red-500">{aiReport.details.avgProfit}%</div>
                      </div>
                      <div className="p-4 text-center">
                          <div className="text-xs text-slate-400 mb-1 flex items-center justify-center gap-1"><ArrowDownRight size={12}/> 平均虧損</div>
                          <div className="text-lg font-bold text-green-600">{aiReport.details.avgLoss}%</div>
                      </div>
                  </div>

                  <div className="p-5">
                      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                          <h4 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                              <Lightbulb size={16} className="text-amber-500"/> 策略建議
                          </h4>
                          <p className="text-xs text-slate-600 leading-relaxed text-justify">
                              {aiReport.summary}
                          </p>
                      </div>
                  </div>

                  <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                      <button onClick={() => navigate('/')} className="flex-1 py-3 bg-white border border-slate-300 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors">
                          返回大廳
                      </button>
                      <button className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">
                          保存戰績
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* 遊戲進行中畫面 */}
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

      <div className="flex-1 relative bg-white">
        <div className="absolute top-4 left-4 z-10">
            <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-slate-800 tracking-tight font-mono">${currentNav.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-mono">Day {battleData.currentDay}</span>
                {myPlayer.avgCost > 0 && (<span className="text-xs text-slate-400 font-mono">均價 ${myPlayer.avgCost.toFixed(2)}</span>)}
            </div>
        </div>

        <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2">
            <div className="flex gap-1 bg-white/90 p-1 rounded-lg backdrop-blur-sm border border-slate-200 shadow-sm">
                <button onClick={() => setShowMA20(!showMA20)} className={`px-2 py-1 rounded text-[10px] font-bold border ${showMA20 ? 'bg-sky-50 text-sky-600 border-sky-200' : 'bg-transparent text-slate-400 border-transparent hover:text-slate-600'}`}>月線</button>
                <button onClick={() => setShowMA60(!showMA60)} className={`px-2 py-1 rounded text-[10px] font-bold border ${showMA60 ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-transparent text-slate-400 border-transparent hover:text-slate-600'}`}>季線</button>
                <button onClick={() => setChartPeriod(prev => prev === 120 ? 250 : 120)} className="px-2 py-1 rounded text-[10px] font-bold border bg-transparent text-slate-400 border-slate-200 hover:text-slate-600">{chartPeriod === 120 ? '半年' : '一年'}</button>
            </div>
        </div>

        <div className="w-full h-full pt-16 pb-4 pr-2">
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartDataInfo.data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <YAxis domain={chartDataInfo.domain} orientation="right" tick={{fill: '#94a3b8', fontSize: 10}} width={40} tickFormatter={(v) => Math.round(v)} />
                    <XAxis dataKey="displayDate" hide />
                    {showMA20 && <Line type="monotone" dataKey="ma20" stroke="#38bdf8" strokeWidth={2} dot={false} isAnimationActive={false} opacity={0.8} />}
                    {showMA60 && <Line type="monotone" dataKey="ma60" stroke="#1d4ed8" strokeWidth={2} dot={false} isAnimationActive={false} opacity={0.8} />}
                    <Line type="monotone" dataKey="nav" stroke="#1e293b" strokeWidth={2} dot={false} isAnimationActive={false} animationDuration={300} />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white border-t border-slate-200 shrink-0 z-30 pb-safe">
        <div className="flex justify-between px-4 py-2 bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
            <div className="flex gap-4">
                <span>現金 ${Math.round(myPlayer.cash).toLocaleString()}</span>
                <span>持倉 {myPlayer.units.toFixed(2)} 單位</span>
            </div>
            <div className="flex items-center gap-1 text-slate-400 font-bold">
               {gameStatus === 'waiting' ? '等待開始' : (gameStatus === 'playing' ? '對戰中' : '已結束')}
            </div>
        </div>

        <div className="grid grid-cols-2 gap-2 p-2">
            <button onClick={() => setTradeMode('BUY')} disabled={myPlayer.cash < 100 || gameStatus !== 'playing'} className="bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all disabled:opacity-50 disabled:bg-slate-300">
                <TrendingUp size={20} /> 買進
            </button>
            <button onClick={() => setTradeMode('SELL')} disabled={myPlayer.units <= 0 || gameStatus !== 'playing'} className="bg-rose-500 hover:bg-rose-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all disabled:opacity-50 disabled:bg-slate-300">
                <TrendingDown size={20} /> 賣出
            </button>
        </div>
      </div>

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