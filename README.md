# Passphrase Generator

A small, fully client-side passphrase generator. Words, digits and special characters are picked in your browser with the Web Crypto API; nothing is sent anywhere and the server stores no data.

Live at https://passphrase.buiting.uk

## Develop
```bash
npm ci
npm test
npm run lint
npm run build:css   # regenerate css/tailwind.css
```
Open `index.html` via any static server (e.g. `python3 -m http.server`).

## Run the container locally
```bash
docker build -t passphrase-generator .
docker run --rm -p 8080:8080 passphrase-generator
```
Deployment: see [`docs/architecture/deploy_runbook.md`](docs/architecture/deploy_runbook.md).

## Security
Passphrases are generated in the browser with `crypto.getRandomValues` and are never stored or transmitted. See [`SECURITY.md`](SECURITY.md) for the security model and how to report a vulnerability.

## License
Code: [MIT](LICENSE). The Inter font is licensed under the SIL Open Font License 1.1, see [`fonts/LICENSE.txt`](fonts/LICENSE.txt).
