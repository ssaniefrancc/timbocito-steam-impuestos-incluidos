// Inicialización y observación incremental de resultados y sugerencias.
(async () => {
    await getUsdExchangeRate();
    getPrices("standard");
    getPrices("search");
    observePriceMutations(["standard", "search"]);
})();

function changeRangeValue() {
    let currentNumber = document.querySelector('input#maxprice_input');

    if (!isNaN(currentNumber.value) && currentNumber.value) {
        let exchangeRate = JSON.parse(localStorage.getItem('timbocito-cotizacion-tarjeta'))?.rate || 6100;
        if (rangeDisplayTexttimbocito) {
            rangeDisplayTexttimbocito.innerText = `Menos de ₲ ${Math.round(currentNumber.value * exchangeRate * totalTaxes)} 🧉`;
        }
    } else if (rangeDisplayTexttimbocito) {
        rangeDisplayTexttimbocito.innerText = "";
    }
}

let rangeInput = document.querySelector('input#price_range');
let rangeDisplayText = document.querySelector('#price_range_display');
if (rangeDisplayText && !document.querySelector('.range_display_timbocito')) {
    rangeDisplayText.insertAdjacentHTML('afterend', `<p class="range_display range_display_timbocito"></p>`);
}
let rangeDisplayTexttimbocito = document.querySelector('.range_display_timbocito');

if (rangeInput) rangeInput.addEventListener('input', changeRangeValue);
