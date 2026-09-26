import ServiceCard from "./ServiceCard";
import EmptyState from "../common/EmptyState";

const ServicesGrid = ({ services, stepByServiceId, query, tier, onStart, onListen, onReset }) => (
  <div id="service-results" role="tabpanel" aria-label={`${tier} services`}>
    {services.length > 0 ? (
      <div className="grid">
        {services.map((service) => (
          <ServiceCard
            key={service.id}
            service={service}
            stepNumber={stepByServiceId.get(service.id)}
            onStart={onStart}
            onListen={onListen}
          />
        ))}
      </div>
    ) : (
      <EmptyState query={query} tier={tier} onReset={onReset} />
    )}
  </div>
);

export default ServicesGrid;
