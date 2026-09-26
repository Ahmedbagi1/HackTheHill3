import { Bell, Landmark } from "lucide-react";
import AccountButton from "../account/AccountButton";

const Header = ({ alertCount }) => (
  <header className="topbar">
    <div className="topbar__inner">
      <a className="brand" href="/" aria-label="CivicOS home">
        <span className="brand__mark" aria-hidden="true">
          <Landmark size={18} />
        </span>
        CivicOS
        <span className="brand__tag">Federal · Ontario · Ottawa services</span>
      </a>
      <div className="topbar__actions">
        <a
          className="icon-btn"
          href="#alerts-heading"
          aria-label={`Civic alerts (${alertCount})`}
        >
          <Bell size={20} />
          {alertCount > 0 && <span className="icon-btn__badge">{alertCount}</span>}
        </a>
        <AccountButton />
      </div>
    </div>
  </header>
);

export default Header;
