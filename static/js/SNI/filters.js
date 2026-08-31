/**
 * static/js/SNI/filters.js
 * Control de filtros interactivos, selección múltiple y presets rápidos para SNI
 */

function initSNIFilters() {
    if (!window.SNI_DATA) return;
    const { filters } = window.SNI_DATA;

    // 1. Renderizar selector de Años
    renderYearFilters(filters.years);

    // 2. Renderizar selector de Regiones
    renderRegionFilters(filters.regions);

    // 3. Renderizar selector de Ministerios
    renderMinistryFilters(filters.ministries);

    // 4. Renderizar selector de Fuentes
    renderSourceFilters(filters.sources);

    // 5. Vincular botones select-all por categoría
    setupSelectAllButtons();

    // 6. Botón de reset general
    const btnReset = document.getElementById('btn-reset-filters');
    if (btnReset) {
        btnReset.addEventListener('click', resetAllSNIFilters);
    }

    if (window.lucide) lucide.createIcons();
}

function setupSelectAllButtons() {
    const btnAllYears = document.getElementById('btn-select-all-years');
    if (btnAllYears) {
        btnAllYears.addEventListener('click', () => {
            const chips = document.querySelectorAll('#filter-years-container .sni-year-chip');
            const allActive = Array.from(chips).length > 0 && Array.from(chips).every(c => c.classList.contains('active'));
            
            if (allActive) {
                chips.forEach(c => c.classList.remove('active'));
                sniState.selectedYears = [];
            } else {
                chips.forEach(c => c.classList.add('active'));
                sniState.selectedYears = window.SNI_DATA && window.SNI_DATA.filters ? [...window.SNI_DATA.filters.years] : [];
            }
            triggerSNIUpdate();
        });
    }

    const btnAllMin = document.getElementById('btn-select-all-ministries');
    if (btnAllMin) {
        btnAllMin.addEventListener('click', () => {
            const checkboxes = document.querySelectorAll('#filter-ministries-container input');
            const allChecked = Array.from(checkboxes).length > 0 && Array.from(checkboxes).every(c => c.checked);
            
            if (allChecked) {
                checkboxes.forEach(c => c.checked = false);
                sniState.selectedMinistries = [];
            } else {
                checkboxes.forEach(c => c.checked = true);
                sniState.selectedMinistries = window.SNI_DATA && window.SNI_DATA.filters ? [...window.SNI_DATA.filters.ministries] : [];
            }
            triggerSNIUpdate();
        });
    }

    const btnAllReg = document.getElementById('btn-select-all-regions');
    if (btnAllReg) {
        btnAllReg.addEventListener('click', () => {
            const checkboxes = document.querySelectorAll('#filter-regions-container input');
            const allChecked = Array.from(checkboxes).length > 0 && Array.from(checkboxes).every(c => c.checked);
            
            if (allChecked) {
                checkboxes.forEach(c => c.checked = false);
                sniState.selectedRegions = [];
            } else {
                checkboxes.forEach(c => c.checked = true);
                sniState.selectedRegions = window.SNI_DATA && window.SNI_DATA.filters ? [...window.SNI_DATA.filters.regions] : [];
            }
            triggerSNIUpdate();
        });
    }

    const btnAllSrc = document.getElementById('btn-select-all-sources');
    if (btnAllSrc) {
        btnAllSrc.addEventListener('click', () => {
            const checkboxes = document.querySelectorAll('#filter-sources-container input');
            const allChecked = Array.from(checkboxes).length > 0 && Array.from(checkboxes).every(c => c.checked);
            
            if (allChecked) {
                checkboxes.forEach(c => c.checked = false);
                sniState.selectedSources = [];
            } else {
                checkboxes.forEach(c => c.checked = true);
                sniState.selectedSources = window.SNI_DATA && window.SNI_DATA.filters ? [...window.SNI_DATA.filters.sources] : [];
            }
            triggerSNIUpdate();
        });
    }
}

function renderYearFilters(years) {
    const container = document.getElementById('filter-years-container');
    if (!container) return;

    container.innerHTML = '';
    years.forEach(yr => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'sni-year-chip';
        chip.dataset.year = yr;
        chip.innerText = yr;
        chip.addEventListener('click', () => {
            toggleYearSelection(yr, chip);
        });
        container.appendChild(chip);
    });
}

function toggleYearSelection(year, chipElement) {
    const idx = sniState.selectedYears.indexOf(year);
    if (idx > -1) {
        sniState.selectedYears.splice(idx, 1);
        chipElement.classList.remove('active');
    } else {
        sniState.selectedYears.push(year);
        chipElement.classList.add('active');
    }
    triggerSNIUpdate();
}

function updateYearChipsUI() {
    document.querySelectorAll('.sni-year-chip').forEach(chip => {
        const yr = parseInt(chip.dataset.year, 10);
        if (sniState.selectedYears.includes(yr)) {
            chip.classList.add('active');
        } else {
            chip.classList.remove('active');
        }
    });
}

function renderRegionFilters(regions) {
    const container = document.getElementById('filter-regions-container');
    if (!container) return;
    container.innerHTML = '';

    regions.forEach(reg => {
        const label = document.createElement('label');
        label.className = 'sni-filter-checkbox-label';
        
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.value = reg;
        chk.addEventListener('change', () => {
            if (chk.checked) {
                if (!sniState.selectedRegions.includes(reg)) sniState.selectedRegions.push(reg);
            } else {
                sniState.selectedRegions = sniState.selectedRegions.filter(r => r !== reg);
            }
            triggerSNIUpdate();
        });

        const span = document.createElement('span');
        span.innerText = reg.replace(/^\d+_/, '');

        label.appendChild(chk);
        label.appendChild(span);
        container.appendChild(label);
    });
}

function renderMinistryFilters(ministries) {
    const container = document.getElementById('filter-ministries-container');
    if (!container) return;
    container.innerHTML = '';

    ministries.forEach(min => {
        const label = document.createElement('label');
        label.className = 'sni-filter-checkbox-label';
        
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.value = min;
        chk.addEventListener('change', () => {
            if (chk.checked) {
                if (!sniState.selectedMinistries.includes(min)) sniState.selectedMinistries.push(min);
            } else {
                sniState.selectedMinistries = sniState.selectedMinistries.filter(m => m !== min);
            }
            triggerSNIUpdate();
        });

        const dot = document.createElement('span');
        dot.className = 'sni-color-dot';
        dot.style.backgroundColor = SNI_COLORS.ministries[min] || SNI_COLORS.primary;

        const span = document.createElement('span');
        span.innerText = min;

        label.appendChild(chk);
        label.appendChild(dot);
        label.appendChild(span);
        container.appendChild(label);
    });
}

function renderSourceFilters(sources) {
    const container = document.getElementById('filter-sources-container');
    if (!container) return;
    container.innerHTML = '';

    sources.forEach(src => {
        const label = document.createElement('label');
        label.className = 'sni-filter-checkbox-label';
        
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.value = src;
        chk.addEventListener('change', () => {
            if (chk.checked) {
                if (!sniState.selectedSources.includes(src)) sniState.selectedSources.push(src);
            } else {
                sniState.selectedSources = sniState.selectedSources.filter(s => s !== src);
            }
            triggerSNIUpdate();
        });

        const span = document.createElement('span');
        span.innerText = src;

        label.appendChild(chk);
        label.appendChild(span);
        container.appendChild(label);
    });
}

function resetAllSNIFilters() {
    sniState.selectedYears = [];
    sniState.selectedRegions = [];
    sniState.selectedMinistries = [];
    sniState.selectedSources = [];
    sniState.selectedSubtitles = [];

    // Reset visual checkboxes & chips
    document.querySelectorAll('.sni-year-chip').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('#filter-regions-container input').forEach(c => c.checked = false);
    document.querySelectorAll('#filter-ministries-container input').forEach(c => c.checked = false);
    document.querySelectorAll('#filter-sources-container input').forEach(c => c.checked = false);

    triggerSNIUpdate();
}

function triggerSNIUpdate() {
    if (typeof updateSNIDashboard === 'function') {
        updateSNIDashboard();
    }
}

