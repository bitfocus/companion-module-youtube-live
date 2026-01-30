import * as http from 'node:http';
import * as url from 'node:url';
import destroyer from 'server-destroy';
import { Logger, DetachedPromise } from '../common.js';

/**
 * Process for acquiring new user authorization tokens.
 */
export class HttpReceiver {
	private Signal: DetachedPromise<string>;
	private Log: Logger;
	private ListenHost: string;
	private ListenPort: number;
	private CallbackServer?: http.Server;

	/**
	 * Initialize this receiver.
	 * @param listenHost Where to start the HTTP server.
	 * @param listenPort Where to start the HTTP server.
	 * @param log Logger for authorization events.
	 */
	constructor(listenHost: string, listenPort: number, log: Logger) {
		this.Signal = new DetachedPromise<string>();
		this.Log = log;
		this.ListenHost = listenHost;
		this.ListenPort = listenPort;
	}

	/**
	 * Start the listener for the authorization code callback.
	 * @param onReady Function that will be called when the listener is ready to accept callbacks.
	 * @returns Promise for the received value.
	 */
	async getCode(onReady: () => void): Promise<string> {
		this.abort(); // cancel previous attempts

		this.CallbackServer = new http.Server();
		destroyer(this.CallbackServer);

		this.CallbackServer.on('listening', onReady);
		this.CallbackServer.on('request', (req, res) => this.handleRequest(req, res));
		this.CallbackServer.on('close', () => {
			// note: if the promise is already resolve()'d, this has no effect (which is great)
			this.Signal.Reject(new Error('Authorization process aborted.'));
		});
		this.CallbackServer.listen(this.ListenPort, this.ListenHost);

		return this.Signal.Promise;
	}

	/**
	 * Handle a request to the HTTP authorization code listener.
	 * @param req HTTP request
	 * @param res HTTP response
	 */
	private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
		if (req.url === undefined) return;

		const address = new url.URL(req.url, `http://${this.ListenHost}:${this.ListenPort}/`);
		this.Log('debug', `Received HTTP request at ${address.pathname}`);

		const code = address.searchParams.get('code');
		if (code === null) {
			this.Log('debug', 'HTTP request does not contain authorization code');
			res.writeHead(400, { 'Content-Type': 'text/plain' });
			res.end('Authorization token required');
			return;
		}

		this.Log('debug', 'HTTP request OK');
		res.writeHead(200, { 'Content-Type': 'text/plain' });
		res.end('Authorization code received successfully! You can now close this window.');

		this.Signal.Resolve(code);
		this.abort();
	}

	/**
	 * Stop the server (and cancel pending listener)
	 */
	abort(): void {
		this.CallbackServer?.destroy();
		this.CallbackServer = undefined;
	}
}
