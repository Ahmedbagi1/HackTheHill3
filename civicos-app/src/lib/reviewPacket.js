/**
 * Builds a self-contained, printable HTML "review packet" of a completed
 * application, in the active language, and triggers a download. All user
 * input is HTML-escaped.
 */

import { tierLabel } from "../data/servicesData";
import { getFormatters } from "../i18n/format";
import { LOCALES, tr } from "../i18n/i18n";
import { formatAnswer } from "./formatting";
import { DISPLAY_ONLY_TYPES, visibleFields } from "./validation";

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const PACKET_STYLES = `
  body{font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#0f172a;max-width:760px;margin:40px auto;padding:0 24px}
  header{border-bottom:2px solid #4f46e5;padding-bottom:16px;margin-bottom:24px}
  h1{font-size:24px;margin:0 0 4px} h2{font-size:16px;margin:28px 0 8px;color:#334155}
  .meta{color:#64748b;font-size:13px}
  .ref{display:inline-block;margin-top:8px;padding:4px 10px;background:#eef2ff;color:#4338ca;border-radius:6px;font-family:ui-monospace,Consolas,monospace;font-weight:600}
  table{width:100%;border-collapse:collapse;font-size:14px}
  th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #e2e8f0;vertical-align:top}
  th{width:40%;color:#475569;font-weight:500}
  ul{padding-left:20px} .note{margin-top:32px;padding:12px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;color:#475569}
  @media print{body{margin:0}}
`;

export function buildReviewPacketHtml({ service, steps, formData, referenceId, submittedAt = new Date(), lang = "en" }) {
  const t = tr(lang);
  const sections = steps
    .filter((step) => step.fields.length)
    .map((step) => {
      const rows = visibleFields(step.fields, formData)
        .filter((field) => !DISPLAY_ONLY_TYPES.has(field.type) || field.type === "estimate")
        .map(
          (field) =>
            `<tr><th>${escapeHtml(field.reviewLabel ?? field.label)}</th><td>${escapeHtml(
              formatAnswer(field, formData[field.name], formData, lang),
            )}</td></tr>`,
        )
        .join("");
      return `<h2>${escapeHtml(step.title)}</h2><table>${rows}</table>`;
    })
    .join("");

  const requirements = service.requirements.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const stamp = getFormatters(lang).dateTime(submittedAt);

  return `<!doctype html>
<html lang="${LOCALES[lang]}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(service.title)} — ${escapeHtml(t("CivicOS review packet", "Récapitulatif CivicOS"))}</title><style>${PACKET_STYLES}</style></head>
<body>
<header>
  <div class="meta">${escapeHtml(tierLabel(service.tier, lang))} · ${escapeHtml(service.agency)}</div>
  <h1>${escapeHtml(service.title)}</h1>
  <div class="meta">${escapeHtml(referenceId ? t(`Submitted ${stamp}`, `Soumise le ${stamp}`) : t(`Draft prepared ${stamp}`, `Brouillon préparé le ${stamp}`))}</div>
  ${referenceId ? `<div class="ref">${escapeHtml(referenceId)}</div>` : ""}
</header>
${sections}
<h2>${escapeHtml(t("Documents to have ready", "Documents à préparer"))}</h2><ul>${requirements}</ul>
<div class="note">${escapeHtml(
    t(
      "Prepared with CivicOS. This packet is a summary for your records and is not an official government document.",
      "Préparé avec CivicOS. Ce récapitulatif est un résumé pour vos dossiers; il ne s'agit pas d'un document officiel du gouvernement.",
    ),
  )}
${escapeHtml(t("Official information:", "Renseignements officiels :"))} ${escapeHtml(service.officialUrl)}</div>
</body></html>`;
}

export function downloadReviewPacket(packetInput) {
  const html = buildReviewPacketHtml(packetInput);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const draft = tr(packetInput.lang ?? "en")("draft", "brouillon");
  link.download = `civicos-${packetInput.service.id}-${packetInput.referenceId ?? draft}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
