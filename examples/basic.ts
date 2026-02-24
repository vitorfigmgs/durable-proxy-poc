import { DurableContext } from "@aws/durable-execution-sdk-js";
import { withDurableDevExecution } from "../src/client";

export const handler = withDurableDevExecution(
  async (event: any, context: DurableContext) => {
    const [callbackPromise, callbackID] = await context.createCallback(
      "callback1",
      {
        timeout: {
          minutes: 5,
        },
      },
    );

    await context.step("hello", async (ctx) => {
      ctx.logger.info("Executing step 'hello'");
      return "Hello, World!";
    });
    const callbackData = await callbackPromise;

    return JSON.parse(callbackData);
  },
);
