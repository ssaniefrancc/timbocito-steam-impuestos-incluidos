function getTransactions(){
    // Agarro todas las transacciones que todavía no fueron procesadas por la función
    const transactions = document.querySelectorAll('.wallet_table_row:not(.processed)');
    setTransactionType(transactions);
}

let standardTaxesDetail = [
	{
		name: "IVA Servicios Digitales (PY)",
		values: [{ percentage: 10, day: 1, month: 1, year: 2020 }],
		moreInfo: "https://www.set.gov.py/"
	}
]

let impuestosGanancias = [];


function setTransactionType(transactions){
    transactions.forEach(transaction => {
        transaction.classList.add('processed');

        // Evito que las transacciones con moneda extranjera sean tomadas en cuenta
        if(transaction.innerText.indexOf('USD') != -1 ){
            return;
        }

        // Obtengo la información de pago de la transacción
        const payments = transaction.querySelectorAll('.wht_type .wth_payment div');

        // Split Purchase
        if(payments.length){
            transaction.classList.add('split-purchase');
            let walletValue = transaction.querySelector('.wht_type .wth_payment > div:first-child');
            let ccValue = transaction.querySelector('.wht_type .wth_payment > div:last-child');
            let date = stringToDate(transaction.querySelector('.wht_date').innerText);
            transaction.dataset.originalValue = ccValue.innerText;
            let contenedorTotal = transaction.querySelector('.wht_total');
            contenedorTotal.innerHTML += `<b>(Precio Steam)</b> <br><br> ${steamizar(stringToNumber(walletValue))} <br> ${guaranizar(calcularImpuestosHistorial(stringToNumber(ccValue),date))}`;
        } 
        
        // One-Method Purchase
        else{
            const paymentType = transaction.querySelector('.wht_type .wth_payment');

            // Evito que las transacciones Digital Card Redemption sean tomadas en cuenta
            if(transaction.querySelector('.wht_total').innerText == ""){
                return;
            } 

			// Evito que las transacciones de la cartera sean tomadas en cuenta
            if(!paymentType.innerText.includes('Master') && !paymentType.innerText.includes('Visa')){                
                transaction.classList.add('wallet-purchase');
            } else{
                transaction.dataset.originalValue = transaction.querySelector('.wht_total').innerText;
                transaction.classList.add('cc-purchase');
            }
        }
        calculateTotals(transaction);
    })
}


function calcularImpuestosHistorial(initialPrice,date) {
	// Hago una variable para guardar la suma de los impuestos.
	let totalTaxesForTransaction = 0;

    standardTaxesDetail.forEach( (tax) => {
        let taxValue = 0;
        tax.values.forEach( (value ) => {
			if(date.year > value.year || (date.year == value.year && (date.month > value.month || (date.month == value.month && date.day >= value.day)))){
			    return taxValue = value.percentage;
			}
            return;
        })
        if(taxValue != 0){
            totalTaxesForTransaction += taxValue;
        }
    })

	let finalPrice = (initialPrice) * (1 + (totalTaxesForTransaction / 100));
    return finalPrice.toFixed(2);
}

function calculateTotals(transaction){
    if(transaction.classList.contains('cc-purchase')){
        const precio = transaction.querySelector('.wht_total');
        let date = stringToDate(transaction.querySelector('.wht_date').innerText);
        precio.innerHTML = guaranizar(calcularImpuestosHistorial(stringToNumber(precio),date));
    }

    else if(transaction.classList.contains('wallet-purchase')){
        const precio = transaction.querySelector('.wht_total');
        precio.innerHTML += emojiWallet;
    }
}

// Corro toda la lógica declarada arriba
getTransactions();

MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
const transactionObserver = new MutationObserver(function(mutations, observer) {
    getTransactions();
});

transactionObserver.observe(document, {
  subtree: true,
  attributes: true
});

// Función deshabilitada.
// showDevolucionHtml();
