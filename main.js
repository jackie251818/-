/**
 * Electron 主进程入口 - 固定资产管理系统便携式离线版
 *
 * 设计要点:
 * 1. 内嵌 HTTP 服务器(复用 simple_server.js 逻辑),自动选择可用端口
 * 2. 静态资源从应用目录(asar 内)提供
 * 3. 数据目录支持便携式模式:数据保存在 exe 旁边的 data/ 目录,跟 exe 走
 * 4. 首次运行时,从 asar 内的初始 data 目录复制 .js 数据文件到便携式数据目录
 */

const { app, BrowserWindow, Menu, shell } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

// 应用资源目录(打包后位于 asar 内,开发时为 __dirname)
const APP_DIR = __dirname;

// MIME 类型映射表
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.htm': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'font/otf',
    '.pdf': 'application/pdf',
    '.csv': 'text/csv; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.map': 'application/json; charset=utf-8'
};

/**
 * 获取便携式数据目录
 * - 便携式打包模式: exe 旁边的 data/ 目录(electron-builder portable 自动设置 PORTABLE_EXECUTABLE_DIR)
 * - NSIS 安装模式: %APPDATA%/<appName>/data(用户可写,Program Files 不可写)
 * - 开发模式: 项目目录下的 data/ 目录
 */
function getPortableDataDir() {
    // 便携式打包模式:数据跟 exe 走
    if (process.env.PORTABLE_EXECUTABLE_DIR) {
        return path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'data');
    }
    // NSIS 安装模式:Program Files 不可写,使用 userData 目录
    if (app.isPackaged) {
        return path.join(app.getPath('userData'), 'data');
    }
    // 开发模式
    return path.join(APP_DIR, 'data');
}

/**
 * 初始化便携式数据目录
 * 首次运行时,从 asar 内的初始 data 目录复制 .js 数据文件到便携式数据目录
 * 不覆盖已存在的文件,保护用户数据
 */
function initPortableDataDir(portableDataDir) {
    try {
        if (!fs.existsSync(portableDataDir)) {
            fs.mkdirSync(portableDataDir, { recursive: true });
            console.log(`[初始化] 创建数据目录: ${portableDataDir}`);
        }

        // 检查便携式数据目录是否已有 .js 数据文件(仅基于 .js 判断,避免被无关 .json 干扰)
        const existingJsFiles = fs.readdirSync(portableDataDir)
            .filter(f => f.endsWith('.js'));
        if (existingJsFiles.length >= 8) {
            console.log(`[初始化] 数据目录已有 ${existingJsFiles.length} 个 .js 数据文件,跳过初始化`);
            return;
        }

        // 从 asar 内的 data 目录复制初始 .js 文件
        const sourceDataDir = path.join(APP_DIR, 'data');
        if (!fs.existsSync(sourceDataDir)) {
            console.warn(`[初始化] 源数据目录不存在: ${sourceDataDir}`);
            return;
        }

        const files = fs.readdirSync(sourceDataDir);
        let copiedCount = 0;
        for (const file of files) {
            // 仅复制 .js 数据文件(不复制 .json、.gitkeep 等)
            if (!file.endsWith('.js')) continue;

            const srcPath = path.join(sourceDataDir, file);
            const destPath = path.join(portableDataDir, file);
            try {
                const content = fs.readFileSync(srcPath, 'utf-8');
                fs.writeFileSync(destPath, content, 'utf-8');
                copiedCount++;
                console.log(`[初始化] 复制初始数据: ${file}`);
            } catch (e) {
                console.error(`[初始化] 复制失败: ${file}`, e.message);
            }
        }
        console.log(`[初始化] 共复制 ${copiedCount} 个初始数据文件`);
    } catch (e) {
        console.error(`[初始化] 数据目录初始化失败:`, e.message);
    }
}

/**
 * 解析请求 URL 为安全的绝对路径,防止路径遍历
 */
function resolveSafePath(requestUrl, publicDir) {
    const parsed = new URL(requestUrl, 'http://localhost');
    let pathname = decodeURIComponent(parsed.pathname);

    if (pathname === '/') {
        pathname = '/index.html';
    }

    const resolved = path.resolve(publicDir, '.' + pathname);
    const normalizedPublic = path.resolve(publicDir);

    if (resolved !== normalizedPublic && !resolved.startsWith(normalizedPublic + path.sep)) {
        return null;
    }
    return resolved;
}

/**
 * 启动内嵌 HTTP 服务器
 * @param {string} publicDir 静态资源目录
 * @param {string} dataDir 数据目录
 * @returns {Promise<number>} 监听端口
 */
function startServer(publicDir, dataDir) {
    return new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
            const parsedUrl = new URL(req.url, 'http://localhost');
            const pathname = parsedUrl.pathname;

            // ============ API 端点处理 ============
            if (pathname.startsWith('/api/')) {
                const key = parsedUrl.searchParams.get('key') || '';
                // 安全校验:key 不允许包含 ../ 或绝对路径
                if (key && (key.includes('..') || key.includes('/') || key.includes('\\') || key.includes(':'))) {
                    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: false, error: '非法的 key 参数' }));
                    return;
                }

                // GET /api/load?key=xxx - 加载数据文件
                if (req.method === 'GET' && pathname === '/api/load') {
                    if (!key) {
                        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                        res.end(JSON.stringify({ success: false, error: '缺少 key 参数' }));
                        return;
                    }
                    const filePath = path.join(dataDir, `${key}.json`);
                    fs.readFile(filePath, 'utf-8', (err, data) => {
                        if (err) {
                            if (err.code === 'ENOENT') {
                                res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
                                res.end(JSON.stringify({ success: false, error: '文件不存在', data: null }));
                            } else {
                                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                                res.end(JSON.stringify({ success: false, error: err.message }));
                            }
                            return;
                        }
                        try {
                            const parsed = JSON.parse(data);
                            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                            res.end(JSON.stringify({ success: true, data: parsed }));
                        } catch (e) {
                            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                            res.end(JSON.stringify({ success: true, data: data }));
                        }
                    });
                    return;
                }

                // GET /api/list - 列出所有数据文件
                if (req.method === 'GET' && pathname === '/api/list') {
                    fs.readdir(dataDir, (err, files) => {
                        if (err) {
                            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                            res.end(JSON.stringify({ success: false, error: err.message }));
                            return;
                        }
                        const jsonFiles = files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
                        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                        res.end(JSON.stringify({ success: true, data: jsonFiles }));
                    });
                    return;
                }

                // POST /api/save?key=xxx - 保存数据到文件
                if (req.method === 'POST' && pathname === '/api/save') {
                    if (!key) {
                        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                        res.end(JSON.stringify({ success: false, error: '缺少 key 参数' }));
                        return;
                    }
                    // 用 Buffer 数组收集 chunk,避免 utf-8 多字节字符被拆分导致拼接损坏
                    const MAX_BODY = 20 * 1024 * 1024; // 20MB 上限
                    const chunks = [];
                    let totalSize = 0;
                    let aborted = false;

                    req.on('data', chunk => {
                        if (aborted) return;
                        totalSize += chunk.length;
                        if (totalSize > MAX_BODY) {
                            aborted = true;
                            res.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' });
                            res.end(JSON.stringify({ success: false, error: '请求体过大(超过 20MB)' }));
                            req.destroy();
                            return;
                        }
                        chunks.push(chunk);
                    });

                    req.on('end', () => {
                        if (aborted) return;
                        const body = Buffer.concat(chunks).toString('utf-8');

                        // 解包 {key, value} 包装对象,显式校验 value
                        let dataToSave;
                        try {
                            const parsed = JSON.parse(body);
                            if (parsed && parsed.value !== undefined) {
                                dataToSave = JSON.stringify(parsed.value, null, 2);
                            } else {
                                // 兼容直接传值的场景(无包装),body 本身就是数据
                                dataToSave = body;
                            }
                        } catch (e) {
                            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                            res.end(JSON.stringify({ success: false, error: '请求体不是有效的 JSON: ' + e.message }));
                            return;
                        }

                        const jsonFilePath = path.join(dataDir, `${key}.json`);
                        fs.writeFile(jsonFilePath, dataToSave, 'utf-8', (err) => {
                            if (err) {
                                console.error(`[API] /api/save 写入 .json 失败: ${key}`, err.message);
                                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                                res.end(JSON.stringify({ success: false, error: err.message }));
                                return;
                            }

                            // P2-8:同步写入 .js 文件(JSONP 风格),保持 data/ 目录下 .js 与 .json 版本一致
                            // .js 文件用于 <script> 标签注入 window.__LOCAL_DATA__
                            const jsFileName = `${key}.js`;
                            const jsFilePath = path.join(dataDir, jsFileName);
                            const jsContent = `// ${key} 数据文件(本地模式)\n` +
                                `// 此文件由系统自动维护,请勿手动编辑\n` +
                                `// 最后更新: ${new Date().toISOString()}\n` +
                                `window.__LOCAL_DATA__ = window.__LOCAL_DATA__ || {};\n` +
                                `window.__LOCAL_DATA__.${key} = ${dataToSave};\n`;
                            fs.writeFile(jsFilePath, jsContent, 'utf-8', (jsErr) => {
                                if (jsErr) {
                                    // .js 同步失败不阻塞主流程,只记日志
                                    console.warn(`[API] /api/save 同步写入 .js 失败(不影响主流程): ${key}`, jsErr.message);
                                }
                                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                                res.end(JSON.stringify({ success: true }));
                            });
                        });
                    });
                    return;
                }

                // DELETE /api/delete?key=xxx - 删除数据文件
                if (req.method === 'DELETE' && pathname === '/api/delete') {
                    if (!key) {
                        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                        res.end(JSON.stringify({ success: false, error: '缺少 key 参数' }));
                        return;
                    }
                    const filePath = path.join(dataDir, `${key}.json`);
                    fs.unlink(filePath, (err) => {
                        if (err) {
                            if (err.code === 'ENOENT') {
                                // 文件不存在视为删除成功(幂等)
                                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                                res.end(JSON.stringify({ success: true }));
                            } else {
                                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                                res.end(JSON.stringify({ success: false, error: err.message }));
                            }
                            return;
                        }
                        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                        res.end(JSON.stringify({ success: true }));
                    });
                    return;
                }

                // GET /api/ping - 服务器存活检测
                if (req.method === 'GET' && pathname === '/api/ping') {
                    res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
                    res.end('window.__serverOnline=true;void(0);');
                    return;
                }

                // GET /api/info - 获取服务器信息
                if (req.method === 'GET' && pathname === '/api/info') {
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({
                        success: true,
                        port: server.address().port,
                        host: 'localhost',
                        url: `http://localhost:${server.address().port}`
                    }));
                    return;
                }

                // 未匹配的 API 端点
                res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: false, error: '未知的 API 端点' }));
                return;
            }

            // ============ 静态文件处理 ============
            const filePath = resolveSafePath(req.url, publicDir);
            if (!filePath) {
                res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('403 Forbidden: 非法路径访问');
                return;
            }

            const extname = path.extname(filePath).toLowerCase();
            const contentType = MIME_TYPES[extname] || 'application/octet-stream';

            fs.readFile(filePath, (error, content) => {
                if (error) {
                    if (error.code === 'ENOENT') {
                        const fallbackHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>404</title></head><body><h1>404 Not Found</h1><p>请求的文件不存在。</p></body></html>';
                        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
                        res.end(fallbackHtml, 'utf-8');
                    } else {
                        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                        res.end(`服务器错误: ${error.code}`);
                    }
                } else {
                    // P3-17: libs/ 下第三方库不可变,加长缓存减少重复读取
                    const headers = { 'Content-Type': contentType };
                    if (filePath.includes(path.sep + 'libs' + path.sep) && ['.js', '.css', '.woff2', '.woff', '.ttf'].includes(extname)) {
                        headers['Cache-Control'] = 'public, max-age=2592000, immutable';
                    }
                    res.writeHead(200, headers);
                    res.end(content, 'utf-8');
                }
            });
        });

        // 监听端口 0,让系统自动分配可用端口,避免端口冲突
        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            console.log(`[服务器] HTTP 服务器运行在 http://127.0.0.1:${port}/`);
            console.log(`[服务器] 静态资源目录: ${publicDir}`);
            console.log(`[服务器] 数据目录: ${dataDir}`);
            httpServer = server; // 保存实例,用于退出时优雅关闭
            resolve(port);
        });

        server.on('error', (err) => {
            console.error(`[服务器] 启动失败:`, err.message);
            reject(err);
        });
    });
}

// 主窗口引用,避免被垃圾回收
let mainWindow = null;
// HTTP 服务器引用,退出时优雅关闭,避免最后的写入被截断
let httpServer = null;

/**
 * 创建应用主窗口
 */
async function createWindow() {
    // 确定数据目录并初始化
    const dataDir = getPortableDataDir();
    console.log(`[应用] 数据目录: ${dataDir}`);

    initPortableDataDir(dataDir);

    // 启动内嵌 HTTP 服务器
    let port;
    try {
        port = await startServer(APP_DIR, dataDir);
    } catch (e) {
        console.error(`[应用] HTTP 服务器启动失败,应用将退出:`, e);
        app.quit();
        return;
    }

    // 创建浏览器窗口
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 680,
        title: '固定资产管理系统',
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        }
    });

    // 加载应用首页(通过内嵌 HTTP 服务器)
    await mainWindow.loadURL(`http://127.0.0.1:${port}/index.html`);

    // 隐藏菜单栏(Windows 下按 Alt 仍可显示)
    Menu.setApplicationMenu(null);
    mainWindow.setMenuBarVisibility(false);

    // 页面标题更新时，显式同步到 Electron 窗口标题（确保窗口标题栏跟随系统名称变化）
    mainWindow.on('page-title-updated', (event, title) => {
        event.preventDefault();
        if (mainWindow && title) {
            mainWindow.setTitle(title);
        }
    });

    // 外部链接在系统默认浏览器中打开
    mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
        if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
            shell.openExternal(targetUrl);
        }
        return { action: 'deny' };
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // 开发模式下打开开发者工具
    if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
        mainWindow.webContents.openDevTools();
    }
}

// Electron 准备就绪后创建窗口
app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        // macOS 下点击 dock 图标时重新创建窗口
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// 所有窗口关闭时退出应用(除 macOS 外)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// P1-5: 应用退出前优雅关闭 HTTP 服务器,避免最后的写入被截断导致 JSON 文件损坏
app.on('before-quit', (event) => {
    if (httpServer && httpServer.listening) {
        event.preventDefault();
        console.log('[退出] 正在优雅关闭 HTTP 服务器...');
        httpServer.close(() => {
            console.log('[退出] HTTP 服务器已关闭,退出应用');
            app.exit(0);
        });
        // 3秒兜底:即使有挂起的连接也强制退出
        setTimeout(() => {
            console.warn('[退出] 服务器关闭超时,强制退出');
            app.exit(0);
        }, 3000);
    }
});

// 安全性:阻止创建额外的渲染进程
app.on('web-contents-created', (event, contents) => {
    contents.on('will-attach-webview', (e) => e.preventDefault());
});
