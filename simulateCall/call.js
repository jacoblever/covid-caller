const axios = require('axios');
const querystring = require('querystring');
const xml2js = require('xml2js');
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

let run = async (host) => {
    try {
        let callId = uuidv4();
        
        console.log("POST /incoming-call - start");
        let incomingResponse = await axios.post(`${host}/incoming-call`, querystring.stringify({ CallSid: callId }));
        console.log(incomingResponse.data);
        console.log("POST /incoming-call - done");

        await sleep(2000);
        
        console.log("POST /find-friend - start");
        let friendResponse = await axios.post(`${host}/find-friend`, querystring.stringify({ CallSid: callId }));
        console.log(friendResponse.data);
        let parsedFriendResponse = await xml2js.parseStringPromise(friendResponse.data);
        console.log("POST /find-friend - done");
        let conferenceName = parsedFriendResponse['Response']['Dial'][0]['Conference'][0]['_'].trim();
        
        await askToHangup();

        console.log("POST /conference-callback - start");
        let confCallbackData = { CallSid: callId, StatusCallbackEvent: 'participant-leave', FriendlyName: conferenceName }
        let confCallbackResponse = await axios.post(`${host}/conference-callback`, querystring.stringify(confCallbackData));
        console.log(confCallbackResponse.data);
        console.log("POST /conference-callback - done");
        process.exit(0);
    } catch (err) {
        console.log(err);
    }
}

run('http://localhost:3000');
