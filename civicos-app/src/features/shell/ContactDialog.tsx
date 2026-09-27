import { ExternalLink, MessageSquare, Phone, Siren, X } from "lucide-react";
import { useDialogBehavior } from "../../hooks/useDialogBehavior";
import { useI18n } from "../../i18n/i18nContext";

interface Channel {
  name: string;
  covers: string;
  phone: string;
  url: string;
}

/** Official government lines. CivicOS can't see or change a government file. */
const SUPPORT_CHANNELS: Channel[] = [
  { name: "Government of Canada (1 800 O-Canada)", covers: "General federal programs and where to get help", phone: "1-800-622-6232", url: "https://www.canada.ca/en/contact.html" },
  { name: "Passport Program", covers: "Passport applications and status", phone: "1-800-567-6868", url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/canadian-passports/contact-passport-program.html" },
  { name: "Canada Revenue Agency", covers: "Income tax, refunds and benefit payments", phone: "1-800-959-8281", url: "https://www.canada.ca/en/revenue-agency/corporate/contact-information.html" },
  { name: "Canadian Dental Care Plan", covers: "CDCP applications and eligibility", phone: "1-833-537-4342", url: "https://www.canada.ca/en/services/benefits/dental/dental-care-plan.html" },
  { name: "ServiceOntario", covers: "Health cards, driver's licences, vehicles and certificates", phone: "1-800-267-8097", url: "https://www.ontario.ca/page/serviceontario" },
  { name: "Landlord and Tenant Board", covers: "T2 and T6 applications and hearings", phone: "1-888-332-3234", url: "https://tribunalsontario.ca/ltb/contact/" },
  { name: "City of Ottawa 3-1-1", covers: "City services, permits, parking and property tax", phone: "613-580-2400", url: "https://ottawa.ca/en/3-1-1" },
  { name: "OC Transpo", covers: "EquiPass and fare discounts", phone: "613-560-5000", url: "https://www.octranspo.com/en/fares/" },
];

const FEEDBACK_LINKS = [
  { label: "Government of Canada: contact and feedback", url: "https://www.canada.ca/en/contact.html" },
  { label: "Government of Ontario: contact and feedback", url: "https://www.ontario.ca/feedback/contact-us" },
  { label: "City of Ottawa: report a problem or give feedback", url: "https://ottawa.ca/en/3-1-1" },
  { label: "CivicOS: report a problem with this app", url: "https://github.com/Ahmedbagi1/HackTheHill3/issues" },
];

const telHref = (phone: string) => `tel:${phone.replace(/\D/g, "")}`;

export default function ContactDialog({ onClose }: { onClose: () => void }) {
  useDialogBehavior(onClose);
  const { t } = useI18n();

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal contact-dialog" role="dialog" aria-modal="true" aria-labelledby="contact-title">
        <div className="modal__header">
          <div>
            <p className="modal__eyebrow">{t("Help and support")}</p>
            <h2 id="contact-title" className="modal__title">
              {t("Contact us")}
            </h2>
          </div>
          <button type="button" className="icon-btn" aria-label={t("Close")} onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="modal__body">
          <p className="callout contact-dialog__emergency">
            <Siren size={16} aria-hidden="true" /> {t("In an emergency, call 9-1-1.")}
          </p>
          <p className="contact-dialog__intro">
            {t("CivicOS helps you prepare applications but can't see or change your government file. For questions about an application, contact the office that handles it.")}
          </p>

          <h3 className="contact-dialog__heading">{t("Official support lines")}</h3>
          <ul className="contact-dialog__list">
            {SUPPORT_CHANNELS.map((channel) => (
              <li key={channel.name} className="contact-dialog__item">
                <div>
                  <p className="contact-dialog__name">{t(channel.name)}</p>
                  <p className="contact-dialog__covers">{t(channel.covers)}</p>
                </div>
                <div className="contact-dialog__actions">
                  <a className="contact-dialog__phone" href={telHref(channel.phone)}>
                    <Phone size={13} aria-hidden="true" /> {channel.phone}
                  </a>
                  <a href={channel.url} target="_blank" rel="noreferrer" aria-label={t("{name} website", { name: t(channel.name) })}>
                    {t("Website")} <ExternalLink size={11} aria-hidden="true" />
                  </a>
                </div>
              </li>
            ))}
          </ul>
          <p className="fineprint">{t("Health advice: call 811 (Health811). Community and social services: call 2-1-1.")}</p>

          <h3 className="contact-dialog__heading">
            <MessageSquare size={15} aria-hidden="true" /> {t("Inquiries and feedback")}
          </h3>
          <ul className="contact-dialog__links">
            {FEEDBACK_LINKS.map((link) => (
              <li key={link.url + link.label}>
                <a href={link.url} target="_blank" rel="noreferrer">
                  {t(link.label)} <ExternalLink size={11} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div className="modal__footer">
          <div className="modal__footer-end">
            <button type="button" className="btn btn--primary" onClick={onClose}>
              {t("Done")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
