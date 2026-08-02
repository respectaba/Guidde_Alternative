/**
 * Small helpers for JSON responses and permissive CORS. The extension's service
 * worker POSTs guides here from a chrome-extension:// origin, so the guide API
 * routes echo permissive CORS headers and answer preflight OPTIONS.
 */
import { NextResponse } from "next/server";

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function json(data: unknown, init?: { status?: number }): NextResponse {
  return NextResponse.json(data, {
    status: init?.status ?? 200,
    headers: CORS_HEADERS,
  });
}

export function error(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    { error: message, ...(details ? { details } : {}) },
    { status, headers: CORS_HEADERS },
  );
}

export function preflight() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
