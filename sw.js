/**
 * Service Worker - 电脑固定资产管理系统 PWA
 * 策略：
 *   - 静态资源（HTML/CSS/JS/libs）: Cache-first（离线优先）
 *   - data/*.js 数据文件: 不缓存（由 storageManager 多重数据源管理）
 *   - API 请求: Network-first（在线优先，离线降级到缓存）
 */

const CACHE_VERSION = 'v2.4-pwa-v2';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;

// 预缓存的核心静态资源列表
const PRECACHE_URLS = [
    './',
    './index.html',
    './styles.css',
    './asset_label_print.html',
    // JS 模块
    './js/config.js',
    './js/storage.js',
    './js/notifications.js',
    './js/navigation.js',
    './js/dashboard.js',
    './js/assets.js',
    './js/asset-add.js',
    './js/search-filter.js',
    './js/import-export.js',
    './js/print.js',
    './js/asset-edit.js',
    './js/charts.js',
    './js/maintenance.js',
    './js/events.js',
    './js/init.js',
    './final_chart_fix.js',
    // 第三方库
    './libs/chart.min.js',
    './libs/xlsx.full.min.js',
    './libs/pdf.min.js',
    './libs/pdf.worker.min.js',
    './libs/qrcode.min.js',
    './libs/font-awesome.min.css',
    './libs/fa-solid-900.woff2',
    // PWA
    './manifest.json',
    './icons/icon.svg'
];

// ============ 安装：预缓存核心资源 ============
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                // 逐个缓存，避免单个失败导致全部失败
                return Promise.allSettled(
                    PRECACHE_URLS.map((url) =>
                        cache.add(url).catch((err) => {
                            console.warn('[SW] 预缓存失败:', url, err.message);
                        })
                    )
                );
            })
            .then(() => self.skipWaiting()) // 立即激活新版本
    );
});

// ============ 激活：清理旧缓存 ============
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== STATIC_CACHE && name !== RUNTIME_CACHE)
                        .map((name) => {
                            console.log('[SW] 删除旧缓存:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => self.clients.claim()) // 立即接管所有客户端
    );
});

// ============ 请求拦截：分层缓存策略 ============
self.addEventListener('fetch', (event) => {
    const request = event.request;

    // 只处理 GET 请求，非 GET 直接放行
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // 跳过跨域请求（如 CDN 资源）
    if (url.origin !== self.location.origin) return;

    // 策略1: data/*.js 数据文件 — 不缓存（动态数据，由 storageManager 管理）
    if (url.pathname.startsWith('/data/') || url.pathname.startsWith('./data/')) {
        return; // 直接走网络，失败则由前端 storageManager 从 localStorage/IndexedDB 加载
    }

    // 策略2: API 请求 — Network-first（在线优先，离线降级到缓存）
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // 成功则缓存响应副本
                    const clone = response.clone();
                    caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
                    return response;
                })
                .catch(() => {
                    // 离线时尝试从缓存读取
                    return caches.match(request);
                })
        );
        return;
    }

    // 策略3: 静态资源 — Cache-first（离线优先）
    event.respondWith(
        caches.match(request)
            .then((cached) => {
                if (cached) {
                    // 命中缓存，同时后台更新（stale-while-revalidate）
                    fetch(request)
                        .then((response) => {
                            if (response && response.status === 200) {
                                const clone = response.clone();
                                caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
                            }
                        })
                        .catch(() => {}); // 离线时静默失败
                    return cached;
                }
                // 未命中缓存，从网络获取
                return fetch(request)
                    .then((response) => {
                        if (!response || response.status !== 200) return response;
                        const clone = response.clone();
                        caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
                        return response;
                    })
                    .catch(() => {
                        // 网络失败且无缓存，返回离线提示页
                        if (request.destination === 'document') {
                            return caches.match('./index.html');
                        }
                    });
            })
    );
});

// ============ 消息通信：支持前端手动更新缓存 ============
self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
