# Contribution Guide

Thanks for considering to contribute ❤️

## Where to start?

If you want to start right away, we recommend you to start from the open issues in the `Todo` state.

You can find them [here](https://github.com/orgs/tweakphp/projects/1)

Feel free to pick an unassigned one. Drop a comment so we can assign it to you.

**If you want to work on something which is not listed in the ToDo issues. Please read the below section!**

## Development Discussion

You may propose new features or improvements to existing behavior in the repository's [Discussion Board](https://github.com/tweakphp/tweakphp/discussions). If you propose a new feature, please be willing to implement at least some of the code that would be needed to complete the feature.

## Security Vulnerabilities

If you discover a security vulnerability within Laravel, please email to Saeed Vaziry at sa.vaziry@gmail.com. All security vulnerabilities will be promptly addressed.

## Coding Style

The coding style is already hardcoded in configurations inside the project.

You may run `npm run lint:fix` to fix your coding styles.

This command should be run before opening a PR, Otherwise, the checks on your PR will fail.

## Local Setup

Copy the `.env.dist` file as `.env`

Fill the variables.

for the `CLIENT_PATH` you need to enther either the client project's path or to one of the client files exist in the `public` directory. Pick the one that matches with your local PHP version.

Then run `npm install` to install the dependencies.

Now you may run `npm run dev` to start the app in development mode.

Also set `DEV` env to `true`

## Building

### macOS (without Apple signing keys)

If you don't have Apple Developer certificates, you can build locally by skipping code signing and notarization:

```bash
SKIP_NOTARIZE=true CSC_IDENTITY_AUTO_DISCOVERY=false npm run build-mac
```

The resulting DMG/app in `release/` will be unsigned — Gatekeeper may warn when opening it on other machines. For development/testing only.
