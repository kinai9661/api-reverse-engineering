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
            const mimeType = part.inlineData.mimeType || 'image/png'
            imageUrl = 'data:' + mimeType + ';base64,' + imageData
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
  const encodedPrompt = encodeURIComponent(prompt)
  const imageUrl = 'https://image.pollinations.ai/prompt/' + encodedPrompt + '?width=' + width + '&height=' + height + '&model=flux&nologo=true&enhance=true'

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

    const encodedPrompt = encodeURIComponent(prompt)
    const imageUrl = 'https://image.pollinations.ai/prompt/' + encodedPrompt + '?' + params.toString()

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
      'https://api-integrations.appmedo.com/app-7r29gu4xs001/api-6LeB8Qe4rWGY/v1/videos/status/' + taskId,
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
  return `<!DOCTYPE html>
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
