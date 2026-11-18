let startDateFilter = null;
let endDateFilter = null;

// حماية صفحة الإدارة: التأكد من تسجيل الدخول عبر sessionStorage
document.addEventListener("DOMContentLoaded", () => {
    if (sessionStorage.getItem('nour_admin_auth') !== 'true') {
        window.location.href = 'index.html';
        return;
    }

    fetchAllData();

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('form-order-date').value = today;
    document.getElementById('form-shipment-date').value = today;
    document.getElementById('form-order-item-date').value = today;
    document.getElementById('form-arrival-item-date').value = today;
    document.getElementById('expense-form-date').value = today;
});

function lockSystem() {
    sessionStorage.removeItem('nour_admin_auth');
    window.location.href = 'index.html';
}

function downloadDatabaseBackup() {
    const backupData = { 
        export_date: new Date().toISOString(), 
        shipments: shipmentsData, 
        orders: ordersData, 
        clients: clientsData, 
        websites: websitesData, 
        expenses: expensesData, 
        announcements: announcementsData 
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `NourTrack_Backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    logActivity('نسخ احتياطي', 'تم تحميل نسخة احتياطية محلية لبيانات النظام', false);
}

async function fetchAllData() {
    if (!supabaseClient) return;
    const statusBadge = document.getElementById('db-status');
    try {
        const [shipRes, ordersRes, clientsRes, websitesRes, expensesRes, annRes, logsRes] = await Promise.all([
            supabaseClient.from('shipments').select('*').order('date', { ascending: false }),
            supabaseClient.from('orders').select('*').order('created_at', { ascending: false }),
            supabaseClient.from('clients').select('*').order('created_at', { ascending: false }),
            supabaseClient.from('websites').select('*').order('created_at', { ascending: false }),
            supabaseClient.from('expenses').select('*').order('date', { ascending: false }),
            supabaseClient.from('public_announcements').select('*').order('created_at', { ascending: false }),
            supabaseClient.from('activity_logs').select('*').order('created_at', { ascending: false })
        ]);

        shipmentsData = shipRes.data || [];
        ordersData = ordersRes.data || [];
        clientsData = clientsRes.data || [];
        websitesData = websitesRes.data || [];
        expensesData = expensesRes.data || [];
        announcementsData = annRes.data || [];
        logsData = logsRes.data || [];

        if(statusBadge) {
            statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> متصل`;
        }

        populateDropdowns();
        applyFilterAndRender();
    } catch (err) {
        console.error("Error fetching admin data:", err);
        if(statusBadge) {
            statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-rose-500"></span> خطأ اتصال`;
        }
    }
}

function populateDropdowns() {
    const webSelect = document.getElementById('form-shipment-website');
    if(webSelect) webSelect.innerHTML = websitesData.map(w => `<option value="${w.name}">${w.name}</option>`).join('');
    const clientSelect = document.getElementById('form-client-name');
    if(clientSelect) clientSelect.innerHTML = clientsData.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    const shipSelect = document.getElementById('form-order-shipment');
    if(shipSelect) shipSelect.innerHTML = shipmentsData.map(s => `<option value="${s.shipment_code}">${s.shipment_code} (${s.website})</option>`).join('');
}

function applyDateFilter() {
    const start = document.getElementById('filter-start-date').value;
    const end = document.getElementById('filter-end-date').value;
    startDateFilter = start ? new Date(start) : null;
    endDateFilter = end ? new Date(end) : null;
    applyFilterAndRender();
}

function resetDateFilter() {
    document.getElementById('filter-start-date').value = '';
    document.getElementById('filter-end-date').value = '';
    startDateFilter = null;
    endDateFilter = null;
    applyFilterAndRender();
}

function filterByDate(itemDateStr) {
    if (!startDateFilter && !endDateFilter) return true;
    if (!itemDateStr) return false;
    const itemDate = new Date(itemDateStr);
    if (startDateFilter && itemDate < startDateFilter) return false;
    if (endDateFilter && itemDate > endDateFilter) return false;
    return true;
}

function calculateFinalOrderPrice() {
    const orig = parseFloat(document.getElementById('form-original-price').value || 0);
    const disc = parseFloat(document.getElementById('form-discount-rate').value || 0);
    const finalPrice = orig - (orig * (disc / 100));
    document.getElementById('form-total-price').value = finalPrice.toFixed(2);
    calculateProfitAutomatically();
}

function calculateProfitAutomatically() {
    const totalPrice = parseFloat(document.getElementById('form-total-price').value || 0);
    const costPrice = parseFloat(document.getElementById('form-cost-price').value || 0);
    const profit = totalPrice - costPrice;
    document.getElementById('form-profit').value = profit.toFixed(2);
}

function applyFilterAndRender() {
    const shipFilter = (document.getElementById('filter-shipments-input')?.value || '').toLowerCase();
    const orderFilter = (document.getElementById('filter-orders-input')?.value || '').toLowerCase();
    const clientFilter = (document.getElementById('filter-clients-input')?.value || '').toLowerCase();
    const webFilter = (document.getElementById('filter-websites-input')?.value || '').toLowerCase();
    const expFilter = (document.getElementById('filter-expenses-input')?.value || '').toLowerCase();
    const logFilter = (document.getElementById('filter-logs-input')?.value || '').toLowerCase();

    const filteredShipments = shipmentsData.filter(s => filterByDate(s.date) && (s.shipment_code.toLowerCase().includes(shipFilter) || s.website.toLowerCase().includes(shipFilter)));
    const filteredExpenses = expensesData.filter(e => filterByDate(e.date) && e.title.toLowerCase().includes(expFilter));
    const filteredOrders = ordersData.filter(o => {
        const datePass = filterByDate(o.order_date);
        const textPass = o.shipment_code.toLowerCase().includes(orderFilter) || o.client_name.toLowerCase().includes(orderFilter);
        return datePass && textPass;
    });

    const filteredClients = clientsData.filter(c => c.name.toLowerCase().includes(clientFilter) || (c.phone && c.phone.includes(clientFilter)));
    const filteredWebsites = websitesData.filter(w => w.name.toLowerCase().includes(webFilter));
    const filteredLogs = logsData.filter(l => l.action_type.toLowerCase().includes(logFilter) || l.description.toLowerCase().includes(logFilter));

    renderDashboard(filteredOrders, filteredShipments, filteredExpenses);
    renderShipments(filteredShipments);
    renderDetailedShipmentsTab();
    renderOrders(filteredOrders);
    renderClients(filteredClients);
    renderAnnouncements(announcementsData);
    renderWebsites(filteredWebsites);
    renderExpenses(filteredExpenses);
    renderLogs(filteredLogs);
}

// عرض تاب الشحنات المفصلة (مع إمكانية الطي والفتح والتصدير)
function renderDetailedShipmentsTab() {
    const container = document.getElementById('detailed-shipments-container');
    if (!container) return;
    const textFilter = (document.getElementById('filter-detailed-shipments-input')?.value || '').toLowerCase();

    const filtered = shipmentsData.filter(s => s.shipment_code.toLowerCase().includes(textFilter) || s.website.toLowerCase().includes(textFilter));

    if (filtered.length === 0) {
        container.innerHTML = `<div class="p-8 text-center text-slate-400 font-bold">لا توجد شحنات مطابقة للبحث.</div>`;
        return;
    }

    container.innerHTML = filtered.map(s => {
        const sOrders = ordersData.filter(o => o.shipment_code === s.shipment_code);
        const base = Number(s.shipping_cost || 0);
        const comm = Number(s.commission_rate || 0);
        const totalCost = base + (base * (comm / 100));
        const totalOrdersSum = sOrders.filter(o => !o.is_returned).reduce((sum, o) => sum + Number(o.total_price || 0), 0);

        return `
            <div class="bg-slate-50/80 border-2 border-slate-200/90 rounded-3xl overflow-hidden shadow-sm hover:border-emerald-300 transition">
                <div class="bg-white p-4 sm:p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-200">
                    <div class="flex items-center gap-3">
                        <button onclick="toggleCollapse('shipment-collapse-${s.id}', 'icon-${s.id}')" class="w-10 h-10 rounded-2xl bg-emerald-100 hover:bg-emerald-200 text-emerald-800 flex items-center justify-center cursor-pointer transition shrink-0">
                            <i id="icon-${s.id}" class="fa-solid fa-chevron-down transition transform rotate-180"></i>
                        </button>
                        <div>
                            <h3 class="font-black text-base sm:text-lg text-slate-900 flex flex-wrap items-center gap-2">
                                <i class="fa-solid fa-box text-emerald-700"></i> شحنة: <span class="text-emerald-800">${s.shipment_code}</span>
                                <span class="px-2.5 py-0.5 bg-emerald-100 text-emerald-900 rounded-xl text-xs font-black">${s.website}</span>
                            </h3>
                            <p class="text-xs text-slate-500 font-bold mt-1">
                                تاريخ الطلب: <b class="text-slate-800">${s.order_date || '-'}</b> | تاريخ الوصول للبريد: <b class="text-slate-800">${s.date}</b> | تكلفة الشحنة: <b class="text-amber-700">₪${totalCost.toFixed(2)}</b> | مبيعات الشحنة: <b class="text-emerald-700">₪${totalOrdersSum.toFixed(2)}</b>
                            </p>
                        </div>
                    </div>
                    <div class="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                        <span class="px-3 py-1.5 rounded-xl text-xs font-black ${s.is_received ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-950'}">${s.is_received ? '✔ وصلت من البريد' : '⏳ بالطريق'}</span>
                        <button onclick="exportSingleShipmentExcel('${s.shipment_code}')" class="bg-blue-700 hover:bg-blue-800 text-white px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-sm hover-scale"><i class="fa-solid fa-file-excel"></i> تصدير Excel</button>
                        <button onclick="openInvoiceModal('shipment', '${s.shipment_code}')" class="bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-sm hover-scale"><i class="fa-solid fa-file-invoice"></i> فاتورة الشحنة</button>
                    </div>
                </div>

                <div id="shipment-collapse-${s.id}" class="p-4 sm:p-5 space-y-3">
                    <h4 class="font-black text-slate-800 text-xs sm:text-sm flex items-center gap-1.5">
                        <i class="fa-solid fa-users text-emerald-700"></i> الزبائن الذين اشتروا من هذه الشحنة (${sOrders.length}):
                    </h4>
                    <div class="overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-inner">
                        <table class="w-full text-right text-xs">
                            <thead class="bg-slate-100 text-slate-700 font-black">
                                <tr>
                                    <th class="p-3">اسم الزبون</th>
                                    <th class="p-3">تاريخ الطلب</th>
                                    <th class="p-3">تاريخ الاستلام</th>
                                    <th class="p-3">تفاصيل القطع</th>
                                    <th class="p-3">السعر الأصلي</th>
                                    <th class="p-3">ما دفعه الزبون</th>
                                    <th class="p-3">حالة الدفع والاستلام</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100 font-bold">
                                ${sOrders.length === 0 ? `<tr><td colspan="7" class="p-6 text-center text-slate-400">لا توجد طلبيات مسجلة لهذه الشحنة.</td></tr>` :
                                    sOrders.map(o => `
                                        <tr class="${o.is_returned ? 'bg-rose-50/40 line-through text-slate-400' : 'hover:bg-slate-50'}">
                                            <td class="p-3 font-black text-slate-900">${o.client_name}</td>
                                            <td class="p-3 text-slate-700">${o.order_date || '-'}</td>
                                            <td class="p-3 text-slate-700">${o.arrival_date || '-'}</td>
                                            <td class="p-3 text-slate-800">${o.notes || '-'}</td>
                                            <td class="p-3 text-slate-600">₪${Number(o.original_price || o.total_price).toFixed(2)}</td>
                                            <td class="p-3 font-black text-emerald-800">₪${Number(o.total_price).toFixed(2)}</td>
                                            <td class="p-3 space-x-1 space-x-reverse">
                                                <span class="px-2 py-0.5 rounded text-[10px] ${o.is_paid ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'}">${o.is_paid ? 'مدفوع' : 'غير مدفوع'}</span>
                                                <span class="px-2 py-0.5 rounded text-[10px] ${o.is_delivered ? 'bg-blue-100 text-blue-900' : 'bg-amber-100 text-amber-900'}">${o.is_returned ? 'مرتجع' : (o.is_delivered ? 'استلم' : 'قيد الانتظار')}</span>
                                            </td>
                                        </tr>
                                    `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function toggleCollapse(collapseId, iconId) {
    const el = document.getElementById(collapseId);
    const icon = document.getElementById(iconId);
    if (el.classList.contains('hidden')) {
        el.classList.remove('hidden');
        icon.classList.add('rotate-180');
    } else {
        el.classList.add('hidden');
        icon.classList.remove('rotate-180');
    }
}

function exportSingleShipmentExcel(shipmentCode) {
    const s = shipmentsData.find(item => item.shipment_code === shipmentCode);
    const sOrders = ordersData.filter(o => o.shipment_code === shipmentCode);
    if (!s) return;

    let csv = [];
    csv.push(`"تفاصيل الشحنة الرئيسية:","${s.shipment_code}","الموقع:","${s.website}","تاريخ الطلب:","${s.order_date || '-'}","تاريخ الوصول:","${s.date}"`);
    csv.push(`""`);
    csv.push(`"اسم الزبون","تاريخ الطلب","تاريخ الاستلام","تفاصيل القطع","السعر الأصلي","ما دفعه الزبون","حالة الدفع","حالة الاستلام"`);

    sOrders.forEach(o => {
        csv.push(`"${o.client_name}","${o.order_date || '-'}","${o.arrival_date || '-'}","${o.notes || '-'}","${o.original_price || o.total_price}","${o.total_price}","${o.is_paid ? 'مدفوع' : 'غير مدفوع'}","${o.is_returned ? 'مرتجع' : (o.is_delivered ? 'استلم' : 'انتظار')}"`);
    });

    const blob = new Blob(["\ufeff" + csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `Shipment_${shipmentCode}_Details.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportAllDetailedShipmentsExcel() {
    let csv = [];
    csv.push(`"تقرير شامل تفصيلي للشحنات والزبائن"`);
    csv.push(`""`);

    shipmentsData.forEach(s => {
        csv.push(`"كود الشحنة:","${s.shipment_code}","الموقع:","${s.website}","الوصول:","${s.date}"`);
        csv.push(`"اسم الزبون","تاريخ الطلب","تفاصيل القطع","المبلغ","الدفع","الحالة"`);
        const sOrders = ordersData.filter(o => o.shipment_code === s.shipment_code);
        if(sOrders.length === 0) {
            csv.push(`"لا توجد طلبيات لهذه الشحنة"`);
        } else {
            sOrders.forEach(o => {
                csv.push(`"${o.client_name}","${o.order_date || '-'}","${o.notes || '-'}","${o.total_price}","${o.is_paid ? 'مدفوع' : 'غير مدفوع'}","${o.is_delivered ? 'استلم' : 'انتظار'}"`);
            });
        }
        csv.push(`""`);
    });

    const blob = new Blob(["\ufeff" + csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `All_Shipments_Detailed_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function renderDashboard(fOrders, fShipments, fExpenses) {
    const activeOrders = fOrders.filter(o => !o.is_returned);
    const paidOrders = activeOrders.filter(o => o.is_paid);
    const unpaidOrders = activeOrders.filter(o => !o.is_paid);

    const totalRevenue = paidOrders.reduce((sum, o) => sum + Number(o.total_price || 0), 0);
    const totalProfitFromPaid = paidOrders.reduce((sum, o) => sum + Number(o.profit || 0), 0);
    const totalExpenses = fExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const netProfit = totalProfitFromPaid - totalExpenses;
    const totalUnpaidDebt = unpaidOrders.reduce((sum, o) => sum + Number(o.total_price || 0), 0);

    const totalShipmentCosts = fShipments.reduce((sum, s) => {
        const base = Number(s.shipping_cost || 0);
        const comm = Number(s.commission_rate || 0);
        return sum + (base + (base * (comm / 100)));
    }, 0);

    const receivedCount = fShipments.filter(s => s.is_received).length;

    let totalDays = 0, countWithDuration = 0;
    fShipments.forEach(s => {
        if (s.order_date && s.date) {
            const diff = Math.ceil((new Date(s.date) - new Date(s.order_date)) / (1000 * 60 * 60 * 24));
            if (diff >= 0) { totalDays += diff; countWithDuration++; }
        }
    });
    const avgDuration = countWithDuration > 0 ? Math.round(totalDays / countWithDuration) : 0;

    let vipCount = 0;
    clientsData.forEach(c => {
        const cOrders = ordersData.filter(o => o.client_name === c.name && !o.is_returned);
        const cPaid = cOrders.filter(o => o.is_paid);
        const totalSpent = cPaid.reduce((s, o) => s + Number(o.total_price || 0), 0);
        if (cOrders.length >= 2 && cPaid.length === cOrders.length && totalSpent >= 200) vipCount++;
    });

    document.getElementById('dash-revenue').textContent = `₪${totalRevenue.toFixed(2)}`;
    document.getElementById('dash-profit').textContent = `₪${netProfit.toFixed(2)}`;
    document.getElementById('dash-debt').textContent = `₪${totalUnpaidDebt.toFixed(2)}`;
    document.getElementById('dash-shipment-costs').textContent = `₪${totalShipmentCosts.toFixed(2)}`;
    document.getElementById('dash-avg-duration').textContent = `${avgDuration} يوم`;
    document.getElementById('dash-received').textContent = receivedCount;
    document.getElementById('dash-vip-count').textContent = vipCount;
}

function showDashboardDetails(type) {
    const modal = document.getElementById('dash-details-modal');
    const titleEl = document.getElementById('dash-details-title');
    const contentEl = document.getElementById('dash-details-content');
    const excelBtn = document.getElementById('dash-details-excel-btn');
    const invoiceBtn = document.getElementById('dash-details-invoice-btn');

    excelBtn.classList.add('hidden');
    invoiceBtn.classList.add('hidden');

    const filteredOrders = ordersData.filter(o => filterByDate(o.order_date));
    const filteredShipments = shipmentsData.filter(s => filterByDate(s.date));
    const filteredExpenses = expensesData.filter(e => filterByDate(e.date));

    if (type === 'revenue') {
        titleEl.textContent = 'تفاصيل المبيعات المحصلة بالكامل';
        const paid = filteredOrders.filter(o => o.is_paid && !o.is_returned);
        excelBtn.classList.remove('hidden');
        excelBtn.setAttribute('onclick', "exportTableToExcel('modal-details-table-body', 'Revenue_Details_Report.csv')");

        contentEl.innerHTML = `
            <div class="space-y-3">
                <p class="text-xs text-slate-500 font-bold">قائمة الطلبيات المدفوعة والمحصورة في النطاق الزمني المحدد:</p>
                <div class="overflow-x-auto border border-slate-200 rounded-2xl max-h-96 overflow-y-auto">
                    <table class="w-full text-right text-xs">
                        <thead class="bg-slate-100 text-slate-700 font-black sticky top-0">
                            <tr><th class="p-3">اسم الزبون</th><th class="p-3">رقم الشحنة</th><th class="p-3">تاريخ الطلب</th><th class="p-3">تفاصيل القطع</th><th class="p-3">المبلغ المحصل (₪)</th><th class="p-3">الربح المحقق (₪)</th></tr>
                        </thead>
                        <tbody id="modal-details-table-body" class="divide-y divide-slate-100 font-bold">
                            ${paid.length === 0 ? `<tr><td colspan="6" class="p-6 text-center text-slate-400">لا توجد مبيعات.</td></tr>` :
                                paid.map(o => `<tr class="hover:bg-slate-50"><td class="p-3">${o.client_name}</td><td class="p-3 text-emerald-800">${o.shipment_code}</td><td class="p-3">${o.order_date || '-'}</td><td class="p-3">${o.notes || '-'}</td><td class="p-3 font-black text-slate-900">₪${Number(o.total_price).toFixed(2)}</td><td class="p-3 text-emerald-700">+₪${Number(o.profit).toFixed(2)}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } else if (type === 'profit') {
        titleEl.textContent = 'تقرير تفصيلي شامل للأرباح من الألف للياء (من المبيعات والمصاريف)';
        const paid = filteredOrders.filter(o => o.is_paid && !o.is_returned);
        const totalP = paid.reduce((s, o) => s + Number(o.profit || 0), 0);
        const totalEx = filteredExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
        const net = totalP - totalEx;

        excelBtn.classList.remove('hidden');
        excelBtn.setAttribute('onclick', "exportTableToExcel('modal-profit-table-body', 'Comprehensive_Profit_Report.csv')");
        invoiceBtn.classList.remove('hidden');
        invoiceBtn.setAttribute('onclick', "openProfitInvoiceModal()");

        contentEl.innerHTML = `
            <div class="space-y-4">
                <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-emerald-50 p-4 rounded-2xl border border-emerald-200 text-xs font-black text-emerald-950 text-center">
                    <div class="bg-white p-3 rounded-xl border border-emerald-100 shadow-sm"><span class="block text-slate-500 font-bold mb-1">إجمالي أرباح الطلبيات</span><span class="text-emerald-800 text-sm">+₪${totalP.toFixed(2)}</span></div>
                    <div class="bg-white p-3 rounded-xl border border-emerald-100 shadow-sm"><span class="block text-slate-500 font-bold mb-1">إجمالي المصاريف</span><span class="text-rose-700 text-sm">-₪${totalEx.toFixed(2)}</span></div>
                    <div class="bg-white p-3 rounded-xl border border-emerald-100 shadow-sm sm:col-span-2"><span class="block text-slate-500 font-bold mb-1">صافي الربح النهائي (من الألف للياء)</span><span class="text-teal-800 text-base">₪${net.toFixed(2)}</span></div>
                </div>

                <div>
                    <h4 class="font-black text-slate-900 text-xs sm:text-sm mb-2"><i class="fa-solid fa-list-check text-emerald-700"></i> تفاصيل كل عملية بيع (سعر الشراء من الموقع، ما دفعه الزبون، والربح المحقق):</h4>
                    <div class="overflow-x-auto border border-slate-200 rounded-2xl max-h-60 overflow-y-auto">
                        <table class="w-full text-right text-xs">
                            <thead class="bg-slate-100 text-slate-700 font-black sticky top-0">
                                <tr>
                                    <th class="p-3">اسم الزبون</th>
                                    <th class="p-3">الشحنة / القطع</th>
                                    <th class="p-3">تاريخ الطلب</th>
                                    <th class="p-3">سعر الموقع (₪)</th>
                                    <th class="p-3">ما دفعه الزبون (₪)</th>
                                    <th class="p-3">الربح الصافي (₪)</th>
                                </tr>
                            </thead>
                            <tbody id="modal-profit-table-body" class="divide-y divide-slate-100 font-bold">
                                ${paid.length === 0 ? `<tr><td colspan="6" class="p-6 text-center text-slate-400">لا توجد عمليات بيع مدفوعة مسجلة.</td></tr>` : 
                                    paid.map(o => `
                                        <tr class="hover:bg-slate-50">
                                            <td class="p-3 font-black text-slate-900">${o.client_name}</td>
                                            <td class="p-3 text-emerald-800">${o.shipment_code} <span class="text-[10px] text-slate-500">(${o.notes || '-'})</span></td>
                                            <td class="p-3 text-slate-700">${o.order_date || '-'}</td>
                                            <td class="p-3 text-slate-800">₪${Number(o.cost_price || 0).toFixed(2)}</td>
                                            <td class="p-3 font-black text-slate-900">₪${Number(o.total_price || 0).toFixed(2)}</td>
                                            <td class="p-3 font-black text-emerald-700">+₪${Number(o.profit || 0).toFixed(2)}</td>
                                        </tr>
                                    `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div>
                    <h4 class="font-black text-slate-900 text-xs sm:text-sm mb-2"><i class="fa-solid fa-receipt text-rose-700"></i> المصاريف التي تم خصمها:</h4>
                    <div class="overflow-x-auto border border-slate-200 rounded-2xl max-h-40 overflow-y-auto">
                        <table class="w-full text-right text-xs">
                            <thead class="bg-slate-100 text-slate-700 font-black sticky top-0">
                                <tr><th class="p-3">البيان</th><th class="p-3">التاريخ</th><th class="p-3">المبلغ (₪)</th><th class="p-3">ملاحظات</th></tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100 font-bold">
                                ${filteredExpenses.length === 0 ? `<tr><td colspan="4" class="p-4 text-center text-slate-400">لا توجد مصاريف مسجلة.</td></tr>` :
                                    filteredExpenses.map(e => `<tr class="hover:bg-slate-50"><td class="p-3">${e.title}</td><td class="p-3">${e.date}</td><td class="p-3 text-rose-700 font-black">-₪${Number(e.amount).toFixed(2)}</td><td class="p-3">${e.notes || '-'}</td></tr>`).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    } else if (type === 'debt') {
        titleEl.textContent = 'قائمة الديون والمدفوعات المعلقة على الزبائن';
        const unpaid = filteredOrders.filter(o => !o.is_paid && !o.is_returned);
        excelBtn.classList.remove('hidden');
        excelBtn.setAttribute('onclick', "exportTableToExcel('modal-details-table-body', 'Unpaid_Debt_Report.csv')");

        contentEl.innerHTML = `
            <div class="space-y-3">
                <p class="text-xs text-slate-500 font-bold">الطلبيات التي لم يتم دفع ثمنها من قبل الزبائن بعد:</p>
                <div class="overflow-x-auto border border-slate-200 rounded-2xl max-h-96 overflow-y-auto">
                    <table class="w-full text-right text-xs">
                        <thead class="bg-slate-100 text-slate-700 font-black sticky top-0">
                            <tr><th class="p-3">اسم الزبون</th><th class="p-3">الشحنة</th><th class="p-3">تاريخ الطلب</th><th class="p-3">القطع</th><th class="p-3">المبلغ المعلق (₪)</th></tr>
                        </thead>
                        <tbody id="modal-details-table-body" class="divide-y divide-slate-100 font-bold">
                            ${unpaid.length === 0 ? `<tr><td colspan="5" class="p-6 text-center text-emerald-700">لا توجد ديون معلقة! جميع الطلبيات مدفوعة.</td></tr>` :
                                unpaid.map(o => `<tr class="hover:bg-slate-50"><td class="p-3">${o.client_name}</td><td class="p-3 text-emerald-800">${o.shipment_code}</td><td class="p-3">${o.order_date || '-'}</td><td class="p-3">${o.notes || '-'}</td><td class="p-3 font-black text-rose-700">₪${Number(o.total_price).toFixed(2)}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } else if (type === 'shipments') {
        titleEl.textContent = 'تفاصيل تكاليف الشحنات الرئيسية والعمولات';
        excelBtn.classList.remove('hidden');
        excelBtn.setAttribute('onclick', "exportTableToExcel('modal-details-table-body', 'Shipment_Costs_Report.csv')");

        contentEl.innerHTML = `
            <div class="space-y-3">
                <p class="text-xs text-slate-500 font-bold">تفاصيل الشحنات وتكاليف الشحن والعمولة:</p>
                <div class="overflow-x-auto border border-slate-200 rounded-2xl max-h-96 overflow-y-auto">
                    <table class="w-full text-right text-xs">
                        <thead class="bg-slate-100 text-slate-700 font-black sticky top-0">
                            <tr><th class="p-3">كود الشحنة</th><th class="p-3">الموقع</th><th class="p-3">تاريخ الطلب</th><th class="p-3">تاريخ الوصول</th><th class="p-3">التكلفة الأساسية</th><th class="p-3">العمولة</th><th class="p-3">الإجمالي</th></tr>
                        </thead>
                        <tbody id="modal-details-table-body" class="divide-y divide-slate-100 font-bold">
                            ${filteredShipments.length === 0 ? `<tr><td colspan="7" class="p-6 text-center text-slate-400">لا توجد شحنات مسجلة.</td></tr>` :
                                filteredShipments.map(s => {
                                    const base = Number(s.shipping_cost || 0);
                                    const comm = Number(s.commission_rate || 0);
                                    const total = base + (base * (comm / 100));
                                    return `<tr class="hover:bg-slate-50"><td class="p-3 font-black text-emerald-800">${s.shipment_code}</td><td class="p-3">${s.website}</td><td class="p-3">${s.order_date || '-'}</td><td class="p-3">${s.date}</td><td class="p-3">₪${base.toFixed(2)}</td><td class="p-3">${comm}%</td><td class="p-3 font-black text-slate-900">₪${total.toFixed(2)}</td></tr>`;
                                }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } else if (type === 'shipping_duration') {
        titleEl.textContent = 'تحليل أوقات ومدة التوصيل الفعلية للشحنات';
        excelBtn.classList.remove('hidden');
        excelBtn.setAttribute('onclick', "exportTableToExcel('modal-details-table-body', 'Shipping_Duration_Report.csv')");

        contentEl.innerHTML = `
            <div class="space-y-3">
                <p class="text-xs text-slate-500 font-bold">حساب الفرق بالأيام بين تاريخ طلب الشحنة وتاريخ وصولها الفعلي للبريد:</p>
                <div class="overflow-x-auto border border-slate-200 rounded-2xl max-h-96 overflow-y-auto">
                    <table class="w-full text-right text-xs">
                        <thead class="bg-slate-100 text-slate-700 font-black sticky top-0">
                            <tr><th class="p-3">كود الشحنة</th><th class="p-3">الموقع</th><th class="p-3">تاريخ الطلب</th><th class="p-3">تاريخ الوصول</th><th class="p-3">مدة التوصيل الفعلية</th></tr>
                        </thead>
                        <tbody id="modal-details-table-body" class="divide-y divide-slate-100 font-bold">
                            ${filteredShipments.length === 0 ? `<tr><td colspan="5" class="p-6 text-center text-slate-400">لا توجد شحنات.</td></tr>` :
                                filteredShipments.map(s => {
                                    let daysText = 'قيد التوصيل';
                                    if (s.order_date && s.date) {
                                        const diff = Math.ceil((new Date(s.date) - new Date(s.order_date)) / (1000 * 60 * 60 * 24));
                                        if (diff >= 0) daysText = `${diff} يوم`;
                                    }
                                    return `<tr class="hover:bg-slate-50"><td class="p-3 font-black text-emerald-800">${s.shipment_code}</td><td class="p-3">${s.website}</td><td class="p-3">${s.order_date || '-'}</td><td class="p-3">${s.date}</td><td class="p-3 font-black text-indigo-700">${daysText}</td></tr>`;
                                }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } else if (type === 'received') {
        titleEl.textContent = 'قائمة الشحنات الواصلة والمستلمة من البريد';
        const received = filteredShipments.filter(s => s.is_received);
        excelBtn.classList.remove('hidden');
        excelBtn.setAttribute('onclick', "exportTableToExcel('modal-details-table-body', 'Received_Shipments_Report.csv')");

        contentEl.innerHTML = `
            <div class="space-y-3">
                <p class="text-xs text-slate-500 font-bold">الشحنات التي تم استلامها من البريد بنجاح:</p>
                <div class="overflow-x-auto border border-slate-200 rounded-2xl max-h-96 overflow-y-auto">
                    <table class="w-full text-right text-xs">
                        <thead class="bg-slate-100 text-slate-700 font-black sticky top-0">
                            <tr><th class="p-3">كود الشحنة</th><th class="p-3">الموقع</th><th class="p-3">تاريخ الوصول</th><th class="p-3">ملاحظات</th></tr>
                        </thead>
                        <tbody id="modal-details-table-body" class="divide-y divide-slate-100 font-bold">
                            ${received.length === 0 ? `<tr><td colspan="4" class="p-6 text-center text-slate-400">لا توجد شحنات واصلة حالياً.</td></tr>` :
                                received.map(s => `<tr class="hover:bg-slate-50"><td class="p-3 font-black text-emerald-800">${s.shipment_code}</td><td class="p-3">${s.website}</td><td class="p-3">${s.date}</td><td class="p-3">${s.notes || '-'}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } else if (type === 'vip_clients') {
        titleEl.textContent = 'قائمة الزبائن المميزين (VIP)';
        const vipList = clientsData.filter(c => {
            const cOrders = ordersData.filter(o => o.client_name === c.name && !o.is_returned);
            const cPaid = cOrders.filter(o => o.is_paid);
            const totalSpent = cPaid.reduce((s, o) => s + Number(o.total_price || 0), 0);
            return cOrders.length >= 2 && cPaid.length === cOrders.length && totalSpent >= 200;
        });
        excelBtn.classList.remove('hidden');
        excelBtn.setAttribute('onclick', "exportTableToExcel('modal-details-table-body', 'VIP_Clients_Report.csv')");

        contentEl.innerHTML = `
            <div class="space-y-3">
                <p class="text-xs text-slate-500 font-bold">الزبائن الذين أتموا طلبيات متعددة ودفعوا بالكامل بإجمالي يتجاوز 200₪:</p>
                <div class="overflow-x-auto border border-slate-200 rounded-2xl max-h-96 overflow-y-auto">
                    <table class="w-full text-right text-xs">
                        <thead class="bg-slate-100 text-slate-700 font-black sticky top-0">
                            <tr><th class="p-3">اسم الزبون</th><th class="p-3">رقم الهاتف</th><th class="p-3">العنوان</th><th class="p-3">ملاحظات الإدارة</th></tr>
                        </thead>
                        <tbody id="modal-details-table-body" class="divide-y divide-slate-100 font-bold">
                            ${vipList.length === 0 ? `<tr><td colspan="4" class="p-6 text-center text-slate-400">لا توجد زبائن VIP مسجلين حالياً.</td></tr>` :
                                vipList.map(c => `<tr class="hover:bg-slate-50"><td class="p-3 font-black text-slate-900"><i class="fa-solid fa-crown text-yellow-600 ml-1"></i> ${c.name}</td><td class="p-3">${c.phone}</td><td class="p-3">${c.address}</td><td class="p-3">${c.admin_notes || '-'}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
    modal.classList.remove('hidden');
}

function closeDashDetailsModal() { document.getElementById('dash-details-modal').classList.add('hidden'); }

function openProfitInvoiceModal() {
    closeDashDetailsModal();
    const todayStr = new Date().toISOString().split('T')[0];
    document.getElementById('inv-date').textContent = `التاريخ: ${todayStr}`;
    document.getElementById('inv-title-type').textContent = "تقرير كشف صافي الأرباح المفصل";
    document.getElementById('inv-code').textContent = "Ref: COMPREHENSIVE-PROFIT-REPORT";
    document.getElementById('inv-client-name').textContent = "الإدارة العامة (أحمد)";
    document.getElementById('inv-client-phone').textContent = "-";
    document.getElementById('inv-client-address').textContent = "كشف أرباح الطلبيات والمصاريف";

    const filteredOrders = ordersData.filter(o => filterByDate(o.order_date));
    const paid = filteredOrders.filter(o => o.is_paid && !o.is_returned);
    const filteredExpenses = expensesData.filter(e => filterByDate(e.date));

    document.getElementById('inv-col-extra').textContent = "الربح الصافي";

    const tbody = document.getElementById('inv-items-table');
    if (paid.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400">لا توجد أرباح مسجلة.</td></tr>`;
        document.getElementById('inv-subtotal').textContent = "₪0.00";
        document.getElementById('inv-grand-total').textContent = "₪0.00";
        document.getElementById('invoice-modal').classList.remove('hidden');
        return;
    }

    let totalProfitSum = 0;
    tbody.innerHTML = paid.map(o => {
        const profit = Number(o.profit || 0);
        totalProfitSum += profit;
        return `
            <tr class="border-b border-slate-100 text-xs font-bold">
                <td class="p-3 font-black text-emerald-800">${o.shipment_code} <br><span class="text-[10px] text-slate-500">(${o.client_name})</span></td>
                <td class="p-3 text-slate-800">${o.notes || 'قطع متنوعة'}</td>
                <td class="p-3 text-slate-700">${o.order_date || '-'}</td>
                <td class="p-3 text-slate-700">${o.arrival_date || '-'}</td>
                <td class="p-3 font-black">₪${Number(o.total_price).toFixed(2)}</td>
                <td class="p-3 font-black text-emerald-700">+₪${profit.toFixed(2)}</td>
            </tr>
        `;
    }).join('');

    const totalEx = filteredExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const finalNet = totalProfitSum - totalEx;

    document.getElementById('inv-subtotal').textContent = `+₪${totalProfitSum.toFixed(2)}`;
    document.getElementById('inv-total-label').textContent = "صافي الأرباح النهائي (بعد المصاريف):";
    document.getElementById('inv-grand-total').textContent = `₪${finalNet.toFixed(2)}`;
    document.getElementById('invoice-modal').classList.remove('hidden');
}

function renderShipments(data) {
    const tbody = document.getElementById('shipments-table-body');
    if (data.length === 0) { tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-slate-400">لا توجد شحنات.</td></tr>`; return; }
    const sorted = [...data].sort((a, b) => (a.is_received === b.is_received) ? 0 : a.is_received ? 1 : -1);

    tbody.innerHTML = sorted.map(s => {
        const relatedOrders = ordersData.filter(o => o.shipment_code === s.shipment_code);
        const base = Number(s.shipping_cost || 0);
        const comm = Number(s.commission_rate || 0);
        const totalWithComm = base + (base * (comm / 100));

        let durationText = '<span class="text-slate-400 text-xs">قيد التوصيل</span>';
        if (s.order_date && s.date) {
            const diff = Math.ceil((new Date(s.date) - new Date(s.order_date)) / (1000 * 60 * 60 * 24));
            if (diff >= 0) durationText = `<span class="px-2.5 py-1 bg-indigo-100 text-indigo-900 rounded-xl font-black text-xs">${diff} يوم وصول</span>`;
        }

        return `
            <tr class="hover:bg-slate-50/80 transition ${!s.is_received ? 'bg-amber-50/30' : ''}">
                <td class="p-4 font-black text-emerald-800">${s.shipment_code} ${!s.is_received ? '<span class="text-[10px] bg-amber-200 text-amber-950 px-1.5 py-0.5 rounded font-black">بالطريق</span>' : ''}</td>
                <td class="p-4">
                    <span class="px-2.5 py-1 bg-emerald-100 text-emerald-900 rounded-xl text-xs font-black">${s.website}</span><br>
                    <span class="text-[10px] text-slate-500 font-bold">طلب: ${s.order_date || '-'} | وصول: ${s.date}</span>
                </td>
                <td class="p-4">${durationText}</td>
                <td class="p-4"><span class="font-black text-slate-900">₪${totalWithComm.toFixed(2)}</span></td>
                <td class="p-4 text-center">
                    <div class="flex items-center justify-center gap-2">
                        <label class="inline-flex items-center gap-1.5 cursor-pointer bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-300">
                            <input type="checkbox" ${s.is_received ? 'checked' : ''} onchange="toggleShipmentReceived('${s.id}', '${s.shipment_code}', this.checked)" class="w-4 h-4 text-emerald-700 rounded border-slate-300 cursor-pointer">
                            <span class="text-xs font-black ${s.is_received ? 'text-emerald-800' : 'text-slate-500'}">${s.is_received ? 'وصلت' : 'بالطريق'}</span>
                        </label>
                        ${s.is_received && relatedOrders.length > 0 ? `<button onclick="sendWhatsAppToAllClients('${s.shipment_code}')" title="إرسال إشعار واتساب لجميع مشتركي الشحنة" class="bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1 shadow-sm cursor-pointer hover-scale"><i class="fa-brands fa-whatsapp"></i></button>` : ''}
                    </div>
                </td>
                <td class="p-4 text-center">
                    <button onclick="openInvoiceModal('shipment', '${s.shipment_code}')" class="bg-indigo-100 hover:bg-indigo-200 text-indigo-900 px-3 py-1.5 rounded-xl text-xs font-black transition inline-flex items-center gap-1 cursor-pointer shadow-sm hover-scale"><i class="fa-solid fa-file-invoice"></i> فاتورة</button>
                </td>
                <td class="p-4 text-center space-x-1 space-x-reverse">
                    <button onclick="editShipment('${s.id}')" class="text-blue-700 hover:text-blue-900 p-1.5 hover:bg-blue-50 rounded-lg transition cursor-pointer font-bold"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="deleteShipment('${s.id}')" class="text-rose-600 hover:text-rose-800 p-1.5 hover:bg-rose-50 rounded-lg transition cursor-pointer font-bold"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('');
}

async function toggleShipmentReceived(id, shipmentCode, isReceived) {
    await supabaseClient.from('shipments').update({ is_received: isReceived }).eq('id', id);
    await logActivity('تعديل حالة الشحنة', `تعديل وصول الشحنة (${shipmentCode}) إلى: ${isReceived ? 'وصلت' : 'بالطريق'}`, false);
    fetchAllData();
}

function sendWhatsAppToAllClients(shipmentCode) {
    const shipmentOrders = ordersData.filter(o => o.shipment_code === shipmentCode && !o.is_returned);
    shipmentOrders.forEach(order => {
        const client = clientsData.find(c => c.name === order.client_name);
        if (client && client.phone) {
            let phone = client.phone.trim();
            if (phone.startsWith('0')) phone = '972' + phone.substring(1);
            const message = `مرحباً ${client.name} 🌸\nنود إعلامك بأن طلبيتك ضمن شحنة رقم (${shipmentCode}) (${order.notes || 'القطع'}) قد وصلت من البريد وهي جاهزة للاستعلام والاستلام! 📦✨`;
            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
        }
    });
}

function renderOrders(data) {
    const tbody = document.getElementById('orders-table-body');
    if (data.length === 0) { tbody.innerHTML = `<tr><td colspan="10" class="p-8 text-center text-slate-400">لا توجد طلبيات.</td></tr>`; return; }
    const sorted = [...data].sort((a, b) => (a.is_delivered === b.is_delivered) ? 0 : a.is_delivered ? 1 : -1);

    tbody.innerHTML = sorted.map(o => {
        const orig = o.original_price || o.total_price;
        const disc = o.discount_rate || 0;
        const cost = o.cost_price || 0;
        return `
            <tr class="hover:bg-slate-50/80 transition ${o.is_returned ? 'bg-rose-50/30 line-through text-slate-400' : (!o.is_delivered ? 'bg-amber-50/20' : '')}">
                <td class="p-4 font-black text-emerald-800">${o.shipment_code}</td>
                <td class="p-4 font-black text-slate-900">${o.client_name}</td>
                <td class="p-4 text-xs text-slate-700"><b>شراء:</b> ${o.order_date || '-'}<br><b>استلام:</b> ${o.arrival_date || '-'}</td>
                <td class="p-4 text-xs"><span class="text-slate-400 line-through">₪${Number(orig).toFixed(2)}</span><br><span class="text-emerald-800 font-black">خصم: ${disc}%</span></td>
                <td class="p-4 font-black text-slate-800">₪${Number(cost).toFixed(2)}</td>
                <td class="p-4"><span class="font-black text-slate-900">₪${Number(o.total_price).toFixed(2)}</span><br><span class="text-[11px] font-black px-2 py-0.5 rounded-lg ${o.is_paid ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'}">${o.is_paid ? '✔ دفع' : '❌ لم يدفع'}</span></td>
                <td class="p-4 font-black ${o.is_paid && !o.is_returned ? 'text-emerald-700' : 'text-slate-400'}">+₪${Number(o.profit).toFixed(2)}</td>
                <td class="p-4 text-center">
                    <div class="flex flex-col items-center gap-1.5">
                        <label class="inline-flex items-center gap-1 cursor-pointer bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-300">
                            <input type="checkbox" ${o.is_delivered ? 'checked' : ''} onchange="toggleOrderDelivered('${o.id}', '${o.client_name}', '${o.shipment_code}', this.checked)" class="w-3.5 h-3.5 text-emerald-700 rounded border-slate-300 cursor-pointer">
                            <span class="text-[11px] font-black ${o.is_delivered ? 'text-emerald-800' : 'text-slate-500'}">${o.is_delivered ? 'استلم' : 'لم يستلم'}</span>
                        </label>
                        <label class="inline-flex items-center gap-1 cursor-pointer bg-rose-50 px-2.5 py-1 rounded-xl border border-rose-300">
                            <input type="checkbox" ${o.is_returned ? 'checked' : ''} onchange="toggleOrderReturned('${o.id}', '${o.client_name}', '${o.shipment_code}', this.checked)" class="w-3.5 h-3.5 text-rose-700 rounded border-slate-300 cursor-pointer">
                            <span class="text-[11px] font-black text-rose-900">${o.is_returned ? 'مرتجع/تالف' : 'إرجاع'}</span>
                        </label>
                    </div>
                </td>
                <td class="p-4 text-slate-800 text-xs font-bold">${o.notes || '-'}</td>
                <td class="p-4 text-center space-x-1 space-x-reverse">
                    <button onclick="editOrder('${o.id}')" class="text-blue-700 hover:text-blue-900 p-1.5 hover:bg-blue-50 rounded-lg transition cursor-pointer font-bold"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="deleteOrder('${o.id}')" class="text-rose-600 hover:text-rose-800 p-1.5 hover:bg-rose-50 rounded-lg transition cursor-pointer font-bold"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('');
}

async function toggleOrderDelivered(orderId, clientName, shipmentCode, isDelivered) {
    await supabaseClient.from('orders').update({ is_delivered: isDelivered }).eq('id', orderId);
    await logActivity('تعديل استلام طلبيّة', `استلام الزبون (${clientName}) للشحنة (${shipmentCode}): ${isDelivered}`, false);
    fetchAllData();
}

async function toggleOrderReturned(orderId, clientName, shipmentCode, isReturned) {
    await supabaseClient.from('orders').update({ is_returned: isReturned }).eq('id', orderId);
    await logActivity('تعديل مرتجع', `مرتجع للزبون (${clientName}) ضمن الشحنة (${shipmentCode}): ${isReturned}`, true);
    fetchAllData();
}

function renderClients(data) {
    const tbody = document.getElementById('clients-table-body');
    if (data.length === 0) { tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-slate-400">لا يوجد زبائن.</td></tr>`; return; }
    tbody.innerHTML = data.map(c => {
        const clientOrders = ordersData.filter(o => o.client_name === c.name && !o.is_returned);
        const paidOrders = clientOrders.filter(o => o.is_paid);
        const totalSpent = paidOrders.reduce((sum, o) => sum + Number(o.total_price || 0), 0);
        const totalProfit = paidOrders.reduce((sum, o) => sum + Number(o.profit || 0), 0);
        const isVip = clientOrders.length >= 2 && paidOrders.length === clientOrders.length && totalSpent >= 200;

        return `
            <tr class="hover:bg-slate-50/80 transition">
                <td class="p-4 font-black text-slate-900">
                    ${c.name}
                    ${isVip ? '<span class="mr-2 inline-flex items-center gap-1 bg-yellow-200 text-yellow-950 px-2 py-0.5 rounded-full text-[10px] font-black"><i class="fa-solid fa-crown"></i> VIP</span>' : ''}
                </td>
                <td class="p-4 text-slate-700 text-xs font-black bg-slate-50/80 rounded-xl">${c.phone}</td>
                <td class="p-4 text-xs font-black text-amber-950 bg-amber-50/70 rounded-xl">${c.admin_notes || '<span class="text-slate-400 font-normal">لا توجد ملاحظات</span>'}</td>
                <td class="p-4 font-black text-slate-900">₪${totalSpent.toFixed(2)}</td>
                <td class="p-4 font-black text-emerald-700">+₪${totalProfit.toFixed(2)}</td>
                <td class="p-4 text-center space-x-1 space-x-reverse">
                    <button onclick="showClientDetails('${c.name}')" class="bg-indigo-100 text-indigo-900 hover:bg-indigo-200 px-2.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer hover-scale">عرض (${clientOrders.length})</button>
                    <button onclick="openInvoiceModal('client', '${c.name}')" class="bg-emerald-100 text-emerald-900 hover:bg-emerald-200 px-2.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer inline-flex items-center gap-1 hover-scale"><i class="fa-solid fa-file-invoice"></i> فاتورة</button>
                </td>
                <td class="p-4 text-center space-x-1 space-x-reverse">
                    <button onclick="editClient('${c.id}')" class="text-blue-700 hover:text-blue-900 p-1.5 hover:bg-blue-50 rounded-lg transition cursor-pointer font-bold"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="deleteClient('${c.id}')" class="text-rose-600 hover:text-rose-800 p-1.5 hover:bg-rose-50 rounded-lg transition cursor-pointer font-bold"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('');
}

function renderAnnouncements(data) {
    const tbody = document.getElementById('announcements-table-body');
    if (!tbody) return;
    if (data.length === 0) { tbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-slate-400">لا توجد إعلانات.</td></tr>`; return; }
    tbody.innerHTML = data.map(a => `
        <tr class="hover:bg-slate-50/80 transition">
            <td class="p-4 font-black text-slate-900">${a.title}</td>
            <td class="p-4 text-xs text-slate-700 font-bold">${a.content}</td>
            <td class="p-4 text-center"><span class="px-2.5 py-1 rounded-full text-[11px] font-black ${a.is_active ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-200 text-slate-700'}">${a.is_active ? 'نشط بالشريط' : 'متوقف'}</span></td>
            <td class="p-4 text-center space-x-1 space-x-reverse">
                <button onclick="editAnnouncement('${a.id}')" class="text-blue-700 hover:text-blue-900 p-1.5 hover:bg-blue-50 rounded-lg transition cursor-pointer font-bold"><i class="fa-solid fa-pen"></i></button>
                <button onclick="deleteAnnouncement('${a.id}')" class="text-rose-600 hover:text-rose-800 p-1.5 hover:bg-rose-50 rounded-lg transition cursor-pointer font-bold"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function openAnnouncementModal() {
    document.getElementById('announcement-form').reset();
    document.getElementById('announcement-id').value = '';
    document.getElementById('announcement-form-active').checked = true;
    document.getElementById('announcement-modal-title').textContent = 'إضافة إعلان جديد';
    document.getElementById('announcement-modal').classList.remove('hidden');
}
function closeAnnouncementModal() { document.getElementById('announcement-modal').classList.add('hidden'); }

async function saveAnnouncement(e) {
    e.preventDefault();
    const id = document.getElementById('announcement-id').value;
    const title = document.getElementById('announcement-form-title').value;
    const data = {
        title: title,
        content: document.getElementById('announcement-form-content').value,
        is_active: document.getElementById('announcement-form-active').checked
    };
    if (id) {
        await supabaseClient.from('public_announcements').update(data).eq('id', id);
        await logActivity('تعديل إعلان', `تعديل الإعلان (${title})`, false);
    } else {
        await supabaseClient.from('public_announcements').insert([data]);
        await logActivity('إضافة إعلان', `إضافة إعلان جديد (${title})`, false);
    }
    closeAnnouncementModal();
    fetchAllData();
}

async function editAnnouncement(id) {
    const a = announcementsData.find(item => item.id === id);
    if (!a) return;
    document.getElementById('announcement-id').value = a.id;
    document.getElementById('announcement-form-title').value = a.title;
    document.getElementById('announcement-form-content').value = a.content;
    document.getElementById('announcement-form-active').checked = a.is_active;
    document.getElementById('announcement-modal-title').textContent = 'تعديل الإعلان';
    document.getElementById('announcement-modal').classList.remove('hidden');
}

async function deleteAnnouncement(id) {
    const a = announcementsData.find(item => item.id === id);
    if (!confirm('حذف هذا الإعلان؟')) return;
    await supabaseClient.from('public_announcements').delete().eq('id', id);
    await logActivity('حذف إعلان', `حذف الإعلان (${a ? a.title : id})`, true);
    fetchAllData();
}

function showClientDetails(clientName) {
    const client = clientsData.find(c => c.name === clientName);
    const clientOrders = ordersData.filter(o => o.client_name === clientName);
    document.getElementById('client-details-title').textContent = `ملف الزبون: ${clientName}`;
    let html = `
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
            <div><span class="text-slate-500 font-bold">هاتف الداتا بيس:</span> <span class="font-black text-slate-900">${client.phone}</span></div>
            <div><span class="text-slate-500 font-bold">العنوان:</span> <span class="font-black text-slate-900">${client.address}</span></div>
            <div><span class="text-slate-500 font-bold">الطلبيات:</span> <span class="font-black text-emerald-800">${clientOrders.length}</span></div>
        </div>
        ${client.admin_notes ? `<div class="bg-amber-50 border border-amber-300 p-3 rounded-2xl text-xs text-amber-950 font-black">ملاحظة الإدارة الحالية للزبون: ${client.admin_notes}</div>` : ''}
        <div class="flex justify-between items-center mt-4">
            <h4 class="font-black text-slate-900 text-sm">سجل الطلبيات والملاحظات:</h4>
            <button onclick="closeClientDetailsModal(); openInvoiceModal('client', '${clientName}')" class="bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer hover-scale"><i class="fa-solid fa-print"></i> إصدار فاتورة الزبون</button>
        </div>
    `;
    html += clientOrders.length === 0 ? `<p class="text-slate-400 text-xs py-4 text-center">لا توجد طلبيات.</p>` : `
        <div class="overflow-x-auto border border-slate-200 rounded-2xl"><table class="w-full text-right text-xs"><thead class="bg-slate-100 text-slate-700 font-black"><tr><th class="p-3">الشحنة</th><th class="p-3">تاريخ الشراء</th><th class="p-3">المبلغ</th><th class="p-3">الدفع</th><th class="p-3">الحالة</th><th class="p-3">القطع</th></tr></thead><tbody class="divide-y divide-slate-100">
        ${clientOrders.map(o => `<tr class="${o.is_returned ? 'bg-rose-50/30 line-through text-slate-400' : 'hover:bg-slate-50'}"><td class="p-3 font-black text-emerald-800">${o.shipment_code}</td><td class="p-3 text-slate-700">${o.order_date || '-'}</td><td class="p-3 font-black">₪${Number(o.total_price).toFixed(2)}</td><td class="p-3 font-black ${o.is_paid ? 'text-emerald-700' : 'text-rose-600'}">${o.is_paid ? 'دفع' : 'لم يدفع'}</td><td class="p-3 font-black">${o.is_returned ? 'مرتجع' : (o.is_delivered ? 'استلم' : 'لم يستلم')}</td><td class="p-3 text-slate-700">${o.notes || '-'}</td></tr>`).join('')}
        </tbody></table></div>`;
    document.getElementById('client-details-content').innerHTML = html;
    document.getElementById('client-details-modal').classList.remove('hidden');
}

function closeClientDetailsModal() { document.getElementById('client-details-modal').classList.add('hidden'); }

function renderWebsites(data) {
    const tbody = document.getElementById('websites-table-body');
    if (data.length === 0) { tbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-slate-400">لا توجد مواقع.</td></tr>`; return; }
    tbody.innerHTML = data.map(w => `
        <tr class="hover:bg-slate-50/80 transition">
            <td class="p-4 font-black text-slate-900">${w.name}</td>
            <td class="p-4"><a href="${w.url || '#'}" target="_blank" class="text-blue-700 hover:underline text-xs font-bold">${w.url || '-'}</a></td>
            <td class="p-4 text-slate-700 text-xs font-bold">${w.notes || '-'}</td>
            <td class="p-4 text-center space-x-1 space-x-reverse">
                <button onclick="editWebsite('${w.id}')" class="text-blue-700 hover:text-blue-900 p-1.5 hover:bg-blue-50 rounded-lg transition cursor-pointer font-bold"><i class="fa-solid fa-pen"></i></button>
                <button onclick="deleteWebsite('${w.id}')" class="text-rose-600 hover:text-rose-800 p-1.5 hover:bg-rose-50 rounded-lg transition cursor-pointer font-bold"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function renderExpenses(data) {
    const tbody = document.getElementById('expenses-table-body');
    if (data.length === 0) { tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-400">لا توجد مصاريف.</td></tr>`; return; }
    tbody.innerHTML = data.map(e => `
        <tr class="hover:bg-slate-50/80 transition">
            <td class="p-4 font-black text-slate-900">${e.title}</td>
            <td class="p-4 text-xs text-slate-600 font-bold">${e.date}</td>
            <td class="p-4 font-black text-rose-700">-₪${Number(e.amount).toFixed(2)}</td>
            <td class="p-4 text-slate-700 text-xs font-bold">${e.notes || '-'}</td>
            <td class="p-4 text-center space-x-1 space-x-reverse">
                <button onclick="editExpense('${e.id}')" class="text-blue-700 hover:text-blue-900 p-1.5 hover:bg-blue-50 rounded-lg transition cursor-pointer font-bold"><i class="fa-solid fa-pen"></i></button>
                <button onclick="deleteExpense('${e.id}')" class="text-rose-600 hover:text-rose-800 p-1.5 hover:bg-rose-50 rounded-lg transition cursor-pointer font-bold"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function renderLogs(data) {
    const tbody = document.getElementById('logs-table-body');
    if (!tbody) return;
    if (data.length === 0) { tbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-slate-400">لا توجد حركات مسجلة بعد.</td></tr>`; return; }
    
    tbody.innerHTML = data.map(l => {
        const isDelete = l.action_type.includes('حذف') || l.is_critical;
        return `
            <tr class="transition ${isDelete ? 'bg-rose-100/70 border-r-4 border-rose-600 text-rose-950 font-black' : 'hover:bg-slate-50/80'}">
                <td class="p-4 font-black ${isDelete ? 'text-rose-700' : 'text-indigo-800'}"><i class="fa-solid ${isDelete ? 'fa-triangle-exclamation' : 'fa-circle-dot'} ml-1"></i> ${l.action_type}</td>
                <td class="p-4 text-xs font-bold leading-relaxed">${l.description}</td>
                <td class="p-4 text-xs font-bold whitespace-nowrap">${new Date(l.created_at).toLocaleString('ar-EG')}</td>
                <td class="p-4 text-center"><button onclick="deleteSingleLog('${l.id}')" class="text-rose-600 hover:text-rose-800 p-1.5 hover:bg-rose-50 rounded-lg transition cursor-pointer font-bold"><i class="fa-solid fa-trash"></i></button></td>
            </tr>
        `;
    }).join('');
}

async function deleteSingleLog(id) {
    if (!confirm('حذف هذا السجل؟')) return;
    await supabaseClient.from('activity_logs').delete().eq('id', id);
    await logActivity('حذف سجل', `حذف سجل حركة ID: ${id}`, true);
    fetchAllData();
}

async function clearAllLogs() {
    if (!confirm('هل أنت متأكد من تفريغ كافة سجلات الحركات؟')) return;
    await supabaseClient.from('activity_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await logActivity('تفريغ السجلات', 'تم تفريغ كافة سجلات النظام الحساسة', true);
    fetchAllData();
}

function switchTab(tab) {
    ['shipments', 'shipment_details', 'orders', 'clients', 'announcements', 'websites', 'expenses', 'logs'].forEach(t => {
        const el = document.getElementById(`section-${t}`);
        const btn = document.getElementById(`btn-tab-${t}`);
        if (el) el.classList.add('hidden');
        if (btn) btn.className = "px-4.5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm bg-slate-200/80 text-slate-700 hover:bg-slate-300 transition cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 hover-scale";
    });
    const targetEl = document.getElementById(`section-${tab}`);
    const targetBtn = document.getElementById(`btn-tab-${tab}`);
    if (targetEl) targetEl.classList.remove('hidden');
    if (targetBtn) targetBtn.className = "px-4.5 py-2.5 rounded-2xl font-black text-xs sm:text-sm bg-emerald-700 text-white transition shadow-md shadow-emerald-700/20 cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 hover-scale";
    
    if (tab === 'shipment_details') {
        renderDetailedShipmentsTab();
    }
}

// CRUD الشحنات
function openShipmentModal() {
    document.getElementById('shipment-form').reset();
    document.getElementById('shipment-id').value = '';
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('form-order-date').value = today;
    document.getElementById('form-shipment-date').value = today;
    document.getElementById('shipment-modal-title').textContent = 'إضافة شحنة رئيسية';
    document.getElementById('shipment-modal').classList.remove('hidden');
}
function closeShipmentModal() { document.getElementById('shipment-modal').classList.add('hidden'); }

async function saveShipment(e) {
    e.preventDefault();
    const orderDate = document.getElementById('form-order-date').value;
    const shipDate = document.getElementById('form-shipment-date').value;

    if (new Date(orderDate) > new Date(shipDate)) {
        alert('خطأ في التواريخ! لا يمكن أن يكون تاريخ الطلب/الشراء بعد تاريخ الوصول للبريد.');
        return;
    }

    const id = document.getElementById('shipment-id').value;
    const code = document.getElementById('form-shipment-code').value;
    const data = {
        shipment_code: code,
        website: document.getElementById('form-shipment-website').value,
        order_date: orderDate,
        date: shipDate,
        shipping_cost: parseFloat(document.getElementById('form-shipping-cost').value || 0),
        commission_rate: parseFloat(document.getElementById('form-commission-rate').value || 0),
        is_received: document.getElementById('form-shipment-received').checked,
        notes: document.getElementById('form-shipment-notes').value
    };
    if (id) {
        await supabaseClient.from('shipments').update(data).eq('id', id);
        await logActivity('تعديل شحنة', `تعديل تفاصيل الشحنة الرئيسية (${code})`, false);
    } else {
        await supabaseClient.from('shipments').insert([data]);
        await logActivity('إضافة شحنة', `إضافة شحنة رئيسية جديدة برمز (${code})`, false);
    }
    closeShipmentModal(); fetchAllData();
}

async function editShipment(id) {
    const s = shipmentsData.find(item => item.id === id);
    if (!s) return;
    document.getElementById('shipment-id').value = s.id;
    document.getElementById('form-shipment-code').value = s.shipment_code;
    document.getElementById('form-shipment-website').value = s.website;
    document.getElementById('form-order-date').value = s.order_date || '';
    document.getElementById('form-shipment-date').value = s.date;
    document.getElementById('form-shipping-cost').value = s.shipping_cost;
    document.getElementById('form-commission-rate').value = s.commission_rate || '';
    document.getElementById('form-shipment-received').checked = s.is_received;
    document.getElementById('form-shipment-notes').value = s.notes || '';
    document.getElementById('shipment-modal-title').textContent = 'تعديل الشحنة';
    document.getElementById('shipment-modal').classList.remove('hidden');
}

async function deleteShipment(id) {
    const s = shipmentsData.find(item => item.id === id);
    if (!confirm(`حذف الشحنة (${s ? s.shipment_code : id})؟`)) return;
    if (s) await supabaseClient.from('orders').delete().eq('shipment_code', s.shipment_code);
    await supabaseClient.from('shipments').delete().eq('id', id);
    await logActivity('حذف شحنة', `حذف الشحنة الرئيسية برمز (${s?.shipment_code}) وطلبياتها المرتبطة`, true);
    fetchAllData();
}

// CRUD الطلبيات
function openOrderModal() {
    if (shipmentsData.length === 0) { alert('أضف شحنة رئيسية أولاً!'); return; }
    document.getElementById('order-form').reset();
    document.getElementById('order-id').value = '';
    document.getElementById('form-discount-rate').value = '0';
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('form-order-item-date').value = today;
    document.getElementById('form-arrival-item-date').value = today;
    document.getElementById('order-modal-title').textContent = 'إضافة طلبية لزبون';
    document.getElementById('order-modal').classList.remove('hidden');
}
function closeOrderModal() { document.getElementById('order-modal').classList.add('hidden'); }

async function saveOrder(e) {
    e.preventDefault();
    const orderDate = document.getElementById('form-order-item-date').value;
    const arrivalDate = document.getElementById('form-arrival-item-date').value;

    if (arrivalDate && new Date(orderDate) > new Date(arrivalDate)) {
        alert('خطأ في التواريخ! لا يمكن أن يكون تاريخ الشراء بعد تاريخ الاستلام.');
        return;
    }

    const id = document.getElementById('order-id').value;
    const clientName = document.getElementById('form-client-name').value;
    const shipCode = document.getElementById('form-order-shipment').value;
    const data = {
        shipment_code: shipCode,
        client_name: clientName,
        order_date: orderDate,
        arrival_date: arrivalDate,
        original_price: parseFloat(document.getElementById('form-original-price').value || 0),
        discount_rate: parseFloat(document.getElementById('form-discount-rate').value || 0),
        cost_price: parseFloat(document.getElementById('form-cost-price').value || 0),
        total_price: parseFloat(document.getElementById('form-total-price').value),
        profit: parseFloat(document.getElementById('form-profit').value),
        is_paid: document.getElementById('form-is-paid').checked,
        is_delivered: document.getElementById('form-is-delivered').checked,
        is_returned: document.getElementById('form-is-returned').checked,
        notes: document.getElementById('form-notes').value
    };
    if (id) {
        await supabaseClient.from('orders').update(data).eq('id', id);
        await logActivity('تعديل طلبية', `تعديل طلبية الزبون (${clientName}) ضمن الشحنة (${shipCode})`, false);
    } else {
        await supabaseClient.from('orders').insert([data]);
        await logActivity('إضافة طلبية', `إضافة طلبية جديدة للزبون (${clientName}) برمز شحنة (${shipCode})`, false);
    }
    closeOrderModal(); fetchAllData();
}

async function editOrder(id) {
    const o = ordersData.find(item => item.id === id);
    if (!o) return;
    document.getElementById('order-id').value = o.id;
    document.getElementById('form-order-shipment').value = o.shipment_code;
    document.getElementById('form-client-name').value = o.client_name;
    document.getElementById('form-order-item-date').value = o.order_date || '';
    document.getElementById('form-arrival-item-date').value = o.arrival_date || '';
    document.getElementById('form-original-price').value = o.original_price || o.total_price;
    document.getElementById('form-discount-rate').value = o.discount_rate || 0;
    document.getElementById('form-cost-price').value = o.cost_price || 0;
    document.getElementById('form-total-price').value = o.total_price;
    document.getElementById('form-profit').value = o.profit;
    document.getElementById('form-is-paid').checked = o.is_paid;
    document.getElementById('form-is-delivered').checked = o.is_delivered;
    document.getElementById('form-is-returned').checked = o.is_returned || false;
    document.getElementById('form-notes').value = o.notes || '';
    document.getElementById('order-modal-title').textContent = 'تعديل الطلبية';
    document.getElementById('order-modal').classList.remove('hidden');
}

async function deleteOrder(id) {
    const o = ordersData.find(item => item.id === id);
    if (!confirm('حذف الطلبية؟')) return;
    await supabaseClient.from('orders').delete().eq('id', id);
    await logActivity('حذف طلبية', `حذف طلبية الزبون (${o ? o.client_name : id}) للشحنة (${o?.shipment_code})`, true);
    fetchAllData();
}

// CRUD الزبائن
function openClientModal() {
    document.getElementById('client-form').reset();
    document.getElementById('client-id').value = '';
    document.getElementById('client-modal-title').textContent = 'إضافة زبون جديد';
    document.getElementById('client-modal').classList.remove('hidden');
}
function closeClientModal() { document.getElementById('client-modal').classList.add('hidden'); }

async function saveClient(e) {
    e.preventDefault();
    const id = document.getElementById('client-id').value;
    const name = document.getElementById('client-form-name').value;
    const data = { 
        name: name, 
        phone: document.getElementById('client-form-phone').value, 
        address: document.getElementById('client-form-address').value,
        admin_notes: document.getElementById('client-form-admin-notes').value
    };
    if (id) {
        await supabaseClient.from('clients').update(data).eq('id', id);
        await logActivity('تعديل زبون', `تعديل بيانات الزبون (${name})`, false);
    } else {
        await supabaseClient.from('clients').insert([data]);
        await logActivity('إضافة زبون', `إضافة زبون جديد باسم (${name})`, false);
    }
    closeClientModal(); fetchAllData();
}

async function editClient(id) {
    const c = clientsData.find(item => item.id === id);
    if (!c) return;
    document.getElementById('client-id').value = c.id;
    document.getElementById('client-form-name').value = c.name;
    document.getElementById('client-form-phone').value = c.phone || '';
    document.getElementById('client-form-address').value = c.address || '';
    document.getElementById('client-form-admin-notes').value = c.admin_notes || '';
    document.getElementById('client-modal-title').textContent = 'تعديل بيانات الزبون والملاحظات';
    document.getElementById('client-modal').classList.remove('hidden');
}

async function deleteClient(id) {
    const c = clientsData.find(item => item.id === id);
    if (!confirm(`حذف الزبون (${c ? c.name : id})؟`)) return;
    await supabaseClient.from('clients').delete().eq('id', id);
    await logActivity('حذف زبون', `حذف الزبون (${c?.name}) نهائياً`, true);
    fetchAllData();
}

// CRUD المواقع
function openWebsiteModal() {
    document.getElementById('website-form').reset();
    document.getElementById('website-id').value = '';
    document.getElementById('website-modal-title').textContent = 'إضافة موقع شراء';
    document.getElementById('website-modal').classList.remove('hidden');
}
function closeWebsiteModal() { document.getElementById('website-modal').classList.add('hidden'); }

async function saveWebsite(e) {
    e.preventDefault();
    const id = document.getElementById('website-id').value;
    const name = document.getElementById('website-form-name').value;
    const data = { name: name, url: document.getElementById('website-form-url').value, notes: document.getElementById('website-form-notes').value };
    if (id) {
        await supabaseClient.from('websites').update(data).eq('id', id);
        await logActivity('تعديل موقع', `تعديل موقع الشراء (${name})`, false);
    } else {
        await supabaseClient.from('websites').insert([data]);
        await logActivity('إضافة موقع', `إضافة موقع شراء جديد (${name})`, false);
    }
    closeWebsiteModal(); fetchAllData();
}

async function editWebsite(id) {
    const w = websitesData.find(item => item.id === id);
    if (!w) return;
    document.getElementById('website-id').value = w.id;
    document.getElementById('website-form-name').value = w.name;
    document.getElementById('website-form-url').value = w.url || '';
    document.getElementById('website-form-notes').value = w.notes || '';
    document.getElementById('website-modal-title').textContent = 'تعديل الموقع';
    document.getElementById('website-modal').classList.remove('hidden');
}

async function deleteWebsite(id) {
    const w = websitesData.find(item => item.id === id);
    if (!confirm('حذف الموقع؟')) return;
    await supabaseClient.from('websites').delete().eq('id', id);
    await logActivity('حذف موقع', `حذف موقع الشراء (${w?.name})`, true);
    fetchAllData();
}

// CRUD المصاريف
function openExpenseModal() {
    document.getElementById('expense-form').reset();
    document.getElementById('expense-id').value = '';
    document.getElementById('expense-form-date').valueAsDate = new Date();
    document.getElementById('expense-modal-title').textContent = 'إضافة مصروف';
    document.getElementById('expense-modal').classList.remove('hidden');
}
function closeExpenseModal() { document.getElementById('expense-modal').classList.add('hidden'); }

async function saveExpense(e) {
    e.preventDefault();
    const id = document.getElementById('expense-id').value;
    const title = document.getElementById('expense-form-title').value;
    const amount = parseFloat(document.getElementById('expense-form-amount').value);
    const data = {
        title: title,
        date: document.getElementById('expense-form-date').value,
        amount: amount,
        notes: document.getElementById('expense-form-notes').value
    };
    if (id) {
        await supabaseClient.from('expenses').update(data).eq('id', id);
        await logActivity('تعديل مصروف', `تعديل بند المصروف (${title}) بقيمة ₪${amount}`, false);
    } else {
        await supabaseClient.from('expenses').insert([data]);
        await logActivity('إضافة مصروف', `إضافة مصروف جديد (${title}) بقيمة ₪${amount}`, false);
    }
    closeExpenseModal(); fetchAllData();
}

async function editExpense(id) {
    const item = expensesData.find(item => item.id === id);
    if (!item) return;
    document.getElementById('expense-id').value = item.id;
    document.getElementById('expense-form-title').value = item.title;
    document.getElementById('expense-form-date').value = item.date;
    document.getElementById('expense-form-amount').value = item.amount;
    document.getElementById('expense-form-notes').value = item.notes || '';
    document.getElementById('expense-modal-title').textContent = 'تعديل المصروف';
    document.getElementById('expense-modal').classList.remove('hidden');
}

async function deleteExpense(id) {
    const ex = expensesData.find(item => item.id === id);
    if (!confirm('حذف المصروف؟')) return;
    await supabaseClient.from('expenses').delete().eq('id', id);
    await logActivity('حذف مصروف', `حذف بند المصروف (${ex?.title}) بقيمة ₪${ex?.amount}`, true);
    fetchAllData();
}
