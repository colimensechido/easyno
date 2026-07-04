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
  Lock,
  Mail,
  PackageOpen,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
  UserCheck
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const LAST_UPDATED = "4 de julio de 2026";

const SECTIONS = [
  {
    icon: Scale,
    title: "1. Aceptacion de estos terminos",
    body: [
      "Al crear una cuenta, iniciar sesion o usar EasyNo de cualquier forma, declaras que leiste, entendiste y aceptas integramente estos Terminos y Condiciones, incluyendo el aviso de juego responsable y la politica de privacidad resumida mas abajo.",
      "Si no estas de acuerdo con alguna parte de este documento, no debes registrarte ni continuar usando la plataforma. El uso continuado despues de una actualizacion de estos terminos constituye tu aceptacion de los cambios."
    ]
  },
  {
    icon: Gamepad2,
    title: "2. Que es EasyNo: entretenimiento 100% virtual",
    body: [
      "EasyNo es una plataforma de entretenimiento social con juegos de mesa virtuales (BolowPoly, inspirado en el genero clasico de compraventa de propiedades) y minijuegos de arcade simulados (Blackjack contra la banca u otros jugadores con fichas virtuales). Es software recreativo, no una casa de apuestas, casino en linea con dinero real, operador de juegos de azar regulado, ni una institucion financiera.",
      "Ningun resultado dentro de la plataforma (ganar o perder una mano, subir de nivel, ganar una partida de BolowPoly, etc.) tiene efecto, valor o consecuencia fuera del entorno virtual de EasyNo.",
      "No se requiere ni se acepta dinero real para jugar. El registro y el uso basico de todos los minijuegos es gratuito."
    ]
  },
  {
    icon: HandCoins,
    title: "3. Monedas virtuales: fichas, saldo de sala y EyCon",
    body: [
      "Toda moneda dentro de la plataforma (fichas de Blackjack, saldo de sala/MAIN, EyCon) es una moneda virtual sin valor monetario real, sin respaldo en dinero, bienes o valores, y sin cotizacion en ningun mercado.",
      "Estas monedas NO pueden canjearse, transferirse, venderse, intercambiarse por dinero real o especies, ni retirarse de la plataforma bajo ninguna circunstancia. No representan un deposito, una inversion, un instrumento financiero ni una promesa de pago.",
      "El saldo virtual puede reiniciarse, ajustarse o balancearse por el equipo de EasyNo en cualquier momento por motivos de mantenimiento, correccion de errores o prevencion de abuso economico, sin que esto genere derecho a compensacion en dinero real."
    ]
  },
  {
    icon: CreditCard,
    title: "4. Compras con dinero real: solo licencias de contenido cosmetico",
    body: [
      "La unica forma de pagar dinero real dentro de EasyNo es para adquirir EyCon a traves de Mercado Pago, con el fin exclusivo de desbloquear cosmeticos (piezas, tableros, dados, efectos visuales y elementos decorativos).",
      "Estas compras se entienden como una contribucion voluntaria al mantenimiento del servicio a cambio de una licencia digital de personalizacion, no como una apuesta, ficha de casino ni compra de suerte o ventaja de juego.",
      "Declaras expresamente que NO estas pagando por posibilidad de ganar dinero, premios en efectivo, bienes de valor real ni resultados de azar: pagas unicamente por contenido esteticamente distinto dentro del software.",
      "Solo pueden realizar compras con dinero real usuarios con al menos 18 anos (o la mayoria de edad legal en su pais, la que sea mayor), conforme a la seccion de elegibilidad de estos terminos.",
      "NO EXISTEN DEVOLUCIONES NI REEMBOLSOS: toda compra de EyCon o de cualquier cosmetico es definitiva, final e irrevocable en el momento en que el pago es aprobado. Esto aplica sin importar el motivo (arrepentimiento, error de compra, falta de uso, insatisfaccion con el cosmetico, cierre voluntario de tu cuenta, o sancion por incumplir estos terminos), salvo unicamente en los casos en que una ley imperativa de tu jurisdiccion obligue expresamente a EasyNo a realizar un reembolso.",
      "Los cargos indebidos, contracargos (chargebacks) fraudulentos o disputas de pago abusivas ante Mercado Pago o tu entidad bancaria, en lugar de solicitar soporte directamente a EasyNo, se consideran una violacion grave de estos terminos y derivan en suspension permanente de la cuenta y perdida total del inventario y saldo asociado, sin derecho a compensacion.",
      "Los precios, promociones, paquetes (incluyendo el Pase VIP) y tasas de conversion de EyCon pueden cambiar en cualquier momento sin previo aviso. Eres responsable de cualquier impuesto aplicable a tu compra segun tu pais de residencia."
    ]
  },
  {
    icon: PackageOpen,
    title: "5. Licencia de uso de cosmeticos (no eres propietario)",
    body: [
      "Al comprar o desbloquear un cosmetico (pieza, tablero, dado, efecto, etc.) recibes unicamente una licencia limitada, personal, no exclusiva, revocable e intransferible para usarlo dentro de tu cuenta en EasyNo.",
      "No adquieres propiedad, derechos de autor ni titularidad sobre ningun cosmetico, modelo 3D, textura, sonido o efecto. No pueden revenderse, licenciarse, extraerse del juego ni comercializarse fuera de la plataforma bajo ninguna forma (incluyendo NFTs o mercados de terceros).",
      "Si tu cuenta es suspendida, eliminada o si un cosmetico es retirado del catalogo por motivos legales, de licenciamiento o de balance, EasyNo no esta obligado a compensar en dinero real el valor pagado por dicho cosmetico."
    ]
  },
  {
    icon: Code2,
    title: "6. Activos de codigo abierto y contenido de terceros",
    body: [
      "Algunos modelos 3D, iconos, texturas, tipografias, efectos de sonido y otros recursos usados como cosmeticos o elementos visuales dentro de EasyNo provienen de bibliotecas de codigo abierto, bancos de assets gratuitos o de licencia libre (por ejemplo, licencias tipo Creative Commons, CC0, MIT o equivalentes) creados por terceros artistas y desarrolladores.",
      "Estos recursos se utilizan de buena fe dentro de los terminos de sus licencias originales, unicamente con fines de decoracion y personalizacion visual, sin animo de apropiacion indebida ni de atribuirnos autoria sobre creaciones ajenas.",
      "Si eres el titular de derechos de autor de algun recurso utilizado en la plataforma y consideras que su uso no respeta la licencia correspondiente o no cuenta con la atribucion debida, contactanos (ver seccion de Contacto) indicando el recurso especifico: procederemos a revisar el caso y, si corresponde, a retirar o corregir la atribucion del contenido a la brevedad.",
      "EasyNo no garantiza ni certifica el origen exacto de cada asset de terceros incluido historicamente en el catalogo, pero mantiene un compromiso activo de retirar cualquier contenido reportado como usado indebidamente."
    ]
  },
  {
    icon: BadgeCheck,
    title: "7. Marcas, MONOPOLY y propiedad intelectual",
    body: [
      "BolowPoly es un juego de mesa virtual independiente, con mecanicas inspiradas libremente en el genero clasico de juegos de compraventa de propiedades tipo MONOPOLY. BolowPoly no esta afiliado, patrocinado, respaldado ni asociado de ninguna forma con Hasbro, Inc. ni con los titulares registrados de la marca MONOPOLY.",
      "Cualquier semejanza con nombres, mecanicas o conceptos de juegos de mesa comerciales existentes es de caracter generico y no pretende infringir marcas registradas ni derechos de autor de terceros.",
      "El nombre EasyNo, su logotipo, la marca BolowPoly, el nombre EyCon y el resto del contenido original (interfaz, codigo propio, textos, disenos) son propiedad de EasyNo y se licencian a los usuarios solo para su uso dentro del servicio, sin derecho a reproduccion, distribucion o explotacion comercial externa."
    ]
  },
  {
    icon: UserCheck,
    title: "8. Elegibilidad y edad minima",
    body: [
      "Para registrarte y jugar en EasyNo (BolowPoly, Blackjack simulado, minijuegos y salas sociales) debes tener al menos 13 anos de edad. Si eres menor de 18 anos, declaras que cuentas con el consentimiento de tu padre, madre o tutor legal para usar la plataforma.",
      "EasyNo es entretenimiento virtual tipo juego de mesa y arcade: no hay apuestas con dinero real dentro de las partidas. Por eso no exigimos mayoria de edad solo para jugar, a diferencia de un casino o casa de apuestas regulada.",
      "Las compras con dinero real (recarga de EyCon y desbloqueo de cosmeticos) estan reservadas exclusivamente a personas con al menos 18 anos, o la mayoria de edad legal en tu pais (la que sea mayor). Si eres menor, no debes realizar pagos ni usar metodos de pago de terceros.",
      "Al crear una cuenta declaras bajo tu responsabilidad que cumples estos requisitos de edad y que la informacion del registro es veraz. EasyNo puede solicitar verificacion razonable y suspender cuentas que incumplan estas reglas, especialmente en caso de compras realizadas por menores."
    ]
  },
  {
    icon: ShieldCheck,
    title: "9. Cuenta, seguridad y conducta prohibida",
    body: [
      "Eres el unico responsable de la confidencialidad de tu usuario y contrasena, y de toda actividad realizada desde tu cuenta.",
      "Queda prohibido: usar bots, macros o automatizaciones no autorizadas; explotar errores o vulnerabilidades (bugs) para obtener ventajas; crear multiples cuentas para manipular la economia virtual, misiones o el pase de progreso; comerciar cuentas o inventarios fuera de la plataforma; acosar, discriminar o usar lenguaje ofensivo hacia otros jugadores; y cualquier intento de vulnerar la seguridad del servicio.",
      "EasyNo puede monitorear el uso de la plataforma con fines de seguridad, prevencion de fraude y cumplimiento de estas reglas."
    ]
  },
  {
    icon: Ban,
    title: "10. Suspension y terminacion de cuenta",
    body: [
      "Nos reservamos el derecho de advertir, suspender temporalmente o eliminar permanentemente cualquier cuenta que incumpla estos terminos, sin necesidad de previo aviso en casos de fraude, abuso economico o riesgo para la plataforma o sus usuarios.",
      "La suspension o eliminacion de una cuenta por incumplimiento no genera derecho a reembolso de compras de EyCon ni de cosmeticos previamente adquiridos.",
      "Puedes solicitar la eliminacion voluntaria de tu cuenta en cualquier momento contactando al soporte; entiendes que esto implica la perdida irreversible de tu progreso, inventario y saldo virtual."
    ]
  },
  {
    icon: Lock,
    title: "11. Privacidad y datos personales",
    body: [
      "Recolectamos y almacenamos unicamente los datos necesarios para operar tu cuenta: nombre de usuario, contrasena cifrada (hash), estadisticas de partidas, inventario de cosmeticos, progreso de misiones/pase de batalla e historial de transacciones de EyCon.",
      "No vendemos ni compartimos tu informacion personal con terceros con fines comerciales. Los datos de pago (tarjeta, metodo de pago) al recargar EyCon son procesados directamente por Mercado Pago bajo sus propias politicas de seguridad; EasyNo no almacena datos completos de tarjetas de credito o debito.",
      "Puedes solicitar informacion sobre los datos que tenemos asociados a tu cuenta, asi como su eliminacion (sujeta a obligaciones legales de conservacion, si las hubiera), contactando al soporte."
    ]
  },
  {
    icon: AlertTriangle,
    title: "12. Limitacion de responsabilidad y ausencia de garantias",
    body: [
      "EasyNo se ofrece \"tal cual\" y \"segun disponibilidad\", sin garantias de ningun tipo, expresas o implicitas, incluyendo disponibilidad ininterrumpida, ausencia de errores o idoneidad para un proposito particular.",
      "En la maxima medida permitida por la ley, EasyNo, sus desarrolladores y colaboradores no seran responsables por danos indirectos, incidentales, especiales o consecuentes derivados del uso o la imposibilidad de uso de la plataforma, incluyendo perdida de progreso virtual, inventario o saldo.",
      "En ningun caso la responsabilidad total de EasyNo frente a un usuario por cualquier reclamo relacionado con el servicio excedera el monto total en dinero real pagado por ese usuario durante los ultimos 90 dias previos al reclamo.",
      "Nada en esta seccion pretende excluir o limitar responsabilidades que no puedan excluirse o limitarse conforme a la ley aplicable en tu jurisdiccion."
    ]
  },
  {
    icon: Gavel,
    title: "13. Indemnizacion",
    body: [
      "Aceptas indemnizar y mantener indemne a EasyNo y a su equipo frente a cualquier reclamo, dano, perdida o gasto (incluyendo honorarios legales razonables) que surja de tu incumplimiento de estos terminos, tu uso indebido de la plataforma o tu violacion de derechos de terceros."
    ]
  },
  {
    icon: RefreshCw,
    title: "14. Cambios a estos terminos y al servicio",
    body: [
      "Podemos actualizar estos Terminos y Condiciones, asi como agregar, modificar, balancear o retirar funciones, cosmeticos, minijuegos, precios o mecanicas de EasyNo en cualquier momento, a nuestra discrecion, con el objetivo de mejorar la plataforma o cumplir con requisitos legales.",
      "Los cambios relevantes se reflejaran en la fecha de \"ultima actualizacion\" de este documento. El uso continuado del servicio despues de una actualizacion implica la aceptacion de los nuevos terminos."
    ]
  },
  {
    icon: Mail,
    title: "15. Contacto y soporte",
    body: [
      "Para dudas sobre estos terminos, solicitudes de privacidad, reportes de contenido de terceros mal atribuido, o cualquier problema con tu cuenta o una compra de EyCon, puedes contactar al equipo de soporte de EasyNo desde la propia plataforma.",
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
            <Sparkles size={14} /> Antes de continuar
          </span>
          <h2>Terminos y condiciones</h2>
          <p>
            Documento largo a proposito: cubre que EasyNo es un juego virtual sin dinero real en juego, que solo se
            paga por cosmeticos, y que algunos recursos visuales son de codigo abierto. Lee hasta el final para poder aceptar.
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
                    <p key={paragraph.slice(0, 24)}>{paragraph}</p>
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
              <p>Llegaste al final del documento. Ya puedes aceptar los terminos y continuar con tu registro.</p>
            </div>
          </div>
        </div>

        {!reachedEnd && (
          <div className="terms-scroll-hint">
            <ChevronDown size={14} className="animate-bounce" />
            Desplazate para leer todo el contenido (15 secciones)
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
            He leido, acepto los terminos
          </button>
        </footer>
      </div>
    </div>
  );
}
