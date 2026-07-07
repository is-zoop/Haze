# Haze Tool Platform

Haze Tool Platform 是一个面向 Skill、HTTP MCP 和 STDIO MCP 的能力资产管理与托管运行平台。它把能力创建、审核、市场分发、MCP 托管部署、统一网关访问、运行监控和企业权限治理串成一条完整流程，适合团队集中管理和发布可复用的 AI 工具能力。

![Haze Tool Platform overview](docs/assets/haze-platform-overview.svg)

## 核心特点

- 多类型能力管理：支持 Skill、HTTP MCP、STDIO MCP。
- 全生命周期流程：创建、上传、审核、部署、调试、发布、下线和删除。
- 能力市场：支持能力搜索、分类筛选、收藏、Prompt 复制和下载链接。
- MCP 托管运行：通过 Worker 构建镜像，并在 Kubernetes 中隔离运行 MCP Server。
- 统一访问网关：MCP Gateway 提供统一入口、API Key 鉴权、请求转发和调用日志。
- 企业权限体系：支持 JWT 登录、成员管理、部门管理和四级 RBAC。
- 运行监控：可查看 MCP 实例状态、部署记录、调用日志和使用统计。
- 私有化部署友好：支持 Docker Compose、镜像仓库、外部 MySQL 和 K8s 运行环境。

## 功能模块

### Web 控制台

- 首页：展示平台概览、常用入口和个人使用情况。
- 开发者中心：管理能力资产、版本、上传包、测试状态和发布流程。
- 审核中心：处理能力提交审核、通过和驳回。
- 能力市场：面向使用者展示已发布能力，支持搜索、收藏和接入。
- MCP Runtime：查看运行实例、部署进度、调用监控和部署记录。
- 系统管理：维护企业成员、角色权限和业务分类。
- 个人中心：管理个人资料和个人服务凭证。

### Backend API

后端基于 FastAPI 构建，提供认证鉴权、成员管理、能力资产、市场、审核、运行管理、调用统计等 API。数据库访问使用 SQLAlchemy，迁移使用 Alembic，响应结构和异常处理保持统一。

### MCP 托管运行面

- Deploy Worker：消费部署任务，校验 MCP 配置，构建镜像并更新部署状态。
- Image Registry：保存 MCP Server 运行镜像。
- Kubernetes Runtime：为 MCP Server 创建独立的 Deployment / Service。
- MCP Gateway：把外部 MCP 请求转发到对应运行实例，并记录调用日志。
- Storage：保存能力包、图标、运行所需文件和下载资源。

## 技术栈

- Frontend：React、Vite、TypeScript、Tailwind CSS、Radix UI
- Backend：FastAPI、SQLAlchemy、Alembic、Pydantic、MySQL
- Runtime：Docker、Docker Compose、Kubernetes、Registry
- Security：JWT、RBAC、API Key

## 目录结构

```text
backend/       FastAPI 后端、Gateway、Worker、数据库模型与迁移
frontend/      React Web 控制台
alembic/       数据库迁移入口
demo/          示例 Skill / MCP 能力
create_user/   用户初始化和管理辅助脚本
docs/assets/   README 图片资源
```

## Docker Compose 部署

### 1. 准备环境

部署前需要准备：

- Docker 和 Docker Compose
- MySQL 数据库
- 可选：Kubernetes 集群，用于托管运行 MCP Server
- 可选：Docker Registry，用于保存 Worker 构建出的 MCP 镜像

### 2. 准备环境变量

复制环境变量模板：

```bash
cp .env.example .env
```

根据实际环境修改 `.env` 中的配置，至少确认以下字段：

```env
DATABASE_URL="mysql+pymysql://user:password@host.docker.internal:3306/haze?charset=utf8mb4"
JWT_SECRET_KEY="replace-with-a-long-random-secret"
INITIAL_ADMIN_NAME="admin"
INITIAL_ADMIN_PHONE="13800138000"
INITIAL_ADMIN_EMAIL="admin@example.com"
INITIAL_ADMIN_PASSWORD="replace-with-a-strong-admin-password"
CORS_ORIGINS='["http://localhost:8080"]'
DOWNLOAD_PUBLIC_BASE_URL="http://127.0.0.1:8000"
GATEWAY_PUBLIC_BASE_URL="http://127.0.0.1:8001"
```

如果需要启用 MCP 托管部署，还需要确认：

```env
K8S_NAMESPACE=haze-runtime
K8S_CONFIG_HOST_PATH=/path/to/your/kubeconfig
REGISTRY_URL=localhost:5000
REGISTRY_PROJECT=haze-mcp
REGISTRY_PUSH_ENABLED=true
DOCKER_CONFIG_PATH=/path/to/your/.docker
```

### 3. 启动服务

```bash
docker compose up -d --build
```

默认会启动以下服务：

- `frontend`：Web 控制台，默认端口 `8080`
- `backend`：后端 API，默认端口 `8000`，仅绑定本机 `127.0.0.1`
- `gateway`：MCP Gateway，默认端口 `8001`
- `worker`：MCP 部署任务 Worker
- `registry`：本地镜像仓库，默认端口 `5000`
- `storage-init`：初始化本地存储目录权限

### 4. 查看服务状态

```bash
docker compose ps
```

查看日志：

```bash
docker compose logs -f backend
docker compose logs -f gateway
docker compose logs -f worker
```

### 5. 访问服务

默认访问地址：

- Web 控制台：http://localhost:8080
- Backend Health：http://127.0.0.1:8000/api/health
- MCP Gateway：http://127.0.0.1:8001

### 6. 停止服务

```bash
docker compose down
```

如果需要同时清理本地容器卷，可以执行：

```bash
docker compose down -v
```

注意：本项目默认把运行数据挂载到 `.env` 中的 `HAZE_STORAGE_PATH` 和 `HAZE_REGISTRY_PATH`，清理前请确认数据是否仍需要保留。

## 本地开发

### Backend

```bash
cd backend
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

### Gateway

```bash
cd backend
..\.venv\Scripts\python.exe -m gateway.main
```

### Worker

```bash
cd backend
..\.venv\Scripts\python.exe -m worker.main
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## License

请根据项目开源计划补充许可证，例如 MIT、Apache-2.0 或其他协议。
