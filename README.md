# 电脑固定资产管理系统 v2.4

> 纯前端 + 轻量 Node.js 服务器的电脑固定资产管理系统，支持离线使用、SQLite 持久化、多浏览器数据同步、附件管理和二维码标签打印。

## 功能特性

- **资产 CRUD** — 资产信息的增删改查，支持自定义字段下拉选项
- **数据导入导出** — Excel / JSON 格式导入导出，支持模板下载和数据备份恢复
- **统计图表** — 4 个 Chart.js 图表（资产状态分布、人员资产、部门资产、设备类型）
- **二维码标签** — 资产二维码生成与标签打印（70mm x 50mm）
- **附件管理** — 图片 / PDF 附件上传、缩略图预览、文件查看器（支持缩放）
- **维护记录** — 资产维护记录的添加和删除
- **多浏览器同步** — 通过 SQLite REST API 实现跨浏览器数据共享
- **离线优先** — IndexedDB 本地缓存优先读取，后台同步 SQLite，断网时立即可用
- **PWA 支持** — Service Worker + Manifest，可安装为桌面应用，离线访问
- **数据一致性检查** — 手动触发 IndexedDB 与 SQLite 差异检测，支持冲突标记与人工审查

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | 原生 HTML / CSS / JavaScript（模块化，无框架） |
| 图表 | Chart.js |
| 表格 | SheetJS (XLSX) |
| 二维码 | qrcode-generator |
| PDF预览 | pdf.js |
| 图标 | Font Awesome |
| PWA | Service Worker + Web App Manifest |
| 服务器 | Node.js 原生 HTTP（零依赖，端口 8000） |
| 数据库 | SQLite（better-sqlite3，持久化存储） |
| 离线缓存 | IndexedDB（大容量本地缓存，附件完整数据） |
| 数据存储 | SQLite + IndexedDB + localStorage（三重冗余） |

## 快速开始

### 方式一：Node.js 服务器（推荐）

```bash
# 克隆仓库
git clone https://github.com/jackie251818/-.git
cd 固定资产管理系统v2.4

# 安装依赖（仅 better-sqlite3）
npm install

# 启动服务器
node simple_server.js

# 浏览器访问
# http://localhost:8000
```

首次启动时 SQLite 数据库会自动创建在 `db/asset_management.db`。

### 方式二：Python 服务器（功能受限）

```bash
python -m http.server 8000
# 浏览器访问 http://localhost:8000
# 注意：此模式无 SQLite 持久化，仅支持本地 IndexedDB 存储
```

### 方式三：直接打开（file:// 模式）

双击 `index.html` 即可使用。此模式下数据仅保存在浏览器本地，不跨浏览器共享，也不持久化到 SQLite。

### 方式四：一键启动

双击 `启动服务器.bat` 或 `start_server.bat`。

## 项目结构

```
├── index.html              # 主页面
├── styles.css              # 全局样式
├── simple_server.js        # Node.js HTTP 服务器（含 /db/* REST API）
├── final_chart_fix.js      # 图表渲染修复（200ms 防抖）
├── manifest.json           # PWA 应用清单
├── sw.js                   # Service Worker（静态资源缓存、离线访问）
│
├── js/                     # JavaScript 模块
│   ├── config.js           # 全局配置、常量、工具函数（debounce/State/getElement）
│   ├── storage.js          # 数据持久化 + SQLite API + 一致性检查
│   ├── notifications.js    # 通知与加载指示器
│   ├── navigation.js       # 页面切换导航
│   ├── dashboard.js        # 控制面板（统计卡片、最近资产）
│   ├── assets.js           # 资产列表、分页、详情、附件查看器
│   ├── asset-add.js        # 添加资产表单
│   ├── asset-edit.js       # 编辑资产表单
│   ├── search-filter.js    # 搜索与筛选（CustomSelect 组件）
│   ├── import-export.js    # Excel/JSON 导入导出
│   ├── print.js            # 打印与二维码生成
│   ├── charts.js           # 统计报表图表
│   ├── maintenance.js      # 维护记录管理
│   └── init.js             # 系统初始化
│
├── db/                     # SQLite 数据库
│   ├── database.js         # 数据库连接与 CRUD 操作
│   └── migrate.js          # 数据迁移脚本（JSON → SQLite）
│
├── libs/                   # 第三方库（离线使用）
│   ├── chart.min.js        # Chart.js
│   ├── xlsx.full.min.js    # SheetJS
│   ├── qrcode.min.js       # 二维码生成
│   ├── pdf.min.js          # PDF.js
│   ├── pdf.worker.min.js   # PDF.js Worker
│   └── font-awesome.min.css # Font Awesome
│
├── data/                   # 数据目录（运行时自动生成）
│   └── .gitkeep
│
├── .gitignore
├── HANDOFF.md              # 开发交接文档
└── README.md
```

## 数据存储架构（离线优先）

系统采用**离线优先**数据持久化策略，确保断网时数据立即可用：

### 数据读取流程

```
getItem(key)
  ├── IndexedDB 缓存命中 → 直接返回（零延迟，离线可用）
  │     └── [后台] 若 SQLite 可用，静默检查并同步最新数据
  ├── IndexedDB 无数据 + SQLite 可用
  │     └── 从 /db/* API 加载 → 回填到 IndexedDB + localStorage
  └── 全部无数据 → localStorage 兜底
```

### 数据写入流程

```
setItem(key, data)
  ├── 1. 同步写入 IndexedDB（离线立即可用）
  ├── 2. 同步等待 SQLite REST API 持久化
  └── 3. 同步写入 localStorage（防刷新丢失）
```

### 附件分离存储

- **localStorage**：仅保存附件元数据（文件名、类型、缩略图 base64）
- **IndexedDB**：保存完整附件数据（含原始 base64 URL）
- 避免 localStorage 5MB 限额问题

## SQLite REST API

服务器提供以下 REST API 端点：

### 资产管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/db/assets?page=1&pageSize=20` | 分页获取资产列表 |
| `GET` | `/db/assets/:id` | 获取单个资产详情 |
| `POST` | `/db/assets` | 创建新资产 |
| `PUT` | `/db/assets/:id` | 更新资产 |
| `DELETE` | `/db/assets/:id` | 删除单个资产 |
| `DELETE` | `/db/assets` | 清空所有资产 |

### 用户状态

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/db/user-state` | 获取用户状态 |
| `PUT` | `/db/user-state` | 更新用户状态 |
| `DELETE` | `/db/user-state` | 清空用户状态 |

### 自定义选项

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/db/options/:category[?includeDeleted=true]` | 获取选项列表 |
| `POST` | `/db/options/:category` | 保存选项（全量替换） |
| `DELETE` | `/db/options/:category` | 清空选项 |

## 数据一致性检查

当后端服务中断后恢复，可在**系统设置**页面手动触发数据一致性检查：

### 检查模式

| 模式 | 说明 |
|------|------|
| **标记冲突**（默认） | 逐条对比字段级差异，仅记录不覆盖，供人工审查 |
| **自动同步** | 检测差异后以 IndexedDB 为准直接覆盖 SQLite |

### 冲突解决

标记模式下发现的冲突会展示在**冲突审查面板**，支持：

- **以本地为准** — 用 IndexedDB 数据覆盖 SQLite
- **以服务器为准** — 用 SQLite 数据覆盖 IndexedDB
- **批量解决** — 一键全部以本地或服务器为准

### 冲突检测范围

- **字段级对比**：owner、brandModel、type、user、department、status、purchaseDate、location、description
- **附件差异**：JSON 结构对比
- **维护记录差异**：JSON 结构对比
- **单边数据**：仅 IndexedDB 或仅 SQLite 存在的资产

## 系统设置

在「系统设置」页面可配置：
- 系统名称（显示在侧边栏和浏览器标签页）
- 日期格式（yyyy/mm/dd 或 yyyy-mm-dd）
- 每页显示记录数
- 导入 / 导出按钮（Excel / JSON）
- 数据备份与恢复
- **数据一致性检查**（标记模式 / 自动模式）
- **冲突审查**（逐条解决字段级差异）

## 开发指南

### 代码规范

- **中文注释** — 所有注释使用中文
- **防御性编程** — 异步操作包裹 try-catch，DOM 访问做空值检查
- **DOM 查询** — 使用 `getElement(id)` 缓存（含 `isConnected` stale 引用保护）
- **多页面** — DOM 查询必须用 `getActivePage()` 限定作用域
- **模态框** — 使用 `.active` CSS 类控制显示，禁止 inline `style.display`
- **防抖** — 使用 `config.js` 的统一 `debounce(key, fn, delay)` 函数
- **日志** — 使用 `Logger.info/warn/error(module, ...args)`

### 关键约束

修改代码时请遵守 [HANDOFF.md](HANDOFF.md) 中记录的硬约束，主要包括：
- DOM 查询必须限定活跃页面
- 加载指示器统一用 `showLoadingIndicator()` / `hideLoadingIndicator()`
- `saveToLocalStorage` 同步优先（先 localStorage，再 IndexedDB）
- 模态框用 `.active` CSS 类控制
- 编辑模式必须同步隐藏详情、附件、维护记录
- 搜索字段访问必须空值保护 `(field || '').toLowerCase()`
- 图表渲染前必须销毁旧实例
- 修改 JS 文件后浏览器会缓存，simple_server.js 已自动添加 no-cache 头

### 修改 JS 后测试

浏览器缓存较顽固，修改后请用 `Ctrl+F5` 强制刷新，或访问 `http://localhost:8000/?t=时间戳`。

## 故障排查

| 问题 | 解决方案 |
|------|----------|
| 页面空白 | 检查浏览器控制台是否有 JS 错误，确认所有 `js/` 文件加载成功 |
| 数据不显示 | 按 `Ctrl+F5` 强制刷新；检查 IndexedDB 和 SQLite 是否有数据 |
| SQLite API 不可用 | 确认使用 `node simple_server.js` 启动（非 Python 服务器），`npm install` 已执行 |
| 图表不渲染 | 确认 `libs/chart.min.js` 已加载；检查 `final_chart_fix.js` 是否执行 |
| Excel 导入导出不可用 | 确认 `libs/xlsx.full.min.js` 已加载 |
| 图标不显示 | 确认 `libs/font-awesome.min.css` 和 `.woff2` 字体文件存在 |
| 离线时无法访问 | Service Worker 需在 http/https 协议下注册，file:// 协议不支持 |
| 数据不一致 | 进入系统设置 → 数据一致性检查 → 标记模式 → 审查并解决冲突 |
| 存储空间不足 | 系统设置中导出备份，清理旧数据；系统已自动处理 QuotaExceededError |

## 打包部署

```bash
# 1. 安装依赖
npm install

# 2. 启动服务器
node simple_server.js

# 3. 访问
# http://localhost:8000
```

或打包为完整压缩包分发：

```bash
# 打包（需安装 archiver）
npm install archiver
node -e "const a=require('archiver');const fs=require('fs');const o=fs.createWriteStream('资产系统_v2.4_完整包.zip');const z=a.create('zip',{zlib:{level:9}});o.on('close',()=>console.log('打包完成'));z.pipe(o);z.directory('.','资产系统_v2.4',{ignore:['node_modules','.git']});z.finalize();"
```

## 版本历史

- **v2.4.4** (2026-08-14) — SQLite 持久化 + 离线优先架构 + 数据一致性检查与冲突标记机制
- **v2.4.3** (2026-08-14) — 全项目性能优化 + 运行时 Bug 修复
- **v2.4.2** (2026-08-14) — 自动文件同步与手动连接体验优化
- **v2.4.1** (2026-08-14) — 模态框闪烁修复 + 编辑模式视觉优化
- **v2.4** — 初始版本

详细变更记录见 [HANDOFF.md](HANDOFF.md)。

## 许可

本项目仅供内部使用。
