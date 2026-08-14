# 电脑固定资产管理系统 v2.4

> 基于 Electron 的离线桌面应用，支持便携式 .exe 单文件运行、附件管理、二维码标签打印和多维度统计图表。

## 功能特性

- **资产 CRUD** — 资产信息的增删改查，支持自定义字段下拉选项
- **数据导入导出** — Excel / JSON 格式导入导出，支持模板下载和数据备份恢复
- **统计图表** — 4 个 Chart.js 图表（资产状态分布、人员资产、部门资产、设备类型）
- **二维码标签** — 资产二维码生成与标签打印（70mm x 50mm）
- **附件管理** — 图片 / PDF 附件上传、缩略图预览、文件查看器（支持缩放）
- **维护记录** — 资产维护记录的添加和删除
- **离线运行** — 完全离线使用，数据存储在 localStorage + IndexedDB + 本地文件（三重冗余）

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Electron |
| 打包工具 | electron-builder（portable / nsis） |
| 前端 | 原生 HTML / CSS / JavaScript（模块化，无框架） |
| 图表 | Chart.js |
| 表格 | SheetJS (XLSX) |
| 二维码 | qrcode-generator |
| PDF预览 | pdf.js |
| 图标 | Font Awesome |
| 数据存储 | localStorage + IndexedDB + 本地 .js 文件（三重冗余） |

## 快速开始

### 方式一：直接运行便携版 .exe（推荐）

1. 通过 `npm run build` 生成 portable exe（位于 `dist/` 目录下）
2. 双击生成的 `固定资产管理系统-便携版-{version}.exe` 即可运行，无需安装
3. 双击项目根目录下的 `安装.bat` 可创建桌面快捷方式

### 方式二：开发模式

```bash
# 安装依赖
npm install

# 启动 Electron 开发模式
npm start
```

### 方式三：浏览器调试（仅前端）

如需在浏览器中调试前端逻辑，可使用任意静态服务器：

```bash
# 使用 Python
python -m http.server 8000

# 或使用 Node.js 的 http-server
npx http-server -p 8000
```

然后访问 `http://localhost:8000`。

> 注：浏览器模式下无 Electron 主进程，文件 API 会自动降级为 IndexedDB 模式。

## 项目结构

```
├── index.html              # 主页面
├── styles.css              # 全局样式
├── main.js                 # Electron 主进程（窗口、HTTP 服务器、数据目录管理）
├── final_chart_fix.js      # 图表渲染修复（200ms 防抖）
├── asset_label_print.html  # 标签打印页面
├── 安装.bat                # 创建桌面快捷方式（调用 install.ps1）
├── install.ps1            # 桌面安装 PowerShell 脚本
│
├── js/                     # JavaScript 模块
│   ├── config.js           # 全局配置、常量、工具函数（debounce/State/getElement）
│   ├── storage.js          # 数据持久化（StorageManager 类）
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
├── libs/                   # 第三方库（离线使用）
│   ├── chart.min.js        # Chart.js
│   ├── xlsx.full.min.js    # SheetJS
│   ├── qrcode.min.js       # 二维码生成
│   ├── pdf.min.js          # PDF.js
│   ├── pdf.worker.min.js   # PDF.js Worker
│   ├── fa-solid-900.woff2  # Font Awesome 字体
│   └── font-awesome.min.css # Font Awesome 样式
│
├── data/                   # 数据目录（运行时自动生成）
│   ├── *.js                # 数据文件（由主进程写入，供前端读取）
│   └── *.json              # JSON 备份
│
├── package.json            # 项目配置和构建脚本
├── 统计数据功能说明.md     # 统计功能说明
└── README.md
```

## 数据存储架构

系统采用**三重冗余**数据持久化策略：

```
写入流程 (storageManager.setItem):
  ├── 优先 → HTTP 服务器（/api/save，仅在 Electron 模式可用）
  ├── 异步 → IndexedDB（大容量存储，保留完整附件数据）
  └── 同步 → localStorage（兜底，确保刷新不丢数据）

读取流程 (storageManager.getItem):
  ├── 优先 → HTTP 服务器（/api/load，仅 Electron 模式）
  ├── 其次 → IndexedDB
  └── 最后 → localStorage
```

**附件分离存储**：localStorage 仅保存附件元数据（文件名、类型、缩略图），完整的 base64 数据存储在 IndexedDB，避免 5MB 限额问题。

**便携模式数据目录**：
- 便携 exe：`<exe所在目录>/data/`
- 安装版：`app.getPath('userData')/data/`
- 开发模式：`<项目根>/data/`

## 系统设置

在「系统设置」页面可配置：
- 系统名称（显示在侧边栏和浏览器标签页）
- 日期格式（yyyy/mm/dd 或 yyyy-mm-dd）
- 每页显示记录数
- 导入 / 导出按钮（Excel / JSON）
- 数据备份与恢复

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

- DOM 查询必须限定活跃页面
- 加载指示器统一用 `showLoadingIndicator()` / `hideLoadingIndicator()`
- `saveToLocalStorage` 同步优先（先 localStorage，再 IndexedDB）
- 模态框用 `.active` CSS 类控制
- 编辑模式必须同步隐藏详情、附件、维护记录
- 搜索字段访问必须空值保护 `(field || '').toLowerCase()`
- 图表渲染前必须销毁旧实例（已包裹 try/catch 防止销毁异常中断渲染）
- 通知统一使用 `showNotification(message, type, duration)` 替代 `alert`

### 修改 JS 后测试

Electron 开发模式下 `Ctrl+R` 刷新窗口；浏览器调试时 `Ctrl+F5` 强制刷新，或访问 `http://localhost:8000/?t=时间戳`。

## 故障排查

| 问题 | 解决方案 |
|------|----------|
| 页面空白 | 检查开发者工具控制台是否有 JS 错误，确认所有 `js/` 文件加载成功 |
| 数据不显示 | `Ctrl+F5` 强制刷新；检查 localStorage 和 IndexedDB 是否有数据 |
| 图表不渲染 | 确认 `libs/chart.min.js` 已加载；检查 `final_chart_fix.js` 是否执行（已添加 `defer`） |
| Excel 导入导出不可用 | 确认 `libs/xlsx.full.min.js` 已加载（错误提示已切换为 Toast） |
| 图标不显示 | 确认 `libs/font-awesome.min.css` 和 `libs/fa-solid-900.woff2` 字体文件存在 |
| PDF 缩略图无法生成 | 检查文件是否加密、`libs/pdf.min.js` 与 `libs/pdf.worker.min.js` 是否存在 |
| 便携 exe 启动后数据丢失 | 检查 exe 所在目录的 `data/` 文件夹是否可写 |
| 存储空间不足 | 系统设置中导出备份，清理旧数据；系统已自动处理 QuotaExceededError |

## 打包部署

```bash
# 安装依赖
npm install

# 生成便携版 .exe（单文件，免安装）
npm run build
# 输出：dist/固定资产管理系统-便携版-{version}.exe

# 生成 NSIS 安装版
npm run build:nsis
# 输出：dist/固定资产管理系统-安装版-{version}.exe

# 仅打包不压缩（开发调试用）
npm run pack
```

**构建优化**：
- `electronLanguages: ["zh-CN", "en-US"]` 仅保留中英文语言包，减小体积
- `compression: "maximum"` 最大压缩比
- 自动排除 `.md` / `.ts` / `.map` / `node_modules` 等无关文件

## 版本历史

- **v2.4.4** (2026-08-14) — 代码整理与文档更新，优化项目结构和部署流程
- **v2.4.3** (2026-08-14) — 全项目性能优化 + 运行时 Bug 修复（P0~P3 全部完成）
- **v2.4.2** (2026-08-14) — 自动文件同步与手动连接体验优化
- **v2.4.1** (2026-08-14) — 模态框闪烁修复 + 编辑模式视觉优化
- **v2.4** — 初始版本

## 许可

本项目仅供内部使用。
