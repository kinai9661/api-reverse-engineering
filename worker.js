// Cloudflare Worker - OpenAI Compatible API with Image & Video Generation
// Version 3.1.0 - 支持 Gemini 图片生成和视频生成

// ==========================================
// 配置
// ==========================================

const CONFIG = {
  // 图片生成 API (Gemini 3 Pro)
  imageAPI: 'https://api-integrations.appmedo.com/app-7r29gu4xs001/api-Xa6JZ58oPMEa/v1beta/models/gemini-3-pro-image-preview:generateContent',

  // 视频生成 API
  videoAPI: 'https://api-integrations.appmedo.com/app-7r29gu4xs001/api-6LeB8Qe4rWGY/v1/videos/text2video',

  // 允许的 CORS 源
  corsOrigin: '*',

  // API 版本
  apiVersion: '3.1.0',
};

// ==========================================
// API Key 验证
// ==========================================

function authenticateRequest(request, env) {
  // 如果没有设置 API_KEY，跳过验证
  if (!env.API_KEY) {
    return { success: true };
  }

  // 从多个来源提取 API Key
  const authHeader = request.headers.get('Authorization');
  const xApiKey = request.headers.get('X-API-Key');
  const url = new URL(request.url);
  const queryApiKey = url.searchParams.get('api_key');

  let providedKey = null;

  if (authHeader?.startsWith('Bearer ')) {
    providedKey = authHeader.substring(7);
  } else if (xApiKey) {
    providedKey = xApiKey;
  } else if (queryApiKey) {
    providedKey = queryApiKey;
  }

  if (!providedKey) {
    return {
      success: false,
      message: 'Missing API key. Please provide an API key via Authorization header, X-API-Key header, or api_key query parameter.',
    };
  }

  if (providedKey !== env.API_KEY) {
    return {
      success: false,
      message: 'Invalid API key.',
    };
  }

  return { success: true };
}

// ==========================================
// 图片生成函数 (Gemini API)
// ==========================================

async function generateImage(prompt, params = {}) {
  const {
    width = 1024,
    height = 1024,
    n = 1,
  } = params;

  // 构造 Gemini API 请求
  const requestBody = {
    contents: [{
      parts: [
        { text: prompt }
      ]
    }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageSize: determineImageSize(width, height),
    }
  };

  try {
    const response = await fetch(CONFIG.imageAPI, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Image API returned status ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    // 解析 Gemini 响应
    return parseGeminiImageResponse(data, prompt);

  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// 确定图片尺寸
function determineImageSize(width, height) {
  const total = width * height;

  if (total >= 4000 * 4000) return '4K';
  if (total >= 2000 * 2000) return '2K';
  return '1K';
}

// 解析 Gemini 图片响应
function parseGeminiImageResponse(data, prompt) {
  try {
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('No image generated');
    }

    const images = [];

    for (const candidate of data.candidates) {
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData) {
            // Base64 图片数据
            images.push({
              b64_json: part.inlineData.data,
              mime_type: part.inlineData.mimeType || 'image/png',
            });
          }
        }
      }
    }

    if (images.length === 0) {
      throw new Error('No image data in response');
    }

    return {
      success: true,
      data: images.map(img => ({
        b64_json: img.b64_json,
        revised_prompt: prompt,
        mime_type: img.mime_type,
      })),
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// ==========================================
// 视频生成函数
// ==========================================

async function generateVideo(prompt, params = {}) {
  const {
    duration = 5,
    resolution = '1920x1080',
    aspectRatio = '16:9',
    fps = 30,
  } = params;

  try {
    const response = await fetch(CONFIG.videoAPI, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: prompt,
        duration: duration,
        resolution: resolution,
        aspect_ratio: aspectRatio,
        fps: fps,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || `Video API returned status ${response.status}`);
    }

    return {
      success: true,
      data: {
        task_id: data.task_id || data.id || generateTaskId(),
        status: data.status || 'processing',
        video_url: data.video_url || data.url,
        prompt: prompt,
        duration: duration,
        resolution: resolution,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// 生成任务 ID
function generateTaskId() {
  return 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// ==========================================
// OpenAI 兼容端点处理
// ==========================================

// POST /v1/images/generations
async function handleImageGenerations(request) {
  try {
    const body = await request.json();
    const { prompt, n = 1, size = '1024x1024', response_format = 'url' } = body;

    if (!prompt) {
      return jsonResponse({
        error: {
          message: 'Missing required parameter: prompt',
          type: 'invalid_request_error',
          code: 'missing_prompt',
        },
      }, 400);
    }

    // 解析尺寸
    const [width, height] = size.split('x').map(Number);

    // 生成图片
    const result = await generateImage(prompt, { width, height, n });

    if (!result.success) {
      return jsonResponse({
        error: {
          message: result.error,
          type: 'api_error',
          code: 'image_generation_failed',
        },
      }, 500);
    }

    // OpenAI 格式响应
    const responseData = {
      created: Math.floor(Date.now() / 1000),
      data: result.data.map(img => {
        if (response_format === 'b64_json') {
          return {
            b64_json: img.b64_json,
            revised_prompt: img.revised_prompt,
          };
        } else {
          // 转换为 data URL
          const dataUrl = `data:${img.mime_type};base64,${img.b64_json}`;
          return {
            url: dataUrl,
            revised_prompt: img.revised_prompt,
          };
        }
      }),
    };

    return jsonResponse(responseData);
  } catch (error) {
    return jsonResponse({
      error: {
        message: error.message,
        type: 'api_error',
        code: 'internal_error',
      },
    }, 500);
  }
}

// POST /v1/videos/generations
async function handleVideoGenerations(request) {
  try {
    const body = await request.json();
    const {
      prompt,
      model = 'text2video-1',
      duration = 5,
      size = '1920x1080',
      response_format = 'url',
    } = body;

    if (!prompt) {
      return jsonResponse({
        error: {
          message: 'Missing required parameter: prompt',
          type: 'invalid_request_error',
          code: 'missing_prompt',
        },
      }, 400);
    }

    // 解析尺寸和宽高比
    const [width, height] = size.split('x').map(Number);
    const aspectRatio = `${width}:${height}`;

    // 生成视频
    const result = await generateVideo(prompt, {
      duration,
      resolution: size,
      aspectRatio,
    });

    if (!result.success) {
      return jsonResponse({
        error: {
          message: result.error,
          type: 'api_error',
          code: 'video_generation_failed',
        },
      }, 500);
    }

    // OpenAI 格式响应
    const responseData = {
      id: result.data.task_id,
      object: 'video.generation',
      created: Math.floor(Date.now() / 1000),
      model: model,
      status: result.data.status,
      prompt: prompt,
    };

    // 如果视频已完成，添加 URL
    if (result.data.video_url) {
      responseData.data = [
        {
          url: result.data.video_url,
          duration: result.data.duration,
          resolution: result.data.resolution,
        },
      ];
    }

    return jsonResponse(responseData);
  } catch (error) {
    return jsonResponse({
      error: {
        message: error.message,
        type: 'api_error',
        code: 'internal_error',
      },
    }, 500);
  }
}

// GET /v1/videos/{task_id}
async function handleVideoStatus(taskId) {
  try {
    // 这里应该查询实际的任务状态
    // 目前返回模拟数据
    return jsonResponse({
      id: taskId,
      object: 'video.generation',
      created: Math.floor(Date.now() / 1000),
      model: 'text2video-1',
      status: 'completed',
      data: [
        {
          url: 'https://example.com/video.mp4',
          duration: 5,
          resolution: '1920x1080',
        },
      ],
    });
  } catch (error) {
    return jsonResponse({
      error: {
        message: error.message,
        type: 'api_error',
        code: 'internal_error',
      },
    }, 500);
  }
}

// GET /v1/models
async function handleModels() {
  return jsonResponse({
    object: 'list',
    data: [
      {
        id: 'gemini-3-pro-image',
        object: 'model',
        created: 1686935002,
        owned_by: 'google',
        permission: [],
        root: 'gemini-3-pro-image',
        parent: null,
        capabilities: { image_generation: true },
      },
      {
        id: 'text2video-1',
        object: 'model',
        created: 1686935002,
        owned_by: 'appmedo',
        permission: [],
        root: 'text2video-1',
        parent: null,
        capabilities: { video_generation: true },
      },
    ],
  });
}

// ==========================================
// 直接 API 端点（含分析）
// ==========================================

// POST /api/generate (图片)
async function handleDirectImageAPI(request) {
  try {
    const body = await request.json();
    const { prompt, width = 1024, height = 1024 } = body;

    if (!prompt) {
      return jsonResponse({ error: 'Missing prompt' }, 400);
    }

    const result = await generateImage(prompt, { width, height });

    if (!result.success) {
      return jsonResponse({
        success: false,
        error: result.error,
        analysis: {
          request: { prompt, width, height },
        },
      }, 500);
    }

    // 转换为 data URL
    const imageData = result.data[0];
    const dataUrl = `data:${imageData.mime_type};base64,${imageData.b64_json}`;

    return jsonResponse({
      success: true,
      prompt: prompt,
      image_url: dataUrl,
      mime_type: imageData.mime_type,
      analysis: {
        request: { prompt, width, height },
        response: {
          mime_type: imageData.mime_type,
          size: imageData.b64_json.length,
        },
      },
    });
  } catch (error) {
    return jsonResponse({ 
      success: false,
      error: error.message 
    }, 500);
  }
}

// POST /api/text2video (视频)
async function handleDirectVideoAPI(request) {
  try {
    const body = await request.json();
    const {
      prompt,
      duration = 5,
      resolution = '1920x1080',
      aspectRatio = '16:9',
    } = body;

    if (!prompt) {
      return jsonResponse({ error: 'Missing prompt' }, 400);
    }

    const result = await generateVideo(prompt, { duration, resolution, aspectRatio });

    return jsonResponse({
      success: result.success,
      task_id: result.data?.task_id,
      status: result.data?.status,
      video_url: result.data?.video_url,
      error: result.error,
      analysis: {
        request: { prompt, duration, resolution, aspectRatio },
        response: result.data,
      },
    });
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}

// POST /api/verify-key
async function handleVerifyKey(request, env) {
  const auth = authenticateRequest(request, env);

  if (!env.API_KEY) {
    return jsonResponse({
      valid: true,
      message: 'API key validation is disabled (development mode)',
    });
  }

  return jsonResponse({
    valid: auth.success,
    message: auth.success ? 'API key is valid' : auth.message,
  }, auth.success ? 200 : 401);
}

// ==========================================
// Web UI
// ==========================================

function handleWebUI() {
  const html = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI 內容生成 API - Gemini 圖片 & 視頻</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 { font-size: 32px; margin-bottom: 10px; }
        .header p { opacity: 0.9; }
        .version-badge {
            display: inline-block;
            background: rgba(255,255,255,0.2);
            padding: 5px 15px;
            border-radius: 15px;
            font-size: 12px;
            margin-top: 10px;
        }
        .tabs {
            display: flex;
            background: #f8f9fa;
            border-bottom: 2px solid #e9ecef;
        }
        .tab {
            flex: 1;
            padding: 20px;
            text-align: center;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s;
            border-bottom: 3px solid transparent;
        }
        .tab:hover { background: #e9ecef; }
        .tab.active {
            background: white;
            border-bottom-color: #667eea;
            color: #667eea;
        }
        .tab-content { display: none; padding: 30px; }
        .tab-content.active { display: block; }
        .api-key-section {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 30px;
        }
        .input-group {
            margin-bottom: 20px;
        }
        .input-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            color: #495057;
        }
        .input-group input, .input-group textarea, .input-group select {
            width: 100%;
            padding: 12px;
            border: 2px solid #e9ecef;
            border-radius: 8px;
            font-size: 14px;
            transition: border 0.3s;
        }
        .input-group input:focus, .input-group textarea:focus, .input-group select:focus {
            outline: none;
            border-color: #667eea;
        }
        .input-group textarea { min-height: 100px; resize: vertical; }
        .button-group {
            display: flex;
            gap: 10px;
            margin-top: 20px;
        }
        .btn {
            flex: 1;
            padding: 15px;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
        }
        .btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }
        .btn-primary:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }
        .result-section {
            margin-top: 30px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 10px;
        }
        .result-section h3 {
            margin-bottom: 15px;
            color: #495057;
        }
        .result-image, .result-video {
            width: 100%;
            max-width: 600px;
            border-radius: 10px;
            margin: 20px auto;
            display: block;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        }
        .status-indicator {
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            margin-right: 8px;
        }
        .status-valid { background: #28a745; }
        .status-invalid { background: #dc3545; }
        .status-unknown { background: #6c757d; }
        .loading {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid #f3f3f3;
            border-top: 3px solid #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .param-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }
        pre {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            overflow-x: auto;
            font-size: 12px;
        }
        .info-badge {
            display: inline-block;
            background: #17a2b8;
            color: white;
            padding: 3px 10px;
            border-radius: 12px;
            font-size: 11px;
            margin-left: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎨 AI 內容生成 API</h1>
            <p>Gemini 3 Pro 圖片 & 視頻生成 | OpenAI Compatible</p>
            <div class="version-badge">v3.1.0 - Gemini Powered</div>
        </div>

        <div class="api-key-section">
            <div class="input-group">
                <label>
                    🔐 API Key
                    <span class="status-indicator" id="keyStatus"></span>
                </label>
                <input type="password" id="apiKey" placeholder="sk-your-api-key-here" />
            </div>
        </div>

        <div class="tabs">
            <div class="tab active" onclick="switchTab('image')">🖼️ 圖片生成</div>
            <div class="tab" onclick="switchTab('video')">🎬 視頻生成</div>
            <div class="tab" onclick="switchTab('api')">📡 API 測試</div>
        </div>

        <!-- 圖片生成 -->
        <div id="image" class="tab-content active">
            <div class="input-group">
                <label>
                    Prompt
                    <span class="info-badge">Gemini 3 Pro</span>
                </label>
                <textarea id="imagePrompt" placeholder="A serene mountain landscape at sunset with vibrant colors..."></textarea>
            </div>
            <div class="param-grid">
                <div class="input-group">
                    <label>尺寸</label>
                    <select id="imageSize">
                        <option value="1024x1024">1024x1024 (1K)</option>
                        <option value="2048x2048">2048x2048 (2K)</option>
                        <option value="4096x4096">4096x4096 (4K)</option>
                        <option value="1920x1080">1920x1080 (FHD)</option>
                    </select>
                </div>
                <div class="input-group">
                    <label>格式</label>
                    <select id="imageFormat">
                        <option value="url">URL (Data URL)</option>
                        <option value="b64_json">Base64</option>
                    </select>
                </div>
            </div>
            <div class="button-group">
                <button class="btn btn-primary" onclick="generateImage()">
                    生成圖片
                </button>
            </div>
            <div id="imageResult" class="result-section" style="display:none;">
                <h3>生成結果</h3>
                <img id="imageDisplay" class="result-image" />
            </div>
        </div>

        <!-- 視頻生成 -->
        <div id="video" class="tab-content">
            <div class="input-group">
                <label>Prompt</label>
                <textarea id="videoPrompt" placeholder="A time-lapse of clouds moving across a blue sky..."></textarea>
            </div>
            <div class="param-grid">
                <div class="input-group">
                    <label>時長 (秒)</label>
                    <select id="videoDuration">
                        <option value="3">3 秒</option>
                        <option value="5" selected>5 秒</option>
                        <option value="10">10 秒</option>
                        <option value="15">15 秒</option>
                    </select>
                </div>
                <div class="input-group">
                    <label>解析度</label>
                    <select id="videoResolution">
                        <option value="1280x720">720p</option>
                        <option value="1920x1080" selected>1080p</option>
                        <option value="2560x1440">2K</option>
                        <option value="3840x2160">4K</option>
                    </select>
                </div>
                <div class="input-group">
                    <label>寬高比</label>
                    <select id="videoAspect">
                        <option value="16:9" selected>16:9</option>
                        <option value="9:16">9:16</option>
                        <option value="1:1">1:1</option>
                        <option value="4:3">4:3</option>
                    </select>
                </div>
            </div>
            <div class="button-group">
                <button class="btn btn-primary" onclick="generateVideo()">
                    生成視頻
                </button>
            </div>
            <div id="videoResult" class="result-section" style="display:none;">
                <h3>生成結果</h3>
                <p>任務 ID: <span id="videoTaskId"></span></p>
                <p>狀態: <span id="videoStatus"></span></p>
                <video id="videoDisplay" class="result-video" controls></video>
            </div>
        </div>

        <!-- API 測試 -->
        <div id="api" class="tab-content">
            <h3>📡 API 端點</h3>
            <pre>
POST /v1/images/generations   - OpenAI 兼容圖片生成 (Gemini 3 Pro)
POST /v1/videos/generations   - OpenAI 兼容視頻生成
GET  /v1/videos/{task_id}     - 查詢視頻狀態
GET  /v1/models                - 列出模型
POST /api/generate             - 直接圖片 API
POST /api/text2video           - 直接視頻 API
POST /api/verify-key           - 驗證 API Key
            </pre>

            <h3 style="margin-top: 30px;">🆕 更新說明</h3>
            <ul style="padding-left: 20px; color: #495057;">
                <li>✅ 圖片生成已升級到 Gemini 3 Pro Image Preview</li>
                <li>✅ 支持更高質量的圖片輸出</li>
                <li>✅ 保持 OpenAI Compatible API 格式</li>
                <li>✅ 視頻生成功能不變</li>
            </ul>
        </div>
    </div>

    <script>
        // 標籤切換
        function switchTab(tabName) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            event.target.classList.add('active');
            document.getElementById(tabName).classList.add('active');
        }

        // API Key 驗證
        const apiKeyInput = document.getElementById('apiKey');
        const keyStatus = document.getElementById('keyStatus');

        apiKeyInput.addEventListener('input', debounce(verifyApiKey, 500));

        // 載入保存的 API Key
        const savedKey = localStorage.getItem('apiKey');
        if (savedKey) {
            apiKeyInput.value = savedKey;
            verifyApiKey();
        }

        function debounce(func, wait) {
            let timeout;
            return function() {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, arguments), wait);
            };
        }

        async function verifyApiKey() {
            const apiKey = apiKeyInput.value;
            if (!apiKey) {
                keyStatus.className = 'status-indicator status-unknown';
                return;
            }

            try {
                const response = await fetch('/api/verify-key', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + apiKey }
                });
                const data = await response.json();

                keyStatus.className = 'status-indicator ' + (data.valid ? 'status-valid' : 'status-invalid');

                if (data.valid) {
                    localStorage.setItem('apiKey', apiKey);
                }
            } catch (error) {
                keyStatus.className = 'status-indicator status-invalid';
            }
        }

        // 生成圖片
        async function generateImage() {
            const prompt = document.getElementById('imagePrompt').value;
            const size = document.getElementById('imageSize').value;
            const format = document.getElementById('imageFormat').value;
            const apiKey = apiKeyInput.value;

            if (!prompt) {
                alert('請輸入 Prompt');
                return;
            }

            const btn = event.target;
            btn.disabled = true;
            btn.innerHTML = '<span class="loading"></span> 生成中...';

            try {
                const response = await fetch('/v1/images/generations', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(apiKey && { 'Authorization': 'Bearer ' + apiKey })
                    },
                    body: JSON.stringify({
                        prompt: prompt,
                        size: size,
                        response_format: format
                    })
                });

                const data = await response.json();

                if (data.error) {
                    alert('錯誤: ' + data.error.message);
                    return;
                }

                const imageUrl = format === 'url' ? data.data[0].url : 'data:image/png;base64,' + data.data[0].b64_json;
                document.getElementById('imageDisplay').src = imageUrl;
                document.getElementById('imageResult').style.display = 'block';
            } catch (error) {
                alert('錯誤: ' + error.message);
            } finally {
                btn.disabled = false;
                btn.innerHTML = '生成圖片';
            }
        }

        // 生成視頻
        async function generateVideo() {
            const prompt = document.getElementById('videoPrompt').value;
            const duration = parseInt(document.getElementById('videoDuration').value);
            const size = document.getElementById('videoResolution').value;
            const apiKey = apiKeyInput.value;

            if (!prompt) {
                alert('請輸入 Prompt');
                return;
            }

            const btn = event.target;
            btn.disabled = true;
            btn.innerHTML = '<span class="loading"></span> 生成中...';

            try {
                const response = await fetch('/v1/videos/generations', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(apiKey && { 'Authorization': 'Bearer ' + apiKey })
                    },
                    body: JSON.stringify({
                        prompt: prompt,
                        duration: duration,
                        size: size
                    })
                });

                const data = await response.json();

                if (data.error) {
                    alert('錯誤: ' + data.error.message);
                    return;
                }

                document.getElementById('videoTaskId').textContent = data.id;
                document.getElementById('videoStatus').textContent = data.status;
                document.getElementById('videoResult').style.display = 'block';

                if (data.data && data.data[0].url) {
                    document.getElementById('videoDisplay').src = data.data[0].url;
                } else {
                    document.getElementById('videoStatus').textContent = '處理中...';
                }
            } catch (error) {
                alert('錯誤: ' + error.message);
            } finally {
                btn.disabled = false;
                btn.innerHTML = '生成視頻';
            }
        }
    </script>
</body>
</html>
  `;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

// ==========================================
// 輔助函數
// ==========================================

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': CONFIG.corsOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    },
  });
}

function handleCORS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': CONFIG.corsOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
      'Access-Control-Max-Age': '86400',
    },
  });
}

// ==========================================
// 主處理函數
// ==========================================

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method;

      // CORS 預檢
      if (method === 'OPTIONS') {
        return handleCORS();
      }

      // Web UI
      if (method === 'GET' && path === '/') {
        return handleWebUI();
      }

      // API Key 驗證（僅對 API 端點）
      if (path.startsWith('/v1/') || path.startsWith('/api/')) {
        const auth = authenticateRequest(request, env);
        if (!auth.success) {
          return jsonResponse({
            error: {
              message: auth.message,
              type: 'authentication_error',
              code: 'invalid_api_key',
            },
          }, 401);
        }
      }

      // 路由
      if (method === 'GET' && path === '/v1/models') {
        return handleModels();
      }

      if (method === 'POST' && path === '/v1/images/generations') {
        return handleImageGenerations(request);
      }

      if (method === 'POST' && path === '/v1/videos/generations') {
        return handleVideoGenerations(request);
      }

      if (method === 'GET' && path.startsWith('/v1/videos/')) {
        const taskId = path.split('/').pop();
        return handleVideoStatus(taskId);
      }

      if (method === 'POST' && path === '/api/generate') {
        return handleDirectImageAPI(request);
      }

      if (method === 'POST' && path === '/api/text2video') {
        return handleDirectVideoAPI(request);
      }

      if (method === 'POST' && path === '/api/verify-key') {
        return handleVerifyKey(request, env);
      }

      // 404
      return jsonResponse({
        error: {
          message: 'Endpoint not found',
          type: 'invalid_request_error',
          code: 'not_found',
        },
      }, 404);

    } catch (error) {
      return jsonResponse({
        error: {
          message: error.message,
          type: 'api_error',
          code: 'internal_error',
        },
      }, 500);
    }
  },
};
