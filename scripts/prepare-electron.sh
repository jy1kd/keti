#!/bin/bash
# Electron 迁移准备脚本

echo "=========================================="
echo "SimNow 交易终端 - Electron 迁移准备"
echo "=========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查函数
check_pass() {
    echo -e "${GREEN}✓${NC} $1"
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
}

check_warn() {
    echo -e "${YELLOW}!${NC} $1"
}

# 1. 检查 Node.js 版本
echo "1. 检查 Node.js 版本..."
NODE_VERSION=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -ge 22 ] 2>/dev/null; then
    check_pass "Node.js 版本: $(node -v)"
else
    check_fail "Node.js 版本过低: $(node -v) (需要 >= 22.12.0)"
    echo "   请执行: nvm install 22 && nvm use 22"
    echo "   或访问: https://nodejs.org/"
fi
echo ""

# 2. 检查 npm 版本
echo "2. 检查 npm 版本..."
NPM_VERSION=$(npm -v 2>/dev/null | cut -d. -f1)
if [ "$NPM_VERSION" -ge 10 ] 2>/dev/null; then
    check_pass "npm 版本: $(npm -v)"
else
    check_warn "npm 版本较低: $(npm -v) (建议 >= 10)"
fi
echo ""

# 3. 检查 Python 版本
echo "3. 检查 Python 版本..."
PYTHON_VERSION=$(python --version 2>&1 | sed 's/Python //' | cut -d. -f1-2)
check_pass "Python 版本: $PYTHON_VERSION"
echo ""

# 4. 检查项目目录
echo "4. 检查项目目录..."
if [ -d "frontend" ]; then
    check_pass "frontend/ 目录存在"
else
    check_fail "frontend/ 目录不存在"
fi

if [ -d "server" ]; then
    check_pass "server/ 目录存在"
else
    check_fail "server/ 目录不存在"
fi
echo ""

# 5. 检查 package.json
echo "5. 检查 package.json..."
if [ -f "frontend/package.json" ]; then
    check_pass "frontend/package.json 存在"
else
    check_fail "frontend/package.json 不存在"
fi
echo ""

# 6. 检查 Electron 依赖
echo "6. 检查 Electron 依赖..."
if [ -d "frontend/node_modules/electron" ]; then
    check_pass "Electron 已安装"
else
    check_warn "Electron 未安装，将自动安装"
fi
echo ""

# 7. 创建目录结构
echo "7. 创建 Electron 目录结构..."
mkdir -p frontend/electron
mkdir -p frontend/electron/ipc
mkdir -p frontend/electron/windows
mkdir -p frontend/electron/assets
mkdir -p frontend/build
mkdir -p frontend/scripts
check_pass "目录结构已创建"
echo ""

# 8. 检查构建工具（Windows）
echo "8. 检查构建工具..."
if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "win32" ]]; then
    if command -v cl &> /dev/null; then
        check_pass "Visual Studio Build Tools 已安装"
    else
        check_warn "Visual Studio Build Tools 未检测到"
        echo "   如遇编译错误，请安装: https://visualstudio.microsoft.com/visual-cpp-build-tools/"
    fi
else
    check_pass "非 Windows 系统，无需额外构建工具"
fi
echo ""

echo "=========================================="
echo "准备检查完成"
echo "=========================================="
echo ""
echo "下一步操作："
echo "1. 如果 Node.js 版本过低，请先升级到 22+"
echo "2. 运行 'cd frontend && npm install' 安装依赖"
echo "3. 开始实现 PR-E1: Electron 基础框架搭建"
echo ""
