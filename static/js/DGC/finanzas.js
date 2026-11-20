// ─── static/js/DGC/finanzas.js ────────────────────────────────────────────────
// Sección "Estados financieros (CMF)" de la ficha de concesión (project-detail.js).
// Datos: static/data/dgc_cmf.js (window.DGC_CMF), que escribe scripts/etl/dgc_cmf.py desde
// los XBRL anuales que cada sociedad concesionaria presenta a la CMF. Se cruza por el RUT
// de la sociedad que trae contracts_data.js.

const dgcFinTooltip = CatlecTooltip.create({ domId: 'dgc-fin-tooltip' });
let dgcFinChartInstance = null;

const DGC_FIN_FILAS = [
    { key: 'ingresos', label: 'Ingresos ordinarios' },
    { key: 'resultado_operacional', label: 'Resultado operacional' },
    { key: 'utilidad', label: 'Utilidad (pérdida)' },
    { key: 'deuda_financiera', label: 'Deuda financiera' },
    { key: 'patrimonio', label: 'Patrimonio' },
];

const DGC_FIN_SERIES = [
    { key: 'ingresos', label: 'Ingresos', color: '#0284c7', fill: 'rgba(2, 132, 199, 0.8)' },
    { key: 'utilidad', label: 'Utilidad', color: '#6366f1', fill: 'rgba(99, 102, 241, 0.8)' },
];

// '78.159.936-0' → '78159936' (mismo criterio que rut_cuerpo de dgc_cmf.py)
function dgcFinRutCuerpo(rut) {
    const s = String(rut || '').trim();
    const m = s.match(/^([\d.\s]+)\s*-\s*[\dkK]$/) || s.match(/^(\d{7,8})$/);
    if (!m) return null;
    const cuerpo = m[1].replace(/\D/g, '');
    return cuerpo.length >= 6 && cuerpo.length <= 8 ? cuerpo : null;
}

function dgcFinFormat(v) {
    if (v == null || isNaN(v)) return '–';
    return Math.round(v).toLocaleString('es-CL');
}

function dgcFinNotice(icon, text) {
    return `
        <div class="dgc-detail-notice dgc-detail-notice--empty">
            <i data-lucide="${icon}"></i>
            <span>${text}</span>
        </div>`;
}

// Sociedad de DGC_CMF de un contrato, o null.
function dgcFinSociedad(item) {
    const data = window.DGC_CMF;
    const cuerpo = item && dgcFinRutCuerpo(item['Rut sociedad Concesionaria']);
    return (data && cuerpo && data.sociedades[cuerpo]) || null;
}

// Años a mostrar: del primero con datos al último año cerrado.
function dgcFinAnios(soc) {
    const data = window.DGC_CMF;
    const conDato = Object.keys(soc.anios).map(Number);
    if (!conDato.length) return [];
    const out = [];
    for (let a = Math.min(...conDato); a <= data.anio_fin; a++) out.push(a);
    return out;
}

function dgcFinanzasHTML(item, status) {
    const data = window.DGC_CMF;
    const title = `
        <h4 class="detail-title dgc-bidders-title">
            <span><i data-lucide="landmark" class="icon-14 icon-color-primary"></i>Estados financieros (CMF)</span>
        </h4>`;
    if (!data) return '';

    const rut = item && item['Rut sociedad Concesionaria'];
    const cuerpo = dgcFinRutCuerpo(rut);
    const soc = dgcFinSociedad(item);
    const rango = `${data.anio_ini}–${data.anio_fin}`;
    let body;

    if (!cuerpo) {
        body = getStatusKey(status) === 'licitacion'
            ? dgcFinNotice('hourglass', 'Concesión en licitación: aún no hay sociedad concesionaria con estados financieros.')
            : dgcFinNotice('info', 'La base de datos no registra el RUT de la sociedad concesionaria de este contrato, así que no se pueden buscar sus estados financieros en la CMF.');
    } else if (!soc) {
        body = dgcFinNotice('info', `La sociedad concesionaria (RUT ${rut}) no figura en los registros de la CMF.`);
    } else if (!Object.keys(soc.anios).length) {
        body = dgcFinNotice('info', `La sociedad figura en la CMF (${soc.registro}${soc.vigente ? '' : ', inscripción cancelada'}), pero no tiene estados financieros anuales en formato XBRL entre ${rango}. <a href="${soc.url}" target="_blank" rel="noopener noreferrer">Ver en la CMF</a>.`);
    } else {
        const anios = dgcFinAnios(soc);
        const head = anios.map(a => `<th>${a}</th>`).join('');
        const rows = DGC_FIN_FILAS.map(f => {
            const cells = anios.map(a => {
                const v = soc.anios[a] ? soc.anios[a][f.key] : null;
                return `<td class="${v != null && v < 0 ? 'dgc-fin-neg' : ''}">${dgcFinFormat(v)}</td>`;
            }).join('');
            return `<tr><th scope="row">${f.label}</th>${cells}</tr>`;
        }).join('');
        const moneda = soc.moneda && soc.moneda !== 'CLP' ? `millones de ${soc.moneda}` : 'millones de pesos';
        const legend = DGC_FIN_SERIES.map(s => `
            <span class="dgc-fin-legend-item" style="color: ${s.color};">
                <span class="dgc-fin-legend-swatch" style="background: ${s.color};"></span>${s.label}
            </span>`).join('');
        const auditor = soc.auditor
            ? `Auditor ${soc.anio_auditoria}: ${soc.auditor}${soc.opinion ? ` (opinión ${soc.opinion.toLowerCase()})` : ''}.`
            : '';
        body = `
            <div class="dgc-fin-chart-head">
                <span class="dgc-section-caption">Ingresos y utilidad (${moneda})</span>
                <div class="dgc-fin-legend">${legend}</div>
            </div>
            <div class="dgc-fin-chart"><canvas id="dgc-fin-chart"></canvas></div>
            <div class="dgc-fin-table-wrap">
                <table class="dgc-fin-table">
                    <thead><tr><th scope="col">MM$ al 31-dic</th>${head}</tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            <p class="dgc-fin-meta">
                ${soc.nombre} · RUT ${soc.rut} · ${soc.registro}${soc.vigente ? '' : ' (inscripción cancelada)'}. ${auditor}
                <a href="${soc.url}" target="_blank" rel="noopener noreferrer">Ver en la CMF</a>
            </p>
            <p class="dgc-fin-note">
                Cifras nominales de los estados financieros anuales presentados a la CMF. Los ingresos son contables:
                según el contrato, parte de lo que paga el Estado (subsidios, ingresos mínimos garantizados) se registra
                como cuenta por cobrar y no como ingreso. Deuda financiera: otros pasivos financieros corrientes y no corrientes.
            </p>`;
    }
    return `<div class="detail-section dgc-fin">${title}${body}</div>`;
}

// Dibuja el gráfico después de insertar el HTML de dgcFinanzasHTML en la ficha.
function dgcFinanzasSetup(item) {
    if (dgcFinChartInstance) {
        dgcFinChartInstance.destroy();   // el canvas anterior ya no existe: la ficha se redibujó
        dgcFinChartInstance = null;
    }
    // Si los años no caben, la tabla parte mostrando los más recientes (se desliza hacia los anteriores).
    const wrap = document.querySelector('.dgc-fin-table-wrap');
    if (wrap) wrap.scrollLeft = wrap.scrollWidth;

    const canvas = document.getElementById('dgc-fin-chart');
    const soc = dgcFinSociedad(item);
    if (!canvas || !soc || typeof Chart === 'undefined') return;

    const anios = dgcFinAnios(soc);
    const textColor = '#334155';
    const gridColor = '#e2e8f0';
    dgcFinChartInstance = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: anios.map(String),
            datasets: DGC_FIN_SERIES.map(s => ({
                label: s.label,
                data: anios.map(a => (soc.anios[a] ? soc.anios[a][s.key] : null)),
                backgroundColor: s.fill,
                borderColor: s.color,
                borderWidth: 1,
                borderRadius: 3,
                maxBarThickness: 22,
            })),
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            devicePixelRatio: Math.max(2.5, window.devicePixelRatio || 1),
            animation: { duration: 450, easing: 'easeOutQuart' },
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: false,
                    external: dgcFinTooltip,
                    callbacks: {
                        title: (items) => `Año ${items[0].label}`,
                        label: (ctx) => ` ${ctx.dataset.label}: ${ctx.raw == null ? 'sin dato' : dgcFinFormat(ctx.raw) + ' MM$'}`,
                    },
                },
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: textColor, font: { size: 10 } } },
                y: {
                    grid: { color: gridColor },
                    ticks: { color: textColor, font: { size: 9.5 }, maxTicksLimit: 5, callback: (v) => dgcFinFormat(v) },
                },
            },
        },
    });
}
