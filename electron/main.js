/**
 * Electron 主进程入口
 *
 * 职责：
 * 1. 启动内嵌 HTTP 服务器 (simple_server.js)
 * 2. 创建应用窗口并加载 http://localhost:PORT
 * 3. 处理窗口生命周期 (单实例锁、关闭退出)
 * 4. 开发模式下支持 DevTools 自动打开
 */

const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { startServer, getServerPort, waitForServer } = require('./server-launcher');

// 是否为开发模式（通过环境变量 ELECTRON_DEV=1 控制）
const isDev = process.env.ELECTRON_DEV === '1';

let mainWindow = null;

// ============ 单实例锁 ============
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        // 第二个实例尝试启动时，聚焦到已有窗口
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
}

// ============ 创建窗口 ============
function createWindow(port) {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 680,
        title: '电脑资产管理系统',
        icon: path.join(__dirname, '..', 'build', 'icon.png'),
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        }
    });

    // 加载应用页面
    mainWindow.loadURL(`http://localhost:${port}/`);

    // 开发模式自动打开 DevTools
    if (isDev) {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }

    // 拦截外部链接，用系统默认浏览器打开（而非 Electron 窗口）
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) {
            return { action: 'allow' };
        }
        shell.openExternal(url);
        return { action: 'deny' };
    });

    // 窗口关闭时清理引用
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// ============ App 生命周期 ============

// Electron 完成初始化后启动服务器 + 创建窗口
app.whenReady().then(async () => {
    try {
        // 启动内嵌 HTTP 服务器
        const port = await startServer();
        console.log(`[Electron] 内嵌服务器已启动，端口: ${port}`);

        // 等待服务器就绪（健康检查）
        await waitForServer(port, 5000);
        console.log('[Electron] 服务器健康检查通过，正在创建窗口...');

        // 创建应用窗口
        createWindow(port);
    } catch (err) {
        console.error('[Electron] 启动失败:', err.message);
        // 即使健康检查失败也尝试创建窗口（服务器可能需要更长时间预热）
        const port = getServerPort();
        if (port) {
            createWindow(port);
        } else {
            app.quit();
        }
    }
});

// 所有窗口关闭时退出应用 (macOS 除外)
app.on('window-all-closed', () => {
    app.quit();
});

// 应用退出前关闭服务器
app.on('before-quit', () => {
    const { stopServer } = require('./server-launcher');
    stopServer();
});

// macOS 激活时重新创建窗口
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && mainWindow === null) {
        const port = getServerPort();
        if (port) {
            createWindow(port);
        }
    }
});
