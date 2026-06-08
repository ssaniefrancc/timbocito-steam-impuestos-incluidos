// Corro función por primera vez
(async() => {
  await getUsdExchangeRate();
  getPrices("standard");

  // Debounce: evita ejecutar getPrices en cada micro-cambio del DOM
  let debounceTimer = null;
  function debouncedGetPrices() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => getPrices("standard"), 300);
  }

  MutationObserver = window.MutationObserver || window.WebKitMutationObserver;

  // Solo observamos nodos nuevos (childList), NO atributos.
  // Steam cambia atributos constantemente (tooltips, animaciones, hover states),
  // lo que antes causaba que getPrices se ejecutara cientos de veces por segundo.
  const observer = new MutationObserver(function(mutations) {
    const hasNewNodes = mutations.some(m => m.addedNodes.length > 0);
    if (hasNewNodes) debouncedGetPrices();
  });

  observer.observe(document, {
    subtree: true,
    childList: true
  });

  // Observador de contenedor de Search
  const searchDiv = document.querySelector('div[id*="searchSuggestion"]');
  if (searchDiv) {
      let searchDebounceTimer = null;
      const searchObserver = new MutationObserver(() => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => getPrices("search"), 300);
      });

      searchObserver.observe(searchDiv, {
          childList: true,
          subtree: true
      });
  }
})();