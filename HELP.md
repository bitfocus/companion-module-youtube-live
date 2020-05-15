## YouTube Live

### Available actions

- **Start stream** - this action starts a YouTube stream and makes it available for viewing.
- **Stop stream**  - this action finishes a YouTube stream.

### Usage

The module is only able to manipulate predefined streams, it is currently not capable of creating them.
So all streams to be controlled by the module have to be created in the YouTube Studio first.

#### Connecting to YouTube account

In order to set up module, you need to authorize it for accessing your channel via the YouTube Data API.
For this you will need to create a new Google API application.
This is done via the Google API console:

1. Log in to the [API console](https://console.developers.google.com/) with your personal Google account.
2. Create a new project (name of the project doesn't matter, but we suggest something as _companion-yt-control_).
3. Enable _YouTube Data API v3_ for the project - the easiest way to do so is to search for it and click on _enable_ on its page.
4. Create credentials for accessing the API:

   From the left panel select _Credentials_ and click _Create credentials_ on the top of the page.
   From the options select _OAuth client ID_. After that, you will be asked to configure _OAuth consent screen_.

   Use these options:
    - User Type: _External_ (do not worry, there is no need to submit the app for verification)
    - Application name: `youtube-live`
    - Scopes for Google APIs: add `/auth/youtube.force-ssl`

5. Head to _credentials_ page and at the top click on _create credentials_ and select _OAuth client ID_.

   Create the client ID with these options:
     - Aplication type: _Web aplication_
     - Name is not important, its only used to identify created credentials in the API console
     - Authorized redirect URLs: This is where the Google OAuth server will forward the credentials, so it
       *must* be the set to the same value as the _OAuth redirect url_ parameter in Companion (by default `http://localhost:3000`)

    After creating these credentials, copy _client ID_ and _client secret_ into correspondig fields in the module instance cofiguration in Companion.

6. When first configuring the module, fill the _Authorization token_ field (in instance configuration) with `login`
7. After applying changes to module configuration, you will be redirected to the OAuth consent screen
   in order to authorize module for accessing your YouTube channel. Log in with the account with which you want the module to interact.

When all above is done, the module is ready for work.

#### Action configuration

When creating buttons for either starting or stopping a broadcast,
you should pick the stream to work with using the provided dropdown menu.
It should contain all streams present on the channel.

### Thanks

Big thanks to members of [AVC Silicon Hill](https://avc.sh.cvut.cz/), for inspiration for further development.