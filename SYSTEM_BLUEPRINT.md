# ระบบจัดการร้านกาแฟ - System Blueprint

## 📋 ข้อมูลทั่วไป
- **ชื่อระบบ:** Coffee Shop Management System
- **แพลตฟอร์ม:** Google Apps Script (HTML Service)
- **ภาษา:** JavaScript + HTML + CSS (Tailwind)
- **ขนาดโค้ด:** 6,096 บรรทัด (~243KB)
- **ระบบฐานข้อมูล:** Google Sheets
- **UI Framework:** Tailwind CSS + Font Awesome Icons
- **Alert Library:** SweetAlert2
- **Chart Library:** Chart.js

---

## 🎨 User Interface Theme System

### Light/Dark Mode
```javascript
// CSS Variables
:root {
  --bg-primary: #f3f4f6;        // พื้นหลังหลัก
  --bg-secondary: #ffffff;       // พื้นหลังรอง
  --bg-gradient-from: #6366f1;  // Gradient เริ่มต้น (Indigo)
  --bg-gradient-to: #8b5cf6;    // Gradient จบ (Purple)
  --text-primary: #1f2937;      // ข้อความหลัก
  --text-secondary: #6b7280;    // ข้อความรอง
  --card-bg: rgba(255, 255, 255, 0.95);
  --glass-bg: rgba(255, 255, 255, 0.15);
}

body.dark-mode {
  --bg-primary: #111827;
  --bg-secondary: #1f2937;
  --text-primary: #f9fafb;
  // ... dark variants
}
```

### การบันทึก Theme
- **localStorage:** `coffeeShopDarkMode` → 'light' | 'dark'
- **Google Sheets:** Settings → DarkMode column

---

## 🏗️ โครงสร้างระบบหลัก

### 1. Application State (appState)
```javascript
var appState = {
  user: null,              // ข้อมูลผู้ใช้ที่ login
  cart: [],                // ตะกร้าสินค้า (POS)
  products: [],            // สินค้าทั้งหมด
  materials: [],           // วัตถุดิบทั้งหมด
  recipes: [],             // สูตรอาหาร (ความสัมพันธ์ Product-Material)
  settings: {},            // การตั้งค่าร้าน
  cache: {},               // Cache ข้อมูล
  optionGroups: [],        // กลุ่มตัวเลือก (เช่น ขนาด, หวาน, เย็น)
  allOptions: [],          // ตัวเลือกทั้งหมด
  combos: [],              // Combo สินค้า
  orderChannels: [],       // ช่องทางการสั่งซื้อ
  currentChannel: null,    // ช่องทางปัจจุบัน
  currentOrderNumber: null,// เลขที่ order ปัจจุบัน
  discountPresets: []      // ส่วนลดที่บันทึกไว้
};
```

### 2. Session Management
- **localStorage Key:** `coffeeShopSession`
- **ข้อมูลที่เก็บ:**
  ```javascript
  {
    email: "user@example.com",
    shopName: "ร้านกาแฟตัวอย่าง",
    sheetId: "1abc...",
    role: "owner",
    licenseStatus: "active",
    expiryDate: "2025-12-31",
    daysLeft: 365
  }
  ```

---

## 📱 หน้าหลัก 9 หน้า

### 1. Dashboard (page-dashboard)
**หน้าหลัก - แสดงภาพรวมธุรกิจ**
- **Cards แสดงยอดวันนี้:**
  - รายรับวันนี้ (Revenue - สีเขียว)
  - ต้นทุนรวม (Cost - สีแดง)
  - กำไรสุทธิ (Profit - สีม่วง)
  - สินค้าที่ขายได้ (Items - สีม่วง)
- **Top 5 สินค้าขายดี**
- **ฟังก์ชันหลัก:**
  - `loadDashboardData()` - โหลดข้อมูลจาก Sales sheet
  - `renderTopProducts()` - แสดงสินค้าขายดี

### 2. Sales/POS (page-sales)
**หน้าขายหน้าร้าน - Point of Sale**
- **ส่วนประกอบหลัก:**
  1. **Product Grid** - แสดงสินค้าทั้งหมด (การ์ดสินค้า)
  2. **Cart** - ตะกร้าสินค้า (ด้านขวา)
  3. **Checkout** - ชำระเงิน

- **Features:**
  - ค้นหาสินค้า (realtime debounced search)
  - กรองตามหมวดหมู่
  - เลือก Order Channel (Shopee, Lazada, Walk-in, etc.)
  - Order Number (Auto/Manual mode)
  - เพิ่มสินค้าแบบ Normal, Combo, With Options
  - แบ่งชำระหลายช่องทาง (เงินสด, โอน, QR)
  - ส่วนลด (%, บาท, หรือ preset)
  - พิมพ์ใบเสร็จ (A4, Thermal 80mm, 58mm)
  - Hold Order / Resume Order

- **ฟังก์ชันสำคัญ:**
  ```javascript
  addToCart(productId)              // เพิ่มสินค้าธรรมดา
  openProductOptionsModal(pid)      // เพิ่มสินค้าแบบมี Options
  openComboModal(pid)               // เพิ่ม Combo
  removeFromCart(index)             // ลบจากตะกร้า
  updateQuantity(index, newQty)    // เปลี่ยนจำนวน
  clearCart(skipConfirm)           // ล้างตะกร้า
  proceedToCheckout()              // ไปหน้าชำระเงิน
  finalizePayment()                // บันทึก Order
  ```

### 3. Products (page-products)
**หน้าจัดการสินค้า**
- **CRUD Operations:**
  - เพิ่มสินค้า (`showAddProductModal()`)
  - แก้ไขสินค้า (`showEditProductModal(id)`)
  - เปลี่ยนสถานะ Active/Inactive
  - จัดการหมวดหมู่ (`showManageCategoriesModal()`)
  - จัดการ Options (`showManageOptionsModal()`)
  - จัดการ Combos (`showManageCombosModal()`)

- **ข้อมูลสินค้า:**
  ```javascript
  {
    'Product ID': 'P001',
    'Product Name': 'Americano',
    'Category': 'Coffee',
    'Price': 45,
    'Cost': 15,
    'Status': 'active',
    'Type': 'normal' | 'combo' | 'with_options'
  }
  ```

### 4. Recipes (page-recipes)
**หน้าจัดการสูตรอาหาร - Recipe Management**
- **ความสัมพันธ์:** Product ↔️ Materials
- **ตัวอย่างสูตร:**
  ```
  Americano (1 แก้ว)
  - เมล็ดกาแฟ 15g
  - น้ำ 200ml
  ```

- **ฟังก์ชันหลัก:**
  ```javascript
  showAddRecipeModal()           // เพิ่ม/แก้ไขสูตร
  showEditRecipeModal(pid)       // แก้ไขสูตรเฉพาะสินค้า
  handleProductSelectChange(pid) // โหลดสูตรเดิม
  addRecipeItem()                // เพิ่มวัตถุดิบในสูตร
  removeRecipeItem(mid)          // ลบวัตถุดิบออกจากสูตร
  saveRecipe()                   // บันทึกสูตรทั้งหมด
  ```

### 5. Materials (page-materials)
**หน้าจัดการวัตถุดิบ**
- **ข้อมูลวัตถุดิบ:**
  ```javascript
  {
    'Material ID': 'M001',
    'Material Name': 'เมล็ดกาแฟ',
    'Unit': 'g',
    'Current Stock': 5000,
    'Min Stock': 500,
    'Cost Per Unit': 0.5
  }
  ```

- **Features:**
  - เพิ่ม/แก้ไข/ลบวัตถุดิบ
  - แสดงสต็อกคงเหลือ
  - แจ้งเตือนเมื่อสต็อกต่ำกว่าขั้นต่ำ

### 6. Costs (page-costs)
**หน้าจัดการค่าใช้จ่าย**
- **ประเภทค่าใช้จ่าย:**
  1. **Daily Costs** - รายวัน (เช่น ค่าน้ำค่าไฟ, เดินทาง)
  2. **Monthly Costs** - รายเดือน (เช่น ค่าเช่า, เงินเดือน)

- **ฟังก์ชัน:**
  ```javascript
  showAddDailyCostModal()
  showAddMonthlyCostModal()
  saveDailyCost()
  saveMonthlyCost()
  ```

### 7. Reports (page-reports)
**หน้ารายงาน - Report Generation**
- **ช่วงวันที่:** เลือกวันเริ่ม - วันสิ้นสุด
- **ข้อมูลที่แสดง:**
  - ยอดขายรวม
  - จำนวนสินค้าที่ขาย
  - สินค้าขายดี (Top Products)
  - ยอดขายแยกตามวัน

- **ฟังก์ชัน:**
  ```javascript
  loadReports()     // โหลดข้อมูลจาก GAS
  renderReport()    // แสดงผลรายงาน
  ```

### 8. Inventory (page-inventory)
**หน้าจัดการสต็อก**
- **Features:**
  - บันทึกการซื้อวัตถุดิบ (`showPurchaseModal()`)
  - บันทึกของเสีย (`showWasteModal()`)
  - แสดงประวัติการเคลื่อนไหว (Purchase History, Waste History)

- **ฟังก์ชัน:**
  ```javascript
  showPurchaseModal()   // บันทึกซื้อวัตถุดิบ
  savePurchase()        // บันทึกลง Purchases sheet
  showWasteModal()      // บันทึกของเสีย
  saveWaste()           // บันทึกลง Waste sheet
  ```

### 9. Settings (page-settings)
**หน้าตั้งค่าระบบ**
- **การตั้งค่า:**
  - ชื่อร้าน
  - หมายเลข PromptPay
  - Order Number Mode (Auto/Manual)
  - Order Number Format (เช่น `ORD-{YYYYMMDD}-{###}`)
  - ดูสถานะ License
  - เปลี่ยนรหัสผ่าน
  - จัดการ Held Orders

---

## 🔧 Modal Windows (18 Modals)

### 1. loginModal
**Login Screen**
- Email + Password
- เรียก `google.script.run.login()`
- บันทึก session ใน localStorage

### 2. changelogModal
**Version Changelog**
- แสดงประวัติการอัปเดตระบบ
- ฟังก์ชัน: `showVersionChangelog()`

### 3. productModal
**เพิ่ม/แก้ไขสินค้า**
- Form: Product Name, Category, Price, Cost, Type
- ฟังก์ชัน: `saveProduct()`

### 4. productOptionsModal
**เลือก Options สำหรับสินค้า**
- เลือกขนาด, ความหวาน, ความเย็น
- คำนวณราคาตาม options
- ฟังก์ชัน: `addProductWithOptions()`

### 5. comboModal
**เลือกสินค้าใน Combo**
- เลือกสินค้าตามกลุ่มที่กำหนด
- ฟังก์ชัน: `addComboToCart()`

### 6. paymentSplitModal
**แบ่งชำระเงิน**
- Cash, Transfer, QR Code
- ส่วนลด (%, บาท, preset)
- PoS Fee (จาก channel)
- ฟังก์ชัน: `finalizePayment()`

### 7. checkoutSuccessModal
**แสดงผลหลังบันทึก Order สำเร็จ**
- Order Number
- ยอดรวม
- ปุ่มพิมพ์ใบเสร็จ / Order ใหม่

### 8. receiptPrintModal
**หน้าพิมพ์ใบเสร็จ**
- เลือกขนาดกระดาษ (A4, 80mm, 58mm)
- พิมพ์โดย `window.print()`

### 9. moreMenuModal (Mobile)
**เมนูเพิ่มเติมสำหรับมือถือ**
- Products, Recipes, Materials, Costs, Reports, Settings

### 10. recipeModal (2 versions - duplicate fix needed)
**จัดการสูตรอาหาร**
- เลือก Product
- เพิ่ม/ลบวัตถุดิบในสูตร
- บันทึกสูตร

### 11. categoryManageModal
**จัดการหมวดหมู่สินค้า**
- เพิ่ม/ลบหมวดหมู่

### 12. purchaseModal
**บันทึกการซื้อวัตถุดิบ**
- เลือกวัตถุดิบ, จำนวน, ราคา

### 13. wasteModal
**บันทึกของเสีย**
- เลือกวัตถุดิบ, จำนวนที่เสีย, เหตุผล

### 14. comboManageModal
**จัดการ Combo**
- สร้าง/แก้ไข Combo และกลุ่มสินค้า

### 15. optionsManageModal
**จัดการ Options Groups**
- สร้างกลุ่ม Options (Size, Sweetness, etc.)
- เพิ่ม Options ในแต่ละกลุ่ม

---

## 🔌 Google Apps Script Integration

### API Endpoints (69+ calls)
```javascript
// Authentication
google.script.run.login(email, password)
google.script.run.logout()

// Data Loading
google.script.run.loadProducts(sheetId)
google.script.run.loadMaterials(sheetId)
google.script.run.loadRecipes(sheetId)
google.script.run.loadSales(sheetId, startDate, endDate)
google.script.run.getSettings(sheetId)

// Data Saving
google.script.run.saveProduct(sheetId, productData)
google.script.run.saveOrder(sheetId, orderData)
google.script.run.saveRecipe(sheetId, productId, recipeItems)
google.script.run.savePurchase(sheetId, purchaseData)
google.script.run.saveWaste(sheetId, wasteData)
google.script.run.updateSettings(sheetId, settings)

// Advanced Operations
google.script.run.generateOrderNumber(sheetId, channel, format)
google.script.run.getLicenseInfo(sheetId)
google.script.run.changePassword(sheetId, oldPass, newPass)
```

### Callback Pattern
```javascript
google.script.run
  .withSuccessHandler(function(result) {
    if (result.success) {
      // Handle success
      appState.products = result.data;
    } else {
      Swal.fire('Error', result.message, 'error');
    }
  })
  .withFailureHandler(function(error) {
    Swal.fire('Error', error.message, 'error');
  })
  .loadProducts(appState.user.sheetId);
```

---

## 📊 Google Sheets Structure

### 1. Products Sheet
| Column | Type | Description |
|--------|------|-------------|
| Product ID | String | P001, P002... |
| Product Name | String | ชื่อสินค้า |
| Category | String | หมวดหมู่ |
| Price | Number | ราคาขาย |
| Cost | Number | ต้นทุน |
| Status | String | active/inactive |
| Type | String | normal/combo/with_options |

### 2. Materials Sheet
| Column | Type | Description |
|--------|------|-------------|
| Material ID | String | M001, M002... |
| Material Name | String | ชื่อวัตถุดิบ |
| Unit | String | หน่วย (g, ml, ชิ้น) |
| Current Stock | Number | สต็อกปัจจุบัน |
| Min Stock | Number | สต็อกขั้นต่ำ |
| Cost Per Unit | Number | ต้นทุนต่อหน่วย |

### 3. Recipes Sheet
| Column | Type | Description |
|--------|------|-------------|
| Product ID | String | P001 |
| Material ID | String | M001 |
| Quantity | Number | จำนวนที่ใช้ |

### 4. Sales Sheet
| Column | Type | Description |
|--------|------|-------------|
| Order Number | String | ORD-20251113-001 |
| Date | Date | วันที่ขาย |
| Product Name | String | ชื่อสินค้า |
| Quantity | Number | จำนวน |
| Price | Number | ราคาต่อหน่วย |
| Total | Number | ยอดรวม |
| Channel | String | ช่องทางขาย |
| Payment Method | String | วิธีชำระเงิน |
| Discount | Number | ส่วนลด |
| Net Total | Number | ยอดสุทธิ |

### 5. Purchases Sheet (ประวัติการซื้อวัตถุดิบ)
| Column | Type | Description |
|--------|------|-------------|
| Date | Date | วันที่ซื้อ |
| Material ID | String | M001 |
| Material Name | String | ชื่อวัตถุดิบ |
| Quantity | Number | จำนวนที่ซื้อ |
| Cost Per Unit | Number | ราคาต่อหน่วย |
| Total Cost | Number | ยอดรวม |

### 6. Waste Sheet (บันทึกของเสีย)
| Column | Type | Description |
|--------|------|-------------|
| Date | Date | วันที่บันทึก |
| Material ID | String | M001 |
| Material Name | String | ชื่อวัตถุดิบ |
| Quantity | Number | จำนวนที่เสีย |
| Reason | String | เหตุผล |

### 7. Daily Costs Sheet
| Column | Type | Description |
|--------|------|-------------|
| Date | Date | วันที่ |
| Description | String | รายละเอียด |
| Amount | Number | จำนวนเงิน |

### 8. Monthly Costs Sheet
| Column | Type | Description |
|--------|------|-------------|
| Month | String | YYYY-MM |
| Description | String | รายละเอียด |
| Amount | Number | จำนวนเงิน |

### 9. Settings Sheet
| Column | Type | Description |
|--------|------|-------------|
| Shop Name | String | ชื่อร้าน |
| PromptPay Number | String | เลขพร้อมเพย์ |
| Order Number Mode | String | auto/manual |
| Order Number Format | String | รูปแบบเลข order |
| DarkMode | String | light/dark |

### 10. Order Channels Sheet
| Column | Type | Description |
|--------|------|-------------|
| Channel Name | String | Shopee, Lazada, etc. |
| Order Number Mode | String | auto/manual |
| PoS Fee (%) | Number | ค่าธรรมเนียม |

### 11. Held Orders Sheet (Order ที่ Hold ไว้)
| Column | Type | Description |
|--------|------|-------------|
| Hold ID | String | HOLD-001 |
| Date | Date | วันที่ Hold |
| Cart JSON | String | ตะกร้าสินค้า (JSON) |
| Customer Name | String | ชื่อลูกค้า (optional) |

---

## 🔐 Security Features

### 1. Authentication
- Email/Password login
- Session stored in localStorage
- Auto-logout when session expires

### 2. License System
- Package-based (Basic, Pro, Enterprise)
- Expiry date tracking
- Days left warning (< 30 days)
- Grace period support

### 3. Role Management
- Owner: Full access
- Staff: Limited access (can be implemented)

---

## ⚡ Performance Optimizations

### 1. Debounced Search
```javascript
var searchTimeout = null;
function debounce(func, delay) {
  return function() {
    var context = this;
    var args = arguments;
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(function() {
      func.apply(context, args);
    }, delay);
  };
}
```

### 2. Client-side Caching
```javascript
appState.cache = {
  products: [],
  materials: [],
  // ... cached data
};
```

### 3. Lazy Loading
- โหลดข้อมูลเฉพาะหน้าที่ใช้งาน
- ใช้ `showPage()` trigger data loading

---

## 🎯 Key Features Summary

### POS Features
✅ Multi-channel support (Shopee, Lazada, Walk-in, etc.)
✅ Product with Options (Size, Sweetness, Ice level)
✅ Combo products
✅ Multiple payment methods
✅ Discount system (%, THB, Presets)
✅ Receipt printing (3 sizes)
✅ Hold/Resume orders
✅ Auto order number generation
✅ Manual order number override

### Inventory Features
✅ Real-time stock tracking
✅ Recipe-based auto deduction
✅ Purchase history
✅ Waste tracking
✅ Low stock alerts

### Reporting Features
✅ Daily/Weekly/Monthly reports
✅ Top products analysis
✅ Revenue/Cost/Profit calculation
✅ Date range filtering

### Modern UI
✅ Light/Dark mode
✅ Responsive design (Desktop/Tablet/Mobile)
✅ Gradient accents
✅ Smooth animations
✅ Toast notifications

---

## 🐛 Known Issues & Technical Debt

### 1. Duplicate recipeModal
- มี recipeModal 2 ตัวในโค้ด (line 741 และ 967)
- ควรลบตัวใดตัวหนึ่งออก

### 2. No Sales History Page
- ไม่มีหน้าแสดงประวัติการขายทั้งหมด
- มีแค่ Reports ที่แสดงสรุปตามช่วงวันที่

### 3. Hard-coded Values
- ขนาดใบเสร็จ (A4, 80mm, 58mm) hard-coded
- ควร configurable ใน Settings

### 4. Error Handling
- บาง API call ไม่มี error handling ที่ดี
- ควรเพิ่ม retry logic

---

## 📦 Dependencies

### External Libraries
```html
<!-- Tailwind CSS -->
<script src="https://cdn.tailwindcss.com"></script>

<!-- Font Awesome 6.4.0 -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">

<!-- SweetAlert2 v11 -->
<script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>

<!-- Chart.js 3.9.1 -->
<script src="https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js"></script>

<!-- Google Fonts: Prompt (Thai) -->
<link href="https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700&display=swap" rel="stylesheet">
```

---

## 🚀 Deployment Guide

### Prerequisites
1. Google Account
2. Google Sheets access
3. Apps Script enabled

### Setup Steps
1. สร้าง Google Sheets ใหม่
2. สร้าง sheets ตามโครงสร้างด้านบน
3. เปิด Apps Script Editor
4. Deploy as Web App
5. วาง index.html เข้าไป
6. ตั้งค่า permissions
7. Deploy และทดสอบ

### Configuration
```javascript
// ใน Settings Sheet
Shop Name: "ร้านกาแฟตัวอย่าง"
PromptPay Number: "0812345678"
Order Number Mode: "auto"
Order Number Format: "ORD-{YYYYMMDD}-{###}"
```

---

## 📝 Future Enhancements

### Phase 1 (High Priority)
- [ ] เพิ่มหน้า Sales History (Order History)
- [ ] Export รายงานเป็น Excel/PDF
- [ ] Stock alerts notification
- [ ] Multi-user support with roles

### Phase 2 (Medium Priority)
- [ ] Customer management (ฐานข้อมูลลูกค้า)
- [ ] Loyalty program (แต้มสะสม)
- [ ] SMS/Email notifications
- [ ] Barcode scanner support

### Phase 3 (Nice to Have)
- [ ] Mobile app (React Native/Flutter)
- [ ] API for third-party integration
- [ ] Advanced analytics dashboard
- [ ] Auto-backup system

---

## 📞 Support & Maintenance

### Version Control
- **Current Version:** v1.0.0
- **Last Updated:** 2025-11-13
- **Git Branch:** `claude/redesign-index-page-011CV4HrguFun4R35qsXNxb5`

### Changelog Location
- Stored in `changelogModal` (HTML line ~264)
- Displayed via `showVersionChangelog()`

---

## 🔍 Code Statistics

| Metric | Value |
|--------|-------|
| Total Lines | 6,096 |
| JavaScript Functions | ~150+ |
| Modal Windows | 18 |
| Pages | 9 |
| CSS Classes | 500+ (Tailwind) |
| Google Script Calls | 69+ |
| File Size | 243KB |

---

## 📚 Additional Documentation

### Files in Project
```
/home/user/coffee/
├── index.html                    (6,096 lines - Main app)
├── index.html.backup             (5,993 lines - Original)
├── index.html.failed-redesign    (6,534 lines - Failed attempt)
├── .gitignore                    (Backup files excluded)
└── SYSTEM_BLUEPRINT.md          (This file)
```

### Git Repository
```bash
# Remote
origin: http://127.0.0.1/git/rentsafethailand/coffee

# Branch
claude/redesign-index-page-011CV4HrguFun4R35qsXNxb5

# Recent Commits
7d10e60 - Fix: Auto-clear cart after order without confirmation prompt
b793847 - Add index.html.failed-redesign to .gitignore
be31585 - Complete redesign: Light/Dark Mode + Modern UI
```

---

**Blueprint สร้างโดย:** Claude (Anthropic)
**วันที่:** 2025-11-13
**สถานะ:** ✅ Complete & Up-to-date
