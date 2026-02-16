# API 逆向工程輸出站 - OpenAI Compatible / OpenAI Compatible API Gateway

[English](#english) | [中文](#中文)

---

<a name="中文"></a>
## 中文文檔

## 🎉 功能特性

### ✅ Web UI
- 完整的圖片生成界面
- 實時 API 請求/響應分析
- 支持多種圖片尺寸
- 溫度參數調節
- **新增**：品質、風格、種子、Top-P、Top-K 等高級參數

### ✅ OpenAI Compatible API
- **POST** `/v1/images/generations` - 圖片生成
- **GET** `/v1/models` - 模型列表
- 完全兼容 OpenAI SDK
- 支持 Base64 和 URL 響應格式
- **新增**：支持更多參數（quality, style, seed, temperature, top_p, top_k, negative_prompt）

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

# 基本使用
response = client.images.generate(
    prompt="A beautiful sunset",
    size="1024x1024"
)

# 高級參數
response = client.images.generate(
    prompt="A beautiful sunset over mountains",
    size="1024x1024",
    quality="hd",           # "standard" 或 "hd"
    style="vivid",          # "vivid" 或 "natural"
    n=1,                    # 生成圖片數量 (1-4)
    extra_body={
        "seed": 12345,      # 隨機種子
        "temperature": 0.8, # 溫度 (0.0-2.0)
        "top_p": 0.9,       # Top-P (0.0-1.0)
        "top_k": 40,        # Top-K (1-100)
        "negative_prompt": "blurry, low quality"  # 負面提示
    }
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

## 📝 支持的參數

### OpenAI 標準參數

| 參數 | 類型 | 默認值 | 描述 |
|------|------|--------|------|
| `prompt` | string | 必填 | 圖片描述提示詞 |
| `size` | string | "1024x1024" | 圖片尺寸 |
| `n` | integer | 1 | 生成圖片數量 (1-4) |
| `quality` | string | "standard" | 圖片品質 ("standard", "hd") |
| `style` | string | "vivid" | 圖片風格 ("vivid", "natural") |

### 擴展參數（通過 extra_body）

| 參數 | 類型 | 範圍 | 描述 |
|------|------|------|------|
| `seed` | integer | 任意整數 | 隨機種子，用於可重現生成 |
| `temperature` | float | 0.0-2.0 | 控制隨機性，越高越隨機 |
| `top_p` | float | 0.0-1.0 | 核採樣參數 |
| `top_k` | integer | 1-100 | Top-K 採樣參數 |
| `negative_prompt` | string | - | 負面提示詞，排除不想要的元素 |

### 支持的圖片尺寸

| OpenAI 格式 | Gemini 格式 |
|-------------|-------------|
| 256x256 | 256px |
| 512x512 | 512px |
| 1024x1024 | 1K |
| 1792x1024 | 1792x1024 |
| 1024x1792 | 1024x1792 |
| 2048x2048 | 2K |
| 4096x4096 | 4K |

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
6. **高級參數**: 支持種子、溫度、Top-P/K 等參數

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

---

<a name="english"></a>
## English Documentation

## 🎉 Features

### ✅ Web UI
- Complete image generation interface
- Real-time API request/response analysis
- Support for multiple image sizes
- Temperature parameter adjustment
- **New**: Quality, style, seed, Top-P, Top-K and other advanced parameters

### ✅ OpenAI Compatible API
- **POST** `/v1/images/generations` - Image generation
- **GET** `/v1/models` - Model list
- Fully compatible with OpenAI SDK
- Support for Base64 and URL response formats
- **New**: Support for more parameters (quality, style, seed, temperature, top_p, top_k, negative_prompt)

### ✅ REST API
- **POST** `/api/generate` - Original API (with full response)
- Detailed request/response analysis
- Error tracking and debugging information

## 🚀 Quick Start

### Deploy to Cloudflare Workers

```bash
# 1. Install Wrangler
npm install -g wrangler

# 2. Login
wrangler login

# 3. Deploy
wrangler deploy worker.js --name api-reverse-engineering
```

### Using OpenAI SDK

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://your-worker.workers.dev/v1"
)

# Basic usage
response = client.images.generate(
    prompt="A beautiful sunset",
    size="1024x1024"
)

# Advanced parameters
response = client.images.generate(
    prompt="A beautiful sunset over mountains",
    size="1024x1024",
    quality="hd",           # "standard" or "hd"
    style="vivid",          # "vivid" or "natural"
    n=1,                    # Number of images (1-4)
    extra_body={
        "seed": 12345,      # Random seed
        "temperature": 0.8, # Temperature (0.0-2.0)
        "top_p": 0.9,       # Top-P (0.0-1.0)
        "top_k": 40,        # Top-K (1-100)
        "negative_prompt": "blurry, low quality"  # Negative prompt
    }
)

image = response.data[0].b64_json
```

### Using Web UI

Visit: `https://your-worker.workers.dev`

## 📚 Documentation

For detailed documentation, see: `OPENAI_API_DOCS.md`

## 🔌 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Web UI interface |
| `/v1/images/generations` | POST | OpenAI compatible image generation |
| `/v1/models` | GET | Available models list |
| `/api/generate` | POST | Original API (with details) |

## 📝 Supported Parameters

### OpenAI Standard Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `prompt` | string | Required | Image description prompt |
| `size` | string | "1024x1024" | Image size |
| `n` | integer | 1 | Number of images to generate (1-4) |
| `quality` | string | "standard" | Image quality ("standard", "hd") |
| `style` | string | "vivid" | Image style ("vivid", "natural") |

### Extended Parameters (via extra_body)

| Parameter | Type | Range | Description |
|-----------|------|-------|-------------|
| `seed` | integer | Any integer | Random seed for reproducible generation |
| `temperature` | float | 0.0-2.0 | Controls randomness, higher = more random |
| `top_p` | float | 0.0-1.0 | Nucleus sampling parameter |
| `top_k` | integer | 1-100 | Top-K sampling parameter |
| `negative_prompt` | string | - | Negative prompt to exclude unwanted elements |

### Supported Image Sizes

| OpenAI Format | Gemini Format |
|---------------|---------------|
| 256x256 | 256px |
| 512x512 | 512px |
| 1024x1024 | 1K |
| 1792x1024 | 1792x1024 |
| 1024x1792 | 1024x1792 |
| 2048x2048 | 2K |
| 4096x4096 | 4K |

## 🎯 Use Cases

- ✅ Replace OpenAI DALL-E API
- ✅ Integrate into existing applications
- ✅ API testing and debugging
- ✅ Image generation automation

## 📊 Response Format

### OpenAI Format
```json
{
  "created": 1677610602,
  "data": [{
    "b64_json": "..."
  }]
}
```

### Original Format (Detailed)
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

## 🌟 Key Features

1. **Multi-endpoint Support**: Web UI + OpenAI API + REST API
2. **Full Transparency**: View all request/response details
3. **Easy Integration**: Compatible with OpenAI SDK
4. **Zero Configuration**: Works out of the box
5. **Global Distribution**: Cloudflare Edge Network
6. **Advanced Parameters**: Support for seed, temperature, Top-P/K, etc.

## 🛠️ Tech Stack

- **Runtime**: Cloudflare Workers
- **API**: Gemini 3 Pro Image Preview
- **Compatibility**: OpenAI Images API v1
- **Frontend**: Vanilla HTML/CSS/JavaScript

## 📈 Performance

- **Global Latency**: < 50ms (Cloudflare CDN)
- **Image Generation**: 1-5 seconds
- **Concurrency**: High (Workers scaling)
- **Availability**: 99.9%+

## 🔐 Security

This version doesn't require an API Key. You can add authentication in the Worker:

```javascript
const API_KEY = env.API_KEY;
if (request.headers.get("Authorization") !== `Bearer ${API_KEY}`) {
  return unauthorized();
}
```

## 📞 Support

- See `OPENAI_API_DOCS.md` for detailed documentation
- Check Worker logs for debugging
- Refer to OpenAI official documentation

## 📄 License

MIT License
