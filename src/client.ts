import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { withDurableExecution } from "@aws/durable-execution-sdk-js";
import {
  DurableOperation,
  LocalDurableTestRunner,
  WaitingOperationStatus,
} from "@aws/durable-execution-sdk-js-testing";
import { events, EventsChannel } from "aws-amplify/data";
import { randomUUID } from "crypto";
import { actionKey, CALLBACK_EVENTS } from "./constants";
import {
  CallbackEventResultMap,
  Handler,
  ResolverMap,
  TimeoutConfig,
} from "./types";
import {
  formatCallbackId,
  setCallbackTimeout,
  setupAppSyncEvents,
} from "./util";

setupAppSyncEvents();

export const withDurableDevExecution = async (handler: Handler) => {
  await LocalDurableTestRunner.setupTestEnvironment();
  const channelId = randomUUID();
  const eventsInstance = new CallbackEventsManager();
  const unsubscrbeToEvents = await eventsInstance.listen(channelId);
  console.log("Subscribed to callback events.");

  let callbackIndex = 0;

  type CreateCallbackConfig = {
    timeout?: TimeoutConfig;
  };

  const runner = new LocalDurableTestRunner({
    handlerFunction: withDurableExecution(async (event, context: any) => {
      const originalCreateCallback = context.createCallback;

      context.createCallback = async (...args: any[]) => {
        console.log("#".repeat(100));
        const [originalPromise, clientCallbackId] =
          await originalCreateCallback.apply(context, args);

        let config: CreateCallbackConfig = {};

        if (args.length > 1) {
          config = args[1];
        } else {
          config = args[0] || {};
        }

        const proxyCallbackRequest = new ProxyCallbackRequest(
          clientCallbackId,
          channelId,
          config.timeout,
        );

        if (proxyCallbackRequest.savedCallbackId) {
          return [originalPromise, proxyCallbackRequest.savedCallbackId!];
        }

        console.log(
          `Created client callback with ID: ${formatCallbackId(clientCallbackId, 15)}`,
          "ARGS",
          args,
        );

        const operation = await findCurrentCallbackOperation();
        if (!operation) {
          throw new Error("Operation not found for callback creation");
        }

        const serverCallbackId = await proxyCallbackRequest.send();
        const callbackName = typeof args[0] === "string" ? args[0] : "unknown";

        proxyCallbackRequest
          .result!.then((data) => {
            operation.sendCallbackSuccess(data);
          })
          .catch((error) => {
            operation.sendCallbackFailure(error);
          });
        console.log("#".repeat(100));

        return [originalPromise, serverCallbackId];
      };

      context.runInChildContext = (...args: any) => {
        throw new Error("Not supported");
      };

      context.parallel = (...args: any) => {
        throw new Error("Not supported");
      };

      context.waitForCallback = (...args: any) => {
        throw new Error("Not supported");
      };
      return handler(event, context);

      async function findCurrentCallbackOperation() {
        let operation: DurableOperation | null = null;
        while (true) {
          operation = runner.getOperationByIndex(callbackIndex++);
          await operation.waitForData(WaitingOperationStatus.STARTED);

          if (operation.isCallback()) {
            break;
          }
        }

        return operation;
      }
    }),
  });

  const run = async (event?: any) => {
    try {
      const execution = runner.run({ payload: event });
      const executionResult = await execution;
      const result = await executionResult.getResult();

      console.log("Local execution completed with result:", result);
    } catch (error) {
      console.error("Execution error:", error);
    } finally {
      unsubscrbeToEvents();
      await LocalDurableTestRunner.teardownTestEnvironment();
      process.exit(1);
    }
  };

  if (process.argv[2] === "--run") {
    await run();
    process.exit(0);
  }

  return run;
};

class CallbackEventsManager {
  private callbackResolvers: ResolverMap = new Map();
  private callbackDataResolvers: ResolverMap = new Map();
  channel!: EventsChannel;
  static instance: CallbackEventsManager;

  constructor() {
    if (CallbackEventsManager.instance) {
      return CallbackEventsManager.instance;
    }

    CallbackEventsManager.instance = this;
  }

  async listen(channelId: string) {
    console.log(
      `Connecting to AppSync events with channel ID: ${channelId}...`,
    );
    this.channel = await events.connect(`/default/${channelId}/server`);

    this.channel.subscribe({
      next: async (appSyncEvent) => {
        console.log("Received AppSync event:", appSyncEvent);
        const { eventType, data } = appSyncEvent.event;

        try {
          const isKnownEvent = eventType in CALLBACK_EVENTS;
          if (!isKnownEvent) {
            console.warn(`Unknown event type received: ${eventType}`);
            return;
          }

          this.resolveCallbackByKey(data.key, eventType, data);
        } catch (error) {
          console.error("Error processing AppSync event:", error);
        }
      },
      error: (error) => {
        console.error("AppSync subscription error:", error);
      },
    });

    return () => {
      console.log("Closing AppSync event channel...");
      return this.channel.close();
    };
  }

  resolveCallbackByKey(
    key: string,
    event: keyof typeof CALLBACK_EVENTS,
    data: any,
  ) {
    const resolverMap = this.getResolverByEvent(event);
    const resolver = resolverMap.get(key);

    if (!resolver) {
      console.warn(
        `No resolver found for key: ${formatCallbackId(key)} on event: ${event}`,
      );
      return;
    }
    resolver.result = data;
    resolver.resolve(data);
    resolver.finally?.();
  }

  waitForCallbackEvent<EventKey extends keyof typeof CALLBACK_EVENTS>(
    key: string,
    event: EventKey,
    cache = true,
  ) {
    const { promise, resolve, reject } =
      Promise.withResolvers<CallbackEventResultMap[EventKey]>();

    const resolverMap = this.getResolverByEvent(event);
    resolverMap.set(key, {
      resolve,
      reject,
      finally: () => {
        if (!cache) {
          resolverMap.delete(key);
        }

        clearTimeout(timeout);
      },
    });

    const timeout = setCallbackTimeout(reject, key, resolverMap);

    return promise;
  }

  getSavedCallbackEvent<EventKey extends keyof typeof CALLBACK_EVENTS>(
    clientCallbackId: string,
    event: EventKey,
  ) {
    const resolverMap = this.getResolverByEvent(event);
    return resolverMap.get(clientCallbackId)?.result as
      | CallbackEventResultMap[EventKey]
      | undefined;
  }

  private getResolverByEvent(event: keyof typeof CALLBACK_EVENTS) {
    switch (event) {
      case "REQUESTED_CALLBACK_ID":
        return this.callbackDataResolvers;
      case "CALLBACK_DATA":
        return this.callbackResolvers;
      default:
        throw new Error("Unknown event type");
    }
  }
}
const lambdaClient = new LambdaClient();
class ProxyCallbackRequest {
  finished!: Promise<boolean>;
  savedCallbackId?: string;
  result?: Promise<any>;

  constructor(
    public clientCallbackId: string,
    private channelId: string,
    public timeout?: TimeoutConfig,
  ) {
    const savedCallbackIdResponse =
      CallbackEventsManager.instance.getSavedCallbackEvent(
        clientCallbackId,
        "REQUESTED_CALLBACK_ID",
      );

    if (savedCallbackIdResponse) {
      this.savedCallbackId = savedCallbackIdResponse.callbackId;
    }
  }

  async send() {
    try {
      const callbackIdPromise =
        CallbackEventsManager.instance.waitForCallbackEvent(
          this.clientCallbackId,
          "REQUESTED_CALLBACK_ID",
        );

      this.result = CallbackEventsManager.instance
        .waitForCallbackEvent(this.clientCallbackId, "CALLBACK_DATA", false)
        .then((data) => {
          if ("error" in data) {
            throw data.error;
          }

          return data?.result;
        })
        .catch((error) => {
          throw {
            ErrorMessage:
              error?.ErrorMessage || error?.message || "Unknown error",
            ErrorType: error?.ErrorType || "FAILURE",
            ErrorData: error?.ErrorData,
          };
        });

      const DURABLE_PROXY_FUNCTION_ARN = process.env.DURABLE_PROXY_FUNCTION_ARN;

      if (!DURABLE_PROXY_FUNCTION_ARN) {
        throw new Error(
          "DURABLE_PROXY_FUNCTION_ARN is not defined in environment variables",
        );
      }

      const command = new InvokeCommand({
        FunctionName: `${DURABLE_PROXY_FUNCTION_ARN}:$LATEST`,
        InvocationType: "Event",
        Payload: JSON.stringify({
          [actionKey]: {
            channelId: this.channelId,
            clientCallbackId: this.clientCallbackId,
            timeout: this.timeout,
            action: "requestCallback",
          },
        }),
      });

      await lambdaClient.send(command);
      return callbackIdPromise.then((data) => data.callbackId);
    } catch (error) {
      console.error("Error sending callback request:", error);
      throw error;
    }
  }
}
