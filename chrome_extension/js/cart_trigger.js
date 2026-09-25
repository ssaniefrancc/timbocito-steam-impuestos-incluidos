// El resumen del carrito se actualiza con cambios de contenido, sin volver a
// buscar precios por todo el documento.
(async () => {
    await getUsdExchangeRate();
    getPrices("cart");
    observePriceMutations(["cart"]);
})();
