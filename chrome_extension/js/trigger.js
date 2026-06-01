// Corro función por primera vez
(async() => {
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


  // Observador de contenedor de Search
  const searchDiv = document.querySelector('div[id*="searchSuggestion"]');
  if (searchDiv) {
      const observer = new MutationObserver((mutations) => {
        getPrices("search");
      });

      observer.observe(searchDiv, {
          childList: true,
          subtree: true
      });
  }

})();








