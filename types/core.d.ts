/**
 * A request parameter value that can potentially be put in a list:
 * a title, user name, namespace number, etc.
 */
export type ListableParam = string | number;
/**
 * A request parameter value that cannot be put in a list:
 * a boolean toggle, a Blob or File (POST requests only),
 * or null or undefined as a default fallback for not sending a parameter at all.
 */
export type UnlistableParam = boolean | Blob | File | null | undefined;
/**
 * A single request parameter value.
 */
export type SingleParam = ListableParam | UnlistableParam;
/**
 * A request parameter value that is a list of values
 * (several titles, namespace numbers, etc.),
 * which may potentially be combined with other lists in a single request
 * (if specified as a set) or not (if specified as an array).
 */
export type ListParam = Array<ListableParam> | Set<ListableParam>;
/**
 * A request parameter value of any kind.
 */
export type Param = ListParam | SingleParam;
/**
 * Request parameters for {@link Session#request} and related methods.
 * Each parameter may be a string, number, boolean, null, or undefined,
 * or an array or set of strings or numbers.
 * Parameters with values false, null, or undefined are completely removed
 * when the request is sent out.
 * In POST requests, a parameter may also be a Blob or File.
 */
export type Params = {
    [x: string]: any;
};
/**
 * Request options for {@link Session#request} and related methods.
 * The actual effective options are merged from
 * the builtin {@link DEFAULT_OPTIONS},
 * the default options passed into the {@link Session} constructor,
 * and the options given with a particular request call.
 */
export type Options = {
    /**
     * The method, either GET (default) or POST.
     */
    method?: string;
    /**
     * Include a token parameter of this type,
     * automatically getting it from the API if necessary.
     * The most common token type is 'csrf' (some actions use a different type);
     * you will also want to set the method option to POST.
     */
    tokenType?: string | null;
    /**
     * The name of the token parameter.
     * Only used if the tokenType option is not null.
     * Defaults to 'token', but some modules need a different name
     * (e.g. action=login needs 'lgtoken').
     */
    tokenName?: string;
    /**
     * The User-Agent header to send.
     * (Usually specified as a default option in the constructor.)
     */
    userAgent?: string;
    /**
     * The maximum duration for automatic retries,
     * i.e. a time interval (in seconds) during which the request will be automatically repeated
     * according to the Retry-After response header if it is present.
     * Defaults to 65 seconds; set to 0 to disable automatic retries.
     * (Can also be a fractional number for sub-second precision.)
     */
    maxRetriesSeconds?: number;
    /**
     * Default Retry-After header value
     * in case of a maxlag error. Only used when the response is missing the header.
     * Since MediaWiki usually sends this header for maxlag errors, this option is rarely used.
     * Defaults to five seconds, which is the recommended maxlag value for bots.
     */
    retryAfterMaxlagSeconds?: number;
    /**
     * Default Retry-After header value
     * in case of a readonly error. Only used when the response is missing the header.
     * MediaWiki does not usually send this header for readonly errors,
     * so this option is more important than the retryAfterMaxlagSeconds option.
     * The default of 30 seconds is thought to be appropriate for Wikimedia wikis;
     * for third-party wikis, higher values may be useful
     * (remember to also increase the maxRetriesSeconds option accordingly).
     */
    retryAfterReadonlySeconds?: number;
    /**
     * A handler for warnings from this API request.
     * Called with a single instance of a subclass of Error, such as {@link ApiWarnings}.
     * The default is console.warn (interactive CLI applications may wish to change this).
     */
    warn?: Function;
    /**
     * Whether to drop warnings about truncated results instead of passing them to the warn handler.
     * Occasionally, an API result may not fit into a single network response;
     * in such cases, the API will add a warning about the result being truncated,
     * as well as continuation parameters that will result in the remaining information
     * being included in the next request, if continuation is followed.
     * If you follow continuation and are prepared to merge truncated responses back together,
     * you don’t need to see this warning and can use this option to suppress it.
     * This option defaults to false in {@link Session#request} (i.e. treat the warning like any other),
     * but to true in {@link Session#requestAndContinueReducingBatch}.
     */
    dropTruncatedResultWarning?: boolean;
    /**
     * Value for the Authorization request header.
     * This option can be used to authenticate requests using OAuth 2.0.
     * For an owner-only client / consumer, where you have an access token,
     * you can set this option to `Bearer ${ accessToken }` directly.
     * Otherwise, use the m3api-oauth2 extension package.
     */
    authorization?: string;
    /**
     * Internal option.
     * Define handlers for API errors, which can retry the request if appropriate.
     * This option is only part of the internal interface, not of the stable, public interface.
     */
    errorHandlers?: {
        [x: string]: ErrorHandler;
    };
    /**
     * Internal option.
     * Retry until the given timestamp (in terms of the performance.now() clock).
     * Takes precedence over the maxRetriesSeconds option.
     * This option is only part of the internal interface, not of the stable, public interface.
     */
    retryUntil?: number;
};
/**
 * An error handler callback, which can be registered in the errorHandlers option.
 *
 * The callback is called if an API request results in an error
 * and the callback has been registered for that error code.
 * It may retry the request or perform any other action.
 */
export type ErrorHandler = (session: Session, params: Params, options: Options, internalResponse: InternalResponse, error: any) => any | null | Promise<any | null>;
/**
 * The internal representation of a full server response,
 * returned by {@link Session#internalGet} and {@link Session#internalPost}.
 */
export type InternalResponse = {
    /**
     * The HTTP status code (e.g. 200 OK).
     */
    status: number;
    /**
     * The response headers.
     * Header names must be all-lowercase.
     * (Set-Cookie is not expected to be included.)
     */
    headers: any;
    /**
     * JSON-decoded response body.
     */
    body: any;
};
/**
 * A request parameter value that can potentially be put in a list:
 * a title, user name, namespace number, etc.
 *
 * @typedef ListableParam
 * @type {string|number}
 */
/**
 * A request parameter value that cannot be put in a list:
 * a boolean toggle, a Blob or File (POST requests only),
 * or null or undefined as a default fallback for not sending a parameter at all.
 *
 * @typedef UnlistableParam
 * @type {boolean|Blob|File|null|undefined}
 */
/**
 * A single request parameter value.
 *
 * @typedef SingleParam
 * @type {ListableParam|UnlistableParam}
 */
/**
 * A request parameter value that is a list of values
 * (several titles, namespace numbers, etc.),
 * which may potentially be combined with other lists in a single request
 * (if specified as a set) or not (if specified as an array).
 *
 * @typedef ListParam
 * @type {Array<ListableParam>|Set<ListableParam>}
 */
/**
 * A request parameter value of any kind.
 *
 * @typedef Param
 * @type {ListParam|SingleParam}
 */
/**
 * Request parameters for {@link Session#request} and related methods.
 * Each parameter may be a string, number, boolean, null, or undefined,
 * or an array or set of strings or numbers.
 * Parameters with values false, null, or undefined are completely removed
 * when the request is sent out.
 * In POST requests, a parameter may also be a Blob or File.
 *
 * @typedef Params
 * @type {Object<string, Param>}
 */
/**
 * Request options for {@link Session#request} and related methods.
 * The actual effective options are merged from
 * the builtin {@link DEFAULT_OPTIONS},
 * the default options passed into the {@link Session} constructor,
 * and the options given with a particular request call.
 *
 * @typedef Options
 * @type {Object}
 * @property {string} [method] The method, either GET (default) or POST.
 * @property {string|null} [tokenType] Include a token parameter of this type,
 * automatically getting it from the API if necessary.
 * The most common token type is 'csrf' (some actions use a different type);
 * you will also want to set the method option to POST.
 * @property {string} [tokenName] The name of the token parameter.
 * Only used if the tokenType option is not null.
 * Defaults to 'token', but some modules need a different name
 * (e.g. action=login needs 'lgtoken').
 * @property {string} [userAgent] The User-Agent header to send.
 * (Usually specified as a default option in the constructor.)
 * @property {number} [maxRetriesSeconds] The maximum duration for automatic retries,
 * i.e. a time interval (in seconds) during which the request will be automatically repeated
 * according to the Retry-After response header if it is present.
 * Defaults to 65 seconds; set to 0 to disable automatic retries.
 * (Can also be a fractional number for sub-second precision.)
 * @property {number} [retryAfterMaxlagSeconds] Default Retry-After header value
 * in case of a maxlag error. Only used when the response is missing the header.
 * Since MediaWiki usually sends this header for maxlag errors, this option is rarely used.
 * Defaults to five seconds, which is the recommended maxlag value for bots.
 * @property {number} [retryAfterReadonlySeconds] Default Retry-After header value
 * in case of a readonly error. Only used when the response is missing the header.
 * MediaWiki does not usually send this header for readonly errors,
 * so this option is more important than the retryAfterMaxlagSeconds option.
 * The default of 30 seconds is thought to be appropriate for Wikimedia wikis;
 * for third-party wikis, higher values may be useful
 * (remember to also increase the maxRetriesSeconds option accordingly).
 * @property {Function} [warn] A handler for warnings from this API request.
 * Called with a single instance of a subclass of Error, such as {@link ApiWarnings}.
 * The default is console.warn (interactive CLI applications may wish to change this).
 * @property {boolean} [dropTruncatedResultWarning]
 * Whether to drop warnings about truncated results instead of passing them to the warn handler.
 * Occasionally, an API result may not fit into a single network response;
 * in such cases, the API will add a warning about the result being truncated,
 * as well as continuation parameters that will result in the remaining information
 * being included in the next request, if continuation is followed.
 * If you follow continuation and are prepared to merge truncated responses back together,
 * you don’t need to see this warning and can use this option to suppress it.
 * This option defaults to false in {@link Session#request} (i.e. treat the warning like any other),
 * but to true in {@link Session#requestAndContinueReducingBatch}.
 * @property {string} [authorization] Value for the Authorization request header.
 * This option can be used to authenticate requests using OAuth 2.0.
 * For an owner-only client / consumer, where you have an access token,
 * you can set this option to `Bearer ${ accessToken }` directly.
 * Otherwise, use the m3api-oauth2 extension package.
 * @property {Object.<string, ErrorHandler>} [errorHandlers] Internal option.
 * Define handlers for API errors, which can retry the request if appropriate.
 * This option is only part of the internal interface, not of the stable, public interface.
 * @property {number} [retryUntil] Internal option.
 * Retry until the given timestamp (in terms of the performance.now() clock).
 * Takes precedence over the maxRetriesSeconds option.
 * This option is only part of the internal interface, not of the stable, public interface.
 */
/**
 * An error handler callback, which can be registered in the errorHandlers option.
 *
 * The callback is called if an API request results in an error
 * and the callback has been registered for that error code.
 * It may retry the request or perform any other action.
 *
 * @callback ErrorHandler
 * @param {Session} session The session to which the request belongs.
 * @param {Params} params The request parameters.
 * @param {Options} options The request options.
 * The retryUntil option is always set here,
 * and the error handler should not retry the request if this timestamp has already passed.
 * @param {InternalResponse} internalResponse The full response sent by the server.
 * @param {Object} error The specific error returned to the API that matched this handler.
 * @return {Object|null|Promise<Object|null>} A synchronous or asynchronous result.
 * If the handler returns an object (or a promise resolving to an object),
 * that object is used as the result of the API request;
 * this can be used to retry the request
 * (the handler makes another request to the session with the same params and options,
 * and returns its result).
 * If the handler returns null (or a promise resolving to null),
 * the error could not be handled;
 * m3api will call error handlers for the remaining errors (if any)
 * and eventually throw ApiErrors if none of them returned an object either.
 */
/**
 * The internal representation of a full server response,
 * returned by {@link Session#internalGet} and {@link Session#internalPost}.
 *
 * @protected
 * @typedef InternalResponse
 * @type {Object}
 * @property {number} status The HTTP status code (e.g. 200 OK).
 * @property {Object} headers The response headers.
 * Header names must be all-lowercase.
 * (Set-Cookie is not expected to be included.)
 * @property {Object} body JSON-decoded response body.
 */
/**
 * Default options for requests across all sessions.
 *
 * Packages extending m3api’s capabilities (“extension packages”)
 * may add their own options here,
 * conventionally prefixed with the package name and a slash.
 * For example, a package named 'abc' may add options 'abc/x' and 'abc/y',
 * while a package named '@abc/def' may add '@abc/def/x' and '@abc/def/y'.
 * Extension packages are encouraged to use a single options object
 * for their own options as well as ones that are passed through to m3api,
 * rather than e.g. separate options or individual parameters;
 * both kinds of options can then have per-session and global defaults.
 *
 * Changing or removing any default options here is strongly discouraged
 * (with the exception of changing 'errorHandlers' to add handlers for additional errors),
 * and may result in unpredictable behavior.
 *
 * @type {Options}
 */
export const DEFAULT_OPTIONS: Options;
/**
 * An Error wrapping one or more API errors.
 */
export class ApiErrors extends Error {
    /**
     * @param {Object[]} errors The error objects from the API.
     * Must be nonempty, and each error must contain at least a code.
     * Other error members depend on the errorformat of the request.
     * @param {...*} params Any other params for the Error constructor.
     * (Not including the message: the first error code is used for that.)
     */
    constructor(errors: any[], ...params: any[]);
    /**
     * The error objects from the API.
     *
     * @member {Object[]}
     */
    errors: any[];
}
/**
 * An Error wrapping one or more API warnings.
 */
export class ApiWarnings extends Error {
    /**
     * @param {Object[]} warnings The warning objects from the API.
     * Must be nonempty; the warning members depend on the errorformat of the request.
     * @param {...*} params Any other params for the Error constructor.
     * (Not including the message: the first warning is used for that.)
     */
    constructor(warnings: any[], ...params: any[]);
    /**
     * The warning objects from the API.
     *
     * @member {Object[]}
     */
    warnings: any[];
}
/**
 * An Error used as a warning when a request with no custom user agent is made.
 */
export class DefaultUserAgentWarning extends Error {
    /**
     * @param {...*} params Any additional params for the Error constructor,
     * not including the message (which is hard-coded).
     */
    constructor(...params: any[]);
}
/**
 * A session to make API requests.
 */
export class Session {
    /**
     * @param {string} apiUrl The URL to the api.php endpoint,
     * such as {@link https://en.wikipedia.org/w/api.php}.
     * Can also be just the domain, such as en.wikipedia.org.
     * @param {Params} [defaultParams] Parameters to include in every API request.
     * You are strongly encouraged to specify formatversion: 2 here;
     * other useful global parameters include uselang, errorformat, maxlag.
     * @param {Options} [defaultOptions] Options to set for each request.
     * You are strongly encouraged to specify a userAgent according to the
     * {@link https://foundation.wikimedia.org/wiki/Special:MyLanguage/Policy:User-Agent_policy User-Agent policy}.
     */
    constructor(apiUrl: string, defaultParams?: Params, defaultOptions?: Options);
    /**
     * The URL to the api.php endpoint.
     * Must not be reassigned.
     *
     * @member {string}
     */
    apiUrl: string;
    /**
     * Parameters to include in every API request.
     * Can be modified after construction,
     * e.g. to add assert=user after logging in.
     *
     * @member {Object}
     */
    defaultParams: {
        [x: string]: any;
    };
    /**
     * Options to set for each request.
     * Can be modified after construction.
     *
     * @member {Options}
     */
    defaultOptions: Options;
    /**
     * Saved/cached tokens.
     * Can be modified after construction,
     * particularly to call `clear()` after logging in or out;
     * apart from that, however,
     * using the tokenType/tokenName options or {@link Session#getToken}
     * is generally more convenient.
     *
     * @member {Map}
     */
    tokens: any;
    /**
     * Make an API request.
     *
     * @param {Params} params The parameters.
     * Default parameters from the constructor are added to these,
     * with per-request parameters overriding default parameters in case of collision.
     * @param {Options} [options] Other options for the request.
     * The per-request options extend and override the options passed into the constructor,
     * which in turn extend and override the builtin {@link DEFAULT_OPTIONS}.
     * @return {Object}
     * @throws {ApiErrors}
     */
    request(params: Params, options?: Options): any;
    /**
     * Make a series of API requests, following API continuation.
     *
     * @param {Params} params Same as for {@link Session#request}.
     * Continuation parameters will be added automatically.
     * @param {Options} [options] Same as for {@link Session#request}.
     * @yield {Object}
     * @throws {ApiErrors}
     */
    requestAndContinue(params: Params, options?: Options): {};
    /**
     * Make a series of API requests, following API continuation,
     * accumulating responses and yielding one result per batch.
     *
     * This works conceptually similar to Array.reduce(), but repeatedly,
     * with each batch of responses corresponding to one array.
     * At the beginning of each batch, an initial value is generated,
     * and then for each response in the batch,
     * a reducer is called with the current value and that response.
     * (The current value starts out as the initial value;
     * afterwards, it’s the reducer’s return value for the previous response.)
     * At the end of each batch, the current value is yielded,
     * and the process starts over with a new initial value.
     *
     * The reducer will typically extract some kind of pages or other entries from the response,
     * add them to the current value, possibly merging them with existing entries there,
     * and then return the updated value.
     * The initial callback defaults to producing empty objects,
     * but other values are also possible: sets or maps may be useful.
     *
     * @param {Params} params Same as for {@link Session#request}.
     * @param {Options} options Same as for {@link Session#request}. (But not optional here!)
     * The dropTruncatedResultWarning option defaults to true here,
     * since continuation will produce the rest of the truncated result automatically.
     * @param {Function} reducer A callback like for Array.reduce().
     * Called with two arguments, the current value and the current response.
     * @param {Function} [initial] A callback producing initial values.
     * Called with no arguments. Defaults to producing empty objects.
     * @yield {*} The last reducer return value for each batch.
     * Typically, the initial and reducer callbacks will have the same return type,
     * which will then also be the return type of this function, such as Object, Map, or Set.
     */
    requestAndContinueReducingBatch(params: Params, options: Options, reducer: Function, initial?: Function): {};
    /**
     * Get a token of the specified type.
     *
     * Though this method is public, it should generally not be used directly:
     * call {@link Session#request} with the tokenType/tokenName options instead.
     *
     * @param {string} type
     * @param {Options} options Options for the request to get the token.
     * @return {string}
     */
    getToken(type: string, options: Options): string;
    /**
     * Get the effective request headers for these options.
     *
     * @protected
     * @param {Options} options
     * @return {Object}
     */
    protected getRequestHeaders(options: Options): any;
    /**
     * Get the effective user agent string for these options.
     *
     * @protected
     * @param {Options} options
     * @return {string}
     */
    protected getUserAgent(options: Options): string;
    /** @private */
    private warnedDefaultUserAgent;
    /**
     * @private
     * @param {Params} params
     * @return {Object}
     */
    private transformParams;
    /**
     * @private
     * @param {Param} value
     * @return {string|undefined}
     */
    private transformParamValue;
    /**
     * @private
     * @param {Array<ListableParam>} value
     * @return {string}
     */
    private transformParamArray;
    /**
     * @private
     * @param {*} value
     * @return {*} string|undefined for string|number|boolean|null|undefined value,
     * the value unmodified otherwise
     */
    private transformParamSingle;
    /**
     * Actually make a GET request.
     *
     * @abstract
     * @protected
     * @param {string} apiUrl
     * @param {Object} params
     * @param {Object} headers Header names must be all-lowercase.
     * @return {Promise<InternalResponse>}
     */
    protected internalGet(apiUrl: string, params: any, headers: any): Promise<InternalResponse>;
    /**
     * Actually make a POST request.
     *
     * @abstract
     * @protected
     * @param {string} apiUrl
     * @param {Object} urlParams
     * @param {Object} bodyParams
     * @param {Object} headers Header names must be all-lowercase.
     * @return {Promise<InternalResponse>}
     */
    protected internalPost(apiUrl: string, urlParams: any, bodyParams: any, headers: any): Promise<InternalResponse>;
}
/**
 * Decorate the given warn handler so that warnings about truncated results are dropped.
 *
 * Most of the time, you should use the dropTruncatedResultWarning request option
 * instead of using this function directly.
 *
 * @param {Function} warn The original warn function.
 * @return {Function} A new function that, when called,
 * will call the original warn functions,
 * but with all truncated result warnings dropped;
 * when there are no other warnings, the original function is not called.
 */
export function makeWarnDroppingTruncatedResultWarning(warn: Function): Function;
/**
 * Convenience function to get a boolean from an API response value.
 *
 * Works for formatversion=1 booleans
 * (absent means false, empty string means true)
 * as well as formatversion=2 booleans
 * (absent or false means false, true means true).
 * Mostly useful in library code,
 * when you don’t know the formatversion of the response.
 * (If you control the request parameters, just use formatversion=2.)
 *
 * @param {boolean|''|undefined} value A value from an API response
 * (e.g. response.query.general.rtl).
 * @return {boolean}
 */
export function responseBoolean(value: boolean | "" | undefined): boolean;
/**
 * Convenience function to create a Set.
 *
 * The two invocations
 *
 *     new Set( [ 'a', 'b' ] )
 *     set( 'a', 'b' )
 *
 * are equivalent, but the second one is shorter and easier to type.
 *
 * @param {...*} elements
 * @return {Set}
 */
export function set(...elements: any[]): Set;
//# sourceMappingURL=core.d.ts.map