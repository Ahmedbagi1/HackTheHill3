import { Landmark } from "lucide-react";
import AccountButton from "../../components/account/AccountButton";
import ProvinceSelector from "./ProvinceSelector";
import NotificationsMenu from "./NotificationsMenu";
import type { DashboardNotification } from "../../types/dashboard";

interface Props {
  notifications: DashboardNotification[];
  readIds: string[];
  onMarkRead: (ids: string[]) => void;
  onSelectNotification: (notification: DashboardNotification) => void;
  onHome: () => void;
}

export default function DashboardHeader({ notifications, readIds, onMarkRead, onSelectNotification, onHome }: Props) {
  return (
    <header className="topbar">
      <div className="topbar__inner">
        <div className="topbar__start">
          <a
            className="brand"
            href="#/"
            aria-label="CivicOS home"
            onClick={(e) => {
              e.preventDefault();
              onHome();
            }}
          >
            <span className="brand__mark" aria-hidden="true">
              <Landmark size={18} />
            </span>
            CivicOS
          </a>
          <ProvinceSelector />
        </div>
        <nav className="topbar__actions" aria-label="Account">
          <NotificationsMenu
            notifications={notifications}
            readIds={readIds}
            onMarkRead={onMarkRead}
            onSelect={onSelectNotification}
          />
          <AccountButton />
        </nav>
      </div>
    </header>
  );
}
