import {
  withDurableExecution,
  DurableContext,
  DurableLogger,
  ChildContextError,
} from "@aws/durable-execution-sdk-js";
import { Amplify } from "aws-amplify";
import { events } from "aws-amplify/data";
import { actionKey, CALLBACK_EVENTS } from "./constants";
import { setupAppSyncEvents } from "./util";

// Configure Amplify for the proxy
setupAppSyncEvents();

export const handler = withDurableExecution(
  async (event: any, context: DurableContext) => {
    const logger = context.logger;
    const actionPayload = event?.[actionKey];
    const hasActionKey = actionKey in event;

    logger.info(
      "Proxy handler started with event:",
      JSON.stringify(event, null, 2),
    );

    if (!hasActionKey) {
      logger.info("This will be used to trigger the local lambda");
      return;
    }

    const channelId = event?.[actionKey]?.channelId;

    if (!channelId) {
      logger.warn(
        "Channel ID is missing in the event. Cannot process callback request.",
      );
      return;
    }

    if (actionPayload.action != "requestCallback") {
      logger.warn(`Unknown action: ${actionPayload.action}`);
      return;
    }

    const timeout = actionPayload?.timeout || { minutes: 5 };
    const clientCallbackId = actionPayload?.clientCallbackId || "unknown";

    const callbackResult = await context
      .waitForCallback(
        `callback`,
        async (callbackId) => {
          await publishEvent(
            CALLBACK_EVENTS.REQUESTED_CALLBACK_ID,
            {
              callbackId: callbackId,
              key: clientCallbackId,
              message: "Request callback ready",
            },
            channelId,
            logger,
          );
        },
        {
          timeout,
        },
      )
      .then((data) => ({
        result: data,
      }))
      .catch((error: ChildContextError & { errorMessage?: string }) => {
        logger.error("Error waiting for callback:", error);
        return {
          error: {
            ErrorMessage:
              error.errorMessage || error.message || "Unknown error",
            ErrorType: error.errorType || error.name || "Error",
            ErrorData: error.errorData || null,
          },
        };
      });

    await context.step("callback-data", async () => {
      // IDEIA: Avoid sending timeout errors since the client already times outs.
      await publishEvent(
        CALLBACK_EVENTS.CALLBACK_DATA,
        {
          key: clientCallbackId,
          ...callbackResult,
        },
        channelId,
        logger,
      );
    });

    return {
      statusCode: 200,
    };
  },
);

interface EventData {
  [key: string]: any;
}

const publishEvent = async (
  eventType: string,
  data: EventData,
  channelId: string,
  logger: DurableLogger,
): Promise<void> => {
  try {
    await events.post(`/default/${channelId}/server`, {
      eventType,
      data,
      timestamp: new Date().toISOString(),
      source: "durable-execution-proxy",
    });
    logger.info(`Published event: ${eventType}`, data);
  } catch (error) {
    logger.error(`Failed to publish event ${eventType}:`, error);
  }
};
