// Bootstrap del dashboard MOP: inicialización, tabs del subheader y resize de gráficos

function init() {
    if (!window.MOP_DATA) {
        console.error('[MOP] window.MOP_DATA no cargado.');
        return;
    }

    populateFilters();
    applyFilters();
    bindFilterEvents();
    bindTableSortEvents();
    bindTabEvents();

    window.addEventListener('resize', () => {
        Object.values(charts).forEach(ch => {
            if (ch && typeof ch.resize === 'function') ch.resize();
        });
    });

    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            setTimeout(renderAllCharts, 120);
        });
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ── Tabs del subheader ────────────────────────────────────────────────────
function switchTab(targetView) {
    currentActiveTab = targetView;
    const tabs = document.querySelectorAll('.view-tab-btn[data-mop-view]');
    const containers = document.querySelectorAll('.mop-view-container');
    tabs.forEach(t => {
        t.classList.toggle('active', t.dataset.mopView === targetView);
    });
    containers.forEach(c => {
        const isMatch = (c.dataset.mopView === targetView);
        c.classList.toggle('hidden', !isMatch);
    });

    requestAnimationFrame(() => {
        renderAllCharts();
        Object.values(charts).forEach(ch => {
            if (ch && typeof ch.resize === 'function') ch.resize();
        });
    });
}
window.switchMOPTab = switchTab;

function bindTabEvents() {
    const tabs = document.querySelectorAll('.view-tab-btn[data-mop-view]');
    tabs.forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.dataset.mopView);
        });
    });

    // Verificar hash en la URL al cargar
    if (window.location.hash === '#inversion') {
        switchTab('inversion');
    } else if (window.location.hash === '#programas') {
        switchTab('programas');
    } else {
        switchTab('resumen');
    }

    window.addEventListener('hashchange', () => {
        if (window.location.hash === '#inversion') {
            switchTab('inversion');
        } else if (window.location.hash === '#programas') {
            switchTab('programas');
        } else if (window.location.hash === '#resumen' || !window.location.hash) {
            switchTab('resumen');
        }
    });
}

// ── Bootstrap ────────────────────────────────────────────────────────────
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
