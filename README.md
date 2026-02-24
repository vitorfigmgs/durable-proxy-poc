# POC: Testing Durable Functions locally using durable proxies

**This repo refers to the following SST issue:** xxxxxxxxx

We are exploring a way to enable "dev mode" (fast code changes without cloud deployments) for [Lambda Durable Functions](https://docs.aws.amazon.com/lambda/latest/dg/durable-functions.html). Our goal is to maintain how other components interact with our functions, similar to how [SST Live Lambda Development](https://sst.dev/docs/live/#how-it-works) works.

# Testing

1. **Run the SST dev server**

    ```bash
    npm run dev
    ```
    This opens a simple GUI where you can resolve created callbacks. It uses the SDK to send Lambda callback commands. This step creates the commands, the AppSync Event API, and the Durable Lambda proxy function.

2. **Select an example**

    The SST TUI lists example dev commands (named `example.*`). Use the arrow keys to select a command and press Enter to run it.

3. **Resolve the created callbacks**

    The client wrapper logs all AppSync events. Copy the `$.event.data.callbackId` property from an event of type `REQUESTED_CALLBACK_ID`. Paste it into the test UI textarea to send a "success" or "failure" signal to that callback token.