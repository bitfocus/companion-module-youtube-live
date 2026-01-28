//require("leaked-handles");
jest.mock('node:http');
jest.mock('server-destroy');

// eslint-disable-next-line @typescript-eslint/naming-convention
import * as _http from 'node:http';
// eslint-disable-next-line @typescript-eslint/naming-convention
import _destroyer from 'server-destroy';

import { HttpReceiver } from '../../auth/httpListener';
import { EventEmitter } from 'events';

const destroyer = jest.mocked(_destroyer);

destroyer.mockImplementation((server) => {
	expect(server).toBeInstanceOf(_http.Server);
	server.destroy = (): void => {
		mockEvent.emit('close');
	};
});
const _mockHttp = new _http.Server();
const mockHttp = jest.mocked(_mockHttp);
jest.mocked(_http.Server).mockImplementation(() => _mockHttp);

const mockEvent = new EventEmitter();
mockHttp.on.mockImplementation((event, listener): _http.Server => {
	mockEvent.on(event, listener);
	return _mockHttp;
});
mockHttp.emit.mockImplementation((event): boolean => {
	return mockEvent.emit(event);
});

const log = jest.fn();

type HttpHeaders = {
	readonly [key in string]: string;
};

describe('HTTP module interaction', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockEvent.removeAllListeners();
	});

	afterAll(() => {
		mockEvent.removeAllListeners();
	});

	test('listen', async () => {
		const code = new HttpReceiver('abcd', 1234, log).getCode(jest.fn());
		void code; // not resolved by this test
		expect(mockHttp.listen).toHaveBeenCalled();
	});

	test('listening is forwarded', async () => {
		const ready = jest.fn();
		const code = new HttpReceiver('abcd', 1234, log).getCode(ready);
		void code; // not resolved by this test
		mockEvent.emit('listening');
		expect(mockHttp.listen).toHaveBeenCalled();
		expect(mockHttp.on).toHaveBeenCalled();
		expect(ready).toHaveBeenCalled();
	});

	test('close is forwarded', async () => {
		const promise = new HttpReceiver('abcd', 1234, log).getCode(jest.fn());
		mockEvent.emit('listening');
		mockEvent.emit('close');
		await expect(promise).rejects.toBeInstanceOf(Error);
	});

	test('request', async () => {
		const promise = new HttpReceiver('abcd', 1234, log).getCode(jest.fn());
		mockEvent.emit('listening');

		const req1 = { url: '/favicon.ico' };
		const res1 = {
			writeHead: jest.fn().mockImplementation((status: number, headers: HttpHeaders) => {
				expect(status).toBe(400);
				expect(headers['Content-Type']).toBe('text/plain');
			}),
			end: jest.fn().mockImplementation((reply: string) => {
				expect(reply.length).toBeGreaterThan(0);
			}),
		};
		mockEvent.emit('request', req1, res1);

		const req2 = { url: '/callback?code=authCode' };
		const res2 = {
			writeHead: jest.fn().mockImplementation((status: number, headers: HttpHeaders) => {
				expect(status).toBe(200);
				expect(headers['Content-Type']).toBe('text/plain');
			}),
			end: jest.fn().mockImplementation((reply: string) => {
				expect(reply.length).toBeGreaterThan(0);
			}),
		};

		mockEvent.emit('request', req2, res2);
		await expect(promise).resolves.toBe('authCode');
	});

	test('abortion', async () => {
		const receiver = new HttpReceiver('abcd', 1234, log);
		const promise = receiver.getCode(jest.fn());
		mockEvent.emit('listening');
		receiver.abort();
		await expect(promise).rejects.toBeInstanceOf(Error);
	});
});
