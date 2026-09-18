// ─── static/js/common/nav-menu.js ─────────────────────────────────────────────
// Menú "Seleccionar Base de Datos" compartido por los 7 dashboards CATLEC.
// Reemplaza las ~7 copias casi idénticas del árbol de navegación (HTML + JS de
// apertura/cierre) que existían antes, una por módulo. Cada HTML solo necesita
// un contenedor vacío <div class="nav-menu" id="nav-menu"></div> y llamar a
// CatlecNav.render(). El módulo actual se detecta automáticamente por el
// nombre del archivo, así que no hace falta configurar nada por página.
//
// La navegación DENTRO del módulo activo (cambiar de vista sin recargar) sigue
// viviendo en cada HTML, porque llama a funciones específicas de ese módulo
// (showEfeInvestmentView, hideTimelineView, switchMOPTab, etc.) que no pueden
// generalizarse sin tocar la lógica de vistas de cada dashboard.
window.CatlecNav = (function () {
    const NAV_MODULES = [
        {
            id: 'dgc',
            file: 'index.html',
            label: 'Dirección General de Concesiones (DGC)',
            logo: { type: 'img', src: 'logo/Gob_chile_logo.svg' },
            submenu: [
                { key: 'map', icon: 'map', label: 'Mapa', hrefSuffix: '' },
                { key: 'timeline', icon: 'clock', label: 'Líneas de Tiempo', hrefSuffix: '#timeline' },
                { key: 'investment', icon: 'line-chart', label: 'Análisis de Inversión', hrefSuffix: '#investment' },
                { key: 'contracts', icon: 'layers', label: 'Análisis de Contratos', hrefSuffix: '#contracts' },
                { key: 'bidders', icon: 'users', label: 'Análisis de Oferentes', hrefSuffix: '#bidders' },
            ],
        },
        {
            id: 'efe',
            file: 'EFE.html',
            label: 'Empresas de Ferrocarriles del Estado (EFE)',
            logo: { type: 'img', src: 'logo/efe_logo.png' },
            submenu: [
                { key: 'map', icon: 'map', label: 'Mapa', hrefSuffix: '' },
                { key: 'timeline', icon: 'clock', label: 'Líneas de Tiempo de Proyectos', hrefSuffix: '#timeline' },
                { key: 'investment', icon: 'line-chart', label: 'Análisis de Inversión de Proyectos', hrefSuffix: '#inversion' },
                { key: 'operacion', icon: 'trending-up', label: 'Demanda y Operación', hrefSuffix: '#operacion' },
            ],
        },
        {
            id: 'metro',
            file: 'Metro.html',
            label: 'Metro de Santiago',
            logo: { type: 'img', src: 'logo/metro_logo.png' },
            submenu: [
                { key: 'map', icon: 'map', label: 'Mapa', hrefSuffix: '' },
                { key: 'timeline', icon: 'clock', label: 'Líneas de Tiempo', hrefSuffix: '#timeline' },
                { key: 'comunas', icon: 'building-2', label: 'Estadísticas Comunales', hrefSuffix: '#comunas' },
                { key: 'demanda', icon: 'trending-up', label: 'Demanda y Operación', hrefSuffix: '#demanda' },
            ],
        },
        {
            id: 'mop',
            file: 'MOP.html',
            label: 'Ministerio de Obras Públicas (MOP)',
            logo: { type: 'img', src: 'logo/Gob_chile_logo.svg' },
            submenu: [
                { key: 'resumen', icon: 'layout-dashboard', label: 'Tabla de proyectos', hrefSuffix: '' },
                { key: 'inversion', icon: 'bar-chart-2', label: 'Análisis de inversión', hrefSuffix: '#inversion' },
                { key: 'programas', icon: 'layers', label: 'Programas y Etapas', hrefSuffix: '#programas' },
            ],
        },
        {
            id: 'sni',
            file: 'SNI.html',
            label: 'Sistema Nacional de Inversiones (SNI)',
            logo: { type: 'img', src: 'logo/Gob_chile_logo.svg' },
            submenu: [
                { key: 'map', icon: 'map', label: 'Mapa Regional', hrefSuffix: '#map' },
                { key: 'territorial', icon: 'bar-chart-2', label: 'Análisis Territorial', hrefSuffix: '#territorial' },
                { key: 'ministries', icon: 'landmark', label: 'Ministerios y Sectores', hrefSuffix: '#ministries' },
                { key: 'temporal', icon: 'clock', label: 'Evolución Temporal', hrefSuffix: '#temporal' },
            ],
        },
        {
            id: 'puertos',
            file: 'puertos.html',
            label: 'Puertos (Región del Biobío)',
            logo: { type: 'lucide', name: 'anchor' },
            submenu: [
                { key: 'resumen', icon: 'boxes', label: 'Resumen de Carga', hrefSuffix: '#resumen' },
                { key: 'contenedores', icon: 'package', label: 'Contenedores y TEUs', hrefSuffix: '#contenedores' },
                { key: 'tipologia', icon: 'layers', label: 'Tipología de Carga', hrefSuffix: '#tipologia' },
                { key: 'terrestre', icon: 'truck', label: 'Conectividad Terrestre', hrefSuffix: '#terrestre' },
            ],
        },
        {
            id: 'sectra',
            file: 'SECTRA.html',
            label: 'Secretaría de Planificación de Transporte (SECTRA)',
            logo: { type: 'img', src: 'logo/Gob_chile_logo.svg' },
            submenu: [
                { key: 'map', icon: 'map', label: 'Mapa & Proyectos', hrefSuffix: '' },
                { key: 'conurbaciones', icon: 'map-pin', label: 'Info por Conurbación', hrefSuffix: '#conurbaciones' },
                { key: 'analytics', icon: 'bar-chart-2', label: 'Estadísticas Generales', hrefSuffix: '#analytics' },
            ],
        },
    ];

    const FILE_TO_ID = {
        'index.html': 'dgc', '': 'dgc',
        'efe.html': 'efe',
        'metro.html': 'metro',
        'mop.html': 'mop',
        'sni.html': 'sni',
        'puertos.html': 'puertos',
        'sectra.html': 'sectra',
    };

    function detectCurrentModuleId() {
        const path = window.location.pathname.toLowerCase();
        const file = path.substring(path.lastIndexOf('/') + 1);
        return FILE_TO_ID[file] || 'dgc';
    }

    function logoHtml(logo, alt) {
        if (logo.type === 'lucide') {
            return `<i data-lucide="${logo.name}" style="width:15px;height:15px;flex-shrink:0;"></i>`;
        }
        return `<img src="${logo.src}" alt="${alt}" class="nav-db-logo" width="15" height="15" style="width:15px;height:15px;max-width:15px;max-height:15px;object-fit:contain;flex-shrink:0;">`;
    }

    function buildMenuHtml(currentId) {
        const current = NAV_MODULES.find(m => m.id === currentId) || NAV_MODULES[0];

        // SECTRA es un módulo independiente y aislado (ver CLAUDE.md): no debe
        // vincularse ni ser accesible desde el menú de ningún otro dashboard,
        // solo se lista a sí mismo cuando el usuario ya está dentro de SECTRA.html.
        const visibleModules = NAV_MODULES.filter(m => m.id !== 'sectra' || currentId === 'sectra');

        const groupsHtml = visibleModules.map(m => {
            const isCurrent = m.id === currentId;
            const rootHref = isCurrent ? '#' : m.file;
            const itemClasses = isCurrent ? 'nav-menu-item active nav-menu-has-sub' : 'nav-menu-item nav-menu-has-sub';

            const submenuHtml = m.submenu.map(item => {
                const href = isCurrent ? (item.hrefSuffix || '#') : (m.file + item.hrefSuffix);
                return `<a class="nav-submenu-item" id="nav-${m.id}-sub-${item.key}" href="${href}">
                    <i data-lucide="${item.icon}" style="width:13px;height:13px;"></i> ${item.label}
                </a>`;
            }).join('\n');

            return `<div class="nav-menu-group" id="nav-${m.id}-group">
                <div class="${itemClasses}" id="nav-${m.id}-parent-item">
                    <a href="${rootHref}" id="nav-${m.id}-main-link" class="nav-menu-parent-link"
                        style="display:flex;align-items:center;gap:0.5rem;flex:1;text-decoration:none;color:inherit;">
                        ${logoHtml(m.logo, m.label)}
                        ${m.label}
                    </a>
                    <i data-lucide="chevron-left" class="nav-submenu-trigger-icon"
                        style="width:12px;height:12px;opacity:0.7;cursor:pointer;padding:2px;"></i>
                </div>
                <div class="nav-submenu" id="nav-${m.id}-submenu">
                    ${submenuHtml}
                </div>
            </div>`;
        }).join('\n');

        return `<button class="nav-menu-btn" id="nav-menu-btn" aria-haspopup="true" aria-expanded="false">
                ${logoHtml(current.logo, current.label)}
                Seleccionar Base de Datos
                <i data-lucide="chevron-down" style="width:12px;height:12px;"></i>
            </button>
            <div class="nav-menu-dropdown" id="nav-menu-dropdown">
                ${groupsHtml}
            </div>`;
    }

    function wireInteractions() {
        const navBtn = document.getElementById('nav-menu-btn');
        const navDropdown = document.getElementById('nav-menu-dropdown');
        if (!navBtn || !navDropdown) return;

        navBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            navDropdown.classList.toggle('open');
            navBtn.setAttribute('aria-expanded', navDropdown.classList.contains('open'));
        });
        document.addEventListener('click', () => {
            navDropdown.classList.remove('open');
            NAV_MODULES.forEach(m => {
                const group = document.getElementById(`nav-${m.id}-group`);
                if (group) group.classList.remove('open');
            });
        });
        navDropdown.addEventListener('click', (e) => e.stopPropagation());

        NAV_MODULES.forEach(m => {
            const group = document.getElementById(`nav-${m.id}-group`);
            if (!group) return;
            const trigger = group.querySelector('.nav-submenu-trigger-icon');
            if (trigger) {
                trigger.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    group.classList.toggle('open');
                });
            }
            group.addEventListener('mouseenter', () => group.classList.add('open'));
            group.addEventListener('mouseleave', () => group.classList.remove('open'));
        });
    }

    function render() {
        const container = document.getElementById('nav-menu');
        if (!container) return;
        const currentId = detectCurrentModuleId();
        container.innerHTML = buildMenuHtml(currentId);
        wireInteractions();
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }

    return { render, NAV_MODULES, detectCurrentModuleId };
})();
