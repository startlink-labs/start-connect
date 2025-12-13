import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
	it("renders the main heading", () => {
		render(<App />);
		expect(screen.getByText("SF HS File Transfer App")).toBeInTheDocument();
	});

	it("shows backend status section", () => {
		render(<App />);
		expect(screen.getByText("バックエンド状態")).toBeInTheDocument();
	});

	it("shows API test section", () => {
		render(<App />);
		expect(screen.getByText("API テスト")).toBeInTheDocument();
	});

	it("shows technology stack", () => {
		render(<App />);
		expect(screen.getByText("技術スタック")).toBeInTheDocument();
		expect(screen.getByText("• React 19 + TypeScript")).toBeInTheDocument();
	});
});
