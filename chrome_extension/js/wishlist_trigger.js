// Procesa solo los precios nuevos que Steam agrega a la lista de deseados.
(async () => {
    await getUsdExchangeRate();
    getPrices("wishlist");
    observePriceMutations(["wishlist"]);
})();
