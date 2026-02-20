import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDQSBBjjaFE0MLoFC00rrlQDG3-m9XQwoc",
    authDomain: "daily-bazar-f62a7.firebaseapp.com",
    databaseURL: "https://daily-bazar-f62a7-default-rtdb.firebaseio.com",
    projectId: "daily-bazar-f62a7",
    storageBucket: "daily-bazar-f62a7.firebasestorage.app",
    messagingSenderId: "94169262272",
    appId: "1:94169262272:web:9743e0e8849e0516f52525",
    measurementId: "G-XSQWQY0QZX"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// State & Config
const USERS = {
    sadi: { id: 'sadi', name: 'Sadi', pin: '2002', colorCls: 'bg-blue-500', textCls: 'text-blue-500', bgSoft: 'bg-blue-50 dark:bg-blue-500/10', img: 'assets/img/sadi.webp', initial: 'S' },
    mahim: { id: 'mahim', name: 'Mahim', pin: '2001', colorCls: 'bg-emerald-500', textCls: 'text-emerald-500', bgSoft: 'bg-emerald-50 dark:bg-emerald-500/10', img: 'assets/img/mahim.webp', initial: 'M' }
};

let currentUserProfile = null;
let fbUser = null;
let allExpenses = [];
let currentViewDate = new Date();
let unsubscribe = null;
let deleteTargetId = null;

// Auth Init
const initAuth = async () => {
    try {
        await signInAnonymously(auth);
    } catch (error) {
        console.error("Auth error:", error);
        alertUI("Failed to connect securely.");
    }
};

initAuth();

onAuthStateChanged(auth, (user) => {
    fbUser = user;
    const savedUser = localStorage.getItem('bazar_user');
    if (savedUser && USERS[savedUser] && user) {
        currentUserProfile = USERS[savedUser];
        showMainApp();
    }
});

// UI Logic: Login
let selectedUserIdForLogin = null;

window.selectUser = (userId) => {
    selectedUserIdForLogin = userId;
    document.getElementById('btn-sadi').classList.replace('opacity-100', 'opacity-50');
    document.getElementById('btn-mahim').classList.replace('opacity-100', 'opacity-50');
    document.getElementById(`btn-${userId}`).classList.replace('opacity-50', 'opacity-100');
    
    document.getElementById('pin-section').classList.remove('hidden');
    const pinInput = document.getElementById('pin-input');
    pinInput.value = '';
    pinInput.focus();
    document.getElementById('login-error').classList.add('hidden');
};

window.verifyPin = () => {
    const pin = document.getElementById('pin-input').value;
    if (selectedUserIdForLogin && USERS[selectedUserIdForLogin].pin === pin) {
        if(!fbUser) { alertUI("Connecting... wait a second."); return; }
        currentUserProfile = USERS[selectedUserIdForLogin];
        localStorage.setItem('bazar_user', currentUserProfile.id);
        showMainApp();
    } else {
        document.getElementById('login-error').classList.remove('hidden');
    }
};

document.getElementById('pin-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') window.verifyPin();
});

window.logout = () => {
    localStorage.removeItem('bazar_user');
    currentUserProfile = null;
    if(unsubscribe) unsubscribe();
    document.getElementById('main-app').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden', 'opacity-0');
    document.getElementById('pin-section').classList.add('hidden');
    document.getElementById('btn-sadi').classList.replace('opacity-100', 'opacity-50');
    document.getElementById('btn-mahim').classList.replace('opacity-100', 'opacity-50');
    selectedUserIdForLogin = null;
};

const showMainApp = () => {
    document.getElementById('login-screen').classList.add('opacity-0');
    setTimeout(() => {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        
        // Header Setup
        document.getElementById('header-name').innerText = currentUserProfile.name;
        document.getElementById('header-img').src = currentUserProfile.img;
        document.getElementById('header-img').onerror = function() {
            const fallbackColor = currentUserProfile.id === 'sadi' ? '3b82f6' : '10b981';
            this.src = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23${fallbackColor}'/><text x='50' y='65' font-family='Arial' font-size='40' font-weight='bold' fill='white' text-anchor='middle'>${currentUserProfile.initial}</text></svg>`;
        };
        document.getElementById('input-person').value = currentUserProfile.id;

        startRealtimeSync();
        updateMonthDisplay();
    }, 500);
};

// Data Sync
const startRealtimeSync = () => {
    if (!fbUser) return;
    const expensesRef = collection(db, 'bazar_expenses');
    unsubscribe = onSnapshot(expensesRef, (snapshot) => {
        allExpenses = [];
        snapshot.forEach(doc => allExpenses.push({ id: doc.id, ...doc.data() }));
        allExpenses.sort((a, b) => new Date(b.date) - new Date(a.date) || b.timestamp - a.timestamp);
        renderData();
    }, (error) => {
        console.error("Sync Error:", error);
        alertUI("Database permission error! Check Firebase Rules.");
    });
};

const renderData = () => {
    calculateOverallBalance();
    renderMonthlyView();
};

const calculateOverallBalance = () => {
    let sadiTotal = 0, mahimTotal = 0;
    allExpenses.forEach(exp => {
        const amt = parseFloat(exp.amount) || 0;
        if (exp.personId === 'sadi') sadiTotal += amt;
        else if (exp.personId === 'mahim') mahimTotal += amt;
    });

    const diff = sadiTotal - mahimTotal;
    const equalizeAmt = Math.abs(diff) / 2;
    
    document.getElementById('equalize-amount').innerText = `৳ ${equalizeAmt.toLocaleString()}`;
    const statusEl = document.getElementById('equalize-status');

    if (equalizeAmt === 0) {
        statusEl.innerHTML = `<i class="ph ph-check-circle text-emerald-400 text-lg"></i> Hishab Ekdom Clear! ✨`;
        statusEl.className = "inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 text-sm font-semibold tracking-wide text-white";
    } else if (diff > 0) {
        statusEl.innerHTML = `<i class="ph ph-arrow-down-left text-white text-lg"></i> Sadi pabe Mahim-er theke`;
        statusEl.className = "inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/20 backdrop-blur-sm border border-blue-400/30 text-sm font-semibold tracking-wide text-blue-100";
    } else {
        statusEl.innerHTML = `<i class="ph ph-arrow-down-left text-white text-lg"></i> Mahim pabe Sadi-r theke`;
        statusEl.className = "inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 backdrop-blur-sm border border-emerald-400/30 text-sm font-semibold tracking-wide text-emerald-100";
    }
};

const renderMonthlyView = () => {
    const y = currentViewDate.getFullYear(), m = currentViewDate.getMonth();
    const monthlyExps = allExpenses.filter(exp => {
        const d = new Date(exp.date); return d.getFullYear() === y && d.getMonth() === m;
    });

    let sM = 0, mM = 0;
    const list = document.getElementById('transactions-container');
    list.innerHTML = '';
    document.getElementById('transaction-count').innerText = monthlyExps.length;

    if (monthlyExps.length === 0) {
        list.innerHTML = `<div class="text-center py-12 opacity-50"><i class="ph ph-ghost text-5xl mb-3"></i><p class="font-medium">No expenses yet</p></div>`;
    } else {
        monthlyExps.forEach((exp, i) => {
            const amt = parseFloat(exp.amount) || 0;
            if (exp.personId === 'sadi') sM += amt; else mM += amt;

            const uDef = USERS[exp.personId];
            const dObj = new Date(exp.date);
            const dateStr = `${dObj.getDate()} ${dObj.toLocaleString('en', { month: 'short' })}`;
            
            const html = `
                <div class="bg-white dark:bg-slate-900 p-5 rounded-[1.5rem] flex flex-col gap-4 shadow-sm hover:shadow-md border border-slate-100 dark:border-slate-800 animate-slide-up group" style="animation-delay: ${i * 0.05}s">
                    <div class="flex items-start justify-between">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-[1rem] ${uDef.bgSoft} flex items-center justify-center shrink-0">
                                <span class="font-bold ${uDef.textCls} text-lg">${uDef.initial}</span>
                            </div>
                            <div>
                                <h4 class="font-bold text-lg leading-tight mb-1 text-slate-800 dark:text-white">${exp.description}</h4>
                                <p class="text-xs text-slate-500 font-medium">${dateStr} • Paid by ${uDef.name}</p>
                            </div>
                        </div>
                        <div class="flex flex-col items-end gap-2">
                            <span class="font-extrabold text-lg text-slate-800 dark:text-white">৳${amt.toLocaleString()}</span>
                            <button onclick="promptDelete('${exp.id}')" class="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100">
                                <i class="ph ph-trash text-lg"></i>
                            </button>
                        </div>
                    </div>
                    ${exp.imageUrl ? `
                    <div class="mt-1">
                        <div class="relative w-20 h-16 rounded-xl overflow-hidden cursor-pointer border border-slate-200 dark:border-slate-700 hover:opacity-90 transition-opacity" onclick="viewImage('${exp.imageUrl}')">
                            <img src="${exp.imageUrl}" class="w-full h-full object-cover">
                            <div class="absolute inset-0 bg-black/20 flex items-center justify-center"><i class="ph ph-magnifying-glass-plus text-white shadow-sm"></i></div>
                        </div>
                    </div>` : ''}
                </div>`;
            list.insertAdjacentHTML('beforeend', html);
        });
    }

    const tM = sM + mM;
    document.getElementById('monthly-sadi').innerText = `৳${sM.toLocaleString()}`;
    document.getElementById('monthly-mahim').innerText = `৳${mM.toLocaleString()}`;
    document.getElementById('monthly-total').innerText = `৳${tM.toLocaleString()}`;
    document.getElementById('bar-sadi').style.width = `${tM===0?50:(sM/tM)*100}%`;
    document.getElementById('bar-mahim').style.width = `${tM===0?50:(mM/tM)*100}%`;
};

// Month Nav
const updateMonthDisplay = () => {
    document.getElementById('current-month-display').innerText = currentViewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if(allExpenses.length > 0) renderMonthlyView();
};
window.changeMonth = (delta) => { currentViewDate.setMonth(currentViewDate.getMonth() + delta); updateMonthDisplay(); };

// Modals & Image
window.openModal = () => {
    document.getElementById('input-date').valueAsDate = new Date();
    document.getElementById('input-amount').value = '';
    document.getElementById('input-desc').value = '';
    removeImage();
    const m = document.getElementById('add-modal'), c = document.getElementById('modal-content');
    m.classList.remove('hidden'); void m.offsetWidth;
    m.classList.remove('opacity-0'); c.classList.remove('translate-y-full');
    setTimeout(() => document.getElementById('input-amount').focus(), 300);
};
window.closeModal = () => {
    const m = document.getElementById('add-modal'), c = document.getElementById('modal-content');
    m.classList.add('opacity-0'); c.classList.add('translate-y-full');
    setTimeout(() => m.classList.add('hidden'), 500);
};

const compressImage = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image(); img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width, h = img.height;
                if (w > h && w > 800) { h *= 800/w; w = 800; }
                else if (h > 800) { w *= 800/h; h = 800; }
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', 0.6)); 
            };
        };
        reader.onerror = error => reject(error);
    });
};

window.previewImage = (e) => {
    const f = e.target.files[0];
    if (f) {
        const r = new FileReader();
        r.onload = (e) => {
            document.getElementById('image-preview').src = e.target.result;
            document.getElementById('image-upload-label').classList.add('hidden');
            document.getElementById('image-preview-container').classList.remove('hidden');
        }
        r.readAsDataURL(f);
    }
};

window.removeImage = () => {
    document.getElementById('input-image').value = '';
    document.getElementById('image-upload-label').classList.remove('hidden');
    document.getElementById('image-preview-container').classList.add('hidden');
};

window.viewImage = (url) => {
    const m = document.getElementById('image-viewer-modal'), img = document.getElementById('full-size-image');
    img.src = url; m.classList.remove('hidden'); void m.offsetWidth;
    m.classList.remove('opacity-0'); img.classList.remove('scale-95');
};
window.closeImageViewer = () => {
    const m = document.getElementById('image-viewer-modal'), img = document.getElementById('full-size-image');
    m.classList.add('opacity-0'); img.classList.add('scale-95');
    setTimeout(() => { m.classList.add('hidden'); img.src = ''; }, 300);
};

// Save & Delete
window.handleSaveExpense = async (e) => {
    e.preventDefault();
    if (!fbUser) return alertUI("Not connected.");
    const btn = document.getElementById('btn-save'), orig = btn.innerHTML;
    btn.innerHTML = `<i class="ph ph-spinner animate-spin"></i> Saving...`; btn.disabled = true;

    const amt = parseFloat(document.getElementById('input-amount').value);
    const desc = document.getElementById('input-desc').value.trim();
    const date = document.getElementById('input-date').value;
    const pid = document.getElementById('input-person').value;
    const imgFile = document.getElementById('input-image').files[0];

    let imgUrl = null;
    if (imgFile) {
        try { imgUrl = await compressImage(imgFile); }
        catch(err) { alertUI("Image processing failed"); btn.innerHTML = orig; btn.disabled = false; return; }
    }

    try {
        await addDoc(collection(db, 'bazar_expenses'), {
            amount: amt, description: desc, date: date, personId: pid, imageUrl: imgUrl,
            timestamp: Date.now(), serverTime: serverTimestamp()
        });
        closeModal();
    } catch (err) { 
        console.error(err);
        alertUI("Failed to save. Check Firebase Rules."); 
    } 
    finally { btn.innerHTML = orig; btn.disabled = false; }
};

window.promptDelete = (id) => {
    deleteTargetId = id;
    const m = document.getElementById('delete-modal'), c = document.getElementById('delete-content');
    m.classList.remove('hidden'); void m.offsetWidth;
    m.classList.remove('opacity-0'); c.classList.remove('scale-95');
};
window.closeDeleteModal = () => {
    const m = document.getElementById('delete-modal'), c = document.getElementById('delete-content');
    m.classList.add('opacity-0'); c.classList.add('scale-95');
    setTimeout(() => { m.classList.add('hidden'); deleteTargetId = null; }, 300);
};
document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
    if (!deleteTargetId || !fbUser) return;
    const btn = document.getElementById('confirm-delete-btn'), orig = btn.innerText;
    btn.innerText = "Deleting..."; btn.disabled = true;
    try {
        await deleteDoc(doc(db, 'bazar_expenses', deleteTargetId));
        closeDeleteModal();
    } catch (err) { 
        console.error(err);
        alertUI("Failed to delete. Check Firebase Rules."); 
    } 
    finally { btn.innerText = orig; btn.disabled = false; }
});

// Theme Toggle
window.toggleTheme = () => {
    const html = document.documentElement, icon = document.getElementById('theme-icon');
    if (html.classList.contains('dark')) {
        html.classList.remove('dark'); localStorage.setItem('bazar_theme', 'light');
        icon.className = 'ph ph-moon text-lg';
    } else {
        html.classList.add('dark'); localStorage.setItem('bazar_theme', 'dark');
        icon.className = 'ph ph-sun text-lg';
    }
};
if (localStorage.getItem('bazar_theme') === 'dark' || (!('bazar_theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark'); document.getElementById('theme-icon').className = 'ph ph-sun text-lg';
}

const alertUI = (msg) => {
    const t = document.createElement('div');
    t.className = 'fixed top-6 left-1/2 -translate-x-1/2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-3 rounded-full shadow-float z-[100] font-bold text-sm tracking-wide animate-slide-up';
    t.innerText = msg; document.body.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translate(-50%, -20px)'; t.style.transition = 'all 0.4s'; setTimeout(() => t.remove(), 400); }, 3000);
};