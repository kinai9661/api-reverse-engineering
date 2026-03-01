# API 逆向工程輸出站 - OpenAI Compatible / OpenAI Compatible API Gateway

[English](#english) | [中文](#中文)

---

<a name="中文"></a>
## 中文文檔

## 📋 最新更新

### v2.2.0 (2026-03-01)
- ✨ **新增多上游負載平衡（故障轉移機制）**
- 新增 `UPSTREAMS` 配置支援多個 API 上游
- 新增 `fetchWithFallback()` 自動故障轉移函數
- 新增 `/api/upstreams` 端點查看上游狀態
- 支援 AppMedo（主要）+ Supabase（備用）雙上游
- 連續 3 次錯誤後自動切換到備用上游
- 響應中新增 `upstream` 欄位顯示使用的上游
- 🔧 **智能路由：按優先級自動選擇可用上游**

### v2.1.0 (2026-02-28)
- ✨ **新增官方 Gemini 3.1 Flash API 格式支援**
- 新增 `aspectRatio: "21:9"` 寬螢幕比例
- 新增 `personGeneration` 人物生成控制（allow_all, allow_adult, dont_allow）
- 新增 `outputMimeType` 輸出格式（image/png, image/jpeg, image/webp）
- 新增 `numberOfImages` 映射到 `imageConfig` 內
- `seed` 參數移至 `imageConfig` 內（符合官方格式）
- 🔧 **預設模型更改為 `gemini-3.1-flash-image-preview`**
- 📝 **更新文檔說明新參數使用方式**

### v2.0.0 (2026-02-27)
- ✨ 新增多模型支援（MODEL_REGISTRY）
- ✨ 新增 Web UI 模型選擇下拉選單
- ✨ 新增 Debug 模式（完整請求/響應分析）
- ✨ 新增官方 Gemini API 格式支援
- 🐛 修復圖片生成問題（空 base64 數據）

## 🎉 功能特性

### ✅ Web UI
- 完整的圖片生成界面
- 實時 API 請求/響應分析
- 支持多種圖片尺寸
- 溫度參數調節
- **新增**：模型選擇下拉選單（Gemini 3 Pro / Gemini 3.1 Flash）
- **新增**：品質、風格、種子、Top-P、Top-K 等高級參數
- **新增**：Debug 模式開關

### ✅ OpenAI Compatible API
- **POST** `/v1/images/generations` - 圖片生成
- **GET** `/v1/models` - 模型列表
- **GET** `/v1/models/{model_id}` - 單一模型資訊
- 完全兼容 OpenAI SDK
- 支持 Base64 和 URL 響應格式
- **新增**：支援多模型選擇（gemini-3-pro-image-preview, gemini-3.1-flash-image-preview）
- **新增**：支持更多參數（quality, style, seed, temperature, top_p, top_k, negative_prompt）
- **新增**：官方 Gemini 3.1 Flash 格式參數（personGeneration, outputMimeType, aspectRatio）

### ✅ REST API
- **POST** `/api/generate` - 原始 API（含完整響應）
- **GET** `/api/models` - 完整模型配置列表（供 Web UI 使用）
- **GET** `/api/upstreams` - 上游狀態檢查（負載平衡監控）
- 詳細的請求/響應分析
- 錯誤追蹤和調試信息

### ✅ 負載平衡（Load Balancing）
- **多上游支援**：AppMedo（主要）+ Supabase（備用）
- **自動故障轉移**：連續 3 次錯誤後自動切換
- **智能路由**：按優先級選擇可用上游
- **狀態追蹤**：即時監控上游健康狀態

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
| `/v1/models/{model_id}` | GET | 單一模型詳細資訊 |
| `/api/generate` | POST | 原始 API（含詳細信息）|
| `/api/models` | GET | 完整模型配置（供 Web UI 使用）|
| `/api/verify-key` | POST | API Key 驗證（返回可用模型）|

## 🤖 支持的模型

| 模型 ID | 名稱 | 別名 | 描述 |
|---------|------|------|------|
| `gemini-3.1-pro-preview` | Gemini 3.1 Pro Preview | `gemini-3.1-pro`, `gemini-3.1` | Google Gemini 3.1 Pro 圖片生成模型（預覽版）**（預設）**|
| `gemini-3-pro-image-preview` | Gemini 3 Pro Image Preview | `gemini-3-pro`, `gemini-3-image` | Google Gemini 3 Pro 圖片生成模型（預覽版）|

### 使用不同模型

```python
# 使用 gemini-3.1-flash-image-preview 模型（預設）
response = client.images.generate(
    prompt="A beautiful sunset",
    model="gemini-3.1-flash-image-preview",  # 或使用別名 "gemini-3.1-flash"
    size="1024x1024"
)

# 使用 gemini-3-pro-image-preview 模型
response = client.images.generate(
    prompt="A beautiful sunset",
    model="gemini-3-pro-image-preview", # 或使用別名 "gemini-3-pro"
    size="1024x1024"
)
```

## 📝 支持的參數

### OpenAI 標準參數

| 參數 | 類型 | 默認值 | 描述 |
|------|------|--------|------|
| `prompt` | string | 必填 | 圖片描述提示詞 |
| `model` | string | "gemini-3-pro-image-preview" | 使用的模型 ID 或別名 |
| `size` | string | "1024x1024" | 圖片尺寸 |
| `n` | integer | 1 | 生成圖片數量 (1-10) |
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
| `useOfficialFormat` | boolean | true/false | 使用官方 Gemini API 格式（預設 false） |
| `debug` | boolean | true/false | Debug 模式，返回完整請求/響應資訊（預設 false） |

### 官方 Gemini 3.1 Flash 新參數

以下參數僅在 `useOfficialFormat: true` 時生效，符合官方 Gemini 3.1 Flash API 格式：

| 參數 | 類型 | 可選值 | 描述 |
|------|------|--------|------|
| `personGeneration` | string | "allow_all", "allow_adult", "dont_allow" | 控制人物生成 |
| `outputMimeType` | string | "image/png", "image/jpeg", "image/webp" | 輸出圖片格式 |
| `aspectRatio` | string | "1:1", "16:9", "9:16", "21:9" | 直接指定寬高比（優先於 size 映射） |

**使用範例：**
```python
# 使用官方 Gemini 3.1 Flash 格式
response = client.images.generate(
    model="gemini-3.1-flash-image-preview",
    prompt="A cyberpunk street vendor selling futuristic ramen",
    size="2048x2048",
    n=2,  # 生成 2 張圖片
    extra_body={
        "useOfficialFormat": True,
        "personGeneration": "allow_adult",
        "outputMimeType": "image/jpeg",
        "aspectRatio": "21:9",
        "seed": 8888888
    }
)
```

### Debug 模式

當 `debug: true` 時，API 將返回完整的請求和響應資訊，方便診斷問題：

**使用範例：**
```python
# 使用 Debug 模式診斷問題
response = client.images.generate(
    model="gemini-3-pro-image-preview",
    prompt="a beautiful sunset",
    size="1024x1024",
    extra_body={
        "debug": True
    }
)
print(response)  # 將顯示完整的請求和響應資訊
```

**Debug 模式輸出包含：**
- `request.url` - API 端點 URL
- `request.body` - 發送的完整請求內容
- `response.status` - HTTP 狀態碼
- `response.body` - API 返回的完整響應
- `params` - 解析後的參數資訊

### 官方 Gemini API 格式說明

當 `useOfficialFormat: true` 時，請求將使用官方 Gemini API 格式：

**官方格式特性：**
- ✅ `responseModalities`: ["TEXT", "IMAGE"] - 支援文字和圖片輸出
- ✅ `imageConfig.aspectRatio` - 寬高比設定（1:1, 16:9, 9:16, **21:9**）
- ✅ `imageConfig.imageSize` - 圖片尺寸（256px, 512px, 1K, 2K, 4K）
- ✅ `imageConfig.numberOfImages` - 生成圖片數量（映射自 `n` 參數）
- ✅ `imageConfig.personGeneration` - 人物生成控制（allow_all, allow_adult, dont_allow）
- ✅ `imageConfig.outputMimeType` - 輸出格式（image/png, image/jpeg, image/webp）
- ✅ `imageConfig.seed` - 隨機種子（放在 imageConfig 內）
- ✅ `safetySettings` - 關閉所有內容過濾（BLOCK_NONE）

**使用範例：**
```python
# 使用官方格式
response = client.images.generate(
    model="gemini-3-pro-image-preview",
    prompt="a beautiful sunset",
    size="1024x1024",
    extra_body={
        "useOfficialFormat": True
    }
)

# 使用完整官方 Gemini 3.1 Flash 格式
response = client.images.generate(
    model="gemini-3.1-flash-image-preview",
    prompt="A cyberpunk street vendor selling futuristic ramen",
    size="2048x2048",
    n=2,
    extra_body={
        "useOfficialFormat": True,
        "aspectRatio": "21:9",
        "personGeneration": "allow_adult",
        "outputMimeType": "image/jpeg",
        "seed": 8888888
    }
)
```

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

## 📋 Latest Updates

### v2.1.0 (2026-02-28)
- ✨ **Added official Gemini 3.1 Flash API format support**
  - Added `aspectRatio: "21:9"` widescreen ratio
  - Added `personGeneration` control (allow_all, allow_adult, dont_allow)
  - Added `outputMimeType` output format (image/png, image/jpeg, image/webp)
  - Added `numberOfImages` mapping to `imageConfig`
  - `seed` parameter moved inside `imageConfig` (official format)
- 🔧 **Default model changed to `gemini-3.1-flash-image-preview`**
- 📝 **Updated documentation for new parameters**

### v2.0.0 (2026-02-27)
- ✨ Added multi-model support (MODEL_REGISTRY)
- ✨ Added Web UI model selection dropdown
- ✨ Added Debug mode (full request/response analysis)
- ✨ Added official Gemini API format support
- 🐛 Fixed image generation issue (empty base64 data)

## 🎉 Features

### ✅ Web UI
- Complete image generation interface
- Real-time API request/response analysis
- Support for multiple image sizes
- Temperature parameter adjustment
- **New**: Model selection dropdown (Gemini 3 Pro / Gemini 3.1 Flash)
- **New**: Quality, style, seed, Top-P, Top-K and other advanced parameters
- **New**: Debug mode switch

### ✅ OpenAI Compatible API
- **POST** `/v1/images/generations` - Image generation
- **GET** `/v1/models` - Model list
- **GET** `/v1/models/{model_id}` - Single model details
- Fully compatible with OpenAI SDK
- Support for Base64 and URL response formats
- **New**: Multi-model support (gemini-3-pro-image-preview, gemini-3.1-flash-image-preview)
- **New**: Support for more parameters (quality, style, seed, temperature, top_p, top_k, negative_prompt)
- **New**: Official Gemini 3.1 Flash format parameters (personGeneration, outputMimeType, aspectRatio)

### ✅ REST API
- **POST** `/api/generate` - Original API (with full response)
- **GET** `/api/models` - Full model configuration (for Web UI)
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
| `/v1/models/{model_id}` | GET | Single model details |
| `/api/generate` | POST | Original API (with details) |
| `/api/models` | GET | Full model configuration (for Web UI) |
| `/api/verify-key` | POST | API Key verification (returns available models) |

## 🤖 Supported Models

| Model ID | Name | Aliases | Description |
|----------|------|---------|-------------|
| `gemini-3.1-pro-preview` | Gemini 3.1 Pro Preview | `gemini-3.1-pro`, `gemini-3.1` | Google Gemini 3.1 Pro image generation model (preview) **(Default)** |
| `gemini-3-pro-image-preview` | Gemini 3 Pro Image Preview | `gemini-3-pro`, `gemini-3-image` | Google Gemini 3 Pro image generation model (preview) |

### Using Different Models

```python
# Use gemini-3.1-flash-image-preview model (default)
response = client.images.generate(
    prompt="A beautiful sunset",
    model="gemini-3.1-flash-image-preview",  # or use alias "gemini-3.1-flash"
    size="1024x1024"
)

# Use gemini-3-pro-image-preview model
response = client.images.generate(
    prompt="A beautiful sunset",
    model="gemini-3-pro-image-preview", # or use alias "gemini-3-pro"
    size="1024x1024"
)
```

## 📝 Supported Parameters

### OpenAI Standard Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `prompt` | string | Required | Image description prompt |
| `model` | string | "gemini-3.1-flash-image-preview" | Model ID or alias to use |
| `size` | string | "1024x1024" | Image size |
| `n` | integer | 1 | Number of images to generate (1-10) |
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
| `useOfficialFormat` | boolean | true/false | Use official Gemini API format (default: false) |
| `debug` | boolean | true/false | Debug mode, returns full request/response info (default: false) |

### Debug Mode

When `debug: true`, the API returns complete request and response information for troubleshooting:

**Usage Example:**
```python
# Use Debug mode to diagnose issues
response = client.images.generate(
    model="gemini-3-pro-image-preview",
    prompt="a beautiful sunset",
    size="1024x1024",
    extra_body={
        "debug": True
    }
)
print(response)  # Will show complete request and response info
```

**Debug Mode Output Includes:**
- `request.url` - API endpoint URL
- `request.body` - Complete request content sent
- `response.status` - HTTP status code
- `response.body` - Complete response from API
- `params` - Parsed parameter information

### Official Gemini API Format

When `useOfficialFormat: true`, the request uses the official Gemini API format:

**Official Format Features:**
- ✅ `responseModalities`: ["TEXT", "IMAGE"] - Supports text and image output
- ✅ `imageConfig.aspectRatio` - Aspect ratio setting (1:1, 16:9, 9:16)
- ✅ `imageConfig.imageSize` - Image size (256px, 512px, 1K, 2K, 4K)
- ✅ `safetySettings` - Disable all content filtering (BLOCK_NONE)

**Usage Example:**
```python
# Use official format
response = client.images.generate(
    model="gemini-3-pro-image-preview",
    prompt="a beautiful sunset",
    size="1024x1024",
    extra_body={
        "useOfficialFormat": True
    }
)
```

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
