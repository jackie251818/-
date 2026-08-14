/**
 * 通知消息和加载指示器
 * 从 script.js 拆分而来 - 请勿手动修改行号映射
 */

function showNotification(message, type = 'info', duration = 3000) {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        max-width: 480px;
        padding: 12px 20px;
        border-radius: 4px;
        color: white;
        z-index: 10000;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        transition: opacity 0.3s;
        font-weight: bold;
        white-space: pre-wrap;
        word-break: break-word;
        line-height: 1.5;
    `;

    // 根据类型设置颜色
    switch (type) {
        case 'error':
            notification.style.backgroundColor = '#ff4d4f';
            break;
        case 'warning':
            notification.style.backgroundColor = '#faad14';
            break;
        case 'success':
            notification.style.backgroundColor = '#52c41a';
            break;
        default:
            notification.style.backgroundColor = '#1890ff';
    }

    notification.textContent = message;
    document.body.appendChild(notification);

    // 持续时间后自动移除（最少 1500ms，避免一闪而过）
    const displayMs = Math.max(1500, Number(duration) || 3000);
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, displayMs);
}

// 进入编辑模式

function showLoadingIndicator() {
    const loader = document.getElementById('loading-indicator');
    if (loader) loader.classList.add('visible');
}

// 隐藏加载指示器
function hideLoadingIndicator() {
    const loader = document.getElementById('loading-indicator');
    if (loader) {
        loader.classList.remove('visible');
        // 清除可能被设置的内联 display 样式，双保险
        loader.style.display = '';
    }
}

// 初始化模板加载函数
