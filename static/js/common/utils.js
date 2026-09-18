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

            ctx.save();
            ctx.font = '600 9px Inter, system-ui, -apple-system, sans-serif';
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

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const wasOpen = dropdown.dataset.open === 'true';
            CatlecUtils.closeAllMultiselects();
            if (!wasOpen) {
                dropdown.style.display = 'flex';
                dropdown.dataset.open = 'true';
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

    // Cierra todos los dropdowns de multiselect abiertos en la página.
    closeAllMultiselects() {
        document.querySelectorAll('.multiselect-dropdown').forEach(d => {
            d.style.display = 'none';
            d.dataset.open = 'false';
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
};
