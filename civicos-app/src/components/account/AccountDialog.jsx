import { useEffect, useRef, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { ArrowRight, CircleAlert, CircleCheck, Landmark, LoaderCircle, LogOut, Mail, User, X } from "lucide-react";
import { useDialogBehavior } from "../../hooks/useDialogBehavior";
import { auth0Configured, auth0ReturnTo } from "../../lib/auth0";
import { useI18n } from "../../i18n/i18nContext";

export default function AccountDialog({ onClose }) {
  const { isLoading, isAuthenticated, user, error, loginWithRedirect, logout } = useAuth0();
  const { t, locale } = useI18n();
  const [pending, setPending] = useState(null);
  const [requestError, setRequestError] = useState(null);
  const [pictureFailed, setPictureFailed] = useState(false);
  const dialogRef = useRef(null);
  const busyRef = useRef(false);
  const loading = auth0Configured && isLoading;
  const busy = loading || pending !== null;
  const failure = requestError ?? error;
  const needsVerification =
    (isAuthenticated && user?.email_verified !== true) ||
    failure?.message?.includes("CIVICOS_EMAIL_UNVERIFIED");
  const signedIn = isAuthenticated && user?.email_verified === true;

  useDialogBehavior(onClose);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  const startAuthentication = async (mode) => {
    if (busyRef.current || !auth0Configured || loading) return;
    busyRef.current = true;
    setPending(mode);
    setRequestError(null);
    try {
      if (mode === "logout") {
        await logout({ logoutParams: { returnTo: auth0ReturnTo } });
      } else {
        await loginWithRedirect({
          authorizationParams: {
            connection: "Username-Password-Authentication",
            // Explicit sign-in also lets users choose a different account or
            // retry after verification without reusing an unverified SSO login.
            prompt: "login",
            // Auth0's hosted pages support English and French.
            ui_locales: locale === "fr" ? "fr-CA fr" : "en",
            ...(mode === "signup" ? { screen_hint: "signup" } : {}),
          },
        });
      }
    } catch (cause) {
      setRequestError(cause instanceof Error ? cause : new Error("Authentication request failed"));
      setPending(null);
      busyRef.current = false;
    }
  };

  const picture = typeof user?.picture === "string" && /^https:\/\//i.test(user.picture)
    ? user.picture : null;

  return (
    <dialog
      ref={dialogRef}
      className="account-dialog"
      aria-labelledby="account-title"
      aria-describedby="account-description"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = [...event.currentTarget.querySelectorAll("button:not(:disabled), a[href]")];
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right ||
            event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
      }}
    >
      <div className="modal__header">
        <div className="account-brand">
          <span className="brand__mark" aria-hidden="true"><Landmark size={18} /></span>
          <span>{t("CivicOS account")}</span>
        </div>
        <button type="button" className="icon-btn" aria-label={t("Close account dialog")} onClick={onClose}>
          <X size={20} />
        </button>
      </div>

      <div className="modal__body account-body" aria-busy={busy}>
        <div>
          <h2 id="account-title" className="account-title">
            {signedIn ? t("Your account") : needsVerification ? t("Verify your email") : t("Welcome to CivicOS")}
          </h2>
          <p id="account-description" className="account-description">
            {signedIn ? t("Your CivicOS profile and sign-in details.") : t("One account for your CivicOS dashboard.")}
          </p>
        </div>

        {!auth0Configured ? (
          <p className="account-notice account-notice--error" role="alert">
            <CircleAlert size={18} aria-hidden="true" />
            {t("Sign-in is currently unavailable. Please try again once account setup is complete.")}
          </p>
        ) : loading ? (
          <p className="account-notice" role="status">
            <LoaderCircle size={18} className="spin" aria-hidden="true" /> {t("Checking your session…")}
          </p>
        ) : needsVerification ? (
          <div className="account-notice" role="alert">
            <Mail size={20} aria-hidden="true" />
            <div>
              <strong>{t("Check your inbox before signing in.")}</strong>
              <p>{t("Open the verification link sent by CivicOS, then return here and sign in again. Check your spam folder if it hasn’t arrived.")}</p>
              <p>{t("If the link has expired or is missing, ask the CivicOS team to resend it.")}</p>
            </div>
          </div>
        ) : failure ? (
          <p className="account-notice account-notice--error" role="alert">
            <CircleAlert size={18} aria-hidden="true" />
            {t("We couldn’t complete your account request. Please try again. If this continues, contact the CivicOS team.")}
          </p>
        ) : null}

        {!loading && signedIn && (
          <div className="account-profile">
            <span className="account-picture" aria-hidden="true">
              {picture && !pictureFailed
                ? <img src={picture} alt="" referrerPolicy="no-referrer" onError={() => setPictureFailed(true)} />
                : <User size={28} />}
            </span>
            <dl className="account-details">
              {user.name && <div><dt>{t("Name")}</dt><dd>{user.name}</dd></div>}
              {user.nickname && <div><dt>{t("Nickname / username")}</dt><dd>{user.nickname}</dd></div>}
              {user.email && <div><dt>{t("Email")}</dt><dd>{user.email}</dd></div>}
              <div><dt>{t("Email verification")}</dt><dd className="account-verified"><CircleCheck size={15} aria-hidden="true" /> {t("Verified")}</dd></div>
            </dl>
          </div>
        )}

        {!loading && !signedIn && (
          <p className="account-description">
            {t("Sign in or create an account on our secure sign-in page. You can also reset a forgotten password there.")}
          </p>
        )}

        <div className="account-actions">
          {!signedIn && (
            <>
              <button type="button" className="btn btn--primary btn--block" disabled={busy || !auth0Configured} onClick={() => startAuthentication("login")}>
                {pending === "login" ? t("Opening sign-in…") : needsVerification ? t("I’ve verified my email. Sign in") : t("Sign in")}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
              {!needsVerification && (
                <button type="button" className="btn btn--secondary btn--block" disabled={busy || !auth0Configured} onClick={() => startAuthentication("signup")}>
                  {pending === "signup" ? t("Opening sign-up…") : t("Create account")}
                </button>
              )}
            </>
          )}
          {(isAuthenticated || needsVerification) && (
            <button type="button" className="btn btn--secondary btn--block" disabled={busy || !auth0Configured} onClick={() => startAuthentication("logout")}>
              <LogOut size={16} aria-hidden="true" />
              {pending === "logout" ? t("Signing out…") : t("Sign out")}
            </button>
          )}
          {pending && <p className="sr-only" role="status">{t("Redirecting to the secure account page…")}</p>}
        </div>
      </div>
      <div className="account-footer">{t("Federal · Ontario · Ottawa services")}</div>
    </dialog>
  );
}
