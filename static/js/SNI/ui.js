/**
 * static/js/SNI/ui.js
 * Coordinación de UI, Pestañas, KPIs y Exportación Excel para SNI
 */

document.addEventListener('DOMContentLoaded', () => {
    initSNIPlatform();
});

function initSNIPlatform() {
    if (!window.SNI_DATA) {
        console.error('SNI_DATA no encontrado. Verifica la carga de static/data/sni_data.js');
        return;
    }

    // 1. Inicializar Lucide Icons
    if (window.lucide) lucide.createIcons();

    // 2. Inicializar Tabs de Vistas
    setupViewTabs();

    // 3. Inicializar Filtros
    initSNIFilters();

    // 4. Inicializar Mapa Leaflet
    initSNIMap();

    // 5. Inicializar Gráficos Chart.js
    initSNICharts();

    // 6. Configurar Botón de Exportación Excel
    setupExportButton();

    // 7. Configurar Toggle de Tema (Claro/Oscuro)
    setupThemeListener();

    // 8. Primera sincronización de datos
    updateSNIDashboard();
}

/**
 * Switcher de vistas (Mapa, Territorio, Ministerios, Evolución)
 */
function setupViewTabs() {
    const tabBtns = document.querySelectorAll('.view-tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const viewName = btn.dataset.view;
            sniState.currentView = viewName;
            switchViewContainer(viewName);
        });
    });

    // Soporte para links directos desde el submenú de SNI
    document.querySelectorAll('#nav-sni-submenu .nav-submenu-item').forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href') || '';
            const hashIndex = href.indexOf('#');
            if (hashIndex !== -1) {
                const targetView = href.substring(hashIndex + 1);
                const targetBtn = document.getElementById(`btn-view-${targetView}`);
                if (targetBtn) {
                    e.preventDefault();
                    targetBtn.click();
                    const dropdown = document.getElementById('nav-menu-dropdown');
                    if (dropdown) dropdown.classList.remove('open');
                    const group = document.getElementById('nav-sni-group');
                    if (group) group.classList.remove('open');
                    window.location.hash = targetView;
                }
            }
        });
    });

    // Soporte para cargar directamente por hash en URL (ej: SNI.html#territorial)
    const initialHash = (window.location.hash || '').replace('#', '');
    if (initialHash) {
        const targetBtn = document.getElementById(`btn-view-${initialHash}`);
        if (targetBtn) {
            targetBtn.click();
        }
    }
}

function switchViewContainer(viewName) {
    document.querySelectorAll('.sni-view-container').forEach(c => {
        c.style.display = 'none';
    });

    const activeContainer = document.getElementById(`view-${viewName}`);
    if (activeContainer) {
        activeContainer.style.display = viewName === 'map' ? 'grid' : 'flex';
    }

    if (viewName === 'map') {
        if (sniLeafletMap) {
            setTimeout(() => {
                sniLeafletMap.invalidateSize();
            }, 100);
        }
        if (typeof updateMapMetricRankingChart === 'function') {
            updateMapMetricRankingChart();
        }
    }

    if (window.lucide) lucide.createIcons();

    // Redibujar gráficos para ajustar dimensiones al contenedor visible
    setTimeout(() => {
        updateSNICharts();
    }, 60);
}

/**
 * Función Maestra: Se ejecuta cada vez que cambia un filtro
 */
function updateSNIDashboard() {
    // 1. Actualizar Tarjetas de KPIs
    updateSummaryKPIsUI();

    // 2. Actualizar Gráficos
    updateSNICharts();

    // 3. Actualizar Mapa
    updateSNIMapChoropleth();
}

/**
 * Actualiza los números del banner superior de KPIs
 */
function updateSummaryKPIsUI() {
    const kpis = getSummaryKPIs();

    const elTotal = document.getElementById('kpi-total-usd');
    const elAvg = document.getElementById('kpi-avg-year');
    const elMin = document.getElementById('kpi-top-min');
    const elReg = document.getElementById('kpi-top-reg');
    const elSub = document.getElementById('kpi-sub-split');

    if (elTotal) elTotal.innerText = `US$ ${kpis.totalUsd.toLocaleString('es-CL', { maximumFractionDigits: 1 })} MM`;
    if (elAvg) elAvg.innerText = `US$ ${kpis.avgYearUsd.toLocaleString('es-CL', { maximumFractionDigits: 1 })} MM/año`;
    if (elMin) elMin.innerText = `${kpis.topMinisterio} (${kpis.topMinisterioPct}%)`;
    if (elReg) elReg.innerText = `${kpis.topRegion.replace(/^\d+_/, '')} (${kpis.topRegionPct}%)`;
    if (elSub) elSub.innerText = `${kpis.sub31Pct}% Proy | ${kpis.sub33Pct}% FNDR`;
}

/**
 * Configura el botón de Exportación a Excel en el sidebar
 */
function setupExportButton() {
    const btnExport = document.getElementById('btn-export-excel');
    if (btnExport) {
        btnExport.addEventListener('click', exportSNIToExcel);
    }
}

// Variable de caché para la base de datos completa de exportación
let cachedSniRawData = null;

/**
 * Exportar datos granulares completos (+47.000 registros) a Excel (.xlsx) con SheetJS
 * Carga bajo demanda (Lazy Export) sin penalizar el rendimiento de la aplicación
 */
async function exportSNIToExcel() {
    if (!window.XLSX) {
        alert('SheetJS no está disponible.');
        return;
    }

    const toast = document.getElementById('sni-export-toast');
    const toastText = document.getElementById('sni-export-toast-text');
    if (toast) {
        toast.style.display = 'flex';
        if (toastText) toastText.innerText = 'Cargando base de datos completa (+47.000 registros)...';
    }

    try {
        // Cargar archivo JSON granular solo cuando el usuario lo solicita
        if (!cachedSniRawData) {
            const resp = await fetch('static/data/sni_raw_data.json');
            if (!resp.ok) throw new Error('No se pudo cargar static/data/sni_raw_data.json');
            cachedSniRawData = await resp.json();
        }

        if (toastText) toastText.innerText = 'Aplicando filtros activos a los registros...';
        await new Promise(resolve => setTimeout(resolve, 60)); // Permitir renderizado de UI

        const { selectedYears, selectedRegions, selectedMinistries, selectedSources, selectedSubtitles } = sniState;

        // Filtrar los registros granulares respetando los filtros seleccionados
        const filteredRaw = cachedSniRawData.filter(row => {
            if (selectedYears && selectedYears.length > 0 && !selectedYears.includes(row.y)) return false;
            if (selectedRegions && selectedRegions.length > 0 && !selectedRegions.includes(row.r)) return false;
            if (selectedMinistries && selectedMinistries.length > 0 && !selectedMinistries.includes(row.m)) return false;
            if (selectedSources && selectedSources.length > 0 && !selectedSources.includes(row.f)) return false;
            if (selectedSubtitles && selectedSubtitles.length > 0 && !selectedSubtitles.includes(row.s)) return false;
            return true;
        });

        if (toastText) toastText.innerText = `Generando Excel con ${filteredRaw.length.toLocaleString('es-CL')} registros...`;
        await new Promise(resolve => setTimeout(resolve, 60));

        const rows = filteredRaw.map(r => ({
            'ID': r.id || '',
            'Ejercicio (Año)': r.y,
            'Región Definitiva': r.r,
            'Provincia': r.prov || 'Sin Provincia',
            'Comuna': r.com || 'Sin Comuna',
            'Ministerio Destacado': r.m,
            'Servicio / Dirección': r.srv || 'Otros',
            'Fuente de Financiamiento': r.f,
            'Subtítulo Presupuestario': r.s,
            'Nombre Programa': r.prog || '',
            'Nombre Asignación': r.asig || '',
            'Inversión MM USD 2024': r.u,
            'Inversión Pesos 2024': r.p
        }));

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Inversion_Publica_SNI');

        const hasFilter = (selectedYears && selectedYears.length) ||
            (selectedRegions && selectedRegions.length) ||
            (selectedMinistries && selectedMinistries.length) ||
            (selectedSources && selectedSources.length) ||
            (selectedSubtitles && selectedSubtitles.length);
        const suffix = hasFilter ? '_Filtrado' : '_Completo';
        XLSX.writeFile(wb, `SNI_Inversion_Publica_CATLEC${suffix}_${new Date().toISOString().slice(0, 10)}.xlsx`);

        if (toastText) toastText.innerText = '¡Descarga completada con éxito!';
        setTimeout(() => {
            if (toast) toast.style.display = 'none';
        }, 2200);
    } catch (err) {
        console.error('Error al exportar a Excel:', err);
        if (toastText) toastText.innerText = 'Error al generar el archivo Excel.';
        setTimeout(() => {
            if (toast) toast.style.display = 'none';
        }, 3000);
        alert('Ocurrió un error al preparar la exportación: ' + err.message);
    }
}

function setupThemeListener() {
    const btnTheme = document.getElementById('theme-toggle-btn');
    if (btnTheme) {
        btnTheme.addEventListener('click', () => {
            setTimeout(() => {
                if (typeof updateMapTileTheme === 'function') updateMapTileTheme();
                updateSNICharts();
            }, 100);
        });
    }
}
