export default {
  async fetch(request, env) {

    const cors = {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Max-Age":       "86400",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: cors });
    }

    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "") {
      return new Response(
        JSON.stringify({ status: "ok", message: "Leaked Archives Upload API" }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    if (request.method === "POST" && url.pathname === "/get-upload-url") {
      try {
        const body     = await request.json();
        const raw      = (body.filename || "video.mp4")
                          .replace(/[^a-zA-Z0-9._-]/g, "_")
                          .toLowerCase();
        const filename = `${Date.now()}_${raw}`;

        return new Response(
          JSON.stringify({
            uploadUrl: `${url.origin}/upload/${filename}`,
            publicUrl: `https://pub-947189f89d8c4deba38620dab133e00a.r2.dev/${filename}`,
            filename
          }),
          { headers: { ...cors, "Content-Type": "application/json" } }
        );
      } catch(e) {
        return new Response(
          JSON.stringify({ error: e.message }),
          { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }
    }

    if (request.method === "PUT" && url.pathname.startsWith("/upload/")) {
      const filename    = decodeURIComponent(url.pathname.replace("/upload/", ""));
      const contentType = request.headers.get("Content-Type") || "video/mp4";

      if (!env.R2_BUCKET) {
        return new Response(
          JSON.stringify({ error: "R2_BUCKET binding missing" }),
          { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      try {
        const buffer = await request.arrayBuffer();
        await env.R2_BUCKET.put(filename, buffer, {
          httpMetadata: { contentType }
        });

        return new Response(
          JSON.stringify({
            success:   true,
            filename,
            publicUrl: `https://pub-947189f89d8c4deba38620dab133e00a.r2.dev/${filename}`
          }),
          { headers: { ...cors, "Content-Type": "application/json" } }
        );
      } catch(e) {
        return new Response(
          JSON.stringify({ error: "R2 write failed: " + e.message }),
          { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: "Not found" }),
      { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
};