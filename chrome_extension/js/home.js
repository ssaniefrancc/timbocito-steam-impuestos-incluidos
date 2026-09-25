// Inicialización y observación incremental de los precios en Steam Home.
(async () => {
    await getUsdExchangeRate();
    getPrices("standard");
    getPrices("search");
    observePriceMutations(["standard", "search"]);
})();

function getOwnedArgentinaGames(){
    return; // Deshabilitado para Paraguay
}
