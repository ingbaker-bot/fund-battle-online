import React, { useState, useEffect, useMemo, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, ResponsiveContainer, ComposedChart, ReferenceDot } from 'recharts';
import { 
  Play, Pause, TrendingUp, TrendingDown, Activity, RotateCcw, AlertCircle, X, Check, MousePointer2, Flag, 
  Maximize, LogOut, Lock, Database, UserCheck, Loader2, Waves, Trophy, Sword, Crown, CalendarClock, History, Sparkles, LogIn 
} from 'lucide-react';

import { FUNDS_LIBRARY } from '../config/funds';

// ============================================
// 繪圖輔助函式
// ============================================

// 1. 扣抵值三角形
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

// 2. 交叉訊號繪製器
const renderCrossTriangle = (props) => {
    const { cx, cy, direction, type } = props;
    if (!Number.isFinite(cx) || !Number.isFinite(cy) || !direction) return null;

    const isSolid = type === 'solid';
    const strokeColor = direction === 'gold' ? "#ef4444" : "#16a34a"; 
    const fillColor = isSolid ? strokeColor : "#ffffff"; 
    
    if (direction === 'gold') {
        return <polygon points={`${cx},${cy - 4} ${cx - 6},${cy + 8} ${cx + 6},${cy + 8}`} fill={fillColor} stroke={strokeColor} strokeWidth={2}/>;
    } else {
        return <polygon points={`${cx},${cy + 4} ${cx - 6},${cy - 8} ${cx + 6},${cy - 8}`} fill={fillColor} stroke={strokeColor} strokeWidth={2}/>;
    }
};

// ============================================
// 數據處理輔助函式
// ============================================
const processRealData = (rawData) => {
    if (!rawData || !Array.isArray(rawData)) return [];
    return rawData.map((item, index) => ({ id: index, date: item.date, nav: parseFloat(item.nav) }));
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

const calculatePureRspRoi = (data, startDay, endDay, rspAmount, rspDay) => {
    if (!data || startDay >= endDay) return 0;
    let units = 0;
    let totalInvested = 0;
    let lastRspMonth = -1;
    for (let i = startDay; i <= endDay; i++) {
        const d = data[i];
        const dateObj = new Date(d.date);
        const currentMonth = dateObj.getFullYear() * 12 + dateObj.getMonth();
        const dayOfMonth = dateObj.getDate();
        if (currentMonth > lastRspMonth && dayOfMonth >= rspDay) {
            units += rspAmount / d.nav;
            totalInvested += rspAmount;
            lastRspMonth = currentMonth;
        }
    }
    if (totalInvested === 0) return 0;
    const finalValue = units * data[endDay].nav;
    return ((finalValue - totalInvested) / totalInvested) * 100;
};

// ============================================
// 主元件：AppTrial (體驗版 v11.1)
// ============================================
export default function AppTrial() {
  const user = { email: 'guest@trial.mode', uid: 'guest' }; 
  const myNickname = '體驗玩家';

  const tickerData = [
      { displayName: '股神巴菲特', fundName: '科技趨勢基金', roi: 128.5 },
      { displayName: '華爾街之狼', fundName: '全球能源基金', roi: 89.2 },
      { displayName: '小資存股族', fundName: '高股息ETF', roi: 45.6 },
      { displayName: 'AI交易員', fundName: '半導體精選', roi: 210.3 },
      { displayName: '當沖客', fundName: '生技醫療基金', roi: -12.4 },
  ];

  const [fullData, setFullData] = useState([]);
  const [currentDay, setCurrentDay] = useState(0);
  const [gameStatus, setGameStatus] = useState('setup'); 
  const [isReady, setIsReady] = useState(false);
  const [currentFundName, setCurrentFundName] = useState('');

  const [initialCapital, setInitialCapital] = useState(1000000);
  const [cash, setCash] = useState(1000000);
  const [units, setUnits] = useState(0);
  const [avgCost, setAvgCost] = useState(0);
  const [transactions, setTransactions] = useState([]);
  
  const [benchmarkStartNav, setBenchmarkStartNav] = useState(null);
  const [realStartDay, setRealStartDay] = useState(0); 
  const [timeOffset, setTimeOffset] = useState(0); 
  
  const [rspConfig, setRspConfig] = useState({ enabled: false, amount: 5000, day: 6 });
  const [lastRspMonth, setLastRspMonth] = useState(-1);
  const [showRspAlert, setShowRspAlert] = useState(false);
  
  const [showMA20, setShowMA20] = useState(true);
  const [showMA60, setShowMA60] = useState(true);
  const [showRiver, setShowRiver] = useState(false);
  const [showTrend, setShowTrend] = useState(true);
  
  const [chartPeriod, setChartPeriod] = useState(250);
  
  const [customStopLossInput, setCustomStopLossInput] = useState(10);
  const [riverMode, setRiverMode] = useState('fixed'); 
  const [riverWidthInput, setRiverWidthInput] = useState(10); 
  const [riverSDMultiplier, setRiverSDMultiplier] = useState(2);

  // ★★★ 修改1：預設模式強制為 'real' (真實) ★★★
  const [dataSourceType, setDataSourceType] = useState('real'); 
  
  // ★★★ 修改2：預設選中開放的基金 (新手入門) ★★★
  // 尋找名稱含有 '新手' 的基金ID，若找不到則預設第一個
  const defaultFundId = useMemo(() => {
      const beginnerFund = FUNDS_LIBRARY.find(f => f.name.includes('新手'));
      return beginnerFund ? beginnerFund.id : FUNDS_LIBRARY[0].id;
  }, []);
  const [selectedFundId, setSelectedFundId] = useState(defaultFundId);

  const [tradeMode, setTradeMode] = useState(null); 
  const [inputAmount, setInputAmount] = useState(''); 
  const [highestNavSinceBuy, setHighestNavSinceBuy] = useState(0);
  const [warningActive, setWarningActive] = useState(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [isCssFullscreen, setIsCssFullscreen] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ show: false, type: null });

  const autoPlayRef = useRef(null);

  const formatNumber = (num) => num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const handleCapitalChange = (e) => { const val = Number(e.target.value.replace(/,/g, '')); if (!isNaN(val)) setInitialCapital(val); };

  const startGame = async () => {
    // 雖然前端有鎖，但這裡再做一次防呆，體驗版強制使用真實模式
    if (dataSourceType === 'random') {
        alert("體驗版僅開放部分真實基金，隨機模式請登入會員使用。");
        return;
    }

    const targetFund = FUNDS_LIBRARY.find(f => f.id === selectedFundId);
    if (!targetFund) return;

    const randomTimeOffset = Math.floor(Math.random() * 51) + 50;
    setTimeOffset(randomTimeOffset);

    setGameStatus('loading_data');
    try {
        const response = await fetch(targetFund.file);
        if (!response.ok) throw new Error("數據讀取失敗");
        const rawData = await response.json();
        let processedData = processRealData(rawData);
        
        const minStart = 60;
        const maxStart = Math.max(minStart, processedData.length - 250);
        const startIdx = Math.floor(Math.random() * (maxStart - minStart + 1)) + minStart;

        if (processedData.length < 100) throw new Error("數據區間過短");

        setFullData(processedData);
        setCash(initialCapital); 
        setTransactions([]);
        setUnits(0);
        setAvgCost(0);
        setHighestNavSinceBuy(0);
        
        const playStartDay = startIdx > 60 ? startIdx : 60;
        setCurrentDay(playStartDay);
        setRealStartDay(playStartDay);
        
        if (processedData && processedData[playStartDay]) {
            setBenchmarkStartNav(processedData[playStartDay].nav);
            const sd = new Date(processedData[playStartDay].date);
            setLastRspMonth(sd.getFullYear() * 12 + sd.getMonth() - 1);
        }

        setCurrentFundName(targetFund.name.replace('🔒 [進階] ', ''));
        setGameStatus('playing');
        setIsReady(true);
    } catch (error) {
        alert(`載入失敗：${error.message}`);
        setGameStatus('setup');
    }
  };

  useEffect(() => {
      if (gameStatus === 'playing' && fullData.length > 0 && rspConfig.enabled) {
          const currentData = fullData[currentDay];
          if (!currentData) return;
          const dateObj = new Date(currentData.date);
          const currentMonth = dateObj.getFullYear() * 12 + dateObj.getMonth();
          const dayOfMonth = dateObj.getDate();
          if (currentMonth > lastRspMonth && dayOfMonth >= rspConfig.day) {
              if (cash >= rspConfig.amount) {
                  const buyUnits = rspConfig.amount / currentData.nav;
                  const newTotalUnits = units + buyUnits;
                  const newAvgCost = (units * avgCost + rspConfig.amount) / newTotalUnits;
                  setAvgCost(newAvgCost);
                  setUnits(newTotalUnits);
                  setCash(prev => prev - rspConfig.amount);
                  setTransactions(prev => [{ id: Date.now(), day: currentDay, type: 'RSP', price: currentData.nav, units: buyUnits, amount: rspConfig.amount, balance: cash - rspConfig.amount }, ...prev]);
                  setLastRspMonth(currentMonth);
                  if (units === 0) setHighestNavSinceBuy(currentData.nav);
              } else {
                  setRspConfig(prev => ({ ...prev, enabled: false }));
                  setShowRspAlert(true);
                  setTimeout(() => setShowRspAlert(false), 3000);
                  if (isAutoPlaying) { clearInterval(autoPlayRef.current); setIsAutoPlaying(false); }
              }
          }
      }
  }, [currentDay, gameStatus, fullData, rspConfig, cash, units, avgCost, lastRspMonth, isAutoPlaying]);

  useEffect(() => {
      if (gameStatus === 'playing' && fullData.length > 0) {
          if (currentDay >= fullData.length - 1) {
              if (isAutoPlaying) { clearInterval(autoPlayRef.current); setIsAutoPlaying(false); }
              setGameStatus('ended');
          }
      }
  }, [currentDay, fullData, gameStatus, isAutoPlaying]);

  const currentNav = fullData[currentDay]?.nav || 10;
  const getDisplayDate = (dateStr) => {
      if (!dateStr) return dateStr;
      const dateObj = new Date(dateStr);
      if (isNaN(dateObj.getTime())) return dateStr;
      const newYear = dateObj.getFullYear() + timeOffset; 
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      return `${newYear}-${month}-${day}`;
  };

  const benchmarkRoi = useMemo(() => {
      if (!benchmarkStartNav || benchmarkStartNav === 0) return 0;
      return ((currentNav - benchmarkStartNav) / benchmarkStartNav) * 100;
  }, [currentNav, benchmarkStartNav]);

  const pureRspRoi = useMemo(() => {
      if (gameStatus !== 'ended') return 0;
      return calculatePureRspRoi(fullData, realStartDay, currentDay, rspConfig.amount, rspConfig.day);
  }, [gameStatus, fullData, realStartDay, currentDay, rspConfig]);

  const trendSignal = useMemo(() => {
      if (!showTrend || !fullData[currentDay]) return null;
      const idx = currentDay;
      const curNav = fullData[idx].nav;
      const ind20 = calculateIndicators(fullData, 20, idx);
      const ind60 = calculateIndicators(fullData, 60, idx);
      const ma20 = ind20.ma; const ma60 = ind60.ma;
      if (!ma20 || !ma60) return null;
      if (curNav > ma20 && ma20 > ma60) return { text: '多頭', icon: <TrendingUp size={14} />, style: 'bg-red-100 text-red-600 border-red-200' };
      else if (curNav < ma20 && ma20 < ma60) return { text: '空頭', icon: <TrendingDown size={14} />, style: 'bg-green-100 text-green-600 border-green-200' };
      return { text: '盤整', icon: <Activity size={14} />, style: 'bg-slate-100 text-slate-500 border-slate-200' };
  }, [fullData, currentDay, showTrend]);

  const chartDataInfo = useMemo(() => {
    if (!isReady || fullData.length === 0) return { data: [], domain: [0, 100] };
    const start = Math.max(0, currentDay - chartPeriod);
    const end = currentDay + 1;
    const slice = fullData.slice(start, end).map((d, idx) => {
        const realIdx = start + idx;
        const ind20 = calculateIndicators(fullData, 20, realIdx);
        const ind60 = calculateIndicators(fullData, 60, realIdx);
        const ma20 = ind20.ma; const ma60 = ind60.ma; const stdDev60 = ind60.stdDev;
        const prevRealIdx = realIdx > 0 ? realIdx - 1 : 0;
        const prevInd20 = calculateIndicators(fullData, 20, prevRealIdx);
        const prevInd60 = calculateIndicators(fullData, 60, prevRealIdx);
        const refRealIdx = realIdx > 5 ? realIdx - 5 : 0;
        const refInd60 = calculateIndicators(fullData, 60, refRealIdx);

        let riverTop = null; let riverBottom = null;
        if (ma60) {
            if (riverMode === 'fixed') { const ratio = riverWidthInput / 100; riverTop = ma60 * (1 + ratio); riverBottom = ma60 * (1 - ratio); } 
            else { if (stdDev60) { riverTop = ma60 + (stdDev60 * riverSDMultiplier); riverBottom = ma60 - (stdDev60 * riverSDMultiplier); } }
        }

        let crossSignal = null;
        if (ma20 && ma60 && prevInd20.ma && prevInd60.ma && refInd60.ma && realIdx > 5) {
            const isGoldCross = prevInd20.ma <= prevInd60.ma && ma20 > ma60;
            const isDeathCross = prevInd20.ma >= prevInd60.ma && ma20 < ma60;
            const isTrendUp = ma60 >= refInd60.ma;
            const isTrendDown = ma60 < refInd60.ma;
            if (isGoldCross) crossSignal = { type: 'gold', style: isTrendUp ? 'solid' : 'hollow' };
            else if (isDeathCross) crossSignal = { type: 'death', style: isTrendDown ? 'solid' : 'hollow' };
        }
        return { ...d, displayDate: getDisplayDate(d.date), ma20, ma60, riverTop, riverBottom, crossSignal };
    });

    let min = Infinity, max = -Infinity;
    slice.forEach(d => {
        const values = [d.nav, showMA20 ? d.ma20 : null, showMA60 ? d.ma60 : null, showRiver ? d.riverTop : null, showRiver ? d.riverBottom : null];
        values.forEach(v => { if (v !== null && !isNaN(v)) { if (v < min) min = v; if (v > max) max = v; } });
    });
    if (min === Infinity) min = 0;
    const stopLossPrice = (units > 0 && highestNavSinceBuy > 0) ? highestNavSinceBuy * (1 - (customStopLossInput / 100)) : null;
    let finalMin = min, finalMax = max;
    if (stopLossPrice !== null) { if (stopLossPrice < finalMin) finalMin = stopLossPrice; if (highestNavSinceBuy > finalMax) finalMax = highestNavSinceBuy; }
    const padding = (finalMax - finalMin) * 0.1; 
    const domainMin = Math.max(0, Math.floor(finalMin - padding));
    const domainMax = Math.ceil(finalMax + padding);
    return { data: slice, domain: [domainMin, domainMax], stopLossPrice };
  }, [fullData, currentDay, isReady, units, highestNavSinceBuy, customStopLossInput, showMA20, showMA60, showRiver, chartPeriod, riverMode, riverWidthInput, riverSDMultiplier, timeOffset, showTrend]);

  const totalAssets = cash + (units * currentNav);
  const roi = initialCapital > 0 ? ((totalAssets - initialCapital) / initialCapital) * 100 : 0;

  useEffect(() => {
    if (units > 0) {
      if (currentNav > highestNavSinceBuy) setHighestNavSinceBuy(currentNav);
      const stopPrice = highestNavSinceBuy * (1 - (customStopLossInput / 100));
      setWarningActive(highestNavSinceBuy > 0 && currentNav < stopPrice);
    } else { setHighestNavSinceBuy(0); setWarningActive(false); }
  }, [currentDay, units, currentNav, highestNavSinceBuy, customStopLossInput]);

  const toggleFullscreen = () => setIsCssFullscreen(!isCssFullscreen);
  const advanceDay = () => { if (currentDay >= fullData.length - 1) { setGameStatus('ended'); return; } setCurrentDay(prev => prev + 1); };
  
  const setBuyPercent = (pct) => { if (pct === 1) setInputAmount(cash ? cash.toString() : '0'); else setInputAmount(Math.floor(cash * pct).toString()); };
  const setSellPercent = (pct) => { if (pct === 1) setInputAmount(units ? units.toString() : '0'); else setInputAmount((units * pct).toFixed(2)); };

  const openTrade = (mode) => { if (isAutoPlaying) toggleAutoPlay(); setTradeMode(mode); setInputAmount(''); };
  const closeTrade = () => { setTradeMode(null); setInputAmount(''); };

  const executeBuy = () => { 
      const amount = parseFloat(inputAmount); 
      if (!amount || amount <= 0 || amount > cash) return; 
      const buyUnits = amount / currentNav; 
      const newTotalUnits = units + buyUnits; 
      const newAvgCost = (units * avgCost + amount) / newTotalUnits; 
      setAvgCost(newAvgCost); 
      setUnits(newTotalUnits); 
      setCash(prev => { const rem = prev - amount; return rem < 0.01 ? 0 : rem; });
      setTransactions(prev => [{ id: Date.now(), day: currentDay, type: 'BUY', price: currentNav, units: buyUnits, amount: amount, balance: cash - amount }, ...prev]); 
      if (units === 0) setHighestNavSinceBuy(currentNav); 
      closeTrade(); 
      advanceDay(); 
  };

  const executeSell = () => { 
      let unitsToSell = parseFloat(inputAmount); 
      if (!unitsToSell || unitsToSell <= 0) return; 
      const isAllIn = unitsToSell >= units || Math.abs(unitsToSell - units) < 0.0001;
      if (isAllIn) unitsToSell = units;
      else if (unitsToSell > units) return;
      const sellAmount = unitsToSell * currentNav; 
      const costOfSoldUnits = unitsToSell * avgCost; 
      const pnl = sellAmount - costOfSoldUnits; 
      setCash(prev => prev + sellAmount); 
      setUnits(prev => { if (isAllIn) return 0; const remaining = prev - unitsToSell; return remaining < 0.0001 ? 0 : remaining; }); 
      setTransactions(prev => [{ id: Date.now(), day: currentDay, type: 'SELL', price: currentNav, units: unitsToSell, amount: sellAmount, balance: cash + sellAmount, pnl }, ...prev]); 
      if (isAllIn) { setHighestNavSinceBuy(0); setWarningActive(false); setAvgCost(0); } 
      closeTrade(); 
      advanceDay(); 
  };

  const toggleAutoPlay = () => { if (isAutoPlaying) { clearInterval(autoPlayRef.current); setIsAutoPlaying(false); } else { setTradeMode(null); setIsAutoPlaying(true); autoPlayRef.current = setInterval(() => { setCurrentDay(prev => prev + 1); }, 100); } };
  
  const executeReset = () => { setConfirmModal({ show: false, type: null }); clearInterval(autoPlayRef.current); setIsAutoPlaying(false); setTradeMode(null); setUnits(0); setAvgCost(0); setTransactions([]); setHighestNavSinceBuy(0); setBenchmarkStartNav(null); setGameStatus('setup'); };
  const triggerReset = () => { if (isAutoPlaying) { clearInterval(autoPlayRef.current); setIsAutoPlaying(false); } setConfirmModal({ show: true, type: 'reset' }); };
  const triggerEndGame = () => { if (isAutoPlaying) { clearInterval(autoPlayRef.current); setIsAutoPlaying(false); } setConfirmModal({ show: true, type: 'end' }); };
  const executeEndGame = () => { setConfirmModal({ show: false, type: null }); setGameStatus('ended'); };
  const triggerExit = () => { if (isAutoPlaying) { clearInterval(autoPlayRef.current); setIsAutoPlaying(false); } setConfirmModal({ show: true, type: 'exit' }); };
  const executeExit = () => { setConfirmModal({ show: false, type: null }); window.location.href = '/'; };

  const containerStyle = isCssFullscreen ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, width: '100vw', height: '100vh' } : { position: 'relative', height: '100vh', width: '100%' };

  // Setup UI
  if (gameStatus === 'setup') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 p-4 flex flex-col items-center justify-center font-sans">
        <div className="w-full max-w-sm bg-white rounded-xl p-5 shadow-xl border border-cyan-200 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-cyan-400 to-teal-500"></div>
            <button onClick={() => window.location.href = '/'} className="absolute top-4 right-3 text-slate-400 hover:text-slate-600 transition-colors" title="離開"><LogOut size={18} /></button>
            
            <div className="flex items-center justify-center gap-3 mb-5 mt-2">
                <img src="/logo.jpg" alt="Logo" className="h-9 object-contain rounded-sm shadow-sm" />
                <div className="flex flex-col">
                    <span className="font-black text-lg text-slate-800 leading-tight">Fund 手遊</span>
                    <span className="text-[10px] text-cyan-600 font-bold tracking-wide bg-cyan-50 px-1 rounded">FCF教具專利</span>
                </div>
            </div>

            <div className="mb-4 flex items-center gap-2">
                <div className="w-2/3 flex items-center justify-center gap-2 bg-gradient-to-br from-cyan-50 to-teal-50 text-cyan-700 font-bold py-3 rounded-xl border border-cyan-200 shadow-sm relative overflow-hidden">
                    <Sparkles size={18} className="text-cyan-500" /> 
                    <span className="z-10 px-1">遊客體驗版</span>
                </div>
                <div className="w-1/3 flex flex-col justify-center gap-0.5 pl-1 text-center">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">功能全開</span>
                    <span className="text-[10px] text-cyan-500 font-bold">免登入試玩</span>
                </div>
            </div> 

            <div className="mb-4 w-full h-10 bg-slate-50 border border-slate-200 rounded flex items-center overflow-hidden relative">
                <div className="animate-marquee items-center gap-0">
                    {[...tickerData, ...tickerData].map((tick, idx) => (
                        <div key={idx} className="flex items-center shrink-0 px-4">
                            <span className="text-[11px] font-mono text-slate-600 flex items-center gap-1 whitespace-nowrap">
                                <span className="text-cyan-600 font-bold">★ {tick.displayName}</span>
                                <span className="text-slate-400 text-[10px]">在</span>
                                <span className="font-medium text-slate-700">{tick.fundName.substring(0, 6)}...</span>
                                <span className="text-slate-400 text-[10px]">獲利</span>
                                <span className="text-red-500 font-bold text-xs">{tick.roi > 0 ? '+' : ''}{tick.roi}%</span>
                            </span>
                            <span className="ml-8 text-slate-300 select-none">|</span>
                        </div>
                    ))}
                </div>
                <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-slate-50 to-transparent z-10 pointer-events-none"></div>
                <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-slate-50 to-transparent z-10 pointer-events-none"></div>
            </div>
            
            <div className="flex gap-2 mb-3">
                <div className="w-2/3 flex items-center bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 shadow-sm">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-2">初始資金</span>
                    <input type="text" value={formatNumber(initialCapital)} onChange={handleCapitalChange} className="w-full bg-transparent text-right text-lg font-mono text-slate-800 font-bold outline-none"/>
                </div>
                <div className="w-1/3 bg-slate-50 border border-slate-300 rounded-xl px-1 py-2 flex flex-col items-center justify-center shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">停損 (%)</span>
                    <input type="number" value={customStopLossInput} onChange={(e) => setCustomStopLossInput(Number(e.target.value))} className="w-full bg-transparent text-center text-lg font-mono text-slate-800 font-bold outline-none h-5"/>
                </div>
            </div>
            
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mb-3 shadow-sm">
                <div className="flex items-center justify-between mb-2 text-indigo-600">
                    <div className="flex items-center gap-2"><CalendarClock size={16} /><span className="text-xs font-bold uppercase tracking-wider">定期定額 (RSP)</span></div>
                    <div className="flex items-center">
                        <input type="checkbox" checked={rspConfig.enabled} onChange={(e) => setRspConfig({...rspConfig, enabled: e.target.checked})} className="w-3.5 h-3.5 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300 mr-2" />
                        <span className={`text-xs font-bold ${rspConfig.enabled ? 'text-indigo-600' : 'text-slate-400'}`}>{rspConfig.enabled ? '開啟中' : '關閉中'}</span>
                    </div>
                </div>
                {rspConfig.enabled && (
                    <div className="flex gap-2 animate-in fade-in slide-in-from-top-1">
                        <div className="flex-1"><label className="text-[10px] text-slate-400 mb-0.5 block">扣款金額</label><input type="number" value={rspConfig.amount} onChange={(e) => setRspConfig({...rspConfig, amount: Number(e.target.value)})} className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-sm text-center text-slate-800 outline-none font-mono"/></div>
                        <div className="flex-1"><label className="text-[10px] text-slate-400 mb-0.5 block">每月扣款日</label><select value={rspConfig.day} onChange={(e) => setRspConfig({...rspConfig, day: Number(e.target.value)})} className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-sm text-center text-slate-800 outline-none font-mono">{[6, 16, 26].map(d => <option key={d} value={d}>{d} 號</option>)}</select></div>
                    </div>
                )}
            </div>

            {/* ★★★ 修改3：選擇挑戰項目 (鎖住隨機) ★★★ */}
            <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">選擇挑戰項目</label>
            <div className="flex gap-2 mb-3 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button 
                    onClick={() => alert("隨機模式僅限會員使用，請前往註冊！")}
                    className="flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 bg-slate-200 text-slate-400 cursor-not-allowed"
                >
                    <Lock size={12} /> 隨機
                </button>
                <button 
                    onClick={() => setDataSourceType('real')} 
                    className="flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 bg-cyan-600 text-white shadow-md ring-1 ring-cyan-400"
                >
                    <span className="animate-bounce">📉</span> 真實
                </button>
            </div>
            
            {/* ★★★ 修改4：基金下拉選單 (限制僅三檔) ★★★ */}
            <div className="mb-3 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-2 bg-cyan-50/50 border border-cyan-200 rounded-xl px-3 py-2 shadow-sm">
                    <Database size={18} className="text-cyan-600" />
                    <select 
                        value={selectedFundId} 
                        onChange={(e) => setSelectedFundId(e.target.value)} 
                        className="w-full bg-transparent text-cyan-900 outline-none text-xs font-bold"
                    >
                        {FUNDS_LIBRARY.map(fund => {
                            // 判斷是否為開放的體驗基金
                            const isAllowed = fund.name.includes('新手') || fund.name.includes('教育') || fund.name.includes('高手');
                            return (
                                <option 
                                    key={fund.id} 
                                    value={fund.id} 
                                    className={isAllowed ? "bg-white text-slate-700" : "text-slate-300 bg-slate-50"}
                                    disabled={!isAllowed}
                                >
                                    {!isAllowed ? '🔒 ' : ''}{fund.name.replace('🔒 [進階] ', '')}
                                    {!isAllowed ? ' (會員限定)' : ''}
                                </option>
                            );
                        })}
                    </select>
                </div>
            </div>

            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 mb-4 shadow-sm">
                <div className="flex items-center justify-between mb-1.5 text-blue-600"><div className="flex items-center gap-2"><Waves size={14} /><span className="text-[10px] font-bold uppercase tracking-wider">河流圖參數 (季線)</span></div></div>
                <div className="flex gap-2">
                    <div className="flex w-1/2 gap-1">
                        <button onClick={() => setRiverMode('fixed')} className={`flex-1 py-1.5 text-[10px] font-bold rounded transition-colors ${riverMode === 'fixed' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-400 border border-slate-200'}`}>固定%</button>
                        <button onClick={() => setRiverMode('dynamic')} className={`flex-1 py-1.5 text-[10px] font-bold rounded transition-colors ${riverMode === 'dynamic' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-400 border border-slate-200'}`}>動態SD</button>
                    </div>
                    <div className="flex items-center w-1/2 bg-white border border-slate-300 rounded px-2">
                        {riverMode === 'fixed' ? (<><input type="number" value={riverWidthInput} onChange={(e) => setRiverWidthInput(Number(e.target.value))} className="flex-1 bg-transparent text-center text-slate-800 outline-none font-mono font-bold text-sm"/><span className="text-xs text-slate-400 ml-1">%</span></>) : (<><span className="text-xs text-slate-400 mr-1">K</span><input type="number" step="0.1" min="1" max="5" value={riverSDMultiplier} onChange={(e) => setRiverSDMultiplier(Number(e.target.value))} className="flex-1 bg-transparent text-center text-emerald-600 font-bold outline-none font-mono text-sm"/></>)}
                    </div>
                </div>
            </div>

            <div className="flex gap-2 mb-4">
                <div className="flex-1 bg-slate-50 border border-slate-300 rounded-xl p-1.5 flex flex-col items-center justify-center gap-0.5 overflow-hidden shadow-sm">
                    <div className="flex items-center gap-1 text-emerald-600">
                        <UserCheck size={12} />
                        <span className="text-[10px] font-bold">遊客</span>
                    </div>
                    <div className="flex flex-col items-center w-full">
                        <span className="text-[10px] text-slate-600 font-mono truncate w-full text-center px-1">Guest</span>
                        <span className="text-[10px] text-cyan-500 font-bold truncate w-full text-center leading-none">(未登入)</span>
                    </div>
                </div>

                <button onClick={startGame} className="flex-[2] bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white font-bold rounded-xl text-lg shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 py-2">
                    <Play size={22} fill="currentColor" /> 開始體驗
                </button>
            </div>
            
            {/* ★★★ 修改5：更新版本號為 v11.1 ★★★ */}
            <div className="mt-2 text-center"><span className="bg-slate-100 text-slate-400 text-[10px] px-2 py-1 rounded-full border border-slate-200 font-mono">2025v11.1 2025v11.7 NBS-奈AI團隊</span></div>
        </div>
      </div>
    );
  }

  if (gameStatus === 'loading_data') return ( <div className="h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-800 gap-4"><Loader2 size={48} className="animate-spin text-cyan-500" /><p className="text-slate-500">正在準備試玩資料...</p></div> );

  return (
    <div style={containerStyle} className="bg-slate-50 text-slate-800 font-sans flex flex-col overflow-hidden transition-all duration-300">
        <header className="bg-white px-3 py-1 border-b border-slate-200 flex justify-between items-center shrink-0 h-12 z-30 relative shadow-sm">
            <button onClick={triggerExit} className="flex items-center gap-1 px-2 py-1.5 rounded bg-slate-100 border border-slate-200 text-slate-600 text-xs hover:text-slate-900 active:scale-95 transition-all"><LogOut size={12} /> 離開</button>
            <div className="flex flex-col items-center"><span className="text-[9px] text-cyan-600 bg-cyan-50 px-1.5 rounded border border-cyan-200 mb-0.5">TRIAL MODE</span><span className={`text-sm font-bold font-mono ${roi >= 0 ? 'text-red-500' : 'text-green-600'}`}>{roi > 0 ? '+' : ''}{roi.toFixed(2)}%</span></div>
            <div className="flex gap-2"><button onClick={toggleFullscreen} className="p-1.5 rounded hover:bg-slate-100 text-slate-500"><Maximize size={14} /></button><button onClick={triggerEndGame} className="flex items-center gap-1 px-2 py-1.5 rounded bg-red-50 border border-red-200 text-red-600 text-xs hover:bg-red-100 active:scale-95 transition-all"><Flag size={12} /> 結算</button></div>
        </header>

        <div className="relative w-full bg-white border-b border-slate-200 shrink-0 z-0" style={{ height: '50%' }}>
            <div className="absolute top-3 left-4 z-0 pointer-events-none">
                <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-slate-800 tracking-tight shadow-white drop-shadow-sm font-mono">${currentNav.toFixed(2)}</span>
                    {trendSignal && (
                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border ${trendSignal.style} shadow-sm animate-in fade-in zoom-in duration-300 ml-1`}>
                            {trendSignal.icon}
                            <span className="text-[10px] font-bold">{trendSignal.text}</span>
                        </div>
                    )}
                </div>
                <span className="text-sm text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1 mt-1 w-fit">
                    {getDisplayDate(fullData[currentDay]?.date)}
                    {timeOffset > 0 && <span className="text-[9px] bg-slate-200 px-1 rounded text-slate-500 ml-1">Sim</span>}
                </span>
                {avgCost > 0 && (<div className="text-xs text-slate-400 mt-1 font-mono font-bold ml-1">均價 ${avgCost.toFixed(2)}</div>)}
            </div>
            
            <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-2">
                <div className="flex gap-1 bg-white/90 p-1 rounded-lg backdrop-blur-sm border border-slate-200 shadow-sm">
                    <button onClick={() => setShowMA20(!showMA20)} className={`px-2 py-1 rounded text-[10px] font-bold border ${showMA20 ? 'bg-sky-50 text-sky-600 border-sky-200' : 'bg-transparent text-slate-400 border-transparent hover:text-slate-600'}`}>月線</button>
                    <button onClick={() => setShowMA60(!showMA60)} className={`px-2 py-1 rounded text-[10px] font-bold border ${showMA60 ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-transparent text-slate-400 border-transparent hover:text-slate-600'}`}>季線</button>
                    <button onClick={() => setShowRiver(!showRiver)} className={`px-2 py-1 rounded text-[10px] font-bold border ${showRiver ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-transparent text-slate-400 border-slate-200 hover:text-slate-600'}`}>河流</button>
                    <button onClick={() => setShowTrend(!showTrend)} className={`px-2 py-1 rounded text-[10px] font-bold border ${showTrend ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-transparent text-slate-400 border-slate-200 hover:text-slate-600'}`}>趨勢</button>
                </div>
                <div className="flex bg-white/90 rounded-lg border border-slate-200 p-1 backdrop-blur-sm shadow-sm">
                    {[125, 250, 500].map(days => (
                        <button key={days} onClick={() => setChartPeriod(days)} className={`px-2.5 py-1 text-[10px] font-bold rounded transition-colors ${chartPeriod === days ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                            {days === 125 ? '半年' : (days === 250 ? '1年' : '2年')}
                        </button>
                    ))}
                </div>
            </div>
            
            <button onClick={triggerReset} className="absolute bottom-4 left-4 z-10 p-2.5 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors shadow-lg" title="重置">
                <RotateCcw size={18} />
            </button>
            
            {showRspAlert && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-red-600 text-white px-6 py-4 rounded-xl shadow-2xl animate-bounce flex flex-col items-center gap-2">
                    <AlertCircle size={32} />
                    <span className="font-bold text-lg">餘額不足！</span>
                    <span className="text-xs">定期定額已自動暫停</span>
                </div>
            )}

            {warningActive && gameStatus === 'playing' && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10 bg-red-500 text-white px-4 py-1.5 rounded-full shadow-lg animate-pulse flex items-center gap-2 backdrop-blur-sm border-2 border-red-200">
                    <AlertCircle size={16} strokeWidth={2.5} />
                    <span className="text-sm font-extrabold tracking-wide">觸及停損 ({customStopLossInput}%)</span>
                </div>
            )}
            
            {isReady && chartDataInfo.data.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartDataInfo.data} margin={{ top: 60, right: 5, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} opacity={0.8} />
                        <XAxis dataKey="displayDate" hide />
                        <YAxis domain={chartDataInfo.domain} orientation="right" tick={{fill: '#64748b', fontSize: 10, fontWeight: 'bold'}} width={35} tickFormatter={(v) => Math.round(v)} interval="preserveStartEnd" />
                        
                        {showTrend && showMA20 && fullData[currentDay - 20] && (<ReferenceDot x={getDisplayDate(fullData[currentDay - 20].date)} y={fullData[currentDay - 20].nav} shape={renderTriangle} fill="#38bdf8" isAnimationActive={false} />)}
                        {showTrend && showMA60 && fullData[currentDay - 60] && (<ReferenceDot x={getDisplayDate(fullData[currentDay - 60].date)} y={fullData[currentDay - 60].nav} shape={renderTriangle} fill="#1d4ed8" isAnimationActive={false} />)}

                        {showRiver && (<><Line type="monotone" dataKey="riverTop" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} opacity={0.3} /><Line type="monotone" dataKey="riverBottom" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} opacity={0.3} /></>)}
                        {showMA20 && <Line type="monotone" dataKey="ma20" stroke="#38bdf8" strokeWidth={2} dot={false} isAnimationActive={false} opacity={0.9} />}
                        {showMA60 && <Line type="monotone" dataKey="ma60" stroke="#1d4ed8" strokeWidth={2} dot={false} isAnimationActive={false} opacity={0.9} />}
                        <Line type="monotone" dataKey="nav" stroke="#000000" strokeWidth={2.5} dot={false} isAnimationActive={false} shadow="0 0 10px rgba(0, 0, 0, 0.2)" />
                        
                        {units > 0 && chartDataInfo.stopLossPrice && (<ReferenceLine y={chartDataInfo.stopLossPrice} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1.5} label={{ position: 'insideBottomLeft', value: `Stop ${chartDataInfo.stopLossPrice.toFixed(1)}`, fill: '#ef4444', fontSize: 10, fontWeight: 'bold', dy: -5 }} />)}

                        {showTrend && chartDataInfo.data.map((entry, index) => {
                            if (entry.crossSignal) {
                                return <ReferenceDot key={`cross-${index}`} x={entry.displayDate} y={entry.ma60} shape={(props) => renderCrossTriangle({ ...props, direction: entry.crossSignal.type, type: entry.crossSignal.style })} isAnimationActive={false} />;
                            }
                            return null;
                        })}
                    </ComposedChart>
                </ResponsiveContainer>
            ) : <div className="flex items-center justify-center h-full text-slate-400">載入中...</div>}
        </div>

        <div className="bg-white shrink-0 z-20 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] border-t border-slate-200">
            <div className="flex justify-between px-4 py-1.5 bg-slate-50 border-b border-slate-200 text-[10px]">
                <div className="flex gap-2 items-center"><span className="text-slate-500">資產</span><span className={`font-mono font-bold text-xs ${roi>=0?'text-red-500':'text-green-600'}`}>${Math.round(totalAssets).toLocaleString()}</span></div>
                
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setRspConfig(prev => ({...prev, enabled: !prev.enabled}))}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all shadow-sm ${
                            rspConfig.enabled
                                ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 shadow-indigo-200' 
                                : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-50 hover:border-slate-400'
                        }`}
                    >
                        <CalendarClock size={12} className={rspConfig.enabled ? "animate-pulse" : ""} /> 
                        <span>定期定額: {rspConfig.enabled ? '扣款中' : '已暫停'}</span>
                    </button>
                    <span className="text-slate-500">現金</span>
                    <span className="text-emerald-600 font-mono font-bold text-xs">${Math.round(cash).toLocaleString()}</span>
                </div>
            </div>
            
            <div className="grid grid-cols-4 gap-1 p-1.5 bg-white">
                <button onClick={advanceDay} disabled={isAutoPlaying || tradeMode} className="bg-white active:bg-slate-100 text-slate-600 py-3 rounded-xl font-bold text-sm flex flex-col items-center gap-1 border-b-4 border-slate-200 active:border-b-0 active:translate-y-[2px] disabled:opacity-40 disabled:text-slate-400 transition-all shadow-sm hover:bg-slate-50">
                    <MousePointer2 size={16} /> 觀望
                </button>
                <button onClick={() => openTrade('buy')} disabled={isAutoPlaying || cash < 10 || tradeMode} className="bg-rose-600 active:bg-rose-700 text-white py-3 rounded-xl font-bold text-sm flex flex-col items-center gap-1 border-b-4 border-rose-800 active:border-b-0 active:translate-y-[2px] disabled:opacity-40 disabled:bg-slate-200 disabled:text-slate-400 disabled:border-slate-300 transition-all shadow-md shadow-rose-100">
                    <TrendingUp size={16} /> 買進
                </button>
                <button onClick={() => openTrade('sell')} disabled={isAutoPlaying || units <= 0 || tradeMode} className="bg-emerald-600 active:bg-emerald-700 text-white py-3 rounded-xl font-bold text-sm flex flex-col items-center gap-1 border-b-4 border-emerald-800 active:border-b-0 active:translate-y-[2px] disabled:opacity-40 disabled:bg-slate-200 disabled:text-slate-400 disabled:border-slate-300 transition-all shadow-md shadow-emerald-100">
                    <TrendingDown size={16} /> 賣出
                </button>
                <button onClick={toggleAutoPlay} disabled={tradeMode} className={`flex flex-col items-center justify-center gap-1 rounded-xl font-bold text-sm border-b-4 active:border-b-0 active:translate-y-[2px] transition-all shadow-sm py-3 ${isAutoPlaying ? 'bg-amber-500 border-amber-700 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 disabled:text-slate-400'}`}>
                    {isAutoPlaying ? <Pause size={16} /> : <Play size={16} />} {isAutoPlaying ? '暫停' : '自動'}
                </button>
            </div>
        </div>

        <div className="flex-1 bg-slate-50 overflow-y-auto p-1 custom-scrollbar">
            {transactions.length === 0 && <div className="text-center text-slate-400 text-xs mt-8 flex flex-col items-center gap-2">尚未進行任何交易</div>}
            {transactions.map(t => (
                <div key={t.id} className="flex justify-between items-center p-2 mb-1 bg-white rounded border border-slate-200 text-[10px] shadow-sm">
                    <div className="flex items-center gap-2">
                        <span className={`w-10 text-center py-0.5 rounded font-bold ${t.type === 'BUY' ? 'bg-red-50 text-red-500' : (t.type === 'RSP' ? 'bg-indigo-50 text-indigo-600' : 'bg-green-50 text-green-600')}`}>
                            {t.type === 'BUY' ? '買' : (t.type === 'RSP' ? '定額' : '賣')}
                        </span>
                        <span className="text-slate-700 font-mono font-bold">{getDisplayDate(fullData[t.day]?.date)}</span>
                        <span className="text-slate-400 pl-1">{t.type !== 'SELL' ? `$${Number(t.amount).toLocaleString()}` : `${Number(t.units).toFixed(2)}U`}</span>
                    </div>
                    <div className="text-right text-slate-800">
                        <span className="mr-2 font-mono font-bold">${t.price.toFixed(2)}</span>
                        {t.type === 'SELL' && (<span className={`font-bold ${t.pnl >= 0 ? 'text-red-500' : 'text-green-600'}`}>{t.pnl >= 0 ? '+' : ''}{Math.round(t.pnl)}</span>)}
                    </div>
                </div>
            ))}
        </div>

        {tradeMode && (
            <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 pb-8 shadow-[0_-10px_50px_rgba(0,0,0,0.1)] z-50 animate-in slide-in-from-bottom duration-200 rounded-t-2xl">
                <div className="flex justify-between items-center mb-5">
                    <h3 className={`text-lg font-bold flex items-center gap-2 ${tradeMode === 'buy' ? 'text-red-500' : 'text-green-600'}`}>
                        {tradeMode === 'buy' ? <TrendingUp size={20} /> : <TrendingDown size={20} />} 
                        {tradeMode === 'buy' ? '買入' : '賣出'}
                    </h3>
                    <button onClick={closeTrade} className="bg-slate-100 p-1.5 rounded-full text-slate-400 hover:text-slate-600"><X size={20} /></button>
                </div>
                <div className="space-y-4">
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 flex items-center shadow-inner">
                        <span className="text-slate-400 font-mono mr-3 text-lg">{tradeMode === 'buy' ? '$' : 'U'}</span>
                        <input type="number" value={inputAmount} onChange={(e) => setInputAmount(e.target.value)} placeholder={tradeMode === 'buy' ? "輸入金額" : "輸入單位"} className="w-full bg-transparent text-2xl font-mono text-slate-800 outline-none font-bold" autoFocus />
                    </div>
                    <div className="flex gap-2">
                        {[0.25, 0.5, 1].map((pct) => (
                            <button key={pct} onClick={() => tradeMode === 'buy' ? setBuyPercent(pct) : setSellPercent(pct)} className="flex-1 py-3 bg-white hover:bg-slate-50 rounded-lg text-xs font-mono font-bold text-slate-500 border border-slate-300 transition-colors shadow-sm">
                                {pct === 1 ? 'All In' : `${pct*100}%`}
                            </button>
                        ))}
                    </div>
                    <button onClick={tradeMode === 'buy' ? executeBuy : executeSell} className={`w-full py-4 rounded-lg font-bold text-lg flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all ${tradeMode === 'buy' ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-100' : 'bg-green-600 hover:bg-green-700 text-white shadow-green-100'}`}>
                        <Check size={20} /> 確認
                    </button>
                </div>
            </div>
        )}
        
        {gameStatus === 'ended' && (
            <div className="absolute inset-0 bg-white/95 z-50 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300 backdrop-blur-md">
                <Crown size={64} className="text-cyan-500 mb-4 animate-bounce" />
                <h2 className="text-3xl font-bold text-slate-800 mb-2 tracking-tight">體驗完成</h2>
                <p className="text-cyan-600/80 text-sm mb-8 font-mono">{currentFundName}</p>
                <div className="grid grid-cols-2 gap-4 w-full max-w-xs mb-8">
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-lg">
                        <div className="text-xs text-slate-400 mb-1 uppercase tracking-wider font-bold">你的 ROI</div>
                        <div className={`text-xl font-mono font-bold ${roi >= 0 ? 'text-red-500' : 'text-green-600'}`}>{roi > 0 ? '+' : ''}{roi.toFixed(2)}%</div>
                    </div>
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-lg">
                        <div className="text-xs text-slate-400 mb-1 uppercase tracking-wider font-bold">大盤 (Buy&Hold)</div>
                        <div className={`text-xl font-mono font-bold ${benchmarkRoi >= 0 ? 'text-red-500' : 'text-green-600'}`}>{benchmarkRoi > 0 ? '+' : ''}{benchmarkRoi.toFixed(2)}%</div>
                    </div>
                </div>

                <div className="w-full max-w-xs bg-indigo-50 border border-indigo-100 rounded-xl p-3 mb-6 flex justify-between items-center shadow-sm">
                    <span className="text-indigo-800 font-bold text-sm flex items-center gap-1"><CalendarClock size={16}/> 純定期定額績效</span>
                    <span className={`font-mono font-bold text-lg ${pureRspRoi >= 0 ? 'text-red-500' : 'text-green-600'}`}>{pureRspRoi > 0 ? '+' : ''}{pureRspRoi.toFixed(2)}%</span>
                </div>

                <div className="flex flex-col w-full max-w-xs gap-3">
                    <button onClick={() => window.location.href = '/ranked'} className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white py-4 rounded-xl font-bold shadow-lg shadow-cyan-900/20 active:scale-[0.98] transition-all mb-2 animate-pulse">
                        <LogIn size={18} /> 登入保存戰績
                    </button>
                    <button onClick={executeReset} className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-600 py-4 rounded-xl font-bold border border-slate-300 transition-colors">
                        <RotateCcw size={18} /> 再玩一次
                    </button>
                    <button onClick={executeExit} className="text-slate-400 text-xs mt-4 hover:text-slate-600 transition-colors">
                        離開
                    </button>
                </div>
            </div>
        )}
        
        {confirmModal.show && (
            <div className="absolute inset-0 bg-slate-900/50 z-[60] flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-2xl w-full max-w-xs text-center">
                    <h3 className="text-xl font-bold text-slate-800 mb-2">{confirmModal.type === 'exit' ? '離開體驗？' : (confirmModal.type === 'reset' ? '重新體驗？' : '結束體驗')}</h3>
                    <div className="flex gap-3 justify-center mt-6">
                        <button onClick={() => setConfirmModal({show:false, type:null})} className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-500 font-bold hover:bg-slate-200">取消</button>
                        <button onClick={confirmModal.type === 'exit' ? executeExit : (confirmModal.type === 'reset' ? executeReset : executeEndGame)} className="flex-1 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-500">確定</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}