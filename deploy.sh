#!/bin/bash
# 一鍵部署腳本

echo "🚀 開始部署 API 逆向工程輸出站..."

# 檢查 wrangler 是否安裝
if ! command -v wrangler &> /dev/null
then
    echo "❌ Wrangler CLI 未安裝"
    echo "📦 正在安裝 Wrangler..."
    npm install -g wrangler
fi

# 登入檢查
echo "🔐 檢查登入狀態..."
wrangler whoami || wrangler login

# 部署
echo "📤 開始部署到 Cloudflare Workers..."
wrangler deploy

echo "✅ 部署完成！"
echo "🌐 訪問你的 Worker URL 開始使用"
