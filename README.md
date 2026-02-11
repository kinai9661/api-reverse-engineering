# 🔧 API 逆向工程輸出站 v3.0

<div align="center">

![Version](https://img.shields.io/badge/version-3.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![OpenAI](https://img.shields.io/badge/OpenAI-Compatible-orange.svg)
![Cloudflare](https://img.shields.io/badge/Cloudflare-Workers-yellow.svg)

**完整的 AI 內容生成 API | 支持圖片 & 視頻生成 | 兼容 OpenAI SDK**

[快速開始](#-快速開始) • [API 文檔](#-api-端點) • [使用示例](#-使用示例) • [部署指南](#-部署)

</div>

---

## 🆕 版本 3.0 新特性

### 🎬 視頻生成功能
- ✅ **OpenAI 兼容的視頻生成 API**
- ✅ **支持自定義時長、解析度、寬高比**
- ✅ **任務狀態查詢**
- ✅ **Web UI 視頻生成界面**

### 🖼️ 圖片生成增強
- ✅ 多種尺寸支持（1K/2K/4K/FHD）
- ✅ Base64 和 URL 響應格式
- ✅ 實時預覽

---

## 📋 目錄

- [功能特性](#-功能特性)
- [快速開始](#-快速開始)
- [API 端點](#-api-端點)
- [使用示例](#-使用示例)
- [Web UI](#-web-ui)
- [部署](#-部署)
- [配置](#-配置)
- [測試](#-測試)
- [文檔](#-文檔)
- [貢獻](#-貢獻)
- [License](#-license)

---

## ✨ 功能特性

### 🎯 核心功能

- ✅ **OpenAI SDK 兼容** - 完全兼容 OpenAI 圖片和視頻生成 API
- ✅ **視頻生成** - Text-to-Video，支持多種參數配置
- ✅ **圖片生成** - Text-to-Image，高質量輸出
- ✅ **API Key 驗證** - 可選的安全保護（開發/生產模式）
- ✅ **Web UI 界面** - 美觀的多標籤頁界面
- ✅ **任務狀態查詢** - 實時查詢視頻生成進度
- ✅ **完整 API 分析** - 實時查看請求/響應內容
- ✅ **CORS 支持** - 跨域資源共享，方便前端集成
- ✅ **邊緣計算** - Cloudflare Workers，全球低延遲

---

## 🚀 快速開始

### 30 秒部署

```bash
# 1. 克隆倉庫
git clone https://github.com/kinai9661/api-reverse-engineering.git
cd api-reverse-engineering

# 2. 登入 Cloudflare
wrangler login

# 3. 部署
wrangler deploy worker.js

# 4. 訪問你的 API
# https://api-reverse-engineering.你的帳號.workers.dev
```

就是這麼簡單！🎉

---

## 📊 API 端點

| 端點 | 方法 | 功能 | 狀態 |
|------|------|------|------|
| `/` | GET | Web UI 界面 | ✅ |
| `/v1/models` | GET | 列出可用模型 | ✅ |
| `/v1/images/generations` | POST | OpenAI 兼容圖片生成 | ✅ |
| `/v1/videos/generations` | POST | OpenAI 兼容視頻生成 ⭐ | ✅ 新增 |
| `/v1/videos/{task_id}` | GET | 查詢視頻任務狀態 ⭐ | ✅ 新增 |
| `/api/generate` | POST | 直接圖片 API（含分析） | ✅ |
| `/api/text2video` | POST | 直接視頻 API（含分析） ⭐ | ✅ 新增 |
| `/api/verify-key` | POST | 驗證 API Key | ✅ |

**總計**: 8 個端點

---

## 💻 使用示例

### 🖼️ 圖片生成

#### Python (OpenAI SDK)

```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-your-api-key",  # 如果啟用了驗證
    base_url="https://your-worker.workers.dev/v1"
)

# 生成圖片
response = client.images.generate(
    prompt="A serene mountain landscape at sunset with vibrant colors",
    size="1024x1024",
    response_format="url"
)

print(response.data[0].url)
```

#### JavaScript / Node.js

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'sk-your-api-key',
  baseURL: 'https://your-worker.workers.dev/v1',
});

const response = await client.images.generate({
  prompt: 'A serene mountain landscape at sunset',
  size: '1024x1024',
});

console.log(response.data[0].url);
```

#### cURL

```bash
curl https://your-worker.workers.dev/v1/images/generations \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A beautiful sunset over mountains",
    "size": "1024x1024"
  }'
```

---

### 🎬 視頻生成（新功能）⭐

#### Python (OpenAI SDK)

```python
from openai import OpenAI
import time

client = OpenAI(
    api_key="sk-your-api-key",
    base_url="https://your-worker.workers.dev/v1"
)

# 創建視頻任務
response = client.videos.generate(
    model="text2video-1",
    prompt="A time-lapse of clouds moving across a blue sky",
    duration=5,
    size="1920x1080"
)

print(f"Task ID: {response.id}")
print(f"Status: {response.status}")

# 查詢任務狀態
task_id = response.id
while True:
    status = client.videos.retrieve(task_id)
    print(f"Current status: {status.status}")

    if status.status == "completed":
        print(f"Video URL: {status.data[0].url}")
        break

    time.sleep(5)  # 等待 5 秒後重試
```

#### JavaScript / Node.js

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'sk-your-api-key',
  baseURL: 'https://your-worker.workers.dev/v1',
});

// 創建視頻任務
const response = await client.videos.generate({
  model: 'text2video-1',
  prompt: 'A time-lapse of clouds moving across a blue sky',
  duration: 5,
  size: '1920x1080',
});

console.log('Task ID:', response.id);
console.log('Status:', response.status);

// 查詢狀態
const status = await client.videos.retrieve(response.id);
if (status.data) {
  console.log('Video URL:', status.data[0].url);
}
```

#### cURL

```bash
# 創建視頻任務
curl https://your-worker.workers.dev/v1/videos/generations \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A beautiful ocean wave crashing on the shore",
    "duration": 5,
    "size": "1920x1080"
  }'

# 查詢任務狀態
curl https://your-worker.workers.dev/v1/videos/task_abc123 \
  -H "Authorization: Bearer sk-your-api-key"
```

---

## 🌐 Web UI

訪問 Worker URL 使用圖形界面：

```
https://your-worker.workers.dev
```

### 界面功能

#### 1️⃣ 🖼️ 圖片生成標籤頁
- Prompt 輸入框
- 尺寸選擇（1024x1024, 2048x2048, 4096x4096, 1920x1080）
- 格式選擇（URL / Base64）
- 實時圖片預覽
- 生成按鈕

#### 2️⃣ 🎬 視頻生成標籤頁 ⭐ 新增
- Prompt 輸入框
- 時長選擇（3/5/10/15 秒）
- 解析度選擇（720p/1080p/2K/4K）
- 寬高比選擇（16:9/9:16/1:1/4:3）
- 任務狀態顯示（處理中/已完成）
- 視頻播放器
- 生成按鈕

#### 3️⃣ 📡 API 測試標籤頁
- 完整 API 端點列表
- 請求格式示例
- 使用說明

#### 通用功能
- 🔐 API Key 輸入和實時驗證
- 💾 LocalStorage 自動保存 API Key
- 🎨 美觀的漸變設計
- 📱 響應式布局

---

## 🔧 部署

### 方式 1: 基本部署（無驗證）

適合本地開發、演示、內部使用。

```bash
# 直接部署
wrangler deploy worker.js

# 測試
curl https://your-worker.workers.dev/v1/models
```

---

### 方式 2: 生產部署（啟用驗證）

適合生產環境、付費服務、公開 API。

```bash
# 1. 生成 API Key
openssl rand -base64 32

# 2. 設置 Secret
wrangler secret put API_KEY
# 輸入你的 API Key

# 3. 部署
wrangler deploy worker.js

# 4. 測試（需要 API Key）
curl https://your-worker.workers.dev/v1/models \
  -H "Authorization: Bearer sk-your-api-key"
```

---

### 本地開發

```bash
# 啟動本地開發服務器
wrangler dev worker.js

# 訪問
# http://localhost:8787

# 在另一個終端測試
curl http://localhost:8787/v1/models
```

---

## ⚙️ 配置

### wrangler.toml

```toml
name = "api-reverse-engineering"
main = "worker.js"
compatibility_date = "2024-01-01"

# API Key 配置（可選）
# 使用 Secrets 設置（推薦）:
#   wrangler secret put API_KEY
```

### API Key 傳遞方式

客戶端可以通過以下 3 種方式傳遞 API Key：

#### 1. Authorization Header（推薦）

```bash
curl -H "Authorization: Bearer sk-your-api-key" ...
```

```python
client = OpenAI(api_key="sk-your-api-key", ...)
```

#### 2. X-API-Key Header

```bash
curl -H "X-API-Key: sk-your-api-key" ...
```

```javascript
fetch(url, {
  headers: { 'X-API-Key': 'sk-your-api-key' }
});
```

#### 3. Query Parameter

```bash
curl "https://your-worker.workers.dev/v1/models?api_key=sk-your-api-key"
```

⚠️ **不推薦用於生產環境**（URL 可能被日誌記錄）

---

## 🧪 測試

### 本地測試

```bash
# 啟動本地開發服務器
wrangler dev worker.js

# 在另一個終端運行測試
python3 test_video_api.py
# 或
node test_video_api.js
```

### 測試腳本

#### Python 測試

```bash
python3 test_video_api.py
```

測試內容：
- ✅ 模型列表
- ✅ 圖片生成
- ✅ 視頻生成
- ✅ 視頻狀態查詢
- ✅ 直接視頻 API

#### Node.js 測試

```bash
node test_video_api.js
```

---

## 📚 文檔

| 文檔 | 說明 |
|------|------|
| [VIDEO_API_GUIDE.md](VIDEO_API_GUIDE.md) | 視頻 API 詳細指南 ⭐ |
| [VIDEO_INTEGRATION_PLAN.md](VIDEO_INTEGRATION_PLAN.md) | 視頻集成方案 |
| [QUICK_START.md](QUICK_START.md) | 快速開始指南 |
| [API_KEY_GUIDE.md](API_KEY_GUIDE.md) | API Key 配置指南 |
| [WRANGLER_CONFIG_GUIDE.md](WRANGLER_CONFIG_GUIDE.md) | Wrangler 配置 |
| [DEPLOYMENT_FIX.md](DEPLOYMENT_FIX.md) | 部署故障排除 |
| [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) | 實現總結 |

---

## 🎯 使用場景

### 圖片生成
- 🎨 **創意設計** - 藝術創作、概念設計
- 📱 **社交媒體** - 內容創作、營銷素材
- 🛍️ **電商** - 產品展示、廣告圖
- 📊 **數據可視化** - 圖表生成、信息圖

### 視頻生成 ⭐ 新增
- 🎬 **短視頻創作** - TikTok、YouTube Shorts
- 📺 **廣告素材** - 營銷視頻、產品宣傳
- 🎓 **教育內容** - 教學視頻、演示動畫
- 🎮 **遊戲開發** - 場景預覽、概念視頻
- 📱 **社交媒體** - Story、Reels 內容

---

## 📊 功能對比

| 功能 | v2.0 | v3.0 |
|------|------|------|
| 圖片生成 | ✅ | ✅ |
| 視頻生成 | ❌ | ✅ 新增 |
| OpenAI 兼容 | 圖片 | 圖片 + 視頻 |
| 任務查詢 | ❌ | ✅ |
| Web UI 標籤頁 | 2 | 3 |
| API 端點 | 5 | 8 |
| 測試腳本 | 2 | 4 |
| 文檔數量 | 15+ | 20+ |

---

## 🛠️ 開發

### 項目結構

```
api-reverse-engineering/
├── worker.js                      # 主代碼（圖片 + 視頻）
├── wrangler.toml                  # Cloudflare 配置
├── package.json                   # NPM 配置
├── README.md                      # 本文件
├── .gitignore                     # Git 忽略文件
├── LICENSE                        # MIT License
├── docs/                          # 文檔目錄
│   ├── VIDEO_API_GUIDE.md        # 視頻 API 指南 ⭐
│   ├── VIDEO_INTEGRATION_PLAN.md
│   ├── QUICK_START.md
│   ├── API_KEY_GUIDE.md
│   └── ...
└── tests/                         # 測試文件
    ├── test_video_api.py         # 視頻測試 ⭐
    ├── test_video_api.js         # 視頻測試 ⭐
    ├── test_api.py
    └── test_api.js
```

---

## 🤝 貢獻

歡迎貢獻！請遵循以下步驟：

1. Fork 本倉庫
2. 創建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 開啟 Pull Request

詳見 [CONTRIBUTING.md](CONTRIBUTING.md)

---

## 📞 支持

### 獲取幫助

- 📖 查看 [文檔](#-文檔)
- 🐛 提交 [Issue](https://github.com/kinai9661/api-reverse-engineering/issues)
- 💬 參與 [Discussions](https://github.com/kinai9661/api-reverse-engineering/discussions)

### 常見問題

#### Q: 如何啟用 API Key 驗證？
A: 運行 `wrangler secret put API_KEY` 並設置你的密鑰。

#### Q: 支持哪些圖片尺寸？
A: 支持 1024x1024、2048x2048、4096x4096、1920x1080。

#### Q: 視頻生成需要多長時間？
A: 通常需要 30-120 秒，取決於參數和負載。

#### Q: 如何查詢視頻生成狀態？
A: 使用 `GET /v1/videos/{task_id}` 端點或 `client.videos.retrieve(task_id)`。

---

## 📄 License

本項目採用 MIT License - 詳見 [LICENSE](LICENSE) 文件。

---

## 🙏 致謝

- [Cloudflare Workers](https://workers.cloudflare.com/) - 邊緣計算平台
- [OpenAI](https://openai.com/) - API 格式參考
- [Pollinations AI](https://pollinations.ai/) - 圖片生成服務
- [AppMedo](https://appmedo.com/) - 視頻生成服務

---

## 📈 統計

![GitHub stars](https://img.shields.io/github/stars/kinai9661/api-reverse-engineering?style=social)
![GitHub forks](https://img.shields.io/github/forks/kinai9661/api-reverse-engineering?style=social)
![GitHub issues](https://img.shields.io/github/issues/kinai9661/api-reverse-engineering)
![GitHub pull requests](https://img.shields.io/github/issues-pr/kinai9661/api-reverse-engineering)

---

<div align="center">

**⭐ 如果這個項目對你有幫助，請給一個 Star！⭐**

Made with ❤️ by [kinai9661](https://github.com/kinai9661)

[⬆ 返回頂部](#-api-逆向工程輸出站-v30)

</div>
