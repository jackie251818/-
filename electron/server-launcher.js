/**
 * 服务器启动器 - 在 Electron 主进程中管理内嵌 HTTP 服务器
 *
 * 职责：
 * 1. 以子进程方式启动 simple_server.js
 * 2. 自动探测可用端口（8000 → 8010）
 * 3. 提供健康检查 (waitForServer)
 * 4. 应用退出时清理子进程
 */

const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');

let serverProcess = null;
let serverPort = null;

// Electron 打包后资源路径解析
function getProjectRoot() {
    if (app) {
        // 打包后: process.resourcesPath 指向 resources/app
        // 开发模式: __dirname/../ 即项目根目录
        return app.isPackaged
            ? path.join(process.resourcesPath, 'app')
            : path.join(__dirname, '..');
    }
    return path.join(__dirname, '..');
}

// electron-main.js 中 app 已可用，此处延迟读取
let app = null;
function ensureApp() {
    if (!app) {
        try { app = require('electron').app; } catch (e) {}
    }
    return app;
}

/**
 * 启动内嵌 HTTP 服务器
 * 自动探测可用端口，避免与用户已有服务冲突
 * @returns {Promise<number>} 实际使用的端口号
 */
function startServer() {
    return new Promise((resolve, reject) => {
        ensureApp();
        const projectRoot = getProjectRoot();
        const serverScript = path.join(projectRoot, 'simple_server.js');

        // 检查服务器脚本是否存在
        if (!fs.existsSync(serverScript)) {
            reject(new Error(`服务器脚本不存在: ${serverScript}`));
            return;
        }

        // 通过环境变量传递候选端口范围
        const candidatePorts = [8000, 8001, 8002, 8003, 8004, 8005];

        // 查找可用端口
        findAvailablePort(candidatePorts).then((port) => {
            serverPort = port;

            // 以子进程方式启动服务器
            // 使用 process.execPath 以确保打包后也能找到 Node 运行时
            const isElectron = !process.versions.electron && process.versions.electron !== undefined;
            // 在 Electron 打包环境中，直接用 electron 进程的 Node 运行 server
            const nodeExec = process.execPath;
            const nodeOptions = process.env.ELECTRON_RUN_AS_NODE ? {} : { ELECTRON_RUN_AS_NODE: '1' };

            serverProcess = spawn(nodeExec, [serverScript], {
                cwd: projectRoot,
                env: {
                    ...process.env,
                    ...nodeOptions,
                    SERVER_PORT: String(port),
                    ELECTRON_MODE: '1'
                },
                stdio: ['ignore', 'pipe', 'pipe']
            });

            // 收集服务器输出用于调试
            serverProcess.stdout.on('data', (data) => {
                const msg = data.toString().trim();
                if (msg) console.log(`[Server] ${msg}`);
            });

            serverProcess.stderr.on('data', (data) => {
                const msg = data.toString().trim();
                if (msg) console.error(`[Server:ERR] ${msg}`);
            });

            serverProcess.on('error', (err) => {
                console.error('[Server] 子进程启动失败:', err.message);
                reject(err);
            });

            serverProcess.on('exit', (code) => {
                console.log(`[Server] 子进程退出，退出码: ${code}`);
                serverProcess = null;
            });

            resolve(port);
        }).catch(reject);
    });
}

/**
 * 查找可用端口
 * @param {number[]} ports 候选端口列表
 * @returns {Promise<number>} 第一个可用端口
 */
function findAvailablePort(ports) {
    return new Promise((resolve, reject) => {
        function tryPort(index) {
            if (index >= ports.length) {
                // 所有候选端口都被占用，使用 0 让系统分配随机端口
                resolve(0);
                return;
            }
            const port = ports[index];
            const tester = http.createServer();
            tester.listen(port, () => {
                tester.close(() => {
                    resolve(port);
                });
            });
            tester.on('error', () => {
                tryPort(index + 1);
            });
        }
        tryPort(0);
    });
}

/**
 * 健康检查 - 等待服务器就绪
 * @param {number} port 服务器端口
 * @param {number} timeout 超时毫秒数
 * @returns {Promise<void>}
 */
function waitForServer(port, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const checkUrl = `http://localhost:${port}/api/ping`;

        function check() {
            if (Date.now() - startTime > timeout) {
                reject(new Error(`服务器健康检查超时 (${timeout}ms)`));
                return;
            }

            const req = http.get(checkUrl, (res) => {
                if (res.statusCode === 200) {
                    resolve();
                } else {
                    setTimeout(check, 200);
                }
                res.resume();
            });

            req.on('error', () => {
                setTimeout(check, 200);
            });

            req.setTimeout(1000, () => {
                req.destroy();
                setTimeout(check, 200);
            });
        }
        check();
    });
}

/**
 * 获取当前服务器端口
 * @returns {number|null}
 */
function getServerPort() {
    return serverPort;
}

/**
 * 停止服务器子进程
 */
function stopServer() {
    if (serverProcess) {
        try {
            // Windows 下 taskkill /T /PID 确保子进程树全部退出
            if (process.platform === 'win32') {
                spawn('taskkill', ['/PID', String(serverProcess.pid), '/T', '/F'], {
                    stdio: 'ignore'
                });
            } else {
                serverProcess.kill('SIGTERM');
            }
        } catch (e) {
            console.error('[Server] 停止子进程失败:', e.message);
        }
        serverProcess = null;
    }
}

module.exports = {
    startServer,
    waitForServer,
    getServerPort,
    stopServer
};
