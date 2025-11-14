# 🏗️ COFFEE SHOP POS SYSTEM - COMPLETE BLUEPRINT

## 📋 สารบัญ
1. [ภาพรวมระบบ](#ภาพรวมระบบ)
2. [สถาปัตยกรรม](#สถาปัตยกรรม)
3. [โครงสร้างหน้าจอ](#โครงสร้างหน้าจอ)
4. [ฟังก์ชันหลัก](#ฟังก์ชันหลัก)
5. [Data Flow](#data-flow)
6. [Database Schema](#database-schema)
7. [API Endpoints](#api-endpoints)
8. [Security](#security)
9. [Performance](#performance)

---

## 📊 ภาพรวมระบบ

### ชื่อระบบ
**Coffee Shop POS & Management System**

### เทคโนโลยี
- **Frontend:** HTML5, Tailwind CSS, JavaScript (ES5 Compatible)
- **Backend:** Google Apps Script
- **Database:** Google Sheets
- **Storage:** Google Drive
- **Charts:** Chart.js 3.9.1
- **UI Components:** SweetAlert2, Font Awesome 6.4.0

### จำนวนโค้ด
- **Frontend:** 6,965 บรรทัด (index.html)
- **Functions:** 174 functions
- **Modals:** 15+ modals
- **Pages:** 9 pages

---

## 🏛️ สถาปัตยกรรม

### Architecture Pattern
```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │         index.html (SPA - Single Page App)       │   │
│  │  - HTML Structure                                 │   │
│  │  - CSS (Tailwind + Custom)                       │   │
│  │  - JavaScript (174 functions)                    │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                          ↕ HTTPS
┌─────────────────────────────────────────────────────────┐
│                   BACKEND LAYER                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │      Google Apps Script (Code.js)                │   │
│  │  - RESTful-like API                              │   │
│  │  - Business Logic                                │   │
│  │  - Authentication                                │   │
│  │  - Cache Management                              │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                          ↕ 
┌─────────────────────────────────────────────────────────┐
│                    DATA LAYER                            │
│  ┌──────────────────────────────────────────────────┐   │
│  │           Google Sheets (Database)               │   │
│  │  - Products                                      │   │
│  │  - Materials                                     │   │
│  │  - Recipes                                       │   │
│  │  - Sales                                         │   │
│  │  - Costs                                         │   │
│  │  - Settings                                      │   │
│  │  - Users                                         │   │
│  │  - Inventory                                     │   │
│  │  - Options                                       │   │
│  │  - Combos                                        │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │           Google Drive (File Storage)            │   │
│  │  - Payment Slips (รูปสลิปการโอนเงิน)              │   │
│  │  - Product Images (ในอนาคต)                       │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Multi-Tenant Architecture
```
Master Sheet (CONFIG.MASTER_SHEET_ID)
  ├── Shop 1 (Independent Sheet)
  ├── Shop 2 (Independent Sheet)
  └── Shop N (Independent Sheet)
```

---

## 📱 โครงสร้างหน้าจอ

### 1. 🔐 Login System
**Modal:** `loginModal`
- Email/Password Authentication
- Session Management (localStorage)
- Auto-login on refresh

### 2. 📊 Dashboard (หน้าหลัก)
**Page ID:** `page-dashboard`

**Sections:**
- Summary Cards (4 cards)
  - ยอดขายวันนี้
  - จำนวนออเดอร์
  - สินค้าขายดี
  - กำไรสุทธิ
- กราฟยอดขาย (7 วันล่าสุด) - Chart.js Line Chart
- Top 5 สินค้าขายดี - Bar Chart
- รายการขายล่าสุด - Table

**Functions:**
- `loadDashboard()`
- `renderDashboardCharts()`

### 3. 🛒 POS - ขายหน้าร้าน
**Page ID:** `page-sales`

**Layout:**
```
┌────────────────────┬───────────────────┐
│   Product Grid     │   Shopping Cart   │
│   (ซ้าย 60%)       │   (ขวา 40%)       │
│                    │                   │
│ ┌────┐ ┌────┐     │  [Items List]     │
│ │Prod│ │Prod│     │  Total: ฿XXX      │
│ └────┘ └────┘     │  [Checkout]       │
│ ┌────┐ ┌────┐     │                   │
│ │Prod│ │Prod│     │                   │
│ └────┘ └────┘     │                   │
└────────────────────┴───────────────────┘
```

**Features:**
- Search Products
- Filter by Category
- Product Options (ร้อน/เย็น, ขนาด, etc.)
- Combo Products
- Discount System
- Split Payment (เงินสด/โอน/QR)
- Upload Slip (ใหม่!)
- Hold Order
- Print Receipt (A4, Thermal 80mm, 58mm)

**Functions:**
- `loadSalesPage()`
- `addToCart(productId)`
- `removeFromCart(index)`
- `updateCartQty(index, delta)`
- `processCheckout()`
- `processCheckoutWithSplit()`
- `uploadSlipToDrive(file, orderId)` ✨ ใหม่
- `printReceipt()`

### 4. 📦 Products (จัดการสินค้า)
**Page ID:** `page-products`

**Features:**
- Product List (Table)
  - Product ID
  - Name
  - Category
  - Price
  - Cost (คำนวณจากวัตถุดิบ) ✨ ใหม่
  - Profit
  - Status
  - Actions
- Add/Edit Product Modal
  - Basic Info
  - **Material Selection** ✨ ใหม่
  - **Auto Cost Calculation** ✨ ใหม่
  - Recipe Management (Inline)
- **Manage Categories Button** ✨ แสดงแล้ว
- Manage Options
- Manage Combos
- Bulk Actions

**Functions:**
- `loadProducts()`
- `showAddProductModal()`
- `editProduct(productId)`
- `saveProduct(event)`
- `deleteProduct(productId)`
- `addMaterialToProduct()` ✨ ใหม่
- `removeMaterial(button)` ✨ ใหม่
- `calculateProductCost()` ✨ ใหม่
- `showManageCategoriesModal()` ✨ แสดงแล้ว
- `recalculateAllCosts()`

### 5. 🥕 Materials (จัดการวัตถุดิบ)
**Page ID:** `page-materials`

**Features:**
- Material List (Responsive Table) ✨ แก้ไขแล้ว
- Add/Edit Material Modal
- Delete Material
- Track Supplier Info

**Functions:**
- `loadMaterials()`
- `showAddMaterialModal()`
- `editMaterial(materialId)`
- `saveMaterial(event)`
- `deleteMaterial(materialId)`

### 6. ~~📖 Recipes (สูตรอาหาร)~~ ❌ ถูกลบแล้ว
**Status:** ซ่อนจาก Navigation แล้ว (รวมอยู่ในหน้า Products)

### 7. 💰 Costs (ค่าใช้จ่าย)
**Page ID:** `page-costs`

**Features:**
- Daily Costs
- Monthly Costs
- Add Cost Modal
- Delete Cost
- Export to Excel (ในอนาคต)

**Functions:**
- `loadCostsPage()`
- `showAddCostModal(type)`
- `saveCost()`
- `deleteCost(type, costId)`

### 8. 📦 Inventory (สต็อกคงคลัง)
**Page ID:** `page-inventory`

**Features:**
- Inventory List (Table)
- Stock Status Indicators
- Receive Stock (รับของเข้า)
- Record Waste (บันทึกของเสีย)
- Low Stock Alert Chart (Top 10)
- Total Stock Value Summary

**Functions:**
- `loadInventoryPage()`
- `showPurchaseModal()`
- `savePurchase()`
- `showWasteModal()`
- `saveWaste()`

### 9. 📈 Reports (รายงาน)
**Page ID:** `page-reports`

**Features:**
- Date Range Selection
- Sales Summary
- Top Products
- Cost Analysis
- Profit Margin Report
- Export Options

**Functions:**
- `loadReportsPage()`
- `generateReport()`
- `exportReport(format)`

### 10. ⚙️ Settings (ตั้งค่า)
**Page ID:** `page-settings`

**Features:**
- Shop Information
- User Profile
- Change Password
- Subscription Status
- Dark Mode Toggle ✨
- System Version
- Held Orders Management
- Logout

**Functions:**
- `loadSettingsPage()`
- `saveSettings()`
- `changePassword()`

### 11. 📊 Sales History (ประวัติการขาย) ✨ ใหม่!
**Page ID:** `page-sales-history`

**Features:**
- 2 กราฟ:
  - ยอดขายรายเดือน (Bar Chart)
  - ยอดขายรายวัน (Line Chart)
- Date Range Filter
- Summary Cards:
  - ยอดขายรวม
  - จำนวนออเดอร์
  - ค่าเฉลี่ยต่อออเดอร์
  - เมนูขายดี
- Sales Table (Sortable)
  - วันที่/เวลา
  - เลขที่ออเดอร์
  - รายการสินค้า
  - ยอดขาย
  - การชำระเงิน
  - สลิป (ถ้ามี)
  - ดูรายละเอียด
- Top 10 Products

**Functions:**
- `loadSalesHistoryPage()` ✨
- `loadSalesHistoryData()` ✨
- `renderMonthlyChart()` ✨
- `renderDailyChart()` ✨
- `filterSalesHistory()` ✨
- `updateSummary()` ✨
- `renderSalesTable()` ✨
- `renderTopProducts()` ✨
- `sortSalesTable(column)` ✨
- `viewOrderDetails(orderId)` ✨
- `viewSlip(url)` ✨

---

## 🎨 UI/UX Features

### Theme System
- **Light Mode** (Default)
  - พื้นหลัง: #f3f4f6, #ffffff
  - สีหลัก: Indigo (#6366f1) → Purple (#8b5cf6)
- **Dark Mode**
  - พื้นหลัง: #111827, #1f2937
  - สีหลัก: Indigo (#4f46e5) → Purple (#7c3aed)
- **CSS Variables:** 14 ตัวแปร
- **Auto-save Preference:** localStorage + Google Sheets

### Design System
- ~~Glass Morphism~~ ❌ ถูกลบแล้ว
- **Solid Colors** ✅ ใช้สีทึบ
- Modern Card Design
- Gradient Buttons
- Smooth Animations
- Hover Effects
- Responsive Grid Layout

### Responsive Design
- **Desktop:** Grid Layout, Sidebar
- **Tablet:** Adapted Grid
- **Mobile:** Single Column, Bottom Navigation

---

## ⚙️ ฟังก์ชันหลัก (174 Functions)

### 🔐 Authentication
- `handleLogin(e)` - Login handler (ใน <head>)
- `showApp()` - แสดงแอปหลัง login
- `logout()` - ออกจากระบบ
- `checkSession()` - ตรวจสอบ session

### 📊 Data Management
- `loadAllData()` - โหลดข้อมูลทั้งหมด
- `loadProducts()` - โหลดสินค้า
- `loadMaterials()` - โหลดวัตถุดิบ
- `loadRecipes()` - โหลดสูตร
- `loadInventory()` - โหลดสต็อก
- `loadSales()` - โหลดยอดขาย
- `loadCosts()` - โหลดค่าใช้จ่าย
- `loadSettings()` - โหลดการตั้งค่า

### 🛒 Cart Management
- `addToCart(productId)` - เพิ่มสินค้าลงตะกร้า
- `removeFromCart(index)` - ลบสินค้าออกจากตะกร้า
- `updateCartQty(index, delta)` - เปลี่ยนจำนวน
- `clearCart()` - ล้างตะกร้า
- `calculateCartTotal()` - คำนวณยอดรวม
- `applyDiscount(amount)` - ใช้ส่วนลด

### 💳 Checkout
- `processCheckout()` - ชำระเงิน
- `processCheckoutWithSplit()` - แบ่งชำระ
- `uploadSlipToDrive(file, orderId)` ✨ - อัพโหลดสลิป
- `clearAfterCheckout()` ✨ - เคลียร์ข้อมูลหลังบันทึก
- `printReceipt()` - พิมพ์ใบเสร็จ

### 📦 Product Operations
- `saveProduct(event)` - บันทึกสินค้า
- `deleteProduct(productId)` - ลบสินค้า
- `editProduct(productId)` - แก้ไขสินค้า
- `addMaterialToProduct()` ✨ - เพิ่มวัตถุดิบ
- `removeMaterial(button)` ✨ - ลบวัตถุดิบ
- `calculateProductCost()` ✨ - คำนวณต้นทุน
- `recalculateAllCosts()` - คำนวณต้นทุนทั้งหมด

### 🔄 CRUD Operations (Pattern)
```javascript
// สำหรับแต่ละ entity (Products, Materials, etc.)
show[Entity]Modal()     // แสดง modal เพิ่ม/แก้ไข
save[Entity](event)     // บันทึก
delete[Entity](id)      // ลบ
edit[Entity](id)        // โหลดข้อมูลเพื่อแก้ไข
load[Entity]()          // โหลดรายการทั้งหมด
```

### 📊 Charts & Visualization
- `renderDashboardCharts()` - กราฟหน้า Dashboard
- `renderMonthlyChart()` ✨ - กราฟยอดขายรายเดือน
- `renderDailyChart()` ✨ - กราฟยอดขายรายวัน
- `renderLowStockChart()` - กราฟสต็อกใกล้หมด

### 🎨 UI Helpers
- `showPage(pageName)` - เปลี่ยนหน้า
- `toggleDarkMode()` - สลับ Dark Mode
- `showToast(message, type)` - แสดง notification
- `showLoadingToast(message)` - แสดง loading
- `hideLoadingToast()` - ซ่อน loading

---

## 🔄 Data Flow

### 1. Login Flow
```
User Input (Email/Password)
  ↓
handleLogin(e) [Frontend]
  ↓
google.script.run.login(email, password) [Backend API]
  ↓
Code.js: login() function
  ↓
Check Google Sheets "Users" tab
  ↓
Verify password (SHA256 hash)
  ↓
Return { success: true, data: userData }
  ↓
localStorage.setItem('coffeeShopSession', userData)
  ↓
showApp() → Load all data
```

### 2. Add to Cart Flow
```
User clicks Product Card
  ↓
addToCart(productId)
  ↓
Check if product has options
  ↓
  Yes → showProductOptionsModal()
  No  → Add directly to cart
  ↓
appState.cart.push(cartItem)
  ↓
updateCartDisplay()
  ↓
calculateCartTotal()
```

### 3. Checkout Flow
```
User clicks "ชำระเงิน"
  ↓
Validate cart (not empty)
  ↓
Select payment method (Cash/Transfer/QR)
  ↓
If Transfer/QR → uploadSlipToDrive() ✨
  ↓
processCheckout()
  ↓
google.script.run.saveSale(saleData)
  ↓
Backend: Append to "Sales" sheet
  ↓
Backend: Update "Inventory" (ลดสต็อก)
  ↓
Return { success: true, orderId: xxx }
  ↓
clearAfterCheckout() ✨
  ↓
showCheckoutSuccessModal()
  ↓
Optional: printReceipt()
```

### 4. Save Product with Materials Flow ✨
```
User fills product form
  ↓
User clicks "เพิ่มวัตถุดิบ"
  ↓
addMaterialToProduct()
  ↓
Show dropdown: Materials list
  ↓
User selects material + quantity
  ↓
calculateProductCost() [Auto-calculate]
  ↓
Cost = Σ(material.price × quantity)
  ↓
User clicks "บันทึก"
  ↓
saveProduct(event)
  ↓
google.script.run.saveProduct(productData)
  ↓
Backend: Update "Products" sheet
  ↓
Backend: Update "Recipes" sheet (if materials)
  ↓
Return { success: true }
  ↓
Reload products list
```

---

## 🗄️ Database Schema (Google Sheets)

### Sheet 1: Products
| Column | Type | Description |
|--------|------|-------------|
| Product ID | String | รหัสสินค้า (P001, P002, ...) |
| Product Name | String | ชื่อสินค้า |
| Category | String | หมวดหมู่ |
| Price | Number | ราคาขาย |
| Cost | Number | ราคาทุน (คำนวณจากวัตถุดิบ) |
| Status | String | Active/Inactive |
| Has Options | Boolean | มี options หรือไม่ |
| Order Channels | String | ช่องทางขาย (comma-separated) |

### Sheet 2: Materials
| Column | Type | Description |
|--------|------|-------------|
| Material ID | String | รหัสวัตถุดิบ (M001, M002, ...) |
| Material Name | String | ชื่อวัตถุดิบ |
| Unit | String | หน่วย (กรัม, ml, ชิ้น) |
| Price Per Unit | Number | ราคาต่อหน่วย |
| Supplier | String | ผู้จัดจำหน่าย |
| Min Stock | Number | สต็อกขั้นต่ำ |

### Sheet 3: Recipes
| Column | Type | Description |
|--------|------|-------------|
| Recipe ID | String | รหัสสูตร (R001, R002, ...) |
| Product ID | String | รหัสสินค้า |
| Material ID | String | รหัสวัตถุดิบ |
| Material Name | String | ชื่อวัตถุดิบ |
| Quantity | Number | ปริมาณที่ใช้ |
| Unit | String | หน่วย |

### Sheet 4: Sales
| Column | Type | Description |
|--------|------|-------------|
| Order ID | String | เลขที่ออเดอร์ (ORD-YYYYMMDD-XXX) |
| Timestamp | DateTime | วันที่/เวลา |
| Items | JSON String | รายการสินค้า [{name, qty, price}] |
| Total | Number | ยอดรวม |
| Discount | Number | ส่วนลด |
| Payment Method | JSON | {cash: boolean, transfer: boolean, qr: boolean} |
| Slip URL | String | URL รูปสลิป (ถ้ามี) ✨ |
| Channel | String | ช่องทางขาย |
| Staff | String | พนักงานขาย |

### Sheet 5: Inventory
| Column | Type | Description |
|--------|------|-------------|
| Material ID | String | รหัสวัตถุดิบ |
| Material Name | String | ชื่อวัตถุดิบ |
| Quantity | Number | จำนวนคงเหลือ |
| Unit | String | หน่วย |
| Last Updated | DateTime | อัพเดทล่าสุด |

### Sheet 6: Costs
| Column | Type | Description |
|--------|------|-------------|
| Cost ID | String | รหัสค่าใช้จ่าย |
| Date | DateTime | วันที่ |
| Category | String | หมวดหมู่ (เงินเดือน, ค่าเช่า, ...) |
| Description | String | รายละเอียด |
| Amount | Number | จำนวนเงิน |
| Type | String | Daily/Monthly |

### Sheet 7: Settings
| Column | Type | Description |
|--------|------|-------------|
| Key | String | ชื่อการตั้งค่า |
| Value | String | ค่า |

**Keys:**
- shopName
- shopAddress
- shopPhone
- darkMode
- receiptPaperSize
- taxId
- qrCodeImage

### Sheet 8: Users
| Column | Type | Description |
|--------|------|-------------|
| User ID | String | รหัสผู้ใช้ |
| Email | String | อีเมล (ใช้ login) |
| Password | String | รหัสผ่าน (SHA256 hash) |
| Shop Name | String | ชื่อร้าน |
| Role | String | Admin/Staff |
| Status | String | Active/Inactive |
| Subscription End | DateTime | วันหมดอายุ subscription |

### Sheet 9: Options
| Column | Type | Description |
|--------|------|-------------|
| Group ID | String | รหัสกลุ่ม (OG001, OG002, ...) |
| Group Name | String | ชื่อกลุ่ม (ขนาด, ความหวาน) |
| Selection Type | String | Single/Multiple |
| Required | String | Yes/No |

### Sheet 10: Option Items
| Column | Type | Description |
|--------|------|-------------|
| Option ID | String | รหัส option (OPT001, OPT002, ...) |
| Group ID | String | รหัสกลุ่ม |
| Option Name | String | ชื่อ option (เล็ก, กลาง, ใหญ่) |
| Price Adjust | Number | ปรับราคา (+10, -5, etc.) |
| Display Order | Number | ลำดับการแสดง |
| Is Default | String | Yes/No |

### Sheet 11: Combos
| Column | Type | Description |
|--------|------|-------------|
| Combo ID | String | รหัสคอมโบ (C001, C002, ...) |
| Combo Name | String | ชื่อคอมโบ |
| Combo Price | Number | ราคาคอมโบ |
| Status | String | Active/Inactive |

### Sheet 12: Combo Items
| Column | Type | Description |
|--------|------|-------------|
| Combo ID | String | รหัสคอมโบ |
| Product ID | String | รหัสสินค้า |
| Product Name | String | ชื่อสินค้า |
| Quantity | Number | จำนวน |
| Allow Options | String | Yes/No |

---

## 🔌 API Endpoints (Google Apps Script)

### Authentication
```javascript
// POST /login
login(email, password)
→ Returns: { success: boolean, data: userData, message: string }

// POST /logout  
logout()
→ Returns: { success: true }
```

### Products
```javascript
// GET /products
getProducts()
→ Returns: { success: true, data: [products] }

// POST /products
saveProduct(productData)
→ Returns: { success: true, productId: string }

// DELETE /products/:id
deleteProduct(productId)
→ Returns: { success: true }

// POST /products/recalculate-costs
recalculateAllCosts()
→ Returns: { success: true, updated: number }
```

### Materials
```javascript
// GET /materials
getMaterials()
→ Returns: { success: true, data: [materials] }

// POST /materials
saveMaterial(materialData)
→ Returns: { success: true, materialId: string }

// DELETE /materials/:id
deleteMaterial(materialId)
→ Returns: { success: true }
```

### Recipes
```javascript
// GET /recipes
getRecipes()
→ Returns: { success: true, data: [recipes] }

// GET /recipes/product/:productId
getRecipesByProduct(productId)
→ Returns: { success: true, data: [recipes] }

// POST /recipes
saveRecipe(recipeData)
→ Returns: { success: true, recipeId: string }

// DELETE /recipes/:id
deleteRecipe(recipeId)
→ Returns: { success: true }
```

### Sales
```javascript
// GET /sales
getSales()
→ Returns: { success: true, data: [sales] }

// GET /sales/history ✨ NEW
getSalesHistory()
→ Returns: { success: true, data: [sales with full details] }

// POST /sales
saveSale(saleData)
→ Returns: { success: true, orderId: string }

// POST /sales/upload-slip ✨ NEW
uploadSlipImage(base64Data, fileName, orderId)
→ Returns: { success: true, url: string }
```

### Inventory
```javascript
// GET /inventory
getInventory()
→ Returns: { success: true, data: [inventory] }

// POST /inventory/purchase
savePurchase(purchaseData)
→ Returns: { success: true }

// POST /inventory/waste
saveWaste(wasteData)
→ Returns: { success: true }
```

### Costs
```javascript
// GET /costs
getCosts()
→ Returns: { success: true, data: { daily: [], monthly: [] } }

// POST /costs
saveCost(costData)
→ Returns: { success: true, costId: string }

// DELETE /costs
deleteCost(type, costId)
→ Returns: { success: true }
```

### Settings
```javascript
// GET /settings
getSettings()
→ Returns: { success: true, data: settingsObject }

// POST /settings
saveSettings(settingsData)
→ Returns: { success: true }

// POST /settings/change-password
changePassword(oldPassword, newPassword)
→ Returns: { success: true }
```

### Options & Combos
```javascript
// GET /options
getAllOptions()
→ Returns: { success: true, data: { groups: [], options: [] } }

// POST /options/group
saveOptionGroup(groupData)
→ Returns: { success: true, groupId: string }

// POST /options/item
saveOptionItem(optionData)
→ Returns: { success: true, optionId: string }

// GET /combos
getAllCombos()
→ Returns: { success: true, data: { combos: [], items: [] } }

// POST /combos
saveCombo(comboData)
→ Returns: { success: true, comboId: string }
```

### System
```javascript
// GET /version
getVersionChangelog()
→ Returns: { success: true, data: changelogObject }

// GET /channels
getOrderChannels()
→ Returns: { success: true, data: [channels] }

// GET /discounts
getDiscountPresets()
→ Returns: { success: true, data: [discounts] }
```

---

## 🔒 Security

### Authentication
- **Password Hashing:** SHA256 with SALT
- **Session Management:** localStorage (client-side)
- **Token Expiry:** No automatic expiry (manual logout required)

### Authorization
- **Role-based Access:** Admin/Staff roles
- **Sheet Protection:** System columns protected
- **Multi-tenant Isolation:** Each shop has separate spreadsheet

### Data Validation
- **Client-side:** JavaScript validation
- **Server-side:** Google Apps Script validation
- **Input Sanitization:** Basic sanitization on backend

### Security Considerations
⚠️ **Current Limitations:**
- No HTTPS enforcement (handled by Google)
- No rate limiting
- No CSRF protection (Google Apps Script limitation)
- Passwords stored as SHA256 hash (consider bcrypt in future)
- No 2FA support

---

## ⚡ Performance Optimization

### Caching Strategy
```javascript
// CacheService (Google Apps Script built-in)
- Products: 5 minutes TTL
- Materials: 5 minutes TTL
- Settings: 5 minutes TTL

// localStorage (Client-side)
- User session
- Dark mode preference
- Held orders
```

### Lazy Loading
- Charts loaded on-demand (when page shown)
- Images lazy-loaded (ในอนาคต)
- Infinite scroll (ในอนาคต)

### Code Splitting
- ไม่มี (Single HTML file)
- Consider: แยก JavaScript เป็นไฟล์ .gs แยก

### Database Optimization
- **Batch Operations:** Save multiple rows at once
- **Indexed Lookups:** Use VLOOKUP/INDEX-MATCH
- **Avoid Full Scans:** Cache frequently accessed data

### Performance Metrics
- **Page Load:** ~2-3 seconds
- **API Response:** 200-500ms (with cache)
- **Chart Rendering:** ~500ms

---

## 🚀 Deployment

### Google Apps Script Deployment
1. Create new Google Apps Script project
2. Copy Code.js content
3. Create HTML files (index.html, superadmin.html)
4. Deploy as Web App
5. Set permissions: Execute as "Me", Access "Anyone"

### Environment Setup
```javascript
const CONFIG = {
  MASTER_SHEET_ID: 'YOUR_SHEET_ID',
  MASTER_FOLDER_ID: 'YOUR_FOLDER_ID',
  MASTER_PASSWORD: 'YOUR_PASSWORD',
  SALT: 'YOUR_SALT',
  TIMEZONE: 'Asia/Bangkok',
  CURRENT_VERSION: '1.0.0'
};
```

---

## 📊 System Capabilities

### ✅ สิ่งที่ระบบทำได้
1. ระบบ POS เต็มรูปแบบ
2. จัดการสินค้า/วัตถุดิบ/สูตร
3. คำนวณต้นทุนอัตโนมัติ ✨
4. รองรับ Options และ Combos
5. จัดการสต็อกคงคลัง
6. บันทึกค่าใช้จ่าย
7. รายงานยอดขาย/กำไร
8. พิมพ์ใบเสร็จ (3 ขนาด)
9. รองรับหลายช่องทางชำระเงิน
10. อัพโหลดสลิปการโอนเงิน ✨
11. ประวัติการขายพร้อมกราฟ ✨
12. Dark Mode ✨
13. Responsive Design
14. Multi-tenant Support

### ⚠️ ข้อจำกัด
1. ไม่รองรับ Barcode Scanner (ยัง)
2. ไม่มี API สำหรับ Mobile App
3. ไม่มี Real-time Sync (ต้อง refresh)
4. ไม่มี Notification System
5. ไม่มี Advanced Analytics
6. ไม่มี Export to Excel (ยัง)
7. ไม่มี Email/SMS Alerts

---

## 🛠️ ต่อยอดในอนาคต (Roadmap)

### Phase 2 (ไตรมาส 2/2025)
- [ ] Barcode Support
- [ ] Email Receipt
- [ ] Advanced Reports (PDF export)
- [ ] Multi-store Management
- [ ] Employee Management
- [ ] Time-tracking
- [ ] Commission System

### Phase 3 (ไตรมาส 3/2025)
- [ ] Mobile App (React Native)
- [ ] Kitchen Display System (KDS)
- [ ] Customer Loyalty Program
- [ ] Online Ordering Integration
- [ ] QR Menu
- [ ] Table Management

### Phase 4 (ไตรมาส 4/2025)
- [ ] AI Sales Prediction
- [ ] Automated Reordering
- [ ] Multi-currency Support
- [ ] Franchise Management
- [ ] API for 3rd-party Integration

---

## 📞 Support & Maintenance

### Version History
- **v1.0.0** (2024-01-15): Initial Release
- **v1.1.0** (2025-11-13): 
  - ลบ Glass Morphism
  - เพิ่มระบบวัตถุดิบในสินค้า
  - เพิ่มระบบ Upload Slip
  - เพิ่มหน้าประวัติการขาย
  - แก้ไข Syntax Errors ทั้งหมด

### Browser Compatibility
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ⚠️ IE 11 (Limited support)

### Known Issues
1. ~~handleLogin undefined~~ ✅ แก้ไขแล้ว
2. ~~Syntax errors in onclick~~ ✅ แก้ไขแล้ว
3. Material table ไม่ responsive บางหน้าจอ (WIP)

---

## 📝 License
Proprietary - All rights reserved

---

**Last Updated:** 2025-11-13  
**Version:** 1.1.0  
**Total Lines:** 6,965 (index.html)  
**Total Functions:** 174

