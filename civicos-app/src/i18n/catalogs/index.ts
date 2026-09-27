import type { Locale } from "../locales";
import type { Catalog } from "../translator";

/** Catalogs load on demand so English visitors don't download them. */
export async function loadCatalog(locale: Locale): Promise<Catalog> {
  switch (locale) {
    case "fr":
      return (await import("./fr")).default;
    case "iu":
      return (await import("./iu")).default;
    case "oj":
      return (await import("./oj")).default;
    default:
      return {};
  }
}
