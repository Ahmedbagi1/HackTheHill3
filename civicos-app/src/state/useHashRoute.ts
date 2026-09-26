import { useCallback, useSyncExternalStore } from "react";

export type ModuleRoute = "housing" | "doctor" | "autism";
export type Route = "dashboard" | "services" | ModuleRoute;

const ROUTES: Route[] = ["dashboard", "services", "housing", "doctor", "autism"];

const parse = (hash: string): Route => {
  const name = hash.replace(/^#\/?/, "").split("?")[0];
  return (ROUTES as string[]).includes(name) ? (name as Route) : "dashboard";
};

const subscribe = (onChange: () => void) => {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
};

/** Minimal hash router so pages are linkable and the back button works. */
export function useHashRoute(): [Route, (route: Route) => void] {
  const route = useSyncExternalStore(subscribe, () => parse(window.location.hash), () => "dashboard" as Route);
  const navigate = useCallback((next: Route) => {
    const hash = next === "dashboard" ? "/" : `/${next}`;
    if (window.location.hash.replace(/^#/, "") !== hash) {
      window.location.hash = hash;
      window.scrollTo({ top: 0 });
    }
  }, []);
  return [route, navigate];
}
