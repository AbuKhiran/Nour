// إعدادات الاتصال بقاعدة البيانات Supabase والمتغيرات العامة المشتركة
const SUPABASE_URL = "https://xjgxuwphpyzeqeacyshp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_wb8bUw9HTSQteDeaxMwF1g_qisXRsgA";

let supabaseClient = null;
try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (err) {
    console.error("Supabase Initialization Error:", err);
}

// مصفوفات البيانات المشتركة بين الصفحات
let shipmentsData = [];
let ordersData = [];
let clientsData = [];
let websitesData = [];
let expensesData = [];
let logsData = [];
let announcementsData = [];
let adminContactPhone = "972500000000";
