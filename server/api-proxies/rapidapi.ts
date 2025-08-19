import type { Request, Response } from 'express';
import fetch from 'node-fetch';

export async function rapidapiProxy(req: Request, res: Response) {
  const link = req.body.link;

  try {
    const response = await fetch("https://terabox-downloader-direct-download-link-generator.p.rapidapi.com/fetch", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-rapidapi-host": "terabox-downloader-direct-download-link-generator.p.rapidapi.com",
        "x-rapidapi-key": "2cb187dc2bmshda738c7c9dddce5p1e7b42jsn02015b25be9c" // Updated key
      },
      body: JSON.stringify({ url: link })
    });
    res.json(await response.json());
  } catch (err) {
    if (err instanceof Error) {
        res.status(500).json({ error: err.message });
    } else {
        res.status(500).json({ error: 'An unknown error occurred' });
    }
  }
}
