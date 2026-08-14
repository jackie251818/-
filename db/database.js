/**
 * SQLite 数据库连接管理与 CRUD 操作
 * 使用 better-sqlite3 同步 API
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// 数据库文件路径
const DB_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DB_DIR, 'asset_management.db');

// 确保数据目录存在
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

// 创建数据库连接（单例）
let db = null;

/**
 * 获取数据库连接
 * @returns {Database}
 */
function getDb() {
    if (db) return db;

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');     // WAL模式提升并发性能
    db.pragma('foreign_keys = ON');       // 开启外键约束
    db.pragma('busy_timeout = 5000');     // 忙等待超时5秒

    console.log('[DB] SQLite 连接成功:', DB_PATH);
    return db;
}

// ============ 建表语句 ============
const SCHEMA_SQL = `
-- 资产主表
CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    owner TEXT,
    brand_model TEXT,
    type TEXT,
    user TEXT,
    department TEXT,
    status TEXT,
    purchase_date TEXT,
    location TEXT,
    description TEXT,
    attachments TEXT DEFAULT '[]',
    maintenance_records TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- 附件表（分离存储 base64 大数据，避免资产主表膨胀）
CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id TEXT NOT NULL,
    name TEXT,
    type TEXT,
    size INTEGER DEFAULT 0,
    thumbnail TEXT,
    url TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);

-- 自定义选项表
CREATE TABLE IF NOT EXISTS custom_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    value TEXT NOT NULL,
    is_deleted INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(category, value)
);

-- 用户状态表（单行存储）
CREATE TABLE IF NOT EXISTS user_state (
    id INTEGER PRIMARY KEY DEFAULT 1,
    current_page INTEGER DEFAULT 1,
    current_view TEXT DEFAULT 'dashboard',
    current_zoom REAL DEFAULT 1,
    system_settings TEXT DEFAULT '{}',
    filters TEXT DEFAULT '{}',
    last_saved TEXT
);

-- 同步元数据
CREATE TABLE IF NOT EXISTS sync_meta (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_assets_owner ON assets(owner);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type);
CREATE INDEX IF NOT EXISTS idx_assets_department ON assets(department);
CREATE INDEX IF NOT EXISTS idx_attachments_asset_id ON attachments(asset_id);
CREATE INDEX IF NOT EXISTS idx_custom_options_category ON custom_options(category);
`;

/**
 * 初始化数据库表结构
 */
function initSchema() {
    const database = getDb();
    database.exec(SCHEMA_SQL);
    console.log('[DB] 数据库表结构初始化完成');
}

// ============ 资产 CRUD ============

/**
 * 查询所有资产（不含附件base64，轻量数据）
 * @param {object} options - 查询选项 { page, pageSize, keyword, status, owner, type, department }
 * @returns {{ data: array, total: number }}
 */
function queryAssets(options = {}) {
    const database = getDb();
    const { page = 1, pageSize = 20, keyword, status, owner, type, department } = options;

    let where = [];
    let params = [];

    if (keyword) {
        where.push('(id LIKE ? OR owner LIKE ? OR brand_model LIKE ? OR user LIKE ? OR department LIKE ? OR type LIKE ? OR description LIKE ? OR location LIKE ?)');
        const kw = `%${keyword}%`;
        params.push(kw, kw, kw, kw, kw, kw, kw, kw);
    }
    if (status && status !== 'all') { where.push('status = ?'); params.push(status); }
    if (owner && owner !== 'all') { where.push('owner = ?'); params.push(owner); }
    if (type && type !== 'all') { where.push('type = ?'); params.push(type); }
    if (department && department !== 'all') { where.push('department = ?'); params.push(department); }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    // 查询总数
    const countRow = database.prepare(`SELECT COUNT(*) as total FROM assets ${whereClause}`).get(...params);
    const total = countRow.total;

    // 分页查询（包含所有字段，含 attachments 和 maintenance_records）
    const offset = (page - 1) * pageSize;
    const rows = database.prepare(
        `SELECT * FROM assets ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).all(...params, pageSize, offset);

    return { data: rows, total };
}

/**
 * 查询单个资产完整信息（含附件和维护记录）
 * @param {string} id
 * @returns {object|null}
 */
function getAssetById(id) {
    const database = getDb();
    const asset = database.prepare('SELECT * FROM assets WHERE id = ?').get(id);
    if (!asset) return null;

    // 解析 JSON 字段
    asset.attachments = JSON.parse(asset.attachments || '[]');
    asset.maintenance_records = JSON.parse(asset.maintenance_records || '[]');

    return asset;
}

/**
 * 新增资产
 * @param {object} asset
 * @returns {object}
 */
function insertAsset(asset) {
    const database = getDb();
    const now = new Date().toISOString();

    const stmt = database.prepare(`
        INSERT INTO assets (id, owner, brand_model, type, user, department, status, purchase_date, location, description, attachments, maintenance_records, created_at, updated_at)
        VALUES (@id, @owner, @brand_model, @type, @user, @department, @status, @purchase_date, @location, @description, @attachments, @maintenance_records, @created_at, @updated_at)
    `);

    stmt.run({
        id: asset.id,
        owner: asset.owner || '',
        brand_model: asset.brandModel || '',
        type: asset.type || '',
        user: asset.user || '',
        department: asset.department || '',
        status: asset.status || '在用',
        purchase_date: asset.purchaseDate || '',
        location: asset.location || '',
        description: asset.description || '',
        attachments: JSON.stringify(asset.attachments || []),
        maintenance_records: JSON.stringify(asset.maintenanceRecords || []),
        created_at: now,
        updated_at: now
    });

    return { id: asset.id, created: true };
}

/**
 * 更新资产
 * @param {string} id
 * @param {object} asset
 * @returns {object}
 */
function updateAsset(id, asset) {
    const database = getDb();
    const now = new Date().toISOString();

    const stmt = database.prepare(`
        UPDATE assets SET
            owner = @owner,
            brand_model = @brand_model,
            type = @type,
            user = @user,
            department = @department,
            status = @status,
            purchase_date = @purchase_date,
            location = @location,
            description = @description,
            attachments = @attachments,
            maintenance_records = @maintenance_records,
            updated_at = @updated_at
        WHERE id = @id
    `);

    const result = stmt.run({
        id: id,
        owner: asset.owner || '',
        brand_model: asset.brandModel || '',
        type: asset.type || '',
        user: asset.user || '',
        department: asset.department || '',
        status: asset.status || '在用',
        purchase_date: asset.purchaseDate || '',
        location: asset.location || '',
        description: asset.description || '',
        attachments: JSON.stringify(asset.attachments || []),
        maintenance_records: JSON.stringify(asset.maintenanceRecords || []),
        updated_at: now
    });

    return { id, updated: result.changes > 0 };
}

/**
 * 删除资产
 * @param {string} id
 * @returns {object}
 */
function deleteAsset(id) {
    const database = getDb();
    const result = database.prepare('DELETE FROM assets WHERE id = ?').run(id);
    return { id, deleted: result.changes > 0 };
}

// ============ 自定义选项 ============

/**
 * 查询自定义选项
 * @param {string} category - owner/department/type
 * @param {boolean} includeDeleted - 是否返回已删除选项（返回对象数组包含 is_deleted 字段）
 * @returns {array}
 */
function getCustomOptions(category, includeDeleted = false) {
    const database = getDb();
    if (includeDeleted) {
        // 返回所有选项（含已删除），格式为对象数组 [{ value, is_deleted }]
        const rows = database.prepare(`SELECT value, is_deleted FROM custom_options WHERE category = ? ORDER BY value`).all(category);
        return rows.map(r => ({ value: r.value, is_deleted: r.is_deleted }));
    } else {
        // 仅返回正常选项，格式为字符串数组
        const rows = database.prepare(`SELECT value FROM custom_options WHERE category = ? AND is_deleted = 0 ORDER BY value`).all(category);
        return rows.map(r => r.value);
    }
}

/**
 * 批量设置自定义选项（替换模式）
 * @param {string} category
 * @param {array} values
 * @param {array} deletedValues
 */
function setCustomOptions(category, values, deletedValues = []) {
    const database = getDb();
    const upsert = database.prepare(`
        INSERT INTO custom_options (category, value, is_deleted)
        VALUES (?, ?, 0)
        ON CONFLICT(category, value) DO UPDATE SET is_deleted = 0
    `);
    const markDeleted = database.prepare(`
        INSERT INTO custom_options (category, value, is_deleted)
        VALUES (?, ?, 1)
        ON CONFLICT(category, value) DO UPDATE SET is_deleted = 1
    `);

    const tx = database.transaction(() => {
        for (const v of values) upsert.run(category, v);
        for (const v of deletedValues) markDeleted.run(category, v);
    });
    tx();
}

// ============ 用户状态 ============

/**
 * 获取用户状态
 * @returns {object}
 */
function getUserState() {
    const database = getDb();
    let state = database.prepare('SELECT * FROM user_state WHERE id = 1').get();
    if (!state) {
        // 初始化默认状态
        database.prepare(`INSERT INTO user_state (id, current_page, current_view, current_zoom, system_settings, filters) VALUES (1, 1, 'dashboard', 1, ?, ?)`)
            .run(JSON.stringify({ systemName: '电脑资产管理系统', dateFormat: 'yyyy/mm/dd', recordsPerPage: 20 }),
                 JSON.stringify({ statusFilter: 'all', ownerFilter: 'all', typeFilter: 'all', departmentFilter: 'all' }));
        state = database.prepare('SELECT * FROM user_state WHERE id = 1').get();
    }
    state.system_settings = JSON.parse(state.system_settings || '{}');
    state.filters = JSON.parse(state.filters || '{}');
    return state;
}

/**
 * 更新用户状态
 * @param {object} state
 */
function updateUserState(state) {
    const database = getDb();
    const now = new Date().toISOString();
    database.prepare(`
        INSERT INTO user_state (id, current_page, current_view, current_zoom, system_settings, filters, last_saved)
        VALUES (1, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            current_page = excluded.current_page,
            current_view = excluded.current_view,
            current_zoom = excluded.current_zoom,
            system_settings = excluded.system_settings,
            filters = excluded.filters,
            last_saved = excluded.last_saved
    `).run(
        state.currentPage || 1,
        state.currentView || 'dashboard',
        state.currentZoom || 1,
        JSON.stringify(state.systemSettings || {}),
        JSON.stringify(state.filters || {}),
        now
    );
}

// ============ 导出 ============

module.exports = {
    getDb,
    initSchema,
    DB_PATH,
    // 资产
    queryAssets,
    getAssetById,
    insertAsset,
    updateAsset,
    deleteAsset,
    // 自定义选项
    getCustomOptions,
    setCustomOptions,
    // 用户状态
    getUserState,
    updateUserState
};
