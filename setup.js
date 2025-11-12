// ============================================
// Setup Functions
// ใช้สำหรับสร้าง Master Sheet และร้านตัวอย่าง
// ============================================

/**
 * สร้าง Master Sheet
 * รันฟังก์ชันนี้ครั้งเดียวเพื่อสร้าง Master Sheet
 */
function setupMasterSheet() {
  try {
    Logger.log('🚀 Starting Master Sheet setup...');

    // ตรวจสอบว่า Master Sheet ID ถูกตั้งค่าแล้วหรือยัง
    if (CONFIG.MASTER_SHEET_ID === 'YOUR_MASTER_SHEET_ID_HERE') {
      Logger.log('❌ Please set MASTER_SHEET_ID in Code.gs first!');
      return {
        success: false,
        message: 'Please set MASTER_SHEET_ID in Code.gs first!'
      };
    }

    const ss = SpreadsheetApp.openById(CONFIG.MASTER_SHEET_ID);
    let sheet = ss.getSheetByName('MasterDB');

    // ลบ sheet เก่าถ้ามี
    if (sheet) {
      Logger.log('⚠️ MasterDB already exists, deleting old one...');
      ss.deleteSheet(sheet);
    }

    // สร้าง sheet ใหม่
    sheet = ss.insertSheet('MasterDB');
    Logger.log('✅ Created MasterDB sheet');

    // สร้าง Header
    const headers = [
      'Shop ID',
      'Shop Name',
      'Email',
      'Password Hash',
      'Sheet ID',
      'Package',
      'Start Date',
      'End Date',
      'Status',
      'Folder ID',
      'Receipts Folder ID',
      'Data Folder ID',
      'Created At',
      'Updated At'
    ];

    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#9333ea')
      .setFontColor('#ffffff')
      .setHorizontalAlignment('center');

    sheet.setFrozenRows(1);

    // ปรับขนาดคอลัมน์
    sheet.setColumnWidth(1, 150); // Shop ID
    sheet.setColumnWidth(2, 200); // Shop Name
    sheet.setColumnWidth(3, 200); // Email
    sheet.setColumnWidth(4, 150); // Password Hash
    sheet.setColumnWidth(5, 300); // Sheet ID
    sheet.setColumnWidth(6, 100); // Package
    sheet.setColumnWidth(7, 120); // Start Date
    sheet.setColumnWidth(8, 120); // End Date
    sheet.setColumnWidth(9, 100); // Status
    sheet.setColumnWidth(10, 300); // Folder ID
    sheet.setColumnWidth(11, 300); // Receipts Folder ID
    sheet.setColumnWidth(12, 300); // Data Folder ID
    sheet.setColumnWidth(13, 150); // Created At
    sheet.setColumnWidth(14, 150); // Updated At

    // ลบ Sheet1 ถ้ามี
    const defaultSheet = ss.getSheetByName('Sheet1');
    if (defaultSheet) {
      ss.deleteSheet(defaultSheet);
      Logger.log('🗑️ Deleted default Sheet1');
    }

    Logger.log('✅ Master Sheet setup completed!');
    Logger.log('📋 Sheet ID: ' + ss.getId());
    Logger.log('🔗 Sheet URL: ' + ss.getUrl());

    return {
      success: true,
      message: 'Master Sheet setup completed!',
      sheetId: ss.getId(),
      url: ss.getUrl()
    };
  } catch (error) {
    Logger.log('❌ Error: ' + error.toString());
    return {
      success: false,
      message: error.toString()
    };
  }
}

/**
 * สร้าง Master Folder
 * รันฟังก์ชันนี้เพื่อสร้างโฟลเดอร์หลักสำหรับเก็บข้อมูลร้านต่างๆ
 */
function setupMasterFolder() {
  try {
    Logger.log('🚀 Starting Master Folder setup...');

    const folderName = 'Coffee Shop - Master Folder';
    const folder = DriveApp.createFolder(folderName);

    Logger.log('✅ Master Folder created!');
    Logger.log('📁 Folder ID: ' + folder.getId());
    Logger.log('🔗 Folder URL: ' + folder.getUrl());
    Logger.log('⚠️ Please copy this Folder ID and paste it in CONFIG.MASTER_FOLDER_ID in Code.gs');

    return {
      success: true,
      message: 'Master Folder created!',
      folderId: folder.getId(),
      url: folder.getUrl()
    };
  } catch (error) {
    Logger.log('❌ Error: ' + error.toString());
    return {
      success: false,
      message: error.toString()
    };
  }
}

/**
 * สร้างร้านตัวอย่าง
 * รันฟังก์ชันนี้เพื่อสร้างร้านทดสอบ
 */
function createSampleShop() {
  try {
    Logger.log('🚀 Creating sample shop...');

    // ตรวจสอบ CONFIG
    if (CONFIG.MASTER_SHEET_ID === 'YOUR_MASTER_SHEET_ID_HERE') {
      Logger.log('❌ Please set MASTER_SHEET_ID in Code.gs first!');
      return {
        success: false,
        message: 'Please set MASTER_SHEET_ID in Code.gs first!'
      };
    }

    if (CONFIG.MASTER_FOLDER_ID === 'YOUR_MASTER_FOLDER_ID_HERE') {
      Logger.log('❌ Please set MASTER_FOLDER_ID in Code.gs first!');
      return {
        success: false,
        message: 'Please set MASTER_FOLDER_ID in Code.gs first!'
      };
    }

    // สร้างร้านตัวอย่าง
    const shopData = {
      shopName: 'ร้านกาแฟตัวอย่าง',
      email: 'demo@coffeeshop.com',
      password: 'demo1234',
      package: 'yearly'
    };

    const result = addNewShop(shopData);

    if (result.success) {
      Logger.log('✅ Sample shop created successfully!');
      Logger.log('📧 Email: ' + shopData.email);
      Logger.log('🔑 Password: ' + shopData.password);
      Logger.log('🆔 Shop ID: ' + result.shopId);
      Logger.log('📊 Sheet ID: ' + result.sheetId);
      Logger.log('📁 Folder ID: ' + result.folderId);
      Logger.log('');
      Logger.log('👉 You can now login to the system with:');
      Logger.log('   Email: demo@coffeeshop.com');
      Logger.log('   Password: demo1234');
    } else {
      Logger.log('❌ Failed to create sample shop: ' + result.message);
    }

    return result;
  } catch (error) {
    Logger.log('❌ Error: ' + error.toString());
    return {
      success: false,
      message: error.toString()
    };
  }
}

/**
 * Setup ทั้งหมดในครั้งเดียว
 * รันฟังก์ชันนี้เพื่อ setup ทุกอย่าง
 *
 * ⚠️ หมายเหตุ: ต้องสร้าง Google Sheet ว่างๆ และ โฟลเดอร์ว่างๆ ก่อน
 * แล้วนำ ID มาใส่ใน Code.gs ก่อนรันฟังก์ชันนี้
 */
function setupAll() {
  Logger.log('');
  Logger.log('='.repeat(50));
  Logger.log('🎉 Coffee Shop Sales Tracker - Full Setup');
  Logger.log('='.repeat(50));
  Logger.log('');

  // 1. Setup Master Sheet
  Logger.log('📝 Step 1: Setting up Master Sheet...');
  const masterSheetResult = setupMasterSheet();

  if (!masterSheetResult.success) {
    Logger.log('❌ Master Sheet setup failed!');
    return;
  }

  Logger.log('');

  // 2. สร้างร้านตัวอย่าง
  Logger.log('🏪 Step 2: Creating sample shop...');
  const sampleShopResult = createSampleShop();

  if (!sampleShopResult.success) {
    Logger.log('❌ Sample shop creation failed!');
    return;
  }

  Logger.log('');
  Logger.log('='.repeat(50));
  Logger.log('✅ Setup completed successfully!');
  Logger.log('='.repeat(50));
  Logger.log('');
  Logger.log('📋 Summary:');
  Logger.log('  - Master Sheet: ' + masterSheetResult.url);
  Logger.log('  - Sample Shop Email: demo@coffeeshop.com');
  Logger.log('  - Sample Shop Password: demo1234');
  Logger.log('  - Master Password (Super Admin): ' + CONFIG.MASTER_PASSWORD);
  Logger.log('');
  Logger.log('🚀 Next Steps:');
  Logger.log('  1. Deploy this script as a Web App');
  Logger.log('  2. Copy the Web App URL');
  Logger.log('  3. Open the URL to access the system');
  Logger.log('  4. Login with demo credentials or create new shop via Super Admin');
  Logger.log('');
}

/**
 * ทดสอบการสร้างหมายเลข Order อัตโนมัติ
 */
function testOrderNumberGeneration() {
  try {
    // ต้องใส่ Sheet ID ของร้านที่ต้องการทดสอบ
    const testSheetId = 'YOUR_SHOP_SHEET_ID_HERE';

    Logger.log('Testing order number generation...');

    for (let i = 0; i < 5; i++) {
      const result = generateOrderNumber(testSheetId);
      if (result.success) {
        Logger.log('Order #' + (i + 1) + ': ' + result.orderNumber);
      } else {
        Logger.log('Error: ' + result.message);
      }
    }
  } catch (error) {
    Logger.log('Error: ' + error.toString());
  }
}

/**
 * ทดสอบการคำนวณต้นทุนสินค้า
 */
function testProductCostCalculation() {
  try {
    // ต้องใส่ Sheet ID ของร้านที่ต้องการทดสอบ
    const testSheetId = 'YOUR_SHOP_SHEET_ID_HERE';
    const testProductId = 'P002'; // Cappuccino

    Logger.log('Testing product cost calculation for ' + testProductId + '...');

    const result = calculateProductCost(testSheetId, testProductId);

    if (result.success) {
      Logger.log('Total Cost: ' + result.data.totalCost + ' THB');
      Logger.log('Breakdown:');
      result.data.breakdown.forEach(item => {
        Logger.log('  - ' + item.materialName + ': ' + item.quantity + ' ' + item.unit + ' x ' + item.pricePerUnit + ' = ' + item.cost + ' THB');
      });
    } else {
      Logger.log('Error: ' + result.message);
    }
  } catch (error) {
    Logger.log('Error: ' + error.toString());
  }
}

/**
 * ดูข้อมูล Config ปัจจุบัน
 */
function showCurrentConfig() {
  Logger.log('');
  Logger.log('='.repeat(50));
  Logger.log('⚙️ Current Configuration');
  Logger.log('='.repeat(50));
  Logger.log('');
  Logger.log('MASTER_SHEET_ID: ' + CONFIG.MASTER_SHEET_ID);
  Logger.log('MASTER_FOLDER_ID: ' + CONFIG.MASTER_FOLDER_ID);
  Logger.log('MASTER_PASSWORD: ' + CONFIG.MASTER_PASSWORD);
  Logger.log('TIMEZONE: ' + CONFIG.TIMEZONE);
  Logger.log('');

  if (CONFIG.MASTER_SHEET_ID === 'YOUR_MASTER_SHEET_ID_HERE') {
    Logger.log('⚠️ WARNING: MASTER_SHEET_ID is not set!');
    Logger.log('   Please create a new Google Sheet and paste its ID in Code.gs');
    Logger.log('');
  }

  if (CONFIG.MASTER_FOLDER_ID === 'YOUR_MASTER_FOLDER_ID_HERE') {
    Logger.log('⚠️ WARNING: MASTER_FOLDER_ID is not set!');
    Logger.log('   Please run setupMasterFolder() function to create one');
    Logger.log('   Or create a folder manually and paste its ID in Code.gs');
    Logger.log('');
  }

  if (CONFIG.MASTER_SHEET_ID !== 'YOUR_MASTER_SHEET_ID_HERE' &&
    CONFIG.MASTER_FOLDER_ID !== 'YOUR_MASTER_FOLDER_ID_HERE') {
    Logger.log('✅ Configuration looks good! You can run setupAll() now.');
    Logger.log('');
  }

  Logger.log('='.repeat(50));
  Logger.log('');
}

/**
 * คำแนะนำการ Setup ครั้งแรก
 */
function setupInstructions() {
  Logger.log('');
  Logger.log('='.repeat(60));
  Logger.log('📖 Coffee Shop Sales Tracker - Setup Instructions');
  Logger.log('='.repeat(60));
  Logger.log('');
  Logger.log('🔧 Step-by-Step Setup Guide:');
  Logger.log('');
  Logger.log('1️⃣ Create Google Sheet for Master Database:');
  Logger.log('   - Go to https://sheets.google.com');
  Logger.log('   - Create a new blank spreadsheet');
  Logger.log('   - Copy the Sheet ID from the URL');
  Logger.log('   - Paste it in CONFIG.MASTER_SHEET_ID in Code.gs');
  Logger.log('');
  Logger.log('2️⃣ Create Master Folder:');
  Logger.log('   - Option A: Run setupMasterFolder() function');
  Logger.log('   - Option B: Create folder manually at https://drive.google.com');
  Logger.log('   - Copy the Folder ID');
  Logger.log('   - Paste it in CONFIG.MASTER_FOLDER_ID in Code.gs');
  Logger.log('');
  Logger.log('3️⃣ Run Setup:');
  Logger.log('   - Run showCurrentConfig() to verify your configuration');
  Logger.log('   - Run setupAll() to initialize everything');
  Logger.log('');
  Logger.log('4️⃣ Deploy as Web App:');
  Logger.log('   - Click "Deploy" > "New deployment"');
  Logger.log('   - Select type: "Web app"');
  Logger.log('   - Execute as: "Me"');
  Logger.log('   - Who has access: "Anyone"');
  Logger.log('   - Click "Deploy"');
  Logger.log('   - Copy the Web App URL');
  Logger.log('');
  Logger.log('5️⃣ Access the System:');
  Logger.log('   - Open the Web App URL in your browser');
  Logger.log('   - Login with demo credentials:');
  Logger.log('     Email: demo@coffeeshop.com');
  Logger.log('     Password: demo1234');
  Logger.log('');
  Logger.log('6️⃣ Access Super Admin:');
  Logger.log('   - Add ?page=superadmin to your Web App URL');
  Logger.log('   - Use master password: ' + CONFIG.MASTER_PASSWORD);
  Logger.log('');
  Logger.log('='.repeat(60));
  Logger.log('');
  Logger.log('📝 Quick Commands:');
  Logger.log('   - showCurrentConfig()       : Show current configuration');
  Logger.log('   - setupMasterFolder()       : Create master folder');
  Logger.log('   - setupMasterSheet()        : Setup master database');
  Logger.log('   - createSampleShop()        : Create demo shop');
  Logger.log('   - setupAll()                : Run full setup');
  Logger.log('');
  Logger.log('='.repeat(60));
  Logger.log('');
}

/**
 * รีเซ็ต Master Sheet (ใช้เมื่อต้องการเริ่มใหม่)
 * ⚠️ ระวัง: จะลบข้อมูลทั้งหมด!
 */
function resetMasterSheet() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Reset Master Sheet',
    'Are you sure you want to reset the Master Sheet? This will DELETE ALL DATA!',
    ui.ButtonSet.YES_NO
  );

  if (response === ui.Button.YES) {
    const result = setupMasterSheet();
    if (result.success) {
      ui.alert('Success', 'Master Sheet has been reset successfully!', ui.ButtonSet.OK);
      Logger.log('✅ Master Sheet reset completed');
    } else {
      ui.alert('Error', result.message, ui.ButtonSet.OK);
      Logger.log('❌ Master Sheet reset failed: ' + result.message);
    }
  } else {
    Logger.log('ℹ️ Reset cancelled by user');
  }
}



/**
 * ฟังก์ชันทดสอบสำหรับรัน createOptionSheetsIfNeeded ด้วยตนเอง
 */
function myTestRun() {
  // 🔽🔽🔽 วาง sheetId ของคุณทับตรงนี้ 🔽🔽🔽
  var MY_SHEET_ID = "1OzUnLPzPaMRWZe4FYGnHLSbWSspbsDuQeUK7LOIE6pA"; 
  // 🔼🔼🔼 วาง sheetId ของคุณทับตรงนี้ 🔼🔼🔼

  Logger.log("กำลังสร้าง Option Sheets สำหรับ ID: " + MY_SHEET_ID);

  var result = createOptionSheetsIfNeeded(MY_SHEET_ID);

  Logger.log(result.message);
}

