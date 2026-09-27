import { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { LoaderCircle, User } from "lucide-react";
import { auth0Configured, clearAuth0Callback } from "../../lib/auth0";
import { useI18n } from "../../i18n/i18nContext";
import { useCivicData } from "../../state/civicDataStore";
import AccountDialog from "./AccountDialog";

/** @param {{ variant?: "avatar" | "pill" }} props */
export default function AccountButton({ variant = "avatar" }) {
  const { isLoading, error } = useAuth0();
  const { t } = useI18n();
  const { displayName, signedIn } = useCivicData();
  const [open, setOpen] = useState(false);
  const [dismissedError, setDismissedError] = useState(null);
  const dialogOpen = open || Boolean(error && error !== dismissedError);

  useEffect(() => {
    if (error) {
      // The SDK has already consumed/validated the callback at this point.
      clearAuth0Callback();
    }
  }, [error]);

  const icon =
    auth0Configured && isLoading ? (
      <LoaderCircle size={18} className="spin" aria-label={t("Loading account")} />
    ) : (
      <User size={18} aria-hidden="true" />
    );

  return (
    <>
      {variant === "pill" ? (
        <button type="button" className="profile-pill" aria-haspopup="dialog" aria-expanded={dialogOpen} onClick={() => setOpen(true)}>
          <span className="avatar avatar--sm" aria-hidden="true">
            {icon}
          </span>
          <span className="profile-pill__text">
            <span className="profile-pill__name">{displayName ?? t("Guest")}</span>
            <span className="profile-pill__meta">{signedIn ? t("Signed in") : t("Sign in or create an account")}</span>
          </span>
        </button>
      ) : (
        <button type="button" className="avatar" aria-label={t("Profile")} aria-haspopup="dialog" aria-expanded={dialogOpen} onClick={() => setOpen(true)}>
          {icon}
        </button>
      )}
      {dialogOpen && (
        <AccountDialog
          onClose={() => {
            setOpen(false);
            setDismissedError(error);
          }}
        />
      )}
    </>
  );
}
