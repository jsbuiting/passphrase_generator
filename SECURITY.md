# Security

## Security model
- Passphrases are generated entirely in the browser. Every random choice uses `crypto.getRandomValues` with rejection sampling, so there is no modulo bias. If the Web Crypto API is unavailable, generation fails instead of falling back to a weaker source.
- A generated passphrase is never sent over the network, written to browser storage, put in the URL or logged. The only things kept in `localStorage` are the display order of the parts and which parts and word lists are switched on.
- The page makes two same-origin requests, for the word lists in `data/`. If either fails or does not look like a word list, no passphrase is generated.
- The server only serves static files. It sets a strict Content-Security-Policy (`default-src 'self'`, no inline scripts or styles, no third-party origins) and keeps no access log.
- There are no runtime dependencies, analytics or third-party scripts.

## What is out of scope
- Anything already running on your device or in your browser (malware, extensions, a shared clipboard). Once you copy a passphrase, it is in your clipboard until you replace it.
- The strength of a passphrase you type or edit yourself.

## Reporting a vulnerability
Please report security issues privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability**. Do not open a public issue for something that could put users at risk.

Include what you found, how to reproduce it and the browser you used. You can expect a first reply within a week.
