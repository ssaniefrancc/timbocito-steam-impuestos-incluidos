// Corro función por primera vez
(async() => {
    await getUsdExchangeRate();
    getPrices("cart");
  
    // Debounce: evita ejecutar getPrices en cada micro-cambio del DOM
    let debounceTimer = null;
    function debouncedGetPrices() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => getPrices("cart"), 300);
    }

    MutationObserver = window.MutationObserver || window.WebKitMutationObserver;

    // Solo observamos nodos nuevos (childList), NO characterData.
    // Steam cambia characterData constantemente (tooltips, contadores),
    // lo que causaba que getPrices se ejecutara cientos de veces por segundo.
    const observer = new MutationObserver(function(mutations) {
        const hasNewNodes = mutations.some(m => m.addedNodes.length > 0);
        if (hasNewNodes) debouncedGetPrices();
    });
  
    observer.observe(document, {
      subtree: true,
      childList: true
    });
  
  })();