/**
 * Rule-based screeners that are not benefit payments. They return the same
 * EstimateResult shape as services/api/benefitCalculators.js.
 */

const money = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });

const toAmount = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
};

/* Ontario Building Code triggers as applied by City of Ottawa Building Code Services. */
export function screenBuildingPermit(data) {
  const { projectType } = data;
  if (!projectType) return null;

  const reasons = [];
  let needed = false;

  if (projectType === "deck") {
    const height = toAmount(data.deckHeight);
    if (height === null || !data.attachedToHouse) return null;
    if (height > 0.6) {
      needed = true;
      reasons.push("Decks more than 60 cm (24 in) above the ground need a permit.");
    }
    if (data.attachedToHouse === "yes") {
      needed = true;
      reasons.push("Decks attached to a house generally need a permit.");
    }
    if (!needed) reasons.push("A low, free-standing deck is usually exempt, but zoning setbacks still apply.");
  }

  if (projectType === "shed") {
    const area = toAmount(data.shedArea);
    if (area === null) return null;
    if (area > 15) {
      needed = true;
      reasons.push("Accessory buildings larger than 15 m² need a permit.");
    } else {
      reasons.push("Sheds 15 m² or smaller are exempt from a permit, but must meet zoning setbacks.");
    }
  }

  if (projectType === "renovation") {
    const work = data.renovationWork ?? [];
    if (!work.length) return null;
    const triggers = {
      structural: "Removing or adding walls or beams",
      plumbing: "Adding or moving plumbing fixtures",
      windows: "Enlarging or adding windows or doors",
      hvac: "Changing heating or ventilation ducts",
    };
    for (const key of work) {
      if (triggers[key]) {
        needed = true;
        reasons.push(`${triggers[key]} requires a permit.`);
      }
    }
    if (!needed) reasons.push("Cosmetic work (paint, flooring, cabinets) doesn't need a permit.");
  }

  if (projectType === "basement") {
    needed = true;
    reasons.push("Finishing a basement (new walls, bedrooms or bathrooms) requires a permit.");
  }

  return {
    status: needed ? "partial" : "eligible",
    headline: needed ? "Building permit likely required" : "Permit likely not required",
    subline: needed ? "Apply before work starts to avoid stop-work orders" : "Confirm zoning rules before you build",
    breakdown: [],
    notes: [...reasons, "This screener is guidance only; Building Code Services makes the final call."],
    source: {
      label: "City of Ottawa: Building permits",
      url: "https://ottawa.ca/en/planning-development-and-construction/building-permits",
    },
  };
}

/* Permanent residents must be physically present 730 days in any 5-year period. */
export function screenPrResidency({ daysInCanada }) {
  const days = toAmount(daysInCanada);
  if (days === null) return null;
  const meets = days >= 730;
  return {
    status: meets ? "eligible" : "ineligible",
    headline: meets ? "Meets the residency obligation" : "Below the residency obligation",
    subline: `${Math.floor(days)} of 730 days in the last 5 years`,
    breakdown: [],
    notes: meets
      ? ["Keep travel records; IRCC may ask for proof."]
      : ["You may need a Permanent Resident Travel Document or humanitarian review. Get legal advice."],
    source: {
      label: "IRCC: PR residency obligation",
      url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/new-immigrants/pr-card/understand-pr-status.html",
    },
  };
}

/* Private used-vehicle sales in Ontario: 13% RST on the greater of price or wholesale value. */
export function estimateVehicleSalesTax({ purchasePrice }) {
  const price = toAmount(purchasePrice);
  if (price === null) return null;
  const tax = Math.round(price * 0.13 * 100) / 100;
  return {
    status: "info",
    headline: `At least ${money.format(tax)} retail sales tax`,
    subline: "13% of the purchase price or wholesale value, whichever is higher",
    breakdown: [
      { label: "Purchase price", value: money.format(price) },
      { label: "13% retail sales tax", value: money.format(tax) },
    ],
    notes: [
      "Dealer sales charge 13% HST at the time of purchase instead.",
      "Transfers between close family members may be exempt with a sworn statement.",
    ],
    source: {
      label: "ServiceOntario: Buying or selling a used vehicle",
      url: "https://www.ontario.ca/page/buy-or-sell-used-vehicle-ontario",
    },
  };
}
