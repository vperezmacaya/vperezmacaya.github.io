// Bootstrap del dashboard Puertos: navegación entre vistas y eventos del DOM
// (Standard catlec-nueva-visualizacion)

window.switchVisualization = function (viewName) {
    const validViews = ['resumen', 'contenedores', 'tipologia', 'terrestre'];
    if (!validViews.includes(viewName)) {
        viewName = 'resumen';
    }

    if (typeof window.puertosCloseAllTooltips === 'function') {
        window.puertosCloseAllTooltips();
    }

    // 1. Desactivar todos los botones del subheader
    document.querySelectorAll('.view-tab-btn').forEach(btn => btn.classList.remove('active'));

    // 2. Activar el botón seleccionado
    const activeBtn = document.getElementById(`btn-view-${viewName}`);
    if (activeBtn) activeBtn.classList.add('active');

    // 3. Ocultar todos los contenedores
    document.querySelectorAll('.vis-container').forEach(el => el.style.display = 'none');

    // 4. Mostrar el contenedor objetivo
    const targetVis = document.getElementById(`vis-container-${viewName}`);
    if (targetVis) {
        targetVis.style.display = 'flex';
    }

    // 5. Renderizar gráficos de la vista seleccionada
    if (viewName === 'resumen') {
        renderVistaResumen();
    } else if (viewName === 'contenedores') {
        renderVistaContenedores();
    } else if (viewName === 'tipologia') {
        renderVistaTipologia();
    } else if (viewName === 'terrestre') {
        renderVistaTerrestre();
    }

    // 6. Actualizar hash en la URL (la vista inicial, Resumen de Carga, va sin #)
    const hash = viewName === 'resumen' ? '' : `#${viewName}`;
    if (window.location.hash !== hash) {
        history.replaceState(null, '', hash || window.location.pathname + window.location.search);
    }

    // 7. Refrescar iconos Lucide
    if (window.lucide) {
        lucide.createIcons();
    }
};

// ── Inicialización al cargar DOM ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initKPIs();

    // Botones de pestañas
    const tabButtons = [
        { id: 'btn-view-resumen', view: 'resumen' },
        { id: 'btn-view-contenedores', view: 'contenedores' },
        { id: 'btn-view-tipologia', view: 'tipologia' },
        { id: 'btn-view-terrestre', view: 'terrestre' }
    ];

    tabButtons.forEach(t => {
        const btn = document.getElementById(t.id);
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                window.switchVisualization(t.view);
            });
        }
    });

    // Botón Exportar
    const btnExp = document.getElementById('btn-export-excel');
    if (btnExp) {
        btnExp.addEventListener('click', window.exportPuertosExcel);
    }

    // Vista según el hash (sin hash o desconocido: Resumen de Carga)
    const viewFromHash = (hash) => {
        const view = (hash || '').replace('#', '').trim();
        return tabButtons.some(t => t.view === view) ? view : 'resumen';
    };
    window.switchVisualization(viewFromHash(window.location.hash));
    window.addEventListener('hashchange', () => window.switchVisualization(viewFromHash(window.location.hash)));

    // Submenú de Puertos en "Seleccionar Base de Datos" (misma página)
    document.querySelectorAll('#nav-puertos-submenu .nav-submenu-item').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            CatlecNav.close();
            window.switchVisualization(viewFromHash(link.getAttribute('href')));
        });
    });

    // Eventos de ventana para cerrar tooltips flotantes
    window.addEventListener('resize', () => {
        if (typeof window.puertosCloseAllTooltips === 'function') window.puertosCloseAllTooltips();
    });
    window.addEventListener('scroll', () => {
        if (typeof window.puertosCloseAllTooltips === 'function') window.puertosCloseAllTooltips();
    }, true);

    // Lucide icons
    if (window.lucide) {
        lucide.createIcons();
    }
});
