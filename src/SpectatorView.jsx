// 2025v11.3 - 主持人端 (分級顯示：實心=順勢訊號，空心=逆勢轉折訊號)
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react'; 
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ComposedChart, ReferenceDot } from 'recharts';
import { 
  Trophy, Users, Play, Pause, FastForward, RotateCcw, 
  Crown, Activity, Monitor, TrendingUp, MousePointer2, Zap, 
  DollarSign, QrCode, X, TrendingDown, Calendar, Hand, Clock, 
  Lock, AlertTriangle, Radio, LogIn, LogOut, ShieldCheck,
  Copy, Check, Percent, TrendingUp as TrendIcon, Timer, Wallet
} from 'lucide-react';

import { db, auth } from './config/firebase'; 
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { 
  doc, setDoc, onSnapshot, updateDoc, collection, 
  serverTimestamp, increment, deleteDoc, getDocs, getDoc 
} from 'firebase/firestore';

import { FUNDS_LIBRARY } from './config/funds';

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

// --- 視覺輔助繪圖函數 ---

// 1. 扣抵值三角形 (藍色/深藍色)
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

// 2. 交叉訊號繪製器 (支援 實心/空心)
// type: 'solid' (順勢/強訊號) | 'hollow' (逆勢/轉折訊號)
const renderCrossTriangle = (props) => {
    const { cx, cy, direction, type } = props;
    
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

export default function SpectatorView() {
  const [hostUser, setHostUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [permissionError, setPermissionError] = useState(''); 
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  const [roomId, setRoomId] = useState(null);
  const [gameStatus, setGameStatus] = useState('waiting'); 
  const [players, setPlayers] = useState([]);
  
  const [currentDay, setCurrentDay] = useState(400);
  const [startDay, setStartDay] = useState(400); 
  const [timeOffset, setTimeOffset] = useState(0); 

  const [selectedFundId, setSelectedFundId] = useState(FUNDS_LIBRARY[0]?.id || 'fund_A');
  const [autoPlaySpeed, setAutoPlaySpeed] = useState(null);
  
  const [gameDuration, setGameDuration] = useState(60);
  const [gameEndTime, setGameEndTime] = useState(null);
  const [remainingTime, setRemainingTime] = useState(0);
  
  const [indicators, setIndicators] = useState({ ma20: false, ma60: false, river: false, trend: false });
  const [fullData, setFullData] = useState([]);
  const [fundName, setFundName] = useState('');
  const [feeRate, setFeeRate] = useState(0.01);
  const [showQrModal, setShowQrModal] = useState(false);
  const [tradeRequests, setTradeRequests] = useState([]);
  const [countdown, setCountdown] = useState(15); 
  const [copied, setCopied] = useState(false);

  const roomIdRef = useRef(null);
  const autoPlayRef = useRef(null);

  // 權限檢查
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsAuthChecking(true);
        setPermissionError('');
        try {
            const userDocRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userDocRef);

            if (userSnap.exists()) {
                const role = userSnap.data().role;
                if (['admin', 'host', 'vip'].includes(role)) {
                    setHostUser(user);
                } else {
                    await signOut(auth);
                    setHostUser(null);
                    setPermissionError('您的帳號沒有主持人權限');
                }
            } else {
                await signOut(auth);
                setHostUser(null);
                setPermissionError('查無會員資料');
            }
        } catch (error) {
            console.error("權限檢查失敗", error);
            setPermissionError('系統錯誤');
            await signOut(auth);
        }
        setIsAuthChecking(false);
      } else {
        setHostUser(null);
        setIsAuthChecking(false);
        setRoomId(null);
        roomIdRef.current = null;
      }
    });
    return () => unsubscribe();
  }, []);

  const handleCreateRoom = async () => {
    if (!hostUser) return;
    const newRoomId = Math.floor(100000 + Math.random() * 900000).toString();
    roomIdRef.current = newRoomId;
    setRoomId(newRoomId);
    setFeeRate(0.01);
    const randomTimeOffset = Math.floor(Math.random() * 50) + 10;
    setTimeOffset(randomTimeOffset);
    
    try {
      await setDoc(doc(db, "battle_rooms", newRoomId), {
        ownerId: hostUser.uid, 
        status: 'waiting',
        currentDay: 400,
        startDay: 400,
        fundId: selectedFundId,
        timeOffset: randomTimeOffset,
        indicators: { ma20: false, ma60: false, river: false, trend: false }, 
        feeRate: 0.01,
        createdAt: serverTimestamp(),
        gameEndTime: null
      });
      setGameStatus('waiting');
    } catch (error) { 
      console.error("開房失敗:", error); 
      alert("開房失敗");
      setRoomId(null);
    }
  };

// SpectatorView.jsx - 修正後的請求監聽 (含時間校正)
  useEffect(() => {
      if (!roomId) return;
      const unsubscribe = onSnapshot(collection(db, "battle_rooms", roomId, "requests"), (snapshot) => {
          const reqs = [];
          snapshot.forEach(doc => reqs.push(doc.data()));
          setTradeRequests(reqs); // 存入請求數據
          
          if (reqs.length > 0) {
              // 停止自動播放
              if (autoPlayRef.current) { clearInterval(autoPlayRef.current); autoPlayRef.current = null; }
              setAutoPlaySpeed(null); 
              
              // ★ 時間校正邏輯 ★
              // 找出最新的一個請求
              const latestReq = reqs.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0))[0];
              
              if (latestReq && latestReq.timestamp) {
                  const nowSeconds = Date.now() / 1000;
                  const reqSeconds = latestReq.timestamp.seconds; // Firestore Timestamp
                  const elapsed = nowSeconds - reqSeconds; // 已經過了幾秒
                  const remaining = Math.max(0, 15 - Math.floor(elapsed)); // 計算剩餘時間
                  
                  // 設定倒數 (如果已經過期，就設為 0)
                  setCountdown(remaining);
              } else {
                  // 如果剛寫入還沒有 timestamp (Latency)，先給 15
                  setCountdown(15);
              }
          }
      });
      return () => unsubscribe();
  }, [roomId]);

  useEffect(() => {
      let timer;
      if (tradeRequests.length > 0 && countdown > 0) {
          timer = setInterval(() => { setCountdown((prev) => prev - 1); }, 1000);
      } else if (tradeRequests.length === 0) {
          setCountdown(15); 
      }
      return () => clearInterval(timer);
  }, [tradeRequests.length, countdown]);

  useEffect(() => {
      const loadData = async () => {
          const targetFund = FUNDS_LIBRARY.find(f => f.id === selectedFundId);
          if (!targetFund) return;
          setFundName(targetFund.name);
          try {
              const res = await fetch(targetFund.file);
              setFullData(processRealData(await res.json()));
          } catch (err) { console.error(err); }
      };
      loadData();
  }, [selectedFundId]);

  useEffect(() => {
    if (!roomId) return;
    const unsubscribe = onSnapshot(doc(db, "battle_rooms", roomId), async (docSnap) => {
      if (!docSnap.exists()) { localStorage.clear(); return; }
      const roomData = docSnap.data();
      
      if (roomData.status) setGameStatus(roomData.status);
      if (roomData.currentDay !== undefined) setCurrentDay(roomData.currentDay);
      if (roomData.startDay) setStartDay(roomData.startDay);
      if (roomData.indicators) setIndicators(roomData.indicators);
      if (roomData.timeOffset) setTimeOffset(roomData.timeOffset);
      if (roomData.feeRate !== undefined) setFeeRate(roomData.feeRate);
      
      if (roomData.gameEndTime) {
          const t = roomData.gameEndTime;
          const millis = typeof t.toMillis === 'function' ? t.toMillis() : Number(t);
          setGameEndTime(millis);
      } else {
          setGameEndTime(null);
      }

      if (fullData.length === 0 && roomData.fundId) {
         const targetFund = FUNDS_LIBRARY.find(f => f.id === roomData.fundId);
         if (targetFund) {
             setFundName(targetFund.name);
             const res = await fetch(targetFund.file);
             setFullData(processRealData(await res.json()));
         }
      }
    });
    return () => unsubscribe();
  }, [roomId, fullData.length]);

  useEffect(() => {
      let interval = null;
      const tick = () => {
          if (gameStatus === 'playing' && gameEndTime) {
              const now = Date.now();
              const diff = gameEndTime - now;
              if (diff <= 0) {
                  setRemainingTime(0);
                  if (gameStatus === 'playing') handleEndGame();
              } else {
                  setRemainingTime(diff);
              }
          } else {
              setRemainingTime(0);
          }
      };
      tick();
      if (gameStatus === 'playing' && gameEndTime) {
          interval = setInterval(tick, 1000);
      }
      return () => { if(interval) clearInterval(interval); };
  }, [gameStatus, gameEndTime]);

  const formatTime = (ms) => {
      if (ms <= 0) return "00:00";
      const totalSeconds = Math.ceil(ms / 1000);
      const m = Math.floor(totalSeconds / 60);
      const s = totalSeconds % 60;
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setPermissionError('');
    try { await signInWithEmailAndPassword(auth, email, password); } catch (err) { setLoginError("登入失敗：帳號或密碼錯誤"); }
  };

  const handleLogout = () => {
    if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    signOut(auth);
  };

  const handleStartGame = async () => {
    if (!roomId || fullData.length === 0) return;
    const minBuffer = 100;
    const maxStart = Math.max(minBuffer, fullData.length - 1250);
    const randomStartDay = Math.floor(Math.random() * (maxStart - minBuffer)) + minBuffer;
    const randomOffset = Math.floor(Math.random() * 50) + 10;

    const duration = Number(gameDuration) || 60;
    const calculatedEndTime = Date.now() + (duration * 60 * 1000);

    setGameEndTime(calculatedEndTime);
    setGameStatus('playing');

    await updateDoc(doc(db, "battle_rooms", roomId), { 
        status: 'playing', 
        fundId: selectedFundId,
        currentDay: randomStartDay, 
        startDay: randomStartDay,   
        timeOffset: randomOffset,
        gameEndTime: calculatedEndTime,
        gameDuration: duration
    });
  };

  const handleNextDay = async () => {
    if (tradeRequests.length > 0) return; 
    if (!roomId) return;
    await updateDoc(doc(db, "battle_rooms", roomId), { currentDay: increment(1) });
    };

  const toggleIndicator = async (key) => {
      const newIndicators = { ...indicators, [key]: !indicators[key] };
      setIndicators(newIndicators); 
      if (roomId) await updateDoc(doc(db, "battle_rooms", roomId), { indicators: newIndicators }); 
  };

  const handleChangeFee = async (e) => {
      const rate = parseFloat(e.target.value);
      setFeeRate(rate);
      if (roomId) await updateDoc(doc(db, "battle_rooms", roomId), { feeRate: rate });
  };

  const toggleAutoPlay = (speed) => {
    if (tradeRequests.length > 0) return;
    if (autoPlaySpeed === speed) {
      clearInterval(autoPlayRef.current);
      setAutoPlaySpeed(null);
    } else {
      clearInterval(autoPlayRef.current);
      setAutoPlaySpeed(speed);
      autoPlayRef.current = setInterval(async () => {
        if (roomIdRef.current) {
           await updateDoc(doc(db, "battle_rooms", roomIdRef.current), { currentDay: increment(1) });
        }
      }, speed);
    }
  };

// 修改後的結算函式：加入緩衝時間，解決冠軍數據不同步問題
  const handleEndGame = async () => {
    // 1. 第一步：立刻停止現場的自動播放與倒數，凍結畫面
    if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    setAutoPlaySpeed(null);
    setGameEndTime(null); // 清除倒數計時，避免重複觸發

    console.log("⏳ 比賽結束，等待數據同步中 (緩衝 2 秒)...");

    // 2. 第二步：給予 2 秒的「數據同步緩衝期」
    // 這段時間是為了讓所有玩家端最新的 ROI 能夠寫入 Firebase
    setTimeout(async () => {
        let winnerInfo = null;

        if (roomId) {
            try {
                console.log("✅ 開始抓取最終排名...");
                // 主動從資料庫抓取最新玩家名單
                const playersRef = collection(db, "battle_rooms", roomId, "players");
                const snapshot = await getDocs(playersRef);
                
                const latestPlayers = [];
                snapshot.forEach((doc) => {
                    latestPlayers.push({ id: doc.id, ...doc.data() });
                });

                // 重新排序 (由高到低)
                // 這裡加入 || -999 防止沒有 roi 欄位時排序錯誤
                latestPlayers.sort((a, b) => (b.roi || -999) - (a.roi || -999));

                // 如果有玩家，取出第一名
                if (latestPlayers.length > 0) {
                    const champion = latestPlayers[0];
                    console.log("🏆 冠軍產生:", champion.nickname, champion.roi);
                    winnerInfo = { nickname: champion.nickname, roi: champion.roi || 0 };
                }

                // 3. 第三步：寫入結算狀態與冠軍資訊
                await updateDoc(doc(db, "battle_rooms", roomId), { 
                    status: 'ended', 
                    finalWinner: winnerInfo 
                });

            } catch (error) {
                console.error("結算時發生錯誤:", error);
            }
        }

        // 最後才設定本地狀態，顯示結算畫面
        setGameStatus('ended');
        
    }, 2000); // ★ 這裡設定延遲 2000 毫秒 (2秒)，確保數據絕對同步
  };


  const handleResetRoom = async () => {
    if (!roomId || !window.confirm("確定重置？")) return;
    setGameStatus('waiting');
    setCurrentDay(400); setStartDay(400);
    setIndicators({ ma20: false, ma60: false, river: false, trend: false });
    setFeeRate(0.01);
    if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    setAutoPlaySpeed(null);
    setTradeRequests([]); setCountdown(15); 
    setGameEndTime(null); 

    await updateDoc(doc(db, "battle_rooms", roomId), { 
        status: 'waiting', 
        currentDay: 400, 
        startDay: 400,
        indicators: { ma20: false, ma60: false, river: false, trend: false },
        feeRate: 0.01,
        finalWinner: null,
        gameEndTime: null
    });
    
    const snapshot = await getDocs(collection(db, "battle_rooms", roomId, "players"));
    snapshot.forEach(async (d) => await deleteDoc(doc(db, "battle_rooms", roomId, "players", d.id)));
    const reqSnap = await getDocs(collection(db, "battle_rooms", roomId, "requests"));
    reqSnap.forEach(async (d) => await deleteDoc(d.ref));
  };

  const handleForceClearRequests = async () => {
      if (!roomId) return;
      const reqSnap = await getDocs(collection(db, "battle_rooms", roomId, "requests"));
      reqSnap.forEach(async (d) => await deleteDoc(d.ref));
      setTradeRequests([]); setCountdown(15);
  };

  const handleCopyUrl = () => {
      if (!joinUrl) return;
      navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); 
  };

  const getDisplayDate = (dateStr) => {
      if (!dateStr) return 'Loading...';
      const dateObj = new Date(dateStr);
      if (isNaN(dateObj.getTime())) return dateStr;
      const newYear = dateObj.getFullYear() + timeOffset;
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      return `${newYear}-${month}-${day}`;
  };

  const deduction20 = (fullData && currentDay >= 20) ? fullData[currentDay - 20] : null;
  const deduction60 = (fullData && currentDay >= 60) ? fullData[currentDay - 60] : null;

  const currentTrendInfo = useMemo(() => {
      if (!fullData[currentDay] || !indicators.trend) return null;
      const realIdx = currentDay;
      const curNav = fullData[realIdx].nav;
      const ind20 = calculateIndicators(fullData, 20, realIdx);
      const ind60 = calculateIndicators(fullData, 60, realIdx);
      const ma20 = ind20.ma; const ma60 = ind60.ma;
      if (!ma20 || !ma60) return null;
      if (curNav > ma20 && ma20 > ma60) return { text: '多頭排列 🔥', color: 'text-red-500', bg: 'bg-red-50' };
      else if (curNav < ma20 && ma20 < ma60) return { text: '空頭排列 🧊', color: 'text-green-600', bg: 'bg-green-50' };
      return { text: '盤整觀望 ⚖️', color: 'text-slate-500', bg: 'bg-slate-100' };
  }, [fullData, currentDay, indicators.trend]);


// ★★★ V11.9 核心升級：盤整過濾加強版 (SpectatorView 同步修正) ★★★
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

          // ★ 關鍵修正 1: 改用 10 天前的索引 (同步 AppBattle)
          const prev10Idx = realIdx > 10 ? realIdx - 10 : 0;
          const ind60_prev10 = calculateIndicators(fullData, 60, prev10Idx);

          // 扣抵值點位
          const deduction20 = (fullData && realIdx >= 20) ? fullData[realIdx - 20] : null;
          const deduction60 = (fullData && realIdx >= 60) ? fullData[realIdx - 60] : null;
          
          let riverTop = null; 
          let riverBottom = null;
          if (ma60) { riverTop = ma60 * 1.1; riverBottom = ma60 * 0.9; }

          // --- 訊號判斷邏輯 (Filter Logic) ---
          let crossSignal = null;
          
          if (ma20 && ma60 && prevInd20.ma && prevInd60.ma && ind60_prev10.ma && realIdx > 10) {
              const isGoldCross = prevInd20.ma <= prevInd60.ma && ma20 > ma60;
              const isDeathCross = prevInd20.ma >= prevInd60.ma && ma20 < ma60;

              // 1. 計算月線斜率
              const slope20 = prevInd20.ma ? (ma20 - prevInd20.ma) / prevInd20.ma : 0;

              // 2. ★ 關鍵修正 2: 計算 10 天前的季線斜率
              const slope60 = ind60_prev10.ma ? (ma60 - ind60_prev10.ma) / ind60_prev10.ma : 0;

              // 3. 計算乖離率
              const currentPrice = d.nav;
              const bias60 = (currentPrice - ma60) / ma60;

              // ★ 關鍵修正 3: 設定盤整濾網門檻 (同步 AppBattle: 0.15%)
              const TREND_THRESHOLD = 0.0015; 

              if (isGoldCross) {
                  // A. 真突破
                  if (slope60 > TREND_THRESHOLD) {
                      crossSignal = { type: 'gold', style: 'solid' };
                  }
                  // B. 盤整區突破 (乖離濾網)
                  else if (slope60 > 0 && bias60 > 0.02) {
                      crossSignal = { type: 'gold', style: 'solid' };
                  }
                  // C. V轉急漲
                  else if (slope20 > 0.005) {
                      crossSignal = { type: 'gold', style: 'solid' };
                  }
                  // D. 雜訊 (空心)
                  else {
                      crossSignal = { type: 'gold', style: 'hollow' };
                  }
              } else if (isDeathCross) {
                  // A. 真跌破
                  if (slope60 < -TREND_THRESHOLD) {
                      crossSignal = { type: 'death', style: 'solid' };
                  }
                  // B. 急跌修正
                  else if (slope20 < -0.005) {
                      crossSignal = { type: 'death', style: 'solid' };
                  }
                  // C. 多頭回檔
                  else {
                      crossSignal = { type: 'death', style: 'hollow' };
                  }
              }
              
              // 補償訊號 (延遲確認)
              if (!crossSignal && ma20 > ma60 && slope60 > TREND_THRESHOLD) {
                   const prevSlope60 = (prevInd60.ma - refInd60.ma) / refInd60.ma; 
                   if (prevSlope60 <= TREND_THRESHOLD) {
                       crossSignal = { type: 'gold', style: 'solid' };
                   }
              }
          }

          return { 
              ...d, 
              ma20, ma60, riverTop, riverBottom, crossSignal, deduction20, deduction60
          };
      });
  }, [fullData, currentDay]);

  const { totalInvestedAmount, positionRatio } = useMemo(() => {
      let totalAssets = 0; let totalInvested = 0;
      players.forEach(p => {
          const pAssets = p.assets || 1000000; totalAssets += pAssets;
          const pUnits = p.units || 0; const currentNav = fullData[currentDay]?.nav || 0;
          let marketValue = pUnits * currentNav; if (marketValue > pAssets) marketValue = pAssets;
          totalInvested += marketValue;
      });
      const ratio = totalAssets > 0 ? (totalInvested / totalAssets) * 100 : 0;
      return { totalInvestedAmount: totalInvested, positionRatio: ratio };
  }, [players, fullData, currentDay]);

  const topPlayers = players.slice(0, 10);
  const bottomPlayers = players.length > 13 ? players.slice(-3).reverse() : []; 
  const joinUrl = roomId ? `${window.location.origin}/battle?room=${roomId}` : '';
  const currentNav = fullData[currentDay]?.nav || 0;
  const currentDisplayDate = fullData[currentDay] ? getDisplayDate(fullData[currentDay].date) : "---";
  const hasRequests = tradeRequests && tradeRequests.length > 0;

  if (isAuthChecking) return <div className="h-screen flex items-center justify-center bg-slate-50 text-slate-500 font-bold"><Activity className="animate-spin mr-2"/> 系統驗證中...</div>;

  if (!hostUser) {
    return (
      <div className="h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm border border-slate-200">
          <div className="flex justify-center mb-6"><img src="/logo.jpg" alt="Logo" className="h-16 object-contain" /></div>
          <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">基金競技場</h2>
          <p className="text-center text-slate-400 text-xs mb-6">主持人控制台登入</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 ml-1 mb-1 block">管理員信箱</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 focus:bg-white transition-all" required placeholder="name@example.com"/>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 ml-1 mb-1 block">密碼</label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 focus:bg-white transition-all" required placeholder="••••••••"/>
            </div>
            {loginError && <div className="p-3 bg-red-50 text-red-500 text-xs rounded-lg text-center font-bold border border-red-100">{loginError}</div>}
            
            {permissionError && <div className="p-3 bg-amber-50 text-amber-600 text-xs rounded-lg text-center font-bold border border-amber-200 flex flex-col gap-1"><ShieldCheck size={20} className="mx-auto"/>{permissionError}</div>}

            <button type="submit" className="w-full py-3.5 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-700 transition-all shadow-lg flex items-center justify-center gap-2">
                <LogIn size={18}/> 登入系統
            </button>
          </form>
          <div className="mt-6 text-center text-[10px] text-slate-400">
            v11.3 Dual Logic (Solid/Hollow) | NBS Team
          </div>
        </div>
      </div>
    );
  }

  if (!roomId) {
      return (
          <div className="h-screen bg-slate-50 text-slate-800 font-sans flex flex-col">
              <header className="bg-white border-b border-slate-200 p-4 flex justify-between items-center shadow-sm">
                  <div className="flex items-center gap-3"><img src="/logo.jpg" alt="Logo" className="h-10 object-contain" /><div className="flex flex-col"><span className="font-black text-base text-slate-800 leading-tight">Fund手遊</span><span className="text-[10px] text-slate-500 font-bold tracking-wide">基金競技場 - 賽事主控台</span></div></div>
                  <div className="flex items-center gap-4">
                      <span className="text-sm text-slate-500 hidden md:block">{hostUser.email}</span>
                      <button onClick={handleLogout} className="text-sm text-red-500 hover:text-red-600 font-bold flex items-center gap-1 bg-red-50 px-3 py-1.5 rounded-lg transition-colors"><LogOut size={16}/> 登出</button>
                  </div>
              </header>
              <main className="flex-1 flex flex-col items-center justify-center p-6">
                  <div className="text-center mb-8">
                      <h1 className="text-4xl font-bold text-slate-800 mb-2">準備好開始一場對決了嗎？</h1>
                      <p className="text-slate-500">點擊下方按鈕建立一個全新的戰局房間</p>
                  </div>
                  <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 w-full max-w-md">
                      <div className="mb-6">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">預設基金</label>
                          <select value={selectedFundId} onChange={(e) => setSelectedFundId(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-800 font-bold">
                               {FUNDS_LIBRARY.map(f => (<option key={f.id} value={f.id}>{f.name}</option>))}
                          </select>
                      </div>
                      <button onClick={handleCreateRoom} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xl shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2 group">
                          <Zap size={24} className="group-hover:scale-110 transition-transform"/> 建立新戰局
                      </button>
                  </div>
              </main>
          </div>
      );
  }

  return (
    <div className="h-screen bg-slate-50 text-slate-800 font-sans flex flex-col overflow-hidden relative">
      <header className="bg-white border-b border-slate-200 p-3 flex justify-between items-center shadow-sm z-20 shrink-0 h-16">
        <div className="flex items-center gap-3 shrink-0"><img src="/logo.jpg" alt="Logo" className="h-10 object-contain rounded-sm" /><div className="flex flex-col justify-center"><span className="font-black text-base text-slate-800 leading-none mb-0.5">Fund手遊</span><span className="text-[10px] text-slate-500 font-bold tracking-wide leading-none">基金競技場 - 賽事主控台</span></div></div>
        <div className="flex-1 flex justify-center items-center px-4">
            {(gameStatus === 'playing' || gameStatus === 'ended') && (
                <div className="flex items-center gap-6 bg-slate-50 px-6 py-1 rounded-xl border border-slate-100 shadow-inner relative">
                    {currentTrendInfo && (<div className={`absolute -top-4 left-1/2 transform -translate-x-1/2 ${currentTrendInfo.bg} px-3 py-0.5 rounded-full border border-slate-200 shadow-sm flex items-center gap-1 z-10`}><span className={`text-[10px] font-bold ${currentTrendInfo.color}`}>{currentTrendInfo.text}</span></div>)}
                    <div className="flex items-center gap-2"><span className="text-slate-500 font-bold text-sm hidden md:block">{fundName}</span></div><div className="w-px h-6 bg-slate-200 hidden md:block"></div><div className="flex items-baseline gap-2"><span className="text-xs text-amber-500 font-bold tracking-widest uppercase hidden sm:block">{currentDisplayDate}</span><span className="text-3xl font-mono font-black text-slate-800 tracking-tight">{currentNav.toFixed(2)}</span></div>
                    <div className="w-px h-6 bg-slate-200 hidden md:block"></div><div className="flex flex-col items-end"><div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase"><Wallet size={10} /> 總資金</div><div className="flex items-baseline gap-2"><span className="text-lg font-mono font-black text-slate-700 leading-none">${Math.round(totalInvestedAmount / 10000)}萬</span><span className={`text-[10px] font-bold ${positionRatio >= 80 ? 'text-red-500' : 'text-slate-400'}`}>({positionRatio.toFixed(0)}%)</span></div></div>
                </div>
            )}
        </div>
        <div className="flex items-center gap-4 justify-end shrink-0">
            {(gameStatus === 'playing' || gameStatus === 'ended') && (<div className="flex items-center gap-2 px-4 py-1 bg-red-50 border border-red-100 rounded-lg animate-pulse"><Timer size={20} className="text-red-500"/><span className="text-2xl font-mono font-black text-red-600 tracking-wider">{formatTime(remainingTime)}</span></div>)}
            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200 hidden md:flex"><div className="text-right"><span className="block text-[10px] text-slate-400 uppercase leading-none">Room ID</span><span className="text-xl font-mono font-bold text-slate-800 tracking-widest leading-none">{roomId || '...'}</span></div><button onClick={() => setShowQrModal(true)} className="bg-white p-1.5 rounded-md border border-slate-300 hover:bg-slate-50 text-slate-600 transition-colors shadow-sm"><QrCode size={18}/></button></div><button onClick={handleLogout} className="p-2 bg-white border border-slate-200 text-red-400 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors ml-2" title="結束控制並登出"><LogOut size={18} /></button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        {gameStatus === 'waiting' && (<div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 relative z-10"><div className="flex gap-16 items-center"><div className="text-left"><h2 className="text-5xl font-bold text-slate-800 mb-4">加入戰局</h2><p className="text-slate-500 text-xl mb-8">拿出手機掃描，輸入暱稱即可參賽</p><button onClick={handleCopyUrl} className="group bg-white hover:bg-emerald-50 px-6 py-4 rounded-xl border border-slate-200 hover:border-emerald-200 text-2xl inline-flex items-center gap-3 mb-8 shadow-sm transition-all active:scale-95 cursor-pointer relative" title="點擊複製連結"><span className="font-mono text-emerald-600 font-bold">{joinUrl}</span><span className={`p-2 rounded-lg transition-colors ${copied ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400 group-hover:bg-white'}`}>{copied ? <Check size={24} /> : <Copy size={24} />}</span><span className={`absolute -top-10 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg transition-opacity duration-300 ${copied ? 'opacity-100' : 'opacity-0'}`}>已複製連結！</span></button><div className="bg-white p-4 rounded-xl border border-slate-200 w-80 shadow-lg"><div className="mb-4"><label className="text-xs text-slate-400 block mb-2">本場戰役目標</label><select value={selectedFundId} onChange={(e) => setSelectedFundId(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-800 outline-none">{FUNDS_LIBRARY.map(f => (<option key={f.id} value={f.id}>{f.name}</option>))}</select></div><div className="mb-6"><label className="text-xs text-slate-400 block mb-2">對戰時間 (分鐘)</label><div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded p-2"><Clock size={18} className="text-slate-400"/><input type="number" value={gameDuration} onChange={(e) => setGameDuration(Number(e.target.value))} className="w-full bg-transparent outline-none text-slate-800 font-bold" min="1"/></div></div><button onClick={handleStartGame} disabled={players.length === 0} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-lg text-lg transition-all shadow-md flex items-center justify-center gap-2"><Play fill="currentColor"/> 開始比賽 ({players.length}人)</button></div></div><div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100">{roomId && <QRCodeSVG value={joinUrl} size={350} />}</div></div></div>)}

        {(gameStatus === 'playing' || gameStatus === 'ended') && (
            <>
                <div className="w-2/3 h-full bg-white border-r border-slate-200 flex flex-col relative">
                    <div className="p-4 flex-1 relative">
                        <ResponsiveContainer width="100%" height="100%">
    <ComposedChart data={chartData} margin={{ top: 10, right: 0, bottom: 0, left: 0 }}>
        {/* 1. 網格與軸線 */}
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} opacity={0.8} />
        <XAxis dataKey="date" hide />
   <YAxis 
    domain={['auto', 'auto']} 
    orientation="right" 
    tick={{fill: '#64748b', fontSize: 11, fontWeight: 'bold'}} 
    width={45} // ★ 給予足夠寬度顯示數字
    tickFormatter={(v) => Math.round(v)} // 取整數，保持整潔
    interval="preserveStartEnd"
/>
        
        {/* 2. 扣抵值標註 */}
        {indicators.trend && indicators.ma20 && deduction20 && (<ReferenceDot x={deduction20.date} y={deduction20.nav} shape={renderTriangle} fill="#38bdf8" />)}
        {indicators.trend && indicators.ma60 && deduction60 && (<ReferenceDot x={deduction60.date} y={deduction60.nav} shape={renderTriangle} fill="#1d4ed8" />)}

        {/* 3. 均線 */}
        {indicators.river && <Line type="monotone" dataKey="riverTop" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} opacity={0.3} />}
        {indicators.river && <Line type="monotone" dataKey="riverBottom" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} opacity={0.3} />}
        {indicators.ma20 && <Line type="monotone" dataKey="ma20" stroke="#38bdf8" strokeWidth={2} dot={false} isAnimationActive={false} opacity={0.9} />}
        {indicators.ma60 && <Line type="monotone" dataKey="ma60" stroke="#1d4ed8" strokeWidth={2} dot={false} isAnimationActive={false} opacity={0.9} />}
        <Line type="monotone" dataKey="nav" stroke="#000000" strokeWidth={2.5} dot={false} isAnimationActive={false} shadow="0 0 10px rgba(0, 0, 0, 0.1)" />

        {/* 4. 訊號 - 修正：根據 crossSignal 的物件屬性繪製 */}
        {indicators.trend && chartData.map((entry, index) => {
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
                </div>
                <div className="w-1/3 h-full bg-slate-50 flex flex-col border-l border-slate-200"><div className="p-4 bg-slate-50 border-b border-slate-200 shrink-0"><h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Trophy size={20} className="text-amber-500"/> 菁英榜 TOP 10</h2></div><div className="flex-1 overflow-hidden relative flex flex-col"><div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">{topPlayers.map((p, idx) => (<div key={p.id} className={`flex justify-between items-center p-2.5 rounded-lg border transition-all duration-300 ${idx===0?'bg-amber-50 border-amber-200':idx===1?'bg-slate-200 border-slate-300':idx===2?'bg-orange-50 border-orange-200':'bg-white border-slate-200'}`}><div className="flex items-center gap-2"><div className={`w-6 h-6 flex items-center justify-center rounded-lg font-bold text-xs ${idx===0?'bg-amber-400 text-white':idx===1?'bg-slate-400 text-white':idx===2?'bg-orange-600 text-white':'bg-slate-100 text-slate-500'}`}>{idx + 1}</div><div className="flex flex-col"><span className="text-slate-800 font-bold text-sm truncate max-w-[100px]">{p.nickname}</span>{idx===0 && <span className="text-[9px] text-amber-500 flex items-center gap-1"><Crown size={8}/> 領先</span>}</div></div><div className={`font-mono font-bold text-base ${(p.roi || 0)>=0?'text-red-500':'text-green-500'}`}>{(p.roi || 0)>0?'+':''}{(p.roi || 0).toFixed(1)}%</div></div>))}</div>{bottomPlayers.length > 0 && (<div className="bg-slate-100 border-t border-slate-300 p-2 shrink-0"><div className="flex items-center gap-2 mb-1 text-slate-500 text-[10px] font-bold uppercase tracking-wider"><TrendingDown size={12}/> 逆風追趕中</div><div className="space-y-1">{bottomPlayers.map((p, idx) => (<div key={p.id} className="flex justify-between items-center p-1.5 bg-white/50 rounded border border-slate-200 text-xs opacity-70"><div className="flex items-center gap-2"><span className="text-slate-400 w-5 text-center">{players.length - idx}</span><span className="text-slate-700 font-bold truncate max-w-[80px]">{p.nickname}</span></div><span className="font-mono text-green-600 font-bold">{(p.roi || 0).toFixed(1)}%</span></div>))}</div></div>)}</div></div>
            </>
        )}
      </main>

      {gameStatus === 'playing' && (
          <footer className="bg-white border-t border-slate-200 h-[72px] shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] relative flex items-center justify-center">
              <div className="absolute left-4 flex gap-1"><button onClick={() => toggleIndicator('ma20')} className={`px-2 py-1.5 rounded text-[10px] font-bold border transition-colors ${indicators.ma20 ? 'bg-sky-50 border-sky-200 text-sky-600' : 'bg-white border-slate-300 text-slate-400'}`}>月線</button><button onClick={() => toggleIndicator('ma60')} className={`px-2 py-1.5 rounded text-[10px] font-bold border transition-colors ${indicators.ma60 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-300 text-slate-400'}`}>季線</button><button onClick={() => toggleIndicator('river')} className={`px-2 py-1.5 rounded text-[10px] font-bold border transition-colors ${indicators.river ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-300 text-slate-400'}`}>河流</button><button onClick={() => toggleIndicator('trend')} className={`px-2 py-1.5 rounded text-[10px] font-bold border transition-colors ${indicators.trend ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-white border-slate-300 text-slate-400'}`}>趨勢</button><div className="flex items-center ml-2 pl-2 border-l border-slate-200"><div className="relative"><Percent size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400"/><select value={feeRate} onChange={handleChangeFee} className="pl-7 pr-2 py-1 bg-white border border-slate-300 rounded-md text-[10px] font-bold text-slate-700 outline-none hover:border-slate-400 cursor-pointer appearance-none w-[90px]"><option value={0}>手續費 0%</option><option value={0.01}>手續費 1%</option><option value={0.02}>手續費 2%</option><option value={0.03}>手續費 3%</option></select></div></div></div>
              <div className="absolute left-[360px] z-50 w-[480px]">
                 {hasRequests ? (<div className="bg-yellow-400 text-slate-900 px-4 py-2 rounded-lg shadow-2xl flex items-center justify-between gap-4 w-full animate-in slide-in-from-bottom-2 duration-300 ring-4 ring-yellow-100"><div className="flex items-center gap-3 overflow-hidden"><div className="bg-white/30 p-1.5 rounded-full shrink-0"><Clock size={18} className="animate-spin-slow"/></div><div className="flex flex-col leading-none overflow-hidden"><div className="font-black text-sm flex items-center gap-2">市場暫停中 <span className="bg-black/10 px-1.5 rounded text-xs font-mono">{countdown}s</span></div><div className="text-[10px] font-bold opacity-80 truncate">{tradeRequests.map(r => r.nickname).join(', ')}</div></div></div><button onClick={handleForceClearRequests} className="bg-slate-900 text-white px-3 py-1.5 rounded-md font-bold text-xs hover:bg-slate-700 shadow-sm whitespace-nowrap flex items-center gap-1 shrink-0"><FastForward size={12} fill="currentColor"/> 繼續</button></div>) : (<div className="flex items-center gap-2 text-slate-600 text-sm font-bold border border-slate-200 bg-slate-100 px-6 py-2 rounded-full shadow-inner w-fit"><div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>市場監控中...</div>)}
              </div>
              <div className="absolute right-4 flex gap-2 items-center">
                  <button onClick={handleNextDay} disabled={hasRequests} className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-sm transition-all border ${hasRequests ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-slate-800 text-white border-slate-800 hover:bg-slate-700 active:scale-95'}`}>{hasRequests ? <Lock size={16}/> : <MousePointer2 size={16} />} 下一天</button>
                  <div className="h-8 w-px bg-slate-200 mx-1"></div>
                  <div className="flex gap-1">{[5, 4, 3, 2, 1].map(sec => (<button key={sec} onClick={() => toggleAutoPlay(sec * 1000)} disabled={hasRequests} className={`w-8 py-2 rounded font-bold text-xs flex justify-center transition-all ${hasRequests ? 'bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed' : (autoPlaySpeed===sec*1000 ? 'bg-emerald-500 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50')}`}>{sec}s</button>))} <button onClick={() => toggleAutoPlay(200)} disabled={hasRequests} className={`px-2 py-2 rounded font-bold text-xs flex gap-1 transition-all ${hasRequests ? 'bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed' : (autoPlaySpeed===200 ? 'bg-purple-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50')}`}><Zap size={12}/> 極速</button></div>
                  <button onClick={handleEndGame} className="px-3 py-2 bg-white border border-red-200 text-red-500 rounded text-xs hover:bg-red-50 font-bold ml-2">End</button>
              </div>
          </footer>
      )}

      {gameStatus === 'ended' && (
          <div className="absolute inset-0 bg-slate-900/50 z-50 flex items-center justify-center backdrop-blur-sm">
              <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center max-w-lg shadow-2xl relative overflow-hidden w-full mx-4">
                  <div className="absolute inset-0 bg-yellow-50/50 animate-pulse"></div>
                  <Crown size={80} className="text-amber-400 mx-auto mb-4 drop-shadow-sm relative z-10"/>
                  <h2 className="text-4xl font-bold text-slate-800 mb-2 relative z-10">WINNER</h2>
                  {players.length > 0 && (<div className="py-6 relative z-10 border-b border-amber-100 mb-6"><div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-600 mb-4">{players[0].nickname}</div><div className={`text-4xl font-mono font-bold ${players[0].roi >= 0 ? 'text-red-500' : 'text-green-600'}`}>ROI: {players[0].roi > 0 ? '+' : ''}{players[0].roi.toFixed(2)}%</div></div>)}
                  <div className="relative z-10 mb-4"><div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">本次挑戰基金</div><div className="text-2xl font-bold text-slate-800 bg-slate-100 px-4 py-2 rounded-xl inline-block shadow-sm border border-slate-200">{fundName}</div></div>
                  {fullData.length > 0 && (<div className="relative z-10 mb-8"><div className="flex items-center justify-center gap-2 text-slate-500 font-bold mb-1 text-xs"><Calendar size={14}/> 真實歷史區間</div><div className="text-lg font-mono font-bold text-slate-600">{fullData[startDay]?.date} <span className="text-slate-400">~</span> {fullData[currentDay]?.date}</div></div>)}
                  <button onClick={handleResetRoom} className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold flex items-center gap-2 mx-auto relative z-10 shadow-lg transition-all active:scale-95"><RotateCcw size={20}/> 開啟新局</button>
              </div>
          </div>
      )}

      {showQrModal && (
          <div className="absolute inset-0 bg-slate-900/80 z-[100] flex items-center justify-center backdrop-blur-sm">
              <div className="bg-white p-8 rounded-3xl border-2 border-slate-200 text-center shadow-2xl relative">
                  <button onClick={() => setShowQrModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={24}/></button>
                  <h2 className="text-2xl font-bold text-slate-800 mb-4">掃描加入戰局</h2>
                  <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-inner inline-block"><QRCodeSVG value={joinUrl} size={300} /></div>
                  <div className="mt-6 text-xl font-mono font-bold text-slate-600 bg-slate-100 px-4 py-2 rounded-lg">Room ID: {roomId}</div>
              </div>
          </div>
      )}
    </div>
  );
}