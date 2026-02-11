// Cloudflare Worker - AI Media Generation API
// 支持图片生成 (Gemini) + 视频生成 (Medeo)
// Author: kinai9661
// Date: 2026-02-11

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  const path = url.pathname

  // CORS 预检请求
  if (request.method === 'OPTIONS') {
    return handleCORS()
  }

  try {
    // ========== 前端界面 ==========
    if (path === '/' && request.method === 'GET') {
      return new Response(getHTML(), {
        headers: { 
          'Content-Type': 'text/html;charset=UTF-8',
          'Cache-Control': 'public, max-age=3600'
        }
      })
    }

    // ========== 图片生成 API ==========

    // Gemini 图片生成（主要端点）
    if (path === '/api/image/generate' && request.method === 'POST') {
      return handleGeminiImage(request)
    }

    // Pollinations 备用端点
    if (path === '/api/image/pollinations' && request.method === 'POST') {
      return handlePollinationsImage(request)
    }

    // ========== 视频生成 API ==========

    // Text2Video
    if (path === '/api/text2video' && request.method === 'POST') {
      return handleText2Video(request)
    }

    // 查询视频状态
    if (path.startsWith('/api/text2video/status/') && request.method === 'GET') {
      const taskId = path.split('/').pop()
      return handleVideoStatus(taskId)
    }

    // ========== 通用端点 ==========

    // 健康检查
    if (path === '/health' && request.method === 'GET') {
      return jsonResponse({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        services: {
          image_generation: 'gemini-3-pro',
          video_generation: 'medeo-text2video'
        }
      })
    }

    // API 信息
    if (path === '/api/info' && request.method === 'GET') {
      return jsonResponse({
        name: 'AI Media Generation API',
        version: '2.1.0',
        services: {
          image: {
            endpoint: '/api/image/generate',
            model: 'gemini-3-pro-image',
            provider: 'appmedo'
          },
          video: {
            endpoint: '/api/text2video',
            model: 'medeo-text2video',
            provider: 'appmedo'
          }
        }
      })
    }

    // 测试图片 API
    if (path === '/api/image/test' && request.method === 'GET') {
      return handleTestImageAPI()
    }

    // 测试视频 API
    if (path === '/api/text2video/test' && request.method === 'GET') {
      return handleTestVideoAPI()
    }

    return new Response('404 Not Found', { 
      status: 404,
      headers: { 'Content-Type': 'text/plain' }
    })

  } catch (error) {
    console.error('Request handler error:', error)
    return jsonResponse({
      error: 'Internal server error',
      message: error.message
    }, 500)
  }
}

// ==================== 图片生成处理函数 ====================

// Gemini 图片生成（主要方法）
async function handleGeminiImage(request) {
  try {
    const body = await request.json()
    const { 
      prompt,
      width = 1024,
      height = 1024,
      aspectRatio = '1:1',
      negativePrompt = '',
      numberOfImages = 1
    } = body

    if (!prompt || prompt.trim().length === 0) {
      return jsonResponse({ 
        error: 'Prompt is required',
        message: '请提供图片描述'
      }, 400)
    }

    console.log('Generating image with Gemini:', { prompt, width, height })

    // 调用 Gemini 图片生成 API
    const geminiResponse = await fetch(
      'https://api-integrations.appmedo.com/app-7r29gu4xs001/api-Xa6JZ58oPMEa/v1beta/models/gemini-3-pro-image-preview:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Origin': 'https://appmedo.com',
          'Referer': 'https://appmedo.com/'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.9,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json'
          },
          safetySettings: [
            {
              category: 'HARM_CATEGORY_HARASSMENT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            },
            {
              category: 'HARM_CATEGORY_HATE_SPEECH',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            }
          ]
        })
      }
    )

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text()
      console.error('Gemini API error:', geminiResponse.status, errorText)

      // 回退到 Pollinations
      return handlePollinationsFallback(prompt, width, height)
    }

    const result = await geminiResponse.json()
    console.log('Gemini API response:', result)

    // 解析 Gemini 响应
    let imageUrl = null
    let imageData = null

    // 尝试从不同的响应格式中提取图片
    if (result.candidates && result.candidates[0]) {
      const candidate = result.candidates[0]

      // 检查是否有图片 URL
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData && part.inlineData.data) {
            // Base64 图片数据
            imageData = part.inlineData.data
            imageUrl = \`data:\${part.inlineData.mimeType || 'image/png'};base64,\${imageData}\`
            break
          } else if (part.fileData && part.fileData.fileUri) {
            // 文件 URI
            imageUrl = part.fileData.fileUri
            break
          }
        }
      }
    }

    // 如果没有获取到图片，使用 Pollinations 作为备用
    if (!imageUrl) {
      console.log('No image URL in Gemini response, using Pollinations fallback')
      return handlePollinationsFallback(prompt, width, height)
    }

    return jsonResponse({
      success: true,
      image_url: imageUrl,
      image_data: imageData ? imageData.substring(0, 100) + '...' : null,
      prompt: prompt,
      model: 'gemini-3-pro-image',
      width: width,
      height: height,
      provider: 'appmedo'
    })

  } catch (error) {
    console.error('Gemini image generation error:', error)

    // 错误时回退到 Pollinations
    try {
      const body = await request.clone().json()
      return handlePollinationsFallback(body.prompt, body.width || 1024, body.height || 1024)
    } catch (fallbackError) {
      return jsonResponse({
        error: 'Image generation failed',
        message: error.message
      }, 500)
    }
  }
}

// Pollinations 备用方案
async function handlePollinationsFallback(prompt, width = 1024, height = 1024) {
  const imageUrl = \`https://image.pollinations.ai/prompt/\${encodeURIComponent(prompt)}?width=\${width}&height=\${height}&model=flux&nologo=true&enhance=true\`

  return jsonResponse({
    success: true,
    image_url: imageUrl,
    prompt: prompt,
    model: 'pollinations-flux',
    width: width,
    height: height,
    provider: 'pollinations',
    note: 'Using fallback API'
  })
}

// Pollinations 图片生成（独立端点）
async function handlePollinationsImage(request) {
  try {
    const body = await request.json()
    const { 
      prompt, 
      width = 1024, 
      height = 1024, 
      model = 'flux',
      seed = -1,
      nologo = true,
      enhance = false
    } = body

    if (!prompt) {
      return jsonResponse({ error: 'Prompt is required' }, 400)
    }

    const params = new URLSearchParams({
      width: width.toString(),
      height: height.toString(),
      model: model,
      seed: seed.toString(),
      nologo: nologo.toString(),
      enhance: enhance.toString()
    })

    const imageUrl = \`https://image.pollinations.ai/prompt/\${encodeURIComponent(prompt)}?\${params}\`

    return jsonResponse({
      success: true,
      image_url: imageUrl,
      prompt: prompt,
      model: 'pollinations-' + model,
      width: width,
      height: height,
      provider: 'pollinations'
    })

  } catch (error) {
    return jsonResponse({
      error: 'Image generation failed',
      message: error.message
    }, 500)
  }
}

// 测试图片 API
async function handleTestImageAPI() {
  try {
    const testStart = Date.now()

    const testResponse = await fetch(
      'https://api-integrations.appmedo.com/app-7r29gu4xs001/api-Xa6JZ58oPMEa/v1beta/models/gemini-3-pro-image-preview:generateContent',
      {
        method: 'OPTIONS',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Origin': 'https://appmedo.com'
        }
      }
    )

    const testEnd = Date.now()

    return jsonResponse({
      success: true,
      status: testResponse.status,
      response_time_ms: testEnd - testStart,
      endpoint: 'gemini-3-pro-image',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    return jsonResponse({
      success: false,
      error: 'API test failed',
      message: error.message
    }, 500)
  }
}

// ==================== 视频生成处理函数 ====================

// Text2Video 生成
async function handleText2Video(request) {
  try {
    const body = await request.json()
    const { 
      text, 
      duration = 10, 
      aspect_ratio = '16:9', 
      style = 'default' 
    } = body

    if (!text || text.trim().length === 0) {
      return jsonResponse({ 
        error: 'Text is required',
        message: '请提供视频描述文字'
      }, 400)
    }

    if (text.length > 500) {
      return jsonResponse({ 
        error: 'Text too long',
        message: '描述文字不能超过 500 个字符'
      }, 400)
    }

    console.log('Generating video:', { text, duration, aspect_ratio, style })

    const medeoResponse = await fetch(
      'https://api-integrations.appmedo.com/app-7r29gu4xs001/api-6LeB8Qe4rWGY/v1/videos/text2video',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Origin': 'https://medeo.app',
          'Referer': 'https://medeo.app/'
        },
        body: JSON.stringify({
          prompt: text,
          duration: duration,
          aspect_ratio: aspect_ratio,
          style: style
        })
      }
    )

    if (!medeoResponse.ok) {
      const errorText = await medeoResponse.text()
      console.error('Medeo API error:', medeoResponse.status, errorText)

      return jsonResponse({
        error: 'API request failed',
        status: medeoResponse.status,
        message: '视频生成服务暂时不可用，请稍后再试'
      }, medeoResponse.status)
    }

    const result = await medeoResponse.json()
    console.log('Medeo API response:', result)

    return jsonResponse({
      success: true,
      task_id: result.task_id || result.id || generateTaskId(),
      status: result.status || 'processing',
      video_url: result.video_url || null,
      thumbnail: result.thumbnail || null,
      estimated_time: result.estimated_time || 60,
      message: '视频生成任务已启动'
    })

  } catch (error) {
    console.error('Text2Video error:', error)
    return jsonResponse({
      error: 'Failed to generate video',
      message: error.message,
      details: '请检查网络连接或稍后再试'
    }, 500)
  }
}

// 查询视频状态
async function handleVideoStatus(taskId) {
  try {
    if (!taskId) {
      return jsonResponse({ error: 'Task ID is required' }, 400)
    }

    const statusResponse = await fetch(
      \`https://api-integrations.appmedo.com/app-7r29gu4xs001/api-6LeB8Qe4rWGY/v1/videos/status/\${taskId}\`,
      {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        }
      }
    )

    if (!statusResponse.ok) {
      if (statusResponse.status === 404) {
        return jsonResponse({
          success: false,
          task_id: taskId,
          status: 'not_found',
          message: '任务不存在或已过期'
        }, 404)
      }

      return jsonResponse({
        error: 'Status check failed',
        status: statusResponse.status
      }, statusResponse.status)
    }

    const result = await statusResponse.json()

    return jsonResponse({
      success: true,
      task_id: taskId,
      status: result.status || 'unknown',
      progress: result.progress || 0,
      video_url: result.video_url || null,
      thumbnail: result.thumbnail || null,
      duration: result.duration || null,
      error: result.error || null
    })

  } catch (error) {
    return jsonResponse({
      error: 'Failed to get status',
      message: error.message,
      task_id: taskId
    }, 500)
  }
}

// 测试视频 API
async function handleTestVideoAPI() {
  try {
    const testStart = Date.now()

    const testResponse = await fetch(
      'https://api-integrations.appmedo.com/app-7r29gu4xs001/api-6LeB8Qe4rWGY/v1/videos/text2video',
      {
        method: 'OPTIONS',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    )

    const testEnd = Date.now()

    return jsonResponse({
      success: true,
      status: testResponse.status,
      response_time_ms: testEnd - testStart,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    return jsonResponse({
      success: false,
      error: 'API test failed',
      message: error.message
    }, 500)
  }
}

// ==================== 工具函数 ====================

function generateTaskId() {
  return 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
}

function handleCORS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  })
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    }
  })
}

// ==================== 前端 HTML ====================

function getHTML() {
  return \`<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI 媒體生成器 - Gemini 圖片 & Medeo 影片</title>
  <meta name="description" content="使用 Gemini AI 生成圖片，Medeo AI 生成影片">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }

    .container {
      max-width: 1000px;
      margin: 0 auto;
      background: rgba(255, 255, 255, 0.98);
      border-radius: 24px;
      padding: 50px;
      box-shadow: 0 25px 70px rgba(0, 0, 0, 0.3);
    }

    h1 {
      font-size: 3em;
      background: linear-gradient(135deg, #667eea, #764ba2);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 10px;
    }

    .subtitle {
      color: #666;
      margin-bottom: 30px;
      font-size: 1.2em;
    }

    .badge {
      display: inline-block;
      padding: 5px 12px;
      border-radius: 12px;
      font-size: 0.85em;
      font-weight: 600;
      margin-left: 10px;
    }

    .badge.gemini {
      background: linear-gradient(135deg, #4285f4, #34a853);
      color: white;
    }

    .badge.medeo {
      background: linear-gradient(135deg, #ff6b6b, #ee5a6f);
      color: white;
    }

    .tabs {
      display: flex;
      gap: 10px;
      margin-bottom: 30px;
      border-bottom: 2px solid #e0e0e0;
    }

    .tab {
      padding: 15px 30px;
      background: none;
      border: none;
      border-bottom: 3px solid transparent;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
      color: #666;
    }

    .tab:hover {
      color: #667eea;
    }

    .tab.active {
      color: #667eea;
      border-bottom-color: #667eea;
    }

    .tab-content {
      display: none;
    }

    .tab-content.active {
      display: block;
      animation: fadeIn 0.3s;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .form-group {
      margin-bottom: 25px;
    }

    label {
      display: block;
      margin-bottom: 10px;
      font-weight: 600;
      color: #333;
      font-size: 1.05em;
    }

    input[type="text"],
    textarea,
    select {
      width: 100%;
      padding: 16px;
      border: 2px solid #e0e0e0;
      border-radius: 12px;
      font-size: 16px;
      transition: all 0.3s;
      font-family: inherit;
    }

    textarea {
      min-height: 120px;
      resize: vertical;
    }

    input:focus, textarea:focus, select:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
    }

    .options-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
    }

    button.generate-btn {
      width: 100%;
      padding: 20px;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      border: none;
      border-radius: 12px;
      font-size: 18px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
    }

    button.generate-btn:hover:not(:disabled) {
      transform: translateY(-3px);
      box-shadow: 0 15px 35px rgba(102, 126, 234, 0.4);
    }

    button.generate-btn:disabled {
      background: linear-gradient(135deg, #ccc, #999);
      cursor: not-allowed;
    }

    .result {
      margin-top: 40px;
      padding: 25px;
      border-radius: 12px;
      display: none;
    }

    .result.show { display: block; animation: slideIn 0.3s; }

    @keyframes slideIn {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .result.success {
      background: linear-gradient(135deg, #d4edda, #c3e6cb);
      border-left: 5px solid #28a745;
    }

    .result.error {
      background: linear-gradient(135deg, #f8d7da, #f5c6cb);
      border-left: 5px solid #dc3545;
    }

    .result.processing {
      background: linear-gradient(135deg, #fff3cd, #ffe69c);
      border-left: 5px solid #ffc107;
    }

    .result-image {
      width: 100%;
      max-width: 100%;
      border-radius: 12px;
      margin-top: 20px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    }

    .result-video {
      width: 100%;
      border-radius: 12px;
      margin-top: 20px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    }

    .progress-bar {
      width: 100%;
      height: 10px;
      background: rgba(0, 0, 0, 0.1);
      border-radius: 5px;
      overflow: hidden;
      margin: 20px 0;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #667eea, #764ba2);
      width: 0%;
      transition: width 0.5s;
    }

    .download-btn {
      margin-top: 15px;
      padding: 15px 30px;
      background: linear-gradient(135deg, #28a745, #20c997);
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
    }

    .download-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 25px rgba(40, 167, 69, 0.4);
    }

    .spinner {
      display: inline-block;
      width: 20px;
      height: 20px;
      border: 3px solid rgba(255,255,255,.3);
      border-radius: 50%;
      border-top-color: #fff;
      animation: spin 1s ease-in-out infinite;
      margin-right: 10px;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .api-info {
      background: linear-gradient(135deg, #f8f9fa, #e9ecef);
      padding: 20px;
      border-radius: 12px;
      margin-top: 30px;
      font-size: 0.95em;
      color: #666;
      border-left: 4px solid #667eea;
    }

    .char-count {
      text-align: right;
      color: #999;
      font-size: 0.9em;
      margin-top: 5px;
    }

    @media (max-width: 768px) {
      .container { padding: 30px 20px; }
      h1 { font-size: 2em; }
      .tabs { flex-wrap: wrap; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎨 AI 媒體生成器</h1>
    <p class="subtitle">
      使用 Gemini 生成圖片
      <span class="badge gemini">Gemini 3 Pro</span>
      使用 Medeo 生成影片
      <span class="badge medeo">Medeo AI</span>
    </p>

    <div class="tabs">
      <button class="tab active" onclick="switchTab('image')">🖼️ 圖片生成</button>
      <button class="tab" onclick="switchTab('video')">🎬 影片生成</button>
    </div>

    <!-- 图片生成 Tab -->
    <div id="imageTab" class="tab-content active">
      <form id="imageForm">
        <div class="form-group">
          <label>📝 圖片描述 <span class="badge gemini">Powered by Gemini</span></label>
          <textarea 
            id="imagePrompt" 
            placeholder="例如：一隻可愛的橘色貓咪坐在窗台上看著外面，溫馨的室內光線，柔和的氛圍，高質量攝影..."
            required
          ></textarea>
        </div>

        <div class="options-grid">
          <div class="form-group">
            <label>📐 寬度</label>
            <select id="imageWidth">
              <option value="512">512px</option>
              <option value="768">768px</option>
              <option value="1024" selected>1024px</option>
              <option value="1280">1280px</option>
              <option value="1536">1536px</option>
            </select>
          </div>

          <div class="form-group">
            <label>📐 高度</label>
            <select id="imageHeight">
              <option value="512">512px</option>
              <option value="768">768px</option>
              <option value="1024" selected>1024px</option>
              <option value="1280">1280px</option>
              <option value="1536">1536px</option>
            </select>
          </div>
        </div>

        <button type="submit" class="generate-btn" id="imageBtn">
          🎨 生成圖片
        </button>
      </form>

      <div id="imageResult" class="result"></div>
    </div>

    <!-- 视频生成 Tab -->
    <div id="videoTab" class="tab-content">
      <form id="videoForm">
        <div class="form-group">
          <label>📝 影片描述 <span class="badge medeo">Powered by Medeo</span></label>
          <textarea 
            id="videoText" 
            placeholder="例如：一隻可愛的金毛獵犬在綠色草地上歡快地奔跑，陽光明媚，藍天白雲，慢動作特效..."
            maxlength="500"
            required
          ></textarea>
          <div id="charCount" class="char-count">0 / 500</div>
        </div>

        <div class="options-grid">
          <div class="form-group">
            <label>⏱️ 時長</label>
            <select id="videoDuration">
              <option value="5">5 秒</option>
              <option value="10" selected>10 秒</option>
              <option value="15">15 秒</option>
              <option value="30">30 秒</option>
            </select>
          </div>

          <div class="form-group">
            <label>📐 比例</label>
            <select id="videoAspect">
              <option value="16:9" selected>16:9 (橫向)</option>
              <option value="9:16">9:16 (直向)</option>
              <option value="1:1">1:1 (方形)</option>
            </select>
          </div>

          <div class="form-group">
            <label>🎨 風格</label>
            <select id="videoStyle">
              <option value="default" selected>預設</option>
              <option value="cinematic">電影</option>
              <option value="anime">動漫</option>
              <option value="realistic">寫實</option>
              <option value="artistic">藝術</option>
            </select>
          </div>
        </div>

        <button type="submit" class="generate-btn" id="videoBtn">
          🎬 生成影片
        </button>
      </form>

      <div id="videoResult" class="result"></div>
    </div>

    <div class="api-info">
      <strong>🔌 使用的服務：</strong><br>
      📸 <strong>圖片生成：</strong> Gemini 3 Pro Image Preview (appmedo.com)<br>
      🎬 <strong>影片生成：</strong> Medeo Text2Video (medeo.app)<br>
      ⚡ <strong>預估時間：</strong> 圖片 3-5 秒，影片 30-60 秒<br>
      🔄 <strong>備用方案：</strong> Pollinations AI（當 Gemini 不可用時）
    </div>
  </div>

  <script>
    let currentTab = 'image';
    let videoTaskId = null;
    let pollInterval = null;

    // Tab 切换
    function switchTab(tab) {
      currentTab = tab;

      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      event.target.classList.add('active');
      document.getElementById(tab + 'Tab').classList.add('active');
    }

    // 图片生成表单
    document.getElementById('imageForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await generateImage();
    });

    // 视频生成表单
    document.getElementById('videoForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await generateVideo();
    });

    // 字数统计
    document.getElementById('videoText').addEventListener('input', (e) => {
      const count = e.target.value.length;
      document.getElementById('charCount').textContent = count + ' / 500';
    });

    // 生成图片
    async function generateImage() {
      const prompt = document.getElementById('imagePrompt').value;
      const width = parseInt(document.getElementById('imageWidth').value);
      const height = parseInt(document.getElementById('imageHeight').value);

      const btn = document.getElementById('imageBtn');
      const result = document.getElementById('imageResult');

      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> 生成中...';
      result.className = 'result show processing';
      result.innerHTML = '<div>🎨 正在使用 Gemini AI 生成圖片...</div>';

      try {
        const response = await fetch('/api/image/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, width, height })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || data.error);
        }

        const modelBadge = data.provider === 'pollinations' 
          ? '<span style="background:#ff9800;color:white;padding:3px 8px;border-radius:6px;font-size:0.8em;margin-left:8px;">備用 API</span>'
          : '<span style="background:#4285f4;color:white;padding:3px 8px;border-radius:6px;font-size:0.8em;margin-left:8px;">Gemini</span>';

        result.className = 'result show success';
        result.innerHTML = \`
          <div><strong>✅ 圖片生成成功！</strong> \${modelBadge}</div>
          <div style="margin-top: 10px; color: #666;">
            模型：\${data.model} | 尺寸：\${data.width}x\${data.height}
          </div>
          <img src="\${data.image_url}" class="result-image" alt="Generated Image" onerror="this.src='/api/image/generate?prompt=' + encodeURIComponent('\${prompt}')">
          <button class="download-btn" onclick="downloadImage('\${data.image_url}', '\${prompt}')">
            ⬇️ 下載圖片
          </button>
        \`;

      } catch (error) {
        result.className = 'result show error';
        result.innerHTML = \`<div><strong>❌ 生成失敗</strong><br>\${error.message}</div>\`;
      } finally {
        btn.disabled = false;
        btn.innerHTML = '🎨 生成圖片';
      }
    }

    // 生成视频
    async function generateVideo() {
      const text = document.getElementById('videoText').value;
      const duration = parseInt(document.getElementById('videoDuration').value);
      const aspect_ratio = document.getElementById('videoAspect').value;
      const style = document.getElementById('videoStyle').value;

      const btn = document.getElementById('videoBtn');
      const result = document.getElementById('videoResult');

      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> 生成中...';
      result.className = 'result show processing';
      result.innerHTML = '<div>🎬 正在使用 Medeo AI 生成影片...</div><div class="progress-bar"><div id="videoProgress" class="progress-fill"></div></div>';

      try {
        const response = await fetch('/api/text2video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, duration, aspect_ratio, style })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || data.error);
        }

        videoTaskId = data.task_id;

        if (data.video_url) {
          showVideo(data.video_url);
        } else {
          startVideoPolling(data.task_id);
        }

      } catch (error) {
        result.className = 'result show error';
        result.innerHTML = \`<div><strong>❌ 生成失敗</strong><br>\${error.message}</div>\`;
        btn.disabled = false;
        btn.innerHTML = '🎬 生成影片';
      }
    }

    // 轮询视频状态
    function startVideoPolling(taskId) {
      let progress = 10;
      const progressBar = document.getElementById('videoProgress');
      const result = document.getElementById('videoResult');

      pollInterval = setInterval(async () => {
        try {
          const response = await fetch(\`/api/text2video/status/\${taskId}\`);
          const data = await response.json();

          if (data.status === 'completed' && data.video_url) {
            clearInterval(pollInterval);
            showVideo(data.video_url);
          } else if (data.status === 'failed') {
            clearInterval(pollInterval);
            result.className = 'result show error';
            result.innerHTML = '<div><strong>❌ 影片生成失敗</strong></div>';
            document.getElementById('videoBtn').disabled = false;
            document.getElementById('videoBtn').innerHTML = '🎬 生成影片';
          } else {
            progress = Math.min(progress + 5, 95);
            if (progressBar) {
              progressBar.style.width = progress + '%';
            }
          }
        } catch (error) {
          console.error('Polling error:', error);
        }
      }, 3000);
    }

    // 显示视频
    function showVideo(videoUrl) {
      const result = document.getElementById('videoResult');
      const progressBar = document.getElementById('videoProgress');

      if (progressBar) {
        progressBar.style.width = '100%';
      }

      setTimeout(() => {
        result.className = 'result show success';
        result.innerHTML = \`
          <div><strong>✅ 影片生成完成！</strong> <span style="background:#ee5a6f;color:white;padding:3px 8px;border-radius:6px;font-size:0.8em;margin-left:8px;">Medeo</span></div>
          <video controls autoplay class="result-video">
            <source src="\${videoUrl}" type="video/mp4">
          </video>
          <button class="download-btn" onclick="downloadVideo('\${videoUrl}')">
            ⬇️ 下載影片
          </button>
        \`;

        document.getElementById('videoBtn').disabled = false;
        document.getElementById('videoBtn').innerHTML = '🎬 生成影片';
      }, 500);
    }

    // 下载图片
    function downloadImage(url, prompt) {
      const a = document.createElement('a');
      a.href = url;
      a.download = \`gemini-image-\${Date.now()}.png\`;
      a.target = '_blank';
      a.click();
    }

    // 下载视频
    function downloadVideo(url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = \`medeo-video-\${Date.now()}.mp4\`;
      a.target = '_blank';
      a.click();
    }
  </script>
</body>
</html>\`
}
