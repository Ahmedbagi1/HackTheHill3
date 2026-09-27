/**
 * Builds a self-contained, printable HTML "review packet" of a completed
 * application and triggers a download. All user input is HTML-escaped.
 * `lang` (see lib/formatting.js) renders the packet in the active language.
 */

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

const ENGLISH = { t: (text, params) => (params ? text.replace(/\{(\w+)\}/g, (m, k) => (params[k] ?? m)) : text), intl: "en-CA", htmlLang: "en-CA", formatDate: null };

export function buildReviewPacketHtml({ service, steps, formData, referenceId, submittedAt = new Date(), lang = ENGLISH }) {
  const { t } = lang;
  const sections = steps
    .filter((step) => step.fields.length)
    .map((step) => {
      const rows = visibleFields(step.fields, formData)
        .filter((field) => !DISPLAY_ONLY_TYPES.has(field.type) || field.type === "estimate")
        .map(
          (field) =>
            `<tr><th>${escapeHtml(t(field.reviewLabel ?? field.label))}</th><td>${escapeHtml(
              formatAnswer(field, formData[field.name], formData, lang),
            )}</td></tr>`,
        )
        .join("");
      return `<h2>${escapeHtml(t(step.title))}</h2><table>${rows}</table>`;
    })
    .join("");

  const requirements = service.requirements.map((item) => `<li>${escapeHtml(t(item))}</li>`).join("");
  const stamp = submittedAt.toLocaleString(lang.intl, { dateStyle: "long", timeStyle: "short" });

  return `<!doctype html>
<html lang="${escapeHtml(lang.htmlLang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(t("{service}: CivicOS review packet", { service: t(service.title) }))}</title><style>${PACKET_STYLES}</style></head>
<body>
<header>
  <div class="meta">${escapeHtml(t(service.tier))} · ${escapeHtml(t(service.agency))}</div>
  <h1>${escapeHtml(t(service.title))}</h1>
  <div class="meta">${escapeHtml(t(referenceId ? "Submitted {date}" : "Draft prepared {date}", { date: stamp }))}</div>
  ${referenceId ? `<div class="ref">${escapeHtml(referenceId)}</div>` : ""}
</header>
${sections}
<h2>${escapeHtml(t("Documents to have ready"))}</h2><ul>${requirements}</ul>
<div class="note">${escapeHtml(t("Prepared with CivicOS using test information. This packet is a summary for your records and is not an official government document."))}
${escapeHtml(t("Nothing was submitted to a government service. Any reference identifies only the internal CivicOS prototype application."))}
${escapeHtml(t("Official information: {url}", { url: service.officialUrl }))}</div>
</body></html>`;
}

export function downloadReviewPacket(packetInput) {
  const html = buildReviewPacketHtml(packetInput);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `civicos-${packetInput.service.id}-${packetInput.referenceId ?? "draft"}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
