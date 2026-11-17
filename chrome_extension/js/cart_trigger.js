const checkoutControls = 'button, a[aria-disabled]';
const cartProductLinks = 'a[href*="/app/"], a[href*="/sub/"], a[href*="/bundle/"]';
const cartSummarySelector = '.timbocito-cart-summary';

function findCartSummary(root) {
    for (const control of root.querySelectorAll(checkoutControls)) {
        if (control.closest('header, dialog, #global_header') || !control.getClientRects().length) continue;
        const actions = control.parentElement;
        let box = actions;
        // El resumen separa el importe y el botón en bloques vecinos.
        for (let depth = 0; depth < 3 && box && box !== root; depth++, box = box.parentElement) {
            if (box.querySelector(cartProductLinks)) break;
            const total = [...box.querySelectorAll('div:not(:has(*))')].find(element =>
                !element.closest(cartSummarySelector) && usdPricePattern.test(element.textContent.trim()));
            if (total) return {box, actions, total};
        }
    }
}

function renderCart() {
    const root = document.querySelector('#StoreTemplate') || document.body;
    const summary = findCartSummary(root);
    const rate = getCachedExchangeRate()?.rate;
    let panel = root.querySelector(cartSummarySelector);
    if (panel && (!summary || panel.nextElementSibling !== summary.actions)) {
        panel.remove();
        panel = null;
    }
    if (!summary || !rate) return;

    const actualBalance = getBalance(false);
    updateWalletBalance();
    const total = Number(extractNumberFromString(summary.total.textContent));
    if (!panel) {
        summary.actions.insertAdjacentHTML('beforebegin', `
            <section class="timbocito-cart-summary">
                <div class="timbocito_cart">
                    <div class="timbocito_cart_wallet">
                        <p>Total exacto pagando con Steam Wallet</p>
                        <span class="timbocito_cart_wallet_value"></span>
                    </div>
                    <div>
                        <p>Total aproximado pagando con tarjeta</p>
                        <span class="timbocito_cart_currentmethod_value"></span>
                    </div>
                    <div class="timbocito_cart_mixed">
                        <p>Total pagando con Steam Wallet + tarjeta</p>
                        <span class="timbocito_cart_mixed_value"></span>
                    </div>
                </div>
                <div class="timbocito_cart_exchangerate">
                    <p>Cotización USD/PYG</p>
                    <span class="exchangerate_value"></span>
                    <p><small data-timbocito-rate-status></small></p>
                </div>
            </section>
        `);
        panel = summary.actions.previousElementSibling;
    }

    const wallet = panel.querySelector('.timbocito_cart_wallet');
    const mixed = panel.querySelector('.timbocito_cart_mixed');
    wallet.hidden = actualBalance < total;
    mixed.hidden = actualBalance <= 0 || actualBalance >= total;
    wallet.querySelector('span').textContent = numberToStringUsd(total.toFixed(2));
    mixed.querySelector('span').textContent = mixed.hidden ? ''
        : `${numberToStringUsd(actualBalance.toFixed(2))} + ${numberToString(calculateTaxesAndExchange(total - actualBalance, rate))}`;
    panel.querySelector('.timbocito_cart_currentmethod_value').textContent = numberToString(calculateTaxesAndExchange(total, rate));
    panel.querySelector('.exchangerate_value').textContent = `1 USD ≈ ${numberToString(rate)}`;
    renderExchangeRateStatus(panel);

    for (const price of root.querySelectorAll('div:not(:has(*))')) {
        if (summary.box.contains(price) || price.closest('header, dialog, #global_header, ' + cartSummarySelector)
            || !usdPricePattern.test(price.textContent.trim()) || !price.getClientRects().length) continue;
        // Las tarjetas reutilizadas por Steam vuelven a mostrar el precio nativo sin el indicador de Timbocito.
        price.removeAttribute(attributeName);
        setArgentinaPrice(price);
    }
}

(async () => {
    await getUsdExchangeRate();
    renderCart();

    let renderTimer;
    const scheduleRender = () => {
        clearTimeout(renderTimer);
        renderTimer = setTimeout(renderCart, 150);
    };
    const observer = new MutationObserver(mutations => {
        for (const { addedNodes, removedNodes } of mutations) {
            forgetRemovedPrices(removedNodes);
            for (const node of addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE && node.isConnected && !node.matches('.emojis')) {
                    restoreRenderedPrices(node);
                }
            }
        }
        if (mutations.some(({target, addedNodes, removedNodes}) => {
            const element = target.nodeType === Node.ELEMENT_NODE ? target : target.parentElement;
            if (!element || element.closest(cartSummarySelector)) return false;
            const price = element.closest(`[${attributeName}]`);
            if (price) return usdPricePattern.test(price.textContent.trim());
            const nodes = [...addedNodes, ...removedNodes];
            return !nodes.length || nodes.some(node => !node.matches?.(`${cartSummarySelector}, .emojis`));
        })) scheduleRender();
    });
    observer.observe(document.body, {subtree: true, childList: true, characterData: true});
    window.addEventListener('resize', scheduleRender);
})();
