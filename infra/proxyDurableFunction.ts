import { apiKey, eventEnvVariables, eventHttpUrl } from "./eventApi";

export const durableProxyFunction = new sst.aws.Function("durableProxy", {
  handler: "src/server.handler",
  runtime: "nodejs22.x",
  transform: {
    function: {
      durableConfig: {
        executionTimeout: 3600, // 1 hour in seconds
        retentionPeriod: 1,
      },
      loggingConfig: { logFormat: "JSON" },
    },
  },
  environment: eventEnvVariables,
  dev: false,
});

const durableExecutionPolicy = new aws.iam.Policy(
  "durableProxyLambdaBasicExecution",
  {
    policy: durableProxyFunction.arn.apply((durableProxyFunctionArn) =>
      JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Action: [
              "lambda:CheckpointDurableExecution",
              "lambda:GetDurableExecutionState",
            ],
            Effect: "Allow",
            Resource: `${durableProxyFunctionArn}:*`,
          },
        ],
      }),
    ),
  },
);

new aws.iam.RolePolicyAttachment(
  "durableProxyLambdaExecutionPolicyAttachment",
  {
    policyArn: durableExecutionPolicy.arn,
    role: durableProxyFunction.nodes.role,
  },
);
