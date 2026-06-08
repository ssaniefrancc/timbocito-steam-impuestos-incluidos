// Inicialización para la página de búsqueda
(async() => {
    await getUsdExchangeRate();
    getPrices("search");
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