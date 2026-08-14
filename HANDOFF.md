# 电脑固定资产管理系统 v2.4 — Agent 交接文档

> **生成时间**: 2026-08-14
> **版本**: v2.4.3
> **项目路径**: `d:\Users\Administrator\Desktop\电脑固定资产管理系统v2.4`

---

## 一、项目概述

纯前端+轻量Node.js服务器的电脑固定资产管理系统，支持离线使用。核心功能：资产CRUD、Excel/JSON导入导出、统计图表、二维码标签打印、附件管理（含PDF缩略图）、自定义下拉选项、多浏览器数据同步。

## 二、技术架构

### 2.1 运行模式

| 模式 | 协议 | 数据存储 | 跨浏览器共享 |
|------|------|----------|-------------|
| 服务器模式（推荐） | `http://localhost:8000` | data/*.json + localStorage + IndexedDB | ✅ 通过服务器API |
| 本地直接打开 | `file://` | localStorage + IndexedDB + data/*.js脚本注入 | ❌ 各浏览器独立 |

### 2.2 数据持久化架构（双写双读）

```
写入流程: showLoadingIndicator → saveToLocalStorage()
  → 同步: _saveToLocalStorage() 写入 localStorage（防刷新丢失）
  → 异步: _saveToIndexedDB() 写入 IndexedDB
  → 异步: _saveToServer() 写入 data/*.json（服务器模式）

读取流程: loadFromLocalStorage()
  → 异步: storageManager.getItem()
    → 优先: window.__LOCAL_DATA__（file://模式脚本注入）
    → 其次: IndexedDB
    → 最后: localStorage（同步兜底）
  → 数据量大者胜出
```

### 2.3 关键约束（必须遵守）

1. **DOM查询必须限定活跃页面** — 使用 `getActivePage()` 限定 `querySelector` 作用域，否则多页面应用会选错元素
2. **加载指示器统一接口** — 必须使用 `showLoadingIndicator()` / `hideLoadingIndicator()` 配对调用，通过CSS类 `visible` 控制，**禁止直接操作 `style.display`**
3. **saveToLocalStorage同步优先** — 先同步写localStorage，再异步写IndexedDB，否则刷新会丢数据
4. **beforeunload同步保存** — 必须用同步 `_saveToLocalStorage()`，不能用Promise
5. **路径安全** — `simple_server.js` 必须验证所有文件路径，防止目录遍历
6. **附件加载失败** — 降级为非阻塞提示，不能用 `alert()` 阻塞页面
7. **页面刷新状态恢复** — `currentView` 必须保存到localStorage，刷新后通过 `<head>` 内联脚本恢复
8. **模态框显示统一用CSS类** — `.modal` 通过 `.active` 类控制显示（`.modal {display:none}` / `.modal.active {display:flex}`），禁止用 inline `style.display = 'block'` 覆盖，避免 hide 时失效
9. **编辑模式隐藏完整详情内容** — `toggleEditMode` / `cancelEditMode` / `cleanupEditUI` 三处必须同步维护 `.asset-details` + `#attachments-container` + `#maintenance-records-table` + 维护记录表头的显示/隐藏，缺一不可
10. **图片查看器先加载再显示** — `openFileViewer` 必须预加载图片到 `new Image()`，等图片 ready 后再赋值给 `modal-image` 的 src 并启用 `.active` 类，防止 modal 打开后图片区域空白跳跃
11. **文件同步自动恢复** — `_restoreFileSystemAccess()` 通过 `queryPermission`（无需用户手势）静默恢复已保存的文件夹句柄；`_saveToScriptFile()` 写入后立即更新 `_fileLastModified` 防止文件监听误报
12. **getElement stale引用保护** — `getElement(id)` 缓存的DOM元素若已从文档移除（`isConnected === false`），必须自动重新查询
13. **搜索安全访问** — `searchAssets()` 中所有字段访问必须用 `(field || '').toLowerCase()` 做空值保护，资产数据可能存在null字段
14. **统一防抖工具** — 各模块防抖必须用 `config.js` 的 `debounce(key, fn, delay)` 函数，禁止在各模块内独立实现 `setTimeout` 防抖，避免重复定时器
15. **图表实例销毁检查** — `charts.js` 渲染图表前必须先检查并销毁旧的 Chart.js 实例（`instance.destroy()`），防止内存泄漏和画布重用错误
16. **附件分离存储** — `_saveToLocalStorage()` 写入资产数据时必须剥离附件 `url`（大base64字段），仅保留 `thumbnail` 等元数据；完整数据保存在 IndexedDB，`openFileViewer()` 按需从 IndexedDB 加载 `url`

## 三、文件结构说明

### 3.1 核心文件

```
index.html              — 主页面（含SVG图标定义、内联恢复脚本、预创建加载指示器）
styles.css              — 全局样式（响应式布局、自定义滚动条、附件横向排版、CustomSelect删除按钮）
simple_server.js        — Node.js HTTP服务器（端口8000，API: /api/save, /api/load, /api/check）
final_chart_fix.js      — 图表渲染修复（200ms防抖，最后加载）
```

### 3.2 JS模块（js/目录，按index.html加载顺序）

| 文件 | 职责 | 关键函数 |
|------|------|----------|
| `config.js` | 全局变量、STORAGE_KEYS常量、Logger、getElement/getActivePage工具函数、统一防抖debounce、轻量状态管理State | `STORAGE_KEYS`, `currentView`, `assetsData`, `debounce()`, `State` |
| `storage.js` | FileStorageManager类、数据加载/保存、文件监听轮询、跨浏览器同步 | `loadFromLocalStorage()`, `saveToLocalStorage()`, `_saveToLocalStorage()`, `_loadFromLocalStorage()` |
| `notifications.js` | 通知消息、加载指示器（visible类控制） | `showLoadingIndicator()`, `hideLoadingIndicator()` |
| `navigation.js` | 页面切换、currentView保存/恢复、图片缩放重置 | `switchPage()`, `resetImageZoom()` |
| `dashboard.js` | 控制面板渲染（统计卡片、最近资产、损坏设备） | `renderRecentAssets()`, `renderDamagedAssets()`, `updateStatistics()` |
| `assets.js` | 资产列表渲染、分页、详情页、附件查看器 | `renderAllAssets()`, `viewAssetDetails()` |
| `asset-add.js` | 添加资产表单、文件上传预览、CustomSelect初始化 | `bindAddAssetEvents()` |
| `search-filter.js` | CustomSelect自定义下拉组件（添加/删除选项）、多条件筛选 | `CustomSelect` class |
| `import-export.js` | Excel/JSON导入导出、模板下载、备份恢复 | `importFromExcel()`, `exportToExcel()` |
| `print.js` | 固定资产登记卡打印、标签打印、二维码生成 | `printAssetCard()`, `generateCardFromTemplate()` |
| `asset-edit.js` | 资产编辑表单、附件保存、CustomSelect初始化 | `saveEditedAsset()`, `createEditForm()` |
| `charts.js` | 统计报表Chart.js图表 | `renderAllReportsCharts()` |
| `maintenance.js` | 维护记录CRUD | `addMaintenanceRecord()` |
| `events.js` | 事件绑定（按钮点击、搜索、筛选、文件监听回调、刷新按钮） | `bindCoreEventListeners()`, `bindDataDependentEventListeners()`, `refreshActivePageContent()` |
| `init.js` | DOMContentLoaded初始化、页面状态恢复、模板加载、扫码跳转 | `initTemplateLoading()`, `handleAssetUrlParam()` |

### 3.3 数据文件（data/目录）

每个数据键同时保存 `.js`（file://模式脚本注入）和 `.json`（服务器API读写）两份：

| 文件 | STORAGE_KEY | 说明 |
|------|-------------|------|
| `assetManagementData.js/json` | `assetManagementData` | 资产数据数组 |
| `userStateData.js/json` | `userStateData` | 用户状态（currentView, currentPage, 筛选条件, 系统设置） |
| `custom_options_owner.js/json` | `custom_options_owner` | 主体自定义选项 |
| `custom_options_type.js/json` | `custom_options_type` | 设备类型自定义选项 |
| `custom_options_department.js/json` | `custom_options_department` | 部门自定义选项 |
| `custom_options_*_deleted.js/json` | `custom_options_*_deleted` | 已删除的预设选项（防止重新出现） |

### 3.4 第三方库（libs/目录）

| 库 | 用途 |
|----|------|
| `chart.min.js` | Chart.js 统计图表 |
| `xlsx.full.min.js` | SheetJS Excel导入导出 |
| `pdf.min.js` + `pdf.worker.min.js` | PDF.js 附件PDF缩略图渲染 |
| `qrcode.min.js` | 二维码生成（标签打印） |
| `font-awesome.min.css` + `fa-solid-900.woff2` | Font Awesome图标字体 |

### 3.5 脚本和工具

| 文件 | 说明 |
|------|------|
| `simple_server.js` | 主服务器（Node.js，端口8000） |
| `start_server.bat` | 启动Node.js服务器 |
| `start_simple_server.bat` | 启动Python服务器 |
| `一键创建桌面快捷方式.bat` | 创建桌面快捷方式（命名"固定资产管理系统离线版"） |
| `create_shortcut.ps1` | PowerShell快捷方式创建脚本 |

## 四、最近修改记录（本次会话）

### 4.8 自动文件同步与手动连接体验优化（2026-08-14）

**问题**: 之前的自动连接方案（全局click监听器）导致：
1. 打开页面时不弹出文件夹选择器，切换页面时才触发
2. 每次点击"允许"后误报"检测到数据变化"（文件写入后被文件监听误判为外部修改）
3. 需每次手动选择data文件夹，无法自动恢复
4. 删除已保存附件后无法保存

**修复文件**: `js/storage.js`, `js/events.js`, `js/asset-edit.js`, `js/config.js`, `js/search-filter.js`

- **[storage.js](file:///d:/Users/Administrator/Desktop/电脑固定资产管理系统v2.4/js/storage.js)**：
  - 删除废弃的 `_registerEarlyAutoConnectListener()` 方法（~100行，全局click监听器方案）
  - 删除废弃的 `_clearBrowserCache()` 方法（~45行，浏览器重启清理方案）
  - 删除废弃变量：`_autoConnectPending`、`_autoConnectClickListenerBound`、`_debugTrace`
  - `_saveToScriptFile()` 写入成功后立即更新 `_fileLastModified[key] = file.lastModified`，防止文件监听轮询误报
  - `_restoreFileSystemAccess()` 只调用 `queryPermission`（无需用户手势），权限已授予时静默恢复连接
  - 新增 `_suppressWatchNotification` 机制：内部写入文件期间阻止 `onFileChange` 触发通知回调

- **[events.js](file:///d:/Users/Administrator/Desktop/电脑固定资产管理系统v2.4/js/events.js)**：
  - `initFileSyncBanner()` 中修改 `checkBannerState()`：浏览器支持File System Access API且未连接时显示横幅（之前是隐藏）
  - `updateFileSyncStatus()` 简化状态文本，移除对 `_autoConnectClickListenerBound` 的引用
  - `onFileChange` 回调入口增加 `_suppressWatchNotification` 检查（双重防护）

- **[asset-edit.js](file:///d:/Users/Administrator/Desktop/电脑固定资产管理系统v2.4/js/asset-edit.js)**：
  - `renderEditModeAttachments()` 删除循环末尾重复的click事件绑定（原L435-441），每个分支内已绑定 `openFileViewer`
  - 删除死代码 `setupEditModeAttachmentViewer()`（从未被调用，功能已由events.js文档级事件委托覆盖）
  - `saveEditedAsset()` 中查找新文件预览从 `activePage.querySelectorAll` 改为 `document.getElementById('edit-file-previews')`，避免编辑表单不在activePage内部时找不到元素
  - `finalizeSave()` 从DOM读取剩余未删除的已有附件（通过 `dataset.index` 映射），确保用户删除的附件不会被加回
  - 无新文件时补充 `finalizeSave([])` 调用，确保删除已有附件后保存能正常执行
  - `renderEditModeAttachments()` 和 `handleEditFileUpload()` 增加容器空值检查

- **[config.js](file:///d:/Users/Administrator/Desktop/电脑固定资产管理系统v2.4/js/config.js)**：
  - `getElement()` 增加 `isConnected` 检测：缓存的DOM元素若已从文档移除，自动重新查询，修复stale引用问题

- **[search-filter.js](file:///d:/Users/Administrator/Desktop/电脑固定资产管理系统v2.4/js/search-filter.js)**：
  - `searchAssets()` 对所有字段（id/owner/brandModel/user/department/type/description/location）统一做空值保护 `(field || '').toLowerCase()`，修复null字段导致TypeError静默返回空结果
  - 扩展搜索范围：新增type（设备类型）、description（配置信息）、location（位置）字段

**现在的连接流程**:
| 场景 | 行为 |
|------|------|
| 首次使用 | 顶部横幅提示 → 用户点击"连接数据文件夹" → showDirectoryPicker弹出 → 选择文件夹 → 句柄保存到IndexedDB → 状态变为"文件同步已启用" |
| 再次打开 | 自动读取已保存句柄 → queryPermission检查权限 → 权限已授予则静默恢复 → 无需手动选择 |
| 权限失效 | 显示横幅 → 用户点击"连接" → 重新授权 |
| 手动断开后 | 显示横幅 → 用户点击"连接" → 重新选择文件夹 |

### 4.10 资产表格不渲染Bug修复 + 空引用防护（2026-08-14）

**问题**: 运行时测试发现资产表格显示"暂无资产记录"，但 `assetsData` 有1条记录且 `dashboard-total-assets` 显示1。`total-records` 也更新为"共1条记录"，但表格tbody行数为0。

**根因**: `renderAllAssets()` 中数据行追加逻辑被包裹在 `requestAnimationFrame()` 回调中。当资产页面非active（如初始化时当前视图为dashboard，或搜索/筛选在dashboard页触发）时，浏览器可能延迟或节流RAF回调，导致 `tableBody.appendChild(fragment)` 未执行，行不渲染。而 `renderPagination()` 在RAF外同步执行，所以 `total-records` 正常更新。

**修复**: [assets.js](file:///d:/Users/Administrator/Desktop/电脑固定资产管理系统v2.4/js/assets.js) L28-39 — 移除 `requestAnimationFrame` 包装，改为在 setTimeout 回调内同步使用 `DocumentFragment` 追加行。每页最多20行，同步追加无性能问题。

**同时修复的空引用Bug**（运行时代码审查发现）:
| 文件 | 行号 | 问题 | 修复 |
|------|------|------|------|
| [init.js](file:///d:/Users/Administrator/Desktop/电脑固定资产管理系统v2.4/js/init.js#L185) | L185 | `checkUsage()` 是async但未await，存储告警静默失效 | 添加 `await` + try-catch |
| [init.js](file:///d:/Users/Administrator/Desktop/电脑固定资产管理系统v2.4/js/init.js#L192) | L192 | `backup-data` 按钮未判空 | 添加 `if (backupBtn)` 检查 |
| [print.js](file:///d:/Users/Administrator/Desktop/电脑固定资产管理系统v2.4/js/print.js#L8) | L8, L15 | `getElement('asset-id').textContent` 未判空 | 提取变量 + 三元判空 |
| [maintenance.js](file:///d:/Users/Administrator/Desktop/电脑固定资产管理系统v2.4/js/maintenance.js#L7) | L7, L42 | 同上 | 同上 |
| [asset-edit.js](file:///d:/Users/Administrator/Desktop/电脑固定资产管理系统v2.4/js/asset-edit.js#L550) | L550, L728 | 同上 | 同上 |

**验证**: 浏览器测试通过 — 强制刷新后表格正确渲染1条资产记录（ZC-2025-001），`total-records`="共1条记录"，`dashboard-total-assets`="1"，无控制台error。

### 4.9 全项目性能优化（2026-08-14）

**目标**: 系统化优化渲染性能、内存管理、存储效率和代码可维护性。

**优化文件**: `js/config.js`, `js/storage.js`, `js/assets.js`, `js/events.js`, `js/search-filter.js`, `js/charts.js`

- **[config.js](file:///d:/Users/Administrator/Desktop/电脑固定资产管理系统v2.4/js/config.js)**：
  - 新增统一防抖工具函数 `debounce(key, fn, delay)`（L114-129）：通过唯一key合并定时器，避免各模块重复实现 `setTimeout` 防抖
  - 新增轻量状态管理 `State` 对象（L73-110）：提供 `on/setAssetsData/setView/setPage` 订阅-通知模式，支持 `assetsData/currentView/currentPage` 三个key的状态变更监听，避免各模块手动轮询

- **[storage.js](file:///d:/Users/Administrator/Desktop/电脑固定资产管理系统v2.4/js/storage.js)**：
  - 文件监听轮询间隔从默认值优化为 5000ms（L29 `_fileWatchInterval = 5000`），降低CPU占用
  - `_saveToLocalStorage()`（L932-948）对资产数据主动剥离附件 `url`（大base64字段），仅保留 `thumbnail` 等元数据写入 localStorage，解决 5MB 限额问题；完整数据仍保存在 IndexedDB
  - `QuotaExceededError` 降级处理（L959-987）：空间不足时自动移除 `url/thumbnail/data` 后重试，确保保存不静默失败

- **[assets.js](file:///d:/Users/Administrator/Desktop/电脑固定资产管理系统v2.4/js/assets.js)**：
  - `openFileViewer()`（L426-449）附件 `url` 不存在时（localStorage瘦身后），按需从 IndexedDB 加载完整数据获取 `url`，避免附件查看失败
  - `renderAllAssets()` 使用 50ms 防抖 + `requestAnimationFrame` + `DocumentFragment` 减少DOM重绘

- **[events.js](file:///d:/Users/Administrator/Desktop/电脑固定资产管理系统v2.4/js/events.js)**：
  - 搜索框统一使用 `debounce()` 函数：dashboard-search（L343, 200ms）、assets-search（L363, 200ms）
  - 筛选器统一使用 `debounce()` 函数：filter（L371/L411, 100ms）
  - 搜索框新增回车搜索（`keydown` Enter 触发），配合实时搜索提升交互体验
  - 资产操作按钮、缩放控制、侧边栏菜单、面包屑导航统一使用 `document.addEventListener('click', ...)` 事件委托（L436/L512/L754/L789/L940），避免动态内容事件丢失

- **[search-filter.js](file:///d:/Users/Administrator/Desktop/电脑固定资产管理系统v2.4/js/search-filter.js)**：
  - `applyFilters()` 增加 try-catch 错误边界（L38/L126-127），防止单个筛选条件异常导致整个筛选功能失效
  - 筛选器元素不存在时提前返回并 `console.warn`（L41），避免后续 `null.value` 错误

- **[charts.js](file:///d:/Users/Administrator/Desktop/电脑固定资产管理系统v2.4/js/charts.js)**：
  - 4个图表渲染前均增加 `instance.destroy()` 检查（L97/L201/L304/L410），防止 Chart.js 实例重复创建导致内存泄漏和画布重用错误

**优化效果**:
| 优化项 | 改善点 |
|--------|--------|
| 统一防抖 | 消除各模块重复定时器，代码可维护性提升 |
| 附件分离存储 | localStorage 空间占用大幅降低（移除base64 url），解决5MB限额 |
| 图表销毁检查 | 防止内存泄漏，多次切换报表页面不再累积Chart实例 |
| 事件委托统一 | 动态生成元素事件不再丢失，减少事件绑定数量 |
| 文件监听间隔 | 5秒轮询降低CPU占用，平衡实时性与性能 |
| 搜索/筛选防抖 | 200ms/100ms防抖减少不必要的渲染，输入更流畅 |
| 错误边界 | 单点异常不再导致整个功能瘫痪 |

### 4.5 导入/导出按钮迁移至系统设置页面

**问题**: 数据管理按钮（导入Excel/JSON、导出Excel/JSON、下载模板）在所有页面顶部显示，杂乱且容易误触。

**修复文件**: `index.html`, `styles.css`
- 从页面顶部 `.content-header` 下的 `.data-management` 区域整体移除按钮组
- 将 5 个按钮 + 2 个隐藏的 file input 插入到 `settings-page` 的"数据管理"卡片内（备份数据按钮上方）
- 调整 [styles.css](file:///d:\Users\Administrator\Desktop\电脑固定资产管理系统v2.4\styles.css) 中 `.data-management` 样式：
  - `justify-content` 由 `flex-end`（右对齐）改为 `flex-start`（卡片内左对齐）
  - `margin-bottom: var(--spacing-xl)` 改为 `margin: 15px 0`
  - 新增 `flex-wrap: wrap` 支持窄屏自动换行
- 按钮的 `id`（`import-excel`, `import-json`, `export-excel`, `export-json`, `download-template`, `file-import-excel`, `file-import-json`）保持不变，`events.js` 的事件绑定无需修改

### 4.6 文件查看器模态框闪烁修复（未保存附件点击缩略图）

**问题**: 编辑模式下上传但未保存的附件，点击缩略图打开查看器时会出现内容闪烁（modal显示后图片区域先空白再突然显示图片）。保存后点击已保存的附件则正常。

**根因（时序问题）**: [openFileViewer](file:///d:\Users\Administrator\Desktop\电脑固定资产管理系统v2.4\js\assets.js#L398) 原逻辑顺序：
```javascript
imageElement.src = url;           // 1. 设置 src，开始异步加载图片
modal.style.display = 'block';     // 2. 立即显示 modal → img 区域空白
                                   // 3. onload 触发 → 图片突然显示 = 视觉跳动
```
保存后正常的原因：首次点击时大图已被浏览器缓存，后续点击时 src 设置后立即命中缓存，空白时间极短。

**修复文件**: `js/assets.js`, `js/events.js`
- **[openFileViewer 重写](file:///d:\Users\Administrator\Desktop\电脑固定资产管理系统v2.4\js\assets.js#L422-L458)**：
  - 用临时 `new Image()` 对象预加载图片，加载完成后再给 `imageElement.src` 赋值
  - 先绑定 `onload`/`onerror` 回调，再设置 `tempImg.src`（防止缓存命中时事件丢失）
  - 对 DataURL 做 `tempImg.complete && naturalWidth` 快速通道（缓存命中时立即显示，不等事件）
  - **图片就绪后才显示 modal**，消除"空白→图片"视觉跳跃
- **统一 modal 显示控制方式**：
  - 显示：`modal.classList.add('active')`（利用 CSS 中 `.modal { display:none }` + `.modal.active { display:flex }`）
  - 隐藏：[closeFileViewer](file:///d:\Users\Administrator\Desktop\电脑固定资产管理系统v2.4\js\events.js#L426-L440) 改为 `classList.remove('active')` + 清除 `style.display` 内联样式
  - [ESC 关闭判断](file:///d:\Users\Administrator\Desktop\电脑固定资产管理系统v2.4\js\events.js#L462-L465) 改为检查 `.classList.contains('active')`
- 与 `styles.css` 保持一致：CSS 中 `.modal { display:none }` / `.modal.active { display:flex }`（L1020-L1030）

### 4.7 编辑模式"两个页面同时显示"视觉混乱修复

**问题**: 进入资产编辑模式后，编辑表单上方可见但下方详情页的维护记录表头+表格依然可见，用户误以为是"两个页面来回闪烁"。

**根因**: [toggleEditMode](file:///d:\Users\Administrator\Desktop\电脑固定资产管理系统v2.4\js\asset-edit.js#L38-L92) 只隐藏了 `.asset-details`（设备信息三列）和 `#attachments-container`（附件卡片），没有隐藏 `#maintenance-records-table` 和它的 `.card-header`（维护记录区块在 card 内位于这两个元素之后）。

**修复文件**: `js/asset-edit.js` — 在 3 处函数同步维护记录的显示/隐藏：
- **[toggleEditMode (进入编辑)](file:///d:\Users\Administrator\Desktop\电脑固定资产管理系统v2.4\js\asset-edit.js#L78-L83)**：隐藏 `maintenanceTable` + `maintenanceHeader`（通过 `previousElementSibling` 获取表头）
- **[cancelEditMode (取消编辑)](file:///d:\Users\Administrator\Desktop\电脑固定资产管理系统v2.4\js\asset-edit.js#L144-L149)**：恢复显示（`style.display = ''` 清空 inline 样式，继承 CSS 默认值）
- **[cleanupEditUI (保存完成后)](file:///d:\Users\Administrator\Desktop\电脑固定资产管理系统v2.4\js\asset-edit.js#L648-L653)**：恢复显示
- 同时清理 [createEditForm](file:///d:\Users\Administrator\Desktop\电脑固定资产管理系统v2.4\js\asset-edit.js#L174-L181) 中调试遗留的红色边框（`3px solid #ff0000`）、硬编码 `backgroundColor`、`zIndex:9999` 等临时样式，保留必要的显示属性即可

### 4.4 页面刷新闪烁修复（2026-08-13）

**问题**: 浏览器刷新时页面先跳到首页再跳回当前页面，产生闪烁。

**根因**: 
1. `init.js` 在 `DOMContentLoaded` 中过早移除了 `<head>` 内联恢复样式 `_restore_view_style`
2. `loadFromLocalStorage` 异步回调中再次切换 active 类，导致二次渲染

**修复文件**: `js/init.js`
- 不再在 `DOMContentLoaded` 中移除临时样式，改为在 `loadFromLocalStorage` 回调完成后移除
- 移除回调中的二次 active 类切换逻辑（前面同步代码已设置好）

### 4.2 加载指示器卡死修复

**问题**: 页面左上角一直显示"处理中，请稍候..."。

**根因**: `initTemplateLoading()` 用 `loader.style.display = 'block'` 设置内联样式显示，但 `hideLoadingIndicator()` 只移除 `visible` CSS类，内联样式优先级更高导致无法隐藏。

**修复文件**: `js/init.js`, `js/notifications.js`
- `initTemplateLoading()` 改用 `showLoadingIndicator()` 函数（统一通过 `visible` 类控制）
- `hideLoadingIndicator()` 增加双保险：`loader.style.display = ''` 清除可能残留的内联样式

### 4.3 历史修复（本次会话之前）

详见 `project_memory.md` 中的 Lessons Learned 和 Hard Constraints。主要包括：
- 数据同步（file:// → 服务器模式跨浏览器共享）
- 自定义下拉选项添加/删除/持久化/跨浏览器同步
- 附件横向排版 + PDF缩略图生成
- 附件保存数据丢失修复
- 页面状态恢复（currentView保存到localStorage）
- 二维码中文编码修复
- 多页面DOM查询作用域问题

### 4.4 项目代码清理

**清理范围**: 全项目遍历，删除调试代码、无用文件和死代码。

**已删除文件**:
- `script.js` — 旧版单体脚本（已拆分到js/目录，index.html未加载）
- `debug_form.html` — 调试表单页面（无引用）
- `test_qr.html` — 二维码测试页面（无引用）
- `simple_server.py` — Python服务器脚本（bat文件使用 `python -m http.server`，不依赖此文件）

**已清理调试代码**:
- `asset-edit.js`: 删除10处 `console.log`、调试用视觉指示器（绿色浮动div）、setTimeout检查块、重复的console.error
- `events.js`: 删除文件监听console.log、废弃的 `bindEventListeners()` 兼容函数（从未被调用）
- `import-export.js`: 删除4处 console.log（导入成功、XLSX加载、导出成功×2）
- `index.html`: 删除 `onload="console.log('XLSX库加载成功')"` 内联调试日志、清理过期注释
- `final_chart_fix.js`: 简化console.warn消息

**保留的日志**:
- `console.error` — 所有错误日志保留
- `console.warn` — 所有警告日志保留（localStorage空间不足、元素未找到等边界情况）
- `Logger.info/warn` — 项目结构化日志系统保留
- `simple_server.js` 中的 `console.log` — 服务器端日志保留

**验证结果**: 浏览器测试通过 — 页面加载正常、加载指示器隐藏、CustomSelect初始化（3个组件54个选项）、图表渲染（4个）、页面状态恢复、刷新后保持当前页面。

## 五、已知问题和注意事项

### 5.1 遗留问题

| 问题 | 严重程度 | 说明 |
|------|----------|------|
| ~~`script.js`~~ | — | 已删除（旧版单体脚本，index.html未加载，js/目录已完全替代） |
| ~~`debug_form.html` / `test_qr.html`~~ | — | 已删除（调试/测试页面，无引用） |
| ~~`simple_server.py`~~ | — | 已删除（bat文件使用 `python -m http.server`，不依赖此文件） |
| ~~`tests/` 目录~~ | — | 已删除（Playwright测试已过期，不兼容CustomSelect组件） |
| localStorage 容量限制（~5MB） | 低 | 已通过附件分离存储缓解：`_saveToLocalStorage` 剥离附件 `url` 大字段，仅存元数据；`QuotaExceededError` 时自动降级移除 `thumbnail/data` 后重试 |
| Font Awesome图标替换 | 低 | init.js中100ms后替换FA图标为SVG use元素，可能有短暂闪烁 |

### 5.2 开发注意事项

1. **修改JS文件后必须强制刷新** — 浏览器缓存较顽固，建议 `Ctrl+F5` 或添加 `?t=timestamp` 参数
2. **测试数据同步** — 修改storage.js后，需在多个浏览器中测试数据同步
3. **CustomSelect组件** — 异步加载选项，需用 `loadOptionsAsync()` / `loadOptionsSync()` 分别处理
4. **图表防抖** — `final_chart_fix.js` 使用200ms防抖，修改图表渲染逻辑时注意不要绕过
5. **附件base64** — 附件以base64编码存储，`url` 大字段在 localStorage 中被剥离（仅保留元数据），完整数据在 IndexedDB；`openFileViewer()` 按需从 IndexedDB 加载 `url`
6. **Node.js依赖** — `package.json` 只有 `archiver`（用于打包），服务器本身是零依赖原生模块
7. **服务器启动** — 端口8000，`node simple_server.js` 或 `python -m http.server 8000`

### 5.3 代码风格约定

- 中文注释，中文变量名描述
- 防御性编程：所有异步操作包裹 try-catch
- 函数前加注释说明用途
- DOM元素通过 `getElement(id)` 缓存（定义在 config.js）
- 日志使用 `Logger.info/warn/error(module, ...args)`（定义在 config.js）

## 六、快速启动指南

```bash
# 方式1: Node.js服务器（推荐）
cd d:\Users\Administrator\Desktop\电脑固定资产管理系统v2.4
node simple_server.js
# 访问 http://localhost:8000

# 方式2: Python服务器
python -m http.server 8000

# 方式3: 双击index.html（file://模式，无跨浏览器共享）
```

## 七、项目记忆文件位置

接手Agent应首先阅读以下记忆文件获取完整上下文：

| 文件 | 说明 |
|------|------|
| `c:\Users\Administrator\.trae-cn\memory\user_profile.md` | 用户偏好（中文沟通、系统化修复、详细文档） |
| `c:\Users\Administrator\.trae-cn\memory\projects\...\project_memory.md` | 项目级约束、约定、经验教训 |
| `c:\Users\Administrator\.trae-cn\memory\projects\...\20260813\topics.md` | 本次会话主题摘要 |
| `c:\Users\Administrator\.trae-cn\memory\projects\...\20260813\session_memory_*.jsonl` | 本次会话详细记录 |

---

*本文档由Agent自动生成，用于项目交接。如有疑问请参阅项目记忆文件或源代码注释。*
