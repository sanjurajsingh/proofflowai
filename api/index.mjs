import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import server from "../dist/server/server.js";

export const config = {
  maxDuration: 30,
};

function getHeaderValue(value) {
  return Array.isArray(value) ? value.join(", ") : value;
}

function toWebRequest(req) {
  const forwardedHost = getHeaderValue(req.headers["x-forwarded-host"]);
  const forwardedProto = getHeaderValue(req.headers["x-forwarded-proto"]);
  const host = forwardedHost || req.headers.host || "localhost";
  const protocol = forwardedProto || "https";
  const url = new URL(req.url || "/", `${protocol}://${host}`);
  const headers = new Headers();

  for (const [name, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
    } else if (value !== undefined) {
      headers.set(name, value);
    }
  }

  const method = req.method || "GET";
  const init = { method, headers };
  if (method !== "GET" && method !== "HEAD") {
    init.body = req;
    init.duplex = "half";
  }

  return new Request(url, init);
}

async function sendWebResponse(res, webResponse) {
  res.statusCode = webResponse.status;
  res.statusMessage = webResponse.statusText;

  webResponse.headers.forEach((value, name) => {
    res.setHeader(name, value);
  });

  if (!webResponse.body) {
    res.end();
    return;
  }

  await pipeline(Readable.fromWeb(webResponse.body), res);
}

export default async function handler(req, res) {
  try {
    const webRequest = toWebRequest(req);
    const webResponse = await server.fetch(webRequest, process.env, {});
    await sendWebResponse(res, webResponse);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("content-type", "text/plain; charset=utf-8");
    }
    res.end("Internal Server Error");
  }
}
