import { useState } from "react";
import { Bell, Landmark, Recycle } from "lucide-react";
import WasteLookupField from "../wizard/WasteLookupField";

const CivicAlertsSidebar = ({ alerts, tierTotals }) => {
  const [schedule, setSchedule] = useState(null);

  return (
    <aside className="sidebar">
      <section className="panel" aria-labelledby="waste-heading">
        <h3 id="waste-heading" className="panel__header">
          <Recycle size={16} aria-hidden="true" />
          What's my garbage day?
          <span className="badge badge--feature">Live</span>
        </h3>
        <div className="panel__body">
          <WasteLookupField id="sidebar-waste-lookup" value={schedule} onChange={setSchedule} />
        </div>
      </section>

      <section className="panel" aria-labelledby="alerts-heading">
        <h3 id="alerts-heading" className="panel__header">
          <Bell size={16} aria-hidden="true" />
          Civic alerts & notices
        </h3>
        <ul className="alert-list">
          {alerts.map((alert) => (
            <li key={alert.id} className="alert">
              <span className={`alert__dot alert__dot--${alert.tone}`} />
              <span>
                <span className="alert__tier">{alert.tier}</span> {alert.text}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel" aria-labelledby="stats-heading">
        <h3 id="stats-heading" className="panel__header">
          <Landmark size={16} aria-hidden="true" />
          Service directory
        </h3>
        <div className="stats">
          {Object.entries(tierTotals).map(([tier, total]) => (
            <div key={tier} className="stat">
              <div className="stat__value">{total}</div>
              <div className="stat__label">{tier === "All" ? "Total services" : tier}</div>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
};

export default CivicAlertsSidebar;
