// ============================================
// Coffee Shop Sales Tracker - Backend
// Google Apps Script
// ============================================

// ============================================
// CONFIGURATION - ต้องตั้งค่าก่อนใช้งาน
// ============================================

const CONFIG = {
  MASTER_SHEET_ID: '18wiZ46CO6eHY5eB8Gr5ll3Mz8PO9H6U8uNhVrH_QBaQ', // ⚠️ ต้องเปลี่ยนเป็น ID ของ Master Sheet
  MASTER_FOLDER_ID: '1-DEJ8tWApWBt3ACV_dUeIBPx55DHascQ', // ⚠️ ต้องเปลี่ยนเป็น ID ของ Master Folder
  MASTER_PASSWORD: 'SuperAdmin123!', // รหัสผ่าน Super Admin
  SALT: 'CoffeeShop2024Secret', // Salt สำหรับ hash password
  TIMEZONE: 'Asia/Bangkok',
  CURRENT_VERSION: '1.0.0', // 🆕 Current system version

  // 📋 Version Changelog - รายละเอียดการอัพเดทแต่ละเวอร์ชั่น
  VERSION_CHANGELOG: {
    '1.0.0': {
      date: '2024-01-15',
      title: 'Version 1.0.0 - Initial Release',
      features: [
        'ระบบจัดการสินค้า (Products)',
        'ระบบจัดการวัตถุดิบ (Materials)',
        'ระบบสูตรอาหาร (Recipes)',
        'ระบบบันทึกยอดขาย (Sales)',
        'ระบบบันทึกต้นทุน (Costs)',
        'ระบบตั้งค่าร้าน (Settings)',
        'Cache Service สำหรับ Products (90% faster)',
        'Multi-tenant Support',
        'Version Management System',
        'Auto-migration on login',
        'Cell protection for System Version'
      ],
      improvements: [],
      bugFixes: []
    }
    // เพิ่ม version ใหม่ตรงนี้เมื่อมีการอัพเดท
    // '1.1.0': {
    //   date: '2024-02-01',
    //   title: 'Version 1.1.0 - Barcode Support',
    //   features: [
    //     'เพิ่ม Barcode column ใน Products',
    //     'รองรับการสแกนบาร์โค้ด'
    //   ],
    //   improvements: [
    //     'ปรับปรุงความเร็วในการโหลดสินค้า'
    //   ],
    //   bugFixes: [
    //     'แก้ไขปัญหาการคำนวณต้นทุนไม่ถูกต้อง'
    //   ]
    // }
  }
};

// ============================================
// MAIN - Serve HTML
// ============================================

function doGet(e) {
  const page = e.parameter.page || 'index';

  if (page === 'superadmin') {
    return HtmlService.createHtmlOutputFromFile('superadmin')
      .setTitle('Super Admin - Coffee Shop Manager')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Coffee Shop Sales Tracker')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ============================================
// CACHE SERVICE - เพิ่มความเร็ว
// ============================================

const CACHE_DURATION = 300; // 5 minutes


/**
 * Get from cache with fallback
 * [V2 - อัปเกรด] เพิ่มการ re-fetch อัตโนมัติถ้า cache เสีย
 */
function getCached(key, fetchFunction) {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(key);
  
  // 🔽 [เพิ่ม Log] 🔽
  Logger.log(`[getCached] Key: ${key}. Cache hit: ${!!cached}`);

  if (cached) {
    try {
      // 1. พยายามอ่านข้อมูลจาก cache
      Logger.log(`[getCached] Key: ${key}. Attempting to parse cache...`);
      return JSON.parse(cached);
    } catch (e) {
      // 2. [แก้ไข] ถ้าอ่าน cache ไม่ได้ (JSON parse error)
      Logger.log(`[getCached] Key: ${key}. ‼️ PARSE ERROR: ${e}. Cache is poisoned.`);
      Logger.log(`[getCached] Key: ${key}. Removing poisoned cache and re-fetching...`);
      
      // 3. ลบ cache ที่เสียทิ้ง
      cache.remove(key);
      
      // 4. ไปดึงข้อมูลใหม่เลย (ข้ามไป 5)
      // *** V2 จะ "ไม่ return" และปล่อยให้โค้ดไหลลงไปข้างล่าง ***
    }
  }

  // 5. ถ้าไม่มี cache (หรือ cache เพิ่งถูกลบ) ให้ดึงข้อมูลใหม่
  Logger.log(`[getCached] Key: ${key}. Cache miss or poisoned. Calling fetchFunction...`);
  const data = fetchFunction(); // <--- นี่คือการเรียกฟังก์ชัน getSettings (ตัวล่าง)
  
  try {
    cache.put(key, JSON.stringify(data), CACHE_DURATION);
    Logger.log(`[getCached] Key: ${key}. New data fetched and cached.`);
  } catch (e) {
    Logger.log(`[getCached] Key: ${key}. Cache put error (data too large): ${e}`);
  }

  return data;
}

/**
 * Invalidate cache
 */
function invalidateCache(pattern) {
  const cache = CacheService.getScriptCache();
  cache.remove(pattern);
}

/**
 * Invalidate all caches for a specific shop
 */

function invalidateAllCaches(sheetId) {
  const cache = CacheService.getScriptCache();

  const cacheKeys = [
    'products_' + sheetId,
    'materials_' + sheetId,
    'recipes_' + sheetId,
    'settings_' + sheetId,
    'inventory_' + sheetId 
  ];

  // Remove all caches
  cacheKeys.forEach(key => cache.remove(key));
  Logger.log('Invalidated all caches for shop: ' + sheetId);
}

// ============================================
// VERSION MANAGEMENT & MIGRATION SYSTEM
// ============================================

/**
 * ดึง version ของร้าน
 */
function getShopVersion(sheetId) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName('Settings');

    if (!sheet) {
      return '0.0.0'; // ร้านเก่าที่ยังไม่มี version
    }

    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === 'System Version') {
        return data[i][1] || '0.0.0';
      }
    }

    return '0.0.0'; // ไม่มี version field = ร้านเก่า
  } catch (error) {
    Logger.log('Error getting shop version: ' + error);
    return '0.0.0';
  }
}

/**
 * อัพเดท version ของร้าน
 */
function setShopVersion(sheetId, version) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName('Settings');

    if (!sheet) {
      return { success: false, message: 'Settings sheet not found' };
    }

    const data = sheet.getDataRange().getValues();
    let updated = false;

    // หา row ที่มี System Version
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === 'System Version') {
        sheet.getRange(i + 1, 2).setValue(version);
        updated = true;
        break;
      }
    }

    // ถ้าไม่มี System Version ให้เพิ่มใหม่
    if (!updated) {
      sheet.appendRow(['System Version', version]);
    }

    // ล็อคเซลล์ System Version
    protectSystemVersion(sheetId);

    Logger.log('Updated shop ' + sheetId + ' to version ' + version);
    return { success: true };
  } catch (error) {
    Logger.log('Error setting shop version: ' + error);
    return { success: false, message: error.toString() };
  }
}

/**
 * ล็อคเซลล์ System Version ป้องกันผู้ใช้แก้ไข (Apps Script แก้ไขได้)
 */
function protectSystemVersion(sheetId) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName('Settings');

    if (!sheet) {
      Logger.log('Settings sheet not found for protection');
      return { success: false, message: 'Settings sheet not found' };
    }

    const data = sheet.getDataRange().getValues();

    // หา row ที่มี System Version
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === 'System Version') {
        const rowIndex = i + 1;
        const range = sheet.getRange(rowIndex, 2, 1, 1); // Column B (Value)

        // เช็คว่ามี protection อยู่แล้วหรือยัง
        const protections = range.getProtections(SpreadsheetApp.ProtectionType.RANGE);

        if (protections.length === 0) {
          // ยังไม่มี protection → สร้างใหม่
          const protection = range.protect();
          protection.setDescription('System Version (Auto-managed by system)');
          protection.setWarningOnly(false); // Full protection (ไม่ใช่แค่ warning)

          // ลบ editors ทั้งหมด (ยกเว้น owner/script)
          // Apps Script ยังแก้ไขได้เพราะถือเป็น owner
          protection.removeEditors(protection.getEditors());

          Logger.log('Protected System Version cell at row ' + rowIndex);
        } else {
          Logger.log('System Version cell already protected');
        }

        return { success: true };
      }
    }

    Logger.log('System Version field not found');
    return { success: false, message: 'System Version field not found' };
  } catch (error) {
    Logger.log('Error protecting System Version: ' + error);
    return { success: false, message: error.toString() };
  }
}

/**
 * ดึงข้อมูล Version Changelog สำหรับแสดงผลใน UI
 * @returns {Object} ข้อมูล changelog ทุก version + current version
 */
function getVersionChangelog() {
  try {
    const changelog = CONFIG.VERSION_CHANGELOG;
    const currentVersion = CONFIG.CURRENT_VERSION;

    // แปลง object เป็น array และเรียงจากใหม่ไปเก่า
    const versions = Object.keys(changelog).sort((a, b) => {
      return compareVersions(b, a); // เรียงจากมากไปน้อย (ใหม่ไปเก่า)
    });

    const changelogArray = versions.map(version => {
      return {
        version: version,
        ...changelog[version]
      };
    });

    return {
      success: true,
      currentVersion: currentVersion,
      changelog: changelogArray
    };
  } catch (error) {
    Logger.log('Error getting version changelog: ' + error);
    return {
      success: false,
      message: error.toString(),
      currentVersion: CONFIG.CURRENT_VERSION,
      changelog: []
    };
  }
}

/**
 * เปรียบเทียบ version (semantic versioning)
 * @returns -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;

    if (p1 < p2) return -1;
    if (p1 > p2) return 1;
  }

  return 0; // Equal
}

/**
 * รัน migrations สำหรับร้าน
 */
function runMigrations(sheetId, fromVersion, toVersion) {
  try {
    Logger.log('Running migrations for shop ' + sheetId + ' from ' + fromVersion + ' to ' + toVersion);

    const migrations = [];

    // Migration 1.0.0 → เพิ่ม System Version field
    if (compareVersions(fromVersion, '1.0.0') < 0 && compareVersions(toVersion, '1.0.0') >= 0) {
      migrations.push({
        version: '1.0.0',
        description: 'Add System Version to Settings',
        migrate: function(sheetId) {
          // System Version จะถูกเพิ่มโดย setShopVersion อยู่แล้ว
          Logger.log('Migration 1.0.0: System Version field added');
          return { success: true };
        }
      });
    }

    // ===== EXAMPLE MIGRATIONS (สำหรับ demo การทำงาน sequential) =====
    // Uncomment เมื่อต้องการใช้งานจริง

    // Migration 1.1.0 → เพิ่ม Barcode column ใน Products
    // if (compareVersions(fromVersion, '1.1.0') < 0 && compareVersions(toVersion, '1.1.0') >= 0) {
    //   migrations.push({
    //     version: '1.1.0',
    //     description: 'Add Barcode column to Products',
    //     migrate: function(sheetId) {
    //       try {
    //         const ss = SpreadsheetApp.openById(sheetId);
    //         const sheet = ss.getSheetByName('Products');
    //         if (!sheet) return { success: false, message: 'Products sheet not found' };
    //
    //         const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    //         if (headers.indexOf('Barcode') === -1) {
    //           sheet.getRange(1, sheet.getLastColumn() + 1).setValue('Barcode');
    //           Logger.log('Migration 1.1.0: Barcode column added');
    //         }
    //         return { success: true };
    //       } catch (error) {
    //         return { success: false, message: error.toString() };
    //       }
    //     }
    //   });
    // }

    // Migration 1.2.0 → เพิ่ม Promotions sheet
    // if (compareVersions(fromVersion, '1.2.0') < 0 && compareVersions(toVersion, '1.2.0') >= 0) {
    //   migrations.push({
    //     version: '1.2.0',
    //     description: 'Add Promotions sheet',
    //     migrate: function(sheetId) {
    //       try {
    //         const ss = SpreadsheetApp.openById(sheetId);
    //         if (!ss.getSheetByName('Promotions')) {
    //           const sheet = ss.insertSheet('Promotions');
    //           sheet.appendRow(['ID', 'Name', 'Discount %', 'Start Date', 'End Date', 'Active']);
    //           sheet.getRange(1, 1, 1, 6).setFontWeight('bold').setBackground('#9333ea').setFontColor('#ffffff');
    //           Logger.log('Migration 1.2.0: Promotions sheet created');
    //         }
    //         return { success: true };
    //       } catch (error) {
    //         return { success: false, message: error.toString() };
    //       }
    //     }
    //   });
    // }

    // Migration 1.3.0 → เพิ่ม Stock Tracking columns
    // if (compareVersions(fromVersion, '1.3.0') < 0 && compareVersions(toVersion, '1.3.0') >= 0) {
    //   migrations.push({
    //     version: '1.3.0',
    //     description: 'Add Stock Tracking to Materials',
    //     migrate: function(sheetId) {
    //       try {
    //         const ss = SpreadsheetApp.openById(sheetId);
    //         const sheet = ss.getSheetByName('Materials');
    //         if (!sheet) return { success: false, message: 'Materials sheet not found' };
    //
    //         const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    //         const lastCol = sheet.getLastColumn();
    //
    //         if (headers.indexOf('Min Stock') === -1) {
    //           sheet.getRange(1, lastCol + 1).setValue('Min Stock');
    //           Logger.log('Migration 1.3.0: Min Stock column added');
    //         }
    //         if (headers.indexOf('Max Stock') === -1) {
    //           sheet.getRange(1, lastCol + 2).setValue('Max Stock');
    //           Logger.log('Migration 1.3.0: Max Stock column added');
    //         }
    //         return { success: true };
    //       } catch (error) {
    //         return { success: false, message: error.toString() };
    //       }
    //     }
    //   });
    // }

    // รัน migrations ตามลำดับ
    for (let i = 0; i < migrations.length; i++) {
      const migration = migrations[i];
      Logger.log('Running migration ' + migration.version + ': ' + migration.description);

      const result = migration.migrate(sheetId);

      if (!result.success) {
        Logger.log('Migration ' + migration.version + ' failed: ' + result.message);
        return {
          success: false,
          failedAt: migration.version,
          message: 'Migration failed at version ' + migration.version
        };
      }
    }

    // อัพเดท version หลังจาก migrate สำเร็จ
    setShopVersion(sheetId, toVersion);

    Logger.log('Migrations completed successfully. Shop updated to version ' + toVersion);

    return {
      success: true,
      message: 'Migrated from ' + fromVersion + ' to ' + toVersion,
      migrationsRun: migrations.length
    };
  } catch (error) {
    Logger.log('Error running migrations: ' + error);
    return {
      success: false,
      message: error.toString()
    };
  }
}

/**
 * เช็คและรัน migrations ถ้าจำเป็น (เรียกตอน login)
 */
function checkAndMigrate(sheetId) {
  try {
    const shopVersion = getShopVersion(sheetId);
    const currentVersion = CONFIG.CURRENT_VERSION;

    Logger.log('Shop version: ' + shopVersion + ', Current version: ' + currentVersion);

    // ถ้า version ตรงกัน ไม่ต้อง migrate
    if (compareVersions(shopVersion, currentVersion) === 0) {
      return {
        success: true,
        migrated: false,
        message: 'Shop is up to date (version ' + shopVersion + ')'
      };
    }

    // ถ้า shop version สูงกว่า current version (ไม่ควรเกิด)
    if (compareVersions(shopVersion, currentVersion) > 0) {
      return {
        success: false,
        message: 'Shop version (' + shopVersion + ') is newer than system version (' + currentVersion + ')'
      };
    }

    // รัน migrations
    const result = runMigrations(sheetId, shopVersion, currentVersion);

    if (result.success) {
      // Clear cache หลัง migrate
      invalidateAllCaches(sheetId);

      // Refresh Named Ranges
      createNamedRanges(sheetId);

      return {
        success: true,
        migrated: true,
        fromVersion: shopVersion,
        toVersion: currentVersion,
        migrationsRun: result.migrationsRun,
        message: 'Successfully migrated from ' + shopVersion + ' to ' + currentVersion
      };
    }

    return result;
  } catch (error) {
    Logger.log('Error in checkAndMigrate: ' + error);
    return {
      success: false,
      message: error.toString()
    };
  }
}

/**
 * ทดสอบระบบ migration (manual testing)
 */
function testMigration(sheetId) {
  const shopVersion = getShopVersion(sheetId);
  const currentVersion = CONFIG.CURRENT_VERSION;

  Logger.log('=== Migration Test ===');
  Logger.log('Shop Version: ' + shopVersion);
  Logger.log('Current Version: ' + currentVersion);
  Logger.log('Comparison: ' + compareVersions(shopVersion, currentVersion));

  const result = checkAndMigrate(sheetId);

  Logger.log('Result: ' + JSON.stringify(result));

  return result;
}

/**
 * Demo: แสดงการทำงานของ Sequential Migration
 *
 * ตัวอย่าง: Shop version = 1.4.0, Current version = 1.8.0
 * จะรัน migrations: 1.5.0 → 1.6.0 → 1.7.0 → 1.8.0 ตามลำดับ
 *
 * @param {string} sheetId - Sheet ID ของร้าน
 * @param {string} simulatedShopVersion - จำลอง shop version (ถ้าไม่ระบุจะใช้ version จริงจาก Settings)
 */
function demoSequentialMigration(sheetId, simulatedShopVersion) {
  try {
    const shopVersion = simulatedShopVersion || getShopVersion(sheetId);
    const currentVersion = CONFIG.CURRENT_VERSION;

    Logger.log('============================================');
    Logger.log('SEQUENTIAL MIGRATION DEMO');
    Logger.log('============================================');
    Logger.log('Shop ID: ' + sheetId);
    Logger.log('Shop Version: ' + shopVersion);
    Logger.log('Current Version: ' + currentVersion);
    Logger.log('');

    // จำลอง migrations ที่จะรัน
    const allMigrations = [
      { version: '1.0.0', description: 'Add System Version to Settings' },
      { version: '1.1.0', description: 'Add Barcode column to Products' },
      { version: '1.2.0', description: 'Add Promotions sheet' },
      { version: '1.3.0', description: 'Add Stock Tracking to Materials' },
      { version: '1.4.0', description: 'Add Customer Loyalty Program' },
      { version: '1.5.0', description: 'Add Multi-currency Support' },
      { version: '1.6.0', description: 'Add Inventory Alerts' },
      { version: '1.7.0', description: 'Add Sales Analytics' },
      { version: '1.8.0', description: 'Add QR Code Menu' }
    ];

    Logger.log('Migrations ที่ต้องรัน (fromVersion > ' + shopVersion + ' && <= ' + currentVersion + '):');
    Logger.log('');

    let migrationsToRun = [];

    for (let i = 0; i < allMigrations.length; i++) {
      const migration = allMigrations[i];
      const shouldRun = compareVersions(shopVersion, migration.version) < 0 &&
                        compareVersions(currentVersion, migration.version) >= 0;

      if (shouldRun) {
        migrationsToRun.push(migration);
        Logger.log('✅ Migration ' + migration.version + ': ' + migration.description);
      } else {
        Logger.log('⏭️  Skip ' + migration.version + ': ' + migration.description +
                   ' (shopVersion: ' + shopVersion + ' vs migration: ' + migration.version + ')');
      }
    }

    Logger.log('');
    Logger.log('============================================');
    Logger.log('SUMMARY');
    Logger.log('============================================');
    Logger.log('Total migrations to run: ' + migrationsToRun.length);
    Logger.log('');

    if (migrationsToRun.length > 0) {
      Logger.log('Execution order:');
      for (let i = 0; i < migrationsToRun.length; i++) {
        Logger.log((i + 1) + '. Version ' + migrationsToRun[i].version + ': ' + migrationsToRun[i].description);
      }
      Logger.log('');
      Logger.log('After all migrations succeed:');
      Logger.log('→ Shop version will be updated from ' + shopVersion + ' to ' + currentVersion);
      Logger.log('→ Cache will be cleared (invalidateAllCaches)');
      Logger.log('→ Named Ranges will be refreshed (createNamedRanges)');
    } else {
      Logger.log('No migrations needed. Shop is up to date!');
    }

    Logger.log('');
    Logger.log('============================================');
    Logger.log('COMPARISON LOGIC');
    Logger.log('============================================');
    Logger.log('');
    Logger.log('การเช็คว่า migration ต้องรันหรือไม่:');
    Logger.log('');
    Logger.log('if (compareVersions(fromVersion, migrationVersion) < 0 &&');
    Logger.log('    compareVersions(toVersion, migrationVersion) >= 0) {');
    Logger.log('  // รัน migration');
    Logger.log('}');
    Logger.log('');
    Logger.log('ตัวอย่าง:');
    Logger.log('Shop Version: 1.4.0, Current: 1.8.0, Migration: 1.5.0');
    Logger.log('→ 1.4.0 < 1.5.0? ' + (compareVersions('1.4.0', '1.5.0') < 0) + ' (YES)');
    Logger.log('→ 1.8.0 >= 1.5.0? ' + (compareVersions('1.8.0', '1.5.0') >= 0) + ' (YES)');
    Logger.log('→ Result: รัน migration 1.5.0 ✅');
    Logger.log('');
    Logger.log('Shop Version: 1.4.0, Current: 1.8.0, Migration: 1.3.0');
    Logger.log('→ 1.4.0 < 1.3.0? ' + (compareVersions('1.4.0', '1.3.0') < 0) + ' (NO)');
    Logger.log('→ Result: ข้าม migration 1.3.0 ⏭️');
    Logger.log('');
    Logger.log('============================================');

    return {
      success: true,
      shopVersion: shopVersion,
      currentVersion: currentVersion,
      migrationsToRun: migrationsToRun.length,
      migrations: migrationsToRun
    };
  } catch (error) {
    Logger.log('Error in demo: ' + error);
    return { success: false, message: error.toString() };
  }
}

/**
 * ตัวอย่างการใช้งาน demoSequentialMigration()
 *
 * เรียกใช้ใน Apps Script Editor:
 *
 * 1. Demo กับ shop version จริง:
 *    demoSequentialMigration('YOUR_SHEET_ID');
 *
 * 2. Demo กับ shop version จำลอง:
 *    demoSequentialMigration('YOUR_SHEET_ID', '1.4.0');
 *    demoSequentialMigration('YOUR_SHEET_ID', '0.0.0');
 *    demoSequentialMigration('YOUR_SHEET_ID', '1.7.0');
 */

// ============================================
// PRE-WARM CACHE SYSTEM - Auto-refresh ทุก 15 นาที
// ============================================

/**
 * Pre-warm cache สำหรับร้านเดียว
 * โหลดข้อมูลล่วงหน้าเพื่อสร้าง cache
 */
function preWarmShopCache(sheetId) {
  try {
    Logger.log('Pre-warming cache for shop: ' + sheetId);

    // Invalidate old caches first
    invalidateAllCaches(sheetId);

    // Warm up caches by calling get functions
    // These will create new cache entries
    getProducts(sheetId);
    getMaterials(sheetId);
    getRecipes(sheetId);
    getSettings(sheetId);

    Logger.log('Cache pre-warmed successfully for shop: ' + sheetId);
    return { success: true };
  } catch (error) {
    Logger.log('Error pre-warming cache for shop ' + sheetId + ': ' + error);
    return { success: false, message: error.toString() };
  }
}

/**
 * Pre-warm cache สำหรับทุกร้านที่ active
 * รันโดย Time-based Trigger ทุก 15 นาที
 */
function preWarmAllCaches() {
  try {
    Logger.log('Starting pre-warm cache for all shops...');

    // ดึงรายการร้านทั้งหมดจาก Master Sheet
    const ss = SpreadsheetApp.openById(CONFIG.MASTER_SHEET_ID);
    const sheet = ss.getSheetByName('MasterDB');

    if (!sheet) {
      Logger.log('Master Sheet not found');
      return { success: false, message: 'Master Sheet not found' };
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      Logger.log('No shops found');
      return { success: true, message: 'No shops to warm' };
    }

    const headers = data[0];
    const sheetIdIndex = headers.indexOf('Sheet ID');
    const statusIndex = headers.indexOf('Status');

    let warmedCount = 0;
    let skippedCount = 0;

    // Loop ทุกร้าน
    for (let i = 1; i < data.length; i++) {
      const status = data[i][statusIndex];
      const sheetId = data[i][sheetIdIndex];

      // Pre-warm เฉพาะร้านที่ active
      if (status === 'active' && sheetId) {
        preWarmShopCache(sheetId);
        warmedCount++;

        // Sleep 1 second ระหว่างร้าน เพื่อป้องกัน quota limit
        Utilities.sleep(1000);
      } else {
        skippedCount++;
      }
    }

    Logger.log('Pre-warm completed: ' + warmedCount + ' shops warmed, ' + skippedCount + ' shops skipped');

    return {
      success: true,
      message: 'Pre-warmed ' + warmedCount + ' shops',
      warmedCount: warmedCount,
      skippedCount: skippedCount
    };
  } catch (error) {
    Logger.log('Error in preWarmAllCaches: ' + error);
    return { success: false, message: error.toString() };
  }
}

/**
 * ติดตั้ง Time-based Trigger สำหรับ Pre-warm Cache
 * รันทุก 15 นาที
 */
function setupCacheWarmerTrigger() {
  try {
    // ลบ trigger เก่าก่อน (ถ้ามี)
    removeCacheWarmerTrigger();

    // สร้าง trigger ใหม่ - รันทุก 15 นาที
    ScriptApp.newTrigger('preWarmAllCaches')
      .timeBased()
      .everyMinutes(15)
      .create();

    Logger.log('Cache warmer trigger installed successfully (runs every 15 minutes)');

    return {
      success: true,
      message: 'Cache warmer trigger installed successfully'
    };
  } catch (error) {
    Logger.log('Error setting up trigger: ' + error);
    return { success: false, message: error.toString() };
  }
}

/**
 * ลบ Time-based Trigger สำหรับ Pre-warm Cache
 */
function removeCacheWarmerTrigger() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    let removedCount = 0;

    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'preWarmAllCaches') {
        ScriptApp.deleteTrigger(trigger);
        removedCount++;
      }
    });

    Logger.log('Removed ' + removedCount + ' cache warmer trigger(s)');

    return {
      success: true,
      message: 'Removed ' + removedCount + ' trigger(s)'
    };
  } catch (error) {
    Logger.log('Error removing triggers: ' + error);
    return { success: false, message: error.toString() };
  }
}

/**
 * ตรวจสอบสถานะ Cache Warmer Trigger
 */
function checkCacheWarmerStatus() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    const cacheWarmerTriggers = triggers.filter(trigger =>
      trigger.getHandlerFunction() === 'preWarmAllCaches'
    );

    if (cacheWarmerTriggers.length === 0) {
      return {
        success: true,
        installed: false,
        message: 'Cache warmer trigger not installed'
      };
    }

    const trigger = cacheWarmerTriggers[0];
    const triggerSource = trigger.getTriggerSource();
    const eventType = trigger.getEventType();

    return {
      success: true,
      installed: true,
      count: cacheWarmerTriggers.length,
      triggerSource: triggerSource.toString(),
      eventType: eventType.toString(),
      message: 'Cache warmer is active (runs every 15 minutes)'
    };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Hash password
 */
function hashPassword(password) {
  const combined = password + CONFIG.SALT;
  return Utilities.base64Encode(Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    combined
  ));
}

/**
 * แปลง Date เป็น ISO String สำหรับ serialize
 */
function serializeDate(date) {
  if (!date) return null;
  if (typeof date === 'string') return date;
  return Utilities.formatDate(new Date(date), CONFIG.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
}

/**
 * แปลง object ที่มี Date ให้เป็น serializable
 */
function serializeObject(obj) {
  if (!obj) return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => serializeObject(item));
  }
  if (typeof obj === 'object' && obj !== null) {
    const serialized = {};
    for (const key in obj) {
      const value = obj[key];
      if (value instanceof Date) {
        serialized[key] = serializeDate(value);
      } else if (typeof value === 'object') {
        serialized[key] = serializeObject(value);
      } else {
        serialized[key] = value;
      }
    }
    return serialized;
  }
  return obj;
}

/**
 * Format วันที่เป็นไทย
 */
function formatDateThai(date) {
  return Utilities.formatDate(new Date(date), CONFIG.TIMEZONE, 'dd/MM/yyyy');
}

/**
 * Format เวลา
 */
function formatTime(date) {
  return Utilities.formatDate(new Date(date), CONFIG.TIMEZONE, 'HH:mm:ss');
}

/**
 * สร้าง unique ID
 */
function generateId(prefix) {
  return prefix + new Date().getTime() + Math.random().toString(36).substr(2, 5).toUpperCase();
}

// ============================================
// NAMED RANGES - เพิ่มความเร็วการค้นหา 50%
// ============================================

/**
 * สร้าง/อัพเดท Named Ranges สำหรับ Sheet
 * ใช้เมื่อ: 1) สร้างร้านใหม่ (auto) 2) เพิ่ม/ลบข้อมูลจำนวนมาก (manual)
 */
function createNamedRanges(sheetId) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);

    // ลบ Named Ranges เก่าก่อน (ถ้ามี)
    const existingRanges = ss.getNamedRanges();
    existingRanges.forEach(range => {
      const name = range.getName();
      if (name === 'ProductsData' || name === 'MaterialsData' || name === 'RecipesData') {
        range.remove();
      }
    });

    // Products
    const productsSheet = ss.getSheetByName('Products');
    if (productsSheet && productsSheet.getLastRow() > 1) {
      const productsRange = productsSheet.getRange(2, 1, productsSheet.getLastRow() - 1, productsSheet.getLastColumn());
      ss.setNamedRange('ProductsData', productsRange);
    }

    // Materials
    const materialsSheet = ss.getSheetByName('Materials');
    if (materialsSheet && materialsSheet.getLastRow() > 1) {
      const materialsRange = materialsSheet.getRange(2, 1, materialsSheet.getLastRow() - 1, materialsSheet.getLastColumn());
      ss.setNamedRange('MaterialsData', materialsRange);
    }

    // Recipes
    const recipesSheet = ss.getSheetByName('Recipes');
    if (recipesSheet && recipesSheet.getLastRow() > 1) {
      const recipesRange = recipesSheet.getRange(2, 1, recipesSheet.getLastRow() - 1, recipesSheet.getLastColumn());
      ss.setNamedRange('RecipesData', recipesRange);
    }

    return { success: true, message: 'Named ranges created successfully' };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

/**
 * Refresh Named Range for specific sheet (helper function)
 * Auto-refresh หลัง add/delete ข้อมูล
 */
function refreshNamedRange(ss, sheetName, rangeName) {
  try {
    const sheet = ss.getSheetByName(sheetName);
    if (sheet && sheet.getLastRow() > 1) {
      const newRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn());
      ss.setNamedRange(rangeName, newRange);
    } else {
      // ถ้าไม่มีข้อมูล ให้ลบ Named Range
      const namedRange = ss.getRangeByName(rangeName);
      if (namedRange) {
        namedRange.remove();
      }
    }
  } catch (e) {
    // Silent fail - Named Range ไม่จำเป็นต้องมี
  }
}

/**
 * ค้นหา Product ด้วย ID แบบเร็ว (ใช้ Named Range)
 */
function getProductByIdFast(sheetId, productId) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const namedRange = ss.getRangeByName('ProductsData');

    if (!namedRange) {
      // Fallback to normal method if named range not exists
      const productsResult = getProducts(sheetId);
      if (productsResult.success) {
        const product = productsResult.data.find(p => p['Product ID'] === productId);
        return product ? { success: true, data: product } : { success: false, message: 'Product not found' };
      }
      return productsResult;
    }

    const values = namedRange.getValues();
    const sheet = ss.getSheetByName('Products');
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    for (let i = 0; i < values.length; i++) {
      if (values[i][0] === productId) {
        let product = {};
        headers.forEach((header, index) => {
          product[header] = values[i][index];
        });
        return { success: true, data: serializeObject(product) };
      }
    }

    return { success: false, message: 'Product not found' };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

/**
 * ค้นหา Material ด้วย ID แบบเร็ว (ใช้ Named Range)
 */
function getMaterialByIdFast(sheetId, materialId) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const namedRange = ss.getRangeByName('MaterialsData');

    if (!namedRange) {
      // Fallback to normal method
      const materialsResult = getMaterials(sheetId);
      if (materialsResult.success) {
        const material = materialsResult.data.find(m => m['Material ID'] === materialId);
        return material ? { success: true, data: material } : { success: false, message: 'Material not found' };
      }
      return materialsResult;
    }

    const values = namedRange.getValues();
    const sheet = ss.getSheetByName('Materials');
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    for (let i = 0; i < values.length; i++) {
      if (values[i][0] === materialId) {
        let material = {};
        headers.forEach((header, index) => {
          material[header] = values[i][index];
        });
        return { success: true, data: serializeObject(material) };
      }
    }

    return { success: false, message: 'Material not found' };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

// ============================================
// MASTER SHEET FUNCTIONS
// ============================================

/**
 * ดึงข้อมูลร้านทั้งหมด (สำหรับ Super Admin)
 */
function getAllShops() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.MASTER_SHEET_ID);
    const sheet = ss.getSheetByName('MasterDB');

    if (!sheet) {
      return { success: false, message: 'Master Sheet not found' };
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return { success: true, data: [] };
    }

    const headers = data[0];
    const rows = data.slice(1);

    const shops = rows.map(row => {
      let shop = {};
      headers.forEach((header, index) => {
        shop[header] = row[index];
      });
      return shop;
    });

    return { success: true, data: serializeObject(shops) };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

/**
 * เพิ่มร้านใหม่
 */
function addNewShop(shopData) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.MASTER_SHEET_ID);
    const sheet = ss.getSheetByName('MasterDB');

    if (!sheet) {
      return { success: false, message: 'Master Sheet not found' };
    }

    // สร้าง Shop ID
    const shopId = generateId('SHOP');

    // สร้างโฟลเดอร์สำหรับร้าน
    const masterFolder = DriveApp.getFolderById(CONFIG.MASTER_FOLDER_ID);
    const shopFolder = masterFolder.createFolder(shopData.shopName + ' - ' + shopId);
    const shopFolderId = shopFolder.getId();

    // สร้างโฟลเดอร์ย่อย
    const receiptsFolder = shopFolder.createFolder('Receipts'); // เก็บรูปสลิป
    const dataFolder = shopFolder.createFolder('Data'); // เก็บไฟล์ข้อมูล

    // สร้าง Google Sheet ใหม่สำหรับร้าน
    const newShopResult = createShopSheet(shopData.shopName, dataFolder.getId());

    if (!newShopResult.success) {
      // ลบโฟลเดอร์ถ้าสร้าง Sheet ไม่สำเร็จ
      shopFolder.setTrashed(true);
      return newShopResult;
    }

    // คำนวณวันหมดอายุ
    const startDate = new Date();
    const endDate = new Date();

    if (shopData.package === 'monthly') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else if (shopData.package === 'yearly') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    // Hash password
    const passwordHash = hashPassword(shopData.password);

    // บันทึกลง Master Sheet
    const row = [
      shopId,
      shopData.shopName,
      shopData.email,
      passwordHash,
      newShopResult.sheetId,
      shopData.package,
      startDate,
      endDate,
      'active',
      shopFolderId,
      receiptsFolder.getId(),
      dataFolder.getId(),
      new Date(),
      new Date()
    ];

    sheet.appendRow(row);

    return {
      success: true,
      message: 'Shop created successfully',
      shopId: shopId,
      sheetId: newShopResult.sheetId,
      folderId: shopFolderId
    };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

/**
 * อัพเดทข้อมูลร้าน
 */
function updateShop(shopId, updateData) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.MASTER_SHEET_ID);
    const sheet = ss.getSheetByName('MasterDB');

    if (!sheet) {
      return { success: false, message: 'Master Sheet not found' };
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const shopIdIndex = headers.indexOf('Shop ID');

    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][shopIdIndex] === shopId) {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex === -1) {
      return { success: false, message: 'Shop not found' };
    }

    // อัพเดทข้อมูล
    Object.keys(updateData).forEach(key => {
      const colIndex = headers.indexOf(key);
      if (colIndex !== -1) {
        if (key === 'Password Hash' && updateData[key]) {
          sheet.getRange(rowIndex, colIndex + 1).setValue(hashPassword(updateData[key]));
        } else {
          sheet.getRange(rowIndex, colIndex + 1).setValue(updateData[key]);
        }
      }
    });

    // อัพเดทเวลา
    const updatedAtIndex = headers.indexOf('Updated At');
    if (updatedAtIndex !== -1) {
      sheet.getRange(rowIndex, updatedAtIndex + 1).setValue(new Date());
    }

    return { success: true, message: 'Shop updated successfully' };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

/**
 * ลบร้าน (เปลี่ยนสถานะเป็น inactive)
 */
function deleteShop(shopId) {
  return updateShop(shopId, { Status: 'inactive' });
}

/**
 * ต่ออายุไลเซ่นส์
 */
function renewLicense(shopId, packageType) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.MASTER_SHEET_ID);
    const sheet = ss.getSheetByName('MasterDB');

    if (!sheet) {
      return { success: false, message: 'Master Sheet not found' };
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const shopIdIndex = headers.indexOf('Shop ID');
    const endDateIndex = headers.indexOf('End Date');

    let rowIndex = -1;
    let currentEndDate = null;

    for (let i = 1; i < data.length; i++) {
      if (data[i][shopIdIndex] === shopId) {
        rowIndex = i + 1;
        currentEndDate = new Date(data[i][endDateIndex]);
        break;
      }
    }

    if (rowIndex === -1) {
      return { success: false, message: 'Shop not found' };
    }

    const newEndDate = new Date(currentEndDate);

    if (packageType === 'monthly') {
      newEndDate.setMonth(newEndDate.getMonth() + 1);
    } else if (packageType === 'yearly') {
      newEndDate.setFullYear(newEndDate.getFullYear() + 1);
    }

    sheet.getRange(rowIndex, endDateIndex + 1).setValue(newEndDate);

    const packageIndex = headers.indexOf('Package');
    const statusIndex = headers.indexOf('Status');
    const updatedAtIndex = headers.indexOf('Updated At');

    if (packageIndex !== -1) {
      sheet.getRange(rowIndex, packageIndex + 1).setValue(packageType);
    }
    if (statusIndex !== -1) {
      sheet.getRange(rowIndex, statusIndex + 1).setValue('active');
    }
    if (updatedAtIndex !== -1) {
      sheet.getRange(rowIndex, updatedAtIndex + 1).setValue(new Date());
    }

    return {
      success: true,
      message: 'License renewed successfully',
      newEndDate: serializeDate(newEndDate)
    };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

// ============================================
// SHOP SHEET FUNCTIONS
// ============================================

/**
 * [แก้ไข] สร้าง Google Sheet ใหม่สำหรับร้าน
 * (อัปเดตให้เรียกสร้างชีตใหม่ทั้งหมด)
 */
function createShopSheet(shopName, folderId) {
  try {
    const folder = DriveApp.getFolderById(folderId);
    const newSS = SpreadsheetApp.create(shopName + ' - Data');
    const file = DriveApp.getFileById(newSS.getId());
    folder.addFile(file);
    DriveApp.getRootFolder().removeFile(file); // ลบออกจาก root

    const sheetId = newSS.getId();
    const defaultSheet = newSS.getSheets()[0];

    // --- สร้าง Sheets พื้นฐาน ---
    createSalesSheet(newSS);
    createProductsSheet(newSS);
    createRecipesSheet(newSS);
    createMaterialsSheet(newSS); // <-- (ฟังก์ชันนี้จะถูกอัปเกรดในข้อ 2)
    createDailyCostsSheet(newSS);
    createMonthlyCostsSheet(newSS);
    createSettingsSheet(newSS, shopName);
    
    // --- 🔽 [เพิ่มใหม่] สร้าง Sheets สำหรับฟีเจอร์ใหม่ 🔽 ---
    
    // 1. สร้างชีตสต็อก
    createStockLedgerSheet(newSS); 
    
    // 2. สร้างชีต Options & Combos
    // (เราจะเรียกใช้ฟังก์ชันที่มีอยู่แล้วใน Code.js ของคุณ)
    createOptionSheetsIfNeeded(sheetId);
    
    // 3. สร้างชีตช่องทางสั่งซื้อ
    createOrderChannelsSheetIfNeeded(sheetId);
    
    // 4. สร้างชีตส่วนลด
    createDiscountPresetsSheetIfNeeded(sheetId);
    
    // 5. สร้างชีตแบ่งจ่าย
    createPaymentSplitsSheetIfNeeded(sheetId);
    
    // --- 🔼 [สิ้นสุดส่วนที่เพิ่ม] 🔼 ---

    newSS.deleteSheet(defaultSheet);

    // Auto-create Named Ranges for fast lookups
    createNamedRanges(sheetId);

    return { success: true, sheetId: sheetId };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

function createSalesSheet(ss) {
  const sheet = ss.insertSheet('Sales');
  const headers = [
    'ID', 'Order Number', 'Date', 'Time', 'Product ID', 'Product Name',
    'Quantity', 'Unit Price', 'Total', 'Payment Methods',
    'Channel', 'Note', 'Created At'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#9333ea')
    .setFontColor('#ffffff');
  sheet.setFrozenRows(1);
}

function createProductsSheet(ss) {
  const sheet = ss.insertSheet('Products');
  const headers = [
    'Product ID', 'Product Name', 'Category', 'Price',
    'Cost', 'Image URL', 'Status', 'Created At', 'Updated At'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#9333ea')
    .setFontColor('#ffffff');
  sheet.setFrozenRows(1);

  // ข้อมูลตัวอย่าง
  const sampleData = [
    ['P001', 'Espresso', 'Hot Coffee', 45, 15, '', 'active', new Date(), new Date()],
    ['P002', 'Cappuccino', 'Hot Coffee', 55, 20, '', 'active', new Date(), new Date()],
    ['P003', 'Latte', 'Hot Coffee', 60, 22, '', 'active', new Date(), new Date()],
    ['P004', 'Americano', 'Hot Coffee', 50, 18, '', 'active', new Date(), new Date()],
    ['P005', 'Iced Latte', 'Iced Coffee', 65, 25, '', 'active', new Date(), new Date()]
  ];
  sheet.getRange(2, 1, sampleData.length, headers.length).setValues(sampleData);
}

function createRecipesSheet(ss) {
  const sheet = ss.insertSheet('Recipes');
  const headers = [
    'Recipe ID', 'Product ID', 'Product Name', 'Material ID',
    'Material Name', 'Quantity', 'Unit', 'Created At'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#9333ea')
    .setFontColor('#ffffff');
  sheet.setFrozenRows(1);

  const sampleData = [
    ['R001', 'P001', 'Espresso', 'M001', 'Coffee Beans', 18, 'g', new Date()],
    ['R002', 'P002', 'Cappuccino', 'M001', 'Coffee Beans', 18, 'g', new Date()],
    ['R003', 'P002', 'Cappuccino', 'M002', 'Milk', 150, 'ml', new Date()],
    ['R004', 'P003', 'Latte', 'M001', 'Coffee Beans', 18, 'g', new Date()],
    ['R005', 'P003', 'Latte', 'M002', 'Milk', 200, 'ml', new Date()]
  ];
  sheet.getRange(2, 1, sampleData.length, headers.length).setValues(sampleData);
}





/**
 * [แก้ไข] สร้างชีต Materials
 * (อัปเดตให้มี Stock on Hand และ Min Stock)
 */
function createMaterialsSheet(ss) {
  const sheet = ss.insertSheet('Materials');
  // [แก้ไข] เพิ่มคอลัมน์ Stock on Hand (คงเหลือ) และ Min Stock (ขั้นต่ำ)
  const headers = [
    'Material ID', 'Material Name', 'Unit', 'Price Per Unit',
    'Supplier', 'Updated At', 'Stock on Hand', 'Min Stock'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#9333ea')
    .setFontColor('#ffffff');
  sheet.setFrozenRows(1);

  // [แก้ไข] เพิ่มข้อมูลตัวอย่างสำหรับคอลัมน์ใหม่
  const sampleData = [
    ['M001', 'Coffee Beans', 'g', 1.5, 'Coffee Supplier Co.', new Date(), 1000, 500],
    ['M002', 'Milk', 'ml', 0.08, 'Dairy Farm', new Date(), 5000, 1000],
    ['M003', 'Sugar', 'g', 0.05, 'Local Market', new Date(), 2000, 200],
    ['M004', 'Cup (Small)', 'pcs', 2.5, 'Packaging Store', new Date(), 500, 100],
    ['M005', 'Cup (Medium)', 'pcs', 3.0, 'Packaging Store', new Date(), 500, 100]
  ];
  sheet.getRange(2, 1, sampleData.length, headers.length).setValues(sampleData);
}


/**
 * [ใหม่] สร้างชีต StockLedger สำหรับเก็บประวัติสต็อก
 */
function createStockLedgerSheet(ss) {
  const sheet = ss.insertSheet('StockLedger');
  const headers = [
    'Ledger ID', 'Date', 'Material ID', 'Material Name', 'Quantity Change', 'Reason', 'Order Number'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#009688') // สีเขียว
    .setFontColor('#ffffff');
  sheet.setFrozenRows(1);
}

/**
 * [ใหม่] สร้าง Sheet 'OrderChannels' ถ้ายังไม่มี
 */
function createOrderChannelsSheetIfNeeded(sheetId) {
  try {
    var ss = SpreadsheetApp.openById(sheetId);
    var sheet = ss.getSheetByName('OrderChannels');
    if (!sheet) {
      sheet = ss.insertSheet('OrderChannels');
      var headers = [
        'Channel ID', 'Channel Name', 'Order Number Mode', 'Order Prefix', 'Counter', 'Status', 'Created Date', 'Updated Date'
      ];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#FF6D00').setFontColor('#FFFFFF');
      sheet.setFrozenRows(1);

      // Add default data
      var demoData = [
        ['CH001', 'หน้าร้าน (POS)', 'auto', 'POS-{YYMMDD}-', 1, 'active', new Date(), new Date()],
        ['CH002', 'Delivery App', 'manual', 'DEL-', 1, 'active', new Date(), new Date()]
      ];
      sheet.getRange(2, 1, demoData.length, headers.length).setValues(demoData);
      Logger.log('OrderChannels sheet created.');
    }
    return { success: true };
  } catch (e) {
    Logger.log('Error creating OrderChannels sheet: ' + e);
    return { success: false, message: e.toString() };
  }
}

/**
 * [ใหม่] สร้าง Sheet 'DiscountPresets' ถ้ายังไม่มี
 */
function createDiscountPresetsSheetIfNeeded(sheetId) {
  try {
    var ss = SpreadsheetApp.openById(sheetId);
    var sheet = ss.getSheetByName('DiscountPresets');
    if (!sheet) {
      sheet = ss.insertSheet('DiscountPresets');
      var headers = [
        'Preset ID', 'Label', 'Discount Value', 'Discount Type', 'Status', 'Created Date'
      ];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#FF9800').setFontColor('#FFFFFF');
      sheet.setFrozenRows(1);

      // Add default data
      var demoData = [
        ['DP001', 'ลด 5%', 5, 'percent', 'active', new Date()],
        ['DP002', 'ลด 10%', 10, 'percent', 'active', new Date()],
        ['DP003', 'ลด 20 บ.', 20, 'amount', 'active', new Date()]
      ];
      sheet.getRange(2, 1, demoData.length, headers.length).setValues(demoData);
      Logger.log('DiscountPresets sheet created.');
    }
    return { success: true };
  } catch (e) {
    Logger.log('Error creating DiscountPresets sheet: ' + e);
    return { success: false, message: e.toString() };
  }
}

/**
 * [ใหม่] สร้าง Sheet 'PaymentSplits' ถ้ายังไม่มี
 */
function createPaymentSplitsSheetIfNeeded(sheetId) {
  try {
    var ss = SpreadsheetApp.openById(sheetId);
    var sheet = ss.getSheetByName('PaymentSplits');
    if (!sheet) {
      sheet = ss.insertSheet('PaymentSplits');
      var headers = [
        'Split ID', 'Order Number', 'Date', 'Method', 'Amount'
      ];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#00BCD4').setFontColor('#FFFFFF');
      sheet.setFrozenRows(1);
      Logger.log('PaymentSplits sheet created.');
    }
    return { success: true };
  } catch (e) {
    Logger.log('Error creating PaymentSplits sheet: ' + e);
    return { success: false, message: e.toString() };
  }
}



/**
 * [ใหม่] สร้างชีต StockLedger สำหรับเก็บประวัติสต็อก
 */
function createStockLedgerSheet(ss) {
  const sheet = ss.insertSheet('StockLedger');
  const headers = [
    'Ledger ID', 'Date', 'Material ID', 'Material Name', 'Quantity Change', 'Reason', 'Order Number'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#009688') // สีเขียว
    .setFontColor('#ffffff');
  sheet.setFrozenRows(1);
}


function createDailyCostsSheet(ss) {
  const sheet = ss.insertSheet('DailyCosts');
  const headers = [
    'ID', 'Date', 'Description', 'Amount', 'Category', 'Created At'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#9333ea')
    .setFontColor('#ffffff');
  sheet.setFrozenRows(1);
}

function createMonthlyCostsSheet(ss) {
  const sheet = ss.insertSheet('MonthlyCosts');
  const headers = [
    'ID', 'Month', 'Description', 'Amount', 'Category', 'Created At', 'Updated At'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#9333ea')
    .setFontColor('#ffffff');
  sheet.setFrozenRows(1);
}

function createSettingsSheet(ss, shopName) {
  const sheet = ss.insertSheet('Settings');

  const settings = [
    ['Setting', 'Value'],
    ['Shop Name', shopName],
    ['Address', ''],
    ['Phone', ''],
    ['Email', ''],
    ['PromptPay Number', ''],
    ['Opening Time', '08:00'],
    ['Closing Time', '20:00'],
    ['Currency', 'THB'],
    ['Tax Rate (%)', 0],
    ['Service Charge (%)', 0],
    ['Order Number Mode', 'auto'], // auto หรือ manual
    ['Order Number Format', 'ORD-{YYYYMMDD}-{###}'], // รูปแบบเลข order อัตโนมัติ
    ['Order Number Counter', 1], // ตัวนับเลข order
    ['Default Payment Method', 'cash'], // cash, transfer, qr
    ['Enable QR Payment', 'yes'],
    ['Enable Cash Payment', 'yes'],
    ['Enable Transfer Payment', 'yes'],
    ['Theme', 'blue-gradient'], // Color theme: blue-gradient, purple-gradient, green-gradient, dark-gradient, sunset-gradient
    ['System Version', CONFIG.CURRENT_VERSION] // Version tracking for migrations
  ];

  sheet.getRange(1, 1, settings.length, 2).setValues(settings);
  sheet.getRange(1, 1, 1, 2)
    .setFontWeight('bold')
    .setBackground('#9333ea')
    .setFontColor('#ffffff');
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 250);
  sheet.setColumnWidth(2, 300);

  // ล็อคเซลล์ System Version ป้องกันผู้ใช้แก้ไข
  protectSystemVersion(ss.getId());
}

// ============================================
// AUTHENTICATION FUNCTIONS
// ============================================

/**
 * Login
 */
function login(email, password) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.MASTER_SHEET_ID);
    const sheet = ss.getSheetByName('MasterDB');

    if (!sheet) {
      return { success: false, message: 'Master Sheet not found' };
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return { success: false, message: 'No shops found' };
    }

    const headers = data[0];
    const emailIndex = headers.indexOf('Email');
    const passwordIndex = headers.indexOf('Password Hash');
    const statusIndex = headers.indexOf('Status');
    const endDateIndex = headers.indexOf('End Date');
    const sheetIdIndex = headers.indexOf('Sheet ID');
    const shopNameIndex = headers.indexOf('Shop Name');
    const shopIdIndex = headers.indexOf('Shop ID');
    const packageIndex = headers.indexOf('Package');
    const folderIdIndex = headers.indexOf('Folder ID');
    const receiptsIdIndex = headers.indexOf('Receipts Folder ID');

    const passwordHash = hashPassword(password);

    for (let i = 1; i < data.length; i++) {
      if (data[i][emailIndex] === email && data[i][passwordIndex] === passwordHash) {
        if (data[i][statusIndex] !== 'active') {
          return { success: false, message: 'Account is inactive' };
        }

        const endDate = new Date(data[i][endDateIndex]);
        const today = new Date();

        if (endDate < today) {
          return { success: false, message: 'License has expired' };
        }

        const daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

        // Check and run migrations if needed
        const migrationResult = checkAndMigrate(data[i][sheetIdIndex]);

        return {
          success: true,
          data: {
            shopId: data[i][shopIdIndex],
            shopName: data[i][shopNameIndex],
            email: data[i][emailIndex],
            sheetId: data[i][sheetIdIndex],
            folderId: data[i][folderIdIndex],
            receiptsFolderId: data[i][receiptsIdIndex],
            package: data[i][packageIndex],
            endDate: serializeDate(endDate),
            daysLeft: daysLeft,
            showWarning: daysLeft <= 30,
            migration: migrationResult // Include migration info
          }
        };
      }
    }

    return { success: false, message: 'Invalid email or password' };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

/**
 * Super Admin Login
 */
function superAdminLogin(password) {
  if (password === CONFIG.MASTER_PASSWORD) {
    return {
      success: true,
      data: {
        role: 'superadmin',
        masterSheetId: CONFIG.MASTER_SHEET_ID
      }
    };
  }
  return { success: false, message: 'Invalid password' };
}

/**
 * เช็คไลเซ่นส์
 */
function checkLicense(sheetId) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.MASTER_SHEET_ID);
    const sheet = ss.getSheetByName('MasterDB');

    if (!sheet) {
      return { success: false, message: 'Master Sheet not found' };
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const sheetIdIndex = headers.indexOf('Sheet ID');
    const endDateIndex = headers.indexOf('End Date');
    const packageIndex = headers.indexOf('Package');
    const shopNameIndex = headers.indexOf('Shop Name');
    const startDateIndex = headers.indexOf('Start Date');

    for (let i = 1; i < data.length; i++) {
      if (data[i][sheetIdIndex] === sheetId) {
        const endDate = new Date(data[i][endDateIndex]);
        const startDate = new Date(data[i][startDateIndex]);
        const today = new Date();
        const daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

        return {
          success: true,
          data: {
            shopName: data[i][shopNameIndex],
            package: data[i][packageIndex],
            startDate: serializeDate(startDate),
            endDate: serializeDate(endDate),
            daysLeft: daysLeft,
            isExpired: endDate < today,
            showWarning: daysLeft <= 30,
            price: data[i][packageIndex] === 'monthly' ? 99 : 999
          }
        };
      }
    }

    return { success: false, message: 'Shop not found' };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

/**
 * เปลี่ยนรหัสผ่าน
 */
function changePassword(email, oldPassword, newPassword) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.MASTER_SHEET_ID);
    const sheet = ss.getSheetByName('MasterDB');

    if (!sheet) {
      return { success: false, message: 'Master Sheet not found' };
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const emailIndex = headers.indexOf('Email');
    const passwordIndex = headers.indexOf('Password Hash');

    const oldPasswordHash = hashPassword(oldPassword);

    for (let i = 1; i < data.length; i++) {
      if (data[i][emailIndex] === email && data[i][passwordIndex] === oldPasswordHash) {
        const newPasswordHash = hashPassword(newPassword);
        sheet.getRange(i + 1, passwordIndex + 1).setValue(newPasswordHash);

        const updatedAtIndex = headers.indexOf('Updated At');
        if (updatedAtIndex !== -1) {
          sheet.getRange(i + 1, updatedAtIndex + 1).setValue(new Date());
        }

        return { success: true, message: 'Password changed successfully' };
      }
    }

    return { success: false, message: 'Invalid email or old password' };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

// ============================================
// SALES FUNCTIONS
// ============================================

/**
 * บันทึกการขาย
 */
function addSale(sheetId, saleData) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName('Sales');

    if (!sheet) {
      return { success: false, message: 'Sales sheet not found' };
    }

    const saleId = generateId('S');
    const now = new Date();
    const dateStr = Utilities.formatDate(now, CONFIG.TIMEZONE, 'yyyy-MM-dd');
    const timeStr = Utilities.formatDate(now, CONFIG.TIMEZONE, 'HH:mm:ss');

    // แปลง payment methods เป็น JSON string
    const paymentMethodsStr = JSON.stringify(saleData.paymentMethods || []);

    const row = [
      saleId,
      saleData.orderNumber || '',
      dateStr,
      timeStr,
      saleData.productId,
      saleData.productName,
      saleData.quantity,
      saleData.unitPrice,
      saleData.total,
      paymentMethodsStr,
      saleData.channel || '',
      saleData.note || '',
      now
    ];

    sheet.appendRow(row);

    _cutStockFromSales(sheetId, [saleData]);

    // Clear cache
    invalidateCache('sales_' + sheetId + '_' + dateStr);
    invalidateCache('inventory_' + sheetId);

    return { success: true, message: 'Sale recorded successfully', saleId: saleId };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

/**
 * บันทึกการขายแบบ Batch (หลายรายการพร้อมกัน) - เร็วกว่า 95%
 */
function addSalesBatch(sheetId, salesDataArray) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName('Sales');

    if (!sheet) {
      return { success: false, message: 'Sales sheet not found' };
    }

    const now = new Date();
    const dateStr = Utilities.formatDate(now, CONFIG.TIMEZONE, 'yyyy-MM-dd');
    const timeStr = Utilities.formatDate(now, CONFIG.TIMEZONE, 'HH:mm:ss');

    // Prepare all rows for batch insert
    const rows = salesDataArray.map(saleData => {
      const saleId = generateId('S');
      const paymentMethodsStr = JSON.stringify(saleData.paymentMethods || []);

      return [
        saleId,
        saleData.orderNumber || '',
        dateStr,
        timeStr,
        saleData.productId,
        saleData.productName,
        saleData.quantity,
        saleData.unitPrice,
        saleData.total,
        paymentMethodsStr,
        saleData.channel || '',
        saleData.note || '',
        now
      ];
    });

    // Batch insert - 1 operation instead of N operations
    if (rows.length > 0) {
      const startRow = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
    }

    _cutStockFromSales(sheetId, salesDataArray);
    // Clear cache once
    invalidateCache('sales_' + sheetId + '_' + dateStr);
    invalidateCache('inventory_' + sheetId);

    return {
      success: true,
      message: `${rows.length} sales recorded successfully`,
      count: rows.length
    };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

/**
 * ดึงยอดขายวันนี้ (With Cache)
 */
function getTodaySales(sheetId) {
  try {
    const today = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd');
    const cacheKey = 'sales_' + sheetId + '_' + today;

    return getCached(cacheKey, function() {
      const ss = SpreadsheetApp.openById(sheetId);
      const sheet = ss.getSheetByName('Sales');

      if (!sheet) {
        return { success: false, message: 'Sales sheet not found' };
      }

      const data = sheet.getDataRange().getValues();
      if (data.length <= 1) {
        return { success: true, data: [] };
      }

      const headers = data[0];

      const sales = data.slice(1).filter(row => {
        const rowDate = row[2]; // Date column
        if (!rowDate) return false;
        return Utilities.formatDate(new Date(rowDate), CONFIG.TIMEZONE, 'yyyy-MM-dd') === today;
      }).map(row => {
        let sale = {};
        headers.forEach((header, index) => {
          sale[header] = row[index];
        });
        return sale;
      });

      return { success: true, data: serializeObject(sales) };
    });
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

/**
 * ดึงยอดขายตามช่วงวันที่
 */
function getSalesByDateRange(sheetId, startDate, endDate) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName('Sales');

    if (!sheet) {
      return { success: false, message: 'Sales sheet not found' };
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return { success: true, data: [] };
    }

    const headers = data[0];
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const sales = data.slice(1).filter(row => {
      const rowDate = row[2];
      if (!rowDate) return false;
      const saleDate = new Date(rowDate);
      return saleDate >= start && saleDate <= end;
    }).map(row => {
      let sale = {};
      headers.forEach((header, index) => {
        sale[header] = row[index];
      });
      return sale;
    });

    return { success: true, data: serializeObject(sales) };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

/**
 * ดึงยอดขายแบบ Lazy Loading (Pagination) - เร็วกว่า 60%
 * @param {string} sheetId - Sheet ID
 * @param {number} page - หมายเลขหน้า (เริ่มจาก 1)
 * @param {number} pageSize - จำนวนรายการต่อหน้า (default: 50)
 * @param {string} date - วันที่ต้องการ (optional, format: yyyy-MM-dd)
 */
function getSalesWithPagination(sheetId, page, pageSize, date) {
  try {
    page = page || 1;
    pageSize = pageSize || 50;

    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName('Sales');

    if (!sheet) {
      return { success: false, message: 'Sales sheet not found' };
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return {
        success: true,
        data: [],
        pagination: {
          page: page,
          pageSize: pageSize,
          totalRows: 0,
          totalPages: 0
        }
      };
    }

    const headers = data[0];
    let salesData = data.slice(1);

    // Filter by date if specified
    if (date) {
      salesData = salesData.filter(row => {
        const rowDate = row[2];
        if (!rowDate) return false;
        return Utilities.formatDate(new Date(rowDate), CONFIG.TIMEZONE, 'yyyy-MM-dd') === date;
      });
    }

    const totalRows = salesData.length;
    const totalPages = Math.ceil(totalRows / pageSize);
    const startIndex = (page - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalRows);

    // Get only the requested page
    const paginatedData = salesData.slice(startIndex, endIndex).map(row => {
      let sale = {};
      headers.forEach((header, index) => {
        sale[header] = row[index];
      });
      return sale;
    });

    return {
      success: true,
      data: serializeObject(paginatedData),
      pagination: {
        page: page,
        pageSize: pageSize,
        totalRows: totalRows,
        totalPages: totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

/**
 * ลบรายการขาย
 */
function deleteSale(sheetId, saleId) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName('Sales');

    if (!sheet) {
      return { success: false, message: 'Sales sheet not found' };
    }

    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === saleId) {
        // Get date before delete for cache invalidation
        const saleDate = data[i][2]; // Date column
        const dateStr = Utilities.formatDate(new Date(saleDate), CONFIG.TIMEZONE, 'yyyy-MM-dd');

        sheet.deleteRow(i + 1);

        // Clear cache
        invalidateCache('sales_' + sheetId + '_' + dateStr);

        return { success: true, message: 'Sale deleted successfully' };
      }
    }

    return { success: false, message: 'Sale not found' };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

/**
 * สร้างหมายเลข Order อัตโนมัติ
 */
function generateOrderNumber(sheetId) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const settingsSheet = ss.getSheetByName('Settings');

    if (!settingsSheet) {
      return { success: false, message: 'Settings sheet not found' };
    }

    const data = settingsSheet.getDataRange().getValues();
    let format = 'ORD-{YYYYMMDD}-{###}';
    let counter = 1;
    let counterRow = -1;

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === 'Order Number Format') {
        format = data[i][1];
      }
      if (data[i][0] === 'Order Number Counter') {
        counter = data[i][1];
        counterRow = i + 1;
      }
    }

    const now = new Date();
    const yyyy = Utilities.formatDate(now, CONFIG.TIMEZONE, 'yyyy');
    const mm = Utilities.formatDate(now, CONFIG.TIMEZONE, 'MM');
    const dd = Utilities.formatDate(now, CONFIG.TIMEZONE, 'dd');
    const yyyymmdd = yyyy + mm + dd;

    let orderNumber = format;
    orderNumber = orderNumber.replace('{YYYY}', yyyy);
    orderNumber = orderNumber.replace('{MM}', mm);
    orderNumber = orderNumber.replace('{DD}', dd);
    orderNumber = orderNumber.replace('{YYYYMMDD}', yyyymmdd);

    // แทนที่ {###} หรือ {##} ด้วยตัวเลข
    const counterMatch = orderNumber.match(/\{(#+)\}/);
    if (counterMatch) {
      const digits = counterMatch[1].length;
      const paddedCounter = String(counter).padStart(digits, '0');
      orderNumber = orderNumber.replace(counterMatch[0], paddedCounter);
    }

    // เพิ่ม counter
    if (counterRow !== -1) {
      settingsSheet.getRange(counterRow, 2).setValue(counter + 1);
    }

    return { success: true, orderNumber: orderNumber };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

/**
 * เช็คว่าหมายเลข Order ซ้ำหรือไม่
 */
function checkOrderNumberExists(sheetId, orderNumber) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName('Sales');

    if (!sheet) {
      return { success: false, message: 'Sales sheet not found' };
    }

    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === orderNumber) { // Order Number column
        return { success: true, exists: true };
      }
    }

    return { success: true, exists: false };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

// ============================================
// PRODUCTS FUNCTIONS
// ============================================

/**
 * ดึงรายการสินค้าทั้งหมด (With Cache)
 */
function getProducts(sheetId) {
  try {
    const cacheKey = 'products_' + sheetId;

    return getCached(cacheKey, function() {
      const ss = SpreadsheetApp.openById(sheetId);
      const sheet = ss.getSheetByName('Products');

      if (!sheet) {
        return { success: false, message: 'Products sheet not found' };
      }

      const data = sheet.getDataRange().getValues();
      if (data.length <= 1) {
        return { success: true, data: [] };
      }

      const headers = data[0];

      const products = data.slice(1).map(row => {
        let product = {};
        headers.forEach((header, index) => {
          product[header] = row[index];
        });
        return product;
      });

      return { success: true, data: serializeObject(products) };
    });
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

/**
 * เพิ่มสินค้า
 */
function addProduct(sheetId, productData) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName('Products');

    if (!sheet) {
      return { success: false, message: 'Products sheet not found' };
    }

    const productId = generateId('P');
    const now = new Date();

    const row = [
      productId,
      productData.name,
      productData.category || '',
      productData.price,
      productData.cost || 0,
      productData.imageUrl || '',
      'active',
      now,
      now
    ];

    sheet.appendRow(row);

    // Clear cache
    invalidateCache('products_' + sheetId);

    // Refresh Named Range (auto)
    refreshNamedRange(ss, 'Products', 'ProductsData');

    return { success: true, message: 'Product added successfully', productId: productId };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

/**
 * อัพเดทสินค้า
 */
function updateProduct(sheetId, productId, updateData) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName('Products');

    if (!sheet) {
      return { success: false, message: 'Products sheet not found' };
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === productId) {
        Object.keys(updateData).forEach(key => {
          const colIndex = headers.indexOf(key);
          if (colIndex !== -1) {
            sheet.getRange(i + 1, colIndex + 1).setValue(updateData[key]);
          }
        });

        const updatedAtIndex = headers.indexOf('Updated At');
        if (updatedAtIndex !== -1) {
          sheet.getRange(i + 1, updatedAtIndex + 1).setValue(new Date());
        }

        // Clear cache
        invalidateCache('products_' + sheetId);

        return { success: true, message: 'Product updated successfully' };
      }
    }

    return { success: false, message: 'Product not found' };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

/**
 * ลบสินค้า
 */
function deleteProduct(sheetId, productId) {
  const result = updateProduct(sheetId, productId, { Status: 'inactive' });
  invalidateCache('products_' + sheetId);

  // Note: Status='inactive' ไม่ลบแถว ไม่ต้อง refresh Named Range
  // ถ้าต้องการ hard delete ให้ใช้ deleteRow แล้ว refresh

  return result;
}

// ============================================
// MATERIALS FUNCTIONS
// ============================================

/**
 * ดึงรายการ Materials ทั้งหมด (With Cache)
 */
function getMaterials(sheetId) {
  try {
    const cacheKey = 'materials_' + sheetId;

    return getCached(cacheKey, function() {
      const ss = SpreadsheetApp.openById(sheetId);
      const sheet = ss.getSheetByName('Materials');

      if (!sheet) {
        return { success: false, message: 'Materials sheet not found' };
      }

      const data = sheet.getDataRange().getValues();
      if (data.length <= 1) {
        return { success: true, data: [] };
      }

      const headers = data[0];
      const materials = data.slice(1).map(row => {
        let material = {};
        headers.forEach((header, index) => {
          material[header] = row[index];
        });
        return material;
      });

      return { success: true, data: serializeObject(materials) };
    });
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

function addMaterial(sheetId, materialData) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName('Materials');

    if (!sheet) {
      return { success: false, message: 'Materials sheet not found' };
    }

    const materialId = generateId('M');

    const row = [
      materialId,
      materialData.name,
      materialData.unit,
      materialData.pricePerUnit,
      materialData.supplier || '',
      new Date()
    ];

    sheet.appendRow(row);

    // Clear cache
    invalidateCache('materials_' + sheetId);

    // Refresh Named Range (auto)
    refreshNamedRange(ss, 'Materials', 'MaterialsData');

    return { success: true, message: 'Material added successfully', materialId: materialId };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

function updateMaterial(sheetId, materialId, updateData) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName('Materials');

    if (!sheet) {
      return { success: false, message: 'Materials sheet not found' };
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === materialId) {
        Object.keys(updateData).forEach(key => {
          const colIndex = headers.indexOf(key);
          if (colIndex !== -1) {
            sheet.getRange(i + 1, colIndex + 1).setValue(updateData[key]);
          }
        });

        const updatedAtIndex = headers.indexOf('Updated At');
        if (updatedAtIndex !== -1) {
          sheet.getRange(i + 1, updatedAtIndex + 1).setValue(new Date());
        }

        // Clear cache
        invalidateCache('materials_' + sheetId);

        return { success: true, message: 'Material updated successfully' };
      }
    }

    return { success: false, message: 'Material not found' };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

function deleteMaterial(sheetId, materialId) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName('Materials');

    if (!sheet) {
      return { success: false, message: 'Materials sheet not found' };
    }

    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === materialId) {
        sheet.deleteRow(i + 1);

        // Clear cache
        invalidateCache('materials_' + sheetId);

        // Refresh Named Range (auto)
        refreshNamedRange(ss, 'Materials', 'MaterialsData');

        return { success: true, message: 'Material deleted successfully' };
      }
    }

    return { success: false, message: 'Material not found' };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

// ============================================
// RECIPES FUNCTIONS
// ============================================

/**
 * ดึงรายการ Recipes ทั้งหมด (With Cache)
 */
function getRecipes(sheetId) {
  try {
    const cacheKey = 'recipes_' + sheetId;

    return getCached(cacheKey, function() {
      const ss = SpreadsheetApp.openById(sheetId);
      const sheet = ss.getSheetByName('Recipes');

      if (!sheet) {
        return { success: false, message: 'Recipes sheet not found' };
      }

      const data = sheet.getDataRange().getValues();
      if (data.length <= 1) {
        return { success: true, data: [] };
      }

      const headers = data[0];
      const recipes = data.slice(1).map(row => {
        let recipe = {};
        headers.forEach((header, index) => {
          recipe[header] = row[index];
        });
        return recipe;
      });

      return { success: true, data: serializeObject(recipes) };
    });
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

function addRecipe(sheetId, recipeData) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName('Recipes');

    if (!sheet) {
      return { success: false, message: 'Recipes sheet not found' };
    }

    const recipeId = generateId('R');

    const row = [
      recipeId,
      recipeData.productId,
      recipeData.productName,
      recipeData.materialId,
      recipeData.materialName,
      recipeData.quantity,
      recipeData.unit,
      new Date()
    ];

    sheet.appendRow(row);

    // Clear cache
    invalidateCache('recipes_' + sheetId);

    // Refresh Named Range (auto)
    refreshNamedRange(ss, 'Recipes', 'RecipesData');

    return { success: true, message: 'Recipe added successfully', recipeId: recipeId };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

function deleteRecipe(sheetId, recipeId) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName('Recipes');

    if (!sheet) {
      return { success: false, message: 'Recipes sheet not found' };
    }

    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === recipeId) {
        sheet.deleteRow(i + 1);

        // Clear cache
        invalidateCache('recipes_' + sheetId);

        // Refresh Named Range (auto)
        refreshNamedRange(ss, 'Recipes', 'RecipesData');

        return { success: true, message: 'Recipe deleted successfully' };
      }
    }

    return { success: false, message: 'Recipe not found' };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

function calculateProductCost(sheetId, productId) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const recipesSheet = ss.getSheetByName('Recipes');
    const materialsSheet = ss.getSheetByName('Materials');

    if (!recipesSheet || !materialsSheet) {
      return { success: false, message: 'Required sheets not found' };
    }

    const recipesData = recipesSheet.getDataRange().getValues();
    const recipesHeaders = recipesData[0];

    const productRecipes = recipesData.slice(1).filter(row =>
      row[recipesHeaders.indexOf('Product ID')] === productId
    );

    const materialsData = materialsSheet.getDataRange().getValues();
    const materialsHeaders = materialsData[0];

    let totalCost = 0;
    const costBreakdown = [];

    productRecipes.forEach(recipe => {
      const materialId = recipe[recipesHeaders.indexOf('Material ID')];
      const quantity = recipe[recipesHeaders.indexOf('Quantity')];

      const material = materialsData.slice(1).find(row =>
        row[materialsHeaders.indexOf('Material ID')] === materialId
      );

      if (material) {
        const pricePerUnit = material[materialsHeaders.indexOf('Price Per Unit')];
        const cost = quantity * pricePerUnit;
        totalCost += cost;

        costBreakdown.push({
          materialName: recipe[recipesHeaders.indexOf('Material Name')],
          quantity: quantity,
          unit: recipe[recipesHeaders.indexOf('Unit')],
          pricePerUnit: pricePerUnit,
          cost: cost
        });
      }
    });

    return {
      success: true,
      data: {
        totalCost: totalCost,
        breakdown: costBreakdown
      }
    };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}


/**
 * [ใหม่] อัปเดตชื่อหมวดหมู่ในชีต Products
 */
function updateCategoryName(sheetId, oldName, newName) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName('Products');
    if (!sheet) return { success: false, message: 'Products sheet not found' };

    const range = sheet.getDataRange();
    const values = range.getValues();
    const headers = values[0];
    const categoryIndex = headers.indexOf('Category');
    const updatedIndex = headers.indexOf('Updated At');

    if (categoryIndex === -1) {
      return { success: false, message: 'Category column not found' };
    }

    let updatedCount = 0;
    const now = new Date();

    // วน Loop ใน Array (เร็วกว่า)
    for (let i = 1; i < values.length; i++) {
      if (values[i][categoryIndex] === oldName) {
        values[i][categoryIndex] = newName; // เปลี่ยนชื่อ
        if (updatedIndex !== -1) {
          values[i][updatedIndex] = now; // อัปเดตเวลา
        }
        updatedCount++;
      }
    }

    // เขียนข้อมูลกลับลงชีตทีเดียว
    if (updatedCount > 0) {
      range.setValues(values);
      invalidateCache('products_' + sheetId); // ลบ Cache
    }

    return { 
      success: true, 
      message: `Updated ${updatedCount} products.`,
      updatedCount: updatedCount
    };
  } catch (error) {
    Logger.log('Error updating category name: ' + error);
    return { success: false, message: error.toString() };
  }
}

/**
 * [ใหม่] ลบชื่อหมวดหมู่ในชีต Products (ตั้งค่าเป็นว่าง)
 */
function deleteCategory(sheetId, categoryName) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName('Products');
    if (!sheet) return { success: false, message: 'Products sheet not found' };

    const range = sheet.getDataRange();
    const values = range.getValues();
    const headers = values[0];
    const categoryIndex = headers.indexOf('Category');
    const updatedIndex = headers.indexOf('Updated At');

    if (categoryIndex === -1) {
      return { success: false, message: 'Category column not found' };
    }

    let updatedCount = 0;
    const now = new Date();

    // วน Loop ใน Array
    for (let i = 1; i < values.length; i++) {
      if (values[i][categoryIndex] === categoryName) {
        values[i][categoryIndex] = ''; // ตั้งค่าเป็นค่าว่าง
        if (updatedIndex !== -1) {
          values[i][updatedIndex] = now;
        }
        updatedCount++;
      }
    }

    // เขียนข้อมูลกลับลงชีต
    if (updatedCount > 0) {
      range.setValues(values);
      invalidateCache('products_' + sheetId); // ลบ Cache
    }

    return { 
      success: true, 
      message: `Removed category from ${updatedCount} products.`,
      updatedCount: updatedCount
    };
  } catch (error) {
    Logger.log('Error deleting category: ' + error);
    return { success: false, message: error.toString() };
  }
}

/**
 * [ใหม่] คำนวณต้นทุนสินค้าทั้งหมดจากสูตร
 * และอัปเดตชีต Products
 */
function recalculateAllProductCosts(sheetId) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const productsSheet = ss.getSheetByName('Products');
    const recipesSheet = ss.getSheetByName('Recipes');
    const materialsSheet = ss.getSheetByName('Materials');

    if (!productsSheet || !recipesSheet || !materialsSheet) {
      return { success: false, message: 'ไม่พบชีต Products, Recipes หรือ Materials' };
    }

    // 1. โหลดข้อมูลวัตถุดิบ (Materials) มาสร้าง Map ราคา
    const materialsData = materialsSheet.getDataRange().getValues();
    const materialsHeaders = materialsData[0];
    const materialPriceIndex = materialsHeaders.indexOf('Price Per Unit');
    const materialIdIndex = materialsHeaders.indexOf('Material ID');
    
    const materialPriceMap = {}; // { 'M001': 1.5, 'M002': 0.08 }
    materialsData.slice(1).forEach(row => {
      materialPriceMap[row[materialIdIndex]] = parseFloat(row[materialPriceIndex]) || 0;
    });

    // 2. โหลดข้อมูลสูตร (Recipes) มาสร้าง Map สูตร
    const recipesData = recipesSheet.getDataRange().getValues();
    const recipesHeaders = recipesData[0];
    const recipeProductIdIndex = recipesHeaders.indexOf('Product ID');
    const recipeMaterialIdIndex = recipesHeaders.indexOf('Material ID');
    const recipeQtyIndex = recipesHeaders.indexOf('Quantity');

    const recipeCostMap = {}; // { 'P001': 27.00, 'P002': 30.50 }
    
    recipesData.slice(1).forEach(row => {
      const productId = row[recipeProductIdIndex];
      const materialId = row[recipeMaterialIdIndex];
      const quantity = parseFloat(row[recipeQtyIndex]) || 0;
      
      const materialPrice = materialPriceMap[materialId] || 0;
      const itemCost = quantity * materialPrice;
      
      if (!recipeCostMap[productId]) {
        recipeCostMap[productId] = 0;
      }
      recipeCostMap[productId] += itemCost;
    });

    // 3. โหลดข้อมูลสินค้า (Products) เพื่อทำการอัปเดต
    const productsRange = productsSheet.getDataRange();
    const productsData = productsRange.getValues();
    const productsHeaders = productsData[0];
    const productCostIndex = productsHeaders.indexOf('Cost');
    const productIdIndex = productsHeaders.indexOf('Product ID');
    
    let updatedCount = 0;

    // วน Loop อัปเดตต้นทุนใน Array (ยังไม่เขียนลงชีต)
    for (let i = 1; i < productsData.length; i++) {
      const productId = productsData[i][productIdIndex];
      
      // ถ้าสินค้านี้มีต้นทุนที่คำนวณได้จากสูตร
      if (recipeCostMap[productId] !== undefined) {
        const newCost = recipeCostMap[productId];
        // อัปเดตต้นทุนใน Array
        productsData[i][productCostIndex] = newCost;
        updatedCount++;
      }
    }

    // 4. เขียนข้อมูลที่อัปเดตแล้วกลับลงชีต "ทีเดียวทั้งหมด" (เร็วมาก)
    if (updatedCount > 0) {
      productsRange.setValues(productsData);
      
      // ลบ Cache ที่เกี่ยวข้อง
      invalidateCache('products_' + sheetId);
      invalidateCache('recipes_' + sheetId); // เผื่อมีการอ้างอิง
    }

    return { 
      success: true, 
      message: `อัปเดตต้นทุน ${updatedCount} รายการสำเร็จ`,
      updatedCount: updatedCount 
    };

  } catch (error) {
    Logger.log('Error recalculating costs: ' + error);
    return { success: false, message: error.toString() };
  }
}


// ============================================
// COSTS FUNCTIONS
// ============================================

function addDailyCost(sheetId, costData) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName('DailyCosts');

    if (!sheet) {
      return { success: false, message: 'DailyCosts sheet not found' };
    }

    const costId = generateId('DC');

    const row = [
      costId,
      costData.date,
      costData.description,
      costData.amount,
      costData.category || '',
      new Date()
    ];

    sheet.appendRow(row);

    // Clear cache
    invalidateCache('dailycosts_' + sheetId + '_' + costData.date);

    return { success: true, message: 'Daily cost added successfully', costId: costId };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

/**
 * ดึง Daily Costs ตามวันที่ (With Cache)
 */
function getDailyCosts(sheetId, date) {
  try {
    const cacheKey = 'dailycosts_' + sheetId + '_' + date;

    return getCached(cacheKey, function() {
      const ss = SpreadsheetApp.openById(sheetId);
      const sheet = ss.getSheetByName('DailyCosts');

      if (!sheet) {
        return { success: false, message: 'DailyCosts sheet not found' };
      }

      const data = sheet.getDataRange().getValues();
      if (data.length <= 1) {
        return { success: true, data: [] };
      }

      const headers = data[0];
      const dateIndex = headers.indexOf('Date');

      const costs = data.slice(1).filter(row => {
        const rowDate = Utilities.formatDate(new Date(row[dateIndex]), CONFIG.TIMEZONE, 'yyyy-MM-dd');
        return rowDate === date;
      }).map(row => {
        let cost = {};
        headers.forEach((header, index) => {
          cost[header] = row[index];
        });
        return cost;
      });

      return { success: true, data: serializeObject(costs) };
    });
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

function addMonthlyCost(sheetId, costData) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName('MonthlyCosts');

    if (!sheet) {
      return { success: false, message: 'MonthlyCosts sheet not found' };
    }

    const costId = generateId('MC');
    const now = new Date();

    const row = [
      costId,
      costData.month,
      costData.description,
      costData.amount,
      costData.category || '',
      now,
      now
    ];

    sheet.appendRow(row);

    // Clear cache
    invalidateCache('monthlycosts_' + sheetId + '_' + costData.month);

    return { success: true, message: 'Monthly cost added successfully', costId: costId };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

/**
 * ดึง Monthly Costs ตามเดือน (With Cache)
 */
function getMonthlyCosts(sheetId, month) {
  try {
    const cacheKey = 'monthlycosts_' + sheetId + '_' + month;

    return getCached(cacheKey, function() {
      const ss = SpreadsheetApp.openById(sheetId);
      const sheet = ss.getSheetByName('MonthlyCosts');

      if (!sheet) {
        return { success: false, message: 'MonthlyCosts sheet not found' };
      }

      const data = sheet.getDataRange().getValues();
      if (data.length <= 1) {
        return { success: true, data: [] };
      }

      const headers = data[0];
      const monthIndex = headers.indexOf('Month');

      const costs = data.slice(1).filter(row => row[monthIndex] === month).map(row => {
        let cost = {};
        headers.forEach((header, index) => {
          cost[header] = row[index];
        });
        return cost;
      });

      return { success: true, data: serializeObject(costs) };
    });
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

function deleteCost(sheetId, sheetName, costId) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return { success: false, message: 'Sheet not found' };
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === costId) {
        // Get date/month before delete for cache invalidation
        let cacheKey = '';
        if (sheetName === 'DailyCosts') {
          const dateIndex = headers.indexOf('Date');
          const date = Utilities.formatDate(new Date(data[i][dateIndex]), CONFIG.TIMEZONE, 'yyyy-MM-dd');
          cacheKey = 'dailycosts_' + sheetId + '_' + date;
        } else if (sheetName === 'MonthlyCosts') {
          const monthIndex = headers.indexOf('Month');
          const month = data[i][monthIndex];
          cacheKey = 'monthlycosts_' + sheetId + '_' + month;
        }

        sheet.deleteRow(i + 1);

        // Clear cache
        if (cacheKey) {
          invalidateCache(cacheKey);
        }

        return { success: true, message: 'Cost deleted successfully' };
      }
    }

    return { success: false, message: 'Cost not found' };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

// ============================================
// DASHBOARD & REPORTS FUNCTIONS
// ============================================

function getDashboardData(sheetId, date) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);

    const salesResult = getTodaySales(sheetId);
    const sales = salesResult.success ? salesResult.data : [];

    const totalRevenue = sales.reduce((sum, sale) => sum + (sale.Total || 0), 0);
    const totalQuantity = sales.reduce((sum, sale) => sum + (sale.Quantity || 0), 0);

    const dailyCostsResult = getDailyCosts(sheetId, date);
    const dailyCosts = dailyCostsResult.success ? dailyCostsResult.data : [];
    const totalDailyCosts = dailyCosts.reduce((sum, cost) => sum + (cost.Amount || 0), 0);

    const month = date.substring(0, 7);
    const monthlyCostsResult = getMonthlyCosts(sheetId, month);
    const monthlyCosts = monthlyCostsResult.success ? monthlyCostsResult.data : [];
    const totalMonthlyCosts = monthlyCosts.reduce((sum, cost) => sum + (cost.Amount || 0), 0);

    const dailyAllocatedMonthlyCost = totalMonthlyCosts / 30;

    let materialCost = 0;
    sales.forEach(sale => {
      const costResult = calculateProductCost(sheetId, sale['Product ID']);
      if (costResult.success) {
        materialCost += costResult.data.totalCost * sale.Quantity;
      }
    });

    const totalCost = materialCost + totalDailyCosts + dailyAllocatedMonthlyCost;
    const profit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

    const productSales = {};
    sales.forEach(sale => {
      const productName = sale['Product Name'];
      if (!productSales[productName]) {
        productSales[productName] = { quantity: 0, revenue: 0 };
      }
      productSales[productName].quantity += sale.Quantity;
      productSales[productName].revenue += sale.Total;
    });

    const topProducts = Object.entries(productSales)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    return {
      success: true,
      data: {
        revenue: totalRevenue,
        totalQuantity: totalQuantity,
        materialCost: materialCost,
        dailyCost: totalDailyCosts,
        monthlyCostPerDay: dailyAllocatedMonthlyCost,
        totalCost: totalCost,
        profit: profit,
        profitMargin: profitMargin,
        salesCount: sales.length,
        topProducts: topProducts
      }
    };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

function getLast7DaysSales(sheetId) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName('Sales');

    if (!sheet) {
      return { success: false, message: 'Sales sheet not found' };
    }

    const data = sheet.getDataRange().getValues();
    const today = new Date();
    const last7Days = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = Utilities.formatDate(date, CONFIG.TIMEZONE, 'yyyy-MM-dd');

      const daySales = data.slice(1).filter(row => {
        if (!row[2]) return false;
        return Utilities.formatDate(new Date(row[2]), CONFIG.TIMEZONE, 'yyyy-MM-dd') === dateStr;
      });

      const revenue = daySales.reduce((sum, row) => sum + (row[8] || 0), 0);

      last7Days.push({
        date: dateStr,
        revenue: revenue,
        quantity: daySales.reduce((sum, row) => sum + (row[6] || 0), 0)
      });
    }

    return { success: true, data: last7Days };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

// ============================================
// SETTINGS FUNCTIONS
// ============================================



/**
 * ดึง Settings (With Cache)
 * [V2 - เพิ่ม Log]
 */
function getSettings(sheetId) {
  try {
    const cacheKey = 'settings_' + sheetId;
    Logger.log(`[getSettings] (1/3) Function called for Sheet ID: ${sheetId}`);

    // กลับมาใช้ getCached V2 (ที่แก้ไขแล้ว)
    return getCached(cacheKey, function() {
      // ส่วนนี้จะทำงาน "เฉพาะ" เมื่อ Cache ไม่มี หรือ Cache เสีย
      Logger.log(`[getSettings] (2/3) [Fetch Function] Running database query...`);
      
      const ss = SpreadsheetApp.openById(sheetId);
      const sheet = ss.getSheetByName('Settings');
      if (!sheet) {
        Logger.log("[getSettings] (X) [Fetch Function] Settings sheet not found!");
        return { success: false, message: 'Settings sheet not found' };
      }
      
      const data = sheet.getDataRange().getValues();
      const settings = {};
      data.slice(1).forEach(row => {
        settings[row[0]] = row[1];
      });

      Logger.log(`[getSettings] (3/3) [Fetch Function] Success. PromptPay read: ${settings['PromptPay Number']}`);
      
      // **สำคัญ:** เรา "ไม่ต้อง" serializeObject ที่นี่
      // เพราะ data ที่มาจากชีต Settings โดยตรง (V2) ไม่มี Date Object
      // (V1 ที่มี serializeObject คือตัวที่ทำให้ Cache เสียครับ)
      return { success: true, data: settings }; 
    });
    
  } catch (error) {
     Logger.log(`[getSettings] (X) CRITICAL ERROR: ${error.message}`);
    return { success: false, message: error.toString() };
  }
}


function updateSettings(sheetId, settingsData) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName('Settings');

    if (!sheet) {
      return { success: false, message: 'Settings sheet not found' };
    }

    const data = sheet.getDataRange().getValues();

    // (ประมาณบรรทัด 1746)
    Object.keys(settingsData).forEach(key => {
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === key) {
          
          // 🔽🔽🔽 [เพิ่มโค้ดตรงนี้] 🔽🔽🔽
          // บังคับให้ PromptPay Number บันทึกเป็น Text โดยการเติม ' (single quote) นำหน้า
          if (key === 'PromptPay Number') {
            sheet.getRange(i + 1, 2).setValue("'" + settingsData[key]); 
          } else {
            sheet.getRange(i + 1, 2).setValue(settingsData[key]);
          }
          // 🔼🔼🔼 [สิ้นสุดโค้ดที่เพิ่ม] 🔼🔼🔼

          break;
        }
      }
    });

    // Clear cache
    invalidateCache('settings_' + sheetId);

    return { success: true, message: 'Settings updated successfully' };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

// ============================================
// OPTIONS & COMBOS SYSTEM - Backend Functions
// ============================================

// ============================================
// 📦 1. SHEET CREATION & INITIALIZATION
// ============================================

/**
 * สร้าง Sheets ทั้งหมดสำหรับระบบ Options & Combos ถ้ายังไม่มี
 * @param {string} sheetId - ID ของ Google Spreadsheet
 * @return {Object} - { success: boolean, message: string }
 */
function createOptionSheetsIfNeeded(sheetId) {
  try {
    var ss = SpreadsheetApp.openById(sheetId);
    var sheetsCreated = [];

    // 1. OptionGroups Sheet
    var optionGroupsSheet = ss.getSheetByName('OptionGroups');
    if (!optionGroupsSheet) {
      optionGroupsSheet = ss.insertSheet('OptionGroups');
      initializeOptionGroups(optionGroupsSheet);
      sheetsCreated.push('OptionGroups');
    }

    // 2. Options Sheet
    var optionsSheet = ss.getSheetByName('Options');
    if (!optionsSheet) {
      optionsSheet = ss.insertSheet('Options');
      initializeOptions(optionsSheet);
      sheetsCreated.push('Options');
    }

    // 3. ProductOptions Sheet
    var productOptionsSheet = ss.getSheetByName('ProductOptions');
    if (!productOptionsSheet) {
      productOptionsSheet = ss.insertSheet('ProductOptions');
      initializeProductOptions(productOptionsSheet);
      sheetsCreated.push('ProductOptions');
    }

    // 4. Combos Sheet
    var combosSheet = ss.getSheetByName('Combos');
    if (!combosSheet) {
      combosSheet = ss.insertSheet('Combos');
      initializeCombos(combosSheet);
      sheetsCreated.push('Combos');
    }

    // 5. ComboItems Sheet
    var comboItemsSheet = ss.getSheetByName('ComboItems');
    if (!comboItemsSheet) {
      comboItemsSheet = ss.insertSheet('ComboItems');
      initializeComboItems(comboItemsSheet);
      sheetsCreated.push('ComboItems');
    }

    // 6. SpecialNotes Sheet
    var specialNotesSheet = ss.getSheetByName('SpecialNotes');
    if (!specialNotesSheet) {
      specialNotesSheet = ss.insertSheet('SpecialNotes');
      initializeSpecialNotes(specialNotesSheet);
      sheetsCreated.push('SpecialNotes');
    }

    var message = sheetsCreated.length > 0
      ? 'Created sheets: ' + sheetsCreated.join(', ')
      : 'All option sheets already exist';

    return { success: true, message: message, sheetsCreated: sheetsCreated };
  } catch (error) {
    Logger.log('Error creating option sheets: ' + error);
    return { success: false, message: error.toString() };
  }
}

/**
 * สร้างและกำหนดค่าเริ่มต้นสำหรับ OptionGroups Sheet
 * @param {Sheet} sheet - Google Sheets object
 */
function initializeOptionGroups(sheet) {
  try {
    // Header
    var headers = [
      'Option Group ID',
      'Group Name',
      'Selection Type',
      'Required',
      'Display Order',
      'Status',
      'Created Date',
      'Updated Date'
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#4CAF50').setFontColor('#FFFFFF');

    // Demo data
    var demoData = [
      ['OG001', 'ชนิด', 'single', 'Yes', 1, 'active', new Date(), new Date()],
      ['OG002', 'ความหวาน', 'single', 'Yes', 2, 'active', new Date(), new Date()],
      ['OG003', 'ขนาดแก้ว', 'single', 'No', 3, 'active', new Date(), new Date()],
      ['OG004', 'ท๊อปปิ้ง', 'multiple', 'No', 4, 'active', new Date(), new Date()],
      ['OG005', 'เพิ่มช๊อต', 'single', 'No', 5, 'active', new Date(), new Date()]
    ];
    sheet.getRange(2, 1, demoData.length, headers.length).setValues(demoData);

    // Format columns
    sheet.setColumnWidth(1, 150); // Option Group ID
    sheet.setColumnWidth(2, 200); // Group Name
    sheet.setColumnWidth(3, 120); // Selection Type
    sheet.setColumnWidth(4, 100); // Required
    sheet.setColumnWidth(5, 120); // Display Order
    sheet.setColumnWidth(6, 100); // Status
    sheet.setColumnWidth(7, 150); // Created Date
    sheet.setColumnWidth(8, 150); // Updated Date

    sheet.setFrozenRows(1);

    Logger.log('OptionGroups sheet initialized successfully');
  } catch (error) {
    Logger.log('Error initializing OptionGroups sheet: ' + error);
    throw error;
  }
}

/**
 * สร้างและกำหนดค่าเริ่มต้นสำหรับ Options Sheet
 * @param {Sheet} sheet - Google Sheets object
 */
function initializeOptions(sheet) {
  try {
    // Header
    var headers = [
      'Option ID',
      'Option Group ID',
      'Option Name',
      'Price Modifier',
      'Is Default',
      'Display Order',
      'Status',
      'Created Date',
      'Updated Date'
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#2196F3').setFontColor('#FFFFFF');

    // Demo data
    var demoData = [
      // ชนิด (OG001)
      ['OPT001', 'OG001', 'ร้อน', 0, 'Yes', 1, 'active', new Date(), new Date()],
      ['OPT002', 'OG001', 'เย็น', 0, 'No', 2, 'active', new Date(), new Date()],
      ['OPT003', 'OG001', 'ปั่น', 10, 'No', 3, 'active', new Date(), new Date()],

      // ความหวาน (OG002)
      ['OPT004', 'OG002', 'หวานน้อย', 0, 'No', 1, 'active', new Date(), new Date()],
      ['OPT005', 'OG002', 'หวานปานกลาง', 0, 'Yes', 2, 'active', new Date(), new Date()],
      ['OPT006', 'OG002', 'หวานมาก', 0, 'No', 3, 'active', new Date(), new Date()],
      ['OPT007', 'OG002', 'ไม่หวาน', 0, 'No', 4, 'active', new Date(), new Date()],

      // ขนาดแก้ว (OG003)
      ['OPT008', 'OG003', 'แก้วเล็ก (12oz)', 0, 'Yes', 1, 'active', new Date(), new Date()],
      ['OPT009', 'OG003', 'แก้วกลาง (16oz)', 10, 'No', 2, 'active', new Date(), new Date()],
      ['OPT010', 'OG003', 'แก้วใหญ่ (20oz)', 20, 'No', 3, 'active', new Date(), new Date()],

      // ท๊อปปิ้ง (OG004)
      ['OPT011', 'OG004', 'วิปครีม', 15, 'No', 1, 'active', new Date(), new Date()],
      ['OPT012', 'OG004', 'ไข่มุก', 20, 'No', 2, 'active', new Date(), new Date()],
      ['OPT013', 'OG004', 'เจลลี่', 15, 'No', 3, 'active', new Date(), new Date()],
      ['OPT014', 'OG004', 'ครีมชีส', 25, 'No', 4, 'active', new Date(), new Date()],

      // เพิ่มช๊อต (OG005)
      ['OPT015', 'OG005', 'ไม่เพิ่ม', 0, 'Yes', 1, 'active', new Date(), new Date()],
      ['OPT016', 'OG005', 'เพิ่ม 1 ช๊อต', 20, 'No', 2, 'active', new Date(), new Date()],
      ['OPT017', 'OG005', 'เพิ่ม 2 ช๊อต', 35, 'No', 3, 'active', new Date(), new Date()]
    ];
    sheet.getRange(2, 1, demoData.length, headers.length).setValues(demoData);

    // Format columns
    sheet.setColumnWidth(1, 120); // Option ID
    sheet.setColumnWidth(2, 150); // Option Group ID
    sheet.setColumnWidth(3, 200); // Option Name
    sheet.setColumnWidth(4, 120); // Price Modifier
    sheet.setColumnWidth(5, 100); // Is Default
    sheet.setColumnWidth(6, 120); // Display Order
    sheet.setColumnWidth(7, 100); // Status
    sheet.setColumnWidth(8, 150); // Created Date
    sheet.setColumnWidth(9, 150); // Updated Date

    sheet.setFrozenRows(1);

    Logger.log('Options sheet initialized successfully');
  } catch (error) {
    Logger.log('Error initializing Options sheet: ' + error);
    throw error;
  }
}

/**
 * สร้างและกำหนดค่าเริ่มต้นสำหรับ ProductOptions Sheet
 * @param {Sheet} sheet - Google Sheets object
 */
function initializeProductOptions(sheet) {
  try {
    // Header
    var headers = [
      'Product ID',
      'Option Group ID',
      'Required',
      'Display Order',
      'Status',
      'Created Date',
      'Updated Date'
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#FF9800').setFontColor('#FFFFFF');

    // Demo data - เชื่อมสินค้ากับ Option Groups
    var demoData = [
      ['P001', 'OG001', 'Yes', 1, 'active', new Date(), new Date()], // กาแฟ - ชนิด
      ['P001', 'OG002', 'Yes', 2, 'active', new Date(), new Date()], // กาแฟ - ความหวาน
      ['P001', 'OG003', 'No', 3, 'active', new Date(), new Date()],  // กาแฟ - ขนาดแก้ว
      ['P001', 'OG005', 'No', 4, 'active', new Date(), new Date()],  // กาแฟ - เพิ่มช๊อต

      ['P002', 'OG001', 'Yes', 1, 'active', new Date(), new Date()], // ชา - ชนิด
      ['P002', 'OG002', 'Yes', 2, 'active', new Date(), new Date()], // ชา - ความหวาน
      ['P002', 'OG004', 'No', 3, 'active', new Date(), new Date()]   // ชา - ท๊อปปิ้ง
    ];
    sheet.getRange(2, 1, demoData.length, headers.length).setValues(demoData);

    // Format columns
    sheet.setColumnWidth(1, 120); // Product ID
    sheet.setColumnWidth(2, 150); // Option Group ID
    sheet.setColumnWidth(3, 100); // Required
    sheet.setColumnWidth(4, 120); // Display Order
    sheet.setColumnWidth(5, 100); // Status
    sheet.setColumnWidth(6, 150); // Created Date
    sheet.setColumnWidth(7, 150); // Updated Date

    sheet.setFrozenRows(1);

    Logger.log('ProductOptions sheet initialized successfully');
  } catch (error) {
    Logger.log('Error initializing ProductOptions sheet: ' + error);
    throw error;
  }
}

/**
 * สร้างและกำหนดค่าเริ่มต้นสำหรับ Combos Sheet
 * @param {Sheet} sheet - Google Sheets object
 */
function initializeCombos(sheet) {
  try {
    // Header
    var headers = [
      'Combo ID',
      'Combo Name',
      'Description',
      'Regular Price',
      'Combo Price',
      'Discount Percent',
      'Image URL',
      'Display Order',
      'Status',
      'Created Date',
      'Updated Date'
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#9C27B0').setFontColor('#FFFFFF');

    // Demo data
    var demoData = [
      ['CB001', 'คู่หูเช้าชื่น', 'กาแฟ + ขนมปัง', 95, 79, 16.84, '', 1, 'active', new Date(), new Date()],
      ['CB002', 'เซ็ตบ่ายสบาย', 'เครื่องดื่ม 2 แก้ว + ขนม 1 ชิ้น', 170, 149, 12.35, '', 2, 'active', new Date(), new Date()],
      ['CB003', 'แฮปปี้เซ็ต', 'เครื่องดื่มใดๆ + เค้ก 1 ชิ้น', 120, 99, 17.50, '', 3, 'active', new Date(), new Date()]
    ];
    sheet.getRange(2, 1, demoData.length, headers.length).setValues(demoData);

    // Format columns
    sheet.setColumnWidth(1, 120); // Combo ID
    sheet.setColumnWidth(2, 200); // Combo Name
    sheet.setColumnWidth(3, 250); // Description
    sheet.setColumnWidth(4, 120); // Regular Price
    sheet.setColumnWidth(5, 120); // Combo Price
    sheet.setColumnWidth(6, 130); // Discount Percent
    sheet.setColumnWidth(7, 200); // Image URL
    sheet.setColumnWidth(8, 120); // Display Order
    sheet.setColumnWidth(9, 100); // Status
    sheet.setColumnWidth(10, 150); // Created Date
    sheet.setColumnWidth(11, 150); // Updated Date

    sheet.setFrozenRows(1);

    Logger.log('Combos sheet initialized successfully');
  } catch (error) {
    Logger.log('Error initializing Combos sheet: ' + error);
    throw error;
  }
}

/**
 * สร้างและกำหนดค่าเริ่มต้นสำหรับ ComboItems Sheet
 * @param {Sheet} sheet - Google Sheets object
 */
function initializeComboItems(sheet) {
  try {
    // Header
    var headers = [
      'Combo ID',
      'Product ID',
      'Quantity',
      'Allow Options',
      'Display Order',
      'Status',
      'Created Date',
      'Updated Date'
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#E91E63').setFontColor('#FFFFFF');

    // Demo data
    var demoData = [
      // คู่หูเช้าชื่น (CB001)
      ['CB001', 'P001', 1, 'Yes', 1, 'active', new Date(), new Date()], // กาแฟ
      ['CB001', 'P010', 1, 'No', 2, 'active', new Date(), new Date()],  // ขนมปัง

      // เซ็ตบ่ายสบาย (CB002)
      ['CB002', 'P001', 1, 'Yes', 1, 'active', new Date(), new Date()], // เครื่องดื่ม 1
      ['CB002', 'P002', 1, 'Yes', 2, 'active', new Date(), new Date()], // เครื่องดื่ม 2
      ['CB002', 'P015', 1, 'No', 3, 'active', new Date(), new Date()],  // ขนม

      // แฮปปี้เซ็ต (CB003)
      ['CB003', 'P001', 1, 'Yes', 1, 'active', new Date(), new Date()], // เครื่องดื่ม
      ['CB003', 'P020', 1, 'No', 2, 'active', new Date(), new Date()]   // เค้ก
    ];
    sheet.getRange(2, 1, demoData.length, headers.length).setValues(demoData);

    // Format columns
    sheet.setColumnWidth(1, 120); // Combo ID
    sheet.setColumnWidth(2, 120); // Product ID
    sheet.setColumnWidth(3, 100); // Quantity
    sheet.setColumnWidth(4, 120); // Allow Options
    sheet.setColumnWidth(5, 120); // Display Order
    sheet.setColumnWidth(6, 100); // Status
    sheet.setColumnWidth(7, 150); // Created Date
    sheet.setColumnWidth(8, 150); // Updated Date

    sheet.setFrozenRows(1);

    Logger.log('ComboItems sheet initialized successfully');
  } catch (error) {
    Logger.log('Error initializing ComboItems sheet: ' + error);
    throw error;
  }
}

/**
 * สร้างและกำหนดค่าเริ่มต้นสำหรับ SpecialNotes Sheet
 * @param {Sheet} sheet - Google Sheets object
 */
function initializeSpecialNotes(sheet) {
  try {
    // Header
    var headers = [
      'Note ID',
      'Note Text',
      'Category',
      'Display Order',
      'Status',
      'Created Date',
      'Updated Date'
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#607D8B').setFontColor('#FFFFFF');

    // Demo data
    var demoData = [
      ['SN001', 'น้ำแข็งน้อย', 'ความเย็น', 1, 'active', new Date(), new Date()],
      ['SN002', 'น้ำแข็งปกติ', 'ความเย็น', 2, 'active', new Date(), new Date()],
      ['SN003', 'น้ำแข็งเยอะ', 'ความเย็น', 3, 'active', new Date(), new Date()],
      ['SN004', 'ไม่ใส่น้ำแข็ง', 'ความเย็น', 4, 'active', new Date(), new Date()],
      ['SN005', 'แยกน้ำเชื่อม', 'พิเศษ', 5, 'active', new Date(), new Date()],
      ['SN006', 'แยกน้ำแข็ง', 'พิเศษ', 6, 'active', new Date(), new Date()],
      ['SN007', 'ใส่ถุงแยก', 'พิเศษ', 7, 'active', new Date(), new Date()],
      ['SN008', 'รสชาติเข้มข้น', 'รสชาติ', 8, 'active', new Date(), new Date()],
      ['SN009', 'รสชาติอ่อน', 'รสชาติ', 9, 'active', new Date(), new Date()]
    ];
    sheet.getRange(2, 1, demoData.length, headers.length).setValues(demoData);

    // Format columns
    sheet.setColumnWidth(1, 120); // Note ID
    sheet.setColumnWidth(2, 200); // Note Text
    sheet.setColumnWidth(3, 120); // Category
    sheet.setColumnWidth(4, 120); // Display Order
    sheet.setColumnWidth(5, 100); // Status
    sheet.setColumnWidth(6, 150); // Created Date
    sheet.setColumnWidth(7, 150); // Updated Date

    sheet.setFrozenRows(1);

    Logger.log('SpecialNotes sheet initialized successfully');
  } catch (error) {
    Logger.log('Error initializing SpecialNotes sheet: ' + error);
    throw error;
  }
}

// ============================================
// 📋 2. OPTION GROUPS CRUD
// ============================================

/**
 * ดึงข้อมูล Option Groups ทั้งหมด
 * @param {string} sheetId - ID ของ Google Spreadsheet
 * @return {Object} - { success: boolean, data: Array }
 */
function getOptionGroups(sheetId) {
  try {
    var cacheKey = 'option_groups_' + sheetId;

    return getCached(cacheKey, function() {
      var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('OptionGroups');
      if (!sheet) {
        Logger.log('[getOptionGroups] ไม่พบชีต OptionGroups');
        return { success: true, data: [] };
      }

      var data = sheet.getDataRange().getValues();
      if (data.length <= 1) return { success: true, data: [] };

      var groups = [];
      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        if (row[5] === 'active') { // Status column
          groups.push({
            groupId: row[0],
            groupName: row[1],
            selectionType: row[2],
            required: row[3],
            displayOrder: row[4],
            status: row[5],
            createdDate: row[6],
            updatedDate: row[7]
          });
        }
      }
      
      Logger.log('[getOptionGroups] ส่งข้อมูลกลับสำเร็จ ' + groups.length + ' รายการ');
      // 🔽🔽🔽 [แก้ไข] เพิ่ม serializeObject() 🔽🔽🔽
      return { success: true, data: serializeObject(groups) };
    });
  } catch (error) {
    Logger.log('[getOptionGroups] เกิด Error: ' + error);
    return { success: false, message: error.toString() };
  }
}

/**
 * เพิ่ม Option Group ใหม่
 * @param {string} sheetId - ID ของ Google Spreadsheet
 * @param {Object} data - ข้อมูล option group
 * @return {Object} - { success: boolean, message: string, groupId: string }
 */
function addOptionGroup(sheetId, data) {
  try {
    var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('OptionGroups');
    if (!sheet) {
      return { success: false, message: 'OptionGroups sheet not found' };
    }

    // Generate Option Group ID
    var groupId = generateOptionGroupId(sheetId);
    var now = new Date();

    var newRow = [
      groupId,
      data.groupName || '',
      data.selectionType || 'single',
      data.required || 'No',
      data.displayOrder || 999,
      'active',
      now,
      now
    ];

    sheet.appendRow(newRow);

    // Clear cache
    invalidateCache('option_groups_' + sheetId);

    Logger.log('Option group added: ' + groupId);
    return { success: true, message: 'Option group added successfully', groupId: groupId };
  } catch (error) {
    Logger.log('Error adding option group: ' + error);
    return { success: false, message: error.toString() };
  }
}

/**
 * อัปเดต Option Group
 * @param {string} sheetId - ID ของ Google Spreadsheet
 * @param {string} groupId - Option Group ID
 * @param {Object} data - ข้อมูลที่ต้องการอัปเดต
 * @return {Object} - { success: boolean, message: string }
 */
function updateOptionGroup(sheetId, groupId, data) {
  try {
    var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('OptionGroups');
    if (!sheet) {
      return { success: false, message: 'OptionGroups sheet not found' };
    }

    var dataRange = sheet.getDataRange();
    var values = dataRange.getValues();

    for (var i = 1; i < values.length; i++) {
      if (values[i][0] === groupId) {
        if (data.groupName !== undefined) values[i][1] = data.groupName;
        if (data.selectionType !== undefined) values[i][2] = data.selectionType;
        if (data.required !== undefined) values[i][3] = data.required;
        if (data.displayOrder !== undefined) values[i][4] = data.displayOrder;
        values[i][7] = new Date(); // Updated Date

        dataRange.setValues(values);

        // Clear cache
        invalidateCache('option_groups_' + sheetId);

        Logger.log('Option group updated: ' + groupId);
        return { success: true, message: 'Option group updated successfully' };
      }
    }

    return { success: false, message: 'Option group not found' };
  } catch (error) {
    Logger.log('Error updating option group: ' + error);
    return { success: false, message: error.toString() };
  }
}

/**
 * ลบ Option Group (set status = inactive)
 * @param {string} sheetId - ID ของ Google Spreadsheet
 * @param {string} groupId - Option Group ID
 * @return {Object} - { success: boolean, message: string }
 */
function deleteOptionGroup(sheetId, groupId) {
  try {
    var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('OptionGroups');
    if (!sheet) {
      return { success: false, message: 'OptionGroups sheet not found' };
    }

    var dataRange = sheet.getDataRange();
    var values = dataRange.getValues();

    for (var i = 1; i < values.length; i++) {
      if (values[i][0] === groupId) {
        values[i][5] = 'inactive'; // Status
        values[i][7] = new Date(); // Updated Date

        dataRange.setValues(values);

        // Clear cache
        invalidateCache('option_groups_' + sheetId);

        Logger.log('Option group deleted: ' + groupId);
        return { success: true, message: 'Option group deleted successfully' };
      }
    }

    return { success: false, message: 'Option group not found' };
  } catch (error) {
    Logger.log('Error deleting option group: ' + error);
    return { success: false, message: error.toString() };
  }
}

// ============================================
// ⚙️ 3. OPTIONS CRUD
// ============================================

/**
 * ดึงข้อมูล Options ทั้งหมด หรือของกลุ่มเฉพาะ
 * @param {string} sheetId - ID ของ Google Spreadsheet
 * @param {string} groupId - Option Group ID (optional)
 * @return {Object} - { success: boolean, data: Array }
 */
function getOptions(sheetId, groupId) {
  try {
    var cacheKey = groupId
      ? 'options_' + sheetId + '_' + groupId
      : 'options_all_' + sheetId;

    return getCached(cacheKey, function() {
      var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('Options');
      if (!sheet) {
        Logger.log('Options sheet not found');
        return { success: true, data: [] };
      }

      var data = sheet.getDataRange().getValues();
      if (data.length <= 1) return { success: true, data: [] };

      var options = [];
      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        if (row[6] === 'active' && (!groupId || row[1] === groupId)) { // Status and GroupID filter
          options.push({
            optionId: row[0],
            optionGroupId: row[1],
            optionName: row[2],
            priceModifier: row[3],
            isDefault: row[4],
            displayOrder: row[5],
            status: row[6],
            createdDate: row[7],
            updatedDate: row[8]
          });
        }
      }
      
      // 🔽🔽🔽 [แก้ไข] เพิ่ม serializeObject() 🔽🔽🔽
      return { success: true, data: serializeObject(options) };
    });
  } catch (error) {
    Logger.log('Error getting options: ' + error);
    return { success: false, message: error.toString() };
  }
}


/**
 * เพิ่ม Option ใหม่
 * @param {string} sheetId - ID ของ Google Spreadsheet
 * @param {Object} data - ข้อมูล option
 * @return {Object} - { success: boolean, message: string, optionId: string }
 */
function addOption(sheetId, data) {
  try {
    var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('Options');
    if (!sheet) {
      return { success: false, message: 'Options sheet not found' };
    }

    // Generate Option ID
    var optionId = generateOptionId(sheetId);
    var now = new Date();

    var newRow = [
      optionId,
      data.optionGroupId || '',
      data.optionName || '',
      data.priceModifier || 0,
      data.isDefault || 'No',
      data.displayOrder || 999,
      'active',
      now,
      now
    ];

    sheet.appendRow(newRow);

    // Clear cache
    invalidateCache('options_' + sheetId + '_' + data.optionGroupId);
    invalidateCache('options_all_' + sheetId);

    Logger.log('Option added: ' + optionId);
    return { success: true, message: 'Option added successfully', optionId: optionId };
  } catch (error) {
    Logger.log('Error adding option: ' + error);
    return { success: false, message: error.toString() };
  }
}

/**
 * อัปเดต Option
 * @param {string} sheetId - ID ของ Google Spreadsheet
 * @param {string} optionId - Option ID
 * @param {Object} data - ข้อมูลที่ต้องการอัปเดต
 * @return {Object} - { success: boolean, message: string }
 */
function updateOption(sheetId, optionId, data) {
  try {
    var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('Options');
    if (!sheet) {
      return { success: false, message: 'Options sheet not found' };
    }

    var dataRange = sheet.getDataRange();
    var values = dataRange.getValues();

    for (var i = 1; i < values.length; i++) {
      if (values[i][0] === optionId) {
        var oldGroupId = values[i][1];

        if (data.optionGroupId !== undefined) values[i][1] = data.optionGroupId;
        if (data.optionName !== undefined) values[i][2] = data.optionName;
        if (data.priceModifier !== undefined) values[i][3] = data.priceModifier;
        if (data.isDefault !== undefined) values[i][4] = data.isDefault;
        if (data.displayOrder !== undefined) values[i][5] = data.displayOrder;
        values[i][8] = new Date(); // Updated Date

        dataRange.setValues(values);

        // Clear cache
        invalidateCache('options_' + sheetId + '_' + oldGroupId);
        if (data.optionGroupId && data.optionGroupId !== oldGroupId) {
          invalidateCache('options_' + sheetId + '_' + data.optionGroupId);
        }
        invalidateCache('options_all_' + sheetId);

        Logger.log('Option updated: ' + optionId);
        return { success: true, message: 'Option updated successfully' };
      }
    }

    return { success: false, message: 'Option not found' };
  } catch (error) {
    Logger.log('Error updating option: ' + error);
    return { success: false, message: error.toString() };
  }
}

/**
 * ลบ Option (set status = inactive)
 * @param {string} sheetId - ID ของ Google Spreadsheet
 * @param {string} optionId - Option ID
 * @return {Object} - { success: boolean, message: string }
 */
function deleteOption(sheetId, optionId) {
  try {
    var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('Options');
    if (!sheet) {
      return { success: false, message: 'Options sheet not found' };
    }

    var dataRange = sheet.getDataRange();
    var values = dataRange.getValues();

    for (var i = 1; i < values.length; i++) {
      if (values[i][0] === optionId) {
        var groupId = values[i][1];
        values[i][6] = 'inactive'; // Status
        values[i][8] = new Date(); // Updated Date

        dataRange.setValues(values);

        // Clear cache
        invalidateCache('options_' + sheetId + '_' + groupId);
        invalidateCache('options_all_' + sheetId);

        Logger.log('Option deleted: ' + optionId);
        return { success: true, message: 'Option deleted successfully' };
      }
    }

    return { success: false, message: 'Option not found' };
  } catch (error) {
    Logger.log('Error deleting option: ' + error);
    return { success: false, message: error.toString() };
  }
}

// ============================================
// 🔗 4. PRODUCT-OPTIONS MAPPING
// ============================================

/**
 * ดึงข้อมูล Option Groups ที่เชื่อมกับสินค้า
 * @param {string} sheetId - ID ของ Google Spreadsheet
 * @param {string} productId - Product ID
 * @return {Array} - Array of product options with group details
 */
function getProductOptions(sheetId, productId) {
  try {
    var cacheKey = 'product_options_' + sheetId + '_' + productId;

    return getCached(cacheKey, function() {
      var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('ProductOptions');
      if (!sheet) {
        Logger.log('ProductOptions sheet not found');
        return [];
      }

      var data = sheet.getDataRange().getValues();
      if (data.length <= 1) return [];

      var productOptions = [];
      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        if (row[0] === productId && row[4] === 'active') { // ProductID and Status
          productOptions.push({
            productId: row[0],
            optionGroupId: row[1],
            required: row[2],
            displayOrder: row[3],
            status: row[4],
            createdDate: row[5],
            updatedDate: row[6]
          });
        }
      }

      return productOptions;
    });
  } catch (error) {
    Logger.log('Error getting product options: ' + error);
    return [];
  }
}

/**
 * เชื่อมสินค้ากับ Option Group
 * @param {string} sheetId - ID ของ Google Spreadsheet
 * @param {string} productId - Product ID
 * @param {string} groupId - Option Group ID
 * @param {string} required - Required (Yes/No)
 * @return {Object} - { success: boolean, message: string }
 */
function addProductOption(sheetId, productId, groupId, required) {
  try {
    var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('ProductOptions');
    if (!sheet) {
      return { success: false, message: 'ProductOptions sheet not found' };
    }

    // Check if mapping already exists
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === productId && data[i][1] === groupId && data[i][4] === 'active') {
        return { success: false, message: 'Product option mapping already exists' };
      }
    }

    var now = new Date();
    var displayOrder = data.length; // Use row count as display order

    var newRow = [
      productId,
      groupId,
      required || 'No',
      displayOrder,
      'active',
      now,
      now
    ];

    sheet.appendRow(newRow);

    // Clear cache
    invalidateCache('product_options_' + sheetId + '_' + productId);

    Logger.log('Product option added: ' + productId + ' - ' + groupId);
    return { success: true, message: 'Product option mapping added successfully' };
  } catch (error) {
    Logger.log('Error adding product option: ' + error);
    return { success: false, message: error.toString() };
  }
}

/**
 * ลบการเชื่อมสินค้ากับ Option Group (set status = inactive)
 * @param {string} sheetId - ID ของ Google Spreadsheet
 * @param {string} productId - Product ID
 * @param {string} groupId - Option Group ID
 * @return {Object} - { success: boolean, message: string }
 */
function deleteProductOption(sheetId, productId, groupId) {
  try {
    var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('ProductOptions');
    if (!sheet) {
      return { success: false, message: 'ProductOptions sheet not found' };
    }

    var dataRange = sheet.getDataRange();
    var values = dataRange.getValues();

    for (var i = 1; i < values.length; i++) {
      if (values[i][0] === productId && values[i][1] === groupId) {
        values[i][4] = 'inactive'; // Status
        values[i][6] = new Date(); // Updated Date

        dataRange.setValues(values);

        // Clear cache
        invalidateCache('product_options_' + sheetId + '_' + productId);

        Logger.log('Product option deleted: ' + productId + ' - ' + groupId);
        return { success: true, message: 'Product option mapping deleted successfully' };
      }
    }

    return { success: false, message: 'Product option mapping not found' };
  } catch (error) {
    Logger.log('Error deleting product option: ' + error);
    return { success: false, message: error.toString() };
  }
}

// ============================================
// 🎁 5. COMBOS CRUD
// ============================================

/**
 * ดึงข้อมูล Combos ทั้งหมด
 * @param {string} sheetId - ID ของ Google Spreadsheet
 * @return {Object} - { success: boolean, data: Array }
 */
function getCombos(sheetId) {
  try {
    var cacheKey = 'combos_' + sheetId;

    return getCached(cacheKey, function() {
      var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('Combos');
      if (!sheet) {
        Logger.log('[getCombos] ไม่พบชีต Combos');
        return { success: true, data: [] };
      }

      var data = sheet.getDataRange().getValues();
      if (data.length <= 1) return { success: true, data: [] };

      var combos = [];
      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        if (row[8] === 'active') { // Status column
          combos.push({
            comboId: row[0],
            comboName: row[1],
            description: row[2],
            regularPrice: row[3],
            comboPrice: row[4],
            discountPercent: row[5],
            imageUrl: row[6],
            displayOrder: row[7],
            status: row[8],
            createdDate: row[9],
            updatedDate: row[10]
          });
        }
      }
      
      Logger.log('[getCombos] ส่งข้อมูลกลับสำเร็จ ' + combos.length + ' รายการ');
      // 🔽🔽🔽 [แก้ไข] เพิ่ม serializeObject() 🔽🔽🔽
      return { success: true, data: serializeObject(combos) };
    });
  } catch (error) {
    Logger.log('[getCombos] เกิด Error: ' + error);
    return { success: false, message: error.toString() };
  }
}


/**
 * ดึงข้อมูล Combo เดียว พร้อม Items
 * @param {string} sheetId - ID ของ Google Spreadsheet
 * @param {string} comboId - Combo ID
 * @return {Object} - { success: boolean, data: Object }
 */
function getComboById(sheetId, comboId) {
  try {
    var cacheKey = 'combo_detail_' + sheetId + '_' + comboId;

    // [แก้ไข] ห่อหุ้ม return ทั้งหมดด้วย { success: true, data: ... }
    return getCached(cacheKey, function() {
      var combosSheet = SpreadsheetApp.openById(sheetId).getSheetByName('Combos');
      if (!combosSheet) {
        Logger.log('Combos sheet not found');
        return { success: false, message: 'Combos sheet not found' }; // ส่ง Object กลับ
      }

      var data = combosSheet.getDataRange().getValues();
      var combo = null;

      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        if (row[0] === comboId && row[8] === 'active') {
          
          // [แก้ไข] เรียก getComboItems (V2)
          var itemsResult = getComboItems(sheetId, comboId);
          
          combo = {
            comboId: row[0],
            comboName: row[1],
            description: row[2],
            regularPrice: row[3],
            comboPrice: row[4],
            discountPercent: row[5],
            imageUrl: row[6],
            displayOrder: row[7],
            status: row[8],
            createdDate: row[9],
            updatedDate: row[10],
            items: itemsResult.success ? itemsResult.data : [] // [แก้ไข]
          };
          break;
        }
      }
      
      // [แก้ไข] ส่ง Object กลับเสมอ
      return { success: true, data: serializeObject(combo) };
    });
    
  } catch (error) {
    Logger.log('Error getting combo by id: ' + error);
    return { success: false, message: error.toString() }; // [แก้ไข]
  }
}



/**
 * [ใหม่] ดึงข้อมูลประวัติการเคลื่อนไหวสต็อก (Stock Ledger)
 * (สำหรับหน้า Inventory)
 */
function getStockLedger(sheetId) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName('StockLedger');
    if (!sheet) {
      return { success: false, message: 'StockLedger sheet not found' };
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return { success: true, data: [] }; // ไม่มีประวัติ
    }

    const headers = data[0];
    
    // ดึงข้อมูล 50 รายการล่าสุด (เรียงจากใหม่ไปเก่า)
    const ledger = data.slice(Math.max(data.length - 50, 1))
      .map(row => {
        let entry = {};
        headers.forEach((header, index) => {
          entry[header] = row[index];
        });
        return entry;
      })
      .reverse(); // เรียงใหม่ไปเก่า

    return { success: true, data: serializeObject(ledger) };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}



/**
 * เพิ่ม Combo ใหม่
 * @param {string} sheetId - ID ของ Google Spreadsheet
 * @param {Object} data - ข้อมูล combo
 * @return {Object} - { success: boolean, message: string, comboId: string }
 */
function addCombo(sheetId, data) {
  try {
    var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('Combos');
    if (!sheet) {
      return { success: false, message: 'Combos sheet not found' };
    }

    // Generate Combo ID
    var comboId = generateComboId(sheetId);
    var now = new Date();

    // Calculate discount percent
    var discountPercent = 0;
    if (data.regularPrice && data.comboPrice && data.regularPrice > 0) {
      discountPercent = ((data.regularPrice - data.comboPrice) / data.regularPrice * 100).toFixed(2);
    }

    var newRow = [
      comboId,
      data.comboName || '',
      data.description || '',
      data.regularPrice || 0,
      data.comboPrice || 0,
      discountPercent,
      data.imageUrl || '',
      data.displayOrder || 999,
      'active',
      now,
      now
    ];

    sheet.appendRow(newRow);

    // Clear cache
    invalidateCache('combos_' + sheetId);

    Logger.log('Combo added: ' + comboId);
    return { success: true, message: 'Combo added successfully', comboId: comboId };
  } catch (error) {
    Logger.log('Error adding combo: ' + error);
    return { success: false, message: error.toString() };
  }
}

/**
 * อัปเดต Combo
 * @param {string} sheetId - ID ของ Google Spreadsheet
 * @param {string} comboId - Combo ID
 * @param {Object} data - ข้อมูลที่ต้องการอัปเดต
 * @return {Object} - { success: boolean, message: string }
 */
function updateCombo(sheetId, comboId, data) {
  try {
    var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('Combos');
    if (!sheet) {
      return { success: false, message: 'Combos sheet not found' };
    }

    var dataRange = sheet.getDataRange();
    var values = dataRange.getValues();

    for (var i = 1; i < values.length; i++) {
      if (values[i][0] === comboId) {
        if (data.comboName !== undefined) values[i][1] = data.comboName;
        if (data.description !== undefined) values[i][2] = data.description;
        if (data.regularPrice !== undefined) values[i][3] = data.regularPrice;
        if (data.comboPrice !== undefined) values[i][4] = data.comboPrice;

        // Recalculate discount percent
        var regularPrice = values[i][3];
        var comboPrice = values[i][4];
        if (regularPrice && comboPrice && regularPrice > 0) {
          values[i][5] = ((regularPrice - comboPrice) / regularPrice * 100).toFixed(2);
        }

        if (data.imageUrl !== undefined) values[i][6] = data.imageUrl;
        if (data.displayOrder !== undefined) values[i][7] = data.displayOrder;
        values[i][10] = new Date(); // Updated Date

        dataRange.setValues(values);

        // Clear cache
        invalidateCache('combos_' + sheetId);
        invalidateCache('combo_detail_' + sheetId + '_' + comboId);

        Logger.log('Combo updated: ' + comboId);
        return { success: true, message: 'Combo updated successfully' };
      }
    }

    return { success: false, message: 'Combo not found' };
  } catch (error) {
    Logger.log('Error updating combo: ' + error);
    return { success: false, message: error.toString() };
  }
}

/**
 * ลบ Combo (set status = inactive)
 * @param {string} sheetId - ID ของ Google Spreadsheet
 * @param {string} comboId - Combo ID
 * @return {Object} - { success: boolean, message: string }
 */
function deleteCombo(sheetId, comboId) {
  try {
    var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('Combos');
    if (!sheet) {
      return { success: false, message: 'Combos sheet not found' };
    }

    var dataRange = sheet.getDataRange();
    var values = dataRange.getValues();

    for (var i = 1; i < values.length; i++) {
      if (values[i][0] === comboId) {
        values[i][8] = 'inactive'; // Status
        values[i][10] = new Date(); // Updated Date

        dataRange.setValues(values);

        // Clear cache
        invalidateCache('combos_' + sheetId);
        invalidateCache('combo_detail_' + sheetId + '_' + comboId);

        Logger.log('Combo deleted: ' + comboId);
        return { success: true, message: 'Combo deleted successfully' };
      }
    }

    return { success: false, message: 'Combo not found' };
  } catch (error) {
    Logger.log('Error deleting combo: ' + error);
    return { success: false, message: error.toString() };
  }
}

// ============================================
// 📦 6. COMBO ITEMS
// ============================================

/**
 * ดึงข้อมูลรายการสินค้าใน Combo
 * @param {string} sheetId - ID ของ Google Spreadsheet
 * @param {string} comboId - Combo ID
 * @return {Array} - Array of combo items
 */
function getComboItems(sheetId, comboId) {
  try {
    var cacheKey = 'combo_items_' + sheetId + '_' + comboId;

    return getCached(cacheKey, function() {
      var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('ComboItems');
      if (!sheet) {
        Logger.log('ComboItems sheet not found');
        return [];
      }

      var data = sheet.getDataRange().getValues();
      if (data.length <= 1) return [];

      var items = [];
      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        if (row[0] === comboId && row[5] === 'active') { // ComboID and Status
          items.push({
            comboId: row[0],
            productId: row[1],
            quantity: row[2],
            allowOptions: row[3],
            displayOrder: row[4],
            status: row[5],
            createdDate: row[6],
            updatedDate: row[7]
          });
        }
      }

      return items;
    });
  } catch (error) {
    Logger.log('Error getting combo items: ' + error);
    return [];
  }
}

/**
 * เพิ่มสินค้าใน Combo
 * @param {string} sheetId - ID ของ Google Spreadsheet
 * @param {string} comboId - Combo ID
 * @param {string} productId - Product ID
 * @param {number} quantity - จำนวน
 * @param {string} allowOptions - อนุญาตให้เลือก Options (Yes/No)
 * @return {Object} - { success: boolean, message: string }
 */
function addComboItem(sheetId, comboId, productId, quantity, allowOptions) {
  try {
    var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('ComboItems');
    if (!sheet) {
      return { success: false, message: 'ComboItems sheet not found' };
    }

    // Check if item already exists in combo
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === comboId && data[i][1] === productId && data[i][5] === 'active') {
        return { success: false, message: 'Product already exists in this combo' };
      }
    }

    var now = new Date();
    var displayOrder = data.length; // Use row count as display order

    var newRow = [
      comboId,
      productId,
      quantity || 1,
      allowOptions || 'No',
      displayOrder,
      'active',
      now,
      now
    ];

    sheet.appendRow(newRow);

    // Clear cache
    invalidateCache('combo_items_' + sheetId + '_' + comboId);
    invalidateCache('combo_detail_' + sheetId + '_' + comboId);

    Logger.log('Combo item added: ' + comboId + ' - ' + productId);
    return { success: true, message: 'Combo item added successfully' };
  } catch (error) {
    Logger.log('Error adding combo item: ' + error);
    return { success: false, message: error.toString() };
  }
}

/**
 * ลบสินค้าจาก Combo (set status = inactive)
 * @param {string} sheetId - ID ของ Google Spreadsheet
 * @param {string} comboId - Combo ID
 * @param {string} productId - Product ID
 * @return {Object} - { success: boolean, message: string }
 */
function deleteComboItem(sheetId, comboId, productId) {
  try {
    var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('ComboItems');
    if (!sheet) {
      return { success: false, message: 'ComboItems sheet not found' };
    }

    var dataRange = sheet.getDataRange();
    var values = dataRange.getValues();

    for (var i = 1; i < values.length; i++) {
      if (values[i][0] === comboId && values[i][1] === productId) {
        values[i][5] = 'inactive'; // Status
        values[i][7] = new Date(); // Updated Date

        dataRange.setValues(values);

        // Clear cache
        invalidateCache('combo_items_' + sheetId + '_' + comboId);
        invalidateCache('combo_detail_' + sheetId + '_' + comboId);

        Logger.log('Combo item deleted: ' + comboId + ' - ' + productId);
        return { success: true, message: 'Combo item deleted successfully' };
      }
    }

    return { success: false, message: 'Combo item not found' };
  } catch (error) {
    Logger.log('Error deleting combo item: ' + error);
    return { success: false, message: error.toString() };
  }
}

// ============================================
// 📝 7. SPECIAL NOTES
// ============================================

/**
 * ดึงข้อมูล Special Notes Template ทั้งหมด
 * @param {string} sheetId - ID ของ Google Spreadsheet
 * @return {Array} - Array of special notes
 */
function getSpecialNotes(sheetId) {
  try {
    var cacheKey = 'special_notes_' + sheetId;

    return getCached(cacheKey, function() {
      var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('SpecialNotes');
      if (!sheet) {
        Logger.log('SpecialNotes sheet not found');
        return [];
      }

      var data = sheet.getDataRange().getValues();
      if (data.length <= 1) return [];

      var notes = [];
      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        if (row[4] === 'active') { // Status column
          notes.push({
            noteId: row[0],
            noteText: row[1],
            category: row[2],
            displayOrder: row[3],
            status: row[4],
            createdDate: row[5],
            updatedDate: row[6]
          });
        }
      }

      return notes;
    });
  } catch (error) {
    Logger.log('Error getting special notes: ' + error);
    return [];
  }
}

/**
 * เพิ่ม Special Note Template ใหม่
 * @param {string} sheetId - ID ของ Google Spreadsheet
 * @param {Object} data - ข้อมูล special note
 * @return {Object} - { success: boolean, message: string, noteId: string }
 */
function addSpecialNote(sheetId, data) {
  try {
    var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('SpecialNotes');
    if (!sheet) {
      return { success: false, message: 'SpecialNotes sheet not found' };
    }

    // Generate Note ID
    var noteId = generateSpecialNoteId(sheetId);
    var now = new Date();

    var newRow = [
      noteId,
      data.noteText || '',
      data.category || 'ทั่วไป',
      data.displayOrder || 999,
      'active',
      now,
      now
    ];

    sheet.appendRow(newRow);

    // Clear cache
    invalidateCache('special_notes_' + sheetId);

    Logger.log('Special note added: ' + noteId);
    return { success: true, message: 'Special note added successfully', noteId: noteId };
  } catch (error) {
    Logger.log('Error adding special note: ' + error);
    return { success: false, message: error.toString() };
  }
}

// ============================================
// 💰 8. PRICE CALCULATION
// ============================================

/**
 * คำนวณราคารวมตาม Options ที่เลือก
 * @param {string} sheetId - ID ของ Google Spreadsheet
 * @param {string} productId - Product ID
 * @param {Array} selectedOptions - Array of selected option IDs [{optionId: 'OPT001'}, ...]
 * @return {Object} - { basePrice: number, optionsPrice: number, totalPrice: number }
 */
function calculateItemPrice(sheetId, productId, selectedOptions) {
  try {
    // Get product base price
    var productsSheet = SpreadsheetApp.openById(sheetId).getSheetByName('Products');
    if (!productsSheet) {
      Logger.log('Products sheet not found');
      return { basePrice: 0, optionsPrice: 0, totalPrice: 0 };
    }

    var productsData = productsSheet.getDataRange().getValues();
    var basePrice = 0;

    for (var i = 1; i < productsData.length; i++) {
      if (productsData[i][0] === productId) { // Product ID in column A
        basePrice = productsData[i][2] || 0; // Price in column C
        break;
      }
    }

    // Calculate options price
    var optionsPrice = 0;

    if (selectedOptions && selectedOptions.length > 0) {
      var optionsSheet = SpreadsheetApp.openById(sheetId).getSheetByName('Options');
      if (optionsSheet) {
        var optionsData = optionsSheet.getDataRange().getValues();

        for (var j = 0; j < selectedOptions.length; j++) {
          var selectedOptionId = selectedOptions[j].optionId;

          for (var k = 1; k < optionsData.length; k++) {
            if (optionsData[k][0] === selectedOptionId) { // Option ID
              var priceModifier = optionsData[k][3] || 0; // Price Modifier
              optionsPrice += parseFloat(priceModifier);
              break;
            }
          }
        }
      }
    }

    var totalPrice = basePrice + optionsPrice;

    return {
      basePrice: basePrice,
      optionsPrice: optionsPrice,
      totalPrice: totalPrice
    };
  } catch (error) {
    Logger.log('Error calculating item price: ' + error);
    return { basePrice: 0, optionsPrice: 0, totalPrice: 0 };
  }
}

/**
 * คำนวณราคา Combo
 * @param {string} sheetId - ID ของ Google Spreadsheet
 * @param {string} comboId - Combo ID
 * @param {Array} comboItems - Array of items with options (optional)
 * @return {Object} - { regularPrice: number, comboPrice: number, savings: number }
 */
function calculateComboPrice(sheetId, comboId, comboItems) {
  try {
    // Get combo data
    var combosSheet = SpreadsheetApp.openById(sheetId).getSheetByName('Combos');
    if (!combosSheet) {
      Logger.log('Combos sheet not found');
      return { regularPrice: 0, comboPrice: 0, savings: 0 };
    }

    var combosData = combosSheet.getDataRange().getValues();
    var regularPrice = 0;
    var comboPrice = 0;

    for (var i = 1; i < combosData.length; i++) {
      if (combosData[i][0] === comboId) { // Combo ID
        regularPrice = combosData[i][3] || 0; // Regular Price
        comboPrice = combosData[i][4] || 0;   // Combo Price
        break;
      }
    }

    // If comboItems with options are provided, add option prices to combo price
    var additionalOptionsPrice = 0;
    if (comboItems && comboItems.length > 0) {
      for (var j = 0; j < comboItems.length; j++) {
        var item = comboItems[j];
        if (item.selectedOptions && item.selectedOptions.length > 0) {
          var itemPricing = calculateItemPrice(sheetId, item.productId, item.selectedOptions);
          additionalOptionsPrice += itemPricing.optionsPrice;
        }
      }
    }

    var finalComboPrice = comboPrice + additionalOptionsPrice;
    var savings = regularPrice - finalComboPrice;

    return {
      regularPrice: regularPrice,
      comboPrice: finalComboPrice,
      savings: savings > 0 ? savings : 0
    };
  } catch (error) {
    Logger.log('Error calculating combo price: ' + error);
    return { regularPrice: 0, comboPrice: 0, savings: 0 };
  }
}

// ============================================
// 🔄 9. HELPER FUNCTIONS
// ============================================

/**
 * สร้าง Option Group ID แบบ OG001, OG002, ...
 * @param {string} sheetId - ID ของ Google Spreadsheet
 * @return {string} - Generated Option Group ID
 */
function generateOptionGroupId(sheetId) {
  try {
    var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('OptionGroups');
    if (!sheet) {
      return 'OG001';
    }

    var data = sheet.getDataRange().getValues();
    var maxId = 0;

    for (var i = 1; i < data.length; i++) {
      var currentId = data[i][0]; // Option Group ID
      if (currentId && typeof currentId === 'string' && currentId.startsWith('OG')) {
        var num = parseInt(currentId.substring(2), 10);
        if (!isNaN(num) && num > maxId) {
          maxId = num;
        }
      }
    }

    var newId = 'OG' + String(maxId + 1).padStart(3, '0');
    Logger.log('Generated Option Group ID: ' + newId);
    return newId;
  } catch (error) {
    Logger.log('Error generating option group ID: ' + error);
    return 'OG001';
  }
}

/**
 * สร้าง Option ID แบบ OPT001, OPT002, ...
 * @param {string} sheetId - ID ของ Google Spreadsheet
 * @return {string} - Generated Option ID
 */
function generateOptionId(sheetId) {
  try {
    var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('Options');
    if (!sheet) {
      return 'OPT001';
    }

    var data = sheet.getDataRange().getValues();
    var maxId = 0;

    for (var i = 1; i < data.length; i++) {
      var currentId = data[i][0]; // Option ID
      if (currentId && typeof currentId === 'string' && currentId.startsWith('OPT')) {
        var num = parseInt(currentId.substring(3), 10);
        if (!isNaN(num) && num > maxId) {
          maxId = num;
        }
      }
    }

    var newId = 'OPT' + String(maxId + 1).padStart(3, '0');
    Logger.log('Generated Option ID: ' + newId);
    return newId;
  } catch (error) {
    Logger.log('Error generating option ID: ' + error);
    return 'OPT001';
  }
}

/**
 * สร้าง Combo ID แบบ CB001, CB002, ...
 * @param {string} sheetId - ID ของ Google Spreadsheet
 * @return {string} - Generated Combo ID
 */
function generateComboId(sheetId) {
  try {
    var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('Combos');
    if (!sheet) {
      return 'CB001';
    }

    var data = sheet.getDataRange().getValues();
    var maxId = 0;

    for (var i = 1; i < data.length; i++) {
      var currentId = data[i][0]; // Combo ID
      if (currentId && typeof currentId === 'string' && currentId.startsWith('CB')) {
        var num = parseInt(currentId.substring(2), 10);
        if (!isNaN(num) && num > maxId) {
          maxId = num;
        }
      }
    }

    var newId = 'CB' + String(maxId + 1).padStart(3, '0');
    Logger.log('Generated Combo ID: ' + newId);
    return newId;
  } catch (error) {
    Logger.log('Error generating combo ID: ' + error);
    return 'CB001';
  }
}

/**
 * สร้าง Special Note ID แบบ SN001, SN002, ...
 * @param {string} sheetId - ID ของ Google Spreadsheet
 * @return {string} - Generated Special Note ID
 */
function generateSpecialNoteId(sheetId) {
  try {
    var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('SpecialNotes');
    if (!sheet) {
      return 'SN001';
    }

    var data = sheet.getDataRange().getValues();
    var maxId = 0;

    for (var i = 1; i < data.length; i++) {
      var currentId = data[i][0]; // Note ID
      if (currentId && typeof currentId === 'string' && currentId.startsWith('SN')) {
        var num = parseInt(currentId.substring(2), 10);
        if (!isNaN(num) && num > maxId) {
          maxId = num;
        }
      }
    }

    var newId = 'SN' + String(maxId + 1).padStart(3, '0');
    Logger.log('Generated Special Note ID: ' + newId);
    return newId;
  } catch (error) {
    Logger.log('Error generating special note ID: ' + error);
    return 'SN001';
  }
}





// ============================================
// ORDER CHANNELS FUNCTIONS
// (ฟังก์ชันที่ขาดหายไป - ส่วนที่ 1)
// ============================================

/**
 * สร้าง Sheet 'OrderChannels' ถ้ายังไม่มี
 */
function createOrderChannelsSheetIfNeeded(sheetId) {
  try {
    var ss = SpreadsheetApp.openById(sheetId);
    var sheet = ss.getSheetByName('OrderChannels');
    if (!sheet) {
      sheet = ss.insertSheet('OrderChannels');
      var headers = [
        'Channel ID', 'Channel Name', 'Order Number Mode', 'Order Prefix', 'Counter', 'Status', 'Created Date', 'Updated Date'
      ];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#FF6D00').setFontColor('#FFFFFF');
      sheet.setFrozenRows(1);

      // Add default data
      var demoData = [
        ['CH001', 'หน้าร้าน (POS)', 'auto', 'POS-{YYMMDD}-', 1, 'active', new Date(), new Date()],
        ['CH002', 'Delivery App', 'manual', 'DEL-', 1, 'active', new Date(), new Date()]
      ];
      sheet.getRange(2, 1, demoData.length, headers.length).setValues(demoData);
      Logger.log('OrderChannels sheet created.');
    }
    return { success: true };
  } catch (e) {
    Logger.log('Error creating OrderChannels sheet: ' + e);
    return { success: false, message: e.toString() };
  }
}



// ============================================
// INVENTORY & STOCK MANAGEMENT FUNCTIONS (ใหม่)
// ============================================



/**
 * [V2 - อัปเกรด] ฟังก์ชันภายในสำหรับตัดสต็อก
 * รองรับทั้งสินค้าเดี่ยว (P...) และ คอมโบ (CB...)
 */
function _cutStockFromSales(sheetId, salesArray) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const materialsSheet = ss.getSheetByName('Materials');
    const recipesSheet = ss.getSheetByName('Recipes');
    const ledgerSheet = ss.getSheetByName('StockLedger');
    const comboItemsSheet = ss.getSheetByName('ComboItems'); // <-- [เพิ่มใหม่]

    if (!materialsSheet || !recipesSheet || !ledgerSheet || !comboItemsSheet) {
      Logger.log('ไม่สามารถตัดสต็อกได้: ไม่พบชีต Materials, Recipes, ComboItems, หรือ StockLedger');
      return;
    }

    // --- 1. โหลดข้อมูลวัตถุดิบ (Materials) ---
    const materialsRange = materialsSheet.getDataRange();
    const materialsData = materialsRange.getValues();
    const materialsHeaders = materialsData[0];
    const stockIndex = materialsHeaders.indexOf('Stock on Hand');
    
    // สร้าง Map สำหรับค้นหาแถวและสต็อกปัจจุบัน (เร็ว)
    const stockMap = {};
    for (let i = 1; i < materialsData.length; i++) {
      const materialId = materialsData[i][0]; // ID อยู่คอลัมน์ A
      stockMap[materialId] = {
        row: i + 1, // แถวจริงในชีต (1-based)
        stock: parseFloat(materialsData[i][stockIndex]) || 0,
        name: materialsData[i][1] // ชื่อ
      };
    }

    // --- 2. โหลดข้อมูลสูตร (Recipes) ---
    const recipesData = recipesSheet.getDataRange().getValues().slice(1);
    
    // สร้าง Map สำหรับสูตร (เร็ว)
    const recipeMap = {};
    recipesData.forEach(row => {
      const productId = row[1]; // Product ID
      const materialId = row[3]; // Material ID
      const quantity = parseFloat(row[5]) || 0;
      if (!recipeMap[productId]) {
        recipeMap[productId] = [];
      }
      recipeMap[productId].push({ materialId: materialId, quantity: quantity });
    });
    
    // --- 3. [ใหม่] โหลดข้อมูล ComboItems ---
    const comboItemsData = comboItemsSheet.getDataRange().getValues().slice(1);
    const comboItemsMap = {};
    comboItemsData.forEach(row => {
      const comboId = row[0]; // Combo ID
      const productId = row[1]; // Product ID (P...)
      const quantity = parseFloat(row[2]) || 1; // จำนวนสินค้าในคอมโบ
      if (!comboItemsMap[comboId]) {
        comboItemsMap[comboId] = [];
      }
      comboItemsMap[comboId].push({ productId: productId, quantity: quantity });
    });


    // --- 4. [แก้ไข] คำนวณยอดที่ต้องตัดทั้งหมด (รองรับ P... และ CB...) ---
    const stockChanges = {}; // { 'M001': -54, 'M002': -450 }
    const ledgerRows = [];
    const now = new Date();

    salesArray.forEach(sale => {
      const saleProductId = sale.productId;
      const saleQuantity = sale.quantity; // e.g., 2 (คอมโบ หรือ สินค้า)

      if (saleProductId.startsWith('P')) {
        // --- กรณีที่ 1: ขายสินค้าเดี่ยว (P...) ---
        const recipe = recipeMap[saleProductId];
        if (recipe) {
          recipe.forEach(ingredient => {
            const change = ingredient.quantity * saleQuantity;
            const materialId = ingredient.materialId;

            if (!stockChanges[materialId]) stockChanges[materialId] = 0;
            stockChanges[materialId] -= change;

            if (stockMap[materialId]) {
               ledgerRows.push([
                generateId('LGR'),
                now,
                materialId,
                stockMap[materialId].name,
                -change, // บันทึกเป็นค่าลบ
                'Sale',
                sale.orderNumber || ''
              ]);
            }
          });
        }
        
      } else if (saleProductId.startsWith('CB')) {
        // --- กรณีที่ 2: ขายคอมโบ (CB...) ---
        const comboItems = comboItemsMap[saleProductId]; // e.g., [ {P001, 1}, {P010, 1} ]
        
        if (comboItems) {
          // วน Loop สินค้า (P...) ที่อยู่ในคอมโบ
          comboItems.forEach(item => {
            const itemProductId = item.productId; // e.g., P001
            const itemQuantityInCombo = item.quantity; // e.g., 1 (ชิ้น)
            
            const recipe = recipeMap[itemProductId]; // ค้นหาสูตรของ P001
            
            if (recipe) {
              // วน Loop วัตถุดิบ (M...) ที่อยู่ในสูตร P001
              recipe.forEach(ingredient => {
                const materialId = ingredient.materialId;
                const ingredientQty = ingredient.quantity; // e.g., 18g
                
                // คำนวณยอดตัดทั้งหมด = (จำนวนในสูตร) x (จำนวนในคอมโบ) x (จำนวนที่ขาย)
                const change = ingredientQty * itemQuantityInCombo * saleQuantity;

                if (!stockChanges[materialId]) stockChanges[materialId] = 0;
                stockChanges[materialId] -= change;

                if (stockMap[materialId]) {
                  ledgerRows.push([
                    generateId('LGR'),
                    now,
                    materialId,
                    stockMap[materialId].name,
                    -change,
                    'Sale (Combo)', // ระบุว่ามาจากคอมโบ
                    sale.orderNumber || ''
                  ]);
                }
              });
            }
          });
        }
      }
    });

    // --- 5. อัปเดตชีต Materials ---
    // (อัปเดตสต็อกใน memory map ก่อน)
    for (const materialId in stockChanges) {
      if (stockMap[materialId]) {
        stockMap[materialId].stock += stockChanges[materialId];
      }
    }

    // เขียนค่ายอดคงเหลือใหม่กลับไปที่ชีต
    for (const materialId in stockMap) {
      const item = stockMap[materialId];
      materialsSheet.getRange(item.row, stockIndex + 1).setValue(item.stock);
    }
    
    // --- 6. บันทึกประวัติลง StockLedger ---
    if (ledgerRows.length > 0) {
      ledgerSheet.getRange(ledgerSheet.getLastRow() + 1, 1, ledgerRows.length, ledgerRows[0].length).setValues(ledgerRows);
    }

    Logger.log('ตัดสต็อกสำเร็จ ' + ledgerRows.length + ' รายการ (รวมคอมโบ)');

  } catch (e) {
    Logger.log('เกิดข้อผิดพลาดในการตัดสต็อก: ' + e);
  }
}


/**
 * [ใหม่] ดึงข้อมูลสต็อกคงเหลือทั้งหมด
 */
function getInventoryData(sheetId) {
  try {
    const cacheKey = 'inventory_' + sheetId;
    
    // ใช้ Cache (ที่ถูกลบทุกครั้งที่ขาย)
    return getCached(cacheKey, function() {
      const ss = SpreadsheetApp.openById(sheetId);
      const sheet = ss.getSheetByName('Materials');
      if (!sheet) {
        return { success: false, message: 'Materials sheet not found' };
      }

      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      
      const idCol = headers.indexOf('Material ID');
      const nameCol = headers.indexOf('Material Name');
      const unitCol = headers.indexOf('Unit');
      const stockCol = headers.indexOf('Stock on Hand');
      const minStockCol = headers.indexOf('Min Stock');
      const priceCol = headers.indexOf('Price Per Unit'); // สำหรับคำนวณมูลค่า

      const inventory = data.slice(1).map(row => {
        return {
          id: row[idCol],
          name: row[nameCol],
          unit: row[unitCol],
          stock: parseFloat(row[stockCol]) || 0,
          minStock: parseFloat(row[minStockCol]) || 0,
          price: parseFloat(row[priceCol]) || 0
        };
      });

      return { success: true, data: inventory };
    });
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

/**
 * [ใหม่] ประมวลผลข้อมูลสำหรับ Dashboard กราฟ
 */
function getInventoryDashboardData(sheetId) {
  try {
    const inventoryResult = getInventoryData(sheetId);
    if (!inventoryResult.success) return inventoryResult;
    
    const inventory = inventoryResult.data;
    
    // 1. กราฟของใกล้หมด (Low Stock Items)
    const lowStockItems = inventory
      .filter(item => item.stock <= item.minStock && item.stock > 0)
      .sort((a, b) => (a.stock / a.minStock) - (b.stock / b.minStock))
      .slice(0, 10); // เอาแค่ 10 อันดับแรก
      
    // 2. กราฟมูลค่าสต็อก (Stock Value)
    const stockValue = inventory.reduce((sum, item) => {
      return sum + (item.stock * item.price);
    }, 0);

    return {
      success: true,
      data: {
        lowStockItems: lowStockItems,
        stockValue: stockValue,
        outOfStockCount: inventory.filter(item => item.stock <= 0).length
      }
    };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

/**
 * [ใหม่] บันทึกรับของเข้า (สั่งซื้อ)
 */
function addStockPurchase(sheetId, materialId, quantity) {
  try {
    if (!materialId || !quantity || quantity <= 0) {
      return { success: false, message: 'ข้อมูลไม่ถูกต้อง' };
    }
    
    quantity = parseFloat(quantity);
    
    const ss = SpreadsheetApp.openById(sheetId);
    const materialsSheet = ss.getSheetByName('Materials');
    const ledgerSheet = ss.getSheetByName('StockLedger');
    
    const data = materialsSheet.getDataRange().getValues();
    const headers = data[0];
    const stockIndex = headers.indexOf('Stock on Hand');
    
    let materialName = '';
    let found = false;

    // อัปเดตสต็อก
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === materialId) {
        let currentStock = parseFloat(data[i][stockIndex]) || 0;
        let newStock = currentStock + quantity;
        materialsSheet.getRange(i + 1, stockIndex + 1).setValue(newStock);
        materialName = data[i][1];
        found = true;
        break;
      }
    }
    
    if (!found) {
      return { success: false, message: 'ไม่พบ Material ID' };
    }
    
    // บันทึกประวัติ
    ledgerSheet.appendRow([
      generateId('LGR'),
      new Date(),
      materialId,
      materialName,
      quantity, // ค่าบวก
      'Purchase / Receive',
      ''
    ]);
    
    // ลบ Cache สต็อก
    invalidateCache('inventory_' + sheetId);
    
    return { success: true, message: 'รับสต็อกเข้าเรียบร้อย' };

  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

/**
 * [ใหม่] บันทึกของเสีย
 */
function recordStockWaste(sheetId, materialId, quantity, reason) {
  try {
    if (!materialId || !quantity || quantity <= 0) {
      return { success: false, message: 'ข้อมูลไม่ถูกต้อง' };
    }
    
    quantity = parseFloat(quantity);
    
    const ss = SpreadsheetApp.openById(sheetId);
    const materialsSheet = ss.getSheetByName('Materials');
    const ledgerSheet = ss.getSheetByName('StockLedger');
    
    const data = materialsSheet.getDataRange().getValues();
    const headers = data[0];
    const stockIndex = headers.indexOf('Stock on Hand');
    
    let materialName = '';
    let found = false;

    // อัปเดตสต็อก
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === materialId) {
        let currentStock = parseFloat(data[i][stockIndex]) || 0;
        let newStock = currentStock - quantity;
        materialsSheet.getRange(i + 1, stockIndex + 1).setValue(newStock < 0 ? 0 : newStock); // กันติดลบ
        materialName = data[i][1];
        found = true;
        break;
      }
    }
    
    if (!found) {
      return { success: false, message: 'ไม่พบ Material ID' };
    }
    
    // บันทึกประวัติ
    ledgerSheet.appendRow([
      generateId('LGR'),
      new Date(),
      materialId,
      materialName,
      -quantity, // ค่าลบ
      'Waste: ' + (reason || 'N/A'),
      ''
    ]);
    
    // ลบ Cache สต็อก
    invalidateCache('inventory_' + sheetId);
    
    return { success: true, message: 'บันทึกของเสียเรียบร้อย' };

  } catch (e) {
    return { success: false, message: e.toString() };
  }
}


/**
 * ดึงข้อมูลช่องทางการสั่งซื้อ
 */
function getOrderChannels(sheetId) {
  try {
    createOrderChannelsSheetIfNeeded(sheetId);

    var cacheKey = 'order_channels_' + sheetId;

    return getCached(cacheKey, function() {
      var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('OrderChannels');
      if (!sheet) {
        Logger.log('OrderChannels sheet not found');
        return { success: false, message: 'OrderChannels sheet not found' };
      }

      var data = sheet.getDataRange().getValues();
      if (data.length <= 1) return { success: true, data: [] };

      var headers = data[0];
      var channels = [];

      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        var channel = {};
        headers.forEach((header, index) => {
          channel[header] = row[index];
        });
        channels.push(channel);
      }
      
      // 🔽🔽🔽 [แก้ไข] เพิ่ม serializeObject() 🔽🔽🔽
      return { success: true, data: serializeObject(channels) };
    });
  } catch (error) {
    Logger.log('Error getting order channels: ' + error);
    return { success: false, message: error.toString() };
  }
}



/**
 * สร้างหมายเลข Order อัตโนมัติสำหรับ Channel
 * [V2 - แก้ไข Bug Placeholder และเพิ่มการ Reset Counter รายวัน]
 */
function generateOrderNumberForChannel(sheetId, channelId) {
  try {
    var ss = SpreadsheetApp.openById(sheetId);
    var sheet = ss.getSheetByName('OrderChannels');
    if (!sheet) {
      return { success: false, message: 'OrderChannels sheet not found' };
    }

    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    
    var idIndex = headers.indexOf('Channel ID');
    var formatIndex = headers.indexOf('Order Prefix');
    var counterIndex = headers.indexOf('Counter');
    var updatedIndex = headers.indexOf('Updated Date'); // <-- ใช้คอลัมน์นี้เช็ควัน

    // ตรวจสอบเผื่อชีตเก่าไม่มีคอลัมน์ 'Updated Date'
    if (updatedIndex === -1) {
      sheet.getRange(1, headers.length + 1).setValue('Updated Date');
      // ดึงข้อมูลใหม่
      data = sheet.getDataRange().getValues();
      headers = data[0];
      updatedIndex = headers.indexOf('Updated Date');
    }

    for (var i = 1; i < data.length; i++) {
      if (data[i][idIndex] === channelId) {
        var format = data[i][formatIndex] || 'ORD-';
        var counter = parseInt(data[i][counterIndex]) || 1;
        var lastUpdate = data[i][updatedIndex]; // ดึงวันที่อัปเดตล่าสุด

        var now = new Date();
        var todayStr = Utilities.formatDate(now, CONFIG.TIMEZONE, 'yyyy-MM-dd');
        
        // --- [แก้ไข 2: ตรรกะรีเซ็ตตัวนับ] ---
        // เช็คว่าวันที่อัปเดตล่าสุดใช่วันนี้หรือไม่
        if (lastUpdate) {
          var lastUpdateStr = Utilities.formatDate(new Date(lastUpdate), CONFIG.TIMEZONE, 'yyyy-MM-dd');
          if (lastUpdateStr !== todayStr) {
            counter = 1; // ถ้-าไม่ใช่วันนี้ (ข้ามวันใหม่แล้ว) ให้รีเซ็ตตัวนับเป็น 1
          }
        }
        // --- [สิ้นสุดการแก้ไข 2] ---

        // --- [แก้ไข 1: ตรรกะแทนที่ Placeholder] ---
        var yyyy = Utilities.formatDate(now, CONFIG.TIMEZONE, 'yyyy');
        var yy = Utilities.formatDate(now, CONFIG.TIMEZONE, 'yy');
        var mm = Utilities.formatDate(now, CONFIG.TIMEZONE, 'MM');
        var dd = Utilities.formatDate(now, CONFIG.TIMEZONE, 'dd');
        var yymmdd = yy + mm + dd; // เช่น 251111
        var yyyymmdd = yyyy + mm + dd; // เช่น 20251111

        var orderNumber = format;
        
        // เราจะแทนที่ตัวที่ยาวกว่าก่อน (สำคัญ)
        orderNumber = orderNumber.replace('{YYYYMMDD}', yyyymmdd); // แทนที่ 20251111
        orderNumber = orderNumber.replace('{YYMMDD}', yymmdd); // แทนที่ 251111
        
        // แทนที่ตัวย่อย (เผื่อผู้ใช้ตั้งค่าแยก)
        orderNumber = orderNumber.replace('{YYYY}', yyyy);
        orderNumber = orderNumber.replace('{YY}', yy);
        orderNumber = orderNumber.replace('{MM}', mm);
        orderNumber = orderNumber.replace('{DD}', dd);
        // --- [สิ้นสุดการแก้ไข 1] ---

        // เพิ่มตัวนับ (pad 3 หลัก เช่น 001, 002)
        orderNumber += String(counter).padStart(3, '0');

        // อัปเดต Counter และ Updated Date ในชีต
        sheet.getRange(i + 1, counterIndex + 1).setValue(counter + 1);
        sheet.getRange(i + 1, updatedIndex + 1).setValue(now); // บันทึกเวลาที่รันเลขนี้

        return { success: true, orderNumber: orderNumber };
      }
    }

    return { success: false, message: 'Channel not found' };
  } catch (error) {
    Logger.log('Error generating order number for channel: ' + error);
    return { success: false, message: error.toString() };
  }
}

// ============================================
// DISCOUNT PRESETS FUNCTIONS
// (ฟังก์ชันที่ขาดหายไป - ส่วนที่ 2)
// ============================================

/**
 * สร้าง Sheet 'DiscountPresets' ถ้ายังไม่มี
 */
function createDiscountPresetsSheetIfNeeded(sheetId) {
  try {
    var ss = SpreadsheetApp.openById(sheetId);
    var sheet = ss.getSheetByName('DiscountPresets');
    if (!sheet) {
      sheet = ss.insertSheet('DiscountPresets');
      var headers = [
        'Preset ID', 'Label', 'Discount Value', 'Discount Type', 'Status', 'Created Date'
      ];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#FF9800').setFontColor('#FFFFFF');
      sheet.setFrozenRows(1);

      // Add default data
      var demoData = [
        ['DP001', 'ลด 5%', 5, 'percent', 'active', new Date()],
        ['DP002', 'ลด 10%', 10, 'percent', 'active', new Date()],
        ['DP003', 'ลด 20 บ.', 20, 'amount', 'active', new Date()]
      ];
      sheet.getRange(2, 1, demoData.length, headers.length).setValues(demoData);
      Logger.log('DiscountPresets sheet created.');
    }
    return { success: true };
  } catch (e) {
    Logger.log('Error creating DiscountPresets sheet: ' + e);
    return { success: false, message: e.toString() };
  }
}



/**
 * ดึงข้อมูลส่วนลดที่ตั้งไว้ล่วงหน้า
 */
function getDiscountPresets(sheetId) {
  try {
    createDiscountPresetsSheetIfNeeded(sheetId);

    var cacheKey = 'discount_presets_' + sheetId;

    return getCached(cacheKey, function() {
      var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('DiscountPresets');
      if (!sheet) {
        Logger.log('DiscountPresets sheet not found');
        return { success: false, message: 'DiscountPresets sheet not found' };
      }

      var data = sheet.getDataRange().getValues();
      if (data.length <= 1) return { success: true, data: [] };

      var headers = data[0];
      var presets = [];

      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        var preset = {};
        headers.forEach((header, index) => {
          preset[header] = row[index];
        });
        presets.push(preset);
      }
      
      // 🔽🔽🔽 [แก้ไข] เพิ่ม serializeObject() 🔽🔽🔽
      return { success: true, data: serializeObject(presets) };
    });
  } catch (error) {
    Logger.log('Error getting discount presets: ' + error);
    return { success: false, message: error.toString() };
  }
}


// ============================================
// PAYMENT SPLIT FUNCTIONS
// (ฟังก์ชันที่ขาดหายไป - ส่วนที่ 3)
// ============================================

/**
 * สร้าง Sheet 'PaymentSplits' ถ้ายังไม่มี
 */
function createPaymentSplitsSheetIfNeeded(sheetId) {
  try {
    var ss = SpreadsheetApp.openById(sheetId);
    var sheet = ss.getSheetByName('PaymentSplits');
    if (!sheet) {
      sheet = ss.insertSheet('PaymentSplits');
      var headers = [
        'Split ID', 'Order Number', 'Date', 'Method', 'Amount'
      ];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#00BCD4').setFontColor('#FFFFFF');
      sheet.setFrozenRows(1);
      Logger.log('PaymentSplits sheet created.');
    }
    return { success: true };
  } catch (e) {
    Logger.log('Error creating PaymentSplits sheet: ' + e);
    return { success: false, message: e.toString() };
  }
}




/**
 * บันทึกการแบ่งชำระเงิน
 */
function savePaymentSplit(sheetId, orderNumber, totalAmount, payments) {
  try { // <--- [แก้ไข] ย้าย try...catch มาคลุมทั้งหมด
    // Check if sheet exists, if not, create it
    createPaymentSplitsSheetIfNeeded(sheetId);

    var ss = SpreadsheetApp.openById(sheetId);
    var sheet = ss.getSheetByName('PaymentSplits');
    if (!sheet) {
      return { success: false, message: 'PaymentSplits sheet not found' };
    }

    var now = new Date();
    var rows = [];
    var totalPaid = 0;

    payments.forEach(function(p) {
      var splitId = generateId('PS');
      rows.push([splitId, orderNumber, now, p.method, p.amount]);
      totalPaid += p.amount;
    });

    if (rows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    }
    
    var change = totalPaid - totalAmount;

    return { 
      success: true, 
      message: 'Payment split saved', 
      change: change > 0 ? change : 0 
    };
  } catch (error) {
    Logger.log('Error saving payment split: ' + error);
    return { success: false, message: error.toString() };
  }
}







