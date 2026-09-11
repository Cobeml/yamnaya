import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import { BlockList, isIP } from "node:net";
const blocked = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  blocked.addSubnet(network, prefix, "ipv4");
export function publicAddress(address: string) {
  return isIP(address) === 4
    ? !blocked.check(address, "ipv4")
    : isIP(address) === 6 &&
        /^[23]/.test(address) &&
        !address.toLowerCase().startsWith("2001:db8:") &&
        !address.toLowerCase().startsWith("2002:") &&
        !address.toLowerCase().startsWith("2001:0:");
}
export async function publicFetch(
  raw: string,
  redirects = 0,
  allowedHosts: string[] = ["*"],
): Promise<{
  url: string;
  status: number;
  headers: Record<string, string>;
  body: Buffer;
}> {
  const url = new URL(raw);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && !["80", "443"].includes(url.port))
  )
    throw new Error("Public HTTP(S) URL required");
  if (!allowedHosts.includes("*") && !allowedHosts.includes(url.hostname))
    throw new Error("Redirect or resource host is outside the grant");
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = await lookup(hostname, { all: true });
  if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
    throw new Error(
      "Private and reserved addresses are outside the public research grant",
    );
  const address = addresses.find(a=>a.family===4) ?? addresses[0];
  const response = await new Promise<{
    status: number;
    headers: Record<string, string>;
    body: Buffer;
  }>((resolve, reject) => {
    const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(
      url,
      {
        method: "GET",
        headers: {
          "User-Agent": "Yamnaya-Research/1.0",
          "Accept-Encoding": "identity",
        },
        lookup: (_host, options, cb) => {
          if (options.all)
            (cb as unknown as (e: null, v: typeof addresses) => void)(null, [
              address,
            ]);
          else cb(null, address.address, address.family);
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        let length = 0;
        res.on("data", (chunk) => {
          length += chunk.length;
          if (length > 5_000_000)
            request.destroy(new Error("Resource exceeds 5 MB"));
          else chunks.push(chunk);
        });
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 500,
            headers: Object.fromEntries(
              Object.entries(res.headers).filter(
                ([, v]) => typeof v === "string",
              ),
            ) as Record<string, string>,
            body: Buffer.concat(chunks),
          }),
        );
        res.on("error", reject);
      },
    );
    request.setTimeout(20000, () =>
      request.destroy(new Error("Public fetch timed out")),
    );
    request.on("error", reject);
    request.end();
  });
  if (
    response.status >= 300 &&
    response.status < 400 &&
    response.headers.location
  ) {
    if (redirects >= 4) throw new Error("Too many redirects");
    return publicFetch(
      new URL(response.headers.location, url).href,
      redirects + 1,
      allowedHosts,
    );
  }
  return { url: url.href, ...response };
}
