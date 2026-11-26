# Data portability and upgrades

The first candidate has record schema version 1. Earlier versionless CLI records are read as version 1. On the first successful write they acquire the version field. Unknown schema versions are refused. The JSON export includes the schema version, request identifiers and linked jobs with handover details. It does not include the files mentioned in handover notes.

For a fresh install, extract the archive into a new directory and run npm start from that directory. To upgrade, stop the old instance, keep the old artifact and a separate copy of its data directory, then copy the data into the new installation before starting it. Verify request and job counts and open a previous handover. If verification fails, stop the new version, keep any new records separately, and run the old artifact with the untouched backup. Keep a separate copy of exported JSON if you need a portable copy.

The first candidate has no earlier downloadable release to test against. Compatibility with the earlier CLI format is covered by an automated test.
