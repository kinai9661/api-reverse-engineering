# API 逆向工程輸出站 - OpenAI Compatible

## 🎉 功能特性

### ✅ Web UI
- 完整的圖片生成界面
- 實時 API 請求/響應分析
- 支持多種圖片尺寸
- 溫度參數調節

### ✅ OpenAI Compatible API
- **POST** `/v1/images/generations` - 圖片生成
- **GET** `/v1/models` - 模型列表
- 完全兼容 OpenAI SDK
- 支持 Base64 和 URL 響應格式

### ✅ REST API
- **POST** `/api/generate` - 原始 API（含完整響應）
- 詳細的請求/響應分析
- 錯誤追蹤和調試信息

## 🚀 快速開始

### 部署到 Cloudflare Workers

```bash
# 1. 安裝 Wrangler
npm install -g wrangler

# 2. 登入
wrangler login

# 3. 部署
wrangler deploy worker.js --name api-reverse-engineering
```

### 使用 OpenAI SDK

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://your-worker.workers.dev/v1"
)

response = client.images.generate(
    prompt="A beautiful sunset",
    size="1024x1024"
)

image = response.data[0].b64_json
```

### 使用 Web UI

訪問: `https://your-worker.workers.dev`

## 📚 文檔

詳細文檔請參見: `OPENAI_API_DOCS.md`

## 🔌 API 端點

| 端點 | 方法 | 描述 |
|------|------|------|
| `/` | GET | Web UI 界面 |
| `/v1/images/generations` | POST | OpenAI 兼容圖片生成 |
| `/v1/models` | GET | 可用模型列表 |
| `/api/generate` | POST | 原始 API（含詳細信息）|

## 🎯 使用場景

- ✅ 替換 OpenAI DALL-E API
- ✅ 集成到現有應用
- ✅ API 測試和調試
- ✅ 圖片生成自動化

## 📊 響應格式

### OpenAI 格式
```json
{
  "created": 1677610602,
  "data": [{
    "b64_json": "..."
  }]
}
```

### 原始格式（詳細）
```json
{
  "success": true,
  "status": 200,
  "duration": 1234,
  "imageData": "data:image/jpeg;base64,...",
  "request": {...},
  "response": {...}
}
```

## 🌟 特色功能

1. **多端點支持**: Web UI + OpenAI API + REST API
2. **完整透明**: 查看所有請求/響應細節
3. **易於集成**: 兼容 OpenAI SDK
4. **無需配置**: 開箱即用
5. **全球分發**: Cloudflare Edge Network

## 🛠️ 技術棧

- **Runtime**: Cloudflare Workers
- **API**: Gemini 3 Pro Image Preview
- **兼容性**: OpenAI Images API v1
- **前端**: 原生 HTML/CSS/JavaScript

## 📈 性能

- **全球延遲**: < 50ms（Cloudflare CDN）
- **圖片生成**: 1-5 秒
- **並發支持**: 高（Workers 擴展）
- **可用性**: 99.9%+

## 🔐 安全性

當前版本無需 API Key，可在 Worker 中添加認證：

```javascript
const API_KEY = env.API_KEY;
if (request.headers.get("Authorization") !== `Bearer ${API_KEY}`) {
  return unauthorized();
}
```

## 📞 支持

- 查看 `OPENAI_API_DOCS.md` 獲取詳細文檔
- 檢查 Worker 日誌進行調試
- 參考 OpenAI 官方文檔

## 📄 License

MIT License
