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
		self.config.fetch_max_count || 10,
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

	self.yt_api_handler.get_all_broadcasts().then( broadcasts_dict => {
		self.yt_api_handler.broadcasts_dict = broadcasts_dict;


		self.log('debug', 'YT broadcast query successful: ' + JSON.stringify(self.yt_api_handler.broadcasts_dict));
		self.actions();

		self.update_streams_broadcasts_state();

		self.refresher = setInterval(self.update_streams_broadcasts_state.bind(self), self.config.refresh_interval*1000);

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

	if (self.refresher !== undefined) {
		clearInterval(self.refresher);
		delete self.refresher;
	}

	if (self.yt_api_handler !== undefined) {
		self.yt_api_handler.destroy();
		delete self.yt_api_handler;
	}
};

instance.prototype.config_fields = function() {
	var self = this;
	return [
		{
			type:  'number',
			label: 'How many broadcasts to fetch from YouTube',
			id:    'fetch_max_count',
			width: 6,
			min:  1,
			max: 50,
			default: 10,
			required: true
		},
		{
			type: "number",
			label: "Interval between refreshments of broadcasts statuses and streams health (in seconds)",
			id: "refresh_interval",
			width: 6,
			default: 60,
			required: true
		},
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

	self.broadcasts_list_to_display = [];

	if (self.yt_api_handler !== undefined) {
		for (var key in self.yt_api_handler.broadcasts_dict) {
			self.broadcasts_list_to_display.push({id : key, label : self.yt_api_handler.broadcasts_dict[key]["title"]});
		}
	}

	self.setActions({
		"start_broadcast": {
			label: "Start a broadcast",
			options: [{
				type: "dropdown",
				label: "Broadcast:",
				id: "broadcast_id",
				choices: self.broadcasts_list_to_display
			}]
		},
		"stop_broadcast": {
			label: "Stop a broadcast",
			options: [{
				type: "dropdown",
				label: "Broadcast:",
				id: "broadcast_id",
				choices: self.broadcasts_list_to_display
			}]
		},
		"toggle_broadcast": {
			label: "Toggle a broadcast",
			options: [{
				type: "dropdown",
				label: "Broadcast:",
				id: "broadcast_id",
				choices: self.broadcasts_list_to_display
			}]
		}
	});
	self.system.emit('instance_actions', self.id, self.setActions);
};

instance.prototype.action = function(action) {
	var self = this;

	if (action.action == "start_broadcast") {
		self.yt_api_handler.set_broadcast_state(
			action.options["broadcast_id"],
			BroadcastTransition.ToLive
		).then( response => {
			self.log("info", "YouTube broadcast was set live successfully");
			self.update_streams_broadcasts_state();
		}).catch( err => {
			self.log("debug", "Error occured during broadcast state actualization, details: " + err);
		});

	} else if (action.action == "stop_broadcast") {
		self.yt_api_handler.set_broadcast_state(
			action.options["broadcast_id"],
			BroadcastTransition.ToCompleted
		).then( response => {
			self.log("info", "YouTube broadcast finished successfully");
			self.update_streams_broadcasts_state();
		}).catch( err => {
			self.log("debug","Error occured during finishing a broadcast, details: " + err);
		});
	} else if (action.action == "toggle_broadcast") {
		let id = action.options["broadcast_id"];

		self.do_toggle(id).then( response => {
			self.log("debug", "YouTube broadcast toggled successfully");
			self.update_streams_broadcasts_state();
		}).catch( err => {
			self.log("warn", "Error occured during broadcast toggling, details: " + err);
		});
	}
}

instance.prototype.do_toggle = async function(id) {
	var self = this;

	let status = self.broadcasts_states_dict[id];
	self.log("debug", "Status of broadcast to toggle is " + status);

	switch (status) {
		case BroadcastLifecycle.Ready:
			self.log("debug", "Starting broadcast test " + id);
			return self.yt_api_handler.set_broadcast_state(id, BroadcastTransition.ToTesting);

		case BroadcastLifecycle.TestStarting:
		case BroadcastLifecycle.TestRunning:
			self.log("debug", "Starting broadcast " + id);
			return self.yt_api_handler.set_broadcast_state(id, BroadcastTransition.ToLive);

		case BroadcastLifecycle.LiveStarting:
		case BroadcastLifecycle.LiveRunning:
			self.log("debug", "Ending broadcast " + id);
			return self.yt_api_handler.set_broadcast_state(id, BroadcastTransition.ToCompleted);

		case BroadcastLifecycle.Revoked:
			throw new Error("Broadcast is revoked");
		case BroadcastLifecycle.Created:
			throw new Error("Broadcast is not configured properly");
		case BroadcastLifecycle.Complete:
			throw new Error("Broadcast is completed");
		default:
			throw new Error("Unknown broadcast status");
	}
}

instance.prototype.init_feedbacks = function() {
	var self = this;

	var feedbacks = {};

	self.broadcasts_list_to_display = [];
	self.broadcast_id_stream_id_list = [];
	self.id_list = []

	if (self.yt_api_handler !== undefined) {
		for (var key in self.yt_api_handler.broadcasts_dict) {
			self.broadcasts_list_to_display.push({id : key, label : self.yt_api_handler.broadcasts_dict[key]["title"]});
			self.broadcast_id_stream_id_list.push({id : self.yt_api_handler.broadcasts_dict[key]["bound_stream_id"],
													label : self.yt_api_handler.broadcasts_dict[key]["title"]});
			self.id_list.push(self.yt_api_handler.broadcasts_dict[key]["bound_stream_id"]);
		}
	}
	console.log(self.broadcast_id_stream_id_list);

	feedbacks["broadcast_status"] = {
		label: "Broadcast status",
		description: "Feedback providing information about state of a broadcast in a broadcast lifecycle",
		options: [
			{
				type: "colorpicker",
				label: "Background color (live)",
				id: "bg_live",
				default: self.rgb(222, 0, 0)
			},
			{
				type: "colorpicker",
				label: "Background color (testing)",
				id: "bg_testing",
				default: self.rgb(0, 172, 0)
			},
			{
				type: "colorpicker",
				label: "Background color (complete)",
				id: "bg_complete",
				default: self.rgb(0, 0, 168)
			},
			{
				type: "colorpicker",
				label: "Background color (ready)",
				id: "bg_ready",
				default: self.rgb(209, 209, 0)
			},
			{
				type: "dropdown",
				label: "Broadcast",
				id: "broadcast",
				choices: self.broadcasts_list_to_display
			}
		]
	}

	feedbacks["broadcast_bound_stream_health"] = {
		label: "Health of stream bound to broadcast",
		description: "Feedback reflecting the health of video stream bound to a broadcast",
		options: [
			{
				type: "colorpicker",
				label: "Background color (good)",
				id: "bg_good",
				default: self.rgb(124, 252, 0)
			},
			{
				type: "colorpicker",
				label: "Background color (ok)",
				id: "bg_ok",
				default: self.rgb(0, 100, 0)
			},
			{
				type: "colorpicker",
				label: "Background color (bad)",
				id: "bg_bad",
				default: self.rgb(255, 255, 0)
			},
			{
				type: "colorpicker",
				label: "Background color (No data)",
				id: "bg_no_data",
				default: self.rgb(255, 0, 0)
			},
			{
				type: "dropdown",
				label: "Broadcast",
				id: "broadcast",
				choices: self.broadcast_id_stream_id_list
			}
		]
	}
	self.setFeedbackDefinitions(feedbacks);
}

instance.prototype.feedback = function(feedback) {
	var self = this;

	if (feedback.type === "broadcast_status") {
		switch(self.broadcasts_states_dict[feedback.options.broadcast]) {
			case BroadcastLifecycle.LiveStarting:
			case BroadcastLifecycle.LiveRunning:
				return {bgcolor: feedback.options.bg_live};
			case BroadcastLifecycle.TestStarting:
			case BroadcastLifecycle.TestRunning:
				return {bgcolor: feedback.options.bg_testing};
			case BroadcastLifecycle.Complete:
				return {bgcolor: feedback.options.bg_complete};
			case BroadcastLifecycle.Ready:
				return {bgcolor: feedback.options.bg_ready};
		}
	}

	if (feedback.type === "broadcast_bound_stream_health") {
		switch(self.streams_health_dict[feedback.options.broadcast]) {
			case StreamHealthStatus.Good:
				return {bgcolor: feedback.options.bg_good};
			case StreamHealthStatus.Ok:
				return {bgcolor: feedback.options.bg_ok};
			case StreamHealthStatus.Bad:
				return {bgcolor: feedback.options.bg_bad};
			case StreamHealthStatus.NoData:
				return {bgcolor: feedback.options.bg_no_data};
		}
	}
}

instance.prototype.update_streams_broadcasts_state = function() {
	var self = this;

	self.yt_api_handler.get_all_broadcasts_state().then(broadcasts_state_dict => {
		self.broadcasts_states_dict = broadcasts_state_dict;
		self.checkFeedbacks("broadcast_status");

		self.yt_api_handler.get_all_streams_health(self.id_list).then(streams_health_dict => {
			self.streams_health_dict = streams_health_dict;
			console.log(self.streams_health_dict);
			self.checkFeedbacks("broadcast_bound_stream_health");
			return;
		})
	});
}

// https://developers.google.com/youtube/v3/live/docs/liveBroadcasts#status.lifeCycleStatus
const BroadcastLifecycle = {
	Revoked: 'revoked',
	Created: 'created',
	Ready:   'ready',
	TestStarting: 'testStarting',
	TestRunning:  'testing',
	LiveStarting: 'liveStarting',
	LiveRunning:  'live',
	Complete: 'complete'
};
Object.freeze(BroadcastLifecycle);

// https://developers.google.com/youtube/v3/live/docs/liveBroadcasts#status.lifeCycleStatus
const BroadcastTransition = {
	ToTesting:   'testing',
	ToLive:      'live',
	ToCompleted: 'complete',
};
Object.freeze(BroadcastLifecycle);

// https://developers.google.com/youtube/v3/live/docs/liveStreams#status.healthStatus.status
const StreamHealthStatus = {
	Good: "good",
	Ok: "ok",
	Bad: "bad",
	NoData: "noData"
};
Object.freeze(StreamHealthStatus);

class Youtube_api_handler {
	constructor(client_id, client_secret, redirect_url, scopes, fetch_max, log) {
		this.broadcasts_dict  = {};
		this.client_id     = client_id;
		this.client_secret = client_secret;
		this.redirect_url  = redirect_url;
		this.scopes        = scopes;
		this.log           = log;
		this.server        = null;
		this.fetch_max_cnt = fetch_max;
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

	async get_all_broadcasts() {
		let response = await this.youtube_service.liveBroadcasts.list({
			"part" : "snippet, contentDetails",
			"broadcastType" : "all",
			"mine" : true,
			"maxResults": this.fetch_max_cnt
		});

		let broadcasts_dict = {};
		response.data.items.forEach( (item, index) => {
			broadcasts_dict[item.id] = {"title" : item.snippet.title, "bound_stream_id" : item.contentDetails.boundStreamId}; 
		});
		return broadcasts_dict;
	}

	async set_broadcast_state(id, transition) {
		return this.youtube_service.liveBroadcasts.transition({
			"part" : "id",
			"id" : id,
			"broadcastStatus" : transition
		});
	}

	async get_all_broadcasts_state() {
		let response = await this.youtube_service.liveBroadcasts.list({
			"part" : "status",
			"broadcastType" : "all",
			"mine" : true,
			"maxResults": this.fetch_max_cnt
		});

		let broadcasts_states_dict = {};
		response.data.items.forEach( (item, index) => {
			broadcasts_states_dict[item.id] = item.status.lifeCycleStatus;
		});
		return broadcasts_states_dict;
	}

	async get_all_streams_health(streams_id_list) {
		let streams_states_dict = {};

		let already_seen_list = []
		for(const value of streams_id_list) {
			if (already_seen_list.indexOf(value) == -1) {
				let response = await this.youtube_service.liveStreams.list({
					"part" : "status",
					"id" : value,
					"maxResults" : this.fetch_max_cnt,
				});
				streams_states_dict[value] = response.data.items[0].status.healthStatus.status;
				already_seen_list.push(value);
			}
		}
		return streams_states_dict;
	}
}


instance_skel.extendedBy(instance);
exports = module.exports = instance;
