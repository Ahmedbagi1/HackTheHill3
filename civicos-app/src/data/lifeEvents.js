/**
 * Life events ("journeys") that span all three tiers of government.
 * Natural-language search matches a query to a journey and shows its
 * checklist, highlighting every referenced service at once.
 *
 *   triggers   phrases that strongly identify the journey
 *   keywords   single words that contribute to a fuzzy match
 *   steps      ordered actions, each tied to a service in servicesData.js
 */

export const LIFE_EVENTS = [
  {
    id: "lost-wallet",
    title: "Lost or stolen wallet",
    intro: "Report the loss, then replace your ID at each level of government.",
    triggers: ["lost wallet", "stolen wallet", "lost my wallet", "wallet stolen", "wallet was stolen", "lost my id", "lost id", "lost purse", "stolen purse", "lost my cards"],
    keywords: ["wallet", "purse", "stolen", "lost", "id", "cards", "identification"],
    steps: [
      { serviceId: "police-report", action: "File a police report for theft under $5,000 and keep the report number." },
      { serviceId: "drivers-licence", action: "Replace your driver's licence at ServiceOntario." },
      { serviceId: "ohip", action: "Report your health card lost or stolen and request a new one." },
      { serviceId: "transit-discounts", action: "If your Presto card is registered, report it lost so its balance can move to a new card." },
      { serviceId: "sin", action: "If your SIN card was in it, request a SIN confirmation letter (no new cards are issued)." },
      { serviceId: "passport", action: "If your passport was lost or stolen, report it right away and apply for a new one." },
    ],
  },
  {
    id: "start-business",
    title: "Starting a business",
    intro: "Register your name, set up tax accounts and check local rules.",
    triggers: ["start a business", "starting a business", "open a business", "opening a business", "new business", "start my own business", "self employed", "self-employed", "become a sole proprietor", "start a company", "side hustle"],
    keywords: ["business", "company", "entrepreneur", "startup", "proprietor", "store", "shop", "freelance"],
    steps: [
      { serviceId: "business-registration", action: "Register your business name (formerly the Master Business Licence)." },
      { serviceId: "income-tax", action: "Get a CRA business number; register for GST/HST once revenue passes $30,000 in four quarters." },
      { serviceId: "cpp-oas", action: "Plan for CPP: self-employed people pay both the employee and employer contributions." },
      { serviceId: "building-permits", action: "Check zoning and permits for your storefront or home-based business." },
      { serviceId: "property-tax-water", action: "Set up property tax and water accounts if you buy or lease commercial space." },
    ],
  },
  {
    id: "new-baby",
    title: "Having a baby",
    intro: "Register the birth, get health coverage and apply for family benefits.",
    triggers: ["new baby", "having a baby", "had a baby", "newborn", "pregnant", "expecting a baby", "birth of my child", "baby born"],
    keywords: ["baby", "newborn", "pregnant", "birth", "maternity", "parental", "infant"],
    steps: [
      { serviceId: "vital-statistics", action: "Register the birth and order a birth certificate." },
      { serviceId: "ohip", action: "Register your baby for OHIP coverage." },
      { serviceId: "sin", action: "Apply for your baby's SIN (it's often bundled with birth registration)." },
      { serviceId: "canada-child-benefit", action: "Apply for the Canada Child Benefit." },
      { serviceId: "employment-insurance", action: "Apply for EI maternity and parental benefits." },
      { serviceId: "gst-hst-credit", action: "Your Groceries & Essentials Benefit increases per child automatically once CCB is set up." },
    ],
  },
  {
    id: "moving",
    title: "Moving or changing your address",
    intro: "Update your address everywhere it's on file.",
    triggers: ["moving", "i moved", "just moved", "new address", "change of address", "change my address", "address change", "moving to ottawa", "update my address"],
    keywords: ["moving", "moved", "move", "address", "relocating", "relocate", "house"],
    steps: [
      { serviceId: "drivers-licence", action: "Update the address on your driver's licence within 6 days." },
      { serviceId: "vehicle-registration", action: "Update the address on your vehicle permit." },
      { serviceId: "ohip", action: "Update the address for your health card." },
      { serviceId: "income-tax", action: "Update your address with the CRA so benefits aren't interrupted." },
      { serviceId: "voter-registration", action: "Update your voter registration." },
      { serviceId: "waste-collection", action: "Look up the collection day at your new address." },
      { serviceId: "property-tax-water", action: "Set up property tax and water accounts if you bought a home." },
      { serviceId: "parking", action: "Apply for a residential parking permit if your street needs one." },
    ],
  },
  {
    id: "lost-job",
    title: "Lost your job",
    intro: "Replace your income and check what support you can get.",
    triggers: ["lost my job", "laid off", "got laid off", "job loss", "lost job", "unemployed", "got fired", "out of work", "no job"],
    keywords: ["laid", "unemployed", "fired", "job", "work", "layoff", "income"],
    steps: [
      { serviceId: "employment-insurance", action: "Apply for EI right away, even before your ROE arrives." },
      { serviceId: "ontario-works", action: "If you can't cover food or rent now, apply for emergency Ontario Works." },
      { serviceId: "dental-care", action: "If you lost workplace dental coverage, check the Canadian Dental Care Plan." },
      { serviceId: "gst-hst-credit", action: "Estimate your Groceries & Essentials Benefit at a lower income." },
      { serviceId: "transit-discounts", action: "Check if you qualify for a discounted EquiPass." },
    ],
  },
  {
    id: "retiring",
    title: "Retiring",
    intro: "Start your pensions and review benefits for seniors.",
    triggers: ["retire", "retiring", "retirement", "turning 65", "planning to retire", "senior benefits"],
    keywords: ["retire", "retirement", "pension", "senior", "seniors", "65", "elderly"],
    steps: [
      { serviceId: "cpp-oas", action: "Apply for CPP and OAS 6–11 months before you want payments to start." },
      { serviceId: "dental-care", action: "Check the Canadian Dental Care Plan if you won't have dental insurance." },
      { serviceId: "gst-hst-credit", action: "Keep filing taxes to receive the Groceries & Essentials Benefit." },
      { serviceId: "transit-discounts", action: "Switch your Presto card to the senior fare." },
      { serviceId: "income-tax", action: "Keep filing a tax return every year to keep receiving the Guaranteed Income Supplement and other benefits." },
    ],
  },
  {
    id: "newcomer",
    title: "New to Canada",
    intro: "Your first steps after arriving in Ottawa.",
    triggers: ["new to canada", "newcomer", "just arrived", "immigrated", "new immigrant", "moved to canada", "new permanent resident", "landed"],
    keywords: ["newcomer", "immigrant", "immigration", "arrived", "refugee", "pr", "permanent"],
    steps: [
      { serviceId: "sin", action: "Apply for your Social Insurance Number so you can work." },
      { serviceId: "ohip", action: "Apply for OHIP as soon as you arrive." },
      { serviceId: "drivers-licence", action: "Exchange your foreign driver's licence or book a road test." },
      { serviceId: "canada-child-benefit", action: "Apply for the Canada Child Benefit if you have children." },
      { serviceId: "income-tax", action: "File a tax return to access the Groceries & Essentials Benefit." },
      { serviceId: "immigration-pr", action: "Track your PR card and keep records of your days in Canada." },
      { serviceId: "transit-discounts", action: "Get a Presto card for OC Transpo." },
      { serviceId: "recreation", action: "Find programs at your local community centre." },
    ],
  },
  {
    id: "going-to-school",
    title: "Going to college or university",
    intro: "Fund your studies and set up the basics.",
    triggers: ["going to college", "going to university", "going back to school", "post secondary", "post-secondary", "pay for school", "pay tuition", "student aid"],
    keywords: ["college", "university", "student", "tuition", "school", "studies"],
    steps: [
      { serviceId: "sin", action: "Make sure you have a SIN; OSAP requires one." },
      { serviceId: "osap", action: "Estimate your OSAP grant and loan mix, then apply at least 60 days before classes." },
      { serviceId: "income-tax", action: "File taxes every year to claim tuition credits and receive benefits." },
      { serviceId: "transit-discounts", action: "Check your school's U-Pass or youth fares for OC Transpo." },
    ],
  },
  {
    id: "renovating",
    title: "Renovating your home",
    intro: "Get the right permits before you build.",
    triggers: ["renovation", "renovating", "renovate", "build a deck", "building a deck", "new deck", "home improvement", "finish my basement", "build a shed"],
    keywords: ["renovation", "deck", "shed", "basement", "contractor", "addition", "remodel"],
    steps: [
      { serviceId: "building-permits", action: "Screen your project and apply for a building permit if needed." },
      { serviceId: "property-tax-water", action: "Major additions can change your property assessment and taxes." },
      { serviceId: "service-requests-311", action: "Contact 3-1-1 about sidewalk, driveway or right-of-way use during construction." },
    ],
  },
  {
    id: "buying-a-car",
    title: "Buying a car",
    intro: "Transfer ownership, insure and park your vehicle.",
    triggers: ["buying a car", "bought a car", "buy a car", "used car", "new car", "buying a used car", "transfer ownership"],
    keywords: ["car", "vehicle", "truck", "ownership", "plates", "dealer"],
    steps: [
      { serviceId: "vehicle-registration", action: "Transfer ownership with the bill of sale, UVIP and Safety Standards Certificate." },
      { serviceId: "drivers-licence", action: "Make sure your licence is valid and your address is current." },
      { serviceId: "parking", action: "Apply for a residential parking permit if you park on the street." },
    ],
  },
  {
    id: "death-in-family",
    title: "After a death in the family",
    intro: "Settle government records and apply for survivor benefits.",
    triggers: ["death in the family", "someone died", "passed away", "died", "bereavement", "funeral", "death of a spouse", "death of a parent"],
    keywords: ["death", "died", "funeral", "estate", "survivor", "executor", "bereavement"],
    steps: [
      { serviceId: "vital-statistics", action: "Order death certificates; you'll need several for banks and agencies." },
      { serviceId: "cpp-oas", action: "Apply for the CPP death benefit and survivor's pension, and stop OAS payments." },
      { serviceId: "income-tax", action: "File the final tax return for the person who died." },
      { serviceId: "passport", action: "Return or cancel the person's passport." },
      { serviceId: "drivers-licence", action: "Cancel the driver's licence and transfer any vehicles." },
    ],
  },
];
