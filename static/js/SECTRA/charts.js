// ─── Visualizaciones & Gráficos SECTRA (Chart.js) ───────────────────────────

function shortenRegionLabel(name) {
    if (!name) return 'Otras';
    let str = String(name).trim();
    str = str.replace(/^Región\s+(de\s+la\s+|del\s+|de\s+)?/i, '');
    if (/metropolitana/i.test(str)) return 'RM';
    if (/libertador|bernardo|o'higgins/i.test(str)) return "O'Higgins";
    if (/magallanes/i.test(str)) return 'Magallanes';
    if (/ays[eé]n/i.test(str)) return 'Aysén';
    if (/arica/i.test(str)) return 'Arica';
    if (/biob[ií]o/i.test(str)) return 'Biobío';
    if (/valpara[ií]so/i.test(str)) return 'Valparaíso';
    if (/antofagasta/i.test(str)) return 'Antofagasta';
    if (/coquimbo/i.test(str)) return 'Coquimbo';
    if (/atacama/i.test(str)) return 'Atacama';
    if (/maule/i.test(str)) return 'Maule';
    if (/ñuble|nuble/i.test(str)) return 'Ñuble';
    if (/araucan[ií]a/i.test(str)) return 'Araucanía';
    if (/r[ií]os/i.test(str)) return 'Los Ríos';
    if (/lagos/i.test(str)) return 'Los Lagos';
    if (/tarapac[aá]/i.test(str)) return 'Tarapacá';
    return str;
}

function initSectraCharts() {
    updateQuickPieCharts();
}

function updateQuickPieCharts() {
    const projs = getFilteredProjects();
    
    // 1. Agrupar Inversión por Región (UF)
    const invByRegion = {};
    const countByRegion = {};
    
    projs.forEach(p => {
        const reg = shortenRegionLabel(p.region);
        const inv = Number(p.investment) || 0;
        
        invByRegion[reg] = (invByRegion[reg] || 0) + inv;
        countByRegion[reg] = (countByRegion[reg] || 0) + 1;
    });
    
    // Ordenar de mayor a menor
    const sortedInv = Object.entries(invByRegion).sort((a, b) => b[1] - a[1]);
    const sortedCount = Object.entries(countByRegion).sort((a, b) => b[1] - a[1]);
    
    // ─── Render Chart 1: Inversión por Región ───
    renderRegionInvPieChart(sortedInv);
    
    // ─── Render Chart 2: Proyectos por Región ───
    renderRegionCountPieChart(sortedCount);
}

function renderRegionInvPieChart(sortedInv) {
    const canvas = document.getElementById('regionInvChart');
    const legendEl = document.getElementById('regionInvChartLegend');
    if (!canvas) return;
    
    // Top 5 + Otros para limpieza visual
    const topInv = sortedInv.slice(0, 5);
    const othersInvVal = sortedInv.slice(5).reduce((acc, curr) => acc + curr[1], 0);
    if (othersInvVal > 0) {
        topInv.push(['Otras', othersInvVal]);
    }
    
    const labels = topInv.map(d => d[0]);
    const dataVals = topInv.map(d => d[1]);
    const colors = labels.map((_, i) => regionPalette[i % regionPalette.length]);
    
    if (regionInvChartInstance) {
        regionInvChartInstance.data.labels = labels;
        regionInvChartInstance.data.datasets[0].data = dataVals;
        regionInvChartInstance.data.datasets[0].backgroundColor = colors;
        regionInvChartInstance.update();
    } else {
        regionInvChartInstance = new Chart(canvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: dataVals,
                    backgroundColor: colors,
                    borderColor: '#0f1626',
                    borderWidth: 2,
                    hoverOffset: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '68%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ` ${ctx.label}: ${Number(ctx.raw).toLocaleString('es-CL')} UF`
                        }
                    }
                }
            }
        });
    }
    
    // Render custom HTML legend
    if (legendEl) {
        legendEl.innerHTML = '';
        topInv.forEach((item, i) => {
            const label = item[0];
            const val = item[1];
            const color = colors[i];
            const itemEl = document.createElement('div');
            itemEl.style.cssText = 'display: flex; align-items: center; justify-content: space-between; font-size: 0.66rem; color: var(--text-primary); cursor: pointer; gap: 0.2rem; padding: 0.05rem 0.1rem; border-radius: 3px; line-height: 1.15;';
            
            // Format short UF (e.g. 1.2M UF)
            let shortUF = `${(val / 1e6).toFixed(1)}M`;
            if (val < 1e6) shortUF = `${(val / 1e3).toFixed(0)}K`;
            if (val === 0) shortUF = '0';
            
            itemEl.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.3rem; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    <span style="width: 7px; height: 7px; border-radius: 50%; background-color: ${color}; flex-shrink: 0;"></span>
                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.66rem;">${label}</span>
                </div>
                <span style="font-weight: 700; color: var(--text-secondary); flex-shrink: 0; font-size: 0.66rem;">${shortUF}</span>
            `;
            legendEl.appendChild(itemEl);
        });
    }
}

function renderRegionCountPieChart(sortedCount) {
    const canvas = document.getElementById('regionCountChart');
    const legendEl = document.getElementById('regionCountChartLegend');
    if (!canvas) return;
    
    const topCount = sortedCount.slice(0, 5);
    const othersCountVal = sortedCount.slice(5).reduce((acc, curr) => acc + curr[1], 0);
    if (othersCountVal > 0) {
        topCount.push(['Otras', othersCountVal]);
    }
    
    const labels = topCount.map(d => d[0]);
    const dataVals = topCount.map(d => d[1]);
    const colors = labels.map((_, i) => regionPalette[(i + 3) % regionPalette.length]);
    
    if (regionCountChartInstance) {
        regionCountChartInstance.data.labels = labels;
        regionCountChartInstance.data.datasets[0].data = dataVals;
        regionCountChartInstance.data.datasets[0].backgroundColor = colors;
        regionCountChartInstance.update();
    } else {
        regionCountChartInstance = new Chart(canvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: dataVals,
                    backgroundColor: colors,
                    borderColor: '#0f1626',
                    borderWidth: 2,
                    hoverOffset: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '68%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ` ${ctx.label}: ${ctx.raw} proyectos`
                        }
                    }
                }
            }
        });
    }
    
    // Render custom HTML legend
    if (legendEl) {
        legendEl.innerHTML = '';
        topCount.forEach((item, i) => {
            const label = item[0];
            const count = item[1];
            const color = colors[i];
            const itemEl = document.createElement('div');
            itemEl.style.cssText = 'display: flex; align-items: center; justify-content: space-between; font-size: 0.66rem; color: var(--text-primary); cursor: pointer; gap: 0.2rem; padding: 0.05rem 0.1rem; border-radius: 3px; line-height: 1.15;';
            itemEl.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.3rem; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    <span style="width: 7px; height: 7px; border-radius: 50%; background-color: ${color}; flex-shrink: 0;"></span>
                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.66rem;">${label}</span>
                </div>
                <span style="font-weight: 700; color: var(--text-secondary); flex-shrink: 0; font-size: 0.66rem;">${count}</span>
            `;
            legendEl.appendChild(itemEl);
        });
    }
}

function renderFullAnalyticsCharts() {
    const projs = getFilteredProjects();
    const regionCanvas = document.getElementById('chart-sectra-region-full');
    const statusCanvas = document.getElementById('chart-sectra-status-full');
    
    if (!regionCanvas || !statusCanvas) return;
    
    // Inversión por Región
    const invByReg = {};
    projs.forEach(p => {
        const reg = shortenRegionLabel(p.region);
        invByReg[reg] = (invByReg[reg] || 0) + (Number(p.investment) || 0);
    });
    const sortedReg = Object.entries(invByReg).sort((a, b) => b[1] - a[1]);
    
    if (fullRegionChartInstance) fullRegionChartInstance.destroy();
    fullRegionChartInstance = new Chart(regionCanvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: sortedReg.map(r => r[0]),
            datasets: [{
                label: 'Inversión (UF)',
                data: sortedReg.map(r => r[1]),
                backgroundColor: '#0ea5e9',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => ` ${Number(ctx.raw).toLocaleString('es-CL')} UF`
                    }
                }
            },
            scales: {
                x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { display: false } },
                y: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.06)' } }
            }
        }
    });
    
    // Distribución por Estado
    const statusCount = {};
    projs.forEach(p => {
        const stat = p.status || 'No informado';
        statusCount[stat] = (statusCount[stat] || 0) + 1;
    });
    const sortedStat = Object.entries(statusCount).sort((a, b) => b[1] - a[1]);
    
    if (fullStatusChartInstance) fullStatusChartInstance.destroy();
    fullStatusChartInstance = new Chart(statusCanvas.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: sortedStat.map(s => s[0]),
            datasets: [{
                data: sortedStat.map(s => s[1]),
                backgroundColor: ['#10b981', '#6366f1', '#0ea5e9', '#f59e0b', '#ec4899', '#8b5cf6'],
                borderColor: '#0f1626',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: { position: 'right', labels: { color: '#94a3b8', font: { size: 10 }, boxWidth: 10 } }
            }
        }
    });
}
