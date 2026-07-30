import { describe, expect, it } from "vitest";
import { decode, encode } from "../../packages/core/src/desk/service/rpc-codec";

describe("Desk RPC codec", () => {
  it("round-trips nested Uint8Array values", () => {
    const source = {
      args: [
        {
          name: "example.bin",
          content: new Uint8Array([0, 1, 2, 127, 255]),
        },
      ],
    };

    const encoded = encode(source);
    const decoded = decode<typeof source>(encoded);

    expect(encoded).toContain('"$u8"');
    expect(decoded.args[0].content).toBeInstanceOf(Uint8Array);
    expect([...decoded.args[0].content]).toEqual([0, 1, 2, 127, 255]);
  });

  it("preserves ordinary JSON values", () => {
    const source = { result: { ok: true, nullable: null, values: ["a", 2] } };
    expect(decode(encode(source))).toEqual(source);
  });
});
