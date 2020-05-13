# companion-module-youtube-live
See HELP.md and LICENSE
<h1>Currently available actions</h1>
<p>
    <ul>
        <li>
            <b>Start stream</b>
            <p>
            This action sets staus of predefined YouTube broadcast to <i><b>live</b></i>
            </p>
        </li>
        <li>
            <b>Stop stream</b>
            <p>
            This action sets status of predifined YouTube broadcast to <i><b>finished</b></i>
            </p>
        </li>
    </ul>
</p>
<h1>Usage</h1>
<p>
    <ul>
        <li>
        The module is able to only manipulate predefined streams, it is not able to create them currently. So all streams to be controled by the module should be created in YouTube Studio
        </li>
        <li>
        <b>Authentication of the module to manipulate YouTube account content</b>
        <p>
        In order to set up module correcty, you need to authorize it for accessing YouTube Data API. This is done via Google API console in several steps:
        <ol>
            <li>Log in into API console with google account (<a href="console.developers.google.com">console.developers.google.com</a>)</li>
            <li>
            Create new project (name of the project doesn't matter, but we suggest something as <i>companion-yt-control</i>)
            </li>
            <li>
            Enable YouTube data API v3 in your project - easiest way of doing so is to search for it and on its administartion page click on  <i>enable</i>
            </li>
            <li>
            Create credentials for accessing the API.
            <br>
            From the left panel select <i> Credentials </i> and click <i> Create credentials </i> on the top of the page. From the options select <i> OAuth client ID </i>. After that, you will be asked to configure <i> OAuth consent screen </i>
            <br>
            Use these options
            <ul>
            <li>User Type: External (do not worry, there is no need to submit the app to verification)</li>
            <li>Application name: youtube-live</li>
            <li>Scopes for Google APIs: add <i> /auth/youtube.force-ssl </i>
            </ul> 
            <br>
            After cofiguring OAuth consent screen, it is time for generating access information
            </li>
            <li>
            Head to <i> credentials </i> page and at the top click on <i> create credentials </i> and select <i> OAuth client ID </i>
            <br>
            Create the client ID with these options:
            <ul>
                <li>Aplication type: Web aplication</li>
                <li>Name is not important, its only used to identify created credentials in theAPI console</li>
                <li>Authorized redirect URLs: This is important for callback from Google OAuth server, so it should be the same as the config parameter OAuth redirect url in Companion (by default http://localshost:3000)</li>
            </ul>
            <br>
            After creating these credentials, copy <i> client ID </i> and <i> client secret </i> into correspondig fields in module instance cofiguration in Companion
            <li>When first configuring the module the <i> Authorization token </i> field (in instance configuration) should be filled with <i><b> login </b></i> </li>
            <li>After applying changes to module configuration, you will be redirected to OAuth consent screen in order to authorize module for accessing YouTube account (there you log in to account with which you want the module to interact</li>
         </ul>
         <br>
        </p>
    </ol>
    When all above is done, the module is ready to work
</p>
<h2>Actions configuration</h2>
<p>
When creating the buttons for either starting the broadcast or stopping the broadcast, the only option there is dropdown menu with titles of all broadcasts on selected YouTube channel. Simply pick the broadcast you want to work with.
</p>
<h2>Thanks</h2>
<p>
Big thanks to members of <a href="https://avc.sh.cvut.cz/"> AVC Silicon Hill </a>, for inspiration for further development.
</p>