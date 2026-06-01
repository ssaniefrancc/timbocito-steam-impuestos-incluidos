// Corro función por primera vez
(() => {
  setTimeout(async function(){
    await getUsdExchangeRate();
    getPrices("standard");
  
    // Trigger recursivo
    MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
    const observer = new MutationObserver(function(mutations, observer) {
      getPrices("standard");
    });
  
    observer.observe(document, {
      subtree: true,
      attributes: true
    });
  },1500)
})();
