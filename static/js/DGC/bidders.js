// ── ANÁLISIS DE OFERENTES ─────────────────────────────────────────────────────

function showBiddersView() {
    if (typeof leafletMap !== 'undefined' && leafletMap && leafletMap.getCenter) {
        appState.savedMapCenter = leafletMap.getCenter();
        appState.savedMapZoom = leafletMap.getZoom();
    }
    if (appState.timelineOpen) hideTimelineView();
    if (appState.investmentOpen) hideInvestmentView();

    appState.biddersOpen = true;
    const grid = document.querySelector('.dashboard-grid');
    const centerPanel = document.querySelector('.center-panel');
    const rightPanel = document.querySelector('.right-panel');
    const biddersPanel = document.getElementById('bidders-full-panel');

    if (grid) grid.style.gridTemplateColumns = '240px 1fr';
    if (centerPanel) centerPanel.style.display = 'none';
    if (rightPanel) rightPanel.style.display = 'none';
    if (biddersPanel) biddersPanel.style.display = 'flex';

    if (typeof setActiveSubheaderTab === 'function') setActiveSubheaderTab('bidders');

    const currentList = (currentFilteredContractsList && currentFilteredContractsList.length > 0)
        ? currentFilteredContractsList
        : (window.STATIC_DATA && window.STATIC_DATA.data ? window.STATIC_DATA.data : []);
    renderBiddersAnalytics(currentList);
}

function hideBiddersView() {
    appState.biddersOpen = false;
    const grid = document.querySelector('.dashboard-grid');
    const centerPanel = document.querySelector('.center-panel');
    const rightPanel = document.querySelector('.right-panel');
    const biddersPanel = document.getElementById('bidders-full-panel');

    if (grid) grid.style.gridTemplateColumns = '';
    if (centerPanel) centerPanel.style.display = 'flex';
    if (rightPanel) rightPanel.style.display = 'flex';
    if (biddersPanel) biddersPanel.style.display = 'none';

    if (typeof setActiveSubheaderTab === 'function' && !appState.timelineOpen && !appState.investmentOpen) {
        setActiveSubheaderTab('map');
    }

    if (typeof leafletMap !== 'undefined' && leafletMap) {
        leafletMap.invalidateSize({ animate: false });
        if (appState.savedMapCenter) {
            leafletMap.setView(appState.savedMapCenter, appState.savedMapZoom || 6, { animate: false });
        }
        setTimeout(() => {
            leafletMap.invalidateSize({ animate: false });
            if (appState.savedMapCenter) {
                leafletMap.setView(appState.savedMapCenter, appState.savedMapZoom || 6, { animate: false });
            }
        }, 0);
    }
}

// ── Render Bidders Analytics ──────────────────────────────────────────────────
function renderBiddersAnalytics(contractsList) {
    if (!contractsList) return;

    const isDark = document.body.classList.contains('dark-theme');
    const textColor = isDark ? '#94a3b8' : '#374151';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

    if (typeof Chart !== 'undefined') {
        Chart.defaults.devicePixelRatio = Math.max(2.5, window.devicePixelRatio || 1);
    }

    const parseYear = (dStr) => {
        if (!dStr) return null;
        const m = String(dStr).match(/(\d{4})/);
        return m ? parseInt(m[1], 10) : null;
    };

    // ── Collect data across filtered contracts ────────────────────────────────
    let totalBidders = 0;
    let totalAdjudicados = 0;
    let consorcioCnt = 0;
    let noConsorcioCnt = 0;
    let topBidderName = 'Sin datos';
    let topBidderCount = 0;
    const bidderParticipations = {};

    // 4-year period histogram: periodLabel -> { bidderCount, concessionCount, totalBudget, budgetCount }
    const byPeriod = {};

    const get4YearBin = (year, startYear = 1993, binSize = 4) => {
        if (!year || year < startYear) return null;
        const idx = Math.floor((year - startYear) / binSize);
        const s = startYear + idx * binSize;
        const e = s + binSize - 1;
        return `${s}-${e}`;
    };

    contractsList.forEach(item => {
        const adjYear = parseYear(item['Fecha decreto adjudicación']);
        const bidders = item.bidders || [];
        totalBidders += bidders.length;

        if (adjYear) {
            const pLabel = get4YearBin(adjYear, 1993, 4);
            if (pLabel) {
                if (!byPeriod[pLabel]) {
                    byPeriod[pLabel] = { bidderCount: 0, concessionCount: 0, totalBudget: 0, budgetCount: 0 };
                }
                if (bidders.length > 0) {
                    byPeriod[pLabel].bidderCount += bidders.length;
                    byPeriod[pLabel].concessionCount += 1;
                }

                const rawB = parseFloat(item['Presupuesto oficial estimado'] || item['Inversión Materializada estimada'] || 0) || 0;
                if (rawB > 0) {
                    byPeriod[pLabel].totalBudget += rawB;
                    byPeriod[pLabel].budgetCount += 1;
                }
            }
        }

        bidders.forEach(b => {
            const isAdj = b.adjudicado || (b.adjudicado_raw && b.adjudicado_raw.toUpperCase().startsWith('S'));
            if (isAdj) {
                totalAdjudicados++;
                const isConso = b.consorcio || (b.consorcio_raw && ['SI', 'SÍ', 'YES', 'TRUE', '1', 'X'].includes((b.consorcio_raw || '').toUpperCase()));
                if (isConso) consorcioCnt++;
                else noConsorcioCnt++;
            }
        });
    });

    // Calculate company with highest net awarded concessions
    const netAdjudicatedCompanies = computeTopCompanies(contractsList, 'participaciones');
    const topNetCompany = netAdjudicatedCompanies.length > 0 ? netAdjudicatedCompanies[0] : null;
    const topNetName = topNetCompany ? topNetCompany.name : 'Sin datos';
    const topNetCount = topNetCompany ? topNetCompany.score : 0;

    const avgBiddersPerContract = contractsList.length > 0
        ? (totalBidders / contractsList.length).toFixed(1)
        : '0';

    // ── Update KPI Banner ─────────────────────────────────────────────────────
    const elTopName = document.getElementById('kpi-bidders-top-name');
    const elTopCount = document.getElementById('kpi-bidders-top-count');
    const elTotal = document.getElementById('kpi-bidders-total');
    const elAvg = document.getElementById('kpi-bidders-avg');
    const elBadge = document.getElementById('bidders-panel-badge');

    if (elTopName) elTopName.textContent = topNetName;
    if (elTopCount) elTopCount.textContent = topNetCount > 0 ? `${topNetCount} concesió${topNetCount !== 1 ? 'nes' : 'n'} adjudicada${topNetCount !== 1 ? 's' : ''}` : '—';
    if (elTotal) elTotal.textContent = totalBidders.toLocaleString('es-CL');
    if (elAvg) elAvg.textContent = avgBiddersPerContract;
    if (elBadge) elBadge.textContent = `${contractsList.length} contratos`;

    // ── Chart 1: Histogram — Licitantes Promedio vs Presupuesto Promedio por Período de 4 años ───────
    const sortedPeriods = Object.keys(byPeriod).sort((a, b) => {
        const yA = parseInt(a.split('-')[0], 10);
        const yB = parseInt(b.split('-')[0], 10);
        return yA - yB;
    });
    const histLabels = sortedPeriods;
    const histDataBidders = sortedPeriods.map(p => {
        const d = byPeriod[p];
        return d.concessionCount > 0 ? parseFloat((d.bidderCount / d.concessionCount).toFixed(2)) : 0;
    });
    const histDataBudget = sortedPeriods.map(p => {
        const d = byPeriod[p];
        return d.budgetCount > 0 ? Math.round(d.totalBudget / d.budgetCount) : 0;
    });
    const byPeriodSnapshot = Object.assign({}, byPeriod); // capture for closure

    const budgetLineColor = isDark ? '#e2e8f0' : '#000000';

    const canvasHist = document.getElementById('chartBiddersHistogram');
    if (canvasHist) {
        if (!chartBiddersHistogramInstance) {
            chartBiddersHistogramInstance = new Chart(canvasHist.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: histLabels,
                    datasets: [
                        {
                            type: 'bar',
                            label: 'Promedio Licitantes / Concesión',
                            data: histDataBidders,
                            backgroundColor: 'rgba(99,102,241,0.78)',
                            borderColor: '#6366f1',
                            borderWidth: 1,
                            borderRadius: 3,
                            yAxisID: 'y',
                            order: 2
                        },
                        {
                            type: 'line',
                            label: 'Presupuesto Promedio (UF)',
                            data: histDataBudget,
                            borderColor: budgetLineColor,
                            backgroundColor: 'rgba(0,0,0,0.05)',
                            borderWidth: 2.2,
                            tension: 0,
                            pointRadius: 2.5,
                            pointHoverRadius: 4.5,
                            pointBackgroundColor: budgetLineColor,
                            fill: false,
                            yAxisID: 'y1',
                            order: 1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: false,
                            external: investmentExternalTooltip,
                            callbacks: {
                                title: (items) => `Período ${items[0].label}`,
                                label: (ctx) => {
                                    const p = ctx.label;
                                    const d = byPeriodSnapshot[p];
                                    const avgB = d && d.concessionCount > 0 ? (d.bidderCount / d.concessionCount).toFixed(2) : 0;
                                    const avgBud = d && d.budgetCount > 0 ? Math.round(d.totalBudget / d.budgetCount) : 0;
                                    return [
                                        ` Licitantes promedio: ${avgB} licitantes/concesión`,
                                        ` Presupuesto promedio: ${formatUF(avgBud)} UF`,
                                        ` Concesiones adjudicadas: ${d ? d.concessionCount : 0}`,
                                        ` Total licitantes: ${d ? d.bidderCount : 0}`
                                    ];
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { color: textColor, font: { size: 8.5 } }
                        },
                        y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            grid: { color: gridColor },
                            ticks: { color: textColor, font: { size: 8.5 }, callback: (v) => v.toFixed(1) },
                            title: { display: true, text: 'Promedio licitantes', color: textColor, font: { size: 8 } }
                        },
                        y1: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            grid: { display: false },
                            ticks: {
                                color: budgetLineColor,
                                font: { size: 8 },
                                callback: (v) => formatUF(v)
                            },
                            title: { display: true, text: 'Presupuesto prom. (UF)', color: budgetLineColor, font: { size: 8 } }
                        }
                    }
                }
            });
        } else {
            chartBiddersHistogramInstance.data.labels = histLabels;
            chartBiddersHistogramInstance.data.datasets[0].data = histDataBidders;
            chartBiddersHistogramInstance.data.datasets[1].data = histDataBudget;
            chartBiddersHistogramInstance.data.datasets[1].borderColor = budgetLineColor;
            chartBiddersHistogramInstance.data.datasets[1].pointBackgroundColor = budgetLineColor;
            chartBiddersHistogramInstance.options.scales.x.ticks.color = textColor;
            chartBiddersHistogramInstance.options.scales.y.grid.color = gridColor;
            chartBiddersHistogramInstance.options.scales.y.ticks.color = textColor;
            chartBiddersHistogramInstance.options.scales.y.title.color = textColor;
            if (chartBiddersHistogramInstance.options.scales.y1) {
                chartBiddersHistogramInstance.options.scales.y1.ticks.color = budgetLineColor;
                chartBiddersHistogramInstance.options.scales.y1.title.color = budgetLineColor;
            }
            chartBiddersHistogramInstance.options.plugins.tooltip.callbacks.title = (items) => `Período ${items[0].label}`;
            chartBiddersHistogramInstance.options.plugins.tooltip.callbacks.label = (ctx) => {
                const p = ctx.label;
                const d = byPeriodSnapshot[p];
                const avgB = d && d.concessionCount > 0 ? (d.bidderCount / d.concessionCount).toFixed(2) : 0;
                const avgBud = d && d.budgetCount > 0 ? Math.round(d.totalBudget / d.budgetCount) : 0;
                return [
                    ` Licitantes promedio: ${avgB} licitantes/concesión`,
                    ` Presupuesto promedio: ${formatUF(avgBud)} UF`,
                    ` Concesiones adjudicadas: ${d ? d.concessionCount : 0}`,
                    ` Total licitantes: ${d ? d.bidderCount : 0}`
                ];
            };
            chartBiddersHistogramInstance.update();
        }
    }

    // ── Chart 2: Doughnut — Adjudicados: Consorcio vs Empresa Única ──────────
    const hasAdjData = totalAdjudicados > 0;
    const pieLabels = ['Grupo Licitante/Consorcio', 'Licitante Único'];
    const pieData = [consorcioCnt, noConsorcioCnt];
    const pieColors = ['#8b5cf6', '#10b981'];

    const canvasPie = document.getElementById('chartBiddersPie');
    if (canvasPie) {
        if (!chartBiddersPieInstance) {
            chartBiddersPieInstance = new Chart(canvasPie.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: hasAdjData ? pieLabels : ['Sin datos'],
                    datasets: [{
                        data: hasAdjData ? pieData : [1],
                        backgroundColor: hasAdjData ? pieColors : ['rgba(148,163,184,0.2)'],
                        borderColor: isDark ? '#0f172a' : '#ffffff',
                        borderWidth: 2,
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '62%',
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: false,
                            external: investmentExternalTooltip,
                            callbacks: {
                                label: (ctx) => {
                                    if (!hasAdjData) return ' Sin datos';
                                    const pct = ((ctx.raw / (totalAdjudicados || 1)) * 100).toFixed(1);
                                    return ` ${ctx.label}: ${ctx.raw} (${pct}%)`;
                                }
                            }
                        }
                    }
                }
            });
        } else {
            chartBiddersPieInstance.data.labels = hasAdjData ? pieLabels : ['Sin datos'];
            chartBiddersPieInstance.data.datasets[0].data = hasAdjData ? pieData : [1];
            chartBiddersPieInstance.data.datasets[0].backgroundColor = hasAdjData ? pieColors : ['rgba(148,163,184,0.2)'];
            chartBiddersPieInstance.data.datasets[0].borderColor = isDark ? '#0f172a' : '#ffffff';
            chartBiddersPieInstance.options.plugins.tooltip.callbacks.label = (ctx) => {
                if (!hasAdjData) return ' Sin datos';
                const pct = ((ctx.raw / (totalAdjudicados || 1)) * 100).toFixed(1);
                return ` ${ctx.label}: ${ctx.raw} (${pct}%)`;
            };
            chartBiddersPieInstance.update();
        }

        // Custom HTML Legend for pie
        const pieLegendEl = document.getElementById('chartBiddersPieLegend');
        if (pieLegendEl) {
            pieLegendEl.innerHTML = '';
            if (hasAdjData) {
                pieLabels.forEach((lbl, i) => {
                    const val = pieData[i];
                    const pct = ((val / (totalAdjudicados || 1)) * 100).toFixed(1);
                    const col = pieColors[i];
                    const itemDiv = document.createElement('div');
                    itemDiv.style.cssText = 'display:flex; align-items:center; gap:0.35rem; font-size:0.65rem; padding:0.05rem 0;';
                    itemDiv.innerHTML = `
                        <span style="width:8px; height:8px; border-radius:50%; background-color:${col}; flex-shrink:0;"></span>
                        <span style="color:var(--text-secondary); flex:1;">${lbl}</span>
                        <span style="font-weight:700; color:var(--text-primary);">${val} <span style="font-weight:400; color:var(--text-muted);">(${pct}%)</span></span>
                    `;
                    pieLegendEl.appendChild(itemDiv);
                });
                const totalDiv = document.createElement('div');
                totalDiv.style.cssText = 'display:flex; align-items:center; justify-content:space-between; font-size:0.62rem; padding-top:0.15rem; margin-top:0.1rem; border-top:1px solid var(--border-color);';
                totalDiv.innerHTML = `<span style="color:var(--text-muted);">Total adjudicados:</span><span style="font-weight:700; color:var(--text-primary);">${totalAdjudicados}</span>`;
                pieLegendEl.appendChild(totalDiv);
            } else {
                pieLegendEl.innerHTML = `<p style="font-size:0.65rem; color:var(--text-muted); font-style:italic; text-align:center; margin:0;">Sin datos de adjudicaciones</p>`;
            }
        }
    }

    // ── Chart 3: Horizontal Bar — Top 10 Empresas (Participaciones vs Adjudicaciones Ponderadas) ──────────
    const mode = appState.topCompaniesMode || 'participaciones';
    const isParticipaciones = (mode === 'participaciones');

    const companyScores = computeTopCompanies(contractsList, mode);
    const top10 = companyScores.slice(0, 10);
    // Reverse for Chart.js (renders bottom-to-top, we want highest at top)
    const top10rev = [...top10].reverse();
    const barLabels = top10rev.map(c => wrapTextToLines(c.name, 20));
    const barData = top10rev.map(c => parseFloat(c.score.toFixed(isParticipaciones ? 0 : 2)));

    // Palette: Amber / Orange for both views
    const baseColor = '245,158,11';
    const borderCol = 'rgba(245,158,11,0.9)';
    const barColors = top10rev.map((_, i) => {
        const alpha = 0.45 + (i / Math.max(top10rev.length - 1, 1)) * 0.45;
        return `rgba(${baseColor},${alpha.toFixed(2)})`;
    });

    // Update Header UI elements
    const titleEl = document.getElementById('chart-top-companies-title');
    const btnTextEl = document.getElementById('btn-top-companies-text');
    const btnToggleEl = document.getElementById('btn-toggle-top-companies');
    const iconHeaderEl = document.getElementById('icon-top-companies-header');

    if (titleEl) {
        titleEl.textContent = isParticipaciones
            ? '10 Empresas con mayor cantidad de adjudicaciones'
            : '10 Empresas con mayor cantidad de adj. (ajustado por % de participación)';
    }
    if (btnTextEl) {
        btnTextEl.textContent = isParticipaciones
            ? 'Ver Adj. Ponderadas'
            : 'Ver Adj. Netas';
    }
    if (btnToggleEl) {
        btnToggleEl.style.background = 'rgba(245, 158, 11, 0.12)';
        btnToggleEl.style.borderColor = 'rgba(245, 158, 11, 0.3)';
        btnToggleEl.style.color = '#f59e0b';
    }
    if (iconHeaderEl) {
        iconHeaderEl.style.color = '#f59e0b';
    }

    const canvasBar = document.getElementById('chartTopCompanies');
    if (canvasBar) {
        const totalSum = companyScores.reduce((s, c) => s + c.score, 0);
        const xTitle = isParticipaciones ? 'Adj. netas' : 'Adj. ponderadas';

        if (!chartTopCompaniesInstance) {
            chartTopCompaniesInstance = new Chart(canvasBar.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: barLabels,
                    datasets: [{
                        label: isParticipaciones ? 'Concesiones adjudicadas' : 'Adjudicaciones (ponderadas)',
                        data: barData,
                        backgroundColor: barColors,
                        borderColor: borderCol,
                        borderWidth: 1,
                        borderRadius: 2,
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: false,
                            external: investmentExternalTooltip,
                            callbacks: {
                                title: (items) => {
                                    const entry = top10rev[items[0].dataIndex];
                                    return entry ? entry.name : items[0].label;
                                },
                                label: (ctx) => {
                                    const entry = top10rev[ctx.dataIndex];
                                    const pct = totalSum > 0 ? ((entry.score / totalSum) * 100).toFixed(1) : '0';
                                    return [
                                        ` ${isParticipaciones ? 'Concesiones adjudicadas' : 'Adjudicaciones (ponderadas)'}: ${ctx.raw}`,
                                        ` Participación: ${pct}% del total`
                                    ];
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { color: gridColor },
                            ticks: {
                                color: textColor,
                                font: { size: 8 },
                                callback: (v) => isParticipaciones ? (v % 1 === 0 ? v : '') : (v % 1 === 0 ? v : v.toFixed(1))
                            },
                            title: { display: true, text: xTitle, color: textColor, font: { size: 7.5 } }
                        },
                        y: {
                            grid: { display: false },
                            ticks: {
                                color: textColor,
                                font: { size: 7.2 },
                                autoSkip: false,
                                callback: function (val, idx) {
                                    const entry = top10rev[idx];
                                    if (!entry) return this.getLabelForValue(val);
                                    return wrapTextToLines(entry.name, 20);
                                }
                            }
                        }
                    }
                }
            });
        } else {
            chartTopCompaniesInstance.data.labels = barLabels;
            chartTopCompaniesInstance.data.datasets[0].label = isParticipaciones ? 'Concesiones adjudicadas' : 'Adjudicaciones (ponderadas)';
            chartTopCompaniesInstance.data.datasets[0].data = barData;
            chartTopCompaniesInstance.data.datasets[0].backgroundColor = barColors;
            chartTopCompaniesInstance.data.datasets[0].borderColor = borderCol;
            chartTopCompaniesInstance.options.scales.x.grid.color = gridColor;
            chartTopCompaniesInstance.options.scales.x.ticks.color = textColor;
            chartTopCompaniesInstance.options.scales.x.title.text = xTitle;
            chartTopCompaniesInstance.options.scales.x/*  */.title.color = textColor;
            chartTopCompaniesInstance.options.scales.x.ticks.callback = (v) => isParticipaciones ? (v % 1 === 0 ? v : '') : (v % 1 === 0 ? v : v.toFixed(1));

            chartTopCompaniesInstance.options.scales.y.ticks.color = textColor;
            chartTopCompaniesInstance.options.scales.y.ticks.callback = function (val, idx) {
                const entry = top10rev[idx];
                if (!entry) return this.getLabelForValue(val);
                return wrapTextToLines(entry.name, 20);
            };

            chartTopCompaniesInstance.options.plugins.tooltip.callbacks.title = (items) => {
                const entry = top10rev[items[0].dataIndex];
                return entry ? entry.name : items[0].label;
            };
            chartTopCompaniesInstance.options.plugins.tooltip.callbacks.label = (ctx) => {
                const entry = top10rev[ctx.dataIndex];
                const pct = totalSum > 0 ? ((entry.score / totalSum) * 100).toFixed(1) : '0';
                return [
                    ` ${isParticipaciones ? 'Concesiones adjudicadas' : 'Adjudicaciones (ponderadas)'}: ${ctx.raw}`,
                    ` Participación: ${pct}% del total`
                ];
            };
            chartTopCompaniesInstance.update();
        }
    }

    lucide.createIcons();
}

// ── Helper: wrap text into multi-line arrays for Chart.js Y-axis ticks (max 2 line breaks / 3 lines) ──────
function wrapTextToLines(str, maxLen = 20, maxLines = 3) {
    if (!str || str.length <= maxLen) return str;
    const words = str.split(' ');
    if (words.length <= 1) return str.length > maxLen ? str.substring(0, maxLen - 1) + '…' : str;

    const lines = [];
    let cur = '';

    for (let i = 0; i < words.length; i++) {
        const w = words[i];
        if (lines.length === maxLines - 1) {
            // Last allowed line: append remaining text and truncate with ellipsis if exceeds maxLen
            const remaining = words.slice(i).join(' ');
            let candidate = cur ? cur + ' ' + remaining : remaining;
            if (candidate.length > maxLen) {
                candidate = candidate.substring(0, maxLen - 1).trimEnd() + '…';
            }
            lines.push(candidate);
            cur = '';
            break;
        }

        if ((cur ? cur + ' ' + w : w).length <= maxLen) {
            cur = cur ? cur + ' ' + w : w;
        } else {
            if (cur) lines.push(cur);
            cur = w;
        }
    }
    if (cur && lines.length < maxLines) {
        lines.push(cur);
    }

    return lines.length > 1 ? lines : str;
}

// ── Helper: compute weighted company scores (adjudicaciones o participaciones) ─────────────────────
function computeTopCompanies(contractsList, mode = 'adjudicaciones') {
    const scores = {}; // companyName -> score

    if (mode === 'participaciones') {
        contractsList.forEach(item => {
            const bidders = item.bidders || [];
            const projectCompanies = new Set();

            bidders.forEach(b => {
                // Solo considerar si fue adjudicado
                const isAdj = b.adjudicado || (b.adjudicado_raw && b.adjudicado_raw.trim().toUpperCase().startsWith('S'));
                if (!isAdj) return;

                const isConsorcio = b.consorcio || (b.consorcio_raw && ['SI', 'SÍ', 'YES', 'TRUE', '1', 'X'].includes((b.consorcio_raw || '').trim().toUpperCase()));

                if (!isConsorcio) {
                    const nm = (b.name || '').trim();
                    if (nm) projectCompanies.add(nm);
                } else {
                    const empresasStr = (b.empresas || '').trim();
                    if (empresasStr) {
                        const companies = empresasStr.split(';').map(s => s.replace(/\n/g, ' ').trim()).filter(Boolean);
                        if (companies.length > 0) {
                            companies.forEach(nm => projectCompanies.add(nm));
                        } else {
                            const nm = (b.name || '').trim();
                            if (nm) projectCompanies.add(nm);
                        }
                    } else {
                        const nm = (b.name || '').trim();
                        if (nm) projectCompanies.add(nm);
                    }
                }
            });

            projectCompanies.forEach(nm => {
                scores[nm] = (scores[nm] || 0) + 1;
            });
        });
    } else {
        // mode === 'adjudicaciones'
        contractsList.forEach(item => {
            const bidders = item.bidders || [];
            bidders.forEach(b => {
                const isAdj = b.adjudicado || (b.adjudicado_raw && b.adjudicado_raw.trim().toUpperCase().startsWith('S'));
                if (!isAdj) return;

                const isConsorcio = b.consorcio || (b.consorcio_raw && ['SI', 'SÍ', 'YES', 'TRUE', '1', 'X'].includes((b.consorcio_raw || '').trim().toUpperCase()));

                if (!isConsorcio) {
                    const nm = (b.name || '').trim();
                    if (nm) scores[nm] = (scores[nm] || 0) + 1;
                    return;
                }

                const empresasStr = (b.empresas || '').trim();
                const pctStr = (b.pct || '').trim();

                if (!empresasStr) {
                    const nm = (b.name || '').trim();
                    if (nm) scores[nm] = (scores[nm] || 0) + 1;
                    return;
                }

                const companies = empresasStr.split(';').map(s => s.replace(/\n/g, ' ').trim()).filter(Boolean);
                if (companies.length === 0) {
                    const nm = (b.name || '').trim();
                    if (nm) scores[nm] = (scores[nm] || 0) + 1;
                    return;
                }

                let weights = [];
                if (pctStr) {
                    weights = pctStr.split(';').map(s => {
                        const cleaned = s.trim().replace(',', '.');
                        const v = parseFloat(cleaned);
                        return isNaN(v) ? null : v;
                    });
                }

                const validWeights = weights.filter(w => w !== null && !isNaN(w));
                if (validWeights.length !== companies.length) {
                    const share = 1 / companies.length;
                    companies.forEach(nm => {
                        if (nm) scores[nm] = (scores[nm] || 0) + share;
                    });
                } else {
                    const totalPct = validWeights.reduce((s, w) => s + w, 0);
                    companies.forEach((nm, i) => {
                        const share = totalPct > 0 ? (validWeights[i] / totalPct) : (1 / companies.length);
                        if (nm) scores[nm] = (scores[nm] || 0) + share;
                    });
                }
            });
        });
    }

    return Object.entries(scores)
        .map(([name, score]) => ({ name, score }))
        .sort((a, b) => b.score - a.score);
}

function initBiddersEvents() {
    const btnClose = document.getElementById('btn-close-bidders');
    if (btnClose) {
        btnClose.addEventListener('click', () => hideBiddersView());
    }

    const btnToggleTop = document.getElementById('btn-toggle-top-companies');
    if (btnToggleTop) {
        btnToggleTop.addEventListener('click', () => {
            appState.topCompaniesMode = (appState.topCompaniesMode === 'participaciones') ? 'adjudicaciones' : 'participaciones';
            const currentList = (currentFilteredContractsList && currentFilteredContractsList.length > 0)
                ? currentFilteredContractsList
                : (window.STATIC_DATA && window.STATIC_DATA.data ? window.STATIC_DATA.data : []);
            renderBiddersAnalytics(currentList);
        });
    }
}
