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
git clone https://github.com/jackie251818/asset-management-system.git
cd asset-management-system

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

### v2.4.4 (2026-08-14) — 数据一致性检查 + 离线优先架构

#### 数据一致性检查与冲突标记机制

新增手动触发 IndexedDB 与 SQLite 差异检测，支持冲突标记而非直接覆盖：

- **`reconcileAll({ mode })`** — 手动触发一致性检查
  - `mode: 'auto'`（自动同步，IndexedDB 为准）
  - `mode: 'mark'`（标记冲突，不覆盖，人工审查）
- **`_detectAssetConflicts(idbAssets, dbAssets)`** — 逐条资产对比
  - 字段级差异检测（owner/brandModel/type/user/department/status/purchaseDate/location/description）
  - 附件和维护记录 JSON 差异检测
  - 仅本地存在的资产（离线新增）和仅服务器存在的资产
- **`getConflicts()` / `resolveConflict(key, resolution)` / `resolveAllConflicts(resolution)`** — 冲突审查 API
  - 解决方案：`'local'`（以本地为准）、`'server'`（以服务器为准）、`'merged'`（自定义合并）
- **修改文件**：`js/storage.js`、`js/events.js`、`index.html`
  - 系统设置页新增一致性检查区域（模式选择 + 检查按钮 + 结果表格）
  - 新增冲突审查面板（冲突徽章、批量操作按钮、逐条冲突详情展示）

冲突记录存储在 IndexedDB `__conflict_${key}__` 键中，包含字段级 diff 详情、idbOnly/dbOnly 资产 ID 列表、双方完整快照。

#### PWA + SQLite 离线优先架构

- **新增文件**：
  - `manifest.json` — PWA 应用清单
  - `sw.js` — Service Worker 静态资源缓存
  - `db/database.js` — SQLite 数据库连接与 CRUD
  - `db/migrate.js` — JSON → SQLite 数据迁移
- **修改 `js/storage.js`**：
  - 新增 `_DB_FIELD_MAP`（snake_case ↔ camelCase 字段映射）、`_DB_ENDPOINTS`（数据键名 ↔ API 端点映射）
  - 新增 `_isDbApiReady()`、`_assetToDb()` / `_dbToAsset()`、`_loadFromDb()` / `_saveToDb()`、`_needsBackgroundSync()`
  - 改造 `getItem()` — IndexedDB 优先 + 后台同步 SQLite
  - 改造 `setItem()` — 同步写 IndexedDB + 同步等待 SQLite + localStorage
  - 改造 `removeItem()` — 删除时同步到 SQLite
- **修改 `simple_server.js`**：新增 REST API 端点 `/db/assets[/:id]`、`/db/user-state`、`/db/options/:category`；JS/CSS/HTML/JSON 文件添加 `Cache-Control: no-cache` 头

### v2.4.3 (2026-08-14) — 全项目性能优化 + 运行时 Bug 修复

#### 资产表格不渲染 Bug 修复 + 空引用防护

- **根因**：`renderAllAssets()` 中数据行追加逻辑被包裹在 `requestAnimationFrame()` 回调中，当资产页面非 active 时浏览器会延迟/节流 RAF 回调，导致行不渲染（但 `renderPagination()` 同步执行，total-records 正常更新）
- **修复**：`js/assets.js` L28-39 — 移除 `requestAnimationFrame` 包装，改为在 `setTimeout` 回调内同步使用 `DocumentFragment` 追加行
- **空引用防护修复**：
  - `js/init.js` L185/L192 — `checkUsage()` 添加 `await` + try-catch；`backup-data` 按钮判空
  - `js/print.js` L8/L15、`js/maintenance.js` L7/L42、`js/asset-edit.js` L550/L728 — `getElement('asset-id').textContent` 提取变量 + 三元判空
- **验证**：强制刷新后表格正确渲染资产记录，无控制台 error

#### 全项目性能优化

| 优化项 | 文件 | 改善点 |
|--------|------|--------|
| 统一防抖 | `js/config.js` | 新增 `debounce(key, fn, delay)`，消除各模块重复定时器 |
| 状态管理 | `js/config.js` | 新增轻量 `State` 对象（订阅-通知模式，避免各模块轮询） |
| 文件监听间隔 | `js/storage.js` | 5 秒轮询降低 CPU 占用 |
| 附件分离存储 | `js/storage.js` | `_saveToLocalStorage` 剥离附件 `url`（大 base64），仅保留元数据，解决 5MB 限额 |
| QuotaExceeded 降级 | `js/storage.js` | 空间不足时自动移除 `url/thumbnail/data` 后重试 |
| 按需加载附件 | `js/assets.js` | `openFileViewer()` 按需从 IndexedDB 加载 `url` |
| DOM 重绘优化 | `js/assets.js` | 50ms 防抖 + `requestAnimationFrame` + `DocumentFragment` |
| 搜索/筛选防抖 | `js/events.js` | dashboard-search 200ms、assets-search 200ms、filter 100ms |
| 事件委托统一 | `js/events.js` | 动态元素事件委托，避免事件丢失 |
| 错误边界 | `js/search-filter.js` | `applyFilters()` try-catch，单点异常不瘫痪整体 |
| 图表实例销毁 | `js/charts.js` | 4 个图表渲染前 `instance.destroy()`，防止内存泄漏 |

### v2.4.2 (2026-08-14) — 自动文件同步与手动连接体验优化

#### 修复问题

1. 打开页面时不弹出文件夹选择器，切换页面时才触发
2. 每次点击"允许"后误报"检测到数据变化"（文件写入后被文件监听误判为外部修改）
3. 需每次手动选择 data 文件夹，无法自动恢复
4. 删除已保存附件后无法保存

#### 修复文件

- **`js/storage.js`**：
  - 删除废弃的 `_registerEarlyAutoConnectListener()`（~100 行，全局 click 监听器方案）
  - 删除废弃的 `_clearBrowserCache()`（~45 行，浏览器重启清理方案）
  - 删除废弃变量：`_autoConnectPending`、`_autoConnectClickListenerBound`、`_debugTrace`
  - `_saveToScriptFile()` 写入成功后立即更新 `_fileLastModified[key]`，防止文件监听轮询误报
  - `_restoreFileSystemAccess()` 只调用 `queryPermission`（无需用户手势），权限已授予时静默恢复
  - 新增 `_suppressWatchNotification` 机制：内部写入文件期间阻止 `onFileChange` 通知
- **`js/events.js`**：`initFileSyncBanner()` 浏览器支持且未连接时显示横幅；`onFileChange` 入口增加 `_suppressWatchNotification` 检查
- **`js/asset-edit.js`**：
  - `renderEditModeAttachments()` 删除循环末尾重复 click 事件绑定
  - 删除死代码 `setupEditModeAttachmentViewer()`
  - `saveEditedAsset()` 改用 `document.getElementById` 查找新文件预览
  - `finalizeSave()` 通过 `dataset.index` 读取剩余未删除附件，确保删除的附件不被加回
  - 无新文件时补充 `finalizeSave([])` 调用
- **`js/config.js`**：`getElement()` 增加 `isConnected` 检测，自动重新查询 stale 引用
- **`js/search-filter.js`**：`searchAssets()` 所有字段空值保护；扩展搜索范围至 type、description、location

#### 连接流程

| 场景 | 行为 |
|------|------|
| 首次使用 | 顶部横幅提示 → 用户点击"连接数据文件夹" → 选择文件夹 → 句柄保存到 IndexedDB |
| 再次打开 | 自动读取已保存句柄 → queryPermission 检查 → 权限已授予则静默恢复 |
| 权限失效 | 显示横幅 → 用户点击"连接" → 重新授权 |

### v2.4.1 (2026-08-14) — 模态框闪烁修复 + 编辑模式视觉优化

#### 文件查看器模态框闪烁修复

- **根因**：`openFileViewer` 原逻辑先设置 `imageElement.src` 再显示 modal，导致 modal 显示后图片区域先空白再突然显示
- **修复 `js/assets.js` L422-458**：用临时 `new Image()` 预加载，加载完成后再赋值给 `imageElement.src`，**图片就绪后才显示 modal**
- **统一 modal 控制**：显示用 `classList.add('active')`，隐藏用 `classList.remove('active')` + 清除 inline `style.display`，ESC 关闭检查 `.classList.contains('active')`
- **修改 `js/events.js`**：`closeFileViewer`（L426-440）、ESC 关闭判断（L462-465）

#### 编辑模式"两个页面同时显示"视觉混乱修复

- **根因**：`toggleEditMode` 只隐藏 `.asset-details` 和 `#attachments-container`，未隐藏 `#maintenance-records-table` 及其 `.card-header`
- **修复 `js/asset-edit.js`** — 在 3 处函数同步维护记录的显示/隐藏：
  - `toggleEditMode` (L78-83)：进入编辑时隐藏
  - `cancelEditMode` (L144-149)：取消编辑时恢复
  - `cleanupEditUI` (L648-653)：保存完成后恢复
- 同时清理 `createEditForm` 中调试遗留的红色边框、硬编码 `backgroundColor`、`zIndex:9999`

#### 页面刷新闪烁修复

- **根因**：`init.js` 在 `DOMContentLoaded` 中过早移除 `<head>` 内联恢复样式 `_restore_view_style`；`loadFromLocalStorage` 异步回调中再次切换 active 类
- **修复 `js/init.js`**：不再在 `DOMContentLoaded` 中移除临时样式，改为在 `loadFromLocalStorage` 回调完成后移除；移除回调中的二次 active 类切换逻辑

#### 加载指示器卡死修复

- **根因**：`initTemplateLoading()` 用 `loader.style.display = 'block'` 设置内联样式，但 `hideLoadingIndicator()` 只移除 `visible` CSS 类，内联样式优先级更高导致无法隐藏
- **修复 `js/init.js`、`js/notifications.js`**：`initTemplateLoading()` 改用 `showLoadingIndicator()`；`hideLoadingIndicator()` 增加 `loader.style.display = ''` 双保险

#### 导入/导出按钮迁移至系统设置页面

- 数据管理按钮（导入 Excel/JSON、导出 Excel/JSON、下载模板）从页面顶部移到 `settings-page` 的"数据管理"卡片内
- 修改 `index.html`、`styles.css`（`.data-management` 调整为 `justify-content: flex-start`、`flex-wrap: wrap`）
- 按钮 `id` 保持不变，`events.js` 无需修改

### v2.4.0 — 初始版本

- 资产 CRUD、Excel/JSON 导入导出、统计图表、二维码标签打印
- 附件管理（图片 / PDF 缩略图）
- 维护记录管理
- 自定义下拉选项添加 / 删除 / 持久化 / 跨浏览器同步
- 多页面 DOM 查询作用域管理
- 二维码中文编码修复

### 项目代码清理（贯穿各版本）

**已删除文件**：
- `script.js` — 旧版单体脚本（已拆分到 `js/` 目录）
- `debug_form.html` — 调试表单页面
- `test_qr.html` — 二维码测试页面
- `simple_server.py` — Python 服务器脚本（bat 文件直接使用 `python -m http.server`）

**已清理调试代码**：
- `asset-edit.js`：删除 10 处 `console.log`、调试用视觉指示器（绿色浮动 div）、重复 console.error
- `events.js`：删除文件监听 console.log、废弃的 `bindEventListeners()` 兼容函数
- `import-export.js`：删除 4 处 console.log
- `index.html`：删除 `onload` 内联调试日志、清理过期注释
- `final_chart_fix.js`：简化 console.warn 消息

**保留的日志**：`console.error`、`console.warn`、`Logger.info/warn`、`simple_server.js` 中的 `console.log`

详细变更记录见 [HANDOFF.md](HANDOFF.md)。

## 许可

本项目仅供内部使用。
