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
  let conferencesWithSpace = db.filter(x => x.participants.length < 2);
  
  if (conferencesWithSpace.length > 0) {
    let conferenceToJoin = conferencesWithSpace[0];
    conferenceToJoin.participants.push(callId);
    return conferenceToJoin;
  } 

  let conferenceName = callId;
  let conference = {
    name: conferenceName,
    participants: [callId],
  }
  db.push(conference);
  return conference;
}

const app = express()
const port = 3000

let db = [];

app.post('/', (request, response) => {
  let welcomeMessage = "Welcome to COVID Caller! Hold on a moment while we find someone for you to talk to.";
  let timeNow = Date.now();

  getBody(request).then((body) => {
    
    let callerNumber = body['Caller'];
    let callId = body['CallSid'];
    var conference = getOrCreateConference(callId);

    let responseBody = `
<Response>
  <Say voice="alice">${welcomeMessage}</Say>
  <Dial>
    <Conference maxParticipants="2">${conference.name}</Conference>
  </Dial>
</Response>`;
  respondWithXml(response, responseBody);
  });
});

app.listen(port, () => console.log(`COVID Caller listening at http://localhost:${port}`))
