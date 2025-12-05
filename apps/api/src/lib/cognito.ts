import {
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient
} from "@aws-sdk/client-cognito-identity-provider";
import { env } from "config";

const client = new CognitoIdentityProviderClient({
  region: env.COGNITO_REGION
});

export async function updateCognitoDisplayName(params: {
  cognitoSub: string;
  displayName: string;
}) {
  const trimmed = params.displayName.trim();

  if (!trimmed) {
    throw new Error("Display name cannot be empty");
  }

  const command = new AdminUpdateUserAttributesCommand({
    UserPoolId: env.COGNITO_USER_POOL_ID,
    Username: params.cognitoSub,
    UserAttributes: [
      {
        Name: "nickname",
        Value: trimmed
      },
      {
        Name: "preferred_username",
        Value: trimmed
      }
    ]
  });

  await client.send(command);
}


