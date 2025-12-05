const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID as string;
const userPoolClientId = import.meta.env.VITE_COGNITO_CLIENT_ID as string;
const region = import.meta.env.VITE_COGNITO_REGION as string;
const redirectSignIn = import.meta.env.VITE_COGNITO_REDIRECT_SIGNIN as string;
const redirectSignOut = import.meta.env.VITE_COGNITO_REDIRECT_SIGNOUT as string;
const rawDomain = (import.meta.env.VITE_COGNITO_DOMAIN as string) ?? "";

const normalizeDomain = (domain: string) =>
  domain.replace(/^https?:\/\//, "").replace(/\/$/, "");

export const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId,
      userPoolClientId,
      region,
      loginWith: {
        oauth: {
          domain: normalizeDomain(rawDomain),
          scopes: ["email", "openid", "profile", "aws.cognito.signin.user.admin"],
          redirectSignIn: [redirectSignIn],
          redirectSignOut: [redirectSignOut],
          responseType: "code" as const
        }
      }
    }
  }
};

