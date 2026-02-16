# YouTube Live

This module allows you to control YouTube live events/broadcasts.

Every action and feedback works upon a specified broadcast. The broadcast is
specified either by selecting it from a dropdown populated with recent
broadcasts that the action might be performed upon, or by specifying its ID (the
part after the `?v=...` in a YouTube video URL) as textual input. A checkbox
switches between the two modes.

The module can create new broadcasts and manipulate existing ones.

## Available actions

- **Start broadcast test** - This action initializes the broadcast. You'll need
  to explicitly use this only if you want to launch the so-called "monitor
  stream" of a broadcast. The same goal can be achieved by visiting the Live
  Control Room of the broadcast when stream video data is being sent to YouTube.
- **Go live** - This action starts the broadcast, making it viewable by the
  broadcast's audience.
- **Finish broadcast** - This action ends an active YouTube broadcast.
- **Advance broadcast to next phase** - This action transitions a broadcast to
  its next phase, whatever it might be: off → testing → live → finished.
- **Refresh broadcast/stream feedbacks** - This action refreshes the broadcast
  lifecycle status/stream health and their feedbacks/variables. This can
  typically be useful for quickly checking if your RTMP stream data has
  successfully reached the corresponding YouTube endpoint.
- **Reload everything from YouTube** - This action forces all cached data to be
  reloaded from YouTube. Use this action to make broadcasts created after
  Companion startup appear in the Companion UI.
- **Send message to live chat** - This action sends a message (200 chars max.)
  to a YouTube broadcast's live chat.
- **Insert advertisement (cuepoint)** - This action inserts an advertisement in
  the YouTube broadcast.
- **Set visibility** - This action sets the visibility (publicly viewable and
  listed in your YouTube channel, publicly viewable but unlisted in your
  channel, privately viewable only by specific people) of the specified
  broadcast.
- **Set title** - This action sets the title of the specified broadcast.
- **Set description** - This action sets the description of the specified
  broadcast.
- **Prepend text to description** - This action inserts the given text at
  beginning of the description.
- **Append text to description** - This action inserts the given text at end of
  the description.
- **Add chapter timecode to description** - This action inserts a chapter
  timecode at the end of the description.
- **Create new broadcast** - This action creates a new YouTube broadcast with
  the specified settings. Supports using an existing broadcast as a template to
  copy settings from (title, description, monitor stream, and stream binding).
  Options include scheduled start time (now, minutes from now, or custom ISO
  8601), privacy status, auto-start/auto-stop, thumbnail upload, and stream
  binding.
- **Set broadcast thumbnail** - This action uploads and sets a custom thumbnail
  image for a broadcast. Accepts a local file path or URL to a JPEG/PNG image
  (max 2MB).
- **Bind stream to broadcast** - This action binds a video stream to a
  broadcast, which is required before going live. Select a stream from the
  dropdown or enter a stream ID manually.

[ytapi]: https://developers.google.com/youtube/v3/live/docs/liveBroadcasts/transition

## Configuration

To use Companion to manipulate the YouTube broadcasts in a YouTube channel,
you'll need to perform some Google/YouTube setup.

### Create a Google Cloud project

First, create a Google Cloud project (or select an existing one) to host a
Google Cloud application that Companion can manipulate to perform actions.

1. Open the [Google Cloud Console](https://console.cloud.google.com/home/dashboard)
   and select "Create a Project".
   - Name it whatever you want -- the name won't appear anywhere visible to
     anyone using Companion.
2. Select the project once you've created it, using the "Select" UI that appears
   for it.
3. Under "Getting Started" on the project dashboard, select "Explore and enable
   APIs", then click "Enable APIs and services".
4. Find the "YouTube Data API v3" API, click on it, then click "Enable" in the
   API's overview page.

### Create an application

Next create a Google Cloud application in the project to manipulate YouTube
channel broadcasts.

1. Go to [https://console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials).
2. Click the "Configure consent screen" button, then click "Get started".
3. Under "App Information":
   - Enter a name for the application that will be displayed when you grant
     consent to the application to manipulate your YouTube channel.
   - Enter an email address for "support" for the application, that will be
     displayed during the consent process. (This should probably be your own
     email address.)
4. Under "Audience":
   - Select "External". (This audience will be narrowed to specific test users
     shortly.)
   - (Unfortunately, if you're using a Google account in a Google Workspace, the
     "Internal" audience type won't work to manipulate a YouTube brand account
     within that Workspace -- only to manipulate non-brand YouTube channels.
     This is a [known](https://issuetracker.google.com/issues/218885162)
     [issue](https://issuetracker.google.com/issues/188719921): the recommended
     workaround is to set it to "External" audience and add specific test users,
     i.e. to do what this document recommends.)
5. Under "Contact Information", use your own email address.

Then give the application the power to edit YouTube broadcast data:

1. Go to [https://console.cloud.google.com/auth/scopes](https://console.cloud.google.com/auth/scopes).
2. Click "Add or remove scopes".
3. Add `https://www.googleapis.com/auth/youtube.force-ssl` as a scope.
4. Click "Save" at bottom of the page.

### Create application credentials and enter them in Companion

Create application credentials (a client ID and a client secret) that can be
used to connect to the application.

1. Within your project, click on "Clients", then the "+ Create client" button.
2. Select the "Web application" application type.
3. Give the client whatever name you want, for example "YouTube Companion app".
   (This only appears in the Google Cloud interface.)
4. In the "Authorized redirect URIs" section, specify a URL on `localhost` that
   includes a port number that isn't in use.
   - For example, if loading [`http://localhost:3000`](http://localhost:3000)
     displays a "Site not found" page when you click it, you could enter
     `http://localhost:3000`.
   - Or if `3000` loads, instead try some other random number: `9362` or
     `28667`, say. (It can be pretty much any positive number smaller than
     `65536`, but avoid using numbers smaller than `1000`.)
5. Copy/paste the URL you set as an authorized redirect URI into the Companion
   **OAuth redirect URL** setting _exactly as written_.
   - _Don't accidentally add a trailing slash or whitespace!_
6. Click "Create".

A dialog will display, showing the created client ID and a client secret. (The
client secret will be inaccessible once you close the dialog, so if you lose it,
you'll have to create new credentials.) The created client ID and client secret
should look something like this:

|                   | **Value**                                                                  |
| ----------------- | -------------------------------------------------------------------------- |
| **Client ID**     | `123456789012-abcdef1ghij2klmno34pqr56stu7vwxy.apps.googleusercontent.com` |
| **Client secret** | `ABCDEF-GH1iJkl2mnoPQrsTuvwx3YZABcdE`                                      |

Copy/paste these into Companion connection settings, then save settings.

### Set the audience for your application

Next, allow your Google account to access the application by adding your account
(and any others you want to have access) as a permitted user of it, if
necessary. (An "Internal" user type will not require this, but it may require
other steps be taken to register users for access that are beyond the scope of
this document. And if you have the resources to get an "External" app fully
reviewed, you probably shouldn't be relying on these instructions!)

1. Go to [https://console.cloud.google.com/auth/audience](https://console.cloud.google.com/auth/audience).
2. With an "External" user type in "Testing" status, you must manually add your
   Google account as a user.
   - Scroll down to the "Test users" section, and add the email address of the
     Google account you want to use to access your YouTube channel.
   - **Note:** Each time you give consent for YouTube to allow Companion to
     manipulate your YouTube broadcasts, you'll have to ignore a warning about
     the app being in testing.

### Give consent to YouTube to perform YouTube operations as requested by Companion

Finally, open the YouTube consent screen for your Google Cloud application by
clicking the link in connection settings. (The full consent link is also logged
in the connection log after you click the link in settings.) Instructions for
completing the consent process can be found underneath that link.

Consent while in "Testing" status only lasts a week. After that you'll have to
reopen the consent screen and recomplete the consent process.

## Available feedbacks

- **Broadcast status** - Changes button colors based on the broadcast lifecycle
  state (ready, testing, live, complete). Colors are configurable.
- **Health of stream bound to broadcast** - Changes button colors based on the
  health of the video stream bound to a broadcast (good, ok, bad, no data).

## Available variables

Per-broadcast variables (where `ID` is the YouTube broadcast ID):

- `broadcast_ID_lifecycle` - Lifecycle state of the broadcast
- `broadcast_ID_health` - Health of the stream bound to the broadcast

Unfinished broadcast variables (where `N` is the index, starting from 0):

- `unfinished_N` - Name of unfinished broadcast #N
- `unfinished_N_id` - ID of unfinished broadcast #N
- `unfinished_short_N` - Shortened name of unfinished broadcast #N
- `unfinished_state_N` - State of unfinished broadcast #N
- `unfinished_health_N` - Stream health of unfinished broadcast #N
- `unfinished_concurrent_viewers_N` - Concurrent viewers of unfinished broadcast #N

Global variables:

- `last_created_broadcast_id` - ID of the most recently created broadcast (via
  the "Create new broadcast" action)

## Action configuration

When creating actions to operate upon a broadcast, pick the broadcast to work
with from the dropdown menu. The dropdown will contain all previously created
broadcasts that the action might be performed on _eventually_: for example, the
action to start a broadcast will list unstarted broadcasts while omitting those
already started, while the action to send a message to live chat will list
unstarted and live broadcasts but will omit completed broadcasts.

Alternatively, if you have the YouTube broadcast ID, you can check the checkbox
to switch to a text input and enter it there. The text field supports
variables, so you can also store the broadcast ID in a variable and change that
variable as needed.

### Using templates with Create broadcast

When creating a broadcast, you can check "Use existing broadcast as template" to
copy settings from an existing broadcast. Template values serve as defaults:
any value you explicitly set will override the template. This is useful for
creating broadcasts with consistent settings. The template's description,
monitor stream setting, and stream binding will be copied if you don't provide
your own.

### Using the last created broadcast ID

After creating a broadcast, its ID is stored in the `last_created_broadcast_id`
variable. You can use this variable in subsequent actions (via text input mode)
to operate on the newly created broadcast without knowing its ID in advance.

## Thanks

Big thanks to members of [AVC Silicon Hill](https://avc.sh.cvut.cz/) for
inspiration for further development.
