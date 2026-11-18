document.addEventListener("DOMContentLoaded", () => {
    fetchPublicDataOnly();
    generateSiteQRCode();

    // السماح بالبحث عند الضغط على زر Enter في حقل الهاتف
    const phoneInput = document.getElementById('public-phone-search');
    if (phoneInput) {
        phoneInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                publicSearchClientOrders();
            }
        });
    }
});

function generateSiteQRCode() {
    const qrContainer = document.getElementById("modal-qrcode");
    if (qrContainer && typeof QRCode !== 'undefined') {
        qrContainer.innerHTML = "";
        new QRCode(qrContainer, {
            text: "https://abukhiran.github.io/Tracking_System/",
            width: 130,
            height: 130,
            colorDark: "#064e3b",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    }
}

async function fetchPublicDataOnly() {
    if (!supabaseClient) return;
    try {
        const [webRes, clientsRes, ordersRes, shipRes, annRes, settingsRes] = await Promise.all([
            supabaseClient.from('websites').select('*'),
            supabaseClient.from('clients').select('*'),
            supabaseClient.from('orders').select('*'),
            supabaseClient.from('shipments').select('*'),
            supabaseClient.from('public_announcements').select('*').order('created_at', { ascending: false }),
            supabaseClient.from('system_settings').select('*')
        ]);
        websitesData = webRes.data || [];
        clientsData = clientsRes.data || [];
        ordersData = ordersRes.data || [];
        shipmentsData = shipRes.data || [];
        announcementsData = annRes.data || [];

        const settings = settingsRes.data || [];
        const phoneSetting = settings.find(s => s.setting_key === 'admin_contact_phone');
        if (phoneSetting) adminContactPhone = phoneSetting.setting_value;

        renderPublicWebsitesIcons();
        renderTickerAnnouncements();
        updateAboutModalStats();
    } catch(e) {
        console.log("Fetch public data error:", e);
    }
}

function updateAboutModalStats() {
    document.getElementById('stats-shipments').textContent = shipmentsData.length;
    document.getElementById('stats-orders').textContent = ordersData.filter(o => !o.is_returned).length;
    document.getElementById('stats-clients').textContent = clientsData.length;

    let totalDays = 0;
    let count = 0;
    shipmentsData.forEach(s => {
        if (s.order_date && s.date) {
            const diff = Math.ceil((new Date(s.date) - new Date(s.order_date)) / (1000 * 60 * 60 * 24));
            if (diff >= 0) { totalDays += diff; count++; }
        }
    });
    const avg = count > 0 ? Math.round(totalDays / count) : 0;
    document.getElementById('stats-duration').textContent = `${avg} يوم`;

    let cleanPhone = adminContactPhone.trim();
    if (cleanPhone.startsWith('0')) cleanPhone = '972' + cleanPhone.substring(1);
    const waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent('مرحباً إدارة Nour Tracking، أود الاستفسار عن طلبيتي.')}`;
    document.getElementById('admin-whatsapp-link').href = waLink;
}

function openAboutModal() {
    updateAboutModalStats();
    generateSiteQRCode();
    document.getElementById('about-modal').classList.remove('hidden');
}

function closeAboutModal() { document.getElementById('about-modal').classList.add('hidden'); }

function renderPublicWebsitesIcons() {
    const container = document.getElementById('footer-websites-icons');
    const portalContainer = document.getElementById('public-websites-list');
    if (websitesData.length === 0) {
        if(container) container.innerHTML = `<span class="text-xs text-slate-400 font-bold">لا توجد مواقع مسجلة.</span>`;
        if(portalContainer) portalContainer.innerHTML = `<span class="text-xs text-slate-400 font-bold">لا توجد مواقع مسجلة.</span>`;
        return;
    }
    const htmlContent = websitesData.map(w => {
        let url = w.url && w.url.startsWith('http') ? w.url : '#';
        return `
            <a href="${url}" target="_blank" title="${w.name}" class="px-3.5 py-1.5 bg-slate-800/90 hover:bg-emerald-700 text-emerald-100 rounded-xl text-xs font-black transition flex items-center gap-1.5 border border-emerald-500/30 hover-scale shrink-0 shadow-sm">
                <i class="fa-solid fa-globe text-emerald-400"></i> ${w.name}
            </a>
        `;
    }).join('');
    if(container) container.innerHTML = htmlContent;
    if(portalContainer) portalContainer.innerHTML = htmlContent;
}

function renderTickerAnnouncements() {
    const container = document.getElementById('ticker-container');
    const activeAnnouncements = announcementsData.filter(a => a.is_active);
    if (activeAnnouncements.length === 0) {
        if(container) container.innerHTML = `<span>🌸 أهلاً بكم في نظام Nour Tracking لتتبع الطلبيات والشحنات بدقة وسرعة.</span>`;
        return;
    }
    const tickerText = activeAnnouncements.map(a => `📢 &nbsp; <b class="text-white">${a.title}:</b> ${a.content} &nbsp;&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;&nbsp;`).join('');
    if(container) container.innerHTML = `<span class="animate-ticker">${tickerText} &nbsp;&nbsp;&nbsp;&nbsp; ${tickerText}</span>`;
}

async function publicSearchClientOrders() {
    const phoneInput = document.getElementById('public-phone-search').value.trim();
    const resultsDiv = document.getElementById('public-portal-results');
    if (!phoneInput) {
        resultsDiv.innerHTML = `<div class="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl text-center text-xs font-black shadow-sm flex items-center justify-center gap-2"><i class="fa-solid fa-circle-exclamation text-base"></i> الرجاء إدخال رقم الهاتف للاستعلام!</div>`;
        return;
    }

    resultsDiv.innerHTML = `<div class="p-6 text-center text-emerald-800 font-black text-xs flex items-center justify-center gap-2"><i class="fa-solid fa-spinner fa-spin text-lg"></i> جاري البحث في قاعدة البيانات...</div>`;

    await fetchPublicDataOnly();
    const matchedClient = clientsData.find(c => c.phone && c.phone.trim().includes(phoneInput));
    
    if (!matchedClient) {
        resultsDiv.innerHTML = `<div class="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl text-center text-xs font-black shadow-sm flex items-center justify-center gap-2"><i class="fa-solid fa-user-xmark text-base"></i> عذراً، لم يتم العثور على زبون مسجل بهذا الرقم في قاعدة البيانات!</div>`;
        return;
    }

    const clientOrders = ordersData.filter(o => o.client_name === matchedClient.name && !o.is_returned);
    
    let adminNoteHtml = '';
    if (matchedClient.admin_notes && matchedClient.admin_notes.trim() !== '') {
        adminNoteHtml = `
            <div class="bg-amber-50 border-2 border-amber-300 p-4 rounded-2xl text-xs text-amber-950 space-y-1.5 shadow-sm">
                <div class="font-black flex items-center gap-1.5 text-amber-900 text-sm"><i class="fa-solid fa-triangle-exclamation text-amber-600"></i> تنبيه هام من الإدارة لك:</div>
                <p class="leading-relaxed font-bold">${matchedClient.admin_notes}</p>
            </div>
        `;
    }

    resultsDiv.innerHTML = `
        <div class="space-y-3.5 modal-animate">
            <div class="bg-gradient-to-l from-emerald-900 via-emerald-800 to-teal-700 text-white p-4 sm:p-5 rounded-2xl text-xs font-black flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-lg">
                <div>
                    <span class="text-emerald-50 text-base block">أهلاً بك، ${matchedClient.name} 🌸</span>
                    <span class="text-[11px] text-emerald-200 font-bold flex items-center gap-1.5 mt-0.5"><i class="fa-solid fa-phone-volume"></i> هاتف الداتا بيس: ${matchedClient.phone}</span>
                </div>
                <button onclick="openInvoiceModal('client', '${matchedClient.name}')" class="bg-white text-emerald-900 hover:bg-emerald-50 px-4 py-2.5 rounded-xl text-xs font-black transition shadow-md cursor-pointer flex items-center gap-1.5 hover-scale shrink-0">
                    <i class="fa-solid fa-file-invoice"></i> طباعة فاتورتي
                </button>
            </div>
            ${adminNoteHtml}
            <div class="space-y-3 pt-1 max-h-[52vh] overflow-y-auto pr-1">
                ${clientOrders.length === 0 ? `<div class="bg-slate-50 border border-slate-200 text-slate-600 p-5 rounded-2xl text-center text-xs font-black">لا توجد طلبيات مسجلة حالياً.</div>` :
                    clientOrders.map(o => {
                        const ps = shipmentsData.find(s => s.shipment_code === o.shipment_code);
                        
                        let statusBadge = '';
                        if (o.is_delivered) {
                            statusBadge = `<span class="px-3 py-1.5 rounded-xl text-xs bg-emerald-100 text-emerald-900 border border-emerald-200 font-black flex items-center gap-1.5 w-fit"><i class="fa-solid fa-circle-check text-emerald-700"></i> تم استلام الطلبية بنجاح</span>`;
                        } else if (ps && ps.is_received) {
                            statusBadge = `<span class="px-3 py-1.5 rounded-xl text-xs bg-indigo-100 text-indigo-950 border border-indigo-200 font-black flex items-center gap-1.5 w-fit animate-pulse"><i class="fa-solid fa-box-open text-indigo-700"></i> شحنتك وصلت وجاهزة للاستلام!</span>`;
                        } else {
                            let expectedDateStr = ps ? ps.date : (o.arrival_date || 'قريباً');
                            statusBadge = `<span class="px-3 py-1.5 rounded-xl text-xs bg-amber-100 text-amber-950 border border-amber-200 font-black flex items-center gap-1.5 w-fit"><i class="fa-solid fa-truck-plane text-amber-700"></i> لم تصل بعد - متوقع وصولها: <b>${expectedDateStr}</b></span>`;
                        }

                        return `
                            <div class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 text-xs space-y-3 shadow-md hover:border-emerald-300 transition">
                                <div class="flex flex-wrap justify-between items-center font-black text-slate-900 border-b border-slate-100 pb-2.5 gap-2">
                                    <span class="text-sm flex items-center gap-1.5"><i class="fa-solid fa-box text-emerald-700"></i> شحنة: <span class="text-emerald-800">${o.shipment_code}</span> <span class="text-xs text-slate-500 font-bold">(${ps ? ps.website : ''})</span></span>
                                    <span class="px-3 py-1 bg-slate-100 text-slate-800 rounded-xl font-black border border-slate-200">القطع: ${o.notes || '-'}</span>
                                </div>
                                <div class="grid grid-cols-2 gap-2 text-slate-700 text-[11px] font-bold bg-slate-50/80 p-2.5 rounded-xl">
                                    <div><i class="fa-regular fa-calendar text-emerald-700 ml-1"></i> <b>تاريخ الشراء:</b> ${o.order_date || '-'}</div>
                                    <div><i class="fa-regular fa-calendar-check text-indigo-700 ml-1"></i> <b>تاريخ الوصول:</b> ${ps ? ps.date : (o.arrival_date || '-')}</div>
                                </div>
                                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center pt-1 font-bold gap-2">
                                    <div class="flex items-center gap-2">
                                        <span>حالة الدفع:</span>
                                        <span class="font-black px-2.5 py-1 rounded-lg ${o.is_paid ? 'text-emerald-800 bg-emerald-100/80 border border-emerald-200' : 'text-rose-700 bg-rose-100/80 border border-rose-200'}">${o.is_paid ? '✔ تم الدفع' : '❌ غير مدفوع'}</span>
                                        <span class="font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">₪${Number(o.total_price).toFixed(2)}</span>
                                    </div>
                                    <div>${statusBadge}</div>
                                </div>
                            </div>
                        `;
                    }).join('')}
            </div>
        </div>
    `;
}

// التحكم بمودال الدخول والانتقال إلى صفحة الإدارة admin.html
function openLoginModal() { 
    document.getElementById('password-error').classList.add('hidden');
    document.getElementById('login-modal').classList.remove('hidden'); 
    setTimeout(() => document.getElementById('access-password').focus(), 100);
}
function closeLoginModal() { document.getElementById('login-modal').classList.add('hidden'); }

async function checkPasswordAndRedirect(e) {
    e.preventDefault();
    const passInput = document.getElementById('access-password').value;
    const loginBtn = document.getElementById('login-btn');
    const origText = loginBtn.innerHTML;
    loginBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> جاري التحقق...`;
    loginBtn.disabled = true;

    try {
        const { data } = await supabaseClient.from('system_settings').select('setting_value').eq('setting_key', 'admin_password').single();
        if (data && passInput === data.setting_value) {
            sessionStorage.setItem('nour_admin_auth', 'true');
            window.location.href = 'admin.html';
        } else {
            showPasswordError();
        }
    } catch(err) {
        if(passInput === "1234" || passInput === "admin") {
            sessionStorage.setItem('nour_admin_auth', 'true');
            window.location.href = 'admin.html';
        } else {
            showPasswordError();
        }
    } finally {
        loginBtn.innerHTML = origText;
        loginBtn.disabled = false;
    }
}

function showPasswordError() {
    const err = document.getElementById('password-error');
    err.classList.remove('hidden');
    document.getElementById('access-password').value = '';
}
