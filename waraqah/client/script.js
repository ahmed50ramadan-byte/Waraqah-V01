// =============================================================
// 0. أدوات مساعدة عامة
// =============================================================

function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return unsafe.toString()
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function showToast(message, type = 'success') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'toast-error' : 'toast-success'}`;
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

function fileUrl(relativePath) {
    if (!relativePath) return '';
    if (relativePath.startsWith('http')) return relativePath;
    // API_BASE_URL ينتهي بـ /api - الملفات المرفوعة عالميًا تحت جذر السيرفر
    const serverRoot = API_BASE_URL.replace(/\/api\/?$/, '');
    return serverRoot + relativePath;
}

// =============================================================
// 1. طبقة الاتصال بالـ API (fetch wrapper) + إدارة الرموز (JWT)
// =============================================================

function getStaffToken() { return localStorage.getItem('waraqah_staff_token'); }
function setStaffToken(token) { localStorage.setItem('waraqah_staff_token', token); }
function clearStaffToken() { localStorage.removeItem('waraqah_staff_token'); localStorage.removeItem('waraqah_staff_user'); }

function getStaffUser() {
    const raw = localStorage.getItem('waraqah_staff_user');
    return raw ? JSON.parse(raw) : null;
}
function setStaffUser(user) { localStorage.setItem('waraqah_staff_user', JSON.stringify(user)); }

function getReaderToken() { return localStorage.getItem('waraqah_reader_token'); }
function setReaderToken(token) { localStorage.setItem('waraqah_reader_token', token); }
function clearReaderToken() { localStorage.removeItem('waraqah_reader_token'); localStorage.removeItem('waraqah_reader_user'); }

function getReaderUser() {
    const raw = localStorage.getItem('waraqah_reader_user');
    return raw ? JSON.parse(raw) : null;
}
function setReaderUser(reader) { localStorage.setItem('waraqah_reader_user', JSON.stringify(reader)); }

/**
 * غلاف موحّد لطلبات الـ API. يضيف التوكن المناسب تلقائيًا.
 * body: إما كائن JS عادي (هيتحول JSON) أو FormData (هيتبعت زي ما هو لدعم رفع الملفات).
 */
async function apiRequest(path, { method = 'GET', body = null, authType = null } = {}) {
    const headers = {};
    let finalBody = body;

    if (body && !(body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
        finalBody = JSON.stringify(body);
    }

    if (authType === 'staff') {
        const token = getStaffToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
    } else if (authType === 'reader') {
        const token = getReaderToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
    } else if (authType === 'reader-optional') {
        const token = getReaderToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${path}`, { method, headers, body: finalBody });

    let data = null;
    try { data = await response.json(); } catch (e) { data = null; }

    if (!response.ok) {
        const message = (data && data.message) ? data.message : 'حدث خطأ أثناء الاتصال بالخادم.';
        throw new Error(message);
    }
    return data;
}

// =============================================================
// 2. الأدوار والتصنيفات (نفس القوائم المستخدمة في الباك إند)
// =============================================================

const ROLES = {
    OWNER: 'المالك (Owner)',
    EDITOR_IN_CHIEF: 'رئيس التحرير (Editor-in-Chief)',
    DEPUTY_EDITOR: 'نائب رئيس التحرير (Deputy Editor)',
    MANAGING_EDITOR: 'مدير التحرير (Managing Editor)',
    EDITORIAL_COORDINATOR: 'منسق التحرير (Editorial Coordinator)',
    SECTION_EDITOR: 'محرر القسم (Section Editor)',
    CONTENT_WRITER: 'كاتب المحتوى (Content Writer)',
    TRANSLATOR: 'المترجم الأدبي (Translator)',
    PROOFREADER: 'المدقق اللغوي (Proofreader)',
    GRAPHIC_DESIGNER: 'مصمم الجرافيك (Graphic Designer)',
    DIGITAL_CONTENT_MANAGER: 'مدير المحتوى الرقمي (Digital Content Manager)',
    IT: 'قسم تكنولوجيا المعلومات (IT)'
};
const ALL_ROLES = Object.values(ROLES);

const REVIEWER_ROLES = [
    ROLES.OWNER, ROLES.EDITOR_IN_CHIEF, ROLES.DEPUTY_EDITOR,
    ROLES.MANAGING_EDITOR, ROLES.EDITORIAL_COORDINATOR, ROLES.SECTION_EDITOR
];
const WRITER_ROLES = [...REVIEWER_ROLES, ROLES.CONTENT_WRITER, ROLES.TRANSLATOR];
const TEAM_MANAGER_ROLES = [ROLES.OWNER, ROLES.EDITOR_IN_CHIEF];
const STAFF_CREATOR_ROLES = [ROLES.OWNER, ROLES.EDITOR_IN_CHIEF, ROLES.MANAGING_EDITOR, ROLES.IT];
const SETTINGS_MANAGER_ROLES = [ROLES.OWNER, ROLES.EDITOR_IN_CHIEF, ROLES.IT];

function canReviewArticles() {
    const user = getStaffUser();
    return !!user && REVIEWER_ROLES.includes(user.role);
}
function canWriteArticles() {
    const user = getStaffUser();
    return !!user && WRITER_ROLES.includes(user.role);
}
function canManageTeam() {
    const user = getStaffUser();
    return !!user && TEAM_MANAGER_ROLES.includes(user.role);
}
function canCreateStaffAccounts() {
    const user = getStaffUser();
    return !!user && STAFF_CREATOR_ROLES.includes(user.role);
}
function canManageSettings() {
    const user = getStaffUser();
    return !!user && SETTINGS_MANAGER_ROLES.includes(user.role);
}

const CATEGORIES = [
    { emoji: "📖", title: "الرواية", subs: ["مراجعات", "تحليلات", "ترشيحات"] },
    { emoji: "📚", title: "القصة القصيرة", subs: ["قراءات نقدية", "مختارات", "مدارس القصة"] },
    { emoji: "✒️", title: "الشعر", subs: ["شعر عربي", "شعر عالمي", "قراءات شعرية"] },
    { emoji: "🖋️", title: "المقال الأدبي", subs: ["أفكار وتأملات", "قضايا أدبية", "الكتابة والإبداع"] },
    { emoji: "🎭", title: "النقد الأدبي", subs: ["تحليل النصوص", "المدارس الأدبية", "المقارنات"] },
    { emoji: "🌍", title: "الأدب العالمي", subs: ["أدباء العالم", "روايات مترجمة", "تيارات أدبية"] },
    { emoji: "🇪🇬", title: "الأدب العربي", subs: ["الأدب المصري", "الأدب الخليجي", "الأدب المغاربي", "الأدب الشامي"] },
    { emoji: "👤", title: "كتّاب وأدباء", subs: ["سير ذاتية", "حوارات", "أعمال مختارة"] },
    { emoji: "📝", title: "اقتباسات", subs: ["اقتباسات روائية", "شعر", "أقوال الأدباء"] },
    { emoji: "🆕", title: "إصدارات جديدة", subs: ["الكتب الجديدة", "الجوائز الأدبية", "أخبار النشر", "المعارض"] },
    { emoji: "🎬", title: "الأدب والسينما", subs: ["روايات تحولت لأفلام", "اقتباسات درامية"] },
    { emoji: "📜", title: "التراث والكلاسيكيات", subs: ["الأدب القديم", "المخطوطات", "أعلام التراث"] }
];

// =============================================================
// 3. الساعة الحية
// =============================================================

function startSmartClock() {
    function updateClock() {
        const dateElement = document.getElementById('live-date-time');
        if (!dateElement) return;
        let userTimeZone = "Africa/Cairo";
        try {
            const detectedZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            if (detectedZone) userTimeZone = detectedZone;
        } catch (e) { /* fallback */ }

        const now = new Date();
        const options = {
            timeZone: userTimeZone, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        };
        dateElement.innerText = `${new Intl.DateTimeFormat('ar-EG', options).format(now)} (${userTimeZone})`;
    }
    updateClock();
    setInterval(updateClock, 1000);
}

// =============================================================
// 4. دخول/خروج الموظفين + إعداد أول حساب (Bootstrap)
// =============================================================

function openLoginModal() { document.getElementById('loginModal').classList.remove('hidden'); }
function closeLoginModal() {
    document.getElementById('loginModal').classList.add('hidden');
    document.getElementById('login-error').classList.add('hidden');
    document.getElementById('bootstrap-error').classList.add('hidden');
}

function toggleBootstrapForm() {
    document.getElementById('bootstrap-form').classList.toggle('hidden');
}

async function handleBootstrap(event) {
    event.preventDefault();
    const username = document.getElementById('bootstrap-username').value.trim();
    const password = document.getElementById('bootstrap-password').value.trim();
    const errorEl = document.getElementById('bootstrap-error');

    try {
        const data = await apiRequest('/auth/bootstrap', { method: 'POST', body: { username, password } });
        setStaffToken(data.token);
        setStaffUser(data.user);
        closeLoginModal();
        await syncUserSessionUI();
        showToast('تم تفعيل حساب المالك بنجاح!');
    } catch (err) {
        errorEl.innerText = err.message;
        errorEl.classList.remove('hidden');
    }
}

async function handleLogin(event) {
    event.preventDefault();
    const username = document.getElementById('usernameInput').value.trim();
    const password = document.getElementById('passwordInput').value.trim();
    const errorEl = document.getElementById('login-error');

    try {
        const data = await apiRequest('/auth/login', { method: 'POST', body: { username, password } });
        setStaffToken(data.token);
        setStaffUser(data.user);
        closeLoginModal();
        await syncUserSessionUI();
        showToast(`أهلاً بك [${data.user.username}]`);
    } catch (err) {
        errorEl.innerText = err.message;
        errorEl.classList.remove('hidden');
    }
}

function handleLogout() {
    if (confirm('هل تود تسجيل الخروج من لوحة التحكّم؟')) {
        clearStaffToken();
        syncUserSessionUI();
        showToast('تم تسجيل الخروج.');
    }
}

async function handleCreateUser(event) {
    event.preventDefault();
    const username = document.getElementById('new-user-name').value.trim();
    const email = document.getElementById('new-user-email').value.trim();
    const password = document.getElementById('new-user-password').value.trim();
    const role = document.getElementById('new-user-role').value;

    try {
        await apiRequest('/auth/staff', {
            method: 'POST',
            authType: 'staff',
            body: { username, email, password, role }
        });
        document.getElementById('new-user-name').value = '';
        document.getElementById('new-user-email').value = '';
        document.getElementById('new-user-password').value = '';
        showToast(`تم إنشاء حساب الموظف [${username}] بنجاح!`);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// =============================================================
// 5. حساب القارئ
// =============================================================

function openReaderModal() {
    document.getElementById('readerModal').classList.remove('hidden');
    switchReaderTab('login');
}
function closeReaderModal() {
    document.getElementById('readerModal').classList.add('hidden');
    document.getElementById('reader-login-error').classList.add('hidden');
    document.getElementById('reader-register-error').classList.add('hidden');
}

function switchReaderTab(tab) {
    const forms = {
        login: document.getElementById('reader-login-form'),
        register: document.getElementById('reader-register-form'),
        account: document.getElementById('reader-account-form')
    };
    const tabs = {
        login: document.getElementById('reader-tab-login'),
        register: document.getElementById('reader-tab-register'),
        account: document.getElementById('reader-tab-account')
    };

    Object.keys(forms).forEach(key => {
        forms[key].classList.toggle('hidden', key !== tab);
        tabs[key].classList.toggle('active-tab', key === tab);
    });
}

async function handleReaderRegister(event) {
    event.preventDefault();
    const name = document.getElementById('reader-register-name').value.trim();
    const email = document.getElementById('reader-register-email').value.trim();
    const password = document.getElementById('reader-register-password').value.trim();
    const referralCode = document.getElementById('reader-register-referral').value.trim();
    const errorEl = document.getElementById('reader-register-error');

    try {
        const data = await apiRequest('/readers/register', { method: 'POST', body: { name, email, password, referralCode } });
        setReaderToken(data.token);
        setReaderUser(data.reader);
        closeReaderModal();
        await syncReaderSessionUI();
        event.target.reset();
        showPointsToast(data.welcomeBonus || 100, `🎉 أهلاً بك ${data.reader.name}! كسبت مكافأة ترحيبية`);
    } catch (err) {
        errorEl.innerText = err.message;
        errorEl.classList.remove('hidden');
    }
}

async function handleReaderLogin(event) {
    event.preventDefault();
    const email = document.getElementById('reader-login-email').value.trim();
    const password = document.getElementById('reader-login-password').value.trim();
    const errorEl = document.getElementById('reader-login-error');

    try {
        const data = await apiRequest('/readers/login', { method: 'POST', body: { email, password } });
        setReaderToken(data.token);
        setReaderUser(data.reader);
        closeReaderModal();
        await syncReaderSessionUI();
        event.target.reset();
        if (data.dailyBonusAwarded) {
            showPointsToast(5, '🎉 مكافأة تسجيل الدخول اليومي');
        }
    } catch (err) {
        errorEl.innerText = err.message;
        errorEl.classList.remove('hidden');
    }
}

function handleReaderLogout() {
    if (confirm('هل تود تسجيل الخروج من حساب القارئ؟')) {
        clearReaderToken();
        syncReaderSessionUI();
    }
}

async function handleUpdateReaderAccount(event) {
    event.preventDefault();
    if (!getReaderToken()) {
        showToast('يجب تسجيل الدخول أولاً عشان تقدر تعدّل بياناتك.', 'error');
        switchReaderTab('login');
        return;
    }

    const newEmail = document.getElementById('account-new-email').value.trim();
    const newPassword = document.getElementById('account-new-password').value.trim();
    const currentPassword = document.getElementById('account-current-password').value.trim();
    const errorEl = document.getElementById('reader-account-error');

    try {
        const data = await apiRequest('/readers/account', {
            method: 'PUT', authType: 'reader', body: { newEmail, newPassword, currentPassword }
        });
        setReaderUser(data.reader);
        errorEl.classList.add('hidden');
        event.target.reset();
        showToast('تم تحديث بيانات حسابك بنجاح!');
        closeReaderModal();
    } catch (err) {
        errorEl.innerText = err.message;
        errorEl.classList.remove('hidden');
    }
}

async function handleForgotPassword() {
    const email = document.getElementById('forgot-password-email').value.trim();
    const messageEl = document.getElementById('forgot-password-message');

    if (!email) {
        showToast('يرجى إدخال البريد الإلكتروني أولاً.', 'error');
        return;
    }

    try {
        const data = await apiRequest('/readers/forgot-password', { method: 'POST', body: { email } });
        messageEl.innerText = data.message;
        messageEl.classList.remove('hidden');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function syncReaderSessionUI() {
    let reader = getReaderUser();
    if (reader && getReaderToken()) {
        try {
            const data = await apiRequest('/readers/me', { authType: 'reader' });
            reader = data.reader;
            setReaderUser(reader);
        } catch (err) {
            clearReaderToken();
            reader = null;
        }
    }

    const loginBtn = document.getElementById('reader-login-btn');
    const logoutBtn = document.getElementById('reader-logout-btn');
    const nameEl = document.getElementById('reader-display-name');
    const waraqBadge = document.getElementById('reader-waraq-badge');

    if (reader) {
        loginBtn.classList.add('hidden');
        logoutBtn.classList.remove('hidden');
        nameEl.classList.remove('hidden');
        nameEl.innerText = reader.name;
        waraqBadge.classList.remove('hidden');
        await refreshWaraqBalance();
    } else {
        loginBtn.classList.remove('hidden');
        logoutBtn.classList.add('hidden');
        nameEl.classList.add('hidden');
        nameEl.innerText = '';
        waraqBadge.classList.add('hidden');
    }
    if (!getStaffToken()) renderGuestBadge(); // لو مفيش موظف مسجل، حدّث شارة "زائر/وراق" فورًا
    renderHomeFeed();
}

// يحدّث رقم رصيد الورق الظاهر في الهيدر من أحدث بيانات من السيرفر
async function refreshWaraqBalance() {
    if (!getReaderToken()) return null;
    try {
        const data = await apiRequest('/points/me', { authType: 'reader' });
        const amountEl = document.getElementById('reader-waraq-amount');
        if (amountEl) amountEl.innerText = data.waraqBalance;
        return data;
    } catch (err) {
        return null;
    }
}

// =============================================================
// 6. مزامنة واجهة الموظفين
// =============================================================

function populateRoleSelect(selectEl, roles) {
    selectEl.innerHTML = roles.map(r => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join('');
}

// يعرض شارة الموظف لغير المسجلين كموظفين: لو القارئ مسجل دخول (حتى بدون حساب موظف)
// نظهر "وراق" بدل "زائر" عشان منوهمهوش إنه غير مسجل خالص، وإلا نفضل "زائر" الحقيقي.
function renderGuestBadge() {
    const userBadge = document.getElementById('user-status-badge');
    const userName = document.getElementById('user-display-name');
    const readerIsLoggedIn = !!getReaderToken() && !!getReaderUser();

    if (readerIsLoggedIn) {
        userBadge.innerText = "وراق";
        userBadge.className = "bg-teal-600 text-white px-2 py-0.5 rounded text-xs font-bold font-body";
        userName.innerText = getReaderUser().name;
        userName.classList.remove('hidden');
    } else {
        userBadge.innerText = "زائر";
        userBadge.className = "bg-amber-600 text-white px-2 py-0.5 rounded text-xs font-bold font-body";
        userName.innerText = "غير مسجل";
        userName.classList.add('hidden');
    }
}

async function syncUserSessionUI() {
    // نتأكد من صلاحية الجلسة مع السيرفر بدل ما نثق في بيانات المتصفح لوحدها -
    // لو التوكن منتهي أو غير صالح (مثلاً بعد تغيير JWT_SECRET أو حذف الحساب)، نسجّل خروج تلقائيًا
    // بدل ما نفضل نعرض حالة "مسجل" وهمية.
    let user = getStaffUser();
    if (user && getStaffToken()) {
        try {
            const data = await apiRequest('/auth/me', { authType: 'staff' });
            user = data.user;
            setStaffUser(user); // تحديث البيانات المحفوظة محليًا لو الدور اتغيّر من مكان تاني
        } catch (err) {
            clearStaffToken();
            user = null;
        }
    }

    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const userBadge = document.getElementById('user-status-badge');
    const userName = document.getElementById('user-display-name');

    const adminQueueBox = document.getElementById('admin-queue-box');
    const userCreationPanel = document.getElementById('user-creation-panel');
    const articleSubmissionSection = document.getElementById('article-submission-section');
    const addTeamForm = document.getElementById('add-team-form');
    const siteSettingsPanel = document.getElementById('site-settings-panel');
    const adsAdminPanel = document.getElementById('ads-admin-panel');
    const goldMembershipPanel = document.getElementById('gold-membership-panel');

    if (user) {
        loginBtn.classList.add('hidden');
        logoutBtn.classList.remove('hidden');

        userBadge.innerText = user.role;
        userBadge.className = "bg-green-700 text-white px-2 py-0.5 rounded text-xs font-bold font-body";
        userName.innerText = user.username;
        userName.classList.remove('hidden');

        adminQueueBox.classList.remove('hidden');
        userCreationPanel.classList.toggle('hidden', !canCreateStaffAccounts());
        articleSubmissionSection.classList.toggle('hidden', !canWriteArticles());
        addTeamForm.classList.toggle('hidden', !canManageTeam());

        const showSettings = canManageSettings();
        siteSettingsPanel.classList.toggle('hidden', !showSettings);
        adsAdminPanel.classList.toggle('hidden', !showSettings);
        goldMembershipPanel.classList.toggle('hidden', !showSettings);
        if (showSettings) {
            await loadSettingsIntoForm();
            await loadAdsAdminPanel();
            await handleSearchReaders();
        }

    } else {
        loginBtn.classList.remove('hidden');
        logoutBtn.classList.add('hidden');

        renderGuestBadge();

        adminQueueBox.classList.add('hidden');
        userCreationPanel.classList.add('hidden');
        articleSubmissionSection.classList.add('hidden');
        addTeamForm.classList.add('hidden');
        siteSettingsPanel.classList.add('hidden');
        adsAdminPanel.classList.add('hidden');
        goldMembershipPanel.classList.add('hidden');
    }

    await Promise.all([renderAuditTimeline(), renderTeamMembers(), renderReviewQueue()]);
}

// =============================================================
// 7. سجل المراجعة (Audit Trail)
// =============================================================

async function renderAuditTimeline() {
    const list = document.getElementById('audit-timeline-list');
    if (!list) return;
    if (!getStaffToken()) { list.innerHTML = ''; return; }

    try {
        const data = await apiRequest('/audit', { authType: 'staff' });
        list.innerHTML = data.logs.map(log => `
            <li class="bg-white p-2 rounded border border-gray-200 text-xs shadow-sm">
                <div class="flex justify-between text-gray-500 font-mono text-[10px] border-b pb-1 mb-1">
                    <span class="font-bold text-amber-800 font-body">${escapeHtml(log.role)}</span>
                    <span>📅 ${new Date(log.createdAt).toLocaleDateString('ar-EG')} | 🕒 ${new Date(log.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p class="text-gray-800 article-body text-xs">${escapeHtml(log.note)}</p>
            </li>
        `).join('');
    } catch (err) {
        list.innerHTML = `<p class="text-red-500 text-xs">تعذّر تحميل السجل: ${escapeHtml(err.message)}</p>`;
    }
}

async function addAuditNote() {
    const commentInput = document.getElementById('reviewCommentInput');
    const text = commentInput.value.trim();
    if (!text) { showToast('يرجى كتابة الملاحظة أولاً.', 'error'); return; }

    try {
        await apiRequest('/audit', { method: 'POST', authType: 'staff', body: { note: text } });
        commentInput.value = '';
        await renderAuditTimeline();
        showToast('تم تدوين الملاحظة بنجاح!');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// =============================================================
// 8. فريق التحرير
// =============================================================

async function renderTeamMembers() {
    const grid = document.getElementById('team-grid');
    if (!grid) return;

    try {
        const data = await apiRequest('/team');
        const isAuthorized = canManageTeam();

        grid.innerHTML = data.members.map(member => `
            <div class="team-card bg-white p-4 rounded-lg shadow border border-gray-200 text-center relative hover:shadow-md transition">
                ${isAuthorized ? `
                    <div class="absolute top-2 left-2 flex gap-1">
                        <button onclick="openEditModal('${member._id}')" title="تعديل" class="bg-amber-600 text-white text-xs w-8 h-8 rounded-full font-bold hover:bg-amber-800 transition flex items-center justify-center font-body">✎</button>
                        <button onclick="deleteTeamMember('${member._id}')" title="حذف" class="bg-red-600 text-white text-xs w-8 h-8 rounded-full font-bold hover:bg-red-800 transition flex items-center justify-center font-body">✕</button>
                    </div>
                ` : ''}
                <img src="${member.photo ? fileUrl(member.photo) : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300'}" alt="${escapeHtml(member.name)}" class="w-24 h-24 rounded-full mx-auto object-cover mb-3 border-2 border-amber-600 shadow-sm">
                <h3 class="font-heading font-bold text-lg text-slate-900">${escapeHtml(member.name)}</h3>
                <p class="text-xs text-amber-700 font-semibold mt-1 font-body">${escapeHtml(member.role)}</p>
                <p class="bio-text text-xs text-slate-500 mt-2 leading-relaxed article-body border-t pt-2 text-right">
                    ${member.bio && member.bio.trim() ? escapeHtml(member.bio) : '<span class="text-slate-300">لا توجد نبذة تعريفية مضافة بعد.</span>'}
                </p>
            </div>
        `).join('');
    } catch (err) {
        grid.innerHTML = `<p class="text-red-500 text-sm col-span-full">تعذّر تحميل الفريق: ${escapeHtml(err.message)}</p>`;
    }
}

async function openEditModal(id) {
    try {
        const data = await apiRequest('/team');
        const member = data.members.find(m => m._id === id);
        if (!member) return;

        populateRoleSelect(document.getElementById('edit-member-role'), ALL_ROLES);
        document.getElementById('edit-member-id').value = member._id;
        document.getElementById('edit-member-name').value = member.name;
        document.getElementById('edit-member-role').value = member.role;
        document.getElementById('edit-member-bio').value = member.bio || '';
        document.getElementById('edit-member-photo-preview').src = member.photo ? fileUrl(member.photo) : '';
        document.getElementById('editMemberModal').classList.remove('hidden');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function closeEditModal() { document.getElementById('editMemberModal').classList.add('hidden'); }

async function handleSaveMemberEdit(event) {
    event.preventDefault();
    const id = document.getElementById('edit-member-id').value;
    const formData = new FormData();
    formData.append('name', document.getElementById('edit-member-name').value.trim());
    formData.append('role', document.getElementById('edit-member-role').value);
    formData.append('bio', document.getElementById('edit-member-bio').value.trim());

    const fileInput = document.getElementById('edit-member-photo-file');
    if (fileInput.files && fileInput.files[0]) formData.append('photo', fileInput.files[0]);

    try {
        await apiRequest(`/team/${id}`, { method: 'PUT', authType: 'staff', body: formData });
        await renderTeamMembers();
        closeEditModal();
        fileInput.value = '';
        showToast('تم تعديل بيانات العضو بنجاح!');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function handleAddTeamMember(event) {
    event.preventDefault();
    const nameInput = document.getElementById('member-name');
    const roleInput = document.getElementById('member-role');
    const fileInput = document.getElementById('member-photo-file');
    const bioInput = document.getElementById('member-bio');

    const formData = new FormData();
    formData.append('name', nameInput.value.trim());
    formData.append('role', roleInput.value);
    formData.append('bio', bioInput.value.trim());
    if (fileInput.files && fileInput.files[0]) formData.append('photo', fileInput.files[0]);

    try {
        await apiRequest('/team', { method: 'POST', authType: 'staff', body: formData });
        nameInput.value = ''; bioInput.value = ''; fileInput.value = '';
        roleInput.selectedIndex = 0;
        await renderTeamMembers();
        showToast('تمت إضافة العضو بنجاح!');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteTeamMember(id) {
    if (!confirm('هل ترغب في حذف هذا العضو من الفريق؟')) return;
    try {
        await apiRequest(`/team/${id}`, { method: 'DELETE', authType: 'staff' });
        await renderTeamMembers();
        showToast('تم حذف العضو.');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// =============================================================
// 9. قوائم المجلة والتنقل
// =============================================================

function renderMagazineNav() {
    const navList = document.getElementById('main-nav-list');
    if (!navList) return;

    navList.innerHTML = CATEGORIES.map((cat, catIndex) => `
        <li class="main-nav-item" data-cat-index="${catIndex}">
            <div class="main-nav-link" onclick="handleMainNavClick(event, ${catIndex})">
                <span class="main-nav-emoji">${cat.emoji}</span>
                <span>${escapeHtml(cat.title)}</span>
            </div>
            <div class="sub-nav-dropdown">
                ${cat.subs.map((sub, subIndex) => `
                    <div class="sub-nav-link" onclick="openCategoryView(${catIndex}, ${subIndex})">${escapeHtml(sub)}</div>
                `).join('')}
            </div>
        </li>
    `).join('');
}

function isTouchDevice() {
    return window.matchMedia('(hover: none), (pointer: coarse)').matches;
}

function handleMainNavClick(event, catIndex) {
    if (!isTouchDevice() && window.innerWidth > 1024) return;
    event.stopPropagation();
    const item = document.querySelector(`.main-nav-item[data-cat-index="${catIndex}"]`);
    if (!item) return;

    const wasActive = item.classList.contains('active') || item.classList.contains('mobile-expanded');
    document.querySelectorAll('.main-nav-item').forEach(el => {
        el.classList.remove('active'); el.classList.remove('mobile-expanded');
    });
    if (!wasActive) { item.classList.add('active'); item.classList.add('mobile-expanded'); }
}

document.addEventListener('click', (event) => {
    if (!event.target.closest('.main-nav-item')) {
        document.querySelectorAll('.main-nav-item').forEach(el => {
            el.classList.remove('active'); el.classList.remove('mobile-expanded');
        });
    }
});

function toggleMobileMainNav() {
    document.getElementById('main-nav-list').classList.toggle('mobile-open');
}

function goHome() {
    document.getElementById('categoryFullScreenView').classList.add('hidden');
    document.getElementById('articlePublicView').classList.add('hidden');
    document.getElementById('articleReviewView').classList.add('hidden');
    document.body.style.overflow = '';
    document.getElementById('main-nav-list').classList.remove('mobile-open');
    document.querySelectorAll('.main-nav-item').forEach(el => {
        el.classList.remove('active'); el.classList.remove('mobile-expanded');
    });
    window.scrollTo(0, 0);
    renderHomeFeed();
}

// =============================================================
// 10. نموذج تقديم المقال
// =============================================================

function renderArticleTagCheckboxes() {
    const container = document.getElementById('article-tags-container');
    if (!container) return;
    container.innerHTML = CATEGORIES.map(cat => `
        <div>
            <p class="font-bold text-slate-700 mb-1">${cat.emoji} ${escapeHtml(cat.title)}</p>
            <div class="flex flex-wrap gap-x-3 gap-y-1 pr-2">
                ${cat.subs.map(sub => `
                    <label class="flex items-center gap-1 cursor-pointer py-0.5">
                        <input type="checkbox" class="tag-checkbox w-3.5 h-3.5" data-tag="${escapeHtml(sub)}">
                        <span>${escapeHtml(sub)}</span>
                    </label>
                `).join('')}
            </div>
        </div>
    `).join('');
}

async function handleArticleSubmit(event) {
    event.preventDefault();

    const titleInput = document.getElementById('article-title-input');
    const bodyInput = document.getElementById('article-body-input');
    const coverInput = document.getElementById('article-cover-input');
    const titleError = document.getElementById('title-error');
    const tagError = document.getElementById('tag-error');

    const title = titleInput.value.trim();
    if (!title) { titleError.classList.remove('hidden'); return; }
    titleError.classList.add('hidden');

    const checkedTags = Array.from(document.querySelectorAll('.tag-checkbox:checked')).map(cb => cb.dataset.tag);
    if (checkedTags.length === 0) { tagError.classList.remove('hidden'); return; }
    tagError.classList.add('hidden');

    const accessLevelInput = document.querySelector('input[name="article-access-level"]:checked');
    const accessLevel = accessLevelInput ? accessLevelInput.value : 'public';

    const formData = new FormData();
    formData.append('title', title);
    formData.append('body', bodyInput.value.trim());
    formData.append('tags', JSON.stringify(checkedTags));
    formData.append('accessLevel', accessLevel);
    if (coverInput.files && coverInput.files[0]) formData.append('coverImage', coverInput.files[0]);

    try {
        await apiRequest('/articles', { method: 'POST', authType: 'staff', body: formData });
        event.target.reset();
        renderArticleTagCheckboxes();
        await renderReviewQueue();
        showToast('تم إرسال المقال بنجاح لجهات المراجعة!');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// =============================================================
// 11. الصفحة الرئيسية
// =============================================================

function renderArticleCard(article) {
    return `
        <div class="home-article-card" onclick="openArticlePublicView('${article.id}')">
            ${article.coverImage ? `<img src="${fileUrl(article.coverImage)}" alt="${escapeHtml(article.title)}">` : ''}
            <div class="card-body">
                <div class="flex items-center gap-2 mb-1">
                    ${article.accessLevel === 'golden' ? `<span class="golden-badge">🏆 ذهبي</span>` : article.accessLevel === 'registered' ? `<span class="exclusive-badge">حصري</span>` : ''}
                    <span class="text-[10px] text-slate-400">${new Date(article.createdAt).toLocaleDateString('ar-EG')}</span>
                </div>
                <h3 class="font-heading font-bold text-slate-900 text-base leading-snug">${escapeHtml(article.title)}</h3>
                <p class="text-[11px] text-amber-700 mt-1">${article.tags.slice(0, 2).map(escapeHtml).join(' · ')}</p>
            </div>
        </div>
    `;
}

async function renderHomeFeed() {
    const latestGrid = document.getElementById('latest-articles-grid');
    const featuredGrid = document.getElementById('featured-articles-grid');
    if (!latestGrid || !featuredGrid) return;

    try {
        const data = await apiRequest('/articles/home-feed');
        latestGrid.innerHTML = data.latest.length ? data.latest.map(renderArticleCard).join('') : `<p class="text-slate-400 text-sm col-span-full">لا توجد مقالات منشورة حتى الآن.</p>`;
        featuredGrid.innerHTML = data.featured.length ? data.featured.map(renderArticleCard).join('') : `<p class="text-slate-400 text-sm col-span-full">لا توجد مقالات مميزة بعد.</p>`;
    } catch (err) {
        latestGrid.innerHTML = `<p class="text-red-500 text-sm col-span-full">تعذّر الاتصال بالخادم: ${escapeHtml(err.message)}</p>`;
        featuredGrid.innerHTML = '';
    }
}

// =============================================================
// 12. صفحة قراءة المقال العامة
// =============================================================

let currentPublicArticleId = null;
let currentPublicArticleData = null;

async function openArticlePublicView(id) {
    currentPublicArticleId = id;
    try {
        const data = await apiRequest(`/articles/public/${id}`, { authType: 'reader-optional' });
        const article = data.article;
        currentPublicArticleData = article;

        document.getElementById('pub-article-tags').innerHTML = article.tags.map(t => `<span class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px]">${escapeHtml(t)}</span>`).join('');
        document.getElementById('pub-article-title').innerText = article.title;
        document.getElementById('pub-article-meta').innerText = `بقلم: ${article.authorName} — ${new Date(article.createdAt).toLocaleDateString('ar-EG')}`;

        const coverImg = document.getElementById('pub-article-cover');
        if (article.coverImage) { coverImg.src = fileUrl(article.coverImage); coverImg.classList.remove('hidden'); }
        else { coverImg.classList.add('hidden'); }

        const lockedBox = document.getElementById('pub-article-locked');
        const fullBox = document.getElementById('pub-article-full');

        // فحص دفاعي إضافي على مستوى الواجهة: حتى لو رجع الخادم locked=false بالغلط،
        // امنع عرض المحتوى المقفول لأي شخص ملوش الصلاحية المطلوبة فعليًا.
        const hasReaderToken = !!getReaderToken();
        const localReader = getReaderUser();
        const isLocalGoldMember = !!(localReader && localReader.isGoldMember);

        const needsRegistrationLocal = article.accessLevel === 'registered' && !hasReaderToken;
        const needsGoldLocal = article.accessLevel === 'golden' && !isLocalGoldMember;
        const shouldBeLocked = data.locked || needsRegistrationLocal || needsGoldLocal;

        if (shouldBeLocked) {
            const isGoldLock = data.lockReason === 'golden' || needsGoldLocal;
            document.getElementById('pub-article-locked-title').innerText = isGoldLock
                ? '🏆 محتوى ذهبي - لمشتركي العضوية الذهبية فقط'
                : 'محتوى حصري لمشتركي ورقة';
            document.getElementById('pub-article-locked-text').innerText = isGoldLock
                ? 'هذا المقال متاح فقط لأصحاب العضوية الذهبية المدفوعة.'
                : 'سجّل كقارئ لمتابعة هذا المقال وكل الحصريات القادمة.';
            document.getElementById('pub-article-locked-btn').innerText = isGoldLock && hasReaderToken
                ? 'تواصل معنا للاشتراك في العضوية الذهبية'
                : 'تسجيل / دخول القارئ';

            lockedBox.classList.remove('hidden');
            fullBox.classList.add('hidden');
            stopReadingHeartbeat();
        } else {
            lockedBox.classList.add('hidden');
            fullBox.classList.remove('hidden');

            document.getElementById('pub-article-body').innerText = article.body;

            const audioWrap = document.getElementById('pub-article-audio-wrap');
            if (article.audio) { audioWrap.innerHTML = `<audio controls src="${fileUrl(article.audio)}"></audio>`; audioWrap.classList.remove('hidden'); }
            else { audioWrap.classList.add('hidden'); }

            renderPubArticleStars(article);
            document.getElementById('pub-article-views').innerText = article.views;
            renderLikeButton(article);
            renderCommentForm();
            await loadComments(article.id);

            // نبدأ تتبّع القراءة النشطة (heartbeat) بس للمحتوى المفتوح فعليًا وغير المقفول
            startReadingHeartbeat(article.id);
        }

        document.getElementById('categoryFullScreenView').classList.add('hidden');
        document.getElementById('articlePublicView').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        window.scrollTo(0, 0);
        renderAdsBanner('ads-banner-article');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function closeArticlePublicView() {
    document.getElementById('articlePublicView').classList.add('hidden');
    document.body.style.overflow = '';
    stopReadingHeartbeat();
    currentPublicArticleId = null;
    currentPublicArticleData = null;
    renderHomeFeed();
}

function renderPubArticleStars(article) {
    const starsWrap = document.getElementById('pub-article-stars');
    const myRating = article.myRating || 0;

    starsWrap.innerHTML = [1, 2, 3, 4, 5].map(v => `
        <span class="star-btn ${v <= myRating ? 'star-filled' : ''}" onclick="rateArticle('${article.id}', ${v})">★</span>
    `).join('');

    document.getElementById('pub-article-rating-avg').innerText = article.avgRating
        ? `(${article.avgRating} من 5 — ${article.ratingsCount} تقييم)`
        : 'لا يوجد تقييم بعد';
}

async function rateArticle(articleId, value) {
    if (!getReaderToken()) {
        showToast('يجب تسجيل الدخول كقارئ أولاً لتقييم المقال.', 'error');
        openReaderModal();
        return;
    }
    try {
        const data = await apiRequest(`/articles/${articleId}/rate`, { method: 'POST', authType: 'reader', body: { value } });
        renderPubArticleStars(data.article);
        renderHomeFeed();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// =============================================================
// 13. صفحة التصنيف الفرعي
// =============================================================

async function openCategoryView(catIndex, subIndex) {
    const category = CATEGORIES[catIndex];
    if (!category) return;
    const subTitle = category.subs[subIndex];

    document.getElementById('cat-view-emoji').innerText = category.emoji;
    document.getElementById('cat-view-title').innerText = category.title;
    document.getElementById('cat-view-sub').innerText = subTitle;
    document.getElementById('cat-view-crumb').innerText = `الرئيسية  /  ${category.title}  /  ${subTitle}`;

    const contentGrid = document.getElementById('cat-view-content');
    contentGrid.innerHTML = `<p class="text-slate-400 text-sm col-span-full">جارِ التحميل...</p>`;

    try {
        const data = await apiRequest(`/articles/by-tag/${encodeURIComponent(subTitle)}`);
        contentGrid.innerHTML = data.articles.length ? data.articles.map(article => `
            <div class="cat-article-card" onclick="openArticlePublicView('${article.id}')">
                ${article.coverImage ? `<img src="${fileUrl(article.coverImage)}" alt="${escapeHtml(article.title)}">` : ''}
                <p class="text-[11px] font-bold text-amber-700 mb-2">${escapeHtml(subTitle)}</p>
                <h4 class="font-heading font-bold text-slate-900 text-lg mb-2">${escapeHtml(article.title)}</h4>
                <p class="text-slate-500 text-xs leading-relaxed">بقلم: ${escapeHtml(article.authorName)}</p>
            </div>
        `).join('') : `<p class="text-slate-400 text-sm col-span-full">لا توجد مقالات منشورة في هذا التصنيف حتى الآن.</p>`;
    } catch (err) {
        contentGrid.innerHTML = `<p class="text-red-500 text-sm col-span-full">${escapeHtml(err.message)}</p>`;
    }

    document.getElementById('categoryFullScreenView').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    window.scrollTo(0, 0);
    renderAdsBanner('ads-banner-category');

    document.getElementById('main-nav-list').classList.remove('mobile-open');
    document.querySelectorAll('.main-nav-item').forEach(el => {
        el.classList.remove('active'); el.classList.remove('mobile-expanded');
    });
}

function closeCategoryView() {
    document.getElementById('categoryFullScreenView').classList.add('hidden');
    document.body.style.overflow = '';
}

// =============================================================
// 14. قائمة المراجعة
// =============================================================

const STATUS_LABEL = { pending: 'قيد المراجعة', revision: 'يحتاج تعديل', published: 'منشور', blocked: 'محظور النشر' };
const STATUS_CLASS = { pending: 'status-badge-pending', revision: 'status-badge-revision', published: 'status-badge-published', blocked: 'status-badge-blocked' };

async function renderReviewQueue() {
    const banner = document.getElementById('workflow-banner');
    const list = document.getElementById('articles-review-list');
    if (!banner || !list) return;

    const user = getStaffUser();
    if (!user || (!canReviewArticles() && !canWriteArticles())) { banner.classList.add('hidden'); return; }
    banner.classList.remove('hidden');

    try {
        const data = await apiRequest('/articles/review-queue', { authType: 'staff' });
        const countEl = document.getElementById('review-queue-count');
        if (countEl) countEl.innerText = `(${data.articles.length})`;

        list.innerHTML = data.articles.length ? data.articles.map(a => `
            <div class="article-review-card bg-white border border-amber-200 rounded-lg p-3" onclick="openArticleReviewView('${a.id}')">
                <div class="flex justify-between items-center gap-2">
                    <h4 class="font-heading font-bold text-slate-900 text-sm">${escapeHtml(a.title || '(بدون عنوان)')}</h4>
                    <span class="${STATUS_CLASS[a.status]} text-white px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap">${STATUS_LABEL[a.status]}</span>
                </div>
                <p class="text-slate-400 text-[10px] mt-1">بقلم: ${escapeHtml(a.authorName)} — ${new Date(a.createdAt).toLocaleDateString('ar-EG')}</p>
            </div>
        `).join('') : `<p class="text-xs text-amber-700 font-body">لا توجد مقالات لعرضها حالياً.</p>`;
    } catch (err) {
        list.innerHTML = `<p class="text-red-500 text-xs">${escapeHtml(err.message)}</p>`;
    }
}

// =============================================================
// 15. صفحة مراجعة المقال
// =============================================================

let currentReviewArticleId = null;

async function openArticleReviewView(id) {
    try {
        const data = await apiRequest(`/articles/review/${id}`, { authType: 'staff' });
        const article = data.article;
        const isReviewer = data.isReviewer;
        const user = getStaffUser();
        const isAuthor = user && article.author && (article.author === user.id || article.author === user._id);

        currentReviewArticleId = id;

        document.getElementById('review-article-title-display').innerText = article.title;
        const statusEl = document.getElementById('review-article-status');
        statusEl.innerText = STATUS_LABEL[article.status];
        statusEl.className = `${STATUS_CLASS[article.status]} px-2 py-0.5 rounded-full text-[10px] font-bold text-white whitespace-nowrap`;

        document.getElementById('review-article-tags').innerHTML = article.tags.map(t => `<span class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px]">${escapeHtml(t)}</span>`).join('');
        document.getElementById('review-article-meta').innerText = `بقلم: ${article.authorName} — ${new Date(article.createdAt).toLocaleDateString('ar-EG')}`;
        document.getElementById('review-article-body-display').innerText = article.body;

        const revisionForm = document.getElementById('review-revision-form');
        if (isAuthor && article.status === 'revision') {
            revisionForm.classList.remove('hidden');
            document.getElementById('review-edit-title').value = article.title;
            document.getElementById('review-edit-body').value = article.body;
        } else {
            revisionForm.classList.add('hidden');
        }

        const audioSection = document.getElementById('review-audio-section');
        if (isReviewer) {
            audioSection.classList.remove('hidden');
            document.getElementById('review-audio-player-wrap').innerHTML = article.audio
                ? `<audio controls src="${fileUrl(article.audio)}"></audio>`
                : `<p class="text-[11px] text-slate-400">لم يُضف ملف صوتي بعد.</p>`;
        } else {
            audioSection.classList.add('hidden');
        }

        const decisionButtons = document.getElementById('review-decision-buttons');
        decisionButtons.classList.toggle('hidden', !(isReviewer && (article.status === 'pending' || article.status === 'revision')));
        document.getElementById('review-revision-note').value = '';
        document.getElementById('review-block-reason').value = '';

        // لوحة إدارة المقال بعد النشر: تعديل / إخفاء / حذف - لجهات المراجعة فقط ولما يكون المقال منشور
        const publishedPanel = document.getElementById('published-article-management');
        publishedPanel.classList.toggle('hidden', !(isReviewer && article.status === 'published'));
        if (isReviewer && article.status === 'published') {
            document.getElementById('published-edit-form').classList.add('hidden');
            document.getElementById('published-edit-title').value = article.title;
            document.getElementById('published-edit-body').value = article.body;
            document.getElementById('published-edit-access-level').value = article.accessLevel || 'public';
            const toggleBtn = document.getElementById('toggle-visibility-btn');
            toggleBtn.innerText = article.visible ? 'إخفاء المقال عن القراء' : 'إظهار المقال للقراء';
            toggleBtn.className = article.visible
                ? 'w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 rounded transition text-sm'
                : 'w-full bg-green-700 hover:bg-green-800 text-white font-bold py-2.5 rounded transition text-sm';
        }

        renderReviewChat(article.chat || []);

        document.getElementById('articleReviewView').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        window.scrollTo(0, 0);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function closeArticleReviewView() {
    document.getElementById('articleReviewView').classList.add('hidden');
    document.body.style.overflow = '';
    currentReviewArticleId = null;
    renderReviewQueue();
}

// =============================================================
// إدارة المقال بعد النشر: تعديل / إخفاء-إظهار / حذف نهائي (جهات المراجعة فقط)
// =============================================================

function togglePublishedEditForm() {
    document.getElementById('published-edit-form').classList.toggle('hidden');
}

async function reviewEditPublishedArticle(event) {
    event.preventDefault();
    if (currentReviewArticleId == null) return;

    const title = document.getElementById('published-edit-title').value.trim();
    const body = document.getElementById('published-edit-body').value.trim();
    const accessLevel = document.getElementById('published-edit-access-level').value;
    const fileInput = document.getElementById('published-edit-cover');

    const formData = new FormData();
    formData.append('title', title);
    formData.append('body', body);
    formData.append('accessLevel', accessLevel);
    if (fileInput.files && fileInput.files[0]) formData.append('coverImage', fileInput.files[0]);

    try {
        await apiRequest(`/articles/review/${currentReviewArticleId}/edit`, {
            method: 'PUT', authType: 'staff', body: formData
        });
        fileInput.value = '';
        showToast('تم حفظ تعديلات المقال بنجاح!');
        await openArticleReviewView(currentReviewArticleId);
        renderHomeFeed();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function reviewToggleVisibility() {
    if (currentReviewArticleId == null) return;
    try {
        const data = await apiRequest(`/articles/review/${currentReviewArticleId}/toggle-visibility`, {
            method: 'POST', authType: 'staff'
        });
        showToast(data.article.visible ? 'المقال ظاهر للقراء الآن.' : 'تم إخفاء المقال عن القراء.');
        await openArticleReviewView(currentReviewArticleId);
        renderHomeFeed();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function reviewDeletePublishedArticle() {
    if (currentReviewArticleId == null) return;
    if (!confirm('هل أنت متأكد من حذف هذا المقال نهائيًا؟ هذا الإجراء لا يمكن التراجع عنه.')) return;

    try {
        await apiRequest(`/articles/review/${currentReviewArticleId}`, { method: 'DELETE', authType: 'staff' });
        showToast('تم حذف المقال نهائيًا.');
        closeArticleReviewView();
        renderHomeFeed();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function renderReviewChat(chat) {
    const list = document.getElementById('review-chat-list');
    if (!list) return;
    if (!chat || chat.length === 0) {
        list.innerHTML = `<p class="text-[11px] text-slate-400 text-center">لا توجد رسائل بعد.</p>`;
        return;
    }
    list.innerHTML = chat.map(msg => `
        <div class="flex flex-col ${msg.from === 'reviewer' ? 'items-end' : 'items-start'}">
            <div class="chat-bubble ${msg.from === 'reviewer' ? 'chat-bubble-reviewer' : 'chat-bubble-author'}">
                <p class="chat-bubble-meta">${escapeHtml(msg.name)} — ${new Date(msg.createdAt).toLocaleString('ar-EG')}</p>
                <p>${escapeHtml(msg.text)}</p>
            </div>
        </div>
    `).join('');
    list.scrollTop = list.scrollHeight;
}

async function sendReviewChatMessage() {
    if (currentReviewArticleId == null) return;
    const input = document.getElementById('review-chat-input');
    const text = input.value.trim();
    if (!text) return;

    try {
        const data = await apiRequest(`/articles/review/${currentReviewArticleId}/chat`, {
            method: 'POST', authType: 'staff', body: { text }
        });
        input.value = '';
        renderReviewChat(data.article.chat || []);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function reviewPublishArticle() {
    if (currentReviewArticleId == null) return;
    try {
        await apiRequest(`/articles/review/${currentReviewArticleId}/publish`, { method: 'POST', authType: 'staff' });
        showToast('تم نشر المقال بنجاح!');
        await openArticleReviewView(currentReviewArticleId);
        renderHomeFeed();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function reviewRequestRevisionArticle() {
    if (currentReviewArticleId == null) return;
    const note = document.getElementById('review-revision-note').value.trim();
    if (!note) { showToast('يرجى كتابة التعديلات المطلوبة أولاً.', 'error'); return; }

    try {
        await apiRequest(`/articles/review/${currentReviewArticleId}/request-revision`, {
            method: 'POST', authType: 'staff', body: { note }
        });
        showToast('تم إرسال طلب التعديل للكاتب.');
        await openArticleReviewView(currentReviewArticleId);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function reviewBlockArticle() {
    if (currentReviewArticleId == null) return;
    const reason = document.getElementById('review-block-reason').value.trim();
    if (!reason) { showToast('يرجى كتابة سبب حظر النشر أولاً.', 'error'); return; }

    try {
        await apiRequest(`/articles/review/${currentReviewArticleId}/block`, {
            method: 'POST', authType: 'staff', body: { reason }
        });
        showToast('تم حظر نشر المقال.');
        await openArticleReviewView(currentReviewArticleId);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function authorResubmitArticle() {
    if (currentReviewArticleId == null) return;
    const title = document.getElementById('review-edit-title').value.trim();
    const body = document.getElementById('review-edit-body').value.trim();
    if (!title) { showToast('عنوان المقال إجباري.', 'error'); return; }

    try {
        await apiRequest(`/articles/review/${currentReviewArticleId}/resubmit`, {
            method: 'POST', authType: 'staff', body: { title, body }
        });
        showToast('تم إرسال التعديلات لجهة المراجعة.');
        await openArticleReviewView(currentReviewArticleId);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function reviewUploadAudio(inputEl) {
    if (currentReviewArticleId == null || !inputEl.files || !inputEl.files[0]) return;

    const formData = new FormData();
    formData.append('audio', inputEl.files[0]);

    try {
        await apiRequest(`/articles/review/${currentReviewArticleId}/audio`, {
            method: 'POST', authType: 'staff', body: formData
        });
        showToast('تم حفظ الملف الصوتي بنجاح!');
        await openArticleReviewView(currentReviewArticleId);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// =============================================================
// 16. طيّ/فرد قائمة المراجعة (عشان متاخدش مساحة كبيرة)
// =============================================================

function toggleReviewQueue() {
    const wrap = document.getElementById('articles-review-list-wrap');
    const arrow = document.getElementById('review-queue-arrow');
    wrap.classList.toggle('hidden');
    arrow.style.transform = wrap.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
}

// =============================================================
// 17. إعدادات الموقع: سوشيال ميديا + إعلان (المالك/رئيس التحرير/IT)
// =============================================================

let currentSiteSettings = null;

async function fetchSiteSettings() {
    try {
        const data = await apiRequest('/settings');
        currentSiteSettings = data.settings;
        return data.settings;
    } catch (err) {
        console.error('تعذّر تحميل إعدادات الموقع:', err.message);
        return null;
    }
}

async function loadSettingsIntoForm() {
    const settings = currentSiteSettings || (await fetchSiteSettings());
    if (!settings) return;
    renderSocialLinksAdminList();
}

async function handleAddSocialLink(event) {
    event.preventDefault();
    const label = document.getElementById('new-social-label').value.trim();
    const url = document.getElementById('new-social-url').value.trim();

    try {
        const data = await apiRequest('/settings/social', { method: 'POST', authType: 'staff', body: { label, url } });
        currentSiteSettings = data.settings;
        event.target.reset();
        renderSocialLinksAdminList();
        renderFooterSocialLinks();
        showToast('تمت إضافة الرابط بنجاح!');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteSocialLinkAdmin(linkId) {
    if (!confirm('هل تود حذف هذا الرابط؟')) return;
    try {
        const data = await apiRequest(`/settings/social/${linkId}`, { method: 'DELETE', authType: 'staff' });
        currentSiteSettings = data.settings;
        renderSocialLinksAdminList();
        renderFooterSocialLinks();
        showToast('تم حذف الرابط.');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function renderSocialLinksAdminList() {
    const list = document.getElementById('social-links-admin-list');
    if (!list || !currentSiteSettings) return;

    const links = currentSiteSettings.socialLinks || [];
    list.innerHTML = links.length ? links.map(link => `
        <div class="flex justify-between items-center bg-slate-50 border rounded-lg p-2">
            <div class="truncate ml-2">
                <p class="font-bold text-slate-800">${escapeHtml(link.label)}</p>
                <p class="text-slate-400 truncate">${escapeHtml(link.url)}</p>
            </div>
            <button onclick="deleteSocialLinkAdmin('${link._id}')" class="bg-red-600 text-white px-2 py-1 rounded text-[10px] font-bold hover:bg-red-700 flex-shrink-0">حذف</button>
        </div>
    `).join('') : `<p class="text-slate-400 text-xs">لا توجد روابط مضافة بعد.</p>`;
}

function renderFooterSocialLinks() {
    const wrap = document.getElementById('footer-social-links');
    if (!wrap || !currentSiteSettings) return;

    const links = currentSiteSettings.socialLinks || [];
    const items = links.map(link =>
        `<a href="${escapeHtml(link.url)}" target="_blank" rel="noopener" class="hover:text-amber-500 transition text-sm font-semibold">${escapeHtml(link.label)}</a>`
    );

    wrap.innerHTML = items.length ? items.join('<span class="text-slate-600">•</span>') : '';
}

// =============================================================
// الإعلانات (متعددة) - تظهر ضمن تدفق الصفحة العادي، مش ثابتة على الشاشة
// =============================================================

let currentAdsList = [];

async function fetchActiveAds() {
    try {
        const data = await apiRequest('/ads');
        currentAdsList = data.ads;
        return data.ads;
    } catch (err) {
        console.error('تعذّر تحميل الإعلانات:', err.message);
        return [];
    }
}

// يبني كارت إعلان واحد كبير وواضح (صورة/نص/رابط - كلهم اختياريين)
function buildAdCardHtml(ad) {
    const clickable = !!(ad.linkUrl && ad.linkUrl.trim());
    const inner = `
        ${ad.imageUrl ? `<img src="${fileUrl(ad.imageUrl)}" alt="إعلان" class="ad-card-image">` : ''}
        ${ad.text ? `<p class="ad-card-text">${escapeHtml(ad.text)}</p>` : ''}
    `;
    if (clickable) {
        return `<a href="javascript:void(0)" onclick="handleAdClick('${ad._id}', '${escapeHtml(ad.linkUrl)}')" class="ad-card ad-card-clickable">${inner}</a>`;
    }
    return `<div class="ad-card">${inner}</div>`;
}

// يعرض كل الإعلانات النشطة داخل حاوية معينة (بيتنادى في كل صفحة عندها بانر)
function renderAdsBanner(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!currentAdsList || currentAdsList.length === 0) {
        container.innerHTML = ''; // فاضي تمامًا لو مفيش إعلانات - زي ما طلبت بالظبط
        return;
    }

    container.innerHTML = `<div class="ads-banner-grid">${currentAdsList.map(buildAdCardHtml).join('')}</div>`;
}

// يعرض بانر الإعلانات في كل الأماكن المتاحة بيها في الصفحة الحالية
function renderAllAdsBanners() {
    ['ads-banner-home', 'ads-banner-category', 'ads-banner-article'].forEach(renderAdsBanner);
}

// يفتح رابط الإعلان في تاب جديد، ويسجّل النقرة، ويمنح +1 ورق للقارئ (مرة واحدة لكل إعلان)
async function handleAdClick(adId, linkUrl) {
    if (linkUrl) window.open(linkUrl, '_blank', 'noopener');

    try {
        const data = await apiRequest(`/ads/${adId}/click`, { method: 'POST', authType: 'reader-optional' });
        if (data.earned > 0) {
            showPointsToast(1, '🎉 كسبت مكافأة النقر على الإعلان');
        }
    } catch (err) {
        // تجاهل بصمت - فتح الرابط نفسه نجح بغض النظر عن تسجيل النقطة
    }
}

// =============================================================
// لوحة إدارة الإعلانات (المالك/رئيس التحرير/IT)
// =============================================================

async function loadAdsAdminPanel() {
    const list = document.getElementById('ads-admin-list');
    try {
        const data = await apiRequest('/ads/all', { authType: 'staff' });
        list.innerHTML = data.ads.length ? data.ads.map(ad => `
            <div class="bg-slate-50 border rounded-lg p-2 text-xs space-y-1">
                <div class="flex justify-between items-start gap-2">
                    <div class="flex-grow">
                        ${ad.imageUrl ? `<img src="${fileUrl(ad.imageUrl)}" alt="" class="w-full h-20 object-cover rounded mb-1">` : ''}
                        ${ad.text ? `<p class="text-slate-700">${escapeHtml(ad.text)}</p>` : ''}
                        ${ad.linkUrl ? `<p class="text-amber-700 truncate">${escapeHtml(ad.linkUrl)}</p>` : ''}
                        <p class="text-slate-400">${ad.clicksCount || 0} نقرة — ${ad.active ? 'نشط' : 'موقوف'}</p>
                    </div>
                </div>
                <div class="flex gap-1">
                    <button onclick="toggleAdActive('${ad._id}', ${!ad.active})" class="bg-slate-700 text-white px-2 py-1 rounded text-[10px] font-bold hover:bg-slate-800">${ad.active ? 'إيقاف' : 'تفعيل'}</button>
                    <button onclick="deleteAdAdmin('${ad._id}')" class="bg-red-600 text-white px-2 py-1 rounded text-[10px] font-bold hover:bg-red-700">حذف</button>
                </div>
            </div>
        `).join('') : `<p class="text-slate-400 text-xs">لا توجد إعلانات مضافة بعد.</p>`;
    } catch (err) {
        list.innerHTML = `<p class="text-red-500 text-xs">${escapeHtml(err.message)}</p>`;
    }
}

async function handleAddAd(event) {
    event.preventDefault();
    const fileInput = document.getElementById('new-ad-image');
    const text = document.getElementById('new-ad-text').value.trim();
    const linkUrl = document.getElementById('new-ad-link').value.trim();

    if (!fileInput.files[0] && !text && !linkUrl) {
        showToast('يجب إضافة صورة أو نص أو رابط على الأقل.', 'error');
        return;
    }

    const formData = new FormData();
    if (fileInput.files && fileInput.files[0]) formData.append('image', fileInput.files[0]);
    formData.append('text', text);
    formData.append('linkUrl', linkUrl);

    try {
        await apiRequest('/ads', { method: 'POST', authType: 'staff', body: formData });
        event.target.reset();
        await loadAdsAdminPanel();
        await fetchActiveAds();
        renderAllAdsBanners();
        showToast('تمت إضافة الإعلان بنجاح!');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function toggleAdActive(id, newActiveState) {
    try {
        const formData = new FormData();
        formData.append('active', newActiveState ? 'true' : 'false');
        await apiRequest(`/ads/${id}`, { method: 'PUT', authType: 'staff', body: formData });
        await loadAdsAdminPanel();
        await fetchActiveAds();
        renderAllAdsBanners();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteAdAdmin(id) {
    if (!confirm('هل تود حذف هذا الإعلان نهائيًا؟')) return;
    try {
        await apiRequest(`/ads/${id}`, { method: 'DELETE', authType: 'staff' });
        await loadAdsAdminPanel();
        await fetchActiveAds();
        renderAllAdsBanners();
        showToast('تم حذف الإعلان.');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// =============================================================
// إدارة العضوية الذهبية (المالك/رئيس التحرير/IT)
// =============================================================

async function handleSearchReaders() {
    const search = document.getElementById('readers-search-input').value.trim();
    const list = document.getElementById('readers-admin-list');

    try {
        const query = search ? `?search=${encodeURIComponent(search)}` : '';
        const data = await apiRequest(`/readers/admin/list${query}`, { authType: 'staff' });

        list.innerHTML = data.readers.length ? data.readers.map(reader => `
            <div class="flex justify-between items-center bg-slate-50 border rounded-lg p-2">
                <div class="truncate ml-2">
                    <p class="font-bold text-slate-800">${escapeHtml(reader.name)} ${reader.isGoldMember ? '🏆' : ''}</p>
                    <p class="text-slate-400 truncate">${escapeHtml(reader.email)} — ${reader.waraqBalance} ورق</p>
                </div>
                <button onclick="toggleGoldMembershipAdmin('${reader._id}')" class="flex-shrink-0 ${reader.isGoldMember ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-amber-600 text-white hover:bg-amber-700'} px-2 py-1 rounded text-[10px] font-bold">
                    ${reader.isGoldMember ? 'سحب العضوية' : 'منح العضوية الذهبية'}
                </button>
            </div>
        `).join('') : `<p class="text-slate-400 text-xs">لا يوجد قرّاء مطابقين.</p>`;
    } catch (err) {
        list.innerHTML = `<p class="text-red-500 text-xs">${escapeHtml(err.message)}</p>`;
    }
}

async function toggleGoldMembershipAdmin(readerId) {
    try {
        await apiRequest(`/readers/admin/${readerId}/toggle-gold`, { method: 'POST', authType: 'staff' });
        await handleSearchReaders();
        showToast('تم تحديث العضوية الذهبية بنجاح!');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// =============================================================
// 18. نظام "ورق" - إشعارات كسب النقاط
// =============================================================

function showPointsToast(amount, message) {
    const existing = document.querySelector('.points-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast points-toast toast-success';
    const sign = amount >= 0 ? '+' : '';
    toast.innerHTML = `${escapeHtml(message)} <strong>(${sign}${amount} ورق 🪙)</strong>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);

    refreshWaraqBalance();
}

// =============================================================
// 19. تتبّع القراءة النشطة (Heartbeat) - أساس الحماية من الغش
//     يشتغل بس لو التاب ظاهر (visible) والمستخدم بيتفاعل فعليًا (سكرول/حركة ماوس/كيبورد)
// =============================================================

let heartbeatIntervalId = null;
let heartbeatArticleId = null;
let lastUserActivityTime = Date.now();
const HEARTBEAT_INTERVAL_MS = 20000; // كل 20 ثانية
const ACTIVITY_TIMEOUT_MS = 25000; // لازم يكون فيه تفاعل خلال آخر 25 ثانية

function markUserActive() {
    lastUserActivityTime = Date.now();
}

// نسجّل مستمعي التفاعل مرة واحدة بس عند تحميل الصفحة
function initActivityTracking() {
    ['scroll', 'mousemove', 'keydown', 'touchstart', 'click'].forEach(evt => {
        window.addEventListener(evt, markUserActive, { passive: true });
    });
}

function startReadingHeartbeat(articleId) {
    stopReadingHeartbeat();
    if (!getReaderToken()) return; // زوار غير مسجلين: مفيش داعي نبعت heartbeat أصلاً

    heartbeatArticleId = articleId;
    markUserActive();

    heartbeatIntervalId = setInterval(async () => {
        const isTabVisible = document.visibilityState === 'visible';
        const isRecentlyActive = (Date.now() - lastUserActivityTime) <= ACTIVITY_TIMEOUT_MS;

        if (!isTabVisible || !isRecentlyActive) return; // مفيش نشاط فعلي = مفيش نقاط

        try {
            const data = await apiRequest('/points/heartbeat', {
                method: 'POST',
                authType: 'reader',
                body: { articleId: heartbeatArticleId, seconds: HEARTBEAT_INTERVAL_MS / 1000 }
            });

            if (data.readArticleBonusAwarded) {
                showPointsToast(5, '🎉 رائع! كسبت مكافأة قراءة هذا المقال');
            } else if (data.earnedThisTick > 0) {
                refreshWaraqBalance();
            }
        } catch (err) {
            // نتجاهل أخطاء heartbeat بصمت (مش محتاجين نزعج القارئ بيها)
        }
    }, HEARTBEAT_INTERVAL_MS);
}

function stopReadingHeartbeat() {
    if (heartbeatIntervalId) {
        clearInterval(heartbeatIntervalId);
        heartbeatIntervalId = null;
    }
    heartbeatArticleId = null;
}

// =============================================================
// 20. الإعجاب بالمقال
// =============================================================

function renderLikeButton(article) {
    const icon = document.getElementById('pub-article-like-icon');
    const count = document.getElementById('pub-article-like-count');
    if (!icon || !count) return;
    icon.innerText = article.isLikedByViewer ? '❤️' : '🤍';
    count.innerText = article.likesCount || 0;
}

async function handleToggleLike() {
    if (!getReaderToken()) {
        showToast('يجب تسجيل الدخول كقارئ أولاً.', 'error');
        openReaderModal();
        return;
    }
    if (!currentPublicArticleId) return;

    try {
        const data = await apiRequest(`/articles/${currentPublicArticleId}/like`, { method: 'POST', authType: 'reader' });
        document.getElementById('pub-article-like-icon').innerText = data.liked ? '❤️' : '🤍';
        document.getElementById('pub-article-like-count').innerText = data.likesCount;
        if (currentPublicArticleData) {
            currentPublicArticleData.isLikedByViewer = data.liked;
            currentPublicArticleData.likesCount = data.likesCount;
        }
        if (data.liked) {
            showPointsToast(2, '🎉 كسبت مكافأة إعجاب/حفظ المقال');
        } else {
            refreshWaraqBalance();
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// =============================================================
// 21. مشاركة المقال على السوشيال ميديا
// =============================================================

function buildShareUrl(platform, articleUrl, title) {
    const encodedUrl = encodeURIComponent(articleUrl);
    const encodedTitle = encodeURIComponent(title);
    switch (platform) {
        case 'facebook': return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
        case 'twitter': return `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`;
        case 'whatsapp': return `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`;
        default: return null;
    }
}

async function handleShareArticle(platform) {
    if (!currentPublicArticleId || !currentPublicArticleData) return;

    // بناء رابط المقال (بما إن الموقع صفحة واحدة، بنستخدم رابط الصفحة الحالية كمرجع للمشاركة)
    const articleUrl = `${window.location.origin}${window.location.pathname}#article-${currentPublicArticleId}`;

    if (platform === 'copy') {
        try {
            await navigator.clipboard.writeText(articleUrl);
            showToast('تم نسخ رابط المقال!');
        } catch (e) {
            showToast('تعذّر نسخ الرابط.', 'error');
        }
    } else {
        const shareUrl = buildShareUrl(platform, articleUrl, currentPublicArticleData.title);
        if (shareUrl) window.open(shareUrl, '_blank', 'noopener,width=600,height=500');
    }

    // منح مكافأة المشاركة (مرة واحدة فقط لكل مقال لكل قارئ - السيرفر بيتحقق من ده)
    if (getReaderToken()) {
        try {
            const data = await apiRequest(`/articles/${currentPublicArticleId}/share`, { method: 'POST', authType: 'reader' });
            if (data.earned > 0) {
                showPointsToast(data.earned, '🎉 كسبت مكافأة مشاركة المقال');
            }
        } catch (err) {
            // تجاهل بصمت - المشاركة نفسها نجحت بغض النظر عن النقاط
        }
    }
}

// =============================================================
// 22. التعليقات الأدبية
// =============================================================

function renderCommentForm() {
    const formWrap = document.getElementById('reader-comment-form-wrap');
    const loginHint = document.getElementById('reader-comment-login-hint');
    const isReader = !!getReaderToken();
    formWrap.classList.toggle('hidden', !isReader);
    loginHint.classList.toggle('hidden', isReader);
    if (isReader) document.getElementById('reader-comment-input').value = '';
}

async function loadComments(articleId) {
    const list = document.getElementById('pub-article-comments-list');
    const countEl = document.getElementById('pub-article-comments-count');
    try {
        const data = await apiRequest(`/articles/${articleId}/comments`);
        countEl.innerText = data.comments.length;

        const canPin = canReviewArticles();
        list.innerHTML = data.comments.length ? data.comments.map(c => `
            <div class="comment-bubble ${c.pinned ? 'comment-pinned' : ''}">
                <div class="flex justify-between items-start gap-2">
                    <p class="font-bold text-sm text-slate-800">${escapeHtml(c.readerName)} ${c.pinned ? '<span class="text-[10px] text-amber-600">📌 مثبّت</span>' : ''}</p>
                    <span class="text-[10px] text-slate-400">${new Date(c.createdAt).toLocaleDateString('ar-EG')}</span>
                </div>
                <p class="text-sm text-slate-700 mt-1 article-body">${escapeHtml(c.text)}</p>
                ${canPin ? `
                    <div class="flex gap-2 mt-2">
                        <button onclick="togglePinComment('${articleId}', '${c._id}')" class="text-[10px] text-amber-700 hover:underline">${c.pinned ? 'إلغاء التثبيت' : 'تثبيت'}</button>
                        <button onclick="deleteCommentAdmin('${articleId}', '${c._id}')" class="text-[10px] text-red-600 hover:underline">حذف</button>
                    </div>
                ` : ''}
            </div>
        `).join('') : `<p class="text-slate-400 text-sm">لا توجد تعليقات بعد - كن أول من يشارك رأيه.</p>`;
    } catch (err) {
        list.innerHTML = `<p class="text-red-500 text-sm">${escapeHtml(err.message)}</p>`;
    }
}

async function submitComment() {
    if (!currentPublicArticleId) return;
    const input = document.getElementById('reader-comment-input');
    const text = input.value.trim();
    if (!text) { showToast('يرجى كتابة التعليق أولاً.', 'error'); return; }

    try {
        const data = await apiRequest(`/articles/${currentPublicArticleId}/comments`, {
            method: 'POST', authType: 'reader', body: { text }
        });
        input.value = '';
        await loadComments(currentPublicArticleId);
        if (data.earned > 0) {
            showPointsToast(data.earned, '🎉 كسبت مكافأة كتابة تعليق');
        } else {
            showToast('تم إضافة تعليقك (وصلت للحد الأقصى من مكافآت التعليقات اليوم).');
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function togglePinComment(articleId, commentId) {
    try {
        await apiRequest(`/articles/${articleId}/comments/${commentId}/pin`, { method: 'POST', authType: 'staff' });
        await loadComments(articleId);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteCommentAdmin(articleId, commentId) {
    if (!confirm('هل تود حذف هذا التعليق؟')) return;
    try {
        await apiRequest(`/articles/${articleId}/comments/${commentId}`, { method: 'DELETE', authType: 'staff' });
        await loadComments(articleId);
        showToast('تم حذف التعليق.');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// =============================================================
// 23. متجر الهدايا (Rewards Store)
// =============================================================

const TIER_LABELS = { low: 'مكافآت رقمية', mid: 'اشتراكات منصات', high: 'هدايا ملموسة', vip: 'VIP' };
const DELIVERY_LABELS = { auto: 'تلقائي', voucher: 'كود خصم', shipping: 'شحن بالبريد', invitation: 'دعوة فعالية' };

async function openRewardsStore() {
    if (!getReaderToken()) {
        showToast('يجب تسجيل الدخول كقارئ أولاً.', 'error');
        openReaderModal();
        return;
    }

    document.getElementById('rewardsStoreView').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    window.scrollTo(0, 0);

    await Promise.all([
        loadRewardsSummary(),
        loadRewardsCatalog(),
        loadMyRedemptions(),
        renderGoldMembershipStatus()
    ]);

    const settingsShow = canManageSettings();
    document.getElementById('rewards-admin-panel').classList.toggle('hidden', !settingsShow);
    if (settingsShow) await loadAdminRewardsPanel();
}

function closeRewardsStore() {
    document.getElementById('rewardsStoreView').classList.add('hidden');
    document.body.style.overflow = '';
}

async function loadRewardsSummary() {
    try {
        const data = await apiRequest('/points/me', { authType: 'reader' });
        document.getElementById('rewards-my-balance').innerText = data.waraqBalance;
        document.getElementById('rewards-my-rank').innerText = data.rank.name;
        document.getElementById('my-referral-code').innerText = data.referralCode || '---';

        const progressBar = document.getElementById('rewards-rank-progress-bar');
        const nextLabel = document.getElementById('rewards-next-rank-label');
        const remainingLabel = document.getElementById('rewards-points-to-next');

        if (data.nextRank) {
            nextLabel.innerText = `الرتبة التالية: ${data.nextRank.name}`;
            remainingLabel.innerText = `باقي ${data.pointsToNextRank} ورق`;
            const currentMin = data.rank.minTotal;
            const nextMin = data.nextRank.minTotal;
            const progressPercent = Math.min(100, Math.max(0, ((data.waraqTotalEarned - currentMin) / (nextMin - currentMin)) * 100));
            progressBar.style.width = `${progressPercent}%`;
        } else {
            nextLabel.innerText = 'وصلت لأعلى رتبة! 🎉';
            remainingLabel.innerText = '';
            progressBar.style.width = '100%';
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function loadRewardsCatalog() {
    const grid = document.getElementById('rewards-catalog-grid');
    try {
        const [catalogData, meData] = await Promise.all([
            apiRequest('/rewards'),
            apiRequest('/points/me', { authType: 'reader' })
        ]);
        const myBalance = meData.waraqBalance;

        grid.innerHTML = catalogData.items.length ? catalogData.items.map(item => {
            const progressPercent = Math.min(100, Math.round((myBalance / item.pointsCost) * 100));
            const canAfford = myBalance >= item.pointsCost;
            return `
                <div class="reward-card">
                    ${item.imageUrl ? `<img src="${fileUrl(item.imageUrl)}" alt="${escapeHtml(item.title)}">` : `<div class="reward-card-placeholder">🎁</div>`}
                    <div class="p-4 space-y-2">
                        <span class="reward-tier-badge">${TIER_LABELS[item.tier] || item.tier}</span>
                        <h4 class="font-heading font-bold text-slate-900">${escapeHtml(item.title)}</h4>
                        <p class="text-xs text-slate-500">${escapeHtml(item.description || '')}</p>
                        <p class="text-amber-600 font-bold text-sm">🪙 ${item.pointsCost} ورق</p>
                        <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div class="bg-amber-500 h-2 rounded-full" style="width:${progressPercent}%"></div>
                        </div>
                        <button onclick="handleRedeemReward('${item._id}', '${item.deliveryType}')" ${canAfford ? '' : 'disabled'} class="w-full ${canAfford ? 'bg-amber-700 hover:bg-amber-800' : 'bg-slate-200 cursor-not-allowed text-slate-400'} text-white font-bold py-2 rounded transition text-sm">
                            ${canAfford ? 'استبدال الهدية' : 'رصيدك غير كافٍ'}
                        </button>
                    </div>
                </div>
            `;
        }).join('') : `<p class="text-slate-400 text-sm col-span-full">لا توجد هدايا متاحة حاليًا.</p>`;
    } catch (err) {
        grid.innerHTML = `<p class="text-red-500 text-sm col-span-full">${escapeHtml(err.message)}</p>`;
    }
}

async function handleRedeemReward(itemId, deliveryType) {
    let shippingAddress = '';
    if (deliveryType === 'shipping') {
        shippingAddress = prompt('يرجى إدخال عنوان الشحن بالتفصيل:');
        if (!shippingAddress || !shippingAddress.trim()) return;
    }
    if (!confirm('هل تود تأكيد استبدال هذه الهدية؟')) return;

    try {
        const data = await apiRequest(`/rewards/${itemId}/redeem`, {
            method: 'POST', authType: 'reader', body: { shippingAddress }
        });
        showToast('تم استبدال الهدية بنجاح!');
        if (data.redemption.voucherCode) {
            alert(`كود الخصم الخاص بك: ${data.redemption.voucherCode}`);
        }
        await Promise.all([loadRewardsSummary(), loadRewardsCatalog(), loadMyRedemptions()]);
        refreshWaraqBalance();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function loadMyRedemptions() {
    const list = document.getElementById('my-redemptions-list');
    try {
        const data = await apiRequest('/rewards/my-redemptions', { authType: 'reader' });
        const statusLabels = { pending: 'قيد التنفيذ', fulfilled: 'تم التسليم', cancelled: 'ملغي' };
        list.innerHTML = data.redemptions.length ? data.redemptions.map(r => `
            <div class="flex justify-between items-center bg-white border border-slate-200 rounded-lg p-3 text-xs">
                <div>
                    <p class="font-bold text-slate-800">${escapeHtml(r.rewardTitleSnapshot)}</p>
                    <p class="text-slate-400">${new Date(r.createdAt).toLocaleDateString('ar-EG')} — ${r.pointsSpent} ورق</p>
                    ${r.voucherCode ? `<p class="text-amber-700 font-mono">كود: ${escapeHtml(r.voucherCode)}</p>` : ''}
                </div>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${r.status === 'fulfilled' ? 'bg-green-100 text-green-700' : r.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}">${statusLabels[r.status]}</span>
            </div>
        `).join('') : `<p class="text-slate-400 text-sm">لا توجد طلبات استبدال سابقة.</p>`;
    } catch (err) {
        list.innerHTML = `<p class="text-red-500 text-sm">${escapeHtml(err.message)}</p>`;
    }
}

function copyReferralCode() {
    const code = document.getElementById('my-referral-code').innerText;
    if (!code || code === '---') return;
    navigator.clipboard.writeText(code)
        .then(() => showToast('تم نسخ كود الدعوة!'))
        .catch(() => showToast('تعذّر نسخ الكود.', 'error'));
}

// =============================================================
// العضوية الذهبية: الدفع بالفيزا/الماستركارد أو المحافظ الإلكترونية
// =============================================================

async function renderGoldMembershipStatus() {
    const statusBadge = document.getElementById('gold-status-badge');
    const paymentOptions = document.getElementById('gold-payment-options');
    const priceText = document.getElementById('gold-price-text');

    let reader = getReaderUser();
    try {
        const data = await apiRequest('/readers/me', { authType: 'reader' });
        reader = data.reader;
        setReaderUser(reader); // حدّث النسخة المحفوظة محليًا بحالة العضوية الفعلية
    } catch (err) {
        // لو الطلب فشل، نكمل بالنسخة المحفوظة محليًا كحل احتياطي
    }

    if (reader && reader.isGoldMember) {
        statusBadge.classList.remove('hidden');
        paymentOptions.classList.add('hidden');
        priceText.innerText = 'عضويتك الذهبية مفعّلة بالفعل - استمتع بكل المحتوى الحصري!';
    } else {
        statusBadge.classList.add('hidden');
        paymentOptions.classList.remove('hidden');
    }
}

async function handlePayWithCard() {
    const statusEl = document.getElementById('gold-payment-status');
    try {
        statusEl.className = 'text-xs font-semibold text-slate-500';
        statusEl.innerText = 'جارِ تجهيز صفحة الدفع...';
        statusEl.classList.remove('hidden');

        const data = await apiRequest('/payment/gold/card', { method: 'POST', authType: 'reader' });
        window.open(data.iframeUrl, '_blank', 'noopener');

        statusEl.className = 'text-xs font-semibold text-amber-700';
        statusEl.innerText = 'فتحنا صفحة الدفع في تاب جديد. بعد إتمام الدفع، رجّع افتح متجر الهدايا تاني عشان تشوف تفعيل العضوية.';
    } catch (err) {
        statusEl.className = 'text-xs font-semibold text-red-600';
        statusEl.innerText = err.message;
        statusEl.classList.remove('hidden');
    }
}

async function handlePayWithWallet() {
    const provider = document.getElementById('wallet-provider-select').value;
    const walletNumber = document.getElementById('wallet-number-input').value.trim();
    const statusEl = document.getElementById('gold-payment-status');

    if (!provider) {
        showToast('يرجى اختيار مزوّد المحفظة أولاً.', 'error');
        return;
    }
    if (!/^01[0-9]{9}$/.test(walletNumber)) {
        showToast('يرجى إدخال رقم محفظة مصري صحيح (01 ثم 9 أرقام).', 'error');
        return;
    }

    try {
        statusEl.className = 'text-xs font-semibold text-slate-500';
        statusEl.innerText = 'جارِ إرسال طلب الدفع للمحفظة...';
        statusEl.classList.remove('hidden');

        const data = await apiRequest('/payment/gold/wallet', {
            method: 'POST', authType: 'reader', body: { walletNumber }
        });

        if (data.redirectUrl) {
            window.open(data.redirectUrl, '_blank', 'noopener');
            statusEl.className = 'text-xs font-semibold text-amber-700';
            statusEl.innerText = 'افتحنا صفحة تأكيد الدفع في تاب جديد - أكّد العملية من تطبيق المحفظة (OTP). بعد التأكيد، رجّع افتح متجر الهدايا تاني.';
        } else {
            statusEl.className = 'text-xs font-semibold text-amber-700';
            statusEl.innerText = 'تم إرسال طلب الدفع. تابع رسالة التأكيد على تليفونك من ' + provider + '.';
        }
    } catch (err) {
        statusEl.className = 'text-xs font-semibold text-red-600';
        statusEl.innerText = err.message;
        statusEl.classList.remove('hidden');
    }
}

// =============================================================
// 24. لوحة إدارة الهدايا (المالك/رئيس التحرير/IT)
// =============================================================

async function loadAdminRewardsPanel() {
    await Promise.all([renderAdminRewardsList(), renderAdminRedemptionsList()]);
}

async function renderAdminRewardsList() {
    const list = document.getElementById('admin-rewards-list');
    try {
        const data = await apiRequest('/rewards/all', { authType: 'staff' });
        list.innerHTML = data.items.length ? data.items.map(item => `
            <div class="flex justify-between items-center bg-slate-50 border rounded-lg p-2 text-xs">
                <div>
                    <p class="font-bold text-slate-800">${escapeHtml(item.title)} <span class="text-amber-600">(${item.pointsCost} ورق)</span></p>
                    <p class="text-slate-400">${TIER_LABELS[item.tier]} — ${DELIVERY_LABELS[item.deliveryType]} — ${item.active ? 'نشطة' : 'موقوفة'}</p>
                </div>
                <div class="flex gap-1">
                    <button onclick="toggleRewardActive('${item._id}', ${!item.active})" class="bg-slate-700 text-white px-2 py-1 rounded text-[10px] font-bold hover:bg-slate-800">${item.active ? 'إيقاف' : 'تفعيل'}</button>
                    <button onclick="deleteRewardItemAdmin('${item._id}')" class="bg-red-600 text-white px-2 py-1 rounded text-[10px] font-bold hover:bg-red-700">حذف</button>
                </div>
            </div>
        `).join('') : `<p class="text-slate-400 text-xs">لا توجد هدايا في الكتالوج بعد.</p>`;
    } catch (err) {
        list.innerHTML = `<p class="text-red-500 text-xs">${escapeHtml(err.message)}</p>`;
    }
}

async function handleAddRewardItem(event) {
    event.preventDefault();
    const formData = new FormData();
    formData.append('title', document.getElementById('reward-title').value.trim());
    formData.append('pointsCost', document.getElementById('reward-points').value);
    formData.append('tier', document.getElementById('reward-tier').value);
    formData.append('deliveryType', document.getElementById('reward-delivery').value);
    formData.append('description', document.getElementById('reward-description').value.trim());

    const fileInput = document.getElementById('reward-image');
    if (fileInput.files && fileInput.files[0]) formData.append('image', fileInput.files[0]);

    try {
        await apiRequest('/rewards', { method: 'POST', authType: 'staff', body: formData });
        event.target.reset();
        await renderAdminRewardsList();
        showToast('تمت إضافة الهدية للكتالوج بنجاح!');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function toggleRewardActive(id, newActiveState) {
    try {
        const formData = new FormData();
        formData.append('active', newActiveState ? 'true' : 'false');
        await apiRequest(`/rewards/${id}`, { method: 'PUT', authType: 'staff', body: formData });
        await renderAdminRewardsList();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteRewardItemAdmin(id) {
    if (!confirm('هل تود حذف هذه الهدية نهائيًا من الكتالوج؟')) return;
    try {
        await apiRequest(`/rewards/${id}`, { method: 'DELETE', authType: 'staff' });
        await renderAdminRewardsList();
        showToast('تم حذف الهدية.');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function renderAdminRedemptionsList() {
    const list = document.getElementById('admin-redemptions-list');
    try {
        const data = await apiRequest('/rewards/redemptions', { authType: 'staff' });
        const statusLabels = { pending: 'قيد التنفيذ', fulfilled: 'تم التسليم', cancelled: 'ملغي' };
        list.innerHTML = data.redemptions.length ? data.redemptions.map(r => `
            <div class="bg-slate-50 border rounded-lg p-2 text-xs space-y-1">
                <div class="flex justify-between items-start">
                    <p class="font-bold text-slate-800">${escapeHtml(r.rewardTitleSnapshot)} — ${escapeHtml(r.reader ? r.reader.name : 'قارئ محذوف')}</p>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${r.status === 'fulfilled' ? 'bg-green-100 text-green-700' : r.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}">${statusLabels[r.status]}</span>
                </div>
                ${r.shippingAddress ? `<p class="text-slate-500">📦 ${escapeHtml(r.shippingAddress)}</p>` : ''}
                ${r.status === 'pending' ? `
                    <div class="flex gap-1 pt-1">
                        <button onclick="updateRedemptionStatusAdmin('${r._id}', 'fulfilled')" class="bg-green-700 text-white px-2 py-1 rounded text-[10px] font-bold hover:bg-green-800">تأكيد التسليم</button>
                        <button onclick="updateRedemptionStatusAdmin('${r._id}', 'cancelled')" class="bg-red-600 text-white px-2 py-1 rounded text-[10px] font-bold hover:bg-red-700">إلغاء</button>
                    </div>
                ` : ''}
            </div>
        `).join('') : `<p class="text-slate-400 text-xs">لا توجد طلبات استبدال بعد.</p>`;
    } catch (err) {
        list.innerHTML = `<p class="text-red-500 text-xs">${escapeHtml(err.message)}</p>`;
    }
}

async function updateRedemptionStatusAdmin(id, status) {
    try {
        await apiRequest(`/rewards/redemptions/${id}`, { method: 'PUT', authType: 'staff', body: { status } });
        await renderAdminRedemptionsList();
        showToast('تم تحديث حالة الطلب.');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// =============================================================
// 25. تشغيل المحرك عند تحميل الصفحة
// =============================================================

document.addEventListener('DOMContentLoaded', async () => {
    startSmartClock();
    initActivityTracking();
    renderMagazineNav();
    renderArticleTagCheckboxes();
    populateRoleSelect(document.getElementById('new-user-role'), ALL_ROLES);
    populateRoleSelect(document.getElementById('member-role'), ALL_ROLES);
    populateRoleSelect(document.getElementById('edit-member-role'), ALL_ROLES);

    await syncUserSessionUI();
    await syncReaderSessionUI();
    await renderHomeFeed();

    await fetchSiteSettings();
    renderFooterSocialLinks();

    await fetchActiveAds();
    renderAllAdsBanners();
});

window.addEventListener('resize', () => {
    if (window.innerWidth > 1024) {
        document.getElementById('main-nav-list').classList.remove('mobile-open');
        document.querySelectorAll('.main-nav-item').forEach(el => {
            el.classList.remove('active'); el.classList.remove('mobile-expanded');
        });
    }
});
