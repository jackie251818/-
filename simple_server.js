const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ============ 端口与路径解析（兼容 Electron 打包环境）============

// 端口优先级：环境变量 SERVER_PORT > 默认 8000
const PORT = parseInt(process.env.SERVER_PORT, 10) || 8000;

// 判断是否运行在 Electron 模式
const IS_ELECTRON = process.env.ELECTRON_MODE === '1';

// 路径解析策略：
// - Electron 打包模式: 静态资源在 process.resourcesPath/app，data/ 在用户可写目录
// - Electron 开发模式: 项目根目录即 __dirname
// - 独立运行模式: process.cwd()
let PUBLIC_DIR;
let DATA_DIR;

if (IS_ELECTRON && process.resourcesPath) {
    // Electron 打包后：静态资源在 resources/app
    PUBLIC_DIR = path.join(process.resourcesPath, 'app');
    // data 目录放在 exe 同级目录（用户可编辑/备份）
    // portable 模式下 process.execPath 指向 exe 本体
    const exeDir = path.dirname(process.execPath);
    DATA_DIR = path.join(exeDir, 'data');
} else {
    // 开发模式或独立 node 运行
    PUBLIC_DIR = process.cwd();
    DATA_DIR = path.join(PUBLIC_DIR, 'data');
}

// 确保 data 目录存在
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ============ data/ 目录默认文件初始化 ============
// 首次运行时自动创建空白数据文件，避免 404 错误
const DEFAULT_DATA = {
    'assetManagementData.json': '[]',
    'userStateData.json': JSON.stringify({
        currentPage: 1,
        currentView: 'dashboard',
        currentZoom: 1,
        systemSettings: {
            systemName: '电脑资产管理系统',
            dateFormat: 'yyyy/mm/dd',
            recordsPerPage: 20
        },
        filters: {
            statusFilter: 'all',
            ownerFilter: 'all',
            typeFilter: 'all',
            departmentFilter: 'all'
        },
        lastSaved: new Date().toISOString()
    }),
    'custom_options_owner.json': '[]',
    'custom_options_type.json': '[]',
    'custom_options_department.json': '[]',
    'custom_options_owner_deleted.json': '[]',
    'custom_options_type_deleted.json': '[]',
    'custom_options_department_deleted.json': '[]'
};

function ensureDefaultDataFiles() {
    for (const [filename, defaultContent] of Object.entries(DEFAULT_DATA)) {
        const filePath = path.join(DATA_DIR, filename);
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, defaultContent, 'utf-8');
            console.log(`[初始化] 创建默认数据文件: ${filename}`);
        }
    }
}

ensureDefaultDataFiles();

// MIME 类型映射表（按扩展名）
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

// 解析请求 URL 为安全的绝对路径，防止路径遍历（如 req.url 包含 ../）
function resolveSafePath(requestUrl) {
    // 使用 URL 解析剥离查询字符串和 hash，仅保留 pathname
    const parsed = new URL(requestUrl, 'http://localhost');
    let pathname = decodeURIComponent(parsed.pathname);

    // 默认入口
    if (pathname === '/') {
        pathname = '/index.html';
    }

    // 规范化路径并解析为绝对路径
    const resolved = path.resolve(PUBLIC_DIR, '.' + pathname);
    const normalizedPublic = path.resolve(PUBLIC_DIR);

    // 防止路径遍历：解析后的路径必须位于 PUBLIC_DIR 之内
    if (resolved !== normalizedPublic && !resolved.startsWith(normalizedPublic + path.sep)) {
        return null;
    }
    return resolved;
}

// 404 响应：优先返回自定义 404.html，不存在时返回内置 HTML，避免回调嵌套异常
function respond404(res) {
    const custom404Path = path.join(PUBLIC_DIR, '404.html');
    fs.readFile(custom404Path, (err, content) => {
        if (err || !content) {
            // 自定义 404.html 不存在，返回内置兜底页面
            const fallbackHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>404</title></head><body><h1>404 Not Found</h1><p>请求的文件不存在。</p></body></html>';
            res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(fallbackHtml, 'utf-8');
        } else {
            res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(content, 'utf-8');
        }
    });
}

// 虚拟网卡名称关键词（需过滤掉）
const VIRTUAL_ADAPTER_KEYWORDS = [
    'VirtualBox', 'VMware', 'Hamachi', 'Hyper-V',
    'WSL', 'Docker', 'vEthernet', 'Loopback',
    'TAP-Windows', 'Miniport', 'Npcap',
    'ZeroTier', 'Tailscale', 'OpenVPN', 'TUN'
];

// 获取本机局域网 IP 地址（过滤虚拟网卡，选择真实物理网卡）
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    const candidates = [];

    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                const isVirtual = VIRTUAL_ADAPTER_KEYWORDS.some(kw =>
                    name.toLowerCase().includes(kw.toLowerCase())
                );
                if (isVirtual) {
                    console.log(`  [虚拟网卡] ${name}: ${iface.address} (已跳过)`);
                } else {
                    console.log(`  [物理网卡] ${name}: ${iface.address}`);
                    candidates.push({ name, address: iface.address });
                }
            }
        }
    }

    // 优先选择物理网卡
    if (candidates.length > 0) {
        console.log(`选择物理网卡: ${candidates[0].name} -> ${candidates[0].address}`);
        return candidates[0].address;
    }

    // 兜底：选择第一个非 internal 的 IPv4
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                console.log(`[兜底] 使用 ${name}: ${iface.address}`);
                return iface.address;
            }
        }
    }

    return 'localhost';
}

const server = http.createServer((req, res) => {
    // 解析请求 URL
    const parsedUrl = new URL(req.url, 'http://localhost');
    const pathname = parsedUrl.pathname;

    // ============ API 端点处理 ============
    if (pathname.startsWith('/api/')) {
        // 安全校验：仅允许 data 目录内的文件操作
        const key = parsedUrl.searchParams.get('key') || '';
        // 防止路径遍历：key 不允许包含 ../ 或绝对路径
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
            const filePath = path.join(DATA_DIR, `${key}.json`);
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
                    // JSON 解析失败，返回原始内容
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: true, data: data }));
                }
            });
            return;
        }

        // GET /api/list - 列出所有数据文件
        if (req.method === 'GET' && pathname === '/api/list') {
            fs.readdir(DATA_DIR, (err, files) => {
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
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
                const filePath = path.join(DATA_DIR, `${key}.json`);
                // 提取 value 字段，避免将 key/value 包装层写入文件
                let dataToSave = body;
                try {
                    const parsed = JSON.parse(body);
                    if (parsed.value !== undefined) {
                        dataToSave = JSON.stringify(parsed.value);
                    }
                } catch (e) {
                    // 非 JSON 格式，直接写入原始 body
                }
                fs.writeFile(filePath, dataToSave, 'utf-8', (err) => {
                    if (err) {
                        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                        res.end(JSON.stringify({ success: false, error: err.message }));
                        return;
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: true }));
                });
            });
            return;
        }

        // GET /api/ping - 服务器存活检测（返回 JavaScript，方便 script 标签检测）
        if (req.method === 'GET' && pathname === '/api/ping') {
            res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
            res.end('window.__serverOnline=true;void(0);');
            return;
        }

        // GET /api/info - 获取服务器信息（IP地址等）
        if (req.method === 'GET' && pathname === '/api/info') {
            const localIP = getLocalIP();
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
                success: true,
                port: PORT,
                host: localIP,
                url: `http://${localIP}:${PORT}`
            }));
            return;
        }

        // 未匹配的 API 端点
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: '未知的 API 端点' }));
        return;
    }

    // ============ 静态文件处理 ============
    // 解析并校验路径，防止路径遍历
    const filePath = resolveSafePath(req.url);
    if (!filePath) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('403 Forbidden: 非法路径访问');
        return;
    }

    // 获取文件扩展名并查找对应 MIME 类型
    const extname = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';

    // 读取文件
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                // 文件不存在
                respond404(res);
            } else {
                // 其他服务器错误
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end(`服务器错误: ${error.code}`);
            }
        } else {
            // 文件读取成功
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// 启动服务器
server.listen(PORT, () => {
    const localIP = getLocalIP();
    console.log(`HTTP 服务器运行在 http://localhost:${PORT}/`);
    console.log(`局域网访问地址: http://${localIP}:${PORT}/`);
});
