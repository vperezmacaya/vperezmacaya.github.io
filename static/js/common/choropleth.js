// ─── static/js/common/choropleth.js ───────────────────────────────────────────
// Mapa coroplético SVG de las regiones de Chile con D3 v7, compartido por SNI y
// MOP (extraído de static/js/SNI/map.js). Dibuja las regiones, las redibuja con
// ResizeObserver, aplica el estilo de hover estándar y posiciona el tooltip
// fijo (.catlec-map-tooltip--fixed). El color de cada región y el contenido del
// tooltip los decide cada módulo. Estilos: .catlec-choropleth-svg y
// .catlec-region-path en styles.css.
window.CatlecChoropleth = {
    // Chile continental (Arica a Cabo de Hornos), sin Isla de Pascua (~lon -109°)
    // para un encuadre correcto: usar SIEMPRE este rectángulo en fitExtent, nunca
    // el bounding box real de las regiones. El anillo debe ir en sentido horario
    // (SW→NW→NE→SE→SW): d3-geo interpreta uno antihorario como "todo el globo
    // salvo este recorte".
    CHILE_CONTINENTAL_BOUNDS: {
        type: 'Feature',
        geometry: {
            type: 'Polygon',
            coordinates: [[[-76.20, -55.98], [-76.20, -17.50], [-66.40, -17.50], [-66.40, -55.98], [-76.20, -55.98]]]
        }
    },

    // Opacidad y borde de una región en reposo y en hover (estándar SNI)
    STYLE: {
        fillOpacity: 0.7,
        hoverFillOpacity: 0.9,
        stroke: '#ffffff',
        strokeWidth: 1.5,
        hoverStroke: '#3b82f6',
        hoverStrokeWidth: 3,
    },

    // Crea el mapa dentro de `containerId`. Devuelve un controlador con:
    // paths() (selección D3 de las regiones) y redraw(). onEnter/onMove/onLeave
    // reciben (event, feature); onDraw se llama tras el primer dibujo (ahí el
    // módulo pinta los colores, porque el contenedor puede no tener tamaño aún).
    create(containerId, { features, padding = 14, style = {}, onEnter, onMove, onLeave, onDraw } = {}) {
        const container = document.getElementById(containerId);
        if (!container || typeof d3 === 'undefined') return null;
        const st = Object.assign({}, this.STYLE, style);
        const bounds = this.CHILE_CONTINENTAL_BOUNDS;

        const svg = d3.select(container)
            .append('svg')
            .attr('class', 'catlec-choropleth-svg')
            .style('width', '100%')
            .style('height', '100%')
            .style('display', 'block');
        const group = svg.append('g').attr('class', 'catlec-choropleth-regions');

        const setHover = (sel, on) => {
            sel.attr('stroke', on ? st.hoverStroke : st.stroke)
                .attr('stroke-width', on ? st.hoverStrokeWidth : st.strokeWidth)
                .attr('fill-opacity', on ? st.hoverFillOpacity : st.fillOpacity);
            if (on) sel.raise();
        };

        let drawn = false;
        const redraw = () => {
            const width = container.clientWidth;
            const height = container.clientHeight;
            if (width <= 0 || height <= 0) return;
            const projection = d3.geoMercator().fitExtent([[padding, padding], [width - padding, height - padding]], bounds);
            const pathGen = d3.geoPath().projection(projection);

            if (drawn) {
                group.selectAll('path.catlec-region-path').attr('d', pathGen);
                return;
            }
            group.selectAll('path.catlec-region-path')
                .data((features || []).filter(f => f && f.geometry))
                .enter()
                .append('path')
                .attr('class', 'catlec-region-path')
                .attr('vector-effect', 'non-scaling-stroke')
                .attr('d', pathGen)
                .attr('fill-opacity', st.fillOpacity)
                .on('mouseenter', function (event, f) {
                    setHover(d3.select(this), true);
                    if (onEnter) onEnter(event, f);
                })
                .on('mousemove', (event, f) => { if (onMove) onMove(event, f); })
                .on('mouseleave', function (event, f) {
                    setHover(d3.select(this), false);
                    if (onLeave) onLeave(event, f);
                });
            drawn = true;
            if (onDraw) onDraw();
        };

        // Redibujo al cambiar el tamaño. El primer dibujo lo hace el módulo con
        // redraw() después de guardar el controlador (ResizeObserver puede tardar
        // en pestañas en segundo plano, y onDraw necesita el controlador asignado).
        if (typeof ResizeObserver !== 'undefined') {
            new ResizeObserver(redraw).observe(container);
        } else {
            window.addEventListener('resize', redraw);
        }

        return {
            svg,
            paths: () => group.selectAll('path.catlec-region-path'),
            redraw
        };
    },

    // Posiciona un tooltip fijo junto al cursor sin salirse de la ventana
    positionTooltip(tooltipEl, event) {
        if (!tooltipEl) return;
        const offset = 14;
        let x = event.clientX + offset;
        let y = event.clientY + offset;
        const rect = tooltipEl.getBoundingClientRect();
        if (x > window.innerWidth - rect.width - 8) x = event.clientX - rect.width - offset;
        if (y > window.innerHeight - rect.height - 8) y = event.clientY - rect.height - offset;
        tooltipEl.style.left = `${Math.max(x, 4)}px`;
        tooltipEl.style.top = `${Math.max(y, 4)}px`;
    },
};
