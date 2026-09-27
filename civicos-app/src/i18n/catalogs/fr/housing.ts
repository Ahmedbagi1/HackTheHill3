/** Provincial Housing Assistance (rent-geared-to-income) module and eligibility engine. */
const housing: Record<string, string> = {
  "Provincial housing assistance · Ontario": "Aide provinciale au logement · Ontario",
  "Subsidized housing (RGI)": "Logement subventionné (LIR)",
  "See whether you qualify for rent-geared-to-income housing, where you'd sit in the selection order, and what to prepare.":
    "Vérifiez si vous êtes admissible à un logement à loyer indexé sur le revenu, votre place dans l'ordre de sélection et ce qu'il faut préparer.",
  "Check eligibility": "Vérifier l'admissibilité",

  // Intake
  "Who would live with you?": "Qui habiterait avec vous?",
  "Unit size and income limits depend on your household.": "La taille du logement et les plafonds de revenu dépendent de votre ménage.",
  "Where are you applying?": "Où présentez-vous votre demande?",
  "City of Ottawa": "Ville d'Ottawa",
  "Elsewhere in Ontario": "Ailleurs en Ontario",
  "Your age": "Votre âge",
  "Do you have a spouse or partner who would live with you?": "Avez-vous un époux ou un partenaire qui habiterait avec vous?",
  "Children in the household": "Enfants dans le ménage",
  "Other adults (not your spouse)": "Autres adultes (autres que votre conjoint)",
  "Income & status": "Revenu et statut",
  "Income, assets and status": "Revenu, biens et statut",
  "Use your household's combined figures from your latest tax returns.": "Utilisez les montants combinés de votre ménage tirés de vos dernières déclarations de revenus.",
  "Combined household income (before tax)": "Revenu combiné du ménage (avant impôt)",
  "From each member's Notice of Assessment.": "Selon l'avis de cotisation de chaque membre.",
  "Household assets": "Biens du ménage",
  "Cash, bank accounts, investments and property. Don't include a vehicle, RRSPs, RESPs or RDSPs.":
    "Argent comptant, comptes bancaires, placements et biens immobiliers. N'incluez pas de véhicule, de REER, de REEE ni de REEI.",
  "Current monthly rent": "Loyer mensuel actuel",
  "Leave blank if you don't pay rent.": "Laissez vide si vous ne payez pas de loyer.",
  "Status in Canada": "Statut au Canada",
  "Canadian citizen": "Citoyen canadien",
  "Permanent resident": "Résident permanent",
  "Convention refugee": "Réfugié au sens de la Convention",
  "Refugee claimant": "Demandeur d'asile",
  "Other (e.g. visitor, student or work permit)": "Autre (p. ex. visiteur, permis d'études ou de travail)",
  "Do you owe money to a social housing provider in Ontario?": "Devez-vous de l'argent à un fournisseur de logements sociaux en Ontario?",
  "Yes, with a repayment agreement": "Oui, avec une entente de remboursement",
  "Yes, no agreement": "Oui, sans entente",
  "Does anyone in the household own a home?": "Un membre du ménage est-il propriétaire d'une maison?",
  "Priority & needs": "Priorité et besoins",
  "Safety, health and housing situation": "Sécurité, santé et situation de logement",
  "These determine your place in the selection order. Answer only what applies.":
    "Ces réponses déterminent votre place dans l'ordre de sélection. Répondez seulement à ce qui s'applique.",
  "Do any of these apply?": "L'une de ces situations s'applique-t-elle?",
  "Leaving abuse or human trafficking": "Je fuis la violence ou la traite de personnes",
  "Facing an ongoing, extraordinary threat to safety": "Je fais face à une menace extraordinaire et continue pour ma sécurité",
  "Local priority: urgent safety": "Priorité locale : sécurité urgente",
  "Life-threatening condition made worse by my housing": "Problème de santé mettant ma vie en danger, aggravé par mon logement",
  "Local priority: medical": "Priorité locale : raison médicale",
  "Living in a shelter or without a home": "Je vis dans un refuge ou je n'ai pas de logement",
  "Local priority: homeless": "Priorité locale : itinérance",
  "I live in an RGI unit bigger than I need": "J'habite un logement LIR plus grand que nécessaire",
  "Provincial over-housed priority": "Priorité provinciale pour logement surdimensionné",
  "Can you live independently, arranging any support you need?": "Pouvez-vous vivre de façon autonome en organisant le soutien dont vous avez besoin?",
  "Does anyone need an accessible unit?": "Un membre du ménage a-t-il besoin d'un logement accessible?",

  // Result
  "You appear eligible for rent-geared-to-income housing": "Vous semblez admissible à un logement à loyer indexé sur le revenu",
  "You may be eligible; some answers need review": "Vous pourriez être admissible; certaines réponses doivent être examinées",
  "You don't appear eligible for RGI assistance": "Vous ne semblez pas admissible à l'aide LIR",
  "We don't have income limits for your area yet": "Nous n'avons pas encore les plafonds de revenu de votre région",
  "Apply through The Social Housing Registry of Ottawa; CivicOS tracks your documents and progress.":
    "Présentez votre demande au Registre des logements sociaux d'Ottawa; CivicOS suit vos documents et votre progression.",
  "See the reasons below and other options that may fit.": "Consultez les raisons ci-dessous et les autres options qui pourraient vous convenir.",
  "Contact your local housing service manager.": "Communiquez avec le gestionnaire des services de logement de votre région.",
  "Income {income} of {limit} limit": "Revenu de {income} sur un plafond de {limit}",
  "{amount} household income": "{amount} de revenu du ménage",
  "Limit {amount}": "Plafond {amount}",
  "Household size": "Taille du ménage",
  "Largest eligible unit": "Plus grand logement admissible",
  "{count} bedroom": "{count} chambre(s)",
  "Estimated RGI rent": "Loyer LIR estimé",
  "/month (30% of income)": "/mois (30 % du revenu)",
  "Selection priority": "Priorité de sélection",
  "Rank {rank} of 4": "Rang {rank} sur 4",
  "{percent}% of income today": "{percent} % du revenu actuellement",
  "Eligibility checks": "Critères d'admissibilité",
  passed: "réussi",
  failed: "échoué",
  "needs review": "à examiner",
  "Other options": "Autres options",
  "Your eligibility result": "Votre résultat d'admissibilité",
  "Edit answers": "Modifier les réponses",
  "Track my application": "Suivre ma demande",
  "Your application": "Votre demande",
  "Withdraw this application and start a new assessment?": "Retirer cette demande et commencer une nouvelle évaluation?",
  "Start over": "Recommencer",
  "Waiting on documents": "En attente de documents",
  "Check them off below as you gather them.": "Cochez-les ci-dessous au fur et à mesure que vous les rassemblez.",

  // Documents
  "Document checklist": "Liste des documents",
  "{done}/{total} ready": "{done}/{total} prêts",
  "if applicable": "s'il y a lieu",
  "Keep documents ready: when you're offered a unit you'll need to provide them quickly, and you're guaranteed one offer.":
    "Gardez vos documents à portée de main : lorsqu'un logement vous sera offert, vous devrez les fournir rapidement, et une seule offre vous est garantie.",
  "Proof of status in Canada": "Preuve de statut au Canada",
  "For every household member: birth certificate, citizenship card, PR card or refugee documents.":
    "Pour chaque membre du ménage : certificat de naissance, carte de citoyenneté, carte de RP ou documents de réfugié.",
  "Proof of income": "Preuve de revenu",
  "Latest Notice of Assessment or Proof of Income Statement for each member with income.":
    "Dernier avis de cotisation ou état de la preuve de revenu pour chaque membre ayant un revenu.",
  "Proof of assets": "Preuve des biens",
  "Bank, investment and property statements. Needed for every member when you accept an offer.":
    "Relevés bancaires, de placements et de biens. Requis pour chaque membre lorsque vous acceptez une offre.",
  "Photo identification": "Pièce d'identité avec photo",
  "Government-issued photo ID for adults in the household.": "Pièce d'identité avec photo délivrée par un gouvernement pour les adultes du ménage.",
  "Special Priority verification": "Vérification de la priorité spéciale",
  "Confirmation of abuse or trafficking from a professional such as a shelter worker, police or health provider.":
    "Confirmation de la violence ou de la traite par une personne professionnelle, comme une intervenante de refuge, la police ou un fournisseur de soins de santé.",
  "Medical documentation": "Documents médicaux",
  "A health professional's letter describing the condition and how housing affects it.":
    "Une lettre d'une personne professionnelle de la santé décrivant le problème et l'effet du logement sur celui-ci.",
  "Shelter or outreach confirmation": "Confirmation d'un refuge ou d'un service d'approche",
  "A letter from an emergency shelter or outreach worker.": "Une lettre d'un refuge d'urgence ou d'une intervenante de rue.",
  "Property ownership details": "Renseignements sur la propriété",
  "Property must be sold within {days} days of being housed.": "La propriété doit être vendue dans les {days} jours suivant l'attribution d'un logement.",

  // Registry card
  "Where to apply": "Où présenter une demande",
  "The Social Housing Registry of Ottawa": "Le Registre des logements sociaux d'Ottawa",
  "manages Ottawa's centralized waiting list. The only way to receive RGI assistance is to apply with them.":
    "gère la liste d'attente centralisée d'Ottawa. La seule façon de recevoir de l'aide LIR est de présenter une demande auprès de ce registre.",
  "Income limits effective {date}. Keep in touch with the Registry at least once a year or your application may be cancelled.":
    "Plafonds de revenu en vigueur depuis {date}. Communiquez avec le Registre au moins une fois par année, sinon votre demande pourrait être annulée.",
  "January 2026": "janvier 2026",

  // Priority and affordability
  "Special Provincial Priority": "Priorité provinciale spéciale",
  "Survivors of abuse or human trafficking are offered housing first.": "Les survivants de violence ou de traite de personnes se voient offrir un logement en premier.",
  "Current RGI tenants in a unit larger than they need move to a right-sized unit next.":
    "Les locataires LIR occupant un logement plus grand que nécessaire obtiennent ensuite un logement de taille appropriée.",
  "Current abuse or extraordinary ongoing threats to safety.": "Violence actuelle ou menaces extraordinaires et continues pour la sécurité.",
  "Local priority: life-threatening medical": "Priorité locale : problème médical mettant la vie en danger",
  "A terminal illness or life-threatening condition made worse by current housing.":
    "Une maladie en phase terminale ou un problème de santé mettant la vie en danger, aggravé par le logement actuel.",
  "Living in an emergency shelter or sleeping rough.": "Vivre dans un refuge d'urgence ou dormir à la rue.",
  Chronological: "Chronologique",
  "Offers are made in order of application date.": "Les offres sont faites selon la date de la demande.",
  "Not renting or rent not provided": "Pas locataire ou loyer non indiqué",
  "Severe affordability pressure (50%+ of income on rent)": "Grave problème d'abordabilité (50 % ou plus du revenu consacré au loyer)",
  "Unaffordable housing (30%+ of income on rent)": "Logement inabordable (30 % ou plus du revenu consacré au loyer)",
  "Rent is under 30% of income": "Le loyer représente moins de 30 % du revenu",

  // Checks
  "Service area": "Zone de service",
  "CivicOS has Ottawa's income limits. Contact your local service manager for other areas.":
    "CivicOS dispose des plafonds de revenu d'Ottawa. Pour les autres régions, communiquez avec votre gestionnaire de services local.",
  "Find your local housing service manager through 2-1-1 Ontario.": "Trouvez le gestionnaire des services de logement de votre région par l'entremise de 211 Ontario.",
  Age: "Âge",
  "At least one household member must be {age} or older.": "Au moins un membre du ménage doit avoir {age} ans ou plus.",
  "Canadian citizens, permanent residents, refugees and refugee claimants can apply.":
    "Les citoyens canadiens, les résidents permanents, les réfugiés et les demandeurs d'asile peuvent présenter une demande.",
  "Household income ({bedrooms}-bedroom limit)": "Revenu du ménage (plafond pour {bedrooms} chambre(s))",
  "{income} is under the {limit} limit.": "{income} est sous le plafond de {limit}.",
  "{income} is at or over the {limit} limit.": "{income} atteint ou dépasse le plafond de {limit}.",
  Assets: "Biens",
  "Limit is {amount} for a single person. RRSPs, RESPs, RDSPs and a vehicle don't count.":
    "Le plafond est de {amount} pour une personne seule. Les REER, REEE, REEI et un véhicule ne sont pas comptés.",
  "Limit is {amount} for households of two or more. RRSPs, RESPs, RDSPs and a vehicle don't count.":
    "Le plafond est de {amount} pour les ménages de deux personnes ou plus. Les REER, REEE, REEI et un véhicule ne sont pas comptés.",
  "Social housing arrears": "Arriérés de logement social",
  "You have a repayment agreement, which keeps you eligible.": "Vous avez une entente de remboursement, ce qui maintient votre admissibilité.",
  "Arrears owed to an Ontario social housing provider must be repaid or under an agreement.":
    "Les arriérés dus à un fournisseur de logements sociaux de l'Ontario doivent être remboursés ou faire l'objet d'une entente.",
  "No arrears owed to Ontario social housing providers.": "Aucun arriéré dû à des fournisseurs de logements sociaux de l'Ontario.",
  "Independent living": "Vie autonome",
  "You must be able to live independently, arranging any support services you need.":
    "Vous devez pouvoir vivre de façon autonome en organisant les services de soutien dont vous avez besoin.",
  "Residential property": "Propriété résidentielle",
  "Owners can apply but must sell within {days} days of being housed.":
    "Les propriétaires peuvent présenter une demande, mais doivent vendre dans les {days} jours suivant l'attribution d'un logement.",
  "Affordable (below-market) rental programs have higher income limits than RGI.":
    "Les programmes de logements abordables (sous le prix du marché) ont des plafonds de revenu plus élevés que le LIR.",
  "Canada-Ontario Housing Benefit (COHB): a portable monthly benefit that may be offered to people on the waiting list.":
    "Allocation Canada-Ontario pour le logement (ACOL) : une prestation mensuelle transférable qui peut être offerte aux personnes inscrites sur la liste d'attente.",
  "For help with rent arrears or emergency shelter today, call 2-1-1.": "Pour obtenir de l'aide avec des arriérés de loyer ou un refuge d'urgence aujourd'hui, composez le 2-1-1.",
};

export default housing;
