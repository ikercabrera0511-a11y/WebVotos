/**
 * Backend de votos — Cloudflare Worker + KV
 * ------------------------------------------
 * Esto es OPCIONAL. Sin esto, la landing funciona en "modo demo"
 * (cada visitante ve solo sus propios votos, guardados en su navegador).
 * Con esto desplegado, todos los visitantes comparten el mismo conteo
 * de votos en tiempo real.
 *
 * PASOS PARA DESPLEGAR:
 * 1. Instala wrangler: npm install -g wrangler
 * 2. wrangler login
 * 3. wrangler kv namespace create VOTES
 *    (te dará un "id", pégalo en wrangler.toml como se indica abajo)
 * 4. Crea un archivo wrangler.toml junto a este worker.js:
 *
 *    name = "votos-cantante"
 *    main = "worker.js"
 *    compatibility_date = "2024-01-01"
 *
 *    [[kv_namespaces]]
 *    binding = "VOTES"
 *    id = "PEGA_AQUI_EL_ID_QUE_TE_DIO_WRANGLER"
 *
 * 5. wrangler deploy
 * 6. Copia la URL que te da (algo como
 *    https://votos-cantante.tu-usuario.workers.dev) y pégala en
 *    CONFIG.API_URL dentro de index.html
 */

const ALLOWED_SONGS = ["adicto", "mala", "olvidate", "recuerdos"];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    if (url.pathname === "/votes" && request.method === "GET") {
      const data = (await env.VOTES.get("counts", "json")) || { adicto: 0, mala: 0, olvidate: 0, recuerdos: 0 };
      return new Response(JSON.stringify(data), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/vote" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: "JSON inválido" }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const { song, previousSong } = body;
      if (!ALLOWED_SONGS.includes(song)) {
        return new Response(JSON.stringify({ error: "canción inválida" }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const data = (await env.VOTES.get("counts", "json")) || { adicto: 0, mala: 0, olvidate: 0, recuerdos: 0 };
      data[song] = (data[song] || 0) + 1;
      if (previousSong && previousSong !== song && ALLOWED_SONGS.includes(previousSong)) {
        data[previousSong] = Math.max(0, (data[previousSong] || 0) - 1);
      }
      await env.VOTES.put("counts", JSON.stringify(data));

      return new Response(JSON.stringify(data), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response("Not found", { status: 404, headers: cors });
  },
};
