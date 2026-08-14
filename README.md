# 电脑固定资产管理系统 v2.4

> 纯前端 + 轻量 Node.js 服务器的电脑固定资产管理系统，支持离线使用、多浏览器数据同步、附件管理和二维码标签打印。

## 功能特性

- **资产 CRUD** — 资产信息的增删改查，支持自定义字段下拉选项
- **数据导入导出** — Excel / JSON 格式导入导出，支持模板下载和数据备份恢复
- **统计图表** — 4 个 Chart.js 图表（资产状态分布、人员资产、部门资产、设备类型）
- **二维码标签** — 资产二维码生成与标签打印（70mm x 50mm）
- **附件管理** — 图片 / PDF 附件上传、缩略图预览、文件查看器（支持缩放）
- **维护记录** — 资产维护记录的添加和删除
- **多浏览器同步** — 通过 File System Access API 连接本地数据文件夹，实现跨浏览器数据共享
- **离线运行** — 支持完全离线使用，数据存储在 localStorage + IndexedDB

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | 原生 HTML / CSS / JavaScript（模块化，无框架） |
| 图表 | Chart.js |
| 表格 | SheetJS (XLSX) |
| 二维码 | qrcode-generator |
| PDF预览 | pdf.js |
| 图标 | Font Awesome |
| 服务器 | Node.js 原生 HTTP（零依赖，端口 8000） |
| 数据存储 | localStorage + IndexedDB + JSON 文件（三重冗余） |

## 快速开始

### 方式一：Node.js 服务器（推荐）

```bash
# 克隆仓库
git clone https://github.com/jackie251818/固定资产管理系统离线版.git
cd 固定资产管理系统离线版

# 启动服务器
node simple_server.js

# 浏览器访问
# http://localhost:8000
```

### 方式二：Python 服务器

```bash
python -m http.server 8000
# 浏览器访问 http://localhost:8000
```

### 方式三：直接打开（file:// 模式）

双击 `index.html` 即可使用。此模式下数据不跨浏览器共享。

### 方式四：一键启动

双击 `启动服务器.bat` 或 `start_server.bat`。

## 项目结构

```
├── index.html              # 主页面
├── styles.css              # 全局样式
├── simple_server.js        # Node.js HTTP 服务器
├── final_chart_fix.js      # 图表渲染修复（200ms 防抖）
├── asset_label_print.html  # 标签打印页面
│
├── js/                     # JavaScript 模块
│   ├── config.js           # 全局配置、常量、工具函数（debounce/State/getElement）
│   ├── storage.js          # 数据持久化（FileStorageManager 类）
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
│   └── init.js             # 系统系统初始化
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

## 数据存储架构

系统采用**三重冗余**数据持久化策略：

```
写入流程:
  saveToLocalStorage()
    ├── 同步 → localStorage（确保刷新不丢数据）
    ├── 异步 → IndexedDB（大容量存储，保留完整附件数据）
    └── 异步 → data/*.json 文件（跨浏览器共享，需连接文件夹）

读取流程:
  loadFromLocalStorage()
    └── storageManager.getItem()
        ├── 优先 → window.__LOCAL_DATA__（file:// 模式脚本注入）
        ├── 其次 → IndexedDB（当前浏览器数据）
        └── 最后 → localStorage（同步兜底）
```

**附件分离存储**：localStorage 仅保存附件元数据（文件名、类型、缩略图），完整的 base64 数据存储在 IndexedDB，避免 5MB 限额问题。

## 连接数据文件夹（跨浏览器同步）

1. 首次打开页面时，顶部会显示「连接数据文件夹」横幅
2. 点击按钮，选择项目的 `data/` 目录
3. 授权后，系统自动将数据同步到 `data/*.js` 文件
4. 其他浏览器打开同一地址并连接同一文件夹即可共享数据

**自动恢复**：再次打开时，系统自动通过 `queryPermission` 静默恢复已保存的文件夹句柄，无需手动选择。

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

修改代码时请遵守 [HANDOFF.md](HANDOFF.md) 中记录的 16 条硬约束，主要包括：
- DOM 查询必须限定活跃页面
- 加载指示器统一用 `showLoadingIndicator()` / `hideLoadingIndicator()`
- `saveToLocalStorage` 同步优先（先 localStorage，再 IndexedDB）
- 模态框用 `.active` CSS 类控制
- 编辑模式必须同步隐藏详情、附件、维护记录
- 搜索字段访问必须空值保护 `(field || '').toLowerCase()`
- 图表渲染前必须销毁旧实例

### 修改 JS 后测试

浏览器缓存较顽固，修改后请用 `Ctrl+F5` 强制刷新，或访问 `http://localhost:8000/?t=时间戳`。

## 故障排查

| 问题 | 解决方案 |
|------|----------|
| 页面空白 | 检查浏览器控制台是否有 JS 错误，确认所有 `js/` 文件加载成功 |
| 数据不显示 | 按 `Ctrl+F5` 强制刷新；检查 localStorage 和 IndexedDB 是否有数据 |
| 图表不渲染 | 确认 `libs/chart.min.js` 已加载；检查 `final_chart_fix.js` 是否执行 |
| Excel 导入导出不可用 | 确认 `libs/xlsx.full.min.js` 已加载 |
| 图标不显示 | 确认 `libs/font-awesome.min.css` 和 `.woff2` 字体文件存在 |
| 数据文件夹无法连接 | 确保使用 `http://localhost:8000` 访问（非 `file://`），浏览器支持 File System Access API |
| 存储空间不足 | 系统设置中导出备份，清理旧数据；系统已自动处理 QuotaExceededError |

## 打包部署

```bash
# 使用 Node.js 打包（需安装 archiver）
npm install archiver
node -e "const a=require('archiver');const fs=require('fs');const o=fs.createWriteStream('资产系统_v2.4_完整包.zip');const z=a.create('zip',{zlib:{level:9}});o.on('close',()=>console.log('打包完成'));z.pipe(o);z.directory('.','资产系统_v2.4',{ignore:['node_modules','.git']});z.finalize();"
```

打包文件命名格式：`资产系统_v2.4_完整包_YYYYMMDD_HHMM.zip`

打包内容包括：`data/` 目录、`node_modules/`、所有项目文件。

## 版本历史

- **v2.4.3** (2026-08-14) — 全项目性能优化 + 运行时 Bug 修复
- **v2.4.2** (2026-08-14) — 自动文件同步与手动连接体验优化
- **v2.4.1** (2026-08-14) — 模态框闪烁修复 + 编辑模式视觉优化
- **v2.4** — 初始版本

详细变更记录见 [HANDOFF.md](HANDOFF.md)。

## 许可

本项目仅供内部使用。
