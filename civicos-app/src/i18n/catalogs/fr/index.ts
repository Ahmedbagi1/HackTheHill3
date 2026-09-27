import type { Catalog } from "../../translator";
import assistant from "./assistant";
import autism from "./autism";
import data from "./data";
import doctor from "./doctor";
import housing from "./housing";
import intake from "./intake";
import life from "./life";
import places from "./places";
import servicesFederal from "./servicesFederal";
import servicesMunicipal from "./servicesMunicipal";
import servicesProvincial from "./servicesProvincial";
import ui from "./ui";

/**
 * Complete French catalog, keyed by English source text. Later spreads win
 * when two files share a key, so interface copy (ui) has the final say.
 */
const fr: Catalog = {
  ...life,
  ...places,
  ...servicesFederal,
  ...servicesProvincial,
  ...servicesMunicipal,
  ...data,
  ...housing,
  ...doctor,
  ...autism,
  ...intake,
  ...assistant,
  ...ui,
};

export default fr;
