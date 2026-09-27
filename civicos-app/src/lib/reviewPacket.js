/**
 * Builds a self-contained, printable HTML "review packet" of a completed
 * application, plus a structured JSON export of the same content, and
 * triggers a download. All user input is HTML-escaped.
 * `lang` (see lib/formatting.js) renders the packet in the active language.
 *
 * Each answer carries the official form section it maps to (`officialRef`),
 * so the packet can be transcribed onto, or uploaded alongside, the official
 * form. No government system accepts this packet directly.
 */

import { formatAnswer } from "./formatting";
import { channelsFor, inPersonStepsFor, officialFormsFor } from "./officialMapping";
import { DISPLAY_ONLY_TYPES, validateFields, visibleFields } from "./validation";

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
  .form-ref{display:block;margin-top:2px;font-size:11px;color:#94a3b8;font-family:ui-monospace,Consolas,monospace}
  .forms{margin:8px 0 0;font-size:13px;color:#334155}
  .inperson{margin:0 0 8px;padding:12px 14px;border:1px solid #f59e0b;background:#fffbeb;border-radius:8px}
  .inperson h2{margin:0 0 6px;color:#92400e} .inperson li{margin-bottom:6px}
  .channels{margin:0 0 8px;padding:12px 14px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px}
  ul{padding-left:20px} .note{margin-top:32px;padding:12px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;color:#475569}
  @media print{body{margin:0}}
`;

const ENGLISH = { t: (text, params) => (params ? text.replace(/\{(\w+)\}/g, (m, k) => (params[k] ?? m)) : text), intl: "en-CA", htmlLang: "en-CA", formatDate: null };

const answerSteps = (steps) => steps.filter((step) => step.fields.length);

function submissionHtml(service, formData, t) {
  if (!service.official) return "";
  const inPerson = inPersonStepsFor(service, formData);
  const channels = channelsFor(service).map((channel) => t(channel.label));
  const { fee, notes, authority } = service.official;
  const inPersonHtml = inPerson.length
    ? `<section class="inperson"><h2>${escapeHtml(t("In-person visit legally required"))}</h2>
<p>${escapeHtml(t("Every other part of the intake is complete in this packet. Bring it and your original documents to finish these steps:"))}</p>
<ul>${inPerson
        .map(
          (step) =>
            `<li><strong>${escapeHtml(t(step.step))}</strong><br>${escapeHtml(t(step.reason))}<br>${escapeHtml(t("Where: {where}", { where: t(step.where) }))}</li>`,
        )
        .join("")}</ul></section>`
    : `<section class="channels"><strong>${escapeHtml(t("No in-person visit required"))}</strong></section>`;
  const facts = [
    channels.length && t("How to submit: {channels}", { channels: channels.join(" · ") }),
    fee && t(fee),
    notes && t(notes),
    authority && t("Authority: {authority}", { authority: t(authority) }),
  ].filter(Boolean);
  return `${inPersonHtml}${facts.length ? `<section class="channels">${facts.map((fact) => `<div>${escapeHtml(fact)}</div>`).join("")}</section>` : ""}`;
}

export function buildReviewPacketHtml({ service, steps, formData, referenceId, submittedAt = new Date(), lang = ENGLISH }) {
  const { t } = lang;
  const sections = answerSteps(steps)
    .map((step) => {
      const rows = visibleFields(step.fields, formData)
        .filter((field) => !DISPLAY_ONLY_TYPES.has(field.type) || field.type === "estimate")
        .map(
          (field) =>
            `<tr><th>${escapeHtml(t(field.reviewLabel ?? field.label))}${
              field.officialRef ? `<span class="form-ref">${escapeHtml(t(field.officialRef))}</span>` : ""
            }</th><td>${escapeHtml(formatAnswer(field, formData[field.name], formData, lang))}</td></tr>`,
        )
        .join("");
      return `<h2>${escapeHtml(t(step.title))}</h2><table>${rows}</table>`;
    })
    .join("");

  const requirements = service.requirements.map((item) => `<li>${escapeHtml(t(item))}</li>`).join("");
  const stamp = submittedAt.toLocaleString(lang.intl, { dateStyle: "long", timeStyle: "short" });
  const forms = officialFormsFor(service, formData);

  return `<!doctype html>
<html lang="${escapeHtml(lang.htmlLang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(t("{service}: CivicOS review packet", { service: t(service.title) }))}</title><style>${PACKET_STYLES}</style></head>
<body>
<header>
  <div class="meta">${escapeHtml(t(service.tier))} · ${escapeHtml(t(service.agency))}</div>
  <h1>${escapeHtml(t(service.title))}</h1>
  <div class="meta">${escapeHtml(t(referenceId ? "Submitted {date}" : "Draft prepared {date}", { date: stamp }))}</div>
  ${referenceId ? `<div class="ref">${escapeHtml(referenceId)}</div>` : ""}
  ${forms.length ? `<div class="forms">${escapeHtml(t("Official form"))}: ${forms.map((form) => `${escapeHtml(t(form.id))} · ${escapeHtml(t(form.title))}`).join("; ")}</div>` : ""}
</header>
${submissionHtml(service, formData, t)}
${sections}
<h2>${escapeHtml(t("Documents to have ready"))}</h2><ul>${requirements}</ul>
<div class="note">${escapeHtml(t("Prepared with CivicOS using test information. This packet is a summary for your records and is not an official government document."))}
${escapeHtml(t("Nothing was submitted to a government service. Any reference identifies only the internal CivicOS prototype application."))}
${escapeHtml(t("Official information: {url}", { url: service.officialUrl }))}</div>
</body></html>`;
}

/**
 * Structured packet (schema "civicos.packet.v1"): every visible answer with its
 * official form section, raw value and display value, plus the official forms,
 * submission channels and any legally required in-person steps.
 */
export function buildReviewPacketData({ service, steps, formData, referenceId, submittedAt = new Date(), lang = ENGLISH }) {
  const { t } = lang;
  return {
    schema: "civicos.packet.v1",
    generatedAt: submittedAt.toISOString(),
    referenceId: referenceId ?? null,
    status: referenceId ? "saved-prototype" : "draft",
    language: lang.htmlLang ?? lang.intl,
    service: { id: service.id, title: t(service.title), tier: service.tier, agency: t(service.agency), officialUrl: service.officialUrl },
    officialForms: officialFormsFor(service, formData).map((form) => ({ id: form.id, title: t(form.title) })),
    submission: service.official
      ? {
          channels: channelsFor(service).map((channel) => ({ id: channel.id, label: t(channel.label) })),
          fee: service.official.fee ? t(service.official.fee) : null,
          notes: service.official.notes ? t(service.official.notes) : null,
          authority: service.official.authority ? t(service.official.authority) : null,
        }
      : null,
    inPersonRequired: inPersonStepsFor(service, formData).map((step) => ({
      id: step.id,
      mode: step.mode,
      step: t(step.step),
      reason: t(step.reason),
      where: t(step.where),
    })),
    intakeComplete: Object.keys(validateFields(answerSteps(steps).flatMap((step) => step.fields), formData)).length === 0,
    sections: answerSteps(steps).map((step) => ({
      id: step.id,
      title: t(step.title),
      fields: visibleFields(step.fields, formData)
        .filter((field) => !DISPLAY_ONLY_TYPES.has(field.type))
        .map((field) => ({
          name: field.name,
          officialRef: field.officialRef ? t(field.officialRef) : null,
          label: t(field.reviewLabel ?? field.label),
          value: formData[field.name] ?? null,
          display: formatAnswer(field, formData[field.name], formData, lang),
        })),
    })),
    documents: service.requirements.map((item) => t(item)),
    notice: t("Prepared with CivicOS using test information. This packet is a summary for your records and is not an official government document."),
  };
}

const download = (content, type, filename) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const packetName = ({ service, referenceId }) => `civicos-${service.id}-${referenceId ?? "draft"}`;

export function downloadReviewPacket(packetInput) {
  download(buildReviewPacketHtml(packetInput), "text/html;charset=utf-8", `${packetName(packetInput)}.html`);
}

export function downloadReviewPacketJson(packetInput) {
  download(JSON.stringify(buildReviewPacketData(packetInput), null, 2), "application/json", `${packetName(packetInput)}.json`);
}
