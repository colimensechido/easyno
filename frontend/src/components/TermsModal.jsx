import {
  AlertTriangle,
  Ban,
  BadgeCheck,
  Check,
  ChevronDown,
  Code2,
  CreditCard,
  Gamepad2,
  Gavel,
  HandCoins,
  Landmark,
  Lock,
  Mail,
  PackageOpen,
  RefreshCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCheck
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const LAST_UPDATED = "27 de julio de 2026";

const SECTIONS = [
  {
    icon: Scale,
    title: "1. Aceptacion de estos terminos",
    body: [
      "Al crear una cuenta, iniciar sesion o usar EasyNo de cualquier forma, declaras que leiste, entendiste y aceptas INTEGRAMENTE estos Terminos y Condiciones, el aviso de que EasyNo es un VIDEOJUEGO / software de entretenimiento, el aviso de inspiracion de BolowPoly, y la politica de privacidad resumida mas abajo.",
      "Si no estas de acuerdo con alguna parte de este documento, NO debes registrarte ni continuar usando la plataforma. El uso continuado despues de una actualizacion de estos terminos constituye tu aceptacion de los cambios.",
      "Al marcar la casilla de aceptacion en el registro confirmas expresamente tu consentimiento informado. Sin esa aceptacion no es posible crear una cuenta."
    ]
  },
  {
    icon: Gamepad2,
    title: "2. EasyNo es un VIDEOJUEGO (no un casino real ni un negocio financiero)",
    body: [
      "EasyNo es una plataforma de VIDEOJUEGOS y entretenimiento digital: software recreativo, salas sociales y minijuegos con fichas / monedas VIRTUALES. No es un casino fisico, no es una casa de apuestas con dinero real, no es un operador de juegos de azar regulado, no es un banco, no es una billetera, no es una plataforma de inversion y no es un intermediario de pagos entre jugadores.",
      "Todo lo que ocurre dentro de EasyNo (ganar, perder, subir de nivel, completar misiones, comprar cosmeticos, jugar Blackjack simulado, jugar BolowPoly, etc.) ocurre UNICAMENTE dentro del entorno virtual del videojuego y NO tiene efecto juridico, valor economico real ni consecuencia patrimonial fuera de la plataforma, salvo la compra voluntaria de licencias cosmeticas descrita mas abajo.",
      "Las palabras \"casino\", \"apuesta\", \"ficha\", \"mesa\", \"banca\", \"premio\" u otras expresiones de estilo usadas en la interfaz son meras metaforas de VIDEOJUEGO y NO implican juego de azar con dinero real ni promesa de ganancias reales.",
      "No se requiere ni se acepta dinero real para JUGAR. El registro y el uso basico de los minijuegos es gratuito. Cualquier pago voluntario es exclusivamente por contenido cosmetico / personalizacion visual."
    ]
  },
  {
    icon: Landmark,
    title: "3. BolowPoly: obra independiente inspirada (no afiliada a MONOPOLY / Hasbro)",
    body: [
      "BolowPoly es un VIDEOJUEGO de mesa virtual ORIGINAL e independiente creado por EasyNo. Sus mecanicas, tablero, nombres, casillas, tokens, economia virtual y presentacion visual estan inspirados libremente en el genero clasico de juegos de compraventa de propiedades (incluyendo, a titulo meramente descriptivo, obras historicamente conocidas bajo la marca MONOPOLY).",
      "DECLARACION EXPRESA: BolowPoly NO esta afiliado, asociado, patrocinado, autorizado, respaldado ni vinculado de ninguna forma con Hasbro, Inc., Hasbro SA, Parker Brothers, ni con los titulares actuales o historicos de la marca registrada MONOPOLY ni de cualquier otro producto, tablero, marca o propiedad intelectual de terceros similares.",
      "Cualquier semejanza de genero, mecanicas genericas (dados, casillas, propiedades, renta, carcel, etc.) o referencias culturales es incidental y propia del genero de juegos de mesa. NO se pretende copiar materiales protegidos especificos (arte oficial, textos literales de reglas oficiales, logotipos, tipografias o assets propietarios de terceros), ni confundir al publico sobre el origen comercial del producto.",
      "Si usas BolowPoly, reconoces que es un videojuego propio de EasyNo, que lo juegas bajo licencia de uso limitada dentro de la plataforma, y que ninguna marca de terceros te otorga derechos, garantia ni relacion contractual con esos terceros por el solo hecho de jugar BolowPoly."
    ]
  },
  {
    icon: HandCoins,
    title: "4. Monedas virtuales: fichas, saldo de sala y EyCon",
    body: [
      "Toda moneda dentro de la plataforma (fichas de Blackjack, saldo de sala/MAIN, EyCon y cualquier otra unidad virtual) es una moneda VIRTUAL sin valor monetario real, sin respaldo en dinero, bienes o valores, y sin cotizacion en ningun mercado.",
      "Estas monedas NO pueden canjearse, transferirse, venderse, intercambiarse por dinero real o especies, ni retirarse de la plataforma bajo ninguna circunstancia. No representan un deposito, una inversion, un instrumento financiero ni una promesa de pago.",
      "El saldo virtual puede reiniciarse, ajustarse, balancearse o eliminarse por el equipo de EasyNo en cualquier momento por mantenimiento, correccion de errores, antiabuso o decision de diseno del videojuego, sin que esto genere derecho a compensacion en dinero real."
    ]
  },
  {
    icon: CreditCard,
    title: "5. Compras con dinero real: solo licencias de contenido cosmetico",
    body: [
      "La unica forma de pagar dinero real dentro de EasyNo es para adquirir EyCon a traves de Mercado Pago (u otro procesador habilitado), con el fin exclusivo de desbloquear cosmeticos (piezas, tableros, dados, efectos visuales y elementos decorativos).",
      "Estas compras se entienden como una contribucion voluntaria al mantenimiento del servicio a cambio de una licencia digital de personalizacion dentro del VIDEOJUEGO, NO como una apuesta, ficha de casino, compra de suerte, ventaja competitiva ni compra de resultados.",
      "Declaras expresamente que NO estas pagando por posibilidad de ganar dinero, premios en efectivo, bienes de valor real ni resultados de azar: pagas unicamente por contenido estetico / cosmetico dentro del software.",
      "Solo pueden realizar compras con dinero real usuarios con al menos 18 anos (o la mayoria de edad legal en su pais, la que sea mayor).",
      "NO EXISTEN DEVOLUCIONES NI REEMBOLSOS: toda compra de EyCon o de cualquier cosmetico es definitiva, final e irrevocable en el momento en que el pago es aprobado. Esto aplica sin importar el motivo (arrepentimiento, error de compra, falta de uso, insatisfaccion, cierre voluntario de cuenta o sancion por incumplir estos terminos), salvo unicamente cuando una ley imperativa de tu jurisdiccion obligue expresamente a EasyNo a reembolsar.",
      "Los cargos indebidos, contracargos (chargebacks) fraudulentos o disputas de pago abusivas ante el procesador o tu banco, en lugar de solicitar soporte a EasyNo, se consideran violacion grave y pueden derivar en suspension permanente de la cuenta y perdida del inventario / saldo virtual, sin compensacion.",
      "Precios, promociones, paquetes (incluyendo Pase VIP) y tasas de conversion de EyCon pueden cambiar en cualquier momento. Eres responsable de impuestos aplicables segun tu pais."
    ]
  },
  {
    icon: PackageOpen,
    title: "6. Licencia de uso de cosmeticos (no eres propietario)",
    body: [
      "Al comprar o desbloquear un cosmetico recibes unicamente una licencia limitada, personal, no exclusiva, revocable e intransferible para usarlo dentro de tu cuenta en EasyNo.",
      "No adquieres propiedad, derechos de autor ni titularidad sobre ningun cosmetico, modelo 3D, textura, sonido o efecto. No pueden revenderse, licenciarse, extraerse del juego ni comercializarse fuera de la plataforma (incluyendo NFTs o mercados de terceros).",
      "Si tu cuenta es suspendida/eliminada o si un cosmetico se retira del catalogo por motivos legales, de licenciamiento o de balance, EasyNo no esta obligado a compensar en dinero real el valor pagado."
    ]
  },
  {
    icon: Code2,
    title: "7. Activos de codigo abierto y contenido de terceros",
    body: [
      "Algunos modelos 3D, iconos, texturas, tipografias, efectos de sonido y otros recursos usados como cosmeticos o elementos visuales pueden provenir de bibliotecas de codigo abierto, bancos de assets gratuitos o de licencia libre (por ejemplo Creative Commons, CC0, MIT o equivalentes) creados por terceros.",
      "Se utilizan de buena fe conforme a sus licencias, solo con fines de decoracion y personalizacion visual, sin animo de apropiacion indebida ni de atribuirnos autoria ajena.",
      "Si eres titular de derechos sobre un recurso y consideras un uso indebido o falta de atribucion, contactanos indicando el recurso: revisaremos el caso y, si corresponde, retiraremos o corregiremos el contenido a la brevedad.",
      "EasyNo no garantiza el origen exacto de cada asset historico del catalogo, pero mantiene un compromiso activo de retirar contenido reportado como usado indebidamente."
    ]
  },
  {
    icon: BadgeCheck,
    title: "8. Marcas y propiedad intelectual de EasyNo",
    body: [
      "El nombre EasyNo, su logotipo, la marca BolowPoly, EyCon y el resto del contenido original (interfaz, codigo propio, textos, disenos, assets propios) son propiedad de EasyNo / sus titulares y se licencian a los usuarios solo para uso dentro del servicio, sin derecho a reproduccion, distribucion o explotacion comercial externa.",
      "Queda prohibido copiar, scrapear, redistribuir, ingenieria inversa abusiva, clonar el servicio o usar marcas/nombres de EasyNo de forma que sugiera afiliacion no autorizada."
    ]
  },
  {
    icon: UserCheck,
    title: "9. Elegibilidad y edad minima",
    body: [
      "Para registrarte y jugar en EasyNo debes tener al menos 13 anos. Si eres menor de 18 anos, declaras que cuentas con el consentimiento de tu padre, madre o tutor legal.",
      "EasyNo es entretenimiento virtual tipo VIDEOJUEGO: no hay apuestas con dinero real dentro de las partidas. Por eso no exigimos mayoria de edad solo para jugar, a diferencia de un casino o casa de apuestas regulada.",
      "Las compras con dinero real estan reservadas a personas con al menos 18 anos (o mayoria de edad legal local, la que sea mayor). Si eres menor, no debes realizar pagos ni usar metodos de pago de terceros.",
      "Al crear una cuenta declaras bajo tu responsabilidad que cumples estos requisitos y que la informacion del registro es veraz. EasyNo puede verificar y suspender cuentas que incumplan estas reglas."
    ]
  },
  {
    icon: ShieldCheck,
    title: "10. Cuenta, seguridad y conducta prohibida",
    body: [
      "Eres el unico responsable de la confidencialidad de tu usuario y contrasena, y de toda actividad realizada desde tu cuenta.",
      "Queda prohibido: bots, macros o automatizaciones no autorizadas; explotar bugs; crear multiples cuentas para manipular economia virtual, misiones o pases; comerciar cuentas/inventarios fuera de la plataforma; acosar, discriminar o usar lenguaje ofensivo; y cualquier intento de vulnerar la seguridad del servicio.",
      "EasyNo puede monitorear el uso con fines de seguridad, prevencion de fraude y cumplimiento de estas reglas."
    ]
  },
  {
    icon: Ban,
    title: "11. Suspension y terminacion de cuenta",
    body: [
      "Nos reservamos el derecho de advertir, suspender temporalmente o eliminar permanentemente cualquier cuenta que incumpla estos terminos, sin previo aviso en casos de fraude, abuso economico o riesgo para la plataforma o sus usuarios.",
      "La suspension o eliminacion por incumplimiento NO genera derecho a reembolso de EyCon ni de cosmeticos.",
      "Puedes solicitar la eliminacion voluntaria de tu cuenta contactando soporte; entiendes que esto implica la perdida irreversible de progreso, inventario y saldo virtual."
    ]
  },
  {
    icon: Lock,
    title: "12. Privacidad y datos personales",
    body: [
      "Recolectamos y almacenamos unicamente los datos necesarios para operar tu cuenta: nombre de usuario, contrasena cifrada (hash), estadisticas de partidas, inventario de cosmeticos, progreso de misiones/pase e historial de transacciones de EyCon.",
      "No vendemos ni compartimos tu informacion personal con terceros con fines comerciales. Los datos de pago al recargar EyCon son procesados por el proveedor de pagos bajo sus politicas; EasyNo no almacena datos completos de tarjetas.",
      "Puedes solicitar informacion o eliminacion de datos asociados a tu cuenta (sujeto a obligaciones legales de conservacion) contactando al soporte."
    ]
  },
  {
    icon: ShieldAlert,
    title: "13. Limitacion de responsabilidad y ausencia de garantias (proteccion maxima)",
    body: [
      "EasyNo se ofrece \"TAL CUAL\" y \"SEGUN DISPONIBILIDAD\", sin garantias de ningun tipo, expresas o implicitas, incluyendo disponibilidad ininterrumpida, ausencia de errores, precision de resultados del videojuego o idoneidad para un proposito particular.",
      "En la maxima medida permitida por la ley, EasyNo, sus desarrolladores, operadores, colaboradores y proveedores no seran responsables por danos directos, indirectos, incidentales, especiales, punitivos o consecuentes derivados del uso o la imposibilidad de uso de la plataforma, incluyendo perdida de progreso virtual, inventario, saldo, tiempo, datos, oportunidades o expectativas de entretenimiento.",
      "En ningun caso la responsabilidad total de EasyNo frente a un usuario por cualquier reclamo relacionado con el servicio excedera el monto total en dinero real efectivamente pagado por ese usuario a EasyNo durante los ultimos 90 dias previos al reclamo (y si no hubo pagos, la responsabilidad maxima sera cero, en la medida permitida por la ley).",
      "Reconoces que el videojuego puede contener bugs, desconexiones, desbalances, reinicios de economia virtual o cambios de diseno, y que eso forma parte normal del software de entretenimiento online.",
      "Nada en esta seccion pretende excluir o limitar responsabilidades que no puedan excluirse o limitarse conforme a la ley imperativa aplicable en tu jurisdiccion."
    ]
  },
  {
    icon: AlertTriangle,
    title: "14. Sin garantias de terceros / sin confusion de marcas",
    body: [
      "Ningun tercero (incluyendo, sin limitacion, Hasbro, titulares de MONOPOLY, procesadores de pago, proveedores de assets o plataformas de hosting) garantiza, respalda ni asume responsabilidad por EasyNo o BolowPoly por el solo hecho de ser mencionados con fines descriptivos, de pago o de licencia de contenido.",
      "Tu relacion contractual por el uso del videojuego es unicamente con EasyNo conforme a estos terminos, no con marcas de juegos de mesa ajenos."
    ]
  },
  {
    icon: Gavel,
    title: "15. Indemnizacion",
    body: [
      "Aceptas indemnizar y mantener indemne a EasyNo y a su equipo frente a cualquier reclamo, dano, perdida o gasto (incluyendo honorarios legales razonables) que surja de: (a) tu incumplimiento de estos terminos; (b) tu uso indebido de la plataforma; (c) tu violacion de derechos de terceros; (d) cargos/contracargos abusivos; o (e) declaraciones falsas en el registro (incluida la edad)."
    ]
  },
  {
    icon: RefreshCw,
    title: "16. Cambios a estos terminos y al servicio",
    body: [
      "Podemos actualizar estos Terminos y Condiciones, y agregar, modificar, balancear o retirar funciones, cosmeticos, minijuegos, precios o mecanicas de EasyNo en cualquier momento, a nuestra discrecion, para mejorar el videojuego o cumplir requisitos legales.",
      "Los cambios relevantes se reflejaran en la fecha de \"ultima actualizacion\". El uso continuado del servicio despues de una actualizacion implica la aceptacion de los nuevos terminos."
    ]
  },
  {
    icon: Mail,
    title: "17. Contacto, ley aplicable y soporte",
    body: [
      "Para dudas sobre estos terminos, privacidad, reportes de contenido de terceros, o problemas con tu cuenta / compra de EyCon, contacta al equipo de soporte de EasyNo desde la propia plataforma.",
      "En la medida permitida por la ley, estos terminos se interpretan de forma favorable a la naturaleza de EasyNo como VIDEOJUEGO de entretenimiento y a la proteccion de sus operadores frente a reclamos especulativos o ajenos al uso ordinario del software.",
      `Ultima actualizacion de este documento: ${LAST_UPDATED}.`
    ]
  }
];

export default function TermsModal({ open, onAccept, onClose, initiallyAccepted = false }) {
  const bodyRef = useRef(null);
  const [reachedEnd, setReachedEnd] = useState(initiallyAccepted);

  useEffect(() => {
    if (!open) return undefined;
    setReachedEnd(initiallyAccepted);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, initiallyAccepted, onClose]);

  if (!open) return null;

  function handleScroll(event) {
    const el = event.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) {
      setReachedEnd(true);
    }
  }

  return (
    <div
      className="terms-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div className="terms-modal" role="dialog" aria-modal="true" aria-label="Terminos y condiciones">
        <header className="terms-modal-header">
          <span className="terms-modal-kicker">
            <Sparkles size={14} /> Lectura obligatoria para registrarte
          </span>
          <h2>Terminos y condiciones</h2>
          <p>
            EasyNo es un VIDEOJUEGO de entretenimiento. BolowPoly esta inspirado en el genero de MONOPOLY y no esta
            afiliado a Hasbro. Lee hasta el final para poder aceptar y crear tu cuenta.
          </p>
        </header>

        <div className="terms-modal-body" ref={bodyRef} onScroll={handleScroll}>
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <article className="terms-section" key={section.title}>
                <div className="terms-section-icon">
                  <Icon size={18} />
                </div>
                <div>
                  <h3>{section.title}</h3>
                  {section.body.map((paragraph) => (
                    <p key={paragraph.slice(0, 48)}>{paragraph}</p>
                  ))}
                </div>
              </article>
            );
          })}

          <div className="terms-section terms-section--end">
            <div className="terms-section-icon">
              <Check size={18} />
            </div>
            <div>
              <h3>Eso es todo</h3>
              <p>
                Llegaste al final. Al aceptar confirmas que EasyNo es un videojuego, que BolowPoly es una obra
                independiente inspirada (sin afiliacion a MONOPOLY/Hasbro), y que aceptas estos terminos para registrarte.
              </p>
            </div>
          </div>
        </div>

        {!reachedEnd && (
          <div className="terms-scroll-hint">
            <ChevronDown size={14} className="animate-bounce" />
            Desplazate para leer todo el contenido ({SECTIONS.length} secciones)
          </div>
        )}

        <footer className="terms-modal-footer">
          <button type="button" className="ghost-button" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="arcade-button"
            disabled={!reachedEnd}
            onClick={() => onAccept?.()}
          >
            <Check size={16} />
            He leido y acepto los terminos
          </button>
        </footer>
      </div>
    </div>
  );
}
