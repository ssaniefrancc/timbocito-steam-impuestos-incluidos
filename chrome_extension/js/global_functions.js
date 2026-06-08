const walletBalance = getBalance();
const totalTaxes = getTotalTaxes();

// Procesa elementos en batches para no congelar la UI
function processBatch(elements, index, batchSize) {
    const end = Math.min(index + batchSize, elements.length);
    for (let i = index; i < end; i++) {
        setArgentinaPrice(elements[i]);
    }
    if (end < elements.length) {
        requestAnimationFrame(() => processBatch(elements, end, batchSize));
    }
}

function getPrices(type){
    let prices;
    if (type == "standard"){
        prices = Array.from(document.querySelectorAll(priceContainers));
        // Fix específico para obtener las DLCs sin descuento y que estas no hagan overlap con las DLCs con descuento
        let standardDlcPrices = document.querySelectorAll(`.game_area_dlc_price:not([${attributeName}])`);
        standardDlcPrices.forEach(dlcPrice => { 
            if(!dlcPrice.querySelector("div")){
                setArgentinaPrice(dlcPrice);
            }
        });
        // Procesar en batches de 20 para no bloquear el hilo principal
        processBatch(prices, 0, 20);
    } else if(type == "cart"){
        setTimeout(() => {
            return renderCart();
        },1000)
    } 
    else if(type == "search"){
        const divs = findPricesInSearch();
        divs.forEach(div => setArgentinaPrice(div));
    }
    else if(type == "wishlist"){
        // Reemplazamos setInterval por MutationObserver para evitar queries masivos cada 1s.
        // Además usamos :not([attributeName]) para saltear elementos ya procesados.
        const processWishlistPrices = () => {
            let divs = document.querySelectorAll(`div.Panel div:not([${attributeName}])`);
            divs.forEach(div => {
                if(div.innerText.slice(0,1) == "$" && div.children.length == 0) {
                    setArgentinaPrice(div);
                }
            });
        };

        processWishlistPrices(); // Primera pasada inmediata

        let wishlistDebounceTimer = null;
        const wishlistObserver = new MutationObserver(() => {
            clearTimeout(wishlistDebounceTimer);
            wishlistDebounceTimer = setTimeout(processWishlistPrices, 300);
        });

        wishlistObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
}

function getNeededWalletAmount(currentWalletAmount){
    return Math.ceil(currentWalletAmount / 5) * 5;
}

function setPaymentMethodName(){
    return "Tarjeta";
}

function renderCart(){
    let paymentMethod = setPaymentMethodName();
    let cotizacion = JSON.parse(localStorage.getItem('timbocito-cotizacion-tarjeta'));
    let exchangeRateTarjeta = cotizacion?.rate;

    if(!exchangeRateTarjeta){
        return;
    }

    let staticExchangeRate = exchangeRateTarjeta;

    provinceTaxes &&
    provinceTaxes.forEach(tax => {
        staticExchangeRate += parseFloat((staticExchangeRate * tax.value / 100).toFixed(2));
    })

    let cartContent = document.querySelector('.Panel.Focusable:has(+ .Panel.Focusable)')
    const cartContentSibling = cartContent.nextElementSibling;
    let cartSidebar = cartContentSibling && cartContentSibling.querySelector('div:has(> button.Primary)')

    if(cartSidebar && cartContent){

        let total = Array.from(cartSidebar.querySelectorAll('div:not(:has(*))')).find(element => element.innerText[0] == "$")
        if(total?.innerText){
            let totalWallet = stringToNumber(total)
            let totalWithCurrentPaymentMethod = calculateTaxesAndExchange(totalWallet,staticExchangeRate)
            let totalMixed = calculateTaxesAndExchange(totalWallet - walletBalance, staticExchangeRate)
            
            let estimatedTotalDisplay = walletBalance < parseFloat(totalWallet) ? "hide" : "show";
            let totalMixedDisplay = estimatedTotalDisplay == "hide" && walletBalance != 0 ? "show" : "hide";

            if(!document.querySelector('.timbocito_cart')){
                cartSidebar.insertAdjacentHTML('beforebegin', `
                
                <div class="steamcito_cart timbocito_cart">
                    <div class="timbocito_cart_wallet">
                        <p class="timbocito_cart_wallet_label">Total Exacto pagando con Steam Wallet</p>
                        <span class="timbocito_cart_wallet_value"></span>
                    </div>
                    <div class="timbocito_cart_currentmethod">
                        <p class="timbocito_cart_currentmethod_label">Total Aproximado pagando con ${paymentMethod} </p>
                        <span class="timbocito_cart_currentmethod_value"></span>
                    </div>
                    <div class="timbocito_cart_mixed">
                        <p class="timbocito_cart_mixed_label">Total Pagando con Steam Wallet + ${paymentMethod} </p>
                        <span class="timbocito_cart_mixed_value"></span>
                    </div>
                </div>

                <div class="timbocito_cart_exchangerate">
                    <p>Cotización aproximada con ${paymentMethod} </p>
                    <span class="exchangerate_value">1 USD ≈ ${numberToString(staticExchangeRate.toFixed(0))} ${emojiMate}</span>
                    <br>
                </div>        
                
                
                
                `)
            }

            let cartTotalWalletContainer = document.querySelector('.timbocito_cart_wallet_value');
            let cartTotalCurrentMethodContainer = document.querySelector('.timbocito_cart_currentmethod_value');
            let mixedWrapper = document.querySelector('.timbocito_cart_mixed');
            let cartTotalMixedContainer = document.querySelector('.timbocito_cart_mixed_value');
            
            cartTotalWalletContainer.innerText = `${numberToStringUsd(totalWallet)}`
            cartTotalCurrentMethodContainer.innerText = `${numberToString(totalWithCurrentPaymentMethod)}`
            cartTotalMixedContainer.innerText = `${numberToStringUsd(walletBalance)} + ${numberToString(totalMixed)}`

            if(totalMixedDisplay == "hide"){
                mixedWrapper.style.display = "none";
            } else{
                mixedWrapper.style.display = "block";
            }

            


        }

        let dynamicClasses = Array.from(cartContent.querySelectorAll('div:not(:has(*))'));
        let filteredDynamicClasses = dynamicClasses.filter(element => element.innerText[0] == "$")
        prices = filteredDynamicClasses
        prices.forEach(price => setArgentinaPrice(price));
        return;
    }
    else{
        return;
    }

}

async function getOwnedGames(){
    // Si el usuario está logueado
    if(document.querySelector("#header_wallet_balance")){
        let shouldRefreshOwnedList = evaluateDate('timbocito-owned-games',86400);
        if(shouldRefreshOwnedList){
            const ownedGames = await fetch(`/dynamicstore/userdata/?time=${Date.now()}`)
            const ownedGamesJSON = await ownedGames.json();
            if(ownedGamesJSON.rgOwnedApps && ownedGamesJSON.rgOwnedApps.length){
                const ownedGamesObject = {
                    games: ownedGamesJSON.rgOwnedApps,
                    date: Date.now()
                }
                localStorage.setItem('timbocito-owned-games',JSON.stringify(ownedGamesObject))
            }
        }
    } else{
        // El usuario no está logueado, limpiar la listita local
        localStorage.removeItem('timbocito-owned-games')
    }
}


async function setArgentinaPrice(price){
    // await getUsdExchangeRate(); Comento esta línea para prevenir actualizaciones innecesarias

    let selectedPaymentMethod = localStorage.getItem('metodo-de-pago') || "timbocito-cotizacion-tarjeta";
    let exchangeRate = JSON.parse(localStorage.getItem(selectedPaymentMethod))?.rate;

    // Si no hay cotización en localStorage, intentar obtenerla antes de renderizar
    if(!exchangeRate){
        await getUsdExchangeRate();
        exchangeRate = JSON.parse(localStorage.getItem(selectedPaymentMethod))?.rate;
    }

        // Ignoro los juegos sin precio (Ejemplo: F2Ps)
        if(price.innerText.includes('$') && exchangeRate){
            let baseNumericPrice = extractNumberFromString(price.innerText)
            price.dataset.originalPrice = baseNumericPrice;
            price.dataset.argentinaPrice = calculateTaxesAndExchange(baseNumericPrice,exchangeRate);
            renderPrices(price);
        }
}

function sanitizePromoLists(){
    let items = document.querySelectorAll('.promo_item_list .price br');
    items.forEach(item => item.remove());
}

function renderPrices(price){

    let argentinaPrice = numberToString(price.dataset.argentinaPrice);
    let originalPrice = numberToStringUsd(price.dataset.originalPrice);

    // Evitar agregar listeners duplicados
    if(!price.dataset.listenerAttached){
        price.addEventListener('click',showSecondaryPrice); 
        price.dataset.listenerAttached = '1';
    }
    price.style.cursor="pointer";

    // Fix para contenedores que intercalan un BR entre precio original y precio en oferta 
    price.classList.contains("was") && sanitizePromoLists();
    
    // Los precios del bloque regional siempre se muestran inicialmente en USD
    let forceUsd = price.classList.contains("regional-meter-price");

    // Si el saldo te alcanza para comprar el juego
    if(forceUsd || walletBalance > parseFloat(price.dataset.originalPrice)){
        price.innerHTML = originalPrice + (forceUsd ? "" : emojiWallet);
        price.classList.add("original");

        // Si tiene un descuento
        if(price.previousElementSibling){
            if(isInsideString(price.previousElementSibling,"$")){
                price.previousElementSibling.classList.add('original');
                price.previousElementSibling.classList.remove('argentina');
                price.previousElementSibling.innerText = numberToStringUsd(price.previousElementSibling.dataset.originalPrice);
            }
        }
    }

    // Si el saldo no alcanza
    else{
        price.innerHTML = argentinaPrice + emojiMate;
        price.classList.add("argentina");

        if(price.previousElementSibling){
            if(isInsideString(price.previousElementSibling,"$")){
                price.previousElementSibling.classList.remove('original');
                price.previousElementSibling.classList.add('argentina');
                price.previousElementSibling.innerText = numberToString(price.previousElementSibling.dataset.argentinaPrice); 
            }
        }
    }

    // Fix para reprocesar bundles dinámicos cuyo precio se carga de manera asíncrona
    // Protección contra ciclo recursivo: solo intentar una vez por elemento
    if(!price.dataset.bundleRetried){
        price.dataset.bundleRetried = '1';
        setTimeout(function(){
            // Usamos '₲' (Guaraní) y 'USD$' porque este fork es para Paraguay
            if(price.classList.contains('argentina') && !price.innerText.includes("₲") &&  (price.closest('.dynamic_bundle_description') || price.closest('div[data-bundlediscount]'))){
                setArgentinaPrice(price);
            }

            if(price.classList.contains('original') && !price.innerText.includes("USD$") && price.closest('.dynamic_bundle_description')){
                setArgentinaPrice(price);
            }
        },1500)
    }

}

function showSecondaryPrice(e){
    e.preventDefault();
    let selectedPrice = e.currentTarget;
    selectedPrice.classList.add("transition-effect");
    selectedPrice.style.opacity = 0;
    if(selectedPrice.classList.contains("argentina")){
        switchPrices(selectedPrice,"argentina","original",emojiWallet);
    }
    else if(selectedPrice.classList.contains("original")){
        switchPrices(selectedPrice,"original","argentina",emojiMate);
    }
}

function switchPrices(selector,first,second,symbol){
    setTimeout(function(){
        selector.style.opacity=1;
        selector.classList.remove(first);
        selector.classList.add(second);

        if(selector.classList.contains("suscription-price")){
            selector.innerHTML = numberToStringSub(selector.dataset[second+"Price"]) + symbol;
        } else{
            selector.innerHTML = first == "argentina" ? numberToStringUsd(selector.dataset[second+"Price"]) + symbol : numberToString(selector.dataset[second+"Price"]) + symbol  ;
        }            
    },250);
}



function evaluateDate(localStorageItem, seconds = 900){
    if(localStorage.getItem(localStorageItem)){
        let exchangeRateJSON = JSON.parse(localStorage.getItem(localStorageItem))
        let savedTimestamp = Math.floor(parseInt(exchangeRateJSON.date) / 1000);
        let currentTimestamp = Math.floor(Date.now()/1000);
        let difference = currentTimestamp - savedTimestamp;
        if(difference >= seconds){
            return true;
        } else{
            return false;
        }
    }
    return true;
}

// processExchangeRate() — Eliminada: función legacy del curator original que ya no se usa en este fork.


async function getUsdExchangeRate(force = false){
    // Si no se fuerza la actualización, solo actualizar si pasaron más de 6 horas
    if(!force){
        let shouldRefresh = evaluateDate('timbocito-cotizacion-tarjeta', 21600);
        if(!shouldRefresh) return;
    }

    try {
        // Usamos una API gratuita y pública para obtener USD -> PYG
        const response = await fetch('https://open.er-api.com/v6/latest/USD');
        const data = await response.json();

        if(data.result === "success" && data.rates.PYG){
            const pygRate = data.rates.PYG;
            const updateDate = new Date().toLocaleString("es-PY");

            const exchangeRateJSON = {
                rate : pygRate,
                taxAmount: 10, // IVA Paraguay
                rateDateProvided: updateDate,
                date: Date.now()
            };

            // Guardamos la misma cotización para todos los métodos para simplificar en Paraguay
            localStorage.setItem('timbocito-cotizacion-tarjeta', JSON.stringify(exchangeRateJSON));
            localStorage.setItem('timbocito-cotizacion-crypto', JSON.stringify(exchangeRateJSON));
            localStorage.setItem('timbocito-cotizacion-mep', JSON.stringify(exchangeRateJSON));
            console.log("timbocito PY: Cotización actualizada correctamente", pygRate);
        }
    } catch (error) {
        console.error("timbocito PY: Error al obtener cotización, usando valor por defecto 6100", error);
        const fallbackJSON = {
            rate : 6100,
            taxAmount: 10,
            rateDateProvided: new Date().toLocaleString("es-PY"),
            date: Date.now()
        };
        localStorage.setItem('timbocito-cotizacion-tarjeta', JSON.stringify(fallbackJSON));
        localStorage.setItem('timbocito-cotizacion-crypto', JSON.stringify(fallbackJSON));
        localStorage.setItem('timbocito-cotizacion-mep', JSON.stringify(fallbackJSON));
    }
}


// getBnaExchangeRate() — Eliminada: función legacy del dólar argentino BNA que no se usa en este fork.


let currentDate = new Date();
const hoy = {
			day: currentDate.getDate(),
			month: currentDate.getMonth()+1,
			year: currentDate.getFullYear()
};

// Pasa de un stirng de iniciales de un mes al número de mes. Ejemplo: AGO (Agosto) será 8
function monthStrToNumber(month)
{
    if(month.indexOf(',')){
        let commaPosition = month.indexOf(',');
        let monthSanitized = commaPosition != -1 ? (month.slice(0,commaPosition)).toUpperCase() : month.toUpperCase();
        return ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"].indexOf(monthSanitized) + 1;
    } else{
        return ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"].indexOf(month) + 1;
    }
}

// Pasa de un string del formato 15 ENE 2023 a un json { day:15, month:1, year:2023}
function stringToDate(dateStr)
{
	let dateArr = dateStr.split(" ");
	return {
		day:Number(dateArr[0]),
		month:monthStrToNumber(dateArr[1]),
		year:Number(dateArr[2])
	};
}


function findPricesInSearch() {
    const searchElements = document.querySelectorAll('div[id*=searchSuggestion] a.Focusable div');
    const validPriceElements = [];

    searchElements.forEach(element => {
        if (element.querySelector('div')) return;
        const text = element.innerText.trim();
        const priceRegex = /^\$\d+\.\d{2}$/;
        if (priceRegex.test(text)) {
            validPriceElements.push(element);
        }
    });
    // console.log('Elementos con precios válidos encontrados:', validPriceElements);
    return validPriceElements;
}


getOwnedGames();

// La ejecución de getPrices() se delega a los triggers específicos de cada página
// (trigger.js, cart_trigger.js, wishlist_trigger.js, search.js)
// para evitar doble ejecución al cargar.