window.chrome = {
    runtime: { getManifest: () => ({ version: 'test' }) },
    storage: { local: { get: (_, callback) => callback({}) } }
};
localStorage.setItem('timbocito-cotizacion-tarjeta', JSON.stringify({ rate: 6100, date: Date.now() }));
localStorage.setItem('timbocito-national-tax', '10');

let testQuote = 7000;
window.fetch = async url => {
    if (url === 'https://open.er-api.com/v6/latest/USD') {
        if (!testQuote) return { ok: false, status: 503 };
        return { ok: true, json: async () => ({ result: 'success', rates: { PYG: testQuote } }) };
    }
    if (url.startsWith('/api/')) return { ok: true, json: async () => ({}) };
    throw new Error(`Solicitud inesperada (${url})`);
};

const fixtureIdleCallbacks = [];
window.requestIdleCallback = callback => {
    if (document.body.dataset.fixture === 'home' && !document.querySelector('#discount')) {
        fixtureIdleCallbacks.push(callback);
        return;
    }
    return setTimeout(() => callback({ didTimeout: true }), 0);
};

// Browser checks
(async () => {
    const find = selector => document.querySelector(selector);
    const pause = (ms = 230) => new Promise(resolve => setTimeout(resolve, ms));
    const check = (condition, description) => {
        if (!condition) throw new Error(description);
    };
    const starts = (selector, expected) => {
        const text = find(selector)?.textContent.trim();
        check(text?.startsWith(expected), `${selector} debía mostrar ${expected}, mostró ${text}`);
    };
    const menuStatus = '.menu-timbocito [data-timbocito-rate-status]';

    try {
        if (document.body.dataset.fixture === 'home') {
            await pause(0);
            const feature = find('[data-featuretarget="discounts-and-events"]');
            feature.append(find('#steam-carousel').content.cloneNode(true));
            const card = feature.querySelector('a');
            const image = feature.querySelector('img');
            const arrow = feature.querySelector('button');
            for (const fn of fixtureIdleCallbacks) fn({ didTimeout: true });
            await pause();
            check(feature.contains(card) && card.contains(image) && feature.contains(arrow), 'Se reemplazó el carrusel');
            starts('#original', '₲ 100.583');
            starts('#discount', '₲ 35.160');
            starts(menuStatus, 'Cotización vigente · Obtenida el');

            find('#global_action_menu').insertAdjacentHTML('beforeend', '<a id="header_wallet_balance">$5.24 USD</a>');
            await pause();
            starts('#original', 'USD$ 14,99');
            starts('#discount', 'USD$ 5,24');
            find('#discount').click();
            await pause(300);
            starts('#discount', '₲ 35.160');
            find('#header_wallet_balance').firstChild.data = '$10.00';
            await pause();
            starts('#discount', '₲ 35.160');
            starts('#original', 'USD$ 14,99');
            find('#discount').textContent = '$11.00 USD';
            await pause();
            starts('#original', '₲');
            starts('#discount', '₲ 73.810');

            const item = card.parentElement;
            const list = item.parentElement;
            item.remove();
            find('#header_wallet_balance').textContent = '$11.00';
            await pause();
            list.append(item);
            await pause();
            starts('#original', 'USD$ 14,99');
            starts('#discount', 'USD$ 11,00');
            find('#header_wallet_balance').textContent = '$10.00';
            await pause();
            starts('#discount', '₲ 73.810');

            localStorage.setItem(exchangeRateKey, JSON.stringify({ rate: 6100, date: Date.now() - exchangeRateLifetime + 500 }));
            await getUsdExchangeRate();
            starts(menuStatus, 'Cotización vigente');
            await pause(600);
            starts(menuStatus, 'Cotización anterior · Obtenida el');

            testQuote = 0;
            await getUsdExchangeRate(true);
            starts(menuStatus, 'Cotización anterior · Obtenida el');
            starts('#discount', '₲ 73.810');
            localStorage.removeItem('timbocito-cotizacion-tarjeta');
            await getUsdExchangeRate(true);
            starts(menuStatus, 'Valor de referencia');
            testQuote = 7000;
            await getUsdExchangeRate(true);
            await pause();
            starts(menuStatus, 'Cotización vigente · Obtenida el');
            starts('.menu-timbocito [data-timbocito-rate-value]', '1 USD ≈ ₲ 7.000');
            starts('#discount', '₲ 84.700');
        }

        if (document.body.dataset.fixture === 'product') {
            await pause();
            starts('.discount_original_price', '₲');
            starts('.discount_final_price', '₲ 35.160');
            starts('.cotizacion-wrapper [data-timbocito-rate-status]', 'Cotización vigente');
            starts('.cotizacion-wrapper [data-timbocito-rate-value]', '1 USD ≈ ₲ 6.100');
            find('#header_wallet_balance').textContent = '$5.24';
            await pause();
            starts('.discount_original_price', 'USD$ 14,99');
            starts('.discount_final_price', 'USD$ 5,24');
        }

        if (document.body.dataset.fixture === 'cart') {
            await pause();
            const panel = '.timbocito-cart-summary';
            starts('#steam-total', '$20.00 USD');
            starts('#line-price', '₲ 134.200');
            starts(`${panel} .timbocito_cart_mixed_value`, 'USD$ 5,00 + ₲ 100.650');
            starts(`${panel} [data-timbocito-rate-status]`, 'Cotización vigente');
            find('#header_wallet_balance').textContent = '$20.00 USD';
            await pause();
            starts('#line-price', 'USD$ 20,00');
            check(!find(`${panel} .timbocito_cart_wallet`).hidden, 'El saldo exacto debe habilitar el total con Wallet');
            check(find(`${panel} .timbocito_cart_mixed`).hidden, 'Con saldo exacto no hay pago mixto');
        }

        find('#test-result').textContent = 'PASS';
    } catch (error) {
        find('#test-result').textContent = `FAIL ${error.message}`;
    }
})();
