import { describe, expect, it } from "vitest";
import { curlLooksComplete, looksLikeCurl, parseCurl } from "./curlParser";

describe("looksLikeCurl", () => {
  it("detects multiline curl commands", () => {
    expect(
      looksLikeCurl(`curl 'https://dev-api.instage.xyz/task' \\
  -H 'accept: application/json' \\
  --data-raw '{"title":"1233"}'`),
    ).toBe(true);
  });

  it("does not match plain URLs", () => {
    expect(looksLikeCurl("https://api.example.com/users")).toBe(false);
  });
});

describe("curlLooksComplete", () => {
  it("treats truncated multiline paste as incomplete", () => {
    expect(curlLooksComplete("curl 'https://dev-api.instage.xyz/task' \\")).toBe(
      false,
    );
  });

  it("treats single-line curl with flags as complete", () => {
    expect(
      curlLooksComplete(
        "curl 'https://example.com' -H 'content-type: application/json' --data-raw '{\"a\":1}'",
      ),
    ).toBe(true);
  });
});

describe("parseCurl", () => {
  it("detects explicit POST", () => {
    const parsed = parseCurl(
      "curl -X POST 'https://api.example.com/data' -H 'Content-Type: application/json' -d '{\"key\":\"value\"}'",
    );
    expect(parsed?.method).toBe("POST");
    expect(parsed?.url).toBe("https://api.example.com/data");
  });

  it("infers POST when body is present without -X", () => {
    const parsed = parseCurl(
      "curl 'https://example.com' --data-raw '{\"foo\":\"bar\"}'",
    );
    expect(parsed?.method).toBe("POST");
    expect(parsed?.body).toContain("foo");
  });

  it("parses --request after URL", () => {
    const parsed = parseCurl("curl 'https://example.com/api' --request DELETE");
    expect(parsed?.method).toBe("DELETE");
  });

  it("handles --location with --request POST", () => {
    const parsed = parseCurl(
      "curl --location --request POST 'https://example.com/api'",
    );
    expect(parsed?.method).toBe("POST");
    expect(parsed?.url).toBe("https://example.com/api");
  });

  it("parses multiline curl with --data-raw", () => {
    const parsed = parseCurl(`curl 'https://dev-api.instage.xyz/task' \\
  -H 'content-type: application/json' \\
  --data-raw '{"title":"1233","status":"backlog"}'`);
    expect(parsed?.method).toBe("POST");
    expect(parsed?.url).toBe("https://dev-api.instage.xyz/task");
    expect(parsed?.body).toContain("1233");
    expect(parsed?.headers["content-type"]).toBe("application/json");
  });
});
