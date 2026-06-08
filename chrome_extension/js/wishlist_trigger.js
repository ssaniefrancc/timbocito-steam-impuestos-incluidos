// Corro función por primera vez
(async() => {
    await getUsdExchangeRate();
    getPrices("wishlist");
  
    // Debounce: evita ejecutar getPrices en cada micro-cambio del DOM
    let debounceTimer = null;
    function debouncedGetPrices() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => getPrices("wishlist"), 300);
    }

    MutationObserver = window.MutationObserver || window.WebKitMutationObserver;

    // Solo observamos nodos nuevos (childList), NO characterData.
    const observer = new MutationObserver(function(mutations) {
        const hasNewNodes = mutations.some(m => m.addedNodes.length > 0);
        if (hasNewNodes) debouncedGetPrices();
    });
  
    observer.observe(document, {
      subtree: true,
      childList: true
    });
  
  })();