/** Floating intake assistant (Gemini) and voice playback messages. */
const assistant: Record<string, string> = {
  // Voice playback
  "The ElevenLabs audio couldn't be played. Using the browser voice instead.":
    "L'audio d'ElevenLabs n'a pas pu être lu. La voix du navigateur est utilisée à la place.",
  "Your browser paused the audio. Press play to start it.": "Votre navigateur a mis l'audio en pause. Appuyez sur lecture pour le démarrer.",
  "The voice service returned no audio.": "Le service vocal n'a renvoyé aucun audio.",

  // Wizard started from the assistant
  "We've started this form from your conversation with the assistant. Review it before continuing.":
    "Nous avons commencé ce formulaire à partir de votre conversation avec l'assistant. Vérifiez-le avant de continuer.",

  // Programs offered by the assistant
  "Rent-geared-to-income housing: eligibility, priority status and application tracking with The Social Housing Registry of Ottawa.":
    "Logement à loyer indexé sur le revenu : admissibilité, statut prioritaire et suivi de la demande auprès du Registre des logements sociaux d'Ottawa.",
  "can't afford rent": "loyer inabordable",
  "Match with family doctors and nurse practitioners accepting patients, and register with Health Care Connect.":
    "Trouvez des médecins de famille et des infirmières praticiennes qui acceptent des patients, et inscrivez-vous à Accès Soins.",
  "Autism support (Ontario Autism Program)": "Soutien en autisme (Programme ontarien des services en matière d'autisme)",
  "Ontario Autism Program pathways, funding and therapies for children and youth under 18.":
    "Parcours, financement et thérapies du Programme ontarien des services en matière d'autisme pour les enfants et les jeunes de moins de 18 ans.",

  // Chat panel
  "Ask CivicOS": "Demandez à CivicOS",
  "Keyword matching (AI unavailable)": "Recherche par mots-clés (IA non disponible)",
  "Describe what happened. We'll find the right service.": "Décrivez ce qui s'est passé. Nous trouverons le bon service.",
  "Start a new conversation": "Commencer une nouvelle conversation",
  "Minimize assistant": "Réduire l'assistant",
  "Tell me what's going on in your own words. I'll point you to federal, provincial or City of Ottawa services and open the right application.":
    "Expliquez-moi la situation dans vos propres mots. Je vous orienterai vers les services fédéraux, provinciaux ou de la Ville d'Ottawa et j'ouvrirai la bonne demande.",
  "Try one of these": "Essayez l'un de ces exemples",
  "My landlord won't fix the heating and shut off the water.": "Mon locateur refuse de réparer le chauffage et a coupé l'eau.",
  "I want to build a deck in my backyard.": "Je veux construire une terrasse dans ma cour arrière.",
  "I lost my job and my household income is low.": "J'ai perdu mon emploi et le revenu de mon ménage est faible.",
  "Urgent: if anyone is in danger, call 9-1-1 now.": "Urgent : si quelqu'un est en danger, composez le 9-1-1 maintenant.",
  "High priority: act soon to protect your income, housing or documents.":
    "Priorité élevée : agissez rapidement pour protéger votre revenu, votre logement ou vos documents.",
  "Your next steps": "Vos prochaines étapes",
  Start: "Commencer",
  "Recommended for you": "Recommandé pour vous",
  "No matching service found. Try describing it differently, or browse all services.":
    "Aucun service correspondant. Essayez de le décrire autrement ou parcourez tous les services.",
  "AI assistance is unavailable here, so these matches come from keywords in your message.":
    "L'assistance par IA n'est pas disponible ici; ces résultats proviennent donc des mots-clés de votre message.",
  "Something went wrong. Please try again.": "Un problème est survenu. Veuillez réessayer.",
  "CivicOS is thinking": "CivicOS réfléchit",
  "Describe your situation": "Décrivez votre situation",
  "e.g. My landlord won't fix the heat": "p. ex. Mon locateur refuse de réparer le chauffage",
  Send: "Envoyer",
  "Messages are sent to Google Gemini. Don't include ID numbers. AI can make mistakes: check the official site before you apply.":
    "Les messages sont envoyés à Google Gemini. N'incluez aucun numéro d'identification. L'IA peut se tromper : consultez le site officiel avant de présenter une demande.",
  "Government services": "Services gouvernementaux",
};

export default assistant;
