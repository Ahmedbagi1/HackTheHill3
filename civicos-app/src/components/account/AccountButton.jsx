import { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { LoaderCircle, User } from "lucide-react";
import { auth0Configured, clearAuth0Callback } from "../../lib/auth0";
import AccountDialog from "./AccountDialog";

export default function AccountButton() {
  const { isLoading, error } = useAuth0();
  const [open, setOpen] = useState(false);
  const [dismissedError, setDismissedError] = useState(null);
  const dialogOpen = open || Boolean(error && error !== dismissedError);

  useEffect(() => {
    if (error) {
      // The SDK has already consumed/validated the callback at this point.
      clearAuth0Callback();
    }
  }, [error]);

  return (
    <>
      <button
        type="button"
        className="avatar"
        aria-label="Profile"
        aria-haspopup="dialog"
        aria-expanded={dialogOpen}
        onClick={() => setOpen(true)}
      >
        {auth0Configured && isLoading
          ? <LoaderCircle size={18} className="spin" aria-label="Loading account" />
          : <User size={18} aria-hidden="true" />}
      </button>
      {dialogOpen && <AccountDialog onClose={() => {
        setOpen(false);
        setDismissedError(error);
      }} />}
    </>
  );
}
