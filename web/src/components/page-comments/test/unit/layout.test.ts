import {expect} from "@open-wc/testing";
import {computeRailLayout, type RailCard} from "../../layout.js";

function card(id: string, idealTop: number, height = 60): RailCard {
  return {id, idealTop, height};
}

describe("computeRailLayout", () => {
  it("keeps non-overlapping cards at their ideal tops", () => {
    const tops = computeRailLayout([card("a", 100), card("b", 300)], null);
    expect(tops.get("a")).to.equal(100);
    expect(tops.get("b")).to.equal(300);
  });

  it("stacks colliding cards with the minimum gap", () => {
    // a and b want the same slot; document order splits them around the gap.
    const tops = computeRailLayout([card("a", 200), card("b", 200)], null);
    expect(tops.get("a")).to.equal(200);
    expect(tops.get("b")).to.equal(200 + 60 + 8);
  });

  it("pins the focused card even when neighbours crowd it", () => {
    const tops = computeRailLayout(
      [card("a", 100), card("focused", 120), card("b", 140)],
      "focused",
    );
    expect(tops.get("focused")).to.equal(120);
    // a must stay clear above the focused card; b below it.
    expect(tops.get("a")).to.equal(120 - 60 - 8);
    expect(tops.get("b")).to.equal(120 + 60 + 8);
  });

  it("pushes a chain of cards above the focused one upward", () => {
    const tops = computeRailLayout(
      [card("top", 10), card("mid", 70), card("focused", 600)],
      "focused",
    );
    // mid keeps its ideal top (no collision), top is pushed above mid.
    expect(tops.get("mid")).to.equal(70);
    expect(tops.get("top")).to.equal(70 - 60 - 8);
  });

  it("pushes cards below the focused one downward", () => {
    const tops = computeRailLayout(
      [card("focused", 100), card("a", 110), card("b", 115)],
      "focused",
    );
    expect(tops.get("focused")).to.equal(100);
    expect(tops.get("a")).to.equal(100 + 60 + 8);
    expect(tops.get("b")).to.equal(100 + 60 + 8 + 60 + 8);
  });

  it("respects the viewport clamp band", () => {
    const tops = computeRailLayout([card("a", -50)], null, {minTop: 8, maxTop: 800});
    expect(tops.get("a")).to.equal(8);
  });

  it("clamps the focused card into the band too", () => {
    const tops = computeRailLayout([card("focused", 10_000)], "focused", {minTop: 8, maxTop: 800});
    expect(tops.get("focused")).to.equal(800 - 60);
  });

  it("handles an empty card list", () => {
    expect(computeRailLayout([], null).size).to.equal(0);
  });
});
