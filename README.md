# BIXSO Company OS

BIXSO Company OS is a local web app for a one-person business. Keep a client request, the work you agree to do and the handover together. Download your records as JSON.

## Run the web app

You need Node.js and npm. Node.js 24 is the CI target. There are no dependencies to install and no account to set up. Open the extracted directory from [GitHub Releases](https://github.com/THANH-DAO-PTY-LTD/BIXSO-CompanyOS/releases) or clone the source:

```sh
git clone https://github.com/THANH-DAO-PTY-LTD/BIXSO-CompanyOS.git
cd BIXSO-CompanyOS
npm start
```

Open the URL printed in the terminal, normally `http://127.0.0.1:4310`. The app listens on this computer only. If the port is in use, run `npm start -- 4311` and use the new printed URL. Press Ctrl+C to stop the app. macOS is the verified setup for this candidate.

1. Fill in an example or enter your own fictional request and save it.
2. Create a job from that request and start it.
3. Record what you delivered, where to find it and how to check it. Add a follow-up if needed.
4. Download JSON. The export includes `schemaVersion`, requests and their linked jobs and handovers.

The app saves a handover note locally. Send the actual deliverable separately.

## Data and backups

Start from the same directory each time to use the same `.company-os/records.json`. The web app and CLI share these records. The JSON download is for moving or reading records, and the app currently has no import screen.

Before replacing application files, stop the server and copy the entire `.company-os` directory to a separate location. Keep the previous application artifact. To roll back, stop the new version and start the previous artifact with a copy of the pre-upgrade data. Preserve any records entered since the upgrade separately. See [release and compatibility notes](docs/RELEASE.md).

## CLI and tests

```sh
npm run demo
npm test
```

The demo prints a completed job and does not write records. Try entering your own fictional data in a fresh working directory, or run the following once in a fresh clone.

```sh
node src/cli.js intake "Juniper Studio" "One square product photo"
node src/cli.js open ENQ-1 "One 1200 × 1200 JPEG"
node src/cli.js start JOB-1
node src/cli.js list
node src/cli.js handover JOB-1 "product-square.jpg" "Shared folder" "Check size and crop" "Customer confirms Monday"
node src/cli.js list
```

Use the IDs returned by the commands if records already exist. Data is stored in the current directory under `.company-os/records.json`. The handover command records a note, and you send the actual deliverable separately. Keep the data fictional. If an interrupted command leaves `.company-os/write.lock`, first verify no command is writing, then move the lock directory aside before retrying. The last committed records are in `records.json`.

The prototype assumes one job per accepted request and three job statuses. Tell us where this is a poor fit using a fictional example. See [how to contribute](CONTRIBUTING.md) and [sample issues](docs/ISSUE-EXAMPLES.md). A link to the BIXSO Social guides and templates can be added once the library has a public URL.

## Community

[Open an issue](https://github.com/THANH-DAO-PTY-LTD/BIXSO-CompanyOS/issues/new/choose) with a fictional example, or see [how to contribute](CONTRIBUTING.md). Send security reports through the [private reporting channel](SECURITY.md).

## License

[MIT](LICENSE) · Copyright (c) 2026 Thanh Dao Pty Ltd.
