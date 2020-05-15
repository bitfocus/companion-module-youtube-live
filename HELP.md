# companion-module-youtube-live
See HELP.md and LICENSE

## Currently available actions

- **Start stream**
  This action sets staus of predefined YouTube broadcast to _**live**_
- **Stop stream**
  This action sets status of predifined YouTube broadcast to _**finished**_

## Usage

The module is able to only manipulate predefined streams, it is not able to create them currently.
So all streams to be controled by the module should be created in YouTube Studio.

### Authentication of the module to manipulate YouTube account content

In order to set up module correcty, you need to authorize it for accessing YouTube Data API. This is done via Google API console in several steps:

1. Log in into API console with google account ([console.developers.google.com](https://console.developers.google.com/)).
2. Create new project (name of the project doesn't matter, but we suggest something as _companion-yt-control_).
3. Enable YouTube data API v3 in your project - easiest way of doing so is to search for it and on its administartion page click on _enable_.
4. Create credentials for accessing the API.

   From the left panel select _Credentials_ and click _Create credentials_ on the top of the page.
   From the options select _OAuth client ID_. After that, you will be asked to configure _OAuth consent screen_.

   Use these options:
    - User Type: External (do not worry, there is no need to submit the app to verification)
    - Application name: `youtube-live`
    - Scopes for Google APIs: add `/auth/youtube.force-ssl`

   After cofiguring OAuth consent screen, it is time for generating access information.

5. Head to _credentials_ page and at the top click on _create credentials_ and select _OAuth client ID_.

   Create the client ID with these options:
     - Aplication type: Web aplication
     - Name is not important, its only used to identify created credentials in the API console
     - Authorized redirect URLs: This is important for callback from Google OAuth server, so it
       should be the same as the config parameter OAuth redirect url in Companion (by default `http://localshost:3000`)

    After creating these credentials, copy _client ID_ and _client secret_ into correspondig fields in module instance cofiguration in Companion.

6. When first configuring the module the _Authorization token_ field (in instance configuration) should be filled with `login` </li>
7. After applying changes to module configuration, you will be redirected to OAuth consent screen
   in order to authorize module for accessing YouTube account (there you log in to account with which you want the module to interact</li>

When all above is done, the module is ready to work

### Actions configuration

When creating the buttons for either starting the broadcast or stopping the broadcast, the only option there is dropdown menu with titles of all broadcasts on selected YouTube channel. Simply pick the broadcast you want to work with.

### Thanks

Big thanks to members of [AVC Silicon Hill](https://avc.sh.cvut.cz/), for inspiration for further development.
