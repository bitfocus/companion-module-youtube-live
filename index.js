var instance_skel = require("../../instance_skel");
const {google}    = require("googleapis");
var fs            = require("fs");
const url         = require("url");
const http        = require("http");
const opn         = require("opn");
const destroyer   = require('server-destroy');
const path        = require('path');

function instance(system, id, config) {
	var self = this;

	instance_skel.apply(this, arguments);

	self.actions();
	self.init_feedbacks();

	return self;
};

instance.prototype.updateConfig = function(config) {
	var self = this;
	self.config = config;
	self.log("Updated config of YT module");
	self.destroy();
	self.init(true);
}

instance.prototype.init = function(is_config) {
	var self = this;

	self.log('debug', 'Initializing YT module');
	self.status(self.STATUS_WARN, 'Initializing');

	var scopes = ["https://www.googleapis.com/auth/youtube.force-ssl"];

	if (!self.config.client_id     ||
	    !self.config.client_secret ||
	    !self.config.client_redirect_url) {
		self.log('warn', 'Not all OAuth application parameters were configured');
		self.status(self.STATUS_ERROR, 'Not all OAuth application parameters were configured');
		return;
	}

	self.yt_api_handler = new Youtube_api_handler(
		self.config.client_id,
		self.config.client_secret,
		self.config.client_redirect_url,
		scopes,
		self.log.bind(self)
	);

	if (!self.config.auth_token && is_config) {
		self.log('info', 'New config without OAuth token, trying new login...');

		self.yt_api_handler.oauth_login().then( credentials => {
			self.log('info', 'OAuth login successful');
			self.config.auth_token = JSON.stringify(credentials);
			self.saveConfig();

			self.log('debug', 'Initializing with the new token...');
			self.init_api_from_token_text(self.config.auth_token);

		}).catch( err => {
			self.log('warn', 'OAuth login failed: ' + err);
			self.status(self.STATUS_ERROR, 'OAuth login failed: ' + err);

			self.config.auth_token = '';
			self.saveConfig();
		});

	} else if (!self.config.auth_token && !is_config) {
		self.log('warn', 'No OAuth authorization present, please reconfigure the module');
		self.status(self.STATUS_ERROR, 'No OAuth authorization present, please reconfigure the module');

	} else if (self.config.auth_token) {
		self.log('debug', 'Found existing OAuth token, proceeding directly');
		self.init_api_from_token_text(self.config.auth_token);
	}
};

instance.prototype.init_api_from_token_text = function(token_text) {
	var self = this;

	var token_object;
	try {
		token_object = JSON.parse(token_text);
	} catch (err) {
		self.log('warn', 'Authorization token is corrupted, please request new login');
		self.status(self.STATUS_ERROR, 'Authorization token is corrupted, please request new login');
		return;
	}

	self.init_api_from_token_object(token_object);
};

instance.prototype.init_api_from_token_object = function(credentials) {
	var self = this;

	self.yt_api_handler.oauth2client.setCredentials(credentials);
	self.yt_api_handler.create_yt_service();

	self.yt_api_handler.get_all_broadcasts().then( streams_dict => {
		self.yt_api_handler.streams_dict = streams_dict;
		

		self.log('debug', 'YT broadcast query successful: ' + JSON.stringify(self.yt_api_handler.streams_dict));
		self.actions();
		self.broadcast_state_refresh_interval = setInterval(self.update_broadcasts_state.bind(self), 20000);
		self.init_feedbacks();

		self.log('info', 'YT Module initialized successfully');
		self.status(self.STATUS_OK);

	}).catch( err => {
		self.log('warn', 'YT broadcast query failed: ' + err);
		self.status(self.STATUS_ERROR, 'YT Broadcast query failed: ' + err);
	});
};

instance.prototype.destroy = function() {
	var self = this;

	clearInterval(self.broadcast_state_refresh_interval);

	if (self.yt_api_handler !== undefined) {
		self.yt_api_handler.destroy();
	}
};

instance.prototype.config_fields = function() {
	var self = this;
	return [
		{
			type: 'text',
			id: 'api-key-info',
			width: 12,
			label: 'OAuth application parameters',
			value: 'Following fields correspond to the Google API Application Credentials. Please see the YouTube Live module setup guide for more info.'
		},
		{
			type: "textinput",
			id: "client_id",
			label: "OAuth client ID",
			width: 12,
			required: true
		},
		{
			type: "textinput",
			id: "client_secret",
			label: "OAuth client secret",
			width: 12,
			required: true
		},
		{
			type: "textinput",
			id: "client_redirect_url",
			label: "OAuth redirect url",
			default: "http://localhost:3000",
			width: 12,
			required: true
		},
		{
			type: 'text',
			id: 'api-key-info',
			width: 12,
			label: 'Cached YouTube bearer token',
			value: 'Following field contains something like a session token - it corresponds to one active access point to a YouTube account.'
		},
		{
			type: "textinput",
			id: "auth_token",
			label: "Authorization token (empty to re-authenticate)",
			width: 12,
			required: false
		}
	]
};

instance.prototype.actions = function(system) {
	var self = this;

	self.streams_list_to_display = [];

	if (self.yt_api_handler !== undefined) {
		for (var key in self.yt_api_handler.streams_dict) {
			self.streams_list_to_display.push({id : key, label : self.yt_api_handler.streams_dict[key]});
		}
	}

	self.setActions({
		"start_stream": {
			label: "Start stream",
			options: [{
				type: "dropdown",
				label: "Stream:",
				id: "stream_to_start",
				choices: self.streams_list_to_display
			}]
		},
		"stop_stream": {
			label: "Stop stream",
			options: [{
				type: "dropdown",
				label: "Stream:",
				id: "stream_to_stop",
				choices: self.streams_list_to_display
			}]
		},
		"toggle_stream": {
			label: "Toggle stream",
			options: [{
				type: "dropdown",
				label: "Stream:",
				id: "stream_to_toggle",
				choices: self.streams_list_to_display
			}]
		}
	});
	self.system.emit('instance_actions', self.id, self.setActions);
};

instance.prototype.action = function(action) {
	var self = this;

	if (action.action == "start_stream") {
		self.yt_api_handler.set_broadcast_live(
			action.options["stream_to_start"]
		).then( response => {
			self.log("info", "YouTube stream was set live successfully");
		}).catch( err => {
			self.log("debug", "Error occured during stream state actualization, details: " + err);
		});

	} else if (action.action == "stop_stream") {
		self.yt_api_handler.set_broadcast_finished(
			action.options["stream_to_stop"]
		).then( response => {
			self.log("info", "YouTube stream finished successfully");
		}).catch( err => {
			self.log("debug","Error occured during finishing a stream, details: " + err);
		});
	} else if (action.action == "toggle_stream") {
		let id = action.options["stream_to_toggle"];

		self.yt_api_handler.get_broadcast(id).then( response => {
			let status = response.status.lifeCycleStatus;
			self.log("debug", "Status of stream to toggle is " + status);

			switch (status) {
				case StreamLifecycle.Ready:
				case StreamLifecycle.TestStarting:
				case StreamLifecycle.TestRunning:
					self.log("debug", "Starting stream " + id);
					return self.yt_api_handler.set_broadcast_live(id);

				case StreamLifecycle.LiveStarting:
				case StreamLifecycle.LiveRunning:
					self.log("debug", "Ending stream " + id);
					return self.yt_api_handler.set_broadcast_finished(id);

				case StreamLifecycle.Revoked:
					throw new Error("Stream is revoked");
				case StreamLifecycle.Created:
					throw new Error("Stream is not configured properly");
				case StreamLifecycle.Complete:
					throw new Error("Stream is completed");
				default:
					throw new Error("Unknown stream status");
			}
		}).then( response => {
			self.log("debug", "Stream toggled successfully");
		}).catch( err => {
			self.log("warn", "Error occured during stream toggling, details: " + err);
		});
	}
}
instance.prototype.init_feedbacks = function() {
	var self = this;

	var feedbacks = {};

	self.streams_list_to_display = [];

	if (self.yt_api_handler !== undefined) {
		for (var key in self.yt_api_handler.streams_dict) {
			self.streams_list_to_display.push({id : key, label : self.yt_api_handler.streams_dict[key]});
		}
	}

	feedbacks["broadcast_status"] = {
		label: "Broadcast status",
		description: "Feedback providing information about state of a broadcast in a broadcast lifecycle",
		options: [
			{
				type: "colorpicker",
				label: "Background color (live)",
				id: "bg_live",
				default: self.rgb(255,0,0)
			},
			{
				type: "colorpicker",
				label: "Background color (testing)",
				id: "bg_testing",
				default: self.rgb(255,255,0)
			},
			{
				type: "colorpicker",
				label: "Background color (complete)",
				id: "bg_complete",
				default: self.rgb(0,0,255)
			},
			{
				type: "colorpicker",
				label: "Background color (ready)",
				id: "bg_ready",
				default: self.rgb(0,255,0)
			},
			{
				type: "dropdown",
				label: "Broadcast",
				id: "broadcast",
				choices: self.streams_list_to_display
			}
		]
	}
	self.setFeedbackDefinitions(feedbacks);
}

instance.prototype.feedback = function(feedback) {
	var self = this;

	if (feedback.type === "broadcast_status") {
		switch(self.broadcasts_states_dict[feedback.options.broadcast]) {
			case StreamLifecycle.LiveRunning:
				return {bgcolor: feedback.options.bg_live};
			case StreamLifecycle.TestRunning:
				return {bgcolor: feedback.options.bg_testing};
			case StreamLifecycle.Complete:
				return {bgcolor: feedback.options.bg_complete};
			case StreamLifecycle.Ready:
				return {bgcolor: feedback.options.bg_ready};
		}
	}
}

instance.prototype.update_broadcasts_state = function() {
	var self = this;

	self.yt_api_handler.get_all_broadcasts_state().then(broadcasts_state_dict => {
		self.broadcasts_states_dict = broadcasts_state_dict;
		self.checkFeedbacks("broadcast_status");
		return;
	});
}

// https://developers.google.com/youtube/v3/live/docs/liveBroadcasts#status.lifeCycleStatus
const StreamLifecycle = {
	Revoked: 'revoked',
	Created: 'created',
	Ready:   'ready',
	TestStarting: 'testStarting',
	TestRunning:  'testing',
	LiveStarting: 'liveStarting',
	LiveRunning:  'live',
	Complete: 'complete'
};
Object.freeze(StreamLifecycle);

class Youtube_api_handler {
	constructor(client_id, client_secret, redirect_url, scopes, log) {
		this.streams_dict  = {};
		this.client_id     = client_id;
		this.client_secret = client_secret;
		this.redirect_url  = redirect_url;
		this.scopes        = scopes;
		this.log           = log;
		this.server        = null;
		this.oauth2client = new google.auth.OAuth2(
			this.client_id,
			this.client_secret,
			this.redirect_url
		);
		google.options({auth: this.oauth2client});
	}

	destroy() {
		if (this.server !== null) {
			this.log('debug', 'destroying orphaned OAuth callback server');
			this.server.destroy();
			this.server = null;
		}
	}

	async oauth_login() {
		return new Promise((resolve, reject) => {
			if (this.server !== null) {
				this.log('warn', 'Cannot start new OAuth authorization - already running');
				reject(new Error('OAuth authorization server is already running'));
			}

			// grab the url that will be used for authorization
			const authorizeUrl = this.oauth2client.generateAuthUrl({
			  access_type: 'offline',
			  prompt: 'consent',
			  scope: this.scopes.join(' '),
			});

			// start the callback server
			this.server = http.createServer(async (req, res) => {
				try {
					const address = url.parse(req.url, true);
					const query   = address.query;
					this.log('debug', 'Received callback at path ' + address.pathname);

					if (query.code) {
						this.log('debug', 'Callback OK');

						const {tokens} = await this.oauth2client.getToken(query.code);

						res.writeHead(200, {'Content-Type': 'text/plain'});
						res.end('Authorization successful! You can now close this window.');

						this.server.destroy();
						this.server = null;
						resolve(tokens);

					} else {
						// this may happen for favicon.ico
						this.log('debug', 'Callback KO');
						res.writeHead(400, {'Content-Type': 'text/plain'});
						res.end('Authorization token required');
					}
				} catch (e) {
					this.log('warn', "Callback request processing error; " + req.url + " detail: " + e);
					res.writeHead(500, {'Content-Type': 'text/plain'});
					res.end('Callback processing failed');
					reject(e);
				}
			}).listen(3000, () => {
				// and open the browser to the authorize url to start the workflow
				this.log('debug', 'Opening browser at ' + authorizeUrl);
				opn(authorizeUrl, {wait: false}).then(cp => cp.unref());
			});
			destroyer(this.server);
		});
	}

	async create_yt_service() {
		this.log('debug', "Creating youtube service.");
		this.youtube_service = google.youtube({
			version : "v3",
			auth : this.oauth2client
		});
	}

	async create_live_broadcast(title, scheduled_start_time, record_from_start, enable_dvr, privacy_status) {
		return this.youtube_service.liveBroadcasts.insert({
			"part" : "snippet, contentDetails, staus",
			"resource" : {
				"snippet" : {
					"title" : title,
					"scheduledStartTime" : scheduled_start_time,
				},
				"contentDetails" : {
					"recordFromStart" : record_from_start,
					"enableDvr" : enable_dvr
				},
				"status" : {
					"privacyStatus" : privacy_status
				}
			}
		});
	}

	async create_live_stream() {}

	async get_broadcast(id) {
		let response = await this.youtube_service.liveBroadcasts.list({
			"part": "snippet, contentDetails, status",
			"id": id
		});

		if (response.data.items.length < 1) {
			throw new Error("No stream found with ID " + id);

		} else if (response.data.items.length > 1) {
			throw new Error("Two or more streams found with ID " + id);

		} else {
			return response.data.items[0];
		}
	}

	async get_all_broadcasts() {
		let response = await this.youtube_service.liveBroadcasts.list({
			"part" : "snippet",
			"broadcastType" : "all",
			"mine" : true
		});

		let streams_dict = {};
		response.data.items.forEach( (item, index) => {
			streams_dict[item.id] = item.snippet.title;
		});
		return streams_dict;
	}

	async set_broadcast_live(id) {
		return this.youtube_service.liveBroadcasts.transition({
			"part" : "snippet, contentDetails, status",
			"id" : id,
			"broadcastStatus" : "live"
		});
	}

	async set_broadcast_finished(id) {
		return this.youtube_service.liveBroadcasts.transition({
			"part" : "snippet, contentDetails, status",
			"id" : id,
			"broadcastStatus" : "complete"
		});
	}
	
	async get_all_broadcasts_state() {
		let response = await this.youtube_service.liveBroadcasts.list({
			"part" : "status",
			"broadcastType" : "all",
			"mine" : true
		});

		let broadcasts_states_dict = {};
		response.data.items.forEach( (item, index) => {
			broadcasts_states_dict[item.id] = item.status.lifeCycleStatus
		});
		return broadcasts_states_dict;


	}
}


instance_skel.extendedBy(instance);
exports = module.exports = instance;
