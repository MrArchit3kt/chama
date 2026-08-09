/**
 * Guirlande de Noël (sapin + boules + guirlande lumineuse) qui se répète
 * à l'infini sur toute la largeur du bandeau, dessinée en SVG (pattern
 * tuilé, donc jamais coupée ni étirée quelle que soit la largeur d'écran).
 */
export function ChristmasGarland() {
  return (
    <div
      className="pointer-events-none absolute inset-x-2 -top-4 h-9 overflow-hidden md:-top-5 md:h-10"
      aria-hidden="true"
    >
      <svg width="100%" height="100%" preserveAspectRatio="none">
        <defs>
          <pattern
            id="chama-christmas-garland"
            width="72"
            height="36"
            patternUnits="userSpaceOnUse"
          >
            {/* fil qui pend en arc entre deux points d'accroche */}
            <path
              d="M0,6 Q36,32 72,6"
              fill="none"
              stroke="#c99a3a"
              strokeWidth="1.4"
              opacity="0.75"
            />

            {/* brin de sapin */}
            <g transform="translate(9,9)">
              <path d="M0,0 L-5,11 L0,8 L5,11 Z" fill="#1f7a45" />
              <path d="M0,4 L-4,13 L0,10 L4,13 Z" fill="#26904f" />
            </g>

            {/* boule rouge */}
            <circle cx="36" cy="27" r="4.2" fill="#e2493a" />
            <circle cx="34.6" cy="25.6" r="1.2" fill="#ffffff" opacity="0.5" />

            {/* petite lumière chaude, avec halo */}
            <circle cx="61" cy="17" r="5.5" fill="#ffd75e" opacity="0.28" />
            <circle cx="61" cy="17" r="2.2" fill="#ffe58a" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#chama-christmas-garland)" />
      </svg>
    </div>
  );
}
