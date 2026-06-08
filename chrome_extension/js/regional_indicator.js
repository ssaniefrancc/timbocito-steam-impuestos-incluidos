const regionalUrl = window.location.pathname;
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
    let exchangeRate = JSON.parse(localStorage.getItem('timbocito-cotizacion-tarjeta'))?.rate;
    let exchangeRateDate = JSON.parse(localStorage.getItem('timbocito-cotizacion-tarjeta'))?.rateDateProvided;
    let tarjetaTax = JSON.parse(localStorage.getItem('timbocito-cotizacion-tarjeta'))?.taxAmount || 10


    if(exchangeRate && exchangeRateDate && tarjetaTax){
        renderExchangeIndicator(exchangeRate,exchangeRateDate,tarjetaTax)
    }
}

const getAppPricing = async (appInitialData) => {
    await getUsdExchangeRate();
    const { type, id } = appInitialData;

    // Si no estamos en una página de producto válida, abortamos
    if(!id) return;

    let appEndpoint = `/api/appdetails?appids=${id}`;
    let subEndpoint = `/api/packagedetails?packageids=${id}`;
    let sidebar = document.querySelector('.rightcol.game_meta_data');
    let exchangeRate = JSON.parse(localStorage.getItem('timbocito-cotizacion-tarjeta'))?.rate;

    // Intentar usar caché por appId (válido 24h — los precios de Steam no cambian seguido)
    const cacheKey = `timbocito-app-${type}-${id}`;
    const cachedRaw = localStorage.getItem(cacheKey);
    if (cachedRaw) {
        try {
            const cached = JSON.parse(cachedRaw);
            const ageSeconds = (Date.now() - cached.date) / 1000;
            if (ageSeconds < 86400 && cached.appData) {
                if (sidebar && exchangeRate) {
                    renderRegionalIndicator(cached.appData, exchangeRate);
                }
                return cached.appData;
            }
        } catch(e) {
            localStorage.removeItem(cacheKey);
        }
    }

    try {
        // Ambos fetches en paralelo para reducir el tiempo de espera a la mitad
        const [appIdFetch, appIdFetchArg] = await Promise.all([
            fetch(`${type == "app" ? `${appEndpoint}&cc=us` : `${subEndpoint}&cc=us`}`, { credentials: 'omit' }),
            fetch(`${type == "app" ? `${appEndpoint}&cc=py` : `${subEndpoint}&cc=py`}`, { credentials: 'omit' })
        ]);

        let appIdResponse = await appIdFetch.json();
        let appIdArgResponse = await appIdFetchArg.json();

        if (appIdResponse[id] && appIdArgResponse[id]) {
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
                };

                if(appData.publisher != "El publisher" && appData.support_email && !appData.support_email.includes('@')){
                    !appData.support_url ? appData.support_url = appData.support_email : "";
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

                if (appData.arsPrice == appData.usdPrice) {
                    appData.regionalDifference = 0;
                    appData.regionalStatus = "expensive";
                }

                if (appData.arsPrice > appData.recommendedArsPrice && appData.arsPrice != appData.usdPrice) {
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

                if (appData.pppPrice && appData.regionalStatus !== "expensive") {
                    const pppDifference = Math.abs(appData.arsPrice - appData.pppPrice) / appData.pppPrice;
                    if (pppDifference <= 0.20) {
                        appData.regionalStatus = "excellent";
                        appData.pppDifference = Math.round(pppDifference * 100);
                    }
                }

                // Guardar en caché para que la próxima visita no haga fetch
                try {
                    localStorage.setItem(cacheKey, JSON.stringify({ appData, date: Date.now() }));
                } catch(e) { /* localStorage lleno, ignorar */ }

                if(sidebar) {
                    renderRegionalIndicator(appData, exchangeRate);
                }
                return appData;
            }
        }
    } catch(err) {
        console.error("timbocito PY: Error en getAppPricing:", err);
    }
};


const renderExchangeIndicator = (exchangeRate,exchangeRateDate,tarjetaTax) => {
    if (indicatorStyle == "barra-oculta") {
        return;
    }
    
    let sidebar = document.querySelector('.rightcol.game_meta_data');

    if(!sidebar) return;

    // Eliminar cualquier bloque de cotización previo (evita duplicados)
    let prevHeadings = sidebar.querySelectorAll('.heading.heading_steamcito_3.heading_timbocito_3');
    prevHeadings.forEach(h => {
        if(h.innerText && h.innerText.trim().includes('Cotización del dólar')) h.remove();
    });
    let prevCot = sidebar.querySelectorAll('.recommendation_reasons.cotizacion-wrapper');
    prevCot.forEach(c => c.remove());
    console.debug('timbocito: removed previous cotizacion blocks, inserting new one');

    let staticExchangeRate = exchangeRate;

    provinceTaxes &&
    provinceTaxes.forEach(tax => {
        exchangeRate += parseFloat((staticExchangeRate * tax.value / 100).toFixed(2));
    })

    let container = `
        <div class="block responsive_apppage_details_right heading heading_steamcito_3 heading_timbocito_3">
            Cotización del dólar
        </div>

        <div class="block responsive_apppage_details_right recommendation_reasons regional-meter-wrapper cotizacion-wrapper ${indicatorStyle} content_steamcito_3 content_timbocito_3">

            
            <p class="reason for dolar_tarjeta">
                <span class="name-span">Tarjeta: 1 USD ≈ ${exchangeRate.toFixed(2)} PYG</span>
                <br>
                <span class="name-smaller">
                   ${tarjetaTax ? `Incluye ${tarjetaTax}% de impuestos (${exchangeRateDate}) ` : ""}  <br>
                   Aplica a todas las tarjetas emitidas en Paraguay.
                </span>
            </p>

                <button class="green-timbocito-button timbocito-update-rate-btn cotizacion-update" type="button" style="margin-top:8px;">Actualizar cotización</button>

            </div>
    `;

    // Marcar los nodos añadidos para poder eliminarlos posteriormente
    sidebar.insertAdjacentHTML('afterbegin', container);
    let inserted = sidebar.querySelectorAll('.recommendation_reasons.cotizacion-wrapper, .heading.heading_steamcito_3');
    inserted.forEach(el => el.classList.add('timbocito-inserted', 'cotizacion-block'));

    let dolarTarjetaItem = document.querySelector('.dolar_tarjeta');
    dolarTarjetaItem && dolarTarjetaItem.addEventListener('click', () => {changePaymentMethodState('timbocito-cotizacion-tarjeta');window.location.reload()} )

    // Listener para el botón de actualización dentro de la sección de cotización
    let cotBtn = sidebar.querySelector('.timbocito-update-rate-btn');
    if(cotBtn && !cotBtn.dataset.listenerAttached){
        cotBtn.addEventListener('click', async () => {
            if(window.__timbocitoUpdatingRate) return;
            window.__timbocitoUpdatingRate = true;
            cotBtn.disabled = true;
            const original = cotBtn.innerText;
            cotBtn.innerText = 'Actualizando...';
            try{
                await getUsdExchangeRate(true);
                await getExchangeRate();
                try{ await getAppPricing(getAppData(regionalUrl)); } catch(e){}
                // Reprocesar precios visibles en la página para reflejar la nueva cotización
                try{ getPrices('standard'); } catch(e){}
            } catch(e){
                console.error('Error actualizando cotización desde sección cotización', e);
            }
            cotBtn.innerText = original;
            cotBtn.disabled = false;
            window.__timbocitoUpdatingRate = false;
        });
        cotBtn.dataset.listenerAttached = '1';
    }
}


const renderPriceIndicators = (appData, exchangeRate) => {
    const taxesPY = (price) => calculateTaxesAndExchange(price, exchangeRate);

    return(`
        <p class="reason info">
            Precio sugerido LATAM <br><span class="regional-meter-price-us regional-meter-price-toggle" data-usd="${parseFloat(appData.recommendedArsPrice).toFixed(2)}" data-pyg="${numberToString(taxesPY(appData.recommendedArsPrice))}" data-current="usd" style="cursor: pointer; transition: opacity 0.2s;">USD$ ${parseFloat(appData.recommendedArsPrice).toFixed(2)}</span>
            ${appData.discount != 0 
                ?
                `<span class="timbocito-strikethrough-price regional-meter-price-toggle" data-usd="${parseFloat(appData.baseRecommendedArsPrice).toFixed(2)}" data-pyg="${numberToString(taxesPY(appData.baseRecommendedArsPrice))}" data-current="usd" style="cursor: pointer; transition: opacity 0.2s;">USD$ ${parseFloat(appData.baseRecommendedArsPrice).toFixed(2)}</span>`
                :
                ""
            }
        </p>
        <hr>
        <p class="reason info">
            Precio actual en Paraguay<br><span class="regional-meter-price regional-meter-price-toggle" data-usd="${appData.arsPrice.toFixed(2)}" data-pyg="${numberToString(taxesPY(appData.arsPrice))}" data-current="pyg" style="cursor: pointer; transition: opacity 0.2s;">${numberToString(taxesPY(appData.arsPrice))}</span>
            ${appData.discount != 0 
                ?
                `<span class="regional-meter-price timbocito-strikethrough-price regional-meter-price-toggle" data-usd="${appData.baseArsPrice.toFixed(2)}" data-pyg="${numberToString(taxesPY(appData.baseArsPrice))}" data-current="pyg" style="cursor: pointer; transition: opacity 0.2s;">${numberToString(taxesPY(appData.baseArsPrice))}</span>`
                :
                ""
            }
        </p> 
        <hr>
        <p class="reason info">
            Precio actual en Estados Unidos<br><span class="regional-meter-price-us regional-meter-price-toggle" data-usd="${appData.usdPrice.toFixed(2)}" data-pyg="${numberToString(taxesPY(appData.usdPrice))}" data-current="usd" style="cursor: pointer; transition: opacity 0.2s;">USD$ ${appData.usdPrice} </span> 
            ${appData.discount != 0 
                ?
                `<span class="timbocito-strikethrough-price regional-meter-price-toggle" data-usd="${appData.baseUsdPrice.toFixed(2)}" data-pyg="${numberToString(taxesPY(appData.baseUsdPrice))}" data-current="usd" style="cursor: pointer; transition: opacity 0.2s;">USD$ ${appData.baseUsdPrice} </span>`
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

    if(!sidebar) return;
    // Evitar duplicados de bloques Timbocito (solo los del indicador regional)
    Array.from(sidebar.querySelectorAll('.regional-meter-wrapper.timbocito-inserted, .heading_steamcito_1.timbocito-inserted')).forEach(el => el.remove());
    // No tocar el bloque de cotización si existe (cotizacion-block)

    // Preparar container del indicador regional
    let container =
        `
    <div class="block responsive_apppage_details_right heading heading_steamcito_1 heading_timbocito_1">
        <p>Análisis de precio regional</p>    
        <span>por Timbocito</span>
    
    </div>
        <div class="block responsive_apppage_details_right recommendation_reasons regional-meter-wrapper ${indicatorStyle} content_steamcito_1 content_timbocito_1">
        <div class="regional-meter-container">
            <div class="regional-meter-bar regional-meter-bar--expensive ${appData.regionalStatus == "expensive" && "regional-meter-bar--selected"}">
                <span>Off</span>
            </div>
            <div class="regional-meter-bar regional-meter-bar--semifair ${appData.regionalStatus == "semifair" && "regional-meter-bar--selected"}">
                <span>Mbore</span>
            </div>
            <div class="regional-meter-bar regional-meter-bar--fair ${appData.regionalStatus == "fair" && "regional-meter-bar--selected"}">
                <span>Omacha</span>
            </div>
            <div class="regional-meter-bar regional-meter-bar--cheap ${appData.regionalStatus == "cheap" && "regional-meter-bar--selected"}">
                <span>Oiko'i</span>
            </div>
            <div class="regional-meter-bar regional-meter-bar--excellent ${appData.regionalStatus == "excellent" && "regional-meter-bar--selected"}">
                <span>Oikoite</span>
            </div>
        </div>

        ${appData.usdPrice == appData.arsPrice && (appData.support_email || appData.support_url)
            ?
            `<span class="notify-publisher-button green-timbocito-button">Solicitar precio regional</span>`
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
                    ${appData.support_email ? `<button class="copiar-texto-timbocito green-timbocito-button" type="button" data-clipboard="publisher-email">Copiar</button>` : ""}
                </div>

            </div>

            <hr>

            <div class="email-template-container">
                
                ${appData.support_email ? 
                `<div class="email-template-container-subheader">
                    <h5>Asunto</h5> 
                    <div class="publisher-popup-flex-container">
                        <p class="publisher-subject">Question about new regional pricing on ${appData.name}</p> 
                        <button class="copiar-texto-timbocito green-timbocito-button" type="button" data-clipboard="publisher-subject">Copiar</button>
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
                        <button class="copiar-texto-timbocito green-timbocito-button" type="button" data-clipboard="email-template">Copiar</button>
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
    // Insertar solo el indicador regional; el bloque de cotización lo maneja renderExchangeIndicator
    sidebar.insertAdjacentHTML('afterbegin', container);
    // Marcar los elementos añadidos para evitar duplicados posteriores
    let added = sidebar.querySelectorAll('.responsive_apppage_details_right.heading_steamcito_1, .regional-meter-wrapper, .heading_steamcito_3');
    added.forEach(el => el.classList.add('timbocito-inserted'));

    // Solicitar al módulo de cotización que inserte/actualice su bloque debajo del regional
    try{ getExchangeRate(); } catch(e){}

    // Asegurar listener en el botón de actualización insertado junto a la cotización
    let newCotBtn = sidebar.querySelector('.timbocito-update-rate-btn');
    if(newCotBtn && !newCotBtn.dataset.listenerAttached){
        newCotBtn.addEventListener('click', async () => {
            newCotBtn.disabled = true;
            const original = newCotBtn.innerText;
            newCotBtn.innerText = 'Actualizando...';
            try{
                await getUsdExchangeRate(true);
                await getExchangeRate();
                try{ await getAppPricing(getAppData(regionalUrl)); } catch(e){}
            } catch(e){
                console.error('Error actualizando cotización desde sección regional', e);
            }
            newCotBtn.innerText = original;
            newCotBtn.disabled = false;
        });
        newCotBtn.dataset.listenerAttached = '1';
    }

    let toggleablePrices = document.querySelectorAll('.regional-meter-price-toggle');
    toggleablePrices.forEach(priceEl => {
        priceEl.addEventListener('click', () => {
            priceEl.style.opacity = 0;
            setTimeout(() => {
                if (priceEl.dataset.current === "usd") {
                    priceEl.innerText = priceEl.dataset.pyg;
                    priceEl.dataset.current = "pyg";
                    priceEl.classList.remove("regional-meter-price-us");
                    priceEl.classList.add("regional-meter-price");
                } else {
                    priceEl.innerText = "USD$ " + priceEl.dataset.usd;
                    priceEl.dataset.current = "usd";
                    priceEl.classList.remove("regional-meter-price");
                    priceEl.classList.add("regional-meter-price-us");
                }
                priceEl.style.opacity = 1;
            }, 150);
        });
    });

    if(appData.usdPrice == appData.arsPrice  && (appData.support_email || appData.support_url)){

        let clipboardHandlers = document.querySelectorAll('.copiar-texto-timbocito');
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

const appData = getAppData(regionalUrl);
getAppPricing(appData);
