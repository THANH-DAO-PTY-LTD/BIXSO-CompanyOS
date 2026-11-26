# Contributing

Use a GitHub issue for workflow feedback or a bug. Include a fictional example, the command you ran, the result you expected, and what happened. For changes to the workflow, describe the decision the operator needs to make.

1. Clone the repo and create a branch with `git switch -c fix/short-description`.
2. Run `npm test` and `npm run demo`.
3. Add a test that captures the behavior, make the smallest change, and run `npm test` again.
4. Open a PR with the linked issue, a short description, and your test result. The maintainer checks the change and CI before merging.

Submit only material you have the right to contribute. Contributions to this repository are provided under its [MIT license](LICENSE).
