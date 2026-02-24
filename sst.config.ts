/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "durable-proxy-poc",
      home: "aws",
      providers: {
        aws: "7.19.0",
      },
    };
  },
  async run() {
    await import("./infra/proxyDurableFunction");
    await import("./infra/eventApi");
    const { CallbackCommand } = await import("./infra/components/CallbackCommand");

    new CallbackCommand("example.basic", {
      dev: {
        command: "tsx examples/basic.ts --run",
        autostart: false,
      },
    });

    new CallbackCommand("example.multiplesCallbacks", {
      dev: {
        command: "tsx examples/multiplesCallbacks.ts --run",
        autostart: false,
      },
    });

    new CallbackCommand("sendCallbackSignal", {
      dev: {
        command: "tsx scripts/sendCallbackSignal.ts",
      },
    });
  },
});
