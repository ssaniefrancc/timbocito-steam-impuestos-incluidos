let walletBalance = getBalance();
const totalTaxes = getTotalTaxes();

// Mantiene una sola cola de precios para que las actualizaciones del DOM no
// creen cadenas de requestAnimationFrame paralelas.
const pendingPrices = new Set();
const renderedPrices = new Set();
const manuallySwitchedPrices = new WeakSet();
let priceBatchScheduled = false;
let repaintExchangeRate;

function processBatch(idleDeadline) {
    priceBatchScheduled = false;
    let processed = 0;
    const maxPerBatch = 8;

    while (pendingPrices.size && processed < maxPerBatch) {
        if (processed > 0 && idleDeadline && !idleDeadline.didTimeout
            && idleDeadline.timeRemaining() < 2) break;
        const price = pendingPrices.values().next().value;
        pendingPrices.delete(price);
        if (price.isConnected) {
            if (hasRenderedPrice(price)) repaintPrice(price);
            else if (!price.hasAttribute(attributeName)) setArgentinaPrice(price);
        }
        processed++;
    }

    if (pendingPrices.size) schedulePriceBatch();
    else repaintExchangeRate = undefined;
}

function schedulePriceBatch() {
    if (priceBatchScheduled) return;
    priceBatchScheduled = true;
    if (window.requestIdleCallback) {
        window.requestIdleCallback(processBatch, {timeout: 100});
    } else {
        requestAnimationFrame(processBatch);
    }
}

function queuePrices(elements) {
    elements.forEach(price => {
        if (price?.isConnected && !price.hasAttribute(attributeName)) pendingPrices.add(price);
    });
    if (pendingPrices.size) schedulePriceBatch();
}

function hasRenderedPrice(price) {
    return price.dataset.listenerAttached && price.hasAttribute(attributeName)
        && price.childElementCount === 1 && price.lastElementChild.classList.contains('emojis');
}

function queueRenderedPrices() {
    for (const price of renderedPrices) {
        if (price.isConnected) pendingPrices.add(price);
        else renderedPrices.delete(price);
    }
    if (pendingPrices.size) schedulePriceBatch();
}

function forgetRemovedPrices(removedNodes) {
    if (!renderedPrices.size) return;
    for (const node of removedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE || node.isConnected) continue;
        renderedPrices.delete(node);
        if (!node.childElementCount) continue;
        node.querySelectorAll(`[${attributeName}]`).forEach(price => renderedPrices.delete(price));
    }
}

function restoreRenderedPrices(root) {
    for (const price of queryWithin(root, `[${attributeName}][data-listener-attached]`)) {
        if (renderedPrices.has(price) || !hasRenderedPrice(price) || price.classList.contains('regional-meter-price')) continue;
        renderedPrices.add(price);
        pendingPrices.add(price);
        repaintExchangeRate ??= getCachedExchangeRate()?.rate;
    }
    if (pendingPrices.size) schedulePriceBatch();
}

function updateWalletBalance() {
    const newBalance = getBalance();
    if (newBalance === walletBalance) return;
    walletBalance = newBalance;
    queueRenderedPrices();
}

function observeWalletBalance() {
    if (localStorage.getItem('manual-mode')) return;
    const balanceContainer = getWalletBalanceElement()?.parentElement;
    const header = document.querySelector('#global_header');
    if (!header && !balanceContainer) return;

    const walletSelector = '#header_wallet_balance, a[href*="store.steampowered.com/account"]';
    const observer = new MutationObserver(mutations => {
        if (mutations.some(({target, addedNodes, removedNodes}) => {
            const element = target.nodeType === Node.ELEMENT_NODE ? target : target.parentElement;
            return element?.closest(walletSelector) || [...addedNodes, ...removedNodes].some(node =>
                node.nodeType === Node.ELEMENT_NODE && (node.matches(walletSelector) || node.querySelector(walletSelector)));
        })) updateWalletBalance();
    });
    const options = {childList: true, characterData: true, subtree: true};
    if (header) observer.observe(header, options);
    if (balanceContainer && !header?.contains(balanceContainer)) observer.observe(balanceContainer, options);
}

observeWalletBalance();

function queryWithin(root, selector) {
    const matches = [];
    if (root instanceof Element && root.matches(selector)) matches.push(root);
    if (root.querySelectorAll) matches.push(...root.querySelectorAll(selector));
    return matches;
}

function getPrices(type, root = document){
    let prices;
    if (type == "standard"){
        prices = queryWithin(root, priceContainers);
        // Fix específico para obtener las DLCs sin descuento y que estas no hagan overlap con las DLCs con descuento
        let standardDlcPrices = queryWithin(root, `.game_area_dlc_price:not([${attributeName}])`);
        standardDlcPrices.forEach(dlcPrice => { 
            if(!dlcPrice.querySelector("div")){
                prices.push(dlcPrice);
            }
        });
        queuePrices(prices);
    } else if(type == "search"){
        const containingSearchRoot = root.closest?.('div[id*=searchSuggestion]');
        const searchRoots = containingSearchRoot
            ? [containingSearchRoot]
            : queryWithin(root, 'div[id*=searchSuggestion]');
        const divs = searchRoots.flatMap(searchRoot => queryWithin(searchRoot, 'a.Focusable div'))
            .filter(div => !div.querySelector('div') && /^\$\d+\.\d{2}$/.test(div.innerText.trim()));
        queuePrices(divs);
    }
    else if(type == "wishlist"){
        let divs = queryWithin(root, `div.Panel div:not([${attributeName}])`);
        divs.forEach(div => {
            if(div.innerText.slice(0,1) == "$" && div.children.length == 0) {
                prices = prices || [];
                prices.push(div);
            }
        });
        queuePrices(prices || []);
    }
}

function observePriceMutations(types, {delay = 150} = {}) {
    const observesStandardPrices = types.includes('standard');
    let timer = null;
    const roots = new Set();
    const observer = new MutationObserver(mutations => {
        for (const mutation of mutations) {
            const target = mutation.target.nodeType === Node.ELEMENT_NODE
                ? mutation.target
                : mutation.target.parentElement;
            if (!target || target.closest('.timbocito_cart, .menu-timbocito, .menu-timbocito-background')) continue;

            const convertedPrice = target.closest(`[${attributeName}]`);
            if (convertedPrice) {
                // Steam puede reutilizar una tarjeta y escribir el importe directamente en su nodo.
                if (observesStandardPrices && convertedPrice.matches(saleWidgetPriceContainers)
                    && !convertedPrice.lastElementChild?.classList.contains('emojis')) {
                    convertedPrice.removeAttribute(attributeName);
                    renderedPrices.delete(convertedPrice);
                    if (usdPricePattern.test(convertedPrice.textContent.trim())) roots.add(convertedPrice);
                }
                continue;
            }

            forgetRemovedPrices(mutation.removedNodes);

            let foundElement = false;
            mutation.addedNodes.forEach(node => {
                if (node.nodeType !== Node.ELEMENT_NODE) return;
                if (node.matches('.timbocito_cart, .menu-timbocito, .menu-timbocito-background')) return;
                roots.add(node);
                foundElement = true;
            });
            // Steam también reemplaza solo el texto de un precio ya existente.
            if ((!foundElement || target.matches(saleWidgetPriceContainers)) && target.matches(priceContainers)) {
                roots.add(target);
            }
        }
        if (!roots.size) return;
        if (timer !== null) return;
        timer = setTimeout(() => {
            timer = null;
            const pendingRoots = [...roots].filter(root => {
                if (!root.isConnected) return false;
                if (!observesStandardPrices) return true;
                for (let parent = root.parentElement; parent; parent = parent.parentElement) {
                    if (roots.has(parent)) return false;
                }
                return true;
            });
            roots.clear();
            pendingRoots.forEach(restoreRenderedPrices);
            const processedSearchRoots = new Set();
            const processedWishlistPanels = new Set();
            pendingRoots.forEach(root => types.forEach(type => {
                if (!root.isConnected) return;
                if (type === "wishlist") {
                    const panel = root.closest?.('div.Panel');
                    const scanRoot = panel || root;
                    if (processedWishlistPanels.has(scanRoot)) return;
                    processedWishlistPanels.add(scanRoot);
                    getPrices(type, scanRoot);
                    return;
                }
                if (type === "search") {
                    const searchRoot = root.closest?.('div[id*=searchSuggestion]');
                    if (searchRoot) {
                        if (processedSearchRoots.has(searchRoot)) return;
                        processedSearchRoots.add(searchRoot);
                        getPrices(type, searchRoot);
                        return;
                    }
                    getPrices(type, root);
                    return;
                }
                getPrices(type, root);
            }));
        }, delay);
    });
    observer.observe(document, {subtree: true, childList: true, characterData: observesStandardPrices});
    return observer;
}

async function setArgentinaPrice(price){
    let selectedPaymentMethod = localStorage.getItem('metodo-de-pago') || "timbocito-cotizacion-tarjeta";
    let exchangeRate = JSON.parse(localStorage.getItem(selectedPaymentMethod))?.rate;

    // Si no hay cotización en localStorage, intentar obtenerla antes de renderizar
    if(!exchangeRate){
        await getUsdExchangeRate();
        exchangeRate = JSON.parse(localStorage.getItem(selectedPaymentMethod))?.rate;
    }

    // Steam puede montar el carrusel entre la detección del nodo y el renderizado del lote.
    if (price.closest(discountsAndEventsModule) && !price.matches(discountsAndEventsPrice)) return;

    const isSaleWidgetPrice = price.matches(saleWidgetPriceContainers);
    const priceText = isSaleWidgetPrice ? price.textContent.trim() : price.innerText;
    if ((isSaleWidgetPrice ? usdPricePattern.test(priceText) : priceText.includes('$')) && exchangeRate) {
        const baseNumericPrice = extractNumberFromString(priceText);
        price.dataset.originalPrice = baseNumericPrice;
        price.dataset.argentinaPrice = calculateTaxesAndExchange(baseNumericPrice, exchangeRate);
        manuallySwitchedPrices.delete(price);
        renderPrices(price);
    }
}

function sanitizePromoLists(){
    let items = document.querySelectorAll('.promo_item_list .price br');
    items.forEach(item => item.remove());
}

function getPairedDiscountPrice(price) {
    const nextPrice = price.nextElementSibling;
    if (!nextPrice) return;

    if ((price.matches('.discount_original_price') && nextPrice.matches('.discount_final_price'))
        || (price.matches(discountsAndEventsPrice) && nextPrice.matches(discountsAndEventsPrice))
        || (price.matches('.StoreSalePriceWidgetContainer.Discounted > div > div')
            && nextPrice.matches('.StoreSalePriceWidgetContainer.Discounted > div > div'))) {
        const text = nextPrice.textContent.trim();
        if (usdPricePattern.test(text) || nextPrice.hasAttribute(attributeName)) return nextPrice;
    }
}

function displayPrice(price, showUsd, forceUsd = false) {
    price.innerHTML = showUsd
        ? numberToStringUsd(price.dataset.originalPrice) + (forceUsd ? '' : emojiWallet)
        : numberToString(price.dataset.argentinaPrice) + emojiMate;
    price.classList.toggle('original', showUsd);
    price.classList.toggle('argentina', !showUsd);
}

function repaintPrice(price) {
    const forceUsd = price.classList.contains('regional-meter-price');
    const discountedPrice = getPairedDiscountPrice(price);
    const currentAmount = discountedPrice
        ? discountedPrice.dataset.originalPrice ?? extractNumberFromString(discountedPrice.textContent)
        : price.dataset.originalPrice;
    const automaticUsd = forceUsd || (walletBalance > 0 && walletBalance >= Number(currentAmount));
    const wasUsd = price.classList.contains('original');
    const showUsd = manuallySwitchedPrices.has(price) ? wasUsd : automaticUsd;
    const convertedAmount = repaintExchangeRate
        ? calculateTaxesAndExchange(price.dataset.originalPrice, repaintExchangeRate)
        : price.dataset.argentinaPrice;
    const amountChanged = convertedAmount !== price.dataset.argentinaPrice;
    if (amountChanged) price.dataset.argentinaPrice = convertedAmount;
    if (!hasRenderedPrice(price) || wasUsd !== showUsd || (amountChanged && !showUsd)) {
        displayPrice(price, showUsd, forceUsd);
    }

    const previousPrice = price.previousElementSibling;
    if (previousPrice && hasRenderedPrice(previousPrice) && getPairedDiscountPrice(previousPrice) === price
        && !manuallySwitchedPrices.has(previousPrice) && previousPrice.classList.contains('original') !== automaticUsd) {
        displayPrice(previousPrice, automaticUsd);
    }
}

function renderPrices(price){

    // Evitar agregar listeners duplicados
    if(!price.dataset.listenerAttached){
        price.addEventListener('click',showSecondaryPrice); 
        price.dataset.listenerAttached = '1';
    }
    price.style.cursor="pointer";

    // Fix para contenedores que intercalan un BR entre precio original y precio en oferta 
    price.classList.contains("was") && sanitizePromoLists();
    
    repaintPrice(price);
    if (!price.classList.contains('regional-meter-price')) renderedPrices.add(price);

    // Fix para reprocesar bundles dinámicos cuyo precio se carga de manera asíncrona
    // Protección contra ciclo recursivo: solo intentar una vez por elemento
    if (!price.dataset.bundleRetried && price.closest('.dynamic_bundle_description, div[data-bundlediscount]')) {
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
    let selectedPrice = e.currentTarget;
    if (!selectedPrice.hasAttribute(attributeName)) return;
    e.preventDefault();
    manuallySwitchedPrices.add(selectedPrice);
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



const exchangeRateKey = 'timbocito-cotizacion-tarjeta';
const exchangeRateLifetime = 21_600_000;
let exchangeRateRequest;
let exchangeRateRetryAfter = 0;
let exchangeRateStatusTimer;

function getCachedExchangeRate() {
    try {
        const cachedRate = JSON.parse(localStorage.getItem(exchangeRateKey));
        const rate = Number(cachedRate?.rate);
        return Number.isFinite(rate) && rate > 0 ? cachedRate : null;
    } catch {
        return null;
    }
}

function renderExchangeRateStatus(root = document) {
    const quote = getCachedExchangeRate();
    const obtainedAt = new Date(Number(quote?.date));
    let status = 'Cotización pendiente';
    if (quote) {
        if (Number(quote.date) === 0 || quote.rateDateProvided === 'Valor de referencia') {
            status = 'Valor de referencia · Sin cotización del proveedor';
        } else if (Number.isFinite(obtainedAt.getTime())) {
            const isPrevious = exchangeRateRetryAfter > 0 || Date.now() - obtainedAt.getTime() >= exchangeRateLifetime;
            const age = isPrevious ? 'Cotización anterior' : 'Cotización vigente';
            status = `${age} · Obtenida el ${obtainedAt.toLocaleString('es-PY')}`;
        } else {
            status = 'Cotización guardada · Fecha de obtención desconocida';
        }
    }

    root.querySelectorAll('[data-timbocito-rate-status]').forEach(element => {
        if (element.textContent !== status) element.textContent = status;
    });
    const rateLabel = quote ? `1 USD ≈ ${numberToString(quote.rate)}` : '';
    root.querySelectorAll('[data-timbocito-rate-value]').forEach(element => {
        if (element.textContent !== rateLabel) element.textContent = rateLabel;
    });
}

function updateExchangeRateStatus() {
    renderExchangeRateStatus();
    clearTimeout(exchangeRateStatusTimer);
    const remaining = Number(getCachedExchangeRate()?.date) + exchangeRateLifetime - Date.now();
    if (remaining > 0) exchangeRateStatusTimer = setTimeout(renderExchangeRateStatus, remaining);
}

function saveExchangeRate(rate, date) {
    const previousRate = Number(getCachedExchangeRate()?.rate);
    const value = JSON.stringify({
        rate,
        taxAmount: 10,
        rateDateProvided: date ? new Date(date).toLocaleString('es-PY') : 'Valor de referencia',
        date
    });
    localStorage.setItem(exchangeRateKey, value);
    localStorage.setItem('timbocito-cotizacion-crypto', value);
    localStorage.setItem('timbocito-cotizacion-mep', value);
    if (renderedPrices.size && rate !== previousRate) {
        repaintExchangeRate = rate;
        queueRenderedPrices();
    }
}

async function refreshExchangeRate() {
    try {
        const response = await fetch('https://open.er-api.com/v6/latest/USD');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const rate = data.rates?.PYG;
        if (data.result !== 'success' || !Number.isFinite(rate) || rate <= 0) {
            throw new Error('Cotización USD/PYG inválida');
        }
        saveExchangeRate(rate, Date.now());
        exchangeRateRetryAfter = 0;
    } catch (error) {
        exchangeRateRetryAfter = Date.now() + 60_000;
        if (!getCachedExchangeRate()) saveExchangeRate(6100, 0);
        console.warn('Timbocito PY: no se pudo actualizar la cotización', error);
    }
}

async function getUsdExchangeRate(force = false) {
    if (exchangeRateRequest) return exchangeRateRequest;
    const now = Date.now();
    const cachedRate = getCachedExchangeRate();
    if (!force && (now < exchangeRateRetryAfter || now - cachedRate?.date < exchangeRateLifetime)) {
        updateExchangeRateStatus();
        return;
    }

    exchangeRateRequest = refreshExchangeRate().finally(() => {
        exchangeRateRequest = undefined;
        updateExchangeRateStatus();
    });
    return exchangeRateRequest;
}

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


// La ejecución de getPrices() se delega a los triggers específicos de cada página
// (home.js, trigger.js, bundle_functions.js, wishlist_trigger.js, search.js)
// para evitar doble ejecución al cargar.
