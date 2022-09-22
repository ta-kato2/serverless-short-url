import { APIGatewayProxyEvent, APIGatewayProxyResultV2 } from "aws-lambda";
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";

type RequestBody = {
  url: string;
};

exports.handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResultV2> => {
  const body = JSON.parse(event.body!) as RequestBody;
  const urlMappingRecord = await selectOrInsertDB(body.url);
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Origin": "*", //'https://form.timedesigner.com',
    },
    body: JSON.stringify({ hash: urlMappingRecord.SHORT_URL_HASH.S }),
  };
};

const selectOrInsertDB = async (originalUrl: string): Promise<any> => {
  const record = await selectDB(originalUrl);
  if (record.Item) {
    return record.Item;
  }
  return await insertDB(originalUrl, generateHash());
};

const selectDB = async (shortUrlHash: string) => {
  const dynamoDBClient = new DynamoDBClient({});
  return dynamoDBClient.send(
    new GetItemCommand({
      TableName: "URL_MAPPING",
      Key: {
        SHORT_URL_HASH: { S: shortUrlHash },
      },
    })
  );
};

const insertDB = async (originalUrl: string, shortUrlHash: string) => {
  const dynamoDBClient = new DynamoDBClient({});
  return dynamoDBClient.send(
    new PutItemCommand({
      TableName: "URL_MAPPING",
      Item: {
        SHORT_URL_HASH: { S: shortUrlHash },
        ORIGINAL_URL: { S: originalUrl },
        REGISTER_DATETIME: { S: new Date().toISOString() },
      },
    })
  );
};

function generateHash() {
  let str = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let randstr = "";
  [...Array(10)].forEach(
    () => (randstr += str[~~(Math.random() * str.length)])
  );
  return randstr;
}
