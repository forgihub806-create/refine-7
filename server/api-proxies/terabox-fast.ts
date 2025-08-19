import type { Request, Response } from 'express';
import fetch from 'node-fetch';

export async function teraboxFastProxy(req: Request, res: Response) {
  const url = req.body.url;
  try {
    const response = await fetch("https://hex.teraboxfast2.workers.dev/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url, key: "C7mAq" })
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
