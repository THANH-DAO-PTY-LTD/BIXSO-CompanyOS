# BIXSO Service OS

A local web app for a one-person business. **Company** shows how your business works. **Flow** is a reusable process you can edit in Create Studio. **Work** is a concrete job linked to a Flow step.

## Try the preview

Use Node.js 24 and npm. Clone the repository or download and unpack the [prerelease source](https://github.com/THANH-DAO-PTY-LTD/BIXSO-Service-OS/releases). In the source directory, run:

```sh
npm ci
npm start
```

Open the loopback URL printed in the terminal. On the sample Company, open **Product photography**, then **View work: Prepare product photo**. Select the fictional job and save a handover note. Use **Create Studio** to draw or edit a Flow. **Save** stores a draft, and **Activate locally** makes the Flow available for **New Work**.

## Limits of this preview

Use fictional records. The app stores them in the current browser profile and local URL. It has no import, export or backup feature in this preview and does not read earlier CLI JSON. The Sela Designer demo proposes a fixed example graph. It makes no model calls and performs no Work. Keep the development server on loopback.

## Try it and help shape it

[Share feedback](https://github.com/THANH-DAO-PTY-LTD/BIXSO-Service-OS/issues) about setup or a step that didn't fit your workflow. A fictional example helps others reproduce it. A challenge we'd like to build with contributors is an opt-in assistant that performs one clearly defined Work item and returns a result the owner can inspect. Propose a task, its expected output and how the owner can tell it succeeded.

Run `npm test` and `npm run build` before opening a pull request. See [CONTRIBUTING](CONTRIBUTING.md) and the [private security reporting channel](SECURITY.md).

## License

[MIT](LICENSE) · Copyright (c) 2026 Thanh Dao Pty Ltd. [Dependency notices](docs/PROVENANCE.md).

The software is provided under the MIT license. Nothing in that license or in this repository excludes, restricts or modifies any right or remedy you have under the Australian Consumer Law, or any other law, that cannot lawfully be excluded.
