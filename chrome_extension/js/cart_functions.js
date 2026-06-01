(async() => {
    await getUsdExchangeRate();

    let oldCart = document.querySelector(".estimated_total_box");
    let walletElement = document.querySelector('#cart_estimated_total');
    let cartTotal = getCartTotal();
    let cartTotalCreditCard = setCartTotalCC(cartTotal);
    let cartTotalMixed = setMixedCartTotal(cartTotal);

    function getCartTotal() {
        return stringToNumber(walletElement);
    }

    function setCartTotalCC(cartValue) {
        walletElement.dataset.currency = "usd";
        return calculateTaxesAndExchange(cartValue);
    }
    
    function setMixedCartTotal(cartValue) {
        if (walletBalance > 0) {
            walletElement.dataset.currency = "usd";
            return calculateTaxesAndExchange(cartValue - walletBalance);
        }
    }
    
    
    function showCart() {
        
        let estimatedTotalDisplay = walletBalance < parseFloat(cartTotal) ? "hide" : "show";
        let totalMixedDisplay = estimatedTotalDisplay == "hide" && walletBalance != 0 ? "show" : "hide";
    
        let newCart =
        `<div class="estimated_total_extension">
    
            <div class="total_wallet"> 
                <p>Total exacto pagando con Steam Wallet </p>
                <span class="green">${numberToStringUsd(cartTotal)} ${emojiWallet}</span>
            </div>
    
            <div class="total_cc">
                <p>Total aproximado pagando con Tarjeta</p>
                <span>${numberToString(cartTotalCreditCard)} ${emojiMate}</span>        
            </div>
    
            <div class="total_mixed ${totalMixedDisplay}">
                <p>Total aproximado pagando con Steam Wallet + Tarjeta</p>
                <span> <span class="green">${numberToStringUsd(walletBalance)} ${emojiWallet} </span> + &nbsp;${numberToString(cartTotalMixed)} ${emojiMate}</span>        
            </div>
    
        </div>`;
        oldCart.insertAdjacentHTML('afterbegin', newCart);
    }
    
    function showTaxes() {

        let cotizacionRaw = JSON.parse(localStorage.getItem('steamcito-cotizacion-tarjeta'));
        let staticExchangeRate = cotizacionRaw?.rate || 7500;
        let newExchangeRate = staticExchangeRate;

        standardTaxes &&
        standardTaxes.forEach(tax => {
            newExchangeRate += parseFloat((staticExchangeRate * tax.value / 100).toFixed(2));
        })

        provinceTaxes &&
        provinceTaxes.forEach(tax => {
            newExchangeRate += parseFloat((staticExchangeRate * tax.value / 100).toFixed(2));
        })


        let taxesContainer =
            `<div class="tax-container">

            <h3 class="main-title">Cotización estimada: 1 USD ≈ ${numberToString(newExchangeRate.toFixed(0))}</h3>
            <ul class="cotizacion-dolar">
                <li>Esta cotización incluye el IVA del 10% y otros cargos que tu banco pueda aplicar.</li>
            </ul>
            <span class="taxes-separator"></span>



            <h3>Impuestos Nacionales</h3>
            <ul class="impuestos-nacionales"></ul>
    
            <span class="taxes-separator"></span>
    
            <h3>Comisiones Bancarias / Recargos</h3>
            <ul class="impuestos-provinciales"></ul>  
            
            <span class="taxes-separator"></span>
    
            <div class="taxes-final-total">
                <span class="final-total">Total de Impuestos: ${((totalTaxes - 1) * 100).toFixed(2)}%</span>
                <p id="tax-change">Personalizar impuestos</p>
            </div>
    
        </div>`;
        oldCart.insertAdjacentHTML('afterend', taxesContainer);
    
        taxes.forEach(tax => showFullInfo(tax, "national"));
        provinceTaxes && provinceTaxes.forEach(tax => showFullInfo(tax, "province"));
    
        function showFullInfo(tax, type) {
            let taxList = `
            <li>
                <p>${tax.name}</p>&nbsp;
                <a href="${tax.moreInfo}" target="_blank">
                    <span>(Boletín Oficial)</span>
                </a>
                <p class="value">${tax.value}%</p>
            </li>
            `
            if (type == "national") {
                document.querySelector(".tax-container ul.impuestos-nacionales").insertAdjacentHTML('afterbegin', taxList);
            } else {
                document.querySelector(".tax-container ul.impuestos-provinciales").insertAdjacentHTML('afterbegin', taxList);
            }
        }
    }
    
    
    showCart();
    showTaxes();

    
    let taxChangeShortcut = document.querySelector("#tax-change");
    taxChangeShortcut.addEventListener('click', function () {
        setTimeout(function () {
            steamcitoIcon.click();
        }, 1);
    });

})();
