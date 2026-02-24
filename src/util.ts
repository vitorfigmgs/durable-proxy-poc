import { Amplify } from "aws-amplify";
import { ResolverMap, TimeoutConfig } from "./types";

export const formatCallbackId = (id?: string, length: number = 8): string => {
  if (!id) return "undefined";
  return id.slice(0, length) + "..." + id.slice(-length);
};

export const getColoredLogMessage = (
  message: string,
  color: "red" | "green" | "yellow",
) => {
  const colorCodes: Record<string, string> = {
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
  };
  const resetCode = "\x1b[0m";
  return `${colorCodes[color] || ""}${message}${resetCode}`;
};

export const callbackTimeToMs = (timeout?: TimeoutConfig) => {
  let timeoutMs = 60 * 60 * 1000; // Default to 1 hour
  if (timeout?.hours) {
    timeoutMs = timeout.hours * 60 * 60 * 1000;
  }

  if (timeout?.minutes) {
    timeoutMs = timeout.minutes * 60 * 1000;
  }

  if (timeout?.seconds) {
    timeoutMs = timeout.seconds * 1000;
  }

  return timeoutMs;
};

export const setCallbackTimeout = (
  reject: (reason?: any) => void,
  clientCallbackId: string,
  callbackResolvers: ResolverMap,
  timeout?: TimeoutConfig,
) => {
  const timeoutMs = callbackTimeToMs(timeout);
  const TIMEOUT_DELAY = 500; /// Add a small additional delay so the client timeout does not conflict with the server timeout.

  return setTimeout(() => {
    if (callbackResolvers.has(clientCallbackId)) {
      callbackResolvers.delete(clientCallbackId);
      reject(new Error(`Callback timed out for ${clientCallbackId}`));
    }
  }, timeoutMs + TIMEOUT_DELAY);
};

export const setupAppSyncEvents = (
  endpoint: string = process.env.APP_SYNC_API_URL!,
  region: string = process.env.APP_SYNC_API_REGION!,
  apiKey: string = process.env.APP_SYNC_API_KEY!,
) => {
  Amplify.configure({
    API: {
      Events: {
        endpoint,
        region,
        defaultAuthMode: "apiKey",
        apiKey,
      },
    },
  });
};
