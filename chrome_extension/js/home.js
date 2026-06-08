// Inicialización para la página Home de Steam
// Ejecuta getPrices('standard') que antes se llamaba desde global_functions.js
(async() => {
    await getUsdExchangeRate();
    getPrices("standard");
})();

function getOwnedArgentinaGames(){
    return; // Deshabilitado para Paraguay
}