const axios = require('axios');
const querystring = require('querystring');
const xml2js = require('xml2js');
const url = require('url');
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

const sleep = (timeout) => new Promise((resolve, reject) => setTimeout(resolve, timeout));

let uuidv4 = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

let askToHangup = () => {
    return new Promise((resolve, reject) => {
        readline.question('Press enter to hangup', (input) => resolve() );
    });
}

let post = async (url, data) => {
    console.log(`POST ${url.toString()} - start`);

    let response = await axios.post(url.toString(), querystring.stringify(data));
    console.log(response.data);

    console.log(`POST ${url.toString()} - done`);
    return response.data;
};

let incomingCall = async (url, callId) => {
    let response = await post(url, { CallSid: callId });
    let parsed = await xml2js.parseStringPromise(response);

    let redirectUrl = parsed['Response']['Redirect'][0]['_'].trim();
    return { redirectUrl: redirectUrl };
};

let findFreind = async (url, callId) => {
    let response = await post(url, { CallSid: callId });
    let parsed = await xml2js.parseStringPromise(response);

    let conferenceName = parsed['Response']['Dial'][0]['Conference'][0]['_'].trim();
    let statusCallbackUrl = parsed['Response']['Dial'][0]['Conference'][0]['$']['statusCallback'].trim();
    return { conferenceName: conferenceName, statusCallbackUrl: statusCallbackUrl };
};

let conferenceCallback = async (url, callId, conferenceName) => {
    let confCallbackData = { CallSid: callId, StatusCallbackEvent: 'participant-leave', FriendlyName: conferenceName }
    await post(url, confCallbackData);
    return;
};

let run = async (host) => {
    try {
        let callId = uuidv4();
        let incomingCallUrl = new url.URL('./incoming-call', host);
    
        let findFreindRelativeUrl = (await incomingCall(incomingCallUrl, callId)).redirectUrl;
        let findFreindUrl = new url.URL(findFreindRelativeUrl, host);

        await sleep(500);
        
        let { conferenceName, statusCallbackUrl } = await findFreind(findFreindUrl, callId);
        let conferenceCallbackUrl = new url.URL(statusCallbackUrl, host);

        await askToHangup();

        await conferenceCallback(conferenceCallbackUrl, callId, conferenceName);

        process.exit(0);
    } catch (err) {
        console.log(err);
        process.exit(1);
    }
}

var host = 'http://localhost:3000/';
if (process.argv.includes('--prod')) {
    host = 'https://covid-caller.jacoblever.dev/';
}

run(host);
