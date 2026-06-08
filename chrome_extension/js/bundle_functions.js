// Corro función por primera vez
(() => {
  setTimeout(async function(){
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
    const observer = new MutationObserver(function(mutations) {
        const hasNewNodes = mutations.some(m => m.addedNodes.length > 0);
        if (hasNewNodes) debouncedGetPrices();
    });
  
    observer.observe(document, {
      subtree: true,
      childList: true
    });
  },1500)
})();
