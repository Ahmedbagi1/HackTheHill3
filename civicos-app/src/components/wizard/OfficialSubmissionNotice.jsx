import { Building2, CircleCheck } from "lucide-react";
import { channelsFor, inPersonStepsFor, officialFormsFor } from "../../lib/officialMapping";
import { useI18n } from "../../i18n/i18nContext";

/**
 * How the official application is submitted, and any step the law requires
 * to be done in person. `complete` switches the wording for the completion
 * summary, after the intake has been saved.
 */
const OfficialSubmissionNotice = ({ service, formData, complete = false }) => {
  const { t } = useI18n();
  if (!service.official) return null;

  const inPerson = inPersonStepsFor(service, formData);
  const forms = officialFormsFor(service, formData);
  const channels = channelsFor(service);
  const { fee, notes, phone } = service.official;

  return (
    <section className={`official-notice${inPerson.length ? " official-notice--in-person" : ""}`} aria-label={t("Official submission")}>
      {inPerson.length ? (
        <>
          <p className="official-notice__title">
            <Building2 size={16} aria-hidden="true" /> {t("In-person visit legally required")}
          </p>
          <p className="official-notice__text">
            {complete
              ? t("Your intake is complete. Bring your packet and original documents to finish these steps:")
              : t("Everything else is completed here. After you submit, bring your packet and original documents to finish these steps:")}
          </p>
          <ul className="official-notice__list">
            {inPerson.map((step) => (
              <li key={step.id}>
                <strong>{t(step.step)}</strong>
                <span>{t(step.reason)}</span>
                <span className="official-notice__where">{t("Where: {where}", { where: t(step.where) })}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="official-notice__title">
          <CircleCheck size={16} aria-hidden="true" /> {t("No in-person visit required")}
        </p>
      )}
      {(forms.length > 0 || channels.length > 0 || fee || notes || phone) && (
        <dl className="official-notice__facts">
          {forms.length > 0 && (
            <div>
              <dt>{t("Official form")}</dt>
              <dd>{forms.map((form) => `${t(form.id)} · ${t(form.title)}`).join("; ")}</dd>
            </div>
          )}
          {channels.length > 0 && (
            <div>
              <dt>{t("How to submit")}</dt>
              <dd>{channels.map((channel) => t(channel.label)).join(" · ")}</dd>
            </div>
          )}
          {phone && (
            <div>
              <dt>{t("Phone")}</dt>
              <dd>
                <a href={`tel:${phone.replace(/\D/g, "")}`}>{phone}</a>
              </dd>
            </div>
          )}
          {fee && (
            <div>
              <dt>{t("Fee")}</dt>
              <dd>{t(fee)}</dd>
            </div>
          )}
          {notes && (
            <div>
              <dt>{t("Note")}</dt>
              <dd>{t(notes)}</dd>
            </div>
          )}
        </dl>
      )}
    </section>
  );
};

export default OfficialSubmissionNotice;
