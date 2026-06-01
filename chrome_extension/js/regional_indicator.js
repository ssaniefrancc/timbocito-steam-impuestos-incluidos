const url = window.location.pathname;
let indicatorStyle = localStorage.getItem('estilo-barra');

const getAppData = (url) => {
    let appData = {
        type: '',
        id: ''
    };
    url.includes('/sub/') ? appData.type = "sub" : appData.type = "app";

    let startingPosition = url.indexOf('/', 1);
    let endingPosition = url.indexOf('/', startingPosition + 1);
    appData.id = url.slice(startingPosition + 1, endingPosition);
    return appData;
}

const admirePublisher = (publisher) => {

    const phrases = [
        `¡Te queremos mucho ${publisher}!`,
        `¡Te amamos ${publisher}!`,
        `¡Tenés que cerrar el estadio ${publisher}!`,
        `¡Genio ${publisher}!`,
        `¡Gracias ${publisher}!`,
        `¡Bien ahí ${publisher}!`,
        `¡Sos groso ${publisher}!`
    ]

    return phrases[Math.floor(Math.random() * phrases.length)];
}


const criticizePublisher = (margin,publisher) => {

    const phrases = [
        `¿Qué pasó ahí, ${publisher}?`,
        `¡Se te fue la mano, ${publisher}!`,
        `Epa, ¿qué rompimos ${publisher}?`,
        `¡Saladito ${publisher}!`,
        `${publisher}, hasta acá llegaste...`,
        `¡Nde tavy ${publisher}!`,
    ]

    const randomChoice = Math.floor(Math.random() * phrases.length);
    if(margin >= 100){
        return `<br><br><span>${phrases[randomChoice]}</span>`
    }
    return "";
}


const getExchangeRate = async () => {
    await getUsdExchangeRate();
    let exchangeRate = JSON.parse(localStorage.getItem('steamcito-cotizacion-tarjeta'))?.rate;
    let exchangeRateDate = JSON.parse(localStorage.getItem('steamcito-cotizacion-tarjeta'))?.rateDateProvided;
    let tarjetaTax = JSON.parse(localStorage.getItem('steamcito-cotizacion-tarjeta'))?.taxAmount || 10


    if(exchangeRate && exchangeRateDate && tarjetaTax){
        renderExchangeIndicator(exchangeRate,exchangeRateDate,tarjetaTax)
    }
}

const getAppPricing = async (appInitialData) => {
    await getUsdExchangeRate();
    const { type, id } = appInitialData;
    let appEndpoint = `/api/appdetails?appids=${id}`;
    let subEndpoint = `/api/packagedetails?packageids=${id}`

    const appIdFetch = await fetch(`${type == "app" ? `${appEndpoint}&cc=us` : `${subEndpoint}&cc=us`}`, { credentials: 'omit' })

    const appIdFetchArg = await fetch(`${type == "app" ? `${appEndpoint}&cc=ar` : `${subEndpoint}&cc=ar`}`, { credentials: 'omit' })

    let exchangeRate = JSON.parse(localStorage.getItem('steamcito-cotizacion-tarjeta'))?.rate;


    let appIdResponse = await appIdFetch.json();
    let appIdArgResponse = await appIdFetchArg.json();

    if (appIdResponse[id].success && appIdArgResponse[id].success) {
        if (appIdResponse[id].data.is_free || !appIdResponse[id].data[type == "sub" ? "price" : "price_overview"]) {
            return;
        }
        appIdResponse = appIdResponse[id].data;
        appIdArgResponse = appIdArgResponse[id].data;

        const appData = {
            name: appIdResponse.name,
            discount: (appIdResponse[type == "sub" ? "price" : "price_overview"].discount_percent),
            publisher: appIdResponse.publishers?.[0] || "El publisher",
            releaseDate: appIdResponse.release_date?.date || "Sin fecha de lanzamiento",
            baseUsdPrice: (appIdResponse[type == "sub" ? "price" : "price_overview"].initial) / 100,
            baseArsPrice: (appIdArgResponse[type == "sub" ? "price" : "price_overview"].initial) / 100,
            usdPrice: (appIdResponse[type == "sub" ? "price" : "price_overview"].final) / 100,
            arsPrice: (appIdArgResponse[type == "sub" ? "price" : "price_overview"].final) / 100,
            support_url: appIdResponse?.support_info?.url,
            support_email: appIdResponse?.support_info?.email,
            baseRecommendedArsPrice: undefined,
            recommendedArsPrice: undefined,
            recommendedLatamPrice: undefined,
            regionalStatus: undefined
        }

        if(appData.publisher != "El publisher" && !appData.support_email.includes('@')){
            // Si el mail no incluye una @, es porque lo cargó mal
            !appData.support_url ? appData.support_url = appData.support_email : ""
            appData.support_email = "";

        }

        const nearestOption = regionalPricingOptionsLatam.reduce((prev, curr) => Math.abs(curr - appData.baseUsdPrice) < Math.abs(prev - appData.baseUsdPrice) ? curr : prev);

        const baseRecommendedArsPrice = regionalPricingChartLatam
            .filter(item => item.usdPrice == nearestOption)
            .map(item => item.argPrice)[0];

        const recommendedArsPrice = regionalPricingChartLatam
            .filter(item => item.usdPrice == nearestOption)
            .map(item => item.argPrice)[0] * (100 - appData.discount) / 100;
            

        appData.recommendedArsPrice = recommendedArsPrice;
        appData.baseRecommendedArsPrice = baseRecommendedArsPrice;

        const pppPrice = regionalPricingChartLatamPPP
            .filter(item => item.usdPrice == nearestOption)
            .map(item => item.argPrice)[0] * (100 - appData.discount) / 100;
        appData.pppPrice = pppPrice;

        // Tiene el mismo precio que en Estados Unidos
        if (appData.arsPrice == appData.usdPrice) {
            appData.regionalDifference = 0;
            appData.regionalStatus = "expensive"
        }

        // Está más caro que lo esperado
        if (appData.arsPrice > appData.recommendedArsPrice && appData.arsPrice != appData.usdPrice ) {
            appData.regionalDifference = Math.round((parseFloat((appData.arsPrice - appData.recommendedArsPrice)) / appData.recommendedArsPrice) * 100);
            appData.regionalDifference <= 25 ? appData.regionalStatus = "fair" : appData.regionalStatus = "semifair";
        }
        else if (appData.arsPrice < appData.recommendedArsPrice) {
            appData.regionalDifference = Math.round((parseFloat((appData.recommendedArsPrice - appData.arsPrice)) / appData.recommendedArsPrice) * 100);
            appData.regionalDifference <= 25 ? appData.regionalStatus = "fair" : appData.regionalStatus = "cheap";
        }
        else if (appData.arsPrice == appData.recommendedArsPrice) {
            appData.regionalStatus = "fair";
            appData.regionalDifference = 0;
        }

        // Excellent: precio dentro del 20% del PPP
        if (appData.pppPrice && appData.regionalStatus !== "expensive") {
            const pppDifference = Math.abs(appData.arsPrice - appData.pppPrice) / appData.pppPrice;
            if (pppDifference <= 0.20) {
                appData.regionalStatus = "excellent";
                appData.pppDifference = Math.round(pppDifference * 100);
            }
        }

        renderRegionalIndicator(appData, exchangeRate);
        return appData;

    }
}

const renderExchangeIndicator = (exchangeRate,exchangeRateDate,tarjetaTax) => {
    if (indicatorStyle == "barra-oculta") {
        return;
    }
    
    let sidebar = document.querySelector('.rightcol.game_meta_data');

    let staticExchangeRate = exchangeRate;

    provinceTaxes &&
    provinceTaxes.forEach(tax => {
        exchangeRate += parseFloat((staticExchangeRate * tax.value / 100).toFixed(2));
    })

    let container = `
        <div class="block responsive_apppage_details_right heading heading_steamcito_3">
            Cotización del dólar
        </div>

        <div class="block responsive_apppage_details_right recommendation_reasons regional-meter-wrapper cotizacion-wrapper ${indicatorStyle} content_steamcito_3">

            
            <p class="reason for dolar_tarjeta">
                <span class="name-span">Tarjeta: 1 USD ≈ ${exchangeRate.toFixed(2)} PYG</span>
                <br>
                <span class="name-smaller">
                   ${tarjetaTax ? `Incluye ${tarjetaTax}% de impuestos (${exchangeRateDate}) ` : ""}  <br>
                   Aplica a todas las tarjetas emitidas en Paraguay.
                </span>
            </p>

        </div>
    `;

    sidebar.insertAdjacentHTML('afterbegin', container);

    let dolarTarjetaItem = document.querySelector('.dolar_tarjeta');
    dolarTarjetaItem && dolarTarjetaItem.addEventListener('click', () => {changePaymentMethodState('steamcito-cotizacion-tarjeta');window.location.reload()} )
}


const renderPriceIndicators = (appData, exchangeRate) => {
    const taxesPY = (price) => calculateTaxesAndExchange(price, exchangeRate);

    return(`
        <p class="reason info">
            Precio sugerido LATAM <br><span class="regional-meter-price">${numberToString(taxesPY(appData.recommendedArsPrice))} ${emojiMate}</span>
            ${appData.discount != 0 
                ?
                `<span class="regional-meter-price steamcito-strikethrough-price">${numberToString(taxesPY(appData.baseRecommendedArsPrice))}</span>`
                :
                ""
            }
        </p>
        <hr>
        <p class="reason info">
            Precio actual en Paraguay<br><span class="regional-meter-price">${numberToString(taxesPY(appData.arsPrice))} ${emojiMate}</span>
            ${appData.discount != 0 
                ?
                `<span class="regional-meter-price steamcito-strikethrough-price">${numberToString(taxesPY(appData.baseArsPrice))}</span>`
                :
                ""
            }
        </p> 
        <hr>
        <p class="reason info">
            Precio actual en Estados Unidos<br><span class="regional-meter-price-us">USD$ ${appData.usdPrice} </span> 
            ${appData.discount != 0 
                ?
                `<span class="steamcito-strikethrough-price">USD$ ${appData.baseUsdPrice} </span>`
                :
                ""
            }
        </p>     
    `)
}


const renderRegionalIndicator = (appData, exchangeRate) => {
    if (indicatorStyle == "barra-oculta") {
        return;
    }
    
    let sidebar = document.querySelector('.rightcol.game_meta_data');

    let container =
        `
    <div class="block responsive_apppage_details_right heading heading_steamcito_1">
        <p>Análisis de precio regional</p>    
        <span>por Steamcito</span>
    
    </div>
    <div class="block responsive_apppage_details_right recommendation_reasons regional-meter-wrapper ${indicatorStyle} content_steamcito_1">
        <div class="regional-meter-container">
            <div class="regional-meter-bar regional-meter-bar--expensive ${appData.regionalStatus == "expensive" && "regional-meter-bar--selected"}">
                <span>No tiene</span>
            </div>
            <div class="regional-meter-bar regional-meter-bar--semifair ${appData.regionalStatus == "semifair" && "regional-meter-bar--selected"}">
                <span>Elevado</span>
            </div>
            <div class="regional-meter-bar regional-meter-bar--fair ${appData.regionalStatus == "fair" && "regional-meter-bar--selected"}">
                <span>Bueno</span>
            </div>
            <div class="regional-meter-bar regional-meter-bar--cheap ${appData.regionalStatus == "cheap" && "regional-meter-bar--selected"}">
                <span>Muy bueno</span>
            </div>
            <div class="regional-meter-bar regional-meter-bar--excellent ${appData.regionalStatus == "excellent" && "regional-meter-bar--selected"}">
                <span>Increíble</span>
            </div>
        </div>

        ${appData.usdPrice == appData.arsPrice && (appData.support_email || appData.support_url)
            ?
            `<span class="notify-publisher-button green-steamcito-button">Solicitar precio regional</span>`
            : 
            ""
        }

        <hr>
        ${appData.regionalStatus == "expensive"
            ?
            `
        <p class="reason against">
            <span class="name-span">${appData.name}</span> no tiene precio regional.
        </p>

        <hr>
        <p class="reason against">
        <span class="name-span"> ${appData.publisher}</span> todavía no cargó un precio para nuestra región.
        </p>
        <hr>
        ${renderPriceIndicators(appData, exchangeRate)}

        `
            : ""
        }


        ${appData.regionalStatus == "semifair"
            ?
            `
        <p class="reason against">
            <span class="name-span">${appData.name}</span> tiene un precio regional relativamente alto.
        </p>
        <hr>
        <p class="reason against">
        <span class="name-span"> ${appData.publisher}</span> cargó un precio <span class="regional-meter-reason--orange">${appData.regionalDifference}% más caro</span> que lo sugerido en nuestra región.
        </p>
        <hr>
        ${renderPriceIndicators(appData, exchangeRate)}

        `
        : 
        ""
        }
        

        ${appData.regionalStatus == "fair"
            ?
            `
        <p class="reason for">
        
        <span class="name-span">${appData.name}</span> tiene un precio regional relativamente accesible.
        </p>
        <hr>


            ${appData.arsPrice > appData.recommendedArsPrice && appData.regionalDifference != 1
                ?
                `
            <p class="reason info">
                <span class="name-span"> ${appData.publisher}</span> cargó un precio <span class="regional-meter-reason--yellow">${appData.regionalDifference}% más caro</span> que lo sugerido en nuestra región.
            </p>
            <hr>                
            `
                :
                ""
            }

            ${appData.arsPrice < appData.recommendedArsPrice && appData.regionalDifference != 0  && appData.regionalDifference != 1
                ?
                `
            <p class="reason for">
                <span class="name-span"> ${appData.publisher}</span> cargó un precio <span class="regional-meter-reason--yellow">${appData.regionalDifference}% más barato</span> que lo sugerido en nuestra región.
            </p>
            <hr>                
            `
                :
                ""
            }

            ${appData.arsPrice == appData.recommendedArsPrice || appData.regionalDifference == 1
                ?
                `
            <p class="reason for">
                <span class="name-span"> ${appData.publisher}</span> cargó el precio sugerido por Valve.
            </p>
            <hr>                
            `
                :
                ""
            }
            ${renderPriceIndicators(appData, exchangeRate)}




        `
            : ""
        }

        ${appData.regionalStatus == "excellent"
            ?
            `
        <p class="reason for">
        <span class="name-span">${appData.name}</span> tiene un precio regional extraordinario.
        </p>
        <hr>
        <p class="reason for">
        <span class="name-span">${appData.publisher}</span> cargó un precio basado en el índice de paridad de poder adquisitivo para nuestra región.
        <br><br>
        ${admirePublisher(appData.publisher)}
        </p>
        <hr>
        ${renderPriceIndicators(appData, exchangeRate)}

        `
            : ""
        }

        ${appData.regionalStatus == "cheap"
            ?
            `
        <p class="reason for">
        <span class="name-span">${appData.name}</span> tiene un precio regional relativamente barato.<br>

        </p>
        <hr>
        <p class="reason info">
        <span class="name-span">${appData.publisher}</span> cargó un precio <span class="regional-meter-reason--green">${appData.regionalDifference}% más bajo </span> que el sugerido por Valve.<br><br> ¡Te quiero mucho ${appData.publisher}!
        </p>
        <hr>
        ${renderPriceIndicators(appData, exchangeRate)}

        `
            : ""
        }

        <p class="regional-meter-disclaimer">Análisis basado en la <a href="https://partner.steamgames.com/pricing/explorer" target="_blank">herramienta oficial de fijación de precios regionales de Valve.</a></p>

    </div>

    ${appData.usdPrice == appData.arsPrice && (appData.support_email || appData.support_url)
        ?
        `
        <div class="notify-publisher-popup notify-publisher-popup--hidden">
            <span class="publisher-popup-close-button">X</span>

            <div class="contact-method-container">
                <h5>Medio de contacto oficial</h5>  
                <div class="publisher-popup-flex-container">
                    ${appData.support_email 
                        ? `<p class="publisher-email">${appData.support_email}</p>`
                        : `<a target=_blank href="${appData.support_url}">${appData.support_url}</a> &nbsp; (${appData.publisher} no brinda un mail de contacto público)`
                    }  
                    ${appData.support_email ? `<button class="copiar-texto-steamcito green-steamcito-button" type="button" data-clipboard="publisher-email">Copiar</button>` : ""}
                </div>

            </div>

            <hr>

            <div class="email-template-container">
                
                ${appData.support_email ? 
                `<div class="email-template-container-subheader">
                    <h5>Asunto</h5> 
                    <div class="publisher-popup-flex-container">
                        <p class="publisher-subject">Question about new regional pricing on ${appData.name}</p> 
                        <button class="copiar-texto-steamcito green-steamcito-button" type="button" data-clipboard="publisher-subject">Copiar</button>
                    </div>
                </div>
                <hr>

                `
                :
                ""
                }

                


                <div class="email-template-container-subheader">
                    <div class="publisher-popup-flex-container">
                        <h5>Cuerpo del Mensaje</h5>
                        <button class="copiar-texto-steamcito green-steamcito-button" type="button" data-clipboard="email-template">Copiar</button>
                    </div>

                </div>
                <p class="email-template">
                    Hi there! <br>
                    <br>

                    I'm a Steam user from Paraguay and wanted to bring something to your attention. In 2023, Steam introduced a new LATAM region which includes many countries in Latin America such as mine, and also added suggested prices to make games more affordable while boosting sales.
                    <br><br>                 

                    Currently, ${appData.name} doesn't have regional pricing here. Would you consider setting a price for our region when you get a chance? This would be greatly appreciated by players across Latin America! <br><br>

                    Kind regards,
                </p>
            </div>
        </div>

        `

        :
            ""
    }

    `
    sidebar.insertAdjacentHTML('afterbegin', container);

    if(appData.usdPrice == appData.arsPrice  && (appData.support_email || appData.support_url)){

        let clipboardHandlers = document.querySelectorAll('.copiar-texto-steamcito');
        clipboardHandlers.forEach(handler => {
            let valueToCopy = document.querySelector(`.${handler.dataset.clipboard}`)
            handler.addEventListener('click', () => {
                navigator.clipboard.writeText(valueToCopy.innerText);
                handler.innerText = '✔ ¡Copiado! '
                setTimeout( () => {
                    handler.innerText = "Copiar"
                },3000)
            })
        })

        let modal = document.querySelector('.notify-publisher-popup');
        let openModalButton = document.querySelector('.notify-publisher-button');
        let closeModalButton = document.querySelector('.publisher-popup-close-button');
        openModalButton.addEventListener('click', () => modal.classList.toggle('notify-publisher-popup--hidden'));
        

        closeModalButton.addEventListener('click', () => modal.classList.toggle('notify-publisher-popup--hidden'))
    }




}

getExchangeRate();

const appData = getAppData(url);
getAppPricing(appData);
