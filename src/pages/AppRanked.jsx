// 2025v11.7 - 單機版 (首頁優化畫面)
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, ResponsiveContainer, ComposedChart, ReferenceDot } from 'recharts';
import { 
  Play, Pause, TrendingUp, TrendingDown, RotateCcw, AlertCircle, X, Check, MousePointer2, Flag, 
  Download, Copy, Maximize, LogOut, Lock, Database, UserCheck, Loader2, Waves, Info, Share2, 
  Mail, MessageCircle, Trophy, Globe, User, CalendarClock, History, Zap,
  Activity, Power, Sword, Sparkles
} from 'lucide-react';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from '../config/firebase'; 
import { FUNDS_LIBRARY } from '../config/funds';
import { useNavigate } from 'react-router-dom'; 
import html2canvas from 'html2canvas';
import ResultCard from '../components/ResultCard'; 

// --- AI 分析模組 ---
import AIAnalysisModal from '../components/AIAnalysisModal';
import { useAIAnalyst } from '../hooks/useAIAnalyst';

import { 
  checkUserNickname, 
  registerNickname, 
  saveGameResult, 
  getLeaderboard, 
  getTickerData 
} from '../services/firestoreService';

// --- Helper Functions ---
const generateRandomData = (years = 30) => {
  const data = [];
  let price = 100.0; 
  const startDate = new Date('1995-01-01');
  const totalDays = years * 250;
  let trend = 0; let volatility = 0.015; 
  for (let i = 0; i < totalDays; i++) {
    const change = (Math.random() - 0.48 + trend) * volatility; 
    price = price * (1 + change);
    if (price < 5) price = 5 + Math.random(); 
    if (i % 200 === 0) { trend = (Math.random() - 0.5) * 0.003; volatility = 0.01 + Math.random() * 0.02; }
    const date = new Date(startDate); date.setDate(startDate.getDate() + (i * 1.4));
    data.push({ id: i, date: date.toISOString().split('T')[0], nav: parseFloat(price.toFixed(2)) });
  }
  return data;
};

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
    const startDate = new Date(data[startDay].date);
    lastRspMonth = startDate.getFullYear() * 12 + startDate.getMonth() - 1;
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

const formatNumber = (num) => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

// --- 繪圖輔助函式 ---

// 1. 扣抵值三角形 (藍色/深藍色)
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

// 2. 交叉訊號繪製器 (支援 實心/空心)
// type: 'solid' (順勢/強訊號) | 'hollow' (逆勢/轉折訊號)
const renderCrossTriangle = (props) => {
    const { cx, cy, direction, type } = props;
    
    // 防呆檢查
    if (!Number.isFinite(cx) || !Number.isFinite(cy) || !direction) return null;

    const isSolid = type === 'solid';
    const strokeColor = direction === 'gold' ? "#ef4444" : "#16a34a"; // 紅 或 綠
    const fillColor = isSolid ? strokeColor : "#ffffff"; // 實心填色 或 空心填白
    
    if (direction === 'gold') {
        // 黃金交叉：紅色向上
        return (
            <polygon 
                points={`${cx},${cy - 4} ${cx - 6},${cy + 8} ${cx + 6},${cy + 8}`} 
                fill={fillColor} 
                stroke={strokeColor}
                strokeWidth={2}
            />
        );
    } else {
        // 死亡交叉：綠色向下
        return (
            <polygon 
                points={`${cx},${cy + 4} ${cx - 6},${cy - 8} ${cx + 6},${cy - 8}`} 
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={2}
            />
        );
    }
};

export default function AppRanked() {
  const [user, setUser] = useState(null); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(true); 
  const navigate = useNavigate();

  // AI 分析
  const { analyzeGame, isAnalyzing, showModal, closeModal, analysisResult, error: aiError } = useAIAnalyst();

  const handleAIAnalysis = () => {
      analyzeGame({
          fundName: currentFundName,
          roi: roi,
          transactions: transactions, 
          nickname: myNickname || (user && user.email ? user.email.split('@')[0] : '匿名玩家')
      });
  };

  // 戰報生成
  const resultCardRef = useRef(null);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownloadReport = async () => {
      if (isGenerating) return;
      if (!resultCardRef.current) { alert("系統錯誤：找不到戰報元件"); return; }
      setIsGenerating(true);
      try {
          await new Promise(r => setTimeout(r, 100));
          const canvas = await html2canvas(resultCardRef.current, { backgroundColor: null, scale: 3, useCORS: true, logging: false, ignoreElements: (el) => el.tagName === 'IMG' && !el.complete });
          canvas.toBlob((blob) => {
              if (!blob) { alert("生成圖片失敗 (Blob is null)"); setIsGenerating(false); return; }
              const url = URL.createObjectURL(blob);
              setGeneratedImage(url);
              setShowImageModal(true);
              setIsGenerating(false);
          }, 'image/png');
      } catch (err) { console.error(err); alert(`發生錯誤：${err?.message || '未知錯誤'}`); setIsGenerating(false); }
  };

  const [myNickname, setMyNickname] = useState(null); 
  const [leaderboardData, setLeaderboardData] = useState([]); 
  const [tickerData, setTickerData] = useState([]); 
  const [showRankModal, setShowRankModal] = useState(false); 
  const [rankUploadStatus, setRankUploadStatus] = useState('idle'); 
  const [inputNickname, setInputNickname] = useState(''); 

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
  const [timeOffset, setTimeOffset] = useState(0); 
  const [realStartDay, setRealStartDay] = useState(0);
  
  const [rspConfig, setRspConfig] = useState({ enabled: false, amount: 5000, day: 6 });
  const [lastRspMonth, setLastRspMonth] = useState(-1);
  const [showRspAlert, setShowRspAlert] = useState(false);

  const [showMA20, setShowMA20] = useState(true);
  const [showMA60, setShowMA60] = useState(true);
  const [showRiver, setShowRiver] = useState(false);
  
  // ★★★ 新增趨勢開關 ★★★
  const [showTrend, setShowTrend] = useState(false);

  const [customStopLossInput, setCustomStopLossInput] = useState(10);
  const [chartPeriod, setChartPeriod] = useState(250);
  const [dataSourceType, setDataSourceType] = useState('random');
  const [selectedFundId, setSelectedFundId] = useState('fund_1');
  
  const [riverMode, setRiverMode] = useState('fixed'); 
  const [riverWidthInput, setRiverWidthInput] = useState(10); 
  const [riverSDMultiplier, setRiverSDMultiplier] = useState(2);

  const [tradeMode, setTradeMode] = useState(null); 
  const [inputAmount, setInputAmount] = useState(''); 
  const [highestNavSinceBuy, setHighestNavSinceBuy] = useState(0);
  const [warningActive, setWarningActive] = useState(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [showCopyToast, setShowCopyToast] = useState(false);
  const [isCssFullscreen, setIsCssFullscreen] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ show: false, type: null });
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [detectedEnv, setDetectedEnv] = useState('Browser');

  const autoPlayRef = useRef(null);

  // --- Effects ---
  useEffect(() => {
      if (!auth) { setAuthError("Firebase Config Error"); setAuthLoading(false); return; }
      const unsubscribe = onAuthStateChanged(auth, async (u) => { 
          setUser(u); setAuthLoading(false);
          if (u) { const nick = await checkUserNickname(u.uid); if (nick) setMyNickname(nick); }
      });
      return () => unsubscribe();
  }, []);

  useEffect(() => { const fetchTicker = async () => { const data = await getTickerData(); if (data) setTickerData(data); }; fetchTicker(); }, []);

  useEffect(() => {
    const data = generateRandomData(30); setFullData(data); setCurrentDay(260); setIsReady(true);
    const ua = (navigator.userAgent || navigator.vendor || window.opera || "").toLowerCase();
    if (ua.indexOf('line') > -1) setDetectedEnv('Line'); else if (ua.indexOf('fban') > -1) setDetectedEnv('Facebook'); else setDetectedEnv('Browser');
  }, []);

  useEffect(() => {
      if (gameStatus === 'playing' && fullData.length > 0 && rspConfig.enabled) {
          const currentData = fullData[currentDay];
          if (!currentData) return;
          const dateObj = new Date(currentData.date); const currentMonth = dateObj.getFullYear() * 12 + dateObj.getMonth(); const dayOfMonth = dateObj.getDate();
          if (currentMonth > lastRspMonth && dayOfMonth >= rspConfig.day) {
              if (cash >= rspConfig.amount) {
                  const buyUnits = rspConfig.amount / currentData.nav; const newTotalUnits = units + buyUnits; const newAvgCost = (units * avgCost + rspConfig.amount) / newTotalUnits;
                  setAvgCost(newAvgCost); setUnits(newTotalUnits); setCash(prev => prev - rspConfig.amount);
                  setTransactions(prev => [{ id: Date.now(), day: currentDay, type: 'RSP', price: currentData.nav, units: buyUnits, amount: rspConfig.amount, balance: cash - rspConfig.amount }, ...prev]);
                  setLastRspMonth(currentMonth);
                  if (units === 0) setHighestNavSinceBuy(currentData.nav);
              } else {
                  setRspConfig(prev => ({ ...prev, enabled: false }));
                  setShowRspAlert(true); setTimeout(() => setShowRspAlert(false), 3000);
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

  // --- Calculations ---
  const currentNav = fullData[currentDay]?.nav || 10;
  
  const getDisplayDate = (dateStr) => {
      if (!dateStr || dataSourceType === 'random') return dateStr;
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

  // ★★★ V11.5 趨勢訊號徽章判斷 ★★★
  const trendSignal = useMemo(() => {
      // 如果沒有開趨勢功能，或是數據不足，就不回傳訊號
      if (!showTrend || !fullData[currentDay]) return null;
      
      const idx = currentDay;
      const curNav = fullData[idx].nav;
      // 計算當日指標
      const ind20 = calculateIndicators(fullData, 20, idx);
      const ind60 = calculateIndicators(fullData, 60, idx);
      const ma20 = ind20.ma; 
      const ma60 = ind60.ma;

      if (!ma20 || !ma60) return null;

      // 判斷邏輯
      if (curNav > ma20 && ma20 > ma60) {
          return { text: '多頭', icon: <TrendingUp size={14} />, style: 'bg-red-100 text-red-600 border-red-200' };
      } else if (curNav < ma20 && ma20 < ma60) {
          return { text: '空頭', icon: <TrendingDown size={14} />, style: 'bg-green-100 text-green-600 border-green-200' };
      }
      
      // 盤整狀態
      return { text: '盤整', icon: <Activity size={14} />, style: 'bg-slate-100 text-slate-500 border-slate-200' };
  }, [fullData, currentDay, showTrend]);
  
  // ★★★ V11.4 核心升級：計算交叉訊號 (含順勢/逆勢判斷) ★★★
  const chartDataInfo = useMemo(() => {
    if (!isReady || fullData.length === 0) return { data: [], domain: [0, 100] };
    
    const start = Math.max(0, currentDay - chartPeriod);
    const end = currentDay + 1;
    
    const slice = fullData.slice(start, end).map((d, idx) => {
        const realIdx = start + idx;
        
        // 1. 當日指標
        const ind20 = calculateIndicators(fullData, 20, realIdx);
        const ind60 = calculateIndicators(fullData, 60, realIdx);
        const ma20 = ind20.ma; const ma60 = ind60.ma; const stdDev60 = ind60.stdDev;

        // 2. 前一日指標 (用於比對交叉)
        const prevRealIdx = realIdx > 0 ? realIdx - 1 : 0;
        const prevInd20 = calculateIndicators(fullData, 20, prevRealIdx);
        const prevInd60 = calculateIndicators(fullData, 60, prevRealIdx);

        // 3. 前五日指標 (用於比對季線趨勢)
        const refRealIdx = realIdx > 5 ? realIdx - 5 : 0;
        const refInd60 = calculateIndicators(fullData, 60, refRealIdx);

        let riverTop = null; 
        let riverBottom = null;
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

        // 4. 訊號判斷：雙重邏輯 (順勢實心 / 逆勢空心)
        let crossSignal = null;
        
        if (ma20 && ma60 && prevInd20.ma && prevInd60.ma && refInd60.ma && realIdx > 5) {
            const isGoldCross = prevInd20.ma <= prevInd60.ma && ma20 > ma60;
            const isDeathCross = prevInd20.ma >= prevInd60.ma && ma20 < ma60;

            // 季線趨勢 (今日 vs 5天前)
            const isTrendUp = ma60 >= refInd60.ma;
            const isTrendDown = ma60 < refInd60.ma;

            if (isGoldCross) {
                // 順勢(季線向上) -> 實心；逆勢(季線向下) -> 空心
                crossSignal = { type: 'gold', style: isTrendUp ? 'solid' : 'hollow' };
            } else if (isDeathCross) {
                // 順勢(季線向下) -> 實心；逆勢(季線向上) -> 空心
                crossSignal = { type: 'death', style: isTrendDown ? 'solid' : 'hollow' };
            }
        }

        return { ...d, displayDate: getDisplayDate(d.date), ma20, ma60, riverTop, riverBottom, crossSignal };
    });

    // 計算 Y 軸範圍
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

  // --- Handlers ---
  const toggleFullscreen = () => setIsCssFullscreen(!isCssFullscreen);
  const handleLogin = async (e) => { e.preventDefault(); setAuthError(''); try { await signInWithEmailAndPassword(auth, email, password); } catch (err) { setAuthError('登入失敗'); } };
  const handleLogout = async () => { await signOut(auth); setGameStatus('shutdown'); setTimeout(() => window.location.reload(), 500); };
  const handleCapitalChange = (e) => {
      const val = e.target.value.replace(/,/g, '');
      if (!isNaN(val) && val !== '') {
          setInitialCapital(Number(val));
      }
  };

  const startGame = async () => {
    let data; let startDay = 0; let fundName = "模擬基金";
    const randomTimeOffset = Math.floor(Math.random() * 51) + 50; setTimeOffset(randomTimeOffset);
    if (dataSourceType === 'real') {
        const selectedFund = FUNDS_LIBRARY.find(f => f.id === selectedFundId); setGameStatus('loading_data');
        try {
            const response = await fetch(selectedFund.file);
            if (!response.ok) throw new Error("找不到數據檔案");
            const rawData = await response.json();
            if (rawData && rawData.length > 5) {
                 data = processRealData(rawData); fundName = selectedFund.name;
                 const minStart = 60; const maxStart = Math.max(minStart, data.length - 250);
                 startDay = Math.floor(Math.random() * (maxStart - minStart + 1)) + minStart;
            } else { throw new Error("數據過少"); }
        } catch (error) { alert(`讀取失敗：${error.message}`); data = generateRandomData(30); startDay = 260; fundName = "隨機模擬基金"; }
    } else { data = generateRandomData(30); startDay = 260; fundName = "隨機模擬基金"; }
    setRankUploadStatus('idle'); setFullData(data); setCash(initialCapital); setCurrentDay(startDay); 
    setRealStartDay(startDay);
    if (data && data[startDay]) { setBenchmarkStartNav(data[startDay].nav); const sd = new Date(data[startDay].date); setLastRspMonth(sd.getFullYear() * 12 + sd.getMonth() - 1); }
    setCurrentFundName(fundName); setGameStatus('playing');
  };

  const executeReset = () => { setConfirmModal({ show: false, type: null }); setShowShareMenu(false); clearInterval(autoPlayRef.current); setIsAutoPlaying(false); setTradeMode(null); setShowRiver(false); setUnits(0); setAvgCost(0); setTransactions([]); setHighestNavSinceBuy(0); setBenchmarkStartNav(null); setRealStartDay(0); setTimeOffset(0); setGameStatus('setup'); };
  const executeEndGame = () => { setConfirmModal({ show: false, type: null }); setGameStatus('ended'); };
  const executeExit = () => { setConfirmModal({ show: false, type: null }); setGameStatus('shutdown'); };
  const handleConfirmClick = () => { if (confirmModal.type === 'exit') executeExit(); else if (confirmModal.type === 'reset') executeReset(); else executeEndGame(); };
  const triggerReset = () => { if (isAutoPlaying) { clearInterval(autoPlayRef.current); setIsAutoPlaying(false); } setConfirmModal({ show: true, type: 'reset' }); };
  const triggerEndGame = () => { if (isAutoPlaying) { clearInterval(autoPlayRef.current); setIsAutoPlaying(false); } setConfirmModal({ show: true, type: 'end' }); };
  const triggerExit = () => { if (isAutoPlaying) { clearInterval(autoPlayRef.current); setIsAutoPlaying(false); } setConfirmModal({ show: true, type: 'exit' }); };
  
  const advanceDay = () => { if (currentDay >= fullData.length - 1) { setGameStatus('ended'); return; } setCurrentDay(prev => prev + 1); };
  const openTrade = (mode) => { if (isAutoPlaying) toggleAutoPlay(); setTradeMode(mode); setInputAmount(''); };
  const closeTrade = () => { setTradeMode(null); setInputAmount(''); };
  const executeBuy = () => { const amount = parseFloat(inputAmount); if (!amount || amount <= 0 || amount > cash) return; const buyUnits = amount / currentNav; const newTotalUnits = units + buyUnits; const newAvgCost = (units * avgCost + amount) / newTotalUnits; setAvgCost(newAvgCost); setUnits(newTotalUnits); setCash(prev => prev - amount); setTransactions(prev => [{ id: Date.now(), day: currentDay, type: 'BUY', price: currentNav, units: buyUnits, amount: amount, balance: cash - amount }, ...prev]); if (units === 0) setHighestNavSinceBuy(currentNav); closeTrade(); advanceDay(); };
  const executeSell = () => { let unitsToSell = parseFloat(inputAmount); if (!unitsToSell || unitsToSell <= 0) return; if (unitsToSell > units) { if (unitsToSell - units < 0.1) unitsToSell = units; else return; } const sellAmount = unitsToSell * currentNav; const costOfSoldUnits = unitsToSell * avgCost; const pnl = sellAmount - costOfSoldUnits; setCash(prev => prev + sellAmount); setUnits(prev => { const remaining = prev - unitsToSell; return remaining < 0.0001 ? 0 : remaining; }); setTransactions(prev => [{ id: Date.now(), day: currentDay, type: 'SELL', price: currentNav, units: unitsToSell, amount: sellAmount, balance: cash + sellAmount, pnl }, ...prev]); if (Math.abs(units - unitsToSell) < 0.0001) { setHighestNavSinceBuy(0); setWarningActive(false); setAvgCost(0); setUnits(0); } closeTrade(); advanceDay(); };
  const toggleAutoPlay = () => { if (isAutoPlaying) { clearInterval(autoPlayRef.current); setIsAutoPlaying(false); } else { setTradeMode(null); setIsAutoPlaying(true); autoPlayRef.current = setInterval(() => { setCurrentDay(prev => prev + 1); }, 100); } };
  
  const fmt = (val, dec) => { if (val === null || isNaN(val)) return '-'; return `"${val.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })}"`; };
  const getDurationString = () => {
      let durationStr = "0年 0個月";
      if (transactions.length > 0) {
          const firstTx = transactions[transactions.length - 1]; const startData = fullData[firstTx.day]; const endData = fullData[currentDay];
          if (startData && endData) { const s = new Date(startData.date); const e = new Date(endData.date); let months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()); const years = Math.floor(months / 12); const remainingMonths = months % 12; durationStr = `${years}年 ${remainingMonths}個月`; }
      }
      return durationStr;
  };
  const getSafeDate = (dayIndex) => { if (dataSourceType === 'random') return `D${dayIndex}`; if (fullData && fullData[dayIndex]) return fullData[dayIndex].date; return 'N/A'; };
  const getCSVContent = () => {
    let durationStr = getDurationString();
    let csvContent = `基金名稱,${currentFundName}\n總報酬率,${roi > 0 ? '+' : ''}${roi.toFixed(2)}%\n總交易時間,${durationStr}\n最終資產,${fmt(totalAssets, 0)}\n\n交易日期,天數,類型,單價,單位數,交易金額,帳戶餘額,損益\n`;
    transactions.forEach(t => {
        const dateStr = getDisplayDate(getSafeDate(t.day));
        const typeStr = t.type === 'BUY' ? '買入' : (t.type === 'RSP' ? '定額' : '賣出');
        const row = `${dateStr},${fmt(t.day, 2)},${typeStr},${fmt(t.price, 2)},${fmt(t.units, 2)},${fmt(t.amount, 0)},${fmt(t.balance, 0)},${t.type === 'SELL' ? fmt(t.pnl, 0) : '-'}`;
        csvContent += row + "\n";
    });
    return csvContent;
  };

  const handleInitiateUpload = async () => { if (rankUploadStatus === 'uploaded') fetchAndShowLeaderboard(); else if (!myNickname) { setRankUploadStatus('asking_nick'); setShowRankModal(true); } else executeUpload(myNickname); };
  const handleRegisterAndUpload = async () => { if (!inputNickname || inputNickname.trim().length < 2) { alert("請輸入暱稱"); return; } setRankUploadStatus('uploading'); try { await registerNickname(user.uid, inputNickname); setMyNickname(inputNickname); await executeUpload(inputNickname); } catch (err) { alert("設定失敗"); setRankUploadStatus('asking_nick'); } };
  const executeUpload = async (nickname) => {
      setRankUploadStatus('uploading'); setShowRankModal(true);
      try {
        let durationMonths = 0; if (transactions.length > 0) { const firstTx = transactions[transactions.length - 1]; const startData = fullData[firstTx.day]; const endData = fullData[currentDay]; if (startData && endData) { const s = new Date(startData.date); const e = new Date(endData.date); durationMonths = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()); } }
        const gameResult = { uid: user.uid, displayName: nickname, fundId: dataSourceType === 'real' ? selectedFundId : 'random', fundName: currentFundName, roi: parseFloat(roi.toFixed(2)), finalAssets: Math.round(totalAssets), durationMonths: durationMonths, version: '2025v1.3' };
        await saveGameResult(gameResult); setRankUploadStatus('uploaded'); fetchAndShowLeaderboard();
      } catch (err) { console.error(err); setRankUploadStatus('error'); }
  };
  const fetchAndShowLeaderboard = async () => { const targetFundId = dataSourceType === 'real' ? selectedFundId : 'random'; const data = await getLeaderboard(targetFundId); setLeaderboardData(data); setShowRankModal(true); };

  const handleShareAction = async (method) => {
    const durationStr = getDurationString();
    const shareText = `📊 Fund 手遊戰報\n基金: ${currentFundName}\n最終資產: $${Math.round(totalAssets).toLocaleString()}\n報酬率: ${roi.toFixed(2)}%\n交易時長: ${durationStr}\n大盤: ${benchmarkRoi.toFixed(2)}% | 定額: ${pureRspRoi.toFixed(2)}%\n`;
    const subject = encodeURIComponent(`[Fund 手遊戰報] ${currentFundName}`); const body = encodeURIComponent(shareText); const encodedText = encodeURIComponent(shareText);
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (method === 'line') window.open(`https://line.me/R/msg/text/?${encodedText}`, '_blank');
    else if (method === 'gmail') {
        const csvContent = getCSVContent(); const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `fund_game_${currentFundName}.csv`; document.body.appendChild(link); link.click(); document.body.removeChild(link);
        if (isMobile) window.location.href = `mailto:?subject=${subject}&body=${body}`;
        else { alert('檔案下載中... 請將下載的 Excel 檔案拖曳至 Gmail 附件區。'); setTimeout(() => window.open(`https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`, '_blank'), 500); }
    } else if (method === 'download') {
        const csvContent = getCSVContent(); const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `fund_game_${currentFundName}.csv`; link.click();
    }
  };
  const copyToClipboard = () => { let text = `📊 Fund 手遊戰報\n基金: ${currentFundName}\n最終資產: $${Math.round(totalAssets).toLocaleString()}\n報酬率: ${roi.toFixed(2)}%\n`; navigator.clipboard.writeText(text).then(() => { setShowCopyToast(true); setTimeout(() => setShowCopyToast(false), 2000); }); };
  const setBuyPercent = (pct) => setInputAmount(Math.floor(cash * pct).toString());
  const setSellPercent = (pct) => { if (pct === 1) setInputAmount(units.toString()); else setInputAmount((units * pct).toFixed(2)); };
  
  const containerStyle = isCssFullscreen ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, width: '100vw', height: '100vh' } : { position: 'relative', height: '100vh', width: '100%' };

  // --- UI ---
  if (authLoading) return <div className="h-screen bg-slate-50 flex items-center justify-center text-slate-500">系統啟動中...</div>;
  if (!user) return ( 
      <div className="h-screen w-screen bg-slate-50 flex flex-col items-center justify-center font-sans p-6">
          <div className="w-full max-w-sm bg-white p-8 rounded-2xl border border-slate-200 shadow-xl">
              <div className="flex justify-center mb-6 text-emerald-500"><Lock size={56} /></div>
              <h2 className="text-2xl font-bold text-slate-800 text-center mb-2">Fund 手遊 V32</h2>
              <p className="text-slate-500 text-center text-sm mb-6">社群爭霸版 - 登入</p>
              <form onSubmit={handleLogin} className="space-y-4">
                  <div><label className="text-xs text-slate-500 ml-1">Email</label><input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-slate-800 focus:border-emerald-500 outline-none"/></div>
                  <div><label className="text-xs text-slate-500 ml-1">密碼</label><input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-slate-800 focus:border-emerald-500 outline-none"/></div>
                  <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-lg transition-all active:scale-[0.98]">登入系統</button>
              </form>
              {authError && <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-500 text-xs text-center">{authError}</div>}
          </div>
      </div>
  );

  if (gameStatus === 'shutdown') return ( <div className="h-screen w-screen bg-slate-50 flex flex-col items-center justify-center text-slate-500 font-sans"><Power size={48} className="mb-4 opacity-50" /><p className="text-lg">系統已關閉</p><button onClick={() => window.location.reload()} className="mt-8 px-6 py-2 border border-slate-300 rounded hover:bg-white hover:text-slate-800 transition-colors">重啟電源</button></div> );
  
if (gameStatus === 'setup') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 p-4 flex flex-col items-center justify-center font-sans">
        {/* 調整 p-6 為 p-5，讓卡片內距也稍微縮小 */}
        <div className="w-full max-w-sm bg-white rounded-xl p-5 shadow-xl border border-slate-200 relative">
            <button onClick={handleLogout} className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 transition-colors" title="登出"><LogOut size={18} /></button>
            
            {/* Logo 區域：mb-8 改為 mb-5 */}
            <div className="flex items-center justify-center gap-3 mb-5">
                <img src="/logo.jpg" alt="Logo" className="h-9 object-contain rounded-sm shadow-sm" />
                <div className="flex flex-col">
                    <span className="font-black text-lg text-slate-800 leading-tight">Fund 手遊</span>
                    <span className="text-[10px] text-slate-500 font-bold tracking-wide">RANKED CHALLENGE</span>
                </div>
            </div>
            
            {/* S1 賽季按鈕：mb-6 改為 mb-4 */}
            <div className="mb-4 flex items-center gap-2">
                <button 
                    onClick={() => navigate('/competition')} 
                    className="w-2/3 flex items-center justify-center gap-2 bg-amber-50 hover:bg-amber-100 text-amber-600 font-bold py-3 rounded-xl border border-amber-200 transition-all group text-sm shadow-sm"
                >
                    <Sword size={18} className="group-hover:rotate-12 transition-transform"/> 
                    S1 賽季競技場
                </button>
                <p className="w-1/3 text-xs text-slate-500 leading-tight text-left pl-1">
                    與其他玩家一較高下，爭奪榮耀！
                </p>
            </div> 
{/* 跑馬燈區域 (Top 5 循環) */}
            {tickerData.length > 0 && (
                <div className="mb-4 w-full h-8 overflow-hidden bg-slate-50 border border-slate-200 rounded flex items-center relative">
                    {/* 1. h-8: 固定高度，讓它變成細長條
                       2. whitespace-nowrap: 關鍵！強制文字不換行
                       3. animate-marquee: 套用動畫
                    */}
                    <div className="whitespace-nowrap animate-marquee flex items-center gap-0">
                        {/* 先排序並只取前 5 名 */}
                        {[...tickerData]
                            .sort((a, b) => b.roi - a.roi) // 確保是高分在前
                            .slice(0, 5) // 只取前 5 筆
                            .map((tick, idx) => (
                            <div key={idx} className="flex items-center">
                                {/* 資料本體 */}
                                <span className="flex items-center text-[10px] text-slate-600 font-mono">
                                    <span className="text-emerald-600 font-bold ml-1">★ {tick.displayName}</span> 
                                    <span className="mx-1 text-slate-400">在</span>
                                    {tick.fundName.substring(0, 6)}... 
                                    <span className="mx-1 text-slate-400">獲利</span>
                                    <span className="text-red-500 font-bold">+{tick.roi}%</span>
                                </span>
                                
                                {/* 分隔線 (除了最後一筆之外都顯示) */}
                                <span className="mx-6 text-slate-300 text-[10px]">|</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            {/* --- 設定區域 Start --- */}

            {/* Row 1: 初始資金 + 停損：mb-4 改為 mb-3 */}
            <div className="flex gap-2 mb-3">
                <div className="w-2/3 flex items-center bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 shadow-sm">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-2">初始資金</span>
                    <input 
                        type="text" 
                        value={formatNumber(initialCapital)} 
                        onChange={handleCapitalChange} 
                        className="w-full bg-transparent text-right text-lg font-mono text-slate-800 font-bold outline-none"
                    />
                </div>
                
                <div className="w-1/3 bg-slate-50 border border-slate-300 rounded-xl px-1 py-2 flex flex-col items-center justify-center shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">停損 (%)</span>
                    <input 
                        type="number" 
                        value={customStopLossInput} 
                        onChange={(e) => setCustomStopLossInput(Number(e.target.value))} 
                        className="w-full bg-transparent text-center text-lg font-mono text-slate-800 font-bold outline-none h-5"
                    />
                </div>
            </div>
            
            {/* Row 2: 定期定額 (RSP)：mb-4 改為 mb-3 */}
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

{/* Row 3: 挑戰項目 */}
            <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">選擇挑戰項目</label>
            <div className="flex gap-2 mb-3 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button 
                    onClick={() => setDataSourceType('random')} 
                    className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all duration-300 flex items-center justify-center gap-1.5 ${
                        dataSourceType === 'random' 
                        ? 'bg-violet-500 text-white shadow-md shadow-violet-200 ring-1 ring-violet-400' 
                        : 'text-slate-500 hover:bg-white hover:shadow-sm hover:text-slate-700'
                    }`}
                >
                    <span className={dataSourceType === 'random' ? 'animate-pulse' : ''}>🎲</span> 隨機
                </button>
                
                <button 
                    onClick={() => setDataSourceType('real')} 
                    className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all duration-300 flex items-center justify-center gap-1.5 ${
                        dataSourceType === 'real' 
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-200 ring-1 ring-blue-500' 
                        : 'text-slate-500 hover:bg-white hover:shadow-sm hover:text-slate-700'
                    }`}
                >
                    <span className={dataSourceType === 'real' ? 'animate-bounce' : ''}>📉</span> 真實
                </button>
            </div>
            
            {/* 真實數據下拉選單 (配色微調以配合藍色主題) */}
            {dataSourceType === 'real' && (
                <div className="mb-3 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-2 bg-blue-50/50 border border-blue-200 rounded-xl px-3 py-2 shadow-sm">
                        <Database size={18} className="text-blue-600" />
                        <select 
                            value={selectedFundId} 
                            onChange={(e) => setSelectedFundId(e.target.value)} 
                            className="w-full bg-transparent text-blue-900 outline-none text-xs font-bold"
                        >
                            {FUNDS_LIBRARY.map(fund => (
                                <option key={fund.id} value={fund.id} className="bg-white text-slate-700">
                                    {fund.name.replace('🔒 [進階] ', '')}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            )}            
            {/* Row 4: 河流圖參數：mb-6 改為 mb-4 */}
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

            {/* Row 5: 玩家資訊 + 開始按鈕：mb-6 改為 mb-4 */}
            <div className="flex gap-2 mb-4">
                <div className="flex-1 bg-slate-50 border border-slate-300 rounded-xl p-1.5 flex flex-col items-center justify-center gap-0.5 overflow-hidden shadow-sm">
                    <div className="flex items-center gap-1 text-emerald-600">
                        <UserCheck size={12} />
                        <span className="text-[10px] font-bold">玩家</span>
                    </div>
                    <div className="flex flex-col items-center w-full">
                        <span className="text-[10px] text-slate-600 font-mono truncate w-full text-center px-1">
                            {user.email.split('@')[0]}
                        </span>
                        {myNickname && <span className="text-[10px] text-amber-500 font-bold truncate w-full text-center leading-none">({myNickname})</span>}
                    </div>
                </div>

                <button onClick={startGame} className="flex-[2] bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold rounded-xl text-lg shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 py-2">
                    <Play size={22} fill="currentColor" /> 開始
                </button>
            </div>
            
            <div className="mt-2 text-center"><span className="bg-slate-100 text-slate-400 text-[10px] px-2 py-1 rounded-full border border-slate-200 font-mono">2025v11.7 NBS-奈AI團隊</span></div>
        </div>
      </div>
    );
  }

  if (gameStatus === 'loading_data') return ( <div className="h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-500 gap-4"><Loader2 size={48} className="animate-spin text-emerald-500" /><p className="text-slate-500">正在載入數據...</p></div> );

  return (
    <div style={containerStyle} className="bg-slate-50 text-slate-800 font-sans flex flex-col overflow-hidden transition-all duration-300">
        <header className="bg-white px-4 py-2 border-b border-slate-200 flex justify-between items-center shrink-0 h-12 z-30 relative shadow-sm">
            <button onClick={triggerExit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 text-sm hover:bg-red-50 hover:text-red-600 hover:border-red-200 active:scale-95 transition-all font-bold"><LogOut size={14} /> 離開</button>
            <div className="flex flex-col items-center"><span className="text-[10px] text-slate-400 max-w-[140px] truncate font-bold">{currentFundName}</span><span className={`text-base font-bold font-mono ${roi >= 0 ? 'text-red-500' : 'text-green-600'}`}>{roi > 0 ? '+' : ''}{roi.toFixed(2)}%</span></div>
            <div className="flex gap-2"><button onClick={toggleFullscreen} className="p-2 rounded hover:bg-slate-100 text-slate-500"><Maximize size={18} /></button><button onClick={triggerEndGame} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 text-sm hover:bg-emerald-100 active:scale-95 transition-all font-bold"><Flag size={14} /> 結算</button></div>
        </header>

        <div className="relative w-full bg-white border-b border-slate-200 shrink-0 z-0" style={{ height: '50%' }}>
            <div className="absolute top-3 left-4 z-0 pointer-events-none">
                <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-slate-800 tracking-tight shadow-white drop-shadow-sm font-mono">{currentNav.toFixed(2)}</span>
                        {trendSignal && (<div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border ${trendSignal.style} shadow-sm animate-in fade-in zoom-in duration-300`}>{trendSignal.icon}<span className="text-[10px] font-bold">{trendSignal.text}</span></div>)}
                    </div>
                    <span className="text-[10px] sm:text-sm text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 flex items-center gap-1 w-fit">{chartDataInfo.data.length > 0 ? chartDataInfo.data[chartDataInfo.data.length-1].displayDate : '---'}{timeOffset > 0 && <span className="text-[7px] sm:text-[9px] bg-slate-200 px-1 rounded text-slate-500 ml-1"></span>}</span>
                </div>
                {avgCost > 0 && (<div className="text-xs text-slate-400 mt-1 font-mono font-bold ml-1">均價 ${avgCost.toFixed(2)}</div>)}
            </div>
            <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-2">
                <div className="flex gap-1 bg-white/90 p-1 rounded-lg backdrop-blur-sm border border-slate-200 shadow-sm">
                    <button onClick={() => setShowMA20(!showMA20)} className={`px-2 py-1 rounded text-[10px] font-bold border ${showMA20 ? 'bg-sky-50 text-sky-600 border-sky-200' : 'bg-transparent text-slate-400 border-transparent hover:text-slate-600'}`}>月線</button>
                    <button onClick={() => setShowMA60(!showMA60)} className={`px-2 py-1 rounded text-[10px] font-bold border ${showMA60 ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-transparent text-slate-400 border-transparent hover:text-slate-600'}`}>季線</button>
                    <button onClick={() => setShowRiver(!showRiver)} className={`px-2 py-1 rounded text-[10px] font-bold border ${showRiver ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-transparent text-slate-400 border-slate-200 hover:text-slate-600'}`}>河流</button>
                    <button onClick={() => setShowTrend(!showTrend)} className={`px-2 py-1 rounded text-[10px] font-bold border ${showTrend ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-transparent text-slate-400 border-slate-200 hover:text-slate-600'}`}>趨勢</button>
                </div>
                <div className="flex bg-white/90 rounded-lg border border-slate-200 p-1 backdrop-blur-sm shadow-sm">{[125, 250, 500].map(days => (<button key={days} onClick={() => setChartPeriod(days)} className={`px-2.5 py-1 text-[10px] font-bold rounded transition-colors ${chartPeriod === days ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{days === 125 ? '半年' : (days === 250 ? '1年' : '2年')}</button>))}</div>
            </div>
            {/*<button onClick={triggerReset} className="absolute bottom-4 left-4 z-10 p-2.5 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors shadow-lg" title="重置"><RotateCcw size={18} /></button>*/}
            {showRspAlert && (<div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-red-600 text-white px-6 py-4 rounded-xl shadow-2xl animate-bounce flex flex-col items-center gap-2"><AlertCircle size={32} /><span className="font-bold text-lg">餘額不足！</span><span className="text-xs">定期定額已自動暫停</span></div>)}
            {warningActive && gameStatus === 'playing' && (<div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10 bg-red-500 text-white px-4 py-1.5 rounded-full shadow-lg animate-pulse flex items-center gap-2 backdrop-blur-sm border-2 border-red-200"><AlertCircle size={16} strokeWidth={2.5} /><span className="text-sm font-extrabold tracking-wide">觸及停損 ({customStopLossInput}%)</span></div>)}
            
            {isReady && chartDataInfo.data.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartDataInfo.data} margin={{ top: 80, right: 5, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} opacity={0.8} />
                        <XAxis dataKey="displayDate" hide />
                        <YAxis domain={chartDataInfo.domain} orientation="right" tick={{fill: '#64748b', fontSize: 11, fontWeight: 'bold'}} width={40} tickFormatter={(v) => Math.round(v)} interval="preserveStartEnd" />
                        
                        {showTrend && showMA20 && fullData[currentDay - 20] && (<ReferenceDot x={getDisplayDate(fullData[currentDay - 20].date)} y={fullData[currentDay - 20].nav} shape={renderTriangle} fill="#38bdf8" isAnimationActive={false} />)}
                        {showTrend && showMA60 && fullData[currentDay - 60] && (<ReferenceDot x={getDisplayDate(fullData[currentDay - 60].date)} y={fullData[currentDay - 60].nav} shape={renderTriangle} fill="#1d4ed8" isAnimationActive={false} />)}

                        {showRiver && (<><Line type="monotone" dataKey="riverTop" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} opacity={0.3} /><Line type="monotone" dataKey="riverBottom" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} opacity={0.3} /></>)}
                        {showMA20 && <Line type="monotone" dataKey="ma20" stroke="#38bdf8" strokeWidth={2} dot={false} isAnimationActive={false} opacity={0.9} />}
                        {showMA60 && <Line type="monotone" dataKey="ma60" stroke="#1d4ed8" strokeWidth={2} dot={false} isAnimationActive={false} opacity={0.9} />}
                        <Line type="monotone" dataKey="nav" stroke="#000000" strokeWidth={2.5} dot={false} isAnimationActive={false} shadow="0 0 10px rgba(0, 0, 0, 0.2)" />
                        
                        {units > 0 && chartDataInfo.stopLossPrice && (<ReferenceLine y={chartDataInfo.stopLossPrice} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={2} label={{ position: 'insideBottomLeft', value: `Stop ${chartDataInfo.stopLossPrice.toFixed(1)}`, fill: '#ef4444', fontSize: 11, fontWeight: 'bold', dy: -8 }} />)}

                        {showTrend && chartDataInfo.data.map((entry, index) => {
                            if (entry.crossSignal) {
                                return (
                                    <ReferenceDot
                                        key={`cross-${index}`}
                                        x={entry.displayDate}
                                        y={entry.ma60} 
                                        shape={(props) => renderCrossTriangle({ 
                                            ...props, 
                                            direction: entry.crossSignal.type, 
                                            type: entry.crossSignal.style 
                                        })}
                                        isAnimationActive={false}
                                    />
                                );
                            }
                            return null;
                        })}
                    </ComposedChart>
                </ResponsiveContainer>
            ) : <div className="flex items-center justify-center h-full text-slate-400">載入中...</div>}
        </div>

        <div className="bg-white shrink-0 z-20 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] border-t border-slate-200">
            <div className="flex justify-between px-5 py-1.5 bg-slate-50 border-b border-slate-200 text-[10px]">
                <div className="flex gap-2 items-center"><span className="text-slate-500">總資產</span><span className={`font-mono font-bold text-xs ${roi>=0?'text-red-500':'text-green-600'}`}>${Math.round(totalAssets).toLocaleString()}</span></div>
                <div className="flex items-center gap-2"><button onClick={() => setRspConfig(prev => ({...prev, enabled: !prev.enabled}))} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all shadow-sm ${rspConfig.enabled ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 shadow-indigo-200' : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-50 hover:border-slate-400'}`}><CalendarClock size={12} className={rspConfig.enabled ? "animate-pulse" : ""} /> <span>定期定額: {rspConfig.enabled ? '扣款中' : '已暫停'}</span></button><span className="text-slate-500">現金</span><span className="text-emerald-600 font-mono font-bold text-xs">${Math.round(cash).toLocaleString()}</span></div>
            </div>
            
            <div className="grid grid-cols-4 gap-1 p-1.5 bg-white">
                <button onClick={advanceDay} disabled={isAutoPlaying || tradeMode} className="bg-white active:bg-slate-100 text-slate-600 py-2 rounded-xl font-bold text-xs flex flex-col items-center gap-1 border-b-4 border-slate-200 active:border-b-0 active:translate-y-[2px] disabled:opacity-40 disabled:text-slate-400 transition-all shadow-sm hover:bg-slate-50"><MousePointer2 size={16} className="text-slate-400"/> 觀望</button>
                <button onClick={() => openTrade('buy')} disabled={isAutoPlaying || cash < 10 || tradeMode} className="bg-rose-600 active:bg-rose-700 text-white py-2 rounded-xl font-bold text-xs flex flex-col items-center gap-1 border-b-4 border-rose-800 active:border-b-0 active:translate-y-[2px] disabled:opacity-40 disabled:bg-slate-200 disabled:text-slate-400 disabled:border-slate-300 transition-all shadow-md shadow-rose-100"><TrendingUp size={16} /> 買進</button>
                <button onClick={() => openTrade('sell')} disabled={isAutoPlaying || units <= 0 || tradeMode} className="bg-emerald-600 active:bg-emerald-700 text-white py-2 rounded-xl font-bold text-xs flex flex-col items-center gap-1 border-b-4 border-emerald-800 active:border-b-0 active:translate-y-[2px] disabled:opacity-40 disabled:bg-slate-200 disabled:text-slate-400 disabled:border-slate-300 transition-all shadow-md shadow-emerald-100"><TrendingDown size={16} /> 賣出</button>
                <button onClick={toggleAutoPlay} disabled={tradeMode} className={`flex flex-col items-center justify-center gap-1 rounded-xl font-bold text-xs border-b-4 active:border-b-0 active:translate-y-[2px] transition-all shadow-sm py-2 ${isAutoPlaying ? 'bg-amber-500 border-amber-700 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 disabled:text-slate-400'}`}>{isAutoPlaying ? <Pause size={16} /> : <Play size={16} />} {isAutoPlaying ? '暫停' : '自動'}</button>
            </div>
        </div>

        <div className="flex-1 bg-slate-50 overflow-y-auto p-2 custom-scrollbar">
            {transactions.length === 0 && <div className="text-center text-slate-400 text-sm mt-12 flex flex-col items-center gap-2"><Info size={32} opacity={0.5}/>尚未進行任何交易</div>}
            {transactions.map(t => (
                <div key={t.id} className="flex justify-between items-center p-3 mb-2 bg-white rounded-xl border border-slate-200 text-xs shadow-sm">
                    <div className="flex items-center gap-3"><span className={`w-10 text-center py-1 rounded-md font-bold text-xs ${t.type === 'BUY' ? 'bg-red-50 text-red-500' : (t.type === 'RSP' ? 'bg-indigo-50 text-indigo-600' : 'bg-green-50 text-green-600')}`}>{t.type === 'BUY' ? '買進' : (t.type === 'RSP' ? '定額' : '賣出')}</span><div className="flex flex-col"><span className="text-slate-700 font-mono font-bold">{getDisplayDate(getSafeDate(t.day))}</span><span className="text-slate-400 text-[10px]">{t.type !== 'SELL' ? `$${t.amount.toLocaleString()}` : `${parseFloat(t.units).toFixed(2)} 單位`}</span></div></div>
                    <div className="text-right"><div className="text-slate-800 font-mono text-sm font-bold">${t.price.toFixed(2)}</div>{t.type === 'SELL' && (<span className={`font-bold font-mono ${t.pnl >= 0 ? 'text-red-500' : 'text-green-600'}`}>{t.pnl >= 0 ? '+' : ''}{Math.round(t.pnl)}</span>)}</div>
                </div>
            ))}
        </div>

        {tradeMode && (
            <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-5 pb-8 shadow-[0_-10px_50px_rgba(0,0,0,0.1)] z-50 animate-in slide-in-from-bottom duration-200 rounded-t-3xl">
                <div className="flex justify-between items-center mb-6"><h3 className={`text-2xl font-bold flex items-center gap-2 ${tradeMode === 'buy' ? 'text-red-500' : 'text-green-600'}`}>{tradeMode === 'buy' ? <TrendingUp size={28} /> : <TrendingDown size={28} />} {tradeMode === 'buy' ? '買進資金' : '賣出單位'}</h3><button onClick={closeTrade} className="bg-slate-100 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"><X size={24} /></button></div>
                <div className="space-y-5"><div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 flex items-center shadow-inner"><span className="text-slate-400 font-mono mr-3 text-2xl font-bold">{tradeMode === 'buy' ? '$' : 'U'}</span><input type="number" value={inputAmount} onChange={(e) => setInputAmount(e.target.value)} placeholder={tradeMode === 'buy' ? "輸入金額" : "輸入單位"} className="w-full bg-transparent text-3xl font-mono text-slate-800 outline-none font-bold" autoFocus /></div>
                <div className="flex gap-3">{[0.25, 0.5, 1].map((pct) => (<button key={pct} onClick={() => tradeMode === 'buy' ? setBuyPercent(pct) : setSellPercent(pct)} className="flex-1 py-4 bg-white hover:bg-slate-50 rounded-xl text-sm font-mono font-bold text-slate-500 border border-slate-300 transition-colors shadow-sm">{pct === 1 ? '全部 (All In)' : `${pct*100}%`}</button>))}</div>
                <button onClick={tradeMode === 'buy' ? executeBuy : executeSell} className={`w-full py-5 rounded-2xl font-bold text-xl flex items-center justify-center gap-3 shadow-lg active:scale-[0.98] transition-all ${tradeMode === 'buy' ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-100' : 'bg-green-500 hover:bg-green-600 text-white shadow-green-100'}`}><Check size={24} strokeWidth={3} /> 確認交易</button></div>
            </div>
        )}
        
        {gameStatus === 'ended' && (
            <div className="absolute inset-0 bg-white/95 z-50 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300 backdrop-blur-md">
                <div className="bg-emerald-50 p-4 rounded-full mb-4 ring-4 ring-emerald-100"><Activity size={56} className="text-emerald-500" /></div>
                <h2 className="text-3xl font-bold text-slate-800 mb-1 tracking-tight">結算成績單</h2>
                <p className="text-sm text-slate-500 mb-8 font-medium">(2025v11.6 單機版結算)</p>
                <div className="grid grid-cols-2 gap-4 w-full max-w-xs mb-8">
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-lg">
                        <div className="text-xs text-slate-400 mb-1 uppercase tracking-wider font-bold">你的操作</div>
                        <div className={`text-2xl font-mono font-bold ${roi >= 0 ? 'text-red-500' : 'text-green-600'}`}>{roi > 0 ? '+' : ''}{roi.toFixed(2)}%</div>
                    </div>
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-inner">
                        <div className="text-xs text-slate-500 mb-1 uppercase tracking-wider font-bold">大盤 (Buy&Hold)</div>
                        <div className={`text-2xl font-mono font-bold ${benchmarkRoi >= 0 ? 'text-red-500' : 'text-green-600'}`}>{benchmarkRoi > 0 ? '+' : ''}{benchmarkRoi.toFixed(2)}%</div>
                    </div>
                </div>
                <div className="w-full max-w-xs bg-indigo-50 border border-indigo-100 rounded-xl p-3 mb-6 flex justify-between items-center shadow-sm"><span className="text-indigo-800 font-bold text-sm flex items-center gap-1"><CalendarClock size={16}/> 純定期定額績效</span><span className={`font-mono font-bold text-lg ${pureRspRoi >= 0 ? 'text-red-500' : 'text-green-600'}`}>{pureRspRoi > 0 ? '+' : ''}{pureRspRoi.toFixed(2)}%</span></div>
                {dataSourceType === 'real' && fullData[realStartDay] && fullData[currentDay] && (<div className="bg-amber-50 border border-amber-200 p-4 rounded-xl w-full max-w-xs mb-6 text-left"><div className="flex items-center gap-2 mb-2 text-amber-700 font-bold"><History size={16} /> 時空解密</div><div className="text-xs text-slate-600 space-y-1"><p>真實區間：<span className="font-mono font-bold">{fullData[realStartDay].date} ~ {fullData[currentDay].date}</span></p><p>表現評語：<span className="font-bold text-slate-800">{roi > benchmarkRoi ? '🏆 你戰勝了大盤！' : '📚 下次試試長期持有？'}</span></p></div></div>)}
                <div className="flex flex-col w-full max-w-xs gap-3">
                    <button onClick={() => setShowShareMenu(true)} className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-600 py-4 rounded-xl font-bold border border-slate-200 transition-colors text-sm shadow-sm"><Share2 size={18} className="text-blue-500"/> 匯出 Excel / 分享</button>
                    {/* AI 分析按鈕 */}
                    <button 
                        onClick={handleAIAnalysis}
                        disabled={isAnalyzing}
                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white py-4 rounded-xl font-bold shadow-lg active:scale-[0.98] transition-all mb-2 border border-violet-400/30 relative overflow-hidden group"
                    >
                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                        <Sparkles size={20} className="text-yellow-300 animate-pulse" /> 
                        {isAnalyzing ? 'AI 正在讀取數據...' : '召喚 AI 導師復盤'}
                    </button>
                    <button onClick={executeReset} className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-emerald-100 active:scale-[0.98] transition-all mt-2"><RotateCcw size={20} /> 重新開始挑戰</button>
                    <div className="mt-6 text-center text-[10px] text-slate-400">Environment: {detectedEnv} | 2025v11.6 單機版</div>
                </div>
            </div>
        )}

        {showShareMenu && (<div className="absolute inset-0 bg-slate-900/50 z-[60] flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in duration-200"><div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-2xl w-full max-w-sm text-center relative"><button onClick={() => setShowShareMenu(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2"><X size={24}/></button><h3 className="text-xl font-bold text-slate-800 mb-2">分享戰報</h3><div className="flex flex-col gap-3 mt-4"><button onClick={() => handleShareAction('line')} className="flex items-center justify-center gap-3 bg-[#06C755] hover:bg-[#05b54d] text-white py-3 rounded-xl font-bold transition-colors shadow-sm"><MessageCircle size={20} /> Line</button><button onClick={() => handleShareAction('gmail')} className="flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-red-600 py-3 rounded-xl font-bold transition-colors border border-slate-200 shadow-sm"><Mail size={20} /> Gmail</button><button onClick={() => handleShareAction('download')} className="flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-600 py-3 rounded-xl font-bold transition-colors border border-slate-200 shadow-sm"><Download size={20} /> 下載 Excel</button></div></div></div>)}

        {confirmModal.show && (<div className="absolute inset-0 bg-slate-900/50 z-[60] flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in duration-200"><div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-2xl w-full max-w-xs text-center"><div className="flex justify-center mb-4">{confirmModal.type === 'exit' ? <LogOut size={48} className="text-slate-400"/> : confirmModal.type === 'reset' ? <RotateCcw size={48} className="text-slate-400"/> : <Flag size={48} className="text-emerald-500"/>}</div><h3 className="text-xl font-bold text-slate-800 mb-2">{confirmModal.type === 'exit' ? '離開遊戲' : (confirmModal.type === 'reset' ? '重置遊戲' : '結算遊戲')}</h3><div className="flex gap-3 justify-center mt-6"><button onClick={() => setConfirmModal({show:false, type:null})} className="flex-1 py-3 rounded-xl bg-white text-slate-500 font-bold hover:bg-slate-50 border border-slate-200">取消</button><button onClick={handleConfirmClick} className={`flex-1 py-3 rounded-xl font-bold text-white shadow-md ${confirmModal.type === 'exit' ? 'bg-red-500 hover:bg-red-600' : (confirmModal.type === 'reset' ? 'bg-slate-500 hover:bg-slate-600' : 'bg-emerald-500 hover:bg-emerald-600')}`}>確定</button></div></div></div>)}

        {showImageModal && (
            <div className="fixed inset-0 z-[9999] bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                <div className="w-full max-w-sm bg-transparent flex flex-col items-center gap-4">
                    <div className="text-white text-center">
                        <h3 className="text-xl font-bold mb-1">戰報已生成！</h3>
                        <p className="text-sm text-slate-300">請長按下方圖片進行儲存或分享</p>
                    </div>
                    {generatedImage && (<img src={generatedImage} alt="戰報" className="w-full rounded-xl shadow-2xl border border-white/20"/>)}
                    <button onClick={() => setShowImageModal(false)} className="mt-4 bg-white text-slate-900 px-8 py-3 rounded-full font-bold shadow-lg active:scale-95 transition-all">關閉</button>
                </div>
            </div>
        )}

        <AIAnalysisModal 
            isOpen={showModal}
            onClose={closeModal}
            isLoading={isAnalyzing}
            analysisResult={analysisResult}
            error={aiError}
        />
        
        {/* 隱藏的戰報生成卡片 */}
        <ResultCard 
            ref={resultCardRef} 
            data={{
                fundName: currentFundName,
                roi: roi,
                assets: Math.round(totalAssets),
                duration: fullData[realStartDay] && fullData[currentDay] ? `${getDisplayDate(fullData[realStartDay]?.date)} ~ ${getDisplayDate(fullData[currentDay]?.date)}` : 'N/A',
                nickname: myNickname || (user && user.email ? user.email.split('@')[0] : '匿名玩家'),
                gameType: '個人挑戰賽 S1',
                dateRange: fullData[realStartDay] && fullData[currentDay] ? `${getDisplayDate(fullData[realStartDay]?.date)} ~ ${getDisplayDate(fullData[currentDay]?.date)}` : 'N/A'
            }}
        />
    </div>
  );
}