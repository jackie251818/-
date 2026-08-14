/**
 * 维护记录管理（添加、删除）
 * 从 script.js 拆分而来 - 请勿手动修改行号映射
 */

function showAddMaintenanceDialog() {
    const assetIdEl = getElement('asset-id');
    const assetId = assetIdEl ? assetIdEl.textContent : '';
    if (!assetId || assetId === '未选择资产') return;
    
    const asset = assetsData.find(a => a.id === assetId);
    if (!asset) return;
    
    const type = prompt('请输入维护类型:', '常规维护');
    if (!type) return;
    
    const description = prompt('请输入维护描述:');
    if (!description) return;
    
    const manager = prompt('请输入负责人:');
    if (!manager) return;
    
    // 添加维护记录
    if (!asset.maintenanceRecords) asset.maintenanceRecords = [];
    asset.maintenanceRecords.push({
        date: new Date().toISOString().split('T')[0],
        type: type,
        description: description,
        manager: manager
    });
    
    // 更新UI
    renderMaintenanceRecords(asset.maintenanceRecords);
    
    // 保存到本地存储
    saveToLocalStorage();
    
    alert('维护记录已添加');
}

// 删除维护记录
function deleteMaintenanceRecord(index) {
    const assetIdEl = getElement('asset-id');
    const assetId = assetIdEl ? assetIdEl.textContent : '';
    if (!assetId || assetId === '未选择资产') return;
    
    const asset = assetsData.find(a => a.id === assetId);
    if (!asset || !asset.maintenanceRecords || !asset.maintenanceRecords[index]) return;
    
    if (confirm('确定要删除这条维护记录吗？')) {
        asset.maintenanceRecords.splice(index, 1);
        renderMaintenanceRecords(asset.maintenanceRecords);
        
        // 保存到本地存储
        saveToLocalStorage();
    }
}

// 保存数据到本地存储 - 使用防抖减少存储操作
