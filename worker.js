export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);

      // CORS 预检请求
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          }
        });
      }

      // OpenAI-compatible API endpoints
      if (url.pathname === '/v1/images/generations' && request.method === 'POST') {
        return await handleOpenAIImageGeneration(request);
      }

      if (url.pathname === '/v1/models' && request.method === 'GET') {
        return handleModelsEndpoint();
      }

      // 原有的 API 端點
      if (url.pathname === '/api/generate' && request.method === 'POST') {
        return await handleGenerate(request);
      }

      // 返回 HTML UI
      return new Response(getHTML(), {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' }
      });

    } catch (error) {
      console.error('Worker Error:', error);
      return new Response(JSON.stringify({
        error: {
          message: error.message,
          stack: error.stack,
          type: 'worker_error'
        }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};

// OpenAI-compatible 图片生成端点
async function handleOpenAIImageGeneration(request) {
  try {
    const body = await request.json();

    const {
      prompt,
      n = 1,
      size = "1024x1024",
      response_format = "b64_json",
      model = "gemini-3-pro-image-preview"
    } = body;

    if (!prompt) {
      return new Response(JSON.stringify({
        error: {
          message: "Missing required parameter: 'prompt'",
          type: "invalid_request_error",
          param: "prompt",
          code: null
        }
      }), {
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const sizeMap = {
      "1024x1024": "1K",
      "2048x2048": "2K",
      "4096x4096": "4K"
    };
    const geminiSize = sizeMap[size] || "2K";

    const apiUrl = "https://api-integrations.appmedo.com/app-7r29gu4xs001/api-Xa6JZ58oPMEa/v1beta/models/gemini-3-pro-image-preview:generateContent";

    const geminiRequest = {
      contents: [{
        role: "user",
        parts: [{
          text: `Generate an image: ${prompt}. Image size: ${geminiSize}.`
        }]
      }],
      generationConfig: {
        temperature: 1.0,
        topP: 0.95,
        maxOutputTokens: 8192
      }
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify(geminiRequest)
    });

    const geminiResponse = await response.json();

    let imageData = null;
    if (response.ok && geminiResponse.candidates && geminiResponse.candidates[0]) {
      const candidate = geminiResponse.candidates[0];
      if (candidate.content && candidate.content.parts && candidate.content.parts[0]) {
        const text = candidate.content.parts[0].text;
        // 修复：使用正确的正则表达式转义
        const regex = /!\[.*?\]\((data:image\/[^;]+;base64,([^)]+))\)/;
        const match = text.match(regex);
        if (match) {
          imageData = {
            fullDataUrl: match[1],
            base64Only: match[2]
          };
        }
      }
    }

    if (imageData) {
      const openAIResponse = {
        created: Math.floor(Date.now() / 1000),
        data: []
      };

      for (let i = 0; i < n; i++) {
        if (response_format === "b64_json") {
          openAIResponse.data.push({
            b64_json: imageData.base64Only
          });
        } else if (response_format === "url") {
          openAIResponse.data.push({
            url: imageData.fullDataUrl
          });
        }
      }

      return new Response(JSON.stringify(openAIResponse), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } else {
      return new Response(JSON.stringify({
        error: {
          message: geminiResponse.error?.message || "Failed to generate image",
          type: "api_error",
          param: null,
          code: response.status
        }
      }), {
        status: response.status || 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

  } catch (error) {
    console.error('OpenAI API Error:', error);
    return new Response(JSON.stringify({
      error: {
        message: error.message,
        type: "server_error",
        param: null,
        code: null
      }
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

function handleModelsEndpoint() {
  const models = {
    object: "list",
    data: [
      {
        id: "gemini-3-pro-image-preview",
        object: "model",
        created: 1677610602,
        owned_by: "google",
        permission: [],
        root: "gemini-3-pro-image-preview",
        parent: null
      }
    ]
  };

  return new Response(JSON.stringify(models), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

async function handleGenerate(request) {
  try {
    const body = await request.json();
    const { prompt, imageSize = "2K", temperature = 1.0 } = body;

    const apiUrl = "https://api-integrations.appmedo.com/app-7r29gu4xs001/api-Xa6JZ58oPMEa/v1beta/models/gemini-3-pro-image-preview:generateContent";

    const apiRequest = {
      contents: [{
        role: "user",
        parts: [{
          text: `Generate an image: ${prompt}. Image size: ${imageSize}. Temperature: ${temperature}`
        }]
      }],
      generationConfig: {
        temperature: temperature,
        topP: 0.95,
        maxOutputTokens: 8192
      }
    };

    const startTime = Date.now();

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify(apiRequest)
    });

    const responseData = await response.json();
    const duration = Date.now() - startTime;

    let extractedImageData = null;
    if (response.ok && responseData.candidates && responseData.candidates[0]) {
      const candidate = responseData.candidates[0];
      if (candidate.content && candidate.content.parts && candidate.content.parts[0]) {
        const text = candidate.content.parts[0].text;
        const regex = /!\[.*?\]\((data:image\/[^;]+;base64,[^)]+)\)/;
        const match = text.match(regex);
        if (match) {
          extractedImageData = match[1];
        }
      }
    }

    return new Response(JSON.stringify({
      success: response.ok,
      status: response.status,
      duration: duration,
      imageData: extractedImageData,
      request: {
        url: apiUrl,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: apiRequest
      },
      response: responseData
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Generate API Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

function getHTML() {
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API 逆向工程輸出站 - OpenAI Compatible</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    .header { text-align: center; color: white; margin-bottom: 30px; }
    .header h1 {
      font-size: 2.5rem;
      margin-bottom: 10px;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
    }
    .header p { font-size: 1.1rem; opacity: 0.9; }
    .api-badge {
      display: inline-block;
      background: rgba(255,255,255,0.2);
      padding: 5px 15px;
      border-radius: 20px;
      margin: 5px;
      font-size: 0.9rem;
    }
    .main-grid {
      display: grid;
      grid-template-columns: 400px 1fr;
      gap: 20px;
      align-items: start;
    }
    .card {
      background: white;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    }
    .input-section { position: sticky; top: 20px; }
    .input-section h2 { margin-bottom: 20px; color: #333; font-size: 1.5rem; }
    .form-group { margin-bottom: 20px; }
    label {
      display: block;
      margin-bottom: 8px;
      color: #555;
      font-weight: 600;
    }
    input[type="text"], textarea, select {
      width: 100%;
      padding: 12px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      font-size: 14px;
      transition: border-color 0.3s;
    }
    input[type="text"]:focus, textarea:focus, select:focus {
      outline: none;
      border-color: #667eea;
    }
    textarea {
      min-height: 100px;
      resize: vertical;
      font-family: inherit;
    }
    input[type="range"] { width: 100%; }
    .range-value {
      display: inline-block;
      margin-left: 10px;
      color: #667eea;
      font-weight: bold;
    }
    button {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
    }
    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
    .api-docs {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 15px;
      margin-top: 20px;
      font-size: 13px;
    }
    .api-docs h3 { margin-bottom: 10px; color: #333; }
    .api-docs code {
      background: #e9ecef;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
    }
    .output-section h2 { margin-bottom: 20px; color: #333; font-size: 1.5rem; }
    .output-tabs {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
      border-bottom: 2px solid #e0e0e0;
    }
    .tab {
      padding: 10px 20px;
      background: none;
      border: none;
      color: #666;
      font-weight: 600;
      cursor: pointer;
      transition: color 0.3s;
      width: auto;
    }
    .tab.active {
      color: #667eea;
      border-bottom: 3px solid #667eea;
      margin-bottom: -2px;
    }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .api-info {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 15px;
    }
    .api-info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 14px;
    }
    .api-info-label { font-weight: 600; color: #555; }
    .api-info-value {
      color: #667eea;
      font-family: 'Courier New', monospace;
    }
    .status-success { color: #10b981; }
    .status-error { color: #ef4444; }
    .json-viewer {
      background: #1e1e1e;
      color: #d4d4d4;
      border-radius: 8px;
      padding: 15px;
      overflow-x: auto;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      max-height: 500px;
      overflow-y: auto;
    }
    .image-result { text-align: center; }
    .image-result img {
      max-width: 100%;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      margin-top: 15px;
    }
    .loading { text-align: center; padding: 40px; color: #667eea; }
    .spinner {
      border: 4px solid #f3f3f3;
      border-top: 4px solid #667eea;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 0 auto 15px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .error-message {
      background: #fee;
      color: #c33;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 15px;
    }
    .success-badge {
      display: inline-block;
      background: #10b981;
      color: white;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      margin-top: 10px;
    }
    @media (max-width: 1024px) {
      .main-grid { grid-template-columns: 1fr; }
      .input-section { position: static; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔧 API 逆向工程輸出站</h1>
      <p>Gemini 3 Pro Image Preview - 完整 API 請求/響應分析</p>
      <div>
        <span class="api-badge">✅ OpenAI Compatible</span>
        <span class="api-badge">✅ REST API</span>
        <span class="api-badge">✅ Web UI</span>
      </div>
    </div>

    <div class="main-grid">
      <div class="card input-section">
        <h2>📝 生成設定</h2>
        <form id="generateForm">
          <div class="form-group">
            <label for="prompt">圖片描述 (Prompt)</label>
            <textarea 
              id="prompt" 
              placeholder="例如：A futuristic city at sunset with flying cars..."
              required
            ></textarea>
          </div>

          <div class="form-group">
            <label for="imageSize">圖片尺寸</label>
            <select id="imageSize">
              <option value="1K">1K (1024px)</option>
              <option value="2K" selected>2K (2048px)</option>
              <option value="4K">4K (4096px)</option>
            </select>
          </div>

          <div class="form-group">
            <label for="temperature">
              創造性 (Temperature)
              <span class="range-value" id="tempValue">1.0</span>
            </label>
            <input 
              type="range" 
              id="temperature" 
              min="0" 
              max="2" 
              step="0.1" 
              value="1.0"
            >
          </div>

          <button type="submit" id="generateBtn">
            🚀 生成圖片並分析 API
          </button>
        </form>

        <div class="api-docs">
          <h3>🔌 OpenAI Compatible API</h3>
          <p style="margin-bottom: 10px;">此服務提供 OpenAI 兼容的 API 端點：</p>
          <p><strong>POST</strong> <code>/v1/images/generations</code></p>
          <p><strong>GET</strong> <code>/v1/models</code></p>
        </div>
      </div>

      <div class="card output-section">
        <h2>📊 API 輸出分析</h2>

        <div class="output-tabs">
          <button class="tab active" data-tab="image">生成圖片</button>
          <button class="tab" data-tab="info">API 資訊</button>
          <button class="tab" data-tab="request">請求內容</button>
          <button class="tab" data-tab="response">響應內容</button>
        </div>

        <div id="outputContainer">
          <div class="tab-content active" data-content="image">
            <p style="text-align: center; color: #999; padding: 60px 20px;">
              👆 填寫左側表單並點擊生成按鈕開始
            </p>
          </div>
          <div class="tab-content" data-content="info"></div>
          <div class="tab-content" data-content="request"></div>
          <div class="tab-content" data-content="response"></div>
        </div>
      </div>
    </div>
  </div>

  <script>
    const tempSlider = document.getElementById('temperature');
    const tempValue = document.getElementById('tempValue');
    tempSlider.addEventListener('input', (e) => {
      tempValue.textContent = e.target.value;
    });

    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.querySelector('[data-content="' + tabName + '"]').classList.add('active');
      });
    });

    document.getElementById('generateForm').addEventListener('submit', async (e) => {
      e.preventDefault();

      const prompt = document.getElementById('prompt').value;
      const imageSize = document.getElementById('imageSize').value;
      const temperature = parseFloat(document.getElementById('temperature').value);
      const generateBtn = document.getElementById('generateBtn');

      generateBtn.disabled = true;
      generateBtn.textContent = '⏳ 生成中...';

      showLoading();

      try {
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, imageSize, temperature })
        });

        const data = await response.json();
        displayResults(data);

      } catch (error) {
        showError(error.message);
      } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = '🚀 生成圖片並分析 API';
      }
    });

    function showLoading() {
      const html = '<div class="loading"><div class="spinner"></div><p>正在調用 API 並生成圖片...</p></div>';
      document.querySelectorAll('.tab-content').forEach(el => el.innerHTML = html);
    }

    function showError(message) {
      const html = '<div class="error-message"><strong>❌ 錯誤：</strong> ' + message + '</div>';
      document.querySelector('[data-content="image"]').innerHTML = html;
    }

    function displayResults(data) {
      const statusClass = data.success ? 'status-success' : 'status-error';
      const infoHtml = '<div class="api-info">' +
        '<div class="api-info-row"><span class="api-info-label">狀態：</span>' +
        '<span class="api-info-value ' + statusClass + '">' + data.status + ' ' + (data.success ? '✓' : '✗') + '</span></div>' +
        '<div class="api-info-row"><span class="api-info-label">響應時間：</span>' +
        '<span class="api-info-value">' + data.duration + 'ms</span></div>' +
        '<div class="api-info-row"><span class="api-info-label">圖片數據：</span>' +
        '<span class="api-info-value">' + (data.imageData ? '✅ 已提取' : '❌ 未找到') + '</span></div>' +
        '</div>';
      document.querySelector('[data-content="info"]').innerHTML = infoHtml;

      const requestHtml = '<div class="json-viewer">' + syntaxHighlight(JSON.stringify(data.request, null, 2)) + '</div>';
      document.querySelector('[data-content="request"]').innerHTML = requestHtml;

      const responseHtml = '<div class="json-viewer">' + syntaxHighlight(JSON.stringify(data.response, null, 2)) + '</div>';
      document.querySelector('[data-content="response"]').innerHTML = responseHtml;

      let imageHtml = '';
      if (data.success && data.imageData) {
        imageHtml = '<div class="image-result">' +
          '<img src="' + data.imageData + '" alt="Generated Image" />' +
          '<div class="success-badge">✅ 圖片生成成功</div>' +
          '<p style="margin-top: 15px; color: #666; font-size: 14px;">圖片已從 Markdown 格式中提取並顯示</p>' +
          '</div>';
      } else if (data.success) {
        imageHtml = '<div class="error-message">⚠️ API 響應成功，但未找到圖片數據。<br>請查看「響應內容」標籤頁獲取完整響應。</div>';
      } else {
        imageHtml = '<div class="error-message">❌ API 調用失敗<br><strong>錯誤：</strong>' + 
          (data.error || '未知錯誤') + '</div>';
      }
      document.querySelector('[data-content="image"]').innerHTML = imageHtml;
    }

    function syntaxHighlight(json) {
      json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return json.replace(/("([^"]*)"([:]?))/g, '<span style="color:#9cdcfe">$1</span>')
                .replace(/([:]\s*)(\"[^\"]*\")/g, '$1<span style="color:#ce9178">$2</span>')
                .replace(/([:]\s*)([0-9.]+)/g, '$1<span style="color:#b5cea8">$2</span>')
                .replace(/([:]\s*)(true|false)/g, '$1<span style="color:#569cd6">$2</span>')
                .replace(/([:]\s*)(null)/g, '$1<span style="color:#569cd6">$2</span>');
    }
  </script>
</body>
</html>`;
}
