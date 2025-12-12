// 2025v13.0 - 玩家端 (吹哨強制結算版)
// ★ 新增功能：
// 1. [Max Players Check] 加入時檢查是否額滿。
// 2. [Whistleblower Listener] 當狀態變為 calculating 時，強制使用伺服器 finalNav 重算並上傳成績。
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { LineChart, Line, YAxis, XAxis, ResponsiveContainer, ComposedChart, CartesianGrid, ReferenceDot } from 'recharts';
import { 
  TrendingUp, TrendingDown, Trophy, Loader2, Zap, Database, Smartphone, 
  AlertTriangle, RefreshCw, Hand, X, Calendar, Crown, Share2, Timer, 
  LogOut, Lock, RotateCcw, Sparkles, Calculator 
} from 'lucide-react';

import { db } from '../config/firebase'; 
import { doc, setDoc, deleteDoc, onSnapshot, updateDoc, serverTimestamp, collection, query, orderBy, limit, getDoc } from 'firebase/firestore';
import { FUNDS_LIBRARY } from '../config/funds';

import html2canvas from 'html2canvas';
import ResultCard from '../components/ResultCard'; 

import AIAnalysisModal from '../components/AIAnalysisModal';
import { useAIAnalyst } from '../hooks/useAIAnalyst';

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
  return { ma: parseFloat(ma.toFixed(2)) };
};

const renderTriangle = (props) => {
    const { cx, cy, fill } = props;
    return (
        <polygon 
            points={`${cx},${cy-6} ${cx-6},${cy+6} ${cx+6},${cy+6}`} 
            fill={fill} 
            stroke="white" 
            strokeWidth={2}
        />
    );
};

const renderCrossTriangle = (props) => {
    const { cx, cy, direction, type } = props;
    
    const isSolid = type === 'solid';
    const strokeColor = direction === 'gold' ? "#ef4444" : "#16a34a"; 
    const fillColor = isSolid ? strokeColor : "#ffffff"; 
    
    if (direction === 'gold') {
        return (
            <polygon 
                points={`${cx},${cy - 4} ${cx - 6},${cy + 8} ${cx + 6},${cy + 8}`} 
                fill={fillColor} 
                stroke={strokeColor}
                strokeWidth={2}
            />
        );
    } else {
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

export default function AppBattle() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const urlRoomId = searchParams.get('room');

  const { analyzeGame, isAnalyzing, showModal, closeModal, analysisResult, error: aiError } = useAIAnalyst();

  const resultCardRef = useRef(null);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownloadReport = async (currentFundName) => {
      if (isGenerating) return;
      if (!resultCardRef.current) { alert("系統錯誤：找不到戰報元件"); return; }
      setIsGenerating(true);
      try {
          await new Promise(r => setTimeout(r, 100));
          const canvas = await html2canvas(resultCardRef.current, { backgroundColor: null, scale: 3, useCORS: true, logging: false, ignoreElements: (el) => el.tagName === 'IMG' && !el.complete });
          canvas.toBlob((blob) => {
              if (!blob) { alert("生成圖片失敗"); setIsGenerating(false); return; }
              const url = URL.createObjectURL(blob);
              setGeneratedImage(url);
              setShowImageModal(true);
              setIsGenerating(false);
          }, 'image/png');
      } catch (err) { console.error(err); alert(`發生錯誤：${err?.message || '未知錯誤'}`); setIsGenerating(false); }
  };

  const getSavedState = (key, defaultValue, type = 'number') => {
      const savedRoom = localStorage.getItem('battle_roomId');
      if (!urlRoomId || savedRoom === urlRoomId) {
          const savedValue = localStorage.getItem(key);
          if (savedValue !== null && savedValue !== undefined) {
              return type === 'number' ? parseFloat(savedValue) : savedValue;
          }
      }
      return defaultValue;
  };

  const [roomId, setRoomId] = useState(urlRoomId || '');
  const [inputRoomId, setInputRoomId] = useState('');
  
  const [status, setStatus] = useState(() => {
      const savedRoom = localStorage.getItem('battle_roomId');
      const savedNick = localStorage.getItem('battle_nickname');
      if (urlRoomId && savedRoom === urlRoomId && savedNick) return 'waiting';
      return urlRoomId ? 'login' : 'input_room';
  });

  const [nickname, setNickname] = useState(() => getSavedState('battle_nickname', '', 'string'));
  const [phoneNumber, setPhoneNumber] = useState(() => getSavedState('battle_phone', '', 'string'));
  
  const [userId, setUserId] = useState(() => {
      const savedUid = getSavedState('battle_userId', '', 'string');
      return savedUid || 'user_' + Math.floor(Math.random() * 100000);
  });

  const [fullData, setFullData] = useState([]);
  const [currentDay, setCurrentDay] = useState(400);
  const [startDay, setStartDay] = useState(0); 
  const [timeOffset, setTimeOffset] = useState(0);
  const [fundName, setFundName] = useState('');
  const [showIndicators, setShowIndicators] = useState({ ma20: false, ma60: false, river: false });
  
  const [cash, setCash] = useState(() => getSavedState('battle_cash', 1000000));
  const [units, setUnits] = useState(() => getSavedState('battle_units', 0));
  const [avgCost, setAvgCost] = useState(() => getSavedState('battle_avgCost', 0));
  const [initialCapital] = useState(1000000);
  const [resetCount, setResetCount] = useState(() => getSavedState('battle_resetCount', 0));
  
  const [transactions, setTransactions] = useState([]); 

  const [inputAmount, setInputAmount] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [isTrading, setIsTrading] = useState(false);
  
  const [feeRate, setFeeRate] = useState(0.01);
  const [champion, setChampion] = useState(null);
  const [tradeType, setTradeType] = useState(null);

  const [gameEndTime, setGameEndTime] = useState(null);
  const [remainingTime, setRemainingTime] = useState(0);
  const [isTimeUp, setIsTimeUp] = useState(false);

  const [activeRequests, setActiveRequests] = useState([]); 
  const [pauseCountdown, setPauseCountdown] = useState(15); 

  const [serverTimeOffset, setServerTimeOffset] = useState(0);

  const lastReportTime = useRef(0);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    const syncTime = async () => {
        try {
            const response = await fetch(window.location.origin, { method: 'HEAD' });
            const serverDateStr = response.headers.get('date');
            if (serverDateStr) {
                const serverTime = new Date(serverDateStr).getTime();
                const localTime = Date.now();
                const offset = serverTime - localTime;
                console.log(`[Player] 時間校正完成，偏差值: ${offset}ms`);
                setServerTimeOffset(offset);
            }
        } catch (err) {
            console.log("時間校正失敗，將使用本機時間", err);
        }
    };
    syncTime();
  }, []);

  useEffect(() => {
      if (roomId) localStorage.setItem('battle_roomId', roomId);
      if (userId) localStorage.setItem('battle_userId', userId);
      if (nickname) localStorage.setItem('battle_nickname', nickname);
      if (phoneNumber) localStorage.setItem('battle_phone', phoneNumber);
      localStorage.setItem('battle_cash', cash);
      localStorage.setItem('battle_units', units);
      localStorage.setItem('battle_avgCost', avgCost);
      localStorage.setItem('battle_resetCount', resetCount);
  }, [cash, units, avgCost, roomId, userId, nickname, phoneNumber, resetCount]);

  useEffect(() => {
      if (!roomId) return;
      const unsubscribe = onSnapshot(collection(db, "battle_rooms", roomId, "requests"), (snapshot) => {
          const reqs = [];
          snapshot.forEach(doc => reqs.push(doc.data()));
          setActiveRequests(reqs);
          
          if (reqs.length > 0) {
              const validReqs = reqs.filter(r => r.timestamp);
              if (validReqs.length > 0) {
                  const sortedReqs = validReqs.sort((a, b) => (a.timestamp.seconds || 0) - (b.timestamp.seconds || 0));
                  const firstReq = sortedReqs[0];
                  
                  const nowSeconds = (Date.now() + serverTimeOffset) / 1000;
                  const reqSeconds = firstReq.timestamp.seconds;
                  const elapsed = nowSeconds - reqSeconds;
                  const remaining = Math.max(0, 15 - Math.floor(elapsed));
                  setPauseCountdown(remaining);
              }
          }
      });
      return () => unsubscribe();
  }, [roomId, serverTimeOffset]); 

  useEffect(() => {
      let timer;
      if (activeRequests.length > 0 && pauseCountdown > 0) {
          timer = setInterval(() => {
              setPauseCountdown(prev => Math.max(0, prev - 1));
          }, 1000);
      }
      return () => clearInterval(timer);
  }, [activeRequests, pauseCountdown]); 

  useEffect(() => {
    if (!roomId || status === 'input_room') return;
    const unsubscribe = onSnapshot(doc(db, "battle_rooms", roomId), async (docSnap) => {
      if (!docSnap.exists()) { 
          alert("找不到此房間"); 
          localStorage.clear();
          setStatus('input_room'); 
          setRoomId(''); 
          return; 
      }
      const roomData = docSnap.data();
      
      // ★ 核心狀態監聽邏輯
      if (roomData.status === 'ended') {
          setStatus('ended');
      } else if (roomData.status === 'calculating') {
          // ★ 強制結算訊號：當收到 calculating 時，立刻執行
          // 1. 讀取主持人寫入的 finalNav (官方淨值)
          if (roomData.finalNav && roomData.finalNav > 0) {
              const officialNav = roomData.finalNav;
              
              // 2. 重新計算最終資產 (不論本地跑多少天，都以這個淨值為準)
              const finalAssets = cash + (units * officialNav);
              const finalRoi = ((finalAssets - initialCapital) / initialCapital) * 100;
              const adjustedRoi = finalRoi - (resetCount * 50);

              // 3. 強制上傳這個「官方認證」的成績
              updateDoc(doc(db, "battle_rooms", roomId, "players", userId), {
                  roi: adjustedRoi, 
                  assets: finalAssets, 
                  lastUpdate: serverTimestamp()
              }).then(() => {
                  console.log("✅ 強制結算數據已上傳:", adjustedRoi);
              });
          }
          setStatus('playing'); // 畫面暫時維持 playing 等待跳轉
      } else if (roomData.status === 'playing') {
          if (status !== 'login' && status !== 'input_room') {
              setStatus('playing');
          }
      } else if (roomData.status === 'waiting') {
          if (status !== 'login' && status !== 'input_room') {
              setStatus('waiting');
          }
      }

      if (roomData.currentDay !== undefined) setCurrentDay(roomData.currentDay);
      if (roomData.startDay) setStartDay(roomData.startDay);
      if (roomData.indicators) setShowIndicators(roomData.indicators);
      if (roomData.timeOffset) setTimeOffset(roomData.timeOffset);
      if (roomData.feeRate !== undefined) setFeeRate(roomData.feeRate);
      
      if (roomData.gameEndTime) {
          setGameEndTime(roomData.gameEndTime);
      } else {
          setGameEndTime(null);
          setIsTimeUp(false);
      }

      if (fullData.length === 0 && roomData.fundId) {
         const targetFund = FUNDS_LIBRARY.find(f => f.id === roomData.fundId);
         if (targetFund) {
             setFundName(targetFund.name);
             const res = await fetch(targetFund.file);
             setFullData(processRealData(await res.json()));
         }
      }

      if (roomData.finalWinner) setChampion(roomData.finalWinner);
    });
    return () => unsubscribe();
  }, [roomId, status, fullData.length, cash, units, resetCount]); // 加入 cash, units 依賴確保結算正確

  useEffect(() => {
      let interval = null;
      if (status === 'playing' && gameEndTime) {
          interval = setInterval(() => {
              const now = Date.now() + serverTimeOffset;
              const diff = gameEndTime - now;
              
              if (diff <= 0) {
                  setRemainingTime(0);
                  setIsTimeUp(true);
                  if (isTrading) setIsTrading(false);
                  clearInterval(interval);
              } else {
                  setRemainingTime(diff);
                  setIsTimeUp(false);
              }
          }, 1000);
      } else {
          setRemainingTime(0);
      }
      return () => { if(interval) clearInterval(interval); };
  }, [status, gameEndTime, isTrading, serverTimeOffset]); 

  const formatTime = (ms) => {
      if (ms <= 0) return "00:00";
      const totalSeconds = Math.floor(ms / 1000);
      const m = Math.floor(totalSeconds / 60);
      const s = totalSeconds % 60;
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentNav = fullData[currentDay]?.nav || 10;
  const totalAssets = cash + (units * currentNav);
  const rawRoi = ((totalAssets - initialCapital) / initialCapital) * 100;
  const displayRoi = rawRoi - (resetCount * 50); 

  const trendSignal = useMemo(() => {
      if (!fullData[currentDay]) return { char: '', color: '' };
      const idx = currentDay;
      const curNav = fullData[idx].nav;
      const ind20 = calculateIndicators(fullData, 20, idx);
      const ind60 = calculateIndicators(fullData, 60, idx);
      const ma20 = ind20.ma; const ma60 = ind60.ma;
      if (!ma20 || !ma60) return { char: '', color: '' };
      if (curNav > ma20 && ma20 > ma60) return { char: '多', color: 'text-red-500' };
      else if (curNav < ma20 && ma20 < ma60) return { char: '空', color: 'text-green-600' };
      return { char: '', color: '' };
  }, [fullData, currentDay]);

  useEffect(() => {
      if ((status === 'playing' || status === 'waiting') && userId) {
          const now = Date.now();
          if (now - lastReportTime.current > 1500) {
              updateDoc(doc(db, "battle_rooms", roomId, "players", userId), {
                  roi: displayRoi, assets: totalAssets, units: units, lastUpdate: serverTimestamp()
              }).catch(e => console.log(e));
              lastReportTime.current = now;
          }
      }
  }, [currentDay]); 

  useEffect(() => {
      if ((status === 'playing' || status === 'waiting') && userId) {
          updateDoc(doc(db, "battle_rooms", roomId, "players", userId), {
              roi: displayRoi, assets: totalAssets, units: units, lastUpdate: serverTimestamp()
          }).catch(e => console.log(e));
          lastReportTime.current = Date.now(); 
      }
  }, [cash, units, resetCount]); 

  const handleConfirmRoom = () => {
      if (!inputRoomId.trim()) return;
      setRoomId(inputRoomId); setStatus('login'); setSearchParams({ room: inputRoomId });
  };

  const handleJoinGame = async () => {
      if (!nickname.trim()) { alert("請輸入暱稱"); return; }
      if (!phoneNumber.trim()) { alert("請輸入手機號碼"); return; }
      
      setIsJoining(true);
      try {
        // ★ v13.0 新增：檢查人數上限
        const roomRef = doc(db, "battle_rooms", roomId);
        const roomSnap = await getDoc(roomRef);
        
        if (roomSnap.exists()) {
            const max = roomSnap.data().maxPlayers || 50;
            const playersSnap = await getDocs(collection(db, "battle_rooms", roomId, "players"));
            
            if (playersSnap.size >= max) {
                alert(`房間已滿！上限 ${max} 人`);
                setIsJoining(false);
                return;
            }
        }

        await setDoc(doc(db, "battle_rooms", roomId, "players", userId), {
            nickname, phone: phoneNumber, roi: 0, assets: initialCapital, units: 0, isOut: false, joinedAt: serverTimestamp()
        });
        setStatus('waiting');
      } catch (err) { alert("加入失敗: " + err.message); } finally { setIsJoining(false); }
  };

  const handleBankruptcyReset = () => {
      if (window.confirm("確定申請紓困？\n\n您的資產將重置為 $1,000,000\n但總成績將扣除 50%！")) {
          setCash(1000000); setUnits(0); setAvgCost(0); setResetCount(prev => prev + 1); setTransactions([]); 
      }
  };
  
  const handleAIAnalysis = () => {
      const currentHistory = fullData;

      if (!currentHistory || currentHistory.length === 0) {
          alert("尚未載入歷史數據，AI 無法分析技術指標。");
          return;
      }

      analyzeGame({
          fundName: fundName,
          roi: displayRoi,
          transactions: transactions,
          historyData: currentHistory, 
          nickname: nickname || '玩家'
      });
  };

  const handleRequestTrade = async () => {
      if (isTimeUp) { alert("比賽時間已到，停止交易！"); return; } 
      setIsTrading(true); setTradeType(null); 
      try { await setDoc(doc(db, "battle_rooms", roomId, "requests", userId), { nickname: nickname, timestamp: serverTimestamp() }); } catch (e) { console.error(e); }
  };

  const handleCancelTrade = async () => {
      setIsTrading(false); setTradeType(null); setInputAmount(''); 
      try { await deleteDoc(doc(db, "battle_rooms", roomId, "requests", userId)); } catch (e) { console.error(e); }
  };

  const handleInputChange = (e) => {
      const rawValue = e.target.value.replace(/,/g, ''); 
      if (!rawValue) { setInputAmount(''); setTradeType(null); return; }
      if (!isNaN(rawValue)) { setInputAmount(Number(rawValue).toLocaleString()); setTradeType(null); }
  };

  const handleQuickAmount = (type, percent) => {
      setTradeType(type); 
      if (type === 'buy') { const amount = Math.floor(cash * percent); setInputAmount(amount.toLocaleString()); } 
      else if (type === 'sell') { const assetValue = units * currentNav; const amount = Math.floor(assetValue * percent); setInputAmount(amount.toLocaleString()); }
  };

  const executeTrade = async (type) => {
      if (isProcessingRef.current) return;
      if (isTimeUp) { alert("比賽時間已到！"); return; }
      
      isProcessingRef.current = true; 
      const amount = parseFloat(inputAmount.replace(/,/g, ''));
      if (!amount || amount <= 0) { isProcessingRef.current = false; return; }

      let transactionRecord = null; 

      if (type === 'buy') {
          if (amount > Math.floor(cash)) { alert(`現金不足 (可用: $${Math.floor(cash).toLocaleString()})`); isProcessingRef.current = false; return; }
          const fee = Math.floor(amount * feeRate); const netInvestment = amount - fee; const buyUnits = netInvestment / currentNav;
          const newUnits = units + buyUnits; 
          setAvgCost((units * avgCost + amount) / newUnits); 
          setUnits(newUnits);
          
          let newCash = 0;
          setCash(prev => { 
              const remains = prev - amount; 
              newCash = Math.abs(remains) < 1 ? 0 : remains;
              return newCash;
          });

          transactionRecord = {
              day: currentDay,
              type: 'BUY',
              price: currentNav,
              units: buyUnits,
              amount: amount,
              balance: newCash
          };

      } else {
          const currentAssetValue = units * currentNav;
          let newCash = 0;
          let sellUnits = 0;
          let pnl = 0;

          if (amount >= Math.floor(currentAssetValue)) { 
              if (units <= 0) { isProcessingRef.current = false; return; } 
              sellUnits = units;
              const sellAmount = sellUnits * currentNav;
              pnl = sellAmount - (sellUnits * avgCost);
              
              setCash(prev => { newCash = prev + currentAssetValue; return newCash; }); 
              setUnits(0); 
              setAvgCost(0); 
          } else { 
              sellUnits = amount / currentNav; 
              if (sellUnits > units * 1.0001) { alert('單位不足'); isProcessingRef.current = false; return; } 
              
              const sellAmount = amount;
              pnl = sellAmount - (sellUnits * avgCost);
              
              setUnits(prev => Math.max(0, prev - sellUnits)); 
              setCash(prev => { newCash = prev + amount; return newCash; }); 
          }

          transactionRecord = {
              day: currentDay,
              type: 'SELL',
              price: currentNav,
              units: sellUnits,
              amount: amount,
              balance: newCash,
              pnl: pnl
          };
      }
      
      if (transactionRecord) {
          setTransactions(prev => [...prev, transactionRecord]);
      }

      setInputAmount(''); if (navigator.vibrate) navigator.vibrate(50);
      setIsTrading(false); setTradeType(null);
      try { await deleteDoc(doc(db, "battle_rooms", roomId, "requests", userId)); } catch (e) { console.error(e); }
      setTimeout(() => { isProcessingRef.current = false; }, 500); 
  };

  const getDisplayDate = (dateStr) => {
      if (!dateStr) return '---';
      const dateObj = new Date(dateStr);
      if (isNaN(dateObj.getTime())) return dateStr;
      const newYear = dateObj.getFullYear() + timeOffset;
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      return `${newYear}-${month}-${day}`;
  };

  const getRealDate = (dateStr) => {
      if (!dateStr) return '---';
      const dateObj = new Date(dateStr);
      if (isNaN(dateObj.getTime())) return dateStr;
      const year = dateObj.getFullYear(); const month = String(dateObj.getMonth() + 1).padStart(2, '0'); const day = String(dateObj.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
  };

  const chartData = useMemo(() => {
      if (!fullData || fullData.length === 0) return [];

      const start = Math.max(0, currentDay - 330); 
      const end = currentDay + 1;
      
      return fullData.slice(start, end).map((d, idx) => {
          const realIdx = start + idx;
          const ind20 = calculateIndicators(fullData, 20, realIdx);
          const ind60 = calculateIndicators(fullData, 60, realIdx);
          const ma20 = ind20.ma; const ma60 = ind60.ma;

          const prevRealIdx = realIdx > 0 ? realIdx - 1 : 0;
          const prevInd20 = calculateIndicators(fullData, 20, prevRealIdx);
          const prevInd60 = calculateIndicators(fullData, 60, prevRealIdx);

          const prev10Idx = realIdx > 10 ? realIdx - 10 : 0;
          const ind60_prev10 = calculateIndicators(fullData, 60, prev10Idx);

          const deduction20 = (fullData && realIdx >= 20) ? fullData[realIdx - 20] : null;
          const deduction60 = (fullData && realIdx >= 60) ? fullData[realIdx - 60] : null;
          
          let riverTop = null; 
          let riverBottom = null;
          if (ma60) { riverTop = ma60 * 1.1; riverBottom = ma60 * 0.9; }

          let crossSignal = null;
          
          if (ma20 && ma60 && prevInd20.ma && prevInd60.ma && ind60_prev10.ma && realIdx > 10) {
              const isGoldCross = prevInd20.ma <= prevInd60.ma && ma20 > ma60;
              const isDeathCross = prevInd20.ma >= prevInd60.ma && ma20 < ma60;

              const slope20 = prevInd20.ma ? (ma20 - prevInd20.ma) / prevInd20.ma : 0;
              const slope60 = ind60_prev10.ma ? (ma60 - ind60_prev10.ma) / ind60_prev10.ma : 0;
              const currentPrice = d.nav;
              const bias60 = (currentPrice - ma60) / ma60;

              const TREND_THRESHOLD = 0.0015; 

              if (isGoldCross) {
                  if (slope60 > TREND_THRESHOLD) {
                      crossSignal = { type: 'gold', style: 'solid' };
                  }
                  else if (slope60 > 0 && bias60 > 0.02) {
                      crossSignal = { type: 'gold', style: 'solid' };
                  }
                  else if (slope20 > 0.005) {
                      crossSignal = { type: 'gold', style: 'solid' };
                  }
                  else {
                      crossSignal = { type: 'gold', style: 'hollow' };
                  }
              } else if (isDeathCross) {
                  if (slope60 < -TREND_THRESHOLD) {
                      crossSignal = { type: 'death', style: 'solid' };
                  }
                  else if (slope20 < -0.005) {
                      crossSignal = { type: 'death', style: 'solid' };
                  }
                  else {
                      crossSignal = { type: 'death', style: 'hollow' };
                  }
              }
          }

          return { 
              ...d, 
              ma20, ma60, riverTop, riverBottom, crossSignal, deduction20, deduction60
          };
      });
  }, [fullData, currentDay]);

  const currentDisplayDate = fullData[currentDay] ? getDisplayDate(fullData[currentDay].date) : "";
  const deduction20 = (fullData && currentDay >= 20) ? fullData[currentDay - 20] : null;
  const deduction60 = (fullData && currentDay >= 60) ? fullData[currentDay - 60] : null;

  const finalChampionRoi = useMemo(() => {
      if (!champion) return 0;
      return champion.roi || 0; 
  }, [champion]);

  if (status === 'input_room') return (
      <div className="h-[100dvh] bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-800">
          <Zap size={64} className="text-emerald-500 mb-6"/>
          <h1 className="text-3xl font-bold mb-2 text-slate-800">重新加入現場對戰輸入Room ID</h1>
          <input type="number" value={inputRoomId} onChange={e => setInputRoomId(e.target.value)} className="w-full bg-white border border-slate-300 rounded-xl p-4 text-center text-3xl font-mono text-slate-800 mb-6 tracking-widest outline-none focus:border-emerald-500 shadow-sm" placeholder="0000" />
          <button onClick={handleConfirmRoom} className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-lg transition-colors">下一步</button>
      </div>
  );

  if (status === 'login') return (
      <div className="h-[100dvh] bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-800">
          <div className="bg-white p-4 rounded-lg mb-8 text-center border border-slate-200 shadow-sm w-full">
              <div className="text-xs text-slate-400 mb-1">ROOM ID</div>
              <div className="text-2xl font-mono font-bold text-emerald-600">{roomId}</div>
          </div>
          <h1 className="text-2xl font-bold mb-6">建立玩家檔案</h1>
          <div className="w-full space-y-4 relative z-10">
              <input type="text" value={nickname} onChange={e => setNickname(e.target.value)} className="w-full bg-white border border-slate-300 rounded-xl p-4 text-center text-xl text-slate-800 outline-none focus:border-emerald-500 shadow-sm" placeholder="您的暱稱" />
              <div className="relative">
                  <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
                  <input type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} className="w-full bg-white border border-slate-300 rounded-xl p-4 pl-12 text-center text-xl text-slate-800 outline-none focus:border-emerald-500 shadow-sm" placeholder="手機號碼" />
              </div>
              <button onClick={handleJoinGame} disabled={isJoining} className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 disabled:opacity-70">{isJoining ? <Loader2 className="animate-spin" /> : '加入房間'}</button>
          </div>
      </div>
  );

  if (status === 'waiting') return (
      <div className="h-[100dvh] bg-slate-50 flex flex-col items-center justify-center text-slate-800 p-6">
          <Loader2 size={48} className="text-emerald-500 animate-spin mb-4"/>
          <h2 className="text-xl font-bold">等待主持人開始...</h2>
          <div className="mt-8 px-6 py-2 bg-white rounded-full border border-slate-200 shadow-sm flex flex-col items-center">
             <span className="text-xs text-slate-400 mb-1">已登入</span>
             <span className="text-emerald-600 font-bold text-lg">{nickname}</span>
          </div>
      </div>
  );

  if (status === 'playing') return (
      <div className="h-[100dvh] bg-slate-50 text-slate-800 flex flex-col font-sans relative overflow-hidden">
          {totalAssets < 100000 && (
              <div className="absolute inset-0 bg-slate-900/90 z-50 flex flex-col items-center justify-center p-8 text-center backdrop-blur-sm animate-in fade-in">
                  <AlertTriangle size={64} className="text-red-500 mb-4 animate-bounce"/>
                  <h2 className="text-3xl font-bold text-white mb-2">瀕臨破產！</h2>
                  <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 mb-8 w-full">
                      <div className="text-xs text-slate-500 mb-1">紓困代價</div>
                      <div className="text-red-400 font-bold text-lg">總成績扣除 50%</div>
                  </div>
                  <button onClick={handleBankruptcyReset} className="w-full py-4 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-xl shadow-lg flex items-center justify-center gap-2"><RefreshCw size={24}/> 申請紓困重整</button>
              </div>
          )}
          
          <div className="sticky top-0 z-20 shadow-sm">
              <div className="bg-slate-100 border-b border-slate-200 px-3 py-1 flex justify-between items-center text-lg font-black text-slate-700 h-12">
                 <div className="flex items-center gap-2 w-1/3">
                     <button onClick={() => { localStorage.clear(); setStatus('input_room'); setRoomId(''); }} className="p-1.5 bg-slate-200 rounded-full text-slate-500 hover:bg-red-100 hover:text-red-500 transition-colors">
                         <LogOut size={16} />
                     </button>
                     <div className={`flex items-center gap-1 font-mono font-bold text-sm ${remainingTime < 30000 ? 'text-red-600 animate-pulse' : 'text-slate-600'}`}>
                         <Timer size={14} />
                         {formatTime(remainingTime)}
                     </div>
                 </div>

                 <div className="w-1/3 text-center">
                     <span className="truncate max-w-full font-bold text-base">{fundName}</span>
                 </div>

                 <div className="w-1/3 text-right">
                     <span className="font-mono tracking-wider text-xs text-slate-500">{currentDisplayDate}</span>
                 </div>
              </div>
              
              <div className="bg-white px-2 py-1 grid grid-cols-4 gap-1 items-center border-b border-slate-200">
                  <div className="flex flex-col items-center border-r border-slate-100">
                     <div className="text-[10px] text-slate-400 font-bold mb-0.5">目前淨值</div>
                     <div className="text-lg font-mono font-black leading-none h-5 flex items-center text-slate-800">
                         {currentNav.toFixed(2)}
                     </div>
                  </div>

                  <div className="flex flex-col items-center border-r border-slate-100">
                     <div className="text-[10px] text-slate-400 font-bold mb-0.5">趨勢</div>
                     <div className={`text-lg font-black leading-none h-5 flex items-center ${trendSignal.color}`}>
                         {trendSignal.char}
                     </div>
                  </div>

                  <div className="flex flex-col items-center border-r border-slate-100">
                     <div className="text-[10px] text-slate-400 font-bold mb-0.5">報酬率</div>
                     <div className={`text-lg font-mono font-black leading-none flex items-center h-5 ${displayRoi >= 0 ? 'text-red-500' : 'text-green-600'}`}>
                         {displayRoi > 0 ? '+' : ''}{displayRoi.toFixed(1)}<span className="text-[9px] ml-0.5">%</span>
                     </div>
                  </div>

                  <div className="flex flex-col items-center">
                     <div className="text-[10px] text-slate-400 font-bold mb-0.5">總資產</div>
                     {/* ★ v12.7 修正：Math.floor -> Math.round 解決 1 元誤差 */}
                     <div className={`text-lg font-mono font-black leading-none flex items-center h-5 ${displayRoi >= 0 ? 'text-red-500' : 'text-green-600'}`}>
                         {Math.round(totalAssets).toLocaleString()}
                     </div>
                  </div>
              </div>
          </div>

          {activeRequests.length > 0 && !isTrading && (
              <div className="bg-yellow-400 text-slate-900 px-4 py-2 flex items-center justify-between shadow-md animate-in slide-in-from-top duration-300 relative z-30">
                  <div className="flex items-center gap-2 overflow-hidden">
                      <Loader2 size={18} className="animate-spin text-slate-800 shrink-0"/>
                      <div className="flex flex-col leading-none">
                          <span className="font-bold text-sm">市場暫停中 🔥</span>
                          <span className="text-[10px] opacity-80 truncate max-w-[180px]">
                              {activeRequests.map(r => r.nickname).join(', ')} 正在操作...
                          </span>
                      </div>
                  </div>
                  <div className="flex items-center gap-2 bg-black/10 px-2 py-1 rounded">
                       <span className="text-[10px] font-bold text-slate-800">倒數</span>
                       <span className="font-mono font-black text-lg text-slate-900 leading-none">
                          {pauseCountdown}s
                       </span>
                  </div>
              </div>
          )}

          <div className="flex-1 relative bg-white min-h-0">
             <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} opacity={0.8} />
		            <XAxis dataKey="date" hide />
                    {showIndicators.river && <Line type="monotone" dataKey="riverTop" stroke="#3b82f6" strokeWidth={1} dot={false} isAnimationActive={false} opacity={0.3} />}
                    {showIndicators.river && <Line type="monotone" dataKey="riverBottom" stroke="#3b82f6" strokeWidth={1} dot={false} isAnimationActive={false} opacity={0.3} />}
                    {showIndicators.ma20 && <Line type="monotone" dataKey="ma20" stroke="#38bdf8" strokeWidth={2} dot={false} isAnimationActive={false} opacity={0.8} />}
                    {showIndicators.ma60 && <Line type="monotone" dataKey="ma60" stroke="#1d4ed8" strokeWidth={2} dot={false} isAnimationActive={false} opacity={0.8} />}
			        
        	        {showIndicators.trend && showIndicators.ma20 && deduction20 && (
           		        <ReferenceDot x={deduction20.date} y={deduction20.nav} shape={renderTriangle} fill="#38bdf8" isAnimationActive={false} />
        	        )}
                    {showIndicators.trend && showIndicators.ma60 && deduction60 && (
                        <ReferenceDot x={deduction60.date} y={deduction60.nav} shape={renderTriangle} fill="#1d4ed8" isAnimationActive={false} />
                    )}                    

                    <Line type="monotone" dataKey="nav" stroke="#000000" strokeWidth={2.5} dot={false} isAnimationActive={false} shadow="0 0 10px rgba(0,0,0,0.1)" />
                    <YAxis 
                        domain={['auto', 'auto']} 
                        orientation="right" 
                        tick={{fill: '#64748b', fontSize: 11, fontWeight: 'bold'}} 
                        width={45} 
                        tickFormatter={(v) => Math.round(v)} 
                        interval="preserveStartEnd" 
                    />
                    
                    {showIndicators.trend && chartData.map((entry, index) => {
                        if (entry.crossSignal) {
                            return (
                                <ReferenceDot
                                    key={`cross-${index}`}
                                    x={entry.date}
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
          </div>
          
          <div className="bg-white shrink-0 z-20 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] border-t border-slate-200 pb-2 safe-area-pb">
              <div className="flex justify-between px-4 py-1.5 border-b border-slate-100 mb-1 text-[10px]">
                  <div className="flex gap-1 text-slate-500 font-bold">
                      <span>現金</span>
                      <span className="font-mono text-emerald-600">${Math.floor(cash).toLocaleString()}</span>
                  </div>
                  <div className="flex gap-1 text-slate-500 font-bold">
                      <span>單位</span>
                      <span className="font-mono text-slate-800">{Math.floor(units).toLocaleString()}</span>
                  </div>
              </div>

              {!isTrading ? (
                  <div className="px-4 pb-1">
                      <button 
                          onClick={handleRequestTrade} 
                          disabled={isTimeUp} 
                          className={`w-full py-4 transition-all text-white rounded-xl font-black text-2xl shadow-lg flex items-center justify-center gap-2 
                          ${isTimeUp 
                              ? 'bg-slate-400 cursor-not-allowed' 
                              : activeRequests.length > 0 
                                  ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 animate-pulse' 
                                  : 'bg-slate-800 hover:bg-slate-700 active:scale-95'
                          }`}
                      >
                          {isTimeUp ? <Lock size={24}/> : <Hand size={24} className="text-yellow-400"/>} 
                          
                          {isTimeUp 
                              ? '比賽結束' 
                              : activeRequests.length > 0 
                                  ? `加入交易戰局！(${pauseCountdown}s)` 
                                  : '請求交易'
                          }
                      </button>
                      <p className="text-center text-[10px] text-slate-400 mt-1">
                          {activeRequests.length > 0 
                              ? `${activeRequests.length} 位玩家正在交易中，市場暫停...` 
                              : (isTimeUp ? '交易通道已關閉，請等待主持人結算' : '按下後行情將暫停，供您思考決策')
                          }
                      </p>
                  </div>
              ) : (
                  <>
                      <div className="px-2 grid grid-cols-5 gap-1 mb-1">
                          <button 
                            onClick={() => handleQuickAmount('buy', 1.0)} 
                            disabled={tradeType === 'sell'} 
                            className={`col-span-1 rounded-md font-bold text-[10px] flex flex-col items-center justify-center py-2 shadow-sm leading-tight ${tradeType === 'sell' ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-rose-500 active:bg-rose-700 text-white active:scale-95'}`}
                          >
                             <span>買入</span><span className="opacity-80">All In</span>
                          </button>
                          
                          <input 
                             type="text" 
                             value={inputAmount} 
                             onChange={handleInputChange} 
                             placeholder="輸入金額" 
                             className="col-span-3 bg-slate-100 border border-slate-300 rounded-md px-1 py-1 text-lg font-bold text-slate-800 outline-none focus:border-slate-500 text-center placeholder:text-slate-300"
                          />
                          
                          <button 
                             onClick={() => handleQuickAmount('sell', 1.0)} 
                             disabled={tradeType === 'buy'} 
                             className={`col-span-1 rounded-md font-bold text-[10px] flex flex-col items-center justify-center py-2 shadow-sm leading-tight ${tradeType === 'buy' ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-emerald-500 active:bg-emerald-700 text-white active:scale-95'}`}
                          >
                             <span>賣出</span><span className="opacity-80">All In</span>
                          </button>
                      </div>
                      
                      <div className="px-2 grid grid-cols-4 gap-1 mb-1">
                          <button onClick={() => handleQuickAmount('buy', 0.2)} disabled={tradeType === 'sell'} className={`rounded-md font-bold text-[10px] py-2 ${tradeType === 'sell' ? 'bg-slate-100 text-slate-300' : 'bg-rose-100 text-rose-700 active:bg-rose-200'}`}>買入 20%</button>
                          <button onClick={() => handleQuickAmount('buy', 0.5)} disabled={tradeType === 'sell'} className={`rounded-md font-bold text-[10px] py-2 ${tradeType === 'sell' ? 'bg-slate-100 text-slate-300' : 'bg-rose-200 text-rose-800 active:bg-rose-300'}`}>買入 50%</button>
                          <button onClick={() => handleQuickAmount('sell', 0.2)} disabled={tradeType === 'buy'} className={`rounded-md font-bold text-[10px] py-2 ${tradeType === 'buy' ? 'bg-slate-100 text-slate-300' : 'bg-emerald-100 text-emerald-700 active:bg-emerald-200'}`}>賣出 20%</button>
                          <button onClick={() => handleQuickAmount('sell', 0.5)} disabled={tradeType === 'buy'} className={`rounded-md font-bold text-[10px] py-2 ${tradeType === 'buy' ? 'bg-slate-100 text-slate-300' : 'bg-emerald-200 text-emerald-800 active:bg-emerald-300'}`}>賣出 50%</button>
                      </div>

                        <div className="px-2 grid grid-cols-2 gap-2">
                            <button 
                                onClick={() => executeTrade('buy')} 
                                disabled={tradeType === 'sell'} 
                                className={`py-2 rounded-lg font-bold text-base shadow-md flex items-center justify-center gap-1 ${tradeType === 'sell' ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-rose-500 active:bg-rose-600 text-white active:scale-95'}`}
                            >
                                <TrendingUp size={16} />
                                <span>買入確認</span>
                                <span className="text-[10px] opacity-80 font-normal pt-0.5">(費{Math.round(feeRate*100)}%)</span>
                            </button>
                            
                            <button 
                                onClick={() => executeTrade('sell')} 
                                disabled={tradeType === 'buy'} 
                                className={`py-2 rounded-lg font-bold text-base shadow-md flex items-center justify-center gap-1 ${tradeType === 'buy' ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-emerald-500 active:bg-emerald-600 text-white active:scale-95'}`}
                            >
                                <TrendingDown size={16} />
                                <span>賣出確認</span>
                                <span className="text-[10px] opacity-80 font-normal pt-0.5">(免費)</span>
                            </button>
                        </div>
                      <div className="px-2 mt-1">
                          <button onClick={handleCancelTrade} className="w-full py-2 bg-slate-200 text-slate-500 rounded-lg font-bold text-xs flex items-center justify-center gap-1"><X size={14}/> 取消交易 (恢復行情)</button>
                      </div>
                  </>
              )}
          </div>
      </div>
  );
}
}