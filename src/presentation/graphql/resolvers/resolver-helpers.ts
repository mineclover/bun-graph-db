import type { GraphQLResolveInfo } from "graphql";
import type {
	GraphQLContext,
	GraphQLParent,
} from "@/core/types/GraphQLTypes.js";

/**
 * Boundary adapters for GraphQL's untyped resolver arguments.
 *
 * The executable schema accepts resolver implementations from several legacy
 * resolver classes. Keeping the narrow runtime checks and unavoidable casts in
 * one module prevents them from leaking through each resolver map.
 */
export type RootResolverArgs = Record<string, unknown>;
export type RootArgsMapper<TArgs> = (args: TArgs) => TArgs;

export const callResolver = <T>(
	resolver: unknown,
	method: string,
	...args: unknown[]
): T | undefined => {
	if (
		!resolver ||
		(typeof resolver !== "object" && typeof resolver !== "function")
	) {
		return undefined;
	}

	const candidate = (resolver as Record<string, unknown>)[method];
	if (typeof candidate !== "function") {
		return undefined;
	}

	return Reflect.apply(candidate, resolver, args) as T;
};

/** The GraphQL executor only supplies an untyped argument record at this boundary. */
export const castRootArgs = <T>(value: RootResolverArgs): T => value as unknown as T;

export const castParent = <T>(value: GraphQLParent): T => value as T;

export const getInput = (value: RootResolverArgs) =>
	(value as { input?: RootResolverArgs }).input;

export const normalizeRootArgs = <TArgs>(
	args: RootResolverArgs,
	mapArgs?: RootArgsMapper<TArgs>,
): TArgs => {
	const typedArgs = castRootArgs<TArgs>(args);
	return mapArgs ? mapArgs(typedArgs) : typedArgs;
};

export const callRootResolver = <
	TArgs = RootResolverArgs,
	TResult = unknown,
	TContext = GraphQLContext,
>(
	resolver: unknown,
	method: string,
	parent: GraphQLParent,
	args: RootResolverArgs,
	context?: TContext,
	info?: GraphQLResolveInfo,
	mapArgs?: RootArgsMapper<TArgs>,
): TResult | undefined => {
	const typedArgs = normalizeRootArgs(args, mapArgs);
	return callResolver<TResult>(
		resolver,
		method,
		parent,
		typedArgs,
		context,
		info,
	);
};

export const callRootResolverWithFallback = <
	TArgs = RootResolverArgs,
	TResult = unknown,
	TContext = GraphQLContext,
>(
	primaryResolver: unknown,
	primaryMethod: string,
	fallbackResolver: unknown,
	fallbackMethod: string,
	parent: GraphQLParent,
	args: RootResolverArgs,
	context?: TContext,
	info?: GraphQLResolveInfo,
	mapArgs?: RootArgsMapper<TArgs>,
): TResult | undefined =>
	callRootResolver<TArgs, TResult, TContext>(
		primaryResolver,
		primaryMethod,
		parent,
		args,
		context,
		info,
		mapArgs,
	) ??
	callRootResolver<TArgs, TResult, TContext>(
		fallbackResolver,
		fallbackMethod,
		parent,
		args,
		context,
		info,
		mapArgs,
	);

export const withPaginationInput = <
	TArgs extends { input?: RootResolverArgs; pagination?: RootResolverArgs },
>(
	args: TArgs,
): TArgs => ({
	...args,
	pagination: args.pagination ?? getInput(args),
});

export const callFieldResolver = <
	TParent,
	TResult = unknown,
	TArgs extends unknown[] = [],
>(
	resolver: unknown,
	method: string,
	parent: GraphQLParent,
	...args: TArgs
): TResult | undefined =>
	callResolver<TResult>(resolver, method, castParent<TParent>(parent), ...args);

export const callFieldResolverWithFallback = <
	TParent,
	TResult = unknown,
	TArgs extends unknown[] = [],
>(
	primaryResolver: unknown,
	primaryMethod: string,
	fallbackResolver: unknown,
	fallbackMethod: string,
	parent: GraphQLParent,
	...args: TArgs
): TResult | undefined =>
	callFieldResolver<TParent, TResult, TArgs>(
		primaryResolver,
		primaryMethod,
		parent,
		...args,
	) ??
	callFieldResolver<TParent, TResult, TArgs>(
		fallbackResolver,
		fallbackMethod,
		parent,
		...args,
	);

export const getRecordValue = (
	value: unknown,
): Record<string, unknown> | null =>
	typeof value === "object" && value !== null && !Array.isArray(value)
		? castParent<Record<string, unknown>>(value)
		: null;

export const getStringValue = (
	value: unknown,
	key: string,
): string | undefined => {
	const candidate = getRecordValue(value)?.[key];
	return typeof candidate === "string" ? candidate : undefined;
};

export const getNumberValue = (
	value: unknown,
	key: string,
): number | undefined => {
	const candidate = getRecordValue(value)?.[key];
	return typeof candidate === "number" ? candidate : undefined;
};

export const getArrayValue = (
	value: unknown,
	key: string,
): unknown[] | undefined => {
	const candidate = getRecordValue(value)?.[key];
	return Array.isArray(candidate) ? candidate : undefined;
};

export const getNestedRecordValue = (
	value: unknown,
	key: string,
): Record<string, unknown> | null =>
	getRecordValue(getRecordValue(value)?.[key]);

export const callStringMethod = (
	value: unknown,
	key: string,
): string | null | undefined => {
	const record = getRecordValue(value);
	if (!record) {
		return undefined;
	}

	const candidate = record[key];
	if (typeof candidate !== "function") {
		return undefined;
	}

	const result = Reflect.apply(candidate, record, []);
	return typeof result === "string" || result === null ? result : undefined;
};
