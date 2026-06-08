// Inicialización para la página de búsqueda
(async() => {
    await getUsdExchangeRate();
    getPrices("standard");
    getPrices("search");

    // Debounce: evita ejecutar getPrices en cada micro-cambio del DOM
    let debounceTimer = null;
    function debouncedGetPrices() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => getPrices("standard"), 300);
    }

    let MutationObserverRef = window.MutationObserver || window.WebKitMutationObserver;

    const observer = new MutationObserverRef(function(mutations) {
        const hasNewNodes = mutations.some(m => m.addedNodes.length > 0);
        if (hasNewNodes) debouncedGetPrices();
    });

    observer.observe(document, {
        subtree: true,
        childList: true
    });

    // Observador de contenedor de Search (dropdown de sugerencias)
    const searchDiv = document.querySelector('div[id*="searchSuggestion"]');
    if (searchDiv) {
        let searchDebounceTimer = null;
        const searchObserver = new MutationObserverRef(() => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => getPrices("search"), 300);
        });

        searchObserver.observe(searchDiv, {
            childList: true,
            subtree: true
        });
    }
})();

function changeRangeValue() {
    let currentNumber = document.querySelector('input#maxprice_input');

    if (!isNaN(currentNumber.value) && currentNumber.value) {
        let exchangeRate = JSON.parse(localStorage.getItem('timbocito-cotizacion-tarjeta'))?.rate || 6100;
        if (rangeDisplayTexttimbocito) {
            rangeDisplayTexttimbocito.innerText = `Menos de ₲ ${Math.round(currentNumber.value * exchangeRate * totalTaxes)} 🧉`;
        }
    } else {
        if (rangeDisplayTexttimbocito) {
            rangeDisplayTexttimbocito.innerText = "";
        }
    }
}

let rangeInput = document.querySelector('input#price_range');
let rangeDisplayText = document.querySelector('#price_range_display');
if (rangeDisplayText) {
    rangeDisplayText.insertAdjacentHTML('afterend', `<p class="range_display range_display_timbocito"></p>`);
}
let rangeDisplayTexttimbocito = document.querySelector('.range_display_timbocito');

if (rangeInput) {
    rangeInput.addEventListener('input', changeRangeValue);
}