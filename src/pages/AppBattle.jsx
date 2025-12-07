import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ComposedChart 
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Users, Sword, Loader2, BrainCircuit, Lightbulb,
  Award, ArrowUpRight, ArrowDownRight, Trophy, UserPlus, AlertTriangle
} from 'lucide-react';
import { doc, onSnapshot, updateDoc, arrayUnion } from 'firebase/firestore';
import { signInAnonymously, updateProfile } from 'firebase/auth'; 
import { db, auth } from '../config/firebase';

// ============================================
// 1. AI 分析邏輯 (直接內嵌，不再引用外部檔案)
// ============================================

// AI 輔助：計算 MA
const calculateMA_AI = (data, days, idx) => {
    if (idx < days - 1) return null;
    let sum = 0;
    for (let i = 0; i < days; i++) {
        sum += data[idx - i].nav;
    }
    return sum / days;
};

// AI 輔助：計算最大回撤
const calculateMaxDrawdown_AI = (data) => {
    let peak = -Infinity;
    let maxDrawdown = 0;
    for (const point of data) {
        if (point.nav > peak) peak = point.nav;
        const drawdown = (peak - point.nav) / peak;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }
    return (maxDrawdown * 100).toFixed(2);
};

// AI 核心分析函數
const runLocalAIAnalysis = (transactions, historyData, initialCapital, finalAssets) => {
    // 防呆
    if (!historyData || historyData.length === 0) {
        return { score: 0, title: "數據不足", marketRoi: 0, playerRoi: 0, summary: "數據不足", details: { winRate: 0, maxDrawdown: 0, avgProfit: 0, avgLoss: 0 } };
    }

    const playerRoi = ((finalAssets - initialCapital) / initialCapital * 100).toFixed(2);
    const startNav = historyData[0].nav;
    const endNav = historyData[historyData.length - 1].nav;
    const marketRoi = ((endNav - startNav) / startNav * 100).toFixed(2);

    let winCount = 0;
    let totalProfit = 0;
    let totalLoss = 0;
    let lossCount = 0;

    const safeTransactions = Array.isArray(transactions) ? transactions : [];
    const sellOrders = safeTransactions.filter(t => t.type === 'SELL');
    
    sellOrders.forEach(t => {
        // 兼容 pnl 計算
        const pnl = t.pnl !== undefined ? t.pnl : (t.amount - (t.units * (t.avgCost || 0))); 
        if (pnl > 0) {
            winCount++;
            totalProfit += pnl;
        } else {
            lossCount++;
            totalLoss += Math.abs(pnl);
        }
    });

    const totalTrades = sellOrders.length;
    const winRate = totalTrades > 0 ? ((winCount / totalTrades) * 100).toFixed(0) : 0;
    const avgProfit = winCount > 0 ? (totalProfit / winCount / initialCapital * 100).toFixed(1) : 0;
    const avgLoss = lossCount > 0 ? (totalLoss / lossCount / initialCapital * 100).toFixed(1) : 0;
    const maxDrawdown = calculateMaxDrawdown_AI(historyData); 

    // 市場趨勢判斷
    const lastIdx = historyData.length - 1;
    const ma60_end = calculateMA_AI(historyData, 60, lastIdx) || endNav;
    const ma60_start = calculateMA_AI(historyData, 60, Math.min(60, lastIdx)) || startNav;
    
    let marketType = "盤整震盪";
    if (endNav > ma60_end && ma60_end > ma60_start * 1.02) marketType = "多頭趨勢";
    else if (endNav < ma60_end && ma60_end < ma60_start * 0.98) marketType = "空頭修正";

    // 評分邏輯
    let score = 60; 
    if (parseFloat(playerRoi) > parseFloat(marketRoi)) score += 20; 
    if (parseFloat(playerRoi) > 0) score += 10; 
    if (parseFloat(playerRoi) < -10) score -= 10;
    if (parseFloat(playerRoi) < -20) score -= 20;
    if (totalTrades > 0 && parseFloat(winRate) > 50) score += 10;
    if (score > 99) score = 99;
    if (score < 10) score = 10;

    let title = "股市見習生";
    let summary = "";

    if (score >= 90) {
        title = "傳奇操盤手";
        summary = `太驚人了！在${marketType}中，您不僅擊敗了大盤，還展現了極高的勝率 (${winRate}%)。您的進出場點位精準，充分利用了複利效應。`;
    } else if (score >= 80) {
        title = "華爾街菁英";
        summary = `表現優異！您的報酬率 (${playerRoi}%) 相當亮眼。您在趨勢判斷上已有相當火侯，只需注意在${marketType}時的風險控管。`;
    } else if (score >= 60) {
        title = "穩健投資者";
        summary = `表現中規中矩。在${marketType}的環境下，您守住了本金並獲得了合理的報酬。建議可以透過「移動停利」提高賺賠比。`;
    } else {
        title = "韭菜練習生";
        summary = `這是一次寶貴的經驗。在${marketType}中受傷是成長的必經之路。建議多觀察「季線」方向，盡量避免逆勢操作。`;
    }

    return {
        score,
        title,
        marketRoi,
        playerRoi,
        summary,
        details: {
            winRate,
            maxDrawdown,
            avgProfit: `+${avgProfit}`,
            avgLoss: `-${avgLoss}`
        }
    };
};

// ============================================
// 2. 遊戲指標輔助函式
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
// 主元件：AppBattle (Self-Contained & Fixed)
// ============================================
export default function AppBattle() {
  const { battleId } = useParams();
  const navigate = useNavigate();
  
  // 核心狀態
  const [user, setUser] = useState(null);
  const [battleData, setBattleData] = useState(null);
  const [fundData, setFundData] = useState([]);
  const [myPlayer, setMyPlayer] = useState(null);
  const [gameStatus, setGameStatus] = useState('loading'); 
  
  // 訪客加入狀態
  const [nickName, setNickName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [errorMsg, setErrorMsg] = useState(''); 

  // 本地交易紀錄 (AI 分析用)
  const [transactions, setTransactions] = useState([]);

  // UI 狀態
  const [tradeMode, setTradeMode] = useState(null);
  const [inputAmount, setInputAmount] = useState('');
  const [showMA20, setShowMA20] = useState(true);
  const [showMA60, setShowMA60] = useState(true);
  const [chartPeriod, setChartPeriod] = useState(120); 
  const [aiReport, setAiReport] = useState(null);

  // 1. 監聽登入狀態
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // 2. 監聽戰鬥室數據
  useEffect(() => {
    if (!battleId) { setErrorMsg("網址錯誤：缺少戰鬥 ID"); return; }

    const battleRef = doc(db, 'battles', battleId);
    const unsub = onSnapshot(battleRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setBattleData(data);
        setGameStatus(data.status); 

        const currentUser = auth.currentUser;
        if (currentUser && data.players) {
          const me = data.players.find(p => p.uid === currentUser.uid);
          setMyPlayer(me || null); 
        }
      } else {
        setErrorMsg("找不到此戰鬥室，可能已結束");
      }
    }, (err) => {
        console.error("讀取失敗:", err);
    });
    return () => unsub();
  }, [battleId, user]); 

  // 3. 載入基金數據
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
          console.error("Fund Load Error:", err);
        }
      }
    };
    loadFund();
  }, [battleData?.fundId, battleData?.fundUrl, fundData.length]); 

  // 4. AI 分析觸發點 (使用內嵌函數)
  useEffect(() => {
      if (gameStatus === 'ended' && fundData.length > 0 && myPlayer && !aiReport) {
          const currentIdx = battleData.currentDay;
          const battleHistory = fundData.slice(0, currentIdx + 1);
          const finalAssets = myPlayer.cash + (myPlayer.units * fundData[currentIdx].nav);
          
          // ★★★ 直接呼叫內嵌函數 runLocalAIAnalysis ★★★
          const report = runLocalAIAnalysis(
              transactions,   
              battleHistory,  
              1000000,        
              finalAssets     
          );
          setAiReport(report);
      }
  }, [gameStatus, fundData, myPlayer, transactions, battleData?.currentDay, aiReport]);

  // 5. 圖表數據計算
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

  // 加入戰局
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

  // 交易執行
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
        
        setTransactions(prev => [...prev, { day: battleData.currentDay, type: 'BUY', price: currentNav, units: buyUnits, amount: amount, balance: newCash }]);
    } else {
        let sellUnits = amount / currentNav;
        if (sellUnits > newUnits) sellUnits = newUnits; 
        const sellAmount = sellUnits * currentNav;
        const pnl = sellAmount - (sellUnits * newAvgCost);
        newCash += sellAmount;
        newUnits -= sellUnits;
        if (newUnits < 0.0001) { newUnits = 0; newAvgCost = 0; }

        setTransactions(prev => [...prev, { day: battleData.currentDay, type: 'SELL', price: currentNav, units: sellUnits, amount: sellAmount, balance: newCash, pnl: pnl }]);
    }

    const playerIndex = battleData.players.findIndex(p => p.uid === auth.currentUser.uid);
    if (playerIndex === -1) return;
    const updatedPlayers = [...battleData.players];
    updatedPlayers[playerIndex] = { ...updatedPlayers[playerIndex], cash: newCash, units: newUnits, avgCost: newAvgCost };
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

  // === 畫面渲染 ===

  if (errorMsg) {
      return (
          <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-white gap-4 p-6 text-center">
              <AlertTriangle size={48} className="text-amber-500 mb-2" />
              <h2 className="text-xl font-bold">連線發生問題</h2>
              <p className="text-slate-400 font-mono text-sm bg-slate-800 p-2 rounded">{errorMsg}</p>
              <button onClick={() => navigate('/')} className="px-6 py-2 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors mt-4">返回首頁</button>
          </div>
      );
  }

  if (!battleData) return <div className="h-screen flex items-center justify-center bg-slate-900 text-white gap-3"><Loader2 className="animate-spin text-amber-500" size={32}/> <span className="text-sm font-mono text-slate-400 animate-pulse">搜尋戰場中...</span></div>;

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

  if (fundData.length === 0) return <div className="h-screen flex items-center justify-center bg-slate-900 text-white"><Loader2 className="animate-spin mr-2"/> 下載數據中...</div>;

  const currentNav = fundData[battleData.currentDay]?.nav || 0;
  const totalAssets = myPlayer.cash + (myPlayer.units * currentNav);
  const roi = ((totalAssets - 1000000) / 1000000 * 100);

  return (
    <div className="h-screen bg-slate-50 flex flex-col font-sans text-slate-800 relative">
      {gameStatus === 'ended' && aiReport && (
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

      <header className="bg-white border-b border-slate-200 px-4 py-2 flex justify-between items-center shrink-0 shadow-sm z-20">
        <div className="flex items-center gap-3"><div className="bg-amber-100 p-1.5 rounded-lg text-amber-600"><Sword size={18} /></div><div><h1 className="font-bold text-sm text-slate-800 leading-tight">多人競技場</h1><div className="flex items-center gap-2 text-[10px] text-slate-500"><span className="bg-slate-100 px-1.5 rounded">S1 賽季</span><span className="flex items-center gap-1"><Users size={10}/> {battleData.players.length}人</span></div></div></div>
        <div className="flex flex-col items-end"><span className={`text-lg font-mono font-bold ${roi >= 0 ? 'text-red-500' : 'text-green-600'}`}>{roi > 0 ? '+' : ''}{roi.toFixed(2)}%</span><span className="text-[10px] text-slate-400">總資產 ${Math.round(totalAssets).toLocaleString()}</span></div>
      </header>

      <div className="flex-1 relative bg-white">
        <div className="absolute top-4 left-4 z-10"><div className="flex items-baseline gap-2"><span className="text-4xl font-bold text-slate-800 tracking-tight font-mono">${currentNav.toFixed(2)}</span></div><div className="flex items-center gap-2 mt-1"><span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-mono">Day {battleData.currentDay}</span></div></div>
        <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2"><div className="flex gap-1 bg-white/90 p-1 rounded-lg backdrop-blur-sm border border-slate-200 shadow-sm"><button onClick={() => setShowMA20(!showMA20)} className={`px-2 py-1 rounded text-[10px] font-bold border ${showMA20 ? 'bg-sky-50 text-sky-600 border-sky-200' : 'bg-transparent text-slate-400 border-transparent hover:text-slate-600'}`}>月線</button><button onClick={() => setShowMA60(!showMA60)} className={`px-2 py-1 rounded text-[10px] font-bold border ${showMA60 ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-transparent text-slate-400 border-transparent hover:text-slate-600'}`}>季線</button></div></div>
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
            <div className="flex gap-4"><span>現金 ${Math.round(myPlayer.cash).toLocaleString()}</span><span>持倉 {myPlayer.units.toFixed(2)} 單位</span></div>
            <div className="flex items-center gap-1 text-slate-400 font-bold">{gameStatus === 'waiting' ? '等待開始' : (gameStatus === 'playing' ? '對戰中' : '已結束')}</div>
        </div>
        <div className="grid grid-cols-2 gap-2 p-2">
            <button onClick={() => setTradeMode('BUY')} disabled={myPlayer.cash < 100 || gameStatus !== 'playing'} className="bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all disabled:opacity-50 disabled:bg-slate-300"><TrendingUp size={20} /> 買進</button>
            <button onClick={() => setTradeMode('SELL')} disabled={myPlayer.units <= 0 || gameStatus !== 'playing'} className="bg-rose-500 hover:bg-rose-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all disabled:opacity-50 disabled:bg-slate-300"><TrendingDown size={20} /> 賣出</button>
        </div>
      </div>

      {tradeMode && (
        <div className="absolute inset-0 bg-black/50 z-50 flex flex-col justify-end">
            <div className="bg-white rounded-t-2xl p-4 animate-in slide-in-from-bottom duration-200">
                <div className="flex justify-between items-center mb-4"><h3 className={`text-lg font-bold flex items-center gap-2 ${tradeMode === 'BUY' ? 'text-emerald-600' : 'text-rose-600'}`}>{tradeMode === 'BUY' ? <TrendingUp/> : <TrendingDown/>}{tradeMode === 'BUY' ? '買入金額' : '賣出金額'}</h3><button onClick={() => setTradeMode(null)} className="p-1 bg-slate-100 rounded-full text-slate-500"><X size={20}/></button></div>
                <div className="bg-slate-100 rounded-xl p-3 mb-4 flex items-center"><span className="text-xl font-bold text-slate-400 mr-2">$</span><input type="number" value={inputAmount} onChange={e => setInputAmount(e.target.value)} className="w-full bg-transparent text-2xl font-bold text-slate-800 outline-none" autoFocus placeholder="0"/></div>
                <div className="flex gap-2 mb-4">{[0.25, 0.5, 1].map(pct => (<button key={pct} onClick={() => setTradePercent(pct, tradeMode)} className="flex-1 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-500 hover:bg-slate-50">{pct * 100}%</button>))}</div>
                <button onClick={() => executeTrade(tradeMode)} className={`w-full py-3.5 rounded-xl font-bold text-white shadow-lg active:scale-[0.98] transition-all ${tradeMode === 'BUY' ? 'bg-emerald-500' : 'bg-rose-500'}`}>確認{tradeMode === 'BUY' ? '買入' : '賣出'}</button>
            </div>
        </div>
      )}
    </div>
  );
}