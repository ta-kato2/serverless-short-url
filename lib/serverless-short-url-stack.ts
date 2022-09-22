import * as cdk from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import { Function, Tracing } from "aws-cdk-lib/aws-lambda";
import {
  CompositePrincipal,
  Effect,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
import { Aspects, Duration, RemovalPolicy, Tag } from "aws-cdk-lib";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import {
  CfnApi,
  CfnIntegration,
  CfnRoute,
  CfnStage,
} from "aws-cdk-lib/aws-apigatewayv2";

export class ServerlessShortUrlStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const urlMappingTable = this.createUrlMappingTable();
    const generateShortUrlLambda =
      this.createGenerateShortUrlLambda(urlMappingTable);
    const lookupOriginalUrlLambda =
      this.createLookupOriginalUrlLambda(urlMappingTable);
    this.createApiGateway(generateShortUrlLambda, lookupOriginalUrlLambda);

    Aspects.of(this).add(new Tag("un-owner", "mobile-team-kato"));
  }

  private createUrlMappingTable(): Table {
    const table = new Table(this, "UrlMappingTable", {
      tableName: `URL_MAPPING`,
      partitionKey: {
        name: "SHORT_URL_HASH",
        type: AttributeType.STRING,
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    table.addGlobalSecondaryIndex({
      indexName: "ORIGINAL_URL_INDEX",
      partitionKey: {
        name: "ORIGINAL_URL",
        type: AttributeType.STRING,
      },
    });
    return table;
  }

  private createGenerateShortUrlLambda(urlMappingTable: Table): Function {
    const role = new Role(this, "GenerateShortUrlLambdaRole", {
      assumedBy: new CompositePrincipal(
        new ServicePrincipal("lambda.amazonaws.com")
      ),
    });
    role.addManagedPolicy({
      managedPolicyArn:
        "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
    });
    role.addToPolicy(
      new PolicyStatement({
        actions: ["dynamodb:Query", "dynamodb:PutItem"],
        resources: [`${urlMappingTable.tableArn}*`],
      })
    );

    return new NodejsFunction(this, "GenerateShortUrlLambda", {
      functionName: `GenerateShortUrlLambda`,
      entry: "lambda/generate-short-url/index.ts",
      bundling: {
        minify: true,
        sourceMap: false,
      },
      tracing: Tracing.ACTIVE,
      timeout: Duration.seconds(5),
      role: role,
    });
  }

  private createLookupOriginalUrlLambda(urlMappingTable: Table): Function {
    const role = new Role(this, "LookupOriginalUrlLambdaRole", {
      assumedBy: new CompositePrincipal(
        new ServicePrincipal("lambda.amazonaws.com")
      ),
    });
    role.addManagedPolicy({
      managedPolicyArn:
        "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
    });
    role.addToPolicy(
      new PolicyStatement({
        actions: ["dynamodb:GetItem"],
        resources: [`${urlMappingTable.tableArn}*`],
      })
    );

    return new NodejsFunction(this, "LookupOriginalUrlLambda", {
      functionName: `LookupOriginalUrlLambda`,
      entry: "lambda/lookup-original-url/index.ts",
      bundling: {
        minify: true,
        sourceMap: false,
      },
      tracing: Tracing.ACTIVE,
      timeout: Duration.seconds(5),
      role: role,
    });
  }

  private createApiGateway(
    generateShortUrlLambda: Function,
    lookupOriginalUrlLambda: Function
  ) {
    const httpApi = new CfnApi(this, "ShortUrlApiGateway", {
      name: `short-url-api`,
      description: `Api Gateway for short url.`,
      protocolType: "HTTP",
      corsConfiguration: {
        allowOrigins: ["*"],
        allowMethods: ["GET", "POST", "OPTIONS"],
        allowHeaders: ["*"],
      },
    });

    const stage = new CfnStage(this, "ShortUrlApiGatewayStage", {
      apiId: httpApi.ref,
      autoDeploy: true,
      stageName: "v1",
    });

    const policy = new PolicyStatement({
      effect: Effect.ALLOW,
      resources: [
        generateShortUrlLambda.functionArn,
        lookupOriginalUrlLambda.functionArn,
      ],
      actions: ["lambda:InvokeFunction"],
    });

    const role = new Role(this, `ShortUrlApiGatewayRole`, {
      assumedBy: new ServicePrincipal("apigateway.amazonaws.com"),
    });
    role.addToPolicy(policy);

    const generateShortUrlLambdaIntegration = new CfnIntegration(
      this,
      "GenerateShortUrlLambdaIntegration",
      {
        apiId: httpApi.ref,
        integrationType: "AWS_PROXY",
        payloadFormatVersion: "2.0",
        integrationUri: generateShortUrlLambda.functionArn,
        credentialsArn: role.roleArn,
      }
    );
    new CfnRoute(this, `GenerateShortUrlRoute`, {
      apiId: httpApi.ref,
      routeKey: "POST /generate",
      target: `integrations/${generateShortUrlLambdaIntegration.ref}`,
    });

    const lookupOriginalUrlIntegration = new CfnIntegration(
      this,
      "LookupOriginalUrlLambdaIntegration",
      {
        apiId: httpApi.ref,
        integrationType: "AWS_PROXY",
        payloadFormatVersion: "2.0",
        integrationUri: lookupOriginalUrlLambda.functionArn,
        credentialsArn: role.roleArn,
      }
    );
    new CfnRoute(this, `LookupOriginalUrlApiGatewayDefaultRoute`, {
      apiId: httpApi.ref,
      routeKey: "GET /lookup",
      target: `integrations/${lookupOriginalUrlIntegration.ref}`,
    });
  }
}
