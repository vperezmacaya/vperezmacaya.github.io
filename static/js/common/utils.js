// ─── static/js/common/utils.js ────────────────────────────────────────────────
// Funciones puras (sin dependencias de estado) compartidas por los módulos
// CATLEC. Reemplaza ~8 utilidades que existían duplicadas con nombres
// distintos (normalizeAccents, debounce, dateToYear, wrapText, wrapTextToLines,
// getLineMidpoint, horizontalBarDataLabelsPlugin, downloadGeoJSON) en DGC, EFE,
// Metro, MOP, SNI y SECTRA.
window.CatlecUtils = {
    // Quita tildes/diacríticos y pasa a minúsculas, para comparar texto de forma
    // tolerante a acentos (ej. "Bío-Bío" ~ "bio-bio").
    normalizeAccents(str) {
        return str ? String(str).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') : '';
    },

    // Normaliza texto para buscadores: sin tildes (ñ -> n), minúsculas, signos
    // de puntuación como espacio y espacios colapsados (ej. "Bío-Bío" -> "bio bio").
    normalizeSearch(str) {
        return CatlecUtils.normalizeAccents(str).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    },

    // Estándar para los buscadores de texto de los filtros: crea un matcher para
    // `query` que recibe los campos buscables de una fila (strings, null o
    // arrays) y devuelve true si la consulta está vacía o aparece en ellos.
    // La consulta se normaliza una sola vez; los campos se concatenan, así que
    // una búsqueda puede abarcar más de un campo.
    // Uso: const matchSearch = CatlecUtils.createSearchMatcher(state.search);
    //      rows.filter(r => matchSearch(r.name, r.region, r.tags));
    createSearchMatcher(query) {
        const q = CatlecUtils.normalizeSearch(query);
        if (!q) return () => true;
        return (...fields) => CatlecUtils.normalizeSearch(
            fields.flat().filter(f => f != null).join(' ')
        ).includes(q);
    },

    // Retrasa la ejecución de fn hasta que pase `delay` ms sin nuevas llamadas
    // (uso típico: buscadores reactivos que no deben filtrar en cada tecla).
    debounce(fn, delay) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    },

    // Convierte una fecha a año fraccionario (ej. 2024-07-01 -> 2024.5), usado
    // para posicionar hitos en ejes temporales de líneas de tiempo.
    dateToYear(str) {
        if (!str) return null;
        const d = new Date(str);
        if (isNaN(d.getTime())) return null;
        const y = d.getFullYear();
        const start = new Date(y, 0, 1);
        const end = new Date(y + 1, 0, 1);
        return y + (d - start) / (end - start);
    },

    // Corta un texto en varias líneas por palabra completa, sin truncar ni
    // agregar elipsis (uso: etiquetas de líneas de tiempo).
    wrapText(text, maxCharsPerLine = 27) {
        if (!text) return ['—'];
        const words = String(text).split(' ');
        const lines = [];
        let currentLine = '';
        words.forEach(w => {
            if ((currentLine + (currentLine ? ' ' : '') + w).length <= maxCharsPerLine) {
                currentLine += (currentLine ? ' ' : '') + w;
            } else {
                if (currentLine) lines.push(currentLine);
                currentLine = w;
            }
        });
        if (currentLine) lines.push(currentLine);
        return lines.length > 0 ? lines : [text];
    },

    // Corta un texto en hasta `maxLines` líneas, truncando la última con "…" si
    // no alcanza el espacio (uso: etiquetas de ejes de Chart.js).
    wrapTextToLines(str, maxLen, maxLines) {
        if (!str || str.length <= maxLen) return str;
        const words = str.split(' ');
        if (words.length <= 1) return str.length > maxLen ? str.substring(0, maxLen - 1) + '…' : str;

        const lines = [];
        let cur = '';

        for (let i = 0; i < words.length; i++) {
            const w = words[i];
            if (lines.length === maxLines - 1) {
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
    },

    // Calcula el punto ubicado al 50% de la distancia recorrida a lo largo de
    // una o varias polilíneas Leaflet (acepta una sola capa o un arreglo).
    getLineMidpoint(layerOrLayers) {
        const layers = Array.isArray(layerOrLayers) ? layerOrLayers : [layerOrLayers];
        if (!layers.length || !layers[0]) return null;

        // Caso especial: una única capa que es un punto (no una línea).
        if (layers.length === 1 && !layers[0].getLatLngs && layers[0].getLatLng) {
            return layers[0].getLatLng();
        }

        let allSegments = [];
        layers.forEach(l => {
            if (l && l.getLatLngs) {
                const rawLatLngs = l.getLatLngs();
                function extractSegments(arr) {
                    if (!Array.isArray(arr) || arr.length === 0) return;
                    if (arr[0] instanceof L.LatLng || (arr[0] && typeof arr[0].lat === 'number')) {
                        if (arr.length >= 2) {
                            allSegments.push(arr);
                        }
                    } else {
                        arr.forEach(sub => extractSegments(sub));
                    }
                }
                extractSegments(rawLatLngs);
            }
        });

        if (allSegments.length === 0) {
            const single = layers.length === 1 ? layers[0] : null;
            return (single && single.getBounds) ? single.getBounds().getCenter() : null;
        }

        let totalLength = 0;
        allSegments.forEach(seg => {
            for (let i = 0; i < seg.length - 1; i++) {
                totalLength += seg[i].distanceTo(seg[i + 1]);
            }
        });

        if (totalLength === 0) {
            return allSegments[0][0];
        }

        const halfDistance = totalLength / 2;
        let accumulated = 0;

        for (let s = 0; s < allSegments.length; s++) {
            const seg = allSegments[s];
            for (let i = 0; i < seg.length - 1; i++) {
                const p1 = seg[i];
                const p2 = seg[i + 1];
                const dist = p1.distanceTo(p2);
                if (accumulated + dist >= halfDistance) {
                    const needed = halfDistance - accumulated;
                    const ratio = dist > 0 ? (needed / dist) : 0;
                    const lat = p1.lat + (p2.lat - p1.lat) * ratio;
                    const lng = p1.lng + (p2.lng - p1.lng) * ratio;
                    return L.latLng(lat, lng);
                }
                accumulated += dist;
            }
        }

        return allSegments[0][Math.floor(allSegments[0].length / 2)];
    },

    // Plugin de Chart.js: dibuja el valor de cada barra horizontal, adentro si
    // hay espacio o afuera a la derecha si la barra es angosta. La plataforma
    // opera solo en tema claro (ver CLAUDE.md), por eso no hay rama de tema oscuro.
    horizontalBarDataLabelsPlugin: {
        id: 'horizontalBarDataLabelsPlugin',
        afterDatasetsDraw: (chart, args, pluginOptions) => {
            const ctx = chart.ctx;
            const meta = chart.getDatasetMeta(0);
            if (!meta || !meta.data) return;

            const outsideColor = '#334155';
            const insideColor = '#ffffff';
            const formatter = (pluginOptions && pluginOptions.formatter) || ((v) => String(v));
            const font = (pluginOptions && pluginOptions.font) || '700 9.5px Helvetica Neue, Helvetica, Arial, sans-serif';

            ctx.save();
            ctx.font = font;
            ctx.textBaseline = 'middle';

            meta.data.forEach((bar, index) => {
                const rawVal = chart.data.datasets[0].data[index];
                if (rawVal === undefined || rawVal === null || rawVal <= 0) return;

                const text = formatter(rawVal);
                const textWidth = ctx.measureText(text).width;
                const barWidth = Math.abs(bar.x - bar.base);

                if (barWidth >= textWidth + 18) {
                    ctx.fillStyle = insideColor;
                    ctx.textAlign = 'right';
                    ctx.fillText(text, bar.x - 6, bar.y);
                } else {
                    ctx.fillStyle = outsideColor;
                    ctx.textAlign = 'left';
                    ctx.fillText(text, bar.x + 5, bar.y);
                }
            });

            ctx.restore();
        }
    },

    // Plugin de Chart.js: dibuja el valor dentro de cada segmento de barra apilada vertical,
    // centrado vertical y horizontalmente si la altura y ancho del segmento son suficientes.
    stackedBarDataLabelsPlugin: {
        id: 'stackedBarDataLabelsPlugin',
        afterDatasetsDraw: (chart, args, pluginOptions) => {
            const ctx = chart.ctx;
            const formatter = (pluginOptions && pluginOptions.formatter) || ((v) => (typeof v === 'number' ? v.toFixed(1) : String(v)));
            const minHeight = (pluginOptions && pluginOptions.minHeight) !== undefined ? pluginOptions.minHeight : 10;
            const font = (pluginOptions && pluginOptions.font) || '700 9.5px Helvetica Neue, Helvetica, Arial, sans-serif';
            const color = (pluginOptions && pluginOptions.color) || '#ffffff';

            ctx.save();
            ctx.font = font;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = color;

            chart.data.datasets.forEach((dataset, dIdx) => {
                if (dataset.type === 'line') return;
                const meta = chart.getDatasetMeta(dIdx);
                if (!meta || meta.hidden || !meta.data) return;

                meta.data.forEach((bar, index) => {
                    const rawVal = dataset.data[index];
                    if (rawVal === undefined || rawVal === null || Number(rawVal) <= 0) return;

                    const height = Math.abs(bar.base - bar.y);
                    if (height < minHeight) return;

                    const text = formatter(rawVal);
                    const textWidth = ctx.measureText(text).width;
                    const barWidth = bar.width || 20;
                    if (barWidth > 0 && barWidth < textWidth - 2) return;

                    const x = bar.x;
                    const y = (bar.y + bar.base) / 2;

                    ctx.fillText(text, x, y);
                });
            });

            ctx.restore();
        }
    },

    // Plugin de Chart.js: dibuja el valor sobre el extremo superior de cada barra
    // vertical (agrupadas o simples, NO apiladas). En combos, si una línea pasa por
    // la etiqueta, la mueve dentro de la barra o, si no cabe, por encima de la línea.
    groupedBarDataLabelsPlugin: {
        id: 'groupedBarDataLabelsPlugin',
        afterDatasetsDraw: (chart, args, pluginOptions) => {
            const ctx = chart.ctx;
            const formatter = (pluginOptions && pluginOptions.formatter) || ((v) => (typeof v === 'number' ? v.toFixed(1) : String(v)));
            const font = (pluginOptions && pluginOptions.font) || '700 9.5px Helvetica Neue, Helvetica, Arial, sans-serif';
            const colorOpt = (pluginOptions && pluginOptions.color) || '#334155';
            const offset = (pluginOptions && pluginOptions.offset) !== undefined ? pluginOptions.offset : 4;
            const insideColor = '#ffffff';

            const lineMetas = chart.data.datasets
                .map((ds, i) => ({ ds, meta: chart.getDatasetMeta(i) }))
                .filter(({ ds, meta }) => (ds.type || chart.config.type) === 'line' && meta && !meta.hidden && meta.data && meta.data.length);

            // Rango vertical [minY, maxY] (px, con margen) que ocupa la línea entre x0 y x1, o null si no pasa por ahí.
            const lineRangeInSpan = ({ ds, meta }, x0, x1) => {
                const pts = meta.data.filter(p => p && !p.skip && Number.isFinite(p.x) && Number.isFinite(p.y));
                if (!pts.length || x1 < pts[0].x || x0 > pts[pts.length - 1].x) return null;

                const yAt = (x) => {
                    for (let i = 0; i < pts.length - 1; i++) {
                        const a = pts[i], b = pts[i + 1];
                        if (x >= a.x && x <= b.x) return b.x === a.x ? a.y : a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x);
                    }
                    return null;
                };

                const ys = [yAt(Math.max(x0, pts[0].x)), yAt(Math.min(x1, pts[pts.length - 1].x))].filter(y => y !== null);
                let pointPad = 0;
                pts.forEach(p => {
                    if (p.x >= x0 && p.x <= x1) {
                        ys.push(p.y);
                        pointPad = Math.max(pointPad, (p.options && p.options.radius) || 0);
                    }
                });
                if (!ys.length) return null;

                const pad = (ds.borderWidth || 2) / 2 + pointPad + 2;
                return [Math.min(...ys) - pad, Math.max(...ys) + pad];
            };

            ctx.save();
            ctx.font = font;
            ctx.textAlign = 'center';

            chart.data.datasets.forEach((dataset, dIdx) => {
                if ((dataset.type || chart.config.type) === 'line') return;
                const meta = chart.getDatasetMeta(dIdx);
                if (!meta || meta.hidden || !meta.data) return;

                const baseColor = typeof colorOpt === 'function' ? colorOpt(dIdx, dataset) : colorOpt;

                meta.data.forEach((bar, index) => {
                    const rawVal = dataset.data[index];
                    if (rawVal === undefined || rawVal === null || Number(rawVal) === 0) return;

                    const text = formatter(rawVal, dIdx, index);
                    const x = bar.x;
                    let y = bar.y - offset;
                    let baseline = 'bottom';
                    let color = baseColor;

                    if (lineMetas.length && bar.y < bar.base) {
                        const m = ctx.measureText(text);
                        const w = m.width;
                        const h = (m.actualBoundingBoxAscent || 0) + (m.actualBoundingBoxDescent || 0) || 10;
                        const boxTop = y - h;
                        const boxBottom = y;

                        const collisions = lineMetas
                            .map(lm => lineRangeInSpan(lm, x - w / 2, x + w / 2))
                            .filter(r => r && r[0] <= boxBottom && r[1] >= boxTop);

                        if (collisions.length) {
                            if (bar.base - bar.y >= h + 2 * offset + 2) {
                                y = bar.y + offset;
                                baseline = 'top';
                                color = insideColor;
                            } else {
                                const aboveY = Math.min(...collisions.map(r => r[0])) - offset;
                                if (aboveY - h >= 0) y = aboveY;
                            }
                        }
                    }

                    ctx.textBaseline = baseline;
                    ctx.fillStyle = color;
                    ctx.fillText(text, x, y);
                });
            });

            ctx.restore();
        }
    },

    // Plugin de Chart.js: dibuja el valor junto a cada punto de datasets tipo
    // 'line' (gráficos combo o 100% de líneas), con desplazamiento vertical
    // configurable por dataset para evitar solaparse entre series cercanas.
    lineDataLabelsPlugin: {
        id: 'lineDataLabelsPlugin',
        afterDatasetsDraw: (chart, args, pluginOptions) => {
            const ctx = chart.ctx;
            const formatter = (pluginOptions && pluginOptions.formatter) || ((v) => (typeof v === 'number' ? v.toFixed(1) : String(v)));
            const font = (pluginOptions && pluginOptions.font) || '700 9.5px Helvetica Neue, Helvetica, Arial, sans-serif';
            const colorOpt = (pluginOptions && pluginOptions.color) || '#334155';
            const offsetOpt = (pluginOptions && pluginOptions.offset) !== undefined ? pluginOptions.offset : 8;

            ctx.save();
            ctx.font = font;
            ctx.textAlign = 'center';

            chart.data.datasets.forEach((dataset, dIdx) => {
                const dsType = dataset.type || chart.config.type;
                if (dsType !== 'line') return;
                const meta = chart.getDatasetMeta(dIdx);
                if (!meta || meta.hidden || !meta.data) return;

                const offsetVal = typeof offsetOpt === 'function' ? offsetOpt(dIdx, dataset) : offsetOpt;
                ctx.fillStyle = typeof colorOpt === 'function' ? colorOpt(dIdx, dataset) : colorOpt;
                ctx.textBaseline = offsetVal < 0 ? 'top' : 'bottom';

                meta.data.forEach((point, index) => {
                    const rawVal = dataset.data[index];
                    if (rawVal === undefined || rawVal === null) return;

                    const text = formatter(rawVal, dIdx, index);
                    ctx.fillText(text, point.x, point.y - offsetVal);
                });
            });

            ctx.restore();
        }
    },

    // Arma un dropdown de filtro multiselect (checkboxes + "seleccionar todos"
    // + texto de resumen en el botón), asumiendo la convención de IDs/clases del
    // design system: ${idPrefix}-multiselect-btn/-dropdown/-check-all/-options-list/
    // -multiselect-text y checkboxes con clase ${idPrefix}-checkbox.
    setupMultiselect(idPrefix, options, defaultLabel, pluralLabel, onChange, opts = {}) {
        const { renderOptionLabel = (v) => v, formatSingleLabel = (v) => v } = opts;
        const btn = document.getElementById(`${idPrefix}-multiselect-btn`);
        const dropdown = document.getElementById(`${idPrefix}-multiselect-dropdown`);
        const textSpan = document.getElementById(`${idPrefix}-multiselect-text`);
        const checkAll = document.getElementById(`${idPrefix}-check-all`);
        const listEl = document.getElementById(`${idPrefix}-options-list`);
        if (!btn || !dropdown || !listEl) return;

        listEl.innerHTML = '';
        options.filter(Boolean).forEach(opt => {
            const label = document.createElement('label');
            label.className = 'multiselect-option';
            label.innerHTML = `<input type="checkbox" class="${idPrefix}-checkbox" value="${opt}"><span>${renderOptionLabel(opt)}</span>`;
            listEl.appendChild(label);
        });

        // Abrir/cerrar = alternar .open en el contenedor; la animación vive en el CSS.
        const container = dropdown.closest('.custom-multiselect') || dropdown.parentElement;
        btn.setAttribute('aria-haspopup', 'listbox');
        btn.setAttribute('aria-expanded', 'false');
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const wasOpen = container.classList.contains('open');
            CatlecUtils.closeAllMultiselects();
            if (!wasOpen) {
                container.classList.add('open');
                btn.setAttribute('aria-expanded', 'true');
            }
        });
        dropdown.addEventListener('click', (e) => e.stopPropagation());

        if (checkAll) {
            checkAll.addEventListener('change', () => {
                listEl.querySelectorAll(`.${idPrefix}-checkbox`).forEach(cb => cb.checked = checkAll.checked);
                updateSelected();
            });
        }
        listEl.addEventListener('change', (e) => {
            if (!e.target.classList.contains(`${idPrefix}-checkbox`)) return;
            const boxes = listEl.querySelectorAll(`.${idPrefix}-checkbox`);
            if (checkAll) checkAll.checked = Array.from(boxes).every(cb => cb.checked);
            updateSelected();
        });

        function updateSelected() {
            const values = Array.from(listEl.querySelectorAll(`.${idPrefix}-checkbox:checked`)).map(cb => cb.value);
            if (values.length === 0 || values.length === options.length) {
                textSpan.textContent = defaultLabel;
                if (checkAll) checkAll.checked = values.length === options.length && options.length > 0;
                onChange([]);
            } else if (values.length === 1) {
                textSpan.textContent = formatSingleLabel(values[0]);
                onChange(values);
            } else {
                textSpan.textContent = `${values.length} ${pluralLabel}`;
                onChange(values);
            }
        }
    },

    // Formatea un monto en millones de USD de forma compacta ("US$ 1.234 MM",
    // "US$ 2.50B", "US$ 0.8 MM"), unificando las variantes que existían
    // duplicadas en EFE (efeFormatInvestment/efeFormatUSD, formatEfeUSD) y
    // Metro (metroFormatInvestment/metroFormatUSD). `val` se asume expresado en
    // millones de USD. Las opciones reproducen las pequeñas diferencias que
    // tenía cada implementación original, para no alterar el output existente:
    //   - emptyText: texto cuando el valor no es válido (default '—').
    //   - rawFallback: string literal a mostrar si el valor no es numérico
    //     (ej. "En evaluación"), usado por Metro antes de caer a emptyText.
    //   - requirePositive: si es true, valores <= 0 se consideran inválidos
    //     (comportamiento de Metro).
    //   - treatZeroAsInvalid: si es true, val === 0 también cae a emptyText
    //     (comportamiento legacy de formatEfeUSD, con emptyText = 'US$ 0').
    //   - bWholeStrip: si es true, en la rama >= 1000 MM (miles de millones)
    //     omite los decimales cuando son ,00 (comportamiento legacy de
    //     formatEfeUSD); si es false, siempre usa 2 decimales.
    //   - mmRounding: 'locale' (toLocaleString con maximumFractionDigits: 0,
    //     usado por EFE/Metro) o 'round' (Math.round, usado por formatEfeUSD).
    formatCompactUSD(val, opts = {}) {
        const {
            emptyText = '—',
            rawFallback = null,
            requirePositive = false,
            treatZeroAsInvalid = false,
            bWholeStrip = false,
            mmRounding = 'locale'
        } = opts;

        const num = Number(val);
        const isNullish = val == null || val === '' || isNaN(num);
        const isInvalid = isNullish
            || (requirePositive && num <= 0)
            || (treatZeroAsInvalid && num === 0);

        if (isInvalid) {
            if (typeof rawFallback === 'string') {
                const trimmed = rawFallback.trim();
                if (trimmed !== '' && trimmed !== '—' && trimmed !== '-' && trimmed.toLowerCase() !== 'nan') {
                    return trimmed;
                }
            }
            return emptyText;
        }

        if (num >= 1000) {
            const b = num / 1000;
            return bWholeStrip
                ? `US$ ${b % 1 === 0 ? b.toFixed(0) : b.toFixed(2)}B`
                : `US$ ${b.toFixed(2)}B`;
        }
        if (num >= 1) {
            const mm = mmRounding === 'round'
                ? Math.round(num).toLocaleString('es-CL')
                : num.toLocaleString('es-CL', { maximumFractionDigits: 0 });
            return `US$ ${mm} MM`;
        }
        return `US$ ${num.toFixed(1)} MM`;
    },

    // Acorta el nombre oficial de una región chilena para mostrar en UI (ej.
    // "Región de Valparaíso" -> "Valparaíso", "Región Metropolitana de
    // Santiago" -> "Metropolitana"). Quita el prefijo "Región de/del/la" vía
    // regex y solo reescribe los 4 casos cuyo nombre oficial no queda legible
    // tal cual tras el recorte (Metropolitana, Aysén, Magallanes, O'Higgins);
    // el resto de regiones se muestra con su nombre completo post-prefijo
    // (ej. "Arica y Parinacota", "Los Ríos"). Estándar único usado por DGC,
    // MOP y SECTRA (antes cada uno tenía su propia variante, incluyendo un
    // acortado adicional a una sola palabra en SECTRA y una etiqueta "RM"
    // para la Metropolitana, ambos removidos para unificar el output).
    shortenRegionName(name) {
        if (!name) return '';
        let str = String(name).trim();
        // "Regi[oó]n" tolera datos de origen sin tilde (ej. SECTRA trae
        // "Region de Arica y Parinacota" sin acento para esa entrada).
        str = str.replace(/^Regi[oó]n\s+(de\s+la\s+|del\s+|de\s+)?/i, '');

        if (/metropolitana/i.test(str)) return 'Metropolitana';
        if (/ays[eé]n/i.test(str)) return 'Aysén';
        if (/magallanes/i.test(str)) return 'Magallanes';
        if (/o'higgins|bernardo/i.test(str)) return "O'Higgins";

        return str;
    },

    // Divide un string de regiones separadas por ; , / o salto de línea en un
    // arreglo de nombres ya acortados vía shortenRegionName (ej. proyectos que
    // abarcan más de una región). Filtra vacíos.
    splitRegionString(regionStr) {
        if (!regionStr) return [];
        const str = String(regionStr).replace(/&nbsp;/g, ' ');
        return str.split(/[;,/\n]+/).map(p => this.shortenRegionName(p.trim())).filter(Boolean);
    },

    // Renderiza la celda/valor de región de un proyecto como texto simple,
    // pill "Nacional" (si el valor indica cobertura nacional/interregional), o
    // varias pills si el proyecto abarca más de una región. Estándar único
    // usado por DGC y MOP (antes duplicado con pequeñas diferencias en los
    // textos vacíos reconocidos por cada uno).
    formatRegionCell(regionStr) {
        const trimmed = regionStr ? String(regionStr).trim() : '';
        if (!trimmed || trimmed === 'N/A' || trimmed === '—') {
            return '<span style="color:var(--text-muted);font-style:italic">Sin región</span>';
        }
        if (/nacional|interregional/i.test(trimmed)) {
            return '<span class="region-pill">Nacional</span>';
        }

        const parts = this.splitRegionString(trimmed);
        if (parts.length > 1) {
            return `<div class="region-pills-wrap">${parts.map(p => `<span class="region-pill">${p}</span>`).join('')}</div>`;
        }

        return `<span>${parts[0] || trimmed}</span>`;
    },

    // Cierra todos los dropdowns de multiselect abiertos en la página.
    closeAllMultiselects() {
        document.querySelectorAll('.custom-multiselect.open').forEach(c => {
            c.classList.remove('open');
            const trigger = c.querySelector('.multiselect-trigger');
            if (trigger) trigger.setAttribute('aria-expanded', 'false');
        });
    },

    // Serializa un FeatureCollection y dispara su descarga como .geojson.
    downloadGeoJSON(featureCollection, filenamePrefix) {
        const jsonString = JSON.stringify(featureCollection, null, 2);
        const blob = new Blob([jsonString], { type: "application/geo+json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const downloadAnchor = document.createElement('a');
        const today = new Date().toISOString().slice(0, 10);
        downloadAnchor.setAttribute('href', url);
        downloadAnchor.setAttribute('download', `${filenamePrefix}_${today}.geojson`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    },

    // Calcula dinámicamente el nivel de maxZoom y padding óptimos según la
    // extensión geográfica diagonal (en km) del bounding box del proyecto.
    calculateAdaptiveZoom(bounds) {
        if (!bounds || typeof bounds.isValid !== 'function' || !bounds.isValid()) {
            return { maxZoom: 11.5, padding: [60, 60], spanKm: 0, isPoint: true };
        }

        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();
        const distMeters = (sw && ne && typeof sw.distanceTo === 'function') ? sw.distanceTo(ne) : 0;
        const spanKm = distMeters / 1000;

        // Escalas adaptativas:
        // 1. Proyecto Puntual / Solo un punto (< 0.25 km): Estación puntual, edificio, peaje
        //    Se aplica un menor nivel de zoom (11.5) para no sobre-acercar la cámara a nivel de calle
        //    y permitir apreciar la ubicación dentro de la ciudad/entorno.
        if (spanKm < 0.25) {
            return { maxZoom: 11.5, padding: [50, 50], spanKm, isPoint: true };
        }
        // 2. Trazado Corto / Urbano (0.25 km a 8 km): Puentes, túneles, variantes, tramos cortos
        if (spanKm < 8) {
            return { maxZoom: 13.0, padding: [50, 50], spanKm, isPoint: false };
        }
        // 3. Intercomunal / Suburbano (8 km a 30 km): Batuco, Limache-Calera, autopistas
        if (spanKm < 30) {
            return { maxZoom: 11.5, padding: [60, 60], spanKm, isPoint: false };
        }
        // 4. Suburbano Extenso (30 km a 100 km): Melipilla, Tren Rancagua, Ruta 68
        if (spanKm < 100) {
            return { maxZoom: 10.0, padding: [65, 65], spanKm, isPoint: false };
        }
        // 5. Interurbano Regional (100 km a 250 km): Tren San Fernando, Tramos Ruta 5
        if (spanKm < 250) {
            return { maxZoom: 8.5, padding: [70, 70], spanKm, isPoint: false };
        }
        // 6. Macro / Multirregional (>= 250 km): Santiago - Chillán (400 km)
        return { maxZoom: 7.0, padding: [80, 80], spanKm, isPoint: false };
    },

    // Función global y estandarizada para hacer zoom fluido y adaptativo a un
    // proyecto, línea, comuna o conjunto de geometrías en cualquier mapa Leaflet de CATLEC.
    zoomToProject(map, target, options = {}) {
        if (!map) return false;

        const {
            duration = 1.2,
            maxZoomOverride = null,
            paddingOverride = null,
            onDefaultView = null,
            onStart = null,
            onEnd = null
        } = options;

        let bounds = null;

        // 1. Si target ya es un LatLngBounds válido
        if (target && typeof target.isValid === 'function' && target.isValid()) {
            bounds = target;
        }
        // 2. Si target es un arreglo de capas o coordenadas
        else if (Array.isArray(target) && target.length > 0) {
            bounds = L.latLngBounds();
            target.forEach(l => {
                if (!l) return;
                if (typeof l.getBounds === 'function') {
                    const b = l.getBounds();
                    if (b && typeof b.isValid === 'function' && b.isValid()) bounds.extend(b);
                } else if (typeof l.getLatLng === 'function') {
                    const ll = l.getLatLng();
                    if (ll) bounds.extend(ll);
                } else if (Array.isArray(l) && l.length === 2 && typeof l[0] === 'number' && typeof l[1] === 'number') {
                    bounds.extend(l);
                }
            });
        }
        // 3. Si target es una sola capa Leaflet
        else if (target && typeof target.getBounds === 'function') {
            const b = target.getBounds();
            if (b && typeof b.isValid === 'function' && b.isValid()) bounds = b;
        } else if (target && typeof target.getLatLng === 'function') {
            const ll = target.getLatLng();
            if (ll) bounds = L.latLngBounds([ll, ll]);
        }
        // 4. Si target es una coordenada [lat, lng] o L.LatLng
        else if (target && target instanceof L.LatLng) {
            bounds = L.latLngBounds([target, target]);
        } else if (Array.isArray(target) && target.length === 2 && typeof target[0] === 'number' && typeof target[1] === 'number') {
            bounds = L.latLngBounds([target, target]);
        }

        // Si se obtuvo un bounds válido:
        if (bounds && typeof bounds.isValid === 'function' && bounds.isValid()) {
            const adaptive = this.calculateAdaptiveZoom(bounds);
            const targetMaxZoom = maxZoomOverride != null ? maxZoomOverride : adaptive.maxZoom;
            const targetPadding = paddingOverride != null ? paddingOverride : adaptive.padding;

            if (typeof onStart === 'function') onStart(Math.round(duration * 1000));

            if (typeof map.flyToBounds === 'function') {
                map.flyToBounds(bounds, {
                    animate: true,
                    duration: duration,
                    padding: targetPadding,
                    maxZoom: targetMaxZoom
                });
            } else {
                map.fitBounds(bounds, {
                    padding: targetPadding,
                    maxZoom: targetMaxZoom,
                    animate: true
                });
            }

            if (typeof onEnd === 'function') {
                setTimeout(onEnd, Math.round(duration * 1000) + 50);
            }
            return true;
        }

        // Fallback si no hay geometrías válidas
        if (typeof onDefaultView === 'function') {
            onDefaultView(true);
            return false;
        }

        return false;
    },

    // Crea un control de leyenda flotante de Leaflet (bottomleft) a partir de un
    // bloque de HTML ya armado por el módulo llamante. Encapsula la plomería común
    // a EFE y Metro: creación del control, inserción del div, bloqueo de
    // propagación de clicks/scroll hacia el mapa, y devuelve el div ya montado
    // para que el módulo enganche sus propios checkboxes vía `onMount`.
    createLegendControl(map, { className = 'efe-map-legend', html, onMount } = {}) {
        if (!map || !html) return null;

        const legend = L.control({ position: 'bottomleft' });

        legend.onAdd = function () {
            const div = L.DomUtil.create('div', className);
            div.innerHTML = html;

            L.DomEvent.disableClickPropagation(div);
            L.DomEvent.disableScrollPropagation(div);

            if (typeof onMount === 'function') onMount(div);

            return div;
        };

        legend.addTo(map);
        return legend;
    },

    // Inicializa un mapa Leaflet con la capa base CartoDB Light que usan todos
    // los dashboards CATLEC (misma URL, API key y atribución). `options` son las
    // opciones propias de L.map de cada módulo (minZoom, zoomDelta, etc.); si se
    // pasa `center`, se aplica un setView inicial. Devuelve { map, tileLayer }.
    createBaseMap(elId, { center, zoom, options = {} } = {}) {
        const map = L.map(elId, Object.assign({ zoomControl: true, zoomSnap: 0.5 }, options));
        if (center) map.setView(center, zoom);

        const tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=cb1_2j8c_1_dacb4df364cf092be679e47d', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(map);

        this.enableCollapsibleAttribution(map);

        return { map, tileLayer };
    },

    // Alterna entre dos vistas contenedoras (tabla ↔ ficha de detalle) con un
    // fundido cruzado + desplazamiento horizontal (ver .catlec-view-* en
    // styles.css). `direction: 'forward'` (ir al detalle) hace que `hideEl`
    // salga hacia la izquierda mientras `showEl` entra desde la derecha;
    // `'back'` (volver a la tabla) invierte ambos sentidos. Estándar único
    // para DGC, EFE, Metro y MOP.
    swapView(hideEl, showEl, { direction = 'forward', showDisplay = 'flex' } = {}) {
        if (!hideEl || !showEl) return;
        // Si el usuario alterna antes de que termine la animación anterior, se
        // cierra de golpe para no dejar listeners ni estilos colgando.
        [hideEl, showEl].forEach(el => { if (el._catlecSwapFinish) el._catlecSwapFinish(); });

        const forward = direction === 'forward';
        const outClass = forward ? 'catlec-view-out-left' : 'catlec-view-out-right';
        const inClass = forward ? 'catlec-view-in-right' : 'catlec-view-in-left';

        // Ambas vistas suelen ser hermanas flex con `flex: 1`: si conviven en el
        // flujo se reparten la altura y todo salta al terminar. La saliente se
        // fija en absoluto sobre su misma caja para que la entrante ocupe el
        // espacio completo desde el primer cuadro.
        const OVERLAY_PROPS = ['position', 'top', 'left', 'width', 'height', 'margin', 'pointerEvents', 'zIndex'];
        const prevStyles = {};
        OVERLAY_PROPS.forEach(p => { prevStyles[p] = hideEl.style[p]; });
        Object.assign(hideEl.style, {
            position: 'absolute',
            top: `${hideEl.offsetTop}px`,
            left: `${hideEl.offsetLeft}px`,
            width: `${hideEl.offsetWidth}px`,
            height: `${hideEl.offsetHeight}px`,
            margin: '0',
            pointerEvents: 'none',
            zIndex: '1'
        });

        const track = (el, cls, onDone) => {
            let timer = null;
            const finish = () => {
                clearTimeout(timer);
                el.removeEventListener('animationend', onEnd);
                el.classList.remove(cls);
                delete el._catlecSwapFinish;
                if (onDone) onDone();
            };
            const onEnd = (e) => { if (e.target === el) finish(); };
            el.addEventListener('animationend', onEnd);
            // Respaldo si animationend no llega (pestaña en segundo plano, animaciones desactivadas).
            timer = setTimeout(finish, 500);
            el._catlecSwapFinish = finish;
            el.classList.add(cls);
        };

        track(hideEl, outClass, () => {
            OVERLAY_PROPS.forEach(p => { hideEl.style[p] = prevStyles[p]; });
            hideEl.style.display = 'none';
        });

        showEl.style.display = showDisplay;
        track(showEl, inClass);
    },

    // Ejecuta `fn` después del próximo repintado (doble requestAnimationFrame).
    // Útil para iniciar un flyTo recién cuando el navegador terminó de pintar el
    // trabajo pesado previo (tablas, paneles), ya que la animación de Leaflet se
    // mide por tiempo y "salta" si sus primeros cuadros quedan bloqueados.
    afterNextPaint(fn) {
        requestAnimationFrame(() => requestAnimationFrame(fn));
    },

    // Cierra todos los tooltips abiertos de un mapa Leaflet usando su API (los
    // tooltips abiertos son capas del mapa). No vaciar el tooltipPane a mano:
    // Leaflet seguiría creyéndolos abiertos y no volvería a mostrarlos.
    closeAllMapTooltips(map) {
        if (!map) return;
        const pane = map.getPane('tooltipPane');
        if (pane && pane.childElementCount === 0) return;
        const open = [];
        map.eachLayer(l => { if (l instanceof L.Tooltip) open.push(l); });
        open.forEach(t => map.closeTooltip(t));
    },

    // Suaviza las transiciones de zoom de un mapa Leaflet (opt-in por mapa):
    // 1. Durante la animación Leaflet no redibuja los vectores: escala con CSS
    //    la capa SVG completa, por lo que en un flyTo de varios niveles las
    //    shapes crecen hasta cubrir el mapa. Si el zoom cambia más de
    //    `threshold` niveles, los panes `fadePanes` se desvanecen y reaparecen
    //    ya redibujados al terminar (clases .catlec-zoom-fade /
    //    .catlec-map-zooming en styles.css). Zooms cortos de rueda no parpadean.
    // 2. Ningún tooltip se muestra mientras el mapa se mueve por un arrastre
    //    (incluida la inercia), aunque el arrastre empiece sobre un ícono o
    //    shape. Al terminar, el tooltip solo reaparece con el siguiente
    //    movimiento del mouse y si el cursor sigue sobre su capa. Esto también
    //    evita el tooltip "pegado" de Leaflet, que abre al soltar el tooltip de
    //    una capa sobrevolada durante el arrastre aunque el cursor ya no esté
    //    encima (y como nunca llega un mouseout, queda fijo en pantalla).
    //    El tooltip abierto también se cierra al iniciar un zoom.
    enableSmoothZoom(map, { threshold = 1, fadePanes = ['overlayPane'] } = {}) {
        if (!map) return;
        const container = map.getContainer();
        fadePanes.forEach(name => {
            const pane = map.getPane(name);
            if (pane) pane.classList.add('catlec-zoom-fade');
        });

        let startZoom = null;
        const fadeIfFar = (zoom) => {
            if (startZoom !== null && Math.abs(zoom - startZoom) > threshold) {
                container.classList.add('catlec-map-zooming');
            }
        };

        let openTooltip = null;
        const closeOpenTooltip = () => {
            if (openTooltip) map.closeTooltip(openTooltip);
        };

        map.on('zoomstart', () => {
            startZoom = map.getZoom();
            closeOpenTooltip();
        });
        map.on('zoomanim', (e) => fadeIfFar(e.zoom));
        map.on('zoom', () => fadeIfFar(map.getZoom()));
        map.on('zoomend', () => {
            startZoom = null;
            container.classList.remove('catlec-map-zooming');
        });

        // Bloqueo de tooltips desde 'dragstart' hasta el 'moveend' que cierra el
        // arrastre (tras la inercia). Leaflet abre sus tooltips diferidos dentro
        // de ese 'moveend', por eso el bloqueo se libera en el tick siguiente.
        // `pendingSource` recuerda la capa cuyo tooltip se bloqueó, para
        // reabrirlo en el próximo mousemove si el cursor sigue sobre ella.
        let dragBlocking = false;
        let dragEnded = false;
        let releaseTimer = null;
        let pendingSource = null;
        const isHovered = (layer) => {
            const el = layer && typeof layer.getElement === 'function' ? layer.getElement() : null;
            return !!(el && el.matches(':hover'));
        };
        const releaseDragBlock = () => {
            clearTimeout(releaseTimer);
            dragBlocking = false;
            dragEnded = false;
        };

        map.on('dragstart', () => {
            clearTimeout(releaseTimer);
            dragBlocking = true;
            dragEnded = false;
            if (openTooltip) {
                pendingSource = openTooltip._source || null;
                map.closeTooltip(openTooltip);
            }
        });
        map.on('dragend', () => {
            dragEnded = true;
            // Respaldo por si el 'moveend' final no llegara: nunca dejar los
            // tooltips bloqueados indefinidamente.
            releaseTimer = setTimeout(releaseDragBlock, 2000);
        });
        map.on('moveend', () => {
            if (dragBlocking && dragEnded) setTimeout(releaseDragBlock, 0);
        });
        map.on('mousemove', (e) => {
            if (dragBlocking || !pendingSource) return;
            const source = pendingSource;
            pendingSource = null;
            if (isHovered(source) && typeof source.openTooltip === 'function') {
                source.openTooltip(e.latlng);
            }
        });

        map.on('tooltipopen', (e) => {
            if (dragBlocking) {
                // Se cierra en una microtarea (antes del repintado, así que
                // nunca llega a verse) para no interrumpir el onAdd de Leaflet.
                pendingSource = e.tooltip._source || null;
                queueMicrotask(() => map.closeTooltip(e.tooltip));
                return;
            }
            openTooltip = e.tooltip;
        });
        map.on('tooltipclose', (e) => {
            if (openTooltip === e.tooltip) openTooltip = null;
        });
    },

    // Convierte el control de atribución de Leaflet en un botón "i" que
    // despliega los créditos con animación (estilos .catlec-attribution-* en
    // styles.css). Para cumplir las guías de atribución de OpenStreetMap, los
    // créditos parten DESPLEGADOS y solo se contraen solos tras la primera
    // interacción del usuario con el mapa (arrastre, clic o rueda) o después de
    // `autoCollapseMs` de estar visible en pantalla. El conteo empieza recién
    // cuando el mapa es visible (IntersectionObserver), porque varios mapas se
    // crean dentro de pestañas ocultas. Después, solo el botón los abre/cierra.
    // createBaseMap lo aplica automáticamente.
    enableCollapsibleAttribution(map, { autoCollapseMs = 6000 } = {}) {
        const ctrl = map && map.attributionControl;
        const container = ctrl && ctrl.getContainer();
        if (!container || container.classList.contains('catlec-attribution')) return;

        // `clip` es el recorte que anima su max-width (ancho medido del texto
        // ↔ 0); `text` recibe el HTML de Leaflet con su padding, para que el
        // recorte llegue a 0 real.
        const clip = L.DomUtil.create('div', 'catlec-attribution-clip');
        clip.id = `catlec-attribution-${L.Util.stamp(map)}`;
        const text = L.DomUtil.create('span', 'catlec-attribution-text', clip);
        const btn = L.DomUtil.create('button', 'catlec-attribution-toggle');
        btn.type = 'button';
        btn.title = 'Créditos del mapa';
        btn.setAttribute('aria-label', 'Créditos del mapa');
        btn.setAttribute('aria-controls', clip.id);
        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';

        // Leaflet reescribe el innerHTML de su contenedor en cada _update (al
        // agregar/quitar capas con atribución); se redirige esa escritura al
        // span de texto para no borrar el botón.
        ctrl._update = function () {
            const outer = this._container;
            this._container = text;
            L.Control.Attribution.prototype._update.call(this);
            this._container = outer;
            measure();
        };
        // Ancho real del texto para animar el max-width sin tramos muertos. Con
        // el mapa oculto mide 0 y se conserva el valor previo (o el respaldo
        // del CSS); se vuelve a medir al hacerse visible y al desplegar.
        const measure = () => {
            const w = text.scrollWidth;
            if (w) clip.style.setProperty('--catlec-attr-w', `${w}px`);
        };
        container.innerHTML = '';
        container.classList.add('catlec-attribution');
        container.append(clip, btn);
        ctrl._update();

        const setExpanded = (expanded) => {
            if (expanded) measure();
            container.classList.toggle('collapsed', !expanded);
            btn.setAttribute('aria-expanded', String(expanded));
        };
        setExpanded(true);
        if (document.fonts) document.fonts.ready.then(measure);

        let autoDone = false;
        let timer = null;
        let observer = null;
        const autoCollapse = () => {
            if (autoDone) return;
            autoDone = true;
            clearTimeout(timer);
            if (observer) observer.disconnect();
            map.off('dragstart click', autoCollapse);
            L.DomEvent.off(map.getContainer(), 'wheel', autoCollapse);
            setExpanded(false);
        };
        map.on('dragstart click', autoCollapse);
        L.DomEvent.on(map.getContainer(), 'wheel', autoCollapse);

        const startTimer = () => {
            if (!timer && !autoDone) timer = setTimeout(autoCollapse, autoCollapseMs);
        };
        if (typeof IntersectionObserver === 'function') {
            observer = new IntersectionObserver((entries) => {
                if (entries.some(e => e.isIntersecting)) {
                    observer.disconnect();
                    measure();
                    startTimer();
                }
            });
            observer.observe(map.getContainer());
        } else {
            startTimer();
        }

        L.DomEvent.on(btn, 'click', (e) => {
            L.DomEvent.stop(e);
            if (!autoDone) {
                // Si el usuario cierra antes del auto-contraído, se respeta.
                autoCollapse();
                return;
            }
            setExpanded(container.classList.contains('collapsed'));
        });
    }
};
