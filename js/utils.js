// تسجيل الحركات الحساسة والمالية في سجل النظام
async function logActivity(actionType, description, isCritical = false) {
    if (!supabaseClient) return;
    try {
        await supabaseClient.from('activity_logs').insert([{ 
            action_type: actionType, 
            description: description, 
            is_critical: isCritical 
        }]);
    } catch (err) { 
        console.error("Log Activity Error:", err); 
    }
}

// تصدير أي جدول HTML إلى ملف Excel (CSV) مع دعم العربية الكامل (UTF-8 BOM)
function exportTableToExcel(tableBodyId, filename) {
    const tbody = document.getElementById(tableBodyId);
    if (!tbody || tbody.rows.length === 0) { 
        alert('لا توجد بيانات للتصدير!'); 
        return; 
    }
    let csv = [];
    const table = tbody.closest('table');
    const headers = [];
    table.querySelectorAll('thead th').forEach(th => {
        headers.push('"' + th.innerText.replace(/[\n\r]+/g, ' ').trim() + '"');
    });
    csv.push(headers.join(','));

    table.querySelectorAll('tbody tr').forEach(tr => {
        const row = [];
        tr.querySelectorAll('td').forEach((td, idx) => {
            if(idx === tr.querySelectorAll('td').length - 1 && tr.querySelectorAll('td').length > 5) return;
            row.push('"' + td.innerText.replace(/[\n\r]+/g, ' ').trim() + '"');
        });
        if(row.length > 0) csv.push(row.join(','));
    });

    const blob = new Blob(["\ufeff" + csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// فتح مودال الفاتورة الرسمية (مشترك بين بوابة الزبائن ولوحة الإدارة)
function openInvoiceModal(type, targetCodeOrName) {
    const todayStr = new Date().toISOString().split('T')[0];
    document.getElementById('inv-date').textContent = `التاريخ: ${todayStr}`;
    document.getElementById('inv-title-type').textContent = "فاتورة مبيعات / استلام";
    document.getElementById('inv-col-extra').textContent = "المبلغ النهائي (₪)";
    
    let items = [];
    let clientName = "-";
    let clientPhone = "-";
    let clientAddress = "-";
    let refCodeText = "-";

    if (type === 'shipment') {
        refCodeText = `شحنة رئيسية: ${targetCodeOrName}`;
        items = ordersData.filter(o => o.shipment_code === targetCodeOrName && !o.is_returned);
        clientName = "مشتركو الشحنة (" + targetCodeOrName + ")";
    } else if (type === 'client') {
        const clientObj = clientsData.find(c => c.name === targetCodeOrName);
        if (clientObj) {
            clientName = clientObj.name;
            clientPhone = clientObj.phone || '-';
            clientAddress = clientObj.address || '-';
        }
        refCodeText = `كشف حساب زبون: ${targetCodeOrName}`;
        items = ordersData.filter(o => o.client_name === targetCodeOrName && !o.is_returned);
    }

    document.getElementById('inv-code').textContent = refCodeText;
    document.getElementById('inv-client-name').textContent = clientName;
    document.getElementById('inv-client-phone').textContent = clientPhone;
    document.getElementById('inv-client-address').textContent = clientAddress;

    const tbody = document.getElementById('inv-items-table');
    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400">لا توجد بنود مطابقة.</td></tr>`;
        document.getElementById('inv-subtotal').textContent = "₪0.00";
        document.getElementById('inv-grand-total').textContent = "₪0.00";
        document.getElementById('invoice-modal').classList.remove('hidden');
        return;
    }

    let subtotal = 0;
    tbody.innerHTML = items.map(o => {
        const total = Number(o.total_price || 0);
        subtotal += total;
        return `
            <tr class="border-b border-slate-100 text-xs font-bold hover:bg-slate-50">
                <td class="p-3 font-black text-emerald-800">${o.shipment_code}</td>
                <td class="p-3 text-slate-800">${o.notes || 'قطع متنوعة'}</td>
                <td class="p-3 text-slate-700">${o.order_date || '-'}</td>
                <td class="p-3 text-slate-700">${o.arrival_date || '-'}</td>
                <td class="p-3 text-slate-700">₪${Number(o.total_price).toFixed(2)}</td>
                <td class="p-3 font-black text-slate-900">₪${total.toFixed(2)}</td>
            </tr>
        `;
    }).join('');

    document.getElementById('inv-subtotal').textContent = `₪${subtotal.toFixed(2)}`;
    document.getElementById('inv-total-label').textContent = "الصافي المطلوب:";
    document.getElementById('inv-grand-total').textContent = `₪${subtotal.toFixed(2)}`;
    document.getElementById('invoice-modal').classList.remove('hidden');
}

function closeInvoiceModal() { 
    document.getElementById('invoice-modal').classList.add('hidden'); 
}
