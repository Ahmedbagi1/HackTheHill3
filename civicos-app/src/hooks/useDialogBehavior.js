import { useEffect, useRef } from "react";

/*
 * Dialogs can stack (e.g. the voice drawer opened from inside the wizard).
 * Only the top-most dialog responds to Escape, and body scroll stays locked
 * until the last dialog closes.
 */
const dialogStack = [];
let savedOverflow = "";

/**
 * Shared behaviour for modal surfaces: Escape to close, background scroll
 * lock, and returning focus to the element that opened the dialog.
 */
export function useDialogBehavior(onClose) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const token = {};
    const opener = document.activeElement;

    if (dialogStack.length === 0) {
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    dialogStack.push(token);

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && dialogStack.at(-1) === token) {
        event.stopPropagation();
        onCloseRef.current();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      dialogStack.splice(dialogStack.indexOf(token), 1);
      if (dialogStack.length === 0) document.body.style.overflow = savedOverflow;
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
    };
  }, []);
}
