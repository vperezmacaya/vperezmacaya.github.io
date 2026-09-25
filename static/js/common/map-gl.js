// ─── static/js/common/map-gl.js ────────────────────────────────────────────────
// Utilidades compartidas para los mapas MapLibre GL de CATLEC (EFE, DGC, Metro).
// Centraliza el mapa base, el tooltip, los vuelos adaptativos, la geometría
// GeoJSON y la leyenda, para que cada módulo solo defina sus capas y estados.
// Requiere maplibre-gl (cargado antes) y CatlecUtils (utils.js).
//
// Nota de zoom: MapLibre usa teselas de 512 px, así que su zoom Z equivale al
// zoom Z+1 de Leaflet. Los umbrales heredados de Leaflet (zoom adaptativo,
// visibilidad de estaciones) se convierten restando ZOOM_OFFSET.
window.CatlecMapGL = {
    ZOOM_OFFSET: 1,

    // Mapa base vectorial CARTO Positron: etiquetas nítidas durante el zoom
    STYLE_URL: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',

    // Créditos del mapa (mismo formato que tenían los mapas Leaflet)
    ATTRIBUTION_HTML: '<a href="https://maplibre.org" target="_blank" rel="noopener" title="Librería de mapas interactivos">MapLibre</a> <span aria-hidden="true">|</span> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',

    // Crea un mapa con el estándar CATLEC: Positron, zoom arriba a la izquierda
    // sin brújula, sin rotación ni inclinación, y el botón "i" de créditos
    // contraíble (addCollapsibleAttribution) en lugar del control nativo.
    createMap(containerId, { center, zoom, minZoom = 0, maxZoom = 20 } = {}) {
        const map = new maplibregl.Map({
            container: containerId,
            style: this.STYLE_URL,
            center,
            zoom,
            minZoom,
            maxZoom,
            attributionControl: false,
            dragRotate: false,
            pitchWithRotate: false,
            touchPitch: false
        });
        map.touchZoomRotate.disableRotation();
        map.keyboard.disableRotation();
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');
        this.addCollapsibleAttribution(map);
        return map;
    },

    // Botón "i" que despliega los créditos con animación: mismo marcado, clases
    // (.catlec-attribution-* en styles.css) y comportamiento que
    // CatlecUtils.enableCollapsibleAttribution de los mapas Leaflet. Para cumplir
    // las guías de atribución de OpenStreetMap, los créditos parten DESPLEGADOS
    // y solo se contraen solos tras la primera interacción con el mapa
    // (arrastre, clic o rueda) o después de `autoCollapseMs` de estar visible
    // (el conteo empieza cuando el mapa se ve: puede crearse en una pestaña
    // oculta). Después, solo el botón los abre y cierra.
    addCollapsibleAttribution(map, { autoCollapseMs = 6000, html = this.ATTRIBUTION_HTML } = {}) {
        const container = document.createElement('div');
        container.className = 'maplibregl-ctrl catlec-attribution';

        // `clip` anima su max-width (ancho medido del texto ↔ 0); `text` lleva
        // el padding, para que el recorte llegue a 0 real.
        const clip = document.createElement('div');
        clip.className = 'catlec-attribution-clip';
        clip.id = `catlec-attribution-${map.getContainer().id || Math.random().toString(36).slice(2)}`;
        const text = document.createElement('span');
        text.className = 'catlec-attribution-text';
        text.innerHTML = html;
        clip.appendChild(text);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'catlec-attribution-toggle';
        btn.title = 'Créditos del mapa';
        btn.setAttribute('aria-label', 'Créditos del mapa');
        btn.setAttribute('aria-controls', clip.id);
        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';
        container.append(clip, btn);

        // Ancho real del texto para animar el max-width sin tramos muertos. Con
        // el mapa oculto mide 0 y se conserva el valor previo (o el respaldo del
        // CSS); se vuelve a medir al hacerse visible y al desplegar.
        const measure = () => {
            const w = text.scrollWidth;
            if (w) clip.style.setProperty('--catlec-attr-w', `${w}px`);
        };
        const setExpanded = (expanded) => {
            if (expanded) measure();
            container.classList.toggle('collapsed', !expanded);
            btn.setAttribute('aria-expanded', String(expanded));
        };

        map.addControl({ onAdd: () => container, onRemove: () => container.remove() }, 'bottom-right');
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
            map.off('dragstart', autoCollapse);
            map.off('click', autoCollapse);
            map.getContainer().removeEventListener('wheel', autoCollapse);
            setExpanded(false);
        };
        map.on('dragstart', autoCollapse);
        map.on('click', autoCollapse);
        map.getContainer().addEventListener('wheel', autoCollapse, { passive: true });

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

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!autoDone) {
                // Si el usuario cierra antes del auto-contraído, se respeta.
                autoCollapse();
                return;
            }
            setExpanded(container.classList.contains('collapsed'));
        });
        return container;
    },

    // Id de la primera capa del bloque FINAL de etiquetas del mapa base: las
    // capas de datos se insertan antes, así quedan sobre calles, vías, puentes,
    // edificios y límites, pero bajo los nombres de lugares y calles. (No sirve
    // la primera capa 'symbol' a secas: Positron tiene etiquetas de ríos muy
    // abajo en la pila y los datos quedarían tapados por las calles.)
    labelsBeforeId(map) {
        const layers = map.getStyle().layers || [];
        let i = layers.length;
        while (i > 0 && layers[i - 1].type === 'symbol') i--;
        return i < layers.length ? layers[i].id : undefined;
    },

    // Muestra u oculta una capa (si existe)
    setLayerVisible(map, layerId, visible) {
        if (map && map.getLayer(layerId)) {
            map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
        }
    },

    // Filtro "COD dentro de la lista" para capas superiores y de resaltado
    inFilter(prop, values) {
        return ['in', ['get', prop], ['literal', [...values]]];
    },

    // ─── Geometría GeoJSON (sin Leaflet) ────────────────────────────────────
    // Secuencias de coordenadas [lng, lat] de una geometría (una por tramo/anillo)
    segments(geometry) {
        if (!geometry) return [];
        switch (geometry.type) {
            case 'LineString': return [geometry.coordinates];
            case 'MultiLineString':
            case 'Polygon': return geometry.coordinates;
            case 'MultiPolygon': return geometry.coordinates.flat();
            case 'Point': return [[geometry.coordinates]];
            case 'MultiPoint': return geometry.coordinates.map(c => [c]);
            default: return [];
        }
    },

    // LngLatBounds de un conjunto de features (null si no hay coordenadas)
    boundsOfFeatures(features) {
        const bounds = new maplibregl.LngLatBounds();
        let any = false;
        (features || []).forEach(f => {
            this.segments(f && f.geometry).forEach(seg => seg.forEach(c => {
                bounds.extend(c);
                any = true;
            }));
        });
        return any ? bounds : null;
    },

    // Centro del rectángulo envolvente de una feature (equivale al
    // getBounds().getCenter() de Leaflet, usado para ubicar íconos)
    boundsCenter(feature) {
        const b = this.boundsOfFeatures([feature]);
        if (!b) return null;
        const c = b.getCenter();
        return [c.lng, c.lat];
    },

    // Distancia en metros entre dos [lng, lat] (haversine, como Leaflet)
    distance(a, b) {
        const R = 6371000;
        const toRad = d => d * Math.PI / 180;
        const dLat = toRad(b[1] - a[1]);
        const dLng = toRad(b[0] - a[0]);
        const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
        return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
    },

    // Punto medio a lo largo de las líneas de un conjunto de features
    // (port de CatlecUtils.getLineMidpoint, que trabaja con capas Leaflet)
    lineMidpoint(features) {
        const segs = [];
        (features || []).forEach(f => this.segments(f.geometry).forEach(s => { if (s.length >= 2) segs.push(s); }));
        if (!segs.length) return null;

        let total = 0;
        segs.forEach(s => { for (let i = 0; i < s.length - 1; i++) total += this.distance(s[i], s[i + 1]); });
        if (total === 0) return segs[0][0];

        const half = total / 2;
        let acc = 0;
        for (const s of segs) {
            for (let i = 0; i < s.length - 1; i++) {
                const d = this.distance(s[i], s[i + 1]);
                if (acc + d >= half) {
                    const r = d > 0 ? (half - acc) / d : 0;
                    return [s[i][0] + (s[i + 1][0] - s[i][0]) * r, s[i][1] + (s[i + 1][1] - s[i][1]) * r];
                }
                acc += d;
            }
        }
        return segs[0][Math.floor(segs[0].length / 2)];
    },

    // ─── Cámara ──────────────────────────────────────────────────────────────
    // Vuelo adaptativo a unos límites. Reutiliza los umbrales de
    // CatlecUtils.calculateAdaptiveZoom (expresados en zoom Leaflet) y los
    // convierte a MapLibre. maxZoomOverride también va en zoom Leaflet.
    flyToBounds(map, bounds, { duration = 1.2, maxZoomOverride = null, paddingOverride = null, onDefaultView = null } = {}) {
        if (!map || !bounds) {
            if (typeof onDefaultView === 'function') onDefaultView();
            return false;
        }
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();
        // calculateAdaptiveZoom solo usa sw.distanceTo(ne) del objeto de límites
        const adaptive = CatlecUtils.calculateAdaptiveZoom({
            isValid: () => true,
            getSouthWest: () => ({ distanceTo: () => this.distance([sw.lng, sw.lat], [ne.lng, ne.lat]) }),
            getNorthEast: () => ne
        });
        const maxZoom = (maxZoomOverride != null ? maxZoomOverride : adaptive.maxZoom) - this.ZOOM_OFFSET;
        const padding = paddingOverride != null ? paddingOverride : adaptive.padding;
        map.fitBounds(bounds, {
            padding: Array.isArray(padding) ? padding[0] : padding,
            maxZoom,
            duration: duration * 1000,
            essential: true
        });
        return true;
    },

    // ─── Tooltip ─────────────────────────────────────────────────────────────
    // Tooltip flotante único por mapa, con el aspecto de .catlec-map-tooltip.
    // Nunca se muestra mientras la cámara se mueve (arrastre, rueda, vuelo):
    // se oculta en 'movestart' y reaparece con el siguiente mousemove del
    // módulo. Se ajusta para no salirse de mapas angostos (overflow oculto).
    createTooltip(map, { className = 'catlec-map-tooltip' } = {}) {
        const el = document.createElement('div');
        el.className = `catlec-gl-tooltip ${className}`;
        map.getContainer().appendChild(el);

        const tip = {
            el,
            owner: null,
            moving: false,
            show(owner, html, point, opts = {}) {
                if (tip.moving || !html || !point) return;
                tip.owner = owner;
                const cls = `catlec-gl-tooltip ${opts.className || className}`;
                if (el.className !== cls) el.className = cls;
                if (el.innerHTML !== html) el.innerHTML = html;
                el.style.display = 'block';

                const container = map.getContainer();
                const cw = container.clientWidth;
                const ch = container.clientHeight;
                el.style.setProperty('max-width', `${Math.max(120, Math.min(260, cw - 8))}px`, 'important');
                const w = el.offsetWidth;
                const h = el.offsetHeight;
                // A la derecha del cursor si cabe; si no, al lado con más espacio
                let x = point.x + 14;
                if (x + w > cw - 4) x = (point.x > cw / 2) ? point.x - 14 - w : point.x + 14;
                x = Math.max(4, Math.min(cw - w - 4, x));
                const y = Math.max(4, Math.min(ch - h - 4, point.y - h / 2));
                el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
            },
            update(owner, html) {
                if (tip.owner === owner && html) el.innerHTML = html;
            },
            hide() {
                tip.owner = null;
                el.style.display = 'none';
            },
            // Punto de un evento DOM relativo al contenedor del mapa
            pointFromEvent(e) {
                const rect = map.getContainer().getBoundingClientRect();
                return { x: e.clientX - rect.left, y: e.clientY - rect.top };
            }
        };

        map.on('movestart', () => {
            tip.moving = true;
            tip.hide();
        });
        map.on('moveend', () => { tip.moving = false; });
        return tip;
    },

    // El navegador dispara 'click' al soltar un arrastre que empezó sobre un
    // ícono HTML (el ícono se mueve con el mapa bajo el cursor). Devuelve una
    // función que indica si ese click debe ignorarse.
    trackDragClick(map) {
        let suppress = false;
        map.on('dragstart', () => { suppress = true; });
        map.on('dragend', () => { setTimeout(() => { suppress = false; }, 0); });
        return () => suppress;
    },

    // ¿El evento de mapa se originó sobre un ícono HTML (marcador)?
    isMarkerEvent(e) {
        const t = e && e.originalEvent && e.originalEvent.target;
        return !!(t && t.closest && t.closest('.maplibregl-marker'));
    },

    // Punto de origen de un cluster desplegado (EFE, Metro) con sus patas
    // punteadas hacia cada ícono. Las patas se dibujan en píxeles dentro del
    // propio marcador (SVG), así que no dependen del zoom. Cada miembro aporta
    // clusterDx/clusterDy (offset en px) y projectColor. Estilos en efe_addons.css
    // (.catlec-gl-cluster-origin, .cluster-origin-dot).
    createClusterOrigin(map, members, { onCollapse, isDragClick = () => false, legOpacity = 0.65, defaultColor = '#52525b' } = {}) {
        const legs = members
            .filter(m => m.clusterDx != null && m.clusterDy != null)
            .map(m => `<line x1="0" y1="0" x2="${m.clusterDx}" y2="${m.clusterDy}" stroke="${m.projectColor || defaultColor}" stroke-width="2" stroke-opacity="${legOpacity}" stroke-dasharray="3 3"/>`)
            .join('');

        const el = document.createElement('div');
        el.className = 'catlec-gl-cluster-origin';
        el.innerHTML = `<svg width="1" height="1">${legs}</svg><div class="cluster-origin-dot" title="Haga click para replegar"></div>`;
        el.querySelector('.cluster-origin-dot').addEventListener('click', (e) => {
            e.stopPropagation();
            if (isDragClick()) return;
            if (typeof onCollapse === 'function') onCollapse();
        });

        return new maplibregl.Marker({ element: el, anchor: 'center', subpixelPositioning: true })
            .setLngLat(members[0].getLngLat())
            .addTo(map);
    },

    // Leyenda flotante como control de MapLibre (abajo a la izquierda por
    // defecto), con el aspecto de .catlec-map-legend (styles.css). El contenido
    // viene como `html` o como un `element` ya existente en la página (DGC); su
    // primer .catlec-map-legend-title se convierte en la cabecera que repliega
    // la leyenda. `onMount(div)` permite enganchar checkboxes del módulo y
    // `storageKey` recuerda en el navegador si quedó replegada.
    addLegendControl(map, { className, html, element, onMount, position = 'bottom-left', storageKey = null } = {}) {
        if (!map || (!html && !element)) return null;
        const div = element || document.createElement('div');
        div.classList.add('maplibregl-ctrl', 'catlec-map-legend');
        if (className) div.classList.add(...className.split(/\s+/).filter(Boolean));
        if (html) div.innerHTML = html;
        div.hidden = false;
        this.makeLegendCollapsible(div, { storageKey });
        if (typeof onMount === 'function') onMount(div);
        map.addControl({ onAdd: () => div, onRemove: () => div.remove() }, position);
        return div;
    },

    // Cabecera-botón "Leyenda ⌄" que repliega el cuerpo de la leyenda. El
    // recuadro anima su ancho y alto entre el tamaño medido antes y después del
    // cambio (queda anclado abajo a la izquierda, así que se pliega hacia su
    // cabecera) y el cuerpo se desvanece (keyframes en styles.css).
    makeLegendCollapsible(div, { storageKey = null } = {}) {
        const titleEl = div.querySelector('.catlec-map-legend-title');
        if (!titleEl || div.querySelector('.catlec-map-legend-header')) return;

        const body = document.createElement('div');
        body.className = 'catlec-map-legend-body';
        body.id = `${div.id || 'catlec-legend-' + Math.random().toString(36).slice(2)}-body`;

        const header = document.createElement('button');
        header.type = 'button';
        header.className = 'catlec-map-legend-header';
        header.setAttribute('aria-controls', body.id);
        header.innerHTML = `<span class="catlec-map-legend-title">${titleEl.textContent.trim()}</span>`
            + '<svg class="catlec-map-legend-chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

        titleEl.remove();
        while (div.firstChild) body.appendChild(div.firstChild);
        div.append(header, body);

        const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        let cleanup = null;

        const setState = (collapsed) => {
            div.classList.toggle('collapsed', collapsed);
            header.setAttribute('aria-expanded', String(!collapsed));
            header.title = collapsed ? 'Mostrar leyenda' : 'Ocultar leyenda';
        };

        const toggle = (collapsed) => {
            if (cleanup) cleanup();
            const from = div.getBoundingClientRect();
            // Ancho natural del cuerpo desplegado: se fija durante la animación
            // para que sus textos no se reacomoden mientras el recuadro se angosta.
            const bodyWidth = collapsed ? body.offsetWidth : 0;
            setState(collapsed);
            const to = div.getBoundingClientRect();
            if (!from.width || !to.width || reduceMotion()) return;

            div.classList.add('is-animating');
            body.style.width = `${collapsed ? bodyWidth : body.offsetWidth}px`;
            div.style.width = `${from.width}px`;
            div.style.height = `${from.height}px`;
            void div.offsetWidth; // fija el tamaño inicial antes de la transición
            div.style.width = `${to.width}px`;
            div.style.height = `${to.height}px`;

            let timer = null;
            const onEnd = (e) => { if (e.target === div && e.propertyName === 'height') cleanup(); };
            cleanup = () => {
                clearTimeout(timer);
                div.removeEventListener('transitionend', onEnd);
                div.classList.remove('is-animating');
                div.style.width = '';
                div.style.height = '';
                body.style.width = '';
                cleanup = null;
            };
            div.addEventListener('transitionend', onEnd);
            timer = setTimeout(cleanup, 400); // por si no llega transitionend
        };

        let initial = false;
        if (storageKey) {
            try { initial = localStorage.getItem(storageKey) === '1'; } catch (e) { /* sin storage */ }
        }
        setState(initial);

        header.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const collapsed = !div.classList.contains('collapsed');
            toggle(collapsed);
            if (storageKey) {
                try { localStorage.setItem(storageKey, collapsed ? '1' : '0'); } catch (err) { /* sin storage */ }
            }
        });
    }
};
