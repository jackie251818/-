# HANDOFF 交接文档

> 本文档面向接手继续开发/维护的工程师或 AI Agent。
> 最后更新：2026-08-14
> 当前版本：v2.4.4
> 上一份交付物：`dist/固定资产管理系统-便携版-2.4.0.exe`（61.4 MB，烟雾测试通过）

---

## 0. 快速上手 Checklist（5 分钟读完）

接手后请按顺序做以下事情：

1. **环境准备**
   ```bash
   npm install
   npm start                 # 开发模式启动，验证基线可运行
   ```
2. **阅读本文档第 1~3 节**：理解项目定位、目录结构、运行模式
3. **阅读第 4 节**：理解三重冗余存储架构（这是最容易出 bug 的地方）
4. **阅读第 6 节「硬约束」**：修改代码前必须遵守的规则
5. **阅读第 8 节「已知问题与陷阱」**：避免重蹈覆辙
6. **如需重新构建**：参见第 7 节
7. **修改 JS 后**：Electron 下 `Ctrl+R`；浏览器调试 `Ctrl+F5` 或 `http://localhost:8000/?t=<时间戳>`
8. **提交前**：运行 `node --check <修改的文件>` 确认语法无误

---

## 1. 项目定位

**固定资产管理系统** 是一个基于 Electron 的离线桌面应用，主要特点：

- **便携式优先**：单文件 `.exe`，双击即用，无需安装
- **完全离线**：所有第三方库本地化（`libs/` 目录），不依赖任何 CDN
- **数据跟 exe 走**：便携模式下数据存在 exe 同级 `data/` 目录，方便迁移
- **多浏览器兼容**：浏览器调试模式下数据可跨浏览器共享（通过 `data/*.js` 文件）
- **无后端依赖**：HTTP 服务器内嵌于 Electron 主进程，零外部依赖

---

## 2. 目录结构

```
固定资产管理系统离线版/
├── index.html              # 主页面（含 <head> 内联脚本 + SVG 图标定义）
├── styles.css              # 全局样式
├── main.js                 # Electron 主进程（窗口、HTTP 服务器、数据目录）
├── final_chart_fix.js      # 图表渲染修复（监听 saveToLocalStorage/switchPage，200ms 防抖）
├── asset_label_print.html  # 资产标签打印页面
├── 安装.bat                # 创建桌面快捷方式（调用 install.ps1，纯 ASCII 无编码问题）
├── install.ps1            # 桌面安装 PowerShell 脚本（原生支持 Unicode）
├── package.json            # 项目配置 + electron-builder 构建配置
├── 交付报告.md             # 上一轮交付报告
├── HANDOFF.md              # 本文档
├── 统计数据功能说明.md     # 统计功能业务说明
│
├── js/                     # 前端模块（按 defer 顺序加载，见第 5 节）
│   ├── config.js           # Logger、STORAGE_KEYS、State、工具函数
│   ├── storage.js          # FileStorageManager 类（核心，约 1400 行）
│   ├── notifications.js    # showNotification / showLoadingIndicator
│   ├── navigation.js       # 页面切换 switchPage
│   ├── dashboard.js        # 控制面板（统计卡片、最近/损坏资产）
│   ├── assets.js           # 资产列表、分页、详情、附件查看器
│   ├── asset-add.js        # 添加资产表单、createPdfThumbnail
│   ├── asset-edit.js       # 编辑资产表单
│   ├── search-filter.js    # 搜索筛选、CustomSelect 组件
│   ├── import-export.js    # Excel/JSON 导入导出、模板下载
│   ├── print.js            # 打印、二维码生成
│   ├── charts.js           # 统计报表 4 个图表
│   ├── maintenance.js      # 维护记录管理
│   └── init.js             # 系统初始化入口
│
├── libs/                   # 第三方库（全部本地化）
│   ├── chart.min.js        # Chart.js
│   ├── xlsx.full.min.js    # SheetJS
│   ├── qrcode.min.js       # 二维码生成
│   ├── pdf.min.js          # PDF.js 主库
│   ├── pdf.worker.min.js   # PDF.js Worker
│   ├── fa-solid-900.woff2  # Font Awesome 字体（仅 solid 实心体）
│   └── font-awesome.min.css # Font Awesome 样式（仅含项目用到的图标）
│
├── data/                   # 数据目录（运行时读写）
│   ├── *.js                # JSONP 风格数据文件，赋值到 window.__LOCAL_DATA__
│   └── *.json              # 纯 JSON 备份
│
└── dist/                   # 构建产物（已在 .gitignore）
    ├── 固定资产管理系统-便携版-2.4.0.exe
    └── win-unpacked/       # 解包目录
```

---

## 3. 三种运行模式

| 模式 | 启动方式 | 数据目录 | HTTP 服务器 |
|------|----------|----------|-------------|
| 便携 exe | 双击 `.exe` | `<exe所在目录>/data/` | 内嵌（127.0.0.1:动态端口） |
| NSIS 安装版 | 安装后启动 | `app.getPath('userData')/data/` | 内嵌 |
| 开发模式 | `npm start` | `<项目根>/data/` | 内嵌 |
| 浏览器调试 | `python -m http.server 8000` | `<项目根>/data/`（只读） | 外部静态服务器 |

**判断逻辑**（见 [main.js#L51](file:///d:/Users/Administrator/Desktop/固定资产管理系统离线版/main.js#L51) `getPortableDataDir`）：
1. `process.env.PORTABLE_EXECUTABLE_DIR` 存在 → 便携模式
2. `app.isPackaged` 为 true → NSIS 安装模式
3. 否则 → 开发模式

> **关键**：NSIS 安装到 `Program Files` 时该目录不可写，必须用 `app.getPath('userData')`。这是 P0-1 修复的根因，勿回退。

---

## 4. 数据存储架构（核心，务必理解）

### 4.1 三重冗余策略

`FileStorageManager`（[storage.js#L13](file:///d:/Users/Administrator/Desktop/固定资产管理系统离线版/js/storage.js#L13)）支持两种模式：

**服务器模式**（Electron 启动时，`fileApiReady=true`）：

```
写入 setItem(key, data):
  1. _saveToServer(key, data)        # POST /api/save 写 data/{key}.json + 同步写 .js
  2. _saveToIndexedDB(key, data)    # 冗余备份（P0-2 新增）
  3. _saveToIndexedDB('__ts_'+key, Date.now())  # 时间戳
  4. _saveToLocalStorage(key, data)  # 同步兜底

读取 getItem(key):
  1. _loadFromServer(key)            # 优先服务器
  2. window.__LOCAL_DATA__[key]      # .js 文件注入的数据
  3. _loadFromLocalStorage(key)      # localStorage
  4. _loadFromIndexedDB(key)         # 最后兜底（P0-2 新增）
```

**本地模式**（`file://` 协议或服务器不可用时，`isLocalMode=true`）：

```
写入 setItem(key, data):
  1. _saveToIndexedDB(key, data)
  2. _saveToIndexedDB('__ts_'+key, Date.now())
  3. _saveToLocalStorage(key, data)
  4. 若已授权 File System Access API:
       _saveToScriptFile(key, data)  # 写 data/{key}.js
     否则:
       _downloadScriptFile(key, data)  # 触发浏览器下载

读取 getItem(key):
  1. 若 isFileSyncEnabled: 取 window.__LOCAL_DATA__ 和 IndexedDB 中数据量更大的一方
  2. 否则: IndexedDB → window.__LOCAL_DATA__ → localStorage
```

### 4.2 `.js` 文件的作用

`data/*.js` 文件采用 JSONP 风格，内容形如：

```javascript
// assetManagementData 数据文件(本地模式)
// 此文件由系统自动维护,请勿手动编辑
// 最后更新: 2026-08-14T10:00:00.000Z
window.__LOCAL_DATA__ = window.__LOCAL_DATA__ || {};
window.__LOCAL_DATA__.assetManagementData = [ /* 资产数据 */ ];
```

**为什么用 `.js` 而不是 `.json`？**
- `file://` 协议下 `fetch()` 无法读取本地文件
- 但 `<script src="data/xxx.js">` 可以加载并执行
- 所以用 `.js` 文件通过 `<script>` 标签注入到 `window.__LOCAL_DATA__`

**为什么还要保留 `.json`？**
- HTTP 服务器模式下，前端通过 `/api/load` 读取 `.json`
- `.js` 文件是同步写入的副本（P2-8 修复），保证两套数据版本一致

### 4.3 附件分离存储

- **localStorage**：仅存附件元数据（文件名、类型、缩略图），避免 5MB 限额
- **IndexedDB**：存完整 base64 数据
- 见 [storage.js#L932](file:///d:/Users/Administrator/Desktop/固定资产管理系统离线版/js/storage.js#L932) `_saveToLocalStorage` 中的 `delete att.url` 逻辑

### 4.4 压缩导出

`compressData(data)` 会克隆数据并删除 `attachment.thumbnail` 和 `attachment.data`，用于导出/备份场景减小体积。注意：**保存到 localStorage 的资产数据会经过压缩**，但 IndexedDB 保留完整数据。

---

## 5. 前端模块加载顺序

`index.html` 底部按以下顺序加载（全部 `defer`，按文档顺序执行）：

```html
<script src="libs/chart.min.js" defer></script>
<script src="libs/xlsx.full.min.js" defer></script>
<!-- 以下按依赖顺序 -->
config.js → storage.js → notifications.js → navigation.js
→ dashboard.js → assets.js → asset-add.js → search-filter.js
→ import-export.js → print.js → asset-edit.js → charts.js
→ maintenance.js → events.js → init.js → final_chart_fix.js
```

> **P2-13 修复**：`final_chart_fix.js` 之前漏了 `defer`，导致它早于 `init.js` 执行，`saveToLocalStorage` 未定义。现已修复。

`init.js` 在 `DOMContentLoaded` 中调用 `loadFromLocalStorage()` 加载数据，完成后渲染 UI。

---

## 6. 硬约束（修改代码前必读）

以下约束来自历史踩坑，**违反会导致难以排查的 bug**：

### 6.1 DOM 操作

- **DOM 查询必须用 `getActivePage()` 限定作用域**：多页面共存于 DOM，直接 `querySelector` 会命中非活动页的元素
- **DOM 引用必须用 `getElement(id)` 缓存工具**：含 `isConnected` 检查，避免 stale 引用
- **模态框用 `.active` CSS 类控制显示**，禁止 `style.display = 'block'`（会与 CSS 冲突导致闪烁）

### 6.2 数据保存

- **`saveToLocalStorage` 同步优先**：先写 localStorage（同步，保证刷新不丢），再写 IndexedDB（异步）
- **服务器保存失败必须通知用户**（P1-7）：调用 `showNotification('⚠️ ...', 'warning', 6000)`
- **写入 `.js` 文件失败不要阻塞主流程**：只记日志（见 [main.js#L266](file:///d:/Users/Administrator/Desktop/固定资产管理系统离线版/main.js#L266)）

### 6.3 异步与错误处理

- **所有异步操作包裹 try/catch**，失败时降级而非崩溃
- **`chart.destroy()` 必须包裹 try/catch**（P2-9）：销毁异常会中断后续图表渲染
- **`createPdfThumbnail` 失败必须通知用户**（P2-11）：区分加密/库加载失败/其他三类错误
- **`alert()` 已全部替换为 `showNotification`**（P2-10）：禁止新增 `alert`

### 6.4 安全

- **`/api/save` 的 `key` 参数禁止包含 `../`、`/`、`\`、`:`**（路径遍历防护，见 [main.js#L150](file:///d:/Users/Administrator/Desktop/固定资产管理系统离线版/main.js#L150)）
- **`/api/save` 请求体上限 20 MB**（P1-4）：防止内存耗尽
- **Electron `webPreferences`**：`contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`（见 [main.js#L412](file:///d:/Users/Administrator/Desktop/固定资产管理系统离线版/main.js#L412)）
- **外部链接在系统浏览器打开**（见 [main.js#L432](file:///d:/Users/Administrator/Desktop/固定资产管理系统离线版/main.js#L432) `setWindowOpenHandler`）

### 6.5 编码规范

- **所有注释使用中文**
- **日志使用 `Logger.info/warn/error(module, ...args)`**，不要直接 `console.log`
- **防抖使用 `config.js` 的 `debounce(key, fn, delay)`**，不要自己写 `setTimeout`
- **加载指示器统一用 `showLoadingIndicator()` / `hideLoadingIndicator()`**

---

## 7. 构建与发布

### 7.1 构建命令

```bash
npm install              # 安装依赖
npm start                # 开发模式启动
npm run build            # 生成便携版 .exe
npm run build:nsis       # 生成 NSIS 安装版
npm run pack             # 仅打包不压缩（调试用）
```

### 7.2 构建配置要点

`package.json` 的 `build` 字段（完整内容见 [package.json](file:///d:/Users/Administrator/Desktop/固定资产管理系统离线版/package.json)）：

| 参数 | 值 | 作用 |
|------|------|------|
| `target` | `portable` | 单文件免安装 exe |
| `arch` | `["x64"]` | 64 位 |
| `electronLanguages` | `["zh-CN", "en-US"]` | locale 从 30+ 精简到 2 个（P2-14） |
| `compression` | `maximum` | 最大压缩比 |
| `files` 排除规则 | `!data/*.json`、`!**/*.{md,d.ts,ts,map}`、`!**/.{git,idea,vscode}/**` | 排除备份/文档/源映射 |

### 7.3 构建后验证

构建完成后建议执行烟雾测试：

1. 运行 `dist/win-unpacked/固定资产管理系统.exe`
2. 观察启动日志：应看到 `[初始化] 创建数据目录` 和 `[服务器] HTTP 服务器运行在 http://127.0.0.1:<port>/`
3. 等待 5~8 秒，确认窗口正常显示、无白屏
4. 检查 `%AppData%/asset-management-system/data/`（NSIS 模式）或 exe 同级 `data/`（便携模式）是否有 8 个 `.js` 文件

> **注意**：开发模式启动时数据目录是 `<项目根>/data/`，便携模式是 `<项目根>/dist/data/`（因为 exe 在 dist 下），两者不共享数据。

### 7.4 桌面快捷方式

双击项目根目录 `安装.bat`，会创建 `固定资产管理系统.lnk` 到桌面（指向 `dist/固定资产管理系统-便携版-{version}.exe`）。

---

## 8. 已知问题与陷阱

### 8.1 已修复但容易回退的坑

| 问题 | 修复 | 容易回退的场景 |
|------|------|----------------|
| NSIS 数据目录不可写 | 用 `app.getPath('userData')` | 改 `getPortableDataDir` 时误删 `app.isPackaged` 分支 |
| `chart.destroy()` 异常中断渲染 | try/catch + 置 null | 新增图表时忘记加 try/catch |
| `final_chart_fix.js` 时序错误 | 加 `defer` | 调整 script 顺序时漏掉 |
| `fa-regular-400.woff2` 404 | 删除该 `@font-face` | 误以为缺字体去补下载 |
| `alert()` 阻塞 UI | 全部替换为 `showNotification` | 新增功能时习惯性写 `alert` |
| `/api/save` chunk 编码错误 | 用 `Buffer.concat` | 改回字符串拼接 |
| 便携初始化误判 | 只检查 `.js` 文件 | 改回检查所有文件 |

### 8.2 未完成 / 待优化事项

以下事项**尚未处理**，接手人可按需推进：

1. **测试覆盖**：项目目前无自动化测试。建议补充 Playwright 端到端测试（用户技术栈包含 Playwright）：
   - 启动 → 资产 CRUD → 导入导出 → 图表渲染
   - 便携模式数据持久化（重启后数据仍在）

2. **ICSP 签名**：exe 未做代码签名，Windows SmartScreen 会拦截首次运行。如需企业分发，需购买代码签名证书并配置 electron-builder 的 `win.certificateFile`。

3. **应用图标**：当前使用 electron 默认图标（`default Electron icon is used`，见构建日志）。如需自定义图标，放置 `build/icon.ico`（256x256，多分辨率）。

4. **`statistics.js` 说明文档**：项目根目录有 `统计数据功能说明.md`，内容是否与当前实现一致未校验。

5. **PDF.js Worker 加载方式**：当前 `ensurePdfJs()` 动态加载 `libs/pdf.min.js`，未显式配置 `workerSrc`。若未来 PDF 渲染异常，检查 `pdfjsLib.GlobalWorkerOptions.workerSrc` 是否指向 `libs/pdf.worker.min.js`。

6. **`asset_label_print.html`**：独立打印页面，与主应用的数据传递方式未在本轮交接中详查，修改前建议先读源码理解。

### 8.3 调试技巧

- **打开 DevTools**：`npm start -- --dev` 或设置 `NODE_ENV=development`
- **查看存储数据**：DevTools → Application → IndexedDB / Local Storage
- **查看 HTTP 服务器日志**：Electron 主进程的 `console.log` 输出在终端（开发模式）或 `dist/smoke_stdout.log`（烟雾测试时）
- **强制刷新**：Electron `Ctrl+R`；浏览器 `Ctrl+F5` 或加 `?t=<时间戳>` URL 参数
- **数据目录定位**：启动日志第一行 `[应用] 数据目录: <path>` 即为当前数据目录

---

## 9. 关键 API 速查

### 9.1 主进程 API（main.js）

| 端点 | 方法 | 作用 |
|------|------|------|
| `/api/load?key=<key>` | GET | 加载 `data/<key>.json` |
| `/api/save?key=<key>` | POST | 保存到 `data/<key>.json` + 同步写 `.js`（请求体上限 20MB） |
| `/api/delete?key=<key>` | DELETE | 删除 `data/<key>.json` |
| `/api/list` | GET | 列出所有数据键 |
| `/api/ping` | GET | 存活检测，返回 `window.__serverOnline=true` |
| `/api/info` | GET | 服务器信息（端口、URL） |

### 9.2 前端核心 API

| API | 文件 | 作用 |
|-----|------|------|
| `storageManager.setItem(key, data)` | storage.js | 写入数据（三重冗余） |
| `storageManager.getItem(key)` | storage.js | 读取数据（按优先级回退） |
| `storageManager.compressData(data)` | storage.js | 压缩数据（移除附件 thumbnail/data） |
| `storageManager.decompressData(data)` | storage.js | 解压数据 |
| `storageManager.checkVersionCompatibility(version)` | storage.js | 版本兼容性检查 |
| `saveToLocalStorage()` | storage.js | 保存所有数据（防抖，见下方说明） |
| `loadFromLocalStorage(callback)` | storage.js | 加载所有数据 |
| `showNotification(msg, type, duration)` | notifications.js | 显示 Toast（type: info/success/warning/error） |
| `showLoadingIndicator()` / `hideLoadingIndicator()` | notifications.js | 加载指示器 |
| `switchPage(pageName)` | navigation.js | 切换页面 |
| `getActivePage()` | config.js | 获取当前活动页 DOM |
| `getElement(id)` | config.js | 缓存式 DOM 查询（含 isConnected 检查） |
| `debounce(key, fn, delay)` | config.js | 统一防抖 |
| `Logger.info/warn/error(module, ...args)` | config.js | 统一日志 |
| `renderAllReportsCharts()` | charts.js | 渲染 4 个统计图表 |
| `createPdfThumbnail(dataUrl, w, h, callback, fileName)` | asset-add.js | 生成 PDF 缩略图 |
| `exportToExcel(type)` / `exportToJson(type)` | import-export.js | 导出 |
| `handleExcelImport(e)` / `handleJsonImport(e)` | import-export.js | 导入 |

### 9.3 `saveToLocalStorage` 的特殊行为

`final_chart_fix.js` 会**包装** `window.saveToLocalStorage` 和 `window.switchPage`：

```javascript
const originalSaveToLocalStorage = window.saveToLocalStorage;
window.saveToLocalStorage = function() {
    const result = originalSaveToLocalStorage.apply(this, arguments);
    if (window.updateStatistics) window.updateStatistics();
    // 若在报表页，200ms 防抖重渲染图表
    if (在报表页 && window.renderAllReportsCharts) {
        debounce 重渲染
    }
    return result;
};
```

**含义**：不要直接修改 `saveToLocalStorage` 的实现来加图表刷新逻辑，而应修改 `final_chart_fix.js` 的包装层。

### 9.4 STORAGE_KEYS 常量

定义在 [config.js#L43](file:///d:/Users/Administrator/Desktop/固定资产管理系统离线版/js/config.js#L43)，所有存储键名集中管理：

```javascript
const STORAGE_KEYS = {
    ASSET_MANAGEMENT_DATA: 'assetManagementData',
    USER_STATE_DATA: 'userStateData',
    SYSTEM_SETTINGS: 'systemSettings',
    BACKUP_HISTORY: 'backupHistory',
    ASSET_CARD_TEMPLATE: 'assetCardTemplate',
    ANALYZED_EXCEL_FORMATS: 'analyzedExcelFormats',
    CUSTOM_OPTIONS_OWNER: 'custom_options_owner',
    CUSTOM_OPTIONS_TYPE: 'custom_options_type',
    CUSTOM_OPTIONS_DEPARTMENT: 'custom_options_department',
    CUSTOM_OPTIONS_OWNER_DELETED: 'custom_options_owner_deleted',
    CUSTOM_OPTIONS_TYPE_DELETED: 'custom_options_type_deleted',
    CUSTOM_OPTIONS_DEPARTMENT_DELETED: 'custom_options_department_deleted'
};
```

`data/` 目录下的文件名与这些键名一一对应（如 `assetManagementData.js` / `assetManagementData.json`）。

---

## 10. 已完成修复清单（v2.4.4）

共 18 项，按优先级分组。详细信息见 [交付报告.md](file:///d:/Users/Administrator/Desktop/固定资产管理系统exe离线便携版/交付报告.md)。

### P0 数据风险（3 项）
- P0-1：NSIS 安装模式数据目录不可写 → `getPortableDataDir` 区分三种模式
- P0-2：服务器模式缺 IndexedDB 冗余 → `setItem`/`getItem` 增加 IndexedDB 备份
- P0-3：便携初始化判断过宽松 → 只检查 `.js` 文件

### P1 稳定性（4 项）
- P1-4：`/api/save` chunk 编码错误 → 改用 `Buffer.concat` + 20MB 上限
- P1-5：HTTP 服务器未关闭 → `before-quit` 钩子优雅关闭 + 3 秒超时
- P1-6：`value=undefined` 写入包装对象 → 显式校验
- P1-7：保存失败静默 → `Logger.error` + `showNotification`

### P2 优化（8 项）
- P2-8：便携模式 `.js` 与 `.json` 版本不一致 → `/api/save` 同步写 `.js`
- P2-9：`chart.destroy()` 异常中断渲染 → 4 个图表实例加 try/catch + 置 null
- P2-10：`alert()` 阻塞 UI → 16 处替换为 `showNotification`，增强支持 `duration` 和多行
- P2-11：PDF 缩略图失败无提示 → `createPdfThumbnail` 新增 `fileName` 参数，区分三类错误
- P2-12：`fa-regular-400.woff2` 404 → 删除 `@font-face`，`.far` 回退到 solid
- P2-13：`final_chart_fix.js` 时序错误 → 加 `defer`
- P2-14：构建体积过大 → `electronLanguages` + `compression: maximum` + 排除规则
- P2-15：README 死链 → 重写

### P3 代码规范（2 项）
- P3-16：`main.js` 未使用 `url` 模块 → 删除
- P3-17：静态文件无缓存 → `libs/` 下不可变资源加 `Cache-Control: public, max-age=2592000, immutable`

> **勘误**：上一份交付报告中 P3-17 描述为「Cache-Control: no-cache」有误，实际是给 `libs/` 下的库文件加长缓存（30 天 immutable），主应用文件不加缓存。详见 [main.js#L354](file:///d:/Users/Administrator/Desktop/固定资产管理系统离线版/main.js#L354)。

### 验证
- 8 个修改文件全部通过 `node --check`
- 构建成功产出 `固定资产管理系统-便携版-2.4.0.exe`（61.4 MB）
- 烟雾测试：启动 8 秒未崩溃，数据目录创建成功，HTTP 服务器在 `127.0.0.1:8221` 运行，stderr 无错误

---

## 11. 技术栈与版本

| 组件 | 版本 |
|------|------|
| Electron | 30.5.1（package.json 声明 `^30.0.0`） |
| electron-builder | 24.13.3 |
| Node.js（开发环境） | 任意现代版本（建议 18+） |
| Chart.js | 见 `libs/chart.min.js` |
| SheetJS (XLSX) | 0.18.5 |
| PDF.js | 见 `libs/pdf.min.js` |
| Font Awesome | 6.x（仅 solid 字体） |

---

## 12. 接手人建议工作流

1. **第一周**：跑通项目，阅读 `storage.js` 全文（这是最复杂的模块），理解三重冗余
2. **第二周**：补 Playwright 端到端测试基线（启动 + 资产 CRUD）
3. **后续**：按业务需求迭代，每次修改后运行 `node --check` + 烟雾测试

### 修改代码时的 PR 自检清单

- [ ] `node --check` 语法通过
- [ ] 没有新增 `alert()`
- [ ] 异步操作有 try/catch
- [ ] DOM 查询用了 `getActivePage()` 或 `getElement(id)`
- [ ] 新增图表的 `destroy()` 包裹了 try/catch
- [ ] 日志用 `Logger` 而非 `console.log`
- [ ] 注释为中文
- [ ] 若改了 `package.json` 的 `files`，确认构建产物包含必要文件
- [ ] 构建后做烟雾测试

---

## 13. 联系上下文

- **项目语言**：中文（代码注释、用户界面、文档均使用中文）
- **用户偏好**：系统性修复而非打补丁；要求详细记录变更和测试结果
- **历史对话**：用户曾要求「项目优化空间检查」→ 产出 20 项问题清单 → 按 P0~P3 优先级全部修复

---

**文档结束。如有疑问，优先阅读源码注释（中文），其次参考 [交付报告.md](file:///d:/Users/Administrator/Desktop/固定资产管理系统离线版/交付报告.md) 和 [README.md](file:///d:/Users/Administrator/Desktop/固定资产管理系统离线版/README.md)。**
