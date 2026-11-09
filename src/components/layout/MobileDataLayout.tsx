import { useEffect } from "react";

/** Adds presentation-only labels to existing tables; desktop styles are untouched. */
export function MobileDataLayout() {
  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    let frame = 0;
    const annotate = () => {
      main.querySelectorAll<HTMLTableElement>("table").forEach((table) => {
        if (table.closest('[aria-hidden="true"]')) return;
        const headers = Array.from(table.tHead?.rows[0]?.cells ?? []);
        if (!headers.length) return;
        const labels = headers.map((cell) => cell.textContent?.trim() ?? "");
        const monthly = labels.some((label) => /^JAN$/i.test(label)) && labels.some((label) => /^DEZ$/i.test(label));
        table.dataset.mobileTable = monthly ? "months" : "records";
        for (const section of [...Array.from(table.tBodies), ...(table.tFoot ? [table.tFoot] : [])]) {
          Array.from(section.rows).forEach((row) => {
            const spanning = Array.from(row.cells).some((cell) => cell.colSpan > 1);
            row.dataset.mobileRow = spanning ? "spanning" : "data";
            let column = 0;
            Array.from(row.cells).forEach((cell) => {
              const label = labels[column] ?? "";
              cell.dataset.mobileLabel = label;
              cell.dataset.mobilePrimary = /^(cliente|produto|descrição|arquivo|regional|indicador|ano)$/i.test(label) ? "true" : "false";
              cell.dataset.mobileEmpty = !cell.textContent?.trim() && !cell.querySelector("button,input,select,textarea,svg,table") ? "true" : "false";
              column += cell.colSpan;
            });
          });
        }
      });
    };
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(annotate);
    });
    annotate();
    observer.observe(main, { childList: true, subtree: true });
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, []);
  return null;
}