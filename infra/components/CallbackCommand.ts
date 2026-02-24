import { eventEnvVariables } from "../eventApi";
import { durableProxyFunction } from "../proxyDurableFunction";

export const callbackCommandRole = new aws.iam.Role("callbackCommandRole", {
  assumeRolePolicy: aws.getCallerIdentity().then((identity) =>
    JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: {
            AWS: identity.arn,
          },
          Action: "sts:AssumeRole",
        },
      ],
    }),
  ),
  inlinePolicies: [
    {
      name: "commandPolicy",
      policy: durableProxyFunction.arn.apply((durableProxyFunctionArn) =>
        JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Action: ["lambda:InvokeFunction"],
              Effect: "Allow",
              Resource: `${durableProxyFunctionArn}:*`,
            },
          ],
        }),
      ),
    },
    {
      name: "sendCallbackSignalPolicy",
      policy: durableProxyFunction.arn.apply((durableProxyFunctionArn) =>
        JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Action: [
                "lambda:SendDurableExecutionCallbackSuccess",
                "lambda:SendDurableExecutionCallbackFailure",
              ],
              Effect: "Allow",
              Resource: `${durableProxyFunctionArn}:*`,
            },
          ],
        }),
      ),
    },
  ],
});

export class CallbackCommand extends sst.x.DevCommand {
  constructor(...args: ConstructorParameters<typeof sst.x.DevCommand>) {
    const [name, props, opts] = args;

    super(
      name,
      {
        ...props,
        aws: {
          role: callbackCommandRole.arn,
        },
        environment: {
          ...props.environment,
          ...eventEnvVariables,
          DURABLE_PROXY_FUNCTION_ARN: durableProxyFunction.arn,
        },
      },
      opts,
    );
  }
}
