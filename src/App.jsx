import React, { useState, useEffect, useMemo, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, ResponsiveContainer, ComposedChart } from 'recharts';
import { Play, Pause, TrendingUp, TrendingDown, Activity, RotateCcw, AlertCircle, X, Check, MousePointer2, Flag, Download, Copy, FileText, Maximize, Minimize, LogOut, Power } from 'lucide-react';

// --- 1. 核心數據生成 (保持不變) ---
const generateMarketData = (years = 30) => {
  const data = [];
  let price = 100.0; 
  const startDate = new Date('1995-01-01');
  const totalDays = years * 250;

  let trend = 0; 
  let volatility = 0.015; 

  for (let i = 0; i < totalDays; i++) {
    const change = (Math.random() - 0.48 + trend) * volatility; 
    price = price * (1 + change);
    if (price < 5) price = 5 + Math.random(); 
    
    if (i % 200 === 0) {
      trend = (Math.random() - 0.5) * 0.003; 
      volatility = 0.01 + Math.random() * 0.02;
    }

    const date = new Date(startDate);
    date.setDate(startDate.getDate() + (i * 1.4));

    data.push({
      id: i,
      date: date.toISOString().split('T')[0],
      nav: parseFloat(price.toFixed(2)),
    });
  }
  return data;
};

const calculateMA = (data, days, currentIndex) => {
  if (!data || currentIndex < days) return null;
  let sum = 0;
  for (let i = 0; i < days; i++) {
    const p = data[currentIndex - i];
    if (p && !isNaN(p.nav)) sum += p.nav;
  }
  return parseFloat((sum / days).toFixed(2));
};

export default function App() {
  // --- State ---
  const [fullData, setFullData] = useState([]);
  const [currentDay, setCurrentDay] = useState(0);
  const [gameStatus, setGameStatus] = useState('setup'); 
  const [isReady, setIsReady] = useState(false);

  // Assets
  const [initialCapital, setInitialCapital] = useState(1000000);
  const [cash, setCash] = useState(1000000);
  const [units, setUnits] = useState(0);
  const [avgCost, setAvgCost] = useState(0);
  const [transactions, setTransactions] = useState([]);
  
  // Settings (Visual & Logic)
  const [showMA20, setShowMA20] = useState(true);
  const [showMA60, setShowMA60] = useState(true);
  const [showRiver, setShowRiver] = useState(false);
  
  // V15 新增：自定義停損輸入與圖表區間
  const [customStopLossInput, setCustomStopLossInput] = useState(10); // 預設 10%
  const [chartPeriod, setChartPeriod] = useState(250); // 預設看 1 年 (250天)

  // UI & Logic
  const [tradeMode, setTradeMode] = useState(null); 
  const [inputAmount, setInputAmount] = useState(''); 
  const [highestNavSinceBuy, setHighestNavSinceBuy] = useState(0);
  const [warningActive, setWarningActive] = useState(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [showCopyToast, setShowCopyToast] = useState(false);
  const [isCssFullscreen, setIsCssFullscreen] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ show: false, type: null });

  const autoPlayRef = useRef(null);

  // --- Initialization ---
  useEffect(() => {
    const data = generateMarketData(30);
    setFullData(data);
    setCurrentDay(260); // 起始點稍微往後，確保 1 年均線有數據
    setIsReady(true);
  }, []);

  // --- Chart Logic (修正：使用動態 chartPeriod) ---
  const currentNav = fullData[currentDay]?.nav || 10;
  
  const chartDataInfo = useMemo(() => {
    if (!isReady || fullData.length === 0) return { data: [], domain: [0, 100] };
    
    // V15: 使用 chartPeriod 決定視窗大小
    const start = Math.max(0, currentDay - chartPeriod);
    const end = currentDay + 1;
    
    const slice = fullData.slice(start, end).map((d, idx) => {
        const realIdx = start + idx;
        const ma20 = calculateMA(fullData, 20, realIdx);
        const ma60 = calculateMA(fullData, 60, realIdx);
        const riverTop = ma60 ? ma60 * 1.10 : null;
        const riverBottom = ma60 ? ma60 * 0.90 : null;
        return { ...d, ma20, ma60, riverTop, riverBottom };
    });

    let min = Infinity, max = -Infinity;
    slice.forEach(d => {
        const values = [d.nav, showMA20 ? d.ma20 : null, showMA60 ? d.ma60 : null, showRiver ? d.riverTop : null, showRiver ? d.riverBottom : null];
        values.forEach(v => {
            if (v !== null && !isNaN(v)) {
                if (v < min) min = v;
                if (v > max) max = v;
            }
        });
    });
    if (min === Infinity) min = 0;

    // 計算停損線 (使用自定義 %)
    const stopLossPrice = (units > 0 && highestNavSinceBuy > 0) 
        ? highestNavSinceBuy * (1 - (customStopLossInput / 100)) 
        : null;

    let finalMin = min;
    let finalMax = max;

    if (stopLossPrice !== null) {
        if (stopLossPrice < finalMin) finalMin = stopLossPrice; 
        if (highestNavSinceBuy > finalMax) finalMax = highestNavSinceBuy; 
    }

    const padding = (finalMax - finalMin) * 0.1; 
    const domainMin = Math.max(0, Math.floor(finalMin - padding));
    const domainMax = Math.ceil(finalMax + padding);

    return { data: slice, domain: [domainMin, domainMax], stopLossPrice };
  }, [fullData, currentDay, isReady, units, highestNavSinceBuy, customStopLossInput, showMA20, showMA60, showRiver, chartPeriod]);

  const totalAssets = cash + (units * currentNav);
  const roi = initialCapital > 0 ? ((totalAssets - initialCapital) / initialCapital) * 100 : 0;

  // --- Stop Loss Logic ---
  useEffect(() => {
    if (units > 0) {
      if (currentNav > highestNavSinceBuy) setHighestNavSinceBuy(currentNav);
      
      const stopPrice = highestNavSinceBuy * (1 - (customStopLossInput / 100));
      if (highestNavSinceBuy > 0 && currentNav < stopPrice) {
        setWarningActive(true);
      } else {
        setWarningActive(false);
      }
    } else {
      setHighestNavSinceBuy(0);
      setWarningActive(false);
    }
  }, [currentDay, units, currentNav, highestNavSinceBuy, customStopLossInput]);

  // --- Actions ---
  const toggleFullscreen = () => setIsCssFullscreen(!isCssFullscreen);

  const startGame = () => {
    setCash(initialCapital);
    setGameStatus('playing');
  };

  const executeReset = () => {
    setConfirmModal({ show: false, type: null });
    clearInterval(autoPlayRef.current);
    setIsAutoPlaying(false);
    setTradeMode(null);
    setShowRiver(false);
    
    const newData = generateMarketData(30);
    setFullData(newData);
    setUnits(0);
    setAvgCost(0);
    setTransactions([]);
    setHighestNavSinceBuy(0);
    setCurrentDay(260);
    setGameStatus('setup');
  };

  const triggerReset = () => {
    if (isAutoPlaying) { clearInterval(autoPlayRef.current); setIsAutoPlaying(false); }
    setConfirmModal({ show: true, type: 'reset' });
  };

  const triggerEndGame = () => {
    if (isAutoPlaying) { clearInterval(autoPlayRef.current); setIsAutoPlaying(false); }
    setConfirmModal({ show: true, type: 'end' });
  };

  const executeEndGame = () => {
    setConfirmModal({ show: false, type: null });
    endGame();
  };

  const triggerExit = () => {
      if (isAutoPlaying) { clearInterval(autoPlayRef.current); setIsAutoPlaying(false); }
      setConfirmModal({ show: true, type: 'exit' });
  };

  const executeExit = () => {
      setConfirmModal({ show: false, type: null });
      setGameStatus('shutdown'); 
  };

  const advanceDay = () => {
    if (currentDay >= fullData.length - 1) { endGame(); return; }
    setCurrentDay(prev => prev + 1);
  };

  const openTrade = (mode) => {
    if (isAutoPlaying) toggleAutoPlay();
    setTradeMode(mode);
    setInputAmount('');
  };

  const closeTrade = () => { setTradeMode(null); setInputAmount(''); };

  const executeBuy = () => {
    const amount = parseFloat(inputAmount);
    if (!amount || amount <= 0 || amount > cash) return;

    const buyUnits = amount / currentNav;
    const totalCostOld = units * avgCost;
    const totalCostNew = totalCostOld + amount;
    const newTotalUnits = units + buyUnits;
    const newAvgCost = totalCostNew / newTotalUnits;

    setAvgCost(newAvgCost);
    setUnits(newTotalUnits);
    setCash(prev => prev - amount);
    setTransactions(prev => [{ id: Date.now(), day: currentDay, type: 'BUY', price: currentNav, units: buyUnits, amount: amount, balance: cash - amount }, ...prev]);
    if (units === 0) setHighestNavSinceBuy(currentNav);
    closeTrade();
    advanceDay();
  };

  const executeSell = () => {
    let unitsToSell = parseFloat(inputAmount);
    if (!unitsToSell || unitsToSell <= 0) return;
    if (unitsToSell > units) {
        if (unitsToSell - units < 0.1) unitsToSell = units;
        else return; 
    }
    const sellAmount = unitsToSell * currentNav;
    const costOfSoldUnits = unitsToSell * avgCost;
    const pnl = sellAmount - costOfSoldUnits;

    setCash(prev => prev + sellAmount);
    setUnits(prev => { const remaining = prev - unitsToSell; return remaining < 0.0001 ? 0 : remaining; });
    setTransactions(prev => [{ id: Date.now(), day: currentDay, type: 'SELL', price: currentNav, units: unitsToSell, amount: sellAmount, balance: cash + sellAmount, pnl }, ...prev]);
    if (Math.abs(units - unitsToSell) < 0.0001) {
        setHighestNavSinceBuy(0);
        setWarningActive(false);
        setAvgCost(0);
        setUnits(0); 
    }
    closeTrade();
    advanceDay();
  };

  const toggleAutoPlay = () => {
    if (isAutoPlaying) {
      clearInterval(autoPlayRef.current);
      setIsAutoPlaying(false);
    } else {
      setTradeMode(null);
      setIsAutoPlaying(true);
      autoPlayRef.current = setInterval(() => {
        setCurrentDay(prev => {
            if (prev >= fullData.length - 1) { clearInterval(autoPlayRef.current); setIsAutoPlaying(false); return prev; }
            return prev + 1;
        });
      }, 100); // 加快一點速度
    }
  };

  const endGame = () => {
    setGameStatus('ended');
    clearInterval(autoPlayRef.current);
    setIsAutoPlaying(false);
    setTradeMode(null);
  };

  const generateCSV = () => { /* ...Same as V13... */ };
  const copyToClipboard = () => { /* ...Same as V13... */ };
  const setBuyPercent = (pct) => setInputAmount(Math.floor(cash * pct).toString());
  const setSellPercent = (pct) => { if (pct === 1) setInputAmount(units.toString()); else setInputAmount((units * pct).toFixed(2)); };

  const containerStyle = isCssFullscreen ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, width: '100vw', height: '100vh' } : { position: 'relative', height: '100vh', width: '100%' };

  // --- Render ---

  if (gameStatus === 'shutdown') {
      return (
          <div className="h-screen w-screen bg-black flex flex-col items-center justify-center text-slate-600 font-sans">
              <Power size={48} className="mb-4 opacity-50" />
              <p className="text-lg">系統已關閉</p>
              <button onClick={() => window.location.reload()} className="mt-8 px-6 py-2 border border-slate-800 rounded hover:bg-slate-900 hover:text-slate-400 transition-colors">重啟電源</button>
          </div>
      );
  }

  if (gameStatus === 'setup') {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6 flex flex-col items-center justify-center font-sans">
        <div className="w-full max-w-sm bg-slate-900 rounded-xl p-6 shadow-2xl border border-slate-800 relative">
            <div className="flex justify-center mb-4 text-emerald-400"><Activity size={56} strokeWidth={1.5} /></div>
            <h1 className="text-3xl font-bold text-center mb-2 tracking-tight">基金操盤手</h1>
            <p className="text-slate-400 text-center text-sm mb-8 font-light">v15.0 自定義戰略版</p>
            
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">初始資金</label>
            <input type="number" value={initialCapital} onChange={(e) => setInitialCapital(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-4 mb-6 text-2xl font-mono text-white focus:border-emerald-500 outline-none transition-colors" />
            
            {/* V15 新增：自定義停損輸入 */}
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">停損設定 (高點回落 %)</label>
            <div className="flex items-center bg-slate-950 border border-slate-700 rounded-lg p-2 mb-8">
                <input 
                    type="number" 
                    value={customStopLossInput} 
                    onChange={(e) => setCustomStopLossInput(Number(e.target.value))} 
                    className="flex-1 bg-transparent text-2xl font-mono text-center text-white focus:outline-none"
                />
                <span className="text-slate-500 font-bold px-4">%</span>
            </div>
            
            <button onClick={startGame} className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-4 rounded-xl text-xl shadow-xl active:scale-[0.98] transition-all">開始挑戰</button>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle} className="bg-slate-950 text-slate-200 font-sans flex flex-col overflow-hidden transition-all duration-300">
        
        {/* 1. Header */}
        <header className="bg-slate-900 px-3 py-1 border-b border-slate-800 flex justify-between items-center shrink-0 h-12 z-30 relative shadow-md">
            <button onClick={triggerExit} className="flex items-center gap-1 px-2 py-1.5 rounded bg-slate-800/50 border border-slate-700 text-slate-400 text-xs hover:text-white active:scale-95 transition-all"><LogOut size={12} /> 離開</button>
            <div className="flex gap-4 items-center">
                <span className={`text-base font-bold font-mono ${roi >= 0 ? 'text-red-400' : 'text-green-400'}`}>{roi > 0 ? '+' : ''}{roi.toFixed(2)}%</span>
            </div>
            <div className="flex gap-2">
                <button onClick={toggleFullscreen} className="p-1.5 rounded hover:bg-slate-800 text-slate-400"><Maximize size={14} /></button>
                <button onClick={triggerEndGame} className="flex items-center gap-1 px-2 py-1.5 rounded bg-red-900/20 border border-red-900/40 text-red-400 text-xs hover:bg-red-900/40 active:scale-95 transition-all"><Flag size={12} /> 結算</button>
            </div>
        </header>

        {/* 2. Chart (V15: 高度增加至 50%) */}
        <div className="relative w-full bg-slate-900/30 border-b border-slate-800 shrink-0 z-0" style={{ height: '50%' }}>
            {/* 左上角資訊 */}
            <div className="absolute top-3 left-4 z-0 pointer-events-none">
                <div className="flex items-baseline gap-2"><span className="text-3xl font-bold text-white tracking-tight shadow-black drop-shadow-md">${currentNav.toFixed(2)}</span><span className="text-xs text-slate-500 font-mono">Day {currentDay}</span></div>
                {avgCost > 0 && (<div className="text-[10px] text-slate-400 mt-1 font-mono">均價 ${avgCost.toFixed(2)}</div>)}
            </div>

            {/* 右上角控制區 (V15: 加入時間區間切換) */}
            <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-2">
                {/* 指標開關 */}
                <div className="flex gap-1">
                    <button onClick={() => setShowMA20(!showMA20)} className={`px-1.5 py-0.5 rounded text-[9px] border ${showMA20 ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' : 'bg-slate-800 text-slate-600 border-slate-700'}`}>月線</button>
                    <button onClick={() => setShowMA60(!showMA60)} className={`px-1.5 py-0.5 rounded text-[9px] border ${showMA60 ? 'bg-purple-500/20 text-purple-400 border-purple-500/50' : 'bg-slate-800 text-slate-600 border-slate-700'}`}>季線</button>
                    <button onClick={() => setShowRiver(!showRiver)} className={`px-1.5 py-0.5 rounded text-[9px] border ${showRiver ? 'bg-blue-500/20 text-blue-400 border-blue-500/50' : 'bg-slate-800 text-slate-600 border-slate-700'}`}>河流</button>
                </div>
                {/* V15: 時間區間選擇 */}
                <div className="flex bg-slate-800 rounded border border-slate-700 p-0.5">
                    {[125, 250, 500].map(days => (
                        <button 
                            key={days} 
                            onClick={() => setChartPeriod(days)} 
                            className={`px-2 py-0.5 text-[9px] rounded ${chartPeriod === days ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            {days === 125 ? '半年' : (days === 250 ? '1年' : '2年')}
                        </button>
                    ))}
                </div>
            </div>

            {/* 重置按鈕 */}
            <button onClick={triggerReset} className="absolute bottom-4 left-4 z-10 p-2 rounded-full bg-slate-800/80 border border-slate-700 text-slate-500 hover:text-white transition-colors" title="重置"><RotateCcw size={14} /></button>

            {/* 停損警示 */}
            {warningActive && gameStatus === 'playing' && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10 bg-amber-500/90 text-black px-3 py-1 rounded-full shadow-lg animate-pulse flex items-center gap-1.5 backdrop-blur-sm">
                    <AlertCircle size={14} strokeWidth={2.5} /><span className="text-xs font-extrabold">觸及停損 ({customStopLossInput}%)</span>
                </div>
            )}

            {isReady && chartDataInfo.data.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartDataInfo.data} margin={{ top: 60, right: 5, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                        <YAxis domain={chartDataInfo.domain} orientation="right" tick={{fill: '#64748b', fontSize: 10}} width={35} tickFormatter={(v) => Math.round(v)} interval="preserveStartEnd" />
                        
                        {showRiver && (
                            <>
                                <Line type="monotone" dataKey="riverTop" stroke="#3b82f6" strokeWidth={1} strokeDasharray="3 3" dot={false} isAnimationActive={false} opacity={0.4} />
                                <Line type="monotone" dataKey="riverBottom" stroke="#3b82f6" strokeWidth={1} strokeDasharray="3 3" dot={false} isAnimationActive={false} opacity={0.4} />
                            </>
                        )}

                        {showMA20 && <Line type="monotone" dataKey="ma20" stroke="#fbbf24" strokeWidth={1} dot={false} isAnimationActive={false} opacity={0.8} />}
                        {showMA60 && <Line type="monotone" dataKey="ma60" stroke="#a855f7" strokeWidth={1} dot={false} isAnimationActive={false} opacity={0.8} />}
                        
                        <Line type="monotone" dataKey="nav" stroke="#34d399" strokeWidth={2} dot={false} isAnimationActive={false} shadow="0 0 10px rgba(52, 211, 153, 0.3)" />
                        
                        {units > 0 && chartDataInfo.stopLossPrice && (
                             <ReferenceLine y={chartDataInfo.stopLossPrice} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1.5} label={{ position: 'insideBottomLeft', value: `Stop ${chartDataInfo.stopLossPrice.toFixed(1)}`, fill: '#ef4444', fontSize: 10, dy: -5 }} />
                        )}
                    </ComposedChart>
                </ResponsiveContainer>
            ) : <div className="flex items-center justify-center h-full text-slate-500">載入中...</div>}
        </div>

        {/* 3. Controls (V15: 高度壓縮，讓位給圖表) */}
        <div className="bg-slate-900 shrink-0 z-20 shadow-lg border-b border-slate-800">
            <div className="flex justify-between px-4 py-1.5 bg-slate-800/50 border-b border-slate-800 text-[10px]">
                <div className="flex gap-2 items-center"><span className="text-slate-400">資產</span><span className={`font-mono font-bold text-xs ${roi>=0?'text-red-400':'text-green-400'}`}>${Math.round(totalAssets).toLocaleString()}</span></div>
                <div className="flex gap-2 items-center"><span className="text-slate-400">現金</span><span className="text-emerald-400 font-mono font-bold text-xs">${Math.round(cash).toLocaleString()}</span></div>
            </div>
            {/* V15: 按鈕改為 py-2 (原本 py-3)，字體 text-xs */}
            <div className="grid grid-cols-4 gap-1 p-1.5 bg-slate-900">
                <button onClick={advanceDay} disabled={isAutoPlaying || tradeMode} className="bg-slate-800 active:bg-slate-700 text-slate-300 py-2 rounded-lg font-bold text-xs flex flex-col items-center gap-0.5 border-b-2 border-slate-900 active:border-b-0 active:translate-y-[1px] disabled:opacity-40 transition-all"><MousePointer2 size={16} /> 觀望</button>
                <button onClick={() => openTrade('buy')} disabled={isAutoPlaying || cash < 10 || tradeMode} className="bg-red-600 active:bg-red-500 text-white py-2 rounded-lg font-bold text-xs flex flex-col items-center gap-0.5 border-b-2 border-red-800 active:border-b-0 active:translate-y-[1px] disabled:opacity-40 disabled:bg-slate-800 transition-all"><TrendingUp size={16} /> 買進</button>
                <button onClick={() => openTrade('sell')} disabled={isAutoPlaying || units <= 0 || tradeMode} className="bg-green-600 active:bg-green-500 text-white py-2 rounded-lg font-bold text-xs flex flex-col items-center gap-0.5 border-b-2 border-green-800 active:border-b-0 active:translate-y-[1px] disabled:opacity-40 disabled:bg-slate-800 transition-all"><TrendingDown size={16} /> 賣出</button>
                <button onClick={toggleAutoPlay} disabled={tradeMode} className={`flex flex-col items-center justify-center gap-0.5 rounded-lg font-bold text-xs border-b-2 active:border-b-0 active:translate-y-[1px] transition-all ${isAutoPlaying ? 'bg-amber-600 border-amber-800 text-white' : 'bg-slate-800 border-slate-900 text-slate-400'}`}>{isAutoPlaying ? <Pause size={16} /> : <Play size={16} />} {isAutoPlaying ? '暫停' : '自動'}</button>
            </div>
        </div>

        {/* 4. Logs */}
        <div className="flex-1 bg-slate-950 overflow-y-auto p-1 custom-scrollbar">
            {transactions.length === 0 && <div className="text-center text-slate-700 text-xs mt-8">尚未進行任何交易</div>}
            {transactions.map(t => (
                <div key={t.id} className="flex justify-between items-center p-2 mb-1 bg-slate-900 rounded border border-slate-800 text-[10px]">
                    <div className="flex items-center gap-2">
                        <span className={`w-8 text-center py-0.5 rounded font-bold ${t.type === 'BUY' ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>{t.type === 'BUY' ? '買' : '賣'}</span>
                        <span className="text-slate-500 font-mono">D{t.day}</span>
                        <span className="text-slate-300 pl-1">{t.type === 'BUY' ? `$${t.amount.toLocaleString()}` : `${parseFloat(t.units).toFixed(2)}U`}</span>
                    </div>
                    <div className="text-right text-slate-400"><span className="mr-2 font-mono">${t.price.toFixed(2)}</span>{t.type === 'SELL' && (<span className={`font-bold ${t.pnl >= 0 ? 'text-red-400' : 'text-green-400'}`}>{t.pnl >= 0 ? '+' : ''}{Math.round(t.pnl)}</span>)}</div>
                </div>
            ))}
        </div>

        {/* 5. Confirm Modal */}
        {confirmModal.show && (
            <div className="absolute inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-2xl w-full max-w-xs text-center">
                    <div className="flex justify-center mb-4">{confirmModal.type === 'exit' ? <LogOut size={40} className="text-slate-400"/> : (confirmModal.type === 'reset' ? <RotateCcw size={40} className="text-slate-400"/> : <Flag size={40} className="text-emerald-500"/>)}</div>
                    <h3 className="text-xl font-bold text-white mb-2">{confirmModal.type === 'exit' ? '離開遊戲' : (confirmModal.type === 'reset' ? '重置遊戲' : '結算遊戲')}</h3>
                    <div className="flex gap-3 mt-6">
                        <button onClick={() => setConfirmModal({show:false, type:null})} className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700">取消</button>
                        <button onClick={confirmModal.type === 'exit' ? executeExit : (confirmModal.type === 'reset' ? executeReset : executeEndGame)} className={`flex-1 py-3 rounded-xl font-bold text-white ${confirmModal.type === 'exit' ? 'bg-red-600 hover:bg-red-500' : (confirmModal.type === 'reset' ? 'bg-slate-600 hover:bg-slate-500' : 'bg-emerald-600 hover:bg-emerald-500')}`}>確定</button>
                    </div>
                </div>
            </div>
        )}

        {/* 6. Trade Overlay */}
        {tradeMode && (
            <div className="absolute bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700 p-4 pb-8 shadow-[0_-10px_50px_rgba(0,0,0,0.9)] z-50 animate-in slide-in-from-bottom duration-200 rounded-t-2xl">
                <div className="flex justify-between items-center mb-5">
                    <h3 className={`text-lg font-bold flex items-center gap-2 ${tradeMode === 'buy' ? 'text-red-400' : 'text-green-400'}`}>{tradeMode === 'buy' ? <TrendingUp size={20} /> : <TrendingDown size={20} />} {tradeMode === 'buy' ? '買入' : '賣出'}</h3>
                    <button onClick={closeTrade} className="bg-slate-800 p-1.5 rounded-full text-slate-400 hover:text-white"><X size={20} /></button>
                </div>
                <div className="space-y-4">
                    <div className="bg-slate-800 rounded-lg p-3 border border-slate-600 flex items-center">
                        <span className="text-slate-400 font-mono mr-3 text-lg">{tradeMode === 'buy' ? '$' : 'U'}</span>
                        <input type="number" value={inputAmount} onChange={(e) => setInputAmount(e.target.value)} placeholder={tradeMode === 'buy' ? "輸入金額" : "輸入單位"} className="w-full bg-transparent text-2xl font-mono text-white outline-none" autoFocus />
                    </div>
                    <div className="flex gap-2">{[0.25, 0.5, 1].map((pct) => (<button key={pct} onClick={() => tradeMode === 'buy' ? setBuyPercent(pct) : setSellPercent(pct)} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-mono text-slate-300 border border-slate-700 transition-colors">{pct === 1 ? 'All In' : `${pct*100}%`}</button>))}</div>
                    <button onClick={tradeMode === 'buy' ? executeBuy : executeSell} className={`w-full py-4 rounded-lg font-bold text-lg flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all ${tradeMode === 'buy' ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-green-600 hover:bg-green-500 text-white'}`}><Check size={20} /> 確認</button>
                </div>
            </div>
        )}

        {/* 7. Game Ended Overlay (V13修正版邏輯) */}
        {gameStatus === 'ended' && (
            <div className="absolute inset-0 bg-slate-950/95 z-50 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
                <Activity size={48} className="text-emerald-500 mb-4" /><h2 className="text-3xl font-bold text-white mb-8 tracking-tight">結算成績單</h2>
                <div className="grid grid-cols-2 gap-4 w-full max-w-xs mb-8"><div className="bg-slate-900 p-5 rounded-xl border border-slate-800"><div className="text-xs text-slate-500 mb-1 uppercase tracking-wider">最終資產</div><div className={`text-xl font-mono font-bold ${roi >= 0 ? 'text-red-400' : 'text-green-400'}`}>${Math.round(totalAssets).toLocaleString()}</div></div><div className="bg-slate-900 p-5 rounded-xl border border-slate-800"><div className="text-xs text-slate-500 mb-1 uppercase tracking-wider">總報酬率</div><div className={`text-xl font-mono font-bold ${roi >= 0 ? 'text-red-400' : 'text-green-400'}`}>{roi > 0 ? '+' : ''}{roi.toFixed(2)}%</div></div></div>
                <div className="flex flex-col w-full max-w-xs gap-3"><div className="h-6"></div><button onClick={executeReset} className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl font-bold shadow-lg shadow-emerald-900/20 active:scale-[0.98] transition-all"><RotateCcw size={18} /> 重新開始挑戰</button></div>
            </div>
        )}
    </div>
  );
}