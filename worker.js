// Cloudflare Worker - AI Media Generation API
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

    console.log('Generating image with Gemini:', prompt)

    const geminiResponse = await fetch(
      'https://api-integrations.appmedo.com/app-7r29gu4xs001/api-Xa6JZ58oPMEa/v1beta/models/gemini-3-pro-image-preview:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json'
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
            maxOutputTokens: 2048
          }
        })
      }
    )

    if (!geminiResponse.ok) {
      console.error('Gemini API error:', geminiResponse.status)
      return handlePollinationsFallback(prompt, width, height)
    }

    const result = await geminiResponse.json()
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
      return handlePollinationsFallback(prompt, width, height)
    }

    return jsonResponse({
      success: true,
      image_url: imageUrl,
      prompt: prompt,
      model: 'gemini-3-pro-image',
      width: width,
      height: height,
      provider: 'appmedo'
    })

  } catch (error) {
    console.error('Error:', error)
    try {
      const body = await request.clone().json()
      return handlePollinationsFallback(body.prompt, body.width || 1024, body.height || 1024)
    } catch (e) {
      return jsonResponse({
        error: 'Image generation failed',
        message: error.message
      }, 500)
    }
  }
}

async function handlePollinationsFallback(prompt, width, height) {
  const encodedPrompt = encodeURIComponent(prompt)
  const imageUrl = 'https://image.pollinations.ai/prompt/' + encodedPrompt + '?width=' + width + '&height=' + height + '&model=flux&nologo=true'

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

    if (!prompt) {
      return jsonResponse({ error: 'Prompt is required' }, 400)
    }

    const encodedPrompt = encodeURIComponent(prompt)
    const imageUrl = 'https://image.pollinations.ai/prompt/' + encodedPrompt + '?width=' + width + '&height=' + height + '&model=flux&nologo=true'

    return jsonResponse({
      success: true,
      image_url: imageUrl,
      prompt: prompt,
      model: 'pollinations-flux',
      width: width,
      height: height,
      provider: 'pollinations'
    })

  } catch (error) {
    return jsonResponse({
      error: 'Failed',
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
        error: 'Text is required'
      }, 400)
    }

    if (text.length > 500) {
      return jsonResponse({ 
        error: 'Text too long'
      }, 400)
    }

    const medeoResponse = await fetch(
      'https://api-integrations.appmedo.com/app-7r29gu4xs001/api-6LeB8Qe4rWGY/v1/videos/text2video',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0'
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
      return jsonResponse({
        error: 'API request failed',
        status: medeoResponse.status
      }, medeoResponse.status)
    }

    const result = await medeoResponse.json()

    return jsonResponse({
      success: true,
      task_id: result.task_id || result.id || generateTaskId(),
      status: result.status || 'processing',
      video_url: result.video_url || null,
      estimated_time: result.estimated_time || 60
    })

  } catch (error) {
    return jsonResponse({
      error: 'Failed',
      message: error.message
    }, 500)
  }
}

async function handleVideoStatus(taskId) {
  try {
    if (!taskId) {
      return jsonResponse({ error: 'Task ID required' }, 400)
    }

    const statusResponse = await fetch(
      'https://api-integrations.appmedo.com/app-7r29gu4xs001/api-6LeB8Qe4rWGY/v1/videos/status/' + taskId,
      {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0'
        }
      }
    )

    if (!statusResponse.ok) {
      if (statusResponse.status === 404) {
        return jsonResponse({
          success: false,
          task_id: taskId,
          status: 'not_found'
        }, 404)
      }
      return jsonResponse({
        error: 'Status check failed'
      }, statusResponse.status)
    }

    const result = await statusResponse.json()

    return jsonResponse({
      success: true,
      task_id: taskId,
      status: result.status || 'unknown',
      progress: result.progress || 0,
      video_url: result.video_url || null
    })

  } catch (error) {
    return jsonResponse({
      error: 'Failed',
      message: error.message
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
      'Access-Control-Allow-Headers': 'Content-Type',
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
      'Access-Control-Allow-Origin': '*'
    }
  })
}

function getHTML() {
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AI Media Generator</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);min-height:100vh;padding:20px}
.container{max-width:1000px;margin:0 auto;background:rgba(255,255,255,0.98);border-radius:24px;padding:50px;box-shadow:0 25px 70px rgba(0,0,0,0.3)}
h1{font-size:3em;background:linear-gradient(135deg,#667eea,#764ba2);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:10px}
.subtitle{color:#666;margin-bottom:30px;font-size:1.2em}
.tabs{display:flex;gap:10px;margin-bottom:30px;border-bottom:2px solid #e0e0e0}
.tab{padding:15px 30px;background:none;border:none;border-bottom:3px solid transparent;font-size:16px;font-weight:600;cursor:pointer;color:#666}
.tab:hover{color:#667eea}
.tab.active{color:#667eea;border-bottom-color:#667eea}
.tab-content{display:none}
.tab-content.active{display:block}
.form-group{margin-bottom:25px}
label{display:block;margin-bottom:10px;font-weight:600;color:#333}
textarea,select{width:100%;padding:16px;border:2px solid #e0e0e0;border-radius:12px;font-size:16px;font-family:inherit}
textarea{min-height:120px;resize:vertical}
textarea:focus,select:focus{outline:none;border-color:#667eea}
.options-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px}
button.generate-btn{width:100%;padding:20px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;border:none;border-radius:12px;font-size:18px;font-weight:600;cursor:pointer}
button.generate-btn:hover{transform:translateY(-3px);box-shadow:0 15px 35px rgba(102,126,234,0.4)}
button.generate-btn:disabled{background:#ccc;cursor:not-allowed}
.result{margin-top:40px;padding:25px;border-radius:12px;display:none}
.result.show{display:block}
.result.success{background:#d4edda;border-left:5px solid #28a745}
.result.error{background:#f8d7da;border-left:5px solid #dc3545}
.result.processing{background:#fff3cd;border-left:5px solid #ffc107}
.result-image{width:100%;border-radius:12px;margin-top:20px;box-shadow:0 10px 30px rgba(0,0,0,0.2)}
.result-video{width:100%;border-radius:12px;margin-top:20px}
.progress-bar{width:100%;height:10px;background:rgba(0,0,0,0.1);border-radius:5px;overflow:hidden;margin:20px 0}
.progress-fill{height:100%;background:linear-gradient(90deg,#667eea,#764ba2);width:0%;transition:width 0.5s}
.download-btn{margin-top:15px;padding:15px 30px;background:#28a745;color:white;border:none;border-radius:10px;cursor:pointer}
.spinner{display:inline-block;width:20px;height:20px;border:3px solid rgba(255,255,255,.3);border-radius:50%;border-top-color:#fff;animation:spin 1s infinite;margin-right:10px}
@keyframes spin{to{transform:rotate(360deg)}}
</style>
</head>
<body>
<div class="container">
<h1>🎨 AI Media Generator</h1>
<p class="subtitle">Gemini Image + Medeo Video</p>

<div class="tabs">
<button class="tab active" onclick="switchTab('image')">🖼️ Image</button>
<button class="tab" onclick="switchTab('video')">🎬 Video</button>
</div>

<div id="imageTab" class="tab-content active">
<form id="imageForm">
<div class="form-group">
<label>Image Description</label>
<textarea id="imagePrompt" placeholder="A cute cat sitting on a windowsill..." required></textarea>
</div>
<div class="options-grid">
<div class="form-group">
<label>Width</label>
<select id="imageWidth">
<option value="512">512px</option>
<option value="768">768px</option>
<option value="1024" selected>1024px</option>
</select>
</div>
<div class="form-group">
<label>Height</label>
<select id="imageHeight">
<option value="512">512px</option>
<option value="768">768px</option>
<option value="1024" selected>1024px</option>
</select>
</div>
</div>
<button type="submit" class="generate-btn" id="imageBtn">Generate Image</button>
</form>
<div id="imageResult" class="result"></div>
</div>

<div id="videoTab" class="tab-content">
<form id="videoForm">
<div class="form-group">
<label>Video Description</label>
<textarea id="videoText" placeholder="A dog running on grass..." maxlength="500" required></textarea>
</div>
<div class="options-grid">
<div class="form-group">
<label>Duration</label>
<select id="videoDuration">
<option value="5">5s</option>
<option value="10" selected>10s</option>
<option value="15">15s</option>
</select>
</div>
<div class="form-group">
<label>Aspect Ratio</label>
<select id="videoAspect">
<option value="16:9" selected>16:9</option>
<option value="9:16">9:16</option>
<option value="1:1">1:1</option>
</select>
</div>
</div>
<button type="submit" class="generate-btn" id="videoBtn">Generate Video</button>
</form>
<div id="videoResult" class="result"></div>
</div>

</div>

<script>
let videoTaskId=null,pollInterval=null;

function switchTab(tab){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById(tab+'Tab').classList.add('active');
}

document.getElementById('imageForm').addEventListener('submit',async(e)=>{
  e.preventDefault();
  const prompt=document.getElementById('imagePrompt').value;
  const width=parseInt(document.getElementById('imageWidth').value);
  const height=parseInt(document.getElementById('imageHeight').value);
  const btn=document.getElementById('imageBtn');
  const result=document.getElementById('imageResult');

  btn.disabled=true;
  btn.innerHTML='<span class="spinner"></span> Generating...';
  result.className='result show processing';
  result.innerHTML='<div>Generating image with Gemini...</div>';

  try{
    const res=await fetch('/api/image/generate',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({prompt,width,height})
    });
    const data=await res.json();

    if(!res.ok) throw new Error(data.message||data.error);

    result.className='result show success';
    result.innerHTML='<div><strong>Success!</strong> Model: '+data.model+'</div>'+
      '<img src="'+data.image_url+'" class="result-image">'+
      '<button class="download-btn" onclick="window.open(\''+data.image_url+'\',\'_blank\')">Download</button>';
  }catch(err){
    result.className='result show error';
    result.innerHTML='<div><strong>Error:</strong> '+err.message+'</div>';
  }finally{
    btn.disabled=false;
    btn.innerHTML='Generate Image';
  }
});

document.getElementById('videoForm').addEventListener('submit',async(e)=>{
  e.preventDefault();
  const text=document.getElementById('videoText').value;
  const duration=parseInt(document.getElementById('videoDuration').value);
  const aspect_ratio=document.getElementById('videoAspect').value;
  const btn=document.getElementById('videoBtn');
  const result=document.getElementById('videoResult');

  btn.disabled=true;
  btn.innerHTML='<span class="spinner"></span> Generating...';
  result.className='result show processing';
  result.innerHTML='<div>Generating video...</div><div class="progress-bar"><div id="videoProgress" class="progress-fill"></div></div>';

  try{
    const res=await fetch('/api/text2video',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({text,duration,aspect_ratio})
    });
    const data=await res.json();

    if(!res.ok) throw new Error(data.message||data.error);

    videoTaskId=data.task_id;
    if(data.video_url){
      showVideo(data.video_url);
    }else{
      startVideoPolling(data.task_id);
    }
  }catch(err){
    result.className='result show error';
    result.innerHTML='<div><strong>Error:</strong> '+err.message+'</div>';
    btn.disabled=false;
    btn.innerHTML='Generate Video';
  }
});

function startVideoPolling(taskId){
  let progress=10;
  pollInterval=setInterval(async()=>{
    try{
      const res=await fetch('/api/text2video/status/'+taskId);
      const data=await res.json();

      if(data.status==='completed'&&data.video_url){
        clearInterval(pollInterval);
        showVideo(data.video_url);
      }else if(data.status==='failed'){
        clearInterval(pollInterval);
        document.getElementById('videoResult').className='result show error';
        document.getElementById('videoResult').innerHTML='<div>Failed</div>';
        document.getElementById('videoBtn').disabled=false;
        document.getElementById('videoBtn').innerHTML='Generate Video';
      }else{
        progress=Math.min(progress+5,95);
        const bar=document.getElementById('videoProgress');
        if(bar) bar.style.width=progress+'%';
      }
    }catch(err){
      console.error(err);
    }
  },3000);
}

function showVideo(url){
  const result=document.getElementById('videoResult');
  const bar=document.getElementById('videoProgress');
  if(bar) bar.style.width='100%';

  setTimeout(()=>{
    result.className='result show success';
    result.innerHTML='<div><strong>Success!</strong></div>'+
      '<video controls autoplay class="result-video"><source src="'+url+'" type="video/mp4"></video>'+
      '<button class="download-btn" onclick="window.open(\''+url+'\',\'_blank\')">Download</button>';
    document.getElementById('videoBtn').disabled=false;
    document.getElementById('videoBtn').innerHTML='Generate Video';
  },500);
}
</script>
</body>
</html>`
}
