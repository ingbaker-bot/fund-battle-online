// 2025v9.3 - 玩家端 (1141201A終版)
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { LineChart, Line, YAxis, ResponsiveContainer, ComposedChart, CartesianGrid } from 'recharts';
import { TrendingUp, TrendingDown, Trophy, Loader2, Zap, Database, Smartphone, AlertTriangle, RefreshCw, Hand, X, Calendar, Crown } from 'lucide-react';

import { db } from '../config/firebase'; 
import { doc, setDoc, deleteDoc, onSnapshot, updateDoc, serverTimestamp, collection, query, orderBy, limit } from 'firebase/firestore';
import { FUNDS_LIBRARY } from '../config/funds';

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

export default function AppBattle() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const urlRoomId = searchParams.get('room');

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

  const [inputAmount, setInputAmount] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [isTrading, setIsTrading] = useState(false);
  
  const [feeRate, setFeeRate] = useState(0.01);
  const [champion, setChampion] = useState(null);

  // ★★★ 新增：交易方向鎖定 (buy / sell / null) ★★★
  const [tradeType, setTradeType] = useState(null);

  const lastReportTime = useRef(0);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    if (urlRoomId) { 
        setRoomId(urlRoomId);
        const savedRoom = localStorage.getItem('battle_roomId');
        if (savedRoom && savedRoom !== urlRoomId) {
            localStorage.clear();
            setCash(1000000); setUnits(0); setAvgCost(0); setNickname(''); setResetCount(0); setIsTrading(false);
            setStatus('login');
        }
    } else { 
        setStatus('input_room'); 
    }
  }, [urlRoomId]);

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
      
      if (roomData.status === 'ended') {
          setStatus('ended');
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
      
      if (roomData.feeRate !== undefined) {
          setFeeRate(roomData.feeRate);
      }

      if (fullData.length === 0 && roomData.fundId) {
         const targetFund = FUNDS_LIBRARY.find(f => f.id === roomData.fundId);
         if (targetFund) {
             setFundName(targetFund.name);
             const res = await fetch(targetFund.file);
             setFullData(processRealData(await res.json()));
         }
      }

      if (roomData.finalWinner) {
          setChampion(roomData.finalWinner);
      }
    });
    return () => unsubscribe();
  }, [roomId, status, fullData.length]);

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
      
      const ma20 = ind20.ma;
      const ma60 = ind60.ma;

      if (!ma20 || !ma60) return { char: '', color: '' };

      if (curNav > ma20 && ma20 > ma60) {
          return { char: '多', color: 'text-red-500' };
      }
      else if (curNav < ma20 && ma20 < ma60) {
          return { char: '空', color: 'text-green-600' };
      }
      
      return { char: '', color: '' };
  }, [fullData, currentDay]);

  useEffect(() => {
      if ((status === 'playing' || status === 'waiting') && userId) {
          const now = Date.now();
          if (now - lastReportTime.current > 1500) {
              updateDoc(doc(db, "battle_rooms", roomId, "players", userId), {
                  roi: displayRoi, 
                  assets: totalAssets, 
                  units: units, 
                  lastUpdate: serverTimestamp()
              }).catch(e => console.log(e));
              lastReportTime.current = now;
          }
      }
  }, [currentDay]); 

  useEffect(() => {
      if ((status === 'playing' || status === 'waiting') && userId) {
          updateDoc(doc(db, "battle_rooms", roomId, "players", userId), {
              roi: displayRoi, 
              assets: totalAssets, 
              units: units, 
              lastUpdate: serverTimestamp()
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
        await setDoc(doc(db, "battle_rooms", roomId, "players", userId), {
            nickname, phone: phoneNumber, roi: 0, assets: initialCapital, units: 0, isOut: false, joinedAt: serverTimestamp()
        });
        setStatus('waiting');
      } catch (err) { alert("加入失敗: " + err.message); } finally { setIsJoining(false); }
  };

  const handleBankruptcyReset = () => {
      if (window.confirm("確定申請紓困？\n\n您的資產將重置為 $1,000,000\n但總成績將扣除 50%！")) {
          setCash(1000000); setUnits(0); setAvgCost(0); setResetCount(prev => prev + 1);
      }
  };

  const handleRequestTrade = async () => {
      setIsTrading(true);
      setTradeType(null); // 重置交易方向
      try {
          await setDoc(doc(db, "battle_rooms", roomId, "requests", userId), {
              nickname: nickname,
              timestamp: serverTimestamp()
          });
      } catch (e) { console.error(e); }
  };

  const handleCancelTrade = async () => {
      setIsTrading(false);
      setTradeType(null); // 重置交易方向
      setInputAmount(''); // 清空輸入
      try {
          await deleteDoc(doc(db, "battle_rooms", roomId, "requests", userId));
      } catch (e) { console.error(e); }
  };

  // ★★★ 修改處：輸入格式化 (千分位) 與解除鎖定 ★★★
  const handleInputChange = (e) => {
      const rawValue = e.target.value.replace(/,/g, ''); // 移除逗號
      if (!rawValue) {
          setInputAmount('');
          setTradeType(null); // 清空時解除鎖定
          return;
      }
      if (!isNaN(rawValue)) {
          // 轉為千分位字串儲存
          setInputAmount(Number(rawValue).toLocaleString());
          setTradeType(null); // 手動輸入時解除鎖定，讓玩家自己選
      }
  };

  // ★★★ 修改處：快速鍵連動鎖定 ★★★
  const handleQuickAmount = (type, percent) => {
      setTradeType(type); // 鎖定方向

      if (type === 'buy') {
          const amount = Math.floor(cash * percent);
          setInputAmount(amount.toLocaleString()); // 顯示千分位
      } else if (type === 'sell') {
          const assetValue = units * currentNav;
          const amount = Math.floor(assetValue * percent);
          setInputAmount(amount.toLocaleString()); // 顯示千分位
      }
  };

  const executeTrade = async (type) => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true; 

      // ★★★ 修正：移除逗號再運算 ★★★
      const amount = parseFloat(inputAmount.replace(/,/g, ''));
      
      if (!amount || amount <= 0) {
          isProcessingRef.current = false; 
          return;
      }

      if (type === 'buy') {
          if (amount > Math.floor(cash)) { 
              alert(`現金不足 (可用: $${Math.floor(cash).toLocaleString()})`); 
              isProcessingRef.current = false; 
              return; 
          }
          
          const fee = Math.floor(amount * feeRate); 
          const netInvestment = amount - fee;       
          const buyUnits = netInvestment / currentNav;
          
          const newUnits = units + buyUnits;
          setAvgCost((units * avgCost + amount) / newUnits);
          
          setUnits(newUnits);
          setCash(prev => {
              const remains = prev - amount;
              return Math.abs(remains) < 1 ? 0 : remains; 
          });
      } else {
          const currentAssetValue = units * currentNav;
          if (amount >= Math.floor(currentAssetValue)) { 
              if (units <= 0) { 
                  isProcessingRef.current = false; 
                  return; 
              }
              setCash(prev => prev + currentAssetValue); 
              setUnits(0);
              setAvgCost(0);
          } else {
              const sellUnits = amount / currentNav;
              if (sellUnits > units * 1.0001) { 
                  alert('單位不足'); 
                  isProcessingRef.current = false; 
                  return; 
              }
              setUnits(prev => Math.max(0, prev - sellUnits));
              setCash(prev => prev + amount);
          }
      }
      
      setInputAmount(''); 
      if (navigator.vibrate) navigator.vibrate(50);
      
      // ★★★ 修正：交易成功後直接返回看盤 ★★★
      // 不用再呼叫 handleCancelTrade，因為那是給"取消"按鈕用的
      // 我們直接在裡面做狀態切換，效果更順暢
      setIsTrading(false);
      setTradeType(null);
      try {
          await deleteDoc(doc(db, "battle_rooms", roomId, "requests", userId));
      } catch (e) { console.error(e); }

      setTimeout(() => {
          isProcessingRef.current = false;
      }, 500); 
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
      const year = dateObj.getFullYear(); 
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
  };

  const chartData = useMemo(() => {
      const start = Math.max(0, currentDay - 330);
      const end = currentDay + 1;
      return fullData.slice(start, end).map((d, idx) => {
          const realIdx = start + idx;
          const ind20 = calculateIndicators(fullData, 20, realIdx);
          const ind60 = calculateIndicators(fullData, 60, realIdx);
          let riverTop = null; let riverBottom = null;
          if (ind60.ma) { riverTop = ind60.ma * 1.1; riverBottom = ind60.ma * 0.9; }
          return { ...d, ma20: ind20.ma, ma60: ind60.ma, riverTop, riverBottom };
      });
  }, [fullData, currentDay]);

  const currentDisplayDate = fullData[currentDay] ? getDisplayDate(fullData[currentDay].date) : "";

  // --- UI Render ---

  if (status === 'input_room') return (
      <div className="h-[100dvh] bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-800">
          <Zap size={64} className="text-emerald-500 mb-6"/>
          <h1 className="text-3xl font-bold mb-2 text-slate-800">加入現場對戰</h1>
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
          
          {/* ★★★ 雙層 Header (資訊大字體優化) ★★★ */}
          <div className="sticky top-0 z-20 shadow-sm">
              {/* 第一層：資訊條 (字體放大) */}
              <div className="bg-slate-100 border-b border-slate-200 px-4 py-2 flex justify-between items-center text-lg font-black text-slate-700">
                 <span className="truncate max-w-[200px]">{fundName}</span>
                 <span className="font-mono tracking-wider">{currentDisplayDate}</span>
              </div>
              
              {/* 第二層：戰鬥數據儀表板 */}
              <div className="bg-white px-2 py-1.5 grid grid-cols-3 gap-1 items-center border-b border-slate-200">
                 
                 {/* 左：趨勢燈號 */}
                 <div className="flex flex-col items-center border-r border-slate-100">
                    <div className="text-xs text-slate-400 font-bold mb-0.5">趨勢</div>
                    <div className={`text-xl font-black leading-none h-6 flex items-center ${trendSignal.color}`}>
                        {trendSignal.char}
                    </div>
                 </div>

                 {/* 中：報酬率 */}
                 <div className="flex flex-col items-center border-r border-slate-100">
                    <div className="text-xs text-slate-400 font-bold mb-0.5">報酬率</div>
                    <div className={`text-xl font-mono font-black leading-none flex items-center h-6 ${displayRoi >= 0 ? 'text-red-500' : 'text-green-600'}`}>
                        {displayRoi > 0 ? '+' : ''}{displayRoi.toFixed(1)}<span className="text-xs ml-0.5">%</span>
                    </div>
                 </div>

                 {/* 右：總資產 */}
                 <div className="flex flex-col items-center">
                    <div className="text-xs text-slate-400 font-bold mb-0.5">總資產</div>
                    <div className={`text-xl font-mono font-black leading-none flex items-center h-6 ${displayRoi >= 0 ? 'text-red-500' : 'text-green-600'}`}>
                        {Math.floor(totalAssets).toLocaleString()}
                    </div>
                 </div>
              </div>
          </div>

          <div className="flex-1 relative bg-white min-h-0">
             <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} opacity={0.8} />
                    {showIndicators.river && <Line type="monotone" dataKey="riverTop" stroke="#3b82f6" strokeWidth={1} dot={false} isAnimationActive={false} opacity={0.3} />}
                    {showIndicators.river && <Line type="monotone" dataKey="riverBottom" stroke="#3b82f6" strokeWidth={1} dot={false} isAnimationActive={false} opacity={0.3} />}
                    {showIndicators.ma20 && <Line type="monotone" dataKey="ma20" stroke="#38bdf8" strokeWidth={2} dot={false} isAnimationActive={false} opacity={0.8} />}
                    {showIndicators.ma60 && <Line type="monotone" dataKey="ma60" stroke="#1d4ed8" strokeWidth={2} dot={false} isAnimationActive={false} opacity={0.8} />}
                    <Line type="monotone" dataKey="nav" stroke="#000000" strokeWidth={2.5} dot={false} isAnimationActive={false} shadow="0 0 10px rgba(0,0,0,0.1)" />
                    <YAxis domain={['auto', 'auto']} hide />
                </ComposedChart>
             </ResponsiveContainer>
          </div>
          
          <div className="bg-white border-t border-slate-200 shrink-0 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] pb-3 pt-1 safe-area-pb">
              <div className="flex justify-between px-4 py-1 border-b border-slate-100 mb-1 text-xs">
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
                  <div className="px-4 pb-2">
                      <button onClick={handleRequestTrade} className="w-full py-6 bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all text-white rounded-xl font-black text-3xl shadow-lg flex items-center justify-center gap-3 animate-pulse"><Hand size={32} className="text-yellow-400"/> 請求交易</button>
                      <p className="text-center text-xs text-slate-400 mt-2">按下後行情將暫停，供您思考決策</p>
                  </div>
              ) : (
                  <>
                      <div className="px-2 grid grid-cols-5 gap-1 mb-1">
                          <button 
                            onClick={() => handleQuickAmount('buy', 1.0)} 
                            disabled={tradeType === 'sell'} // ★ 互斥鎖
                            className={`col-span-1 rounded-md font-bold text-xs flex flex-col items-center justify-center py-2 shadow-sm leading-tight ${tradeType === 'sell' ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-rose-500 active:bg-rose-700 text-white active:scale-95'}`}
                          >
                             <span>買入</span><span className="text-[10px] opacity-80">All In</span>
                          </button>
                          
                          {/* ★★★ 輸入框：支援千分位顯示 ★★★ */}
                          <input 
                             type="text" // 改為 text 以支援逗號 
                             value={inputAmount} 
                             onChange={handleInputChange} 
                             placeholder="輸入金額" 
                             className="col-span-3 bg-slate-100 border border-slate-300 rounded-md px-1 py-2 text-xl font-bold text-slate-800 outline-none focus:border-slate-500 text-center placeholder:text-slate-300"
                          />
                          
                          <button 
                             onClick={() => handleQuickAmount('sell', 1.0)} 
                             disabled={tradeType === 'buy'} // ★ 互斥鎖
                             className={`col-span-1 rounded-md font-bold text-xs flex flex-col items-center justify-center py-2 shadow-sm leading-tight ${tradeType === 'buy' ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-emerald-500 active:bg-emerald-700 text-white active:scale-95'}`}
                          >
                             <span>賣出</span><span className="text-[10px] opacity-80">All In</span>
                          </button>
                      </div>
                      
                      <div className="px-2 grid grid-cols-4 gap-1 mb-1">
                          <button onClick={() => handleQuickAmount('buy', 0.2)} disabled={tradeType === 'sell'} className={`rounded-md font-bold text-xs py-2 ${tradeType === 'sell' ? 'bg-slate-100 text-slate-300' : 'bg-rose-100 text-rose-700 active:bg-rose-200'}`}>買入 20%</button>
                          <button onClick={() => handleQuickAmount('buy', 0.5)} disabled={tradeType === 'sell'} className={`rounded-md font-bold text-xs py-2 ${tradeType === 'sell' ? 'bg-slate-100 text-slate-300' : 'bg-rose-200 text-rose-800 active:bg-rose-300'}`}>買入 50%</button>
                          <button onClick={() => handleQuickAmount('sell', 0.2)} disabled={tradeType === 'buy'} className={`rounded-md font-bold text-xs py-2 ${tradeType === 'buy' ? 'bg-slate-100 text-slate-300' : 'bg-emerald-100 text-emerald-700 active:bg-emerald-200'}`}>賣出 20%</button>
                          <button onClick={() => handleQuickAmount('sell', 0.5)} disabled={tradeType === 'buy'} className={`rounded-md font-bold text-xs py-2 ${tradeType === 'buy' ? 'bg-slate-100 text-slate-300' : 'bg-emerald-200 text-emerald-800 active:bg-emerald-300'}`}>賣出 50%</button>
                      </div>

<div className="px-2 grid grid-cols-2 gap-2">
    {/* 左邊：買入按鈕 (單行模式) */}
    <button 
        onClick={() => executeTrade('buy')} 
        disabled={tradeType === 'sell'} 
        /* 修改重點：移除 flex-col，保留 flex 讓內容左右排列，py-2 控制高度 */
        className={`py-2 rounded-lg font-bold text-lg shadow-md flex items-center justify-center gap-1 ${tradeType === 'sell' ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-rose-500 active:bg-rose-600 text-white active:scale-95'}`}
    >
        <TrendingUp size={18} />
        <span>買入確認</span>
        {/* 手續費縮小並緊跟在後 */}
        <span className="text-[10px] opacity-80 font-normal pt-1">(費{Math.round(feeRate*100)}%)</span>
    </button>
    
    {/* 右邊：賣出按鈕 (單行模式) */}
    <button 
        onClick={() => executeTrade('sell')} 
        disabled={tradeType === 'buy'} 
        className={`py-2 rounded-lg font-bold text-lg shadow-md flex items-center justify-center gap-1 ${tradeType === 'buy' ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-emerald-500 active:bg-emerald-600 text-white active:scale-95'}`}
    >
        <TrendingDown size={18} />
        <span>賣出確認</span>
        <span className="text-[10px] opacity-80 font-normal pt-1">(免手續費)</span>
    </button>


                      </div>
                      <div className="px-2 mt-1">
                          <button onClick={handleCancelTrade} className="w-full py-2 bg-slate-200 text-slate-500 rounded-lg font-bold text-sm flex items-center justify-center gap-1"><X size={16}/> 取消交易 (恢復行情)</button>
                      </div>
                  </>
              )}
          </div>
      </div>
  );

  // ★★★ 結算畫面 (v9.2：左右分割佈局) ★★★
  return (
    <div className="h-[100dvh] bg-slate-50 text-slate-800 flex flex-col items-center justify-center p-6 text-center overflow-y-auto">
        <Trophy size={64} className="text-amber-500 mb-4 animate-bounce"/>
        <h2 className="text-3xl font-bold mb-4 text-slate-800">比賽結束</h2>
        
        <div className="mb-6 bg-white px-6 py-2 rounded-full shadow-sm border border-slate-200 inline-block">
            <span className="text-xs text-slate-400 mr-2 font-bold">基金揭曉</span>
            <span className="text-lg font-bold text-emerald-600">{fundName}</span>
        </div>

        {/* ★ 左右分割佈局 ★ */}
        <div className="w-full max-w-sm flex gap-2 mb-6">
            
            {/* 左：玩家成績 (2/3) */}
            <div className="flex-1 bg-white p-4 rounded-xl border border-slate-200 shadow-md flex flex-col justify-center items-center">
                <div className="text-xs text-slate-400 mb-1 font-bold">您的最終成績</div>
                <div className={`text-4xl font-black ${displayRoi >= 0 ? 'text-red-500' : 'text-green-600'}`}>
                    {displayRoi > 0 ? '+' : ''}{displayRoi.toFixed(1)}%
                </div>
            </div>

            {/* 右：冠軍資訊 (1/3) */}
            {champion && (
               <div className="w-1/3 bg-gradient-to-br from-yellow-400 to-orange-500 p-3 rounded-xl border border-amber-300 shadow-md flex flex-col justify-center items-center relative overflow-hidden text-white">
       		 {/* 背景裝飾皇冠：改成淡淡的白色透明 */}
        	<Crown size={40} className="absolute -right-2 -top-2 text-white/30"/>
        
        	{/* 小皇冠圖示：改成白色 */}
        	<Crown size={20} className="text-white mb-1" fill="currentColor"/>
        
        	{/* 標題：改中文、放大、加粗 */}
        	<div className="text-lg text-white font-black mb-0 shadow-sm">本場冠軍</div>
        
       		 {/* 玩家暱稱 */}
        	<div className="text-sm font-bold truncate w-full text-center mb-1 drop-shadow-md">{champion.nickname}</div>
        
        	{/* 報酬率：改成白色大字 */}
        	<div className="text-lg font-mono font-black text-white drop-shadow-md">
            	{champion.roi > 0 ? '+' : ''}{champion.roi.toFixed(1)}%
                    </div>
                </div>
            )}
        </div>

        {fullData.length > 0 && (
            <div className="bg-slate-100 p-4 rounded-xl w-full max-w-sm border border-slate-200">
                <div className="flex items-center justify-center gap-2 text-slate-500 font-bold mb-2 text-xs">
                    <Calendar size={14}/> 真實歷史區間
                </div>
                <div className="text-lg font-mono font-bold text-slate-700">
                    {getRealDate(fullData[startDay]?.date)} 
                    <span className="text-slate-400 mx-1">~</span> 
                    {getRealDate(fullData[currentDay]?.date)}
                </div>
            </div>
        )}

        <button onClick={() => { localStorage.clear(); setStatus('input_room'); setRoomId(''); }} className="mt-8 text-slate-400 underline hover:text-slate-600 mb-8">離開房間</button>
    </div>
  );
}