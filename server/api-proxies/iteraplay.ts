import type { Request, Response } from 'express';
import fetch from 'node-fetch';

export async function iteraplayProxy(req: Request, res: Response) {
  const ITERAPLAY_API_KEY = "terabox_pro_api_august_2025_premium";
  const link = req.body.link;

  try {
    console.log("[IteraPlay Proxy] Endpoint hit");

    // 2. Get stream config
    const t = Date.now();
    const configRes = await fetch(`https://iteraplay.com/config-files/get-stream-api-config.php?t=${t}`, {
      method: "GET",
      headers: {
        "accept": "*/*",
        "accept-language": "en-US,en;q=0.9",
        "priority": "u=1, i",
        "sec-ch-ua": '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "referer": "https://stream.iteraplay.com/"
      }
    });
    const configData = await configRes.json();
    console.log("Stream config response:", configData);

    // 3. Stream request
    const streamRes = await fetch("https://api.iteraplay.com/stream.php", {
      method: "POST",
      headers: {
        "accept": "*/*",
        "accept-language": "en-US,en;q=0.9",
        "content-type": "application/json",
        "priority": "u=1, i",
        "sec-ch-ua": '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "x-api-key": ITERAPLAY_API_KEY,
        "referer": "https://stream.iteraplay.com/"
      },
      body: JSON.stringify({
        url: link,
        token: configData.token,
        t: configData.timestamp
      })
    });
    const streamData = await streamRes.json();
    console.log("Stream response:", streamData);
    res.json(streamData);
  } catch (err) {
    console.log("[IteraPlay Proxy] Error:", err);
    if (err instanceof Error) {
        res.status(500).json({ error: err.message });
    } else {
        res.status(500).json({ error: 'An unknown error occurred' });
    }
  }
}
