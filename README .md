# API 逆向工程輸出站

## 功能特點
✅ Gemini 3 Pro Image Preview API 代理
✅ 完整的 API 請求/響應顯示
✅ 實時圖片生成預覽
✅ 單一 UI 介面（無需外部依賴）
✅ 一鍵部署到 Cloudflare Workers

## 快速部署

### 1. 安裝 Wrangler CLI
```bash
npm install -g wrangler
```

### 2. 登入 Cloudflare 帳號
```bash
wrangler login
```

### 3. 部署到 Cloudflare Workers
```bash
wrangler deploy
```

部署完成後，你會獲得一個 URL，例如：
```
https://api-reverse-engineering.your-account.workers.dev
```

## 本地開發

```bash
# 啟動本地開發伺服器
wrangler dev

# 訪問 http://localhost:8787
```

## 自定義配置

### 修改 API 端點
編輯 `worker.js` 的第 19 行：
```javascript
const apiUrl = "你的API端點";
```

### 添加認證
如果需要 API Key，在第 26 行添加：
```javascript
headers: {
  'Content-Type': 'application/json',
  'Authorization': 'Bearer YOUR_API_KEY',
  'X-API-Key': 'YOUR_API_KEY'
}
```

### 綁定自定義域名
編輯 `wrangler.toml`：
```toml
routes = [
  { pattern = "api-reverse.yourdomain.com", zone_name = "yourdomain.com" }
]
```

## 使用說明

1. 訪問你的 Worker URL
2. 在左側輸入圖片描述（Prompt）
3. 選擇圖片尺寸和創造性參數
4. 點擊「生成圖片並分析 API」
5. 查看四個標籤頁：
   - **生成圖片**：顯示生成的圖片
   - **API 資訊**：狀態碼、響應時間等
   - **請求內容**：完整的 API 請求 JSON
   - **響應內容**：完整的 API 響應 JSON

## 技術架構

- **Runtime**: Cloudflare Workers (Edge Computing)
- **API**: Gemini 3 Pro Image Preview
- **UI**: 純 HTML/CSS/JavaScript（無框架）
- **部署**: 全球 CDN 分發

## 進階功能

### 添加速率限制
```javascript
// 在 worker.js 的 fetch 函數中添加
const RATE_LIMIT = 10; // 每分鐘 10 次請求
```

### 添加請求日誌
```javascript
console.log('Request:', {
  timestamp: new Date().toISOString(),
  prompt: prompt,
  imageSize: imageSize
});
```

### 環境變數配置
在 Cloudflare Dashboard 添加環境變數：
- `API_KEY`: API 認證密鑰
- `API_ENDPOINT`: 自定義 API 端點

## 故障排除

### 部署失敗
```bash
# 檢查配置
wrangler whoami

# 清除快取重新部署
wrangler deploy --force
```

### CORS 錯誤
已在 Worker 中配置 CORS 頭，如果仍有問題，檢查目標 API 的 CORS 設定。

### 圖片未顯示
檢查 API 響應結構，可能需要修改 `displayResults` 函數中的圖片 URL 提取邏輯。

## 安全建議

1. ⚠️ 不要在前端代碼中硬編碼 API Key
2. ⚠️ 使用環境變數存儲敏感信息
3. ⚠️ 考慮添加 IP 白名單或速率限制
4. ⚠️ 定期檢查 API 使用量和費用

## License
MIT License
