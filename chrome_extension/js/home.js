// Inicialización de los precios en la portada, categorías y eventos de Steam.
(async () => {
    await getUsdExchangeRate();
    getPrices("standard");
    getPrices("search");
    observePriceMutations(["standard", "search"]);
})();
