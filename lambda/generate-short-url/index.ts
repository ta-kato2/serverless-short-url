import { APIGatewayProxyEvent, APIGatewayProxyResultV2 } from "aws-lambda";
import {
  DynamoDBClient,
  QueryCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";

type RequestBody = {
  url: string;
};

exports.handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResultV2> => {
  const body = JSON.parse(event.body!) as RequestBody;
  const record = await selectDB(body.url);
  if (record.Items!.length > 0) {
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Origin": "*", //TODO
      },
      body: JSON.stringify({ hash: record.Items![0].SHORT_URL_HASH.S }),
    };
  }

  const hash = generateHash();
  await insertDB(body.url, hash);
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Origin": "*", //TODO
    },
    body: JSON.stringify({ hash: hash }),
  };
};

const selectDB = async (originalUrl: string) => {
  const dynamoDBClient = new DynamoDBClient({});
  return await dynamoDBClient.send(
    new QueryCommand({
      TableName: "URL_MAPPING",
      IndexName: "ORIGINAL_URL_INDEX",
      KeyConditionExpression: "ORIGINAL_URL = :originalUrl",
      ExpressionAttributeValues: {
        ":originalUrl": { S: originalUrl },
      },
    })
  );
};

const insertDB = async (originalUrl: string, shortUrlHash: string) => {
  const dynamoDBClient = new DynamoDBClient({});
  await dynamoDBClient.send(
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
