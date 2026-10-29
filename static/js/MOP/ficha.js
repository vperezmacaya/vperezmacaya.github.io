// ─── static/js/MOP/ficha.js ───────────────────────────────────────────────────
// Ficha del proyecto de la visualización "Tabla de proyectos" (patrón de la
// ficha de DGC): al seleccionar un proyecto (fila o mapa, mopSelectProject en
// main.js) la tabla se reemplaza por su ficha, con navegación Anterior /
// Siguiente por la lista filtrada y "Volver a la Lista".
//
// Datos: MOP_DATA.projects (nombre, servicio, etapa, región, inversión) y
// window.MOP_FICHAS (static/data/mop_fichas.js, generado por
// scripts/export_static_data.py desde las fichas IDI de BIP Consulta):
// { <bip>: { justificacion, descripcion, ficha, etapas: [{etapa, anio, monto}] } }.
// Ese archivo pesa ~2,5 MB, así que se carga recién al abrir la primera ficha.

const MOP_FICHAS_SRC = 'static/data/mop_fichas.js?v=20261029_norate';
const MOP_BIP_CONSULTA_URL = 'https://bip.ministeriodesarrollosocial.gob.cl/bip2-consulta/app/parent-flow';

let mopFichasPromise = null;
// Estado de la vista (no se lee del display: durante la animación de
// CatlecUtils.swapView ambas vistas están visibles)
let mopDetailOpen = false;

// Carga perezosa de window.MOP_FICHAS (una sola vez)
function mopLoadFichas() {
    if (window.MOP_FICHAS) return Promise.resolve(window.MOP_FICHAS);
    if (!mopFichasPromise) {
        mopFichasPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = MOP_FICHAS_SRC;
            script.onload = () => resolve(window.MOP_FICHAS || {});
            script.onerror = () => {
                mopFichasPromise = null;
                reject(new Error('No se pudo cargar ' + MOP_FICHAS_SRC));
            };
            document.head.appendChild(script);
        });
    }
    return mopFichasPromise;
}

function mopDetailViews() {
    return {
        list: document.getElementById('mop-table-container-view'),
        detail: document.getElementById('mop-project-detail-view'),
        body: document.getElementById('mop-detail-view-body'),
    };
}

function mopIsDetailOpen() {
    return mopDetailOpen;
}

// Abre (o actualiza) la ficha del proyecto `bip`
async function mopShowProjectDetail(bip) {
    const { list, detail, body } = mopDetailViews();
    const project = ((window.MOP_DATA && window.MOP_DATA.projects) || []).find(p => p.bip === bip);
    if (!list || !detail || !body || !project) return;

    if (!mopDetailOpen) {
        CatlecUtils.swapView(list, detail, { direction: 'forward' });
        mopDetailOpen = true;
    }
    body.scrollTop = 0;
    mopUpdateDetailNav(bip);

    if (!window.MOP_FICHAS) {
        body.innerHTML = `
            <div class="mop-detail-loading">
                <i data-lucide="loader-2"></i>
                <span>Cargando ficha del proyecto...</span>
            </div>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
    let fichas = {};
    try {
        fichas = await mopLoadFichas();
    } catch (err) {
        console.error('[MOP]', err);
    }
    // Si mientras cargaba se eligió otro proyecto o se cerró la ficha, no pintar este
    if (mopSelectedBip !== bip || !mopIsDetailOpen()) return;
    mopRenderProjectDetail(project, fichas[bip]);
}

// Vuelve a la tabla (lo llama mopSelectProject(null))
function mopHideProjectDetail() {
    const { list, detail } = mopDetailViews();
    if (!list || !detail || !mopDetailOpen) return;
    CatlecUtils.swapView(detail, list, { direction: 'back' });
    mopDetailOpen = false;
}

// Anterior / Siguiente recorren la lista filtrada en el orden de la tabla
function mopUpdateDetailNav(bip) {
    const idx = mopFilteredProjects.findIndex(p => p.bip === bip);
    const prev = document.getElementById('mop-btn-detail-prev');
    const next = document.getElementById('mop-btn-detail-next');
    if (prev) prev.disabled = idx <= 0;
    if (next) next.disabled = idx < 0 || idx >= mopFilteredProjects.length - 1;
}

function mopStepProjectDetail(dir) {
    const idx = mopFilteredProjects.findIndex(p => p.bip === mopSelectedBip);
    const target = mopFilteredProjects[idx + dir];
    if (idx >= 0 && target) mopSelectProject(target.bip, { fromMap: true });
}

// "Ejecución 2026", "Diseño 2016" a partir del nombre del archivo de la ficha ("2026_EJECUCION.pdf")
function mopFichaLabel(ficha, etapas) {
    const year = parseInt(String(ficha || ''), 10);
    const match = (etapas || []).find(e => e.anio === year);
    return match ? `${match.etapa} ${match.anio}` : String(year || '');
}

function mopRenderProjectDetail(p, ficha) {
    const { body } = mopDetailViews();
    if (!body) return;
    const esc = mopEscapeHtml;
    const year = (window.MOP_DATA && window.MOP_DATA.summary && window.MOP_DATA.summary.inversion_year) || '';
    const etapas = (ficha && ficha.etapas) || [];
    const recortado = ficha && [ficha.justificacion, ficha.descripcion].some(t => String(t || '').endsWith('…'));
    const textSection = (title, text) => `
        <div class="detail-section">
            <h4 class="detail-title">${title}</h4>
            <p class="detail-desc mop-detail-desc">${text ? esc(text) : 'La ficha IDI no trae este texto.'}</p>
        </div>`;

    const invSection = ficha
        ? `
        <div class="detail-section">
            <h4 class="detail-title">Costo por etapa</h4>
            <div class="mop-detail-inv-total">
                ${p.inversion != null ? `${mopFmtInversionMM(p.inversion)} MM$` : '—'}
                <small>pesos ${year}${etapas.length > 1 ? ` · suma de ${etapas.length} etapas` : ''}</small>
            </div>
            <div class="mop-detail-etapas">
                ${etapas.map(e => `
                    <span>${esc(e.etapa)} <span class="mop-detail-etapa-anio">· ficha ${e.anio}</span></span>
                    <span class="mop-detail-etapa-monto">${e.monto != null ? `${mopFmtInversionMM(e.monto)} MM$` : '—'}</span>
                `).join('')}
            </div>
            <p class="mop-detail-note">Costo total programado de cada etapa (sección 16 de su ficha IDI más reciente), llevado a pesos de ${year}. En las etapas previas a la ejecución es el costo del estudio o del diseño, no el de la obra.</p>
        </div>`
        : `
        <div class="detail-section">
            <h4 class="detail-title">Ficha IDI</h4>
            <p class="mop-detail-note">Este proyecto no tiene ficha en BIP Consulta, así que no hay costo, justificación ni descripción.</p>
        </div>`;

    body.classList.add('mop-detail-body');
    body.innerHTML = `
        <div class="mop-detail-head">
            <div class="mop-detail-head-row">
                <h3 class="mop-detail-title">${esc(p.nombre) || 'Sin nombre'}</h3>
                <span class="badge badge-info">${esc(p.etapa) || 'Sin etapa'}</span>
            </div>
            <div class="mop-detail-meta">
                <span class="mop-cell-code">${esc(p.bip)}</span> · ${esc(mopShortServicio(p.servicio))} · ${esc(p.region)}
            </div>
        </div>

        ${invSection}

        ${ficha ? textSection('Justificación', ficha.justificacion) : ''}
        ${ficha ? textSection('Descripción', ficha.descripcion) : ''}
        ${recortado ? '<p class="mop-detail-note">Los textos terminados en "…" vienen así en la ficha IDI, que recorta los textos largos.</p>' : ''}

        <div class="detail-section">
            <h4 class="detail-title">Datos del proyecto</h4>
            <div class="detail-grid mop-detail-grid">
                <span class="detail-label">Código BIP:</span>
                <span class="detail-value">${esc(p.bip)}</span>
                <span class="detail-label">Servicio:</span>
                <span class="detail-value">${esc(p.servicio) || '—'}</span>
                <span class="detail-label">Región:</span>
                <span class="detail-value">${esc(p.region) || '—'}</span>
                <span class="detail-label">Etapa (contratos):</span>
                <span class="detail-value">${esc(p.etapa) || '—'}</span>
                <span class="detail-label">Ítem:</span>
                <span class="detail-value">${esc(p.item) || '—'}</span>
                ${ficha && ficha.ficha ? `
                <span class="detail-label">Textos de la ficha:</span>
                <span class="detail-value">${esc(mopFichaLabel(ficha.ficha, etapas))}</span>` : ''}
                <span class="detail-label">Mapa:</span>
                <span class="detail-value">${!mopProjectHasGeo(p.bip) ? 'Sin ubicación en el mapa'
                    : mopProjectGeoIsAerodromo(p.bip) ? 'Ubicación del aeródromo (referencial)' : 'Con ubicación'}</span>
            </div>
        </div>

        <div class="detail-actions">
            <a href="${MOP_BIP_CONSULTA_URL}" target="_blank" rel="noopener noreferrer" class="btn-action-link"
                title="Buscar el código ${esc(p.bip.split('-')[0])} en BIP Consulta">
                <i data-lucide="external-link"></i> BIP Consulta
            </a>
        </div>
    `;
    body.scrollTop = 0;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function mopSetupProjectDetail() {
    const back = document.getElementById('mop-btn-back-to-list');
    const prev = document.getElementById('mop-btn-detail-prev');
    const next = document.getElementById('mop-btn-detail-next');
    if (back) back.addEventListener('click', () => mopSelectProject(null));
    if (prev) prev.addEventListener('click', () => mopStepProjectDetail(-1));
    if (next) next.addEventListener('click', () => mopStepProjectDetail(1));
}
