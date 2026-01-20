// --- CONFIGURACIÓN FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyA10y5hAR7f801mnHDDcCqD-bR5zGONvXo",
  authDomain: "ajedrez-dual.firebaseapp.com",
  projectId: "ajedrez-dual",
  storageBucket: "ajedrez-dual.firebasestorage.app",
  messagingSenderId: "801556818038",
  appId: "1:801556818038:web:c04e8c103e99fa73715757",
  measurementId: "G-GKKMF3J3CD"
};

// Variables globales que usará el resto del juego
let db = null;
let auth = null;
let miUsuarioId = null;

// --- CONTROLADOR DE AUDIO ---
const AudioController = {
    volMusica: 0.5,
    volEfectos: 0.5,
    bgMusic: null, 

    init: function() {
        this.bgMusic = document.getElementById('snd-musica');
        if(this.bgMusic) this.bgMusic.volume = this.volMusica;
        this.playMusic();
        
        document.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('mouseenter', () => this.play('snd-boton'));
            btn.addEventListener('click', () => this.play('snd-boton'));
        });
    },

    play: function(id) {
        const audio = document.getElementById(id);
        if (audio) {
            audio.volume = this.volEfectos;
            audio.currentTime = 0;
            audio.play().catch(() => {});
        }
    },

    playMusic: function() {
        if(this.bgMusic) {
            this.bgMusic.play().catch(() => {
                // Si el navegador bloquea el autoplay, esperar al primer clic
                document.body.addEventListener('click', () => { 
                    this.bgMusic.play().catch(()=>{}); 
                }, { once: true });
            });
        }
    },

    stopMusic: function() {
        if(this.bgMusic) {
            this.bgMusic.pause();
            this.bgMusic.currentTime = 0;
        }
    },

    updateVolume: function(tipo, valor) {
        if (tipo === 'musica') {
            this.volMusica = valor;
            if(this.bgMusic) this.bgMusic.volume = valor;
        } else {
            this.volEfectos = valor;
        }
    }
};

// --- INICIALIZACIÓN Y CONEXIÓN FIREBASE ---
try {
    if (typeof firebase !== 'undefined') {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        db = firebase.database();
        auth = firebase.auth();
        console.log("✅ Firebase conectado.");

        auth.signInAnonymously()
            .then(() => { console.log("🕵️ Conectado de forma anónima."); })
            .catch((error) => {
                console.error("Error al entrar:", error);
                console.warn("Error de conexión. Revisa tu internet.");
            });

        auth.onAuthStateChanged((user) => {
            if (user) {
                miUsuarioId = user.uid;
                console.log("Mi ID es:", miUsuarioId);
            }
        });
    } else {
        console.warn("⚠️ ERROR: No se encontraron los scripts de Firebase en el HTML.");
    }
} catch (e) {
    console.error("⚠️ Error crítico:", e);
}

document.addEventListener('DOMContentLoaded', function() {
    
    // Iniciar Audio
    AudioController.init();

    // --- CORRECCIÓN BUG VISUAL: Forzar ocultar juego al inicio ---
    const contenedorJuego = document.getElementById('contenedor-principal-juego');
    if (contenedorJuego) contenedorJuego.style.display = 'none';
    // -------------------------------------------------------------

    // --- SISTEMA DE MODALES PERSONALIZADOS ---
    const modalAlertaGen = document.getElementById('modal-alerta-generica');
    const txtAlertaGen = document.getElementById('texto-alerta-generica');
    const btnCerrarAlertaGen = document.getElementById('btn-cerrar-alerta-generica');

    const modalConfirmGen = document.getElementById('modal-confirmacion-generica');
    const txtConfirmGen = document.getElementById('texto-confirmacion-generica');
    const btnConfirmSi = document.getElementById('btn-confirmar-si');
    const btnConfirmNo = document.getElementById('btn-confirmar-no');

    let accionConfirmacionPendiente = null; 

    window.mostrarAlerta = function(mensaje) {
        if(txtAlertaGen) {
            txtAlertaGen.innerText = mensaje;
            modalAlertaGen.style.display = 'flex';
            AudioController.play('snd-boton');
        } else { alert(mensaje); }
    };

    window.mostrarConfirmacion = function(mensaje, accionSi) {
        if(txtConfirmGen) {
            txtConfirmGen.innerText = mensaje;
            accionConfirmacionPendiente = accionSi;
            modalConfirmGen.style.display = 'flex';
            AudioController.play('snd-boton');
        } else { if(confirm(mensaje)) accionSi(); }
    };

    if(btnCerrarAlertaGen) {
        btnCerrarAlertaGen.addEventListener('click', () => {
            modalAlertaGen.style.display = 'none';
            AudioController.play('snd-boton');
        });
    };

    if(btnConfirmSi) {
        btnConfirmSi.addEventListener('click', () => {
            if (accionConfirmacionPendiente) accionConfirmacionPendiente();
            modalConfirmGen.style.display = 'none';
            accionConfirmacionPendiente = null;
            AudioController.play('snd-boton');
        });
    }

    if(btnConfirmNo) {
        btnConfirmNo.addEventListener('click', () => {
            modalConfirmGen.style.display = 'none';
            accionConfirmacionPendiente = null;
            AudioController.play('snd-boton');
        });
    }   
    console.log("Iniciando juego...");

    // --- 1. GESTIÓN DE DATOS Y PERSISTENCIA ---
let datosUsuario = {
        monedas: 50,
        inventarioPiezas: ['default'],
        inventarioTableros: ['default'],
        skinEquipadaPiezas: 'default',
        skinEquipadaTablero: 'default',
        nombre: '',
        partidasJugadas: 0,
        tutorialVisto: false // <--- NUEVA PROPIEDAD
    };

    try {
        const guardado = localStorage.getItem('datosAjedrezDual_v3');
        if (guardado) {
            const parsed = JSON.parse(guardado);
            datosUsuario = { ...datosUsuario, ...parsed };
        }
    } catch (err) {
        console.warn("Error leyendo datos, reiniciando perfil.", err);
    }

    function guardarDatosUsuario() {
        localStorage.setItem('datosAjedrezDual_v3', JSON.stringify(datosUsuario));
        actualizarInterfazMonedas();
    }

    function actualizarInterfazMonedas() {
        const txtTienda = document.getElementById('texto-monedas');
        const txtMenu = document.getElementById('menu-monedas-val');
        if(txtTienda) txtTienda.innerText = datosUsuario.monedas;
        if(txtMenu) txtMenu.innerText = datosUsuario.monedas;
    }

    // --- 2. SISTEMA DE ANUNCIOS ---
    const btnVerAnuncio = document.getElementById('btn-ver-anuncio');
    
    if(btnVerAnuncio) {
        btnVerAnuncio.addEventListener('click', () => {
            const originalText = btnVerAnuncio.innerText;
            btnVerAnuncio.disabled = true;
            btnVerAnuncio.innerText = "📺 Viendo anuncio...";
            
            setTimeout(() => {
                datosUsuario.monedas += 10;
                guardarDatosUsuario();
                mostrarAlerta("¡Gracias por ver el anuncio! Has ganado +10 Monedas.");
                btnVerAnuncio.innerText = originalText;
                btnVerAnuncio.disabled = false;
                AudioController.play('snd-victoria'); 
            }, 3000);
        });
    }

    function chequearAnuncioIntersticial() {
        datosUsuario.partidasJugadas++;
        guardarDatosUsuario();
        if (datosUsuario.partidasJugadas % 2 === 0) {
            setTimeout(() => {
                mostrarAlerta("📢 PUBLICIDAD PANTALLA COMPLETA 📢\n\n(Simulación AdMob)\n\n¡Gracias por apoyar el juego!");
            }, 800);
        }
    }

    // --- 3. CATÁLOGOS ---
    const CATALOGO_PIEZAS = [
        { id: 'default', nombre: 'Clásico', precio: 0 },
        { id: 'caballeros pixelart', nombre: 'Medieval', precio: 350 },
        { id: 'comida', nombre: 'Comida', precio: 400 },
        { id: 'emojis', nombre: 'Emojis', precio: 200 },
        { id: 'granja', nombre: 'Granja', precio: 150 },
        { id: 'instrumentos', nombre: 'Musica', precio: 450 },
        { id: 'maquillaje', nombre: 'Make Up', precio: 150 },
        { id: 'mariposas', nombre: 'Mariposas', precio: 100 },
        { id: 'medieval pixelart', nombre: 'Medieval PixelArt', precio: 350 },
        { id: 'militar', nombre: 'Militar', precio: 150 },
        { id: 'minecraft', nombre: 'Minecraft', precio: 200 },
        { id: 'moras y frutillas', nombre: 'FrutiMoras', precio: 500 },
        { id: 'navidad', nombre: 'Navidad', precio: 50 },
        { id: 'navidad pixelart', nombre: 'Navidad PixelArt', precio: 350 },
        { id: 'paises', nombre: 'Paises', precio: 50 },
        { id: 'peluches', nombre: 'Peluches', precio: 170 },
        { id: 'plantas', nombre: 'Naturaleza', precio: 300 },
        { id: 'reino', nombre: 'Princesas', precio: 400 },
        { id: 'roblox', nombre: 'Lego', precio: 150 },
        { id: 'utensillos', nombre: 'Cocina', precio: 100 },
    ];

    const CATALOGO_TABLEROS = [
        { id: 'default', nombre: 'Madera Clásica', precio: 0 },
        { id: 'comida', nombre: 'Food', precio: 200 },
        { id: 'granja', nombre: 'Granja', precio: 250 },
        { id: 'maquillaje', nombre: 'Make Up', precio: 350 },
        { id: 'mariposas', nombre: 'Mariposas', precio: 100 },
        { id: 'medieval pixelart', nombre: 'Medieval PixelArt', precio: 400 },
        { id: 'militar', nombre: 'Militar', precio: 200 },
        { id: 'navidad', nombre: 'Navidad', precio: 50 },
        { id: 'paises', nombre: 'Mundi', precio: 100 },
        { id: 'peluches', nombre: 'Peluches', precio: 300 },
        { id: 'plantas', nombre: 'Natural', precio: 200 },
        { id: 'reino', nombre: 'Reino', precio: 250 },
    ];
    
    let skinsPartida = {
        piezasMias: 'default',
        piezasRival: 'default',
        tableroPrincipal: 'default',
        tableroFantasma: 'default'
    };

    const PIEZAS_WIKI = {
        'wK': 'https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg', 
        'wQ': 'https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg', 
        'wR': 'https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg', 
        'wB': 'https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg', 
        'wN': 'https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg', 
        'wP': 'https://upload.wikimedia.org/wikipedia/commons/4/45/Chess_plt45.svg',
        'bK': 'https://upload.wikimedia.org/wikipedia/commons/f/f0/Chess_kdt45.svg', 
        'bQ': 'https://upload.wikimedia.org/wikipedia/commons/4/47/Chess_qdt45.svg', 
        'bR': 'https://upload.wikimedia.org/wikipedia/commons/f/ff/Chess_rdt45.svg', 
        'bB': 'https://upload.wikimedia.org/wikipedia/commons/9/98/Chess_bdt45.svg', 
        'bN': 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Chess_ndt45.svg', 
        'bP': 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Chess_pdt45.svg'
    };

    const VALOR_PIEZAS = { 'P': 10, 'N': 30, 'B': 30, 'R': 50, 'Q': 90, 'K': 900 };
    
    const PST = {
        'P': [[0,0,0,0,0,0,0,0],[5,5,5,5,5,5,5,5],[1,1,2,3,3,2,1,1],[0.5,0.5,1,2.5,2.5,1,0.5,0.5],[0,0,0,2,2,0,0,0],[0.5,-0.5,-1,0,0,-1,-0.5,0.5],[0.5,1,1,-2,-2,1,1,0.5],[0,0,0,0,0,0,0,0]],
        'N': [[-5,-4,-3,-3,-3,-3,-4,-5],[-4,-2,0,0,0,0,-2,-4],[-3,0,1,1.5,1.5,1,0,-3],[-3,0.5,1.5,2,2,1.5,0.5,-3],[-3,0,1.5,2,2,1.5,0,-3],[-3,0.5,1,1.5,1.5,1,0.5,-3],[-4,-2,0,0.5,0.5,0,-2,-4],[-5,-4,-3,-3,-3,-3,-4,-5]]
    };

    const POSICION_ORIGINAL = { 
        'bR_0': {fila:0,col:0}, 'bN_0': {fila:0,col:1}, 'bB_0': {fila:0,col:2}, 'bQ': {fila:0,col:3}, 'bK_P': {fila:0,col:4}, 'bB_1': {fila:0,col:5}, 'bN_1': {fila:0,col:6}, 'bR_1': {fila:0,col:7}, 
        'bP_0': {fila:1,col:0}, 'bP_1': {fila:1,col:1}, 'bP_2': {fila:1,col:2}, 'bP_3': {fila:1,col:3}, 'bP_4': {fila:1,col:4}, 'bP_5': {fila:1,col:5}, 'bP_6': {fila:1,col:6}, 'bP_7': {fila:1,col:7}, 
        'wP_0': {fila:6,col:0}, 'wP_1': {fila:6,col:1}, 'wP_2': {fila:6,col:2}, 'wP_3': {fila:6,col:3}, 'wP_4': {fila:6,col:4}, 'wP_5': {fila:6,col:5}, 'wP_6': {fila:6,col:6}, 'wP_7': {fila:6,col:7}, 
        'wR_0': {fila:7,col:0}, 'wN_0': {fila:7,col:1}, 'wB_0': {fila:7,col:2}, 'wQ': {fila:7,col:3}, 'wK_P': {fila:7,col:4}, 'wB_1': {fila:7,col:5}, 'wN_1': {fila:7,col:6}, 'wR_1': {fila:7,col:7} 
    };

    const POS_INICIAL_PRINCIPAL = [
        ['bR_0', 'bN_0', 'bB_0', 'bQ', 'bK_P', 'bB_1', 'bN_1', 'bR_1'],
        ['bP_0', 'bP_1', 'bP_2', 'bP_3', 'bP_4', 'bP_5', 'bP_6', 'bP_7'],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['wP_0', 'wP_1', 'wP_2', 'wP_3', 'wP_4', 'wP_5', 'wP_6', 'wP_7'],
        ['wR_0', 'wN_0', 'wB_0', 'wQ', 'wK_P', 'wB_1', 'wN_1', 'wR_1']
    ];
    const POS_INICIAL_FANTASMA = [
        ['', '', '', '', 'bK_F', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', 'wK_F', '', '', '']
    ];
    const HISTORIAL_INICIAL = { wK_P:false, wR_0:false, wR_1:false, bK_P:false, bR_0:false, bR_1:false, wK_F:false, bK_F:false };

function getEstadoInicial() {
        return {
            posPrincipal: JSON.parse(JSON.stringify(POS_INICIAL_PRINCIPAL)),
            posFantasma: JSON.parse(JSON.stringify(POS_INICIAL_FANTASMA)),
            turnoActual: 'w',
            historialMovimientos: JSON.parse(JSON.stringify(HISTORIAL_INICIAL)),
            juegoTerminado: false,
            modoJuego: 'local',
            colorJugador: 'w',
            colorIA: null,
            tableroVolteado: false,
            piezaSeleccionada: null,
            movimientosValidos: [],
            atacantePrincipal: null,
            atacanteFantasma: null,
            peonAlPaso: null, // <--- ¡AÑADE ESTA LÍNEA! (null o {fila, col, tablero})
			ultimoMovimiento: null // <--- AGREGA ESTA LÍNEA
        };
    }

    let estadoJuego = getEstadoInicial();
    let configuracionPartida = { color: 'w', dificultad: 'facil' };
    let onlineSalaId = null;
    let miColorOnline = null;
    let miNombreUsuario = "Jugador";
    let timerIA = null;
    let intervaloTemporizador = null;
    let tiempoRestante = 55;
    let coronacionPendiente = null;
    let onlinePath = 'partidas/'; 
    
	// --- SISTEMA DE TEMPORIZADORES ---
let tiempoBlancas = 600; // 10 minutos en segundos
let tiempoNegras = 600;
let intervalTemporizador = null;
let ultimoTiempoActualizacion = Date.now();

    // --- ELEMENTOS DOM ---
    const menuPrincipal = document.getElementById('menu-principal');
    const menuConfigIA = document.getElementById('menu-config-ia');
    const menuOnline = document.getElementById('menu-online');
    const pantallaEspera = document.getElementById('pantalla-espera');
    const contenedorPrincipalJuego = document.getElementById('contenedor-principal-juego');
    const infoOnlineBar = document.getElementById('info-online-bar');
    const miColorTexto = document.getElementById('mi-color-texto');
    const inputNombreUsuario = document.getElementById('input-nombre-usuario');
    const timerDisplay = document.getElementById('timer-display');
    
    const tableroPrincipal = document.getElementById('tableroPrincipal');
    const tableroFantasma = document.getElementById('tableroFantasma');
    const bannerJaquePrincipal = document.getElementById('banner-jaque-principal');
    const bannerJaqueFantasma = document.getElementById('banner-jaque-fantasma');
    const modalFinPartida = document.getElementById('modal-fin-partida');
    // const mensajeTexto = document.getElementById('mensaje-texto');
    const botonReiniciar = document.getElementById('boton-reiniciar');
    const toastNotificacion = document.getElementById('toast-notificacion');
    const modalReglas = document.getElementById('modal-reglas');
    const modalConfig = document.getElementById('modal-config');

    const btnJugarLocal = document.getElementById('btn-jugar-local');
    const btnJugarIA = document.getElementById('btn-jugar-ia');
    const btnMenuOnline = document.getElementById('btn-menu-online');
    const btnVolverMenu = document.getElementById('btn-volver-menu'); 
    const btnVolverOnline = document.getElementById('btn-volver-online'); 
    const btnCancelarEspera = document.getElementById('btn-cancelar-espera'); 
    const btnCrearSala = document.getElementById('btn-crear-sala');
    const btnUnirseSala = document.getElementById('btn-unirse-sala');
    const btnBuscarPublica = document.getElementById('btn-buscar-publica'); 
    
    const btnVerReglasMenu = document.getElementById('btn-ver-reglas-menu');
    const btnConfiguracion = document.getElementById('btn-configuracion');
    const btnFlotanteReglas = document.getElementById('btn-flotante-reglas');
    const btnCerrarReglas = document.getElementById('btn-cerrar-reglas');
    const btnCerrarConfig = document.getElementById('btn-cerrar-config');
    const btnSalirPartida = document.getElementById('btn-salir-partida');

    const btnColorBlancas = document.getElementById('btn-color-blancas');
    const btnColorNegras = document.getElementById('btn-color-negras');
    const btnDifFacil = document.getElementById('btn-dif-facil');
    const btnDifMedio = document.getElementById('btn-dif-medio');
    const btnDifDificil = document.getElementById('btn-dif-dificil');
    const btnComenzarIA = document.getElementById('btn-comenzar-ia');
    
    const sliderMusica = document.getElementById('slider-musica');
    const sliderEfectos = document.getElementById('slider-efectos');

    // --- CONFIGURACIÓN VOLUMEN ---
    if(sliderMusica) sliderMusica.addEventListener('input', (e) => AudioController.updateVolume('musica', e.target.value));
    if(sliderEfectos) sliderEfectos.addEventListener('input', (e) => AudioController.updateVolume('efectos', e.target.value));

    // --- LISTENERS MENÚS ---
    if(btnJugarLocal) btnJugarLocal.addEventListener('click', () => iniciarJuego('local'));
    if(btnJugarIA) btnJugarIA.addEventListener('click', mostrarMenuIA);
    if(btnMenuOnline) btnMenuOnline.addEventListener('click', iniciarModoOnline);
    if(btnVolverMenu) btnVolverMenu.addEventListener('click', volverAlMenu);
	// --- GUARDADO AUTOMÁTICO DE NOMBRE ---
    if (inputNombreUsuario) {
        inputNombreUsuario.addEventListener('input', () => {
            datosUsuario.nombre = inputNombreUsuario.value;          
            miNombreUsuario = inputNombreUsuario.value;           
            guardarDatosUsuario();
        });
    }
    if(btnConfiguracion) btnConfiguracion.addEventListener('click', () => modalConfig.style.display = 'flex');
    if(btnVerReglasMenu) btnVerReglasMenu.addEventListener('click', () => modalReglas.style.display = 'flex');
    
    // Config IA
    if(btnColorBlancas) btnColorBlancas.addEventListener('click', () => { 
        configuracionPartida.color = 'w'; 
        btnColorBlancas.classList.add('opcion-seleccionada'); 
        btnColorNegras.classList.remove('opcion-seleccionada'); 
    });
    if(btnColorNegras) btnColorNegras.addEventListener('click', () => { 
        configuracionPartida.color = 'b'; 
        btnColorNegras.classList.add('opcion-seleccionada'); 
        btnColorBlancas.classList.remove('opcion-seleccionada'); 
    });
    
    if(btnDifFacil) btnDifFacil.addEventListener('click', () => { configuracionPartida.dificultad = 'facil'; resaltarDif(btnDifFacil); });
    if(btnDifMedio) btnDifMedio.addEventListener('click', () => { configuracionPartida.dificultad = 'medio'; resaltarDif(btnDifMedio); });
    if(btnDifDificil) btnDifDificil.addEventListener('click', () => { configuracionPartida.dificultad = 'dificil'; resaltarDif(btnDifDificil); });
    
    function resaltarDif(btn) {
        [btnDifFacil, btnDifMedio, btnDifDificil].forEach(b => b.classList.remove('opcion-seleccionada'));
        btn.classList.add('opcion-seleccionada');
    }
    
    if(btnComenzarIA) btnComenzarIA.addEventListener('click', () => iniciarJuego('ia'));

    // Modales y botones varios
    if(btnCerrarReglas) btnCerrarReglas.addEventListener('click', () => modalReglas.style.display = 'none');
    if(btnFlotanteReglas) btnFlotanteReglas.addEventListener('click', () => modalReglas.style.display = 'flex');
    if(btnCerrarConfig) btnCerrarConfig.addEventListener('click', () => modalConfig.style.display = 'none');
    if(botonReiniciar) botonReiniciar.addEventListener('click', volverAlMenu);
    
    if(btnCrearSala) btnCrearSala.addEventListener('click', crearNuevaSala);
    if(btnUnirseSala) btnUnirseSala.addEventListener('click', unirseASalaManual);
    if(btnBuscarPublica) btnBuscarPublica.addEventListener('click', buscarPartidaPublica);
    if(btnCancelarEspera) btnCancelarEspera.addEventListener('click', ()=>{ menuOnline.style.display='flex'; pantallaEspera.style.display='none'; if(onlineSalaId && db) { db.ref('partidas/'+onlineSalaId).remove(); onlineSalaId=null; } });
    if(btnVolverOnline) btnVolverOnline.addEventListener('click', ()=>{ menuOnline.style.display='none'; menuPrincipal.style.display='flex'; });

if (btnSalirPartida) {
        btnSalirPartida.addEventListener('click', () => {
            // Ahora la confirmación sale SIEMPRE, sin importar el modo de juego
            mostrarConfirmacion("¿Estás seguro que quieres salir de la partida?", () => {
                // Esta lógica solo se ejecuta si el usuario pulsa "Sí"
                
                // 1. Si es Online, avisamos que abandonamos
                if (estadoJuego.modoJuego === 'online' && onlineSalaId && db) {
                    const campo = miColorOnline === 'w' ? 'jugadorBlancas' : 'jugadorNegras';
                    db.ref(onlinePath + onlineSalaId + '/' + campo).set('abandono');
                }

                // 2. Volvemos al menú
                volverAlMenu();
            });
        });
    }



    function ganarPorAbandono(colorAbandono) {
        if (!estadoJuego || estadoJuego.juegoTerminado) return;
        if (miColorOnline === colorAbandono) return;

        console.log("El rival abandonó. Otorgando victoria...");
        estadoJuego.juegoTerminado = true;

        const mensaje = "🏳️ El rival abandonó la partida. ¡Ganaste!";
        const ganador = miColorOnline; 

        dibujarTableros();
        anunciarGanador(mensaje, ganador); 
        detenerTemporizador();

        if (onlineSalaId && onlinePath && db) {
            db.ref(onlinePath + onlineSalaId).off();
        }
    }

    // --- CONTROL DE MENUS ---
    function iniciarModoOnline() { 
        if (!db) { mostrarAlerta("No se pudo conectar al servidor. Verifica tu internet."); return; }
        const nombre = inputNombreUsuario.value.trim();
        if (!nombre) {
            mostrarAlerta("Por favor, escribe tu nombre.");
            inputNombreUsuario.focus();
            return;
        }
        miNombreUsuario = nombre;
        datosUsuario.nombre = nombre; guardarDatosUsuario();
        menuPrincipal.style.display = 'none'; menuOnline.style.display = 'flex'; 
    }

    function mostrarMenuIA() { menuPrincipal.style.display = 'none'; menuConfigIA.style.display = 'flex'; }
    
    function volverAlMenu() {
        console.log("SALÍ AL MENÚ");
        modalFinPartida.style.display = 'none';
        contenedorPrincipalJuego.style.display = 'none';
        menuConfigIA.style.display = 'none';
        menuOnline.style.display = 'none';
        pantallaEspera.style.display = 'none';
        
        menuPrincipal.style.display = 'flex';

        if (estadoJuego.modoJuego === 'online' && onlineSalaId && db) {
            const campo = (miColorOnline === 'w') ? 'jugadorBlancas' : 'jugadorNegras';
            db.ref(onlinePath + onlineSalaId + '/' + campo).set('abandono');
            db.ref(onlinePath + onlineSalaId).off(); 
            
            onlineSalaId = null;
            miColorOnline = null;
        }

        if(timerIA) clearTimeout(timerIA);
        detenerTemporizador();
tiempoBlancas = 600;
tiempoNegras = 600;
        AudioController.playMusic();
        
        if(estadoJuego.juegoTerminado) chequearAnuncioIntersticial();
    }

    function iniciarJuego(modo) {
    AudioController.stopMusic();
    AudioController.play('snd-inicio');

    // --- CAMBIO: Mostrar relojes SIEMPRE (antes solo era en online) ---
    const relojBlancas = document.getElementById('reloj-blancas');
    const relojNegras = document.getElementById('reloj-negras');
    if (relojBlancas) relojBlancas.style.display = 'block';
    if (relojNegras) relojNegras.style.display = 'block';
    
    console.log("Iniciando juego en modo:", modo); 
    menuPrincipal.style.display = 'none';
    menuConfigIA.style.display = 'none'; 
    contenedorPrincipalJuego.style.display = 'grid';
    
    estadoJuego = getEstadoInicial(); 
    estadoJuego.modoJuego = modo; 
    
    // --- CAMBIO: Resetear tiempos y ARRANCAR el temporizador ---
    tiempoBlancas = 600; // 10 minutos
    tiempoNegras = 600;
    iniciarTemporizador(); // <--- ¡Esto da vida al reloj!

    if (modo === 'ia') {
        estadoJuego.colorJugador = configuracionPartida.color;
        estadoJuego.colorIA = (configuracionPartida.color === 'w') ? 'b' : 'w';
        estadoJuego.tableroVolteado = (estadoJuego.colorJugador === 'b'); 
    } else { 
        estadoJuego.colorJugador = 'w'; 
        estadoJuego.colorIA = null;
        estadoJuego.tableroVolteado = false; 
    }
    
    if(modo !== 'online') {
        infoOnlineBar.style.display = 'none';
        skinsPartida.piezasMias = datosUsuario.skinEquipadaPiezas;
        skinsPartida.piezasRival = datosUsuario.skinEquipadaPiezas;
        skinsPartida.tableroPrincipal = datosUsuario.skinEquipadaTablero;
        skinsPartida.tableroFantasma = datosUsuario.skinEquipadaTablero;
    }

    reiniciarJuego(); 
    verificarYMostrarReglas(); 

    if (modo === 'ia' && estadoJuego.turnoActual === estadoJuego.colorIA) {
        setTimeout(ejecutarTurnoIA, 700);
    }
}

    function crearNuevaSala() {
        if (!db) return;
        const salaId = Math.random().toString(36).substring(2, 8).toUpperCase();
        unirseComoHost(salaId, false); 
    }

    function buscarPartidaPublica() {
        if (!db) return;
        db.ref('partidas_publicas').orderByChild('jugadorNegras').equalTo('esperando').limitToFirst(1).once('value', (snapshot) => {
            if (snapshot.exists()) {
                const salaId = Object.keys(snapshot.val())[0];
                unirseComoInvitado(salaId, true); 
            } else {
                const salaId = Math.random().toString(36).substring(2, 8).toUpperCase();
                unirseComoHost(salaId, true);
            }
        });
    }

    function unirseComoHost(salaId, esPublica) {
        onlineSalaId = salaId; 
        miColorOnline = 'w';
        onlinePath = esPublica ? 'partidas_publicas/' : 'partidas/';
    tiempoBlancas = 600;
    tiempoNegras = 600;
        
        const dataSala = { 
            estado: getEstadoInicial(), 
            jugadorBlancas: 'conectado', 
            nombreBlancas: miNombreUsuario, 
            skinPiezasBlancas: datosUsuario.skinEquipadaPiezas,
            skinTableroBlancas: datosUsuario.skinEquipadaTablero,
            jugadorNegras: 'esperando',
            nombreNegras: 'Esperando...',
            esPublica: esPublica
        };
        
        db.ref(onlinePath + salaId).set(dataSala).then(() => { 
            mostrarPantallaEspera(salaId, esPublica); 
            escucharSala(salaId, onlinePath); 
            db.ref(onlinePath + salaId + '/jugadorBlancas').onDisconnect().set('desconectado');
        });
    }

    function unirseComoInvitado(salaId, esPublica) {
        onlineSalaId = salaId; 
        miColorOnline = 'b';
        onlinePath = esPublica ? 'partidas_publicas/' : 'partidas/';
    tiempoBlancas = 600;
    tiempoNegras = 600;

        db.ref(onlinePath + salaId).update({ 
            jugadorNegras: 'conectado',
            nombreNegras: miNombreUsuario,
            skinPiezasNegras: datosUsuario.skinEquipadaPiezas,
            skinTableroNegras: datosUsuario.skinEquipadaTablero
        }).then(() => {
            escucharSala(salaId, onlinePath);
            menuOnline.style.display = 'none'; contenedorPrincipalJuego.style.display = 'grid';
            verificarYMostrarReglas(); // <--- PON ESTA LÍNEA
            AudioController.stopMusic();
            AudioController.play('snd-inicio');
			iniciarTemporizador(); // Iniciar temporizador para el jugador negro
            db.ref(onlinePath + salaId + '/jugadorNegras').onDisconnect().set('desconectado');
        });
    }

    function unirseASalaManual() {
        if (!db) return;
        const codigo = document.getElementById('input-codigo-sala').value.toUpperCase();
        if (!codigo) { mostrarAlerta("Escribe un código"); return; }
        
        db.ref('partidas/' + codigo).get().then((snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                if (data.jugadorNegras === 'esperando') {
                    unirseComoInvitado(codigo, false);
                } else { mostrarAlerta("La sala está llena."); }
            } else { mostrarAlerta("Sala no encontrada."); }
        });
    }

    function mostrarPantallaEspera(codigo, esPublica) {
        menuOnline.style.display = 'none'; pantallaEspera.style.display = 'flex';
        const titulo = document.getElementById('titulo-espera');
        const contenedorCodigo = document.getElementById('contenedor-codigo-espera');
        const txtCodigo = document.getElementById('texto-codigo-sala');

        if (esPublica) {
            titulo.innerText = "Buscando Rival en el Mundo...";
            contenedorCodigo.style.display = 'none'; 
        } else {
            titulo.innerText = "Esperando Oponente...";
            contenedorCodigo.style.display = 'block';
            txtCodigo.innerText = codigo;
        }
    }

    function escucharSala(salaId, path) {
        db.ref(path + salaId).on('value', (snapshot) => {
            const data = snapshot.val(); 
            if (!data) return;

            if (estadoJuego.modoJuego === 'online' && !estadoJuego.juegoTerminado) {
                const estadoRival = (miColorOnline === 'w') ? data.jugadorNegras : data.jugadorBlancas;
                if (estadoRival === 'desconectado' || estadoRival === 'abandono') {
                    const colorRival = (miColorOnline === 'w') ? 'b' : 'w';
                    ganarPorAbandono(colorRival);
                    return; 
                }
            }

            const estadoRivalDisplay = document.getElementById('estado-rival');
            let rivalStatus = (miColorOnline === 'w') ? data.jugadorNegras : data.jugadorBlancas;
            
            if (rivalStatus === 'desconectado') {
                if(estadoRivalDisplay) estadoRivalDisplay.innerText = "⚠️ RIVAL DESCONECTADO";
            } else {
                if(estadoRivalDisplay) estadoRivalDisplay.innerText = "";
            }

            if (data.skinPiezasBlancas && data.skinPiezasNegras) {
                if (miColorOnline === 'w') {
                    skinsPartida.piezasMias = data.skinPiezasBlancas;
                    skinsPartida.piezasRival = data.skinPiezasNegras;
                } else {
                    skinsPartida.piezasMias = data.skinPiezasNegras;
                    skinsPartida.piezasRival = data.skinPiezasBlancas;
                }
                const sB = data.skinTableroBlancas;
                const sN = data.skinTableroNegras;
                skinsPartida.tableroPrincipal = (sB !== 'default') ? sB : ((sN !== 'default') ? sN : 'default');
                skinsPartida.tableroFantasma = skinsPartida.tableroPrincipal;
            }

            if (data.nombreBlancas && data.nombreNegras) {
                document.getElementById('nombre-blancas-display').innerText = data.nombreBlancas;
                document.getElementById('nombre-negras-display').innerText = data.nombreNegras;
            }

            if (miColorOnline === 'w' && data.jugadorNegras === 'conectado' && pantallaEspera.style.display === 'flex') {
                pantallaEspera.style.display = 'none'; 
                contenedorPrincipalJuego.style.display = 'grid';
                estadoJuego.modoJuego = 'online'; 
                estadoJuego.tableroVolteado = false;
                infoOnlineBar.style.display = 'block'; 
                miColorTexto.innerText = 'BLANCAS';
                miColorTexto.style.color = '#FFF';
                dibujarTableros();
                verificarYMostrarReglas(); // <--- PON ESTA LÍNEA
                AudioController.stopMusic();
                AudioController.play('snd-inicio');
                iniciarTemporizador();
            }
            
                 if (miColorOnline === 'b' && miColorTexto.innerText !== 'NEGRAS') {
                 infoOnlineBar.style.display = 'block'; 
                 miColorTexto.innerText = 'NEGRAS';
                 miColorTexto.style.color = '#333';
                 miColorTexto.style.backgroundColor = '#CCC'; 
                 miColorTexto.style.padding = "2px 5px";
                 miColorTexto.style.borderRadius = "4px";

                 estadoJuego = data.estado; 
                 estadoJuego.modoJuego = 'online';
                 estadoJuego.tableroVolteado = true;
                 dibujarTableros();
                 iniciarTemporizador();
            }

 if (data.estado) {
    const miVolteo = estadoJuego.tableroVolteado;
    const eraMiTurno = (estadoJuego.turnoActual === miColorOnline);
    
    estadoJuego = data.estado;
    estadoJuego.modoJuego = 'online';
    estadoJuego.tableroVolteado = miVolteo;
    
    // Sincronizar tiempos SOLO si cambió el turno
    const esAhoraMiTurno = (estadoJuego.turnoActual === miColorOnline);
    const cambioTurno = (eraMiTurno !== esAhoraMiTurno);
    

if (estadoJuego.tiempoBlancas !== undefined && estadoJuego.tiempoNegras !== undefined) {
    // Siempre actualizo el tiempo del RIVAL (el que NO controlo)
    if (miColorOnline === 'w') {
        // Soy blancas, actualizo el tiempo de negras
        tiempoNegras = estadoJuego.tiempoNegras;
    } else {
        // Soy negras, actualizo el tiempo de blancas
        tiempoBlancas = estadoJuego.tiempoBlancas;
    }
    
    // Si cambió el turno a mí, reseteo el tiempo base
    if (cambioTurno && esAhoraMiTurno) {
        ultimoTiempoActualizacion = Date.now();
    }
}
    
    dibujarTableros();
    actualizarDisplayRelojes();
                if (estadoJuego.juegoTerminado) {
                    const modalFin = document.getElementById('modal-fin-partida');
                    if (modalFin && modalFin.style.display !== 'flex') {
                        detenerTemporizador();
                        const msgFinal = estadoJuego.mensajeFin || "Partida Finalizada";
                        const winner = estadoJuego.ganador;
                        anunciarGanador(msgFinal, winner);
                    }
                }
            } 
        });
    }
                
function enviarMovimientoOnline() {
    if (estadoJuego.modoJuego === 'online' && db) {
        // Guardar tiempos actuales
estadoJuego.tiempoBlancas = Math.max(0, tiempoBlancas);
estadoJuego.tiempoNegras = Math.max(0, tiempoNegras);
        db.ref(onlinePath + onlineSalaId + '/estado').set(estadoJuego);
    }
}

    // --- DIBUJO ---
function dibujarTableros() {
        const juegos = document.querySelectorAll('.juego-completo');
        if (estadoJuego.tableroVolteado) { juegos.forEach(w => w.classList.add('volteado')); } 
        else { juegos.forEach(w => w.classList.remove('volteado')); }
        
        const colorActual = estadoJuego.turnoActual;
        if (!estadoJuego.juegoTerminado) {
            estadoJuego.atacantePrincipal = isInCheck(colorActual, estadoJuego.posPrincipal);
            estadoJuego.atacanteFantasma = isInCheck(colorActual, estadoJuego.posFantasma);
        } 
        const nombreJugador = colorActual === 'w' ? 'Blancas' : 'Negras';
        
        // --- 1. GESTIÓN DE BANNERS Y BORDES ROJOS (CORREGIDO) ---
        const wrapperP = document.getElementById('wrapper-principal');
        const wrapperF = document.getElementById('wrapper-fantasma');

        // Lógica Tablero Principal
        if (estadoJuego.atacantePrincipal) { 
            bannerJaquePrincipal.innerText = `¡${nombreJugador.toUpperCase()} EN JAQUE!`; 
            bannerJaquePrincipal.classList.add('visible'); 
            if(wrapperP) wrapperP.classList.add('tablero-en-jaque'); // Activa borde
        } else { 
            bannerJaquePrincipal.classList.remove('visible'); 
            if(wrapperP) wrapperP.classList.remove('tablero-en-jaque'); // Quita borde
        }
        
        // Lógica Tablero Fantasma
        if (estadoJuego.atacanteFantasma) { 
            bannerJaqueFantasma.innerText = `¡${nombreJugador.toUpperCase()} EN JAQUE!`; 
            bannerJaqueFantasma.classList.add('visible'); 
            if(wrapperF) wrapperF.classList.add('tablero-en-jaque'); // Activa borde
        } else { 
            bannerJaqueFantasma.classList.remove('visible'); 
            if(wrapperF) wrapperF.classList.remove('tablero-en-jaque'); // Quita borde
        }
        
        dibujarUnTablero(tableroPrincipal, estadoJuego.posPrincipal, 'principal', colorActual);
        dibujarUnTablero(tableroFantasma, estadoJuego.posFantasma, 'fantasma', colorActual);

        // --- APLICAR FONDOS DE TABLERO (SKINS) ---
        let skinP = 'default', skinF = 'default';
        if (estadoJuego.modoJuego === 'online') {
            skinP = skinsPartida.tableroPrincipal;
            skinF = skinsPartida.tableroFantasma;
        } else {
            skinP = datosUsuario.skinEquipadaTablero;
            skinF = datosUsuario.skinEquipadaTablero;
        }
        
        aplicarFondoTablero(wrapperP, skinP);
        aplicarFondoTablero(wrapperF, skinF);
    }
    
  
function aplicarFondoTablero(wrapper, skinId) {
        if(!wrapper) return;

        if (skinId === 'default') {
            wrapper.classList.remove('con-skin');
            wrapper.style.backgroundImage = 'none';
            wrapper.style.padding = '10%'; 
        } else {
            wrapper.classList.add('con-skin');
            wrapper.style.backgroundImage = `url('skins/tableros/${skinId}/tablero.png')`;
     
            wrapper.style.padding = '9.2%'; 
          
            wrapper.style.backgroundSize = '100% 100%'; 
        }
    }
	
    function dibujarUnTablero(contenedor, pos, nombreTablero, colorActual) {
        let reyPos = null;
        if (estadoJuego.juegoTerminado) {
             if (estadoJuego.atacanteFantasma && nombreTablero === 'fantasma') reyPos = findKing(estadoJuego.turnoActual, pos);
             else if (estadoJuego.atacantePrincipal && nombreTablero === 'principal') reyPos = findKing(estadoJuego.turnoActual, pos);
        } else { reyPos = findKing(colorActual, pos); }
        
        const atacante = (nombreTablero === 'principal') ? estadoJuego.atacantePrincipal : estadoJuego.atacanteFantasma;
        contenedor.innerHTML = '';
        
        for (let fila = 0; fila < 8; fila++) {
            for (let col = 0; col < 8; col++) {
                const casilla = document.createElement('div');
                casilla.classList.add('casilla');
                casilla.dataset.fila = fila; casilla.dataset.col = col;
				// --- PINTAR ÚLTIMO MOVIMIENTO (GRIS) ---
                if (estadoJuego.ultimoMovimiento && estadoJuego.ultimoMovimiento.tablero === nombreTablero) {
                    const um = estadoJuego.ultimoMovimiento;
                    // Si esta casilla es el Origen O el Destino, la pintamos
                    if ((um.origen.fila === fila && um.origen.col === col) || 
                        (um.destino.fila === fila && um.destino.col === col)) {
                        casilla.classList.add('casilla-ultimo-movimiento');
                    }
                }
                const esClara = (fila + col) % 2 !== 0;
                casilla.classList.add(esClara ? 'casilla-clara' : 'casilla-oscura');
                
                if (estadoJuego.piezaSeleccionada?.tablero === nombreTablero &&
                    estadoJuego.movimientosValidos.find(m => m.fila === fila && m.col === col)) {
                    casilla.classList.add('movimiento-valido');
                }
                if (atacante && reyPos && reyPos.fila === fila && reyPos.col === col) casilla.classList.add('casilla-jaque');
                if (atacante && atacante.fila === fila && atacante.col === col) casilla.classList.add('casilla-atacante');
                
                const nombrePieza = pos[fila][col];
                if (nombrePieza) {
                    const tipoPieza = nombrePieza.substring(1, 2); 
                    const colorPieza = nombrePieza.substring(0, 1);
                    const imgPieza = document.createElement('img');
                    
                    let skinAUsar = 'default';
                    if (estadoJuego.modoJuego === 'online') {
                        const soyBlancas = (miColorOnline === 'w');
                        if (soyBlancas) {
                            skinAUsar = (colorPieza === 'w') ? skinsPartida.piezasMias : skinsPartida.piezasRival;
                        } else {
                            skinAUsar = (colorPieza === 'b') ? skinsPartida.piezasMias : skinsPartida.piezasRival;
                        }
                    } else {
                        skinAUsar = datosUsuario.skinEquipadaPiezas;
                    }

                    if (skinAUsar === 'default') {
                        imgPieza.src = PIEZAS_WIKI[colorPieza + tipoPieza];
                    } else {
                        imgPieza.src = `skins/piezas/${skinAUsar}/${colorPieza}${tipoPieza}.png`;
                    }
                    
                    imgPieza.classList.add('pieza');
                    imgPieza.style.pointerEvents = 'none';
                    imgPieza.id = `pieza-${nombreTablero}-${fila}-${col}`;

                    if (estadoJuego.piezaSeleccionada?.tablero === nombreTablero &&
                        estadoJuego.piezaSeleccionada.fila === fila && 
                        estadoJuego.piezaSeleccionada.col === col) {
                        imgPieza.classList.add('pieza-seleccionada');
                    }
                    casilla.appendChild(imgPieza);
                }
                contenedor.appendChild(casilla);
            }
        }
    }

    // --- CLICS ---
    function alHacerClicEnCualquierTablero(evento) {
        if (!estadoJuego || estadoJuego.juegoTerminado) return; 
        if (estadoJuego.modoJuego === 'ia' && estadoJuego.turnoActual === estadoJuego.colorIA) return;
        if (estadoJuego.modoJuego === 'online' && estadoJuego.turnoActual !== miColorOnline) return;
        
        const casillaClickeada = evento.target.closest('.casilla');
        if (!casillaClickeada) return; 
        const tableroElement = casillaClickeada.closest('.tablero');
        if (!tableroElement) return; 
        const nombreTablero = tableroElement.id === 'tableroPrincipal' ? 'principal' : 'fantasma';
        const pos = (nombreTablero === 'principal') ? estadoJuego.posPrincipal : estadoJuego.posFantasma;
        let fila = parseInt(casillaClickeada.dataset.fila);
        let col = parseInt(casillaClickeada.dataset.col);
        
        const piezaEnCasilla = pos[fila][col];
        const colorActual = estadoJuego.turnoActual;
        const estaEnJaqueP = isInCheck(colorActual, estadoJuego.posPrincipal);
        const estaEnJaqueF = isInCheck(colorActual, estadoJuego.posFantasma);

        if (estaEnJaqueP && nombreTablero !== 'principal') { mostrarToast("¡Debes salir del Jaque en el tablero Principal!"); return; }
        if (estaEnJaqueF && nombreTablero !== 'fantasma') { mostrarToast("¡Debes salir del Jaque en el tablero Fantasma!"); return; }

        if (estadoJuego.piezaSeleccionada) {
            if (estadoJuego.piezaSeleccionada.tablero === nombreTablero) {
                const movimientoValido = estadoJuego.movimientosValidos.find(m => m.fila === fila && m.col === col);
                if (movimientoValido) {
                    const origen = estadoJuego.piezaSeleccionada;
                    const destino = { fila, col };
                    const tipoPieza = getTipo(origen.pieza);
                    const esEnroque = (tipoPieza === 'K' && Math.abs(origen.col - destino.col) === 2);
                    limpiarSeleccion();
                    
                    if (esEnroque && nombreTablero === 'principal') {
                        animarYCompletarEnroque(origen, destino, nombreTablero);
                    } else {
                        moverPieza(origen, destino, nombreTablero);
                        const esPeon = getTipo(origen.pieza) === 'P';
                        const colorP = getColor(origen.pieza);
                        const filaFin = (colorP === 'w') ? 0 : 7;
                        
                        if (esPeon && destino.fila === filaFin) {
                            iniciarCoronacion(destino, nombreTablero, colorP);
                        } else {
                            gestionarFinDeTurno();
                        }
                    }
                    return; 
                }
            }
        }

        if (piezaEnCasilla && getColor(piezaEnCasilla) === estadoJuego.turnoActual) {
            seleccionarPieza(fila, col, piezaEnCasilla, nombreTablero);
            dibujarTableros();
            return; 
        }

        limpiarSeleccion();
        dibujarTableros();
    }
    
    // Asignar listeners a tableros
    tableroPrincipal.addEventListener('click', alHacerClicEnCualquierTablero);
    tableroFantasma.addEventListener('click', alHacerClicEnCualquierTablero);

    function animarYCompletarEnroque(origen, destino, nombreTablero) {
        mostrarToast("¡Enroque!");
        AudioController.play('snd-enroque');

        let origenFilaDOM = origen.fila; 
        let origenColDOM = origen.col;
        let torreFilaDOM = origen.fila;
        let torreColOrigenDOM;

        const reyImg = document.getElementById(`pieza-${nombreTablero}-${origenFilaDOM}-${origenColDOM}`);
        let torreImg;

        // --- CORRECCIÓN FINAL: RESETEAR ANIMACIÓN ---
        if (reyImg) {
            reyImg.classList.remove('pieza-seleccionada');
            // TRUCO DE MAGIA: Esta línea extraña obliga al navegador a resetear la pieza
            // antes de moverla, permitiendo que la animación de deslizamiento funcione.
            void reyImg.offsetWidth; 
        }

        if (destino.col === 6) { 
            // Enroque CORTO
            torreColOrigenDOM = 7;
            torreImg = document.getElementById(`pieza-${nombreTablero}-${torreFilaDOM}-${torreColOrigenDOM}`);
            
            if(reyImg) reyImg.classList.add('pieza-enroque-corto-rey');
            if(torreImg) torreImg.classList.add('pieza-enroque-corto-torre');
        } else { 
            // Enroque LARGO
            torreColOrigenDOM = 0;
            torreImg = document.getElementById(`pieza-${nombreTablero}-${torreFilaDOM}-${torreColOrigenDOM}`);
            
            if(reyImg) reyImg.classList.add('pieza-enroque-largo-rey');
            if(torreImg) torreImg.classList.add('pieza-enroque-largo-torre');
        }

        setTimeout(() => { 
            moverPieza(origen, destino, nombreTablero); 
            gestionarFinDeTurno(); 
        }, 400); 
    }
	
function iniciarTemporizador() {
    detenerTemporizador(); // Limpiar cualquier temporizador previo
    
    
    ultimoTiempoActualizacion = Date.now();
    actualizarDisplayRelojes();
    
    // Iniciar intervalo que actualiza cada 100ms para mayor precisión
    intervalTemporizador = setInterval(() => {
        if (estadoJuego.juegoTerminado) {
            detenerTemporizador();
            return;
        }
        
 // En online, solo YO decremento mi propio reloj
const deboDecrementar = (estadoJuego.modoJuego !== 'online') || (estadoJuego.turnoActual === miColorOnline);
        
if (!deboDecrementar) {
    // No es mi turno, solo actualizar display
    actualizarDisplayRelojes();
    return;
}
        
        const ahora = Date.now();
        const deltaTiempo = (ahora - ultimoTiempoActualizacion) / 1000;
        ultimoTiempoActualizacion = ahora;
        
        // Restar tiempo al jugador actual
        if (estadoJuego.turnoActual === 'w') {
            tiempoBlancas -= deltaTiempo;
            if (tiempoBlancas <= 0) {
                tiempoBlancas = 0;
                finalizarPorTiempo('w');
                return;
            }
        } else {
            tiempoNegras -= deltaTiempo;
            if (tiempoNegras <= 0) {
                tiempoNegras = 0;
                finalizarPorTiempo('b');
                return;
            }
        }
        
        actualizarDisplayRelojes();
        
// Enviar actualización cada segundo cuando es mi turno
if (estadoJuego.modoJuego === 'online' && estadoJuego.turnoActual === miColorOnline) {
    const segundoActual = Math.floor(tiempoBlancas + tiempoNegras);
    const segundoAnterior = Math.floor((tiempoBlancas + deltaTiempo) + (tiempoNegras + deltaTiempo));
    
    if (segundoActual !== segundoAnterior) {
        enviarMovimientoOnline();
    }
}
    }, 100);
}

function detenerTemporizador() {
    if (intervalTemporizador) {
        clearInterval(intervalTemporizador);
        intervalTemporizador = null;
    }
}

function actualizarDisplayRelojes() {
    const relojBlancas = document.getElementById('reloj-blancas');
    const relojNegras = document.getElementById('reloj-negras');
    
    if (relojBlancas) {
        relojBlancas.innerText = formatearTiempo(tiempoBlancas);
        
        // Resaltar reloj activo
        if (estadoJuego.turnoActual === 'w' && !estadoJuego.juegoTerminado) {
            relojBlancas.classList.add('reloj-activo');
            relojNegras.classList.remove('reloj-activo');
        } else if (estadoJuego.turnoActual === 'b' && !estadoJuego.juegoTerminado) {
            relojBlancas.classList.remove('reloj-activo');
            relojNegras.classList.add('reloj-activo');
        }
        
        // Advertencia cuando queda poco tiempo (menos de 1 minuto)
        if (tiempoBlancas < 60) {
            relojBlancas.style.color = '#e74c3c';
            relojBlancas.style.fontWeight = 'bold';
        } else {
            relojBlancas.style.color = '#333';
            relojBlancas.style.fontWeight = 'normal';
        }
    }
    
    if (relojNegras) {
        relojNegras.innerText = formatearTiempo(tiempoNegras);
        
        if (tiempoNegras < 60) {
            relojNegras.style.color = '#e74c3c';
            relojNegras.style.fontWeight = 'bold';
        } else {
            relojNegras.style.color = '#FFF';
            relojNegras.style.fontWeight = 'normal';
        }
    }
}

function formatearTiempo(segundos) {
    const mins = Math.floor(segundos / 60);
    const segs = Math.floor(segundos % 60);
    return `${mins}:${segs.toString().padStart(2, '0')}`;
}

function finalizarPorTiempo(colorPerdedor) {
    if (estadoJuego.juegoTerminado) return;
    
    estadoJuego.juegoTerminado = true;
    detenerTemporizador();
    
    const nombrePerdedor = colorPerdedor === 'w' ? 'Blancas' : 'Negras';
    const nombreGanador = colorPerdedor === 'w' ? 'Negras' : 'Blancas';
    const colorGanador = colorPerdedor === 'w' ? 'b' : 'w';
    
    const mensaje = `⏰ ¡Se acabó el tiempo!\n${nombrePerdedor} perdieron.\n¡Ganan ${nombreGanador}!`;
    
    dibujarTableros();
    anunciarGanador(mensaje, colorGanador);
    enviarMovimientoOnline();
}

    function gestionarFinDeTurno() {
    const jugadorActual = estadoJuego.turnoActual;
    const oponente = jugadorActual === 'w' ? 'b' : 'w';
    const nombreJugador = jugadorActual === 'w' ? 'Blancas' : 'Negras';
    const nombreOponente = oponente === 'w' ? 'Blancas' : 'Negras';

    let terminado = false;
    let mensaje = "";
    let ganadorColor = null;

    const estaEnJaqueP = isInCheck(oponente, estadoJuego.posPrincipal);
    const estaEnJaqueF = isInCheck(oponente, estadoJuego.posFantasma);

    if (isCheckmate(jugadorActual, estadoJuego.posFantasma)) {
        estadoJuego.atacanteFantasma = isInCheck(jugadorActual, estadoJuego.posFantasma);
        terminado = true;
        mensaje = `¡SACRIFICIO LETAL! Ganan las ${nombreOponente}.`;
        ganadorColor = oponente;
    }
    else if (isCheckmate(oponente, estadoJuego.posPrincipal)) {
        estadoJuego.atacantePrincipal = isInCheck(oponente, estadoJuego.posPrincipal);
        terminado = true;
        mensaje = `¡JAQUE MATE! ${nombreJugador} ganan en el tablero Principal.`;
        ganadorColor = jugadorActual;
    }
    else if (isCheckmate(oponente, estadoJuego.posFantasma)) {
        estadoJuego.atacanteFantasma = isInCheck(oponente, estadoJuego.posFantasma);
        terminado = true;
        mensaje = `¡JAQUE MATE! ${nombreJugador} ganan en el tablero Fantasma.`;
        ganadorColor = jugadorActual;
    }
    else if (!estaEnJaqueP && !estaEnJaqueF) {
        const movimientosLegales = [];
        getMovesForBoard('principal', estadoJuego.posPrincipal, oponente, movimientosLegales);
        getMovesForBoard('fantasma', estadoJuego.posFantasma, oponente, movimientosLegales);

        if (movimientosLegales.length === 0) {
            terminado = true;
            mensaje = "¡TABLAS! Rey ahogado.";
            ganadorColor = 'draw';
        }
    }

    if (terminado) {
        estadoJuego.juegoTerminado = true;
        dibujarTableros();
        anunciarGanador(mensaje, ganadorColor);
        enviarMovimientoOnline();
        detenerTemporizador(); // Aquí sí detenemos el reloj porque acabó el juego
        return;
    }

    if (estaEnJaqueP || estaEnJaqueF) {
        AudioController.play('snd-jaque');
    }

    estadoJuego.turnoActual = oponente;
    ultimoTiempoActualizacion = Date.now(); // Resetear base de tiempo para el cambio de turno
    dibujarTableros();
    actualizarDisplayRelojes();
    enviarMovimientoOnline();

    if (estadoJuego.modoJuego === 'ia' && estadoJuego.turnoActual === estadoJuego.colorIA) {
        timerIA = setTimeout(ejecutarTurnoIA, 700);
    }

    // --- CAMBIO IMPORTANTE: ---
    // He BORRADO la línea: "if (estadoJuego.modoJuego !== 'online') detenerTemporizador();"
    // Al borrarla, el reloj sigue corriendo para el siguiente jugador en modo local.
}

    
    function anunciarGanador(mensaje, ganadorColor) {
        let premio = 0;
        
        if (ganadorColor === estadoJuego.colorJugador) {
            if (estadoJuego.modoJuego === 'online') {
                premio = 35; 
            } else if (estadoJuego.modoJuego === 'ia') {
                premio = 20; 
            }
        }

        if (premio > 0) {
            datosUsuario.monedas += premio;
            guardarDatosUsuario(); 
            mensaje += `\n¡Ganaste +$${premio}!`;
            AudioController.play('snd-victoria');
        } else if (estadoJuego.modoJuego === 'online' && ganadorColor !== estadoJuego.colorJugador) {
            AudioController.play('snd-derrota');
        } else {
            AudioController.play('snd-victoria');
        }

        document.getElementById('mensaje-texto').innerText = mensaje;
        modalFinPartida.style.display = 'flex';
    }

    function ejecutarTurnoIA() {
        if (estadoJuego.juegoTerminado) return;
        const colorIA = estadoJuego.colorIA;
        const todosMovimientosLegales = [];
        const estaEnJaqueP = isInCheck(colorIA, estadoJuego.posPrincipal);
        const estaEnJaqueF = isInCheck(colorIA, estadoJuego.posFantasma);
        
        if (!estaEnJaqueF) getMovesForBoard('principal', estadoJuego.posPrincipal, colorIA, todosMovimientosLegales);
        if (!estaEnJaqueP) getMovesForBoard('fantasma', estadoJuego.posFantasma, colorIA, todosMovimientosLegales);
        
        if (todosMovimientosLegales.length === 0) return;
        
        let movElegido = null;
        if (configuracionPartida.dificultad === 'facil') {
            movElegido = todosMovimientosLegales[Math.floor(Math.random() * todosMovimientosLegales.length)];
        } else {
            movElegido = getMejorMovimientoIA(todosMovimientosLegales, colorIA, true);
        }
        
        seleccionarPieza(movElegido.origen.fila, movElegido.origen.col, movElegido.origen.pieza, movElegido.tablero);
        estadoJuego.movimientosValidos = [movElegido.destino];
        dibujarTableros();
        
        setTimeout(() => {
            const esEnroque = (getTipo(movElegido.origen.pieza) === 'K' && Math.abs(movElegido.origen.col - movElegido.destino.col) === 2);
            if (esEnroque && movElegido.tablero === 'principal') {
                animarYCompletarEnroque(movElegido.origen, movElegido.destino, movElegido.tablero);
            } else {
                moverPieza(movElegido.origen, movElegido.destino, movElegido.tablero);
                gestionarFinDeTurno();
            }
        }, 500);
    }
    
    function getMovesForBoard(nombre, pos, color, lista) {
        for (let f = 0; f < 8; f++) { for (let c = 0; c < 8; c++) {
            const pieza = pos[f][c];
            if (pieza && getColor(pieza) === color) {
                const origen = { fila: f, col: c, pieza };
                const movimientosPosibles = getValidMoves(f, c, pieza, pos);
                const movimientosLegales = filterLegalMoves(movimientosPosibles, origen, pos);
                for (const destino of movimientosLegales) lista.push({ origen, destino, tablero: nombre });
            }
        }}
    }
    function getMejorMovimientoIA(movimientosLegales, colorIA, usarPosicional) {
        let mejorPuntuacion = -Infinity; let mejoresMovimientos = []; 
        for (const mov of movimientosLegales) {
            const posSimulada = (mov.tablero === 'principal') ? JSON.parse(JSON.stringify(estadoJuego.posPrincipal)) : JSON.parse(JSON.stringify(estadoJuego.posFantasma));
            posSimulada[mov.destino.fila][mov.destino.col] = mov.origen.pieza;
            posSimulada[mov.origen.fila][mov.origen.col] = '';
            let puntuacion = 0;
            if (mov.tablero === 'principal') puntuacion = evaluarTablero(posSimulada, colorIA, usarPosicional) + evaluarTablero(estadoJuego.posFantasma, colorIA, usarPosicional);
            else puntuacion = evaluarTablero(estadoJuego.posPrincipal, colorIA, usarPosicional) + evaluarTablero(posSimulada, colorIA, usarPosicional);
            if (puntuacion > mejorPuntuacion) { mejorPuntuacion = puntuacion; mejoresMovimientos = [mov]; }
            else if (puntuacion === mejorPuntuacion) { mejoresMovimientos.push(mov); }
        }
        return mejoresMovimientos[Math.floor(Math.random() * mejoresMovimientos.length)];
    }
    function evaluarTablero(pos, color, usarPosicional) {
        let puntuacion = 0;
        for (let f = 0; f < 8; f++) { for (let c = 0; c < 8; c++) {
            const pieza = pos[f][c];
            if (pieza) {
                const tipo = getTipo(pieza);
                let valor = VALOR_PIEZAS[tipo] || 0;
                if (usarPosicional && PST[tipo] && Array.isArray(PST[tipo])) {
                    let bonus = (getColor(pieza) === 'w') ? (PST[tipo][f][c] || 0) : (PST[tipo][7-f][c] || 0);
                    valor += bonus;
                }
                if (getColor(pieza) === color) puntuacion += valor; else puntuacion -= valor;
            }
        }}
        return puntuacion;
    }

function moverPieza(origen, destino, tablero) {
        let huboCaptura = false;
        const pos = (tablero === 'principal') ? estadoJuego.posPrincipal : estadoJuego.posFantasma;
        const pieza = origen.pieza; 
        const tipoPieza = getTipo(pieza);
        const colorPieza = getColor(pieza);
        const soyYo = (colorPieza === estadoJuego.colorJugador);
        
        // --- LÓGICA CAPTURA AL PASO (EN PASSANT) ---
        let esCapturaAlPaso = false;
        if (tipoPieza === 'P' && estadoJuego.peonAlPaso) {
            // Si el peón aterriza exactamente en la casilla "sombra" del peón al paso
            if (destino.fila === estadoJuego.peonAlPaso.fila && 
                destino.col === estadoJuego.peonAlPaso.col && 
                estadoJuego.peonAlPaso.tablero === tablero) {
                
                esCapturaAlPaso = true;
                // La pieza a capturar NO está en el destino, está en la fila de origen del atacante
                // (Ej: Si muevo a fila 2, el peón enemigo está en fila 3)
                const filaEnemiga = origen.fila; 
                const piezaCapturadaEP = pos[filaEnemiga][destino.col];
                
                // Borrar peón enemigo y revivirlo
                pos[filaEnemiga][destino.col] = ''; 
                revivirPiezaEnFantasma(piezaCapturadaEP);
                huboCaptura = true;
                mostrarToast("¡Captura al Paso!");
            }
        }

        // --- LÓGICA DE CAPTURA NORMAL ---
        if (!esCapturaAlPaso) {
            if (tablero === 'principal') {
                const piezaCapturada = pos[destino.fila][destino.col];
                if (piezaCapturada && getTipo(piezaCapturada) !== 'K') { 
                    revivirPiezaEnFantasma(piezaCapturada);
                    huboCaptura = true; 
                }
            } else {
                 if (pos[destino.fila][destino.col] !== '') huboCaptura = true;
            }
        }
        
        // --- AUDIO ---
        if (huboCaptura) {
            if (estadoJuego.modoJuego === 'local') AudioController.play('snd-captura-yo');
            else { if (soyYo) AudioController.play('snd-captura-yo'); else AudioController.play('snd-captura-me'); }
        } else {
            if (estadoJuego.modoJuego === 'local') AudioController.play('snd-mov-yo');
            else { if (soyYo) AudioController.play('snd-mov-yo'); else AudioController.play('snd-mov-rival'); }
        }
        
        // Mover la pieza en la matriz
        pos[destino.fila][destino.col] = pieza; 
        pos[origen.fila][origen.col] = '';
        
        // Manejo de Enroque (mover la torre)
        if (tipoPieza === 'K' && Math.abs(destino.col - origen.col) === 2) {
            if (destino.col === 6) { const t=pos[destino.fila][7]; pos[destino.fila][5]=t; pos[destino.fila][7]=''; }
            else if (destino.col === 2) { const t=pos[destino.fila][0]; pos[destino.fila][3]=t; pos[destino.fila][0]=''; }
        }

        // --- ACTUALIZAR ESTADO PEÓN AL PASO ---
        // Si un peón se mueve 2 casillas, habilitamos la captura para el sgte turno
        if (tipoPieza === 'P' && Math.abs(destino.fila - origen.fila) === 2) {
            // La casilla "sombra" es la intermedia
            const filaIntermedia = (origen.fila + destino.fila) / 2;
            estadoJuego.peonAlPaso = {
                fila: filaIntermedia,
                col: origen.col,
                tablero: tablero
            };
        } else {
            // Cualquier otro movimiento borra la oportunidad
            estadoJuego.peonAlPaso = null;
        }

        // Actualizar historial para enroques
        const hKey = pieza; 
        if (estadoJuego.historialMovimientos.hasOwnProperty(hKey)) estadoJuego.historialMovimientos[hKey] = true;
		
		// --- GUARDAR EL ÚLTIMO MOVIMIENTO PARA RESALTARLO ---
        estadoJuego.ultimoMovimiento = {
            origen: { fila: origen.fila, col: origen.col },
            destino: { fila: destino.fila, col: destino.col },
            tablero: tablero
        };
    }

    function reiniciarJuego() {
        const modo=estadoJuego.modoJuego; const cJ=estadoJuego.colorJugador; const cIA=estadoJuego.colorIA; const v=estadoJuego.tableroVolteado;
        estadoJuego = getEstadoInicial();
        estadoJuego.modoJuego=modo; estadoJuego.colorJugador=cJ; estadoJuego.colorIA=cIA; estadoJuego.tableroVolteado=v;
        modalFinPartida.style.display = 'none'; dibujarTableros();
    }

function revivirPiezaEnFantasma(pieza) {
    const origen = POSICION_ORIGINAL[pieza];
    
    // 1. Intento prioritario: Su casilla original
    if (origen && isEmpty(estadoJuego.posFantasma, origen.fila, origen.col)) {
        estadoJuego.posFantasma[origen.fila][origen.col] = pieza;
        // AQUÍ BORRAMOS EL TOAST
        return; 
    }

    // 2. Fallback: Buscar hueco libre
    let filaInicio = 0;
    if (origen) {
        filaInicio = origen.fila;
    } else {
        filaInicio = (getColor(pieza) === 'w') ? 7 : 0;
    }

    for (let i = 0; i < 8; i++) {
        const f = (filaInicio + i) % 8;
        for (let c = 0; c < 8; c++) {
            if (isEmpty(estadoJuego.posFantasma, f, c)) {
                estadoJuego.posFantasma[f][c] = pieza;
                // AQUÍ TAMBIÉN BORRAMOS EL TOAST
                return; 
            }
        }
    }
    console.warn("⚠️ Tablero fantasma colapsado. No cabe ni un alfiler.");
}
    
    function iniciarCoronacion(destino, tablero, color) {
        coronacionPendiente = { destino, tablero, color };
        document.getElementById('modal-coronacion').style.display = 'flex';
    }

    // Funciones auxiliares ajedrez
    function seleccionarPieza(f,c,p,t) { estadoJuego.piezaSeleccionada={fila:f,col:c,pieza:p,tablero:t}; const pos=(t==='principal')?estadoJuego.posPrincipal:estadoJuego.posFantasma; const movs=getValidMoves(f,c,p,pos); estadoJuego.movimientosValidos=filterLegalMoves(movs,{fila:f,col:c,pieza:p},pos); }
    function limpiarSeleccion() { estadoJuego.piezaSeleccionada=null; estadoJuego.movimientosValidos=[]; }
    function getValidMoves(f,c,p,pos) { const t=getTipo(p); const co=getColor(p); if(t==='P')return getPawnMoves(f,c,co,pos); if(t==='N')return getKnightMoves(f,c,co,pos); if(t==='B')return getBishopMoves(f,c,co,pos); if(t==='R')return getRookMoves(f,c,co,pos); if(t==='Q')return getQueenMoves(f,c,co,pos); if(t==='K')return getKingMoves(f,c,co,pos,p); return[]; }
    function filterLegalMoves(m,o,p) { const l=[]; const c=getColor(o.pieza); for(const mv of m) { const pi=p[mv.fila][mv.col]; p[mv.fila][mv.col]=o.pieza; p[o.fila][o.col]=''; if(!isInCheck(c,p)) l.push(mv); p[o.fila][o.col]=o.pieza; p[mv.fila][mv.col]=pi; } return l; }
function getPawnMoves(f, c, co, p) { 
        const m = []; 
        const d = (co === 'w') ? -1 : 1; 
        
        // 1. Movimiento frontal simple
        if (isWithinBoard(f + d, c) && isEmpty(p, f + d, c)) { 
            m.push({ fila: f + d, col: c }); 
            // 2. Movimiento doble inicial
            if (((co === 'w' && f === 6) || (co === 'b' && f === 1)) && isEmpty(p, f + d * 2, c)) {
                m.push({ fila: f + d * 2, col: c }); 
            }
        } 

        // 3. Capturas Diagonales Normales
        if (isWithinBoard(f + d, c - 1) && !isEmpty(p, f + d, c - 1) && isEnemy(p, co, f + d, c - 1) && getTipo(p[f + d][c - 1]) !== 'K') {
            m.push({ fila: f + d, col: c - 1 }); 
        }
        if (isWithinBoard(f + d, c + 1) && !isEmpty(p, f + d, c + 1) && isEnemy(p, co, f + d, c + 1) && getTipo(p[f + d][c + 1]) !== 'K') {
            m.push({ fila: f + d, col: c + 1 }); 
        }

        // 4. CAPTURA AL PASO (NUEVO)
        if (estadoJuego.peonAlPaso) {
            // Detectar en qué tablero estamos operando comparando la matriz
            const nombreTableroActual = (p === estadoJuego.posPrincipal) ? 'principal' : 'fantasma';
            
            if (estadoJuego.peonAlPaso.tablero === nombreTableroActual) {
                const ep = estadoJuego.peonAlPaso;
                // Si la casilla EP está en mi diagonal de ataque (fila f+d)
                if (ep.fila === f + d) {
                    // Y está a izquierda o derecha
                    if (Math.abs(ep.col - c) === 1) {
                        m.push({ fila: ep.fila, col: ep.col });
                    }
                }
            }
        }

        return m; 
    }
    function getKnightMoves(f,c,co,p) { const m=[]; const o=[{f:-2,c:-1},{f:-2,c:1},{f:-1,c:-2},{f:-1,c:2},{f:1,c:-2},{f:1,c:2},{f:2,c:-1},{f:2,c:1}]; o.forEach(off=>{ if(isWithinBoard(f+off.f,c+off.c)){ if(isEmpty(p,f+off.f,c+off.c)||(isEnemy(p,co,f+off.f,c+off.c)&&getTipo(p[f+off.f][c+off.c])!=='K')) m.push({fila:f+off.f,col:c+off.c}); }}); return m; }
    function getBishopMoves(f,c,co,p) { return getSlidingMoves(f,c,co,p,[{f:-1,c:-1},{f:-1,c:1},{f:1,c:-1},{f:1,c:1}]); }
    function getRookMoves(f,c,co,p) { return getSlidingMoves(f,c,co,p,[{f:-1,c:0},{f:1,c:0},{f:0,c:-1},{f:0,c:1}]); }
    function getQueenMoves(f,c,co,p) { return getSlidingMoves(f,c,co,p,[{f:-1,c:-1},{f:-1,c:1},{f:1,c:-1},{f:1,c:1},{f:-1,c:0},{f:1,c:0},{f:0,c:-1},{f:0,c:1}]); }
    function getSlidingMoves(f,c,co,p,ds) { const m=[]; for(const d of ds) { for(let i=1;i<8;i++) { const nf=f+i*d.f,nc=c+i*d.c; if(!isWithinBoard(nf,nc)) break; if(isEmpty(p,nf,nc)) m.push({fila:nf,col:nc}); else { if(isEnemy(p,co,nf,nc)&&getTipo(p[nf][nc])!=='K') m.push({fila:nf,col:nc}); break; } } } return m; }
    function getKingMoves(f,c,co,p,id) { const m=[]; const o=[{f:-1,c:-1},{f:-1,c:0},{f:-1,c:1},{f:0,c:-1},{f:0,c:1},{f:1,c:-1},{f:1,c:0},{f:1,c:1}]; o.forEach(off=>{ if(isWithinBoard(f+off.f,c+off.c)){ if(isEmpty(p,f+off.f,c+off.c)||(isEnemy(p,co,f+off.f,c+off.c)&&getTipo(p[f+off.f][c+off.c])!=='K')) m.push({fila:f+off.f,col:c+off.c}); }}); 
    if(id && estadoJuego.historialMovimientos && !estadoJuego.historialMovimientos[id]&&!isInCheck(co,p)){ const op=(co==='w'?'b':'w'); if(id==='wK_P'||id==='bK_P'){ if(!estadoJuego.historialMovimientos[co+'R_1']&&isEmpty(p,f,c+1)&&isEmpty(p,f,c+2)&&!isSquareAttacked(f,c+1,op,p)&&!isSquareAttacked(f,c+2,op,p)) m.push({fila:f,col:c+2}); if(!estadoJuego.historialMovimientos[co+'R_0']&&isEmpty(p,f,c-1)&&isEmpty(p,f,c-2)&&isEmpty(p,f,c-3)&&!isSquareAttacked(f,c-1,op,p)&&!isSquareAttacked(f,c-2,op,p)) m.push({fila:f,col:c-2}); } } return m; }
    
    function getColor(p) { return p ? (p.startsWith('w')?'w':'b') : null; }
    function getTipo(p) { return p ? p.substring(1,2) : null; }
    function isEmpty(p, f, c) { return (isWithinBoard(f,c) && p[f][c] === ''); }
    function isWithinBoard(f, c) { return (f>=0 && f<8 && c>=0 && c<8); }
    function isEnemy(p, co, f, c) { const pi = p[f][c]; return (pi && getColor(pi) !== co); }
    function findKing(color, pos) { for(let f=0;f<8;f++) for(let c=0;c<8;c++) if(pos[f][c]&&getColor(pos[f][c])===color&&getTipo(pos[f][c])==='K') return {fila:f,col:c}; return null; }
    function isInCheck(color, pos) { const k=findKing(color, pos); return k ? isSquareAttacked(k.fila, k.col, (color==='w'?'b':'w'), pos) : null; }
    function isCheckmate(color, pos) { if(!isInCheck(color, pos)) return false; for(let f=0;f<8;f++) for(let c=0;c<8;c++) { if(pos[f][c]&&getColor(pos[f][c])===color) { const m=getValidMoves(f,c,pos[f][c],pos); if(filterLegalMoves(m,{fila:f,col:c,pieza:pos[f][c]},pos).length>0) return false; } } return true; }
    function isSquareAttacked(f, c, ca, p) {
        const d=(ca==='w')?-1:1; const pn=ca+'P'; if(isWithinBoard(f-d,c-1)&&p[f-d][c-1].startsWith(pn)) return {fila:f-d,col:c-1}; if(isWithinBoard(f-d,c+1)&&p[f-d][c+1].startsWith(pn)) return {fila:f-d,col:c+1};
        const kn=ca+'N'; const ok=[{f:-2,c:-1},{f:-2,c:1},{f:-1,c:-2},{f:-1,c:2},{f:1,c:-2},{f:1,c:2},{f:2,c:-1},{f:2,c:1}]; for(const o of ok) if(isWithinBoard(f+o.f,c+o.c)&&p[f+o.f][c+o.c].startsWith(kn)) return {fila:f+o.f,col:c+o.c};
        const b=ca+'B', q=ca+'Q'; const ob=[{f:-1,c:-1},{f:-1,c:1},{f:1,c:-1},{f:1,c:1}]; for(const d of ob) for(let i=1;i<8;i++){ const nf=f+i*d.f,nc=c+i*d.c; if(!isWithinBoard(nf,nc)) break; if(p[nf][nc]!==''){ if(p[nf][nc].startsWith(b)||p[nf][nc].startsWith(q)) return {fila:nf,col:nc}; break; } }
        const r=ca+'R'; const or=[{f:-1,c:0},{f:1,c:0},{f:0,c:-1},{f:0,c:1}]; for(const d of or) for(let i=1;i<8;i++){ const nf=f+i*d.f,nc=c+i*d.c; if(!isWithinBoard(nf,nc)) break; if(p[nf][nc]!==''){ if(p[nf][nc].startsWith(r)||p[nf][nc].startsWith(q)) return {fila:nf,col:nc}; break; } }
        const k=ca+'K'; const ok2=[{f:-1,c:-1},{f:-1,c:0},{f:-1,c:1},{f:0,c:-1},{f:0,c:1},{f:1,c:-1},{f:1,c:0},{f:1,c:1}]; for(const o of ok2) if(isWithinBoard(f+o.f,c+o.c)&&p[f+o.f][c+o.c].startsWith(k)) return {fila:f+o.f,col:c+o.c}; return null;
    }
    function mostrarToast(m) { toastNotificacion.innerText=m; toastNotificacion.classList.add('visible'); setTimeout(()=>{toastNotificacion.classList.remove('visible');},2000); }

    // --- LÓGICA BOTÓN ANUNCIO TIENDA (+5 MONEDAS) ---
    const btnAdTienda = document.getElementById('btn-ad-tienda');
    
    if(btnAdTienda) {
        btnAdTienda.addEventListener('click', () => {
            const textoOriginal = btnAdTienda.innerText;
            btnAdTienda.disabled = true;
            btnAdTienda.innerText = "📺 ...";
            btnAdTienda.style.backgroundColor = "#555";
            mostrarAlerta("Viendo anuncio publicitario...");
            setTimeout(() => {
                datosUsuario.monedas += 5; // Sumar 5 monedas
                guardarDatosUsuario();
                mostrarAlerta("¡Anuncio completado! \nRecibiste +5 Monedas.");
                AudioController.play('snd-victoria');
                btnAdTienda.disabled = false;
                btnAdTienda.innerText = textoOriginal;
                btnAdTienda.style.backgroundColor = "#8e44ad";
                renderizarTienda();
            }, 3000);
        });
    }

    window.finalizarCoronacion = function(tipo) {
        if (!coronacionPendiente) return;
        const { destino, tablero, color } = coronacionPendiente;
        const nuevaPieza = color + tipo;
        const pos = (tablero === 'principal') ? estadoJuego.posPrincipal : estadoJuego.posFantasma;
        pos[destino.fila][destino.col] = nuevaPieza;
        document.getElementById('modal-coronacion').style.display = 'none';
        coronacionPendiente = null;
        AudioController.play('snd-inicio'); 
        dibujarTableros();
        gestionarFinDeTurno();
    };

    // --- TIENDA ---
    const btnTienda = document.getElementById('btn-tienda');
    const pantallaTienda = document.getElementById('pantalla-tienda');
    const btnCerrarTienda = document.getElementById('btn-cerrar-tienda');
    const gridTienda = document.getElementById('grid-tienda');
    const txtMonedas = document.getElementById('texto-monedas');
    let tabActualTienda = 'piezas';

    if(btnTienda) btnTienda.addEventListener('click', () => {
        pantallaTienda.style.display = 'flex';
        renderizarTienda();
    });
    if(btnCerrarTienda) btnCerrarTienda.addEventListener('click', () => pantallaTienda.style.display = 'none');

    window.cambiarTabTienda = function(tab) {
        tabActualTienda = tab;
        document.getElementById('tab-piezas').classList.toggle('tab-activa', tab === 'piezas');
        document.getElementById('tab-tableros').classList.toggle('tab-activa', tab === 'tableros');
        renderizarTienda();
    };

    function renderizarTienda() {
        gridTienda.innerHTML = '';
        txtMonedas.innerText = datosUsuario.monedas;
        
        const catalogo = (tabActualTienda === 'piezas') ? CATALOGO_PIEZAS : CATALOGO_TABLEROS;
        const inventario = (tabActualTienda === 'piezas') ? datosUsuario.inventarioPiezas : datosUsuario.inventarioTableros;
        const equipado = (tabActualTienda === 'piezas') ? datosUsuario.skinEquipadaPiezas : datosUsuario.skinEquipadaTablero;

        catalogo.forEach(item => {
            const div = document.createElement('div');
            div.className = 'item-tienda';
            if (item.id === equipado) div.classList.add('item-equipado');

            let rutaImg = '';
            if (tabActualTienda === 'piezas') {
                if(item.id === 'default') rutaImg = PIEZAS_WIKI['wQ']; 
                else rutaImg = `skins/piezas/${item.id}/wQ.png`;
            } else {
                if(item.id === 'default') {
                    rutaImg = 'https://upload.wikimedia.org/wikipedia/commons/d/d7/Chessboard480.svg'; 
                }
                else rutaImg = `skins/tableros/${item.id}/tablero.png`;
            }

            const tieneItem = inventario.includes(item.id);
            let botonHTML = '';

            if (item.id === equipado) {
                botonHTML = `<button disabled>Equipado</button>`;
            } else if (tieneItem) {
                botonHTML = `<button class="btn-equipar" onclick="window.equiparItem('${item.id}')">Equipar</button>`;
            } else {
                botonHTML = `<button class="btn-comprar" onclick="window.comprarItem('${item.id}', ${item.precio})">Comprar $${item.precio}</button>`;
            }

            div.innerHTML = `
                <img src="${rutaImg}" onerror="this.src='https://upload.wikimedia.org/wikipedia/commons/a/a3/Image-not-found.png'"> 
                <h4>${item.nombre}</h4>
                ${botonHTML}
            `;
            gridTienda.appendChild(div);
        });
    }

    window.comprarItem = function(id, precio) {
        if (datosUsuario.monedas >= precio) {
            datosUsuario.monedas -= precio;
            
            if (tabActualTienda === 'piezas') {
                datosUsuario.inventarioPiezas.push(id);
                datosUsuario.skinEquipadaPiezas = id; 
            } else {
                datosUsuario.inventarioTableros.push(id);
                datosUsuario.skinEquipadaTablero = id; 
            }

            guardarDatosUsuario(); 
            renderizarTienda();
            dibujarTableros(); 
            AudioController.play('snd-boton');
        } else {
            mostrarAlerta("No tienes suficientes monedas.");
        }
    };

    window.equiparItem = function(id) {
        if (tabActualTienda === 'piezas') {
            datosUsuario.skinEquipadaPiezas = id;
        } else {
            datosUsuario.skinEquipadaTablero = id;
        }
        guardarDatosUsuario(); 
        renderizarTienda();
        dibujarTableros();
        AudioController.play('snd-boton');
    };

    // --- INICIALIZACIÓN DE DATOS AL ABRIR LA APP ---
    if(datosUsuario.nombre) {
        inputNombreUsuario.value = datosUsuario.nombre; 
        miNombreUsuario = datosUsuario.nombre;
    }
    actualizarInterfazMonedas();
	
	// --- NUEVA FUNCIÓN PARA GESTIONAR EL TUTORIAL ---
    function verificarYMostrarReglas() {
        // Solo mostramos el modal si NO se ha visto antes
        if (!datosUsuario.tutorialVisto) {
            document.getElementById('modal-reglas').style.display = 'flex';
            
            // Marcamos como visto y guardamos
            datosUsuario.tutorialVisto = true;
            guardarDatosUsuario();
        }
    }
});