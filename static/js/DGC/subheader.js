// Subheader view switcher (Mapa / Líneas de Tiempo / Inversión / Contratos / Oferentes)

function setActiveSubheaderTab(activeId) {
    const btnMap = document.getElementById('btn-view-map');
    const btnTl  = document.getElementById('btn-view-timeline');
    const btnInv = document.getElementById('btn-view-investment');
    const btnCnt = document.getElementById('btn-view-contracts');
    const btnBid = document.getElementById('btn-view-bidders');
    if (btnMap) btnMap.classList.toggle('active', activeId === 'map');
    if (btnTl)  btnTl.classList.toggle('active', activeId === 'timeline');
    if (btnInv) btnInv.classList.toggle('active', activeId === 'investment');
    if (btnCnt) btnCnt.classList.toggle('active', activeId === 'contracts');
    if (btnBid) btnBid.classList.toggle('active', activeId === 'bidders');
}

function initSubheaderViewSwitcher() {
    const btnMap = document.getElementById('btn-view-map');
    const btnTl  = document.getElementById('btn-view-timeline');
    const btnInv = document.getElementById('btn-view-investment');
    const btnCnt = document.getElementById('btn-view-contracts');
    const btnBid = document.getElementById('btn-view-bidders');

    if (btnMap) {
        btnMap.addEventListener('click', () => {
            if (typeof hideTimelineView === 'function') hideTimelineView();
            if (typeof hideInvestmentView === 'function') hideInvestmentView();
            if (typeof hideContractsView === 'function') hideContractsView();
            if (typeof hideBiddersView === 'function') hideBiddersView();
            setActiveSubheaderTab('map');
        });
    }

    if (btnTl) {
        btnTl.addEventListener('click', () => {
            if (typeof hideInvestmentView === 'function') hideInvestmentView();
            if (typeof hideContractsView === 'function') hideContractsView();
            if (typeof hideBiddersView === 'function') hideBiddersView();
            if (typeof showTimelineView === 'function') showTimelineView();
            setActiveSubheaderTab('timeline');
        });
    }

    if (btnInv) {
        btnInv.addEventListener('click', () => {
            if (typeof hideTimelineView === 'function') hideTimelineView();
            if (typeof hideContractsView === 'function') hideContractsView();
            if (typeof hideBiddersView === 'function') hideBiddersView();
            if (typeof showInvestmentView === 'function') showInvestmentView();
            setActiveSubheaderTab('investment');
        });
    }

    if (btnCnt) {
        btnCnt.addEventListener('click', () => {
            if (typeof hideTimelineView === 'function') hideTimelineView();
            if (typeof hideInvestmentView === 'function') hideInvestmentView();
            if (typeof hideBiddersView === 'function') hideBiddersView();
            if (typeof showContractsView === 'function') showContractsView();
            setActiveSubheaderTab('contracts');
        });
    }

    if (btnBid) {
        btnBid.addEventListener('click', () => {
            if (typeof hideTimelineView === 'function') hideTimelineView();
            if (typeof hideInvestmentView === 'function') hideInvestmentView();
            if (typeof hideContractsView === 'function') hideContractsView();
            if (typeof showBiddersView === 'function') showBiddersView();
            setActiveSubheaderTab('bidders');
        });
    }
}
