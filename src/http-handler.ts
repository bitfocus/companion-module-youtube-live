import type { CompanionHTTPRequest, CompanionHTTPResponse } from '@companion-module/base';
import { generateAuthorizationURL } from './authorization.js';
import { YoutubeConfig } from './config.js';
import { YoutubeInstance } from './index.js';

async function redirectToAuthorizeEndpoint(
	config: YoutubeConfig,
	request: CompanionHTTPRequest
): Promise<CompanionHTTPResponse> {
	if (request.method !== 'GET') {
		return {
			status: 500,
			headers: {
				'Content-Type': 'text/plain',
			},
			body: 'Authorize redirect must only be accessed using GET',
		};
	}

	const urlOrErrors = generateAuthorizationURL(config);
	if (typeof urlOrErrors === 'string') {
		return {
			status: 302,
			headers: {
				Location: urlOrErrors,
			},
		};
	}

	const title = "Can't redirect to authorization URL";
	return {
		status: 500,
		headers: {
			'Content-Type': 'text/html;charset=UTF-8',
		},
		body: `
<!DOCTYPE html>
<html>
<head>
<title>${title}</title>
</head>
<body>
<p>Fix these errors to authorize access to YouTube:</p>
<ul>
${urlOrErrors
	.map(
		(err) =>
			`<li>${
				// heavy-handed but effective for <li /> content
				[...err].map((c) => `&#${c.codePointAt(0)};`).join('')
			}</li>`
	)
	.join('\n')}
</ul>
</body>
</html>
		`,
	};
}

export async function handleHttpRequest(
	config: YoutubeConfig,
	log: YoutubeInstance['log'],
	request: CompanionHTTPRequest
): Promise<CompanionHTTPResponse> {
	console.log(`HTTP handler for ${request.path}`);
	try {
		switch (request.path) {
			case '/authorize':
				return redirectToAuthorizeEndpoint(config, request);
		}
	} catch (e: unknown) {
		log(
			'error',
			`Error handling HTTP request for '${request.path}': ${e instanceof Error ? e.message : 'unknown error'}`
		);
		return {
			status: 500,
			headers: {
				'Content-Type': 'text/plain',
			},
			body: `Internal error`,
		};
	}

	log('warn', `YouTube module HTTP handler doesn't handle this path: ${request.path}`);
	return {
		status: 404,
		headers: {
			'Content-Type': 'text/plain',
		},
		body: 'Not found',
	};
}
