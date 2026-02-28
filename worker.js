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
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
          }
        });
      }

      // API Key 验证（仅对 API 端点生效）
      if (url.pathname.startsWith('/v1/') || url.pathname.startsWith('/api/')) {
        const authResult = authenticateRequest(request, env);
        if (!authResult.success) {
          return new Response(JSON.stringify({
            error: {
              message: authResult.message,
              type: "authentication_error",
              code: "invalid_api_key"
            }
          }), {
            status: 401,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }
      }

      // OpenAI-compatible API endpoints
      if (url.pathname === '/v1/images/generations' && request.method === 'POST') {
        return await handleOpenAIImageGeneration(request);
      }
  
      // 模型列表端點
      if (url.pathname === '/v1/models' && request.method === 'GET') {
        return handleModelsEndpoint();
      }
  
      // 單一模型資訊端點（支援 /v1/models/{model_id}）
      const modelMatch = url.pathname.match(/^\/v1\/models\/([^\/]+)$/);
      if (modelMatch && request.method === 'GET') {
        return handleModelInfo(modelMatch[1]);
      }
  
      // 原有的 API 端點
      if (url.pathname === '/api/generate' && request.method === 'POST') {
        return await handleGenerate(request);
      }
  
      // API Key 管理端点
      if (url.pathname === '/api/verify-key' && request.method === 'POST') {
        return handleVerifyKey(request, env);
      }
  
      // 可用模型列表端點（供 Web UI 使用）
      if (url.pathname === '/api/models' && request.method === 'GET') {
        return handleApiModelsEndpoint();
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

// API Key 验证函数
function authenticateRequest(request, env) {
  // 如果没有设置 API_KEY 环境变量，跳过验证（开发模式）
  const requiredKey = env?.API_KEY;
  if (!requiredKey) {
    return { success: true };
  }

  // 从多个位置尝试获取 API Key
  let providedKey = null;

  // 1. Authorization header (Bearer token)
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    providedKey = authHeader.substring(7);
  }

  // 2. X-API-Key header
  if (!providedKey) {
    providedKey = request.headers.get('X-API-Key');
  }

  // 3. Query parameter
  if (!providedKey) {
    const url = new URL(request.url);
    providedKey = url.searchParams.get('api_key');
  }

  // 验证 API Key
  if (!providedKey) {
    return {
      success: false,
      message: 'Missing API key. Please provide via Authorization header, X-API-Key header, or api_key query parameter.'
    };
  }

  if (providedKey !== requiredKey) {
    return {
      success: false,
      message: 'Invalid API key.'
    };
  }

  return { success: true };
}

// 验证 API Key 端点（包含可用模型資訊）
function handleVerifyKey(request, env) {
  const authResult = authenticateRequest(request, env);

  const response = {
    valid: authResult.success,
    message: authResult.success ? 'API key is valid' : authResult.message
  };

  // 如果驗證成功，返回可用模型資訊
  if (authResult.success) {
    response.models = getAvailableModels().map(model => ({
      id: model.id,
      name: MODEL_REGISTRY[model.id]?.name || model.id,
      aliases: MODEL_REGISTRY[model.id]?.aliases || []
    }));
    response.default_model = DEFAULT_MODEL;
  }

  return new Response(JSON.stringify(response), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

// API 模型列表端點（供 Web UI 使用，返回完整配置）
function handleApiModelsEndpoint() {
  const models = Object.values(MODEL_REGISTRY)
    .filter(model => model.status === "active")
    .map(model => ({
      id: model.id,
      name: model.name,
      description: model.description,
      owned_by: model.owned_by,
      aliases: model.aliases,
      capabilities: model.capabilities,
      defaults: model.defaults
    }));

  return new Response(JSON.stringify({
    success: true,
    default_model: DEFAULT_MODEL,
    models: models
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

// ==================== 模型註冊表 ====================
const MODEL_REGISTRY = {
  "gemini-3-pro-image-preview": {
    id: "gemini-3-pro-image-preview",
    name: "Gemini 3 Pro Image Preview",
    owned_by: "google",
    description: "Google Gemini 3 Pro image generation model (preview)",
    apiUrl: "https://api-integrations.appmedo.com/app-7r29gu4xs001/api-Xa6JZ58oPMEa/v1beta/models/gemini-3-pro-image-preview:generateContent",
    capabilities: {
      imageGeneration: true,
      supportedSizes: ["256x256", "512x512", "1024x1024", "1792x1024", "1024x1792", "2048x2048", "4096x4096"],
      defaultSize: "1024x1024",
      maxImages: 10,
      supportsNegativePrompt: true,
      supportsSeed: true,
      supportsStyle: true,
      supportsQuality: true
    },
    defaults: {
      temperature: 1.0,
      top_p: 0.95,
      top_k: 40,
      max_output_tokens: 8192
    },
    aliases: ["gemini-3-pro", "gemini-3-image"],
    status: "active",
    created: 1677610602
  },
  "gemini-3.1-pro-preview": {
    id: "gemini-3.1-pro-preview",
    name: "Gemini 3.1 Pro Preview",
    owned_by: "google",
    description: "Google Gemini 3.1 Pro image generation model (preview)",
    apiUrl: "https://api-integrations.appmedo.com/app-7r29gu4xs001/api-Xa6JZ58oPMEa/v1beta/models/gemini-3.1-pro-preview:generateContent",
    capabilities: {
      imageGeneration: true,
      supportedSizes: ["256x256", "512x512", "1024x1024", "1792x1024", "1024x1792", "2048x2048", "4096x4096"],
      defaultSize: "1024x1024",
      maxImages: 10,
      supportsNegativePrompt: true,
      supportsSeed: true,
      supportsStyle: true,
      supportsQuality: true
    },
    defaults: {
      temperature: 1.0,
      top_p: 0.95,
      top_k: 40,
      max_output_tokens: 8192
    },
    aliases: ["gemini-3.1-pro", "gemini-3.1"],
    status: "active",
    created: 1704067200
  }
};

// 預設模型
const DEFAULT_MODEL = "gemini-3-pro-image-preview";

// ==================== 模型管理函數 ====================

// 取得模型配置（支援別名解析）
function getModelConfig(modelId) {
  // 直接匹配
  if (MODEL_REGISTRY[modelId]) {
    return MODEL_REGISTRY[modelId];
  }
  
  // 別名匹配
  for (const [id, config] of Object.entries(MODEL_REGISTRY)) {
    if (config.aliases && config.aliases.includes(modelId)) {
      return config;
    }
  }
  
  return null;
}

// 取得所有可用模型列表
function getAvailableModels() {
  return Object.values(MODEL_REGISTRY)
    .filter(model => model.status === "active")
    .map(model => ({
      id: model.id,
      object: "model",
      created: model.created,
      owned_by: model.owned_by,
      permission: [],
      root: model.id,
      parent: null
    }));
}

// 驗證模型是否支援指定尺寸
function validateModelSize(modelConfig, size) {
  if (!modelConfig || !modelConfig.capabilities || !modelConfig.capabilities.supportedSizes) {
    return { valid: false, fallback: "1024x1024" };
  }
  
  const supportedSizes = modelConfig.capabilities.supportedSizes;
  if (supportedSizes.includes(size)) {
    return { valid: true, size: size };
  }
  
  // 返回模型預設尺寸作為 fallback
  return {
    valid: false,
    fallback: modelConfig.capabilities.defaultSize || "1024x1024",
    message: `Size ${size} not supported by model ${modelConfig.id}. Using ${modelConfig.capabilities.defaultSize || "1024x1024"} instead.`
  };
}

// 取得模型 API URL
function getModelApiUrl(modelConfig) {
  return modelConfig?.apiUrl || MODEL_REGISTRY[DEFAULT_MODEL].apiUrl;
}

// ==================== 參數映射配置 ====================
const SIZE_MAP = {
  '256x256': '256px',
  '512x512': '512px',
  '1024x1024': '1K',
  '1792x1024': '1792x1024',
  '1024x1792': '1024x1792',
  '2048x2048': '2K',
  '4096x4096': '4K'
};

const STYLE_MAP = {
  'vivid': 'vibrant, colorful, ',
  'natural': 'natural, realistic, '
};

const QUALITY_MAP = {
	'standard': 0.8,
	'hd': 1.0
};

// ==================== 官方 Gemini API 格式常數 ====================

// 安全設定：關閉所有內容過濾
const SAFETY_SETTINGS = [
	{ category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
	{ category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
	{ category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
	{ category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
];

// 回應模式：支援文字和圖片
const RESPONSE_MODALITIES = ["TEXT", "IMAGE"];

// 寬高比映射（OpenAI 尺寸 -> Gemini aspectRatio）
const ASPECT_RATIO_MAP = {
	'256x256': '1:1',
	'512x512': '1:1',
	'1024x1024': '1:1',
	'1792x1024': '16:9',
	'1024x1792': '9:16',
	'2048x2048': '1:1',
	'4096x4096': '1:1'
};

// 官方格式圖片尺寸映射
const OFFICIAL_IMAGE_SIZE_MAP = {
	'256x256': '256px',
	'512x512': '512px',
	'1024x1024': '1K',
	'1792x1024': '1792x1024',
	'1024x1792': '1024x1792',
	'2048x2048': '2K',
	'4096x4096': '4K'
};

// ==================== 輔助函數 ====================

// 數值範圍限制
function clamp(value, min, max) {
  if (typeof value !== 'number' || isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

// 驗證尺寸參數
function validateSize(size) {
  const validSizes = Object.keys(SIZE_MAP);
  return validSizes.includes(size) ? size : '1024x1024';
}

// 參數驗證與標準化（支援多模型）
function validateAndNormalizeParams(body) {
  // 驗證必需參數
  if (!body.prompt) {
    const error = new Error("Missing required parameter: 'prompt'");
    error.type = "invalid_request_error";
    error.param = "prompt";
    throw error;
  }

  // 解析模型配置
  const requestedModel = body.model || DEFAULT_MODEL;
  const modelConfig = getModelConfig(requestedModel);
  
  // 如果模型不存在，使用預設模型並記錄警告
  let modelId = requestedModel;
  let modelWarning = null;
  if (!modelConfig) {
    modelWarning = `Model '${requestedModel}' not found. Using default model '${DEFAULT_MODEL}'.`;
    modelId = DEFAULT_MODEL;
  } else {
    modelId = modelConfig.id; // 使用正規化的模型 ID
  }

  // 取得模型預設值
  const modelDefaults = modelConfig?.defaults || MODEL_REGISTRY[DEFAULT_MODEL].defaults;
  const modelCapabilities = modelConfig?.capabilities || MODEL_REGISTRY[DEFAULT_MODEL].capabilities;

  // 驗證尺寸
  const requestedSize = body.size || modelCapabilities.defaultSize;
  const sizeValidation = modelConfig ? validateModelSize(modelConfig, requestedSize) : { valid: true, size: validateSize(requestedSize) };
  const finalSize = sizeValidation.valid ? sizeValidation.size : sizeValidation.fallback;

  return {
  	// 標準 OpenAI 參數
  	prompt: body.prompt,
  	n: clamp(body.n || 1, 1, modelCapabilities.maxImages || 10),
  	size: finalSize,
  	response_format: body.response_format || 'b64_json',
  	model: modelId,
 
  	// 新增 OpenAI 參數
  	quality: body.quality || 'standard',
  	style: body.style || 'natural',
  	seed: body.seed !== undefined ? Math.floor(clamp(body.seed, 0, 2147483647)) : undefined,
 
  	// Gemini 擴展參數（使用模型預設值）
  	temperature: clamp(body.temperature ?? modelDefaults.temperature, 0, 2),
  	top_p: clamp(body.top_p ?? modelDefaults.top_p, 0, 1),
  	top_k: clamp(body.top_k ?? modelDefaults.top_k, 1, 100),
  	max_output_tokens: body.max_output_tokens || modelDefaults.max_output_tokens,
  	negative_prompt: body.negative_prompt || null,
 
  	// 官方格式開關（支援駝峰式和蛇形式）
  	useOfficialFormat: body.useOfficialFormat === true || body.use_official_format === true,
 
  	// 模型配置資訊
  	modelConfig: modelConfig || MODEL_REGISTRY[DEFAULT_MODEL],
  	modelWarning: modelWarning,
  	sizeWarning: sizeValidation.message || null
  };
 }

// 構建 Gemini 請求（支援混合模式：向後兼容 + 官方格式）
function buildGeminiRequest(params) {
	// 構建提示詞（包含 style 前綴）
	let promptText = '';
	if (STYLE_MAP[params.style]) {
		promptText += STYLE_MAP[params.style];
	}
	promptText += `Generate an image: ${params.prompt}`;

	// 構建 contents
	const contents = [{
		role: 'user',
		parts: [{ text: promptText }]
	}];

	// 添加 negative_prompt
	if (params.negative_prompt) {
		contents[0].parts.push({
			text: `Negative prompt: ${params.negative_prompt}`
		});
	}

	// 基礎 generationConfig
	const generationConfig = {
		temperature: params.temperature,
		topP: params.top_p,
		topK: params.top_k,
		maxOutputTokens: params.max_output_tokens
	};

	// 添加 seed
	if (params.seed !== undefined) {
		generationConfig.seed = params.seed;
	}

	// 根據 quality 調整參數
	if (params.quality === 'hd') {
		generationConfig.temperature = Math.max(generationConfig.temperature, QUALITY_MAP['hd']);
	}

	// ==================== 混合模式：官方格式 vs 向後兼容 ====================
	if (params.useOfficialFormat) {
		// 官方 Gemini API 格式
		generationConfig.responseModalities = RESPONSE_MODALITIES;
		
		// 構建 imageConfig
		generationConfig.imageConfig = {
			aspectRatio: ASPECT_RATIO_MAP[params.size] || '1:1',
			imageSize: OFFICIAL_IMAGE_SIZE_MAP[params.size] || '2K'
		};

		// 返回官方格式請求（包含 safetySettings）
		return {
			contents,
			generationConfig,
			safetySettings: SAFETY_SETTINGS
		};
	} else {
		// 向後兼容模式：將尺寸信息嵌入提示詞
		const geminiSize = SIZE_MAP[params.size] || '2K';
		contents[0].parts[0].text += `. Image size: ${geminiSize}.`;

		return {
			contents,
			generationConfig
		};
	}
}

// 從 Gemini 響應中提取圖片數據
function extractImageData(geminiResponse) {
  if (!geminiResponse.candidates || !geminiResponse.candidates[0]) {
    return null;
  }

  const candidate = geminiResponse.candidates[0];
  if (!candidate.content || !candidate.content.parts || !candidate.content.parts[0]) {
    return null;
  }

  const text = candidate.content.parts[0].text;
  const regex = /!\[.*?\]\((data:image\/[^;]+;base64,([^)]+))\)/;
  const match = text.match(regex);

  if (match) {
    return {
      fullDataUrl: match[1],
      base64Only: match[2]
    };
  }

  return null;
}

// 構建 OpenAI 格式響應
function buildOpenAIResponse(imageData, params) {
  const openAIResponse = {
    created: Math.floor(Date.now() / 1000),
    data: []
  };

  for (let i = 0; i < params.n; i++) {
    const imageItem = {};

    if (params.response_format === 'b64_json') {
      imageItem.b64_json = imageData.base64Only;
    } else {
      imageItem.url = imageData.fullDataUrl;
    }

    // 添加擴展元數據
    imageItem.revised_prompt = params.prompt;
    if (params.seed !== undefined) {
      imageItem.seed = params.seed;
    }

    openAIResponse.data.push(imageItem);
  }

  return openAIResponse;
}

// ==================== OpenAI 兼容圖片生成端點 ====================
async function handleOpenAIImageGeneration(request) {
  try {
    const body = await request.json();

    // 參數驗證與標準化（支援多模型）
    const params = validateAndNormalizeParams(body);

    // 構建 Gemini 請求
    const geminiRequest = buildGeminiRequest(params);

    // 從模型配置取得 API URL
    const apiUrl = getModelApiUrl(params.modelConfig);

    // 調用 Gemini API
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify(geminiRequest)
    });

    const geminiResponse = await response.json();

    // 提取圖片數據
    const imageData = extractImageData(geminiResponse);

    if (imageData) {
      // 構建 OpenAI 格式響應
      const openAIResponse = buildOpenAIResponse(imageData, params);

      // 如果有警告訊息，加入響應中
      if (params.modelWarning || params.sizeWarning) {
        openAIResponse.warnings = [];
        if (params.modelWarning) openAIResponse.warnings.push(params.modelWarning);
        if (params.sizeWarning) openAIResponse.warnings.push(params.sizeWarning);
      }

      // 加入模型資訊
      openAIResponse.model = params.model;

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
        type: error.type || "server_error",
        param: error.param || null,
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
}

// ==================== 模型列表端點 ====================
function handleModelsEndpoint() {
  const models = {
    object: "list",
    data: getAvailableModels()
  };

  return new Response(JSON.stringify(models), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

// ==================== 單一模型資訊端點 ====================
function handleModelInfo(modelId) {
  const modelConfig = getModelConfig(modelId);
  
  if (!modelConfig) {
    return new Response(JSON.stringify({
      error: {
        message: `Model '${modelId}' not found`,
        type: "invalid_request_error",
        param: "model",
        code: "model_not_found"
      }
    }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  const modelInfo = {
    id: modelConfig.id,
    object: "model",
    created: modelConfig.created,
    owned_by: modelConfig.owned_by,
    permission: [],
    root: modelConfig.id,
    parent: null,
    // 擴展資訊
    name: modelConfig.name,
    description: modelConfig.description,
    capabilities: modelConfig.capabilities,
    aliases: modelConfig.aliases
  };

  return new Response(JSON.stringify(modelInfo), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

// ==================== 原始 API 端點（支持完整參數）====================
async function handleGenerate(request) {
  try {
    const body = await request.json();

    // 驗證必需參數
    if (!body.prompt) {
      return new Response(JSON.stringify({
        success: false,
        error: "Missing required parameter: 'prompt'"
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // 使用統一的參數驗證與標準化（支援多模型）
    const params = validateAndNormalizeParams(body);

    // 構建 Gemini 請求
    const geminiRequest = buildGeminiRequest(params);

    // 從模型配置取得 API URL
    const apiUrl = getModelApiUrl(params.modelConfig);

    const startTime = Date.now();

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify(geminiRequest)
    });

    const responseData = await response.json();
    const duration = Date.now() - startTime;

    // 提取圖片數據
    const imageData = extractImageData(responseData);

    // 構建響應
    const resultResponse = {
      success: response.ok,
      status: response.status,
      duration: duration,
      model: params.model,
      imageData: imageData ? imageData.fullDataUrl : null,
      request: {
        url: apiUrl,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: geminiRequest
      },
      response: responseData,
      // 添加參數信息
      params: {
        prompt: params.prompt,
        n: params.n,
        size: params.size,
        quality: params.quality,
        style: params.style,
        seed: params.seed,
        temperature: params.temperature,
        top_p: params.top_p,
        top_k: params.top_k,
        negative_prompt: params.negative_prompt
      }
    };

    // 添加警告訊息（如果有）
    if (params.modelWarning || params.sizeWarning) {
      resultResponse.warnings = [];
      if (params.modelWarning) resultResponse.warnings.push(params.modelWarning);
      if (params.sizeWarning) resultResponse.warnings.push(params.sizeWarning);
    }

    return new Response(JSON.stringify(resultResponse), {
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
<title>API Reverse Engineering - OpenAI Compatible</title>
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
input[type="text"],
input[type="password"],
input[type="number"],
textarea,
select {
  width: 100%;
  padding: 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.3s;
}
input[type="text"]:focus,
input[type="password"]:focus,
input[type="number"]:focus,
textarea:focus,
select:focus {
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
.api-key-section {
  background: #fff3cd;
  border: 2px solid #ffc107;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 20px;
}
.api-key-section h3 {
  color: #856404;
  margin-bottom: 10px;
  font-size: 1rem;
}
.api-key-status {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}
.status-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #6c757d;
}
.status-indicator.valid { background: #28a745; }
.status-indicator.invalid { background: #dc3545; }
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
.lang-switch {
position: fixed;
top: 20px;
right: 20px;
background: rgba(255,255,255,0.9);
border: none;
border-radius: 20px;
padding: 8px 16px;
cursor: pointer;
font-size: 14px;
color: #667eea;
font-weight: 600;
transition: all 0.3s;
z-index: 1000;
box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}
.lang-switch:hover {
background: white;
box-shadow: 0 4px 15px rgba(0,0,0,0.2);
transform: translateY(-2px);
}
.header { position: relative; }
</style>
</head>
<body>
<div class="container">
<div class="header">
<button class="lang-switch" id="langSwitch" onclick="toggleLanguage()">EN / 中</button>
<h1 id="mainTitle">🔧 API 逆向工程輸出站</h1>
<p id="subTitle">Gemini 3 Pro Image Preview - 完整 API 請求/響應分析</p>
<div>
<span class="api-badge">🔐 API Key Protected</span>
<span class="api-badge">✅ OpenAI Compatible</span>
<span class="api-badge">✅ REST API</span>
</div>
</div>

<div class="main-grid">
  <div class="card input-section">
  <h2 id="settingsTitle">📝 生成設定</h2>
  
  <!-- API Key Section -->
  <div class="api-key-section">
  <h3 id="apiKeyTitle">🔐 API Key（可選）</h3>
  <input
  type="password"
  id="apiKey"
  data-placeholder-zh="輸入您的 API Key（如果需要）"
  data-placeholder-en="Enter your API Key (if required)"
  placeholder="輸入您的 API Key（如果需要）"
  >
  <div class="api-key-status">
  <div class="status-indicator" id="keyStatus"></div>
  <span id="keyStatusText">未驗證</span>
  </div>
  </div>
  
  <form id="generateForm">
  <div class="form-group">
  <label for="prompt" id="promptLabel">圖片描述 (Prompt) *</label>
  <textarea
  id="prompt"
  data-placeholder-zh="例如：A futuristic city at sunset with flying cars..."
  data-placeholder-en="e.g., A futuristic city at sunset with flying cars..."
  placeholder="例如：A futuristic city at sunset with flying cars..."
  required
  ></textarea>
  </div>
  
  <div class="form-group">
  <label for="imageSize" id="sizeLabel">圖片尺寸 (Size)</label>
  <select id="imageSize">
  <option value="256x256">256x256</option>
  <option value="512x512">512x512</option>
  <option value="1024x1024" selected>1024x1024 (1K)</option>
  <option value="1792x1024">1792x1024 (Landscape)</option>
  <option value="1024x1792">1024x1792 (Portrait)</option>
  <option value="2048x2048">2048x2048 (2K)</option>
  <option value="4096x4096">4096x4096 (4K)</option>
  </select>
  </div>
  
  <div class="form-group">
  <label for="quality" id="qualityLabel">圖片品質 (Quality)</label>
  <select id="quality">
  <option value="standard" selected data-i18n-zh="Standard (標準)" data-i18n-en="Standard">Standard (標準)</option>
  <option value="hd" data-i18n-zh="HD (高品質)" data-i18n-en="HD (High Quality)">HD (高品質)</option>
  </select>
  </div>
  
  <div class="form-group">
  <label for="style" id="styleLabel">風格 (Style)</label>
  <select id="style">
  <option value="natural" selected data-i18n-zh="Natural (自然)" data-i18n-en="Natural">Natural (自然)</option>
  <option value="vivid" data-i18n-zh="Vivid (鮮豔)" data-i18n-en="Vivid">Vivid (鮮豔)</option>
  </select>
  </div>
  
  <div class="form-group">
  <label for="numImages" id="numImagesLabel">
  生成數量 (N)
  <span class="range-value" id="numImagesValue">1</span>
  </label>
  <input
  type="range"
  id="numImages"
  min="1"
  max="10"
  step="1"
  value="1"
  >
  </div>
  
  <div class="form-group">
  <label for="temperature" id="tempLabel">
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
  
  <div class="form-group">
  <label for="topP">
  Top P
  <span class="range-value" id="topPValue">0.95</span>
  </label>
  <input
  type="range"
  id="topP"
  min="0"
  max="1"
  step="0.05"
  value="0.95"
  >
  </div>
  
  <div class="form-group">
  <label for="topK">
  Top K
  <span class="range-value" id="topKValue">40</span>
  </label>
  <input
  type="range"
  id="topK"
  min="1"
  max="100"
  step="1"
  value="40"
  >
  </div>
  
  <div class="form-group">
  <label for="seed" id="seedLabel">隨機種子 (Seed)</label>
  <input
  type="number"
  id="seed"
  data-placeholder-zh="留空為隨機"
  data-placeholder-en="Leave empty for random"
  placeholder="留空為隨機"
  min="0"
  max="2147483647"
  >
  </div>
  
  <div class="form-group">
  <label for="negativePrompt" id="negPromptLabel">負面提示詞 (Negative Prompt)</label>
  <textarea
  id="negativePrompt"
  data-placeholder-zh="例如：blurry, low quality, distorted..."
  data-placeholder-en="e.g., blurry, low quality, distorted..."
  placeholder="例如：blurry, low quality, distorted..."
  style="min-height: 60px;"
  ></textarea>
  </div>
  
  <button type="submit" id="generateBtn">
  🚀 生成圖片並分析 API
  </button>
  </form>
  
  <div class="api-docs">
  <h3>🔌 OpenAI Compatible API</h3>
  <p style="margin-bottom: 10px;" id="apiDocsDesc">此服務提供 OpenAI 兼容的 API 端點：</p>
  <p><strong>POST</strong> <code>/v1/images/generations</code></p>
  <p><strong>GET</strong> <code>/v1/models</code></p>
  <p style="margin-top: 10px; font-size: 12px; color: #666;" id="apiKeyHint">
  💡 支持多種 API Key 傳遞方式
  </p>
  </div>
  </div>

  <div class="card output-section">
  <h2 id="outputTitle">📊 API 輸出分析</h2>
  
  <div class="output-tabs">
  <button class="tab active" data-tab="image" data-i18n-zh="生成圖片" data-i18n-en="Generated Image">生成圖片</button>
  <button class="tab" data-tab="info" data-i18n-zh="API 資訊" data-i18n-en="API Info">API 資訊</button>
  <button class="tab" data-tab="request" data-i18n-zh="請求內容" data-i18n-en="Request">請求內容</button>
  <button class="tab" data-tab="response" data-i18n-zh="響應內容" data-i18n-en="Response">響應內容</button>
  </div>
  
  <div id="outputContainer">
  <div class="tab-content active" data-content="image">
  <p style="text-align: center; color: #999; padding: 60px 20px;" id="startHint">
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
// ==================== i18n 語言系統 ====================
const i18n = {
zh: {
mainTitle: '🔧 API 逆向工程輸出站',
subTitle: 'Gemini 3 Pro Image Preview - 完整 API 請求/響應分析',
settingsTitle: '📝 生成設定',
apiKeyTitle: '🔐 API Key（可選）',
apiKeyPlaceholder: '輸入您的 API Key（如果需要）',
keyNotVerified: '未驗證',
keyValid: '✅ 有效',
keyInvalid: '❌ 無效',
keyNoNeed: '⚠️ 無需驗證',
promptLabel: '圖片描述 (Prompt) *',
promptPlaceholder: '例如：A futuristic city at sunset with flying cars...',
sizeLabel: '圖片尺寸 (Size)',
qualityLabel: '圖片品質 (Quality)',
qualityStandard: 'Standard (標準)',
qualityHD: 'HD (高品質)',
styleLabel: '風格 (Style)',
styleNatural: 'Natural (自然)',
styleVivid: 'Vivid (鮮豔)',
numImagesLabel: '生成數量 (N)',
tempLabel: '創造性 (Temperature)',
seedLabel: '隨機種子 (Seed)',
seedPlaceholder: '留空為隨機',
negPromptLabel: '負面提示詞 (Negative Prompt)',
negPromptPlaceholder: '例如：blurry, low quality, distorted...',
generateBtn: '🚀 生成圖片並分析 API',
generatingBtn: '⏳ 生成中...',
apiDocsDesc: '此服務提供 OpenAI 兼容的 API 端點：',
apiKeyHint: '💡 支持多種 API Key 傳遞方式',
outputTitle: '📊 API 輸出分析',
tabImage: '生成圖片',
tabInfo: 'API 資訊',
tabRequest: '請求內容',
tabResponse: '響應內容',
startHint: '👆 填寫左側表單並點擊生成按鈕開始',
loadingText: '正在調用 API 並生成圖片...',
errorPrefix: '❌ 錯誤：',
statusLabel: '狀態：',
responseTimeLabel: '響應時間：',
imageDataLabel: '圖片數據：',
imageExtracted: '✅ 已提取',
imageNotFound: '❌ 未找到',
imageSuccess: '✅ 圖片生成成功',
imageExtractedNote: '圖片已從 Markdown 格式中提取並顯示',
apiSuccessNoImage: '⚠️ API 響應成功，但未找到圖片數據。<br>請查看「響應內容」標籤頁獲取完整響應。',
apiFailed: '❌ API 調用失敗',
errorLabel: '錯誤：',
unknownError: '未知錯誤',
apiKeyInvalid: '❌ API Key 無效或缺失。請檢查您的 API Key 設定。'
},
en: {
mainTitle: '🔧 API Reverse Engineering Gateway',
subTitle: 'Gemini 3 Pro Image Preview - Full API Request/Response Analysis',
settingsTitle: '📝 Generation Settings',
apiKeyTitle: '🔐 API Key (Optional)',
apiKeyPlaceholder: 'Enter your API Key (if required)',
keyNotVerified: 'Not Verified',
keyValid: '✅ Valid',
keyInvalid: '❌ Invalid',
keyNoNeed: '⚠️ No Verification Needed',
promptLabel: 'Image Description (Prompt) *',
promptPlaceholder: 'e.g., A futuristic city at sunset with flying cars...',
sizeLabel: 'Image Size',
qualityLabel: 'Image Quality',
qualityStandard: 'Standard',
qualityHD: 'HD (High Quality)',
styleLabel: 'Style',
styleNatural: 'Natural',
styleVivid: 'Vivid',
numImagesLabel: 'Number of Images (N)',
tempLabel: 'Creativity (Temperature)',
seedLabel: 'Random Seed',
seedPlaceholder: 'Leave empty for random',
negPromptLabel: 'Negative Prompt',
negPromptPlaceholder: 'e.g., blurry, low quality, distorted...',
generateBtn: '🚀 Generate Image & Analyze API',
generatingBtn: '⏳ Generating...',
apiDocsDesc: 'This service provides OpenAI-compatible API endpoints:',
apiKeyHint: '💡 Multiple API Key delivery methods supported',
outputTitle: '📊 API Output Analysis',
tabImage: 'Generated Image',
tabInfo: 'API Info',
tabRequest: 'Request',
tabResponse: 'Response',
startHint: '👆 Fill in the form on the left and click generate to start',
loadingText: 'Calling API and generating image...',
errorPrefix: '❌ Error: ',
statusLabel: 'Status: ',
responseTimeLabel: 'Response Time: ',
imageDataLabel: 'Image Data: ',
imageExtracted: '✅ Extracted',
imageNotFound: '❌ Not Found',
imageSuccess: '✅ Image Generated Successfully',
imageExtractedNote: 'Image extracted from Markdown format and displayed',
apiSuccessNoImage: '⚠️ API response successful, but no image data found.<br>Check the "Response" tab for full response.',
apiFailed: '❌ API Call Failed',
errorLabel: 'Error: ',
unknownError: 'Unknown Error',
apiKeyInvalid: '❌ API Key is invalid or missing. Please check your API Key settings.'
}
};

// 當前語言
let currentLang = localStorage.getItem('lang') || 'zh';

// 切換語言
function toggleLanguage() {
currentLang = currentLang === 'zh' ? 'en' : 'zh';
localStorage.setItem('lang', currentLang);
applyLanguage();
}

// 應用語言
function applyLanguage() {
const lang = i18n[currentLang];

// 更新標題
document.getElementById('mainTitle').textContent = lang.mainTitle;
document.getElementById('subTitle').textContent = lang.subTitle;
document.getElementById('settingsTitle').textContent = lang.settingsTitle;
document.getElementById('apiKeyTitle').textContent = lang.apiKeyTitle;
document.getElementById('outputTitle').textContent = lang.outputTitle;

// 更新標籤
document.getElementById('promptLabel').textContent = lang.promptLabel;
document.getElementById('sizeLabel').textContent = lang.sizeLabel;
document.getElementById('qualityLabel').textContent = lang.qualityLabel;
document.getElementById('styleLabel').textContent = lang.styleLabel;
document.getElementById('numImagesLabel').childNodes[0].textContent = lang.numImagesLabel + ' ';
document.getElementById('tempLabel').childNodes[0].textContent = lang.tempLabel + ' ';
document.getElementById('seedLabel').textContent = lang.seedLabel;
document.getElementById('negPromptLabel').textContent = lang.negPromptLabel;

// 更新 placeholder
document.getElementById('apiKey').placeholder = lang.apiKeyPlaceholder;
document.getElementById('prompt').placeholder = lang.promptPlaceholder;
document.getElementById('seed').placeholder = lang.seedPlaceholder;
document.getElementById('negativePrompt').placeholder = lang.negPromptPlaceholder;

// 更新選項
const qualitySelect = document.getElementById('quality');
qualitySelect.options[0].text = lang.qualityStandard;
qualitySelect.options[1].text = lang.qualityHD;

const styleSelect = document.getElementById('style');
styleSelect.options[0].text = lang.styleNatural;
styleSelect.options[1].text = lang.styleVivid;

// 更新按鈕
const generateBtn = document.getElementById('generateBtn');
if (!generateBtn.disabled) {
generateBtn.textContent = lang.generateBtn;
}

// 更新 API 文檔
document.getElementById('apiDocsDesc').textContent = lang.apiDocsDesc;
document.getElementById('apiKeyHint').textContent = lang.apiKeyHint;

// 更新標籤頁
document.querySelectorAll('.tab').forEach(tab => {
const key = tab.dataset.tab;
const i18nKey = 'tab' + key.charAt(0).toUpperCase() + key.slice(1);
if (lang[i18nKey]) {
tab.textContent = lang[i18nKey];
}
});

// 更新開始提示
document.getElementById('startHint').textContent = lang.startHint;

// 更新 HTML lang 屬性
document.documentElement.lang = currentLang === 'zh' ? 'zh-TW' : 'en';

// 更新 API Key 狀態文字
updateKeyStatusText();
}

// 更新 Key 狀態文字
function updateKeyStatusText() {
const keyStatusText = document.getElementById('keyStatusText');
const currentText = keyStatusText.textContent;
const lang = i18n[currentLang];

if (currentText.includes('未驗證') || currentText === 'Not Verified') {
keyStatusText.textContent = lang.keyNotVerified;
} else if (currentText.includes('有效') || currentText === '✅ Valid') {
keyStatusText.textContent = lang.keyValid;
} else if (currentText.includes('無效') || currentText === '❌ Invalid') {
keyStatusText.textContent = lang.keyInvalid;
} else if (currentText.includes('無需') || currentText === '⚠️ No Verification Needed') {
keyStatusText.textContent = lang.keyNoNeed;
}
}

// 頁面載入時應用語言
document.addEventListener('DOMContentLoaded', () => {
applyLanguage();
});

// ==================== API Key 管理 ====================
const apiKeyInput = document.getElementById('apiKey');
const keyStatus = document.getElementById('keyStatus');
const keyStatusText = document.getElementById('keyStatusText');

// 从 localStorage 加载 API Key
const savedApiKey = localStorage.getItem('apiKey');
if (savedApiKey) {
apiKeyInput.value = savedApiKey;
verifyApiKey(savedApiKey);
}

// API Key 输入变化时
apiKeyInput.addEventListener('change', async (e) => {
const apiKey = e.target.value;
if (apiKey) {
localStorage.setItem('apiKey', apiKey);
await verifyApiKey(apiKey);
} else {
localStorage.removeItem('apiKey');
keyStatus.className = 'status-indicator';
keyStatusText.textContent = i18n[currentLang].keyNotVerified;
}
});

// 验证 API Key
async function verifyApiKey(apiKey) {
try {
const response = await fetch('/api/verify-key', {
method: 'POST',
headers: {
'Content-Type': 'application/json',
'Authorization': 'Bearer ' + apiKey
}
});

const data = await response.json();

if (data.valid) {
keyStatus.className = 'status-indicator valid';
keyStatusText.textContent = i18n[currentLang].keyValid;
} else {
keyStatus.className = 'status-indicator invalid';
keyStatusText.textContent = i18n[currentLang].keyInvalid;
}
} catch (error) {
keyStatus.className = 'status-indicator';
keyStatusText.textContent = i18n[currentLang].keyNoNeed;
}
}

// 获取 API Key
function getApiKey() {
  return apiKeyInput.value || localStorage.getItem('apiKey') || '';
}

// ==================== 滑桿事件綁定 ====================

// Temperature 滑桿
const tempSlider = document.getElementById('temperature');
const tempValue = document.getElementById('tempValue');
tempSlider.addEventListener('input', (e) => {
  tempValue.textContent = e.target.value;
});

// Top P 滑桿
const topPSlider = document.getElementById('topP');
const topPValue = document.getElementById('topPValue');
topPSlider.addEventListener('input', (e) => {
  topPValue.textContent = e.target.value;
});

// Top K 滑桿
const topKSlider = document.getElementById('topK');
const topKValue = document.getElementById('topKValue');
topKSlider.addEventListener('input', (e) => {
  topKValue.textContent = e.target.value;
});

// 生成數量滑桿
const numImagesSlider = document.getElementById('numImages');
const numImagesValue = document.getElementById('numImagesValue');
numImagesSlider.addEventListener('input', (e) => {
  numImagesValue.textContent = e.target.value;
});

// ==================== Tab 切換 ====================
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.dataset.tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.querySelector('[data-content="' + tabName + '"]').classList.add('active');
  });
});

// ==================== 表單提交 ====================
document.getElementById('generateForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  // 收集所有參數
  const prompt = document.getElementById('prompt').value;
  const size = document.getElementById('imageSize').value;
  const quality = document.getElementById('quality').value;
  const style = document.getElementById('style').value;
  const n = parseInt(document.getElementById('numImages').value);
  const temperature = parseFloat(document.getElementById('temperature').value);
  const top_p = parseFloat(document.getElementById('topP').value);
  const top_k = parseInt(document.getElementById('topK').value);
  const seedValue = document.getElementById('seed').value;
  const negative_prompt = document.getElementById('negativePrompt').value || null;
  
  const generateBtn = document.getElementById('generateBtn');
  const apiKey = getApiKey();

  generateBtn.disabled = true;
  generateBtn.textContent = i18n[currentLang].generatingBtn;
  
  showLoading();
  
  try {
  const headers = {
  'Content-Type': 'application/json'
  };
  
  // 添加 API Key（如果有）
  if (apiKey) {
  headers['Authorization'] = 'Bearer ' + apiKey;
  }
  
  // 構建請求體
  const requestBody = {
  prompt,
  n,
  size,
  quality,
  style,
  temperature,
  top_p,
  top_k
  };
  
  // 添加可選參數
  if (seedValue) {
  requestBody.seed = parseInt(seedValue);
  }
  if (negative_prompt) {
  requestBody.negative_prompt = negative_prompt;
  }
  
  const response = await fetch('/api/generate', {
  method: 'POST',
  headers: headers,
  body: JSON.stringify(requestBody)
  });
  
  const data = await response.json();
  
  if (response.status === 401) {
  showError(i18n[currentLang].apiKeyInvalid);
  } else {
  displayResults(data);
  }
  
  } catch (error) {
  showError(error.message);
  } finally {
  generateBtn.disabled = false;
  generateBtn.textContent = i18n[currentLang].generateBtn;
  }
  });
  
  function showLoading() {
  const html = '<div class="loading"><div class="spinner"></div><p>' + i18n[currentLang].loadingText + '</p></div>';
  document.querySelectorAll('.tab-content').forEach(el => el.innerHTML = html);
  }
  
  function showError(message) {
  const html = '<div class="error-message"><strong>' + i18n[currentLang].errorPrefix + '</strong> ' + message + '</div>';
  document.querySelector('[data-content="image"]').innerHTML = html;
  }
  
  function displayResults(data) {
  const lang = i18n[currentLang];
  const statusClass = data.success ? 'status-success' : 'status-error';
  const infoHtml = '<div class="api-info">' +
  '<div class="api-info-row"><span class="api-info-label">' + lang.statusLabel + '</span>' +
  '<span class="api-info-value ' + statusClass + '">' + data.status + ' ' + (data.success ? '✓' : '✗') + '</span></div>' +
  '<div class="api-info-row"><span class="api-info-label">' + lang.responseTimeLabel + '</span>' +
  '<span class="api-info-value">' + data.duration + 'ms</span></div>' +
  '<div class="api-info-row"><span class="api-info-label">' + lang.imageDataLabel + '</span>' +
  '<span class="api-info-value">' + (data.imageData ? lang.imageExtracted : lang.imageNotFound) + '</span></div>' +
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
  '<div class="success-badge">' + lang.imageSuccess + '</div>' +
  '<p style="margin-top: 15px; color: #666; font-size: 14px;">' + lang.imageExtractedNote + '</p>' +
  '</div>';
  } else if (data.success) {
  imageHtml = '<div class="error-message">' + lang.apiSuccessNoImage + '</div>';
  } else {
  imageHtml = '<div class="error-message">' + lang.apiFailed + '<br><strong>' + lang.errorLabel + '</strong>' +
  (data.error || lang.unknownError) + '</div>';
  }
  document.querySelector('[data-content="image"]').innerHTML = imageHtml;
  }

function syntaxHighlight(json) {
  if (json === undefined || json === null) {
    return '<span style="color:#569cd6">null</span>';
  }
  json = json.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>');
  return json.replace(/("([^"]*)"([:]?))/g, '<span style="color:#9cdcfe">$1</span>')
    .replace(/([:]\\s*)(\\"[^\\"]*\\")/g, '$1<span style="color:#ce9178">$2</span>')
    .replace(/([:]\\s*)([0-9.]+)/g, '$1<span style="color:#b5cea8">$2</span>')
    .replace(/([:]\\s*)(true|false)/g, '$1<span style="color:#569cd6">$2</span>')
    .replace(/([:]\\s*)(null)/g, '$1<span style="color:#569cd6">$2</span>');
}
</script>
</body>
</html>`;
}
