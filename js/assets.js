/**
 * 资产列表渲染、分页、详情查看、附件展示、图片查看器
 * 从 script.js 拆分而来 - 请勿手动修改行号映射
 */
function renderAllAssets(filteredAssets = null) {
    // 防抖处理，避免频繁渲染（50ms，平衡性能与响应速度）
    if (renderTimeout) clearTimeout(renderTimeout);

    renderTimeout = setTimeout(() => {
        const tableBody = getElement('all-assets-table');

        if (!tableBody) return;
        // 清空表格
        tableBody.innerHTML = '';
        
        let assetsToRender = filteredAssets || assetsData;
        
        // 分页处理
        const startIndex = (currentPage - 1) * recordsPerPage;
        const endIndex = startIndex + recordsPerPage;
        assetsToRender = assetsToRender.slice(startIndex, endIndex);
        
        if (assetsToRender.length === 0) {
            // 资产表格固定 8 列（id/owner/type/brandModel/user/department/purchaseDate/操作）
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = `<td colspan="8" style="text-align: center; padding: 20px;">暂无资产记录，请添加或导入资产</td>`;
            tableBody.appendChild(emptyRow);
        } else {
            // 使用文档片段减少DOM重绘（同步追加，避免 requestAnimationFrame 在非active页面被节流导致行不渲染）
            const fragment = document.createDocumentFragment();

            // 批量创建元素
            assetsToRender.forEach(asset => {
                const { row } = createAssetTableRow(asset);
                fragment.appendChild(row);
            });

            tableBody.appendChild(fragment);
        }
        
        // 渲染分页控件
        renderPagination(filteredAssets);
    }, 50); // 50ms防抖延迟
}

// 渲染分页控件 - 根据实际数据量动态生成
function renderPagination(filteredAssets = null) {
    const paginationContainer = document.querySelector('#assets-page .pagination');
    if (!paginationContainer) return;
    
    // 获取数据
    let dataToUse = filteredAssets || assetsData;
    const totalCount = dataToUse.length;
    
    // 更新"共X条记录"文本
    const totalRecordsEl = document.getElementById('total-records');
    if (totalRecordsEl) {
        totalRecordsEl.textContent = `共 ${totalCount} 条记录`;
    }
    
    // 清空现有的分页控件
    paginationContainer.innerHTML = '';
    
    if (totalCount === 0) {
        // 如果没有数据，不显示分页控件按钮
        return;
    }
    
    // 计算总页数
    const totalPages = Math.ceil(totalCount / recordsPerPage);
    
    // 确保currentPage不超过总页数
    if (currentPage > totalPages) {
        currentPage = totalPages;
    }
    if (currentPage < 1) {
        currentPage = 1;
    }
    
    // 使用 DocumentFragment 批量构建分页控件，避免多次 reflow
    const fragment = document.createDocumentFragment();

    // 添加上一页按钮
    const prevPageItem = document.createElement('div');
    prevPageItem.className = `pagination-item${currentPage <= 1 ? ' disabled' : ''}`;
    prevPageItem.id = 'prev-page';
    prevPageItem.innerHTML = '<i class="fas fa-chevron-left"></i>';
    if (currentPage > 1) {
        prevPageItem.addEventListener('click', () => {
            currentPage--;
            hasUnsavedChanges = true;
            applyFilters();
        });
    }
    fragment.appendChild(prevPageItem);

    // 限制显示的页码数量，最多显示10个页码
    const maxVisiblePages = 10;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    // 调整起始页码，确保显示足够的页码
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    // 如果只有一页或不需要省略号，简化显示
    if (totalPages <= maxVisiblePages) {
        startPage = 1;
        endPage = totalPages;
    }

    // 添加首页按钮
    if (startPage > 1) {
        const firstPageItem = createPageItem(1);
        fragment.appendChild(firstPageItem);

        // 如果首页和起始页之间有间隔，添加省略号
        if (startPage > 2) {
            const ellipsis = document.createElement('div');
            ellipsis.className = 'pagination-item';
            ellipsis.textContent = '...';
            ellipsis.style.cursor = 'default';
            ellipsis.style.pointerEvents = 'none';
            fragment.appendChild(ellipsis);
        }
    }

    // 添加可见的页码
    for (let i = startPage; i <= endPage; i++) {
        const pageItem = createPageItem(i);
        fragment.appendChild(pageItem);
    }

    // 添加尾页按钮
    if (endPage < totalPages) {
        // 如果结束页和尾页之间有间隔，添加省略号
        if (endPage < totalPages - 1) {
            const ellipsis = document.createElement('div');
            ellipsis.className = 'pagination-item';
            ellipsis.textContent = '...';
            ellipsis.style.cursor = 'default';
            ellipsis.style.pointerEvents = 'none';
            fragment.appendChild(ellipsis);
        }

        const lastPageItem = createPageItem(totalPages);
        fragment.appendChild(lastPageItem);
    }

    // 添加下一页按钮
    const nextPageItem = document.createElement('div');
    nextPageItem.className = `pagination-item${currentPage >= totalPages ? ' disabled' : ''}`;
    nextPageItem.id = 'next-page';
    nextPageItem.innerHTML = '<i class="fas fa-chevron-right"></i>';
    if (currentPage < totalPages) {
        nextPageItem.addEventListener('click', () => {
            currentPage++;
            hasUnsavedChanges = true;
            applyFilters();
        });
    }
    fragment.appendChild(nextPageItem);

    // 一次性追加所有分页元素（仅1次 reflow）
    paginationContainer.appendChild(fragment);
    
    // 创建页码项的辅助函数
    function createPageItem(pageNumber) {
        const pageItem = document.createElement('div');
        pageItem.className = `pagination-item ${pageNumber === currentPage ? 'active' : ''}`;
        pageItem.textContent = pageNumber;
        
        // 为非当前页添加点击事件
        if (pageNumber !== currentPage) {
            pageItem.addEventListener('click', () => {
                currentPage = pageNumber;
                // 设置为有未保存的更改，确保在页面卸载时保存currentPage
                hasUnsavedChanges = true;
                // 使用applyFilters而不是直接传入filteredAssets，确保总是使用最新的筛选条件
                applyFilters();
            });
        }
        
        return pageItem;
    }
}

// 创建资产表格行 - 优化DOM操作和状态处理
function createAssetTableRow(asset, showDamageReason = false) {
    const row = document.createElement('tr');
    
    // 优化状态徽章生成，使用对象映射替代switch语句
    const statusBadgeMap = {
        'active': '<span class="status-badge status-active"><i class="fas fa-check-circle"></i> 在用</span>',
        'idle': '<span class="status-badge status-idle"><i class="fas fa-pause-circle"></i> 闲置</span>',
        'damaged': '<span class="status-badge status-damaged"><i class="fas fa-exclamation-circle"></i> 损坏</span>',
        'maintenance': '<span class="status-badge status-maintenance"><i class="fas fa-wrench"></i> 维修中</span>',
        'retired': '<span class="status-badge status-retired"><i class="fas fa-ban"></i> 报废</span>'
    };
    
    const statusBadge = statusBadgeMap[asset.status] || '';
    
    // 根据是否显示损坏原因构建表格行
    let damageReasonCell = '';
    let colspan = 8;
    
    if (showDamageReason) {
        damageReasonCell = `<td>${asset.damageReason || '-'}</td>`;
        colspan = 9;
    }
    
    // 使用模板字符串一次性设置innerHTML，减少DOM操作
    row.innerHTML = `
        <td>${asset.id}</td>
        <td>${asset.owner}</td>
        <td>${asset.type}</td>
        <td>${asset.brandModel}</td>
        <td>${asset.user || '-'}</td>
        <td>${asset.department || '-'}</td>
        ${damageReasonCell}
        <td>${statusBadge}</td>
        <td>
            <button class="btn btn-sm btn-primary view-asset" data-id="${asset.id}">
                <i class="fas fa-eye"></i> 查看
            </button>
        </td>
    `;
    
    return { row, colspan };
}

// 查看资产详情 - 优化DOM操作和防抖处理
let viewAssetTimeout;
function viewAssetDetails(assetId) {
    // 防抖处理
    if (viewAssetTimeout) clearTimeout(viewAssetTimeout);

    viewAssetTimeout = setTimeout(() => {
        // 使用requestAnimationFrame优化UI渲染
        requestAnimationFrame(() => {
            const asset = assetsData.find(a => a.id === assetId);
            if (!asset) return;
            // 记录当前查看的资产ID，供 openFileViewer 按需加载附件 url
            window._currentViewingAssetId = assetId;
            // 创建一个对象存储需要更新的元素
            const elementsToUpdate = {
                'asset-id': asset.id,
                'detail-asset-code': asset.id,
                'detail-owner': asset.owner,
                'detail-asset-type': asset.type,
                'detail-brand-model': asset.brandModel,
                'detail-configuration': asset.configuration || '-',
                'detail-purchase-date': formatDate(asset.purchaseDate),
                'detail-status': getStatusText(asset.status),
                'detail-user': asset.user || '-',
                'detail-department': asset.department || '-',
                'detail-location': asset.location || '-',
                'detail-manager': asset.manager || '-',
                'detail-unit': asset.unit || '-',
                'detail-quantity': asset.quantity || 1,
                'detail-value': asset.value ? '¥' + Number(asset.value).toLocaleString('zh-CN', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-',
                'detail-depreciation-years': asset.depreciationYears ? asset.depreciationYears + ' 年' : '-',
                'detail-purchase-no': asset.purchaseNo || '-',
                'detail-payment-no': asset.paymentNo || '-'
            };
            
            // 批量更新DOM，减少重绘
            Object.keys(elementsToUpdate).forEach(id => {
                const element = getElement(id);
                if (element) {
                    element.textContent = elementsToUpdate[id];
                }
            });
            
            // 更新状态徽章
            const statusBadge = getElement('asset-status-badge');
            if (statusBadge) {
                statusBadge.className = 'status-badge';
                statusBadge.classList.add(`status-${asset.status}`);
                statusBadge.innerHTML = `<i class="fas ${getStatusIcon(asset.status)}"></i> ${getStatusText(asset.status)}`;
            }
            
            // 处理损坏原因显示
            const damageContainer = getElement('damage-reason-container');
            const damageReason = getElement('detail-damage-reason');
            if (damageContainer && damageReason) {
                if (asset.status === 'damaged' && asset.damageReason) {
                    damageReason.textContent = asset.damageReason;
                    damageContainer.style.display = 'block';
                } else {
                    damageContainer.style.display = 'none';
                }
            }
            
            // 延迟渲染附件和维护记录，让主UI先渲染完成
            requestAnimationFrame(() => {
                renderAttachments(asset.attachments);
                renderMaintenanceRecords(asset.maintenanceRecords);
            });
            
            // 切换到详情页 - 直接显示资产详情页面，不通过菜单切换
            try {
                // 移除所有页面的活跃状态
                document.querySelectorAll('.page-content').forEach(page => {
                    page.classList.remove('active');
                });
                
                // 激活资产详情页面
                const assetDetailPage = document.getElementById('asset-detail-page');
                if (assetDetailPage) {
                    assetDetailPage.classList.add('active');
                } else {
                    console.error('找不到资产详情页面元素');
                }
            } catch (error) {
                console.error('切换资产详情页面时发生错误:', error);
            }
        });
    }, 50); // 50ms防抖延迟
}

// 渲染附件
function renderAttachments(attachments) {
    const container = getElement('attachments-container');
    const list = getElement('attachments-list');
    const noAttachments = getElement('no-attachments');
    
    list.innerHTML = '';
    
    if (!attachments || attachments.length === 0) {
        noAttachments.style.display = 'block';
        list.style.display = 'none';
        return;
    }
    
    noAttachments.style.display = 'none';
    list.style.display = 'block';
    
    // 使用文档片段减少DOM重绘
    const fragment = document.createDocumentFragment();
    attachments.forEach(attachment => {
        const isImage = attachment.type.startsWith('image/');
        const isPdf = attachment.type === 'application/pdf';
        
        const item = document.createElement('div');
        item.className = 'attachment-item';
        item.dataset.type = attachment.type;
        item.dataset.url = attachment.url || '';

        // 生成缩略图：优先用已有的 thumbnail，否则尝试从 url 生成
        let thumbnailHtml = '';
        if (isImage) {
            thumbnailHtml = `<img src="${attachment.thumbnail || attachment.url || ''}" class="attachment-thumbnail" alt="${attachment.name}" loading="lazy">`;
        } else if (isPdf) {
            if (attachment.thumbnail) {
                thumbnailHtml = `<img src="${attachment.thumbnail}" class="attachment-thumbnail" alt="${attachment.name}" loading="lazy" style="object-fit: contain; border: 1px solid #e0e0e0; border-radius: 4px; background: #fff;">`;
            } else {
                thumbnailHtml = `
                    <div class="attachment-thumbnail" style="display: flex; align-items: center; justify-content: center;">
                        <i class="fas fa-file-pdf fa-5x" style="color: #ff4d4f;"></i>
                    </div>
                `;
                // 异步生成PDF缩略图（url 可能在 IndexedDB 中，此处跳过）
                if (attachment.url && typeof createPdfThumbnail === 'function') {
                    createPdfThumbnail(attachment.url, 160, 200, (thumb) => {
                        if (thumb) {
                            attachment.thumbnail = thumb;
                            const img = item.querySelector('.attachment-thumbnail');
                            if (img) {
                                img.replaceWith(Object.assign(document.createElement('img'), {
                                    src: thumb,
                                    alt: attachment.name,
                                    loading: 'lazy',
                                    className: 'attachment-thumbnail',
                                    style: 'object-fit: contain; border: 1px solid #e0e0e0; border-radius: 4px; background: #fff;'
                                }));
                            }
                        }
                    }, attachment.name);
                }
            }
        } else {
            thumbnailHtml = `
                <div class="attachment-thumbnail" style="display: flex; align-items: center; justify-content: center;">
                    <i class="fas fa-file fa-5x" style="color: #3081eb;"></i>
                </div>
            `;
        }
        
        item.innerHTML = `
            ${thumbnailHtml}
            <div class="attachment-name">${attachment.name}</div>
        `;
        
        item.addEventListener('click', () => openFileViewer(attachment));
        fragment.appendChild(item);
    });
    
    list.appendChild(fragment);
}

// 打开文件查看器
async function openFileViewer(attachment) {
    // 使用全局modal变量，避免重复声明
    const modal = getElement('image-viewer-modal');
    const imageElement = getElement('modal-image');
    const pdfElement = document.getElementById('modal-pdf');
    const modalTitle = document.getElementById('modal-title');

    // 确保所有元素都存在
    if (!modal || !imageElement || !pdfElement || !modalTitle) {
        console.error('文件查看器元素未找到');
        return;
    }

    // 在打开新图片前，先清理之前可能存在的事件监听器
    if (typeof modal.cleanupImageZoomControls === 'function') {
        modal.cleanupImageZoomControls();
    }

    // 重置图片缩放
    resetImageZoom();

    // 设置模态框标题
    modalTitle.textContent = `查看文件: ${attachment.name || '未知文件名'}`;

    // 如果 attachment.url 不存在（localStorage 瘦身后），从 IndexedDB 加载完整数据
    if (!attachment.url) {
        const assetId = window._currentViewingAssetId;
        if (assetId && storageManager) {
            try {
                const fullData = await storageManager.getItem(STORAGE_KEYS.ASSET_MANAGEMENT_DATA);
                if (fullData) {
                    const assets = Array.isArray(fullData) ? fullData : (fullData.data || []);
                    const fullAsset = assets.find(a => a.id === assetId);
                    if (fullAsset && fullAsset.attachments) {
                        const fullAtt = fullAsset.attachments.find(a => a.name === attachment.name);
                        if (fullAtt && fullAtt.url) {
                            attachment.url = fullAtt.url;
                        }
                    }
                }
            } catch(e) {
                console.warn('从 IndexedDB 加载附件 url 失败:', e);
            }
        }
        if (!attachment.url) {
            console.warn('附件 url 不可用:', attachment.name);
            return;
        }
    }

    if (attachment.type && attachment.type.startsWith('image/')) {
        // 预加载图片，加载完成后再显示到页面中，避免"先空白后图片"的视觉闪烁
        const tempImg = new Image();
        const showModalNow = () => {
            imageElement.style.display = 'block';
            pdfElement.style.display = 'none';
            setupImageZoomControls();
            modal.classList.add('active');
        };
        tempImg.onload = function() {
            imageElement.src = attachment.url;
            showModalNow();
        };
        tempImg.onerror = function() {
            console.warn('图片加载失败:', attachment.name);
            if (attachment.thumbnail && attachment.thumbnail !== attachment.url) {
                imageElement.src = attachment.thumbnail;
            } else {
                imageElement.style.display = 'none';
                const placeholder = document.createElement('div');
                placeholder.className = 'image-placeholder';
                placeholder.textContent = '图片无法加载（数据可能已损坏）';
                const mdBody = modal.querySelector('.modal-body') || modal;
                mdBody.appendChild(placeholder);
                setTimeout(() => {
                    const ph = modal.querySelector('.image-placeholder');
                    if (ph) ph.remove();
                }, 3000);
            }
            modal.classList.add('active');
        };
        tempImg.src = attachment.url;
        // DataURL 通常会从缓存命中；若 complete 直接走显示逻辑避免等待
        if (tempImg.complete && tempImg.naturalWidth) {
            imageElement.src = attachment.url;
            showModalNow();
        }
    } else if (attachment.type === 'application/pdf') {
        pdfElement.src = attachment.url;
        pdfElement.style.display = 'block';
        imageElement.style.display = 'none';
        modal.classList.add('active');
    } else {
        alert('不支持的文件类型');
        return;
    }
}

// 全局变量，用于图片拖动
let translateX = 0;
let translateY = 0;

// 缩放图片函数
function zoomImage(imageElement, zoomAmount) {
    // 健壮性检查
    if (!imageElement || typeof zoomAmount !== 'number') {
        console.error('zoomImage: 参数无效');
        return;
    }
    
    // 确保currentZoom已定义
    if (typeof currentZoom !== 'number') {
        currentZoom = 1;
    }
    
    const newZoom = currentZoom + zoomAmount;
    if (newZoom > 0.1 && newZoom < 10) {
        currentZoom = newZoom;
        
        // 更新图片变换，保持当前拖动位置
        imageElement.style.transform = `scale(${currentZoom}) translate(${translateX}px, ${translateY}px)`;
    }
}

// 设置图片缩放控制
function setupImageZoomControls() {
    const imageElement = getElement('modal-image');
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const zoomResetBtn = document.getElementById('zoom-reset-btn');
    const modal = getElement('image-viewer-modal');
    
    // 确保元素存在
    if (!imageElement || !zoomInBtn || !zoomOutBtn || !zoomResetBtn || !modal) {
        console.error('图片查看器元素未找到');
        return;
    }
    
    // 确保只有在图片显示时才激活缩放控制
    if (imageElement.style.display === 'block') {
        // 重置拖动状态
        translateX = 0;
        translateY = 0;
        
        // 创建事件处理函数，方便后续清理
        const handleZoomIn = () => zoomImage(imageElement, 0.1);
        const handleZoomOut = () => zoomImage(imageElement, -0.1);
        const handleZoomReset = resetImageZoom;
        
        const handleWheel = (e) => {
            e.preventDefault();
            zoomImage(imageElement, e.deltaY < 0 ? 0.1 : -0.1);
        };
        
        let isDragging = false;
        let startX, startY;
        
        const handleMouseDown = (e) => {
            isDragging = true;
            startX = e.clientX - translateX;
            startY = e.clientY - translateY;
            imageElement.style.cursor = 'grabbing';
        };
        
        const handleMouseMove = (e) => {
            if (!isDragging) return;
            
            translateX = e.clientX - startX;
            translateY = e.clientY - startY;
            
            // 仅在缩放后允许拖动
            if (currentZoom > 1.01) {
                imageElement.style.transform = `scale(${currentZoom}) translate(${translateX}px, ${translateY}px)`;
            } else {
                // 重置拖动
                translateX = 0;
                translateY = 0;
            }
        };
        
        const handleMouseUp = () => {
            isDragging = false;
            imageElement.style.cursor = 'grab';
        };
        
        const handleMouseLeave = () => {
            isDragging = false;
            imageElement.style.cursor = 'grab';
        };
        
        // 绑定事件监听器
        zoomInBtn.addEventListener('click', handleZoomIn);
        zoomOutBtn.addEventListener('click', handleZoomOut);
        zoomResetBtn.addEventListener('click', handleZoomReset);
        imageElement.addEventListener('wheel', handleWheel);
        imageElement.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('mouseleave', handleMouseLeave);
        
        // 添加模态框关闭时的清理函数
        // 先移除可能存在的旧的清理函数
        const cleanupFuncName = 'cleanupImageZoomControls';
        
        // 移除旧的清理函数
        const oldCleanup = modal[cleanupFuncName];
        if (typeof oldCleanup === 'function') {
            oldCleanup();
        }
        
        // 保存新的清理函数到模态框元素上
        modal[cleanupFuncName] = function() {
            zoomInBtn.removeEventListener('click', handleZoomIn);
            zoomOutBtn.removeEventListener('click', handleZoomOut);
            zoomResetBtn.removeEventListener('click', handleZoomReset);
            imageElement.removeEventListener('wheel', handleWheel);
            imageElement.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('mouseleave', handleMouseLeave);
        };
    }
}

// 获取状态文本
function getStatusText(status) {
    const statusMap = {
        'active': '在用',
        'idle': '闲置',
        'damaged': '损坏',
        'maintenance': '维修中',
        'retired': '报废'
    };
    return statusMap[status] || status;
}

// 获取状态图标
function getStatusIcon(status) {
    const iconMap = {
        'active': 'fa-check-circle',
        'idle': 'fa-pause-circle',
        'damaged': 'fa-exclamation-circle',
        'maintenance': 'fa-wrench',
        'retired': 'fa-ban'
    };
    return iconMap[status] || 'fa-question-circle';
}

// 渲染维护记录 - 使用防抖和requestAnimationFrame优化
let renderMaintenanceTimeout;
function renderMaintenanceRecords(records) {
    // 防抖处理
    if (renderMaintenanceTimeout) clearTimeout(renderMaintenanceTimeout);
    
    renderMaintenanceTimeout = setTimeout(() => {
        const table = getElement('maintenance-records-table');
        const tableBody = table ? table.querySelector('tbody') : null;
        
        if (!tableBody) return;
        
        requestAnimationFrame(() => {
            tableBody.innerHTML = '';
            
            if (!records || records.length === 0) {
                // 使用动态colspan值
                const colspan = 5; // 固定为5列，但如果将来列数变化可以改为动态计算
                const emptyRow = document.createElement('tr');
                emptyRow.innerHTML = `<td colspan="${colspan}" style="text-align: center; padding: 20px;">暂无维护记录</td>`;
                tableBody.appendChild(emptyRow);
                return;
            }
            
            // 创建HTML字符串一次性更新DOM，减少DOM操作
            let rowsHTML = '';
            records.forEach((record, index) => {
                rowsHTML += `
                    <tr>
                        <td>${formatDate(record.date)}</td>
                        <td>${record.type}</td>
                        <td>${record.description}</td>
                        <td>${record.manager}</td>
                        <td>
                            <button class="btn btn-sm btn-secondary delete-maintenance" data-index="${index}">
                                <i class="fas fa-trash"></i> 删除
                            </button>
                        </td>
                    </tr>
                `;
            });
            
            tableBody.innerHTML = rowsHTML;
        });
    }, 50);
}

// 处理文件上传 - 优化图片处理和用户体验
let uploadTimeout;
