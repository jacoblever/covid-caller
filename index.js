const Database = require('./database.js')

let db = new Database();
/*
TODO:
- welcome message X
- know X
-- who rang X
-- the time of the call X
-- the call id X
- Change who it says the number is on Anita's phone
- put two calls in a conference X
- cost?
*/

let respondWithXml = (xml) => {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/xml' },
    body: `<?xml version="1.0" encoding="UTF-8"?>${xml}`,
  };
}

let parseQuery = (queryString) => {
  var query = {};
  var pairs = (queryString[0] === '?' ? queryString.substr(1) : queryString).split('&');
  for (var i = 0; i < pairs.length; i++) {
    var pair = pairs[i].split('=');
    query[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
  }
  return query;
}

let getOrCreateConference = async (callId) => {
  let conferencesWithSpace = await db.getJoinableConferences();

  if (conferencesWithSpace.length > 0) {
    let conferenceToJoin = conferencesWithSpace[0];
    await db.joinExistingConference(conferenceToJoin.conferenceName, callId);
    return conferenceToJoin;
  }

  let conferenceName = callId;
  return await db.createConference(conferenceName, callId);
}

exports.incomingCall = async event => {
  let body = parseQuery(event.body);

  let welcomeMessage = "Welcome to COVID Caller! Hold on a moment while we find someone for you to talk to.";
  let callId = body['CallSid'];

  console.log(`Call ${callId}: Sending welcome message...`);
  let responseBody = `
<Response>
  <Say voice="alice">${welcomeMessage}</Say>
  <Redirect method="POST">./find-friend</Redirect>
</Response>`;
  return respondWithXml(responseBody);
};

exports.findFriend = async event => {
  let body = parseQuery(event.body);
  let callId = body['CallSid'];
  console.log(`Call ${callId}: Finding Conference...`);

  var conference = await getOrCreateConference(callId);
  console.log(`Call ${callId}: Joining conference ${conference.conferenceName}`);

  let endMessage = "Your partner has hung up. We hope you enjoyed your conversation with them. See you next time, Goodbye!";
  let responseBody = `
<Response>
  <Dial>
    <Conference
      maxParticipants="2"
      statusCallback="./conference-callback"
      statusCallbackEvent="leave"
      endConferenceOnExit="true">
        ${conference.conferenceName}
    </Conference>
  </Dial>
  <Say voice="alice">${endMessage}</Say>
</Response>`;
  return respondWithXml(responseBody)
};

exports.conferenceCallback = async event => {
  let body = parseQuery(event.body);
  let callId = body['CallSid'];
  if (body['StatusCallbackEvent'] === 'participant-leave') {
    let conferenceName = body['FriendlyName'];
    await db.endConference(conferenceName);
    console.log(`Call ${callId}: Left conference ${conferenceName}`);
  }
  return { statusCode: 204 };
};
