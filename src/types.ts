import { DurableContext } from "@aws/durable-execution-sdk-js";
import { CALLBACK_EVENTS } from "./constants";

export type CallbackEventResultMap = {
  [CALLBACK_EVENTS.REQUESTED_CALLBACK_ID]: {
    callbackId: string;
    key: string;
    message: string;
  };
  [CALLBACK_EVENTS.CALLBACK_DATA]: {
    key: string;
    result: any;
    error?: {
      ErrorMessage: string;
      ErrorType?: string;
      ErrorData?: any;
    };
  };
};

export type TimeoutConfig = {
  hours?: number;
  minutes?: number;
  seconds?: number;
};

export type ResolverMap = Map<
  string,
  {
    resolve: (value?: any) => void;
    reject: (reason?: any) => void;
    finally?: () => void;
    result?: any;
  }
>;

export type Handler = (event: any, context: DurableContext) => Promise<any>;
