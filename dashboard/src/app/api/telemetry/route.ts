import { NextRequest, NextResponse } from 'next/server';
import { getLiveSnapshot, ingestTelemetry, isValidIncomingTelemetry } from '@/lib/telemetryStore';

export async function GET() {
  return NextResponse.json(getLiveSnapshot());
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body.' },
      { status: 400 }
    );
  }

  if (!isValidIncomingTelemetry(body)) {
    return NextResponse.json(
      {
        error:
          'Invalid payload. Required: node_id, lat, lng, acceleration_g, gas_raw, motion.',
      },
      { status: 400 }
    );
  }

  const snapshot = ingestTelemetry(body);
  return NextResponse.json(snapshot, { status: 202 });
}
