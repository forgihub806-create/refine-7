import type { Request, Response } from 'express';
import fetch from 'node-fetch';

export async function teradwnProxy(req: Request, res: Response) {
  const link = req.body.link;

  try {
    const params = new URLSearchParams();
    params.append("action", "terabox_fetch");
    params.append("url", link);
    params.append("nonce", "d65296dd2c"); // Updated nonce

    const response = await fetch("https://teradownloadr.com/wp-admin/admin-ajax.php", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-requested-with": "XMLHttpRequest",
        "referer": "https://teradownloadr.com/"
      },
      body: params.toString()
    });

    res.send(await response.text());
  } catch (err) {
    if (err instanceof Error) {
        res.status(500).json({ error: err.message });
    } else {
        res.status(500).json({ error: 'An unknown error occurred' });
    }
  }
}
