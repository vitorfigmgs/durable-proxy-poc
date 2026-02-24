import { DurableContext } from "@aws/durable-execution-sdk-js";
import { withDurableDevExecution } from "../src/client";

export const handler = withDurableDevExecution(
  async (event: any, context: DurableContext) => {
    const logger = context.logger;

    const [callbackPromise, callbackID] = await context.createCallback(
      "callback1",
      {
        timeout: {
          hours: 1,
        },
      },
    );

    const [callback2Promise, callback2ID] = await context.createCallback(
      "callback2",
      {
        timeout: {
          minutes: 5,
        },
      },
    );

    const data = await context.step("hello", async (ctx) => {
      ctx.logger.info("Executing step 'hello'");
      return "Hello, World!";
    });
    await Promise.all([callbackPromise, callback2Promise]);

    const data1 = await context.step("hello 1", async (ctx) => {
      ctx.logger.info("Executing step 'hello 1'");
      return "Hello, World 1!";
    });

    const [callback3Promise, callback3ID] = await context.createCallback(
      "callback3",
      {
        timeout: {
          minutes: 5,
        },
      },
    );
    const data3 = await context.step("hello 2", async (ctx) => {
      ctx.logger.info("Executing step 'hello 2'");
      return "Hello, World 2!";
    });

    const [callback4Promise, callback4ID] = await context.createCallback(
      "callback4",
      {
        timeout: {
          minutes: 5,
        },
      },
    );
    await Promise.all([callback3Promise, callback4Promise]);

    const data4 = await context.step("hello 3", async (ctx) => {
      ctx.logger.info("Executing step 'hello 3'");
      return "Hello, World 3!";
    });

    return { data, data1, data3, data4 };
  },
);
