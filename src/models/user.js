import "server-only";
import logger from "@utils/shared/logger";
import { ddb } from "@utils/server/db-client";
import {
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { normalizeEmail } from "@utils/server/normalize-email";
import notionConfigTemplate from "@templates/notion_config.json";

const TABLE_NAME = process.env.DYNAMODB_USER_TABLE;

// Get user by UUID
export const getUserById = async (id) => {
  try {
    const result = await ddb.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { uuid: id },
      }),
    );
    return result.Item;
  } catch (error) {
    logger.error("Error getting user by ID", error);
    throw error;
  }
};

// Get user by email (requires GSI: EmailIndex)
export const getUserByEmail = async (email) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  try {
    const result = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "EmailIndex",
        KeyConditionExpression: "email = :email",
        ExpressionAttributeValues: {
          ":email": normalizedEmail,
        },
      }),
    );
    return result.Items?.[0] || null;
  } catch (error) {
    logger.error("Error getting user by email", error);
    throw error;
  }
};

// Get all users (scan all)
export const getAllUsers = async () => {
  try {
    const result = await ddb.send(
      new ScanCommand({
        TableName: TABLE_NAME,
      }),
    );
    return result.Items || [];
  } catch (error) {
    logger.error("Error getting all users", error);
    throw error;
  }
};

// Get user by provider and providerSub
export const getUserByProviderSub = async (provider, sub) => {
  const r = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "ProviderSubIndex",
      KeyConditionExpression: "provider = :p AND providerSub = :s",
      ExpressionAttributeValues: { ":p": provider, ":s": sub },
      Limit: 1,
    }),
  );
  return r.Items?.[0] || null;
};

// Get daily user counts for the last 14 days
export const getDailyUserCountsLast14 = async () => {
  const today = new Date();
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today.getTime() - (13 - i) * 24 * 3600 * 1000);
    return d.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  });

  const jobs = days.map(async (day) => {
    const out = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "createdAtIndex",
        KeyConditionExpression: "createdAt = :d",
        ExpressionAttributeValues: { ":d": day },
        Select: "COUNT",
      }),
    );
    return { createdAt: day, count: out.Count || 0 };
  });

  return Promise.all(jobs);
};

// Create a Google-authenticated user record.
export const createUser = async (userData) => {
  const provider = userData.provider || "google";
  const now = new Date();
  const createdAtISO = now.toISOString();
  const createdAtDate = createdAtISO.slice(0, 10); // "YYYY-MM-DD"
  const createdAtMs = now.getTime(); // epoch (UTC)
  const normalizedEmail = normalizeEmail(userData.email);

  if (!normalizedEmail) throw new Error("Email is required!");
  if (provider !== "google") {
    throw new Error("Only Google-authenticated users are supported.");
  }
  if (!userData.providerSub) {
    throw new Error("Google providerSub is required.");
  }
  const username = userData.username || normalizedEmail.split("@")[0];

  const item = {
    uuid: uuidv4(),
    email: normalizedEmail,
    username,
    role: userData.role ?? "user",
    image: userData.image ?? null,
    provider: provider,
    providerSub: userData.providerSub,
    createdAt: createdAtDate,
    createdAtMs: createdAtMs,
    updatedAt: createdAtDate,
    updatedAtMs: createdAtMs,
    lastLoginAt: createdAtDate,
    lastLoginAtMs: createdAtMs,
    lastLoginLocation: userData.lastLoginLocation ?? null,
    emailVerified: true,
    plan: userData.plan ?? "free",
  };

  try {
    await ddb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
        ConditionExpression: "attribute_not_exists(#uuid)",
        ExpressionAttributeNames: { "#uuid": "uuid" },
      }),
    );
    return item;
  } catch (error) {
    logger.error("Error creating user", error);
    throw error;
  }
};

// Update user by ID
export const updateUser = async (id, updateData) => {
  const now = new Date();
  const updatedAtDate = now.toISOString().slice(0, 10); // "YYYY-MM-DD"
  const updatedAtMs = now.getTime(); // epoch ms (UTC)

  const updateExpressions = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {
    ":updatedAt": updatedAtDate,
    ":updatedAtMs": updatedAtMs,
  };

  for (const key in updateData) {
    if (key !== "uuid" && key !== "id") {
      updateExpressions.push(`#${key} = :${key}`);
      expressionAttributeNames[`#${key}`] = key;
      expressionAttributeValues[`:${key}`] = updateData[key];
    }
  }

  updateExpressions.push("#updatedAt = :updatedAt");
  updateExpressions.push("#updatedAtMs = :updatedAtMs");
  expressionAttributeNames["#updatedAt"] = "updatedAt";
  expressionAttributeNames["#updatedAtMs"] = "updatedAtMs";

  try {
    const result = await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { uuid: id },
        UpdateExpression: "SET " + updateExpressions.join(", "),
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: "ALL_NEW",
      }),
    );
    return result.Attributes;
  } catch (error) {
    logger.error("Error updating user", error);
    throw error;
  }
};

export const updateLastLogin = async (uuid, ip = null, when = new Date()) => {
  try {
    const dateStr = when.toISOString().slice(0, 10);
    const ms = when.getTime();

    await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { uuid },
        UpdateExpression:
          "SET lastLoginAt = :dt, lastLoginAtMs = :ms, updatedAt = :dt, updatedAtMs = :ms" +
          (ip ? ", lastLoginLocation = :ip" : ""),
        ExpressionAttributeValues: {
          ":dt": dateStr,
          ":ms": ms,
          ...(ip && { ":ip": ip }),
        },
        ConditionExpression: "attribute_exists(#uuid)",
        ExpressionAttributeNames: { "#uuid": "uuid" },
      }),
    );
  } catch (err) {
    logger.error("Error updating lastLogin", err);
    throw err;
  }
};

// Delete user by ID
export const deleteUser = async (id) => {
  try {
    await ddb.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { uuid: id },
      }),
    );
    return { success: true };
  } catch (error) {
    logger.error("Error deleting user", error);
    throw error;
  }
};

// Get Notion config by UUID
export async function getNotionConfigByUuid(uuid) {
  try {
    const result = await ddb.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { uuid },
        ProjectionExpression: "notionConfig",
      }),
    );

    return result.Item?.notionConfig;
  } catch (err) {
    logger.error(
      { err, uuid },
      "[db] Failed to get Notion config from DynamoDB",
    );
    throw err;
  }
}

// Update Notion config
export async function updateNotionConfigByUuid(uuid, config) {
  const now = new Date();
  const updatedAtDate = now.toISOString().slice(0, 10); // "YYYY-MM-DD"
  const updatedAtMs = now.getTime(); // epoch ms (UTC)
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { uuid },
        UpdateExpression:
          "SET notionConfig = :cfg, updatedAt = :updatedAtDate, updatedAtMs = :updatedAtMs",
        ConditionExpression: "attribute_exists(#uuid)",
        ExpressionAttributeNames: {
          "#uuid": "uuid",
        },
        ExpressionAttributeValues: {
          ":cfg": config,
          ":updatedAtDate": updatedAtDate,
          ":updatedAtMs": updatedAtMs,
        },
        ReturnValues: "ALL_NEW",
      }),
    );
  } catch (err) {
    logger.error({ err, uuid }, "[db] Failed to update user.notionConfig");
    throw err;
  }
}

// Upload Notion config to default template
export async function uploadNotionConfigTemplateByUuid(uuid) {
  try {
    const notionConfig = JSON.parse(JSON.stringify(notionConfigTemplate));
    const now = Date.now();

    await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { uuid },
        UpdateExpression: "SET notionConfig = :cfg, updatedAt = :now",
        ConditionExpression: "attribute_exists(#uuid)",
        ExpressionAttributeNames: {
          "#uuid": "uuid",
        },
        ExpressionAttributeValues: {
          ":cfg": notionConfig,
          ":now": now,
        },
        ReturnValues: "ALL_NEW",
      }),
    );

    return notionConfig;
  } catch (err) {
    logger.error({ err, uuid }, "[db] Failed to update user.notionConfig");
    throw err;
  }
}
