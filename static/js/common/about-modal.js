// ─── static/js/common/about-modal.js ──────────────────────────────────────────
// Controlador del modal "Acerca de" compartido por los dashboards CATLEC.
// Reemplaza las ~6 copias casi idénticas del mismo controlador (abrir/cerrar,
// cerrar al hacer clic afuera, cerrar con Escape) que existían antes, una por
// módulo. El contenido interno del modal (fuentes, metodología, autores) sigue
// viviendo en cada HTML — solo se centraliza el mecanismo de apertura/cierre.
window.CatlecAboutModal = {
    init() {
        const btnOpen = document.getElementById('btn-open-about');
        const btnClose = document.getElementById('btn-close-about-modal');
        const modal = document.getElementById('about-modal');
        if (!modal) return;

        function open() {
            modal.style.display = 'flex';
            if (window.lucide) lucide.createIcons();
        }
        function close() {
            modal.style.display = 'none';
        }

        btnOpen?.addEventListener('click', e => { e.preventDefault(); open(); });
        btnClose?.addEventListener('click', e => { e.preventDefault(); close(); });
        modal.addEventListener('click', e => { if (e.target === modal) close(); });
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && modal.style.display === 'flex') close(); });
    }
};
