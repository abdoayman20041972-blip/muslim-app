/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as macaly from "../macaly.js";
import type * as notificationEngine from "../notificationEngine.js";
import type * as pushSubscriptionQuery from "../pushSubscriptionQuery.js";
import type * as pushSubscriptions from "../pushSubscriptions.js";
import type * as scheduler from "../scheduler.js";
import type * as schedulerNode from "../schedulerNode.js";
import type * as sendPush from "../sendPush.js";
import type * as shared_dailyAyah from "../shared/dailyAyah.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  crons: typeof crons;
  http: typeof http;
  macaly: typeof macaly;
  notificationEngine: typeof notificationEngine;
  pushSubscriptionQuery: typeof pushSubscriptionQuery;
  pushSubscriptions: typeof pushSubscriptions;
  scheduler: typeof scheduler;
  schedulerNode: typeof schedulerNode;
  sendPush: typeof sendPush;
  "shared/dailyAyah": typeof shared_dailyAyah;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
