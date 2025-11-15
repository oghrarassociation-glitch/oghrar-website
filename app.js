const STORAGE_KEY = 'waterConsumptionData';

// ===== IndexedDB storage shim (non-breaking): keeps a synchronous cache and persists async =====
const IDB_DB_NAME = 'waterapp-db';
const IDB_STORE = 'kv';
let DB_CACHE = { users: [], pricePerTon: 5 };
let DB_READY = false;

function openIDB() {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(IDB_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });
}
function idbGet(key) {
  return openIDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const store = tx.objectStore(IDB_STORE);
    const getReq = store.get(key);
    getReq.onsuccess = () => resolve(getReq.result);
    getReq.onerror = () => reject(getReq.error);
  }));
}
function idbSet(key, value) {
  return openIDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    const putReq = store.put(value, key);
    putReq.onsuccess = () => resolve();
    putReq.onerror = () => reject(putReq.error);
  }));
}

async function initStorage() {
  try {
    // If data exists in IDB, use it
    const existing = await idbGet(STORAGE_KEY);
    if (existing && typeof existing === 'object') {
      DB_CACHE = existing;
    } else {
      // One-time migration from localStorage if present
      const ls = localStorage.getItem(STORAGE_KEY);
      if (ls) {
        try { DB_CACHE = JSON.parse(ls) || DB_CACHE; } catch (_) {}
        try { await idbSet(STORAGE_KEY, DB_CACHE); } catch (_) {}
        try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
      } else {
        try { await idbSet(STORAGE_KEY, DB_CACHE); } catch (_) {}
      }
    }
  } catch (e) {
    console.warn('IndexedDB unavailable, falling back to localStorage only:', e);
    try {
      const ls = localStorage.getItem(STORAGE_KEY);
      if (ls) DB_CACHE = JSON.parse(ls);
    } catch (_) {}
  } finally {
    DB_READY = true;
  }
  try { window.dispatchEvent(new Event('storageReady')); } catch (_) {}
}

function storageReady() { return DB_READY; }

// Association name used in all invoices/receipts
const ASSOCIATION_NAME = 'جمعية وغرار لتنمية علي او صالح';

// Helpers for thermal receipts (58mm): wrap and center long text
function thermalWrap(text, width = 32) {
  try {
    const s = String(text || '');
    const out = [];
    let line = '';
    for (const ch of s) {
      if (line.length >= width) { out.push(line); line = ''; }
      line += ch;
    }
    if (line) out.push(line);
    return out.join('\n');
  } catch (_) { return String(text || ''); }
}
function thermalCenter(text, width = 32) {
  const lines = thermalWrap(text, width).split('\n');
  return lines.map(l => ' '.repeat(Math.max(0, Math.floor((width - l.length)/2))) + l).join('\n');
}
// Global UI state to avoid double-submit bugs on Save button
const STATE = { formMode: 'add', editingId: null };

// =============== الترجمة ===============
const translations = {
  ar: {
    title: "لوحة تحكم استهلاك الماء - جمعية وغرار",
    addBtn: "➕ إضافة مستهلك جديد",
    search: "بحث بالاسم أو رقم العداد...",
    all: "عرض الكل",
    paid: "المدفوعة فقط",
    unpaid: "غير المدفوعة فقط",
    changePrice: "💰 تغيير سعر الطن",
    stats: "📊 إحصائيات",
    printAll: "🖨️ طباعة الكل",
    nightMode: "🌙 ليلي",
    dayMode: "☀️ عادي",
    langAR: "🇲🇦 AR",
    langEN: "🇬🇧 EN",
    fullName: "الاسم الكامل",
    meterNumber: "رقم العداد",
    currentReading: "القراءة الحالية",
    phone: "رقم الهاتف",
    registrationDate: "تاريخ التسجيل",
    save: "💾 حفظ",
    cancel: "❌ إلغاء",
    changePriceTitle: "تغيير سعر الطن",
    pricePerTon: "سعر الطن (درهم)",
    apply: "✅ تطبيق السعر",
    name: "الاسم",
    meter: "رقم العداد",
    reading: "القراءة الحالية",
    status: "الحالة",
    unpaidMonths: "أشهر غير مدفوعة",
    actions: "إجراءات",
    view: "👁️ عرض",
    addMonth: "📅 إضافة شهر",
    invoice: "📄 فاتورة",
    thermal: "🖨️ حرارية",
    edit: "✏️ تعديل",
    delete: "🗑️ حذف",
    export: "📤 صدّر البيانات",
    import: "📥 استورد بيانات",
    paidStatus: "مدفوعة",
    unpaidStatus: "غير مدفوعة",
    statsTitle: "📊 الإحصائيات العامة",
    customers: "👥 عدد المستهلكين",
    consumption: "💧 إجمالي الاستهلاك",
    revenue: "💰 إجمالي التمن",
    paidTotal: "✅ المدفوع",
    unpaidTotal: "⚠️ غير المدفوع",
    avgConsumption: "📈 متوسط الاستهلاك",
    lastUpdate: "آخر تحديث",
    close: "✅ إغلاق",
    selectMonth: "اختر شهر لطباعة الفاتورة",
    printNormal: "🖨️ طباعة فاتورة عادية",
    printThermal: "🖨️ طباعة حرارية"
  },
  en: {
    title: "Water Consumption Dashboard - Oghrar Association",
    addBtn: "➕ Add New Customer",
    search: "Search by name or meter number...",
    all: "Show All",
    paid: "Paid Only",
    unpaid: "Unpaid Only",
    changePrice: "💰 Change Price per Ton",
    stats: "📊 Statistics",
    printAll: "🖨️ Print All",
    nightMode: "🌙 Night Mode",
    dayMode: "☀️ Day Mode",
    langAR: "🇲🇦 AR",
    langEN: "🇬🇧 EN",
    fullName: "Full Name",
    meterNumber: "Meter Number",
    currentReading: "Current Reading",
    phone: "Phone Number",
    registrationDate: "Registration Date",
    save: "💾 Save",
    cancel: "❌ Cancel",
    changePriceTitle: "Change Price per Ton",
    pricePerTon: "Price per Ton (MAD)",
    apply: "✅ Apply Price",
    name: "Name",
    meter: "Meter",
    reading: "Current Reading",
    status: "Status",
    unpaidMonths: "Unpaid Months",
    actions: "Actions",
    view: "👁️ View",
    addMonth: "📅 Add Month",
    invoice: "📄 Invoice",
    thermal: "🖨️ Thermal",
    edit: "✏️ Edit",
    delete: "🗑️ Delete",
    export: "📤 Export Data",
    import: "📥 Import Data",
    paidStatus: "Paid",
    unpaidStatus: "Unpaid",
    statsTitle: "📊 General Statistics",
    customers: "👥 Total Customers",
    consumption: "💧 Total Consumption",
    revenue: "💰 Total Revenue",
    paidTotal: "✅ Paid",
    unpaidTotal: "⚠️ Unpaid",
    avgConsumption: "📈 Avg. Consumption",
    lastUpdate: "Last Update",
    close: "✅ Close",
    selectMonth: "Select month to print invoice",
    printNormal: "🖨️ Print Normal Invoice",
    printThermal: "🖨️ Print Thermal Invoice"
  }
};

function getCurrentLanguage() {
  return localStorage.getItem('appLanguage') || 'ar';
}

function setCurrentLanguage(lang) {
  localStorage.setItem('appLanguage', lang);
}

function getCurrentTheme() {
  return localStorage.getItem('appTheme') || 'light';
}

function applyTheme() {
  const theme = getCurrentTheme();
  if (theme === 'dark') {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
  applyTranslations(); // لتحديث نص زر الوضع
}

function applyTranslations() {
  const lang = getCurrentLanguage();
  const t = translations[lang];
  const isDark = document.body.classList.contains('dark-mode');

  // تحديث العنوان والأزرار الرئيسية
  document.querySelector('title').textContent = t.title;
  document.querySelector('h1').textContent = t.title;
  document.getElementById('addBtn').textContent = t.addBtn;
  document.getElementById('searchInput').placeholder = t.search;
  document.getElementById('filterStatus').options[0].textContent = t.all;
  document.getElementById('filterStatus').options[1].textContent = t.paid;
  document.getElementById('filterStatus').options[2].textContent = t.unpaid;
  document.getElementById('changePriceBtn').textContent = t.changePrice;
  document.getElementById('statsBtn').textContent = t.stats;
  document.getElementById('printAllBtn').textContent = t.printAll;
  document.getElementById('exportBtn').textContent = t.export;
  document.getElementById('importBtn').textContent = t.import;
  document.getElementById('langToggle').textContent = lang === 'ar' ? t.langEN : t.langAR;
  document.getElementById('themeToggle').textContent = isDark ? t.dayMode : t.nightMode;
  
  // تحديث نموذج الإضافة
  document.querySelector('#addForm h3').textContent = lang === 'ar' ? 'إضافة مستهلك جديد' : 'Add New Customer';
  document.getElementById('fullName').placeholder = t.fullName;
  document.getElementById('meterNumber').placeholder = t.meterNumber;
  document.getElementById('currentReading').placeholder = t.currentReading;
  document.getElementById('phone').placeholder = t.phone;
  document.getElementById('saveBtn').textContent = t.save;
  document.getElementById('cancelBtn').textContent = t.cancel;
  
  // تحديث نموذج تغيير السعر
  document.querySelector('#changePriceForm h3').textContent = t.changePriceTitle;
  document.getElementById('newPricePerTon').placeholder = t.pricePerTon;
  document.getElementById('applyPriceBtn').textContent = t.apply;
  document.getElementById('cancelPriceBtn').textContent = t.cancel;
  
  // تحديث رؤوس الجدول
  const tableHeaders = document.querySelectorAll('#dataTable thead th');
  if (tableHeaders.length >= 6) {
    tableHeaders[0].textContent = t.name;
    tableHeaders[1].textContent = t.meter;
    tableHeaders[2].textContent = t.reading;
    tableHeaders[3].textContent = t.status;
    tableHeaders[4].textContent = t.unpaidMonths;
    tableHeaders[5].textContent = t.actions;
  }
}

// =============== إدارة البيانات ===============
function loadData() {
  // Return the in-memory snapshot; initialized during initStorage()
  if (!DB_CACHE || !Array.isArray(DB_CACHE.users)) {
    return { users: [], pricePerTon: 5 };
  }
  return DB_CACHE;
}

function saveData(data) {
  // Update cache synchronously; persist to IndexedDB asynchronously
  DB_CACHE = data;
  try {
    idbSet(STORAGE_KEY, data).catch(() => {});
  } catch (_) {}
}

// =============== الإحصائيات ===============
function showStatistics() {
  const data = loadData();
  let totalCustomers = data.users.length;
  let totalConsumption = 0;
  let totalRevenue = 0;
  let totalPaid = 0;
  let totalUnpaid = 0;
  let totalMonths = 0;

  data.users.forEach(user => {
    if (user.months && Array.isArray(user.months)) {
      user.months.forEach(month => {
        totalConsumption += month.consumption || 0;
        totalRevenue += month.totalPrice || 0;
        if (month.status === 'مدفوعة') {
          totalPaid += month.totalPrice || 0;
        } else {
          totalUnpaid += month.totalPrice || 0;
        }
        totalMonths++;
      });
    }
  });

  const avgConsumption = totalMonths > 0 ? (totalConsumption / totalMonths).toFixed(2) : 0;
  const lang = getCurrentLanguage();
  const t = translations[lang];
  const isDark = document.body.classList.contains('dark-mode');
  const colors = isDark ? {
    modalBg: '#2a2a2a', modalFg: 'white',
    b1: '#0d47a1', b2: '#1b5e20', b3: '#e65100', b4: '#1b5e20', b5: '#b71c1c', b6: '#4a148c', fg: 'white'
  } : {
    modalBg: 'white', modalFg: 'black',
    b1: '#e3f2fd', b2: '#e8f5e9', b3: '#fff3e0', b4: '#e8f5e9', b5: '#ffebee', b6: '#f3e5f5', fg: 'black'
  };

  const modal = document.createElement('div');
  modal.style.position = 'fixed';
  modal.style.top = '10%';
  modal.style.left = '10%';
  modal.style.width = '80%';
  modal.style.maxWidth = '600px';
  modal.style.backgroundColor = colors.modalBg;
  modal.style.color = colors.modalFg;
  modal.style.padding = '20px';
  modal.style.borderRadius = '10px';
  modal.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
  modal.style.zIndex = '2000';
  modal.style.direction = 'rtl';

  modal.innerHTML = `
    <h2 style="text-align:center; margin-top:0;">${t.statsTitle}</h2>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
      <div style="background:${colors.b1}; color:${colors.fg}; padding:15px; border-radius:8px;">
        <h3>${t.customers}</h3>
        <p style="font-size:24px; font-weight:bold; margin:0;">${totalCustomers}</p>
      </div>
      <div style="background:${colors.b2}; color:${colors.fg}; padding:15px; border-radius:8px;">
        <h3>${t.consumption}</h3>
        <p style="font-size:24px; font-weight:bold; margin:0;">${totalConsumption.toFixed(2)} طن</p>
      </div>
      <div style="background:${colors.b3}; color:${colors.fg}; padding:15px; border-radius:8px;">
        <h3>${t.revenue}</h3>
        <p style="font-size:24px; font-weight:bold; margin:0;">${totalRevenue.toFixed(2)} درهم</p>
      </div>
      <div style="background:${colors.b4}; color:${colors.fg}; padding:15px; border-radius:8px;">
        <h3>${t.paidTotal}</h3>
        <p style="font-size:24px; font-weight:bold; margin:0; color:${isDark ? '#c8f7c5' : 'green'};">${totalPaid.toFixed(2)} درهم</p>
      </div>
      <div style="background:${colors.b5}; color:${colors.fg}; padding:15px; border-radius:8px;">
        <h3>${t.unpaidTotal}</h3>
        <p style="font-size:24px; font-weight:bold; margin:0; color:${isDark ? '#ffcdd2' : 'red'};">${totalUnpaid.toFixed(2)} درهم</p>
      </div>
      <div style="background:${colors.b6}; color:${colors.fg}; padding:15px; border-radius:8px;">
        <h3>${t.avgConsumption}</h3>
        <p style="font-size:24px; font-weight:bold; margin:0;">${avgConsumption} طن/شهر</p>
      </div>
    </div>
    <br>
    <p style="text-align:center; color:${isDark ? '#bbb' : '#666'};">
      ${t.lastUpdate}: ${new Date().toLocaleDateString('ar-MA')} على الساعة ${new Date().toLocaleTimeString('ar-MA')}
    </p>
    <div style="text-align:center; margin-top:20px;">
      <button onclick="this.parentElement.parentElement.remove()" style="background:#00796b; color:white; border:none; padding:10px 20px; border-radius:5px;">
        ${t.close}
      </button>
    </div>
  `;

  document.body.appendChild(modal);
}

// =============== إضافة مستهلك ===============
function addUser(fullName, meterNumber, currentReading, phone, registrationDate) {
  const data = loadData();
  const newUser = {
    id: Date.now(),
    fullName: fullName,
    meterNumber: meterNumber,
    phone: phone,
    registrationDate: registrationDate,
    months: [
      {
        month: new Date().toLocaleDateString('ar-MA', { year: 'numeric', month: 'long' }),
        oldReading: 0,
        newReading: currentReading,
        consumption: currentReading,
        totalPrice: currentReading * data.pricePerTon,
        status: 'غير مدفوعة',
        date: new Date().toISOString()
      }
    ],
    date: new Date().toISOString()
  };

  data.users.push(newUser);
  saveData(data);
  updateUI();
}

// =============== واجهة المستخدم ===============
function updateUI() {
  const data = loadData();
  const tableBody = document.getElementById('tableBody');
  tableBody.innerHTML = '';

  const searchTerm = document.getElementById('searchInput').value.trim().toLowerCase();
  const filterStatus = document.getElementById('filterStatus').value;
  const lang = getCurrentLanguage();
  const t = translations[lang];

  let filteredUsers = data.users.filter(user => {
    const matchesSearch = !searchTerm || 
      user.fullName.toLowerCase().includes(searchTerm) || 
      user.meterNumber.toString().includes(searchTerm);
    
    let matchesFilter = true;
    if (filterStatus === 'مدفوعة') {
      // إظهار المستخدمين الذين جميع شهورهم مدفوعة
      matchesFilter = user.months.every(m => m.status === 'مدفوعة');
    } else if (filterStatus === 'غير مدفوعة') {
      // إظهار المستخدمين الذين لديهم شهر واحد على الأقل غير مدفوع
      matchesFilter = user.months.some(m => m.status === 'غير مدفوعة');
    }
    
    return matchesSearch && matchesFilter;
  });

  filteredUsers.forEach(user => {
    // Defensive check for months array
    if (!user.months || user.months.length === 0) return;
    
    const userStatus = user.months.some(m => m.status === 'غير مدفوعة') ? 'غير مدفوعة' : 'مدفوعة';
    const statusClass = userStatus === 'مدفوعة' ? 'status-paid' : 'status-unpaid';
    const unpaidCount = user.months.filter(m => m.status === 'غير مدفوعة').length;

    const row = document.createElement('tr');
    
    // Create cells with text content (safer than innerHTML for user data)
    const nameCell = document.createElement('td');
    nameCell.textContent = user.fullName;
    
    const meterCell = document.createElement('td');
    meterCell.textContent = user.meterNumber;
    
    const readingCell = document.createElement('td');
    readingCell.textContent = user.months[user.months.length - 1].newReading;
    
    const statusCell = document.createElement('td');
    statusCell.style.padding = '0';
    const statusDiv = document.createElement('div');
    statusDiv.className = statusClass;
    statusDiv.textContent = userStatus === 'مدفوعة' ? t.paidStatus : t.unpaidStatus;
    statusCell.appendChild(statusDiv);
    
    const unpaidCell = document.createElement('td');
    unpaidCell.style.fontWeight = 'bold';
    unpaidCell.style.color = unpaidCount > 0 ? '#c62828' : '#2e7d32';
    unpaidCell.textContent = unpaidCount;
    
    const actionsCell = document.createElement('td');
    actionsCell.innerHTML = `
      <button onclick="viewUser(${user.id})">${t.view}</button>
      <button onclick="addMonth(${user.id})">${t.addMonth}</button>
      <button onclick="printUserInvoice(${user.id})">${t.invoice}</button>
      <button onclick="printThermal(${user.id})">${t.thermal}</button>
      <button onclick="editUser(${user.id})">${t.edit}</button>
      <button onclick="deleteUser(${user.id})">${t.delete}</button>
    `;
    
    row.appendChild(nameCell);
    row.appendChild(meterCell);
    row.appendChild(readingCell);
    row.appendChild(statusCell);
    row.appendChild(unpaidCell);
    row.appendChild(actionsCell);
    
    tableBody.appendChild(row);
  });
}

// =============== إضافة مستهلك جديد ===============
document.getElementById('addBtn').addEventListener('click', () => {
  STATE.formMode = 'add';
  STATE.editingId = null;
  document.getElementById('addForm').style.display = 'block';
  document.getElementById('fullName').value = '';
  document.getElementById('meterNumber').value = '';
  document.getElementById('currentReading').value = '';
  document.getElementById('phone').value = '';
  document.getElementById('registrationDate').value = '';
});

document.getElementById('saveBtn').addEventListener('click', () => {
  const fullName = document.getElementById('fullName').value.trim();
  const meterNumber = parseInt(document.getElementById('meterNumber').value, 10);
  const currentReading = parseFloat(document.getElementById('currentReading').value);
  const phone = document.getElementById('phone').value.trim();
  const registrationDate = document.getElementById('registrationDate').value;

  if (!fullName || isNaN(meterNumber) || isNaN(currentReading) || !registrationDate) {
    alert('من فضلك املأ جميع الحقول بصحة!');
    return;
  }

  const data = loadData();

  if (STATE.formMode === 'add') {
    // منع تكرار رقم العداد عند الإضافة فقط
    const duplicateMeter = data.users.find(u => u.meterNumber === meterNumber);
    if (duplicateMeter) {
      alert(`⚠️ رقم العداد ${meterNumber} مستخدم من قبل: ${duplicateMeter.fullName}`);
      return;
    }
    if (currentReading < 0) {
      alert('من فضلك أدخل قراءة صحيحة!');
      return;
    }
    addUser(fullName, meterNumber, currentReading, phone, registrationDate);
    document.getElementById('addForm').style.display = 'none';
    STATE.formMode = 'add'; STATE.editingId = null;
    return;
  }

  if (STATE.formMode === 'edit' && STATE.editingId != null) {
    const user = data.users.find(u => u.id === STATE.editingId);
    if (!user) { alert('المستخدم غير موجود!'); return; }

    // منع تكرار رقم العداد مع استثناء الحالي
    const duplicateMeter = data.users.find(u => u.id !== STATE.editingId && u.meterNumber === meterNumber);
    if (duplicateMeter) {
      alert(`⚠️ رقم العداد ${meterNumber} مستخدم من قبل: ${duplicateMeter.fullName}`);
      return;
    }

    user.fullName = fullName;
    user.meterNumber = meterNumber;
    user.phone = phone;
    user.registrationDate = registrationDate;

    const lastMonth = user.months[user.months.length - 1];
    // نحافظ على سعر الطن الخاص بهذا الشهر (لا نستعمل السعر العالمي الجديد)
    const oldConsumption = lastMonth.consumption || 0;
    const oldTotalPrice = lastMonth.totalPrice || 0;
    let monthPricePerTon = data.pricePerTon;
    if (oldConsumption > 0 && oldTotalPrice > 0) {
      monthPricePerTon = oldTotalPrice / oldConsumption;
    }

    lastMonth.newReading = currentReading;
    lastMonth.consumption = Math.max(0, currentReading - lastMonth.oldReading);
    lastMonth.totalPrice = lastMonth.consumption * monthPricePerTon;

    saveData(data);
    updateUI();
    document.getElementById('addForm').style.display = 'none';
    const lang = getCurrentLanguage();
    document.querySelector('#addForm h3').textContent = lang === 'ar' ? 'إضافة مستهلك جديد' : 'Add New Customer';
    STATE.formMode = 'add'; STATE.editingId = null;
  }
});

document.getElementById('cancelBtn').addEventListener('click', () => {
  STATE.formMode = 'add';
  STATE.editingId = null;
  document.getElementById('addForm').style.display = 'none';
  const lang = getCurrentLanguage();
  document.querySelector('#addForm h3').textContent = lang === 'ar' ? 'إضافة مستهلك جديد' : 'Add New Customer';
});

// =============== حذف وتعديل ===============
function deleteUser(id) {
  const data = loadData();
  const user = data.users.find(u => u.id === id);
  if (!user) return;
  
  const lang = getCurrentLanguage();
  const confirmMsg = lang === 'ar' 
    ? `هل أنت متأكد من حذف ${user.fullName}؟`
    : `Are you sure you want to delete ${user.fullName}?`;
  
  if (!confirm(confirmMsg)) return;
  
  data.users = data.users.filter(user => user.id !== id);
  saveData(data);
  updateUI();
}

function editUser(id) {
  const data = loadData();
  const user = data.users.find(u => u.id === id);
  if (!user) return;

  STATE.formMode = 'edit';
  STATE.editingId = id;

  document.getElementById('addForm').style.display = 'block';
  document.querySelector('#addForm h3').textContent = getCurrentLanguage() === 'ar' ? 'تعديل بيانات مستهلك' : 'Edit Customer';
  document.getElementById('fullName').value = user.fullName;
  document.getElementById('meterNumber').value = user.meterNumber;
  document.getElementById('currentReading').value = user.months[user.months.length - 1].newReading;
  document.getElementById('phone').value = user.phone || '';
  document.getElementById('registrationDate').value = user.registrationDate;
}

// =============== عرض المستخدم ===============
function viewUser(id) {
  const data = loadData();
  const user = data.users.find(u => u.id === id);
  if (!user) return;

  const lang = getCurrentLanguage();
  const t = translations[lang];
  const title = lang === 'ar' ? `بيانات: ${user.fullName}` : `Details: ${user.fullName}`;
  const selectLabel = lang === 'ar' ? 'تحديد' : 'Select';
  const monthLabel = lang === 'ar' ? 'الشهر' : 'Month';
  const oldLabel = lang === 'ar' ? 'القراءة القديمة' : 'Old Reading';
  const newLabel = lang === 'ar' ? 'القراءة الجديدة' : 'New Reading';
  const consLabel = lang === 'ar' ? 'الاستهلاك' : 'Consumption';
  const priceLabel = lang === 'ar' ? 'التمن' : 'Price';
  const statusLabel = lang === 'ar' ? 'الحالة' : 'Status';
  const toggleLabel = lang === 'ar' ? 'تبديل' : 'Toggle';
  const deleteLabel = lang === 'ar' ? 'حذف' : 'Delete';
  const printAllLabel = lang === 'ar' ? '🖨️ طباعة كل الأشهر' : '🖨️ Print All Months';
  const printSelectedLabel = lang === 'ar' ? '🖨️ طباعة الأشهر المحددة' : '🖨️ Print Selected Months';
  const printSelectedThermalLabel = lang === 'ar' ? '🖨️ حرارية للأشهر المحددة' : '🖨️ Thermal for Selected';

  // New: details (phone and registration date) under the name
  const phoneLabel2 = lang === 'ar' ? 'الهاتف' : 'Phone';
  const regLabel2 = lang === 'ar' ? 'تاريخ التسجيل' : 'Registration Date';
  let regText = user.registrationDate || '';
  try {
    if (user.registrationDate) {
      const d = new Date(user.registrationDate);
      if (!isNaN(d.getTime())) regText = d.toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'en-US');
    }
  } catch (_) {}
  const phoneText = user.phone || (lang === 'ar' ? 'غير متوفر' : 'N/A');
  const detailsHTML = `<div style="margin:8px 0 16px 0; font-size:14px;">
    <div><strong>${phoneLabel2}:</strong> ${phoneText}</div>
    <div><strong>${regLabel2}:</strong> ${regText || '-'}</div>
  </div>`;

  let modalContent = `<h3>${title}</h3>${detailsHTML}<table border="1"><tr><th>${selectLabel}</th><th>${monthLabel}</th><th>${oldLabel}</th><th>${newLabel}</th><th>${consLabel}</th><th>${priceLabel}</th><th>${statusLabel}</th><th>تغيير الحالة</th><th>${deleteLabel}</th></tr>`;
  user.months.forEach((month, index) => {
    const statusColor = month.status === 'مدفوعة' ? 'green' : 'red';
    modalContent += `<tr>
      <td><input type=\"checkbox\" class=\"month-checkbox\" value=\"${index}\"></td>
      <td>${month.month}</td>
      <td>${month.oldReading}</td>
      <td>${month.newReading}</td>
      <td>${month.consumption}</td>
      <td>${month.totalPrice.toFixed(2)} درهم</td>
      <td style=\"color:${statusColor}\">${month.status}</td>
      <td><button onclick=\"toggleMonthStatus(${id}, ${index})\" style=\"background:#00796b; color:white; border:none; padding:5px 10px; border-radius:3px; cursor:pointer;\">🔄 ${toggleLabel}</button></td>
      <td><button onclick=\"deleteMonth(${id}, ${index})\" style=\"background:#d32f2f; color:white; border:none; padding:5px 10px; border-radius:3px; cursor:pointer;\">🗑️ ${deleteLabel}</button></td>
    </tr>`;
  });
  modalContent += `</table>
    <div style="margin-top:10px;">
      <button onclick="printUserDetails(${id})" style="margin:4px;">${printAllLabel}</button>
      <button onclick="printSelectedMonths(${id}, false)" style="margin:4px;">${printSelectedLabel}</button>
      <button onclick="printSelectedMonths(${id}, true)" style="margin:4px;">${printSelectedThermalLabel}</button>
    </div>`;

  const modal = document.createElement('div');
  modal.className = 'user-modal';
  modal.id = `user-modal-${id}`;
  modal.style.position = 'fixed';
  modal.style.top = '5%';
  modal.style.left = '5%';
  modal.style.width = '90%';
  modal.style.maxHeight = '90%';
  modal.style.overflow = 'auto';
  modal.style.backgroundColor = document.body.classList.contains('dark-mode') ? '#2a2a2a' : 'white';
  modal.style.color = document.body.classList.contains('dark-mode') ? 'white' : 'black';
  modal.style.padding = '20px';
  modal.style.border = '2px solid #00796b';
  modal.style.borderRadius = '10px';
  modal.style.zIndex = '1000';
  modal.style.direction = 'rtl';
  modal.innerHTML = modalContent + '<br><button onclick=\"document.body.removeChild(this.parentElement)\" style=\"background:#00796b; color:white; border:none; padding:10px 20px; border-radius:5px; cursor:pointer;\">❌ إغلاق</button>';

  document.body.appendChild(modal);
}

// =============== حذف شهر محدد ===============
function deleteMonth(userId, monthIndex) {
  const data = loadData();
  const user = data.users.find(u => u.id === userId);
  if (!user || !user.months[monthIndex]) return;
  if (user.months.length <= 1) { alert('لا يمكن حذف آخر شهر للمستخدم.'); return; }
  const month = user.months[monthIndex];
  const lang = getCurrentLanguage();
  const confirmMsg = lang === 'ar' ? `هل تريد حذف شهر ${month.month}؟` : `Delete month ${month.month}?`;
  if (!confirm(confirmMsg)) return;
  user.months.splice(monthIndex, 1);
  saveData(data);
  updateUI();
  const modals = document.querySelectorAll('.user-modal');
  modals.forEach(m => m.remove());
  viewUser(userId);
}

// =============== طباعة جميع بيانات المستخدم ===============
function printUserDetails(id) {
  const data = loadData();
  const user = data.users.find(u => u.id === id);
  if (!user || !user.months || user.months.length === 0) return;

  let tableRows = '';
  user.months.forEach(month => {
    const statusColor = month.status === 'مدفوعة' ? 'green' : 'red';
    tableRows += `
      <tr>
        <td>${month.month}</td>
        <td>${month.oldReading}</td>
        <td>${month.newReading}</td>
        <td>${month.consumption}</td>
        <td>${month.totalPrice.toFixed(2)} درهم</td>
        <td style="color:${statusColor}; font-weight:bold;">${month.status}</td>
      </tr>
    `;
  });

  const invoiceContent = `
    <div style="text-align:center; margin-bottom:20px;">
      <h2>${ASSOCIATION_NAME}</h2>
    </div>
    <h2>فاتورة استهلاك الماء - جميع الأشهر</h2>
    <p><strong>الاسم:</strong> ${user.fullName}</p>
    <p><strong>رقم العداد:</strong> ${user.meterNumber}</p>
    <p><strong>التاريخ:</strong> ${new Date().toLocaleDateString('ar-MA')}</p>
    <br>
    <table>
      <thead>
        <tr>
          <th>الشهر</th>
          <th>القراءة القديمة</th>
          <th>القراءة الجديدة</th>
          <th>الاستهلاك (طن)</th>
          <th>التمن (درهم)</th>
          <th>الحالة</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
    <br>
    <p style="text-align:center; font-size:14px;">شكراً لثقتكم ✨</p>
  `;

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
      <head>
        <meta charset="UTF-8">
        <title>فاتورة - ${user.fullName}</title>
        <style>
          * { box-sizing: border-box; }
          @page { 
            size: A4;
            margin: 20mm;
          }
          body { 
            font-family: 'Traditional Arabic', 'Arial', sans-serif; 
            padding: 20px; 
            direction: rtl;
            margin: 0;
            background: white;
          }
          h2 { 
            color: #2d3748;
            margin: 10px 0;
          }
          p {
            margin: 8px 0;
            font-size: 16px;
          }
          table { 
            width: 100%; 
            border-collapse: collapse;
            margin: 20px 0;
            page-break-inside: avoid;
          }
          th, td { 
            padding: 12px; 
            text-align: center; 
            border: 2px solid #333;
            font-size: 14px;
          }
          th {
            background-color: #667eea;
            color: white;
            font-weight: bold;
          }
          @media print {
            body { padding: 0; }
            @page { margin: 15mm; }
          }
        </style>
      </head>
      <body>
        ${invoiceContent}
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 250);
}

// =============== تبديل حالة الشهر ===============
function toggleMonthStatus(userId, monthIndex) {
  const data = loadData();
  const user = data.users.find(u => u.id === userId);
  if (!user || !user.months[monthIndex]) return;

  const month = user.months[monthIndex];
  month.status = month.status === 'مدفوعة' ? 'غير مدفوعة' : 'مدفوعة';
  
  saveData(data);
  updateUI();
  
  // إغلاق النافذة الحالية وإعادة فتحها
  const modals = document.querySelectorAll('.user-modal');
  modals.forEach(m => m.remove());
  viewUser(userId);
}

// =============== طباعة حرارية ===============
function printThermal(id) {
  const data = loadData();
  const user = data.users.find(u => u.id === id);
  if (!user || user.months.length === 0) return;

  const lang = getCurrentLanguage();
  const t = translations[lang];

  const modal = document.createElement('div');
  modal.style.position = 'fixed';
  modal.style.top = '20%';
  modal.style.left = '25%';
  modal.style.width = '50%';
  modal.style.backgroundColor = document.body.classList.contains('dark-mode') ? '#2a2a2a' : 'white';
  modal.style.color = document.body.classList.contains('dark-mode') ? 'white' : 'black';
  modal.style.padding = '20px';
  modal.style.borderRadius = '10px';
  modal.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
  modal.style.zIndex = '2000';
  modal.style.direction = 'rtl';

  let options = '';
  user.months.forEach((month, index) => {
    options += `<option value="${index}">${month.month}</option>`;
  });

  modal.innerHTML = `
    <h3>${t.selectMonth}</h3>
    <select id="monthSelectThermal" style="width:100%; padding:8px; margin:10px 0; background:${document.body.classList.contains('dark-mode') ? '#333' : 'white'}; color:${document.body.classList.contains('dark-mode') ? 'white' : 'black'};">
      ${options}
    </select>
    <br>
    <button id="confirmThermalPrint" style="background:#555; color:white; border:none; padding:10px 15px; border-radius:5px; margin:5px;">${t.printThermal}</button>
    <button id="cancelThermalPrint" style="background:#d32f2f; color:white; border:none; padding:10px 15px; border-radius:5px; margin:5px;">❌ إلغاء</button>
  `;

  document.body.appendChild(modal);

  function closeModal() {
    document.body.removeChild(modal);
  }

  document.getElementById('confirmThermalPrint').addEventListener('click', () => {
    const selectedIndex = document.getElementById('monthSelectThermal').value;
    const month = user.months[selectedIndex];
    closeModal();
    printSingleInvoice(user, month, true);
  });

  document.getElementById('cancelThermalPrint').addEventListener('click', closeModal);
}

// =============== إضافة شهر ===============
function addMonth(id) {
  const data = loadData();
  const user = data.users.find(u => u.id === id);
  if (!user) return;

  const lang = getCurrentLanguage();
  const t = translations[lang];
  
  // حساب الشهر التالي بناءً على آخر شهر
  const lastMonth = user.months[user.months.length - 1];
  const lastMonthDate = lastMonth.date ? new Date(lastMonth.date) : new Date();
  
  // إضافة شهر واحد
  const nextMonthDate = new Date(lastMonthDate);
  nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
  
  const monthName = nextMonthDate.toLocaleDateString('ar-MA', { year: 'numeric', month: 'long' });
  
  // فحص إذا كان الشهر موجود بالفعل
  const monthExists = user.months.some(m => m.month === monthName);
  if (monthExists) {
    alert(`⚠️ الشهر ${monthName} موجود بالفعل!`);
    return;
  }
  
  const oldReading = lastMonth.newReading;
  const newReading = prompt(`أدخل القراءة الجديدة لشهر ${monthName}:`, oldReading);
  
  if (newReading === null) return; // المستخدم ضغط إلغاء
  
  const newReadingNum = parseFloat(newReading);
  if (isNaN(newReadingNum)) {
    alert('من فضلك أدخل قراءة صحيحة!');
    return;
  }
  
  if (newReadingNum < oldReading) {
    const confirmNegative = confirm('القراءة الجديدة أقل من القديمة. هل تريد المتابعة؟');
    if (!confirmNegative) return;
  }

  const consumption = Math.max(0, newReadingNum - oldReading);
  const totalPrice = consumption * data.pricePerTon;

  user.months.push({
    month: monthName,
    oldReading: oldReading,
    newReading: newReadingNum,
    consumption: consumption,
    totalPrice: totalPrice,
    status: 'غير مدفوعة',
    date: nextMonthDate.toISOString()
  });

  saveData(data);
  updateUI();
  alert(`✅ تم إضافة شهر ${monthName} بنجاح!`);
}

// =============== طباعة فاتورة شهر واحد ===============
function printUserInvoice(id) {
  const data = loadData();
  const user = data.users.find(u => u.id === id);
  if (!user || user.months.length === 0) return;

  const lang = getCurrentLanguage();
  const t = translations[lang];

  const modal = document.createElement('div');
  modal.style.position = 'fixed';
  modal.style.top = '20%';
  modal.style.left = '25%';
  modal.style.width = '50%';
  modal.style.backgroundColor = document.body.classList.contains('dark-mode') ? '#2a2a2a' : 'white';
  modal.style.color = document.body.classList.contains('dark-mode') ? 'white' : 'black';
  modal.style.padding = '20px';
  modal.style.borderRadius = '10px';
  modal.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
  modal.style.zIndex = '2000';
  modal.style.direction = 'rtl';

  let options = '';
  user.months.forEach((month, index) => {
    options += `<option value="${index}">${month.month}</option>`;
  });

  modal.innerHTML = `
    <h3>${t.selectMonth}</h3>
    <select id="monthSelect" style="width:100%; padding:8px; margin:10px 0; background:${document.body.classList.contains('dark-mode') ? '#333' : 'white'}; color:${document.body.classList.contains('dark-mode') ? 'white' : 'black'};">
      ${options}
    </select>
    <br>
    <button id="confirmPrint" style="background:#00796b; color:white; border:none; padding:10px 15px; border-radius:5px; margin:5px;">${t.printNormal}</button>
    <button id="confirmThermal" style="background:#555; color:white; border:none; padding:10px 15px; border-radius:5px; margin:5px;">${t.printThermal}</button>
    <button id="cancelPrint" style="background:#d32f2f; color:white; border:none; padding:10px 15px; border-radius:5px; margin:5px;">❌ إلغاء</button>
  `;

  document.body.appendChild(modal);

  function closeModal() {
    document.body.removeChild(modal);
  }

  document.getElementById('confirmPrint').addEventListener('click', () => {
    const selectedIndex = document.getElementById('monthSelect').value;
    const month = user.months[selectedIndex];
    closeModal();
    printSingleInvoice(user, month, false);
  });

  document.getElementById('confirmThermal').addEventListener('click', () => {
    const selectedIndex = document.getElementById('monthSelect').value;
    const month = user.months[selectedIndex];
    closeModal();
    printSingleInvoice(user, month, true);
  });

  document.getElementById('cancelPrint').addEventListener('click', closeModal);
}

// =============== طباعة الأشهر المحددة (عادي/حراري) ===============
function printSelectedMonths(userId, isThermal) {
  const data = loadData();
  const user = data.users.find(u => u.id === userId);
  if (!user || !user.months || user.months.length === 0) return;
  const modal = document.getElementById(`user-modal-${userId}`);
  if (!modal) return;
  const selected = Array.from(modal.querySelectorAll('.month-checkbox:checked')).map(cb => parseInt(cb.value, 10));
  if (selected.length === 0) { alert(getCurrentLanguage() === 'ar' ? 'اختر شهراً واحداً على الأقل' : 'Select at least one month'); return; }
  const months = selected.map(i => user.months[i]);

  if (isThermal) {
    let text = "";
    text += (typeof thermalCenter==='function'?thermalCenter(ASSOCIATION_NAME):ASSOCIATION_NAME) + "\n";
    text += "================================\n";
    text += "فاتورة استهلاك الماء (مختارة)\n";
    text += "--------------------------------\n";
    text += `الاسم: ${user.fullName}\n`;
    text += `العداد: ${user.meterNumber}\n`;
    text += `التاريخ: ${new Date().toLocaleDateString('ar-MA')}\n`;
    text += "--------------------------------\n";
    text += "الشهر      الاستهلاك   التمن\n";
    months.forEach(m => {
      const monthShort = m.month.length > 10 ? m.month.substring(0,10) : m.month;
      const cons = (m.consumption || 0).toFixed(1).padStart(6);
      const price = (m.totalPrice || 0).toFixed(2).padStart(8);
      text += `${monthShort} ${cons} طن ${price} درهم\n`;
    });
    const sumCons = months.reduce((s,m)=>s+(m.consumption||0),0);
    const sumPrice = months.reduce((s,m)=>s+(m.totalPrice||0),0);
    text += "--------------------------------\n";
    text += `المجموع: ${sumCons.toFixed(1).padStart(6)} طن ${sumPrice.toFixed(2).padStart(8)} درهم\n`;
    text += "================================\n";
    text += "شكراً لثقتكم\n";

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>فواتير حرارية - مختارة</title>
          <style>
body { font-family: 'Courier New', monospace; font-size: 14px; line-height: 1.4; width: 58mm; margin:0; padding:5mm; direction:ltr; white-space: pre; word-wrap: break-word; }
            @media print { body { width:58mm; margin:0; padding:0; } }
          </style>
        </head>
        <body>${text}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  } else {
    let rows = '';
    months.forEach(m => {
      const statusColor = m.status === 'مدفوعة' ? 'green' : 'red';
      rows += `
        <tr>
          <td>${m.month}</td>
          <td>${m.oldReading}</td>
          <td>${m.newReading}</td>
          <td>${m.consumption}</td>
          <td>${(m.totalPrice||0).toFixed(2)} درهم</td>
          <td style="color:${statusColor}">${m.status}</td>
        </tr>`;
    });
    const invoiceContent = `
      <div style="text-align:center; margin-bottom:20px;">
        <h2>${ASSOCIATION_NAME}</h2>
      </div>
      <h2>فاتورة استهلاك الماء - أشهر محددة</h2>
      <p><strong>الاسم:</strong> ${user.fullName}</p>
      <p><strong>رقم العداد:</strong> ${user.meterNumber}</p>
      <p><strong>التاريخ:</strong> ${new Date().toLocaleDateString('ar-MA')}</p>
      <br>
      <table>
        <thead>
          <tr>
            <th>الشهر</th>
            <th>القراءة القديمة</th>
            <th>القراءة الجديدة</th>
            <th>الاستهلاك (طن)</th>
            <th>التمن (درهم)</th>
            <th>الحالة</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <br>
      <p style="text-align:center; font-size:14px;">شكراً لثقتكم ✨</p>`;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <meta charset="UTF-8">
          <title>فواتير - أشهر محددة</title>
          <style>
            * { box-sizing: border-box; }
            @page { size: A4; margin: 20mm; }
            body { font-family: 'Traditional Arabic','Arial',sans-serif; padding:20px; direction:rtl; margin:0; background:white; }
            h2 { color:#2d3748; margin:10px 0; }
            p { margin:8px 0; font-size:16px; }
            table { width:100%; border-collapse: collapse; margin: 20px 0; page-break-inside: avoid; }
            th, td { padding:12px; text-align:center; border:2px solid #333; font-size:14px; }
            th { background-color:#667eea; color:white; font-weight:bold; }
            @media print { body { padding:0; } @page { margin:15mm; } }
          </style>
        </head>
        <body>${invoiceContent}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 250);
  }
}

// =============== دالة الطباعة الموحدة ===============
function printSingleInvoice(user, month, isThermal) {
  const lang = getCurrentLanguage();
  const t = translations[lang];

  if (isThermal) {
    let text = "";
    text += (typeof thermalCenter==='function'?thermalCenter(ASSOCIATION_NAME):ASSOCIATION_NAME) + "\n";
    text += "================================\n";
    text += "فاتورة استهلاك الماء\n";
    text += "--------------------------------\n";
    text += `الاسم: ${user.fullName}\n`;
    text += `العداد: ${user.meterNumber}\n`;
    text += `التاريخ: ${new Date().toLocaleDateString('ar-MA')}\n`;
    text += "--------------------------------\n";
    text += "الشهر      الاستهلاك   التمن\n";
    
    const monthShort = month.month.length > 10 ? month.month.substring(0,10) : month.month;
    const cons = month.consumption.toFixed(1).padStart(6);
    const price = month.totalPrice.toFixed(2).padStart(8);
    text += `${monthShort} ${cons} طن ${price} درهم\n`;

    text += "--------------------------------\n";
    text += `المجموع: ${month.consumption.toFixed(1).padStart(6)} طن ${month.totalPrice.toFixed(2).padStart(8)} درهم\n`;
    const status = month.status === 'مدفوعة' ? 'مدفوعة' : 'غير مدفوعة';
    text += `الحالة: ${status}\n`;
    text += "================================\n";
    text += "شكراً لثقتكم\n";

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>فاتورة حرارية - ${month.month}</title>
          <style>
            body {
              font-family: 'Courier New', monospace;
              font-size: 14px;
              line-height: 1.4;
              width: 58mm;
              margin: 0;
              padding: 5mm;
              direction: ltr;
              white-space: pre;
              word-wrap: break-word;
            }
            @media print {
              body { 
                width: 58mm; 
                margin: 0; 
                padding: 0; 
              }
            }
          </style>
        </head>
        <body>${text}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  } else {
    let invoiceContent = `
      <div style="text-align:center; margin-bottom:20px;">
        <h2>${ASSOCIATION_NAME}</h2>
      </div>
      <h2>فاتورة استهلاك الماء</h2>
      <p><strong>الاسم:</strong> ${user.fullName}</p>
      <p><strong>رقم العداد:</strong> ${user.meterNumber}</p>
      <p><strong>التاريخ:</strong> ${new Date().toLocaleDateString('ar-MA')}</p>
      <br>
      <table border="1" style="width:100%; border-collapse: collapse;">
        <tr>
          <th>الشهر</th>
          <th>القراءة القديمة</th>
          <th>القراءة الجديدة</th>
          <th>الاستهلاك (طن)</th>
          <th>التمن (درهم)</th>
          <th>الحالة</th>
        </tr>
        <tr>
          <td>${month.month}</td>
          <td>${month.oldReading}</td>
          <td>${month.newReading}</td>
          <td>${month.consumption}</td>
          <td>${month.totalPrice.toFixed(2)}</td>
          <td style="color:${month.status === 'مدفوعة' ? 'green' : 'red'}">${month.status}</td>
        </tr>
      </table>
      <br>
      <p style="text-align:center; font-size:14px;">شكراً لثقتكم ✨</p>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <meta charset="UTF-8">
          <title>فاتورة - ${month.month}</title>
          <style>
            * { box-sizing: border-box; }
            @page { 
              size: A4;
              margin: 20mm;
            }
            body { 
              font-family: 'Traditional Arabic', 'Arial', sans-serif; 
              padding: 20px; 
              direction: rtl;
              margin: 0;
              background: white;
            }
            h2 { 
              color: #2d3748;
              margin: 10px 0;
            }
            p {
              margin: 8px 0;
              font-size: 16px;
            }
            table { 
              width: 100%; 
              border-collapse: collapse;
              margin: 20px 0;
              page-break-inside: avoid;
            }
            th, td { 
              padding: 12px; 
              text-align: center; 
              border: 2px solid #333;
              font-size: 14px;
            }
            th {
              background-color: #667eea;
              color: white;
              font-weight: bold;
            }
            @media print {
              body { padding: 0; }
              @page { margin: 15mm; }
            }
          </style>
        </head>
        <body>
          ${invoiceContent}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }
}

// =============== ترتيب الجدول ===============
let sortDirection = {};
function sortTable(columnIndex) {
  const data = loadData();
  sortDirection[columnIndex] = sortDirection[columnIndex] === 'asc' ? 'desc' : 'asc';
  
  data.users.sort((a, b) => {
    let aVal, bVal;
    
    if (columnIndex === 0) { // الاسم
      aVal = a.fullName;
      bVal = b.fullName;
    } else if (columnIndex === 1) { // رقم العداد
      aVal = a.meterNumber;
      bVal = b.meterNumber;
    } else if (columnIndex === 2) { // القراءة الحالية
      aVal = a.months[a.months.length - 1].newReading;
      bVal = b.months[b.months.length - 1].newReading;
    } else if (columnIndex === 3) { // الحالة
      aVal = a.months.some(m => m.status === 'غير مدفوعة') ? 'غير مدفوعة' : 'مدفوعة';
      bVal = b.months.some(m => m.status === 'غير مدفوعة') ? 'غير مدفوعة' : 'مدفوعة';
    } else if (columnIndex === 4) { // عدد الأشهر غير المدفوعة
      aVal = a.months.filter(m => m.status === 'غير مدفوعة').length;
      bVal = b.months.filter(m => m.status === 'غير مدفوعة').length;
    }
    
    if (typeof aVal === 'string') { 
      aVal = aVal.toLowerCase(); 
      bVal = bVal.toLowerCase(); 
    }
    
    return sortDirection[columnIndex] === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
  });
  
  saveData(data);
  updateUI();
}

// =============== البحث والفلترة ===============
document.getElementById('searchInput').addEventListener('input', updateUI);
document.getElementById('filterStatus').addEventListener('change', updateUI);

// =============== تغيير سعر الطن ===============
document.getElementById('changePriceBtn').addEventListener('click', () => {
  document.getElementById('changePriceForm').style.display = 'block';
  document.getElementById('newPricePerTon').value = loadData().pricePerTon;
});

document.getElementById('applyPriceBtn').addEventListener('click', () => {
  const newPrice = parseFloat(document.getElementById('newPricePerTon').value);
  if (isNaN(newPrice) || newPrice < 0) {
    alert('من فضلك أدخل سعر صحيح!');
    return;
  }
  const data = loadData();
  // فقط نحدّث سعر الطن المستقبلي، ولا نعيد حساب الأشهر القديمة
  data.pricePerTon = newPrice;
  saveData(data);
  updateUI();
  document.getElementById('changePriceForm').style.display = 'none';
});

document.getElementById('cancelPriceBtn').addEventListener('click', () => {
  document.getElementById('changePriceForm').style.display = 'none';
});

// =============== طباعة جميع الفواتير ===============
document.getElementById('printAllBtn').addEventListener('click', () => {
  const data = loadData();
  if (data.users.length === 0) { alert('ما عندكش مستخدمين!'); return; }
  let printContent = `<div style=\"text-align:center;\"><h2>${ASSOCIATION_NAME}</h2></div><h2>جميع فواتير استهلاك الماء</h2>`;
  data.users.forEach(user => {
    printContent += `<h3>${user.fullName} - رقم العداد: ${user.meterNumber}</h3><table border="1" style="width:100%; border-collapse: collapse;"><tr><th>الشهر</th><th>القراءة القديمة</th><th>القراءة الجديدة</th><th>الاستهلاك</th><th>التمن</th><th>الحالة</th></tr>`;
    user.months.forEach(month => {
      const statusColor = month.status === 'مدفوعة' ? 'green' : 'red';
      printContent += `<tr><td>${month.month}</td><td>${month.oldReading}</td><td>${month.newReading}</td><td>${month.consumption}</td><td>${month.totalPrice.toFixed(2)} درهم</td><td style="color:${statusColor}">${month.status}</td></tr>`;
    });
    printContent += `</table><br>`;
  });
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
      <head>
        <meta charset="UTF-8">
        <title>جميع الفواتير</title>
        <style>
          * { box-sizing: border-box; }
          @page { 
            size: A4;
            margin: 15mm;
          }
          body {
            font-family: 'Traditional Arabic', 'Arial', sans-serif;
            padding: 20px;
            direction: rtl;
            background: white;
            margin: 0;
          }
          h2, h3 {
            color: #2d3748;
            margin: 15px 0 10px 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0 30px 0;
            page-break-inside: avoid;
          }
          th, td {
            padding: 10px;
            text-align: center;
            border: 2px solid #333;
            font-size: 13px;
          }
          th {
            background-color: #667eea;
            color: white;
            font-weight: bold;
          }
          @media print {
            body { padding: 10px; }
            h3 { page-break-after: avoid; }
          }
        </style>
      </head>
      <body>${printContent}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 250);
});

// =============== تصدير واستيراد (JSON) ===============
document.getElementById('exportBtn').addEventListener('click', () => {
  const data = loadData();
  const dataStr = JSON.stringify(data, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'water-consumption-data.json';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
});

document.getElementById('importBtn').addEventListener('click', () => {
  document.getElementById('importFile').click();
});

document.getElementById('importFile').addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      // Validate imported data structure
      if (!imported.users || !Array.isArray(imported.users)) {
        alert('❌ الملف غير صالح: بنية بيانات خاطئة!');
        return;
      }
      // Validate each user has required fields
      const valid = imported.users.every(u => 
        u.fullName && u.meterNumber && u.months && Array.isArray(u.months)
      );
      if (!valid) {
        alert('❌ الملف غير صالح: بيانات ناقصة!');
        return;
      }
      saveData(imported);
      updateUI();
      alert('✅ البيانات استوردات بنجاح!');
    } catch (err) {
      alert('❌ الملف غير صالح!');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
});

// ===================== تصدير/استيراد Excel =====================
// Lazy loader for SheetJS in case the CDN script didn't load for any reason
function loadXLSX() {
  return new Promise((resolve, reject) => {
    if (window.XLSX) return resolve(window.XLSX);
    const tryLoad = (src, next) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve(window.XLSX);
      s.onerror = () => next();
      document.head.appendChild(s);
    };
    // Try CDN, then unpkg, then local vendor copy
    tryLoad('https://cdn.jsdelivr.net/npm/xlsx@0.20.2/dist/xlsx.full.min.js', () =>
      tryLoad('https://unpkg.com/xlsx@0.20.2/dist/xlsx.full.min.js', () =>
        tryLoad('./vendor/xlsx.full.min.js', () => reject(new Error('Failed to load Excel library')))
      )
    );
  });
}

// Lazy loader for ExcelJS + FileSaver (for styled workbooks)
function loadExcelJS() {
  return new Promise((resolve, reject) => {
    function ready() {
      if (window.ExcelJS && window.saveAs) return resolve(window.ExcelJS);
    }
    if (ready()) return;
    const tryLoadExcel = (src, next) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => next();
      s.onerror = () => next(true);
      document.head.appendChild(s);
    };
    const tryLoadSaver = (src, done) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => done();
      s.onerror = () => done(true);
      document.head.appendChild(s);
    };
    // Try CDN ExcelJS then FileSaver; fall back to local vendor copies
    tryLoadExcel('https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js', (err1) => {
      const excelLocal = () => tryLoadExcel('./vendor/exceljs.min.js', (errLocal) => {
        if (errLocal) return reject(new Error('ExcelJS load error'));
        // load saver after local excel
        tryLoadSaver('./vendor/FileSaver.min.js', (errSaver) => {
          if (errSaver) return reject(new Error('FileSaver load error'));
          ready();
        });
      });
      const loadSaverCdn = () => tryLoadSaver('https://cdn.jsdelivr.net/npm/file-saver@2.0.5/dist/FileSaver.min.js', (err2) => {
        if (err2) {
          // try local filesaver
          tryLoadSaver('./vendor/FileSaver.min.js', (err3) => {
            if (err3) return reject(new Error('FileSaver load error'));
            ready();
          });
        } else { ready(); }
      });
      if (err1) {
        // try local exceljs then local/cdn filesaver
        excelLocal();
      } else {
        // exceljs ok; now load filesaver from cdn then local
        loadSaverCdn();
      }
    });
  });
}


function frMonthLabels() {
  return ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
}
function monthIndexFromFr(label) {
  const arr = frMonthLabels();
  const idx = arr.findIndex(m => (label||'').toString().toLowerCase().startsWith(m));
  return idx; // 0..11 or -1
}
// Accept FR/EN/AR month names or numeric 1..12
function monthIndexFromAny(val) {
  if (val == null) return -1;
  if (typeof val === 'number') { const n = Math.round(val); return (n>=1 && n<=12) ? n-1 : -1; }
  const s = val.toString().trim().toLowerCase();
  // numeric as string
  const n = parseInt(s, 10); if (!isNaN(n) && n>=1 && n<=12) return n-1;
  // fr
  const fr = frMonthLabels();
  let i = fr.findIndex(m => s.startsWith(m)); if (i>=0) return i;
  // en
  const en = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  i = en.findIndex(m => s.startsWith(m)); if (i>=0) return i;
  // ar (common MA variants)
  const ar = ['يناير','فبراير','مارس','أبريل','ابريل','ماي','يونيو','يوليوز','غشت','شتنبر','أكتوبر','اكتوبر','نونبر','دجنبر'];
  const arMap = {0:0,1:1,2:2,3:3,4:3,5:4,6:5,7:6,8:7,9:8,10:9,11:9,12:10,13:11};
  for (let k=0;k<ar.length;k++){ if (s.includes(ar[k])) return arMap[k]; }
  return -1;
}

function isValidDateObj(d) { return d instanceof Date && !isNaN(d.getTime()); }
function excelSerialToISOString(n) {
  // Excel serial date (days since 1899-12-30). Supports fractions (time)
  const epoch = Date.UTC(1899, 11, 30);
  const ms = Math.round(Number(n) * 86400000);
  return new Date(epoch + ms).toISOString();
}
function normalizeISODate({year, monthIndex, isoCandidate, monthText}) {
  // 1) If isoCandidate is Date or numeric excel serial or parseable string
  if (isoCandidate instanceof Date && isValidDateObj(isoCandidate)) return isoCandidate.toISOString();
  if (typeof isoCandidate === 'number' && isoCandidate > 20000) {
    try { return excelSerialToISOString(isoCandidate); } catch(_) {}
  }
  if (typeof isoCandidate === 'string' && isoCandidate.trim()) {
    // Try YYYY-MM, YYYY/MM, MM/YYYY, DD/MM/YYYY
    const s = isoCandidate.trim();
    let m = s.match(/^(\d{4})[-\/.](\d{1,2})/); // YYYY-MM
    if (m) { const y = parseInt(m[1],10), mi = parseInt(m[2],10)-1; if (!isNaN(y) && mi>=0 && mi<12) return new Date(Date.UTC(y, mi, 1)).toISOString(); }
    m = s.match(/^(\d{1,2})[-\/.](\d{4})$/); // MM-YYYY
    if (m) { const mi = parseInt(m[1],10)-1, y = parseInt(m[2],10); if (!isNaN(y) && mi>=0 && mi<12) return new Date(Date.UTC(y, mi, 1)).toISOString(); }
    // Try Date.parse fallback
    const d = new Date(s);
    if (isValidDateObj(d)) return d.toISOString();
  }
  // 2) Build from explicit year/monthIndex
  if (typeof year === 'number' && !isNaN(year)) {
    let mi = monthIndex;
    if (mi == null && monthText != null) mi = monthIndexFromAny(monthText);
    if (typeof mi === 'number' && mi>=0 && mi<12) return new Date(Date.UTC(year<100?2000+year:year, mi, 1)).toISOString();
  }
  // 3) Build from monthText alone if includes year
  if (monthText) {
    const s = monthText.toString();
    const m = s.match(/(\d{2,4})/);
    const yy = m ? parseInt(m[1],10) : NaN;
    const mi = monthIndexFromAny(s);
    if (!isNaN(yy) && mi>=0) return new Date(Date.UTC(yy<100?2000+yy:yy, mi, 1)).toISOString();
  }
  // 4) Fallback to first day of current month to avoid Invalid Date
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}
function ymFromMonthObj(m) {
  try {
    if (m.date) {
      const d = new Date(m.date);
      return { y: d.getFullYear(), m: d.getMonth() };
    }
  } catch (_) {}
  // fallback: try to parse Arabic month text as current year (approx)
  const d = new Date();
  return { y: d.getFullYear(), m: d.getMonth() };
}

function collectYears(data) {
  const years = new Set();
  data.users.forEach(u => (u.months||[]).forEach(m => { try { if (m.date) years.add(new Date(m.date).getFullYear()); } catch(_){} }));
  if (years.size === 0) years.add(new Date().getFullYear());
  return Array.from(years).sort((a,b)=>a-b);
}

function buildSummary(data) {
  const years = collectYears(data);
  const fr = frMonthLabels();
  const header = ['N° Compteur','Adhérent'];
  const meta = [{kind:'meter'},{kind:'name'}];
  years.forEach(y => {
    for (let mi=0; mi<12; mi++) { header.push(`${fr[mi]}-${String(y).slice(2)}`); meta.push({kind:'month', year:y, mi}); }
    header.push('مجموع الأشهر'); meta.push({kind:'sumTons', year:y});
    header.push('المجموع بدرهم'); meta.push({kind:'sumMAD', year:y});
    header.push('عدد الأشهر غير المدفوعة'); meta.push({kind:'unpaidCount', year:y});
    header.push('ثمن الأشهر غير المدفوعة'); meta.push({kind:'unpaidMAD', year:y});
  });
  const rows = [header];
  const status = [];
  data.users.forEach(u => {
    const r = [u.meterNumber, u.fullName];
    const sRow = [];
    years.forEach(y => {
      for (let mi=0; mi<12; mi++) {
        const mrec = (u.months||[]).find(mm => { const ym = ymFromMonthObj(mm); return ym.y===y && ym.m===mi; });
        if (mrec) {
          // الاستهلاك بالطن كعدد صحيح
          r.push(Math.round(mrec.consumption||0));
          sRow.push(mrec.status||'');
        } else {
          r.push('');
          sRow.push('');
        }
      }
      const yearMonths = (u.months||[]).filter(mm => { const ym = ymFromMonthObj(mm); return ym.y===y; });
      const sumTons = yearMonths.reduce((s,mm)=> s + Math.round(mm.consumption||0), 0);
      const sumAllMAD = yearMonths.reduce((s,mm)=> s + (mm.totalPrice||0), 0);
      const unpaidCount = yearMonths.filter(mm => (mm.status==='غير مدفوعة')).length;
      const unpaidMAD = yearMonths.reduce((s,mm)=> s + ((mm.status==='غير مدفوعة') ? (mm.totalPrice||0) : 0), 0);
      r.push(sumTons);
      r.push(Number(sumAllMAD.toFixed(2)));
      r.push(unpaidCount);
      r.push(Number(unpaidMAD.toFixed(2)));
    });
    rows.push(r);
    status.push(sRow);
  });
  return { rows, meta, status };
}

function buildSummaryRows(data) {
  return buildSummary(data).rows;
}

// Build normalized transaction rows for import/export compatibility
function buildTransactionRows(data) {
  const rows = [];
  const fr = frMonthLabels();
  data.users.forEach(u => {
    (u.months||[]).forEach(m => {
      const d = m.date ? new Date(m.date) : new Date();
      // استنتاج سعر الطن لكل شهر من التمن والاستهلاك (للحفاظ على الأسعار القديمة)
      const cons = m.consumption || 0;
      const inferredPrice = cons > 0 ? (m.totalPrice || 0) / cons : data.pricePerTon;
      rows.push({
        MeterNumber: u.meterNumber,
        FullName: u.fullName,
        Phone: u.phone || '',
        RegistrationDate: u.registrationDate || '',
        Year: d.getFullYear(),
        Month: fr[d.getMonth()],
        OldReading: m.oldReading || 0,
        NewReading: m.newReading || 0,
        Consumption: cons,
        PricePerTon: Number(inferredPrice.toFixed(4)),
        TotalPrice: m.totalPrice || 0,
        Status: m.status || '',
        ISODate: m.date || ''
      });
    });
  });
  return rows;
}

function downloadBlob(content, mime, filename) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
}

function exportSummaryAsHtmlXls() {
  const rows = buildSummaryRows(loadData());
  let html = '<html><head><meta charset="UTF-8"></head><body><table border="1">';
  rows.forEach(r => { html += '<tr>' + r.map(c => `<td>${c ?? ''}</td>`).join('') + '</tr>'; });
  html += '</table></body></html>';
  downloadBlob(html, 'application/vnd.ms-excel', 'water-consumption.xls');
}


function exportToExcelStyled() {
  if (typeof ExcelJS === 'undefined' || typeof saveAs === 'undefined') { throw new Error('ExcelJS not available'); }
  const data = loadData();
  const { rows, meta, status } = buildSummary(data);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Résumé', { views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }] });
  ws.addRow(rows[0]);
  ws.columns = rows[0].map((_,i)=>({ width: i<2 ? 26 : 14 }));
  // widen the two new columns
  meta.forEach((m, idx) => {
    if (!m) return;
    const col = ws.getColumn(idx+1);
    if (m.kind === 'unpaidCount') col.width = Math.max(col.width||0, 22);
    if (m.kind === 'unpaidMAD') col.width = Math.max(col.width||0, 24);
  });
  const headBlue = { type:'pattern', pattern:'solid', fgColor:{argb:'1F4E78'} };
  const headYellow = { type:'pattern', pattern:'solid', fgColor:{argb:'FFF2CC'} };
  const headLightBlue = { type:'pattern', pattern:'solid', fgColor:{argb:'DDEBF7'} };
  const headPink = { type:'pattern', pattern:'solid', fgColor:{argb:'F8CBAD'} };
  ws.getRow(1).height = 22;
  ws.getRow(1).eachCell((cell, c) => {
    const m = meta[c-1];
    // فرض الاسم على عمود مجموع الأشهر بصرف النظر عن محتوى الصف المصدر
    if (m && m.kind==='sumTons') cell.value = 'مجموع الأشهر';
    if (m && m.kind==='sumMAD') cell.value = 'المجموع بدرهم';
    cell.font = { bold:true, color:{argb:'FFFFFFFF'} };
    cell.alignment = { vertical:'middle', horizontal:'center' };
    if (!m || m.kind==='meter' || m.kind==='name') {
      cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:'305496'} };
      cell.font = { bold:true, color:{argb:'FFFFFFFF'} };
    } else if (m && m.kind==='month') {
      cell.fill = headBlue;
    } else if (m && m.kind==='sumTons') {
      cell.fill = headYellow; cell.font = { bold:true, color:{argb:'FF000000'} }; cell.numFmt = '0';
    } else if (m && m.kind==='sumMAD') {
      cell.fill = headLightBlue; cell.font = { bold:true, color:{argb:'FF000000'} }; cell.numFmt = '0.00';
    } else if (m && m.kind==='unpaidCount') {
      cell.value = 'عدد الأشهر غير المدفوعة';
      cell.fill = headPink; cell.font = { bold:true, color:{argb:'FF000000'} }; cell.numFmt = '0';
    } else if (m && m.kind==='unpaidMAD') {
      cell.value = 'ثمن الأشهر غير المدفوعة';
      cell.fill = headPink; cell.font = { bold:true, color:{argb:'FF000000'} }; cell.numFmt = '0.00';
    }
    cell.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
  });
  const greenFill = { type:'pattern', pattern:'solid', fgColor:{argb:'C6EFCE'} };
  const redFill = { type:'pattern', pattern:'solid', fgColor:{argb:'FFC7CE'} };
  for (let r=1; r<rows.length; r++) {
    const excelRow = ws.addRow(rows[r]);
    excelRow.alignment = { vertical:'middle', horizontal:'center' };
    let monthPtr = -1;
    excelRow.eachCell((cell, c) => {
      const cm = meta[c-1];
      cell.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
      // Make names (column 2) bold and bigger on body rows
      if (c === 2) {
        cell.font = { ...(cell.font||{}), bold: true, size: 13 };
        cell.alignment = { ...(cell.alignment||{}), horizontal: 'right' };
      }
      if (!cm) return;
      if (cm.kind==='month') {
        monthPtr++;
        const st = (status[r-1] && status[r-1][monthPtr]) || '';
        if (cell.value !== '') cell.numFmt = '0';
        if (st === 'مدفوعة') cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:'C6EFCE'} };
        else if (st === 'غير مدفوعة') cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:'FFC7CE'} };
      } else if (cm.kind==='sumTons') {
        cell.fill = headYellow; cell.font = { bold:true, color:{argb:'FF000000'} }; cell.numFmt = '0';
      } else if (cm.kind==='sumMAD') {
        cell.fill = headLightBlue; cell.numFmt = '0.00';
      } else if (cm.kind==='unpaidCount') {
        cell.numFmt = '0';
      } else if (cm.kind==='unpaidMAD') {
        cell.numFmt = '0.00';
      }
    });
  }
  // Add a normalized Transactions sheet so the file can be re-imported
  const txRows = buildTransactionRows(data);
  const wsTx = wb.addWorksheet('Transactions');
  wsTx.columns = [
    { header:'MeterNumber', key:'MeterNumber', width:12 },
    { header:'FullName', key:'FullName', width:24 },
    { header:'Phone', key:'Phone', width:14 },
    { header:'RegistrationDate', key:'RegistrationDate', width:16 },
    { header:'Year', key:'Year', width:8 },
    { header:'Month', key:'Month', width:10 },
    { header:'OldReading', key:'OldReading', width:12 },
    { header:'NewReading', key:'NewReading', width:12 },
    { header:'Consumption', key:'Consumption', width:12 },
    { header:'PricePerTon', key:'PricePerTon', width:12 },
    { header:'TotalPrice', key:'TotalPrice', width:12 },
    { header:'Status', key:'Status', width:10 },
    { header:'ISODate', key:'ISODate', width:22 }
  ];
  wsTx.addRows(txRows);
  wsTx.views = [{ state:'frozen', ySplit:1 }];

  return wb.xlsx.writeBuffer().then(buf => {
    saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'water-consumption-styled.xlsx');
  });
}

function exportToExcel() {
  if (typeof XLSX === 'undefined') { exportSummaryAsHtmlXls(); return; }
  const data = loadData();
  const wb = XLSX.utils.book_new();

  // Transactions sheet (normalized)
  const txRows = [];
  data.users.forEach(u => {
    (u.months||[]).forEach(m => {
      const d = m.date ? new Date(m.date) : new Date();
      const fr = frMonthLabels();
      const cons = m.consumption || 0;
      const inferredPrice = cons > 0 ? (m.totalPrice || 0) / cons : data.pricePerTon;
      txRows.push({
        MeterNumber: u.meterNumber,
        FullName: u.fullName,
        Phone: u.phone || '',
        RegistrationDate: u.registrationDate || '',
        Year: d.getFullYear(),
        Month: fr[d.getMonth()],
        OldReading: m.oldReading || 0,
        NewReading: m.newReading || 0,
        Consumption: cons,
        PricePerTon: Number(inferredPrice.toFixed(4)),
        TotalPrice: m.totalPrice || 0,
        Status: m.status || '',
        ISODate: m.date || ''
      });
    });
  });
  const wsTx = XLSX.utils.json_to_sheet(txRows);
  wsTx['!cols'] = [10,24,14,16,8,10,12,12,12,12,12,10,22].map(w=>({wch:w}));
  XLSX.utils.book_append_sheet(wb, wsTx, 'Transactions');

  // Summary sheet (picture-like)
  const { rows: sumRows, meta: metaX } = buildSummary(data);
  const wsSum = XLSX.utils.aoa_to_sheet(sumRows);
  const cols = metaX.map((m, i) => {
    let wch = i<2 ? 26 : 14;
    if (m && m.kind === 'unpaidCount') wch = Math.max(wch, 22);
    if (m && m.kind === 'unpaidMAD') wch = Math.max(wch, 24);
    return { wch };
  });
  wsSum['!cols'] = cols;
  XLSX.utils.book_append_sheet(wb, wsSum, 'Résumé');

  XLSX.writeFile(wb, 'water-consumption.xlsx');
}

function ingestTransactionRowsToData(rows) {
  const map = new Map();
  let pricePerTon = loadData().pricePerTon;
  let droppedNoMeter = 0, fixedIso = 0;
  rows.forEach(r => {
    const meter = parseInt(r.MeterNumber || r['meterNumber'] || r['N° Compteur'] || r['Meter'], 10);
    if (!meter) { droppedNoMeter++; return; }
    const fullName = (r.FullName || r['Adhérent'] || '').toString();
    const phone = (r.Phone || '').toString();
    const reg = (r.RegistrationDate || '').toString();
    const y = parseInt(r.Year || r['Anno'] || r['Annee'] || '', 10);
    let mIdx = monthIndexFromAny(r.Month || r['Mois'] || r['Month'] || '');
    let iso = normalizeISODate({ year: y, monthIndex: mIdx, isoCandidate: (r.ISODate ?? r['ISODate'] ?? r['Date'] ?? r['date']), monthText: (r.Month || r['Mois'] || r['Month'] || '') });
    if (iso) fixedIso++;
    const oldR = parseFloat(r.OldReading || r['Old'] || 0) || 0;
    const newR = parseFloat(r.NewReading || r['New'] || 0) || 0;
    const cons = parseFloat(r.Consumption || 0) || Math.max(0, newR - oldR);
    const ppt = parseFloat(r.PricePerTon || pricePerTon) || pricePerTon;
    const total = parseFloat(r.TotalPrice || (cons * ppt)) || (cons * ppt);
    const status = (r.Status || '').toString();
    pricePerTon = ppt; // keep last seen

    if (!map.has(meter)) {
      map.set(meter, { id: Date.now()+meter, fullName, meterNumber: meter, phone, registrationDate: reg, months: [] });
    }
    const u = map.get(meter);
    u.fullName = fullName || u.fullName;
    if (phone) u.phone = phone;
    if (reg) u.registrationDate = reg;
    u.months.push({
      month: new Date(iso).toLocaleDateString('ar-MA', { year:'numeric', month:'long'}),
      oldReading: oldR, newReading: newR, consumption: cons,
      totalPrice: total, status: status || 'غير مدفوعة', date: iso
    });
  });
  const result = { users: Array.from(map.values()), pricePerTon };
  try {
    const rowCount = rows.length;
    const monthCount = result.users.reduce((s,u)=>s+(u.months?u.months.length:0),0);
    console.info('[Import summary] rows:', rowCount, 'users:', result.users.length, 'months:', monthCount, 'no-meter-dropped:', droppedNoMeter, 'fixedIso:', fixedIso);
  } catch(_){}
  return result;
}

function importFromExcel(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets['Transactions'] || wb.Sheets[wb.SheetNames[0]];
      if (!ws) { alert('❌ لم يتم العثور على ورقة Transactions في الملف.'); return; }
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      const { users, pricePerTon } = ingestTransactionRowsToData(rows);
      saveData({ users, pricePerTon });
      updateUI();
      alert('✅ تم استيراد ملف Excel بنجاح');
    } catch (err) {
      console.error(err);
      alert('❌ تعذر قراءة ملف Excel');
    }
  };
  reader.readAsArrayBuffer(file);
}

// Fallback import using ExcelJS if XLSX not available
function importFromExcelWithExcelJS(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    const valToString = (v) => {
      if (v == null) return '';
      if (v instanceof Date) return v.toISOString();
      if (typeof v === 'object') {
        if (typeof v.text !== 'undefined') return String(v.text);
        if (typeof v.result !== 'undefined') return String(v.result);
        if (Array.isArray(v.richText)) return v.richText.map(t=>t.text).join('');
      }
      return String(v);
    };
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(e.target.result);
      let ws = wb.getWorksheet('Transactions');
      if (!ws) ws = wb.worksheets[0];
      if (!ws) { alert('❌ لم يتم العثور على ورقة Transactions في الملف.'); return; }
      const header = [];
      ws.getRow(1).eachCell((cell, col) => { header[col-1] = valToString(cell.value); });
      const rows = [];
      for (let r=2; r<=ws.rowCount; r++) {
        const obj = {};
        header.forEach((h, i) => { obj[h] = ws.getRow(r).getCell(i+1).value ?? ''; });
        // Normalize some common fields to strings for matching
        if (obj.Month) obj.Month = valToString(obj.Month);
        if (obj.FullName) obj.FullName = valToString(obj.FullName);
        if (obj.Status) obj.Status = valToString(obj.Status);
        if (obj.ISODate) obj.ISODate = valToString(obj.ISODate);
        rows.push(obj);
      }
      // Ingest Transactions first
      const result = ingestTransactionRowsToData(rows);

      // Complement with Résumé sheet (to avoid missing data), using cell colors for status if available
      const resume = wb.getWorksheet('Résumé') || wb.getWorksheet('Resume') || wb.getWorksheet('Feuille1') || wb.worksheets.find(s=>/resum|summary|sheet/i.test(s.name));
      if (resume) {
        const headerRow = resume.getRow(1);
        const colMeta = []; // {kind:'meter'|'name'|'month', mi, year}
        headerRow.eachCell((cell, c) => {
          const v = valToString(cell.value).trim();
          if (c===1) { colMeta[c] = {kind:'meter'}; return; }
          if (c===2) { colMeta[c] = {kind:'name'}; return; }
          // Patterns: 'janv.-25', 'janv. 2025', 'يناير-25', '1-25', plain 'janv.' with year in next col
          let matched = false;
          let m = v.match(/^([^-\s]+)[\s-]?(\d{2,4})$/);
          if (m) {
            let mi = monthIndexFromAny(m[1]);
            let yy = parseInt(m[2],10);
            if (yy < 100) yy = 2000 + yy;
            if (mi>=0 && !isNaN(yy)) { colMeta[c] = {kind:'month', mi, year:yy}; matched = true; }
          }
          if (!matched) {
            // Case: separate month name then a dedicated year column (e.g., 'janv.' then '2025')
            const mi = monthIndexFromAny(v);
            const next = headerRow.getCell(c+1) ? valToString(headerRow.getCell(c+1).value).trim() : '';
            const yr = parseInt(next, 10);
            if (mi>=0 && !isNaN(yr)) { colMeta[c] = {kind:'month', mi, year: yr<100?2000+yr:yr}; matched = true; }
          }
          if (!matched) {
            // numeric month with year in previous col
            const num = parseInt(v,10);
            const prev = headerRow.getCell(c-1) ? valToString(headerRow.getCell(c-1).value).trim() : '';
            const yr = parseInt(prev, 10);
            if (!isNaN(num) && num>=1 && num<=12 && !isNaN(yr)) { colMeta[c] = {kind:'month', mi:num-1, year: yr<100?2000+yr:yr}; matched = true; }
          }
          if (!matched) colMeta[c] = {kind:'other'};
        });

        // Build index of existing months to avoid duplicates
        const hasKey = new Set();
        result.users.forEach(u => (u.months||[]).forEach(m => {
          const d = m.date ? new Date(m.date) : (m.ISODate ? new Date(m.ISODate) : null);
          if (!d) return;
          const key = `${u.meterNumber}-${d.getFullYear()}-${d.getMonth()}`;
          hasKey.add(key);
        }));

        const pricePerTon = result.pricePerTon || loadData().pricePerTon;
        for (let r=2; r<=resume.rowCount; r++) {
          const row = resume.getRow(r);
          const meter = parseInt(valToString(row.getCell(1).value),10);
          if (!meter) continue;
          const name = valToString(row.getCell(2).value);
          let user = result.users.find(u=>u.meterNumber===meter);
          if (!user) { user = { id: Date.now()+meter, fullName:name, meterNumber:meter, months:[] }; result.users.push(user); }
          row.eachCell((cell, c) => {
            const meta = colMeta[c];
            if (!meta || meta.kind!=='month') return;
            const val = valToString(cell.value);
            // accept integers/decimals and also split '6 طن' → 6
            const num = (val.match(/[0-9]+(?:\.[0-9]+)?/g)||[])[0];
            const consumption = num ? parseFloat(num) : 0;
            if (!consumption && val==='') return;
            const year = meta.year, mi = meta.mi;
            const key = `${meter}-${year}-${mi}`;
            if (hasKey.has(key)) return; // already present from Transactions
            // detect status by fill color if available
            let status = 'غير مدفوعة';
            try {
              const fill = cell.fill && cell.fill.fgColor && (cell.fill.fgColor.argb || cell.fill.fgColor.rgb);
              const up = (fill||'').toUpperCase();
              if (up.includes('C6EFCE')) status = 'مدفوعة'; // green
              if (up.includes('FFC7CE')) status = 'غير مدفوعة'; // red
            } catch(_){}
            const iso = new Date(Date.UTC(year, mi, 1)).toISOString();
            user.months.push({
              month: new Date(iso).toLocaleDateString('ar-MA',{year:'numeric',month:'long'}),
              oldReading: 0,
              newReading: consumption,
              consumption: consumption,
              totalPrice: consumption * pricePerTon,
              status,
              date: iso
            });
            hasKey.add(key);
          });
        }
      }

      saveData(result);
      updateUI();
      alert('✅ تم استيراد ملف Excel بنجاح');
    } catch (err) {
      console.error(err);
      alert('❌ تعذر قراءة ملف Excel');
    }
  };
  reader.readAsArrayBuffer(file);
}

// Styled first (ExcelJS), then fallback to XLSX, then HTML .xls
document.getElementById('exportExcelBtn').addEventListener('click', () => {
  loadExcelJS()
    .then(() => exportToExcelStyled())
    .catch(() => {
      loadXLSX()
        .then(() => { try { exportToExcel(); } catch (e) { console.error(e); exportSummaryAsHtmlXls(); } })
        .catch(() => exportSummaryAsHtmlXls());
    });
});
document.getElementById('importExcelBtn').addEventListener('click', () => document.getElementById('importExcelFile').click());
document.getElementById('importExcelFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  loadXLSX().then(() => importFromExcel(file)).catch(() => {
    // try ExcelJS-based import as a fallback
    loadExcelJS()
      .then(() => importFromExcelWithExcelJS(file))
      .catch(() => {
        alert('❌ تعذر تحميل مكتبة Excel\nحل سريع: استعمل التصدير/الاستيراد JSON أو حمِّل النسخ المحلية داخل مجلد vendor: xlsx.full.min.js, exceljs.min.js, FileSaver.min.js');
      });
  });
  e.target.value = '';
});

// =============== نسخة احتياطية تلقائية ===============
function autoBackup() {
  try { idbSet('waterConsumptionData_backup', loadData()).catch(() => {}); } catch (_) {}
}
setInterval(autoBackup, 300000);

window.addEventListener('load', async () => {
  // Initialize storage (migrate from localStorage if needed)
  await initStorage();
  // Try restore from IDB backup if no data present
  try {
    if (!DB_CACHE || !Array.isArray(DB_CACHE.users) || DB_CACHE.users.length === 0) {
      const backup = await idbGet('waterConsumptionData_backup');
      if (backup && backup.users) {
        DB_CACHE = backup;
        try { await idbSet(STORAGE_KEY, DB_CACHE); } catch (_) {}
      }
    }
  } catch (_) {}
  applyTheme();
  updateUI();
});

// =============== أزرار التحكم ===============
document.getElementById('statsBtn').addEventListener('click', showStatistics);
document.getElementById('themeToggle').addEventListener('click', () => {
  const current = getCurrentTheme();
  const newTheme = current === 'light' ? 'dark' : 'light';
  localStorage.setItem('appTheme', newTheme);
  applyTheme();
});
document.getElementById('langToggle').addEventListener('click', () => {
  const current = getCurrentLanguage();
  const newLang = current === 'ar' ? 'en' : 'ar';
  setCurrentLanguage(newLang);
  document.documentElement.lang = newLang;
  document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
  applyTranslations();
  updateUI();
});

// =============== تشغيل أولي ===============
// moved into window load after storage init to avoid race conditions
