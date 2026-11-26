import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import TapGrid from "../components/live/TapGrid.jsx";
import StageRail from "../components/live/StageRail.jsx";
import CallList from "../components/CallList.jsx";
import { DEFAULT_CONTENT } from "../data/defaultContent.js";

describe("TapGrid", () => {
  it("marks the chosen tap and reports clicks", () => {
    const onChange = vi.fn();
    const taps = DEFAULT_CONTENT.stages[0].taps;
    render(<TapGrid taps={taps} value="right_person" onChange={onChange} />);
    fireEvent.click(screen.getByText("Switchboard / reception"));
    expect(onChange).toHaveBeenCalledWith("switchboard");
  });
});

describe("StageRail", () => {
  it("flags the current stage and lets you jump", () => {
    const onPick = vi.fn();
    render(<StageRail stages={DEFAULT_CONTENT.stages} stageNo={3} onPick={onPick} logged={new Set([1])} />);
    const current = screen.getByRole("button", { current: "step" });
    expect(current).toHaveAttribute("title", DEFAULT_CONTENT.stages[2].name);
    fireEvent.click(screen.getByTitle(DEFAULT_CONTENT.stages[0].name));
    expect(onPick).toHaveBeenCalledWith(1);
    // Stage 2 was jumped over with no tap: it must not look done.
    expect(screen.getByTitle(`${DEFAULT_CONTENT.stages[1].name} (nothing tapped)`)).toBeInTheDocument();
  });
});

describe("CallList", () => {
  it("imports a CSV and lists prospects in order", async () => {
    render(<CallList onStart={() => {}} />);
    const file = new File(["name,company,role\nAsha,Acme Tools,Owner\nRavi,Beta Castings,MD\n"], "list.csv", { type: "text/csv" });
    fireEvent.change(document.getElementById("call-list-file"), { target: { files: [file] } });
    expect(await screen.findByText("Asha")).toBeInTheDocument();
    expect(screen.getByText("2 of 2 left")).toBeInTheDocument();
    fireEvent.click(screen.getAllByText("Skip")[0]);
    expect(screen.getByText("1 of 2 left")).toBeInTheDocument();
  });
});
