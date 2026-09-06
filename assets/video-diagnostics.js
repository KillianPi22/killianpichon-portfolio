/* Diagnostic volontaire : ?video-debug=1. Mesures locales, aucune URL ni collecte. */
(() => {
  'use strict';
  if (new URLSearchParams(location.search).get('video-debug') !== '1') return;
  const panel = document.createElement('details');
  panel.className = 'kp-exploration-panel';
  panel.style.cssText = 'left:auto;right:18px;bottom:76px;max-height:45vh;overflow:auto';
  panel.innerHTML = '<summary>Diagnostic vidéo</summary><div class="kp-exploration-options"><p class="kp-exploration-note">Lance la vidéo, puis actualise les mesures. Elles restent sur ton appareil.</p><button type="button" data-video-measure>Actualiser</button><button type="button" data-video-copy>Copier les mesures</button><textarea readonly aria-label="Mesures du lecteur vidéo" rows="7"></textarea><p class="kp-exploration-note" role="status"></p></div>';
  const output = panel.querySelector('textarea');
  output.style.cssText = 'width:100%;min-width:0;resize:vertical;background:var(--void-900);color:var(--text-heading);border:1px solid var(--line-subtle);font:11px/1.5 var(--font-mono);padding:8px';
  const status = panel.querySelector('[role="status"]');
  function measure() {
    const frame = document.querySelector('.project-video-player');
    const iframe = frame?.querySelector('iframe');
    const rect = element => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return { largeur: Math.round(box.width), hauteur: Math.round(box.height), gauche: Math.round(box.left), droite: Math.round(box.right) };
    };
    // Ni chemin de projet, ni source du media, ni donnees du document externe.
    const report = {
      version: 'video-fit-3',
      cadrageDrive: frame?.dataset.driveFit || 'standard',
      fenetre: document.documentElement.clientWidth,
      page: document.documentElement.scrollWidth,
      ecranVisible: window.visualViewport ? Math.round(window.visualViewport.width) : null,
      zoom: window.visualViewport ? Number(window.visualViewport.scale.toFixed(2)) : null,
      colonne: rect(frame?.parentElement),
      cadre: rect(frame),
      lecteur: rect(iframe),
      dimensionsFixees: iframe ? [iframe.getAttribute('width'), iframe.getAttribute('height')] : null
    };
    output.value = JSON.stringify(report, null, 2);
    status.textContent = iframe ? 'Mesures actualisées.' : 'Ouvre une vidéo dans la grille pour mesurer son lecteur.';
    return output.value;
  }
  panel.addEventListener('toggle', () => { if (panel.open) measure(); });
  panel.querySelector('[data-video-measure]').addEventListener('click', measure);
  panel.querySelector('[data-video-copy]').addEventListener('click', async () => {
    const report = measure();
    try {
      await navigator.clipboard.writeText(report);
      status.textContent = 'Mesures copiées. Tu peux les coller dans la conversation.';
    } catch {
      output.focus(); output.select();
      status.textContent = 'Copie le texte sélectionné pour le coller dans la conversation.';
    }
  });
  document.body.append(panel);
})();
