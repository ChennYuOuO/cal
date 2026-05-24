# 個人記帳與消費分析系統：Gemini API Node.js 版本

這個版本不使用 PHP，改用 Node.js 當後端代理 Gemini API。

## 為什麼需要 Node.js 後端？

不要把 Gemini API Key 直接寫在前端 `script.js`，因為使用者可以從瀏覽器開發者工具看到金鑰。這個版本的做法是：

```text
手機/瀏覽器網頁 → Node.js 後端 /api/analyze → Gemini API → 回傳 AI 分析結果
```

## 使用步驟

1. 安裝 Node.js 18 以上版本。
2. 把整個資料夾放到你想要的位置，例如桌面。
3. 複製 `.env.example`，改名成 `.env`。
4. 打開 `.env`，填入自己的 Gemini API Key：

```env
GEMINI_API_KEY=你的_Gemini_API_Key
GEMINI_MODEL=gemini-2.5-flash
```

5. 在資料夾內開啟終端機，執行：

```bash
npm start
```

或：

```bash
node server.js
```

6. 用瀏覽器打開：

```text
http://localhost:3000
```

## 注意事項

- 不要直接雙擊 `index.html` 測試 AI 功能，因為這樣不會啟動 Node.js 後端。
- 如果 Gemini 回報模型不存在，可以把 `.env` 裡的 `GEMINI_MODEL` 改成你目前帳號可用的模型。
- 這個版本不需要 XAMPP，也不需要 PHP。
