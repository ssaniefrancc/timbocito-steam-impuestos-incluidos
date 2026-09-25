// Inicialización y observación incremental para páginas de juegos.
(async () => {
    await getUsdExchangeRate();
    getPrices("standard");
    getPrices("search");
    observePriceMutations(["standard", "search"]);
})();
