import type { Request, Response } from 'express';
import fetch from 'node-fetch';

export async function teraDownloaderCcProxy(req: Request, res: Response) {
  const url = req.body.url;

  try {
    const params = new URLSearchParams();
    params.append("action", "terabox_fetch");
    params.append("url", url);
    params.append("nonce", "d65296dd2c"); // Use a valid nonce if required

    const response = await fetch("https://teradownloadr.cc/wp-admin/admin-ajax.php", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-requested-with": "XMLHttpRequest",
        "referer": "https://teradownloadr.cc/"
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
