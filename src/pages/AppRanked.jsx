// 2025v9.7 - 會員版 (修復黑屏與下載錯誤的最終版)
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, ResponsiveContainer, ComposedChart } from 'recharts';
import { Play, Pause, TrendingUp, TrendingDown, Activity, RotateCcw, AlertCircle, X, Check, MousePointer2, Flag, Download, Copy, Maximize, LogOut, Power, Lock, Database, UserCheck, Loader2, Waves, Info, ExternalLink, FileSpreadsheet, Share2, Mail, MessageCircle, Monitor, Trophy, Globe, User, Sword, CalendarClock, History, Settings2, Zap } from 'lucide-react';

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";

import { auth } from '../config/firebase'; 
import { FUNDS_LIBRARY } from '../config/funds';
import { useNavigate } from 'react-router-dom'; 
import html2canvas from 'html2canvas';
import ResultCard from '../components/ResultCard'; 

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

// ============================================
// 2025v1.3: AppRanked 主元件
// ============================================
export default function AppRanked() {
  const [user, setUser] = useState(null); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(true); 
  const navigate = useNavigate();

  // ★★★ 戰報圖片與 Modal 邏輯 (修正版) ★★★
  const resultCardRef = useRef(null);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false); // 新增：控制按鈕讀取狀態

  const handleDownloadReport = async () => {
      console.log("開始生成戰報...");
      
      // 防止重複點擊
      if (isGenerating) return;
      
      if (!resultCardRef.current) {
          alert("系統錯誤：找不到戰報元件 (Ref is null)");
          return;
      }
      
      setIsGenerating(true); // 設定為生成中 (取代直接修改 DOM)

      try {
          // 延遲一點點，讓 UI 有機會更新 loading 狀態
          await new Promise(resolve => setTimeout(resolve, 100));

          const canvas = await html2canvas(resultCardRef.current, {
              backgroundColor: null, 
              scale: 3, 
              useCORS: true, // 允許跨域
              allowTaint: true,
              logging: false,
              // 強制忽略讀取失敗的圖片，避免全黑
              ignoreElements: (element) => {
                  if (element.tagName === 'IMG' && !element.complete) return true;
                  return false;
              }
          });

          canvas.toBlob((blob) => {
              if (!blob) {
                  alert("圖片生成失敗 (Blob is null)");
                  setIsGenerating(false);
                  return;
              }
              const url = URL.createObjectURL(blob);
              setGeneratedImage(url);
              setShowImageModal(true);
              setIsGenerating(false); // 完成後恢復
          }, 'image/png');

      } catch (err) {
          console.error("戰報生成失敗:", err);
          // 顯示完整的錯誤訊息，不再是 undefined
          alert(`生成失敗：${err?.message || JSON.stringify(err)}`);
          setIsGenerating(false); // 失敗也要恢復
      }
  };
  // ★★★ 結束 ★★★

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
  const [showCsvCopyToast, setShowCsvCopyToast] = useState(false);

  const autoPlayRef = useRef(null);

  useEffect(() => {
      if (!auth) { setAuthError("Firebase Config Error"); setAuthLoading(false); return; }
      const unsubscribe = onAuthStateChanged(auth, async (u) => { 
          setUser(u); 
          setAuthLoading(false);
          if (u) {
             const nick = await checkUserNickname(u.uid);
             if (nick) setMyNickname(nick);
          }
      });
      return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchTicker = async () => {
      const data = await getTickerData();
      if (data && data.length > 0) setTickerData(data);
    };
    fetchTicker();
  }, []);

  useEffect(() => {
    const data = generateRandomData(30);
    setFullData(data);
    setCurrentDay(260);
    setIsReady(true);
    
    const ua = (navigator.userAgent || navigator.vendor || window.opera || "").toLowerCase();
    if (ua.indexOf('line') > -1) setDetectedEnv('Line');
    else if (ua.indexOf('fban') > -1 || ua.indexOf('fbav') > -1) setDetectedEnv('Facebook');
    else if (ua.indexOf('instagram') > -1) setDetectedEnv('Instagram');
    else setDetectedEnv('Standard Browser');
  }, []);

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
                  setTransactions(prev => [{ 
                      id: Date.now(), 
                      day: currentDay, 
                      type: 'RSP', 
                      price: currentData.nav, 
                      units: buyUnits, 
                      amount: rspConfig.amount, 
                      balance: cash - rspConfig.amount 
                  }, ...prev]);
                  
                  setLastRspMonth(currentMonth);
                  if (units === 0) setHighestNavSinceBuy(currentData.nav);
              } else {
                  setRspConfig(prev => ({ ...prev, enabled: false }));
                  setShowRspAlert(true);
                  setTimeout(() => setShowRspAlert(false), 3000);
                  if (isAutoPlaying) {
                      clearInterval(autoPlayRef.current);
                      setIsAutoPlaying(false);
                  }
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

  const chartDataInfo = useMemo(() => {
    if (!isReady || fullData.length === 0) return { data: [], domain: [0, 100] };
    const start = Math.max(0, currentDay - chartPeriod);
    const end = currentDay + 1;
    const slice = fullData.slice(start, end).map((d, idx) => {
        const realIdx = start + idx;
        const ind20 = calculateIndicators(fullData, 20, realIdx);
        const ind60 = calculateIndicators(fullData, 60, realIdx);
        const ma20 = ind20.ma; const ma60 = ind60.ma; const stdDev60 = ind60.stdDev;
        let riverTop = null; let riverBottom = null;
        if (ma60) {
            if (riverMode === 'fixed') { const ratio = riverWidthInput / 100; riverTop = ma60 * (1 + ratio); riverBottom = ma60 * (1 - ratio); } 
            else { if (stdDev60) { riverTop = ma60 + (stdDev60 * riverSDMultiplier); riverBottom = ma60 - (stdDev60 * riverSDMultiplier); } }
        }
        return { ...d, displayDate: getDisplayDate(d.date), ma20, ma60, riverTop, riverBottom };
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
  }, [fullData, currentDay, isReady, units, highestNavSinceBuy, customStopLossInput, showMA20, showMA60, showRiver, chartPeriod, riverMode, riverWidthInput, riverSDMultiplier, timeOffset]);

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
  const handleLogin = async (e) => { e.preventDefault(); setAuthError(''); try { await signInWithEmailAndPassword(auth, email, password); } catch (err) { setAuthError('登入失敗'); } };
  const handleLogout = async () => { await signOut(auth); setGameStatus('shutdown'); setTimeout(() => window.location.reload(), 500); };

  const startGame = async () => {
    let data; 
    let startDay = 0; 
    let fundName = "模擬基金";
    const randomTimeOffset = Math.floor(Math.random() * 51) + 50;
    setTimeOffset(randomTimeOffset);

    if (dataSourceType === 'real') {
        const selectedFund = FUNDS_LIBRARY.find(f => f.id === selectedFundId);
        setGameStatus('loading_data');
        try {
            const response = await fetch(selectedFund.file);
            if (!response.ok) throw new Error("找不到數據檔案");
            const rawData = await response.json();
            if (rawData && rawData.length > 5) {
                 data = processRealData(rawData);
                 fundName = selectedFund.name;
                 const minStart = 60;
                 const maxStart = Math.max(minStart, data.length - 250);
                 startDay = Math.floor(Math.random() * (maxStart - minStart + 1)) + minStart;
            } else {
                 throw new Error("數據過少");
            }
        } catch (error) {
             alert(`讀取基金數據失敗：${error.message}\n將切換為隨機模式。`);
             data = generateRandomData(30);
             startDay = 260;
             fundName = "隨機模擬基金";
        }
    } else {
        data = generateRandomData(30);
        startDay = 260;
        fundName = "隨機模擬基金";
    }
    setRankUploadStatus('idle');
    setFullData(data); setCash(initialCapital); setCurrentDay(startDay); 
    
    setRealStartDay(startDay);
    if (data && data[startDay]) {
        setBenchmarkStartNav(data[startDay].nav);
        const sd = new Date(data[startDay].date);
        setLastRspMonth(sd.getFullYear() * 12 + sd.getMonth() - 1);
    }

    setCurrentFundName(fundName); 
    setGameStatus('playing');
  };

  const executeReset = () => { setConfirmModal({ show: false, type: null }); setShowShareMenu(false); clearInterval(autoPlayRef.current); setIsAutoPlaying(false); setTradeMode(null); setShowRiver(false); setUnits(0); setAvgCost(0); setTransactions([]); setHighestNavSinceBuy(0); setBenchmarkStartNav(null); setRealStartDay(0); setTimeOffset(0); setGameStatus('setup'); };
  const executeEndGame = () => { setConfirmModal({ show: false, type: null }); setGameStatus('ended'); };
  const executeExit = () => { setConfirmModal({ show: false, type: null }); setGameStatus('shutdown'); };

  const handleConfirmClick = () => {
      if (confirmModal.type === 'exit') {
          executeExit();
      } else if (confirmModal.type === 'reset') {
          executeReset();
      } else {
          executeEndGame();
      }
  };

  const triggerReset = () => { if (isAutoPlaying) { clearInterval(autoPlayRef.current); setIsAutoPlaying(false); } setConfirmModal({ show: true, type: 'reset' }); };
  const triggerEndGame = () => { if (isAutoPlaying) { clearInterval(autoPlayRef.current); setIsAutoPlaying(false); } setConfirmModal({ show: true, type: 'end' }); };
  const triggerExit = () => { if (isAutoPlaying) { clearInterval(autoPlayRef.current); setIsAutoPlaying(false); } setConfirmModal({ show: true, type: 'exit' }); };
  
  const advanceDay = () => { if (currentDay >= fullData.length - 1) { setGameStatus('ended'); return; } setCurrentDay(prev => prev + 1); };
  const openTrade = (mode) => { if (isAutoPlaying) toggleAutoPlay(); setTradeMode(mode); setInputAmount(''); };
  const closeTrade = () => { setTradeMode(null); setInputAmount(''); };
  const executeBuy = () => { const amount = parseFloat(inputAmount); if (!amount || amount <= 0 || amount > cash) return; const buyUnits = amount / currentNav; const newTotalUnits = units + buyUnits; const newAvgCost = (units * avgCost + amount) / newTotalUnits; setAvgCost(newAvgCost); setUnits(newTotalUnits); setCash(prev => prev - amount); setTransactions(prev => [{ id: Date.now(), day: currentDay, type: 'BUY', price: currentNav, units: buyUnits, amount: amount, balance: cash - amount }, ...prev]); if (units === 0) setHighestNavSinceBuy(currentNav); closeTrade(); advanceDay(); };
  const executeSell = () => { let unitsToSell = parseFloat(inputAmount); if (!unitsToSell || unitsToSell <= 0) return; if (unitsToSell > units) { if (unitsToSell - units < 0.1) unitsToSell = units; else return; } const sellAmount = unitsToSell * currentNav; const costOfSoldUnits = unitsToSell * avgCost; const pnl = sellAmount - costOfSoldUnits; setCash(prev => prev + sellAmount); setUnits(prev => { const remaining = prev - unitsToSell; return remaining < 0.0001 ? 0 : remaining; }); setTransactions(prev => [{ id: Date.now(), day: currentDay, type: 'SELL', price: currentNav, units: unitsToSell, amount: sellAmount, balance: cash + sellAmount, pnl }, ...prev]); if (Math.abs(units - unitsToSell) < 0.0001) { setHighestNavSinceBuy(0); setWarningActive(false); setAvgCost(0); setUnits(0); } closeTrade(); advanceDay(); };
  const toggleAutoPlay = () => { if (isAutoPlaying) { clearInterval(autoPlayRef.current); setIsAutoPlaying(false); } else { setTradeMode(null); setIsAutoPlaying(true); autoPlayRef.current = setInterval(() => { setCurrentDay(prev => prev + 1); }, 100); } };
  
  const fmt = (val, dec, useFormula = false) => {
    if (val === null || val === undefined || isNaN(val)) return '-';
    const s = val.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    return `"${s}"`;
  };

  const getDurationString = () => {
      let durationStr = "0年 0個月";
      if (transactions.length > 0) {
          const firstTx = transactions[transactions.length - 1]; 
          const startData = fullData[firstTx.day];
          const endData = fullData[currentDay];
          if (startData && endData) {
              const s = new Date(startData.date);
              const e = new Date(endData.date);
              let months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
              const years = Math.floor(months / 12);
              const remainingMonths = months % 12;
              durationStr = `${years}年 ${remainingMonths}個月`;
          }
      }
      return durationStr;
  };

  const getSafeDate = (dayIndex) => {
      if (dataSourceType === 'random') return `D${dayIndex}`;
      if (fullData && fullData[dayIndex]) return fullData[dayIndex].date;
      return 'N/A';
  };

  const getCSVContent = () => {
    let durationStr = getDurationString();
    let csvContent = `基金名稱,${currentFundName}\n`;
    csvContent += `總報酬率,${roi > 0 ? '+' : ''}${roi.toFixed(2)}%\n`;
    csvContent += `總交易時間,${durationStr}\n`;
    csvContent += `最終資產,${fmt(totalAssets, 0, true)}\n`; 
    csvContent += `\n交易日期,天數,類型,單價,單位數,交易金額,帳戶餘額,損益(賣出才有)\n`;
    transactions.forEach(t => {
        const dateStr = getDisplayDate(getSafeDate(t.day));
        const typeStr = t.type === 'BUY' ? '買入' : (t.type === 'RSP' ? '定額' : '賣出');
        const row = `${dateStr},${fmt(t.day, 2, true)},${typeStr},${fmt(t.price, 2, true)},${fmt(t.units, 2, true)},${fmt(t.amount, 0, true)},${fmt(t.balance, 0, true)},${t.type === 'SELL' ? fmt(t.pnl, 0, true) : '-'}`;
        csvContent += row + "\n";
    });
    return csvContent;
  };

  const handleInitiateUpload = async () => {
    if (rankUploadStatus === 'uploaded') {
        fetchAndShowLeaderboard();
        return;
    }
    if (!myNickname) {
        setRankUploadStatus('asking_nick');
        setShowRankModal(true);
    } else {
        await executeUpload(myNickname);
    }
  };

  const handleRegisterAndUpload = async () => {
      if (!inputNickname || inputNickname.trim().length < 2) {
          alert("請輸入至少兩個字的暱稱");
          return;
      }
      setRankUploadStatus('uploading');
      try {
          await registerNickname(user.uid, inputNickname);
          setMyNickname(inputNickname);
          await executeUpload(inputNickname);
      } catch (err) {
          alert("設定失敗，請稍後再試");
          setRankUploadStatus('asking_nick');
      }
  };

  const executeUpload = async (nickname) => {
      setRankUploadStatus('uploading');
      setShowRankModal(true);
      
      try {
        let durationMonths = 0;
        if (transactions.length > 0) {
            const firstTx = transactions[transactions.length - 1];
            const startData = fullData[firstTx.day];
            const endData = fullData[currentDay];
            if (startData && endData) {
                const s = new Date(startData.date);
                const e = new Date(endData.date);
                durationMonths = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
            }
        }

        const gameResult = {
            uid: user.uid,
            displayName: nickname,
            fundId: dataSourceType === 'real' ? selectedFundId : 'random',
            fundName: currentFundName,
            roi: parseFloat(roi.toFixed(2)),
            finalAssets: Math.round(totalAssets),
            durationMonths: durationMonths,
            version: '2025v1.3'
        };

        await saveGameResult(gameResult);
        setRankUploadStatus('uploaded');
        fetchAndShowLeaderboard();

      } catch (err) {
          console.error(err);
          setRankUploadStatus('error');
      }
  };

  const fetchAndShowLeaderboard = async () => {
      const targetFundId = dataSourceType === 'real' ? selectedFundId : 'random';
      const data = await getLeader