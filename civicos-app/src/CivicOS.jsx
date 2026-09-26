import React, { useState, useMemo } from "react";
import { Search } from "lucide-react";

const CivicOS = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeLevel, setActiveLevel] = useState("All");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const services = [
    {
      title: "Lost wallet",
      summary: "Report a lost wallet.",
      level: "Municipal",
      time: "10 mins",
    },
    {
      title: "Renew Driver's License",
      summary: "Renew your driver's license.",
      level: "Provincial",
      time: "2 weeks",
    },
    {
      title: "Trash pickup schedule",
      summary: "Check your trash pickup schedule.",
      level: "Municipal",
      time: "5 mins",
    },
    {
      title: "Passport renewal",
      summary: "Renew your passport.",
      level: "Federal",
      time: "3 weeks",
    },
    {
      title: "Utility bill payment",
      summary: "Pay your utility bills.",
      level: "Provincial",
      time: "2 days",
    },
    {
      title: "Vehicle registration",
      summary: "Register your vehicle.",
      level: "Municipal",
      time: "1 week",
    },
  ];

  const filteredServices = useMemo(() => {
    return services.filter(
      (service) =>
        service.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        (activeLevel === "All" || service.level === activeLevel),
    );
  }, [searchQuery, activeLevel]);

  const handleSearchChange = (e) => setSearchQuery(e.target.value);
  const handleLevelChange = (level) => setActiveLevel(level);
  const handleModalOpen = () => {
    setCurrentStep(1);
    setIsModalOpen(true);
  };
  const handleModalClose = () => setIsModalOpen(false);
  const handleNextStep = () => setCurrentStep(currentStep + 1);
  const handleBackStep = () => setCurrentStep(currentStep - 1);

  return (
    <div className="bg-slate-50 min-h-screen text-slate-900">
      {/* Top Header */}
      <header className="bg-indigo-600 text-white p-4 flex flex-wrap justify-between items-center gap-4 shadow">
        <h1 className="text-2xl font-bold tracking-tight">CivicOS</h1>
        <div className="flex items-center space-x-4">
          <div className="flex space-x-1 sm:space-x-2">
            {["All", "Municipal", "Provincial", "Federal"].map((level) => (
              <button
                key={level}
                onClick={() => handleLevelChange(level)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  activeLevel === level
                    ? "bg-indigo-800 text-white shadow-inner"
                    : "text-indigo-100 hover:bg-indigo-700"
                }`}
              >
                {level}
              </button>
            ))}
          </div>
          <button className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 transition-colors text-sm font-medium rounded shadow-sm">
            Profile
          </button>
        </div>
      </header>

      {/* Main Content Layout */}
      <div className="max-w-7xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        <main className="lg:col-span-3">
          {/* Search Bar */}
          <div className="flex items-center bg-white border border-slate-300 rounded-lg px-3 py-2 shadow-sm mb-6 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500">
            <Search className="w-5 h-5 text-slate-400 mr-2 shrink-0" />
            <input
              type="text"
              placeholder="Search services (e.g. passport, driver's license, wallet)..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full bg-transparent outline-none text-slate-800 placeholder-slate-400 text-sm md:text-base"
            />
          </div>

          {/* Service Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredServices.map((service, index) => (
              <div
                key={index}
                className="bg-white rounded-lg border border-slate-200 shadow-sm p-5 flex flex-col justify-between hover:shadow-md transition-shadow"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        service.level === "Municipal"
                          ? "bg-indigo-100 text-indigo-700"
                          : service.level === "Provincial"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {service.level}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      Est. {service.time}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-slate-800 mb-1">
                    {service.title}
                  </h2>
                  <p className="text-sm text-slate-600 mb-4">
                    {service.summary}
                  </p>
                </div>
                <button
                  onClick={handleModalOpen}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded text-sm transition-colors shadow-sm"
                >
                  Start Application
                </button>
              </div>
            ))}
          </div>

          {filteredServices.length === 0 && (
            <p className="text-center text-slate-500 mt-8 text-sm">
              No civic services found matching "{searchQuery}".
            </p>
          )}
        </main>

        {/* Live Civic Alerts Sidebar */}
        <aside className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm h-fit">
          <h3 className="text-base font-bold text-slate-800 mb-3 pb-2 border-b border-slate-100">
            Civic Alerts & Notices
          </h3>
          <ul className="space-y-3 text-sm text-slate-600">
            <li className="flex items-start gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
              <span>Spring street sweeping schedule has been updated.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="h-2 w-2 rounded-full bg-rose-500 mt-1.5 shrink-0" />
              <span>Passport processing delays: expect 2-3 weeks.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
              <span>Green bin and organic pickup scheduled for tomorrow.</span>
            </li>
          </ul>
        </aside>
      </div>

      {/* 3-Step Wizard Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-800">
                Application Wizard
              </h2>
              <span className="text-xs font-semibold px-2 py-1 bg-slate-100 rounded text-slate-600">
                Step {currentStep} of 3
              </span>
            </div>

            {currentStep === 1 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-700">
                  Step 1: Identity & Eligibility
                </h3>
                <input
                  type="text"
                  placeholder="Full Name"
                  className="border border-slate-300 rounded px-3 py-2 w-full text-sm outline-none focus:border-indigo-500"
                />
                <input
                  type="email"
                  placeholder="Email Address"
                  className="border border-slate-300 rounded px-3 py-2 w-full text-sm outline-none focus:border-indigo-500"
                />
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-700">
                  Step 2: Details & Address
                </h3>
                <input
                  type="text"
                  placeholder="Residential Address"
                  className="border border-slate-300 rounded px-3 py-2 w-full text-sm outline-none focus:border-indigo-500"
                />
                <input
                  type="text"
                  placeholder="City"
                  className="border border-slate-300 rounded px-3 py-2 w-full text-sm outline-none focus:border-indigo-500"
                />
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-700">
                  Step 3: Confirmation
                </h3>
                <div className="p-3 bg-slate-50 rounded border border-slate-200 text-xs text-slate-600">
                  Ready to submit your application details. A downloadable PDF
                  confirmation will be issued.
                </div>
              </div>
            )}

            {/* Modal Controls */}
            <div className="flex justify-between items-center mt-6 pt-3 border-t border-slate-100">
              {currentStep > 1 ? (
                <button
                  onClick={handleBackStep}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium px-4 py-2 rounded transition-colors"
                >
                  Back
                </button>
              ) : (
                <button
                  onClick={handleModalClose}
                  className="text-slate-500 hover:text-slate-700 text-sm font-medium px-2 py-2"
                >
                  Cancel
                </button>
              )}

              {currentStep < 3 ? (
                <button
                  onClick={handleNextStep}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded transition-colors ml-auto"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={handleModalClose}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded transition-colors ml-auto"
                >
                  Submit
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CivicOS;
