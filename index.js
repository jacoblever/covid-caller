const AWS = require('aws-sdk');

AWS.config.update({region:  process.env.AWS_REGION});

const ddb = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: process.env.AWS_REGION });

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
  let queryParams = {
    TableName: process.env.DYNAMO_DB_TABLE_NAME,
    IndexName: 'JoinableConferences',
    KeyConditionExpression: 'isJoinable = :val',
    ExpressionAttributeValues: {
      ':val': 'yes',
    }
  };
  let conferencesWithSpace = (await ddb.query(queryParams).promise()).Items;

  if (conferencesWithSpace.length > 0) {
    let conferenceToJoin = conferencesWithSpace[0];
    
    let updateParams = {
      TableName: process.env.DYNAMO_DB_TABLE_NAME,
      Key: { conferenceName: conferenceToJoin.conferenceName },
      UpdateExpression: 'add participants :participant remove isJoinable',
      ExpressionAttributeValues: {
        ':participant' : ddb.createSet([callId]),
      }
    };
    await ddb.update(updateParams).promise();
    return conferenceToJoin;
  }

  let conferenceName = callId;

  let conference = {
    conferenceName: conferenceName,
    participants: ddb.createSet([callId]),
    isJoinable: 'yes',
    ended: false,
  };

  let params = {
    TableName: process.env.DYNAMO_DB_TABLE_NAME,
    Item: conference,
  };
  await ddb.put(params).promise();
  return conference;
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

    let updateParams = {
      TableName: process.env.DYNAMO_DB_TABLE_NAME,
      Key: { conferenceName: conferenceName },
      UpdateExpression: 'set ended=:true remove isJoinable',
      ExpressionAttributeValues: {
        ':true' : true,
      }
    };
    await ddb.update(updateParams).promise();
    console.log(`Call ${callId}: Left conference ${conferenceName}`);
  }
  return { statusCode: 204 };
};
