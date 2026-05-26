import { NextResponse } from "next/server";
import { createH5PBuffer, h5pFileName, type GenerateH5PRequest } from "@/lib/h5pPackage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateH5PRequest;

    if (!body.youtubeUrl || !body.title || !Array.isArray(body.interactions)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const buffer = createH5PBuffer(body);
    const fileName = h5pFileName(body.title);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to generate H5P package" }, { status: 500 });
  }
}
