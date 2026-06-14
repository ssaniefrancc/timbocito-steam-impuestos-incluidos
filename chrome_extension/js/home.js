// Inicialización para la página Home de Steam
// Ejecuta getPrices('standard') que antes se llamaba desde global_functions.js
(async() => {
    await getUsdExchangeRate();
    getPrices("standard");
    getPrices("search");

    let debounceTimer = null;
    function debouncedGetPrices() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            getPrices("standard");
            getPrices("search");
        }, 300);
    }

    const MutationObserverRef = window.MutationObserver || window.WebKitMutationObserver;
    const observer = new MutationObserverRef(function(mutations) {
        debouncedGetPrices();
    });

    observer.observe(document, {
        subtree: true,
        childList: true,
        characterData: true
    });
})();

function getOwnedArgentinaGames(){
    return; // Deshabilitado para Paraguay
}