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

  if (request.method === 'OPTIONS') {
    return handleCORS()
  }

  try {
    if (path === '/' && request.method === 'GET') {
      return new Response(getHTML(), {
        headers: { 
          'Content-Type': 'text/html;charset=UTF-8',
          'Cache-Control': 'public, max-age=3600'
        }
      })
    }

    if (path === '/api/image/generate' && request.method === 'POST') {
      return handleGeminiImage(request)
    }

    if (path === '/api/image/pollinations' && request.method === 'POST') {
      return handlePollinationsImage(request)
    }

    if (path === '/api/text2video' && request.method === 'POST') {
      return handleText2Video(request)
    }

    if (path.startsWith('/api/text2video/status/') && request.method === 'GET') {
      const taskId = path.split('/').pop()
      return handleVideoStatus(taskId)
    }

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

async function handleGeminiImage(request) {
  try {
    const body = await request.json()
    const prompt = body.prompt || ''
    const width = body.width || 1024
    const height = body.height || 1024

    if (!prompt || prompt.trim().length === 0) {
      return jsonResponse({ 
        error: 'Prompt is required',
        message: '请提供图片描述'
      }, 400)
    }

    console.log('Generating image with Gemini:', { prompt, width, height })

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
      return handlePollinationsFallback(prompt, width, height)
    }

    const result = await geminiResponse.json()
    console.log('Gemini API response:', result)

    let imageUrl = null
    let imageData = null

    if (result.candidates && result.candidates[0]) {
      const candidate = result.candidates[0]

      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData && part.inlineData.data) {
            imageData = part.inlineData.data
            const mimeType = part.inlineData.mimeType || 'image/png'
            imageUrl = 'data:' + mimeType + ';base64,' + imageData
            break
          } else if (part.fileData && part.fileData.fileUri) {
            imageUrl = part.fileData.fileUri
            break
          }
        }
      }
    }

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

async function handlePollinationsFallback(prompt, width, height) {
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

async function handlePollinationsImage(request) {
  try {
    const body = await request.json()
    const prompt = body.prompt || ''
    const width = body.width || 1024
    const height = body.height || 1024
    const model = body.model || 'flux'

    if (!prompt) {
      return jsonResponse({ error: 'Prompt is required' }, 400)
    }

    const encodedPrompt = encodeURIComponent(prompt)
    const imageUrl = 'https://image.pollinations.ai/prompt/' + encodedPrompt + '?width=' + width + '&height=' + height + '&model=' + model + '&nologo=true'

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

async function handleText2Video(request) {
  try {
    const body = await request.json()
    const text = body.text || ''
    const duration = body.duration || 10
    const aspect_ratio = body.aspect_ratio || '16:9'
    const style = body.style || 'default'

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

function jsonResponse(data, status) {
  status = status || 200
  return new Response(JSON.stringify(data, null, 2), {
    status: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    }
  })
}

function getHTML() {
  const html = '<!DOCTYPE html>' +
'<html lang="zh-TW">' +
'<head>' +
'<meta charset="UTF-8">' +
'<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
'<title>AI 媒體生成器</title>' +
'<style>' +
'* { margin: 0; padding: 0; box-sizing: border-box; }' +
'body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 20px; }' +
'.container { max-width: 1000px; margin: 0 auto; background: rgba(255,255,255,0.98); border-radius: 24px; padding: 50px; box-shadow: 0 25px 70px rgba(0,0,0,0.3); }' +
'h1 { font-size: 3em; background: linear-gradient(135deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 10px; }' +
'.subtitle { color: #666; margin-bottom: 30px; font-size: 1.2em; }' +
'.badge { display: inline-block; padding: 5px 12px; border-radius: 12px; font-size: 0.85em; font-weight: 600; margin-left: 10px; color: white; }' +
'.badge.gemini { background: linear-gradient(135deg, #4285f4, #34a853); }' +
'.badge.medeo { background: linear-gradient(135deg, #ff6b6b, #ee5a6f); }' +
'.tabs { display: flex; gap: 10px; margin-bottom: 30px; border-bottom: 2px solid #e0e0e0; }' +
'.tab { padding: 15px 30px; background: none; border: none; border-bottom: 3px solid transparent; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.3s; color: #666; }' +
'.tab:hover { color: #667eea; }' +
'.tab.active { color: #667eea; border-bottom-color: #667eea; }' +
'.tab-content { display: none; }' +
'.tab-content.active { display: block; animation: fadeIn 0.3s; }' +
'@keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }' +
'.form-group { margin-bottom: 25px; }' +
'label { display: block; margin-bottom: 10px; font-weight: 600; color: #333; font-size: 1.05em; }' +
'textarea, select { width: 100%; padding: 16px; border: 2px solid #e0e0e0; border-radius: 12px; font-size: 16px; transition: all 0.3s; font-family: inherit; }' +
'textarea { min-height: 120px; resize: vertical; }' +
'textarea:focus, select:focus { outline: none; border-color: #667eea; box-shadow: 0 0 0 4px rgba(102,126,234,0.1); }' +
'.options-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }' +
'button.generate-btn { width: 100%; padding: 20px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; border-radius: 12px; font-size: 18px; font-weight: 600; cursor: pointer; transition: all 0.3s; }' +
'button.generate-btn:hover:not(:disabled) { transform: translateY(-3px); box-shadow: 0 15px 35px rgba(102,126,234,0.4); }' +
'button.generate-btn:disabled { background: linear-gradient(135deg, #ccc, #999); cursor: not-allowed; }' +
'.result { margin-top: 40px; padding: 25px; border-radius: 12px; display: none; }' +
'.result.show { display: block; animation: slideIn 0.3s; }' +
'@keyframes slideIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }' +
'.result.success { background: linear-gradient(135deg, #d4edda, #c3e6cb); border-left: 5px solid #28a745; }' +
'.result.error { background: linear-gradient(135deg, #f8d7da, #f5c6cb); border-left: 5px solid #dc3545; }' +
'.result.processing { background: linear-gradient(135deg, #fff3cd, #ffe69c); border-left: 5px solid #ffc107; }' +
'.result-image { width: 100%; max-width: 100%; border-radius: 12px; margin-top: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }' +
'.result-video { width: 100%; border-radius: 12px; margin-top: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }' +
'.progress-bar { width: 100%; height: 10px; background: rgba(0,0,0,0.1); border-radius: 5px; overflow: hidden; margin: 20px 0; }' +
'.progress-fill { height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); width: 0%; transition: width 0.5s; }' +
'.download-btn { margin-top: 15px; padding: 15px 30px; background: linear-gradient(135deg, #28a745, #20c997); color: white; border: none; border-radius: 10px; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.3s; }' +
'.download-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(40,167,69,0.4); }' +
'.spinner { display: inline-block; width: 20px; height: 20px; border: 3px solid rgba(255,255,255,.3); border-radius: 50%; border-top-color: #fff; animation: spin 1s ease-in-out infinite; margin-right: 10px; }' +
'@keyframes spin { to { transform: rotate(360deg); } }' +
'.api-info { background: linear-gradient(135deg, #f8f9fa, #e9ecef); padding: 20px; border-radius: 12px; margin-top: 30px; font-size: 0.95em; color: #666; border-left: 4px solid #667eea; }' +
'.char-count { text-align: right; color: #999; font-size: 0.9em; margin-top: 5px; }' +
'@media (max-width: 768px) { .container { padding: 30px 20px; } h1 { font-size: 2em; } .tabs { flex-wrap: wrap; } }' +
'</style>' +
'</head>' +
'<body>' +
'<div class="container">' +
'<h1>🎨 AI 媒體生成器</h1>' +
'<p class="subtitle">使用 Gemini 生成圖片 <span class="badge gemini">Gemini 3 Pro</span> 使用 Medeo 生成影片 <span class="badge medeo">Medeo AI</span></p>' +
'<div class="tabs">' +
'<button class="tab active" onclick="switchTab(\'image\')">🖼️ 圖片生成</button>' +
'<button class="tab" onclick="switchTab(\'video\')">🎬 影片生成</button>' +
'</div>' +
'<div id="imageTab" class="tab-content active">' +
'<form id="imageForm">' +
'<div class="form-group">' +
'<label>📝 圖片描述 <span class="badge gemini">Powered by Gemini</span></label>' +
'<textarea id="imagePrompt" placeholder="例如：一隻可愛的橘色貓咪坐在窗台上..." required></textarea>' +
'</div>' +
'<div class="options-grid">' +
'<div class="form-group"><label>📐 寬度</label><select id="imageWidth"><option value="512">512px</option><option value="768">768px</option><option value="1024" selected>1024px</option><option value="1280">1280px</option><option value="1536">1536px</option></select></div>' +
'<div class="form-group"><label>📐 高度</label><select id="imageHeight"><option value="512">512px</option><option value="768">768px</option><option value="1024" selected>1024px</option><option value="1280">1280px</option><option value="1536">1536px</option></select></div>' +
'</div>' +
'<button type="submit" class="generate-btn" id="imageBtn">🎨 生成圖片</button>' +
'</form>' +
'<div id="imageResult" class="result"></div>' +
'</div>' +
'<div id="videoTab" class="tab-content">' +
'<form id="videoForm">' +
'<div class="form-group">' +
'<label>📝 影片描述 <span class="badge medeo">Powered by Medeo</span></label>' +
'<textarea id="videoText" placeholder="例如：一隻金毛獵犬在草地上奔跑..." maxlength="500" required></textarea>' +
'<div id="charCount" class="char-count">0 / 500</div>' +
'</div>' +
'<div class="options-grid">' +
'<div class="form-group"><label>⏱️ 時長</label><select id="videoDuration"><option value="5">5 秒</option><option value="10" selected>10 秒</option><option value="15">15 秒</option><option value="30">30 秒</option></select></div>' +
'<div class="form-group"><label>📐 比例</label><select id="videoAspect"><option value="16:9" selected>16:9 (橫向)</option><option value="9:16">9:16 (直向)</option><option value="1:1">1:1 (方形)</option></select></div>' +
'<div class="form-group"><label>🎨 風格</label><select id="videoStyle"><option value="default" selected>預設</option><option value="cinematic">電影</option><option value="anime">動漫</option><option value="realistic">寫實</option><option value="artistic">藝術</option></select></div>' +
'</div>' +
'<button type="submit" class="generate-btn" id="videoBtn">🎬 生成影片</button>' +
'</form>' +
'<div id="videoResult" class="result"></div>' +
'</div>' +
'<div class="api-info"><strong>🔌 使用的服務：</strong><br>📸 <strong>圖片生成：</strong> Gemini 3 Pro Image Preview<br>🎬 <strong>影片生成：</strong> Medeo Text2Video<br>⚡ <strong>預估時間：</strong> 圖片 3-5 秒，影片 30-60 秒</div>' +
'</div>' +
'<script>' +
'let videoTaskId=null,pollInterval=null;' +
'function switchTab(t){document.querySelectorAll(".tab").forEach(e=>e.classList.remove("active"));document.querySelectorAll(".tab-content").forEach(e=>e.classList.remove("active"));event.target.classList.add("active");document.getElementById(t+"Tab").classList.add("active")}' +
'document.getElementById("imageForm").addEventListener("submit",async e=>{e.preventDefault();await generateImage()});' +
'document.getElementById("videoForm").addEventListener("submit",async e=>{e.preventDefault();await generateVideo()});' +
'document.getElementById("videoText").addEventListener("input",e=>{document.getElementById("charCount").textContent=e.target.value.length+" / 500"});' +
'async function generateImage(){const t=document.getElementById("imagePrompt").value,e=parseInt(document.getElementById("imageWidth").value),a=parseInt(document.getElementById("imageHeight").value),n=document.getElementById("imageBtn"),o=document.getElementById("imageResult");n.disabled=!0;n.innerHTML="<span class=\'spinner\'></span> 生成中...";o.className="result show processing";o.innerHTML="<div>🎨 正在使用 Gemini AI 生成圖片...</div>";try{const r=await fetch("/api/image/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt:t,width:e,height:a})}),s=await r.json();if(!r.ok)throw new Error(s.message||s.error);const d="pollinations"===s.provider?"<span style=\'background:#ff9800;color:white;padding:3px 8px;border-radius:6px;font-size:0.8em;margin-left:8px;\'>備用 API</span>":"<span style=\'background:#4285f4;color:white;padding:3px 8px;border-radius:6px;font-size:0.8em;margin-left:8px;\'>Gemini</span>";o.className="result show success";o.innerHTML="<div><strong>✅ 圖片生成成功！</strong> "+d+"</div><div style=\'margin-top:10px;color:#666;\'>模型："+s.model+" | 尺寸："+s.width+"x"+s.height+"</div><img src=\'"+s.image_url+"\' class=\'result-image\' alt=\'Generated Image\'><button class=\'download-btn\' onclick=\'downloadImage(\""+s.image_url+'\",\"'+t+'\")\'⬇️ 下載圖片</button>"}catch(e){o.className="result show error";o.innerHTML="<div><strong>❌ 生成失敗</strong><br>"+e.message+"</div>"}finally{n.disabled=!1;n.innerHTML="🎨 生成圖片"}}' +
'async function generateVideo(){const t=document.getElementById("videoText").value,e=parseInt(document.getElementById("videoDuration").value),a=document.getElementById("videoAspect").value,n=document.getElementById("videoStyle").value,o=document.getElementById("videoBtn"),r=document.getElementById("videoResult");o.disabled=!0;o.innerHTML="<span class=\'spinner\'></span> 生成中...";r.className="result show processing";r.innerHTML="<div>🎬 正在使用 Medeo AI 生成影片...</div><div class=\'progress-bar\'><div id=\'videoProgress\' class=\'progress-fill\'></div></div>";try{const s=await fetch("/api/text2video",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:t,duration:e,aspect_ratio:a,style:n})}),d=await s.json();if(!s.ok)throw new Error(d.message||d.error);videoTaskId=d.task_id;d.video_url?showVideo(d.video_url):startVideoPolling(d.task_id)}catch(e){r.className="result show error";r.innerHTML="<div><strong>❌ 生成失敗</strong><br>"+e.message+"</div>";o.disabled=!1;o.innerHTML="🎬 生成影片"}}' +
'function startVideoPolling(t){let e=10;pollInterval=setInterval(async()=>{try{const a=await fetch("/api/text2video/status/"+t),n=await a.json();"completed"===n.status&&n.video_url?(clearInterval(pollInterval),showVideo(n.video_url)):"failed"===n.status?(clearInterval(pollInterval),document.getElementById("videoResult").className="result show error",document.getElementById("videoResult").innerHTML="<div><strong>❌ 影片生成失敗</strong></div>",document.getElementById("videoBtn").disabled=!1,document.getElementById("videoBtn").innerHTML="🎬 生成影片"):(e=Math.min(e+5,95),document.getElementById("videoProgress").style.width=e+"%")}catch(e){console.error("Polling error:",e)}},3e3)}' +
'function showVideo(t){const e=document.getElementById("videoResult"),a=document.getElementById("videoProgress");a&&(a.style.width="100%");setTimeout(()=>{e.className="result show success";e.innerHTML="<div><strong>✅ 影片生成完成！</strong> <span style=\'background:#ee5a6f;color:white;padding:3px 8px;border-radius:6px;font-size:0.8em;margin-left:8px;\'>Medeo</span></div><video controls autoplay class=\'result-video\'><source src=\'"+t+"\' type=\'video/mp4\'></video><button class=\'download-btn\' onclick=\'downloadVideo(\""+t+'\")\'⬇️ 下載影片</button>";document.getElementById("videoBtn").disabled=!1;document.getElementById("videoBtn").innerHTML="🎬 生成影片"},500)}' +
'function downloadImage(t,e){const a=document.createElement("a");a.href=t;a.download="gemini-image-"+Date.now()+".png";a.target="_blank";a.click()}' +
'function downloadVideo(t){const e=document.createElement("a");e.href=t;e.download="medeo-video-"+Date.now()+".mp4";e.target="_blank";e.click()}' +
'</script>' +
'</body>' +
'</html>'

  return html
}
