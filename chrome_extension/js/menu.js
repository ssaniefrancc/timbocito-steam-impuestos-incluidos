function createMenus(){
    let oldMenu = document.querySelector("#global_action_menu") || document.querySelector('#checkout_steam_logo span');
    let steamcitoIcon = 
    `<div class="ico-steamcito"> 
        🧉
    </div>`;
    oldMenu && oldMenu.insertAdjacentHTML('afterend',steamcitoIcon);
    steamcitoIcon = document.querySelector(".ico-steamcito");
    steamcitoIcon && steamcitoIcon.addEventListener('click',showMenu);

    let steamcitoMenu = `
    <div class="menu-steamcito-background"></div>
    <div class="menu-steamcito">
            <div class="internal-menu">
                <span class="titulo">CONFIGURACIÓN DE STEAMCITO <br><span class="titulo__version"> Versión ${chrome.runtime.getManifest().version}</span></span>

                <div class="opciones-avanzadas-steamcito">

                    <div class="grupo-opciones">
                        <h3> Opciones de Cotización e Impuestos </h3>

                        <div class="opcion" id="metodo-de-pago">
                            <div>
                                <label for="metodo-de-pago-opciones">Tu método de pago</label>
                                <select name="" id="metodo-de-pago-opciones">
                                    <option value="steamcito-cotizacion-tarjeta">🧉 Tarjeta emitida en Paraguay</option>
                                </select>
                            </div>
                            <small>Se aplicará el IVA del 10% sobre la cotización del dólar.</small>
                        </div>

                        <div class="opcion">
                            <div>
                                <label for="national-tax">Impuestos nacionales</label>
                                <div class="input-container">
                                    <input id="national-tax" type="number" name="national-tax" disabled placeholder="10"/>
                                    <span> % </span>
                                </div>
                            </div>
                            <small>IVA Servicios Digitales en Paraguay.</small>
                        </div>                    

                        <div class="opcion">
                            <div>
                                <label for="province-tax">Comisión bancaria / Recargo extra</label>
                            <div class="input-container">
                                <input id="province-tax" type="number" name="province-tax" placeholder="0"/>
                                <span> % </span>
                            </div>    
                        </div>
                        <small> Configurá aquí el recargo adicional de tu banco si lo aplica (Itaú, Ueno, Sudameris, etc).</small>
                        </div>   

                    </div>

                    <div class="grupo-opciones">
                        <h3> Opciones Visuales </h3>

                        <div class="opcion" id="preferencia-de-precios">
                            <div>
                                <label for="modo-manual">Preferencia de visualización de precios</label>
                                <select name="" id="modo-manual">
                                    <option value="">Modo inteligente (Recomendado)</option>
                                    <option value="mate">Por defecto en Guaraníes</option>
                                    <option value="wallet">Por defecto en dólares</option>
                                </select>
                            </div>
                            <small>El modo inteligente te muestra el precio en función de tu saldo si estás logueado.</small>
                        </div>

                    </div>

                    <br>


                </div>

                <div class="ayuda-steamcito"> 
                    <div class="grupo-opciones">
                        <h3>Enlaces Útiles</h3>
                        <a href="https://www.set.gov.py/" target="_blank">Información sobre IVA Digital 🇵🇾</a>
                        <a href="https://github.com/ssaniefrancc/timbocito-steam-impuestos-incluidos/issues" target="_blank">Reportar un bug en la versión PY 🐛</a>
                        <a href="https://partner.steamgames.com/pricing" target="_blank">Precios Regionales de Valve 📊</a>
                        ${getReviewLink()} 
                    </div>
                </div>

            </div>

    </div>
    `;
    document.body.insertAdjacentHTML('beforeend',steamcitoMenu);
}

function getReviewLink(){
    return `<a href="https://chrome.google.com/webstore/detail/steamcito-steam-con-impue/fcjljapncagfmfhdkccgnbkgdpbcefcj" target="_blank">Valorá Steamcito en Chrome Store ⭐</a> `;
}

function setInitialLocalStates(){
    if(nationalTax) { localStorage.getItem('national-tax') && localStorage.getItem('national-tax') != '0' ? nationalTax.value = localStorage.getItem('national-tax') : localStorage.setItem('national-tax',10); }
    if(provinceTax) { localStorage.getItem('province-tax') ? provinceTax.value=localStorage.getItem('province-tax') : localStorage.removeItem('province-tax'); }
    if(selectManualMode) { localStorage.getItem('manual-mode') ? selectManualMode.value=localStorage.getItem('manual-mode') : localStorage.removeItem('manual-mode'); }
    localStorage.getItem('metodo-de-pago') != "steamcito-cotizacion-tarjeta" ? localStorage.setItem('metodo-de-pago','steamcito-cotizacion-tarjeta') : "" ;
}

function changePaymentMethodState(e){
    let value = e?.currentTarget?.value || e
    let tarjetaTax = JSON.parse(localStorage.getItem('steamcito-cotizacion-tarjeta')).taxAmount || 10 
    localStorage.setItem('metodo-de-pago', value)
    localStorage.setItem('national-tax', tarjetaTax)
    if(nationalTax) nationalTax.value = tarjetaTax;
    window.location.reload();
}

function changeManualModeState(){
    if(!selectManualMode.value){
        localStorage.removeItem('manual-mode')
    } else{
        selectManualMode.value == 'mate' ? localStorage.setItem('manual-mode', 'mate') : localStorage.setItem('manual-mode', 'wallet');
    }
    window.location.reload();
}

function changeNationalTax(){
    localStorage.setItem('national-tax',this.value);
    window.location.reload();
}

function changeProvinceTax(){
    localStorage.setItem('province-tax',this.value);
    window.location.reload();
}

function showMenu(e){
    menu.classList.add('enabled');
    menuBackground.classList.add('menu-steamcito-background-enabled');
    document.body.classList.add('menu-enabled');
    document.addEventListener('click',hideMenu);
}

function hideMenu(e){
    if(!menu.contains(e.target) && !steamcitoIcon.contains(e.target)) {
        menu.classList.remove('enabled');
        menuBackground.classList.remove('menu-steamcito-background-enabled');
        document.body.classList.remove('menu-enabled');
        document.removeEventListener('click',hideMenu);
    }
}

function setEmojis(){
    return ['<span class="emojis">🧉</span>','<span class="emojis">💲</span>'];        
}

// Inicializo Menú 
createMenus();

// Selecciono los botones del menú y les asigno eventos
const menu = document.querySelector(".menu-steamcito");
const menuBackground = document.querySelector(".menu-steamcito-background");

const steamcitoIcon = document.querySelector(".ico-steamcito");
let selectManualMode = document.querySelector("#modo-manual");
let selectPaymentMethod = document.querySelector('#metodo-de-pago-opciones');

selectManualMode && selectManualMode.addEventListener('input', changeManualModeState);
selectPaymentMethod && selectPaymentMethod.addEventListener('input', changePaymentMethodState);

let nationalTax = document.querySelector("#national-tax");
nationalTax && nationalTax.addEventListener('change', changeNationalTax);

let provinceTax = document.querySelector("#province-tax");
provinceTax && provinceTax.addEventListener('change', changeProvinceTax);

// Seteo el estado inicial de payment y emojis
setInitialLocalStates();

// Defino qué emojis se van a usar
const emojis = setEmojis();
const emojiMate = emojis[0];
const emojiWallet = emojis[1];
