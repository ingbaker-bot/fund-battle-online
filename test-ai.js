// test-ai.js
// 這是一個測試腳本，用來確認 API 是否通暢
async function testAPI() {
    console.log("正在呼叫 AI API...");
    
    // 如果您在本地跑，網址通常是 http://localhost:3000/api/analyze-game
    // 如果您已經部署到 Vercel，請換成 https://您的網址.vercel.app/api/analyze-game
    const url = "http://localhost:3000/api/analyze-game"; 

    const mockData = {
        nickname: "測試員Jack",
        fundName: "元大台灣50",
        roi: -15.5,
        transactions: [
            { day: 10, type: "BUY", price: 100, units: 10 },
            { day: 20, type: "SELL", price: 85, units: 10 }
        ]
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(mockData)
        });
        
        const data = await response.json();
        console.log("----- AI 回覆結果 -----");
        console.log(data);
    } catch (error) {
        console.error("測試失敗:", error);
    }
}

testAPI();