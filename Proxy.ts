export interface ProxyResponse extends Response {
	proxyHeaders: Headers;
}

export class FetchProxy {
	proxyEndpoint: string;

	constructor(proxyEndpoint: string) {
		this.proxyEndpoint = proxyEndpoint;
		if (this.proxyEndpoint.length == 0)
			throw new Error("Proxy endpoint must not be a blank string");
	}

	async fetch(
		endpoint: string | URL,
		options: RequestInit = {},
	): Promise<Response & { proxyHeaders: Headers }> {
		const configuredOptions: RequestInit = {
			method: options.method ?? "GET",
			body: options.body ?? undefined,
			mode: options.mode ?? undefined,
			keepalive: options.keepalive ?? undefined,
			signal: options.signal ?? undefined,
			credentials: options.credentials ?? undefined,
			redirect: "manual",
			headers: {
				endpoint: typeof endpoint == "string" ? endpoint : endpoint.toString(),
				/* cspell: disable-next-line */
				"oproxy-options": JSON.stringify({
					method: options.method ?? "GET",
					mode: options.mode ?? undefined,
					credentials: options.credentials ?? undefined,
					redirect: options.redirect ?? undefined,
					referrer: options.referrer ?? undefined,
					referrerPolicy: options.referrerPolicy ?? undefined,
					integrity: options.integrity ?? undefined,
					keepalive: options.keepalive ?? undefined,
				}),
				headers: options.headers == null ? "{}" : JSON.stringify(options.headers),
			},
		};
		const res = await fetch(this.proxyEndpoint, configuredOptions);
		const receivedHeaders = res.headers.has("incomingHeaders")
			? JSON.parse(res.headers?.get("incomingHeaders") ?? "")
			: null;
		const receivedStatus = res.headers.has("receivedStatus")
			? Number(res.headers.get("receivedStatus"))
			: res.status;
		Object.defineProperty(res, "status", { get: () => receivedStatus });
		const proxyHeaders = res.headers;
		Object.defineProperty(res, "proxyHeaders", { get: () => proxyHeaders });
		const resWithHeaders: ProxyResponse = res as ProxyResponse;
		if (receivedHeaders != null) {
			Object.defineProperty(resWithHeaders, "headers", {
				get: () => new Headers(receivedHeaders),
			});
		}
		return resWithHeaders;
	}
}
