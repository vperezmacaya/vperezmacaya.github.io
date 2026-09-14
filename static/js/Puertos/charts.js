/**
 * CATLEC - Módulo Puertos (Región del Biobío)
 * static/js/Puertos/charts.js
 * 
 * Lógica de inicialización, cálculo de KPIs y renderizado de gráficos Chart.js
 * Cumple con los estándares de diseño CATLEC (Light Theme, HiDPI, Micro-leyendas, Doughnuts con leyenda HTML)
 */

(function () {
    'use strict';

    // ── Configuración HiDPI / Retina ──────────────────────────────────────────
    if (typeof Chart !== 'undefined' && Chart.defaults) {
        Chart.defaults.devicePixelRatio = Math.max(2.5, window.devicePixelRatio || 1);
        Chart.defaults.font.family = "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    }

    // Instancias de Gráficos
    const chartInstances = {};

    // Paleta oficial CATLEC
    const COLORS = {
        primary: '#6366f1',
        primaryAlpha: 'rgba(99, 102, 241, 0.82)',
        sky: '#0284c7',
        skyAlpha: 'rgba(2, 132, 199, 0.82)',
        amber: '#f59e0b',
        amberAlpha: 'rgba(245, 158, 11, 0.85)',
        emerald: '#10b981',
        emeraldAlpha: 'rgba(16, 185, 129, 0.85)',
        purple: '#8b5cf6',
        purpleAlpha: 'rgba(139, 92, 246, 0.82)',
        rose: '#f43f5e',
        roseAlpha: 'rgba(244, 63, 94, 0.82)',
        slate: '#64748b',
        slateAlpha: 'rgba(100, 116, 139, 0.82)',
        cyan: '#06b6d4',
        cyanAlpha: 'rgba(6, 182, 212, 0.82)',
        grid: '#e2e8f0',
        textPrimary: '#1e293b',
        textSecondary: '#64748b'
    };

    // ── Formatters ────────────────────────────────────────────────────────────
    function formatNumber(num, decimals = 0) {
        if (num === null || num === undefined || isNaN(num)) return '0';
        return Number(num).toLocaleString('es-CL', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }

    function formatMillion(num, unit = 'Ton') {
        if (num === null || num === undefined || isNaN(num)) return `0 ${unit}`;
        const val = Number(num);
        if (Math.abs(val) >= 1e6) {
            return `${formatNumber(val / 1e6, 2)} M ${unit}`;
        } else if (Math.abs(val) >= 1e3) {
            return `${formatNumber(val / 1e3, 1)} K ${unit}`;
        }
        return `${formatNumber(val, 0)} ${unit}`;
    }

    // ── Destrucción segura de gráficos ────────────────────────────────────────
    function destroyChart(key) {
        if (chartInstances[key]) {
            chartInstances[key].destroy();
            delete chartInstances[key];
        }
    }

    // ── Inicializar KPIs ──────────────────────────────────────────────────────
    function initKPIs() {
        if (!window.PUERTOS_DATA || !window.PUERTOS_DATA.kpis) return;
        const k = window.PUERTOS_DATA.kpis;

        // Vista 1: Resumen de Carga
        const elTotCarga = document.getElementById('kpi-total-carga');
        if (elTotCarga) elTotCarga.textContent = formatMillion(k.total_carga_historica_ton, 'Ton');

        const elAvgCarga = document.getElementById('kpi-avg-carga');
        if (elAvgCarga) elAvgCarga.textContent = `${formatMillion(k.avg_carga_anual_ton, 'Ton')}/año`;

        const elEmbExt = document.getElementById('kpi-embarque-exterior');
        if (elEmbExt) elEmbExt.textContent = formatMillion(k.total_embarcada_exterior_ton, 'Ton');

        const elDesembExt = document.getElementById('kpi-desembarque-exterior');
        if (elDesembExt) elDesembExt.textContent = formatMillion(k.total_desembarcada_exterior_ton, 'Ton');

        const elCabTrans = document.getElementById('kpi-cabotaje-transito');
        if (elCabTrans) elCabTrans.textContent = formatMillion(k.total_cabotaje_ton + k.total_transito_ton, 'Ton');

        // Vista 2: Contenedores y TEUs
        const elTotTeus = document.getElementById('kpi-total-teus');
        if (elTotTeus) elTotTeus.textContent = formatMillion(k.total_teus_historico, 'TEUs');

        const elAvgTeus = document.getElementById('kpi-avg-teus');
        if (elAvgTeus) elAvgTeus.textContent = `${formatMillion(k.avg_teus_anual, 'TEUs')}/año`;

        const elC40 = document.getElementById('kpi-c40-unidades');
        if (elC40) elC40.textContent = formatMillion(k.total_c40_unidades, 'Unid.');

        const elC20 = document.getElementById('kpi-c20-unidades');
        if (elC20) elC20.textContent = formatMillion(k.total_c20_unidades, 'Unid.');

        const elRatio = document.getElementById('kpi-ratio-c40-c20');
        if (elRatio) {
            const ratio = k.total_c20_unidades > 0 ? (k.total_c40_unidades / k.total_c20_unidades).toFixed(1) : '0';
            elRatio.textContent = `${ratio}x (40ft/20ft)`;
        }

        // Vista 3: Tipología de Carga
        const elGrLiq = document.getElementById('kpi-granel-liquido');
        if (elGrLiq) elGrLiq.textContent = formatMillion(k.total_granel_liquido_ton, 'Ton');

        const elGrSol = document.getElementById('kpi-granel-solido');
        if (elGrSol) elGrSol.textContent = formatMillion(k.total_granel_solido_ton, 'Ton');

        const elCargaCont = document.getElementById('kpi-carga-contenedores');
        if (elCargaCont) elCargaCont.textContent = formatMillion(k.total_contenedores_ton, 'Ton');

        const elCargaSuel = document.getElementById('kpi-carga-suelta');
        if (elCargaSuel) elCargaSuel.textContent = formatMillion(k.total_carga_suelta_ton, 'Ton');

        // Vista 4: Conectividad Terrestre
        const elTotPeaje = document.getElementById('kpi-total-pasadas-peaje');
        if (elTotPeaje) elTotPeaje.textContent = formatMillion(k.total_peaje_pasadas, 'Pasadas');

        const elPj3 = document.getElementById('kpi-camiones-3mas-ejes');
        if (elPj3) {
            const pct3 = k.total_peaje_pasadas > 0 ? ((k.total_peaje_camiones_3mas_ejes / k.total_peaje_pasadas) * 100).toFixed(1) : 0;
            elPj3.textContent = `${formatMillion(k.total_peaje_camiones_3mas_ejes, '')} (${pct3}%)`;
        }

        const elPj2 = document.getElementById('kpi-camiones-2ejes');
        if (elPj2) {
            const pct2 = k.total_peaje_pasadas > 0 ? ((k.total_peaje_camiones_2ejes / k.total_peaje_pasadas) * 100).toFixed(1) : 0;
            elPj2.textContent = `${formatMillion(k.total_peaje_camiones_2ejes, '')} (${pct2}%)`;
        }

        const elReestTrans = document.getElementById('kpi-reestibas-transbordos');
        if (elReestTrans) elReestTrans.textContent = formatMillion(k.total_reestibas_transbordos_ton, 'Ton');

        const elTransitoInt = document.getElementById('kpi-transito-internacional');
        if (elTransitoInt) elTransitoInt.textContent = formatMillion(k.total_transito_ton, 'Ton');
    }

    // ── Tooltip externo negro compartido para todos los gráficos de Puertos ───
    // (réplica exacta del estándar investmentExternalTooltip de index.html)
    function puertosExternalTooltip(context) {
        const { chart, tooltip } = context;
        const tooltipId = 'puertos-shared-tooltip';
        let el = document.getElementById(tooltipId);
        if (!el) {
            el = document.createElement('div');
            el.id = tooltipId;
            el.style.cssText = [
                'position:fixed',
                'background:rgba(0,0,0,0.8)',
                'color:#fff',
                'border-radius:3px',
                'padding:6px 8px',
                'font:12px/1.4 system-ui,sans-serif',
                'pointer-events:none',
                'white-space:nowrap',
                'z-index:9999',
                'opacity:0'
            ].join(';');
            document.body.appendChild(el);
        }

        if (tooltip.opacity === 0) {
            el.style.transition = 'opacity 0.25s ease-in';
            el.style.opacity = '0';
            return;
        }

        const wasVisible = parseFloat(el.style.opacity || '0') > 0.05;

        // Título
        const titleLines = (tooltip.title || []).flatMap(t => Array.isArray(t) ? t : [t]);
        const title = titleLines.map(t => String(t).trim()).filter(Boolean).join(' ');

        // Líneas de cuerpo
        const bodyLines = (tooltip.body || []).flatMap(b => b.lines).flatMap(l => Array.isArray(l) ? l : [l]);

        el.innerHTML = [
            title ? `<div style="font-weight:700;margin-bottom:3px">${title}</div>` : '',
            ...bodyLines.map(line => `<div>${line}</div>`)
        ].join('');

        // Posicionamiento en coordenadas de ventana cerca del puntero/caret
        const canvasRect = chart.canvas.getBoundingClientRect();
        let left = canvasRect.left + tooltip.caretX + 10;
        let top = canvasRect.top + tooltip.caretY - 10;

        // Prevenir desborde en el borde derecho
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && left + rect.width > window.innerWidth - 8) {
            left = canvasRect.left + tooltip.caretX - rect.width - 10;
        }

        if (wasVisible) {
            el.style.transition = 'opacity 0.2s ease-out, left 0.8s cubic-bezier(0.2, 0, 0.2, 1), top 0.8s cubic-bezier(0.2, 0, 0.2, 1)';
            el.style.left = left + 'px';
            el.style.top = top + 'px';
            el.style.opacity = '1';
        } else {
            el.style.transition = 'none';
            el.style.left = left + 'px';
            el.style.top = top + 'px';
            void el.offsetHeight;
            el.style.transition = 'opacity 0.2s ease-out';
            el.style.opacity = '1';
        }
    }

    window.puertosCloseAllTooltips = function () {
        const el = document.getElementById('puertos-shared-tooltip');
        if (el) el.style.opacity = '0';
    };

    // ── Helper para Doughnut con Leyenda HTML desacoplada (Standard CATLEC) ───
    function renderPieWithLegend(canvasId, legendId, items, valueFormatter = (v) => formatMillion(v, 'Ton')) {
        const canvas = document.getElementById(canvasId);
        const legendEl = document.getElementById(legendId);
        if (!canvas) return;

        destroyChart(canvasId);

        const labels = items.map(d => d.label);
        const values = items.map(d => Number(d.value) || 0);
        const colors = items.map(d => d.color);
        const total = values.reduce((acc, v) => acc + v, 0) || 1;

        chartInstances[canvasId] = new Chart(canvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors,
                    borderColor: '#ffffff',
                    borderWidth: 1.5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                interaction: {
                    mode: 'nearest',
                    intersect: true
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false,
                        external: puertosExternalTooltip,
                        callbacks: {
                            title: (items) => (items && items[0] ? items[0].label : ''),
                            label: (ctx) => {
                                const val = ctx.raw;
                                const pct = ((val / total) * 100).toFixed(1);
                                return ` ${valueFormatter(val)} (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });

        if (legendEl) {
            legendEl.innerHTML = '';
            labels.forEach((lbl, idx) => {
                const val = values[idx];
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                const col = colors[idx];

                const itemDiv = document.createElement('div');
                itemDiv.style.cssText = 'display:flex; align-items:center; gap:0.35rem; font-size:0.72rem; padding:0.06rem 0;';
                itemDiv.title = `${lbl}: ${valueFormatter(val)} (${pct}%)`;
                itemDiv.innerHTML = `
                    <span style="width:7px; height:7px; border-radius:50%; background-color:${col}; flex-shrink:0;"></span>
                    <span style="color:var(--text-secondary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:0;">${lbl}</span>
                    <span style="font-weight:700; color:var(--text-primary); flex-shrink:0; white-space:nowrap; font-size:0.7rem;">${pct}%</span>
                `;
                legendEl.appendChild(itemDiv);
            });
        }
    }

    // ==========================================================================
    // ── VISTA 1: RESUMEN DE CARGA ─────────────────────────────────────────────
    // ==========================================================================
    function renderVistaResumen() {
        const data = window.PUERTOS_DATA;
        if (!data || !data.annual_aggregates) return;

        const agg = data.annual_aggregates;
        const years = agg.map(d => d.anio.toString());

        // 1. Combo Carga Total vs Variación %
        const c1 = document.getElementById('chart-carga-evolucion');
        if (c1) {
            destroyChart('chart-carga-evolucion');
            const tonsMM = agg.map(d => roundNumber(d.carga_total / 1e6, 2));
            const varsPct = agg.map(d => d.var_anual_carga_pct);

            chartInstances['chart-carga-evolucion'] = new Chart(c1.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: years,
                    datasets: [
                        {
                            type: 'bar',
                            label: 'Carga Total (MM Ton)',
                            data: tonsMM,
                            backgroundColor: COLORS.skyAlpha,
                            borderColor: COLORS.sky,
                            borderWidth: 1,
                            borderRadius: 3,
                            yAxisID: 'y',
                            order: 2
                        },
                        {
                            type: 'line',
                            label: 'Variación Anual (%)',
                            data: varsPct,
                            borderColor: COLORS.amber,
                            backgroundColor: COLORS.amber,
                            borderWidth: 2.2,
                            tension: 0,
                            pointRadius: 2.5,
                            pointHoverRadius: 4.5,
                            pointBackgroundColor: COLORS.amber,
                            fill: false,
                            yAxisID: 'y1',
                            order: 1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'nearest', intersect: true },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: false,
                            external: puertosExternalTooltip,
                            callbacks: {
                                title: (items) => `Año ${items[0].label}`,
                                label: (ctx) => {
                                    if (ctx.dataset.type === 'line') {
                                        return ` Variación: ${ctx.raw > 0 ? '+' : ''}${ctx.raw}%`;
                                    }
                                    return ` Carga Total: ${formatNumber(ctx.raw, 2)} MM Ton`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { color: COLORS.textPrimary, font: { size: 10 } }
                        },
                        y: {
                            type: 'linear',
                            position: 'left',
                            grid: { color: COLORS.grid },
                            ticks: { color: COLORS.textPrimary, font: { size: 10 } },
                            title: { display: true, text: 'Millones de Toneladas (MM Ton)', color: COLORS.textPrimary, font: { size: 9.5, weight: '600' } }
                        },
                        y1: {
                            type: 'linear',
                            position: 'right',
                            grid: { drawOnChartArea: false },
                            ticks: {
                                color: COLORS.amber,
                                font: { size: 10 },
                                callback: (v) => `${v}%`
                            },
                            title: { display: true, text: 'Var. Interanual (%)', color: COLORS.amber, font: { size: 9.5, weight: '600' } }
                        }
                    }
                }
            });
        }

        // 2. Barras Apiladas por Flujo de Carga
        const c2 = document.getElementById('chart-carga-flujos');
        if (c2) {
            destroyChart('chart-carga-flujos');
            chartInstances['chart-carga-flujos'] = new Chart(c2.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: years,
                    datasets: [
                        {
                            label: 'Embarcada Ext.',
                            data: agg.map(d => roundNumber(d.carga_embarcada_ext / 1e6, 2)),
                            backgroundColor: COLORS.skyAlpha,
                            borderColor: COLORS.sky,
                            borderWidth: 1,
                            borderRadius: 2
                        },
                        {
                            label: 'Desembarcada Ext.',
                            data: agg.map(d => roundNumber(d.carga_desembarcada_ext / 1e6, 2)),
                            backgroundColor: COLORS.primaryAlpha,
                            borderColor: COLORS.primary,
                            borderWidth: 1,
                            borderRadius: 2
                        },
                        {
                            label: 'Cabotaje',
                            data: agg.map(d => roundNumber(d.carga_cabotaje / 1e6, 2)),
                            backgroundColor: COLORS.emeraldAlpha,
                            borderColor: COLORS.emerald,
                            borderWidth: 1,
                            borderRadius: 2
                        },
                        {
                            label: 'Re-estibas/Transb.',
                            data: agg.map(d => roundNumber(d.carga_reestibas_transbordos / 1e6, 2)),
                            backgroundColor: COLORS.amberAlpha,
                            borderColor: COLORS.amber,
                            borderWidth: 1,
                            borderRadius: 2
                        },
                        {
                            label: 'Tránsito',
                            data: agg.map(d => roundNumber(d.carga_transito / 1e6, 2)),
                            backgroundColor: COLORS.purpleAlpha,
                            borderColor: COLORS.purple,
                            borderWidth: 1,
                            borderRadius: 2
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'nearest', intersect: true },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: false,
                            external: puertosExternalTooltip,
                            callbacks: {
                                title: (items) => `Año ${items[0].label}`,
                                label: (ctx) => ` ${ctx.dataset.label}: ${formatNumber(ctx.raw, 2)} MM Ton`
                            }
                        }
                    },
                    scales: {
                        x: {
                            stacked: true,
                            grid: { display: false },
                            ticks: { color: COLORS.textPrimary, font: { size: 10 } }
                        },
                        y: {
                            stacked: true,
                            grid: { color: COLORS.grid },
                            ticks: { color: COLORS.textPrimary, font: { size: 10 } },
                            title: { display: true, text: 'MM Toneladas', color: COLORS.textPrimary, font: { size: 9.5, weight: '600' } }
                        }
                    }
                }
            });
        }

        // 3. Doughnut Participación Operación Portuaria
        const k = data.kpis;
        const pieFlujos = [
            { label: 'Embarcada al Exterior', value: k.total_embarcada_exterior_ton, color: COLORS.sky },
            { label: 'Desembarcada del Exterior', value: k.total_desembarcada_exterior_ton, color: COLORS.primary },
            { label: 'Cabotaje', value: k.total_cabotaje_ton, color: COLORS.emerald },
            { label: 'Re-estibas y Transbordos', value: k.total_reestibas_transbordos_ton, color: COLORS.amber },
            { label: 'Tránsito Internacional', value: k.total_transito_ton, color: COLORS.purple }
        ];
        renderPieWithLegend('chart-carga-operacion-pie', 'chart-carga-operacion-pieLegend', pieFlujos);

        // 4. Estacionalidad Mensual
        const c4 = document.getElementById('chart-carga-estacionalidad');
        if (c4 && data.monthly_seasonality) {
            destroyChart('chart-carga-estacionalidad');
            const mLabels = data.monthly_seasonality.map(d => d.mes_nombre);
            const mData = data.monthly_seasonality.map(d => roundNumber(d.avg_carga_ton / 1e6, 2));

            chartInstances['chart-carga-estacionalidad'] = new Chart(c4.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: mLabels,
                    datasets: [{
                        label: 'Promedio Mensual (MM Ton)',
                        data: mData,
                        backgroundColor: COLORS.cyanAlpha,
                        borderColor: COLORS.cyan,
                        borderWidth: 1,
                        borderRadius: 3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'nearest', intersect: true },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: false,
                            external: puertosExternalTooltip,
                            callbacks: {
                                title: (items) => `Mes: ${items[0].label}`,
                                label: (ctx) => ` Promedio: ${formatNumber(ctx.raw, 2)} MM Ton`
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { color: COLORS.textPrimary, font: { size: 10 } }
                        },
                        y: {
                            grid: { color: COLORS.grid },
                            ticks: { color: COLORS.textPrimary, font: { size: 10 } },
                            title: { display: true, text: 'MM Toneladas / Mes', color: COLORS.textPrimary, font: { size: 9.5, weight: '600' } }
                        }
                    }
                }
            });
        }
    }

    // ==========================================================================
    // ── VISTA 2: CONTENEDORES Y TEUS ──────────────────────────────────────────
    // ==========================================================================
    function renderVistaContenedores() {
        const data = window.PUERTOS_DATA;
        if (!data || !data.annual_aggregates) return;

        const agg = data.annual_aggregates;
        const years = agg.map(d => d.anio.toString());

        // 1. Combo TEUs Totales vs Variación %
        const c1 = document.getElementById('chart-teus-evolucion');
        if (c1) {
            destroyChart('chart-teus-evolucion');
            const teusK = agg.map(d => roundNumber(d.teus_total / 1e3, 1));
            const varsPct = agg.map(d => d.var_anual_teus_pct);

            chartInstances['chart-teus-evolucion'] = new Chart(c1.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: years,
                    datasets: [
                        {
                            type: 'bar',
                            label: 'TEUs Totales (Miles)',
                            data: teusK,
                            backgroundColor: COLORS.primaryAlpha,
                            borderColor: COLORS.primary,
                            borderWidth: 1,
                            borderRadius: 3,
                            yAxisID: 'y',
                            order: 2
                        },
                        {
                            type: 'line',
                            label: 'Variación Anual (%)',
                            data: varsPct,
                            borderColor: COLORS.emerald,
                            backgroundColor: COLORS.emerald,
                            borderWidth: 2.2,
                            tension: 0,
                            pointRadius: 2.5,
                            pointHoverRadius: 4.5,
                            pointBackgroundColor: COLORS.emerald,
                            fill: false,
                            yAxisID: 'y1',
                            order: 1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'nearest', intersect: true },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: false,
                            external: puertosExternalTooltip,
                            callbacks: {
                                title: (items) => `Año ${items[0].label}`,
                                label: (ctx) => {
                                    if (ctx.dataset.type === 'line') {
                                        return ` Variación: ${ctx.raw > 0 ? '+' : ''}${ctx.raw}%`;
                                    }
                                    return ` TEUs: ${formatNumber(ctx.raw * 1000)} TEUs`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { color: COLORS.textPrimary, font: { size: 10 } }
                        },
                        y: {
                            type: 'linear',
                            position: 'left',
                            grid: { color: COLORS.grid },
                            ticks: { color: COLORS.textPrimary, font: { size: 10 } },
                            title: { display: true, text: 'Miles de TEUs (kTEU)', color: COLORS.textPrimary, font: { size: 9.5, weight: '600' } }
                        },
                        y1: {
                            type: 'linear',
                            position: 'right',
                            grid: { drawOnChartArea: false },
                            ticks: {
                                color: COLORS.emerald,
                                font: { size: 10 },
                                callback: (v) => `${v}%`
                            },
                            title: { display: true, text: 'Var. Interanual (%)', color: COLORS.emerald, font: { size: 9.5, weight: '600' } }
                        }
                    }
                }
            });
        }

        // 2. Comparativa Unidades 20ft vs 40ft
        const c2 = document.getElementById('chart-contenedores-comparativa');
        if (c2) {
            destroyChart('chart-contenedores-comparativa');
            chartInstances['chart-contenedores-comparativa'] = new Chart(c2.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: years,
                    datasets: [
                        {
                            label: 'Contenedores 40 pies',
                            data: agg.map(d => roundNumber(d.contenedores_40_unidades / 1e3, 1)),
                            backgroundColor: COLORS.skyAlpha,
                            borderColor: COLORS.sky,
                            borderWidth: 1,
                            borderRadius: 3
                        },
                        {
                            label: 'Contenedores 20 pies',
                            data: agg.map(d => roundNumber(d.contenedores_20_unidades / 1e3, 1)),
                            backgroundColor: COLORS.amberAlpha,
                            borderColor: COLORS.amber,
                            borderWidth: 1,
                            borderRadius: 3
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'nearest', intersect: true },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: false,
                            external: puertosExternalTooltip,
                            callbacks: {
                                title: (items) => `Año ${items[0].label}`,
                                label: (ctx) => ` ${ctx.dataset.label}: ${formatNumber(ctx.raw * 1000)} Unidades`
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { color: COLORS.textPrimary, font: { size: 10 } }
                        },
                        y: {
                            grid: { color: COLORS.grid },
                            ticks: { color: COLORS.textPrimary, font: { size: 10 } },
                            title: { display: true, text: 'Miles de Unidades', color: COLORS.textPrimary, font: { size: 9.5, weight: '600' } }
                        }
                    }
                }
            });
        }

        // 3. Estado de Manejo de Contenedores (Apilado)
        const c3 = document.getElementById('chart-contenedores-manejo');
        if (c3) {
            destroyChart('chart-contenedores-manejo');
            chartInstances['chart-contenedores-manejo'] = new Chart(c3.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: years,
                    datasets: [
                        {
                            label: 'Embarcados',
                            data: agg.map(d => roundNumber(d.cont_embarcados_total / 1e3, 1)),
                            backgroundColor: COLORS.primaryAlpha,
                            borderColor: COLORS.primary,
                            borderWidth: 1,
                            borderRadius: 2
                        },
                        {
                            label: 'Desembarcados',
                            data: agg.map(d => roundNumber(d.cont_desembarcados_total / 1e3, 1)),
                            backgroundColor: COLORS.skyAlpha,
                            borderColor: COLORS.sky,
                            borderWidth: 1,
                            borderRadius: 2
                        },
                        {
                            label: 'Cabotaje y Tránsito',
                            data: agg.map(d => roundNumber(d.cont_cabotaje_transito_total / 1e3, 1)),
                            backgroundColor: COLORS.emeraldAlpha,
                            borderColor: COLORS.emerald,
                            borderWidth: 1,
                            borderRadius: 2
                        },
                        {
                            label: 'Re-estibas',
                            data: agg.map(d => roundNumber(d.cont_reestibas_total / 1e3, 1)),
                            backgroundColor: COLORS.amberAlpha,
                            borderColor: COLORS.amber,
                            borderWidth: 1,
                            borderRadius: 2
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'nearest', intersect: true },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: false,
                            external: puertosExternalTooltip,
                            callbacks: {
                                title: (items) => `Año ${items[0].label}`,
                                label: (ctx) => ` ${ctx.dataset.label}: ${formatNumber(ctx.raw * 1000)} Unid.`
                            }
                        }
                    },
                    scales: {
                        x: {
                            stacked: true,
                            grid: { display: false },
                            ticks: { color: COLORS.textPrimary, font: { size: 10 } }
                        },
                        y: {
                            stacked: true,
                            grid: { color: COLORS.grid },
                            ticks: { color: COLORS.textPrimary, font: { size: 10 } },
                            title: { display: true, text: 'Miles de Contenedores', color: COLORS.textPrimary, font: { size: 9.5, weight: '600' } }
                        }
                    }
                }
            });
        }

        // 4. Doughnut Estado de Manipulación
        const totEmb = agg.reduce((s, d) => s + d.cont_embarcados_total, 0);
        const totDes = agg.reduce((s, d) => s + d.cont_desembarcados_total, 0);
        const totCabTr = agg.reduce((s, d) => s + d.cont_cabotaje_transito_total, 0);
        const totReest = agg.reduce((s, d) => s + d.cont_reestibas_total, 0);

        const pieManejo = [
            { label: 'Embarcados', value: totEmb, color: COLORS.primary },
            { label: 'Desembarcados', value: totDes, color: COLORS.sky },
            { label: 'Cabotaje y Tránsito', value: totCabTr, color: COLORS.emerald },
            { label: 'Re-estibas', value: totReest, color: COLORS.amber }
        ];
        renderPieWithLegend('chart-contenedores-pie', 'chart-contenedores-pieLegend', pieManejo, (v) => formatMillion(v, 'Unid.'));
    }

    // ==========================================================================
    // ── VISTA 3: TIPOLOGÍA DE CARGA ───────────────────────────────────────────
    // ==========================================================================
    function renderVistaTipologia() {
        const data = window.PUERTOS_DATA;
        if (!data || !data.annual_aggregates) return;

        const agg = data.annual_aggregates;
        const years = agg.map(d => d.anio.toString());

        // 1. Tipología Embarcada (Apilada)
        const c1 = document.getElementById('chart-tipologia-embarcada');
        if (c1) {
            destroyChart('chart-tipologia-embarcada');
            chartInstances['chart-tipologia-embarcada'] = new Chart(c1.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: years,
                    datasets: [
                        {
                            label: 'Contenedores',
                            data: agg.map(d => roundNumber(d.emb_contenedores / 1e6, 2)),
                            backgroundColor: COLORS.primaryAlpha,
                            borderColor: COLORS.primary,
                            borderWidth: 1,
                            borderRadius: 2
                        },
                        {
                            label: 'Carga Suelta / General',
                            data: agg.map(d => roundNumber(d.emb_suelta / 1e6, 2)),
                            backgroundColor: COLORS.skyAlpha,
                            borderColor: COLORS.sky,
                            borderWidth: 1,
                            borderRadius: 2
                        },
                        {
                            label: 'Granel Sólido',
                            data: agg.map(d => roundNumber(d.emb_granel_solido / 1e6, 2)),
                            backgroundColor: COLORS.amberAlpha,
                            borderColor: COLORS.amber,
                            borderWidth: 1,
                            borderRadius: 2
                        },
                        {
                            label: 'Granel Líquido/Gaseoso',
                            data: agg.map(d => roundNumber(d.emb_granel_liquido / 1e6, 2)),
                            backgroundColor: COLORS.emeraldAlpha,
                            borderColor: COLORS.emerald,
                            borderWidth: 1,
                            borderRadius: 2
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'nearest', intersect: true },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: false,
                            external: puertosExternalTooltip,
                            callbacks: {
                                title: (items) => `Año ${items[0].label}`,
                                label: (ctx) => ` ${ctx.dataset.label}: ${formatNumber(ctx.raw, 2)} MM Ton`
                            }
                        }
                    },
                    scales: {
                        x: {
                            stacked: true,
                            grid: { display: false },
                            ticks: { color: COLORS.textPrimary, font: { size: 10 } }
                        },
                        y: {
                            stacked: true,
                            grid: { color: COLORS.grid },
                            ticks: { color: COLORS.textPrimary, font: { size: 10 } },
                            title: { display: true, text: 'MM Ton Embarcadas', color: COLORS.textPrimary, font: { size: 9.5, weight: '600' } }
                        }
                    }
                }
            });
        }

        // 2. Tipología Desembarcada (Apilada)
        const c2 = document.getElementById('chart-tipologia-desembarcada');
        if (c2) {
            destroyChart('chart-tipologia-desembarcada');
            chartInstances['chart-tipologia-desembarcada'] = new Chart(c2.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: years,
                    datasets: [
                        {
                            label: 'Granel Líquido/Gaseoso',
                            data: agg.map(d => roundNumber(d.des_granel_liquido / 1e6, 2)),
                            backgroundColor: COLORS.emeraldAlpha,
                            borderColor: COLORS.emerald,
                            borderWidth: 1,
                            borderRadius: 2
                        },
                        {
                            label: 'Granel Sólido',
                            data: agg.map(d => roundNumber(d.des_granel_solido / 1e6, 2)),
                            backgroundColor: COLORS.amberAlpha,
                            borderColor: COLORS.amber,
                            borderWidth: 1,
                            borderRadius: 2
                        },
                        {
                            label: 'Contenedores',
                            data: agg.map(d => roundNumber(d.des_contenedores / 1e6, 2)),
                            backgroundColor: COLORS.primaryAlpha,
                            borderColor: COLORS.primary,
                            borderWidth: 1,
                            borderRadius: 2
                        },
                        {
                            label: 'Carga Suelta / General',
                            data: agg.map(d => roundNumber(d.des_suelta / 1e6, 2)),
                            backgroundColor: COLORS.skyAlpha,
                            borderColor: COLORS.sky,
                            borderWidth: 1,
                            borderRadius: 2
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'nearest', intersect: true },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: false,
                            external: puertosExternalTooltip,
                            callbacks: {
                                title: (items) => `Año ${items[0].label}`,
                                label: (ctx) => ` ${ctx.dataset.label}: ${formatNumber(ctx.raw, 2)} MM Ton`
                            }
                        }
                    },
                    scales: {
                        x: {
                            stacked: true,
                            grid: { display: false },
                            ticks: { color: COLORS.textPrimary, font: { size: 10 } }
                        },
                        y: {
                            stacked: true,
                            grid: { color: COLORS.grid },
                            ticks: { color: COLORS.textPrimary, font: { size: 10 } },
                            title: { display: true, text: 'MM Ton Desembarcadas', color: COLORS.textPrimary, font: { size: 9.5, weight: '600' } }
                        }
                    }
                }
            });
        }

        // 3. Doughnut Embarcada
        const totEmbCont = agg.reduce((s, d) => s + d.emb_contenedores, 0);
        const totEmbSuel = agg.reduce((s, d) => s + d.emb_suelta, 0);
        const totEmbSol = agg.reduce((s, d) => s + d.emb_granel_solido, 0);
        const totEmbLiq = agg.reduce((s, d) => s + d.emb_granel_liquido, 0);

        const pieEmb = [
            { label: 'Contenedores', value: totEmbCont, color: COLORS.primary },
            { label: 'Carga Suelta', value: totEmbSuel, color: COLORS.sky },
            { label: 'Granel Sólido', value: totEmbSol, color: COLORS.amber },
            { label: 'Granel Líquido', value: totEmbLiq, color: COLORS.emerald }
        ];
        renderPieWithLegend('chart-pie-embarcada', 'chart-pie-embarcadaLegend', pieEmb);

        // 4. Doughnut Desembarcada
        const totDesLiq = agg.reduce((s, d) => s + d.des_granel_liquido, 0);
        const totDesSol = agg.reduce((s, d) => s + d.des_granel_solido, 0);
        const totDesCont = agg.reduce((s, d) => s + d.des_contenedores, 0);
        const totDesSuel = agg.reduce((s, d) => s + d.des_suelta, 0);

        const pieDesemb = [
            { label: 'Granel Líquido', value: totDesLiq, color: COLORS.emerald },
            { label: 'Granel Sólido', value: totDesSol, color: COLORS.amber },
            { label: 'Contenedores', value: totDesCont, color: COLORS.primary },
            { label: 'Carga Suelta', value: totDesSuel, color: COLORS.sky }
        ];
        renderPieWithLegend('chart-pie-desembarcada', 'chart-pie-desembarcadaLegend', pieDesemb);
    }

    // ==========================================================================
    // ── VISTA 4: CONECTIVIDAD TERRESTRE Y PEAJES ──────────────────────────────
    // ==========================================================================
    function renderVistaTerrestre() {
        const data = window.PUERTOS_DATA;
        if (!data || !data.annual_aggregates) return;

        const agg = data.annual_aggregates;
        const years = agg.map(d => d.anio.toString());

        // 1. Pasadas de Camiones por Peajes
        const c1 = document.getElementById('chart-peajes-evolucion');
        if (c1) {
            destroyChart('chart-peajes-evolucion');
            chartInstances['chart-peajes-evolucion'] = new Chart(c1.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: years,
                    datasets: [
                        {
                            label: 'Camiones 3 y más ejes',
                            data: agg.map(d => roundNumber(d.peaje_camiones_3mas_ejes / 1e6, 2)),
                            backgroundColor: COLORS.primaryAlpha,
                            borderColor: COLORS.primary,
                            borderWidth: 1,
                            borderRadius: 3
                        },
                        {
                            label: 'Camiones 2 ejes',
                            data: agg.map(d => roundNumber(d.peaje_camiones_2ejes / 1e6, 2)),
                            backgroundColor: COLORS.amberAlpha,
                            borderColor: COLORS.amber,
                            borderWidth: 1,
                            borderRadius: 3
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'nearest', intersect: true },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: false,
                            external: puertosExternalTooltip,
                            callbacks: {
                                title: (items) => `Año ${items[0].label}`,
                                label: (ctx) => ` ${ctx.dataset.label}: ${formatNumber(ctx.raw, 2)} MM Pasadas`
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { color: COLORS.textPrimary, font: { size: 10 } }
                        },
                        y: {
                            grid: { color: COLORS.grid },
                            ticks: { color: COLORS.textPrimary, font: { size: 10 } },
                            title: { display: true, text: 'Millones de Pasadas (MM)', color: COLORS.textPrimary, font: { size: 9.5, weight: '600' } }
                        }
                    }
                }
            });
        }

        // 2. Re-estibas vs Transbordos (Toneladas)
        const c2 = document.getElementById('chart-reestibas-transbordos');
        if (c2) {
            destroyChart('chart-reestibas-transbordos');
            chartInstances['chart-reestibas-transbordos'] = new Chart(c2.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: years,
                    datasets: [
                        {
                            label: 'Re-estibas (Ton)',
                            data: agg.map(d => roundNumber(d.reestibas_ton / 1e3, 1)),
                            backgroundColor: COLORS.skyAlpha,
                            borderColor: COLORS.sky,
                            borderWidth: 1,
                            borderRadius: 3
                        },
                        {
                            label: 'Transbordos (Ton)',
                            data: agg.map(d => roundNumber(d.transbordos_ton / 1e3, 1)),
                            backgroundColor: COLORS.purpleAlpha,
                            borderColor: COLORS.purple,
                            borderWidth: 1,
                            borderRadius: 3
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'nearest', intersect: true },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: false,
                            external: puertosExternalTooltip,
                            callbacks: {
                                title: (items) => `Año ${items[0].label}`,
                                label: (ctx) => ` ${ctx.dataset.label}: ${formatNumber(ctx.raw * 1000)} Ton`
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { color: COLORS.textPrimary, font: { size: 10 } }
                        },
                        y: {
                            grid: { color: COLORS.grid },
                            ticks: { color: COLORS.textPrimary, font: { size: 10 } },
                            title: { display: true, text: 'Miles de Toneladas (kTon)', color: COLORS.textPrimary, font: { size: 9.5, weight: '600' } }
                        }
                    }
                }
            });
        }

        // 3. Doughnut Proporción de Flota de Carga
        const k = data.kpis;
        const piePeajes = [
            { label: 'Camiones de 3 y más ejes', value: k.total_peaje_camiones_3mas_ejes, color: COLORS.primary },
            { label: 'Camiones de 2 ejes', value: k.total_peaje_camiones_2ejes, color: COLORS.amber }
        ];
        renderPieWithLegend('chart-peajes-pie', 'chart-peajes-pieLegend', piePeajes, (v) => formatMillion(v, 'Pasadas'));

        // 4. Estacionalidad Mensual de Tránsito Pesado
        const c4 = document.getElementById('chart-peajes-estacionalidad');
        if (c4 && data.monthly_seasonality) {
            destroyChart('chart-peajes-estacionalidad');
            const mLabels = data.monthly_seasonality.map(d => d.mes_nombre);
            const mData = data.monthly_seasonality.map(d => roundNumber(d.avg_peajes / 1e3, 1));

            chartInstances['chart-peajes-estacionalidad'] = new Chart(c4.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: mLabels,
                    datasets: [{
                        label: 'Pasadas Promedio (Miles)',
                        data: mData,
                        backgroundColor: COLORS.emeraldAlpha,
                        borderColor: COLORS.emerald,
                        borderWidth: 1,
                        borderRadius: 3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'nearest', intersect: true },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: false,
                            external: puertosExternalTooltip,
                            callbacks: {
                                title: (items) => `Mes: ${items[0].label}`,
                                label: (ctx) => ` Pasadas Promedio: ${formatNumber(ctx.raw * 1000)}`
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { color: COLORS.textPrimary, font: { size: 10 } }
                        },
                        y: {
                            grid: { color: COLORS.grid },
                            ticks: { color: COLORS.textPrimary, font: { size: 10 } },
                            title: { display: true, text: 'Miles de Pasadas / Mes', color: COLORS.textPrimary, font: { size: 9.5, weight: '600' } }
                        }
                    }
                }
            });
        }
    }

    function roundNumber(num, decimals = 2) {
        return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
    }

    // ==========================================================================
    // ── NAVEGACIÓN Y ALTERNANCIA DE VISTAS (Standard catlec-nueva-visualizacion)
    // ==========================================================================
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

        // 6. Actualizar hash en la URL
        if (window.location.hash !== `#${viewName}`) {
            history.replaceState(null, '', `#${viewName}`);
        }

        // 7. Refrescar iconos Lucide
        if (window.lucide) {
            lucide.createIcons();
        }
    };

    // ── Dropdown de Navegación "Seleccionar Base de Datos" ────────────────────
    function initNavMenu() {
        const navBtn = document.getElementById('nav-menu-btn');
        const navDropdown = document.getElementById('nav-menu-dropdown');
        if (!navBtn || !navDropdown) return;

        navBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = navDropdown.classList.contains('open');
            navDropdown.classList.toggle('open', !isOpen);
            navBtn.setAttribute('aria-expanded', (!isOpen).toString());
        });

        document.addEventListener('click', (e) => {
            if (!navDropdown.contains(e.target) && !navBtn.contains(e.target)) {
                navDropdown.classList.remove('open');
                navBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // ── Exportación a Excel (SheetJS) ─────────────────────────────────────────
    window.exportPuertosExcel = function () {
        if (!window.PUERTOS_DATA || !window.XLSX) {
            alert('Datos no disponibles para exportar.');
            return;
        }
        const wb = XLSX.utils.book_new();
        const s = window.PUERTOS_DATA.series;

        if (s.carga_total) {
            const ws1 = XLSX.utils.json_to_sheet(s.carga_total);
            XLSX.utils.book_append_sheet(wb, ws1, 'Carga Total');
        }
        if (s.teus) {
            const ws2 = XLSX.utils.json_to_sheet(s.teus);
            XLSX.utils.book_append_sheet(wb, ws2, 'TEUS');
        }
        if (s.embarcada) {
            const ws3 = XLSX.utils.json_to_sheet(s.embarcada);
            XLSX.utils.book_append_sheet(wb, ws3, 'Embarcada');
        }
        if (s.desembarcada) {
            const ws4 = XLSX.utils.json_to_sheet(s.desembarcada);
            XLSX.utils.book_append_sheet(wb, ws4, 'Desembarcada');
        }
        if (s.plaza_peaje) {
            const ws5 = XLSX.utils.json_to_sheet(s.plaza_peaje);
            XLSX.utils.book_append_sheet(wb, ws5, 'Plazas de Peaje');
        }

        XLSX.writeFile(wb, 'CATLEC_Puertos_Biobio_Data.xlsx');
    };

    // ── Inicialización al cargar DOM ──────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', () => {
        initNavMenu();
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

        // Comprobar Hash inicial
        const initialHash = window.location.hash.replace('#', '').trim();
        if (['resumen', 'contenedores', 'tipologia', 'terrestre'].includes(initialHash)) {
            window.switchVisualization(initialHash);
        } else {
            window.switchVisualization('resumen');
        }

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

})();
