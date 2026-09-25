// Inicialización incremental para precios y bundles dinámicos.
(async () => {
    await getUsdExchangeRate();
    getPrices("standard");
    observePriceMutations(["standard"]);
})();
