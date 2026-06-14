// Corro función por primera vez
(async() => {
    await getUsdExchangeRate();
    getPrices("wishlist");
    getPrices("standard");
    getPrices("search");
  
    // Debounce: evita ejecutar getPrices en cada micro-cambio del DOM
    let debounceTimer = null;
    function debouncedGetPrices() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            getPrices("wishlist");
            getPrices("standard");
            getPrices("search");
        }, 300);
    }

    MutationObserver = window.MutationObserver || window.WebKitMutationObserver;

    const observer = new MutationObserver(function(mutations) {
        debouncedGetPrices();
    });
  
    observer.observe(document, {
      subtree: true,
      childList: true,
      characterData: true
    });
  
  })();