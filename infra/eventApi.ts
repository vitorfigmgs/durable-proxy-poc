export const eventApi = new aws.appsync.Api("eventApi", {
  eventConfig: {
    authProviders: [{ authType: "API_KEY" }],
    connectionAuthModes: [
      {
        authType: "API_KEY",
      },
    ],
    defaultPublishAuthModes: [
      {
        authType: "API_KEY",
      },
    ],
    defaultSubscribeAuthModes: [
      {
        authType: "API_KEY",
      },
    ],
  },
});

export const defaultNamespace = new aws.appsync.ChannelNamespace(
  "defaultNamespace",
  {
    apiId: eventApi.id,
    name: "default",
  },
);

export const eventHttpUrl = eventApi.dns.apply((dns) => dns["HTTP"]);

export const apiKey = new aws.appsync.ApiKey("apiKey", {
  apiId: eventApi.id,
});

export const eventEnvVariables = {
  APP_SYNC_API_URL: eventHttpUrl.apply((url) => `https://${url}/event`),
  APP_SYNC_API_KEY: apiKey.apiKeyId,
  APP_SYNC_API_REGION: aws.config.region!,
};
