/**
 * Third-party feed titles such as "Incident: Merivale N/B at Burris" pair a
 * label we generate with free text from the source. Translate only the label.
 */
const FEED_PREFIXES = ["Incident", "Construction", "Event closure", "Road condition", "Special event"];

export function localizeFeedTitle(title: string, t: (text: string) => string): { text: string; sourceOnly: boolean } {
  const separator = title.indexOf(": ");
  if (separator > 0) {
    const prefix = title.slice(0, separator);
    if (FEED_PREFIXES.includes(prefix)) return { text: `${t(prefix)}: ${title.slice(separator + 2)}`, sourceOnly: false };
  }
  return { text: title, sourceOnly: true };
}
