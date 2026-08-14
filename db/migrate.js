/**
 * 数据迁移脚本 — 从 data/*.json 文件导入到 SQLite
 *
 * 用法：
 *   node db/migrate.js          # 迁移并保留JSON文件
 *   node db/migrate.js --clean  # 迁移后删除JSON文件
 *
 * 迁移的数据源：
 *   data/assetManagementData.json  → assets 表
 *   data/userStateData.json        → user_state 表
 *   data/custom_options_*.json     → custom_options 表
 *   data/custom_options_*_deleted  → custom_options (is_deleted=1)
 */
const fs = require('fs');
const path = require('path');
const db = require('./database');

const DATA_DIR = path.join(__dirname, '..', 'data');

/**
 * 安全读取 JSON 文件
 */
function readJsonFile(filename) {
    const filepath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filepath)) {
        console.log(`[Migrate] 跳过（文件不存在）: ${filename}`);
        return null;
    }
    try {
        const content = fs.readFileSync(filepath, 'utf-8');
        return JSON.parse(content);
    } catch (e) {
        console.warn(`[Migrate] 解析失败: ${filename} - ${e.message}`);
        return null;
    }
}

/**
 * 迁移资产数据
 */
function migrateAssets() {
    const data = readJsonFile('assetManagementData.json');
    if (!data || !Array.isArray(data)) {
        console.log('[Migrate] 资产数据为空或格式不对，跳过');
        return { migrated: 0, skipped: 0 };
    }

    console.log(`[Migrate] 开始迁移 ${data.length} 条资产记录...`);
    let migrated = 0;
    let skipped = 0;

    for (const asset of data) {
        if (!asset.id) {
            console.warn('[Migrate] 资产缺少ID，跳过');
            skipped++;
            continue;
        }

        try {
            // 检查是否已存在
            const existing = db.getAssetById(asset.id);
            if (existing) {
                // 已存在则跳过（不覆盖）
                skipped++;
                continue;
            }
            db.insertAsset(asset);
            migrated++;
        } catch (e) {
            console.warn(`[Migrate] 资产 ${asset.id} 迁移失败: ${e.message}`);
            skipped++;
        }
    }

    console.log(`[Migrate] 资产迁移完成: ${migrated} 条成功, ${skipped} 条跳过`);
    return { migrated, skipped };
}

/**
 * 迁移用户状态
 */
function migrateUserState() {
    const data = readJsonFile('userStateData.json');
    if (!data || typeof data !== 'object') {
        console.log('[Migrate] 用户状态为空或格式不对，跳过');
        return false;
    }

    console.log('[Migrate] 迁移用户状态...');
    db.updateUserState(data);
    console.log('[Migrate] 用户状态迁移完成');
    return true;
}

/**
 * 迁移自定义选项
 */
function migrateCustomOptions() {
    const categories = ['owner', 'type', 'department'];
    let totalMigrated = 0;

    for (const category of categories) {
        // 正常选项
        const values = readJsonFile(`custom_options_${category}.json`);
        // 已删除选项
        const deletedValues = readJsonFile(`custom_options_${category}_deleted.json`);

        if (values && Array.isArray(values)) {
            console.log(`[Migrate] 迁移 ${category} 选项: ${values.length} 个正常, ${deletedValues ? deletedValues.length : 0} 个已删除`);
            db.setCustomOptions(category, values, deletedValues || []);
            totalMigrated += values.length + (deletedValues ? deletedValues.length : 0);
        } else {
            console.log(`[Migrate] ${category} 选项为空，跳过`);
        }
    }

    console.log(`[Migrate] 自定义选项迁移完成: ${totalMigrated} 条`);
    return totalMigrated;
}

/**
 * 主迁移流程
 */
function runMigration(clean = false) {
    console.log('========================================');
    console.log('  数据库迁移工具 v2.4');
    console.log('  data/*.json → SQLite');
    console.log('========================================');
    console.log('');

    // 1. 初始化数据库表结构
    console.log('[Step 1] 初始化数据库表结构...');
    db.initSchema();
    console.log('');

    // 2. 迁移资产数据
    console.log('[Step 2] 迁移资产数据...');
    migrateAssets();
    console.log('');

    // 3. 迁移用户状态
    console.log('[Step 3] 迁移用户状态...');
    migrateUserState();
    console.log('');

    // 4. 迁移自定义选项
    console.log('[Step 4] 迁移自定义选项...');
    migrateCustomOptions();
    console.log('');

    // 5. 验证迁移结果
    console.log('[Step 5] 验证迁移结果...');
    const assets = db.queryAssets({ page: 1, pageSize: 1 });
    const userState = db.getUserState();
    const ownerOptions = db.getCustomOptions('owner');
    console.log(`  资产总数: ${assets.total}`);
    console.log(`  用户视图: ${userState.current_view}`);
    console.log(`  所有者选项: ${ownerOptions.length} 个`);
    console.log('');

    // 6. 可选清理
    if (clean) {
        console.log('[Step 6] 清理 JSON 文件...');
        const jsonFiles = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
        for (const f of jsonFiles) {
            fs.unlinkSync(path.join(DATA_DIR, f));
            console.log(`  删除: ${f}`);
        }
    }

    console.log('');
    console.log('========================================');
    console.log('  迁移完成！');
    console.log(`  数据库: ${db.DB_PATH}`);
    console.log('========================================');

    // 关闭数据库连接
    db.getDb().close();
    process.exit(0);
}

// 运行迁移
const cleanMode = process.argv.includes('--clean');
runMigration(cleanMode);
