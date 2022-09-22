import { APIGatewayProxyEvent, APIGatewayProxyResultV2 } from "aws-lambda";
import {
  DynamoDBClient,
  GetItemCommand,
} from "@aws-sdk/client-dynamodb";

type RequestBody = {
  hash: string;
};

exports.handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResultV2> => {
  const body = JSON.parse(event.body!) as RequestBody;
  const urlMappingRecord = await selectDB(body.hash);
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Origin": "*", //'https://form.timedesigner.com',
    },
    body: JSON.stringify({
      hash: urlMappingRecord.Item?.SHORT_URL_HASH.S ?? null,
    }),
  };
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
