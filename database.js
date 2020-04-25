const AWS = require('aws-sdk');

AWS.config.update({ region: process.env.AWS_REGION });
// Docs: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB/DocumentClient.html
const ddb = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: process.env.AWS_REGION });

const _24_HOURS = 24 * 60 * 60;

class Database {
  async getJoinableConferences() {
    let queryParams = {
      TableName: process.env.DYNAMO_DB_TABLE_NAME,
      IndexName: 'JoinableConferences',
      KeyConditionExpression: 'isJoinable = :val',
      ExpressionAttributeValues: {
        ':val': 'yes',
      }
    };
    return (await ddb.query(queryParams).promise()).Items;
  }

  async joinExistingConference(conferenceName, callId) {
    let updateParams = {
      TableName: process.env.DYNAMO_DB_TABLE_NAME,
      Key: { conferenceName: conferenceName },
      UpdateExpression: 'add participants :participant remove isJoinable',
      ExpressionAttributeValues: {
        ':participant' : ddb.createSet([callId]),
      }
    };
    await ddb.update(updateParams).promise();
    return true;
  }

  async createConference(conferenceName, callId) {
    let conference = {
      conferenceName: conferenceName,
      participants: ddb.createSet([callId]),
      isJoinable: 'yes',
      ended: false,
      timeToLive: Math.floor((new Date()).getTime() / 1000) + _24_HOURS,
    };
  
    let params = {
      TableName: process.env.DYNAMO_DB_TABLE_NAME,
      Item: conference,
    };
    await ddb.put(params).promise();
    return conference;
  }

  async endConference(conferenceName) {
    let updateParams = {
      TableName: process.env.DYNAMO_DB_TABLE_NAME,
      Key: { conferenceName: conferenceName },
      UpdateExpression: 'set ended=:true remove isJoinable',
      ExpressionAttributeValues: {
        ':true' : true,
      }
    };
    await ddb.update(updateParams).promise();
    return true;
  }
}

module.exports = Database;
