// ─── static/js/Landing/about.js ──────────────────────────────────────────────
// Arranque de "Acerca del Observatorio" (acerca.html): objetivos, equipo y
// créditos fotográficos, con el header y las apariciones al hacer scroll del
// landing. Todo el contenido viene de LandingCommon (common.js).
document.addEventListener('DOMContentLoaded', () => {
    LandingCommon.renderObjectives();
    LandingCommon.renderAuthors();
    LandingCommon.renderPhotoCredits();

    LandingCommon.createIcons();
    LandingCommon.wireHeader();
    LandingCommon.wireReveal();
});
