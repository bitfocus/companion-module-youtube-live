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

	return self;
};

instance.prototype.updateConfig = function(config) {
	var self = this;
	self.config = config;
	console.log("Update config YT_module")
	self.destroy();
	self.init();
}

instance.prototype.init = function() {
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
		scopes
	);

	if (self.config.auth_token == 'login') {
		self.log('info', 'New OAuth login requested...');

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

	} else if (self.config.auth_token) {
		self.log('debug', 'Found existing OAuth token, proceeding directly');
		self.init_api_from_token_text(self.config.auth_token);

	} else {
		self.log('warn', 'No authorization token found, please request new login');
		self.status(self.STATUS_ERROR, 'No authorization token found, please request new login');
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

		self.log('info', 'YT Module initialized successfully');
		self.status(self.STATUS_OK);

	}).catch( err => {
		self.log('warn', 'YT broadcast query failed: ' + err);
		self.status(self.STATUS_ERROR, 'YT Broadcast query failed: ' + err);
	});
};

instance.prototype.destroy = function() {
	var self = this;
	self.stream_to_start_list = [];
	self.stream_to_stop_list  = [];
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
			label: "Authorization token ('login' to re-authenticate)",
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
	}
}

class Youtube_api_handler {
	constructor(client_id, client_secret, redirect_url, scopes) {
		this.streams_dict  = {};
		this.client_id     = client_id;
		this.client_secret = client_secret;
		this.redirect_url  = redirect_url;
		this.scopes        = scopes;
		this.oauth2client = new google.auth.OAuth2(
			this.client_id,
			this.client_secret,
			this.redirect_url
		);
		google.options({auth: this.oauth2client});
	}
	async oauth_login() {
		return new Promise((resolve, reject) => {
			// grab the url that will be used for authorization
			const authorizeUrl = this.oauth2client.generateAuthUrl({
			  access_type: 'offline',
			  scope: this.scopes.join(' '),
			});
			console.log(authorizeUrl);
			const server = http
			  .createServer(async (req, res) => {
				try {
					console.log(req.url);
					if (req.url.indexOf("code=") !== -1) {
						const qs = new url.URL(req.url, 'http://localhost:3000')
						.searchParams;
						console.log(qs)
						res.end('Authentication successful! Please return to the Companion.');
						console.log("Code: " + qs.get("code"));
						const {tokens} = await this.oauth2client.getToken(qs.get('code'));
						console.log("Credentials: " + tokens);
						server.destroy();
						resolve(tokens);
					}
				} catch (e) {
				  console.log("Callback request processing error; " + req.url + " detail: " + e);
				  reject(e);
				}
			  })
			  .listen(3000, () => {
				// open the browser to the authorize url to start the workflow
				opn(authorizeUrl, {wait: false}).then(cp => cp.unref());
			  });
			destroyer(server);
			console.log("Server destroyed");
		  });
		}
	async create_yt_service() {
		console.log("Creating youtube service.");
		this.youtube_service = google.youtube({
			version : "v3",
			auth : this.oauth2client
		});
	}
	async create_live_broadcast(title, scheduled_start_time, record_from_start, enable_dvr, privacy_status) {
		return new Promise((resolve, reject) => {
			this.youtube_service.liveBroadcasts.insert({
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
			}).then( response => {
				console.log("Broadcast created successfully ; details: " + response);
				resolve(response);
			}, err => {
				console.log("Error during execution of create live broadcast action ; details: " + err);
				reject(err);
			})
		});
	}
	async create_live_stream() {}

	async get_all_broadcasts() {
		return new Promise((resolve, reject) => {
			this.youtube_service.liveBroadcasts.list({
				"part" : "snippet, contentDetails, status",
				"broadcastType" : "all",
				"mine" : true
			}).then( response => {
				let streams_dict = {};
				response.data.items.forEach( (item, index) => {
					streams_dict[item.id] = item.snippet.title;
				})
				resolve(streams_dict);
			}, err => {
				Console.log("Error retreaving list of streams")
				reject(err);
			});
		});
	}

	async set_broadcast_live(id) {
		return new Promise((resolve, reject) => {
			this.youtube_service.liveBroadcasts.transition({
				"part" : "snippet, contentDetails, status",
				"id" : id,
				"broadcastStatus" : "live"
			}).then( response => {
				resolve(response);
			}, err => {
				reject(err);
			});
		});
	}

	async set_broadcast_finished(id) {
		return new Promise((resolve, reject) => {
			this.youtube_service.liveBroadcasts.transition({
				"part" : "snippet, contentDetails, status",
				"id" : id,
				"broadcastStatus" : "complete"
			}).then( response => {
				resolve(response);
			}, err => {
				reject(err);
			});
		});
	}
}


instance_skel.extendedBy(instance);
exports = module.exports = instance;
