import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Auth0Provider } from "@auth0/auth0-react";
import App from "./App";
import { auth0ClientId, auth0Configured, auth0Domain, auth0ReturnTo, clearAuth0Callback } from "./lib/auth0";
import "./styles/index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {auth0Configured ? (
      <Auth0Provider
        domain={auth0Domain}
        clientId={auth0ClientId}
        authorizationParams={{ redirect_uri: auth0ReturnTo, scope: "openid profile email" }}
        cacheLocation="localstorage"
        useRefreshTokens
        onRedirectCallback={clearAuth0Callback}
      >
        <App />
      </Auth0Provider>
    ) : <App />}
  </StrictMode>,
);
