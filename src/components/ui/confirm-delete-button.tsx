"use client";

import { useRef, useState, type ButtonHTMLAttributes, type MouseEvent } from "react";
import clsx from "clsx";

type ConfirmDeleteButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Titre de la pop-up de confirmation, ex. "Supprimer ce tournoi ?" */
  confirmTitle: string;
  /** Détail affiché sous le titre — ce qui va disparaître avec l'action. */
  confirmDescription?: string;
  /** Texte du bouton de confirmation dans la pop-up (défaut "Supprimer"). */
  confirmLabel?: string;
};

/**
 * Bouton de suppression avec confirmation dans une pop-up — remplace un
 * `<button type="submit">Supprimer</button>` à l'identique (même `form`
 * parent, même `formAction`/`name`/`value` s'il y en a) : au clic, on
 * n'affiche que la pop-up ; le formulaire n'est réellement soumis qu'à la
 * confirmation, via `form.requestSubmit(ce bouton)` — ce qui respecte les
 * éventuels `formAction`/`name`/`value` posés sur le bouton (cas des
 * boutons "✕" qui redirigent un même formulaire vers une autre action).
 */
export function ConfirmDeleteButton({
  confirmTitle,
  confirmDescription,
  confirmLabel = "Supprimer",
  className,
  children,
  onClick,
  ...rest
}: ConfirmDeleteButtonProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    onClick?.(event);
    setOpen(true);
  }

  function handleConfirm() {
    setOpen(false);
    buttonRef.current?.form?.requestSubmit(buttonRef.current);
  }

  return (
    <>
      <button {...rest} ref={buttonRef} type="submit" className={className} onClick={handleClick}>
        {children}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="neon-card w-full max-w-sm p-6"
            role="alertdialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white">{confirmTitle}</h3>
            {confirmDescription ? (
              <p className="neon-text-muted mt-2 text-sm leading-6">{confirmDescription}</p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/[0.05]"
                onClick={() => setOpen(false)}
              >
                Annuler
              </button>
              <button
                type="button"
                className={clsx(
                  "rounded-lg border border-rose-400/30 bg-rose-400/10 px-4 py-2 text-sm font-semibold text-rose-300 transition hover:bg-rose-400/20",
                )}
                onClick={handleConfirm}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
