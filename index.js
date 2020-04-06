const express = require('express')

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

let respondWithXml = (response, xml) => {
  response.writeHead(200, {"Content-Type": "text/xml"});
  response.write(`<?xml version="1.0" encoding="UTF-8"?>${xml}`);
  response.end();
}

let getBody = (request) => {
  var promise = new Promise(function(resolve, reject) {
    let body = '';
    request.on('data', chunk => {
        body += chunk.toString(); // convert Buffer to string
    });
  
    request.on('end', () => {
      resolve(parseQuery(body));
    });
  });
  return promise;
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

let getOrCreateConference = (callId) => {
  console.log(`Call ${callId}: db ${db}`);
  let conferencesWithSpace = db.filter(x => {
    return x.participants.length < 2 && x.ended === false
  });
  
  if (conferencesWithSpace.length > 0) {
    let conferenceToJoin = conferencesWithSpace[0];
    conferenceToJoin.participants.push(callId);
    return conferenceToJoin;
  } 

  let conferenceName = callId;
  let conference = {
    name: conferenceName,
    participants: [callId],
    ended: false,
  }
  db.push(conference);
  return conference;
}

const app = express()
const port = 3000

let db = [];

app.post('/', (request, response) => {
  let welcomeMessage = "Welcome to COVID Caller! Hold on a moment while we find someone for you to talk to.";

  getBody(request).then((body) => {
    let callId = body['CallSid'];

    console.log(`Call ${callId}: Sending welcome message...`)
    let responseBody = `
<Response>
  <Say voice="alice">${welcomeMessage}</Say>
  <Redirect method="POST">./find-friend</Redirect>
</Response>`;
  respondWithXml(response, responseBody);
  });
})

app.post('/find-friend', (request, response) => {
  getBody(request).then((body) => {
    let callId = body['CallSid'];

    console.log(`Call ${callId}: Finding Conference...`);
    var conference = getOrCreateConference(callId);
    console.log(`Call ${callId}: Joining conference ${conference.name}`);

    let endMessage = "Your partner has hung up. We hope you enjoyed your conversation with them. See you next time, Goodbye!";
    let responseBody = `
<Response>
  <Dial>
    <Conference
      maxParticipants="2"
      statusCallback="./conference-callback"
      statusCallbackEvent="leave"
      endConferenceOnExit="true">
        ${conference.name}
    </Conference>
  </Dial>
  <Say voice="alice">${endMessage}</Say>
</Response>`;
  respondWithXml(response, responseBody);
  });
})

app.post('/conference-callback', (request, response) => {
  getBody(request).then((body) => {
    let callId = body['CallSid'];
    if (body['StatusCallbackEvent'] === 'participant-leave') {
      let conferenceName = body['FriendlyName'];
      let conference = db.filter(x => x.name === conferenceName)[0];
      if (conference) {
        console.log(`Call ${callId}: Left conference ${conference.name}`);
        conference.ended = true;
      }
    }
  });
})

app.listen(port, () => console.log(`COVID Caller listening at http://localhost:${port}`))
